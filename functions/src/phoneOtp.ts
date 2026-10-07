import * as admin from "firebase-admin";
import * as crypto from "crypto";
import { onCall, HttpsError } from "firebase-functions/v1/https";
import { enforceDailyRateLimit } from "./rate-limit";
import { cleanItems } from "./cartSync";

/**
 * "Save my cart on WhatsApp" with the number proven by a one-time code.
 *
 * The cart page asks a guest for their WhatsApp number. The code goes out
 * as a WhatsApp authentication template (Fast2SMS's Meta-format endpoint,
 * sent at once rather than through the queue); entering it saves the cart
 * against that number (cartSnapshots, stage "saved") and records consent,
 * because the box says so next to the button: verifying the number agrees
 * to updates and promotional messages about the order and products. The
 * abandoned-cart reminder then reaches them like any checkout left half-way.
 *
 * The same code verifies the phone at checkout (purpose "checkout"): the
 * reply carries a short-lived token that placeOrder checks and records as
 * order.phoneVerified, so delivery has a proven number.
 *
 * Switch and template: settings/cartSaveOtp
 *   { enabled: true, templateName: "<approved authentication template>", language: "en",
 *     checkoutRequired: false }   // true = no order without a verified number
 * The cart page shows the box only while `enabled` is true. Needs
 * FAST2SMS_API_KEY and OTP_PEPPER in functions/.env and the business number's
 * phone_number_id in whatsappSettings/provider.
 */

const OTP_TTL_MS = 10 * 60_000;
const RESEND_COOLDOWN_MS = 60_000;
const MAX_ATTEMPTS = 5;
export const CART_SAVE_CONSENT =
  "By verifying this number you agree to receive updates and promotional messages about your order and our products on WhatsApp. Reply STOP anytime.";
// Both boxes show the same sentence (save-cart-whatsapp.tsx, PhoneVerify.tsx).

const sha = (s: string) => crypto.createHash("sha256").update(s).digest("hex");
const hashOtp = (otp: string, phone: string) => {
  const pepper = process.env.OTP_PEPPER || "";
  if (pepper.length < 16) throw new HttpsError("failed-precondition", "OTP is not set up yet");
  return sha(`cart:${otp}:${phone}:${pepper}`);
};
const tenDigits = (raw: unknown) => {
  const d = String(raw || "").replace(/\D/g, "").slice(-10);
  if (!/^[6-9]\d{9}$/.test(d)) throw new HttpsError("invalid-argument", "Enter a valid 10-digit mobile number");
  return d;
};
const callerIp = (context: any) =>
  String(context?.rawRequest?.headers?.["x-forwarded-for"] || context?.rawRequest?.ip || "unknown").split(",")[0].trim();

async function settings() {
  const s = (await admin.firestore().doc("settings/cartSaveOtp").get()).data() as any;
  if (!s?.enabled || !s?.templateName) throw new HttpsError("failed-precondition", "WhatsApp verification is not available right now");
  return { templateName: String(s.templateName), language: String(s.language || "en") };
}

