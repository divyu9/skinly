"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notifyOrderPlaced = void 0;
const ordersAdmin_1 = require("./ordersAdmin");
/**
 * Tells the customer, and you, that an order exists.
 *
 * Nothing did this. `placeOrder` wrote the order and stopped, so an order
 * placed on a fully working site with a valid MSG91 key and every usecase
 * enabled still reached nobody. The two orders placed since the site came back
 * both produced zero messages, which is how the gap showed up.
 *
 * Timing follows the original: a COD order notifies the moment it is placed,
 * an online order only once PhonePe confirms the money. Telling someone "we've
 * got your order" before they have paid is worse than saying nothing.
 *
 * Everything here is best-effort and guarded. An order must never fail, or be
 * lost, because a message could not go out.
 */
const MSG91_EMAIL_ENDPOINT = "https://control.msg91.com/api/v5/email/send";
/** Where "View Your Order" should point. */
function orderLinkFor(orderId) {
    const site = (process.env.SITE_URL || "https://goskinly.com").replace(/\/+$/, "");
    return `${site}/orders/${orderId}`;
}
/**
 * The image the mail should show, or nothing.
 *
 * 55 of 144 orders carry a res.cloudinary.com image, and that account was
 * wiped — every one of those URLs now answers 401. The template wraps the
 * picture in {{#if productImage}}, so sending an empty string drops the block
 * entirely and the mail looks deliberate, where a dead URL would show a broken
 * image icon next to "Here's what you picked — looking good!".
 */
function usableImage(items) {
    var _a;
    const url = String(((_a = items === null || items === void 0 ? void 0 : items[0]) === null || _a === void 0 ? void 0 : _a.productImage) || "");
    if (!url || url.includes("res.cloudinary.com"))
        return "";
    return url;
}
/** Queues one WhatsApp message, if that usecase is switched on. */
async function queueWhatsApp(db, usecaseKey, phone, variables, orderId) {
    const digits = String(phone || "").replace(/\D/g, "").slice(-10);
    if (!/^[6-9]\d{9}$/.test(digits))
        return false;
    const uc = await db.collection("whatsappUsecases").where("usecaseKey", "==", usecaseKey).limit(1).get();
    if (uc.empty || uc.docs[0].data().enabled !== true)
        return false;
    const msg = await db.collection("whatsappMessages").add({
        usecaseKey,
        recipientPhone: digits,
        relatedOrderId: orderId,
        variables,
        status: "pending",
        createdAt: Date.now(),
    });
    await db.collection("whatsappQueue").add({
        messageId: msg.id,
        status: "pending",
        attempts: 0,
        scheduledFor: Date.now(),
        createdAt: Date.now(),
    });
    return true;
}
/** Sends the order-confirmed mail, if the key and template allow it. */
async function sendConfirmationEmail(db, order, orderId) {
    var _a, _b;
    const authkey = process.env.MSG91_AUTH_TOKEN || "";
    if (!authkey)
        return false;
    const to = String(order.email || order.customerEmail || order.guestEmail || "");
    if (!to)
        return false;
    const tpl = await db.collection("emailUsecaseTemplates")
        .where("usecaseKey", "==", "order_confirmed").limit(1).get();
    if (tpl.empty || tpl.docs[0].data().enabled !== true)
        return false;
    const t = tpl.docs[0].data();
    const items = Array.isArray(order.items) ? order.items : [];
    const name = ((_a = order.shippingAddress) === null || _a === void 0 ? void 0 : _a.fullName) || order.customerName || "Customer";
    const total = Number((_b = order.total) !== null && _b !== void 0 ? _b : order.amountPayable) || 0;
    const res = await fetch(MSG91_EMAIL_ENDPOINT, {
        method: "POST",
        headers: { authkey, "Content-Type": "application/json" },
        body: JSON.stringify({
            template_id: t.msg91TemplateId,
            recipients: [{
                    to: [{ email: to, name }],
                    variables: {
                        customerName: name,
                        orderNumber: String(order.orderNumber || "Pending"),
                        productName: (0, ordersAdmin_1.describeItems)(items),
                        amount: `₹${total.toFixed(2)}`,
                        productImage: usableImage(items),
                        orderLink: orderLinkFor(orderId),
                    },
                }],
            from: { email: "noreply@mail.goskinly.com", name: "Skinly" },
            domain: "mail.goskinly.com",
        }),
    });
    const text = await res.text();
    await db.collection("emailMessages").add(Object.assign(Object.assign({ createdAt: Date.now(), recipientEmail: to, recipientUserId: order.userId || null, usecaseKey: "order_confirmed", templateName: t.templateName || "order confirmed", msg91TemplateId: t.msg91TemplateId, relatedOrderId: orderId, status: res.ok ? "sent" : "failed" }, (res.ok ? {} : { errorMessage: text.slice(0, 500) })), { retryCount: 0 }));
    if (!res.ok)
        console.error("order_confirmed email failed", { orderId, status: res.status, text });
    return res.ok;
}
/**
 * Fires every notification an order should produce, exactly once.
 *
 * The `orderNotifiedAt` flag is set first and checked in a transaction: a COD
 * order and a late PhonePe callback can both arrive at this, and two "we've got
 * your order" messages for one order is the kind of thing customers screenshot.
 */
async function notifyOrderPlaced(db, orderId) {
    var _a, _b, _c;
    const ref = db.collection("orders").doc(orderId);
    const order = await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists)
            return null;
        const data = snap.data();
        if (data.orderNotifiedAt)
            return null;
        tx.update(ref, { orderNotifiedAt: Date.now() });
        return data;
    });
    if (!order)
        return;
    const items = Array.isArray(order.items) ? order.items : [];
    const name = ((_a = order.shippingAddress) === null || _a === void 0 ? void 0 : _a.fullName) || order.customerName || "Customer";
    const orderNumber = String(order.orderNumber || "Pending");
    const total = Number((_b = order.total) !== null && _b !== void 0 ? _b : order.amountPayable) || 0;
    const productNames = items.map((i) => i === null || i === void 0 ? void 0 : i.productTitle).filter(Boolean).join(", ");
    const results = await Promise.allSettled([
        queueWhatsApp(db, "order_received", ((_c = order.shippingAddress) === null || _c === void 0 ? void 0 : _c.phone) || order.phone || "", {
            customer_name: name,
            order_number: orderNumber,
            product_name: productNames,
        }, orderId),
        (async () => {
            var _a;
            // The admin's own number is configuration, not customer data, so it is
            // read fresh rather than baked into the order.
            const cfg = await db.doc("whatsappSettings/adminNotifications").get();
            const adminPhone = cfg.exists ? String(((_a = cfg.data()) === null || _a === void 0 ? void 0 : _a.adminPhone) || "") : "";
            if (!adminPhone)
                return false;
            const mode = String(order.paymentMethod || "").toLowerCase() === "cod" ? "COD" : "Prepaid";
            return queueWhatsApp(db, "admin_new_order", adminPhone, {
                order_number: orderNumber,
                amount: total.toFixed(2),
                customer_name: name,
                number_of_products: String(items.length),
                payment_mode: mode,
            }, orderId);
        })(),
        sendConfirmationEmail(db, order, orderId),
    ]);
    const [customerWa, adminWa, mail] = results.map((r) => r.status === "fulfilled" ? r.value : false);
    console.log("notifyOrderPlaced", { orderId, orderNumber, customerWa, adminWa, mail });
}
exports.notifyOrderPlaced = notifyOrderPlaced;
//# sourceMappingURL=orderNotifications.js.map