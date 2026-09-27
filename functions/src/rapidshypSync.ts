import * as functionsV1 from "firebase-functions/v1";
import { HttpsError } from "firebase-functions/v1/https";
import * as admin from "firebase-admin";
import { requireAdmin } from "./auth";
import { applyShipment } from "./rapidshypWebhook";
import { isConfirmedOrder } from "./materials";

/**
 * Asking RapidShyp, rather than waiting to be told.
 *
 * The webhook is how an order learns its AWB and each scan, and RapidShyp does
 * not always send it: of ~28 orders created here and shipped in its panel on
 * 27 Sep, 14 got no webhook at all — AWB assigned, pickup scheduled
 * (Shadowfax), and still "processing" here. Its tracking API returns the same
 * record the webhook carries, so each open RapidShyp order is looked up and
 * applied through the webhook's own code (applyShipment): every 30 minutes,
 * and on demand from Admin › Orders.
 */
const OPEN = new Set(["processing", "ready_to_ship", "shipped", "out_for_delivery", "undelivered"]);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function trackOne(order: any): Promise<{ record: any; shipment: any } | null> {
  const key = process.env.RAPIDSHYP_API_KEY || "";
  if (!key) throw new Error("RapidShyp API key not configured");
  const base = (process.env.RAPIDSHYP_API_URL || "https://api.rapidshyp.com/rapidshyp/apis/v1/wrapper").replace(/\/wrapper\/?$/, "");
  const phone = String(order.shippingAddress?.phone || order.phone || "").replace(/\D/g, "").slice(-10);
  const body = order.awbNumber
    ? { orderId: "", awb: String(order.awbNumber), contact: "", email: "" }
    : { orderId: String(order.rapidshypOrderId || order.orderNumber), awb: "", contact: phone, email: "" };
  const res = await fetch(`${base}/track_order`, { method: "POST", headers: { "rapidshyp-token": key, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j: any = await res.json().catch(() => null);
  const record = j?.records?.[0];
  const shipment = record?.shipment_details?.[0];
  return record && shipment ? { record, shipment } : null;
}

async function syncDocs(db: admin.firestore.Firestore, docs: admin.firestore.DocumentSnapshot[]) {
  const out = { checked: 0, updated: 0, noShipment: 0, errors: 0, moved: [] as string[] };
  for (const d of docs) {
    const o = d.data() as any;
    try {
      const hit = await trackOne(o);
      out.checked++;
      if (!hit?.shipment?.awb) { out.noShipment++; continue; }
      const r: any = await applyShipment(db, hit.record, hit.shipment);
      if (r?.ok) { out.updated++; if (r.changed) out.moved.push(`${o.orderNumber}→${r.status}`); }
    } catch (e: any) {
      out.errors++;
      console.warn("rapidshypSync failed", { order: o.orderNumber, error: e?.message || e });
    }
    await sleep(250);
  }
  return out;
}

/** Open orders that RapidShyp holds: booked there (rapidshypOrderId) or shipped by it. */
async function openRapidshypOrders(db: admin.firestore.Firestore) {
  const [a, b] = await Promise.all([
    db.collection("orders").where("shippingProvider", "==", "rapidshyp").get(),
    db.collection("orders").where("rapidshypOrderId", "!=", null).get(),
  ]);
  const seen = new Map<string, admin.firestore.DocumentSnapshot>();
  for (const d of [...a.docs, ...b.docs]) {
    const o = d.data() as any;
    if (OPEN.has(String(o.status)) && isConfirmedOrder(o) && o.shippingProvider !== "delhivery") seen.set(d.id, d);
  }
  return [...seen.values()];
}

export const rapidshypTrackingSync = functionsV1
  .runWith({ timeoutSeconds: 540, memory: "256MB" })
  .pubsub.schedule("every 30 minutes")
  .timeZone("Asia/Kolkata")
  .onRun(async () => {
    if (!process.env.RAPIDSHYP_API_KEY) return null;
    const db = admin.firestore();
    const docs = await openRapidshypOrders(db);
    if (!docs.length) return null;
    const out = await syncDocs(db, docs);
    console.log("rapidshypTrackingSync", { open: docs.length, ...out });
    return null;
  });

/** Admin › Orders › RapidShyp › Sync: the given orders, or every open one. */
export const syncRapidshypOrders = functionsV1
  .runWith({ timeoutSeconds: 300, memory: "256MB" })
  .https.onCall(async (data: any, context: any) => {
    await requireAdmin(context);
    const db = admin.firestore();
    const ids: string[] = (Array.isArray(data?.orderIds) ? data.orderIds : []).map(String).filter(Boolean).slice(0, 150);
    const docs = ids.length
      ? (await db.getAll(...ids.map((id) => db.collection("orders").doc(id)))).filter((d) => d.exists)
      : await openRapidshypOrders(db);
    if (!docs.length) throw new HttpsError("not-found", "No RapidShyp orders to sync");
    return syncDocs(db, docs);
  });
