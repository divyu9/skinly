import * as admin from "firebase-admin";
import * as crypto from "crypto";
import { onCall, HttpsError } from "firebase-functions/v1/https";
import { requireAdmin } from "./auth";

/**
 * Meta Conversions API: the shop's own server tells Meta about checkouts and
 * purchases, beside the browser Pixel.
 *
 * The dataset's last server event was 2025-12-07 — nothing in the code sent
 * any. Browser events alone miss buyers whose browser blocks the Pixel and
 * buyers who pay on PhonePe and never come back to the order page.
 *
 * What goes when:
 *   InitiateCheckout, AddPaymentInfo — once placeOrder has written the order
 *     (the browser sent both earlier, with these same event_ids).
 *   Purchase — only when the money is confirmed: PhonePe's callback or the
 *     status check (applyPaymentResult in phonepe.ts). Never on the button.
 *     COD orders only with META_CAPI_COD_PURCHASE=true.
 * Each event carries the browser's event_id (ic-…, api-…, purchase-<number>)
 * so Meta keeps one of each pair, and the order's own customer data, hashed.
 *
 * Env (functions/.env): META_CAPI_TOKEN (required; nothing is sent without
 * it), META_TEST_EVENT_CODE (while set, every event goes to Events Manager ›
 * Test Events and is NOT used for ads — remove it after testing),
 * META_PIXEL_ID, META_GRAPH_VERSION, META_CAPI_ENABLED=false (kill switch),
 * META_CAPI_COD_PURCHASE=true. A failure is logged on the order (metaCapi.*)
 * and in the function log; it never blocks or fails an order.
 */

const PIXEL_ID = () => process.env.META_PIXEL_ID || "1037478581823270";
const GRAPH_VERSION = () => process.env.META_GRAPH_VERSION || "v26.0";
const TOKEN = () => process.env.META_CAPI_TOKEN || "";
const TEST_CODE = () => process.env.META_TEST_EVENT_CODE || "";
export const capiEnabled = () => !!TOKEN() && process.env.META_CAPI_ENABLED !== "false";
export const capiCodPurchase = () => process.env.META_CAPI_COD_PURCHASE === "true";

const SITE = "https://goskinly.com";

// ── The browser's numbers, matched exactly (src/lib/analytics.ts) ───────────
/** trackPurchase sends eventID `purchase-<order number>`. */
export const purchaseEventId = (order: any) => `purchase-${String(order?.orderNumber || "")}`;
/** trackPurchaseOnce reports order.total (what was charged, after coupon and wallet). */
export const purchaseValue = (order: any) => Math.round((Number(order?.total ?? order?.amountPayable) || 0) * 100) / 100;

