import { CheckIcon } from "lucide-react";

interface CoverageSelectorProps {
  selectedCoverage: "only_back" | "full_body_wrap";
  onCoverageChange: (coverage: "only_back" | "full_body_wrap") => void;
}

const OPTIONS = [
  { key: "only_back" as const, title: "Only Back", note: "Back panel only" },
  { key: "full_body_wrap" as const, title: "Full Body Wrap", note: "Back + sides, complete protection" },
];

/**
 * Only Back or Full Body Wrap. The chosen one has to be obvious at a glance:
 * a faint tint on a thin border read as "neither selected" (owner, 9 Nov 2026),
 * so it is now ink-bordered, tinted, with a check, and the other stays plain.
 */
export function CoverageSelector({ selectedCoverage, onCoverageChange }: CoverageSelectorProps) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-bold">Select Coverage</label>
      <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Coverage">
        {OPTIONS.map((o) => {
          const on = selectedCoverage === o.key;
          return (
            <button
              key={o.key}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onCoverageChange(o.key)}
              className={`relative rounded-2xl border-2 p-3.5 text-left transition-all ${
                on ? "sticker border-ink bg-brand/15" : "border-ink/15 bg-card hover:border-ink/50"
              }`}
            >
              <span
                className={`absolute right-2.5 top-2.5 inline-flex size-5 items-center justify-center rounded-full border-2 ${
                  on ? "border-ink bg-brand text-brand-foreground" : "border-ink/25"
                }`}
              >
                {on && <CheckIcon className="size-3" strokeWidth={3} />}
              </span>
              <div className={`pr-6 text-sm ${on ? "font-extrabold" : "font-semibold"}`}>{o.title}</div>
              <div className="mt-1 text-xs text-muted-foreground">{o.note}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
