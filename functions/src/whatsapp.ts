import { onCall } from "firebase-functions/v1/https";
import * as admin from "firebase-admin";
import { requireAdmin } from "./auth";
import { enforceDailyRateLimit } from "./rate-limit";

const getWhatsAppConfig = () => {
  const authkey = process.env.WHATSAPP_AUTHKEY || "";
  if (!authkey) {
    throw new Error("WhatsApp API credentials not configured.");
  }
  return { authkey };
};

export const sendWhatsAppMessage = onCall(async (data: any, context: any) => {
  const { uid } = await requireAdmin(context);
  await enforceDailyRateLimit({ key: `sendWhatsAppMessage_${uid}`, limit: Number(process.env.WHATSAPP_DAILY_LIMIT || 500) });
  const { phone, templateId, variables } = data;

  if (!phone || !templateId) {
    throw new Error("Missing required fields");
  }
  if (typeof phone !== "string" || !/^[0-9]{10,15}$/.test(phone.replace(/\D/g, ""))) {
    throw new Error("Invalid phone");
  }
  if (typeof templateId !== "string" || templateId.length > 128) {
    throw new Error("Invalid templateId");
  }
  if (variables && typeof variables !== "object") {
    throw new Error("Invalid variables");
  }

  const config = getWhatsAppConfig();

  // MSG91/Authkey logic implementation
  try {
    const fetch = require("node-fetch");
    // Replace with actual provider URL (Authkey/MSG91)
    const url = "https://api.authkey.io/request";

    // Construct the payload for Authkey.io
    const params = new URLSearchParams({
      authkey: config.authkey,
      mobile: phone.replace(/\D/g, ""),
      country_code: "91", // Assuming India, dynamically parse if needed
      sid: "XXX", // Sender ID
      template_id: templateId,
      ...variables
    });

    const response = await fetch(`${url}?${params.toString()}`, {
      method: "GET"
    });

    if (!response.ok) {
      console.error("WhatsApp API Error:", await response.text());
      throw new Error("WhatsApp sending failed");
    }

    // Save message log to firestore
    await admin.firestore().collection("whatsappLogs").add({
      phone,
      templateId,
      variables,
      status: "SENT",
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    return { success: true, message: "WhatsApp message sent successfully" };

  } catch (error: any) {
    console.error("WhatsApp Send Error:", error);

    await admin.firestore().collection("whatsappLogs").add({
      phone,
      templateId,
      variables,
      status: "FAILED",
      error: error.message,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    throw new Error(error.message || "WhatsApp sending failed");
  }
});
