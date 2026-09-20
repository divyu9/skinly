import * as functionsV1 from "firebase-functions/v1";
import * as admin from "firebase-admin";
import { normalizeOrderStatus } from "./orderStatus";
import { queueWhatsApp } from "./orderNotifications";

/**
 * One message a morning, instead of four tabs.
 *
 * Nothing watched anything. To know how yesterday went, what has to be packed
 * today and whether a design is about to run out, somebody had to open the
 * orders list, the stock tab and the materials page and hold the answer in
 * their head. Worse, nobody watched the shelf at all: a roll running out was
 * discovered when a listing went out of stock, which is one day too late.
 *
 * The figures are written to `digests/{day}` whether or not a message goes
 * out, so the number is on record even when WhatsApp is not configured.
 */

const SETTINGS = {
  rollMetres: "LOW_STOCK_ROLL_METRES",
  cutoutSheets: "LOW_STOCK_CUTOUT_SHEETS",
};

async function threshold(db: admin.firestore.Firestore, key: string, fallback: number): Promise<number> {
  const snap = await db.collection("settings").doc(key).get();
  const n = Number(snap.exists ? (snap.data() as any)?.value : NaN);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export interface Digest {
  day: string;
  orders: number;
  revenue: number;
  cod: number;
  toPack: number;
  inTransit: number;
  needsAttention: number;
  unpaid: number;
  lowStock: Array<{ code: string; name: string; left: number; unit: string }>;
  outOfStockListings: number;
}

export async function buildDigest(db: admin.firestore.Firestore): Promise<Digest> {
  const now = Date.now();
  const day = new Date(now).toISOString().slice(0, 10);
  const since = now - 24 * 3600 * 1000;

  const [orderSnap, rollSnap, cutoutSnap, variantSnap] = await Promise.all([
    db.collection("orders").get(),
    db.collection("rollInventory").get(),
    db.collection("cutoutInventory").get(),
    db.collection("variants").get(),
  ]);

  const live = orderSnap.docs.map((d) => d.data() as any).filter((o) => o.isDeleted !== true);

  let orders = 0, revenue = 0, cod = 0;
  let toPack = 0, inTransit = 0, needsAttention = 0, unpaid = 0;
  for (const o of live) {
    const status = normalizeOrderStatus(o.status, o.paymentStatus, o);
    const placed = Number(o.createdAt) || 0;
    if (placed >= since) {
      orders += 1;
      // Yesterday's takings, not yesterday's promises: COD is counted when it
      // is collected, which is on delivery, not when the order was placed.
      if (String(o.paymentStatus || "").toLowerCase() === "success") {
        revenue += Number(o.total ?? o.amountPayable) || 0;
      }
      if (String(o.paymentMethod || "").toLowerCase() === "cod") cod += 1;
    }
    if (status === "processing") toPack += 1;
    else if (status === "ready_to_ship" || status === "shipped" || status === "out_for_delivery") inTransit += 1;
    else if (status === "undelivered") needsAttention += 1;
    else if (status === "pending_payment") unpaid += 1;
  }

  const [rollFloor, sheetFloor] = await Promise.all([
    threshold(db, SETTINGS.rollMetres, 5),
    threshold(db, SETTINGS.cutoutSheets, 3),
  ]);

  const lowStock: Digest["lowStock"] = [];
  for (const d of rollSnap.docs) {
    const r = d.data() as any;
    const left = Number(r.metersAvailable) || 0;
    if (left <= rollFloor) {
      lowStock.push({ code: String(r.rNumber || d.id), name: String(r.designName || ""), left, unit: "m" });
    }
  }
  for (const d of cutoutSnap.docs) {
    const c = d.data() as any;
    const left = Number(c.sheetsAvailable) || 0;
    if (left <= sheetFloor) {
      lowStock.push({ code: String(c.cutoutNumber || d.id), name: String(c.designName || ""), left, unit: "sheets" });
    }
  }
  lowStock.sort((a, b) => a.left - b.left);

  const outOfStockListings = variantSnap.docs.filter((d) => {
    const v = d.data() as any;
    return !(Number(v.inventoryQuantity) > 0);
  }).length;

  return {
    day, orders, revenue, cod, toPack, inTransit, needsAttention, unpaid,
    lowStock: lowStock.slice(0, 25),
    outOfStockListings,
  };
}

/** The digest as a line somebody would actually read. */
function inWords(d: Digest): string {
  const parts = [
    `${d.orders} orders yesterday`,
    d.revenue > 0 ? `₹${Math.round(d.revenue).toLocaleString("en-IN")} collected` : "",
    `${d.toPack} to pack`,
    d.inTransit ? `${d.inTransit} on the way` : "",
    d.needsAttention ? `${d.needsAttention} failed delivery` : "",
    d.lowStock.length ? `${d.lowStock.length} designs running low` : "",
  ].filter(Boolean);
  return parts.join(", ");
}

export async function sendDigest(db: admin.firestore.Firestore): Promise<Digest> {
  const digest = await buildDigest(db);
  await db.collection("digests").doc(digest.day).set({ ...digest, at: Date.now() });

  try {
    const cfg = await db.doc("whatsappSettings/adminNotifications").get();
    const adminPhone = cfg.exists ? String((cfg.data() as any)?.adminPhone || "") : "";
    if (adminPhone) {
      await queueWhatsApp(db, "admin_daily_digest", adminPhone, {
        summary: inWords(digest),
        orders_count: String(digest.orders),
        revenue: `₹${Math.round(digest.revenue).toLocaleString("en-IN")}`,
        to_pack: String(digest.toPack),
        needs_attention: String(digest.needsAttention + digest.lowStock.length),
        low_stock: digest.lowStock.slice(0, 5).map((l) => `${l.code} (${l.left}${l.unit === "m" ? "m" : " sheets"})`).join(", ") || "none",
        company_name: "Skinly",
      }, digest.day);
    }
  } catch (e: any) {
    console.error("sendDigest: message skipped", e?.message || e);
  }

  console.log("dailyDigest", inWords(digest));
  return digest;
}

/** 03:30 UTC is 9:00 in Agra — the start of the working day, not the middle of it. */
export const dailyDigest = functionsV1
  .runWith({ memory: "512MB", timeoutSeconds: 300 })
  .pubsub.schedule("30 3 * * *")
  .timeZone("UTC")
  .onRun(async () => {
    await sendDigest(admin.firestore());
    return null;
  });

/** The same figures on demand, for the admin screen. */
export const runDailyDigest = functionsV1
  .runWith({ memory: "512MB", timeoutSeconds: 300 })
  .https.onCall(async (_data: any, context: any) => {
    const { requireAdmin } = await import("./auth");
    await requireAdmin(context);
    const digest = await sendDigest(admin.firestore());
    return { success: true, digest, message: inWords(digest) };
  });