// ── Hashing, as Meta normalises (lowercase, trimmed; see Customer Information Parameters) ──
const sha = (v: string | undefined) => (v ? crypto.createHash("sha256").update(v).digest("hex") : undefined);
// Letters only: accents dropped (NFKD + combining marks), Latin and Indic scripts kept.
const letters = (s: unknown) => String(s || "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z\u00c0-\u024f\u0900-\u0dff]/g, "");
function phone91(p: unknown): string | undefined {
  let d = String(p || "").replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  if (d.length === 10) d = `91${d}`;
  return d.length === 12 && d.startsWith("91") ? d : undefined;
}
function names(full: unknown): { fn?: string; ln?: string } {
  const parts = String(full || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return {};
  return { fn: letters(parts[0]) || undefined, ln: parts.length > 1 ? letters(parts[parts.length - 1]) || undefined : undefined };
}

type Tracking = {
  fbp?: string; fbc?: string; fbclid?: string; clientIp?: string; userAgent?: string;
  eventSourceUrl?: string; initiateCheckoutAt?: number; initiateCheckoutEventId?: string; addPaymentInfoEventId?: string;
};

function userData(order: any): Record<string, unknown> {
  const a = order?.shippingAddress || {};
  const t: Tracking = order?.tracking || {};
  const email = String(order?.email || order?.customerEmail || order?.guestEmail || "").trim().toLowerCase();
  const { fn, ln } = names(a.fullName || order?.customerName);
  const zip = String(a.pincode || "").replace(/\D/g, "").slice(0, 6);
  const external = String(order?.ownerUid || "") || phone91(a.phone || order?.phone) || "";
  const u: Record<string, unknown> = {
    em: email.includes("@") ? [sha(email)] : undefined,
    ph: phone91(a.phone || order?.phone) ? [sha(phone91(a.phone || order?.phone))] : undefined,
    fn: fn ? [sha(fn)] : undefined,
    ln: ln ? [sha(ln)] : undefined,
    ct: letters(a.city) ? [sha(letters(a.city))] : undefined,
    st: letters(a.state) ? [sha(letters(a.state))] : undefined,
    zp: zip.length === 6 ? [sha(zip)] : undefined,
    country: [sha("in")],
    external_id: external ? [sha(external)] : undefined,
    // Not hashed, as Meta asks.
    client_ip_address: t.clientIp || undefined,
    client_user_agent: t.userAgent || undefined,
    fbp: t.fbp || undefined,
    fbc: t.fbc || undefined,
  };
  for (const k of Object.keys(u)) if (u[k] === undefined) delete u[k];
  return u;
}

function contents(order: any) {
  const items = Array.isArray(order?.items) ? order.items : [];
  // content_ids as the browser sends them: productId, else the SKU.
  const ids = items.map((i: any) => String(i?.productId || i?.sku || "")).filter(Boolean);
  return {
    content_ids: ids,
    content_type: "product",
    contents: items.map((i: any) => ({ id: String(i?.productId || i?.sku || ""), quantity: Number(i?.quantity) || 1, item_price: Number(i?.price) || 0 })),
    num_items: items.reduce((n: number, i: any) => n + (Number(i?.quantity) || 1), 0),
  };
}

const sec = (ms: number) => Math.floor(ms / 1000);
/** Meta refuses events older than 7 days; a stale time becomes now. */
const eventTime = (ms?: number) => {
  const now = Date.now();
  return sec(ms && ms > now - 6.5 * 24 * 3600_000 && ms <= now + 60_000 ? ms : now);
};

export type CapiResult = { ok: boolean; status?: number; error?: string; fbtraceId?: string; eventsReceived?: number; testCode?: string };

/** POSTs events to the dataset. Never throws. */
export async function sendCapiEvents(events: any[], opts: { testEventCode?: string } = {}): Promise<CapiResult> {
  if (!capiEnabled()) return { ok: false, error: "disabled (no META_CAPI_TOKEN or META_CAPI_ENABLED=false)" };
  const testCode = opts.testEventCode || TEST_CODE();
  const url = `https://graph.facebook.com/${GRAPH_VERSION()}/${PIXEL_ID()}/events?access_token=${encodeURIComponent(TOKEN())}`;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 8000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: events, ...(testCode ? { test_event_code: testCode } : {}) }),
      signal: ctl.signal,
    });
    const text = await res.text();
    let j: any = {};
    try { j = JSON.parse(text); } catch { /* not JSON */ }
    if (!res.ok || j?.error) {
      return { ok: false, status: res.status, error: String(j?.error?.message || text).slice(0, 300), fbtraceId: j?.error?.fbtrace_id || j?.fbtrace_id, testCode: testCode || undefined };
    }
    return { ok: true, status: res.status, eventsReceived: Number(j?.events_received) || 0, fbtraceId: j?.fbtrace_id, testCode: testCode || undefined };
  } catch (e: any) {
    return { ok: false, error: e?.name === "AbortError" ? "timeout after 8s" : String(e?.message || e).slice(0, 300) };
  } finally {
    clearTimeout(timer);
  }
}

export function buildPurchaseEvent(orderId: string, order: any, eventId = purchaseEventId(order)) {
  return {
    event_name: "Purchase",
    event_time: eventTime(Date.now()),
    event_id: eventId,
    action_source: "website",
    // Where the browser fires its Purchase: the order's page.
    event_source_url: `${SITE}/orders/${orderId}`,
    user_data: userData(order),
    custom_data: { currency: "INR", value: purchaseValue(order), order_id: String(order?.orderNumber || orderId), ...contents(order) },
  };
}

/**
 * The Purchase for a paid order, once: a transaction claims metaCapi.purchase
 * first, so the PhonePe callback and the status check (which both confirm the
 * same payment) cannot both send it. Never throws.
 */
export async function sendPurchaseForOrder(db: admin.firestore.Firestore, orderId: string, via: string): Promise<void> {
  try {
    if (!capiEnabled()) return;
    const ref = db.collection("orders").doc(orderId);
    const order = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return null;
      const o = snap.data() as any;
      if (o?.metaCapi?.purchase?.claimedAt || !o?.orderNumber || o?.isDeleted) return null;
      tx.update(ref, { "metaCapi.purchase": { claimedAt: Date.now(), via } });
      return o;
    });
    if (!order) return;
    const event = buildPurchaseEvent(orderId, order);
    const r = await sendCapiEvents([event]);
    await ref.update({ "metaCapi.purchase": { claimedAt: Date.now(), via, eventId: event.event_id, value: event.custom_data.value, ...r, sentAt: Date.now() } });
    if (!r.ok) console.error("[metaCapi] Purchase failed", { orderId, ...r });
  } catch (e: any) {
    console.error("[metaCapi] Purchase error", { orderId, error: e?.message || e });
  }
}

/**
 * InitiateCheckout and AddPaymentInfo for an order just written, with the
 * event_ids its checkout already used in the browser. Never throws.
 */
