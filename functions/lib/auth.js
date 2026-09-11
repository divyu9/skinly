"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAdmin = exports.requireAuth = exports.getCaller = void 0;
const https_1 = require("firebase-functions/v1/https");
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
/**
 * Admin is proven by a custom claim on the ID token, or by an email on the
 * server-side allowlist. It is deliberately NOT read from users/{uid}.isAdmin
 * any more: that document is writable by the user it belongs to, so trusting a
 * field in it let any customer grant themselves every admin function.
 */
const requireAdmin = async (request) => {
    const { uid, token } = (0, exports.getCaller)(request);
    if (!uid) {
        throw new https_1.HttpsError("unauthenticated", "UNAUTHENTICATED");
    }
    if ((token === null || token === void 0 ? void 0 : token.admin) === true) {
        return { uid };
    }
    const allowlist = parseAllowlist(process.env.ADMIN_EMAIL_ALLOWLIST);
    const email = ((token === null || token === void 0 ? void 0 : token.email) || "").toLowerCase();
    // email_verified guards against a provider that lets an address be claimed
    // without proving it.
    if (email && (token === null || token === void 0 ? void 0 : token.email_verified) !== false && allowlist.includes(email)) {
        return { uid };
    }
    throw new https_1.HttpsError("permission-denied", "Your account is not an admin");
};
exports.requireAdmin = requireAdmin;
//# sourceMappingURL=auth.js.map