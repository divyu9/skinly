import * as functionsV1 from "firebase-functions/v1";
import * as admin from "firebase-admin";
import * as crypto from "crypto";
import * as zlib from "zlib";
import { parseMobicare, parseTia, ModelIndex, siteCategory, groupOf, VendorModel } from "./pltMatch";

/**
 * The cutting files, as the Windows PC sees them.
 *
 * Every model the shop can actually cut has a PLT file on the plotter PC, in
 * the cutting software's own folder. The website's model list was kept by
 * hand beside it, so the two drift: a model gets a cut file and never reaches
 * the picker, or the picker offers a model nobody can cut.
 *
 * tools/plt-sync/plt-sync.ps1 runs on that PC once a day and posts the list of
 * files here — path, size, modified time, one line each, gzipped. It does
 * nothing else, so the rules that turn "Samsung/S24 Ultra - Back B1.plt" into
 * one model live on the server and change without touching the PC.
 *
 * Kept in Firestore, which only the server reads (no rule opens pltSync), not
 * in R2, whose bucket is public.
 */

const CHUNK_CHARS = 700_000;
const MAX_FILES = 300_000;

function keyOk(given: unknown): boolean {
  const want = process.env.PLT_SYNC_KEY || "";
  if (!want || typeof given !== "string") return false;
  const a = Buffer.from(want);
  const b = Buffer.from(given);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

type Vendor = "mobicare" | "tia";

/*
 * What a day's upload adds to Admin › Models › From plotter.
 *
 * A model is new when the vendor's earliest file for it is later than the
 * newest file seen in the previous upload (the watermark), or, for TIA
 * models with no template files to date them, when its id is past the last
 * id seen. The first watermarks are the libraries read by hand on 25 Sep
 * 2026, so the first upload brings only what the vendors added since.
 *
 * A new model the website already lists is skipped; one already in the admin
 * list (pending, approved or rejected — a rejection sticks) gets this vendor
 * recorded on its row; anything else becomes a pending row, with the other
 * vendor on it too if its last upload had the same model.
 */
const CHUNK = 500_000;
async function saveIndex(db: admin.firestore.Firestore, vendor: Vendor, models: VendorModel[]) {
  const body = JSON.stringify(models.map((m) => [m.gadget, m.brand, m.model, m.firstAt]));
  const ref = db.collection("pltSync").doc(`index_${vendor}`);
  const old = await ref.collection("chunks").get();
  for (const d of old.docs) await d.ref.delete();
  for (let i = 0, n = 0; i < body.length; i += CHUNK, n++) await ref.collection("chunks").doc(String(n).padStart(4, "0")).set({ text: body.slice(i, i + CHUNK) });
  await ref.set({ at: Date.now(), models: models.length });
}
async function loadIndex(db: admin.firestore.Firestore, vendor: Vendor): Promise<Array<[string, string, string, number]>> {
  const snap = await db.collection("pltSync").doc(`index_${vendor}`).collection("chunks").get();
  if (snap.empty) return [];
  try { return JSON.parse(snap.docs.map((d) => String(d.data().text || "")).join("")); } catch { return []; }
}

export async function processUpload(
  db: admin.firestore.Firestore, vendor: Vendor, lines: string[],
  opts: { dryRun?: boolean; watermark?: number; maxTiaId?: number } = {}
) {
  const models = vendor === "mobicare" ? parseMobicare(lines) : parseTia(lines);
  const stateRef = db.collection("pltSync").doc("state");
  const state = ((await stateRef.get()).data() || {}) as any;
  const mark = state[vendor] || {};
  const watermark = opts.watermark ?? (Number(mark.watermark) || 0);
  const maxTiaId = opts.maxTiaId ?? (Number(mark.maxTiaId) || 0);
  const isNew = (m: VendorModel) => m.firstAt ? m.firstAt > watermark : vendor === "tia" && (m.tiaId || 0) > maxTiaId;

  // The site, as the matcher sees it, and how it spells each brand.
  const site = new ModelIndex();
  const siteBrands = new Map<string, string>();
  const byGroup = new Map<string, Map<string, number>>();
  const sm = await db.collection("supportedModels").get();
  for (const d of sm.docs) {
    const x = d.data() as any;
    if (x.isActive === false || x.mergedInto || !x.brandName || !x.modelName) continue;
    site.add(String(x.category || ""), x.brandName, ModelIndex.fullName(x.brandName, x.modelName));
    siteBrands.set(String(x.brandName).toLowerCase().replace(/\s/g, ""), x.brandName);
    const g = groupOf(x.brandName), c = byGroup.get(g) || new Map();
    c.set(x.brandName, (c.get(x.brandName) || 0) + 1); byGroup.set(g, c);
  }
  const brandFor = (m: VendorModel) => {
    const first = m.model.toLowerCase();
    for (const [w, n] of [["honor", "Honor"], ["poco", "Poco"], ["iqoo", "iQOO"], ["cmf", "CMF"], ["ai+", "AI+"]]) {
      if (first.startsWith(w)) return siteBrands.get(n.toLowerCase()) || n;
    }
    const own = siteBrands.get(m.brand.toLowerCase().replace(/\s/g, ""));
    if (own) return own;
    const common = [...(byGroup.get(m.group)?.entries() || [])].sort((a, b) => b[1] - a[1])[0];
    if (common) return common[0];
    return m.brand === m.brand.toUpperCase() || m.brand === m.brand.toLowerCase()
      ? m.brand.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) : m.brand;
  };

  // The admin list, so nothing is offered twice and rejections stick.
  const rowsIdx = new ModelIndex();
  const rowByName = new Map<string, admin.firestore.QueryDocumentSnapshot>();
  const rows = await db.collection("plotterModels").get();
  for (const d of rows.docs) {
    const x = d.data() as any;
    const full = ModelIndex.fullName(x.brand, x.approvedAs?.modelName || x.model);
    rowsIdx.add(String(x.approvedAs?.category || x.category || ""), x.brand, full);
    rowByName.set(full, d);
  }

  // The other vendor's last upload.
  const other: Vendor = vendor === "mobicare" ? "tia" : "mobicare";
  const otherIdx = new ModelIndex();
  const otherByName = new Map<string, { model: string; firstAt: number }>();
  for (const [g, b, model, firstAt] of await loadIndex(db, other)) {
    const full = ModelIndex.fullName(b, model);
    otherIdx.add(siteCategory(g as any, model), b, full);
    otherByName.set(full, { model: `${b} ${model}`, firstAt });
  }

  const out = { vendor, models: models.length, newModels: 0, onSite: 0, added: 0, updated: 0, names: [] as string[] };
  for (const m of models.filter(isNew)) {
    out.newModels++;
    if (site.find(m).status === "yes") { out.onSite++; continue; }
    const vendorEntry = { name: vendor === "tia" ? `${m.brand} ${m.model}` : m.model, firstAt: m.firstAt || null };
    const hit = rowsIdx.find(m);
    if (hit.status === "yes") {
      const row = rowByName.get(hit.name);
      if (row && !(row.data() as any).vendors?.[vendor]) {
        if (!opts.dryRun) await row.ref.update({ [`vendors.${vendor}`]: vendorEntry });
        out.updated++;
      }
      continue;
    }
    const vendors: Record<string, unknown> = { [vendor]: vendorEntry };
    const o = otherIdx.find(m);
    if (o.status === "yes") {
      const e = otherByName.get(o.name);
      if (e) vendors[other] = { name: e.model, firstAt: e.firstAt || null };
    }
    const id = `${vendor === "tia" ? "t" : "p"}_${crypto.createHash("sha1").update(`${m.gadget}|${m.group}|${m.key}`).digest("hex").slice(0, 20)}`;
    const ref = db.collection("plotterModels").doc(id);
    if ((await ref.get()).exists) continue;
    // iQOO, Poco, Honor and CMF are brands of their own on the site, and their
    // models are named without the brand ("Poco | X8 Power", not "Poco | Poco X8 Power").
    const brand = brandFor(m);
    const model = /^(iqoo|poco|honor|cmf)$/i.test(brand) ? m.model.replace(new RegExp(`^${brand}\\s+`, "i"), "").trim() || m.model : m.model;
    if (!opts.dryRun) await ref.set({
      brand, model, category: siteCategory(m.gadget, m.model),
      parts: m.parts.slice(0, 60), folders: m.folders, firstFileAt: m.firstAt || null, newestFileAt: m.firstAt || null,
      status: "pending", source: `sync-${vendor}`, createdAt: Date.now(), vendors,
    });
    rowsIdx.add(siteCategory(m.gadget, m.model), brand, ModelIndex.fullName(brand, model));
    out.added++;
    if (out.names.length < 30) out.names.push(`${brand} | ${model}`);
  }

  if (opts.dryRun) return out;
  await saveIndex(db, vendor, models);
  const newest = Math.max(watermark, ...models.map((m) => m.firstAt || 0));
  const topId = Math.max(maxTiaId, ...models.map((m) => m.tiaId || 0));
  await stateRef.set({ [vendor]: { watermark: newest, ...(vendor === "tia" ? { maxTiaId: topId } : {}), at: Date.now() } }, { merge: true });
  return out;
}

