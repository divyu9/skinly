import * as functionsV1 from "firebase-functions/v1";
import { onCall, HttpsError } from "firebase-functions/v1/https";
import * as admin from "firebase-admin";
import { requireAdmin } from "./auth";
import { marketingAllowed } from "./contacts";
import { enforceDailyRateLimit } from "./rate-limit";

const MARKETING_USECASES = new Set(["abandoned_cart", "back_in_stock", "review_request"]);
const NEEDS_OPT_IN = new Set(["abandoned_cart"]);

// ── Fast2SMS ────────────────────────────────────────────────────────────────

const F2S_GRAPH_VERSION = process.env.FAST2SMS_GRAPH_VERSION || "v26.0";

type F2sTemplate = { name: string; language: string; varCount: number; imageHeader: boolean; urlButton: { index: number; url: string } | null };
const f2sCache = new Map<string, { at: number; t: F2sTemplate | null }>();

/**
 * One approved template's name, language, body variable count and dynamic
 * URL button, by its Fast2SMS message_id (Get WABA & Template Details).
 * Cached for ten minutes per worker instance.
 */
async function fast2smsTemplate(key: string, phoneNumberId: string, messageId: string): Promise<F2sTemplate | null> {
  const hit = f2sCache.get(messageId);
  if (hit && Date.now() - hit.at < 10 * 60 * 1000) return hit.t;
  const fetch = require("node-fetch");
  const res = await fetch(`https://www.fast2sms.com/dev/dlt_manager/whatsapp?type=template&phone_number_id=${encodeURIComponent(phoneNumberId)}`,
    { headers: { Authorization: key } });
  const j: any = await res.json();
  const all: any[] = (j?.data || []).flatMap((n: any) => n.templates || []);
  for (const t of all) {
    const buttons: any[] = (t.components || []).find((c: any) => String(c.type).toUpperCase() === "BUTTONS")?.buttons || [];
    const i = buttons.findIndex((b: any) => String(b.type).toUpperCase() === "URL" && String(b.url || "").includes("{{1}}"));
    f2sCache.set(String(t.message_id), {
      at: Date.now(),
      t: {
        name: String(t.template_name), language: String(t.language || "en"),
        varCount: Number.isFinite(Number(t.var_count)) ? Number(t.var_count) : -1,
        imageHeader: (t.components || []).some((c: any) => String(c.type).toUpperCase() === "HEADER" && String(c.format).toUpperCase() === "IMAGE"),
        urlButton: i >= 0 ? { index: i, url: String(buttons[i].url) } : null,
      },
    });
  }
  return f2sCache.get(messageId)?.t ?? null;
}

const SITE = (process.env.SITE_URL || "https://goskinly.com").replace(/\/+$/, "");

/** The full link a message's dynamic URL button opens (docs/whatsapp-templates.md). */
function buttonUrlFor(usecaseKey: string, v: Record<string, any>): string {
  switch (usecaseKey) {
    case "order_dispatched": return String(v.order_link || "");
    case "order_delivered":
    case "review_request": return String(v.review_link || "");
    case "payment_failed": return String(v.pay_link || "");
    case "back_in_stock": return String(v.product_url || "");
    case "abandoned_cart": return v.cart_code ? `${SITE}/c/${v.cart_code}` : "";
    case "model_added":
      return v.brand_name && v.model_name
        ? `${SITE}/products?${new URLSearchParams({ brand: String(v.brand_name), model: String(v.model_name), utm_source: "whatsapp", utm_medium: "model_added" })}`
        : "";
    default: return String(v.button_url || "");
  }
}

/**
 * Drains whatsappQueue through the authkey API.
 *
 * Nothing has sent since February: the templates and usecases never came
 * across in the migration, so there was no config to send against and no
 * worker to do it. Config is restored; this is the worker.
 *
 * A row is claimed inside a transaction before the request goes out, so a
 * failure mid-send costs one message rather than re-sending it every run.
 */

