# Security Review Report (goskinly.com)

## Executive Summary
This codebase is a React + Firebase (Auth/Firestore/Functions) stack. The highest-risk issues are (1) plaintext secrets committed to the repository, and (2) multiple Firebase callable Cloud Functions that appear callable without authorization checks (allowing abuse, data tampering, and cost/spam attacks). There are also stored-XSS risks due to rendering unsanitized HTML with `dangerouslySetInnerHTML`.

## Critical Findings

### C-01: Plaintext secrets committed in repository
**Impact:** Anyone with repo access (or any leaked zip/build artifact) can reuse these credentials to take over infrastructure and incur direct financial loss.

- Evidence: [functions/.runtimeconfig.json](file:///Users/madhousemedia/Downloads/opti-code-byclaude-newbackup/functions/.runtimeconfig.json#L1-L38) contains multiple production credentials (payments, shipping, OpenAI, messaging, image/CDN, object storage).
- Risk: credential reuse enables attackers to send WhatsApp messages, generate SEO content with OpenAI, manipulate shipping/payment integrations, and upload/delete objects in storage.

**Remediation**
- Immediately rotate/revoke all secrets present in that file (treat as compromised).
- Remove the file from the repo history (git history rewrite) and add it to `.gitignore`.
- Store secrets only in Firebase/Google Secret Manager or Functions environment variables; restrict who can deploy/read them.

### C-02: Unprotected callable Cloud Functions (authorization checks commented out / missing)
**Impact:** Unauthenticated (or non-admin) callers can trigger privileged operations such as generating signed upload URLs, sending WhatsApp messages, and calling paid APIs.

- R2 CORS setup + signed URL generation lacks enforced auth checks:
  - [r2.ts](file:///Users/madhousemedia/Downloads/opti-code-byclaude-newbackup/functions/src/r2.ts#L19-L67)
- SEO generation callable function lacks enforced admin check:
  - [seo.ts](file:///Users/madhousemedia/Downloads/opti-code-byclaude-newbackup/functions/src/seo.ts#L11-L17)
- WhatsApp sending callable function lacks enforced auth/admin check:
  - [whatsapp.ts](file:///Users/madhousemedia/Downloads/opti-code-byclaude-newbackup/functions/src/whatsapp.ts#L12-L18)
- Shipment creation callable function lacks enforced auth/admin check:
  - [rapidshyp.ts](file:///Users/madhousemedia/Downloads/opti-code-byclaude-newbackup/functions/src/rapidshyp.ts#L15-L25)
- Payment initiation callable function does not enforce auth/ownership:
  - [phonepe.ts](file:///Users/madhousemedia/Downloads/opti-code-byclaude-newbackup/functions/src/phonepe.ts#L30-L38)

**Remediation**
- Enforce `request.auth` checks on every callable function; for admin-only actions, enforce custom claims (e.g. `request.auth.token.admin === true`).
- Add Firebase App Check enforcement for callable functions to reduce automated abuse.
- Add per-user/IP rate limiting for cost-bearing endpoints (SEO/OpenAI, WhatsApp).

## High Findings

### H-03: Order/Resource tampering risk (IDOR) in Functions
**Impact:** A user can potentially update or affect orders they do not own by passing arbitrary `orderId`.

- Payment initiation updates an order document by `orderId` without verifying caller owns that order:
  - [phonepe.ts](file:///Users/madhousemedia/Downloads/opti-code-byclaude-newbackup/functions/src/phonepe.ts#L30-L97)
- Shipment creation reads/updates an order document by `orderId` without verifying admin:
  - [rapidshyp.ts](file:///Users/madhousemedia/Downloads/opti-code-byclaude-newbackup/functions/src/rapidshyp.ts#L15-L66)

**Remediation**
- Require authentication for these endpoints.
- Verify `order.userId === request.auth.uid` for customer actions, and admin claim for admin actions.
- Consider storing an immutable server-generated order number/token and validating it, not trusting client-provided IDs.

### H-04: Stored XSS risk via `dangerouslySetInnerHTML` with unsanitized content
**Impact:** If an attacker (or compromised admin) can write HTML into these content fields, they can execute script in visitors’ browsers (session hijack, payment redirection, admin takeover).

- SEO pages render arbitrary HTML:
  - [product-layout.tsx](file:///Users/madhousemedia/Downloads/opti-code-byclaude-newbackup/src/pages/seo/_components/product-layout.tsx#L160-L167)
- Product landing sections render HTML:
  - [ProductLandingSections.tsx](file:///Users/madhousemedia/Downloads/opti-code-byclaude-newbackup/src/components/products/sections/ProductLandingSections.tsx#L72-L77)
  - [ProductLandingSections.tsx](file:///Users/madhousemedia/Downloads/opti-code-byclaude-newbackup/src/components/products/sections/ProductLandingSections.tsx#L136-L141)
  - [ProductLandingSections.tsx](file:///Users/madhousemedia/Downloads/opti-code-byclaude-newbackup/src/components/products/sections/ProductLandingSections.tsx#L178-L183)
  - [ProductLandingSections.tsx](file:///Users/madhousemedia/Downloads/opti-code-byclaude-newbackup/src/components/products/sections/ProductLandingSections.tsx#L214-L217)
- Product description converts user-provided text to HTML then injects it without sanitization:
  - [formatted-description.tsx](file:///Users/madhousemedia/Downloads/opti-code-byclaude-newbackup/src/pages/products/detail/_components/formatted-description.tsx#L5-L39)

**Remediation**
- Sanitize HTML before rendering (allowlist tags/attributes) using a vetted sanitizer.
- Prefer storing structured content/markdown and rendering with a safe markdown renderer (no raw HTML), or sanitize server-side before saving.
- Add a strict CSP (Content Security Policy) to reduce exploitability of XSS (still not a replacement for sanitization).

### H-05: Admin authorization appears client-driven; must be enforced server-side in Firestore rules and Functions
**Impact:** If Firestore security rules are permissive, a non-admin user could modify their own user document (`isAdmin`) and gain access, or call admin-only APIs directly.

- Client uses email hardcode + Firestore user doc `isAdmin`:
  - [firebase-hooks.tsx](file:///Users/madhousemedia/Downloads/opti-code-byclaude-newbackup/src/lib/firebase-hooks.tsx#L1640-L1666)
  - [firebase-hooks.tsx](file:///Users/madhousemedia/Downloads/opti-code-byclaude-newbackup/src/lib/firebase-hooks.tsx#L1667-L1691)
- Admin UI guard is client-side only:
  - [admin-auth-guard.tsx](file:///Users/madhousemedia/Downloads/opti-code-byclaude-newbackup/src/components/admin-auth-guard.tsx#L12-L128)

**Remediation**
- Use Firebase custom claims for admin (`setCustomUserClaims`) and enforce them in Cloud Functions + Firestore rules.
- Ensure Firestore rules prevent users from writing `isAdmin` on their own document.
- Add MFA requirements for admin accounts.

## Medium Findings

### M-06: Overly permissive bucket CORS configuration
**Impact:** Broad CORS increases the blast radius if a signed URL is leaked; enables cross-origin uploads/requests from any origin.

- Evidence: `AllowedOrigins: ["*"]` and wide method allowlist:
  - [r2.ts](file:///Users/madhousemedia/Downloads/opti-code-byclaude-newbackup/functions/src/r2.ts#L37-L49)

**Remediation**
- Restrict `AllowedOrigins` to known domains (e.g., `https://goskinly.com`, `https://admin.goskinly.com`).
- Restrict methods to only what you need (usually `GET`, `PUT`).

### M-07: Potential cost/spam abuse (no rate limits / quotas visible)
**Impact:** Attackers can drive up costs by repeatedly calling SEO generation, WhatsApp sending, signed-upload generation.

- Evidence: callable functions do not implement rate limiting:
  - [seo.ts](file:///Users/madhousemedia/Downloads/opti-code-byclaude-newbackup/functions/src/seo.ts#L11-L64)
  - [whatsapp.ts](file:///Users/madhousemedia/Downloads/opti-code-byclaude-newbackup/functions/src/whatsapp.ts#L12-L71)
  - [r2.ts](file:///Users/madhousemedia/Downloads/opti-code-byclaude-newbackup/functions/src/r2.ts#L61-L100)

**Remediation**
- Add rate limiting (per UID and/or per IP), request validation, and quotas.
- Use App Check + reCAPTCHA in admin workflows that trigger cost-bearing calls.

### M-08: Logging of potentially sensitive data (PII) in Functions
**Impact:** Phone numbers, addresses, order metadata may end up in logs; increases privacy risk and breach impact.

- Evidence: payload logging in shipping integration:
  - [rapidshyp.ts](file:///Users/madhousemedia/Downloads/opti-code-byclaude-newbackup/functions/src/rapidshyp.ts#L41-L52)
- Evidence: WhatsApp logs store phone/template variables:
  - [whatsapp.ts](file:///Users/madhousemedia/Downloads/opti-code-byclaude-newbackup/functions/src/whatsapp.ts#L47-L69)

**Remediation**
- Avoid logging PII; log only minimal identifiers.
- Restrict access to logs and Firestore collections that contain messaging logs.

## Operational Hardening Recommendations (Not code-specific)
- Enable security headers (CSP, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, clickjacking protection) at CDN/Hostinger/Cloudflare layer.
- Ensure Firebase Auth is configured with appropriate providers and MFA for admin accounts.
- Run dependency audits (`npm audit`) and monitor for vulnerable packages.
- Review Firestore security rules in Firebase Console (no `allow read, write: if true;`) and ensure least-privilege.

