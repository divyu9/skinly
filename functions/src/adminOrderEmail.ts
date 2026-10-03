import * as functionsV1 from "firebase-functions/v1";
import { HttpsError } from "firebase-functions/v1/https";
import * as admin from "firebase-admin";
import { transactionalFrom } from "./mailFrom";

/**
 * "New order!" — an email to the shop's own inbox the moment an order is
 * confirmed, so nobody has to keep the admin open to know.
 *
 * Sent from notifyOrderPlaced (orderNotifications.ts), which runs once per
 * order at confirmation, beside the admin WhatsApp. Recipients and the on /
 * off switch live in settings/adminAlerts (Admin › Emails › Admin alerts);
 * the MSG91 template is the `admin_new_order` usecase
 * (docs/email-templates/admin_new_order.html).
 */

const SITE = (process.env.SITE_URL || "https://goskinly.com").replace(/\/+$/, "");
const IST = 5.5 * 3600 * 1000;
const rupees = (n: unknown) => `₹${Math.round(Number(n) || 0).toLocaleString("en-IN")}`;
const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] || "th"}`;

export async function sendAdminOrderEmail(db: admin.firestore.Firestore, order: any, orderId: string, opts: { force?: boolean } = {}): Promise<boolean> {
  const cfg = (await db.collection("settings").doc("adminAlerts").get()).data() as any;
  const to: string[] = (Array.isArray(cfg?.emails) ? cfg.emails : []).map((e: unknown) => String(e).trim().toLowerCase()).filter((e: string) => /@/.test(e));
  if (!to.length || (!opts.force && cfg?.newOrderEmail === false)) return false;
  const tpl = await db.collection("emailUsecaseTemplates").where("usecaseKey", "==", "admin_new_order").limit(1).get();
  if (tpl.empty || (!opts.force && tpl.docs[0].data().enabled !== true)) return false;
  const authkey = process.env.MSG91_AUTH_TOKEN || "";
  if (!authkey) return false;

  const items: any[] = Array.isArray(order.items) ? order.items : [];
  const cod = String(order.paymentMethod || "").toLowerCase() === "cod";
  const total = Number(order.total ?? order.amountPayable) || 0;
  const itemsText = items.map((i) => {
    const qty = Number(i?.quantity) || 1;
    const device = i?.phoneModel ? ` (${[i.phoneBrand, i.phoneModel].filter(Boolean).join(" ")})` : "";
    return `${qty > 1 ? `${qty} × ` : ""}${String(i?.productTitle || "Item")}${device}`;
  }).join("  ·  ");
  const upsell = items.filter((i) => i?.upsellRuleId).reduce((s, i) => s + (Number(i?.price) || 0) * (Number(i?.quantity) || 1), 0);

  // Today so far, in IST: which order this is, and what the day has sold.
  const dayStart = Math.floor((Date.now() + IST) / 86400000) * 86400000 - IST;
  const today = (await db.collection("orders").where("createdAt", ">=", dayStart).get()).docs
    .map((d) => d.data() as any)
    .filter((o) => o.orderNumber && !o.isDeleted && o.status !== "pending_payment" && o.status !== "cancelled" && o.paymentStatus !== "failed" && !o.addOnTo);
  const n = Math.max(1, today.length);
  const sold = today.reduce((s, o) => s + (Number(o.total ?? o.amountPayable) || 0), 0);

  const img = String(items[0]?.productImage || "");
  const variables: Record<string, string> = {
    orderNumber: String(order.orderNumber || ""),
    amountText: rupees(total),
    paymentLine: cod ? `Cash on delivery — collect ${rupees(Math.max(0, total - (Number(order.prepaidAmount) || 0)))}` : "Paid online ✓",
    customerName: String(order.shippingAddress?.fullName || order.customerName || "A customer"),
    city: [order.shippingAddress?.city, order.shippingAddress?.state].filter(Boolean).join(", ") || "India",
    itemsText: itemsText || "—",
    itemCount: `${items.reduce((s, i) => s + (Number(i?.quantity) || 1), 0)} item${items.length === 1 && (Number(items[0]?.quantity) || 1) === 1 ? "" : "s"}`,
    productPhoto: /^https:\/\//.test(img) && !img.includes("res.cloudinary.com") ? img.replace(/ /g, "%20")
      : "https://mailer-prod-api-assets.s3.ap-southeast-2.amazonaws.com/templates/1765380300-outbound-23404-Skinly_Logo.png",
    upsellLine: upsell > 0 ? `Includes ${rupees(upsell)} of add-ons` : "No add-ons this time",
    todayLine: `${ordinal(n)} order today · ${rupees(sold)} sold today`,
    adminLink: `${SITE}/backend-skinly/orders/${orderId}`,
    dashboardLink: `${SITE}/backend-skinly`,
  };

  const res = await fetch("https://control.msg91.com/api/v5/email/send", {
    method: "POST",
    headers: { authkey, "Content-Type": "application/json" },
    body: JSON.stringify({
      template_id: tpl.docs[0].data().msg91TemplateId,
      recipients: to.map((email) => ({ to: [{ email, name: "GoSkinly" }], variables })),
      from: transactionalFrom("GoSkinly Orders"),
      domain: "mail.goskinly.com",
    }),
  });
  const text = await res.text();
  await db.collection("emailMessages").add({
    createdAt: Date.now(), recipientEmail: to.join(", "), usecaseKey: "admin_new_order",
    templateName: tpl.docs[0].data().templateName || "admin_new_order", msg91TemplateId: tpl.docs[0].data().msg91TemplateId,
    relatedOrderId: orderId, variables, status: res.ok ? "sent" : "failed", ...(res.ok ? {} : { errorMessage: text.slice(0, 500) }),
  });
  return res.ok;
}

/** Admin › Emails › Admin alerts › "Send test": the email for the latest confirmed order. */
export const testAdminOrderEmail = functionsV1.https.onCall(async (_data: any, context: any) => {
  const { requireAdmin } = await import("./auth");
  await requireAdmin(context);
  const db = admin.firestore();
  const recent = await db.collection("orders").orderBy("createdAt", "desc").limit(40).get();
  const d = recent.docs.find((x) => { const o = x.data() as any; return o.orderNumber && !o.isDeleted && o.status !== "pending_payment" && o.paymentStatus !== "failed"; });
  if (!d) throw new HttpsError("not-found", "No confirmed order to use for the test");
  const ok = await sendAdminOrderEmail(db, d.data(), d.id, { force: true });
  if (!ok) throw new HttpsError("failed-precondition", "Not sent — add a recipient and check the admin_new_order template ID in Admin › Emails");
  return { ok, orderNumber: (d.data() as any).orderNumber };
});
