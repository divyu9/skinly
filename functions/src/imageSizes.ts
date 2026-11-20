import * as functionsV1 from "firebase-functions/v1";
import * as admin from "firebase-admin";
import { createHash } from "crypto";
import { GetObjectCommand, PutObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { pipelineS3, cacheControlFor } from "./r2";

/*
 * Every picture the site shows, in ready-made sizes.
 *
 * Cloudflare's per-request resizing allows 5,000 distinct pictures a month for
 * free; with ~180,000 mockups it ran out (error 9422) and every picture took a
 * redirect to its full-size original. Paid it would have been ₹3–6k a month
 * with no ceiling (Nov 2026). So each picture in R2 gets WebP copies at
 * sized/<width>/<key>, made once, and the storefront asks for those
 * (src/lib/image-cdn.ts; a copy not made yet falls back to the original).
 *
 * The widths cover what the site asks for (120px thumbnails up to 1600px
 * banners): each request is served by the first size at or above it. Mockups
 * are 1100px and never shown wider than 960, so they skip 1600.
 *
 * How a picture gets its sizes, whichever way it arrives:
 *  - written by a function (putR2Object): made right there;
 *  - uploaded from the browser to a presigned URL (generateUploadUrl) or copied
 *    (copyR2Object): queued, and processSizedQueue makes them within minutes;
 *  - a mockup doc written (bulk_upload.cjs, the admin): onMockupSized;
 *  - anything else, or a picture redone in place: sweepSizedImages, nightly,
 *    compares every original with its copies.
 * scripts/mockups/make_sized.cjs made them once for everything already there.
 * These rules are repeated there and in image-cdn.ts: keep the three alike.
 */

export const SIZES = [240, 480, 720, 960, 1600];
// Folders the site never shows: Meesho listing photos (35k), design working files, backups.
const SKIP = /^(sized|backups|resources|ai-mockups-pending|whatsapp|meesho|design-raw|design-pieces|mockup-templates|shot-references|packing)\//;

/** A picture the site may show: an image file outside the internal folders. */
export const isSizable = (key: string) => /\.(webp|png|jpe?g|avif)$/i.test(key) && !SKIP.test(key);
export const widthsFor = (key: string) => (key.startsWith("mockups/") ? SIZES.slice(0, 4) : SIZES);
export const sizedKey = (width: number, key: string) => `sized/${width}/${key}`;

/** Writes the sizes from bytes already in hand. */
export async function makeSizedFrom(key: string, original: Buffer): Promise<void> {
  const { s3, config } = pipelineS3();
  const sharp = (await import("sharp")).default;
  for (const width of widthsFor(key)) {
    const body = await sharp(original, { failOn: "none" }).rotate()
      .resize({ width, withoutEnlargement: true }).webp({ quality: 75 }).toBuffer();
    await s3.send(new PutObjectCommand({
      Bucket: config.bucketName, Key: sizedKey(width, key), Body: body, ContentType: "image/webp",
      CacheControl: cacheControlFor(key),
    }));
  }
}

/** Reads the original from R2 and writes its sizes. */
export async function makeSizedCopies(key: string): Promise<void> {
  const { s3, config } = pipelineS3();
  const obj = await s3.send(new GetObjectCommand({ Bucket: config.bucketName, Key: key }));
  await makeSizedFrom(key, Buffer.from(await (obj.Body as any).transformToByteArray()));
}

const queue = () => admin.firestore().collection("sizedQueue");
const idOf = (key: string) => createHash("sha1").update(key).digest("hex");

/** Remember a key whose bytes this function never saw; processSizedQueue makes its sizes. */
export async function enqueueSized(key: string, error?: string): Promise<void> {
  await queue().doc(idOf(key)).set({ key, at: Date.now(), ...(error ? { error } : {}) }, { merge: true });
}

const missing = (e: any) => e?.name === "NoSuchKey" || e?.$metadata?.httpStatusCode === 404;

/** Every 5 minutes: the queued uploads. An upload that never arrived is dropped after a day. */
export const processSizedQueue = functionsV1
  .runWith({ memory: "1GB", timeoutSeconds: 300 })
  .pubsub.schedule("every 5 minutes")
  .onRun(async () => {
    // Give the browser a moment to finish the upload it was signed for.
    const snap = await queue().where("at", "<=", Date.now() - 20_000).orderBy("at").limit(120).get();
    let made = 0, waiting = 0, dropped = 0, failed = 0;
    for (const d of snap.docs) {
      const { key, at } = d.data() as { key: string; at: number };
      try {
        await makeSizedCopies(key);
        await d.ref.delete();
        made++;
      } catch (e: any) {
        if (missing(e) && Date.now() - at < 86_400_000) { waiting++; continue; }
        if (missing(e)) { await d.ref.delete(); dropped++; continue; }
        await d.ref.set({ error: String(e?.message || e), tries: admin.firestore.FieldValue.increment(1) }, { merge: true });
        failed++;
      }
    }
    if (snap.size) console.log(`sizedQueue: ${made} made, ${waiting} waiting, ${dropped} dropped, ${failed} failed`);
    return null;
  });

/** Nightly: any picture without its sizes, or redone since they were made. */
export const sweepSizedImages = functionsV1
  .runWith({ memory: "2GB", timeoutSeconds: 540 })
  .pubsub.schedule("30 3 * * *").timeZone("Asia/Kolkata")
  .onRun(async () => {
    const t0 = Date.now();
    const { s3, config } = pipelineS3();
    const list = async (prefix: string) => {
      const out = new Map<string, number>();
      let token: string | undefined;
      do {
        const r = await s3.send(new ListObjectsV2Command({ Bucket: config.bucketName, Prefix: prefix, ContinuationToken: token }));
        for (const o of r.Contents || []) if (o.Key) out.set(o.Key, o.LastModified ? o.LastModified.getTime() : 0);
        token = r.IsTruncated ? r.NextContinuationToken : undefined;
      } while (token);
      return out;
    };
    const all = await list("");
    const todo: string[] = [];
    for (const [key, mod] of all) {
      if (!isSizable(key)) continue;
      if (widthsFor(key).some((w) => { const t = all.get(sizedKey(w, key)); return t === undefined || t < mod; })) todo.push(key);
    }
    let made = 0, failed = 0, next = 0;
    // Stop with a minute in hand; what is left is done tomorrow night.
    const worker = async () => {
      while (next < todo.length && Date.now() - t0 < 480_000) {
        const key = todo[next++];
        try { await makeSizedCopies(key); made++; } catch (e: any) { failed++; console.error(`sized ${key}: ${e?.message || e}`); }
      }
    };
    await Promise.all(Array.from({ length: 6 }, worker));
    console.log(`sweepSizedImages: ${todo.length} needed sizes, ${made} made, ${failed} failed, ${todo.length - made - failed} left for tomorrow`);
    return null;
  });
