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
exports.placeOrder = void 0;
const functions = __importStar(require("firebase-functions/v1"));
const materials_1 = require("./materials");
const https_1 = require("firebase-functions/v1/https");
const admin = __importStar(require("firebase-admin"));
const crypto = __importStar(require("crypto"));
const auth_1 = require("./auth");
/** Atomic counter increment — runs in background while cart is being fetched */
const reserveOrderNumber = async (db) => {
    const counterRef = db.collection("settings").doc("order_counter");
    let orderNumber = "";
    await db.runTransaction(async (tx) => {
        var _a, _b;
        const snap = await tx.get(counterRef);
        const current = snap.exists ? ((_b = (_a = snap.data()) === null || _a === void 0 ? void 0 : _a.value) !== null && _b !== void 0 ? _b : 4001) : 4001;
        tx.set(counterRef, { value: current + 1 }, { merge: true });
        orderNumber = `#${current}`;
    });
    return orderNumber;
};
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
/**
 * Fast combined placeOrder — single function call for the entire checkout.
 *
 * Perf vs naive createOrder + initiatePayment:
 *   - No rate-limit Firestore transaction        → -800ms
 *   - No order-counter Firestore transaction     → -1200ms
 *     (order number derived from pre-generated doc ID, zero cost)
 *   - Variant lookups batched into 1 query       → faster than N individual queries
 *   - PhonePe called immediately, no re-fetch    → -500ms round trip
 *   - Fire-and-forget the post-payment doc update → doesn't block response
 */
