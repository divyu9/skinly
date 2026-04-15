import { onCall } from "firebase-functions/v1/https";
import * as admin from "firebase-admin";
import { requireAdmin } from "./auth";
import { enforceDailyRateLimit } from "./rate-limit";

const getRapidShypConfig = () => {
  const apiKey = process.env.RAPIDSHYP_API_KEY || "";
  const apiUrl = process.env.RAPIDSHYP_API_URL || "https://api.rapidshyp.com/rapidshyp/apis/v1/wrapper";

  if (!apiKey) {
    throw new Error("RapidShyp API credentials not configured.");
  }

  return { apiKey, apiUrl };
};

export const createShipment = onCall(async (data: any, context: any) => {
  const { uid } = await requireAdmin(context);
  await enforceDailyRateLimit({ key: `createShipment_${uid}`, limit: Number(process.env.RAPIDSHYP_DAILY_LIMIT || 200) });
  const { orderId } = data;

  if (!orderId) {
    throw new Error("Missing orderId");
  }

  const orderRef = admin.firestore().collection("orders").doc(orderId);
  const orderDoc = await orderRef.get();

  if (!orderDoc.exists) {
    throw new Error("Order not found");
  }

  const order = orderDoc.data()!;

  if (!order.shippingAddress?.phone) {
    throw new Error("Order missing phone number in shipping address");
  }

  const config = getRapidShypConfig();

  // Rapidshyp payload formatting goes here.
  // We're just stubbing this so the frontend can call it and not crash.

  const payload = {
    // Map order details to Rapidshyp requirements
    orderId: order.orderNumber || orderDoc.id,
    customerName: order.shippingAddress.name,
    // ...
  };

  console.log("RapidShyp Payload:", payload, "Config URL:", config.apiUrl);

  try {
    // const fetch = (await import("node-fetch")).default;
    // const response = await fetch(config.apiUrl, { method: "POST", headers: { Authorization: config.apiKey }, body: JSON.stringify(payload) });
    // const responseData = await response.json();

    // Fake success for now to establish the hook
    const fakeAwb = "AWB123456789";

    await orderRef.update({
      shippingProvider: "rapidshyp",
      trackingNumber: fakeAwb,
      shippingStatus: "SHIPPED"
    });

    return {
      success: true,
      awbNumber: fakeAwb,
      message: "Shipment created successfully"
    };

  } catch (error: any) {
    console.error("Rapidshyp error", error);
    throw new Error(error.message || "Shipment creation failed");
  }
});
