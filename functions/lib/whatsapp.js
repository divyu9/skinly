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
exports.sendWhatsAppMessage = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = __importStar(require("firebase-admin"));
const auth_1 = require("./auth");
const rate_limit_1 = require("./rate-limit");
const getWhatsAppConfig = () => {
    const authkey = process.env.WHATSAPP_AUTHKEY || "";
    if (!authkey) {
        throw new Error("WhatsApp API credentials not configured.");
    }
    return { authkey };
};
exports.sendWhatsAppMessage = (0, https_1.onCall)({ memory: "256MiB", timeoutSeconds: 60, invoker: "public" }, async (request) => {
    const { uid } = await (0, auth_1.requireAdmin)(request);
    await (0, rate_limit_1.enforceDailyRateLimit)({ key: `sendWhatsAppMessage_${uid}`, limit: Number(process.env.WHATSAPP_DAILY_LIMIT || 500) });
    const data = request.data;
    const { phone, templateId, variables } = data;
    if (!phone || !templateId) {
        throw new Error("Missing required fields");
    }
    if (typeof phone !== "string" || !/^[0-9]{10,15}$/.test(phone.replace(/\D/g, ""))) {
        throw new Error("Invalid phone");
    }
    if (typeof templateId !== "string" || templateId.length > 128) {
        throw new Error("Invalid templateId");
    }
    if (variables && typeof variables !== "object") {
        throw new Error("Invalid variables");
    }
    const config = getWhatsAppConfig();
    // MSG91/Authkey logic implementation
    try {
        const fetch = require("node-fetch");
        // Replace with actual provider URL (Authkey/MSG91)
        const url = "https://api.authkey.io/request";
        // Construct the payload for Authkey.io
        const params = new URLSearchParams(Object.assign({ authkey: config.authkey, mobile: phone.replace(/\D/g, ""), country_code: "91", sid: "XXX", template_id: templateId }, variables));
        const response = await fetch(`${url}?${params.toString()}`, {
            method: "GET"
        });
        if (!response.ok) {
            console.error("WhatsApp API Error:", await response.text());
            throw new Error("WhatsApp sending failed");
        }
        // Save message log to firestore
        await admin.firestore().collection("whatsappLogs").add({
            phone,
            templateId,
            variables,
            status: "SENT",
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
        return { success: true, message: "WhatsApp message sent successfully" };
    }
    catch (error) {
        console.error("WhatsApp Send Error:", error);
        await admin.firestore().collection("whatsappLogs").add({
            phone,
            templateId,
            variables,
            status: "FAILED",
            error: error.message,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
        throw new Error(error.message || "WhatsApp sending failed");
    }
});
//# sourceMappingURL=whatsapp.js.map