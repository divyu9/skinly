import * as functionsV1 from "firebase-functions/v1";
import * as admin from "firebase-admin";

/**
 * An email whenever money lands in a customer's Skinly wallet.
 *
 * Wallet credits come from five places — delivery cashback and coupon
 * credit (orderStatus.ts), review rewards (reviewRewards.ts), refunds
 * (ordersAdmin.ts), referral rewards (referrals.ts) and owed credit paid on
 * sign-up (userDoc.ts) — and every one writes a walletTransactions row. So
 * this listens there, once, instead of five senders: nobody was told about
 * any of it, and money nobody knows about is never spent.
 *
 * Refunds use the `wallet_refund` usecase, everything else `wallet_credited`
 * (Admin › Emails; both start switched off until their MSG91 templates are
 * approved). Templates: docs/email-templates/wallet_credited.html and
 * wallet_refund.html. Condition-free variables, as MSG91 needs.
 */

const SITE = (process.env.SITE_URL || "https://goskinly.com").replace(/\/+$/, "");
const rupees = (n: unknown) => `₹${(Math.round((Number(n) || 0) * 100) / 100).toLocaleString("en-IN")}`;

export const onWalletCredit = functionsV1.firestore
  .document("walletTransactions/{id}")
  .onCreate(async (snap) => {
    const t = snap.data() as any;
    if (t?.transactionType !== "credit" || !(Number(t.amount) > 0)) return null;
    const db = admin.firestore();
    const source = String(t.source || t.type || "");
    const usecaseKey = source === "refund" ? "wallet_refund" : "wallet_credited";

    // Who: the wallet's account (by document id, or by sign-in uid), else the order's email.
    const users = db.collection("users");
    let user = t.userId ? (await users.doc(String(t.userId)).get()).data() as any : null;
    if (!user && t.ownerUid) user = (await users.where("authUid", "==", String(t.ownerUid)).limit(1).get()).docs[0]?.data();
    const order = t.relatedOrderId ? (await db.collection("orders").doc(String(t.relatedOrderId)).get()).data() as any : null;
    const to = String(user?.email || order?.email || "").trim().toLowerCase();
    if (!to) return null;
    const name = String(user?.name || user?.fullName || order?.shippingAddress?.fullName || order?.customerName || "").trim();
    const first = name.split(/\s+/)[0] || "there";
    const orderNumber = String(order?.orderNumber || "");

    const reasonLine =
      source === "refund" ? `Refund for order ${orderNumber}`.trim()
      : source === "review_reward" ? `Thanks for reviewing order ${orderNumber} — here's your reward`.trim()
      : source === "referral_reward" ? "Your friend's order was delivered — here's your referral reward"
      : ["cashback", "coupon_credit", "delivery_credit"].includes(source) ? `Cashback for order ${orderNumber}, now that it's delivered`.trim()
      : String(t.description || "Added to your Skinly wallet");

    // WhatsApp (`wallet_credited` usecase, off until switched on), whatever the email does.
    const phone = String(user?.phone || user?.phoneNumber || order?.shippingAddress?.phone || order?.phone || "").replace(/\D/g, "").slice(-10);
    if (/^[6-9]\d{9}$/.test(phone)) {
      const { queueWhatsApp } = await import("./orderNotifications");
      await queueWhatsApp(db, "wallet_credited", phone, {
        customer_name: first, amount_text: rupees(t.amount), reason_line: reasonLine, wallet_balance: rupees(t.balanceAfter),
        wallet_link: `${SITE}/account/wallet?utm_source=whatsapp&utm_medium=wallet_credited`,
      }, String(t.relatedOrderId || "")).catch(() => false);
    }

    const tpl = await db.collection("emailUsecaseTemplates").where("usecaseKey", "==", usecaseKey).limit(1).get();
    if (tpl.empty || tpl.docs[0].data().enabled !== true) return null;
    const authkey = process.env.MSG91_AUTH_TOKEN || "";
    if (!authkey) return null;

    const variables: Record<string, string> = {
      customerName: name || "there",
      firstName: first,
      amount: String(Math.round((Number(t.amount) || 0) * 100) / 100),
      amountText: rupees(t.amount),
      walletBalance: rupees(t.balanceAfter),
      orderNumber: orderNumber || "—",
      reasonLine,
      walletLink: `${SITE}/account/wallet?utm_source=email&utm_medium=${usecaseKey}`,
      shopLink: `${SITE}/products?utm_source=email&utm_medium=${usecaseKey}`,
    };

    const res = await fetch("https://control.msg91.com/api/v5/email/send", {
      method: "POST",
      headers: { authkey, "Content-Type": "application/json" },
      body: JSON.stringify({
        template_id: tpl.docs[0].data().msg91TemplateId,
        recipients: [{ to: [{ email: to, name: name || first }], variables }],
        from: { email: "noreply@mail.goskinly.com", name: "GoSkinly" },
        domain: "mail.goskinly.com",
      }),
    });
    const text = await res.text();
    await db.collection("emailMessages").add({
      createdAt: Date.now(), recipientEmail: to, recipientUserId: t.userId || null, usecaseKey,
      templateName: tpl.docs[0].data().templateName || usecaseKey, msg91TemplateId: tpl.docs[0].data().msg91TemplateId,
      relatedOrderId: t.relatedOrderId || null, relatedWalletTransactionId: snap.id, variables,
      status: res.ok ? "sent" : "failed", ...(res.ok ? {} : { errorMessage: text.slice(0, 500) }),
    });
    console.log("onWalletCredit", { id: snap.id, source, usecaseKey, ok: res.ok });
    return null;
  });
