import * as functions from "firebase-functions/v1";
import { reserveMaterialForOrder } from "./materials";
import { cashbackForLines } from "./cashback";
import { notifyOrderPlaced } from "./orderNotifications";
import { HttpsError } from "firebase-functions/v1/https";
import * as admin from "firebase-admin";
import * as crypto from "crypto";
import { getCaller } from "./auth";

/** Atomic counter increment — runs in background while cart is being fetched */
const reserveOrderNumber = async (db: admin.firestore.Firestore): Promise<string> => {
  const counterRef = db.collection("settings").doc("order_counter");
  let orderNumber = "";
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(counterRef);
    const current = snap.exists ? (snap.data()?.value ?? 4001) : 4001;
    tx.set(counterRef, { value: current + 1 }, { merge: true });
    orderNumber = `#${current}`;
  });
  return orderNumber;
};

const getPhonePeConfig = () => {
  const merchantId = process.env.PHONEPE_MERCHANT_ID || "";
  const saltKey = process.env.PHONEPE_SALT_KEY || "";
  const saltIndex = process.env.PHONEPE_SALT_INDEX || "1";
  const environment = process.env.PHONEPE_ENVIRONMENT || "PRODUCTION";
  if (!merchantId || !saltKey) {
    throw new HttpsError("failed-precondition", "PhonePe credentials not configured.");
  }
  const v1BaseUrl =
    environment === "PRODUCTION"
      ? "https://api.phonepe.com/apis/hermes"
      : "https://api-preprod.phonepe.com/apis/pg-sandbox";
  return { merchantId, saltKey, saltIndex, v1BaseUrl };
};

/**
 * Fast combined placeOrder — single function call for the entire checkout.
 *
 * Perf vs naive createOrder + initiatePayment:
 *   - No rate-limit Firestore transaction        → -800ms
 *   - No order-counter Firestore transaction     → -1200ms
 *     (order number derived from pre-generated doc ID, zero cost)
 *   - Variant lookups batched into 1 query       → faster than N individual queries
 *   - PhonePe called immediately, no re-fetch    → -500ms round trip
 *   - Fire-and-forget the post-payment doc update → doesn't block response
 */
