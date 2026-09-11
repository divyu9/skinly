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
exports.sendOrderStatusEmail = exports.refundToWallet = exports.retryPayment = exports.describeItems = void 0;
const https_1 = require("firebase-functions/v1/https");
const admin = __importStar(require("firebase-admin"));
const auth_1 = require("./auth");
/**
 * Order actions that must not run in the browser.
 *
 * The rest of this app's admin writes go straight to Firestore through the
 * client shim, which is fine for data the admin is allowed to edit anyway. The
 * three here are not that: one moves money into a customer's wallet, one holds
 * the MSG91 credential, and one decides how much is still owed on an order.
 * Each was left unimplemented by the Convex migration, so the buttons have been
 * throwing "function not found" ever since.
 */
/** "Midnight Card Skin (iPhone 17 - Full Body Wrap) x 1, …" — one line for the mail. */
function describeItems(items) {
    return (items || [])
        .map((item) => {
        var _a;
        const coverage = (item === null || item === void 0 ? void 0 : item.coverage) === "full_body_wrap" ? "Full Body Wrap"
            : (item === null || item === void 0 ? void 0 : item.coverage) === "only_back" ? "Only Back" : "";
        const model = (item === null || item === void 0 ? void 0 : item.phoneModel) || "";
        const detail = coverage && model ? `${model} - ${coverage}` : coverage || model;
        return `${(item === null || item === void 0 ? void 0 : item.productTitle) || "Item"}${detail ? ` (${detail})` : ""} x ${(_a = item === null || item === void 0 ? void 0 : item.quantity) !== null && _a !== void 0 ? _a : 1}`;
    })
        .join(", ");
}
exports.describeItems = describeItems;
const MSG91_EMAIL_ENDPOINT = "https://control.msg91.com/api/v5/email/send";
const num = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
};
/** Money already collected against an order, however it was collected. */
function paidSoFar(order) {
    if (order.paymentStatus === "success")
        return num(order.total) || num(order.amountPayable);
    return num(order.prepaidAmount) + num(order.paymentAmountPaise) / 100;
}
/**
 * Re-opens a failed or pending order for payment.
 *
 * Returns what the PhonePe initiation needs rather than starting it here: the
 * browser drives that redirect, and the order must still be worth paying for
 * when it does.
 */
exports.retryPayment = (0, https_1.onCall)(async (data, context) => {
    var _a, _b, _c, _d;
    const orderId = String((data === null || data === void 0 ? void 0 : data.orderId) || "");
    if (!orderId)
        throw new https_1.HttpsError("invalid-argument", "Missing orderId");
    const db = admin.firestore();
    const ref = db.collection("orders").doc(orderId);
    const snap = await ref.get();
    if (!snap.exists)
        throw new https_1.HttpsError("not-found", "Order not found");
    const order = snap.data();
    // The caller must own the order. A guest order has no uid, and its id is
    // unguessable, so possession of the id is the only credential there is.
    const uid = (_a = context === null || context === void 0 ? void 0 : context.auth) === null || _a === void 0 ? void 0 : _a.uid;
    if (order.userId && uid && order.userId !== uid) {
        const email = String(((_c = (_b = context === null || context === void 0 ? void 0 : context.auth) === null || _b === void 0 ? void 0 : _b.token) === null || _c === void 0 ? void 0 : _c.email) || "").toLowerCase();
        const allow = String(process.env.ADMIN_EMAIL_ALLOWLIST || "").toLowerCase();
        if (!email || !allow.includes(email))
            throw new https_1.HttpsError("permission-denied", "Not your order");
    }
    if (order.paymentStatus === "success") {
        throw new https_1.HttpsError("failed-precondition", "This order is already paid");
    }
    if (["cancelled", "delivered", "rto"].includes(String(order.status))) {
        throw new https_1.HttpsError("failed-precondition", `This order is ${order.status} and cannot be paid`);
    }
    const items = Array.isArray(order.items) ? order.items : [];
    const lineTotal = items.reduce((s, i) => s + num(i === null || i === void 0 ? void 0 : i.price) * (num(i === null || i === void 0 ? void 0 : i.quantity) || 1), 0);
    const total = num(order.total) || num(order.amountPayable) || lineTotal;
    const remainingAmount = Math.max(0, Math.round((total - paidSoFar(order)) * 100) / 100);
    if (!(remainingAmount > 0)) {
        throw new https_1.HttpsError("failed-precondition", "Nothing left to pay on this order");
    }
    await ref.update({ paymentRetryAt: Date.now(), updatedAt: Date.now() });
    return {
        success: true,
        orderId,
        orderNumber: order.orderNumber || orderId,
        remainingAmount,
        shippingPhone: ((_d = order.shippingAddress) === null || _d === void 0 ? void 0 : _d.phone) || order.phone || "",
    };
});
/**
 * Credits a refund to the customer's wallet.
 *
 * In one transaction, because the balance, the ledger row and the order's
 * refunded flag have to agree: a double-click that credits twice is not
 * something an apology fixes.
 */
