import { onCall, HttpsError } from "firebase-functions/v1/https";
import * as admin from "firebase-admin";
import * as crypto from "crypto";
import { enforceDailyRateLimit } from "./rate-limit";

/*
 * The phone check before a COD order.
 *
 * Checkout's OTP was a stub: any six digits passed, so anyone could file a
 * cash-on-delivery order against any number — a parcel shipped, refused and
 * paid for twice in courier charges. The code is now sent by SMS (the same
 * Authkey route and template as the login OTP; WhatsApp waits for Meta to
 * approve the business name) and checked here.
 *
 * A guest can check out, so neither call needs a signed-in user. Verifying
 * returns a one-time token that placeOrder requires for a COD order while
 * codSettings.otpRequired is on (assertCodOtp below); the switch lives in
 * Admin › COD, so the check can be turned off without a deploy.
 */

const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 60 * 1000;
/** How long a verified number stays good for placing the order. */
const TOKEN_TTL_MS = 30 * 60 * 1000;

const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

// codOtps is closed to browsers (no rule matches it), but the pepper is what
// keeps a leaked document from being brute-forced, as with loginOtps.
const hashOtp = (otp: string, phone: string) => {
  const pepper = process.env.OTP_PEPPER || "";
  if (pepper.length < 16) throw new HttpsError("failed-precondition", "OTP_PEPPER is not configured");
  return sha256(`cod:${otp}:${phone}:${pepper}`);
};

const normalizePhone = (raw: unknown): string => {
  if (typeof raw !== "string") throw new HttpsError("invalid-argument", "Invalid phone number");
  const digits = raw.replace(/\D/g, "").slice(-10);
  if (!/^[6-9]\d{9}$/.test(digits)) throw new HttpsError("invalid-argument", "Enter a valid 10-digit mobile number");
  return digits;
};

const callerIp = (context: any) =>
  String(context?.rawRequest?.headers?.["x-forwarded-for"] || context?.rawRequest?.ip || "unknown").split(",")[0].trim();

async function sendSmsOtp(phone: string, otp: string) {
  const authkey = process.env.WHATSAPP_AUTHKEY || "";
  const templateId = process.env.OTP_TEMPLATE_ID || "";
  if (!authkey || !templateId) throw new HttpsError("failed-precondition", "OTP provider is not configured");
  const fetch = require("node-fetch");
  const params = new URLSearchParams({
    authkey,
    mobile: phone,
    country_code: "91",
    sid: process.env.OTP_SENDER_ID || "",
    template_id: templateId,
    otp,
  });
  const res = await fetch(`https://api.authkey.io/request?${params.toString()}`, { method: "GET" });
  const body = await res.text();
  if (!res.ok) {
    console.error("[codOtp] send failed:", res.status, body);
    throw new HttpsError("internal", "Could not send OTP. Please try again.");
  }
  return body;
}

export const generateCodOtp = onCall(async (data: any, context: any) => {
  const phone = normalizePhone(data?.phoneNumber);

  // Each send is a paid SMS: per number and per connection, so a script cannot
  // pump messages to numbers it does not own.
  await enforceDailyRateLimit({ key: `codOtp_phone_${phone}`, limit: 5 });
  await enforceDailyRateLimit({ key: `codOtp_ip_${callerIp(context).replace(/[^\w.:-]/g, "_")}`, limit: 20 });

  const db = admin.firestore();
  const ref = db.collection("codOtps").doc(phone);
  const existing = await ref.get();
  if (existing.exists && Date.now() - Number(existing.data()?.sentAt || 0) < RESEND_COOLDOWN_MS) {
    throw new HttpsError("resource-exhausted", "Please wait a minute before requesting another OTP");
  }

  const otp = String(crypto.randomInt(100000, 1000000));
  const providerReply = await sendSmsOtp(phone, otp);
  const expiresAt = Date.now() + OTP_TTL_MS;
  await ref.set({
    phone,
    otpHash: hashOtp(otp, phone),
    sentAt: Date.now(),
    expiresAt,
    attempts: 0,
    verified: false,
    channel: "sms",
    providerReply: String(providerReply).slice(0, 300),
  });
  return { success: true, expiresAt, channel: "sms" };
});

export const verifyCodOtp = onCall(async (data: any) => {
  const phone = normalizePhone(data?.phoneNumber);
  const otp = typeof data?.otp === "string" ? data.otp.trim() : "";
  if (!/^\d{6}$/.test(otp)) throw new HttpsError("invalid-argument", "Enter the 6-digit code");

  const db = admin.firestore();
  const ref = db.collection("codOtps").doc(phone);
  const token = crypto.randomBytes(24).toString("hex");

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError("not-found", "Request a new OTP");
    const rec = snap.data() as any;
    if (rec.verified) throw new HttpsError("failed-precondition", "This code was already used. Request a new OTP.");
    if (Date.now() > Number(rec.expiresAt || 0)) throw new HttpsError("deadline-exceeded", "OTP expired. Request a new one.");
    if (Number(rec.attempts || 0) >= MAX_ATTEMPTS) throw new HttpsError("resource-exhausted", "Too many attempts. Request a new OTP.");

    const expected = Buffer.from(String(rec.otpHash || ""));
    const actual = Buffer.from(hashOtp(otp, phone));
    if (!(expected.length === actual.length && crypto.timingSafeEqual(expected, actual))) {
      tx.update(ref, { attempts: Number(rec.attempts || 0) + 1 });
      throw new HttpsError("invalid-argument", "Incorrect OTP");
    }
    tx.update(ref, { verified: true, verifiedAt: Date.now(), tokenHash: sha256(token), tokenUsedAt: null });
  });

  return { success: true, codOtpToken: token };
});

/**
 * Throws unless this COD order's phone was verified in the last 30 minutes
 * with the token verifyCodOtp handed out. Returns the record to mark used
 * once the order exists (markCodOtpUsed). No-op while the switch is off.
 */
export async function assertCodOtp(
  db: admin.firestore.Firestore,
  codSettings: any,
  rawPhone: unknown,
  token: unknown,
): Promise<admin.firestore.DocumentReference | null> {
  if (codSettings?.otpRequired !== true) return null;
  let phone = "";
  try { phone = normalizePhone(rawPhone); } catch { /* falls through to the refusal */ }
  const ref = phone ? db.collection("codOtps").doc(phone) : null;
  const rec = ref ? (await ref.get()).data() : undefined;
  const ok = !!rec && rec.verified === true && !rec.tokenUsedAt &&
    typeof token === "string" && token.length > 0 && rec.tokenHash === sha256(token) &&
    Date.now() - Number(rec.verifiedAt || 0) < TOKEN_TTL_MS;
  if (!ok) throw new HttpsError("failed-precondition", "Please verify your phone number with OTP before placing a COD order");
  return ref;
}

export async function markCodOtpUsed(ref: admin.firestore.DocumentReference | null, orderId: string) {
  if (!ref) return;
  await ref.update({ tokenUsedAt: Date.now(), usedForOrder: orderId }).catch((e) => console.error("[codOtp] mark used:", e));
}
