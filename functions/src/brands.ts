import * as functionsV1 from "firebase-functions/v1";
import { HttpsError } from "firebase-functions/v1/https";
import * as admin from "firebase-admin";
import { requireAdmin } from "./auth";

/**
 * Renaming a brand, or merging several into one (Admin › Models › Brands).
 *
 * A brand's name is written in more places than its models. The shop finds a
 * model's mockups by brand and model name (mockups.brand), and a listing's
 * brand scope is a list of names (products.modelBrands / modelBrandsExclude).
 * The browser only renamed supportedModels, so after "Oneplus" became
 * "OnePlus" its phones lost their mockups and fell out of their listings.
 * Everything moves together here, in batches no browser could sustain (a
 * large brand has tens of thousands of mockups).
 */

async function commitInBatches(db: admin.firestore.Firestore, refs: admin.firestore.DocumentReference[], patch: (ref: admin.firestore.DocumentReference) => Record<string, any>) {
  for (let i = 0; i < refs.length; i += 400) {
    const batch = db.batch();
    refs.slice(i, i + 400).forEach((r) => batch.update(r, patch(r)));
    await batch.commit();
  }
}

export const renameBrands = functionsV1
  .runWith({ timeoutSeconds: 540, memory: "1GB" })
  .https.onCall(async (data: any, context: any) => {
    await requireAdmin(context);
    const to = String(data?.to || "").replace(/\s+/g, " ").trim();
    const from: string[] = (Array.isArray(data?.from) ? data.from : [data?.from]).map((s: any) => String(s || "")).filter((s: string) => s && s !== to);
    if (!to || !from.length) throw new HttpsError("invalid-argument", "Name the brand(s) to rename and the new name");
    const db = admin.firestore();
    const out = { models: 0, mockups: 0, listings: 0 };

    for (const name of from) {
      const models = await db.collection("supportedModels").where("brandName", "==", name).select().get();
      await commitInBatches(db, models.docs.map((d) => d.ref), () => ({ brandName: to }));
      out.models += models.size;

      const mockups = await db.collection("mockups").where("brand", "==", name).select().get();
      await commitInBatches(db, mockups.docs.map((d) => d.ref), () => ({ brand: to }));
      out.mockups += mockups.size;

      // Listing scopes: swap the name inside the arrays, keeping the rest.
      for (const field of ["modelBrands", "modelBrandsExclude"]) {
        const listings = await db.collection("products").where(field, "array-contains", name).get();
        for (const d of listings.docs) {
          const arr: string[] = (d.data() as any)[field] || [];
          await d.ref.update({ [field]: [...new Set(arr.map((b) => (b === name ? to : b)))], updatedAt: Date.now() });
        }
        out.listings += listings.size;
      }
    }
    console.log("renameBrands", { from, to, ...out });
    return out;
  });
