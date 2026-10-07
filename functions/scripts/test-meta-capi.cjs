/**
 * Checks the Conversions API payload against what Meta requires and what the
 * browser sends, without calling Meta. Run after building:
 *
 *   npm --prefix functions run build && node functions/scripts/test-meta-capi.cjs
 */
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const path = require("node:path");
const capi = require(path.join(__dirname, "..", "lib", "metaCapi.js"));

const sha = (v) => crypto.createHash("sha256").update(v).digest("hex");
let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log(`ok - ${name}`); };

const order = {
  orderNumber: 4102, total: 369, amountPayable: 369, paymentMethod: "phonepe", ownerUid: "uid123",
  email: "  Priya.Sharma@Example.COM ", createdAt: Date.now() - 60_000,
  shippingAddress: { fullName: "Priya  Sharma", phone: "+91 98765-43210", city: "New Delhi", state: "Uttar Pradesh", pincode: "110 001" },
  items: [{ productId: "p1", price: 299, quantity: 1 }, { sku: "R-39", price: 35, quantity: 2 }],
  tracking: { fbp: "fb.1.1700000000000.123", fbc: "fb.1.1700000000000.abc", clientIp: "203.0.113.7", userAgent: "UA/1.0",
    initiateCheckoutEventId: "ic-ck-x", addPaymentInfoEventId: "api-ck-x", initiateCheckoutAt: Date.now() - 300_000 },
};

test("purchase event_id matches the browser (purchase-<order number>)", () => {
  assert.equal(capi.purchaseEventId(order), "purchase-4102");
});

test("purchase value is order.total, as trackPurchaseOnce sends", () => {
  assert.equal(capi.purchaseValue(order), 369);
  assert.equal(capi.purchaseValue({ amountPayable: 199.5 }), 199.5);
});

test("Purchase payload: required fields, hashed PII, raw match keys", () => {
  const e = capi.buildPurchaseEvent("ord1", order);
  assert.equal(e.event_name, "Purchase");
  assert.equal(e.action_source, "website");
  assert.equal(e.event_id, "purchase-4102");
  assert.equal(e.event_source_url, "https://goskinly.com/orders/ord1");
  assert.ok(Math.abs(e.event_time - Date.now() / 1000) < 5);
  assert.equal(e.custom_data.currency, "INR");
  assert.equal(e.custom_data.value, 369);
  assert.deepEqual(e.custom_data.content_ids, ["p1", "R-39"]);
  assert.equal(e.custom_data.content_type, "product");
  assert.equal(e.custom_data.num_items, 3);
  const u = e.user_data;
  assert.deepEqual(u.em, [sha("priya.sharma@example.com")]);
  assert.deepEqual(u.ph, [sha("919876543210")]);
  assert.deepEqual(u.fn, [sha("priya")]);
  assert.deepEqual(u.ln, [sha("sharma")]);
  assert.deepEqual(u.ct, [sha("newdelhi")]);
  assert.deepEqual(u.st, [sha("uttarpradesh")]);
  assert.deepEqual(u.zp, [sha("110001")]);
  assert.deepEqual(u.country, [sha("in")]);
  assert.deepEqual(u.external_id, [sha("uid123")]);
  assert.equal(u.client_ip_address, "203.0.113.7");
  assert.equal(u.client_user_agent, "UA/1.0");
  assert.equal(u.fbp, order.tracking.fbp);
  assert.equal(u.fbc, order.tracking.fbc);
});

test("missing customer fields are left out, not sent empty", () => {
  const u = capi.buildPurchaseEvent("o", { orderNumber: 1, total: 1, items: [] }).user_data;
  assert.deepEqual(Object.keys(u).sort(), ["country"]);
});

test("cleanTracking keeps known fields, takes IP/UA from the request, refuses foreign source URLs", () => {
  const t = capi.cleanTracking(
    { fbp: "fb.1.1.2", fbc: "fb.1.3.x", utm: { source: "ig", medium: "paid", evil: "x" }, initiateCheckoutEventId: "ic-1",
      eventSourceUrl: "https://evil.example/checkout", junk: { a: 1 } },
    { headers: { "x-forwarded-for": "198.51.100.2, 10.0.0.1", "user-agent": "Mozilla/5.0" } },
  );
  assert.equal(t.clientIp, "198.51.100.2");
  assert.equal(t.userAgent, "Mozilla/5.0");
  assert.deepEqual(t.utm, { source: "ig", medium: "paid" });
  assert.equal(t.eventSourceUrl, undefined);
  assert.equal(t.junk, undefined);
  const ok = capi.cleanTracking({ eventSourceUrl: "https://goskinly.com/checkout" }, {});
  assert.equal(ok.eventSourceUrl, "https://goskinly.com/checkout");
});

test("nothing is sent without META_CAPI_TOKEN", async () => {
  delete process.env.META_CAPI_TOKEN;
  assert.equal(capi.capiEnabled(), false);
});

test("META_CAPI_ENABLED=false is a kill switch", () => {
  process.env.META_CAPI_TOKEN = "x";
  process.env.META_CAPI_ENABLED = "false";
  assert.equal(capi.capiEnabled(), false);
  delete process.env.META_CAPI_ENABLED;
  assert.equal(capi.capiEnabled(), true);
  delete process.env.META_CAPI_TOKEN;
});

(async () => {
  const r = await capi.sendCapiEvents([{ event_name: "Purchase" }]);
  assert.equal(r.ok, false);
  assert.match(r.error, /disabled/);
  passed++; console.log("ok - sendCapiEvents does not call Meta when disabled");

  const { shippingFor, shippingRule, SHIPPING_DEFAULTS } = await import(path.join(__dirname, "..", "..", "src", "lib", "shipping-config.mjs"));
  assert.equal(shippingFor(299, { flatShippingFee: 70, freeShippingThreshold: 500 }), 70);
  assert.equal(shippingFor(499, { flatShippingFee: 70, freeShippingThreshold: 500 }), 70);
  assert.equal(shippingFor(500, { flatShippingFee: 70, freeShippingThreshold: 500 }), 0);
  assert.equal(shippingFor(299, null), SHIPPING_DEFAULTS.flatShippingFee);
  assert.deepEqual(shippingRule({ flatShippingFee: 0, freeShippingThreshold: 0 }), { fee: 0, threshold: 0 });
  passed++; console.log("ok - shipping rule: ₹70 below ₹500, free from ₹500 (live settings/shipping), defaults when unset");

  const { homeMeta, catalogueClaims } = await import(path.join(__dirname, "..", "..", "src", "lib", "category-paths.mjs"));
  const m = homeMeta({ models: 5765, brands: 87, designs: 363 });
  assert.match(m.description, /5,700\+ models across 87 brands/);
  assert.match(m.title, /5,700\+ Models/);
  assert.deepEqual(catalogueClaims(null).models, 3600);
  passed++; console.log("ok - homepage meta uses the catalogue counts");

  console.log(`\n${passed} passed`);
})().catch((e) => { console.error(e); process.exit(1); });
