/**
 * Firestore, fetched when something needs it rather than with the first page.
 *
 * The SDK is the largest single piece of the script a phone downloads before
 * the site can draw. Reads that belong to the first page go through
 * firebase-hooks-store, which is loaded the same way; one-off reads in
 * storefront modules do `const { db, getDocs, … } = await loadFs()`.
 */
export const loadFs = () => import("./firestore-sdk");

type Fs = typeof import("./firestore-sdk");

/** `getDocs(build(fs))`, with Firestore fetched first. `build` receives the SDK's functions and `db`. */
export async function getDocsOf(build: (fs: Fs) => any): Promise<import("firebase/firestore").QuerySnapshot<any>> {
  const fs = await loadFs();
  return fs.getDocs(build(fs));
}