exports.refundToWallet = (0, https_1.onCall)(async (data, context) => {
    const { uid } = await (0, auth_1.requireAdmin)(context);
    const orderId = String((data === null || data === void 0 ? void 0 : data.orderId) || "");
    const refundAmount = num(data === null || data === void 0 ? void 0 : data.refundAmount);
    const refundReason = (data === null || data === void 0 ? void 0 : data.refundReason) ? String(data.refundReason) : "";
    if (!orderId)
        throw new https_1.HttpsError("invalid-argument", "Missing orderId");
    if (!(refundAmount > 0))
        throw new https_1.HttpsError("invalid-argument", "Refund amount must be positive");
    const db = admin.firestore();
    const orderRef = db.collection("orders").doc(orderId);
    const result = await db.runTransaction(async (tx) => {
        var _a;
        const orderSnap = await tx.get(orderRef);
        if (!orderSnap.exists)
            throw new https_1.HttpsError("not-found", "Order not found");
        const order = orderSnap.data();
        if (order.refundedToWallet) {
            throw new https_1.HttpsError("already-exists", "This order has already been refunded");
        }
        if (!order.userId) {
            throw new https_1.HttpsError("failed-precondition", "Guest orders have no wallet to refund into");
        }
        const total = num(order.total) || num(order.amountPayable);
        if (refundAmount > total) {
            throw new https_1.HttpsError("invalid-argument", `Refund exceeds the order total of ₹${total}`);
        }
        const userRef = db.collection("users").doc(String(order.userId));
        const userSnap = await tx.get(userRef);
        if (!userSnap.exists)
            throw new https_1.HttpsError("not-found", "Customer account not found");
        const before = num((_a = userSnap.data()) === null || _a === void 0 ? void 0 : _a.walletBalance);
        const after = before + refundAmount;
        tx.update(userRef, { walletBalance: after });
        tx.set(db.collection("walletTransactions").doc(), {
            userId: order.userId,
            transactionType: "credit",
            amount: refundAmount,
            source: "refund",
            balanceBefore: before,
            balanceAfter: after,
            description: `Refund for order ${order.orderNumber || orderId}`,
            relatedOrderId: orderId,
            createdAt: Date.now(),
        });
        tx.update(orderRef, {
            refundedToWallet: true,
            refundAmount,
            refundReason,
            refundedAt: Date.now(),
            refundedBy: uid,
            updatedAt: Date.now(),
        });
        return { balanceAfter: after };
    });
    return Object.assign(Object.assign({ success: true, refundAmount }, result), { message: "Refunded to wallet" });
});
/** Which MSG91 template an order-status mail uses. */
const EMAIL_USECASE = {
    order_confirmed: "order_confirmed",
    order_dispatched: "order_dispatched",
    order_delivered: "order_delivered",
    order_cancelled: "order_cancelled",
};
exports.sendOrderStatusEmail = (0, https_1.onCall)(async (data, context) => {
    var _a, _b;
    await (0, auth_1.requireAdmin)(context);
    const orderId = String((data === null || data === void 0 ? void 0 : data.orderId) || "");
    const emailType = String((data === null || data === void 0 ? void 0 : data.emailType) || "order_confirmed");
    if (!orderId)
        throw new https_1.HttpsError("invalid-argument", "Missing orderId");
    const usecaseKey = EMAIL_USECASE[emailType];
    if (!usecaseKey)
        throw new https_1.HttpsError("invalid-argument", `Unknown email type "${emailType}"`);
    const authkey = process.env.MSG91_AUTH_TOKEN || "";
    if (!authkey) {
        // Said plainly, because the alternative is a button that silently does
        // nothing and an admin who thinks the customer was told.
        throw new https_1.HttpsError("failed-precondition", "MSG91_AUTH_TOKEN is not configured, so no email can be sent.");
    }
    const db = admin.firestore();
    const snap = await db.collection("orders").doc(orderId).get();
    if (!snap.exists)
        throw new https_1.HttpsError("not-found", "Order not found");
    const order = snap.data();
    const to = String(order.email || order.customerEmail || order.guestEmail || "");
    if (!to)
        throw new https_1.HttpsError("failed-precondition", "This order has no email address");
    const tpl = await db.collection("emailUsecaseTemplates")
        .where("usecaseKey", "==", usecaseKey).limit(1).get();
    if (tpl.empty)
        throw new https_1.HttpsError("failed-precondition", `No email template for "${usecaseKey}"`);
    const t = tpl.docs[0].data();
    if (t.enabled !== true)
        throw new https_1.HttpsError("failed-precondition", `The "${usecaseKey}" email is switched off`);
    const items = Array.isArray(order.items) ? order.items : [];
    const name = ((_a = order.shippingAddress) === null || _a === void 0 ? void 0 : _a.fullName) || order.customerName || "Customer";
    const body = {
        template_id: t.msg91TemplateId,
        recipients: [{
                to: [{ email: to, name }],
                // These five names are what the MSG91 templates were built against, and
                // the API silently drops anything it does not recognise — which is why a
                // test mail arrived with "Thanks, — we've got your order!" and an empty
                // Order/Product/Amount table. All four order templates take the same set.
                variables: {
                    customerName: name,
                    orderNumber: String(order.orderNumber || order.failedOrderNumber || "Pending"),
                    productName: describeItems(items),
                    amount: `₹${(num(order.total) || num(order.amountPayable)).toFixed(2)}`,
                    productImage: String(((_b = items[0]) === null || _b === void 0 ? void 0 : _b.productImage) || ""),
                },
            }],
        from: { email: "noreply@mail.goskinly.com", name: "Skinly" },
        domain: "mail.goskinly.com",
    };
    const res = await fetch(MSG91_EMAIL_ENDPOINT, {
        method: "POST",
        headers: { authkey, "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) {
        console.error("sendOrderStatusEmail: MSG91 refused", { status: res.status, text });
        throw new https_1.HttpsError("unavailable", `MSG91: ${text.slice(0, 300)}`);
    }
    await db.collection("emailMessages").add({
        createdAt: Date.now(),
        recipientEmail: to,
        recipientUserId: order.userId || null,
        usecaseKey,
        templateName: t.templateName || usecaseKey,
        msg91TemplateId: t.msg91TemplateId,
        relatedOrderId: orderId,
        status: "sent",
        retryCount: 0,
    });
    return { success: true, message: `Email sent to ${to}` };
});
//# sourceMappingURL=ordersAdmin.js.map