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
exports.createOrder = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = __importStar(require("firebase-admin"));
const auth_1 = require("./auth");
const rate_limit_1 = require("./rate-limit");
exports.createOrder = (0, https_1.onCall)({ memory: "256MiB", timeoutSeconds: 60, invoker: "public", cors: true }, async (request) => {
    const { uid } = (0, auth_1.getCaller)(request);
    const data = request.data || {};
    const { shippingAddress, customerEmail, guestEmail, paymentMethod, guestItems, sessionId: reqSessionId } = data;
    // Use uid if logged in, otherwise use the session id passed from frontend
    const trackingId = uid || reqSessionId || "guest";
    // Rate limit order creation (50 orders per user/session per day)
    await (0, rate_limit_1.enforceDailyRateLimit)({ key: `createOrder_${trackingId}`, limit: 50 });
    const db = admin.firestore();
    // 1. Gather Cart Items Securely
    let orderItems = [];
    if (uid) {
        const cartSnap = await db.collection('cart').where('userId', '==', uid).get();
        orderItems = cartSnap.docs.map(d => d.data());
    }
    else if (guestItems && guestItems.length > 0) {
        // If guest passes items directly, use them (you could also fetch them by session ID from the DB)
        orderItems = guestItems;
    }
    else if (reqSessionId) {
        const cartSnap = await db.collection('cart').where('sessionId', '==', reqSessionId).get();
        orderItems = cartSnap.docs.map(d => d.data());
    }
    if (!orderItems || orderItems.length === 0) {
        throw new https_1.HttpsError("failed-precondition", "Cannot create order with an empty cart");
    }
    // 2. Generate Order Number (Transactionally to avoid duplicates)
    const counterRef = db.collection('settings').doc('order_counter');
    let orderNumber = '';
    await db.runTransaction(async (transaction) => {
        const counterDoc = await transaction.get(counterRef);
        let currentVal = 4001; // Default starting number
        if (counterDoc.exists) {
            const docData = counterDoc.data();
            currentVal = (docData && docData.value) ? docData.value : 4001;
            transaction.update(counterRef, { value: currentVal + 1 });
        }
        else {
            transaction.set(counterRef, { key: 'order_counter', value: 4002 });
        }
        orderNumber = `#${currentVal}`;
    });
    // 3. Assemble the Order Payload securely by calculating total from database
    const lineTotals = await Promise.all(orderItems.map(async (item) => {
        const quantity = Number((item === null || item === void 0 ? void 0 : item.quantity) || 1);
        if ((item === null || item === void 0 ? void 0 : item.productId) && (item === null || item === void 0 ? void 0 : item.variant)) {
            const variantSnap = await db
                .collection("variants")
                .where("productId", "==", item.productId)
                .where("title", "==", item.variant)
                .limit(1)
                .get();
            if (!variantSnap.empty) {
                const variantData = variantSnap.docs[0].data();
                return Number((variantData === null || variantData === void 0 ? void 0 : variantData.price) || 0) * quantity;
            }
        }
        return Number((item === null || item === void 0 ? void 0 : item.price) || 0) * quantity;
    }));
    const calculatedTotal = lineTotals.reduce((sum, n) => sum + Number(n || 0), 0);
    // Use calculated total instead of client-provided remainingAmount
    const newOrder = {
        orderNumber: orderNumber,
        userId: uid || reqSessionId || 'guest',
        customerName: (shippingAddress === null || shippingAddress === void 0 ? void 0 : shippingAddress.fullName) || 'Guest',
        email: customerEmail || guestEmail || '',
        phone: (shippingAddress === null || shippingAddress === void 0 ? void 0 : shippingAddress.phone) || '',
        shippingAddress: shippingAddress || {},
        paymentMethod: paymentMethod || 'prepaid',
        status: 'pending',
        paymentStatus: 'pending',
        total: calculatedTotal,
        items: orderItems,
        createdAt: Date.now(),
        updatedAt: Date.now()
    };
    // 4. Save to Firestore
    const docRef = await db.collection('orders').add(newOrder);
    // 5. Optional Cleanup (Delete user's cart after creating order)
    // Moved to client side so we only clear on SUCCESSFUL payment
    // if (uid) {
    //   const batch = db.batch();
    //   const cartSnap = await db.collection('cart').where('userId', '==', uid).get();
    //   cartSnap.docs.forEach(doc => {
    //     batch.delete(doc.ref);
    //   });
    //   await batch.commit();
    // }
    return {
        orderId: docRef.id,
        orderNumber: orderNumber,
        remainingAmount: calculatedTotal,
        trackingToken: `TRACK-${docRef.id}`
    };
});
//# sourceMappingURL=orders.js.map