// The WhatsApp endpoint, not the SMS one. api.authkey.io/request with `sid`
// is Authkey's SMS API: it answered every send with {"success":{"sms":false},
// "message":{"sms":"Invalid Template"}} — keyed by "sms", because that is what
// it thought we were sending. WhatsApp wants this host and `wid`.
const AUTHKEY_URL = "https://console.authkey.io/restapi/request.php";
// Its JSON sibling, the only one that takes a template header (an image).
const AUTHKEY_JSON_URL = "https://console.authkey.io/restapi/requestjson.php";
const MAX_PER_RUN = 40;
const MAX_ATTEMPTS = 3;

/**
 * Decides whether Authkey actually sent the message.
 *
 * It does not answer the way the old check assumed. A refusal comes back as
 * HTTP 203 with `{"Message": "Invalid authkey or insufficient balance"}` — a
 * 2xx, so `res.ok` was true, and the word "error" never appears, so the
 * substring test missed it too. Every rejected message was recorded as sent,
 * which is the worst outcome available: the queue drains, the admin reads
 * "sent", and the customer hears nothing.
 *
 * So the rule is inverted. A send counts only on a recognised success signal;
 * anything unrecognised is a failure that keeps the body for diagnosis. A
 * message wrongly marked failed is retried, which costs little. A message
 * wrongly marked sent is simply gone.
 */
export function readAuthkeyResult(status: number, body: string): { sent: boolean; reason: string } {
  const text = String(body || "").trim();
  if (status !== 200) return { sent: false, reason: `HTTP ${status}: ${text.slice(0, 240)}` };

  let message = text;
  let hasLogId = false;
  try {
    const j = JSON.parse(text);
    // This endpoint answers per channel: {"success":{"whatsapp":true},
    // "message":{"whatsapp":"..."}}. A nested false is a refusal however
    // cheerful the surrounding JSON looks.
    const flat = (v: any): string =>
      v && typeof v === "object" ? Object.values(v).map(String).join(" ") : String(v ?? "");
    message = flat(j.message ?? j.Message ?? text);
    if (j.success && typeof j.success === "object") {
      const flags = Object.values(j.success);
      if (flags.length && flags.every((f) => f === false)) {
        return { sent: false, reason: message.slice(0, 240) || "provider reported failure" };
      }
      if (flags.some((f) => f === true)) return { sent: true, reason: "" };
    }
    if (j.success === false) return { sent: false, reason: message.slice(0, 240) };
    hasLogId = Boolean(j.LogID ?? j.log_id ?? j.logid ?? j.MessageID ?? j.message_id);
  } catch {
    // Not JSON; judge the raw text instead.
  }

  if (/invalid|insufficient|unauthor|denied|fail|error|missing|not found|blocked/i.test(message)) {
    return { sent: false, reason: message.slice(0, 240) };
  }
  if (hasLogId || /success|submitted|queued|accepted/i.test(message)) {
    return { sent: true, reason: "" };
  }
  return { sent: false, reason: `Unrecognised Authkey response: ${text.slice(0, 240)}` };
}

const isSendableStatus = (s: string) => s === "pending" || s === "queued";

/** Claims one queue row, or returns null if another run already has it. */
const claim = async (queueId: string): Promise<any | null> => {
  const db = admin.firestore();
  const ref = db.collection("whatsappQueue").doc(queueId);
  try {
    return await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return null;
      const row = snap.data() as any;

      if (!isSendableStatus(row.status)) return null;
      if (Number(row.attempts || 0) >= MAX_ATTEMPTS) {
        tx.update(ref, { status: "failed", failureReason: "attempt limit reached" });
        return null;
      }

      tx.update(ref, {
        status: "processing",
        attempts: Number(row.attempts || 0) + 1,
        lastAttemptAt: Date.now(),
      });
      return { ...row, _id: queueId };
    });
  } catch (err) {
    console.error(`claim failed for queue row ${queueId}:`, err);
    return null;
  }
};

