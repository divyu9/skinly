import { useEffect, useState } from "react";
import { MessageCircleIcon, CheckIcon } from "lucide-react";
import { loadFs } from "@/lib/fs";
import { cartId } from "@/lib/cart-sync";

/**
 * "Save my cart on WhatsApp" for a guest, on the cart page, with the number
 * proven by a one-time code (functions/src/phoneOtp.ts).
 *
 * Someone who leaves from the cart page left nothing to reach them by. Here
 * they give their WhatsApp number, get a 6-digit code on WhatsApp, and
 * entering it saves the cart against the number. The consent line sits right
 * above the verify button: verifying agrees to order and product updates and
 * promotions, which is what the abandoned-cart reminder needs.
 *
 * Shown only while settings/cartSaveOtp.enabled is true (an approved
 * WhatsApp authentication template is needed to send the code).
 */
const SAVED_KEY = "skinly_cart_saved_phone";
const CONSENT = "By verifying this number you agree to receive updates and promotional messages about your order and our products on WhatsApp. Reply STOP anytime.";

async function call(name: string, data: unknown) {
  const [{ functions }, { httpsCallable }] = await Promise.all([import("@/lib/firebase"), import("firebase/functions")]);
  return (await httpsCallable(functions, name)(data)).data as any;
}

export function SaveCartWhatsApp({ items }: { items: any[] }) {
  const [enabled, setEnabled] = useState(false);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState<string>(() => {
    try { return localStorage.getItem(SAVED_KEY) || ""; } catch { return ""; }
  });

  useEffect(() => {
    let live = true;
    loadFs().then(({ doc, getDoc, db }) => getDoc(doc(db, "settings", "cartSaveOtp")))
      .then((s) => { if (live) setEnabled(s.data()?.enabled === true); })
      .catch(() => undefined);
    return () => { live = false; };
  }, []);

  if (!items.length || (!enabled && !saved)) return null;

  if (saved) {
    return (
      <p className="flex items-start gap-2 rounded-xl border-2 border-ink/10 bg-brand/10 p-3 text-xs">
        <CheckIcon className="mt-0.5 size-4 shrink-0 text-brand" />
        <span>Cart saved for <b>{saved}</b>. If you don't finish your order, we'll send it to you on WhatsApp with a discount code.</span>
      </p>
    );
  }

  const sendCode = async () => {
    setBusy(true); setError("");
    try {
      await call("sendCartSaveOtp", { phone });
      setStep("code");
    } catch (e: any) {
      setError(e?.message || "Could not send the code. Try again.");
    } finally { setBusy(false); }
  };
  const verify = async () => {
    setBusy(true); setError("");
    try {
      await call("verifyCartSaveOtp", {
        phone, otp: code, cartId: cartId(),
        items: items.map((i) => ({
          productId: i.productId, productTitle: i.productTitle, productImage: i.productImage, variant: i.variant,
          price: i.price, quantity: i.quantity, phoneBrand: i.phoneBrand, phoneModel: i.phoneModel, coverage: i.coverage,
        })),
      });
      try { localStorage.setItem(SAVED_KEY, phone); } catch { /* storage blocked */ }
      setSaved(phone);
    } catch (e: any) {
      setError(e?.message || "That code did not work. Try again.");
    } finally { setBusy(false); }
  };

  const validPhone = /^[6-9]\d{9}$/.test(phone);
  return (
    <form
      className="space-y-2 rounded-xl border-2 border-ink/10 bg-card p-3"
      onSubmit={(e) => { e.preventDefault(); if (step === "phone" ? validPhone : code.length === 6) void (step === "phone" ? sendCode() : verify()); }}
    >
      <label htmlFor={step === "phone" ? "save-cart-phone" : "save-cart-code"} className="flex items-center gap-1.5 text-sm font-semibold">
        <MessageCircleIcon className="size-4 text-brand" />
        {step === "phone" ? "Not ready yet? Save your cart on WhatsApp" : `Enter the code sent to ${phone} on WhatsApp`}
      </label>
      <div className="flex gap-2">
        {step === "phone" ? (
          <input id="save-cart-phone" inputMode="numeric" autoComplete="tel-national" maxLength={10}
            placeholder="10-digit WhatsApp number" value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
            className="min-w-0 flex-1 rounded-lg border-2 border-ink/15 bg-background px-3 py-2 text-sm outline-none focus:border-brand" />
        ) : (
          <input id="save-cart-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6}
            placeholder="6-digit code" value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            className="min-w-0 flex-1 rounded-lg border-2 border-ink/15 bg-background px-3 py-2 text-sm tracking-widest outline-none focus:border-brand" />
        )}
        <button type="submit" disabled={busy || (step === "phone" ? !validPhone : code.length !== 6)}
          className="shrink-0 rounded-lg border-2 border-ink bg-brand px-3 py-2 text-sm font-bold text-brand-foreground disabled:opacity-50">
          {busy ? "…" : step === "phone" ? "Send code" : "Verify & save"}
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      {step === "code" && (
        <button type="button" className="text-xs font-semibold text-brand underline" onClick={() => { setStep("phone"); setCode(""); setError(""); }}>
          Change number
        </button>
      )}
      <p className="text-[11px] leading-snug text-muted-foreground">{CONSENT}</p>
    </form>
  );
}
