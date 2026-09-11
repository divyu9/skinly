import * as functions from "firebase-functions/v1";
import { onRequest, HttpsError } from "firebase-functions/v1/https";
import * as admin from "firebase-admin";
import { notifyOrderPlaced } from "./orderNotifications";
import * as crypto from "crypto";
import { requireAuth, getCaller } from "./auth";
import { enforceDailyRateLimit } from "./rate-limit";

// PhonePe Config from Firebase environment config or secrets
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

const generateXVerify = (base64Payload: string, endpoint: string, saltKey: string, saltIndex: string) => {
  const stringToHash = base64Payload + endpoint + saltKey;
  const sha256Hash = crypto.createHash("sha256").update(stringToHash).digest("hex");
  return `${sha256Hash}###${saltIndex}`;
};

type PaymentState = "COMPLETED" | "FAILED" | string | undefined;

/**
 * Applies a PhonePe result to the order it belongs to.
 *
 * Shared by the status check and the server-to-server callback, because they
 * are the same decision reached by two routes and they must not drift. The
 * callback is the one that matters: the status check only runs while the
 * customer's browser is still on our page, and plenty of them never come back.
 *
 * Idempotent — PhonePe retries its callback, and a settled order stays settled.
 */
const applyPaymentResult = async (
  merchantTransactionId: string,
  state: PaymentState,
  paidPaise: unknown,
  source: "status-check" | "callback"
): Promise<{ paymentStatus: string; orderId: string | null; changed: boolean }> => {
  const paymentStatus = state === "COMPLETED" ? "success" : state === "FAILED" ? "failed" : "pending";

  const snap = await admin.firestore().collection("orders")
    .where("paymentTransactionId", "==", merchantTransactionId)
    .limit(1)
    .get();

  if (snap.empty) {
    console.warn("PhonePe result for an unknown transaction", { merchantTransactionId, state, source });
    return { paymentStatus, orderId: null, changed: false };
  }

  const doc = snap.docs[0];
  const order = doc.data() as any;

  // Never walk a settled order backwards: a late callback for a transaction
  // that already succeeded must not reopen it.
  if (order.paymentStatus === "success" && paymentStatus !== "success") {
    console.warn("Ignoring a later non-success for a paid order", { orderId: doc.id, state, source });
    return { paymentStatus: "success", orderId: doc.id, changed: false };
  }
  if (paymentStatus === "pending") return { paymentStatus, orderId: doc.id, changed: false };

  if (paymentStatus === "failed") {
    if (order.paymentStatus === "failed") return { paymentStatus, orderId: doc.id, changed: false };
    await doc.ref.update({ paymentStatus: "failed", updatedAt: Date.now(), paymentFailedVia: source });
    return { paymentStatus, orderId: doc.id, changed: true };
  }

  // COMPLETED is not the same as PhonePe having collected the right amount.
  const expectedPaise = Math.max(Math.round(Number(order.amountPayable ?? order.total) * 100), 100);
  const paid = Number(paidPaise);
  if (!Number.isFinite(paid) || paid < expectedPaise) {
    console.error("PhonePe amount mismatch", { merchantTransactionId, orderId: doc.id, paid, expectedPaise, source });
    await doc.ref.update({
      paymentStatus: "underpaid",
      paymentAmountPaise: Number.isFinite(paid) ? paid : null,
      updatedAt: Date.now(),
    });
    return { paymentStatus: "underpaid", orderId: doc.id, changed: true };
  }

  if (order.paymentStatus === "success") return { paymentStatus, orderId: doc.id, changed: false };

  await doc.ref.update({
    paymentStatus: "success",
    status: "processing",
    paymentAmountPaise: paid,
    paymentConfirmedVia: source,
    updatedAt: Date.now(),
  });

  // The money is in, so now the customer hears about it. Not before: an
  // online order that never gets paid should produce no confirmation at all.
  // Non-blocking, and guarded by its own once-only flag, because the status
  // check and the callback both reach this for the same payment.
  notifyOrderPlaced(admin.firestore(), doc.id).catch((e) =>
    console.error("notifyOrderPlaced failed", { order: doc.id, error: e?.message || e })
  );

  return { paymentStatus, orderId: doc.id, changed: true };
};

