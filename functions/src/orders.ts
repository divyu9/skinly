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
  const lineTotals = await Promise.all(
    orderItems.map(async (item) => {
      const quantity = Number(item?.quantity || 1);
      if (item?.productId && item?.variant) {
        const variantSnap = await db
          .collection("variants")
          .where("productId", "==", item.productId)
          .where("title", "==", item.variant)
          .limit(1)
          .get();

        if (!variantSnap.empty) {
          const variantData = variantSnap.docs[0].data() as any;
          return Number(variantData?.price || 0) * quantity;
        }
      }

      return Number(item?.price || 0) * quantity;
    })
  );
  const calculatedTotal = lineTotals.reduce((sum, n) => sum + Number(n || 0), 0);

  // Use calculated total instead of client-provided remainingAmount
  const newOrder = {
    orderNumber: orderNumber,
    userId: uid || reqSessionId || 'guest',
    customerName: shippingAddress?.fullName || 'Guest',
    email: customerEmail || guestEmail || '',
    phone: shippingAddress?.phone || '',
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

  return {
    orderId: docRef.id,
    orderNumber: orderNumber,
    remainingAmount: calculatedTotal,
    trackingToken: `TRACK-${docRef.id}`
  };
});