export const placeOrder = functions
  .runWith({ memory: "256MB", timeoutSeconds: 120, minInstances: 1 })
  .https.onCall(async (data: any, context: any) => {
    const { uid } = getCaller(context);
    const db = admin.firestore();

    const { shippingAddress, customerEmail, guestEmail, paymentMethod, guestItems,
            sessionId: reqSessionId, customerPhone, couponId, walletAmount } = data;
    // Note: couponDiscount / prepaidAmount / amount also arrive from the client.
    // They are deliberately ignored — every figure below is re-derived here.

    // ── 1. Kick off order number reservation immediately (runs in background) ──
    // Cart fetch + variant query take ~500ms. The counter transaction takes ~800-1200ms.
    // By starting both at the same time we overlap most of the wait.
    const orderNumberPromise = reserveOrderNumber(db);

    // Pre-generate doc ref so we have orderId before any writes
    const docRef = db.collection("orders").doc();
    const orderId = docRef.id;

    // ── 2. Fetch cart items ───────────────────────────────────────────────────
    let orderItems: any[] = [];
    if (uid) {
      const snap = await db.collection("cart").where("userId", "==", uid).get();
      orderItems = snap.docs.map((d) => d.data());
    } else if (guestItems && guestItems.length > 0) {
      orderItems = guestItems;
    } else if (reqSessionId) {
      const snap = await db.collection("cart").where("sessionId", "==", reqSessionId).get();
      orderItems = snap.docs.map((d) => d.data());
    }

    if (!orderItems || orderItems.length === 0) {
      throw new HttpsError("failed-precondition", "Cannot create order with an empty cart");
    }

    /*
     * An order has to have a usable email address.
     *
     * The checkout page has asked for one for a while, but only the browser
     * was checking — so every other way in left it blank, and orders exist
     * with no email at all. Those customers cannot be sent a confirmation, a
     * dispatch note or a delivery note, and cannot look their own order up on
     * the tracking page. Checked here, where it cannot be skipped.
     */
    const email = String(customerEmail || guestEmail || "").trim().toLowerCase();
    if (!email) {
      throw new HttpsError("failed-precondition", "An email address is required to place an order");
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      throw new HttpsError("failed-precondition", `"${email}" is not a valid email address`);
    }

    // ── 3. Batch-fetch all variant prices in ONE Firestore query ──────────────
    const productIds = Array.from(
      new Set(orderItems.map((i) => i?.productId).filter((p): p is string => typeof p === "string" && p.length > 0))
    );

    const priceMap = new Map<string, number>();
    // The variant's own id as well, because a cashback rule can target one.
    const variantIdMap = new Map<string, string>();
    if (productIds.length > 0) {
      // Firestore "in" supports up to 30 values; chunk just in case
      const chunks: string[][] = [];
      for (let i = 0; i < productIds.length; i += 30) chunks.push(productIds.slice(i, i + 30));
      const snaps = await Promise.all(chunks.map((chunk) => db.collection("variants").where("productId", "in", chunk).get()));
      for (const snap of snaps) {
        for (const d of snap.docs) {
          const v = d.data() as any;
          const key = `${String(v.productId)}::${String(v.title)}`;
          priceMap.set(key, Number(v.price || 0));
          variantIdMap.set(key, d.id);
        }
      }
    }

    // Price comes from the variant document, always. The old fallback to
    // `item.price` meant a cart line naming a variant that does not exist was
    // billed at whatever the caller claimed — send variant "zzz" with price 1
    // and a ₹5,000 order became ₹1.
    const itemsTotal = orderItems.reduce((sum, item) => {
      const qty = Math.max(1, Math.floor(Number(item?.quantity || 1)));
      const dbPrice = item?.productId && item?.variant
        ? priceMap.get(`${String(item.productId)}::${String(item.variant)}`)
        : undefined;
      if (typeof dbPrice !== "number") {
        throw new HttpsError(
          "failed-precondition",
          `No such variant "${item?.variant}" for product ${item?.productId}`
        );
      }
      // An unpriced variant is not for sale. New Hexa Ring carried twenty rows
      // at price 0; the storefront hides them, but this is the line that bills,
      // and it would have charged ₹0 for any of them.
      if (!(dbPrice > 0)) {
        throw new HttpsError(
          "failed-precondition",
          `"${item?.variant}" is not available to order`
        );
      }
      return sum + dbPrice * qty;
    }, 0);

    // ── 3a. Shipping, the same rule the checkout page shows ──────────────────
    // Checkout adds flatShippingFee below freeShippingThreshold and shows it in
    // the total, but this function never added it, so PhonePe collected ₹70
    // less than the customer was shown on every order under the threshold.
    // Defaults match the storefront's fallback when the settings doc is absent.
    const shipSnap = await db.collection("settings").doc("shipping").get();
    const ship = shipSnap.exists ? (shipSnap.data() as any) : {};
    const freeShippingThreshold = Number(ship.freeShippingThreshold ?? 500);
    const flatShippingFee = Number(ship.flatShippingFee ?? 50);
    const shippingFee = itemsTotal >= freeShippingThreshold ? 0 : Math.max(0, flatShippingFee);

    // ── 3b. Re-derive every discount server-side ──────────────────────────────
    /*
     * Every rule the admin set on a coupon, enforced where it bills.
     *
     * The form writes seven of them — a window, a minimum, a cap, a usage
     * limit, an email allowlist — and this read exactly one, `isActive`. So an
     * expired coupon still worked, a "first 100 customers" coupon worked
     * forever because nothing ever incremented `usageCount`, and a coupon
     * meant for three named people worked for everyone. The list on the admin
     * page showed "0 / 100" for all of them, which was true and useless.
     *
     * The count is claimed in a transaction before the order is written, so
     * two people racing for the last use cannot both get it.
     */
    let couponDiscount = 0;
    let walletCreditCouponAmount = 0;
    let couponCode = "";
    if (couponId && typeof couponId === "string") {
      const couponRef = db.collection("coupons").doc(couponId);
      const cSnap = await couponRef.get();
      const c = cSnap.exists ? (cSnap.data() as any) : null;
      if (!c) throw new HttpsError("failed-precondition", "That coupon no longer exists");
      if (c.isActive !== true) throw new HttpsError("failed-precondition", "That coupon is no longer active");

      const now = Date.now();
      if (c.startDate && now < Number(c.startDate)) {
        throw new HttpsError("failed-precondition", "That coupon is not valid yet");
      }
      if (c.endDate && now > Number(c.endDate)) {
        throw new HttpsError("failed-precondition", "That coupon has expired");
      }

      // The form writes `minPurchase` and `maxDiscount`; this read
      // `minPurchaseAmount` and `maxDiscountAmount`, names nothing has ever
      // written — so every minimum an admin set was ignored on the line that
      // actually bills, and every percentage cap with it.
      const minPurchase = Number(c.minPurchase ?? c.minCartValue ?? c.minPurchaseAmount ?? 0);
      const maxDiscount = Number(c.maxDiscount ?? c.maxDiscountAmount ?? 0);
      if (minPurchase > 0 && itemsTotal < minPurchase) {
        throw new HttpsError("failed-precondition", `This coupon needs a cart of at least ₹${minPurchase}`);
      }

      const allowed: string[] = Array.isArray(c.allowedCustomerEmails)
        ? c.allowedCustomerEmails.map((e: any) => String(e).trim().toLowerCase()).filter(Boolean)
        : [];
      if (allowed.length && !allowed.includes(email)) {
        throw new HttpsError("failed-precondition", "This coupon is not available on this account");
      }

      // Claim one use, or find out there are none left.
      const limit = Number(c.usageLimit) || 0;
      await db.runTransaction(async (tx) => {
        const fresh = await tx.get(couponRef);
        const used = Number((fresh.data() as any)?.usageCount) || 0;
        if (limit > 0 && used >= limit) {
          throw new HttpsError("failed-precondition", "This coupon has been fully used");
        }
        tx.update(couponRef, { usageCount: used + 1, lastUsedAt: Date.now() });
      });

      couponCode = String(c.code || "");
      if (c.discountType === "percentage") {
        couponDiscount = Math.floor(itemsTotal * (Number(c.discountValue || 0) / 100));
        if (maxDiscount > 0) couponDiscount = Math.min(couponDiscount, maxDiscount);
      } else {
        couponDiscount = Math.min(itemsTotal, Number(c.discountValue || 0));
      }
      /*
       * A wallet-credit coupon pays out afterwards; it is not money off now.
       *
       * The amount is kept, which it never was: the order recorded a coupon
       * worth ₹0 and nothing else, so the "₹100 wallet credit on delivery"
       * the checkout page promised had nowhere to be read from and was never
       * paid to anybody.
       */
      if (c.isWalletCredit === true || c.effectType === "wallet_credit") {
        walletCreditCouponAmount = couponDiscount;
        couponDiscount = 0;
      }
    }

    // What this order earns back on delivery, settled now at today's rules.
    const cashback = await cashbackForLines(
      db,
      orderItems.map((item) => {
        const key = `${String(item?.productId)}::${String(item?.variant)}`;
        return {
          productId: String(item?.productId || ""),
          variantId: variantIdMap.get(key),
          unitPrice: priceMap.get(key) || 0,
          quantity: Math.max(1, Math.floor(Number(item?.quantity || 1))),
        };
      }).filter((l) => l.productId),
      itemsTotal
    ).catch((e) => {
      // Never lose an order over the cashback table.
      console.error("placeOrder: cashback calculation failed", { order: orderId, error: e?.message || e });
      return { total: 0, lines: [] };
    });

    // Wallet is capped by the balance the server can see, never by the request.
    let walletUsed = 0;
    if (uid && Number(walletAmount) > 0) {
      const uSnap = await db.collection("users").doc(uid).get();
      const balance = Number(uSnap.exists ? (uSnap.data() as any)?.walletBalance || 0 : 0);
      // The storefront lets the wallet cover shipping too.
      walletUsed = Math.max(0, Math.min(Number(walletAmount), balance, itemsTotal + shippingFee - couponDiscount));
    }

    // COD fee and the prepaid split come from codSettings, same formula the
    // storefront shows.
    let codFee = 0;
    let prepaidAmount = 0;
    if (paymentMethod === "cod") {
      const cs = await db.collection("codSettings").limit(1).get();
      const st = cs.empty ? {} : (cs.docs[0].data() as any);
      const base = itemsTotal - couponDiscount - walletUsed;
      codFee = st.codFeeType === "fixed"
        ? Number(st.codFeeValue || 0)
        : (base * Number(st.codFeeValue || 0)) / 100;
      if (st.partialCodEnabled === true) {
        prepaidAmount = st.prepaidType === "fixed"
          ? Number(st.prepaidValue || 0)
          : (base * Number(st.prepaidValue || 0)) / 100;
      }
    }

    const calculatedTotal = Math.max(0, itemsTotal + shippingFee - couponDiscount - walletUsed + codFee);
    // What PhonePe must collect right now: the whole thing for prepaid, only
    // the prepaid slice for partial COD.
    const amountPayable = paymentMethod === "cod"
      ? Math.max(0, Math.min(prepaidAmount, calculatedTotal))
      : calculatedTotal;

    // ── 4. Write order ────────────────────────────────────────────────────────
    // Collect the order number now — by this point cart+variants took ~500ms,
    // so the counter transaction (started at step 1) is usually already done.
    const orderNumber = await orderNumberPromise;

    await docRef.set({
      orderNumber,
      userId: uid || reqSessionId || "guest",
      customerName: shippingAddress?.fullName || "Guest",
      email,
      phone: shippingAddress?.phone || "",
      shippingAddress: shippingAddress || {},
      paymentMethod: paymentMethod || "prepaid",
      status: "pending",
      paymentStatus: "pending",
      itemsTotal,
      shippingFee,
      couponId: couponId || null,
      couponCode,
      couponDiscount,
      walletUsed,
      // Paid into the wallet when the parcel lands — see creditWalletOnDelivery.
      walletCreditCouponAmount,
      cashbackAmount: cashback.total,
      cashbackLines: cashback.lines,
      creditOnDelivery: walletCreditCouponAmount + cashback.total,
      codFee,
      prepaidAmount,
      total: calculatedTotal,
      // The only figure any payment step may charge.
      amountPayable,
      items: orderItems,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // ── 4b. Draw down design stock ────────────────────────────────────────────
    // After the order is safely written, and deliberately not blocking on it:
    // an order must never be lost because the stock ledger had a bad row.
    reserveMaterialForOrder(db, docRef, orderItems).catch((e) =>
      console.error("reserveMaterial failed", { order: docRef.id, error: e?.message || e })
    );

    // ── 4c. Tell the customer ─────────────────────────────────────────────────
    // COD only. An online order is notified once PhonePe confirms the money,
    // from applyPaymentResult — "we've got your order" before payment is worse
    // than silence. Non-blocking for the same reason as the stock draw-down.
    if (paymentMethod !== "phonepe") {
      notifyOrderPlaced(db, docRef.id).catch((e) =>
        console.error("notifyOrderPlaced failed", { order: docRef.id, error: e?.message || e })
      );
    }

    // ── 5. Initiate PhonePe (same function call, no second round-trip) ──────────
    if (paymentMethod === "phonepe" && calculatedTotal > 0 && customerPhone) {
      let phoneDigits = String(customerPhone).replace(/\D/g, "");
      if (phoneDigits.length === 12 && phoneDigits.startsWith("91")) phoneDigits = phoneDigits.slice(2);
      if (!/^[0-9]{10}$/.test(phoneDigits)) throw new HttpsError("invalid-argument", "Invalid phone number");

      const config = getPhonePeConfig();
      const merchantTransactionId = `${orderNumber.replace("#", "")}-${Date.now().toString().slice(-6)}`;
      const amountInPaise = Math.max(Math.round(amountPayable * 100), 100);
      const siteUrl = (process.env.SITE_URL || "https://goskinly.com").replace(/\/+$/, "");
      // The function, not the SPA route — see the note in phonepe.ts.
      const callbackFnUrl = process.env.CALLBACK_FN_URL
        || `https://us-central1-${process.env.GCLOUD_PROJECT || "skinly-3003b"}.cloudfunctions.net/paymentCallback`;

      const paymentPayload = {
        merchantId: config.merchantId,
        merchantTransactionId,
        merchantUserId: uid || (reqSessionId ? String(reqSessionId).slice(-24) : "GUEST_USER"),
        amount: amountInPaise,
        redirectUrl: `${siteUrl}/payment/callback`,
        redirectMode: "REDIRECT",
        callbackUrl: callbackFnUrl,
        mobileNumber: phoneDigits,
        paymentInstrument: { type: "PAY_PAGE" },
      };

      const base64Payload = Buffer.from(JSON.stringify(paymentPayload)).toString("base64");
      const endpoint = "/pg/v1/pay";
      const xVerify = `${crypto.createHash("sha256").update(base64Payload + endpoint + config.saltKey).digest("hex")}###${config.saltIndex}`;

      console.log("PhonePe placeOrder", { merchantTransactionId, amount: amountInPaise, orderNumber });

      try {
        const fetch = require("node-fetch");
        const response = await fetch(`${config.v1BaseUrl}${endpoint}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-VERIFY": xVerify, accept: "application/json" },
          body: JSON.stringify({ request: base64Payload }),
        });

        const responseText = await response.text();
        let responseData: any = {};
        try { responseData = JSON.parse(responseText); } catch {
          console.error("PhonePe non-JSON", { status: response.status, body: responseText.slice(0, 200) });
          return { orderId, orderNumber, remainingAmount: calculatedTotal, trackingToken: `TRACK-${orderId}`, paymentError: `PhonePe HTTP ${response.status}` };
        }

        console.log("PhonePe response", { code: responseData.code, success: responseData.success });

        if (!response.ok || !responseData.success) {
          const errMsg = `PhonePe error: ${responseData.code || "UNKNOWN"} - ${responseData.message || "Payment initiation failed"}`;
          console.error("PhonePe failed", responseData);
          return { orderId, orderNumber, remainingAmount: calculatedTotal, trackingToken: `TRACK-${orderId}`, paymentError: errMsg };
        }

        const paymentUrl = responseData.data?.instrumentResponse?.redirectInfo?.url;
        if (!paymentUrl) {
          return { orderId, orderNumber, remainingAmount: calculatedTotal, trackingToken: `TRACK-${orderId}`, paymentError: "PhonePe returned no payment URL" };
        }

        // Fire-and-forget — doesn't block the redirect
        docRef.update({ paymentTransactionId: merchantTransactionId, paymentStatus: "PENDING", paymentProvider: "phonepe" })
          .catch((e) => console.error("order txn update failed", e));

        return { orderId, orderNumber, remainingAmount: calculatedTotal, trackingToken: `TRACK-${orderId}`, paymentUrl, merchantTransactionId };
      } catch (err: any) {
        console.error("PhonePe API error", err?.message || err);
        if (err instanceof HttpsError) throw err;
        throw new HttpsError("unavailable", err?.message || "PhonePe API error");
      }
    }

    // ── 6. COD / wallet / zero-total path ─────────────────────────────────────
    return { orderId, orderNumber, remainingAmount: calculatedTotal, trackingToken: `TRACK-${orderId}` };
  });
