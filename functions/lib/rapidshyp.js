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
exports.bulkFetchLabels = exports.cancelShipment = exports.createShipment = void 0;
const https_1 = require("firebase-functions/v1/https");
const admin = __importStar(require("firebase-admin"));
const auth_1 = require("./auth");
const rate_limit_1 = require("./rate-limit");
/**
 * RapidShyp shipment creation.
 *
 * This was a stub after the Convex migration: it skipped the API call
 * entirely, wrote the literal AWB "AWB123456789" onto the order, marked it
 * SHIPPED and reported success. The admin saw "Shipment created!" and nothing
 * existed at the courier — the worst possible failure, because it looks like it
 * worked. This is the pre-migration implementation restored, reading the order
 * out of Firestore rather than through Convex queries.
 */
const getRapidShypConfig = () => {
    const apiKey = process.env.RAPIDSHYP_API_KEY || "";
    const apiUrl = process.env.RAPIDSHYP_API_URL || "https://api.rapidshyp.com/rapidshyp/apis/v1/wrapper";
    if (!apiKey) {
        throw new https_1.HttpsError("failed-precondition", "RapidShyp API key not configured.");
    }
    return { apiKey, apiUrl };
};
/** A finite number, or null. */
const num = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
};
/**
 * Orders written by different generations of checkout disagree about their
 * money fields; 43 of them carry no `subtotal` or `shippingFee` at all. The
 * courier needs real figures, so they are derived the same way the admin UI
 * derives them rather than defaulted to zero.
 */