const sendOne = async (queueRow: any, opts: { ignoreSwitch?: boolean } = {}): Promise<boolean> => {
  const db = admin.firestore();
  const queueRef = db.collection("whatsappQueue").doc(queueRow._id);

  const messageId = queueRow.messageId;
  const msgSnap = messageId ? await db.collection("whatsappMessages").doc(messageId).get() : null;
  if (!msgSnap?.exists) {
    await queueRef.update({ status: "failed", failureReason: "message not found" });
    return false;
  }
  const msg = msgSnap.data() as any;

  // Respect the per-usecase switch at send time, so turning one off takes
  // effect immediately for anything already queued.
  const uc = await db.collection("whatsappUsecases").where("usecaseKey", "==", msg.usecaseKey).limit(1).get();
  if (uc.empty || (!opts.ignoreSwitch && uc.docs[0].data().enabled !== true)) {
    await queueRef.update({ status: "skipped", failureReason: "usecase disabled" });
    await msgSnap.ref.update({ status: "skipped" });
    return false;
  }

  /*
   * Which provider sends: whatsappSettings/provider (Admin › WhatsApp). The
   * number moved to Fast2SMS on 3 Oct 2026 after Authkey's onboarding stalled;
   * Authkey stays as a fallback. Keys live in functions/.env, never Firestore.
   */
  const prov = ((await db.doc("whatsappSettings/provider").get()).data() || {}) as any;
  const provider: "fast2sms" | "authkey" = prov.provider === "fast2sms" ? "fast2sms" : "authkey";
  const authkey = process.env.WHATSAPP_AUTHKEY || "";
  const f2sKey = process.env.FAST2SMS_API_KEY || "";
  if (provider === "authkey" && !authkey) throw new Error("WHATSAPP_AUTHKEY not configured");
  if (provider === "fast2sms" && (!f2sKey || !prov.phoneNumberId)) throw new Error("Fast2SMS needs FAST2SMS_API_KEY in functions/.env and the Phone Number ID in Admin › WhatsApp");

  const phone = String(msg.recipientPhone || "").replace(/\D/g, "").slice(-10);
  if (!/^[6-9]\d{9}$/.test(phone)) {
    await queueRef.update({ status: "failed", failureReason: "invalid phone" });
    await msgSnap.ref.update({ status: "failed" });
    return false;
  }

  /*
   * Marketing permission (contacts/{phone}, Admin › Contacts). An order
   * message is not permission for offers (Meta policy, India's DPDP Act):
   * the abandoned-cart nudge needs the customer's opt-in; back in stock (they
   * asked for it) and the review request (about their own order) go unless
   * they said STOP. Order and shipping messages are never held back.
   */
  if (!msg.test && MARKETING_USECASES.has(msg.usecaseKey)) {
    const allowed = await marketingAllowed(phone, NEEDS_OPT_IN.has(msg.usecaseKey));
    if (!allowed) {
      await queueRef.update({ status: "skipped", failureReason: "no marketing permission (not opted in, or said STOP)" });
      await msgSnap.ref.update({ status: "skipped", failureReason: "no marketing permission" });
      return false;
    }
  }

  const wid = String(msg.providerTemplateId || uc.docs[0].data().providerTemplateId || "");
  if (!wid) {
    await queueRef.update({ status: "failed", failureReason: "no providerTemplateId on the usecase" });
    await msgSnap.ref.update({ status: "failed" });
    return false;
  }

  // Authkey takes variables positionally, as 1, 2, 3…, in the order the
  // template declares them — not by name. Sent by name they are simply
  // dropped and the message arrives with empty placeholders.
  // The template registered for this provider (IDs from two providers can collide).
  const tplAll = await db.collection("whatsappTemplates").where("providerTemplateId", "==", wid).get();
  const tplDoc = tplAll.docs.find((d) => ((d.data() as any).provider || "authkey") === provider) || tplAll.docs[0];
  const tpl = { empty: !tplDoc, docs: tplDoc ? [tplDoc] : [] };
  const order: string[] = tpl.empty ? [] : (tpl.docs[0].data().variables || []);
  const numbered: Record<string, string> = {};
  order.forEach((name, i) => {
    const v = (msg.variables || {})[name];
    if (v !== undefined) numbered[String(i + 1)] = String(v);
  });

  /*
   * A template approved with an image header must be sent one, or Meta
   * refuses it outright. The GET endpoint can't carry a header, so those go
   * through Authkey's JSON endpoint (same wid, same numbered values); the
   * picture is `header_image` on the message, else the store's default card.
   */
  const tplData = tpl.empty ? {} : (tpl.docs[0].data() as any);
  // Fast2SMS says itself whether the approved template has a photo header, so
  // the admin's Photo/Text toggle cannot disagree with Meta (error 132012).
  const f2sMeta = provider === "fast2sms" && prov.phoneNumberId
    ? await fast2smsTemplate(f2sKey, String(prov.phoneNumberId), wid).catch((e) => {
        console.warn("[fast2sms] template details unavailable:", e?.message || e);
        return null;
      })
    : null;
  const wantsImage = f2sMeta ? f2sMeta.imageHeader : tplData.headerType === "image";
  const headerImage = wantsImage
    ? String((msg.variables || {}).header_image || "https://goskinly.com/og-default.jpg")
    : "";

  const fetch = require("node-fetch");
  if (provider === "fast2sms") {
    const meta = f2sMeta;
    // Values in template order. The body may take fewer than the registry
    // lists (the review link moved into the button), so only var_count go.
    let values = order.map((_, i) => String(numbered[String(i + 1)] ?? "").replace(/\s*\n\s*/g, " "));
    if (meta && meta.varCount >= 0) values = values.slice(0, meta.varCount);

    let fres: any;
    const urlButton = meta?.urlButton || null;
    if (meta && urlButton) {
      /*
       * A dynamic URL button: only Fast2SMS's Meta-format endpoint carries
       * the button's {{1}}. The value is the part of this message's link
       * after the button's fixed start ("https://goskinly.com/orders/").
       */
      // www.goskinly.com and goskinly.com are one site (SITE_URL carries the
      // www; the templates were approved without it), so compare without it.
      const noWww = (u: string) => u.replace(/^(https?:\/\/)www\./i, "$1");
      const full = noWww(buttonUrlFor(msg.usecaseKey, msg.variables || {}));
      const base = noWww(urlButton.url.split("{{1}}")[0]);
      if (!full || !full.startsWith(base)) {
        const why = `button link ${full ? "does not start with " + base : "missing"}`;
        await queueRef.update({ status: "failed", failureReason: why });
        await msgSnap.ref.update({ status: "failed", provider, failureReason: why });
        return false;
      }
      const suffix = full.slice(base.length);
      const components: any[] = [];
      if (headerImage) components.push({ type: "header", parameters: [{ type: "image", image: { link: headerImage } }] });
      if (values.length) components.push({ type: "body", parameters: values.map((text) => ({ type: "text", text })) });
      const send = (paramType: "text" | "payload") => fetch(
        `https://www.fast2sms.com/dev/whatsapp/${F2S_GRAPH_VERSION}/${prov.phoneNumberId}/messages`,
        {
          method: "POST",
          headers: { Authorization: f2sKey, "Content-Type": "application/json" },
          body: JSON.stringify({
            messaging_product: "whatsapp", recipient_type: "individual", to: `91${phone}`, type: "template",
            template: {
              name: meta.name, language: { code: meta.language },
              components: [...components, {
                type: "button", sub_type: "url", index: String(urlButton.index),
                parameters: [paramType === "text" ? { type: "text", text: suffix } : { type: "payload", payload: suffix }],
              }],
            },
          }),
        });
      // Meta's own format names the URL value "text"; Fast2SMS's page shows "payload". Try both.
      fres = await send("text");
      if (fres.status !== 200) fres = await send("payload");
    } else {
      const q = new URLSearchParams({ message_id: wid, phone_number_id: String(prov.phoneNumberId), numbers: phone });
      // Joined with "|", so a "|" inside one would split it.
      if (values.length) q.set("variables_values", values.map((v) => v.replace(/\|/g, "/")).join("|"));
      if (headerImage) q.set("media_url", headerImage);
      q.set("udf1", messageId);
      fres = await fetch(`https://www.fast2sms.com/dev/whatsapp?${q.toString()}`, { method: "GET", headers: { Authorization: f2sKey } });
    }
    const fbody = await fres.text();
    let ok = false;
    let providerMessageId = "";
    try {
      const j = JSON.parse(fbody);
      ok = fres.status === 200 && (j.status === true || j.return === true || !!j.messages?.[0]?.id);
      providerMessageId = String(j.request_id || j.messages?.[0]?.id || "");
    } catch { ok = false; }
    if (!ok) {
      console.error("fast2sms send failed:", { status: fres.status, body: fbody.slice(0, 300) });
      await queueRef.update({ status: "pending", failureReason: `Fast2SMS: ${fbody.slice(0, 200)}` });
      await msgSnap.ref.update({ status: "failed", provider, failureReason: `Fast2SMS: ${fbody.slice(0, 200)}`, providerResponse: fbody.slice(0, 500) });
      return false;
    }
    await queueRef.update({ status: "sent", sentAt: Date.now(), failureReason: admin.firestore.FieldValue.delete() });
    await msgSnap.ref.update({
      status: "sent", sentAt: Date.now(), provider, providerResponse: fbody.slice(0, 500), providerTemplateId: wid, sentParams: numbered,
      ...(providerMessageId ? { providerMessageId } : {}), ...(headerImage ? { headerImage } : {}),
    });
    return true;
  }
  const res = headerImage
    ? await fetch(AUTHKEY_JSON_URL, {
        method: "POST",
        headers: { Authorization: `Basic ${authkey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          country_code: "91",
          mobile: phone,
          wid,
          type: "media",
          bodyValues: numbered,
          headerValues: { headerFileName: "GoSkinly.jpg", headerData: headerImage },
        }),
      })
    : await fetch(`${AUTHKEY_URL}?${new URLSearchParams({ authkey, mobile: phone, country_code: "91", wid, ...numbered }).toString()}`, { method: "GET" });
  const body = await res.text();

  const verdict = readAuthkeyResult(res.status, body);
  if (!verdict.sent) {
    console.error("authkey send failed:", { status: res.status, body: body.slice(0, 300) });
    await queueRef.update({ status: "pending", failureReason: verdict.reason });
    await msgSnap.ref.update({ status: "failed", failureReason: verdict.reason, providerResponse: body.slice(0, 500) });
    return false;
  }

  await queueRef.update({ status: "sent", sentAt: Date.now(), failureReason: admin.firestore.FieldValue.delete() });
  // What Authkey said, kept: "sent" here only means Authkey accepted it, and
  // the LogID is what their delivery report is searched by.
  await msgSnap.ref.update({ status: "sent", sentAt: Date.now(), providerResponse: body.slice(0, 500), providerTemplateId: wid, sentParams: numbered, ...(headerImage ? { headerImage } : {}) });
  return true;
};

const drainQueue = async (): Promise<{ sent: number; claimed: number }> => {
  const db = admin.firestore();
  const due = await db.collection("whatsappQueue")
    .where("status", "in", ["pending", "queued"])
    .limit(MAX_PER_RUN)
    .get();

  let sent = 0;
  let claimed = 0;
  for (const d of due.docs) {
    const row = await claim(d.id);
    if (!row) continue;
    claimed++;

    try {
      await enforceDailyRateLimit({
        key: "whatsappSends",
        limit: Number(process.env.WHATSAPP_DAILY_LIMIT || 500),
      });
    } catch {
      console.warn("daily WhatsApp cap reached; stopping this pass");
      await db.collection("whatsappQueue").doc(d.id).update({ status: "pending" });
      break;
    }

    if (await sendOne(row)) sent++;
  }
  return { sent, claimed };
};

export const whatsappQueueWorker = functionsV1.pubsub
  .schedule("every 5 minutes")
  .timeZone("Asia/Kolkata")
  .onRun(async () => {
    const result = await drainQueue();
    if (result.claimed) console.log("whatsapp worker:", result);
    return null;
  });

/** Runs the same pass on demand from the dashboard. */
export const triggerWhatsAppWorker = onCall(async (_data: any, context: any) => {
  await requireAdmin(context);
  return drainQueue();
});

/**
 * Admin › WhatsApp › Test: one message for a usecase, to the admin's own
 * number (or the one given), sent now through the same path as real ones —
 * template lookup, numbered values, image header — and Authkey's answer
 * returned, so a wrong ID or variable count shows on the spot.
 */
export const testWhatsAppTemplate = onCall(async (data: any, context: any) => {
  await requireAdmin(context);
  const usecaseKey = String(data?.usecaseKey || "");
  if (!usecaseKey) throw new HttpsError("invalid-argument", "usecaseKey is required");
  await enforceDailyRateLimit({ key: "whatsappTests", limit: 40 });

  const db = admin.firestore();
  const uc = await db.collection("whatsappUsecases").where("usecaseKey", "==", usecaseKey).limit(1).get();
  if (uc.empty) throw new HttpsError("not-found", "Usecase not found");
  if (!uc.docs[0].data().providerTemplateId) throw new HttpsError("failed-precondition", "Add the template ID first");

  let phone = String(data?.phone || "").replace(/\D/g, "").slice(-10);
  if (!phone) {
    const cfg = await db.doc("whatsappSettings/adminNotifications").get();
    phone = String((cfg.data() as any)?.adminPhone || "").replace(/\D/g, "").slice(-10);
  }
  if (!/^[6-9]\d{9}$/.test(phone)) throw new HttpsError("failed-precondition", "Set the admin WhatsApp number first");

  const variables: Record<string, string> = {};
  for (const [k, v] of Object.entries(data?.variables || {})) variables[String(k)] = String(v).slice(0, 500);
  const msg = await db.collection("whatsappMessages").add({
    usecaseKey, recipientPhone: phone, variables, status: "pending", test: true, createdAt: Date.now(),
  });
  const q = await db.collection("whatsappQueue").add({
    messageId: msg.id, status: "pending", attempts: 0, scheduledFor: Date.now(), createdAt: Date.now(),
  });

  // Sent regardless of the on/off switch: testing is how you decide to switch it on.
  const row = await claim(q.id);
  if (row) await sendOne(row, { ignoreSwitch: true });
  const after = (await msg.get()).data() as any;
  // A failed test is not retried by the cron: the admin is watching and will press again.
  if (after?.status !== "sent") await q.update({ status: "failed" });
  return { status: after?.status, response: String(after?.providerResponse || after?.failureReason || "").slice(0, 500), phone };
});

/**
 * Admin › WhatsApp › "Check Fast2SMS": the numbers on the Fast2SMS account
 * (Phone Number ID, display-name status, quality) and every template with
 * its Message ID, status and whether it has a dynamic URL button. The key
 * stays on the server; only these details go back.
 */
export const fast2smsAccount = onCall(async (_data: any, context: any) => {
  await requireAdmin(context);
  const key = process.env.FAST2SMS_API_KEY || "";
  if (!key) throw new HttpsError("failed-precondition", "FAST2SMS_API_KEY is not in functions/.env");
  const fetch = require("node-fetch");
  const res = await fetch("https://www.fast2sms.com/dev/dlt_manager/whatsapp?type=template", { headers: { Authorization: key } });
  const text = await res.text();
  let j: any;
  try { j = JSON.parse(text); } catch { throw new HttpsError("internal", `Fast2SMS: ${text.slice(0, 200)}`); }
  if (!res.ok || j?.success === false || !Array.isArray(j?.data)) throw new HttpsError("internal", `Fast2SMS: ${text.slice(0, 200)}`);
  return {
    numbers: j.data.map((n: any) => ({
      phoneNumberId: String(n.phone_number_id), number: String(n.number || ""), verifiedName: String(n.verified_name || ""),
      nameStatus: String(n.name_status || ""), quality: String(n.quality_rating || ""), limit: String(n.messaging_limit || ""),
      connection: String(n.connection_status || ""),
    })),
    templates: j.data.flatMap((n: any) => (n.templates || []).map((t: any) => {
      const buttons: any[] = (t.components || []).find((c: any) => String(c.type).toUpperCase() === "BUTTONS")?.buttons || [];
      return {
        messageId: String(t.message_id), name: String(t.template_name), status: String(t.status), category: String(t.category),
        language: String(t.language || ""), varCount: Number(t.var_count) || 0,
        hasImage: (t.components || []).some((c: any) => String(c.type).toUpperCase() === "HEADER" && String(c.format).toUpperCase() === "IMAGE"),
        dynamicButton: buttons.some((b: any) => String(b.type).toUpperCase() === "URL" && String(b.url || "").includes("{{1}}")),
      };
    })),
  };
});

/**
 * Admin › WhatsApp › "Delivery log": Fast2SMS's status reports for the last
 * three days (accepted → sent → delivered / read, or failed with Meta's
 * error). "Sent" in our log only means Fast2SMS took the message; this is
 * where a message Meta refused afterwards (e.g. a marketing cap) shows up.
 */
export const fast2smsLogs = onCall(async (_data: any, context: any) => {
  await requireAdmin(context);
  const key = process.env.FAST2SMS_API_KEY || "";
  if (!key) throw new HttpsError("failed-precondition", "FAST2SMS_API_KEY is not in functions/.env");
  const day = (d: Date) => d.toISOString().slice(0, 10);
  const to = new Date(Date.now() + 5.5 * 3600 * 1000);
  const from = new Date(to.getTime() - 2 * 86400 * 1000);
  const fetch = require("node-fetch");
  const res = await fetch(`https://www.fast2sms.com/dev/whatsapp_logs?from=${day(from)}&to=${day(to)}`, { headers: { Authorization: key } });
  const text = await res.text();
  let j: any;
  try { j = JSON.parse(text); } catch { throw new HttpsError("internal", `Fast2SMS: ${text.slice(0, 200)}`); }
  if (!Array.isArray(j?.data)) throw new HttpsError("internal", `Fast2SMS: ${text.slice(0, 200)}`);
  const rows = j.data.map((r: any) => ({
    requestId: String(r.request_id || ""), to: String(r.recipient_id || ""), status: String(r.status || ""),
    at: Number(r.timestamp) ? Number(r.timestamp) * 1000 : 0,
    error: explainMetaError(r.errors, r.status_description),
  }));
  rows.sort((a: any, b: any) => b.at - a.at);
  return { rows: rows.slice(0, 80) };
});


// ── Delivery reports ────────────────────────────────────────────────────────

/** Meta's error codes a shop owner actually meets, in plain words. */
const META_ERRORS: Record<string, string> = {
  "131049": "Meta held this marketing message back (it limits how many marketing messages one person gets). Not a fault on our side; try again in a day or two.",
  "131050": "The customer chose to stop marketing messages from us.",
  "131026": "This number can't receive it (not on WhatsApp, old app, or hasn't accepted the latest WhatsApp terms).",
  "131047": "More than 24 hours since the customer's last message, so only a template can be sent.",
  "131056": "Too many messages to this number too quickly; it will go through later.",
  "132012": "The message didn't match the approved template (photo header or variables).",
  "132001": "Template not found or not approved yet.",
  "131051": "Unsupported message type.",
  "130472": "Meta is running an experiment and held this marketing message back for this user.",
  "131031": "The WhatsApp business account is restricted.",
};
/*
 * Fast2SMS puts Meta's reason in `status_description` — "This message was not
 * delivered to maintain healthy ecosystem engagement. (Error: 131049)",
 * "(#132012) Parameter format does not match…" — with `errors` null, so every
 * failure read as a bare "Failed at Meta". Both are read now.
 */
function explainMetaError(errors: any, description?: unknown): string {
  const desc = String(description || "").trim();
  if (desc) {
    const code = /(?:Error:\s*|#)(\d{5,6})/.exec(desc)?.[1] || "";
    const plain = code ? META_ERRORS[code] : "";
    return plain ? `${plain} (Meta ${code})` : desc.slice(0, 200);
  }
  const e = Array.isArray(errors) ? errors[0] : errors;
  if (!e) return "";
  const code = String(e.code ?? e.error_code ?? "");
  const plain = META_ERRORS[code];
  const raw = String(e.title || e.message || e.error_data?.details || JSON.stringify(e)).slice(0, 200);
  return plain ? `${plain} (Meta ${code})` : `${raw}${code ? ` (Meta ${code})` : ""}`;
}

const RANK: Record<string, number> = { accepted: 1, sent: 2, delivered: 3, read: 4, failed: 5 };

/**
 * Pulls Fast2SMS's status reports (last 3 days) onto whatsappMessages:
 * delivered / read / failed with Meta's reason in plain words. "sent" in our
 * log only meant Fast2SMS took it; this is where the phone's answer arrives.
 */
async function syncFast2smsDelivery(): Promise<{ updated: number; reports: number }> {
  const key = process.env.FAST2SMS_API_KEY || "";
  if (!key) return { updated: 0, reports: 0 };
  const day = (d: Date) => d.toISOString().slice(0, 10);
  const to = new Date(Date.now() + 5.5 * 3600 * 1000);
  const from = new Date(to.getTime() - 2 * 86400 * 1000);
  const fetch = require("node-fetch");
  const res = await fetch(`https://www.fast2sms.com/dev/whatsapp_logs?from=${day(from)}&to=${day(to)}`, { headers: { Authorization: key } });
  const j: any = await res.json().catch(() => null);
  const rows: any[] = Array.isArray(j?.data) ? j.data : [];
  // The furthest each message got: failed beats read beats delivered beats sent.
  const best = new Map<string, any>();
  for (const r of rows) {
    const id = String(r.request_id || "");
    if (!id) continue;
    const cur = best.get(id);
    if (!cur || (RANK[r.status] || 0) > (RANK[cur.status] || 0)) best.set(id, r);
  }
  const db = admin.firestore();
  let updated = 0;
  const ids = [...best.keys()];
  for (let i = 0; i < ids.length; i += 30) {
    const snap = await db.collection("whatsappMessages").where("providerMessageId", "in", ids.slice(i, i + 30)).get();
    for (const d of snap.docs) {
      const r = best.get(String(d.data().providerMessageId));
      const status = String(r?.status || "");
      if (!["delivered", "read", "failed"].includes(status)) continue;
      const at = Number(r.timestamp) ? Number(r.timestamp) * 1000 : Number(r.sent_timestamp) ? Number(r.sent_timestamp) * 1000 : Date.now();
      const patch: any = { status, deliveryCheckedAt: Date.now() };
      if (status === "delivered") patch.deliveredAt = at;
      if (status === "read") { patch.readAt = at; patch.deliveredAt = d.data().deliveredAt || at; }
      if (status === "failed") { patch.failedAt = at; patch.failureReason = explainMetaError(r.errors, r.status_description) || "Failed at Meta"; }
      if (d.data().status === status && d.data().failureReason === patch.failureReason) continue;
      await d.ref.update(patch);
      updated++;
    }
  }
  return { updated, reports: rows.length };
}

/** Every 15 minutes, so the Messages page shows delivered / failed without anyone asking. */
export const whatsappDeliverySync = functionsV1.pubsub
  .schedule("every 15 minutes")
  .timeZone("Asia/Kolkata")
  .onRun(async () => {
    const r = await syncFast2smsDelivery().catch((e) => { console.error("[delivery sync]", e); return null; });
    console.log("[delivery sync]", r);
  });

/** Admin › WhatsApp › Messages: "Refresh delivery status". */
export const syncWhatsAppDelivery = onCall(async (_data: any, context: any) => {
  await requireAdmin(context);
  return syncFast2smsDelivery();
});
