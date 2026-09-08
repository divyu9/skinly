# Security & correctness audit — goskinly.com

Scope: `src/` (82k lines), `functions/src/` (2.1k lines), `firestore.rules`, `index.html`,
production dependencies, and the live Firestore database.
Date: 2026-09-09. Commit: `84941229`.

**How to read this:** findings marked *verified* were reproduced against the live system.
Findings marked *from code* were established by reading the code and rules; I did not
exploit them, because doing so would have meant creating an account, escalating a real
account's privileges, or putting through a real payment.

---

## 1. CRITICAL — Any logged-in customer can make themselves a full admin

*From code. Not exploited.*

`firestore.rules`:

```
function isAdmin() {
  return isAuthenticated() && (
    request.auth.token.email == 'chandan1992@gmail.com' ||
    get(/databases/$(database)/documents/users/$(request.auth.uid)).data.isAdmin == true
  );
}

match /users/{userId} {
  allow read, write: if isOwner(userId) || isAdmin();
}
```

`isOwner(userId)` is `request.auth.uid == userId`. So a signed-in user may write their own
`users/{uid}` document, with no restriction on which fields. `isAdmin` is a plain field on
that document — confirmed present on live user docs.

A customer therefore runs, from their own browser console:

```
setDoc(doc(db, 'users', auth.currentUser.uid), { isAdmin: true }, { merge: true })
```

and `isAdmin()` now returns true for them. That grants:

- **write access to every collection**, because the catch-all is `allow write: if isAdmin()`
- **every admin Cloud Function**, because `functions/src/auth.ts` `requireAdmin()` also trusts
  `users/{uid}.isAdmin === true` — so R2 uploads, WhatsApp sends, shipment creation, SEO
  generation, wallet adjustments and the collection resync all open up

This is the single most serious issue: one customer signup ends in complete control of the store.

**Fix.** Admin status must live somewhere the user cannot write. Two steps:

1. Move it to a **custom claim** on the Firebase Auth token (`admin: true`), set only by a
   Cloud Function or the Admin SDK. `requireAdmin()` already honours `token.admin === true`
   first, so that path exists; it just isn't being used.
2. Stop the client writing the flag. Restrict the users rule so the field cannot be
   self-granted:

```
match /users/{userId} {
  allow read: if isOwner(userId) || isAdmin();
  allow create: if isOwner(userId)
                && !('isAdmin' in request.resource.data);
  allow update: if (isOwner(userId)
                    && request.resource.data.diff(resource.data)
                         .affectedKeys().hasAny(['isAdmin']) == false)
                 || isAdmin();
}
```

and change `isAdmin()` to read `request.auth.token.admin == true` only.

---

## 2. CRITICAL — The entire database is readable by anyone, with no login

*Verified.* I queried the Firestore REST API with **no Authorization header at all** — the
same access any visitor's browser has — and read every collection.

```
match /{document=**} {
  allow read: if true;
}
```

Records exposed right now:

| Collection | Records | What leaks |
|---|---:|---|
| `orders` | 143 | customer name, email, phone, full shipping address, items, payment status |
| `abandonedCarts` | 4,830 | customer email, cart contents, totals |
| `whatsappMessages` | 216 | recipient phone numbers |
| `users` | 75 | name, email |
| `modelRequests` | 52 | WhatsApp phone numbers |
| `cart` | 42 | live cart contents |
| `loginOtps` | 17 | **phone number + OTP code in plaintext** (see §7) |
| `bugReports` | 12 | reporter email and phone |
| `walletTransactions` | 2 | balances before/after |

That is roughly 5,300 records of customer personal data, downloadable by anyone who opens
devtools. Under India's DPDP Act this is reportable personal-data exposure, not just a bug.

The `loginOtps` block in the rules is inert and says so in its own comment — Firestore rules
combine with OR, so a narrower `allow read: if false` cannot revoke the broader
`allow read: if true` above it.

**Fix.** Replace the blanket read with per-collection reads. Public catalogue data stays open;
everything with a person's name on it does not:

```
match /{document=**} { allow read, write: if false; }

// public catalogue
match /products/{id}       { allow read: if true; }
match /variants/{id}       { allow read: if true; }
match /collections/{id}    { allow read: if true; }
match /collectionProducts/{id} { allow read: if true; }
match /mockups/{id}        { allow read: if true; }
match /settings/{id}       { allow read: if true; }
match /seoPages/{id}       { allow read: if true; }

// private
match /orders/{id}   { allow read: if isOwner(resource.data.userId) || isAdmin(); }
match /users/{id}    { allow read: if isOwner(id) || isAdmin(); }
match /loginOtps/{id}      { allow read, write: if false; }
match /abandonedCarts/{id} { allow read: if isAdmin(); }
match /whatsappMessages/{id} { allow read: if isAdmin(); }
match /bugReports/{id}     { allow read: if isAdmin(); }
match /walletTransactions/{id} { allow read: if isOwner(resource.data.userId) || isAdmin(); }
```

