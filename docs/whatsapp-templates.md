# WhatsApp templates (Fast2SMS, earlier Authkey) / Meta

> 3 Oct 2026: the business number moved to Fast2SMS, a new WhatsApp Business
> account, so every template is submitted again there (Fast2SMS → WhatsApp →
> Templates). The texts, categories, headers and variable order below are the
> same; the IDs Fast2SMS gives are pasted in Admin › WhatsApp with provider
> "Fast2SMS". Template 0 was approved on Authkey and is written out here so it
> can be submitted again too.

Every template below matches a trigger that already exists in the code, and its
variables are exactly what that trigger sends. Create each one in Authkey
(console.authkey.io → WhatsApp → Templates → Create), wait for Meta's approval,
then send the **template ID** (the number in the URL, like 20862) to be wired
up and switched on.

- `{{1}}` is the first variable listed, `{{2}}` the second, and so on. Keep the
  order exactly.
- Support contact in every template is https://goskinly.com/support, which opens the website support WhatsApp (97610 11121). Meta rejects wa.me links in templates (error 2388081), so never paste wa.me directly. Replies to these messages are not monitored.
- Language: **English**. Header: none, except the templates marked **Header: Image** — choose Image there, because a header can't be added after approval. Footer: `GoSkinly` (optional). Buttons: none,
  unless a template says otherwise. Links sit in the body so no button setup is needed.
- Meta's rules, which every body here already follows: it cannot start or end with a
  variable; two variables cannot sit side by side; not too many variables for
  the amount of text; Utility templates must not advertise.

Status: ✅ live and confirmed · 🆕 new · 🔁 replaces a live template whose variable
order was never confirmed (the new one removes the guesswork).

| # | Template | Category | Usecase | Status |
|---|---|---|---|---|
| — | new_model_request (20862) | Utility | model_requested | ✅ keep as is |
| 1 | skinly_order_confirmed | Utility | order_received | 🔁 replaces 20892 neworder_1 |
| 2 | skinly_admin_new_order | Utility | admin_new_order | 🔁 replaces 20991 order_recv_45 |
| 3 | skinly_model_added | Utility | model_added | 🔁 replaces 20875 request_fulfilled |
| 4 | skinly_order_dispatched | Utility | order_dispatched | 🆕 |
| 5 | skinly_out_for_delivery | Utility | out_for_delivery | 🆕 |
| 6 | skinly_order_delivered | Utility | order_delivered | 🆕 |
| 7 | skinly_review_request | Marketing | review_request | 🆕 |
| 8 | skinly_wallet_credited | Utility | wallet_credited | 🆕 |
| 9 | skinly_payment_failed | Utility | payment_failed | 🆕 |
| 10 | skinly_order_cancelled | Utility | order_cancelled | 🆕 |
| 11 | skinly_back_in_stock | Marketing | back_in_stock | 🆕 |
| 12 | skinly_abandoned_cart | Marketing | abandoned_cart | 🆕 |
| 13 | skinly_otp | Authentication | COD / login OTP | 🆕 |
| 14 | skinly_referral_friend_ordered | Utility | referral_friend_ordered | 🆕 later |
| 15 | skinly_referral_reward_paid | Utility | referral_reward_paid | 🆕 later |
| 16 | skinly_admin_daily_digest | Utility | admin_daily_digest | 🆕 later |

---

## 0. `skinly_model_requested` — Utility
Variables: `brand_name, model_name, request_number`

```
Hi! We've received your request for {{1}} {{2}} skins on GoSkinly.

Your request number is {{3}}. We'll add the model and message you here as soon as its skins are live.

Questions? WhatsApp our support team: https://goskinly.com/support
```
Samples: Samsung · Galaxy S25 FE · MR-150

## 1. `skinly_order_confirmed` — Utility
**Header: Image** — a collage of the products in the order (up to 4). Upload any Skinly product photo as the sample.  
Variables: `customer_name, order_number, product_name, order_total`

```
Hi {{1}}, thank you for shopping with GoSkinly! 🎉

Your order {{2}} is confirmed.
Items: {{3}}
Order total: ₹{{4}}

We cut every skin fresh for your exact device and pack it within 24–48 hours. We'll message you here with tracking as soon as it ships.

Questions? WhatsApp our support team: https://goskinly.com/support
```
Samples: Priya · #4102 · Aurora Arches Matte iPhone 15 Skin · 527.00

## 2. `skinly_admin_new_order` — Utility (to your own number)
**Header: Image** — a collage of the products in the order (up to 4). Upload any Skinly product photo as the sample.  
Variables: `order_number, order_amount, customer_name, number_of_products, payment_mode`

```
New order on GoSkinly 🎉

Order: {{1}}
Amount: ₹{{2}}
Customer: {{3}}
Products: {{4}}
Payment: {{5}}

Open the admin panel to pack it: https://goskinly.com/backend-skinly/orders
```
Samples: #4102 · 527.00 · Priya Sharma · 2 · COD

