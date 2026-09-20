import * as functions from "firebase-functions/v1";
import { HttpsError } from "firebase-functions/v1/https";
import * as admin from "firebase-admin";
import { getCaller } from "./auth";
import { enforceDailyRateLimit } from "./rate-limit";

export const createOrder = functions.runWith({ memory: "256MB", timeoutSeconds: 60, minInstances: 1 }).https.onCall(async (data: any, context: any) => {
  const { uid } = getCaller(context);
  const { shippingAddress, customerEmail, guestEmail, paymentMethod, guestItems, sessionId: reqSessionId } = data;


  // Use uid if logged in, otherwise use the session id passed from frontend
  const trackingId = uid || reqSessionId || "guest";

  // Rate limit order creation (50 orders per user/session per day)
  await enforceDailyRateLimit({ key: `createOrder_${trackingId}`, limit: 50 });

  const db = admin.firestore();

  // 1. Gather Cart Items Securely
  let orderItems: any[] = [];
  if (uid) {
    const cartSnap = await db.collection('cart').where('userId', '==', uid).get();
    orderItems = cartSnap.docs.map(d => d.data());
  } else if (guestItems && guestItems.length > 0) {
    // If guest passes items directly, use them (you could also fetch them by session ID from the DB)
    orderItems = guestItems;
  } else if (reqSessionId) {
    const cartSnap = await db.collection('cart').where('sessionId', '==', reqSessionId).get();
    orderItems = cartSnap.docs.map(d => d.data());
  }

  if (!orderItems || orderItems.length === 0) {
    throw new HttpsError("failed-precondition", "Cannot create order with an empty cart");
  }

  // Same rule as placeOrder: an order with no email can be told nothing and
  // looked up by nobody.
  const email = String(customerEmail || guestEmail || "").trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    throw new HttpsError("failed-precondition", "A valid email address is required to place an order");
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
    } else {
      transaction.set(counterRef, { key: 'order_counter', value: 4002 });
    }
    orderNumber = `#${currentVal}`;
  });

  // 3. Assemble the Order Payload securely by calculating total from database
  const productIds = Array.from(
    new Set(
      orderItems
        .map((i) => i?.productId)
        .filter((p) => typeof p === "string" && p.length > 0)
    )
  );

  const chunks: string[][] = [];
  for (let i = 0; i < productIds.length; i += 10) {
    chunks.push(productIds.slice(i, i + 10));
  }

  const variantsArr = (await Promise.all(
    chunks.map(async (chunk) => {
      if (chunk.length === 0) return [];
      const snap = await db.collection("variants").where("productId", "in", chunk).get();
      return snap.docs.map((d) => d.data());
    })
  )).flat() as any[];

  const priceMap = new Map<string, number>();
  for (const v of variantsArr) {
    const key = `${String(v.productId)}::${String(v.title)}`;
    priceMap.set(key, Number(v.price || 0));
  }

  // Price from the variant document only, as placeOrder does. Falling back to
  // `item.price` let a caller name a variant that does not exist and set its
  // price; and a variant priced 0 is an unpriced row, not a free item.
  const lineTotals = orderItems.map((item) => {
    const quantity = Math.max(1, Math.floor(Number(item?.quantity || 1)));
    const dbPrice = item?.productId && item?.variant
      ? priceMap.get(`${String(item.productId)}::${String(item.variant)}`)
      : undefined;
    if (typeof dbPrice !== "number" || !(dbPrice > 0)) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        `"${item?.variant}" is not available to order`
      );
    }
    return dbPrice * quantity;
  });
  const calculatedTotal = lineTotals.reduce((sum, n) => sum + Number(n || 0), 0);

  // Use calculated total instead of client-provided remainingAmount
  const newOrder = {
    orderNumber: orderNumber,
    userId: uid || reqSessionId || 'guest',
    customerName: shippingAddress?.fullName || 'Guest',
    email,
    phone: shippingAddress?.phone || '',
    shippingAddress: shippingAddress || {},
    paymentMethod: paymentMethod || 'prepaid',
    status: (paymentMethod || 'prepaid') === 'cod' ? 'processing' : 'pending_payment',
    paymentStatus: 'pending',
    total: calculatedTotal,
    items: orderItems,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  // 4. Save to Firestore
  const docRef = await db.collection('orders').add(newOrder);

  return {
    orderId: docRef.id,
    orderNumber: orderNumber,
    remainingAmount: calculatedTotal,
    trackingToken: `TRACK-${docRef.id}`
  };
});
