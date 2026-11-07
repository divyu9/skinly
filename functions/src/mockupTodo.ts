import * as functionsV1 from "firebase-functions/v1";
import * as admin from "firebase-admin";
import { GoogleAuth } from "google-auth-library";
import { modelSlug } from "./seoAuto";

/**
 * The mockup to-do list: which phone models most need their mockups made.
 *
 * Ranked from what the shop already knows — orders placed for the model
 * (recent ones count more), customers' model requests, and how new the model
 * is on the site (a phone from a big brand added lately is about to be
 * searched for). Google Search data has a slot here for when it is synced.
 * A model drops out as soon as its mockup coverage is (nearly) complete.
 *
 * Written nightly to mockupTodo/latest; Admin › Advanced Mockups shows it and
 * removes rows live as the admin uploads (it watches mockupCoverage itself).
 */

type Row = {
  modelId: string; brand: string; model: string; score: number;
  orders365: number; orders90: number; requests: number; newDays: number | null;
  impressions: number; clicks: number; have: number; reasons: string[];
};

/**
 * Google Search Console, last 28 days, by page: how often each model page is
 * shown and clicked. Needs the functions' service account added as a user on
 * the GSC property (sc-domain:goskinly.com). Returns null when it cannot read,
 * and the list is ranked without search data that day.
 */
async function searchByPage(): Promise<{ rows: Map<string, { impressions: number; clicks: number }>; error?: string }> {
  const rows = new Map<string, { impressions: number; clicks: number }>();
  try {
    const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/webmasters.readonly"] });
    const client = await auth.getClient();
    const day = (d: Date) => d.toISOString().slice(0, 10);
    const end = new Date(Date.now() - 2 * DAY), start = new Date(Date.now() - 30 * DAY);
    const res: any = await client.request({
      url: "https://www.googleapis.com/webmasters/v3/sites/sc-domain%3Agoskinly.com/searchAnalytics/query",
      method: "POST",
      data: { startDate: day(start), endDate: day(end), dimensions: ["page"], rowLimit: 5000, type: "web" },
    });
    for (const r of (res.data?.rows || []) as any[]) {
      const path = String(r.keys?.[0] || "").replace(/^https?:\/\/(www\.)?goskinly\.com/i, "").replace(/\/$/, "").replace(/\?.*$/, "");
      if (!path) continue;
      const cur = rows.get(path) || { impressions: 0, clicks: 0 };
      cur.impressions += Number(r.impressions || 0); cur.clicks += Number(r.clicks || 0);
      rows.set(path, cur);
    }
    return { rows };
  } catch (e: any) {
    return { rows, error: String(e?.message || e).slice(0, 300) };
  }
}

const norm = (s: unknown) => String(s || "").toLowerCase().replace(/\(5g\)|\b5g\b|\b4g\b/g, "").replace(/[^a-z0-9]/g, "");
const MAJOR = new Set(["apple", "samsung", "vivo", "oppo", "realme", "xiaomi", "redmi", "poco", "oneplus", "motorola", "google", "nothing", "cmf", "iqoo", "infinix", "tecno", "honor"]);
const DAY = 864e5;