Do this in the Firebase console's Rules playground first — the storefront reads a lot of
collections and any one missed will break a page. Worth listing every collection the shim
reads before switching over.

Guest order tracking currently relies on `resource.data.userId == 'guest'` being readable.
That will need a tracking-token check instead, or it becomes "any guest can read all guest
orders" — which is what it is today.

---

## 3. HIGH — The amount charged is never checked against the order total

*From code. Not exploited — testing it would mean putting a real payment through PhonePe.*

`functions/src/phonepe.ts`, `initiatePayment`:

```ts
const { orderId, amount, customerPhone, orderNumber, sessionId } = data;
...
if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
  throw new HttpsError("invalid-argument", "Invalid amount");
}
...
const amountInPaise = Math.max(Math.round(amount * 100), 100);
```

`amount` comes from the caller. It is checked for being a positive number and nothing else —
it is **never compared with `order.total`**, even though the function has already loaded the
order document two lines earlier.

`checkPaymentStatus` then closes the loop:

```ts
if (paymentStatus === "success") {
  ...
  await ordersSnap.docs[0].ref.update({
    paymentStatus: "success",
    status: "processing",
  });
}
```

It marks the order paid because PhonePe reported `COMPLETED`, without reading how much PhonePe
actually collected.

So: place a ₹5,000 order, call `initiatePayment` with `amount: 1`, pay ₹1, call
`checkPaymentStatus`. The order goes to `processing` and ships. Both functions are deployed
callables, so this needs no cooperation from the site's own UI.

**Fix.**

```ts
const expected = Number(order.total);
if (!Number.isFinite(expected) || expected <= 0) {
  throw new HttpsError("failed-precondition", "Order has no valid total");
}
const amountInPaise = Math.round(expected * 100);   // ignore data.amount entirely
```

and in `checkPaymentStatus`, before marking success:

```ts
const paidPaise = Number(responseData.data?.amount);
const order = ordersSnap.docs[0].data();
if (paidPaise !== Math.round(Number(order.total) * 100)) {
  console.error("amount mismatch", { paidPaise, expected: order.total, merchantTransactionId });
  throw new HttpsError("failed-precondition", "Payment amount does not match the order");
}
```

---

## 4. HIGH — Order totals fall back to a client-supplied price

*From code.*

`functions/src/placeorder.ts` recomputes the total from Firestore, which is right — but only
when the lookup hits:

```ts
const calculatedTotal = orderItems.reduce((sum, item) => {
  const qty = Number(item?.quantity || 1);
  if (item?.productId && item?.variant) {
    const dbPrice = priceMap.get(`${String(item.productId)}::${String(item.variant)}`);
    if (typeof dbPrice === "number") return sum + dbPrice * qty;
  }
  return sum + Number(item?.price || 0) * qty;    // ← client's number
}, 0);
```

The map is keyed on `productId::variantTitle`. If the variant title does not match a real
variant, the code silently trusts `item.price`.

For guest checkout the items come straight off the wire:

```ts
} else if (guestItems && guestItems.length > 0) {
  orderItems = guestItems;
}
```

So a guest sends `guestItems: [{ productId: "<real id>", variant: "zzz", price: 1, quantity: 1 }]`
and the order is created with `total: 1`.

Signed-in users are less exposed because items are read from the `cart` collection — but see
§6: that collection is world-writable, so the same values can be planted there.

**Fix.** Reject the item instead of trusting it:

```ts
const dbPrice = priceMap.get(`${item.productId}::${item.variant}`);
if (typeof dbPrice !== "number") {
  throw new HttpsError("failed-precondition",
    `Unknown variant for product ${item.productId}`);
}
return sum + dbPrice * qty;
```

Also drop `price` from the stored `items` array, or overwrite it with `dbPrice`, so the record
of what was charged is the server's number.

---

## 5. MEDIUM — The PhonePe webhook does nothing

*Verified by reading the deployed source.*

```ts
export const paymentCallback = onRequest(async (req: any, res: any) => {
  res.status(200).send("OK");
});
```

The whole handler. It does not verify the `X-VERIFY` signature and it does not update the
order. `initiatePayment` still passes this URL to PhonePe as `callbackUrl`.

Two consequences. Payment confirmation depends entirely on the customer's browser coming back
and calling `checkPaymentStatus` — if they close the tab after paying, the money is taken and
the order stays `pending` until someone notices. And the one channel that could independently
confirm the amount PhonePe collected is unused.

**Fix.** Implement it: verify `X-VERIFY` as
`sha256(base64Response + saltKey) + "###" + saltIndex`, decode the base64 payload, look up the
order by `merchantTransactionId`, check the amount against `order.total`, and only then mark it
paid. Keep `checkPaymentStatus` as the fallback, not the primary path.

---

## 6. MEDIUM — The `cart` collection is world-writable

*Verified in rules.*

```
match /cart/{cartId} {
  allow read, write: if true;
}
```

