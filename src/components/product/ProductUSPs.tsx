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
 * Each gets its own hue so the block reads as a spectrum — which is the product.
 */
const SKIN_USPS = [
  { icon: ScissorsIcon,       label: "Precision cut",     sub: "Perfect fit, every port",  tone: "violet"  },
  { icon: SparklesIcon,       label: "High-res print",    sub: "True-to-screen colour",    tone: "fuchsia" },
  { icon: DropletsIcon,       label: "Bubble-free",       sub: "Air-release adhesive",     tone: "sky"     },
  { icon: Undo2Icon,          label: "Residue-free",      sub: "Peels clean, anytime",     tone: "emerald" },
  { icon: WandSparklesIcon,   label: "Easy to apply",     sub: "Under 5 minutes",          tone: "amber"   },
  { icon: GiftIcon,           label: "Install kit",       sub: "Included in the box",      tone: "rose"    },
] as const;

const TONES = {
  violet:  "from-violet-500/15  to-violet-500/5  text-violet-600  dark:text-violet-300  ring-violet-500/20",
  fuchsia: "from-fuchsia-500/15 to-fuchsia-500/5 text-fuchsia-600 dark:text-fuchsia-300 ring-fuchsia-500/20",
  sky:     "from-sky-500/15     to-sky-500/5     text-sky-600     dark:text-sky-300     ring-sky-500/20",
  emerald: "from-emerald-500/15 to-emerald-500/5 text-emerald-600 dark:text-emerald-300 ring-emerald-500/20",
  amber:   "from-amber-500/15   to-amber-500/5   text-amber-600   dark:text-amber-300   ring-amber-500/20",
  rose:    "from-rose-500/15    to-rose-500/5    text-rose-600    dark:text-rose-300    ring-rose-500/20",
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
          className="group rounded-2xl bg-card p-3 ring-1 ring-border/70 transition-all hover:-translate-y-0.5 hover:shadow-md hover:shadow-black/5"
        >
          <div
            className={`mb-2 inline-flex size-9 items-center justify-center rounded-xl bg-gradient-to-br ring-1 ${TONES[usp.tone]}`}
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
