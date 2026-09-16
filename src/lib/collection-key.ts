/**
 * "Cars & Bikes" and "cars-bikes" name the same collection.
 *
 * Collections travel under two spellings: the display name, which is what the
 * chips on /products put in the URL, and the slug, which is what the sitemap
 * and every link built from it uses. Compare them through this and both forms
 * land on the same record.
 */
export function collectionKey(value: unknown): string {
  return typeof value === "string"
    ? value
        .toLowerCase()
        .replace(/&/g, " ")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
    : "";
}