export const initiatePayment = functions.runWith({ memory: "256MB", timeoutSeconds: 60, minInstances: 1 }).https.onCall(async (data: any, context: any) => {
  const { uid } = getCaller(context);
  await enforceDailyRateLimit({ key: `initiatePayment_${uid || "guest"}`, limit: Number(process.env.PHONEPE_INIT_DAILY_LIMIT || 2000) });

  // `amount` is accepted for backward compatibility and then ignored — what
  // gets charged is read off the order below. Trusting the caller's figure let
  // anyone pay ₹1 for any order.
  const { orderId, customerPhone, orderNumber, sessionId } = data;

  if (!orderId || !customerPhone) {
    throw new HttpsError("invalid-argument", "Missing required fields");
  }
  if (typeof orderId !== "string" || orderId.length > 128) {
    throw new HttpsError("invalid-argument", "Invalid orderId");
  }
  let phoneDigits = String(customerPhone).replace(/\D/g, "");
  if (phoneDigits.length === 12 && phoneDigits.startsWith("91")) {
    phoneDigits = phoneDigits.slice(2);
  }
  if (!/^[0-9]{10}$/.test(phoneDigits)) {
    throw new HttpsError("invalid-argument", "Invalid phone number");
  }
  const config = getPhonePeConfig();

  const orderRef = admin.firestore().collection("orders").doc(orderId);
  const orderSnap = await orderRef.get();
  if (!orderSnap.exists) {
    throw new HttpsError("not-found", "Order not found");
  }
  const order = orderSnap.data() as any;

  if (uid) {
    if (order.userId !== uid) {
      console.error(`Auth mismatch. order.userId: ${order.userId}, uid: ${uid}`);
      throw new HttpsError("unauthenticated", "UNAUTHENTICATED");
    }
  } else {
    if (!sessionId || typeof sessionId !== "string" || sessionId.length > 128) {
      console.error(`Missing or invalid sessionId: ${sessionId}`);
      throw new HttpsError("unauthenticated", "UNAUTHENTICATED");
    }
    if (order.userId !== sessionId && order.userId !== "guest") {
      console.error(`Auth mismatch. order.userId: ${order.userId}, sessionId: ${sessionId}`);
      throw new HttpsError("unauthenticated", "UNAUTHENTICATED");
    }
  }

  if (order.phone) {
    let orderPhoneDigits = String(order.phone).replace(/\D/g, "");
    if (orderPhoneDigits.length === 12 && orderPhoneDigits.startsWith("91")) {
      orderPhoneDigits = orderPhoneDigits.slice(2);
    }
    if (orderPhoneDigits && orderPhoneDigits !== phoneDigits) {
      throw new HttpsError("permission-denied", "Unauthorized");
    }
  }

  // The single source of truth for what this order costs.
  const payable = Number(order.amountPayable ?? order.total);
  if (!Number.isFinite(payable) || payable <= 0) {
    throw new HttpsError("failed-precondition", "Order has no payable amount");
  }
  if (order.paymentStatus === "success") {
    throw new HttpsError("failed-precondition", "Order is already paid");
  }

  const timestamp = Date.now();
  const last6 = timestamp.toString().slice(-6);
  const orderRefSuffix = orderNumber || orderId.slice(-8);
  const merchantTransactionId = `${orderRefSuffix}-${last6}`;

  const amountInPaise = Math.max(Math.round(payable * 100), 100);
  const siteUrl = (process.env.SITE_URL || "https://goskinly.com").replace(/\/+$/, "");
  // callbackUrl must be the Firebase Function endpoint so PhonePe can POST to a real server
  // Must be the function, not the SPA route. The default used to be
  // `${siteUrl}/payment/callback`, which is a React page: PhonePe POSTed its
  // result there, got 200 and a lump of HTML, and the order stayed pending.
  const callbackFnUrl = process.env.CALLBACK_FN_URL
    || `https://us-central1-${process.env.GCLOUD_PROJECT || "skinly-3003b"}.cloudfunctions.net/paymentCallback`;

  const paymentPayload = {
    merchantId: config.merchantId,
    merchantTransactionId: merchantTransactionId,
    merchantUserId: uid ? uid : (sessionId ? String(sessionId).slice(-24) : "GUEST_USER"),
    amount: amountInPaise,
    redirectUrl: `${siteUrl}/payment/callback`,
    redirectMode: "REDIRECT",
    callbackUrl: callbackFnUrl,
    mobileNumber: phoneDigits,
    paymentInstrument: {
      type: "PAY_PAGE",
    },
  };

  console.log("PhonePe initiating payment", {
    merchantId: config.merchantId,
    merchantTransactionId,
    amount: amountInPaise,
    redirectUrl: paymentPayload.redirectUrl,
    callbackUrl: callbackFnUrl,
    mobileNumber: phoneDigits,
  });

  const base64Payload = Buffer.from(JSON.stringify(paymentPayload)).toString("base64");
  const endpoint = "/pg/v1/pay";
  const xVerify = generateXVerify(base64Payload, endpoint, config.saltKey, config.saltIndex);

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

    console.log("PhonePe response", { status: response.status, code: responseData.code, success: responseData.success, message: responseData.message });

    if (!response.ok || !responseData.success) {
      const errMsg = `PhonePe error: ${responseData.code || "UNKNOWN"} - ${responseData.message || "Payment initiation failed"}`;
      console.error("PhonePe Initiation Failed", responseData);
      throw new HttpsError("unavailable", errMsg);
    }

    const paymentUrl = responseData.data?.instrumentResponse?.redirectInfo?.url;
    if (!paymentUrl) {
      throw new HttpsError("unavailable", "PhonePe returned no payment URL");
    }

    await orderSnap.ref.update({
      paymentTransactionId: merchantTransactionId,
      paymentStatus: "pending",
      paymentProvider: "phonepe",
      updatedAt: Date.now()
    });

    return {
      success: true,
      paymentUrl,
      merchantTransactionId,
    };
  } catch (error: any) {
    console.error("PhonePe API Error", error?.message || error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError("unavailable", error?.message || "PhonePe API error");
  }
});

