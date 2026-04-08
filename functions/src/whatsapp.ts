import { onCall } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

const getWhatsAppConfig = () => {
  const authkey = process.env.WHATSAPP_AUTHKEY || "";
  if (!authkey) {
      throw new Error("WhatsApp API credentials not configured.");
    }
  return { authkey };
};

export const sendWhatsAppMessage = onCall({ memory: "256MiB", timeoutSeconds: 60 }, async (request: any) => {
  const data = request.data;
  const { phone, templateId, variables } = data;

  if (!phone || !templateId) {
    throw new Error("Missing required fields");
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
      mobile: phone,
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
