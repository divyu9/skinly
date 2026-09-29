import * as admin from "firebase-admin";

/**
 * Telling the people who asked to be told.
 *
 * A shopper who taps "notify me when this is back" is the warmest lead this
 * shop gets: they chose the design, chose their model, and left a phone
 * number. Those requests were being collected faithfully and sent only when
 * an admin remembered to open Stock Notifications and press a button — so in
 * practice a design could come back, sell out again, and the people waiting
 * for it would never hear a word.
 *
 * Stock now tells them itself, the moment a variant crosses back above zero.
 */

/**
 * Queues the back-in-stock message for everyone waiting on these variants.
 *
 * Queued rather than sent: the WhatsApp worker owns delivery, so these get the
 * same claim, retry cap and daily ceiling as every other message. Silent about
 * a usecase that does not exist or is switched off — that is a decision
 * somebody made, not an error to raise from a stock recount.
 */
const RESTOCK_CAP = 100;

export async function notifyRestocked(
  db: admin.firestore.Firestore,
  variantIds: string[]
): Promise<number> {
  const ids = [...new Set(variantIds.filter(Boolean))];
  if (!ids.length) return 0;

  const uc = await db.collection("whatsappUsecases")
    .where("usecaseKey", "==", "back_in_stock").limit(1).get();
  const waOn = !uc.empty && uc.docs[0].data().enabled === true;
  const usecase = (uc.empty ? {} : uc.docs[0].data()) as any;
  // The email (MSG91 `back_in_stock`, docs/email-templates/back_in_stock.html)
  // goes to whoever left an address, alongside or instead of the WhatsApp.
  const et = await db.collection("emailUsecaseTemplates").where("usecaseKey", "==", "back_in_stock").limit(1).get();
  const emailTemplateId = !et.empty && et.docs[0].data().enabled === true && process.env.MSG91_AUTH_TOKEN
    ? String(et.docs[0].data().msg91TemplateId || "") : "";
  if (!waOn && !emailTemplateId) return 0;

  let queued = 0;
  for (const variantId of ids) {
    const waiting = await db.collection("stockNotifications")
      .where("variantId", "==", variantId)
      .where("status", "==", "waiting")
      .get();
    if (waiting.empty) continue;

    // Requests made before titles were stored carry none, and the template
    // would go out with an empty product name.
    const variantSnap = await db.collection("variants").doc(variantId).get();
    const variant = (variantSnap.data() || {}) as any;
    const productSnap = variant.productId
      ? await db.collection("products").doc(String(variant.productId)).get()
      : null;
    const product = (productSnap?.data() || {}) as any;

    /*
     * One message per number, and at most RESTOCK_CAP per variant per restock.
     * Anyone can leave a number here, so without a ceiling a restock would
     * text however many a script planted; and each message is four writes,
     * so past 125 the batch was over Firestore's 500 and nobody heard at all.
     * The ones past the cap stay waiting for the next restock.
     */
    const batch = db.batch();
    const seen = new Set<string>();
    const emails = new Set<string>();
    for (const d of waiting.docs) {
      const n = d.data() as any;
      if (seen.size >= RESTOCK_CAP) break;
      if (seen.has(String(n.phoneNumber))) continue;
      seen.add(String(n.phoneNumber));
      const email = String(n.userEmail || "").trim().toLowerCase();
      if (emailTemplateId && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) emails.add(email);
      const msgRef = db.collection("whatsappMessages").doc();
      if (waOn) batch.set(msgRef, {
        usecaseKey: "back_in_stock",
        templateName: usecase.templateName,
        providerTemplateId: usecase.providerTemplateId,
        recipientPhone: n.phoneNumber,
        recipientUserId: n.userId || null,
        // Every name the template editor offers that this message can fill;
        // the worker sends only the ones the template declares.
        variables: {
          product_name: n.productTitle || product.title || "",
          variant_name: n.variantTitle || variant.title || "",
          model_name: n.variantTitle || variant.title || "",
          product_url: `https://goskinly.com/products/${n.productSlug || product.slug || ""}`,
          product_price: variant.price ? `₹${variant.price}` : "",
          shop_url: "https://goskinly.com",
          company_name: "GoSkinly",
          customer_name: "there",
          stock_notification: "back in stock",
        },
        status: "pending",
        retryCount: 0,
        createdAt: Date.now(),
        queuedBy: "auto-restock",
      });
      if (waOn) batch.set(db.collection("whatsappQueue").doc(), {
        messageId: msgRef.id,
        status: "pending",
        attempts: 0,
        priority: "normal",
        scheduledFor: Date.now(),
        createdAt: Date.now(),
      });
      // Kept as history under a fresh id: the waiting request's id is
      // variant+phone, and it has to be free again for the next time this
      // customer asks.
      batch.set(db.collection("stockNotifications").doc(), {
        ...n,
        status: "notified",
        notifiedAt: Date.now(),
        messageId: waOn ? msgRef.id : null,
        emailed: emails.has(email),
      });
      batch.delete(d.ref);
      queued++;
    }
    await batch.commit();
    if (emails.size) {
      await sendRestockEmail(db, emailTemplateId, [...emails], {
        productName: String(product.title || waiting.docs[0].data().productTitle || "Your Skinly pick"),
        variant: String(variant.title || waiting.docs[0].data().variantTitle || ""),
        image: String(product.images?.[0]?.url || (typeof product.images?.[0] === "string" ? product.images[0] : "") || product.designImageUrl || ""),
        price: variant.price ? `₹${variant.price}` : "",
        url: `https://goskinly.com/products/${product.slug || waiting.docs[0].data().productSlug || ""}?utm_source=email&utm_medium=back_in_stock`,
      }).catch((e) => console.error("restock email failed", { variantId, error: e?.message || e }));
    }
  }

  if (queued) console.log("notifyRestocked", { variants: ids.length, queued });
  return queued;
}

/** One MSG91 send for everyone who left an email on this variant. */
async function sendRestockEmail(
  db: admin.firestore.Firestore,
  templateId: string,
  to: string[],
  p: { productName: string; variant: string; image: string; price: string; url: string }
): Promise<void> {
  const img = /^https:\/\//.test(p.image) && !p.image.includes("res.cloudinary.com") ? p.image.replace(/ /g, "%20")
    : "https://mailer-prod-api-assets.s3.ap-southeast-2.amazonaws.com/templates/1765447805-outbound-23404-Skinly_Logo.png";
  const variant = /^default( title)?$/i.test(p.variant) ? "" : p.variant;
  const variables = {
    firstName: "there",
    productName: p.productName,
    variantLine: variant ? `For ${variant}` : "Cut fresh for your device",
    productPhoto: img,
    productPrice: p.price || "Shop now",
    productUrl: p.url,
  };
  const res = await fetch("https://control.msg91.com/api/v5/email/send", {
    method: "POST",
    headers: { authkey: process.env.MSG91_AUTH_TOKEN || "", "Content-Type": "application/json" },
    body: JSON.stringify({
      template_id: templateId,
      recipients: to.map((email) => ({ to: [{ email, name: "there" }], variables })),
      from: { email: "noreply@mail.goskinly.com", name: "GoSkinly" },
      domain: "mail.goskinly.com",
    }),
  });
  const text = await res.text();
  await db.collection("emailMessages").add({
    createdAt: Date.now(), recipientEmail: to.join(", "), usecaseKey: "back_in_stock", msg91TemplateId: templateId,
    variables, status: res.ok ? "sent" : "failed", ...(res.ok ? {} : { errorMessage: text.slice(0, 500) }),
  });
}

