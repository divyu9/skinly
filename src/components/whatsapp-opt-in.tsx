import { useId } from "react";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import { cn } from "@/lib/utils.ts";

/**
 * The marketing permission box: unticked by default, wording agreed with
 * Chandan (29 Sep 2026). An order or a request is not permission for offers
 * (Meta policy, India's DPDP Act); this box is. Where it is saved:
 * placeOrder (checkout) or recordWhatsAppOptIn (forms) → contacts/{phone}.
 */
export function WhatsAppOptIn({
  checked,
  onCheckedChange,
  className,
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  className?: string;
}) {
  const id = useId();
  return (
    <label htmlFor={id} className={cn("flex cursor-pointer items-start gap-2.5 text-sm leading-snug", className)}>
      <Checkbox id={id} checked={checked} onCheckedChange={(v) => onCheckedChange(v === true)} className="mt-0.5" />
      <span>
        WhatsApp pe naye designs aur offers bhejein
        <span className="block text-xs text-muted-foreground">Kabhi bhi STOP likh ke band kar sakte hain.</span>
      </span>
    </label>
  );
}

/**
 * Saves the box's yes after a model request or Notify me was filed. Never
 * throws: a failed opt-in must not turn a successful request into an error.
 */
export async function recordWhatsAppOptIn(phone: string, source: "model_request" | "notify_me") {
  try {
    const [{ httpsCallable }, { functions }] = await Promise.all([import("firebase/functions"), import("@/lib/firebase")]);
    await httpsCallable(functions, "setWhatsAppOptIn")({ phoneNumber: phone, source });
  } catch (e) {
    console.warn("[opt-in] not saved:", e);
  }
}