export const pltInventoryUpload = functionsV1
  .runWith({ memory: "1GB", timeoutSeconds: 300 })
  .https.onRequest(async (req, res) => {
    if (req.method !== "POST") { res.status(405).send("POST only"); return; }
    if (!keyOk(req.get("x-plt-key"))) { res.status(401).send("bad key"); return; }

    let text: string;
    try {
      const raw: Buffer = (req as any).rawBody || Buffer.alloc(0);
      const gz = raw.length > 2 && raw[0] === 0x1f && raw[1] === 0x8b;
      text = (gz ? zlib.gunzipSync(raw) : raw).toString("utf8").replace(/^﻿/, "");
    } catch {
      res.status(400).send("could not read the body");
      return;
    }

    // One file per line: relative path <TAB> bytes <TAB> modified (unix seconds).
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length > MAX_FILES) { res.status(413).send("too many files"); return; }
    const machine = String(req.get("x-plt-machine") || "").slice(0, 80);
    const vendor: Vendor = req.get("x-plt-vendor") === "tia" ? "tia" : "mobicare";
    let root = String(req.get("x-plt-root") || "");
    try { root = decodeURIComponent(root); } catch { /* sent plain */ }
    root = root.slice(0, 300);

    const db = admin.firestore();
    const now = Date.now();
    const runId = `${vendor}-${new Date(now).toISOString().replace(/[:.]/g, "-")}`;
    const runRef = db.collection("pltSync").doc(runId);

    const body = lines.join("\n");
    const chunks: string[] = [];
    for (let i = 0; i < body.length; i += CHUNK_CHARS) chunks.push(body.slice(i, i + CHUNK_CHARS));
    for (const [i, c] of chunks.entries()) {
      await runRef.collection("chunks").doc(String(i).padStart(4, "0")).set({ text: c });
    }

    const byExt: Record<string, number> = {};
    for (const l of lines) {
      const ext = (/\.([A-Za-z0-9]{1,6})(?:\t|$)/.exec(l.split("\t")[0])?.[1] || "none").toLowerCase();
      byExt[ext] = (byExt[ext] || 0) + 1;
    }
    let result: Awaited<ReturnType<typeof processUpload>> | { error: string };
    try {
      result = await processUpload(db, vendor, lines);
    } catch (e: any) {
      console.error("processUpload failed", vendor, e);
      result = { error: String(e?.message || e) };
    }
    const summary = { runId, vendor, receivedAt: now, machine, root, fileCount: lines.length, chunks: chunks.length, byExt, result };
    await runRef.set(summary);
    await db.collection("pltSync").doc(`latest_${vendor}`).set(summary);

    console.log("pltInventoryUpload", { vendor, machine, files: lines.length, result });
    res.json({ ok: true, vendor, files: lines.length, result });
  });
