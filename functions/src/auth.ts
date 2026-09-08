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

/**
 * Admin is proven by a custom claim on the ID token, or by an email on the
 * server-side allowlist. It is deliberately NOT read from users/{uid}.isAdmin
 * any more: that document is writable by the user it belongs to, so trusting a
 * field in it let any customer grant themselves every admin function.
 */
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
  // email_verified guards against a provider that lets an address be claimed
  // without proving it.
  if (email && token?.email_verified !== false && allowlist.includes(email)) {
    return { uid };
  }

  throw new HttpsError("permission-denied", "Your account is not an admin");
};
