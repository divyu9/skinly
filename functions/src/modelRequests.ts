import * as functionsV1 from "firebase-functions/v1";
import * as admin from "firebase-admin";
import { queueWhatsApp } from "./orderNotifications";
import { enforceDailyRateLimit } from "./rate-limit";

const COUNTER = "counters/modelRequests";

/**
 * Gives every model request what the admin table needs: a date, a status
 * and a request number.
 *
 * Since the move off Convex the storefront's "request a model" forms write
 * through the generic create, which saves only what the form sent — brand,
 * model, category, phone. The requests arrived with no requestedAt, no
 * requestNumber and no status, so the admin page showed a blank date, a dash
 * for the ID, and no Approve or Reject (those only appear on "pending").
 * Doing it here covers all four forms and any old copy of the site still
 * open in someone's tab, and the number comes from a counter in a
 * transaction, which a visitor's browser could not safely hold.
 */
export const onModelRequestCreated = functionsV1.firestore
  .document("modelRequests/{id}")
  .onCreate(async (snap) => {
    const db = admin.firestore();
    const data = snap.data() || {};
    const patch: Record<string, unknown> = {};
    if (!data.requestedAt) patch.requestedAt = Number(data._creationTime) || snap.createTime.toMillis();
    if (!data.status) patch.status = "pending";
    if (!data.requestNumber) {
      patch.requestNumber = await db.runTransaction(async (tx) => {
        const ref = db.doc(COUNTER);
        const cur = await tx.get(ref);
        const next = (Number(cur.data()?.last) || 0) + 1;
        tx.set(ref, { last: next, updatedAt: Date.now() }, { merge: true });
        return `MR-${next}`;
      });
    }
    if (Object.keys(patch).length) await snap.ref.update(patch);

    // "We've got your request" — the moment it is made, while they are still
    // on the site and thinking about their phone.
    const request = { ...data, ...patch };
    const claimed = await claimOnce(snap.ref, "requestAckAt");
    if (!claimed) return null;
    const limited = await overAckLimit(String(data.whatsappPhone || ""));
    if (limited) {
      await snap.ref.update({ ackSkipped: limited });
      console.warn("model_requested not sent", { id: snap.id, limited });
      return null;
    }
    await notify(db, snap.id, request, "model_requested");
    return null;
  });

/**
 * "Your model is here" — when a request is approved, however it is approved.
 *
 * Approval happens in the admin page's browser, which only ever added the
 * model to the picker; nothing told the customer. Since the move off Convex
 * not one "model added" message has gone out (the last was on 16 January),
 * though the WhatsApp and email templates were set up and switched on. On the
 * server it fires once per request, whichever screen approved it.
 */
export const onModelRequestUpdated = functionsV1.firestore
  .document("modelRequests/{id}")
  .onUpdate(async (change) => {
    const before = change.before.data() || {};
    const after = change.after.data() || {};
    if (after.status !== "approved" || before.status === "approved") return null;
    const claimed = await claimOnce(change.after.ref, "availableNotifiedAt");
    if (claimed) await notify(admin.firestore(), change.after.id, after, "model_added");
    return null;
  });

/**
 * Anyone can file a request without signing in, and each one texts the number
 * in it from our WhatsApp account. A person asks for a model or two; a script
 * asks for hundreds. So: three acknowledgements a day to one number, and 60 a
 * day in all (the shop gets about one request a day). The request itself is
 * always kept; only the message is held back. Returns why, or null to send.
 */
async function overAckLimit(phone: string): Promise<string | null> {
  const digits = phone.replace(/\D/g, "").slice(-10);
  try {
    await enforceDailyRateLimit({ key: `model_ack_all`, limit: 60 });
    if (digits) await enforceDailyRateLimit({ key: `model_ack_${digits}`, limit: 3 });
    return null;
  } catch (e: any) {
    return e?.code === "resource-exhausted" ? "daily message limit reached" : null;
  }
}

