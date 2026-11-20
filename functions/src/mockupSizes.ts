import * as functionsV1 from "firebase-functions/v1";
import { makeSizedCopies } from "./r2";

/**
 * A mockup written or redone: make its 480 and 960 copies (r2.ts
 * makeSizedCopies), which is what the storefront shows.
 *
 * Every way a mockup arrives ends in a `mockups` doc (the admin uploads,
 * scripts/mockups/bulk_upload.cjs), so this one trigger covers them all. An
 * alias row reuses another model's file, whose copies already exist. A picture
 * redone in place keeps its key, so a newer updatedAt also remakes the copies.
 */
export const onMockupSized = functionsV1
  .runWith({ memory: "1GB", timeoutSeconds: 120 })
  .firestore.document("mockups/{id}")
  .onWrite(async (change) => {
    const after = change.after.exists ? (change.after.data() as any) : null;
    if (!after || after.aliasOf) return null;
    const key = keyOf(after);
    if (!key || !key.startsWith("mockups/")) return null;
    const before = change.before.exists ? (change.before.data() as any) : null;
    if (before && keyOf(before) === key && before.updatedAt === after.updatedAt) return null;
    try {
      await makeSizedCopies(key);
    } catch (e: any) {
      // The site falls back to the original; the backfill script fills gaps.
      console.error(`sized copies failed for ${key}: ${e?.message || e}`);
    }
    return null;
  });

/** The object key: r2Key when stored, else read from the public URL. */
function keyOf(d: any): string | null {
  if (typeof d.r2Key === "string" && d.r2Key) return d.r2Key;
  const url = String(d.cloudinaryUrl || d.r2Url || "");
  const m = url.match(/^https:\/\/(?:cdn\.goskinly\.com|pub-[a-z0-9]+\.r2\.dev)\/(mockups\/.+)$/);
  if (!m) return null;
  try { return decodeURIComponent(m[1]); } catch { return null; }
}
