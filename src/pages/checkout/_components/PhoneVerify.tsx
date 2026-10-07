import { useState } from "react";
import { CheckCircle2Icon } from "lucide-react";
import { cartId } from "@/lib/cart-sync";

/**
 * Verify the checkout phone on WhatsApp (functions/src/phoneOtp.ts, purpose
 * "checkout"). A verified number is proven for delivery, the order records
 * it (placeOrder checks the token), and verifying is the shopper's consent
 * to order and product updates and promotions on WhatsApp — the sentence
 * sits right under the button.
 */
export const PHONE_CONSENT =
  "By verifying this number you agree to receive updates and promotional messages about your order and our products on WhatsApp. Reply STOP anytime.";

async function call(name: string, data: unknown) {
  const [{ functions }, { httpsCallable }] = await Promise.all([import("@/lib/firebase"), import("firebase/functions")]);
  return (await httpsCallable(functions, name)(data)).data as any;
}

export function PhoneVerify({ phone, isPhoneValid, verified, required, items, onVerified }: {
  phone: string;
  isPhoneValid: boolean;
  verified: boolean;
  required: boolean;
  items: any[];
  onVerified: (token: string) => void;
}) {
  const [sentTo, setSentTo] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (verified) {
    return (
      <p className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-green-700 dark:text-green-400">
        <CheckCircle2Icon className="size-4" /> WhatsApp number verified
      </p>
    );
  }
  if (!isPhoneValid) {
    return <p className="mt-1 text-xs text-muted-foreground">{required ? "We'll verify this number on WhatsApp." : "For order updates on WhatsApp."}</p>;
  }

  const codeSent = sentTo === phone;
  const send = async () => {
    setBusy(true); setError("");
    try { await call("sendCartSaveOtp", { phone, purpose: "checkout" }); setSentTo(phone); setCode(""); }
    catch (e: any) { setError(e?.message || "Could not send the code. Try again."); }
    finally { setBusy(false); }
  };
  const verify = async () => {
    setBusy(true); setError("");
    try {
      const r = await call("verifyCartSaveOtp", {
        phone, otp: code, purpose: "checkout", cartId: cartId(),
        items: items.map((i) => ({
          productId: i.productId, productTitle: i.productTitle, productImage: i.productImage, variant: i.variant,
          price: i.price, quantity: i.quantity, phoneBrand: i.phoneBrand, phoneModel: i.phoneModel, coverage: i.coverage,
        })),
      });
      if (r?.token) onVerified(String(r.token));
    } catch (e: any) { setError(e?.message || "That code did not work. Try again."); }
    finally { setBusy(false); }
  };

  return (
    <div className="mt-2 space-y-2 rounded-xl border-2 border-ink/10 bg-brand/5 p-3">
      {!codeSent ? (
        <button type="button" onClick={send} disabled={busy}
          className="w-full rounded-lg border-2 border-ink bg-brand px-3 py-2 text-sm font-bold text-brand-foreground disabled:opacity-60">
          {busy ? "Sending…" : `Verify ${phone} on WhatsApp${required ? "" : " (recommended)"}`}
        </button>
      ) : (
        <>
          <label htmlFor="checkout-otp" className="block text-xs font-semibold">Enter the 6-digit code sent to {phone} on WhatsApp</label>
          <div className="flex gap-2">
            <input id="checkout-otp" inputMode="numeric" autoComplete="one-time-code" maxLength={6}
              placeholder="6-digit code" value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="min-w-0 flex-1 rounded-lg border-2 border-ink/15 bg-background px-3 py-2 text-sm tracking-widest outline-none focus:border-brand" />
            <button type="button" onClick={verify} disabled={busy || code.length !== 6}
              className="shrink-0 rounded-lg border-2 border-ink bg-brand px-3 py-2 text-sm font-bold text-brand-foreground disabled:opacity-50">
              {busy ? "…" : "Verify"}
            </button>
          </div>
          <button type="button" onClick={send} disabled={busy} className="text-xs font-semibold text-brand underline">Resend code</button>
        </>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
      <p className="text-[11px] leading-snug text-muted-foreground">{PHONE_CONSENT}</p>
    </div>
  );
}