/** The code as a WhatsApp authentication template: body {{1}} and the copy-code button both carry it. */
async function sendWhatsAppOtp(phone: string, otp: string, tpl: { templateName: string; language: string }) {
  const key = process.env.FAST2SMS_API_KEY || "";
  const prov = (await admin.firestore().doc("whatsappSettings/provider").get()).data() as any;
  if (!key || !prov?.phoneNumberId) throw new HttpsError("failed-precondition", "WhatsApp is not set up");
  const version = process.env.FAST2SMS_GRAPH_VERSION || "v26.0";
  const res = await fetch(`https://www.fast2sms.com/dev/whatsapp/${version}/${prov.phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: key, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp", recipient_type: "individual", to: `91${phone}`, type: "template",
      template: {
        name: tpl.templateName, language: { code: tpl.language },
        components: [
          { type: "body", parameters: [{ type: "text", text: otp }] },
          { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: otp }] },
        ],
      },
    }),
  });
  const text = await res.text();
  let ok = res.ok;
  try { const j = JSON.parse(text); ok = ok && !j?.error && (j?.messages?.[0]?.id || j?.return === true || j?.status === true); } catch { ok = false; }
  if (!ok) {
    console.error("[phoneOtp] send failed", { status: res.status, body: text.slice(0, 300) });
    throw new HttpsError("unavailable", "Could not send the code on WhatsApp. Check the number and try again.");
  }
}

export const sendCartSaveOtp = onCall(async (data: any, context: any) => {
  const tpl = await settings();
  const phone = tenDigits(data?.phone);
  await enforceDailyRateLimit({ key: `cartOtp_${phone}`, limit: 5 });
  await enforceDailyRateLimit({ key: `cartOtpIp_${callerIp(context)}`, limit: 30 });

  const ref = admin.firestore().collection("phoneOtps").doc(phone);
  const prev = (await ref.get()).data() as any;
  if (prev?.sentAt && Date.now() - Number(prev.sentAt) < RESEND_COOLDOWN_MS) {
    throw new HttpsError("resource-exhausted", "Please wait a minute before asking for another code");
  }
  const otp = String(crypto.randomInt(100000, 1000000));
  await ref.set({ hash: hashOtp(otp, phone), sentAt: Date.now(), expiresAt: Date.now() + OTP_TTL_MS, attempts: 0, purpose: "cart_save" });
  await sendWhatsAppOtp(phone, otp, tpl);
  return { sent: true };
});

const TOKEN_TTL_MS = 3 * 3600_000;
const sign = (s: string) => {
  const pepper = process.env.OTP_PEPPER || "";
  if (pepper.length < 16) throw new HttpsError("failed-precondition", "OTP is not set up yet");
  return crypto.createHmac("sha256", pepper).update(`phone-token:${s}`).digest("hex").slice(0, 32);
};
/** placeOrder: is this the token verifyCartSaveOtp gave for this phone, and still fresh? */
export function verifyPhoneToken(token: unknown, phone10: string): boolean {
  try {
    const [p, exp, mac] = String(token || "").split(".");
    if (!p || p !== phone10 || !(Number(exp) > Date.now())) return false;
    const want = sign(`${p}.${exp}`);
    return mac?.length === want.length && crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(want));
  } catch { return false; }
}
/** Whether checkout refuses an unverified number (settings/cartSaveOtp.checkoutRequired). */
export async function checkoutPhoneRequired(): Promise<boolean> {
  const s = (await admin.firestore().doc("settings/cartSaveOtp").get()).data() as any;
  return s?.enabled === true && s?.checkoutRequired === true;
}

export const verifyCartSaveOtp = onCall(async (data: any) => {
  const phone = tenDigits(data?.phone);
  const otp = String(data?.otp || "").replace(/\D/g, "");
  const cartId = String(data?.cartId || "");
  if (otp.length !== 6) throw new HttpsError("invalid-argument", "Enter the 6-digit code");
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(cartId)) throw new HttpsError("invalid-argument", "Bad cart id");

  const db = admin.firestore();
  const ref = db.collection("phoneOtps").doc(phone);
  const rec = (await ref.get()).data() as any;
  if (!rec || Date.now() > Number(rec.expiresAt)) throw new HttpsError("deadline-exceeded", "The code has expired. Ask for a new one.");
  if (Number(rec.attempts) >= MAX_ATTEMPTS) throw new HttpsError("resource-exhausted", "Too many wrong codes. Ask for a new one.");
  if (rec.hash !== hashOtp(otp, phone)) {
    await ref.update({ attempts: admin.firestore.FieldValue.increment(1) });
    throw new HttpsError("permission-denied", "That code is not right");
  }
  await ref.delete();

  const now = Date.now();
  // Consent, as the box worded it at the moment of verifying.
  await db.collection("contacts").doc(phone).set({
    optIn: true, optInAt: now, optInSource: data?.purpose === "checkout" ? "checkout_otp" : "cart_save_otp", optOut: false,
    phoneVerifiedAt: now, consentText: CART_SAVE_CONSENT,
  }, { merge: true });

  const purpose = data?.purpose === "checkout" ? "checkout" : "cart";
  const items = cleanItems(data?.items);
  const snap = db.collection("cartSnapshots").doc(cartId);
  const prev = await snap.get();
  const prevStage = prev.exists ? String((prev.data() as any).stage || "") : "";
  await snap.set({
    items,
    itemCount: items.reduce((n, i) => n + i.quantity, 0),
    total: Math.round(items.reduce((s, i) => s + i.price * i.quantity, 0)),
    stage: purpose === "checkout" ? "checkout" : prevStage === "checkout" || prevStage === "ordered" ? prevStage : "saved",
    phone, optIn: true, phoneVerified: true,
    checkoutAt: now, updatedAt: now,
    ...(prev.exists ? {} : { createdAt: now }),
  }, { merge: true });
  const exp = now + TOKEN_TTL_MS;
  return { ok: true, token: `${phone}.${exp}.${sign(`${phone}.${exp}`)}` };
});
