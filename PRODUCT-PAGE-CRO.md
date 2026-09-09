# Product page — conversion analysis

Based on the live mobile page (`/yellow-and-black-abstract-matte-finish-phone-skin`),
`src/pages/products/detail/product-detail.tsx`, and the live order/review data.
Date: 2026-09-09.

---

## What the numbers say first

Everything below is measured, not estimated.

```
abandoned carts recorded        4,830
orders created                    143
reached PhonePe (has txn id)       11
marked paid                        27
marked failed                      35
still pending                      70

reviews in the database             0    across all 1,155 products
COD orders                          8    of 143  (5.6%)
AOV Rs 698    median order Rs 382
LCP 1.58s     TTFB 348ms            — speed is NOT your problem
```

Two things jump out. Roughly **4,830 carts produced 143 orders**, and of those only
**27 were paid**. The page itself is not where most of the money is being lost —
the checkout and the payment method mix are. So the revamp should start there, not
with the hero image.

---

## 1. COD is switched off. This is the single biggest lever.

The page states it plainly, under the buy button:

> ❌ Non Returnable  ❌ COD Not Available  ⚠️ Custom Cut: No cancellation or changes

Only 8 of 143 orders were COD, which matches. In Indian D2C at this price point,
**cash on delivery is normally 50–70% of orders**. Turning it off does not remove
those customers' intent, it removes the order.

At a ₹151–₹599 price point the RTO risk that usually justifies blocking COD is
small in absolute rupees, and you already have partial-COD support built:
`codSettings` has `partialCodEnabled`, `prepaidType` and `prepaidValue`.

**Do this:** turn COD on with a prepaid slice — customer pays ₹49–₹99 online, rest on
delivery. That filters out fake orders while keeping the COD buyer. The settings
already exist in the admin; the checkout already computes the split, and after the
security fix `placeOrder` now derives it server-side.

One thing to know: `placeOrder` currently only initiates PhonePe when
`paymentMethod === "phonepe"`, so a partial-COD order will not produce a payment
link. That needs a one-line condition change before you switch COD on.

Expected impact: **largest of anything on this list.**

---

## 2. Ten paid orders may never have been marked paid

`paymentCallback` in `functions/src/phonepe.ts` is still a stub that returns `200 OK`
and does nothing. An order only becomes `paid` if the customer's browser returns to
the site and triggers `checkPaymentStatus`.

Right now **10 orders are `pending` and already carry a PhonePe transaction id**,
worth **₹5,968** combined. If any of those customers completed payment and closed the
tab, you took the money and never shipped.

**Do this:** implement the webhook — verify `X-VERIFY`, decode the payload, match on
`merchantTransactionId`, check the amount, mark the order. Then reconcile those 10
against your PhonePe dashboard manually.

This is not a "conversion" fix in the usual sense, but it converts money you have
already earned into orders you actually fulfil, and it stops the leak repeating.

---

## 3. Zero reviews, and three components show a fake 4-star rating

There are **0 reviews** in the database. Meanwhile `top-picks.tsx`,
`SuggestedProductsSection.tsx` and `TrendingProductsSection.tsx` each render a
hardcoded four-star rating with the label `(4.0)`. The code even calls it
`{/* Rating placeholder */}`.

Two problems. Buyers who look twice notice that every single product has exactly 4.0,
and it undermines the rest of the page. And fabricated ratings are specifically
covered by India's framework on online reviews (BIS IS 19000:2022, and the CCPA's
dark-pattern guidelines) — this is the kind of thing that draws a notice.

**Do this, in order:**

1. Delete the placeholder stars today. An honest blank beats an obvious fake.
2. Get real reviews flowing: a WhatsApp message 3 days after delivery asking for a
   photo review. You already have the WhatsApp queue and 216 delivered messages'
   worth of history — the plumbing exists, it needs a `review_request` template.
3. Photo reviews specifically. For a skin, a customer photo on a real phone answers
   the exact doubt the page currently creates (see next point).

Until then, use proof you actually have: number of orders shipped, number of device
models supported (953), "designs printed to order in Agra".

---

## 4. The first thing above the product image is a disclaimer

```
ⓘ Model images are for reference only – You will receive the skin
   for your selected model
```

