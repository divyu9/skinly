/**
 * Turn the WhatsApp OTP at checkout on or off (settings/cartSaveOtp.checkoutRequired).
 * Takes effect at once: checkout and placeOrder both read this setting. The cart-page
 * "save my cart" OTP stays on either way.
 *
 *   node scripts/settings/checkout-otp.cjs off
 *   node scripts/settings/checkout-otp.cjs on
 */
const path = require("path");
const admin = require(path.join(__dirname, "..", "..", "functions", "node_modules", "firebase-admin"));
admin.initializeApp({ projectId: "skinly-3003b" });
const want = process.argv[2];
if (want !== "on" && want !== "off") { console.error("Usage: node scripts/settings/checkout-otp.cjs on|off"); process.exit(1); }
const ref = admin.firestore().doc("settings/cartSaveOtp");
ref.set({ checkoutRequired: want === "on", updatedAt: Date.now() }, { merge: true })
  .then(() => ref.get())
  .then((s) => { const d = s.data(); console.log(`Checkout OTP is now ${d.checkoutRequired ? "REQUIRED" : "OFF"} (cart-save OTP enabled: ${d.enabled})`); process.exit(0); })
  .catch((e) => { console.error("ERR", e.message); process.exit(1); });