function orderMoney(order, items) {
    var _a, _b, _c, _d, _e, _f;
    const lineTotal = items.reduce((sum, it) => { var _a, _b; return sum + ((_a = num(it === null || it === void 0 ? void 0 : it.price)) !== null && _a !== void 0 ? _a : 0) * ((_b = num(it === null || it === void 0 ? void 0 : it.quantity)) !== null && _b !== void 0 ? _b : 1); }, 0);
    const shippingFee = (_a = num(order === null || order === void 0 ? void 0 : order.shippingFee)) !== null && _a !== void 0 ? _a : 0;
    const codFee = (_b = num(order === null || order === void 0 ? void 0 : order.codFee)) !== null && _b !== void 0 ? _b : 0;
    const subtotal = (_d = (_c = num(order === null || order === void 0 ? void 0 : order.subtotal)) !== null && _c !== void 0 ? _c : num(order === null || order === void 0 ? void 0 : order.itemsTotal)) !== null && _d !== void 0 ? _d : (items.length ? lineTotal : 0);
    const total = (_f = (_e = num(order === null || order === void 0 ? void 0 : order.total)) !== null && _e !== void 0 ? _e : num(order === null || order === void 0 ? void 0 : order.amountPayable)) !== null && _f !== void 0 ? _f : subtotal + shippingFee + codFee;
    return { subtotal, shippingFee, codFee, total };
}
function emailOf(order) {
    var _a;
    return String((order === null || order === void 0 ? void 0 : order.email) || (order === null || order === void 0 ? void 0 : order.customerEmail) || (order === null || order === void 0 ? void 0 : order.guestEmail) || ((_a = order === null || order === void 0 ? void 0 : order.user) === null || _a === void 0 ? void 0 : _a.email) || "");
}
/** Pulls the readable message out of whatever shape RapidShyp returned. */
function describeError(status, body) {
    try {
        const j = JSON.parse(body);
        if (j.message)
            return String(j.message);
        if (typeof j.error === "string")
            return j.error;
        if (j.error)
            return JSON.stringify(j.error);
        if (Array.isArray(j.errors)) {
            return j.errors
                .map((e) => ((e === null || e === void 0 ? void 0 : e.field) ? `${e.field}: ${e.message}` : (e === null || e === void 0 ? void 0 : e.message) || JSON.stringify(e)))
                .join(", ");
        }
        if (j.errors)
            return JSON.stringify(j.errors);
        if (j.details)
            return typeof j.details === "string" ? j.details : JSON.stringify(j.details);
        return JSON.stringify(j);
    }
    catch (_a) {
        return body || `RapidShyp API error (${status})`;
    }
}
exports.createShipment = (0, https_1.onCall)(async (data, context) => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
    const { uid } = await (0, auth_1.requireAdmin)(context);
    await (0, rate_limit_1.enforceDailyRateLimit)({
        key: `createShipment_${uid}`,
        limit: Number(process.env.RAPIDSHYP_DAILY_LIMIT || 200),
    });
    const orderId = String((data === null || data === void 0 ? void 0 : data.orderId) || "");
    if (!orderId)
        throw new https_1.HttpsError("invalid-argument", "Missing orderId");
    const db = admin.firestore();
    const orderRef = db.collection("orders").doc(orderId);
    const orderDoc = await orderRef.get();
    if (!orderDoc.exists)
        throw new https_1.HttpsError("not-found", "Order not found");
    const order = orderDoc.data();
    const items = Array.isArray(order.items) ? order.items : [];
    if (!((_a = order.shippingAddress) === null || _a === void 0 ? void 0 : _a.phone)) {
        throw new https_1.HttpsError("failed-precondition", "Order is missing a phone number in the shipping address");
    }
    if (!((_b = order.shippingAddress) === null || _b === void 0 ? void 0 : _b.pincode)) {
        throw new https_1.HttpsError("failed-precondition", "Order is missing a pincode in the shipping address");
    }
    if (!items.length) {
        throw new https_1.HttpsError("failed-precondition", "Order has no items");
    }
    // Refuse rather than book a second consignment for one parcel.
    if (order.awbNumber) {
        throw new https_1.HttpsError("already-exists", `Shipment already created (AWB ${order.awbNumber})`);
    }
    const config = getRapidShypConfig();
    // Weight and dimensions come off the products, not the order lines.
    const productIds = [...new Set(items.map((i) => i === null || i === void 0 ? void 0 : i.productId).filter(Boolean))];
    const productDocs = productIds.length
        ? await db.getAll(...productIds.map((id) => db.collection("products").doc(id)))
        : [];
    const products = new Map();
    productDocs.forEach((d) => { if (d.exists)
        products.set(d.id, d.data()); });
    const physical = items.filter((i) => { var _a; return ((_a = products.get(String(i === null || i === void 0 ? void 0 : i.productId))) === null || _a === void 0 ? void 0 : _a.productType) !== "digital"; });
    if (!physical.length) {
        throw new https_1.HttpsError("failed-precondition", "Order contains only digital products, no shipment required");
    }
    let totalWeight = 0, totalLength = 0, totalBreadth = 0, totalHeight = 0;
    for (const item of physical) {
        const p = products.get(String(item === null || item === void 0 ? void 0 : item.productId)) || {};
        totalWeight += ((_c = num(p.weight)) !== null && _c !== void 0 ? _c : 100) * ((_d = num(item === null || item === void 0 ? void 0 : item.quantity)) !== null && _d !== void 0 ? _d : 1);
        totalLength += (_e = num(p.length)) !== null && _e !== void 0 ? _e : 10;
        totalBreadth += (_f = num(p.breadth)) !== null && _f !== void 0 ? _f : 10;
        totalHeight += (_g = num(p.height)) !== null && _g !== void 0 ? _g : 2;
    }
    const count = physical.length;
    const avgLength = Math.ceil(totalLength / count);
    const avgBreadth = Math.ceil(totalBreadth / count);
    const avgHeight = Math.ceil(totalHeight / count);
    const packageWeightInGrams = Math.max(1, Math.round(totalWeight));
    const money = orderMoney(order, items);
    if (!(money.total > 0)) {
        throw new https_1.HttpsError("failed-precondition", "Order total is missing or invalid");
    }
    for (const item of items) {
        if (!(num(item === null || item === void 0 ? void 0 : item.price) > 0)) {
            throw new https_1.HttpsError("failed-precondition", `Item price is missing or invalid for ${(item === null || item === void 0 ? void 0 : item.productTitle) || "an item"}`);
        }
    }
    const isCod = String(order.paymentMethod || "").toLowerCase() === "cod";
    const paymentMethod = isCod ? "COD" : "Prepaid";
    const codValue = isCod ? ((_h = num(order.codAmount)) !== null && _h !== void 0 ? _h : money.total) : 0;
    const nameParts = String(order.shippingAddress.fullName || order.customerName || "").trim().split(/\s+/);
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "";
    const phone = String(order.shippingAddress.phone).replace(/^\+/, "");
    const email = emailOf(order);
    const address = {
        firstName,
        lastName,
        addressLine1: order.shippingAddress.addressLine1 || "",
        addressLine2: order.shippingAddress.addressLine2 || "",
        city: order.shippingAddress.city || "",
        state: order.shippingAddress.state || "",
        pinCode: order.shippingAddress.pincode,
        phone,
        email,
    };
    const orderedAt = num(order.createdAt) || num(order._creationTime) || Date.now();
    const shipmentPayload = Object.assign(Object.assign({ orderId: order.orderNumber || orderDoc.id, orderDate: new Date(orderedAt).toISOString().split("T")[0], pickupAddressName: process.env.RAPIDSHYP_PICKUP_NAME || "SKINLY", storeName: process.env.RAPIDSHYP_STORE_NAME || "DEFAULT", billingIsShipping: true, shippingAddress: address, billingAddress: address, orderItems: items.map((item) => {
            var _a, _b;
            const price = (_a = num(item === null || item === void 0 ? void 0 : item.price)) !== null && _a !== void 0 ? _a : 0;
            // Prices are GST-inclusive, so the tax component is price × 0.18/1.18.
            return {
                itemName: item.productTitle,
                sku: item.sku || item.variant,
                units: (_b = num(item === null || item === void 0 ? void 0 : item.quantity)) !== null && _b !== void 0 ? _b : 1,
                unitPrice: price,
                tax: Number((price * (0.18 / 1.18)).toFixed(2)),
                hsn: "39269099",
            };
        }), paymentMethod, shippingCharges: money.shippingFee, totalDiscount: 0 }, (isCod ? { codValue } : {})), { packageDetails: {
            packageLength: avgLength,
            packageBreadth: avgBreadth,
            packageHeight: avgHeight,
            packageWeight: packageWeightInGrams,
        } });
    console.log("RapidShyp createShipment", {
        order: order.orderNumber || orderDoc.id,
        url: config.apiUrl,
        payload: shipmentPayload,
    });
    const response = await fetch(config.apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", "rapidshyp-token": config.apiKey },
        body: JSON.stringify(shipmentPayload),
    });
    if (!response.ok) {
        const body = await response.text();
        const message = describeError(response.status, body);
        console.error("RapidShyp createShipment failed", { status: response.status, body });
        throw new https_1.HttpsError("unavailable", message);
    }
    const result = await response.json();
    console.log("RapidShyp createShipment response", JSON.stringify(result));
    const shipment = (_j = result === null || result === void 0 ? void 0 : result.shipment) === null || _j === void 0 ? void 0 : _j[0];
    if (!shipment) {
        throw new https_1.HttpsError("unavailable", `RapidShyp returned no shipment data: ${JSON.stringify(result)}`);
    }
    const awbNumber = shipment.awb;
    if (!awbNumber) {
        throw new https_1.HttpsError("unavailable", `RapidShyp returned no AWB number: ${JSON.stringify(shipment)}`);
    }
    const update = {
        awbNumber,
        trackingUrl: shipment.tracking_link || `https://app.rapidshyp.com/t/${awbNumber}`,
        shippingStatus: "Shipment Created",
        shippingProvider: "rapidshyp",
        updatedAt: Date.now(),
    };
    if (shipment.courierName)
        update.courierName = shipment.courierName;
    if (shipment.labelURL)
        update.labelUrl = shipment.labelURL;
    if (shipment.shipmentId)
        update.shipmentId = shipment.shipmentId;
    await orderRef.update(update);
    return {
        success: true,
        awbNumber,
        shipmentId: shipment.shipmentId,
        trackingUrl: update.trackingUrl,
        labelUrl: shipment.labelURL,
        courierName: shipment.courierName,
        message: "Shipment created successfully",
    };
});
exports.cancelShipment = (0, https_1.onCall)(async (data, context) => {
    await (0, auth_1.requireAdmin)(context);
    const orderId = String((data === null || data === void 0 ? void 0 : data.orderId) || "");
    if (!orderId)
        throw new https_1.HttpsError("invalid-argument", "Missing orderId");
    const db = admin.firestore();
    const orderRef = db.collection("orders").doc(orderId);
    const orderDoc = await orderRef.get();
    if (!orderDoc.exists)
        throw new https_1.HttpsError("not-found", "Order not found");
    const order = orderDoc.data();
    if (!order.awbNumber)
        throw new https_1.HttpsError("failed-precondition", "Order has no shipment to cancel");
    const config = getRapidShypConfig();
    const base = config.apiUrl.replace(/\/rapidshyp\/apis\/v1\/wrapper\/?$/, "");
    const response = await fetch(`${base}/v1/external/orders/cancel/${order.awbNumber}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "rapidshyp-token": config.apiKey },
    });
    if (!response.ok) {
        const body = await response.text();
        console.error("RapidShyp cancelShipment failed", { status: response.status, body });
        throw new https_1.HttpsError("unavailable", describeError(response.status, body));
    }
    await orderRef.update({
        awbNumber: admin.firestore.FieldValue.delete(),
        trackingUrl: admin.firestore.FieldValue.delete(),
        courierName: admin.firestore.FieldValue.delete(),
        labelUrl: admin.firestore.FieldValue.delete(),
        shipmentId: admin.firestore.FieldValue.delete(),
        shippingProvider: admin.firestore.FieldValue.delete(),
        shippingStatus: "",
        status: "processing",
        updatedAt: Date.now(),
    });
    return { success: true, message: "Shipment cancelled successfully", orderNumber: order.orderNumber };
});
/**
 * Pulls the shipping labels for a batch of orders as base64 PDFs.
 *
 * The fetch happens here rather than in the browser because the label lives on
 * a RapidShyp host that sends no CORS headers — the page can neither read the
 * bytes nor lay them out four-to-a-sheet.
 */
exports.bulkFetchLabels = (0, https_1.onCall)(async (data, context) => {
    await (0, auth_1.requireAdmin)(context);
    const orderIds = Array.isArray(data === null || data === void 0 ? void 0 : data.orderIds) ? data.orderIds : [];
    if (!orderIds.length)
        throw new https_1.HttpsError("invalid-argument", "No orders selected");
    if (orderIds.length > 100)
        throw new https_1.HttpsError("invalid-argument", "At most 100 labels at a time");
    const db = admin.firestore();
    const labels = [];
    const errors = [];
    const docs = await db.getAll(...orderIds.map((id) => db.collection("orders").doc(id)));
    for (const snap of docs) {
        const order = snap.exists ? snap.data() : null;
        const label = String((order === null || order === void 0 ? void 0 : order.orderNumber) || (order === null || order === void 0 ? void 0 : order.failedOrderNumber) || "Pending");
        if (!order) {
            errors.push({ orderId: snap.id, orderNumber: label, error: "Order not found" });
            continue;
        }
        if (!order.labelUrl) {
            errors.push({ orderId: snap.id, orderNumber: label, error: "No label URL found" });
            continue;
        }
        try {
            const res = await fetch(String(order.labelUrl), { redirect: "follow" });
            if (!res.ok)
                throw new Error(`HTTP ${res.status} ${res.statusText}`);
            const buf = Buffer.from(await res.arrayBuffer());
            if (!buf.byteLength)
                throw new Error("Empty PDF file");
            labels.push({ orderId: snap.id, orderNumber: label, pdfBase64: buf.toString("base64") });
        }
        catch (e) {
            errors.push({ orderId: snap.id, orderNumber: label, error: (e === null || e === void 0 ? void 0 : e.message) || "Fetch failed" });
        }
    }
    return { success: errors.length === 0, labels, errors };
});
//# sourceMappingURL=rapidshyp.js.map