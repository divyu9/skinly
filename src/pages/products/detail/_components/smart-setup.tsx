import { useEffect, useMemo, useRef, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { CheckIcon, PlusIcon, SparklesIcon } from "lucide-react";
import { db } from "@/lib/firebase";
import { loadCatalogue, loadModelCatalogue, type CatalogueModel, type CatalogueProduct } from "@/lib/catalogue";
import { sizedImage } from "@/lib/image-cdn";
import { buildSetupPicks, offerPrice, withDefaults, type SetupPick, type SmartUpsellSettings } from "@/lib/smart-setup";
import { cn } from "@/lib/utils.ts";

/**
 * "Complete your setup", above the buy buttons on a skin's page once a
 * device is chosen: add-ons that fit that device, each off until tapped (a
 * ticked-by-default box is basket sneaking under the 2023 dark-pattern
 * guidelines). Whatever is ticked goes into the cart with the skin, at the
 * offer price, marked for placeOrder to verify.
 */

export type SetupCartItem = {
  productId: string; productTitle: string; productImage: string; variant: string; price: number; quantity: number;
  upsellRuleId: string; upsellSource?: string; phoneBrand?: string; phoneModel?: string;
};

let settingsOnce: Promise<SmartUpsellSettings> | null = null;
const loadSettings = () =>
  (settingsOnce ||= getDoc(doc(db, "settings", "smartUpsell")).then((s) => withDefaults(s.data())).catch(() => withDefaults(null)));

type Choice = { option: number; charger?: string };

export function SmartSetup({ productId, device, onChange, resetKey }: {
  productId: string;
  device: { brand: string; model: string; category: string } | null;
  onChange: (items: SetupCartItem[]) => void;
  /** Bumped after the cart takes the items, to clear the ticks. */
  resetKey: number;
}) {
  const [data, setData] = useState<{ catalogue: CatalogueProduct[]; models: CatalogueModel[]; settings: SmartUpsellSettings } | null>(null);
  const [chosen, setChosen] = useState<Record<string, Choice>>({});
  const [open, setOpen] = useState<Record<string, Choice>>({});
  const lastSent = useRef("[]");

  useEffect(() => {
    if (!device) return;
    let live = true;
    Promise.all([loadCatalogue(), loadModelCatalogue(), loadSettings()]).then(([c, m, s]) => {
      if (live && c) setData({ catalogue: c.products, models: m?.models || [], settings: s });
    });
    return () => { live = false; };
  }, [device?.model]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setChosen({}); setOpen({}); }, [resetKey, device?.model]);

  const picks: SetupPick[] = useMemo(() => {
    if (!data || !device) return [];
    const self = data.catalogue.find((p) => p._id === productId);
    if (!self || self.productCategory !== "skin" || self.gadgetCategory === "charger") return [];
    return buildSetupPicks(self, device, data.catalogue, data.models, data.settings).slice(0, 5);
    // The device arrives as a fresh object each render; its fields are what matter.
  }, [data, device?.brand, device?.model, device?.category, productId]); // eslint-disable-line react-hooks/exhaustive-deps

  // The draft choice per pick (colour, charger) is kept even while unticked.
  const draft = (k: string): Choice => open[k] || chosen[k] || { option: 0, charger: picks.find((p) => p.kind === k)?.chargers?.preselect?.model };

  useEffect(() => {
    if (!data) return;
    const items: SetupCartItem[] = [];
    for (const p of picks) {
      const c = chosen[p.kind];
      if (!c) continue;
      const o = p.options[c.option] || p.options[0];
      const charger = p.chargers?.options.find((x) => x.model === c.charger);
      if (p.kind === "chargerSkin" && !charger) continue;
      items.push({
        productId: o.productId, productTitle: o.title, productImage: o.image, variant: o.variant, quantity: 1,
        price: offerPrice(o.price, data.settings.offers[p.kind]),
        upsellRuleId: `smart:${p.kind}`,
        upsellSource: "product",
        ...(charger ? { phoneBrand: charger.brand, phoneModel: charger.model } : {}),
      });
    }
    // Only when the selection really changed: the parent re-renders on every call.
    const sig = JSON.stringify(items);
    if (sig !== lastSent.current) {
      lastSent.current = sig;
      onChange(items);
    }
  }, [chosen, picks, data]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!device || !data || !picks.length) return null;

  const toggle = (p: SetupPick) => {
    const k = p.kind;
    if (chosen[k]) {
      setChosen(({ [k]: _, ...rest }) => rest);
      return;
    }
    setChosen((s) => ({ ...s, [k]: draft(k) }));
  };
  const setChoice = (k: string, patch: Partial<Choice>) => {
    const next = { ...draft(k), ...patch };
    setOpen((s) => ({ ...s, [k]: next }));
    setChosen((s) => (s[k] ? { ...s, [k]: next } : s));
  };

  const count = Object.keys(chosen).length;
  const saved = picks.reduce((sum, p) => {
    const c = chosen[p.kind];
    if (!c) return sum;
    const o = p.options[c.option] || p.options[0];
    return sum + (o.price - offerPrice(o.price, data.settings.offers[p.kind]));
  }, 0);

  return (
    <section className="min-w-0 overflow-hidden rounded-2xl border-2 border-ink bg-card shadow-[3px_3px_0_0_var(--ink)]">
      <header className="flex items-center justify-between gap-2 border-b-2 border-ink/10 bg-sunny/35 px-4 py-2.5">
        <h3 className="flex shrink-0 items-center gap-1.5 text-sm font-extrabold">
          <SparklesIcon className="size-4" /> Complete your setup
        </h3>
        <span className="min-w-0 truncate text-[11px] font-semibold text-foreground/70">
          {count ? <>+{count} added{saved > 0 ? <> · <b className="text-emerald-700">₹{saved} saved</b></> : null}</> : `Picked for your ${device.model}`}
        </span>
      </header>

      <ul className="divide-y divide-ink/10">
        {picks.map((p) => {
          const on = !!chosen[p.kind];
          const d = draft(p.kind);
          const o = p.options[d.option] || p.options[0];
          const rule = data.settings.offers[p.kind];
          const now = offerPrice(o.price, rule);
          const needsCharger = p.kind === "chargerSkin" && !d.charger;
          return (
            <li key={p.kind} className={cn("transition-colors", on && "bg-brand/[0.07]")}>
              <button
                type="button"
                onClick={() => (needsCharger && !on ? setOpen((s) => ({ ...s, [p.kind]: d })) : toggle(p))}
                aria-pressed={on}
                className="flex w-full items-center gap-3 px-4 py-3 text-left"
              >
                <span className={cn(
                  "grid size-6 shrink-0 place-items-center rounded-md border-2 border-ink transition-colors",
                  on ? "bg-brand text-brand-foreground" : "bg-background",
                )}>
                  {on ? <CheckIcon className="size-4" strokeWidth={3} /> : <PlusIcon className="size-3.5" strokeWidth={3} />}
                </span>
                <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-lg border border-ink/15 bg-muted">
                  {o.image ? <img src={sizedImage(o.image, 120)} alt="" loading="lazy" className="size-full object-cover" /> : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold leading-tight">{p.heading}</span>
                  <span className="mt-0.5 flex items-center gap-1 truncate text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                    <CheckIcon className="size-3 shrink-0" strokeWidth={3} /> {p.fit}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-sm font-extrabold tabular-nums">₹{now}</span>
                  {now < o.price && <span className="block text-[11px] text-muted-foreground line-through tabular-nums">₹{o.price}</span>}
                </span>
              </button>

              {/* Options: colour, glass type, charger — only once it is being considered. */}
              {(on || open[p.kind]) && (p.options.length > 1 || p.chargers) && (
                <div className="space-y-2 px-4 pb-3 pl-[3.25rem]">
                  {p.options.length > 1 && (
                    <div className="flex flex-wrap gap-1.5">
                      {p.options.map((opt, i) => (
                        <button key={opt.variantId} type="button" onClick={() => setChoice(p.kind, { option: i })}
                          className={cn(
                            "rounded-full border-2 px-2.5 py-0.5 text-[11px] font-semibold transition-colors",
                            i === d.option ? "border-ink bg-ink text-background" : "border-ink/20 hover:border-ink/50",
                          )}>
                          {opt.label}{opt.price !== o.price ? ` · ₹${offerPrice(opt.price, rule)}` : ""}
                        </button>
                      ))}
                    </div>
                  )}
                  {p.chargers && (
                    <label className="flex items-center gap-2 text-[11px] font-semibold text-muted-foreground">
                      For
                      <select
                        value={d.charger || ""}
                        onChange={(e) => {
                          setChoice(p.kind, { charger: e.target.value || undefined });
                          if (e.target.value && !chosen[p.kind]) setChosen((s) => ({ ...s, [p.kind]: { ...d, charger: e.target.value } }));
                        }}
                        className="h-7 min-w-0 flex-1 rounded-md border-2 border-ink/20 bg-background px-1.5 text-xs font-semibold text-foreground"
                      >
                        <option value="">Choose your charger…</option>
                        {p.chargers.options.map((c) => <option key={c.model} value={c.model}>{c.model}</option>)}
                      </select>
                    </label>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