export const checkPaymentStatus = functions.runWith({ memory: "256MB", timeoutSeconds: 60, minInstances: 1 }).https.onCall(async (data: any, context: any) => {
  const { uid } = getCaller(context);
  await enforceDailyRateLimit({ key: `checkPaymentStatus_${uid || "guest"}`, limit: Number(process.env.PHONEPE_STATUS_DAILY_LIMIT || 4000) });

  const { merchantTransactionId, orderId, sessionId } = data;

  if (!merchantTransactionId) {
    throw new HttpsError("invalid-argument", "Missing merchantTransactionId");
  }
  if (typeof merchantTransactionId !== "string" || merchantTransactionId.length > 128) {
    throw new HttpsError("invalid-argument", "Invalid merchantTransactionId");
  }
  if (orderId) {
    if (typeof orderId !== "string" || orderId.length > 128) throw new HttpsError("invalid-argument", "Invalid orderId");
    const orderRef = admin.firestore().collection("orders").doc(orderId);
    const orderSnap = await orderRef.get();
    if (!orderSnap.exists) throw new HttpsError("not-found", "Order not found");
    const order = orderSnap.data() as any;
    if (uid) {
      if (order.userId !== uid) throw new HttpsError("unauthenticated", "UNAUTHENTICATED");
    } else {
      if (!sessionId || typeof sessionId !== "string" || sessionId.length > 128) throw new HttpsError("unauthenticated", "UNAUTHENTICATED");
      if (order.userId !== sessionId) throw new HttpsError("unauthenticated", "UNAUTHENTICATED");
    }
  } else {
    requireAuth(context);
  }

  const config = getPhonePeConfig();
  const endpoint = `/pg/v1/status/${config.merchantId}/${merchantTransactionId}`;

  const stringToHash = endpoint + config.saltKey;
  const sha256Hash = crypto.createHash("sha256").update(stringToHash).digest("hex");
  const xVerify = `${sha256Hash}###${config.saltIndex}`;

  try {
    const fetch = require("node-fetch");
    const response = await fetch(`${config.v1BaseUrl}${endpoint}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-MERCHANT-ID": config.merchantId,
        "X-VERIFY": xVerify,
        accept: "application/json",
      },
    });

    const responseData: any = await response.json();

    if (!response.ok) {
      console.error("PhonePe Status Failed", responseData);
      throw new HttpsError("internal", responseData.message || "Payment status check failed");
    }

    const state = responseData.data?.state;
    // One decision, one implementation — the callback reaches the same place.
    const applied = await applyPaymentResult(
      merchantTransactionId, state, responseData.data?.amount, "status-check"
    );
    if (applied.paymentStatus === "underpaid") {
      throw new HttpsError("failed-precondition", "Payment amount does not match the order");
    }
    const paymentStatus = applied.paymentStatus;

    return {
      success: true,
      paymentStatus,
      state
    };
  } catch (error: any) {
    console.error("PhonePe Status Check Error", error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError("internal", error?.message || "Status check error");
  }
});

/**
 * PhonePe's server-to-server result.
 *
 * This is the only path that does not depend on the customer's browser coming
 * back to us, which is why it matters: a closed tab, a dropped connection or a
 * UPI app that never redirects all end here and nowhere else. It used to reply
 * "OK" and discard the body, so those orders stayed pending for ever.
 *
 * PhonePe signs the callback the same way it signs a response: the header is
 * sha256(base64Payload + saltKey) + "###" + saltIndex. An unsigned or wrongly
 * signed POST is refused — this endpoint is public, and without the check
 * anyone could mark any order paid.
 */
export const paymentCallback = onRequest(async (req: any, res: any) => {
  try {
    if (req.method !== "POST") { res.status(405).send("Method not allowed"); return; }

    const header = String(req.get("X-VERIFY") || req.get("x-verify") || "");
    const encoded = req.body?.response;
    if (!header || typeof encoded !== "string" || !encoded) {
      console.error("PhonePe callback missing signature or body");
      res.status(400).send("Bad request");
      return;
    }

    const config = getPhonePeConfig();
    const expected = crypto.createHash("sha256").update(encoded + config.saltKey).digest("hex");
    const [got] = header.split("###");
    const a = Buffer.from(String(got), "utf8");
    const b = Buffer.from(expected, "utf8");
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      console.error("PhonePe callback signature rejected");
      res.status(401).send("Unauthorized");
      return;
    }

    const payload = JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
    const d = payload?.data || {};
    const merchantTransactionId = d.merchantTransactionId || d.merchantOrderId || d.transactionId;
    if (!merchantTransactionId) {
      console.error("PhonePe callback carried no transaction id", { code: payload?.code });
      res.status(400).send("Bad request");
      return;
    }

    const state = d.state || (payload?.code === "PAYMENT_SUCCESS" ? "COMPLETED"
      : payload?.code === "PAYMENT_ERROR" ? "FAILED" : undefined);

    const applied = await applyPaymentResult(merchantTransactionId, state, d.amount, "callback");
    console.log("PhonePe callback applied", {
      merchantTransactionId, state, code: payload?.code, ...applied,
    });

    // Always 200 once the signature checks out: a non-2xx makes PhonePe retry,
    // and a transaction we cannot match will not match on the retry either.
    res.status(200).send("OK");
  } catch (e: any) {
    console.error("PhonePe callback failed", e?.message || e);
    // 500 so PhonePe retries — this one may well succeed next time.
    res.status(500).send("Error");
  }
});
