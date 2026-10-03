import * as functionsV1 from "firebase-functions/v1";
import { onCall, HttpsError } from "firebase-functions/v1/https";
import * as admin from "firebase-admin";
import { requireAdmin } from "./auth";
import { enforceDailyRateLimit } from "./rate-limit";

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
  const headerImage = tplData.headerType === "image"
    ? String((msg.variables || {}).header_image || "https://goskinly.com/og-default.jpg")
    : "";

  const fetch = require("node-fetch");
  if (provider === "fast2sms") {
    // Values in template order, joined with "|" — so a "|" inside one would split it.
    const values = order.map((_, i) => String(numbered[String(i + 1)] ?? "").replace(/\|/g, "/").replace(/\s*\n\s*/g, " "));
    const q = new URLSearchParams({ message_id: wid, phone_number_id: String(prov.phoneNumberId), numbers: phone });
    if (values.length) q.set("variables_values", values.join("|"));
    if (headerImage) q.set("media_url", headerImage);
    q.set("udf1", messageId);
    const fres = await fetch(`https://www.fast2sms.com/dev/whatsapp?${q.toString()}`, { method: "GET", headers: { Authorization: f2sKey } });
    const fbody = await fres.text();
    let ok = false;
    try { const j = JSON.parse(fbody); ok = fres.status === 200 && (j.status === true || j.return === true); } catch { ok = false; }
    if (!ok) {
      console.error("fast2sms send failed:", { status: fres.status, body: fbody.slice(0, 300) });
      await queueRef.update({ status: "pending", failureReason: `Fast2SMS: ${fbody.slice(0, 200)}` });
      await msgSnap.ref.update({ status: "failed", provider, failureReason: `Fast2SMS: ${fbody.slice(0, 200)}`, providerResponse: fbody.slice(0, 500) });
      return false;
    }
    await queueRef.update({ status: "sent", sentAt: Date.now(), failureReason: admin.firestore.FieldValue.delete() });
    await msgSnap.ref.update({ status: "sent", sentAt: Date.now(), provider, providerResponse: fbody.slice(0, 500), providerTemplateId: wid, sentParams: numbered, ...(headerImage ? { headerImage } : {}) });
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
