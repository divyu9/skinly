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
exports.verifyLoginOtp = exports.generateLoginOtp = void 0;
const https_1 = require("firebase-functions/v1/https");
const admin = __importStar(require("firebase-admin"));
const crypto = __importStar(require("crypto"));
const auth_1 = require("./auth");
const rate_limit_1 = require("./rate-limit");
const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 60 * 1000;
// The catch-all Firestore rule grants public read, so these documents are
// reachable from a browser. A six digit code is trivially brute-forced against
// an unsalted hash, so the pepper is what actually protects it — refuse to run
// without one rather than write a code that can be reversed.
const hashOtp = (otp, phone) => {
    const pepper = process.env.OTP_PEPPER || "";
    if (pepper.length < 16) {
        throw new https_1.HttpsError("failed-precondition", "OTP_PEPPER is not configured");
    }
    return crypto.createHash("sha256").update(`${otp}:${phone}:${pepper}`).digest("hex");
};
const normalizePhone = (raw) => {
    if (typeof raw !== "string")
        throw new https_1.HttpsError("invalid-argument", "Invalid phone number");
    const digits = raw.replace(/\D/g, "").slice(-10);
    if (!/^[6-9]\d{9}$/.test(digits))
        throw new https_1.HttpsError("invalid-argument", "Enter a valid 10-digit mobile number");
    return digits;
};
exports.generateLoginOtp = (0, https_1.onCall)(async (data, context) => {
    var _a;
    const { uid } = (0, auth_1.requireAuth)(context);
    const phoneNumber = normalizePhone(data === null || data === void 0 ? void 0 : data.phoneNumber);
    await (0, rate_limit_1.enforceDailyRateLimit)({
        key: `loginOtp_${uid}`,
        limit: Number(process.env.OTP_DAILY_LIMIT || 10),
    });
    const db = admin.firestore();
    const ref = db.collection("loginOtps").doc(`${uid}_${phoneNumber}`);
    const existing = await ref.get();
    if (existing.exists) {
        const sentAt = Number(((_a = existing.data()) === null || _a === void 0 ? void 0 : _a.sentAt) || 0);
        if (Date.now() - sentAt < RESEND_COOLDOWN_MS) {
            throw new https_1.HttpsError("resource-exhausted", "Please wait a minute before requesting another OTP");
        }
    }
    const otp = String(crypto.randomInt(100000, 1000000));
    const authkey = process.env.WHATSAPP_AUTHKEY || "";
    if (!authkey)
        throw new https_1.HttpsError("failed-precondition", "OTP provider is not configured");
    const templateId = process.env.OTP_TEMPLATE_ID || "";
    if (!templateId)
        throw new https_1.HttpsError("failed-precondition", "OTP template is not configured");
    const fetch = require("node-fetch");
    const params = new URLSearchParams({
        authkey,
        mobile: phoneNumber,
        country_code: "91",
        sid: process.env.OTP_SENDER_ID || "",
        template_id: templateId,
        otp,
    });
    const response = await fetch(`https://api.authkey.io/request?${params.toString()}`, { method: "GET" });
    if (!response.ok) {
        console.error("OTP send failed:", await response.text());
        throw new https_1.HttpsError("internal", "Could not send OTP. Please try again.");
    }
    await ref.set({
        uid,
        phoneNumber,
        otpHash: hashOtp(otp, phoneNumber),
        sentAt: Date.now(),
        expiresAt: Date.now() + OTP_TTL_MS,
        attempts: 0,
        verified: false,
    });
    return { success: true };
});
exports.verifyLoginOtp = (0, https_1.onCall)(async (data, context) => {
    const { uid } = (0, auth_1.requireAuth)(context);
    const phoneNumber = normalizePhone(data === null || data === void 0 ? void 0 : data.phoneNumber);
    const otp = typeof (data === null || data === void 0 ? void 0 : data.otp) === "string" ? data.otp.trim() : "";
    if (!/^\d{6}$/.test(otp))
        throw new https_1.HttpsError("invalid-argument", "Enter the 6-digit code");
    const db = admin.firestore();
    const ref = db.collection("loginOtps").doc(`${uid}_${phoneNumber}`);
    await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists)
            throw new https_1.HttpsError("not-found", "Request a new OTP");
        const rec = snap.data();
        if (rec.verified)
            throw new https_1.HttpsError("failed-precondition", "This code was already used");
        if (Date.now() > Number(rec.expiresAt || 0))
            throw new https_1.HttpsError("deadline-exceeded", "OTP expired. Request a new one.");
        if (Number(rec.attempts || 0) >= MAX_ATTEMPTS)
            throw new https_1.HttpsError("resource-exhausted", "Too many attempts. Request a new OTP.");
        // Constant-time compare so a wrong code cannot be narrowed down by timing.
        const expected = Buffer.from(String(rec.otpHash || ""));
        const actual = Buffer.from(hashOtp(otp, phoneNumber));
        const ok = expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
        if (!ok) {
            tx.update(ref, { attempts: Number(rec.attempts || 0) + 1 });
            throw new https_1.HttpsError("invalid-argument", "Incorrect OTP");
        }
        tx.update(ref, { verified: true, verifiedAt: Date.now() });
        tx.set(db.collection("users").doc(uid), { phoneNumber, phoneVerified: true, phoneVerifiedAt: Date.now() }, { merge: true });
    });
    return { success: true, phoneNumber };
});
//# sourceMappingURL=loginOtp.js.map