"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentCallback = exports.checkPaymentStatus = exports.initiatePayment = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = __importStar(require("firebase-admin"));
const crypto = __importStar(require("crypto"));
const auth_1 = require("./auth");
const rate_limit_1 = require("./rate-limit");
// PhonePe Config from Firebase environment config or secrets
const getPhonePeConfig = () => {
    const merchantId = process.env.PHONEPE_MERCHANT_ID || "";
    const saltKey = process.env.PHONEPE_SALT_KEY || "";
    const saltIndex = process.env.PHONEPE_SALT_INDEX || "1";
    const environment = process.env.PHONEPE_ENVIRONMENT || "PRODUCTION";
    if (!merchantId || !saltKey) {
        throw new https_1.HttpsError("failed-precondition", "PhonePe credentials not configured.");
    }
    const v1BaseUrl = environment === "PRODUCTION"
        ? "https://api.phonepe.com/apis/hermes"
        : "https://api-preprod.phonepe.com/apis/pg-sandbox";
    return { merchantId, saltKey, saltIndex, v1BaseUrl };
};
const generateXVerify = (base64Payload, endpoint, saltKey, saltIndex) => {
    const stringToHash = base64Payload + endpoint + saltKey;
    const sha256Hash = crypto.createHash("sha256").update(stringToHash).digest("hex");
    return `${sha256Hash}###${saltIndex}`;
};
exports.initiatePayment = (0, https_1.onCall)({ memory: "256MiB", timeoutSeconds: 60 }, async (request) => {
    var _a, _b, _c;
    const data = request.data || {};
    const { uid } = (0, auth_1.getCaller)(request);
    await (0, rate_limit_1.enforceDailyRateLimit)({ key: `initiatePayment_${uid || "guest"}`, limit: Number(process.env.PHONEPE_INIT_DAILY_LIMIT || 2000) });
    const { orderId, amount, customerPhone, orderNumber, sessionId } = data;
    if (!orderId || !amount || !customerPhone) {
        throw new https_1.HttpsError("invalid-argument", "Missing required fields");
    }
    if (typeof orderId !== "string" || orderId.length > 128) {
        throw new https_1.HttpsError("invalid-argument", "Invalid orderId");
    }
    let phoneDigits = String(customerPhone).replace(/\D/g, "");
    if (phoneDigits.length === 12 && phoneDigits.startsWith("91")) {
        phoneDigits = phoneDigits.slice(2);
    }
    if (!/^[0-9]{10}$/.test(phoneDigits)) {
        throw new https_1.HttpsError("invalid-argument", "Invalid phone number");
    }
    if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
        throw new https_1.HttpsError("invalid-argument", "Invalid amount");
    }
    const config = getPhonePeConfig();
    const orderRef = admin.firestore().collection("orders").doc(orderId);
    const orderSnap = await orderRef.get();
    if (!orderSnap.exists) {
        throw new https_1.HttpsError("not-found", "Order not found");
    }
    const order = orderSnap.data();
    if (uid) {
        if (order.userId !== uid) {
            console.error(`Auth mismatch. order.userId: ${order.userId}, uid: ${uid}`);
            throw new https_1.HttpsError("unauthenticated", "UNAUTHENTICATED");
        }
    }
    else {
        if (!sessionId || typeof sessionId !== "string" || sessionId.length > 128) {
            console.error(`Missing or invalid sessionId: ${sessionId}`);
            throw new https_1.HttpsError("unauthenticated", "UNAUTHENTICATED");
        }
        if (order.userId !== sessionId && order.userId !== "guest") {
            console.error(`Auth mismatch. order.userId: ${order.userId}, sessionId: ${sessionId}`);
            throw new https_1.HttpsError("unauthenticated", "UNAUTHENTICATED");
        }
    }
    if (order.phone) {
        let orderPhoneDigits = String(order.phone).replace(/\D/g, "");
        if (orderPhoneDigits.length === 12 && orderPhoneDigits.startsWith("91")) {
            orderPhoneDigits = orderPhoneDigits.slice(2);
        }
        if (orderPhoneDigits && orderPhoneDigits !== phoneDigits) {
            throw new https_1.HttpsError("permission-denied", "Unauthorized");
        }
    }
    const timestamp = Date.now();
    const last6 = timestamp.toString().slice(-6);
    const orderRefSuffix = orderNumber || orderId.slice(-8);
    const merchantTransactionId = `${orderRefSuffix}-${last6}`;
    const amountInPaise = Math.max(Math.round(amount * 100), 100);
    const siteUrl = (process.env.SITE_URL || "https://goskinly.com").replace(/\/+$/, "");
    // callbackUrl must be the Firebase Function endpoint so PhonePe can POST to a real server
    const callbackFnUrl = process.env.CALLBACK_FN_URL || `${siteUrl}/payment/callback`;
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
        let responseData = {};
        try {
            responseData = JSON.parse(responseText);
        }
        catch (_d) {
            console.error("PhonePe non-JSON response", { status: response.status, body: responseText.slice(0, 500) });
            throw new https_1.HttpsError("unavailable", `PhonePe returned non-JSON response (HTTP ${response.status})`);
        }
        console.log("PhonePe response", { status: response.status, code: responseData.code, success: responseData.success, message: responseData.message });
        if (!response.ok || !responseData.success) {
            const errMsg = `PhonePe error: ${responseData.code || "UNKNOWN"} - ${responseData.message || "Payment initiation failed"}`;
            console.error("PhonePe Initiation Failed", responseData);
            throw new https_1.HttpsError("unavailable", errMsg);
        }
        const paymentUrl = (_c = (_b = (_a = responseData.data) === null || _a === void 0 ? void 0 : _a.instrumentResponse) === null || _b === void 0 ? void 0 : _b.redirectInfo) === null || _c === void 0 ? void 0 : _c.url;
        if (!paymentUrl) {
            throw new https_1.HttpsError("unavailable", "PhonePe returned no payment URL");
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
    }
    catch (error) {
        console.error("PhonePe API Error", (error === null || error === void 0 ? void 0 : error.message) || error);
        if (error instanceof https_1.HttpsError) {
            throw error;
        }
        throw new https_1.HttpsError("unavailable", (error === null || error === void 0 ? void 0 : error.message) || "PhonePe API error");
    }
});
exports.checkPaymentStatus = (0, https_1.onCall)({ memory: "256MiB", timeoutSeconds: 60 }, async (request) => {
    var _a;
    const data = request.data || {};
    const { uid } = (0, auth_1.getCaller)(request);
    await (0, rate_limit_1.enforceDailyRateLimit)({ key: `checkPaymentStatus_${uid || "guest"}`, limit: Number(process.env.PHONEPE_STATUS_DAILY_LIMIT || 4000) });
    const { merchantTransactionId, orderId, sessionId } = data;
    if (!merchantTransactionId) {
        throw new https_1.HttpsError("invalid-argument", "Missing merchantTransactionId");
    }
    if (typeof merchantTransactionId !== "string" || merchantTransactionId.length > 128) {
        throw new https_1.HttpsError("invalid-argument", "Invalid merchantTransactionId");
    }
    if (orderId) {
        if (typeof orderId !== "string" || orderId.length > 128)
            throw new https_1.HttpsError("invalid-argument", "Invalid orderId");
        const orderRef = admin.firestore().collection("orders").doc(orderId);
        const orderSnap = await orderRef.get();
        if (!orderSnap.exists)
            throw new https_1.HttpsError("not-found", "Order not found");
        const order = orderSnap.data();
        if (uid) {
            if (order.userId !== uid)
                throw new https_1.HttpsError("unauthenticated", "UNAUTHENTICATED");
        }
        else {
            if (!sessionId || typeof sessionId !== "string" || sessionId.length > 128)
                throw new https_1.HttpsError("unauthenticated", "UNAUTHENTICATED");
            if (order.userId !== sessionId)
                throw new https_1.HttpsError("unauthenticated", "UNAUTHENTICATED");
        }
    }
    else {
        (0, auth_1.requireAuth)(request);
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
        const responseData = await response.json();
        if (!response.ok) {
            console.error("PhonePe Status Failed", responseData);
            throw new https_1.HttpsError("internal", responseData.message || "Payment status check failed");
        }
        const state = (_a = responseData.data) === null || _a === void 0 ? void 0 : _a.state;
        let paymentStatus = "pending";
        if (state === "COMPLETED")
            paymentStatus = "success";
        else if (state === "FAILED")
            paymentStatus = "failed";
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
    }
    catch (error) {
        console.error("PhonePe Status Check Error", error);
        if (error instanceof https_1.HttpsError) {
            throw error;
        }
        throw new https_1.HttpsError("internal", (error === null || error === void 0 ? void 0 : error.message) || "Status check error");
    }
});
exports.paymentCallback = (0, https_1.onRequest)({ memory: "256MiB", timeoutSeconds: 60 }, async (req, res) => {
    res.status(200).send("OK");
});
//# sourceMappingURL=phonepe.js.map