import {
  ScissorsIcon,
  SparklesIcon,
  DropletsIcon,
  Undo2Icon,
  WandSparklesIcon,
  GiftIcon,
} from "lucide-react";

/**
 * Six reasons to buy, as colour-coded chips rather than a grey bullet list.
 *
 * They were a Tailwind spectrum — violet, fuchsia, sky, emerald, amber, rose —
 * none of which appears on the product, the sleeve or the logo, so the block
 * read as six chips that happened to be different rather than as one thing.
 * Same idea, cycling the four colours the packaging actually prints in.
 */
const SKIN_USPS = [
  { icon: ScissorsIcon,       label: "Precision cut",     sub: "Perfect fit, every port",  tone: "teal" },
  { icon: SparklesIcon,       label: "High-res print",    sub: "True-to-screen colour",    tone: "pink" },
  { icon: DropletsIcon,       label: "Bubble-free",       sub: "Air-release adhesive",     tone: "sun"  },
  { icon: Undo2Icon,          label: "Residue-free",      sub: "Peels clean, anytime",     tone: "red"  },
  { icon: WandSparklesIcon,   label: "Easy to apply",     sub: "Under 5 minutes",          tone: "teal" },
  { icon: GiftIcon,           label: "Install kit",       sub: "Included in the box",      tone: "pink" },
] as const;

const TONES = {
  teal:  "bg-brand/15  text-brand",
  pink:  "bg-blush/45  text-heart",
  sun:   "bg-sunny/45  text-ink",
  red:   "bg-heart/15  text-heart",
} as const;

interface ProductUSPsProps {
  show: boolean;
}

export function ProductUSPs({ show }: ProductUSPsProps) {
  if (!show) return null;

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
      {SKIN_USPS.map((usp) => (
        <div
          key={usp.label}
          className="group rounded-2xl border-2 border-ink/15 bg-card p-3 transition-all hover:-translate-y-0.5 hover:shadow-md hover:shadow-black/5"
        >
          <div
            className={`mb-2 inline-flex size-9 items-center justify-center rounded-xl border-2 border-ink/15 ${TONES[usp.tone]}`}
          >
            <usp.icon className="size-[18px]" strokeWidth={2.2} />
          </div>
          <p className="text-[13px] font-semibold leading-tight text-foreground">{usp.label}</p>
          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{usp.sub}</p>
        </div>
      ))}
    </div>
  );
}