## 3. `skinly_model_added` — Utility
Variables: `brand_name, model_name, request_number`  
**Button: Visit website, Dynamic URL** — opens the skins for that exact model.
- Button text: `See skins for my device`
- URL type: **Dynamic**, URL: `https://goskinly.com/{{1}}`
- Sample for `{{1}}`: `products?brand=Samsung&model=Galaxy+S25+FE`

```
Good news! Skins for your {{1}} {{2}} are now live on GoSkinly 🎉

You asked for this model in request {{3}}, and we've added it. Tap the button below to see every design cut for your device.

Thank you for waiting — Team GoSkinly
```
Samples: Samsung · Galaxy S25 FE · MR-150

## 4. `skinly_order_dispatched` — Utility
**Header: Image** — a collage of the products in the parcel (up to 4). Upload any Skinly product photo as the sample.  
Variables: `first_name, order_number, courier_name, awb_number, tracking_url`  
**Button: Visit website, Dynamic URL** — opens the customer's own order page (items, address, live tracking).
- Button text: `View my order`
- URL type: **Dynamic**, URL: `https://goskinly.com/orders/{{1}}`
- Sample for `{{1}}`: `Xk3P9qLm2Rt7Vb1Nc4Ds?k=8f2a1c9e4b7d`

```
Hi {{1}}, your GoSkinly order {{2}} has been shipped! 🚚

Courier: {{3}}
AWB number: {{4}}
Track your parcel: {{5}}

While it's on the way, watch how to apply your skin perfectly: https://goskinly.com/how-to-apply
```
Samples: Priya · #4102 · Delhivery · 38291045561 · https://www.delhivery.com/track-v2/package/38291045561

## 5. `skinly_out_for_delivery` — Utility
Variables: `first_name, order_number, cod_line`

```
Hi {{1}}, your GoSkinly order {{2}} is out for delivery today 📦

{{3}}

Please keep your phone reachable so the delivery partner can reach you.
```
Samples: Priya · #4102 · Please keep ₹527 ready — it's Cash on Delivery.

(For prepaid orders the code sends "It's prepaid, so there's nothing to pay.")

## 6. `skinly_order_delivered` — Utility
**Header: Image** — a collage of the products in the parcel (up to 4). Upload any Skinly product photo as the sample.  
Variables (body): `first_name, order_number` — the review link goes in the button.  
**Button: Visit website, Dynamic URL** — opens the order's own review page (signed, works for guests).
- Button text: `Rate my skin`
- URL type: **Dynamic**, URL: `https://goskinly.com/review/{{1}}`
- Sample for `{{1}}`: `Xk3P9qLm2Rt7Vb1Nc4Ds?t=8f2a1c9e4b7d&utm_source=whatsapp`

Mentions the "up to 10% back" reward (Chandan's call, 3 Oct 2026). Meta may
re-file a Utility template that offers money as Marketing (dearer, capped per
user); if it does, accept that rather than dropping the line.

```
Hi {{1}}, your GoSkinly order {{2}} has been delivered 🎉

Before you apply it, watch our step-by-step video guide — it takes 2 minutes and gives a bubble-free finish: https://goskinly.com/how-to-apply

Once it's on, rate it using the button below. 📸 *Add a photo and get up to 10% of your order back* in your Skinly wallet.

Need help applying it? WhatsApp our support team: https://goskinly.com/support
```
Samples: Priya · #4102

## 7. `skinly_review_request` — Marketing
**Header: Image** — the product being reviewed. Upload any Skinly product photo as the sample.  
Variables (body): `customer_name, product_name` — the review link goes in the button.  
**Button: Visit website, Dynamic URL** — opens the order's own review page (signed, works for guests).
- Button text: `Rate my skin`
- URL type: **Dynamic**, URL: `https://goskinly.com/review/{{1}}`
- Sample for `{{1}}`: `Xk3P9qLm2Rt7Vb1Nc4Ds?t=8f2a1c9e4b7d&utm_source=whatsapp`

Sent a few days after delivery, and once more five days later to anyone who
hasn't reviewed yet (never a third time). Submitted as Marketing (it offers
the "up to 10% back" reward), so the key lines are in WhatsApp bold (*…*).
Sent to buyers about their own order; anyone who replied STOP is skipped.

```
Hi {{1}}, how are you liking your *{{2}}*? 😊

⭐ *Rate it in 30 seconds* — tap the button below.

📸 *Add a photo and get up to 10% of your order back* in your Skinly wallet, to spend on your next skin.

Thank you for choosing GoSkinly! 💚
```
Samples: Priya · Aurora Arches Matte iPhone 15 Skin

## 8. `skinly_wallet_credited` — Utility
Variables: `customer_name, amount_text, reason_line, wallet_balance, wallet_link`

Covers review cashback, delivery cashback, referral rewards and refunds — the
reason line says which.

