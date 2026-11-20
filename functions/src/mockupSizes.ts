import * as functionsV1 from "firebase-functions/v1";
import { makeSizedCopies, enqueueSized } from "./imageSizes";

/**
 * A mockup written or redone: make its sizes now (imageSizes.ts).
 *
 * scripts/mockups/bulk_upload.cjs writes to R2 directly, past every function,
 * but it always ends in a `mockups` doc, as the admin's uploads do; so this
 * trigger has the new mockup on the site in its small sizes within seconds
 * rather than at the nightly sweep. An alias row reuses another model's file,
 * whose sizes exist already. A picture redone in place keeps its key, so a
 * newer updatedAt also remakes them.
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
      // The site shows the original meanwhile; the queue tries again.
      await enqueueSized(key, String(e?.message || e)).catch(() => undefined);
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
