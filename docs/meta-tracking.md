# Meta Pixel, Conversions API and GA4 — setup and testing

## What sends what

| Event | Browser (Pixel / GA4) | Server (Conversions API) | event_id |
|---|---|---|---|
| ViewContent / view_item | product page | — | `vc-…` |
| AddToCart / add_to_cart | add to cart | — | `atc-…` |
| InitiateCheckout / begin_checkout | checkout opened (once per tab session, not on return from PhonePe) | when the order is written (placeOrder) | `ic-<checkoutId>` |
| AddPaymentInfo / add_payment_info | Place Order tapped with a valid form | when the order is written | `api-<checkoutId>` |
| Purchase / purchase | order page, once the order is confirmed (this browser only, once) | **only** when PhonePe confirms the money (callback or status check); COD only with `META_CAPI_COD_PURCHASE=true` | `purchase-<order number>` |
| checkout_validation_error / CheckoutValidationError | field name (never the value) | — | |
| payment_failed / payment_cancelled (PaymentFailed / PaymentCancelled) | PhonePe's reason code, from the order page or checkout | — | |
| checkout_abandoned / CheckoutAbandoned | left checkout after InitiateCheckout with no order (beacon) | — | |

Purchase value is `order.total` (what was charged, after coupon and wallet) on all three: GA4, Pixel and CAPI. GA4's transaction_id is the order number.

The server sends each Purchase once: a transaction claims `orders/{id}.metaCapi.purchase` before sending. Results are kept on the order (`metaCapi.purchase`, `metaCapi.checkout`), and Admin › Order › Source shows them. A CAPI error is logged and never blocks an order.

## Flags

**Functions** (`functions/.env`; these are server secrets, so never put them in client code):

| Variable | Default | Meaning |
|---|---|---|
| `META_CAPI_TOKEN` | — | Conversions API access token. Nothing is sent without it. |
| `META_TEST_EVENT_CODE` | — | While set, **every** server event goes to Test Events only and is not used for ads. Remove it after testing. |
| `META_PIXEL_ID` | `1037478581823270` | Dataset / pixel id |
| `META_GRAPH_VERSION` | `v26.0` | Graph API version |
| `META_CAPI_ENABLED` | on (when a token is set) | `false` = kill switch |
| `META_CAPI_COD_PURCHASE` | off | `true` = also send Purchase for COD orders at placement |
| `PAYMENT_TEST_MODE` | off | `true` = allow the admin "Simulate successful payment" button |

**Storefront build** (Vite `.env`; nothing secret here):

| Variable | Default | Meaning |
|---|---|---|
| `VITE_TRACKING_HOSTS` | `goskinly.com,www.goskinly.com` | The only hosts where gtag.js and fbevents.js load and send |
| `VITE_TRACKING_FORCE` | off | `true` = load the tags on any host, for testing a build |
| `VITE_PAYMENT_TEST_MODE` | off | `true` = show the "Payment test mode" card on Admin › Order |

`?ga_debug=1` on any page marks that tab's GA4 hits for DebugView.

## Testing

1. **Deduplicated Purchase, without paying**
   - Set `META_CAPI_TOKEN`, `META_TEST_EVENT_CODE` (from Events Manager › Test Events) and `PAYMENT_TEST_MODE=true`, then deploy functions.
   - Build the storefront with `VITE_PAYMENT_TEST_MODE=true`.
   - In Test Events, open goskinly.com through "Test browser events", go to Admin › Orders › any order, and press **Simulate successful payment**.
   - The browser and the server both send `purchase-test-…`, which should show as Browser + Server, deduplicated.
   - Nothing about the order changes.
2. **A real PhonePe order** (with `META_TEST_EVENT_CODE` still set)
   - Place a small online order on goskinly.com from the Test Events browser tab.
   - Test Events should show InitiateCheckout, AddPaymentInfo and Purchase from both Browser and Server, with matching event_ids.
   - Admin › Order › Source shows what the server sent.
3. **Go live**
   - Remove `META_TEST_EVENT_CODE`, `PAYMENT_TEST_MODE` and `VITE_PAYMENT_TEST_MODE`, then redeploy.
4. **GA4 DebugView**
   - Open `https://goskinly.com/?ga_debug=1`, go through checkout, then leave it or submit an empty form.
   - DebugView should show begin_checkout, checkout_validation_error, add_payment_info, payment_failed / payment_cancelled and checkout_abandoned.
5. **Unit checks**:
   ```bash
   npm --prefix functions run build && node functions/scripts/test-meta-capi.cjs
   ```
