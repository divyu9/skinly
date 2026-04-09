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
exports.requireAdmin = exports.requireAuth = exports.getCaller = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const getCaller = (request) => {
    const auth = request === null || request === void 0 ? void 0 : request.auth;
    const uid = (auth === null || auth === void 0 ? void 0 : auth.uid) || null;
    const token = (auth === null || auth === void 0 ? void 0 : auth.token) || null;
    return { uid, token };
};
exports.getCaller = getCaller;
const requireAuth = (request) => {
    const { uid } = (0, exports.getCaller)(request);
    if (!uid) {
        throw new https_1.HttpsError("unauthenticated", "UNAUTHENTICATED");
    }
    return { uid };
};
exports.requireAuth = requireAuth;
const parseAllowlist = (value) => {
    if (!value)
        return [];
    return value
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
};
const requireAdmin = async (request) => {
    var _a;
    const { uid, token } = (0, exports.getCaller)(request);
    if (!uid) {
        throw new https_1.HttpsError("unauthenticated", "UNAUTHENTICATED");
    }
    if ((token === null || token === void 0 ? void 0 : token.admin) === true) {
        return { uid };
    }
    const allowlist = parseAllowlist(process.env.ADMIN_EMAIL_ALLOWLIST);
    const email = ((token === null || token === void 0 ? void 0 : token.email) || "").toLowerCase();
    if (email && allowlist.includes(email)) {
        return { uid };
    }
    const snap = await admin.firestore().collection("users").doc(uid).get();
    if (snap.exists && ((_a = snap.data()) === null || _a === void 0 ? void 0 : _a.isAdmin) === true) {
        return { uid };
    }
    throw new https_1.HttpsError("permission-denied", "UNAUTHENTICATED");
};
exports.requireAdmin = requireAdmin;
//# sourceMappingURL=auth.js.map