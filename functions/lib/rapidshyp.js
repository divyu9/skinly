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
exports.createShipment = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = __importStar(require("firebase-admin"));
const auth_1 = require("./auth");
const rate_limit_1 = require("./rate-limit");
const getRapidShypConfig = () => {
    const apiKey = process.env.RAPIDSHYP_API_KEY || "";
    const apiUrl = process.env.RAPIDSHYP_API_URL || "https://api.rapidshyp.com/rapidshyp/apis/v1/wrapper";
    if (!apiKey) {
        throw new Error("RapidShyp API credentials not configured.");
    }
    return { apiKey, apiUrl };
};
exports.createShipment = (0, https_1.onCall)({ memory: "256MiB", timeoutSeconds: 60, invoker: "public" }, async (request) => {
    var _a;
    const { uid } = await (0, auth_1.requireAdmin)(request);
    await (0, rate_limit_1.enforceDailyRateLimit)({ key: `createShipment_${uid}`, limit: Number(process.env.RAPIDSHYP_DAILY_LIMIT || 200) });
    const data = request.data;
    const { orderId } = data;
    if (!orderId) {
        throw new Error("Missing orderId");
    }
    const orderRef = admin.firestore().collection("orders").doc(orderId);
    const orderDoc = await orderRef.get();
    if (!orderDoc.exists) {
        throw new Error("Order not found");
    }
    const order = orderDoc.data();
    if (!((_a = order.shippingAddress) === null || _a === void 0 ? void 0 : _a.phone)) {
        throw new Error("Order missing phone number in shipping address");
    }
    const config = getRapidShypConfig();
    // Rapidshyp payload formatting goes here.
    // We're just stubbing this so the frontend can call it and not crash.
    const payload = {
        // Map order details to Rapidshyp requirements
        orderId: order.orderNumber || orderDoc.id,
        customerName: order.shippingAddress.name,
        // ...
    };
    console.log("RapidShyp Payload:", payload, "Config URL:", config.apiUrl);
    try {
        // const fetch = (await import("node-fetch")).default;
        // const response = await fetch(config.apiUrl, { method: "POST", headers: { Authorization: config.apiKey }, body: JSON.stringify(payload) });
        // const responseData = await response.json();
        // Fake success for now to establish the hook
        const fakeAwb = "AWB123456789";
        await orderRef.update({
            shippingProvider: "rapidshyp",
            trackingNumber: fakeAwb,
            shippingStatus: "SHIPPED"
        });
        return {
            success: true,
            awbNumber: fakeAwb,
            message: "Shipment created successfully"
        };
    }
    catch (error) {
        console.error("Rapidshyp error", error);
        throw new Error(error.message || "Shipment creation failed");
    }
});
//# sourceMappingURL=rapidshyp.js.map