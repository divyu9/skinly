import { useState } from "react";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { toast } from "sonner";
import {
  MapPinIcon,
  TruckIcon,
  ScissorsIcon,
  ShieldCheckIcon,
  BanknoteIcon,
} from "lucide-react";

interface DeliveryInfoProps {
  isSkinProduct: boolean;
  /** Set once COD is switched on in codSettings. */
  codAvailable?: boolean;
}

/**
 * The old version stacked three refusals directly under the buy button —
 * "Non Returnable", "COD Not Available", "no cancellation" — at the exact moment
 * of decision. The facts are unchanged, but the made-to-order cut is stated as
 * the reason it is made for you, and it is answered by the reprint guarantee,
 * which is what the buyer is actually worried about.
 */
export function DeliveryInfo({ isSkinProduct, codAvailable = false }: DeliveryInfoProps) {
  const [pincode, setPincode] = useState("");
  const [pincodeChecked, setPincodeChecked] = useState(false);

  const handlePincodeCheck = () => {
    if (!/^\d{6}$/.test(pincode)) {
      toast.error("Please enter a valid 6-digit pincode");
      return;
    }
    setPincodeChecked(true);
  };

  const arriveBy = new Date(Date.now() + 6 * 24 * 60 * 60 * 1000);
  const longDate = arriveBy.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

  return (
    <div className="space-y-3">
      {/* Pincode → a date, not a promise */}
      <div className="rounded-2xl border-2 border-ink/15 bg-card p-3">
        <div className="mb-2.5 flex items-center gap-2">
          <MapPinIcon className="size-4 text-brand" />
          <span className="text-[13px] font-semibold">Check delivery to your pincode</span>
        </div>
        <div className="flex gap-2">
          <Input
            type="text"
            inputMode="numeric"
            placeholder="6-digit pincode"
            className="h-11 flex-1 rounded-xl border-border/80 bg-background"
            value={pincode}
            onChange={(e) => {
              setPincode(e.target.value.replace(/\D/g, "").slice(0, 6));
              setPincodeChecked(false);
            }}
            maxLength={6}
          />
          <Button
            className="sticker-sm sticker-press h-11 rounded-xl bg-brand px-5 font-bold text-brand-foreground hover:bg-brand/90"
            onClick={handlePincodeCheck}
          >
            Check
          </Button>
        </div>

        {pincodeChecked && /^\d{6}$/.test(pincode) && (
          <div className="mt-2.5 flex items-start gap-2.5 rounded-xl border-2 border-brand/30 bg-brand/10 p-3">
            <TruckIcon className="mt-0.5 size-4 shrink-0 text-brand" />
            <div className="text-[13px] leading-snug">
              <p className="font-semibold text-brand">
                Arrives by {longDate}
              </p>
              <p className="text-brand/80">
                Printed and dispatched the next working day
              </p>
            </div>
          </div>
        )}
      </div>

      {/* What you're covered on */}
      <div className="grid grid-cols-2 gap-2.5">
        <Assurance
          icon={ShieldCheckIcon}
          tone="emerald"
          title="Free reprint"
          body="Misprint or wrong cut? We remake it, on us."
        />
        <Assurance
          icon={TruckIcon}
          tone="sky"
          title="Pan-India"
          body="Tracked delivery to every pincode we serve."
        />
        {codAvailable ? (
          <Assurance
            icon={BanknoteIcon}
            tone="violet"
            title="Cash on delivery"
            body="Pay a small amount now, rest at your door."
          />
        ) : null}
        {isSkinProduct && (
          <Assurance
            icon={ScissorsIcon}
            tone="amber"
            title="Made for your model"
            body="Cut to order, so it can't be resold — please check your model before you buy."
            wide={!codAvailable}
          />
        )}
      </div>
    </div>
  );
}

/* The packaging's colours, same four as the USP chips above them. */
const TONES = {
  emerald: "bg-brand/15 text-brand",
  sky:     "bg-blush/45 text-heart",
  violet:  "bg-sunny/45 text-ink",
  amber:   "bg-heart/15 text-heart",
} as const;

function Assurance({
  icon: Icon,
  tone,
  title,
  body,
  wide,
}: {
  icon: typeof ShieldCheckIcon;
  tone: keyof typeof TONES;
  title: string;
  body: string;
  wide?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border-2 border-ink/15 bg-card p-3 ${wide ? "col-span-2" : ""}`}
    >
      <div className={`mb-1.5 inline-flex size-8 items-center justify-center rounded-lg border-2 border-ink/15 ${TONES[tone]}`}>
        <Icon className="size-4" strokeWidth={2.2} />
      </div>
      <p className="text-[13px] font-semibold leading-tight">{title}</p>
      <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{body}</p>
    </div>
  );
}