Anyone may create, edit or delete any cart row, including other people's. Combined with §4,
planting a row with an unmatchable variant title and `price: 1` against another user's `userId`
is enough to poison their next order total. It is also an unmetered write endpoint — a script
can fill the collection and run up Firestore costs.

**Fix.** Scope it to the owner:

```
match /cart/{cartId} {
  allow read:   if resource.data.userId == request.auth.uid
                || resource.data.sessionId == request.resource.data.sessionId;
  allow create: if request.resource.data.userId == request.auth.uid
                || request.resource.data.sessionId is string;
  allow update, delete: if resource.data.userId == request.auth.uid;
}
```

Guest carts keyed only by `sessionId` cannot be secured properly by rules alone; if that matters,
move cart writes behind a Cloud Function.

---

## 7. MEDIUM — 17 plaintext OTPs with phone numbers, publicly readable

*Verified.* I sampled a `loginOtps` document anonymously: the `otp` field is short and
unhashed — a plaintext code, next to the phone number it was sent to.

The current `loginOtp.ts` is fine: it stores a SHA-256 hash peppered with `OTP_PEPPER`, refuses
to run if the pepper is under 16 characters, expires codes after 10 minutes, allows 5 attempts
and enforces a 60-second cooldown plus a daily cap. These 17 are leftovers from before that
rewrite.

They are expired, so they are not directly usable to log in. They are still 17 customer phone
numbers plus a demonstration that codes were once stored in the clear.

**Fix.** Delete them. You have never authorised this, so I have not. One line once you say go:

```
gcloud firestore documents delete --collection-ids=loginOtps
```

or a scripted delete of the 17 documents.

---

## 8. LOW — HTML sanitiser is a denylist

`src/lib/sanitize-html.ts` strips `script`, `iframe`, `object`, `embed`, `link`, `meta`, `style`,
all `on*` attributes, `javascript:` URLs and `srcdoc`. Every `dangerouslySetInnerHTML` in the
codebase passes through it — I checked all eleven, including `formatted-description.tsx`.

It is a denylist, so it misses things an allowlist would not: `<base href>` can rewrite every
relative link on the page, `data:text/html` URLs survive, and SVG `<animate>`-style attribute
injection is untouched.

The content it renders (`seoPages.contentHTML`, product section descriptions) is admin-authored,
so this only becomes exploitable after §1 — but §1 currently makes any customer an admin, which
is exactly why it is worth closing.

**Fix.** Swap in DOMPurify (`npm i dompurify`), which is an allowlist and maintained:

```ts
import DOMPurify from "dompurify";
export const sanitizeHtml = (input: string) =>
  input ? DOMPurify.sanitize(input, { USE_PROFILES: { html: true } }) : "";
```

---

## 9. LOW — Dependency advisories

`npm audit --omit=dev` reports 37 advisories (3 critical, 18 high). Almost all are in `vite`
and `websocket-driver`, which are **build- and dev-server-only** — the deployed site is static
files and does not run them, so real-world exposure is close to zero.

Still worth clearing so genuine advisories are not lost in the noise:

```bash
npm audit fix
```

Check the site builds afterwards; avoid `--force`, which will move Vite across a major version.

---

## What I checked and found clean

- **No secrets in the repo.** No `.env` is tracked, and no API keys, tokens or private keys are
  hardcoded in `src/`. The `VITE_*` variables that reach the browser are the Firebase web config
  and the reCAPTCHA site key, both of which are designed to be public.
- **Auth on Cloud Functions.** Every callable that should be admin-only calls `requireAdmin()` —
  R2 uploads, WhatsApp, SEO, shipments, cart reminders, collection resync. The two unauthenticated
  callables (`generateLoginOtp`, `verifyLoginOtp`) are the login flow and are meant to be open.
- **OTP hardening.** Peppered hash, 10-minute expiry, 5 attempts, 60-second cooldown, daily cap,
  `crypto.timingSafeEqual` for comparison. Solid.
- **Rate limiting.** `enforceDailyRateLimit` is transactional and applied to OTP generation,
  payment initiation and status checks.
- **No `eval`, no `new Function`, no raw `innerHTML` assignment** anywhere in `src/`.
- **Order numbers** are allocated through a Firestore transaction, so they cannot collide.
- **WhatsApp and abandoned-cart senders** claim a row before sending, so a mid-send failure costs
  one message rather than looping.

---

## Suggested order of work

1. **§1 privilege escalation** — one rules change plus a custom claim. Everything else is worse
   while this is open.
2. **§2 public reads** — the live data exposure. Test in the Rules playground first.
3. **§3 and §4 payment amounts** — small, contained edits to two functions.
4. **§7 delete the 17 OTP records** — needs one word from you.
5. **§5 webhook**, **§6 cart rules**, **§8 DOMPurify**, **§9 npm audit** — when convenient.

Items 1, 2 and 7 are changes to live configuration and data. I have not made any of them.
