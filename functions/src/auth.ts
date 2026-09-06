import * as admin from "firebase-admin";
import { HttpsError } from "firebase-functions/v1/https";

export const getCaller = (request: any) => {
  const auth = request?.auth;
  const uid = auth?.uid || null;
  const token = auth?.token || null;
  return { uid, token };
};

export const requireAuth = (request: any) => {
  const { uid } = getCaller(request);
  if (!uid) {
    throw new HttpsError("unauthenticated", "UNAUTHENTICATED");
  }
  return { uid };
};

const parseAllowlist = (value: string | undefined) => {
  if (!value) return [];
  return value
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
};

export const requireAdmin = async (request: any) => {
  const { uid, token } = getCaller(request);
  if (!uid) {
    throw new HttpsError("unauthenticated", "UNAUTHENTICATED");
  }

  if (token?.admin === true) {
    return { uid };
  }

  const allowlist = parseAllowlist(process.env.ADMIN_EMAIL_ALLOWLIST);
  const email = (token?.email || "").toLowerCase();
  if (email && allowlist.includes(email)) {
    return { uid };
  }

  const db = admin.firestore();

  const snap = await db.collection("users").doc(uid).get();
  if (snap.exists && snap.data()?.isAdmin === true) {
    return { uid };
  }

  // User documents were imported from the previous backend keyed by its own
  // ids, so users/{authUid} does not exist for anyone who predates the move.
  // Fall back to matching on the email the token already proves they own.
  if (email) {
    const byEmail = await db
      .collection("users")
      .where("email", "==", email)
      .limit(1)
      .get();
    if (!byEmail.empty && byEmail.docs[0].data()?.isAdmin === true) {
      return { uid };
    }
  }

  throw new HttpsError("permission-denied", "Your account is not an admin");
};