export async function computeMockupTodo(db: admin.firestore.Firestore) {
  const now = Date.now();

  // Phone models on the site, keyed for loose matching.
  const models = new Map<string, { id: string; brand: string; model: string; createdAt: number; source: string }>();
  const byKey = new Map<string, string>();
  (await db.collection("supportedModels").where("category", "==", "phone").get()).forEach((d) => {
    const x = d.data() as any;
    if (x.isActive === false || x.mergedInto) return;
    const row = { id: d.id, brand: String(x.brandName || ""), model: String(x.modelName || ""), createdAt: Number(x.createdAt || x._creationTime || 0), source: String(x.source || "") };
    models.set(d.id, row);
    byKey.set(norm(row.brand) + "|" + norm(row.model), d.id);
  });
  const find = (brand: unknown, model: unknown) => {
    const b = norm(brand), m = norm(model);
    return byKey.get(b + "|" + m) || byKey.get(b + "|" + b + m) || byKey.get(b + "|galaxy" + m) || byKey.get(b + "|" + m.replace(/^galaxy/, "")) || null;
  };

  // How many designs a model needs: the precut designs in stock plus the rolls (zero-sheet precuts are never restocked).
  let need = 0;
  (await db.collection("cutoutInventory").get()).forEach((d) => {
    const x = d.data() as any;
    if (x.isActive === false || !(x.usableFor || ["phone"]).includes("phone")) return;
    if (x.kind === "precut" && Number(x.sheetsAvailable || 0) <= 0) return;
    need++;
  });
  const have = new Map<string, number>();
  (await db.collection("mockupCoverage").select("skus").get()).forEach((d) => have.set(d.id, ((d.get("skus") as string[]) || []).length));
  const coveredAt = Math.max(1, Math.floor(need * 0.9));

  const orders365 = new Map<string, number>(), orders90 = new Map<string, number>();
  (await db.collection("orders").select("createdAt", "items").get()).forEach((d) => {
    const o = d.data() as any;
    const t = o.createdAt && o.createdAt.toMillis ? o.createdAt.toMillis() : Number(o.createdAt || 0);
    if (!t || t < now - 365 * DAY) return;
    for (const it of (o.items || []) as any[]) {
      const id = it.phoneModel ? find(it.phoneBrand, it.phoneModel) : null;
      if (!id) continue;
      orders365.set(id, (orders365.get(id) || 0) + 1);
      if (t >= now - 90 * DAY) orders90.set(id, (orders90.get(id) || 0) + 1);
    }
  });

  const requests = new Map<string, number>();
  (await db.collection("modelRequests").get()).forEach((d) => {
    const x = d.data() as any;
    if (x.category && x.category !== "phone") return;
    const id = x.supportedModelId && models.has(x.supportedModelId) ? x.supportedModelId : find(x.brandName, x.modelName);
    if (id) requests.set(id, (requests.get(id) || 0) + 1);
  });

  const gsc = await searchByPage();

  const rows: Row[] = [];
  for (const m of models.values()) {
    const h = have.get(m.id) || 0;
    if (h >= coveredAt) continue;
    const o365 = orders365.get(m.id) || 0, o90 = orders90.get(m.id) || 0, req = requests.get(m.id) || 0;
    const newDays = m.createdAt ? Math.floor((now - m.createdAt) / DAY) : null;
    const major = MAJOR.has(norm(m.brand));
    const search = gsc.rows.get("/" + modelSlug(m.brand, m.model)) || { impressions: 0, clicks: 0 };
    // Search: a click is worth an order's weight; impressions in hundreds — a page shown 300 times a month is worth 3 points.
    let score = o365 * 5 + o90 * 5 + req * 4 + search.clicks * 5 + Math.round(search.impressions / 100);
    const reasons: string[] = [];
    if (o365) reasons.push(`${o365} order${o365 > 1 ? "s" : ""} in a year${o90 ? ` (${o90} in 90 days)` : ""}`);
    if (req) reasons.push(`${req} customer request${req > 1 ? "s" : ""}`);
    if (search.impressions || search.clicks) reasons.push(`Google: ${search.impressions} impressions, ${search.clicks} click${search.clicks === 1 ? "" : "s"} in 28 days`);
    if (newDays !== null && newDays <= 90 && major) { score += newDays <= 30 ? 6 : 3; reasons.push(`new on the site ${newDays} day${newDays === 1 ? "" : "s"} ago`); }
    if (h > 0 && h < coveredAt) reasons.push(`${h} of ${need} designs done`);
    if (score <= 0) continue;
    rows.push({ modelId: m.id, brand: m.brand, model: m.model, score, orders365: o365, orders90: o90, requests: req, newDays, impressions: search.impressions, clicks: search.clicks, have: h, reasons });
  }
  rows.sort((a, b) => b.score - a.score || a.brand.localeCompare(b.brand) || a.model.localeCompare(b.model));
  const top = rows.slice(0, 100);
  await db.collection("mockupTodo").doc("latest").set({
    rows: top, need, coveredAt, candidates: rows.length, computedAt: now,
    search: gsc.error ? { ok: false, error: gsc.error } : { ok: true, pages: gsc.rows.size },
  });
  return { rows: top.length, candidates: rows.length, need, coveredAt, search: gsc.error ? "unavailable: " + gsc.error : `${gsc.rows.size} pages` };
}

/** Nightly, after the day's orders and requests are in. */
export const mockupTodoNightly = functionsV1
  .runWith({ memory: "1GB", timeoutSeconds: 300 })
  .pubsub.schedule("15 2 * * *").timeZone("Asia/Kolkata")
  .onRun(async () => { await computeMockupTodo(admin.firestore()); return null; });

export const refreshMockupTodo = functionsV1
  .runWith({ memory: "1GB", timeoutSeconds: 300 })
  .https.onCall(async (_data: any, context: any) => {
    const { requireAdmin } = await import("./auth");
    await requireAdmin(context);
    return computeMockupTodo(admin.firestore());
  });