exports.placeOrder = functions
    .runWith({ memory: "256MB", timeoutSeconds: 120, minInstances: 1 })
    .https.onCall(async (data, context) => {
    var _a, _b, _c, _d;
    const { uid } = (0, auth_1.getCaller)(context);
    const db = admin.firestore();
    const { shippingAddress, customerEmail, guestEmail, paymentMethod, guestItems, sessionId: reqSessionId, customerPhone, couponId, walletAmount } = data;
    // Note: couponDiscount / prepaidAmount / amount also arrive from the client.
    // They are deliberately ignored — every figure below is re-derived here.
    // ── 1. Kick off order number reservation immediately (runs in background) ──
    // Cart fetch + variant query take ~500ms. The counter transaction takes ~800-1200ms.
    // By starting both at the same time we overlap most of the wait.
    const orderNumberPromise = reserveOrderNumber(db);
    // Pre-generate doc ref so we have orderId before any writes
    const docRef = db.collection("orders").doc();
    const orderId = docRef.id;
    // ── 2. Fetch cart items ───────────────────────────────────────────────────
    let orderItems = [];
    if (uid) {
        const snap = await db.collection("cart").where("userId", "==", uid).get();
        orderItems = snap.docs.map((d) => d.data());
    }
    else if (guestItems && guestItems.length > 0) {
        orderItems = guestItems;
    }
    else if (reqSessionId) {
        const snap = await db.collection("cart").where("sessionId", "==", reqSessionId).get();
        orderItems = snap.docs.map((d) => d.data());
    }
    if (!orderItems || orderItems.length === 0) {
        throw new https_1.HttpsError("failed-precondition", "Cannot create order with an empty cart");
    }
    // ── 3. Batch-fetch all variant prices in ONE Firestore query ──────────────
    const productIds = Array.from(new Set(orderItems.map((i) => i === null || i === void 0 ? void 0 : i.productId).filter((p) => typeof p === "string" && p.length > 0)));
    const priceMap = new Map();
    if (productIds.length > 0) {
        // Firestore "in" supports up to 30 values; chunk just in case
        const chunks = [];
        for (let i = 0; i < productIds.length; i += 30)
            chunks.push(productIds.slice(i, i + 30));
        const snaps = await Promise.all(chunks.map((chunk) => db.collection("variants").where("productId", "in", chunk).get()));
        for (const snap of snaps) {
            for (const d of snap.docs) {
                const v = d.data();
                priceMap.set(`${String(v.productId)}::${String(v.title)}`, Number(v.price || 0));
            }
        }
    }
    // Price comes from the variant document, always. The old fallback to
    // `item.price` meant a cart line naming a variant that does not exist was
    // billed at whatever the caller claimed — send variant "zzz" with price 1
    // and a ₹5,000 order became ₹1.
    const itemsTotal = orderItems.reduce((sum, item) => {
        const qty = Math.max(1, Math.floor(Number((item === null || item === void 0 ? void 0 : item.quantity) || 1)));
        const dbPrice = (item === null || item === void 0 ? void 0 : item.productId) && (item === null || item === void 0 ? void 0 : item.variant)
            ? priceMap.get(`${String(item.productId)}::${String(item.variant)}`)
            : undefined;
        if (typeof dbPrice !== "number") {
            throw new https_1.HttpsError("failed-precondition", `No such variant "${item === null || item === void 0 ? void 0 : item.variant}" for product ${item === null || item === void 0 ? void 0 : item.productId}`);
        }
        return sum + dbPrice * qty;
    }, 0);
    // ── 3b. Re-derive every discount server-side ──────────────────────────────
    let couponDiscount = 0;
    if (couponId && typeof couponId === "string") {
        const cSnap = await db.collection("coupons").doc(couponId).get();
        const c = cSnap.exists ? cSnap.data() : null;
        if (c && c.isActive === true && itemsTotal >= Number(c.minPurchaseAmount || 0)) {
            if (c.discountType === "percentage") {
                couponDiscount = Math.floor(itemsTotal * (Number(c.discountValue || 0) / 100));
                if (c.maxDiscountAmount)
                    couponDiscount = Math.min(couponDiscount, Number(c.maxDiscountAmount));
            }
            else {
                couponDiscount = Math.min(itemsTotal, Number(c.discountValue || 0));
            }
            // A wallet-credit coupon pays out afterwards; it is not money off now.
            if (c.isWalletCredit === true)
                couponDiscount = 0;
        }
    }
    // Wallet is capped by the balance the server can see, never by the request.
    let walletUsed = 0;
    if (uid && Number(walletAmount) > 0) {
        const uSnap = await db.collection("users").doc(uid).get();
        const balance = Number(uSnap.exists ? ((_a = uSnap.data()) === null || _a === void 0 ? void 0 : _a.walletBalance) || 0 : 0);
        walletUsed = Math.max(0, Math.min(Number(walletAmount), balance, itemsTotal - couponDiscount));
    }
    // COD fee and the prepaid split come from codSettings, same formula the
    // storefront shows.
    let codFee = 0;
    let prepaidAmount = 0;
    if (paymentMethod === "cod") {
        const cs = await db.collection("codSettings").limit(1).get();
        const st = cs.empty ? {} : cs.docs[0].data();
        const base = itemsTotal - couponDiscount - walletUsed;
        codFee = st.codFeeType === "fixed"
            ? Number(st.codFeeValue || 0)
            : (base * Number(st.codFeeValue || 0)) / 100;
        if (st.partialCodEnabled === true) {
            prepaidAmount = st.prepaidType === "fixed"
                ? Number(st.prepaidValue || 0)
                : (base * Number(st.prepaidValue || 0)) / 100;
        }
    }
    const calculatedTotal = Math.max(0, itemsTotal - couponDiscount - walletUsed + codFee);
    // What PhonePe must collect right now: the whole thing for prepaid, only
    // the prepaid slice for partial COD.
    const amountPayable = paymentMethod === "cod"
        ? Math.max(0, Math.min(prepaidAmount, calculatedTotal))
        : calculatedTotal;
    // ── 4. Write order ────────────────────────────────────────────────────────
    // Collect the order number now — by this point cart+variants took ~500ms,
    // so the counter transaction (started at step 1) is usually already done.
    const orderNumber = await orderNumberPromise;
    await docRef.set({
        orderNumber,
        userId: uid || reqSessionId || "guest",
        customerName: (shippingAddress === null || shippingAddress === void 0 ? void 0 : shippingAddress.fullName) || "Guest",
        email: customerEmail || guestEmail || "",
        phone: (shippingAddress === null || shippingAddress === void 0 ? void 0 : shippingAddress.phone) || "",
        shippingAddress: shippingAddress || {},
        paymentMethod: paymentMethod || "prepaid",
        status: "pending",
        paymentStatus: "pending",
        itemsTotal,
        couponId: couponId || null,
        couponDiscount,
        walletUsed,
        codFee,
        prepaidAmount,
        total: calculatedTotal,
        // The only figure any payment step may charge.
        amountPayable,
        items: orderItems,
        createdAt: Date.now(),
        updatedAt: Date.now(),
    });
    // ── 4b. Draw down design stock ────────────────────────────────────────────
    // After the order is safely written, and deliberately not blocking on it:
    // an order must never be lost because the stock ledger had a bad row.
    (0, materials_1.reserveMaterialForOrder)(db, docRef, orderItems).catch((e) => console.error("reserveMaterial failed", { order: docRef.id, error: (e === null || e === void 0 ? void 0 : e.message) || e }));
    // ── 5. Initiate PhonePe (same function call, no second round-trip) ──────────
    if (paymentMethod === "phonepe" && calculatedTotal > 0 && customerPhone) {
        let phoneDigits = String(customerPhone).replace(/\D/g, "");
        if (phoneDigits.length === 12 && phoneDigits.startsWith("91"))
            phoneDigits = phoneDigits.slice(2);
        if (!/^[0-9]{10}$/.test(phoneDigits))
            throw new https_1.HttpsError("invalid-argument", "Invalid phone number");
        const config = getPhonePeConfig();
        const merchantTransactionId = `${orderNumber.replace("#", "")}-${Date.now().toString().slice(-6)}`;
        const amountInPaise = Math.max(Math.round(amountPayable * 100), 100);
        const siteUrl = (process.env.SITE_URL || "https://goskinly.com").replace(/\/+$/, "");
        // The function, not the SPA route — see the note in phonepe.ts.
        const callbackFnUrl = process.env.CALLBACK_FN_URL
            || `https://us-central1-${process.env.GCLOUD_PROJECT || "skinly-3003b"}.cloudfunctions.net/paymentCallback`;
        const paymentPayload = {
            merchantId: config.merchantId,
            merchantTransactionId,
            merchantUserId: uid || (reqSessionId ? String(reqSessionId).slice(-24) : "GUEST_USER"),
            amount: amountInPaise,
            redirectUrl: `${siteUrl}/payment/callback`,
            redirectMode: "REDIRECT",
            callbackUrl: callbackFnUrl,
            mobileNumber: phoneDigits,
            paymentInstrument: { type: "PAY_PAGE" },
        };
        const base64Payload = Buffer.from(JSON.stringify(paymentPayload)).toString("base64");
        const endpoint = "/pg/v1/pay";
        const xVerify = `${crypto.createHash("sha256").update(base64Payload + endpoint + config.saltKey).digest("hex")}###${config.saltIndex}`;
        console.log("PhonePe placeOrder", { merchantTransactionId, amount: amountInPaise, orderNumber });
        try {
            const fetch = require("node-fetch");
            const response = await fetch(`${config.v1BaseUrl}${endpoint}`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "X-VERIFY": xVerify, accept: "application/json" },
                body: JSON.stringify({ request: base64Payload }),
            });
            const responseText = await response.text();
            let responseData = {};
            try {
                responseData = JSON.parse(responseText);
            }
            catch (_e) {
                console.error("PhonePe non-JSON", { status: response.status, body: responseText.slice(0, 200) });
                return { orderId, orderNumber, remainingAmount: calculatedTotal, trackingToken: `TRACK-${orderId}`, paymentError: `PhonePe HTTP ${response.status}` };
            }
            console.log("PhonePe response", { code: responseData.code, success: responseData.success });
            if (!response.ok || !responseData.success) {
                const errMsg = `PhonePe error: ${responseData.code || "UNKNOWN"} - ${responseData.message || "Payment initiation failed"}`;
                console.error("PhonePe failed", responseData);
                return { orderId, orderNumber, remainingAmount: calculatedTotal, trackingToken: `TRACK-${orderId}`, paymentError: errMsg };
            }
            const paymentUrl = (_d = (_c = (_b = responseData.data) === null || _b === void 0 ? void 0 : _b.instrumentResponse) === null || _c === void 0 ? void 0 : _c.redirectInfo) === null || _d === void 0 ? void 0 : _d.url;
            if (!paymentUrl) {
                return { orderId, orderNumber, remainingAmount: calculatedTotal, trackingToken: `TRACK-${orderId}`, paymentError: "PhonePe returned no payment URL" };
            }
            // Fire-and-forget — doesn't block the redirect
            docRef.update({ paymentTransactionId: merchantTransactionId, paymentStatus: "PENDING", paymentProvider: "phonepe" })
                .catch((e) => console.error("order txn update failed", e));
            return { orderId, orderNumber, remainingAmount: calculatedTotal, trackingToken: `TRACK-${orderId}`, paymentUrl, merchantTransactionId };
        }
        catch (err) {
            console.error("PhonePe API error", (err === null || err === void 0 ? void 0 : err.message) || err);
            if (err instanceof https_1.HttpsError)
                throw err;
            throw new https_1.HttpsError("unavailable", (err === null || err === void 0 ? void 0 : err.message) || "PhonePe API error");
        }
    }
    // ── 6. COD / wallet / zero-total path ─────────────────────────────────────
    return { orderId, orderNumber, remainingAmount: calculatedTotal, trackingToken: `TRACK-${orderId}` };
});
//# sourceMappingURL=placeorder.js.map