export async function sendCheckoutEventsForOrder(db: admin.firestore.Firestore, orderId: string, order: any): Promise<void> {
  try {
    if (!capiEnabled()) return;
    const t: Tracking = order?.tracking || {};
    const url = t.eventSourceUrl || `${SITE}/checkout`;
    const items = Array.isArray(order?.items) ? order.items : [];
    const itemsValue = items.reduce((s: number, i: any) => s + (Number(i?.price) || 0) * (Number(i?.quantity) || 1), 0);
    const base = { action_source: "website", event_source_url: url, user_data: userData(order) };
    const events: any[] = [];
    if (t.initiateCheckoutEventId) {
      events.push({ ...base, event_name: "InitiateCheckout", event_id: t.initiateCheckoutEventId, event_time: eventTime(t.initiateCheckoutAt),
        custom_data: { currency: "INR", value: itemsValue, ...contents(order) } });
    }
    if (t.addPaymentInfoEventId) {
      events.push({ ...base, event_name: "AddPaymentInfo", event_id: t.addPaymentInfoEventId, event_time: eventTime(Number(order?.createdAt) || Date.now()),
        custom_data: { currency: "INR", value: purchaseValue(order), payment_type: String(order?.paymentMethod || ""), ...contents(order) } });
    }
    if (!events.length) return;
    const r = await sendCapiEvents(events);
    await db.collection("orders").doc(orderId).update({ "metaCapi.checkout": { sentAt: Date.now(), events: events.map((e) => e.event_name), ...r } });
    if (!r.ok) console.error("[metaCapi] checkout events failed", { orderId, ...r });
  } catch (e: any) {
    console.error("[metaCapi] checkout events error", { orderId, error: e?.message || e });
  }
}

/** The browser's tracking for an order, kept to known short strings, plus the caller's IP and user agent. */
export function cleanTracking(raw: any, rawRequest: any): Record<string, unknown> | null {
  const str = (v: unknown, n = 300) => (typeof v === "string" && v ? v.slice(0, n) : undefined);
  const headers = rawRequest?.headers || {};
  const fwd = String(headers["x-forwarded-for"] || "").split(",")[0].trim();
  const ip = str(fwd || rawRequest?.ip, 64);
  const ua = str(headers["user-agent"], 400);
  const t = raw && typeof raw === "object" ? raw : {};
  const utm = t.utm && typeof t.utm === "object"
    ? Object.fromEntries(["source", "medium", "campaign", "content", "term"].map((k) => [k, str(t.utm[k], 150)]).filter(([, v]) => v))
    : undefined;
  const out: Record<string, unknown> = {
    fbp: str(t.fbp, 200), fbc: str(t.fbc, 600), fbclid: str(t.fbclid, 500),
    ...(utm && Object.keys(utm).length ? { utm } : {}),
    checkoutId: str(t.checkoutId, 80),
    initiateCheckoutEventId: str(t.initiateCheckoutEventId, 100),
    addPaymentInfoEventId: str(t.addPaymentInfoEventId, 100),
    initiateCheckoutAt: Number.isFinite(Number(t.initiateCheckoutAt)) && Number(t.initiateCheckoutAt) > 0 ? Number(t.initiateCheckoutAt) : undefined,
    eventSourceUrl: typeof t.eventSourceUrl === "string" && /^https:\/\/(www\.)?goskinly\.com\//.test(t.eventSourceUrl) ? t.eventSourceUrl.slice(0, 500) : undefined,
    clientIp: ip, userAgent: ua,
  };
  for (const k of Object.keys(out)) if (out[k] === undefined) delete out[k];
  return Object.keys(out).length ? out : null;
}

/**
 * Payment test mode: a Purchase for an existing order sent to Test Events
 * only, with an event_id the admin page also fires from the browser, so
 * Events Manager shows the pair deduplicated — without taking money or
 * marking anything paid (a fake "paid" order would issue a GST invoice,
 * reserve stock and message the customer). Needs PAYMENT_TEST_MODE=true and
 * META_TEST_EVENT_CODE in functions/.env, and an admin.
 */
export const metaCapiTestPurchase = onCall(async (data: any, context: any) => {
  await requireAdmin(context);
  if (process.env.PAYMENT_TEST_MODE !== "true") throw new HttpsError("failed-precondition", "Payment test mode is off (PAYMENT_TEST_MODE)");
  if (!TEST_CODE()) throw new HttpsError("failed-precondition", "Set META_TEST_EVENT_CODE first, so the test stays out of live data");
  if (!capiEnabled()) throw new HttpsError("failed-precondition", "META_CAPI_TOKEN is not set");
  const orderId = String(data?.orderId || "");
  const eventId = String(data?.eventId || "");
  if (!/^purchase-test-[A-Za-z0-9_-]{1,80}$/.test(eventId)) throw new HttpsError("invalid-argument", "eventId must start with purchase-test-");
  const snap = await admin.firestore().collection("orders").doc(orderId).get();
  if (!snap.exists) throw new HttpsError("not-found", "Order not found");
  const event = buildPurchaseEvent(orderId, snap.data(), eventId);
  const r = await sendCapiEvents([event], { testEventCode: TEST_CODE() });
  return { ...r, eventId, value: event.custom_data.value, userDataKeys: Object.keys(event.user_data) };
});
