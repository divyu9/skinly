import * as functionsV1 from "firebase-functions/v1";
import { HttpsError } from "firebase-functions/v1/https";
import * as admin from "firebase-admin";
import * as zlib from "zlib";
import { promisify } from "util";
import { requireAdmin } from "./auth";
import { putR2Object } from "./r2";

const gzip = promisify(zlib.gzip);

/**
 * A copy of the database, somewhere else, every day.
 *
 * There was none. This shop runs bulk operations by hand all the time — a
 * launch that rewrites hundreds of listings, a SKU repair across every laptop
 * product, a status backfill over every order — and if one of them went wrong
 * there was nothing to restore from. Firestore keeps no history of its own.
 *
 * The copy goes to R2, which this project already pays for and already has
 * working credentials for, as one gzipped JSON file per collection. That makes
 * it readable by anything: a bad row can be looked at in a text editor, and a
 * whole collection can be put back by reading the file and writing it in
 * batches. Firestore's own managed export is the more official answer and can
 * be added later; it needs an IAM grant this service account does not have,
 * and a backup that needs a permission nobody has granted is not a backup.
 */

/**
 * What is worth keeping.
 *
 * Everything that would be painful to lose, and nothing that regenerates
 * itself. Queues, logs and rate-limit counters are noise a day later and
 * would dominate the file; `mockups` and `designMockups` hold generated
 * images whose bytes live in R2 anyway.
 */
const COLLECTIONS = [
  // The catalogue, which is the expensive thing to rebuild
  "products", "variants", "collections", "collectionProducts", "phoneCollections",
  "supportedModels", "gadgetTypes", "finishTypes", "modelMetadata",
  // Money and people
  "orders", "users", "walletTransactions", "coupons", "cashbackRules",
  // Stock
  "rollInventory", "cutoutInventory", "gadgetConsumption", "variantConsumptionPresets",
  // Storefront arrangement, all of it hand-made
  "homepageSections", "homepageSectionCards", "heroSlides", "productSectionContent",
  "productCategoriesConfig", "categoryDisplaySettings", "trendingProductsConfig",
  "suggestedProductsConfig", "checkoutUpsells", "seoPages", "seoPageTemplates",
  // Settings and templates
  "settings", "codSettings", "emailUsecaseTemplates", "whatsappUsecases", "whatsappTemplates",
  // Customer-facing content
  "reviews", "ugcVideos", "stockNotifications", "abandonedCarts",
  // The studio's own definitions, not its output
  "gadgetMockupPrompts", "gadgetMockupSettings", "designLaunches",
];

/**
 * The day this run belongs to, in Indian time.
 *
 * UTC put the nightly 02:30 run — and a button pressed at one in the morning —
 * into the previous day's folder, so every backup was filed under the date
 * before the one anybody would call it. The bucket is read by a person looking
 * for "the copy from Tuesday".
 */
const dayKey = (d = new Date()) =>
  new Date(d.getTime() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);

interface CollectionResult {
  collection: string;
  docs: number;
  bytes: number;
  url?: string;
  error?: string;
}

/**
 * Writes one day's copy and returns what it managed to write.
 *
 * A collection that fails takes its own line in the result rather than the
 * whole run: nineteen collections safely copied and one that errored is a
 * far better outcome than nothing, and the one that failed is named.
 */
export async function runBackup(reason: string): Promise<{
  day: string;
  results: CollectionResult[];
  totalDocs: number;
  totalBytes: number;
  failed: string[];
}> {
  const db = admin.firestore();
  const day = dayKey();
  const results: CollectionResult[] = [];

  for (const name of COLLECTIONS) {
    try {
      const snap = await db.collection(name).get();
      // An empty collection still gets a file, so a day where something was
      // wiped is visible as a file full of nothing rather than a missing one.
      const rows = snap.docs.map((d) => ({ _id: d.id, ...d.data() }));
      const json = JSON.stringify(rows);
      const body = await gzip(Buffer.from(json, "utf8"));
      const url = await putR2Object(`backups/${day}/${name}.json.gz`, body, "application/gzip");
      results.push({ collection: name, docs: rows.length, bytes: body.byteLength, url });
    } catch (e: any) {
      console.error("backup: collection failed", { collection: name, error: e?.message || e });
      results.push({ collection: name, docs: 0, bytes: 0, error: String(e?.message || e) });
    }
  }

  const totalDocs = results.reduce((n, r) => n + r.docs, 0);
  const totalBytes = results.reduce((n, r) => n + r.bytes, 0);
  const failed = results.filter((r) => r.error).map((r) => r.collection);

  // A manifest beside the files, so restoring does not start with guesswork.
  const manifest = { day, at: Date.now(), reason, totalDocs, totalBytes, results };
  try {
    await putR2Object(
      `backups/${day}/manifest.json`,
      Buffer.from(JSON.stringify(manifest, null, 2), "utf8"),
      "application/json"
    );
  } catch (e: any) {
    console.error("backup: manifest failed", e?.message || e);
  }

  // And a row in Firestore, because the place you look when you are worried
  // is the admin, not a bucket listing.
  await db.collection("backups").doc(day).set({
    day, at: Date.now(), reason, totalDocs, totalBytes,
    collections: results.length,
    failed,
    ok: failed.length === 0,
    perCollection: results.map((r) => ({ c: r.collection, n: r.docs, ...(r.error ? { e: r.error } : {}) })),
  });

  console.log("backup", { day, reason, totalDocs, totalBytes, failed });
  return { day, results, totalDocs, totalBytes, failed };
}

/**
 * Every night, in the quiet hours.
 *
 * 21:00 UTC is 02:30 in Agra — after the day's orders and before anyone
 * starts editing.
 */
export const dailyBackup = functionsV1
  .runWith({ memory: "1GB", timeoutSeconds: 540 })
  .pubsub.schedule("0 21 * * *")
  .timeZone("UTC")
  .onRun(async () => {
    await runBackup("scheduled");
    return null;
  });

/** The same thing on demand, for the minute before a big bulk edit. */
export const runBackupNow = functionsV1
  .runWith({ memory: "1GB", timeoutSeconds: 540 })
  .https.onCall(async (_data: any, context: any) => {
    const { uid } = await requireAdmin(context);
    const out = await runBackup(`manual by ${uid}`);
    if (out.failed.length) {
      throw new HttpsError(
        "internal",
        `Copied ${out.totalDocs} documents, but these collections failed: ${out.failed.join(", ")}`
      );
    }
    return {
      success: true,
      day: out.day,
      totalDocs: out.totalDocs,
      sizeMb: Number((out.totalBytes / 1024 / 1024).toFixed(2)),
      message: `Backed up ${out.totalDocs.toLocaleString("en-IN")} documents across ${out.results.length} collections`,
    };
  });