```
Hi {{1}}, {{2}} has been added to your Skinly wallet 🎉

Reason: {{3}}

Your wallet balance is now {{4}}. It is applied automatically at checkout on your next order.

See your wallet: {{5}}

Thank you for shopping with GoSkinly!
```
Samples: Priya · ₹23 · Thanks for reviewing order #4102 — here's your reward · ₹73 · https://goskinly.com/account/wallet

## 9. `skinly_payment_failed` — Utility
Variables (body): `customer_name, order_number, order_amount` — the pay link goes in the button.  
**Button: Visit website, Dynamic URL** — opens the order's own payment page (signed, works for guests), straight to PhonePe.
- Button text: `Complete payment`
- URL type: **Dynamic**, URL: `https://goskinly.com/pay/{{1}}`
- Sample for `{{1}}`: `Xk3P9qLm2Rt7Vb1Nc4Ds?t=8f2a1c9e4b7d&utm_source=whatsapp`

```
Hi {{1}}, the payment for your GoSkinly order {{2}} of *{{3}}* didn't go through.

Don't worry, your items are saved. Tap *Complete payment* below to pay securely and confirm your order.

If money was deducted, it will be refunded automatically by your bank.
```
Samples: Priya · 4102 · ₹527

## 10. `skinly_order_cancelled` — Utility
Variables: `first_name, order_number, refund_line`

```
Hi {{1}}, your GoSkinly order {{2}} has been cancelled.

{{3}}

If you didn't expect this, WhatsApp our support team and we'll sort it out: https://goskinly.com/support
```
Samples: Priya · #4102 · Your payment will be refunded to the original payment method.

## 11. `skinly_back_in_stock` — Marketing
**Header: Image** — the product that is back. Upload any Skinly product photo as the sample.  
Variables: `product_name, product_url`

Sent only to people who tapped "Notify me" on a sold-out product.

```
Good news! {{1}} is back in stock at GoSkinly 🎉

You asked us to tell you when it returned. Grab it before it sells out again: {{2}}

Team GoSkinly
```
Samples: Aurora Arches Matte iPhone 15 Skin · https://goskinly.com/products/aurora-arches

## 12. `skinly_abandoned_cart` — Marketing
**Header: Image** — a collage of the products in the cart (up to 4). Upload any Skinly product photo as the sample.  
Variables: `customer_name, product_name, coupon_line` · Button 1 variable: `cart_code`

```
Hi {{1}}, you left {{2}} in your GoSkinly cart 🛒

It's saved and ready — tap below to check out in one step.

{{3}}

Team GoSkinly
```
Samples: Priya · Aurora Arches Matte iPhone 15 Skin · Use code BACK10 at checkout for 10% off.

Buttons (Call To Action):
- **Complete My Order** — Visit website, **Dynamic**, URL `https://goskinly.com/c/` (Authkey appends `{{1}}` itself — don't type it), sample `Xy12Ab34Cd56`. The code is the cart's restore key: /c/<code> refills that exact cart with the coupon applied, even in WhatsApp's in-app browser.
- **Need Help?** — Visit website, Static, `https://goskinly.com/support`.

## 13. `skinly_otp` — Authentication
Variable: `otp`

Meta writes the text for Authentication templates itself — you only choose the
options. In the Authkey / Meta template form pick:

- Category: **Authentication**
- Code delivery: **Copy code** button (button text: `Copy code`)
- ✅ Add security recommendation ("For your security, do not share this code.")
- ✅ Add expiry time: **10 minutes**

Meta then generates:
```
{{1}} is your verification code. For your security, do not share this code.
This code expires in 10 minutes.
```
Sample: 482913

## 14. `skinly_referral_friend_ordered` — Utility
Variables: `referrerName, friendName, amount, link`

```
Hi {{1}}, your friend {{2}} just ordered from GoSkinly using your link! 🙌

You'll get {{3}} in your Skinly wallet once their order is delivered.

Track your referrals here: {{4}}

Thank you for spreading the word!
```
Samples: Rahul · Priya · ₹50 · https://goskinly.com/account/referrals

## 15. `skinly_referral_reward_paid` — Utility
Variables: `referrerName, friendName, amount, link`

```
Hi {{1}}, {{2}}'s order has been delivered, so {{3}} has been added to your Skinly wallet 🎉

See your wallet and referrals: {{4}}

Keep sharing — every friend who orders earns you more.
```
Samples: Rahul · Priya · ₹50 · https://goskinly.com/account/referrals

## 16. `skinly_admin_daily_digest` — Utility (to your own number)
Variables: `orders_count, revenue, to_pack, needs_attention, low_stock`

```
Good morning! Yesterday at GoSkinly: {{1}} orders and {{2}} collected.

To pack today: {{3}}
Needs attention: {{4}}
Running low: {{5}}

Open the dashboard: https://goskinly.com/backend-skinly
```
Samples: 17 · ₹4,434 · 29 · 2 · R-39 (0m), L-30 (0 sheets)
