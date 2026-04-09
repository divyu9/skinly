import { onCall, onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
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
      throw new Error("PhonePe credentials not configured.");
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

export const initiatePayment = onCall({ memory: "256MiB", timeoutSeconds: 60 }, async (request: any) => {
  const data = request.data;
  const { uid } = getCaller(request);
  await enforceDailyRateLimit({ key: `initiatePayment_${uid || "guest"}`, limit: Number(process.env.PHONEPE_INIT_DAILY_LIMIT || 2000) });

  const { orderId, amount, customerPhone, orderNumber, sessionId } = data;

  if (!orderId || !amount || !customerPhone) {
      throw new Error("Missing required fields");
    }
  if (typeof orderId !== "string" || orderId.length > 128) {
    throw new Error("Invalid orderId");
  }
  const phoneDigits = String(customerPhone).replace(/\D/g, "");
  if (!/^[0-9]{10,15}$/.test(phoneDigits)) {
    throw new Error("Invalid phone");
  }
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
    throw new Error("Invalid amount");
  }

  const config = getPhonePeConfig();

  const orderRef = admin.firestore().collection("orders").doc(orderId);
  const orderSnap = await orderRef.get();
  if (!orderSnap.exists) {
    throw new Error("Order not found");
  }
  const order = orderSnap.data() as any;

  if (uid) {
    if (order.userId !== uid) {
      console.error(`Auth mismatch. order.userId: ${order.userId}, uid: ${uid}`);
      throw new Error("UNAUTHENTICATED");
    }
  } else {
    if (!sessionId || typeof sessionId !== "string" || sessionId.length > 128) {
      console.error(`Missing or invalid sessionId: ${sessionId}`);
      throw new Error("UNAUTHENTICATED");
    }
    if (order.userId !== sessionId && order.userId !== "guest") {
      console.error(`Auth mismatch. order.userId: ${order.userId}, sessionId: ${sessionId}`);
      throw new Error("UNAUTHENTICATED");
    }
  }

  if (order.phone) {
    const orderPhoneDigits = String(order.phone).replace(/\D/g, "");
    if (orderPhoneDigits && orderPhoneDigits !== phoneDigits) {
      throw new Error("Unauthorized");
    }
  }

  const timestamp = Date.now();
  const last6 = timestamp.toString().slice(-6);
  const orderRefSuffix = orderNumber || orderId.slice(-8);
  const merchantTransactionId = `${orderRefSuffix}-${last6}`;

  const amountInPaise = Math.max(Math.round(amount * 100), 100);
  const siteUrl = process.env.SITE_URL || "https://www.goskinly.com";

  const paymentPayload = {
    merchantId: config.merchantId,
    merchantTransactionId: merchantTransactionId,
    merchantUserId: uid ? uid : (sessionId ? String(sessionId).slice(-24) : "GUEST_USER"),
    amount: amountInPaise,
    redirectUrl: `${siteUrl}/payment/callback`,
    redirectMode: "REDIRECT",
    callbackUrl: `${siteUrl}/payment/callback`,
    mobileNumber: phoneDigits,
    paymentInstrument: {
      type: "PAY_PAGE",
    },
  };

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

    const responseData: any = await response.json();

    if (!response.ok || !responseData.success) {
      console.error("PhonePe Initiation Failed", responseData);
      throw new Error(responseData.message || "Payment initiation failed");
    }

    const paymentUrl = responseData.data?.instrumentResponse?.redirectInfo?.url;
    if (!paymentUrl) {
      throw new Error("No payment URL returned");
    }

    await orderSnap.ref.update({
      paymentTransactionId: merchantTransactionId,
      paymentStatus: "PENDING",
      paymentProvider: "phonepe"
    });

    return {
      success: true,
      paymentUrl,
      merchantTransactionId,
    };
  } catch (error: any) {
    console.error("PhonePe API Error", error);
    throw new Error(error.message || "Unknown error");
  }
});

export const checkPaymentStatus = onCall({ memory: "256MiB", timeoutSeconds: 60 }, async (request: any) => {
  const data = request.data;
  const { uid } = getCaller(request);
  await enforceDailyRateLimit({ key: `checkPaymentStatus_${uid || "guest"}`, limit: Number(process.env.PHONEPE_STATUS_DAILY_LIMIT || 4000) });

  const { merchantTransactionId, orderId, sessionId } = data;

  if (!merchantTransactionId) {
    throw new Error("Missing merchantTransactionId");
  }
  if (typeof merchantTransactionId !== "string" || merchantTransactionId.length > 128) {
    throw new Error("Invalid merchantTransactionId");
  }
  if (orderId) {
    if (typeof orderId !== "string" || orderId.length > 128) throw new Error("Invalid orderId");
    const orderRef = admin.firestore().collection("orders").doc(orderId);
    const orderSnap = await orderRef.get();
    if (!orderSnap.exists) throw new Error("Order not found");
    const order = orderSnap.data() as any;
    if (uid) {
      if (order.userId !== uid) throw new Error("Unauthorized");
    } else {
      if (!sessionId || typeof sessionId !== "string" || sessionId.length > 128) throw new Error("Unauthorized");
      if (order.userId !== sessionId) throw new Error("Unauthorized");
    }
  } else {
    requireAuth(request);
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
      throw new Error(responseData.message || "Payment status check failed");
    }

    const state = responseData.data?.state;
    let paymentStatus = "pending";

    if (state === "COMPLETED") paymentStatus = "success";
    else if (state === "FAILED") paymentStatus = "failed";

    if (paymentStatus === "success") {
      const ordersSnap = await admin.firestore().collection("orders")
        .where("paymentTransactionId", "==", merchantTransactionId)
        .limit(1)
        .get();

      if (!ordersSnap.empty) {
        await ordersSnap.docs[0].ref.update({ paymentStatus: "PAID" });
      }
    }

    return {
      success: true,
      paymentStatus,
      state
    };
  } catch (error: any) {
    console.error("PhonePe Status Check Error", error);
    throw new Error(error.message || "Status check error");
  }
});

export const paymentCallback = onRequest({ memory: "256MiB", timeoutSeconds: 60 }, async (req: any, res: any) => {
  res.status(200).send("OK");
});