/** Sets a timestamp field only if it is unset; true for the one caller that set it. */
async function claimOnce(ref: admin.firestore.DocumentReference, field: string): Promise<boolean> {
  return admin.firestore().runTransaction(async (tx) => {
    const cur = await tx.get(ref);
    if (cur.data()?.[field]) return false;
    tx.update(ref, { [field]: Date.now() });
    return true;
  });
}

const SITE = (process.env.SITE_URL || "https://goskinly.com").replace(/\/+$/, "");

async function customerName(db: admin.firestore.Firestore, r: any): Promise<string> {
  if (r.customerName || r.userName) return String(r.customerName || r.userName).split(/\s+/)[0];
  if (r.userId) {
    const u = await db.collection("users").doc(String(r.userId)).get().catch(() => null);
    const n = u?.exists ? String((u.data() as any).name || (u.data() as any).fullName || "") : "";
    if (n) return n.split(/\s+/)[0];
  }
  return "there";
}

async function notify(db: admin.firestore.Firestore, id: string, r: any, usecaseKey: "model_requested" | "model_added") {
  const brand = String(r.brandName || "").trim();
  const model = String(r.modelName || "").trim();
  const number = String(r.requestNumber || "");
  const name = await customerName(db, r);
  const shopLink = `${SITE}/products?brand=${encodeURIComponent(brand)}&utm_source=${usecaseKey === "model_added" ? "model_added" : "model_request"}&utm_medium=notification`;

  const results = await Promise.allSettled([
    // Each WhatsApp template reads exactly the names in its variableMapping;
    // extras are ignored, so the one set serves both.
    queueWhatsApp(db, usecaseKey, String(r.whatsappPhone || ""), {
      customer_name: name,
      brand_name: brand,
      model_name: model,
      request_number: number,
    }, id),
    r.userEmail ? sendEmail(db, usecaseKey, String(r.userEmail), name, id, r.userId, {
      customer_name: name, brand_name: brand, model_name: model, request_number: number,
      customerName: name, brandName: brand, modelName: model, requestNumber: number,
      shopLink,
    }) : Promise.resolve(false),
  ]);
  const [wa, mail] = results.map((x) => (x.status === "fulfilled" ? x.value : false));
  if (results.some((x) => x.status === "rejected")) {
    console.error(`${usecaseKey} notify error`, id, results.map((x) => x.status === "rejected" ? String((x as any).reason?.message || x.reason) : "ok"));
  }
  console.log(`${usecaseKey} notified`, { id, number, wa, mail });
}

/** One MSG91 usecase email, logged like the order mails. */
async function sendEmail(
  db: admin.firestore.Firestore, usecaseKey: string, to: string, name: string,
  relatedId: string, userId: unknown, variables: Record<string, string>,
): Promise<boolean> {
  const authkey = process.env.MSG91_AUTH_TOKEN || "";
  if (!authkey || !to) return false;
  const tpl = await db.collection("emailUsecaseTemplates").where("usecaseKey", "==", usecaseKey).limit(1).get();
  if (tpl.empty || tpl.docs[0].data().enabled !== true) return false;
  const t = tpl.docs[0].data();
  const res = await fetch("https://control.msg91.com/api/v5/email/send", {
    method: "POST",
    headers: { authkey, "Content-Type": "application/json" },
    body: JSON.stringify({
      template_id: t.msg91TemplateId,
      recipients: [{ to: [{ email: to, name }], variables }],
      from: { email: "noreply@mail.goskinly.com", name: "GoSkinly" },
      domain: "mail.goskinly.com",
    }),
  });
  const text = await res.text();
  await db.collection("emailMessages").add({
    createdAt: Date.now(), recipientEmail: to, recipientUserId: userId || null, usecaseKey,
    templateName: t.templateName || usecaseKey, msg91TemplateId: t.msg91TemplateId,
    relatedModelRequestId: relatedId, variables,
    status: res.ok ? "sent" : "failed", ...(res.ok ? {} : { errorMessage: text.slice(0, 500) }),
  });
  return res.ok;
}
