/**
 * One-off: write GA4's session source onto every paid order GA4 still has
 * (order.attribution.ga4), for orders placed before the checkout recorded its
 * own source. Same code as the daily job (functions/src/orderSources.ts).
 *
 *   npm --prefix functions run build && node scripts/backfill-order-sources.cjs
 *
 * Runs with your gcloud application-default login, which needs read access to
 * the GoSkinly GA4 property.
 */
const path = require("path");
const fn = path.join(__dirname, "..", "functions");
const admin = require(path.join(fn, "node_modules", "firebase-admin"));
admin.initializeApp({ projectId: "skinly-3003b" });
const { syncOrderSources } = require(path.join(fn, "lib", "orderSources.js"));

syncOrderSources(540)
  .then((r) => { console.log(JSON.stringify(r)); process.exit(0); })
  .catch((e) => { console.error("ERR", e?.response?.data?.error?.message || e?.message || e); process.exit(1); });
