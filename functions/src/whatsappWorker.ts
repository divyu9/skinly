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

const AUTHKEY_URL = "https://api.authkey.io/request";
const MAX_PER_RUN = 40;
const MAX_ATTEMPTS = 3;

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

const sendOne = async (queueRow: any): Promise<boolean> => {
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
  if (uc.empty || uc.docs[0].data().enabled !== true) {
    await queueRef.update({ status: "skipped", failureReason: "usecase disabled" });
    await msgSnap.ref.update({ status: "skipped" });
    return false;
  }

  const authkey = process.env.WHATSAPP_AUTHKEY || "";
  if (!authkey) throw new Error("WHATSAPP_AUTHKEY not configured");

  const phone = String(msg.recipientPhone || "").replace(/\D/g, "").slice(-10);
  if (!/^[6-9]\d{9}$/.test(phone)) {
    await queueRef.update({ status: "failed", failureReason: "invalid phone" });
    await msgSnap.ref.update({ status: "failed" });
    return false;
  }

  const params = new URLSearchParams({
    authkey,
    mobile: phone,
    country_code: "91",
    sid: String(msg.providerTemplateId || uc.docs[0].data().providerTemplateId || ""),
    ...(msg.variables || {}),
  });

  const fetch = require("node-fetch");
  const res = await fetch(`${AUTHKEY_URL}?${params.toString()}`, { method: "GET" });
  const body = await res.text();

  if (!res.ok || /error/i.test(body)) {
    console.error("authkey send failed:", body.slice(0, 300));
    await queueRef.update({ status: "pending", failureReason: body.slice(0, 300) });
    await msgSnap.ref.update({ status: "failed", failureReason: body.slice(0, 300) });
    return false;
  }

  await queueRef.update({ status: "sent", sentAt: Date.now(), failureReason: admin.firestore.FieldValue.delete() });
  await msgSnap.ref.update({ status: "sent", sentAt: Date.now() });
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

/** Sends one message against a usecase, to check the provider wiring. */
export const testWhatsAppTemplate = onCall(async (data: any, context: any) => {
  await requireAdmin(context);
  if (!data?.phone || !data?.usecaseKey) {
    throw new HttpsError("invalid-argument", "phone and usecaseKey are required");
  }

  const db = admin.firestore();
  const uc = await db.collection("whatsappUsecases").where("usecaseKey", "==", data.usecaseKey).limit(1).get();
  if (uc.empty) throw new HttpsError("not-found", "Usecase not found");

  const authkey = process.env.WHATSAPP_AUTHKEY || "";
  if (!authkey) throw new HttpsError("failed-precondition", "WHATSAPP_AUTHKEY is not configured");

  const phone = String(data.phone).replace(/\D/g, "").slice(-10);
  const params = new URLSearchParams({
    authkey, mobile: phone, country_code: "91",
    sid: String(uc.docs[0].data().providerTemplateId || ""),
    ...(data.variables || {}),
  });

  const fetch = require("node-fetch");
  const res = await fetch(`${AUTHKEY_URL}?${params.toString()}`, { method: "GET" });
  const body = await res.text();
  return { ok: res.ok && !/error/i.test(body), response: body.slice(0, 500) };
});
