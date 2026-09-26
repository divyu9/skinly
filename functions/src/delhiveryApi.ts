import { HttpsError } from "firebase-functions/v1/https";
import * as admin from "firebase-admin";

/**
 * Delhivery's B2C ("Express") API, called directly.
 *
 * The same parcel under 500 g costs ₹67 booked on Delhivery's own panel and
 * ₹82 through RapidShyp, so an order can now go either way from the admin.
 * RapidShyp stays: it covers pincodes Delhivery does not, and its NDR and COD
 * handling live in one place.
 *
 * Kept apart from delhivery.ts so rapidshyp.ts can cancel and re-fetch labels
 * for a Delhivery shipment without the two modules importing each other.
 *
 * Reference: delhivery-express-api-doc.readme.io. Auth is a header,
 * "Authorization: Token <key>"; production is track.delhivery.com and staging
 * staging-express.delhivery.com, with different keys. The token lives in
 * functions/.env as DELHIVERY_API_TOKEN, never in the code or the database.
 */

export const DELHIVERY_TRACK_URL = (awb: string) => `https://www.delhivery.com/track-v2/package/${encodeURIComponent(awb)}`;

const base = () =>
  process.env.DELHIVERY_ENV === "staging" ? "https://staging-express.delhivery.com" : "https://track.delhivery.com";

function token(): string {
  const t = String(process.env.DELHIVERY_API_TOKEN || "").trim();
  if (!t) throw new HttpsError("failed-precondition", "Delhivery API token is not configured (DELHIVERY_API_TOKEN in functions/.env).");
  return t;
}

/** One call to Delhivery; the body comes back parsed when it is JSON, as text otherwise. */
export async function dlv(path: string, init: { method?: string; body?: string; json?: unknown } = {}): Promise<{ status: number; data: any; text: string }> {
  const headers: Record<string, string> = { Authorization: `Token ${token()}`, Accept: "application/json" };
  let body = init.body;
  if (init.json !== undefined) { body = JSON.stringify(init.json); headers["Content-Type"] = "application/json"; }
  else if (body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(`${base()}${path}`, { method: init.method || (body ? "POST" : "GET"), headers, body });
  const text = await res.text();
  let data: any = null;
  try { data = JSON.parse(text); } catch { /* not JSON */ }
  return { status: res.status, data, text };
}

/** The Delhivery half of Admin › Shipping. */
export async function delhiverySettings(db: admin.firestore.Firestore) {
  const snap = await db.collection("settings").doc("shipping").get();
  const s = snap.exists ? (snap.data() as any) : {};
  const mode = String(s.delhiveryMode || "Surface");
  return {
    pickup: String(s.delhiveryPickupName || s.rapidshypPickupName || "").trim(),
    originPin: String(s.delhiveryOriginPin || "").replace(/\D/g, "").slice(0, 6),
    gstin: String(s.sellerGstin || "").trim().toUpperCase(),
    mode: mode === "Express" ? "Express" : "Surface",
    sellerName: String(s.sellerName || "GoSkinly").trim(),
  };
}

/**
 * Delhivery's manifest body is not URL-encoded ("format=json&data=<json>"),
 * and it refuses & # % ; \ anywhere in it, so they are taken out of every
 * value rather than escaped.
 */
export const dlvClean = (v: unknown) => String(v ?? "").replace(/[&#%;\\]/g, " ").replace(/\s+/g, " ").trim();

/** Delhivery's timestamps are IST without a zone ("2026-09-26T17:10:42.767"). */
export function dlvTime(v: unknown): number {
  const s = String(v || "").trim();
  if (!s) return 0;
  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(s)) { const t = Date.parse(s); return Number.isFinite(t) ? t : 0; }
  const t = Date.parse(`${s.replace(" ", "T")}Z`);
  return Number.isFinite(t) ? t - 5.5 * 3600 * 1000 : 0;
}

/** Cancels a manifested parcel. Allowed until it is out for delivery. */
export async function cancelDelhiveryWaybill(awb: string): Promise<void> {
  const r = await dlv("/api/p/edit", { json: { waybill: awb, cancellation: "true" } });
  const ok = r.status < 300 && (r.data?.status === true || /cancel/i.test(String(r.data?.remark || "")));
  if (!ok) {
    console.error("Delhivery cancel failed", { awb, status: r.status, body: r.text.slice(0, 500) });
    throw new HttpsError("unavailable", String(r.data?.remark || r.data?.error || r.text || `Delhivery refused the cancellation (HTTP ${r.status})`).slice(0, 300));
  }
}

/**
 * A fresh link to the label PDF, or null.
 *
 * Asked for each time rather than stored: the label carries the customer's
 * name, address and phone, and the link Delhivery hands out is its own
 * short-lived one — nothing of it is copied to public storage.
 */
export async function delhiveryLabelLink(awb: string): Promise<string | null> {
  const r = await dlv(`/api/p/packing_slip?wbns=${encodeURIComponent(awb)}&pdf=true&pdf_size=4R`);
  const p = r.data?.packages?.[0];
  const link = p?.pdf_download_link || p?.pdf_link || null;
  if (!link) console.warn("Delhivery label: no PDF link", { awb, status: r.status, body: r.text.slice(0, 300) });
  return link ? String(link) : null;
}
