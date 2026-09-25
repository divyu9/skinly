import * as functionsV1 from "firebase-functions/v1";
import * as admin from "firebase-admin";

/**
 * A product's gadget is two fields that must name the same thing:
 * gadgetTypeId (the shop's gadget filter, and what the admin product form
 * shows) and gadgetCategory (the name — "fits your device", breadcrumbs, SEO
 * pages). The edit form only ever wrote the id and the old new-product form
 * had a separate dropdown for each, so they drifted: 110 skins had an id and
 * no name and dropped out of "fits your device", and a phone skin set to
 * Phone in the form still read "accessory".
 *
 * Whatever writes a product, the name now follows the id. A skin with a name
 * and no id gets the id too (a non-skin's stray name is not trusted into a
 * filter: see src/lib/classification.ts).
 */
export const syncProductGadget = functionsV1.firestore
  .document("products/{productId}")
  .onWrite(async (change) => {
    if (!change.after.exists) return null;
    const after = change.after.data() as any;
    const before = change.before.exists ? (change.before.data() as any) : null;
    if (before && before.gadgetTypeId === after.gadgetTypeId && before.gadgetCategory === after.gadgetCategory) return null;

    const db = admin.firestore();
    if (after.gadgetTypeId) {
      const gt = await db.collection("gadgetTypes").doc(String(after.gadgetTypeId)).get();
      const name = gt.exists ? String((gt.data() as any).name || "") : "";
      if (name && after.gadgetCategory !== name) {
        await change.after.ref.update({ gadgetCategory: name });
        console.log(`product ${change.after.id}: gadgetCategory ${after.gadgetCategory || "(none)"} -> ${name}`);
      }
    } else if (after.gadgetCategory && after.productCategory === "skin") {
      const gt = await db.collection("gadgetTypes").where("name", "==", String(after.gadgetCategory)).limit(1).get();
      if (!gt.empty) await change.after.ref.update({ gadgetTypeId: gt.docs[0].id });
    }
    return null;
  });