That banner sits above the product photo, in the most valuable space on the page. The
first sentence a buyer reads tells them the picture is not what they get.

The information is fair and worth keeping — but not there, and not phrased as a
warning. Move it under the image as a quiet line, or better, invert it:

> **Cut to fit your exact model.** Choose your device and we print and cut this design
> for it.

Same fact, framed as the product's strength rather than a caveat. The custom cut is
the reason you can serve 953 models and Shopify sellers can't — it should read like a
feature.

---

## 5. Three negatives stacked directly under the buy button

Non-returnable, no COD, and no cancellation all appear together immediately below the
CTA — the exact moment of decision.

Non-returnable is genuinely unavoidable for a made-to-order cut. But it can be paired
with something reassuring instead of sitting alone:

- **"Misprint or wrong cut? We reprint free."** A print-defect guarantee costs you
  very little (your own error rate) and removes the buyer's actual fear, which is not
  "I'll change my mind", it is "what if it doesn't fit".
- Show the delivery date, not "Fast Shipping". "Order today, delivered by 14 Sep"
  converts; a vague promise does not.
- The pincode checker is good — put the result inline as a date.

---

## 6. Four of eight images on the page fail to load

The "Complete Your Setup" upsell row renders alt text instead of pictures — those are
the lost Cloudinary product photos. An upsell with a broken image is worse than no
upsell: it makes the whole page look abandoned.

**Do this now:** hide any upsell card whose image fails to load, rather than showing a
grey box. One `onError` handler. Then re-shoot or re-generate the missing photos —
around 65 accessory products need it.

---

## 7. The buy button is disabled and the page doesn't say why

Both CTAs render greyed out until a device model is chosen, and there is no message
at the button explaining that. A first-time visitor sees a dead "Buy Now" and leaves.

**Do this:** make the button itself the prompt. Instead of a disabled button, show an
enabled one labelled **"Select your device"** that opens the model picker, and only
then becomes "Buy Now". Never render a dead primary CTA.

Better still: detect the device. You already have `useDeviceDetection` in the codebase
and a `supportedModels` collection — on mobile you can pre-select the visitor's own
phone and let them change it. That removes the single biggest step in the funnel.

---

## 8. The description is collapsed by default

`showFullDescription` starts false, so the product description is hidden behind a
chevron. For a design-led product the description is where "matte finish", "3M vinyl",
"no residue" live — the things that justify the price.

Show the first two lines expanded with a "more" link, rather than a closed accordion.

---

## What I would do, in order

| # | Change | Effort | Why it is here |
|---|---|---|---|
| 1 | Turn on COD with a prepaid slice (+ the `placeOrder` condition fix) | half a day | 5.6% COD in a market that runs on COD |
| 2 | Implement the PhonePe webhook, reconcile the 10 stuck orders | half a day | ₹5,968 already at risk, leak is ongoing |
| 3 | Delete the fake 4.0 ratings | 10 minutes | trust + compliance |
| 4 | Turn the disclaimer banner into a "cut to fit your model" feature line | 1 hour | worst-placed sentence on the page |
| 5 | Replace the disabled CTA with "Select your device" | 2 hours | dead primary button |
| 6 | Hide upsell cards with broken images | 30 minutes | half the images on the page fail |
| 7 | Delivery date instead of "Fast Shipping" | 2 hours | pincode checker already there |
| 8 | Free-reprint guarantee next to "non returnable" | copy only | answers the real objection |
| 9 | WhatsApp review request 3 days post-delivery | 1 day | 0 reviews is the deepest hole |
| 10 | Expand description by default | 10 minutes | trivial |

Items 1 and 2 are worth more than 3–10 combined. Do not start with the visual redesign.

---

## What is already good

Worth saying, because a revamp should not throw these out:

- **Speed is fine.** LCP 1.58s, TTFB 348ms, 7KB of JS on the product route. Most
  Indian D2C stores would take this.
- The **pincode checker** at the CTA is the right idea, just needs to output a date.
- **WhatsApp support button** on the product page is correct for this market.
- The **sticky bottom bar** with price and CTA is right for mobile.
- **Coverage selector** (back only / full wrap) is a genuine upsell lever and is
  already positioned well.
- The 953-model custom cut is a real moat. The page currently apologises for it
  instead of selling it.
