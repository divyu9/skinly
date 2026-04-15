import * as functions from "firebase-functions/v1";
import { HttpsError } from "firebase-functions/v1/https";
import * as admin from "firebase-admin";
import * as crypto from "crypto";
import { getCaller } from "./auth";
import { enforceDailyRateLimit } from "./rate-limit";

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
 * Combined createOrder + initiatePayment in a single function call.
 * Eliminates one round trip and parallelises internal Firestore operations
 * so checkout is noticeably faster.
 *
 * Returns:
 *   { orderId, orderNumber, remainingAmount, paymentUrl?, merchantTransactionId? }
 */
export const placeOrder = functions
  .runWith({ memory: "256MB", timeoutSeconds: 120, minInstances: 1 })
  .https.onCall(async (data: any, context: any) => {
    const { uid } = getCaller(context);
    const trackingId = uid || data.sessionId || "guest";

    await enforceDailyRateLimit({ key: `placeOrder_${trackingId}`, limit: 50 });

    const db = admin.firestore();
    const {
      shippingAddress,
      customerEmail,
      guestEmail,
      paymentMethod,
      guestItems,
      sessionId: reqSessionId,
      // PhonePe fields (only present when paymentMethod === "phonepe")
      customerPhone,
    } = data;

    // ── 1. Gather cart items ──────────────────────────────────────────────────
    let orderItems: any[] = [];
    if (uid) {
      const cartSnap = await db.collection("cart").where("userId", "==", uid).get();
      orderItems = cartSnap.docs.map((d) => d.data());
    } else if (guestItems && guestItems.length > 0) {
      orderItems = guestItems;
    } else if (reqSessionId) {
      const cartSnap = await db.collection("cart").where("sessionId", "==", reqSessionId).get();
      orderItems = cartSnap.docs.map((d) => d.data());
    }

    if (!orderItems || orderItems.length === 0) {
      throw new HttpsError("failed-precondition", "Cannot create order with an empty cart");
    }

    // ── 2. Parallelise: order counter + variant price lookups ─────────────────
    const getOrderNumber = async () => {
      const counterRef = db.collection("settings").doc("order_counter");
      let orderNumber = "";
      await db.runTransaction(async (transaction) => {
        const counterDoc = await transaction.get(counterRef);
        let currentVal = 4001;
        if (counterDoc.exists) {
          const docData = counterDoc.data();
          currentVal = docData && docData.value ? docData.value : 4001;
          transaction.update(counterRef, { value: currentVal + 1 });
        } else {
          transaction.set(counterRef, { key: "order_counter", value: 4002 });
        }
        orderNumber = `#${currentVal}`;
      });
      return orderNumber;
    };

    const getLineTotals = async () =>
      Promise.all(
        orderItems.map(async (item) => {
          const quantity = Number(item?.quantity || 1);
          if (item?.productId && item?.variant) {
            const variantSnap = await db
              .collection("variants")
              .where("productId", "==", item.productId)
              .where("title", "==", item.variant)
              .limit(1)
              .get();
            if (!variantSnap.empty) {
              const v = variantSnap.docs[0].data() as any;
              return Number(v?.price || 0) * quantity;
            }
          }
          return Number(item?.price || 0) * quantity;
        })
      );

    // Run order counter transaction and price lookups at the same time
    const [orderNumber, lineTotals] = await Promise.all([getOrderNumber(), getLineTotals()]);
    const calculatedTotal = lineTotals.reduce((sum, n) => sum + Number(n || 0), 0);

    // ── 3. Save order ─────────────────────────────────────────────────────────
    const newOrder: any = {
      orderNumber,
      userId: uid || reqSessionId || "guest",
      customerName: shippingAddress?.fullName || "Guest",
      email: customerEmail || guestEmail || "",
      phone: shippingAddress?.phone || "",
      shippingAddress: shippingAddress || {},
      paymentMethod: paymentMethod || "prepaid",
      status: "pending",
      paymentStatus: "pending",
      total: calculatedTotal,
      items: orderItems,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const docRef = await db.collection("orders").add(newOrder);
    const orderId = docRef.id;

    // ── 4. Initiate PhonePe payment if needed ─────────────────────────────────
    if (paymentMethod === "phonepe" && calculatedTotal > 0 && customerPhone) {
      let phoneDigits = String(customerPhone).replace(/\D/g, "");
      if (phoneDigits.length === 12 && phoneDigits.startsWith("91")) {
        phoneDigits = phoneDigits.slice(2);
      }
      if (!/^[0-9]{10}$/.test(phoneDigits)) {
        throw new HttpsError("invalid-argument", "Invalid phone number");
      }

      const config = getPhonePeConfig();
      const timestamp = Date.now();
      const last6 = timestamp.toString().slice(-6);
      const orderRefSuffix = orderNumber.replace(/[^a-zA-Z0-9_-]/g, "") || orderId.slice(-8);
      const merchantTransactionId = `${orderRefSuffix}-${last6}`;

      const amountInPaise = Math.max(Math.round(calculatedTotal * 100), 100);
      const siteUrl = (process.env.SITE_URL || "https://goskinly.com").replace(/\/+$/, "");
      const callbackFnUrl = process.env.CALLBACK_FN_URL || `${siteUrl}/payment/callback`;

      const paymentPayload = {
        merchantId: config.merchantId,
        merchantTransactionId,
        merchantUserId: uid ? uid : reqSessionId ? String(reqSessionId).slice(-24) : "GUEST_USER",
        amount: amountInPaise,
        redirectUrl: `${siteUrl}/payment/callback`,
        redirectMode: "REDIRECT",
        callbackUrl: callbackFnUrl,
        mobileNumber: phoneDigits,
        paymentInstrument: { type: "PAY_PAGE" },
      };

      const base64Payload = Buffer.from(JSON.stringify(paymentPayload)).toString("base64");
      const endpoint = "/pg/v1/pay";
      const stringToHash = base64Payload + endpoint + config.saltKey;
      const sha256Hash = crypto.createHash("sha256").update(stringToHash).digest("hex");
      const xVerify = `${sha256Hash}###${config.saltIndex}`;

      console.log("PhonePe placeOrder initiating", { merchantTransactionId, amount: amountInPaise });

      try {
        const fetch = require("node-fetch");
        const response = await fetch(`${config.v1BaseUrl}${endpoint}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-VERIFY": xVerify,
            accept: "application/json",
          },
          body: JSON.stringify({ request: base64Payload }),
        });

        const responseText = await response.text();
        let responseData: any = {};
        try {
          responseData = JSON.parse(responseText);
        } catch {
          console.error("PhonePe non-JSON response", { status: response.status, body: responseText.slice(0, 500) });
          throw new HttpsError("unavailable", `PhonePe returned non-JSON response (HTTP ${response.status})`);
        }

        console.log("PhonePe response", { code: responseData.code, success: responseData.success });

        if (!response.ok || !responseData.success) {
          const errMsg = `PhonePe error: ${responseData.code || "UNKNOWN"} - ${responseData.message || "Payment initiation failed"}`;
          console.error("PhonePe Initiation Failed", responseData);
          // Return the order even on payment failure so user can retry from order page
          return {
            orderId,
            orderNumber,
            remainingAmount: calculatedTotal,
            trackingToken: `TRACK-${orderId}`,
            paymentError: errMsg,
          };
        }

        const paymentUrl = responseData.data?.instrumentResponse?.redirectInfo?.url;
        if (!paymentUrl) {
          return {
            orderId,
            orderNumber,
            remainingAmount: calculatedTotal,
            trackingToken: `TRACK-${orderId}`,
            paymentError: "PhonePe returned no payment URL",
          };
        }

        // Update order with transaction ID (fire-and-forget, don't block the response)
        docRef.update({
          paymentTransactionId: merchantTransactionId,
          paymentStatus: "PENDING",
          paymentProvider: "phonepe",
        }).catch((e) => console.error("order update failed", e));

        return {
          orderId,
          orderNumber,
          remainingAmount: calculatedTotal,
          trackingToken: `TRACK-${orderId}`,
          paymentUrl,
          merchantTransactionId,
        };
      } catch (error: any) {
        console.error("PhonePe API Error", error?.message || error);
        if (error instanceof HttpsError) throw error;
        throw new HttpsError("unavailable", error?.message || "PhonePe API error");
      }
    }

    // ── 5. Non-PhonePe path (COD / wallet) ───────────────────────────────────
    return {
      orderId,
      orderNumber,
      remainingAmount: calculatedTotal,
      trackingToken: `TRACK-${orderId}`,
    };
  });
