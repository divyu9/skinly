# WhatsApp templates to create in Authkey

Each template below matches a trigger that already exists in the code. Create
it in Authkey (console.authkey.io → WhatsApp → Templates → Create), wait for
approval, then send the **template ID** (the number in the URL, like 20862) to
be wired up — or add it yourself in Admin › WhatsApp and switch the usecase on.

The variables must be in exactly this order: `{{1}}` is the first variable
listed, `{{2}}` the second, and so on. Sample values are what Authkey asks for.

Rules Meta enforces: a body cannot start or end with a variable, and two
variables cannot sit side by side. Utility templates must not advertise.

---

## 1. `skinly_order_dispatched` — Utility
Usecase: **order_dispatched** · Variables: `first_name, order_number, courier_name, awb_number, tracking_url`

```
Hi {{1}}, your GoSkinly order {{2}} has been shipped! 🚚

Courier: {{3}}
AWB: {{4}}
Track it here: {{5}}

Before it arrives, see how to apply your skin: https://goskinly.com/how-to-apply
```
Samples: Priya · #4102 · Delhivery · 38291045561 · https://www.delhivery.com/track-v2/package/38291045561

## 2. `skinly_out_for_delivery` — Utility
Usecase: **out_for_delivery** · Variables: `first_name, order_number, cod_line`

```
Hi {{1}}, your GoSkinly order {{2}} is out for delivery today 📦

{{3}}

Please keep your phone reachable for the delivery partner.
```
Samples: Priya · #4102 · Please keep ₹527 ready — it's Cash on Delivery.

## 3. `skinly_order_delivered` — Utility
Usecase: **order_delivered** · Variables: `first_name, order_number, review_link`

```
Hi {{1}}, your GoSkinly order {{2}} has been delivered 🎉

Apply it perfectly with our guide: https://goskinly.com/how-to-apply

Loved it? Rate it here and get up to 10% back in your Skinly wallet: {{3}}
```
Samples: Priya · #4102 · https://goskinly.com/review/abc123?t=xyz

## 4. `skinly_order_cancelled` — Utility
Usecase: **order_cancelled** · Variables: `first_name, order_number, refund_line`

```
Hi {{1}}, your GoSkinly order {{2}} has been cancelled.

{{3}}

If this wasn't expected, just reply to this message and we'll help.
```
Samples: Priya · #4102 · Your payment will be refunded to the original payment method.

## 5. `skinly_payment_failed` — Utility
Usecase: **payment_failed** (exists, needs a template) · Variables: `customer_name, order_number, order_amount, pay_link`

```
Hi {{1}}, the payment for your GoSkinly order {{2}} ({{3}}) didn't go through.

Your items are saved. Complete the payment here: {{4}}
```
Samples: Priya · 4102 · ₹527 · https://goskinly.com/pay/abc123?t=xyz

## 6. `skinly_review_request` — Utility
Usecase: **review_request** (exists — was wired to the model-request template by mistake, now switched off) · Variables: `customer_name, order_number, review_link`

```
Hi {{1}}, how is your new Skinly from order {{2}}? 😊

Tap to rate it — add a photo and get up to 10% back in your Skinly wallet: {{3}}
```
Samples: Priya · 4102 · https://goskinly.com/review/abc123?t=xyz

## 7. `skinly_abandoned_cart` — Marketing
Usecase: **abandoned_cart** (first reminder only) · Variables: `customer_name, product_name, cart_link, coupon_line`

```
Hi {{1}}, you left {{2}} in your GoSkinly cart 🛒

It's saved for you: {{3}}

{{4}} — Team GoSkinly
```
Samples: Priya · Aurora Arches Matte iPhone Skin · https://goskinly.com/cart · Use code BACK10 at checkout for 10% off.

## 8. `skinly_wallet_credited` — Utility
Usecase: **wallet_credited** · Variables: `customer_name, amount_text, reason_line, wallet_balance, wallet_link`

```
Hi {{1}}, {{2}} has been added to your Skinly wallet 🎉

{{3}}

Wallet balance: {{4}}
See it here: {{5}}
```
Samples: Priya · ₹23 · Thanks for reviewing order #4102 — here's your reward · ₹73 · https://goskinly.com/account/wallet

## 9. `skinly_back_in_stock` — Marketing
Usecase: **back_in_stock** · Variables: `product_name, product_price, product_url`

```
Good news! {{1}} is back in stock at GoSkinly ({{2}}).

Grab it before it runs out again: {{3}}
```
Samples: Aurora Arches Matte iPhone Skin · ₹199 · https://goskinly.com/products/aurora-arches

## 10. `skinly_referral_friend_ordered` — Utility
Usecase: **referral_friend_ordered** · Variables: `referrerName, friendName, amount, link`

```
Hi {{1}}, your friend {{2}} just ordered from GoSkinly with your link! 🙌

You'll get {{3}} in your Skinly wallet once their order is delivered. Track your referrals: {{4}}
```
Samples: Rahul · Priya · ₹50 · https://goskinly.com/account/referrals

## 11. `skinly_referral_reward_paid` — Utility
Usecase: **referral_reward_paid** · Variables: `referrerName, friendName, amount, link`

```
Hi {{1}}, {{2}}'s order was delivered, so {{3}} has been added to your Skinly wallet 🎉

See your wallet and referrals: {{4}}
```
Samples: Rahul · Priya · ₹50 · https://goskinly.com/account/referrals

## 12. `skinly_admin_daily_digest` — Utility (to your own number)
Usecase: **admin_daily_digest** · Variables: `orders_count, revenue, to_pack, needs_attention, low_stock`

```
Good morning! Yesterday at GoSkinly: {{1}} orders, {{2}} collected.

To pack today: {{3}}
Needs attention: {{4}}
Running low: {{5}}

Open the dashboard: https://goskinly.com/backend-skinly
```
Samples: 17 · ₹4,434 · 29 · 2 · R-39 (0m), L-30 (0 sheets)
