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
exports.enforceDailyRateLimit = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v1/https");
const toDayKey = (d) => {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
};
const enforceDailyRateLimit = async ({ key, limit, }) => {
    const db = admin.firestore();
    const now = new Date();
    const dayKey = toDayKey(now);
    const docId = `${key}_${dayKey}`;
    const ref = db.collection("rateLimits").doc(docId);
    await db.runTransaction(async (tx) => {
        var _a;
        const snap = await tx.get(ref);
        const current = snap.exists ? Number(((_a = snap.data()) === null || _a === void 0 ? void 0 : _a.count) || 0) : 0;
        if (current >= limit) {
            throw new https_1.HttpsError("resource-exhausted", "Rate limit exceeded");
        }
        tx.set(ref, {
            key,
            dayKey,
            count: current + 1,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
    });
};
exports.enforceDailyRateLimit = enforceDailyRateLimit;
//# sourceMappingURL=rate-limit.js.map