import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { toast } from "sonner";
import { CheckIcon, GiftIcon, LoaderIcon, PlusIcon, SparklesIcon } from "lucide-react";
import { db } from "@/lib/firebase";
import { useMutation } from "@/lib/firebase-hooks";
import { api } from "@/lib/firebase-api";
import { useAuth } from "@/hooks/use-auth.ts";
import { useGuestCart } from "@/hooks/use-guest-cart.ts";
import { loadCatalogue, loadModelCatalogue, type CatalogueModel, type CatalogueProduct } from "@/lib/catalogue";
import { sizedImage } from "@/lib/image-cdn";
import { trackAddToCart } from "@/lib/analytics.ts";
import {
  buildSetupPicks, isFlagship, kindOf, offerPrice, smartCartPrices, withDefaults,
  type CartLine, type SetupPick, type SmartUpsellSettings,
} from "@/lib/smart-setup";
import { cn } from "@/lib/utils.ts";

/**
 * Smart Setup on the cart and at checkout.
 *
 * The same device-matched add-ons as the product page, for the skins already
 * in the cart — one tap each — plus the free-gift bar when the admin has
 * switched it on. It replaces the one generic checkout rule, which offered
 * iPhone glass to every cart; that rule still shows (as `fallback`) for a
 * cart with no skin to match against.
 *
 * useSmartRepricing keeps the stored price of every Smart Setup line equal to
 * what placeOrder will charge, so the totals on these pages never promise an
 * offer that no longer holds (the skin was removed) or miss a gift that now does.
 */

type Loaded = { byId: Map<string, CatalogueProduct>; models: CatalogueModel[]; settings: SmartUpsellSettings };
let loadedOnce: Promise<Loaded | null> | null = null;
function loadAll(): Promise<Loaded | null> {
  return (loadedOnce ||= Promise.all([
    loadCatalogue(),
    loadModelCatalogue(),
    getDoc(doc(db, "settings", "smartUpsell")).then((s) => withDefaults(s.data())).catch(() => withDefaults(null)),
  ]).then(([c, m, s]) => (c ? { byId: new Map(c.products.map((p) => [p._id, p])), models: m?.models || [], settings: s } : null)));
}
function useLoaded() {
  const [data, setData] = useState<Loaded | null>(null);
  useEffect(() => { let live = true; loadAll().then((d) => live && setData(d)); return () => { live = false; }; }, []);
  return data;
}

/** Rewrites Smart Setup line prices to what placeOrder will charge. */
export function useSmartRepricing(lines: CartLine[] | undefined, isGuest: boolean) {
  const data = useLoaded();
  const { guestCart } = useGuestCart();
  const busy = useRef(false);
  useEffect(() => {
    if (!data || !lines?.length || busy.current) return;
    const prices = smartCartPrices(lines, data.byId, data.settings);
    const wrong = [...prices.entries()].filter(([i, p]) => Number(lines[i].price) !== p);
    if (!wrong.length) return;
    busy.current = true;
    (async () => {
      try {
        if (isGuest) {
          const stored: any[] = JSON.parse(localStorage.getItem("skinly_guest_cart") || "[]");
          for (const [i, p] of wrong) {
            const l = lines[i];
            const hit = stored.find((s) => s.productId === l.productId && s.variant === l.variant && (s.phoneModel || "") === (l.phoneModel || "") && s.upsellRuleId === l.upsellRuleId);
            if (hit) hit.price = p;
          }
          localStorage.setItem("skinly_guest_cart", JSON.stringify(stored));
          window.dispatchEvent(new Event("guest_cart_updated"));
        } else {
          await Promise.all(wrong.map(([i, p]) => (lines[i]._id ? updateDoc(doc(db, "cart", lines[i]._id!), { price: p }) : null)));
        }
      } catch (e) {
        console.warn("smart repricing skipped", e);
      } finally {
        busy.current = false;
      }
    })();
  }, [data, lines, isGuest, guestCart]);
}

export function CartSmartSetup({ lines, compact = false, fallback }: { lines: CartLine[] | undefined; compact?: boolean; fallback?: ReactNode }) {
  const data = useLoaded();
  const { user } = useAuth();
  const { addToGuestCart } = useGuestCart();
  const addToCartMutation = useMutation(api.cart.addToCart);
  const [draft, setDraft] = useState<Record<string, { option: number; charger?: string }>>({});
  const [adding, setAdding] = useState<string | null>(null);

  // The first skin in the cart that is cut for a device, and that device.
  const anchor = useMemo(() => {
    if (!data || !lines) return null;
    for (const l of lines) {
      const p = data.byId.get(l.productId);
      if (!p || p.productCategory !== "skin" || p.gadgetCategory === "charger" || !l.phoneModel || l.upsellRuleId) continue;
      return { product: p, device: { brand: String(l.phoneBrand || ""), model: String(l.phoneModel), category: String(p.gadgetCategory || "phone") } };
    }
    return null;
  }, [data, lines]);

  const picks: SetupPick[] = useMemo(() => {
    if (!data || !anchor || !lines) return [];
    const have = new Set(lines.map((l) => kindOf(data.byId.get(l.productId) || { title: "" })).filter(Boolean));
    let list = buildSetupPicks(anchor.product, anchor.device, [...data.byId.values()], data.models, data.settings).filter((p) => !have.has(p.kind));
    // On a flagship, Magneto X leads as the creator's pick.
    if (isFlagship(anchor.device.brand, anchor.device.model)) list = [...list.filter((p) => p.kind === "magneto"), ...list.filter((p) => p.kind !== "magneto")];
    return list.slice(0, compact ? 2 : 4);
  }, [data, anchor, lines, compact]);

  if (!lines?.length || !data) return null;
  if (!anchor || !picks.length) return <>{fallback}</>;

  const { settings } = data;
  const gift = settings.freeGift;
  const restValue = lines.filter((l) => !l.upsellRuleId).reduce((s, l) => s + Number(l.price || 0) * (Number(l.quantity) || 1), 0);
  const giftPick = gift.enabled ? picks.find((p) => p.kind === gift.kind) : undefined;
  const giftTaken = lines.some((l) => l.upsellRuleId === `smart:${gift.kind}` && Number(l.price) === 0);
  const giftUnlocked = !!giftPick && restValue >= gift.threshold;

  const add = async (p: SetupPick) => {
    const d = draft[p.kind] || { option: 0, charger: p.chargers?.preselect?.model };
    const o = p.options[d.option] || p.options[0];
    const charger = p.chargers?.options.find((c) => c.model === d.charger);
    if (p.chargers && !charger) { toast.error("Choose your charger first"); return; }
    const free = giftUnlocked && !giftTaken && p.kind === gift.kind;
    const item: any = {
      productId: o.productId, productTitle: o.title, productImage: o.image, variant: o.variant, quantity: 1,
      price: free ? 0 : offerPrice(o.price, settings.offers[p.kind]),
      upsellRuleId: `smart:${p.kind}`,
      ...(charger ? { phoneBrand: charger.brand, phoneModel: charger.model } : {}),
    };
    setAdding(p.kind);
    try {
      if (user) await addToCartMutation(item); else addToGuestCart(item);
      trackAddToCart(item.productId, `${item.productTitle} - ${item.variant}`, item.price, 1);
      toast.success(free ? "Free gift added! 🎁" : "Added to cart");
    } catch {
      addToGuestCart(item);
    } finally {
      setAdding(null);
    }
  };

  return (
    <section className="min-w-0 overflow-hidden rounded-2xl border-2 border-ink bg-card shadow-[3px_3px_0_0_var(--ink)]">
      <header className="flex items-center justify-between gap-2 border-b-2 border-ink/10 bg-sunny/35 px-4 py-2.5">
        <h3 className="flex shrink-0 items-center gap-1.5 text-sm font-extrabold"><SparklesIcon className="size-4" /> Complete your setup</h3>
        <span className="min-w-0 truncate text-[11px] font-semibold text-foreground/70">For your {anchor.device.model}</span>
      </header>

      {/* The free-gift bar: how far, or that it is theirs to take. */}
      {giftPick && !giftTaken && (
        <div className="border-b-2 border-ink/10 bg-blush/30 px-4 py-2.5">
          <p className="flex items-center gap-1.5 text-xs font-semibold">
            <GiftIcon className="size-4 shrink-0" />
            {giftUnlocked
              ? <>Unlocked: a <b>FREE {giftPick.heading.toLowerCase()}</b> — add it below</>
              : <>Add <b>₹{Math.ceil(gift.threshold - restValue)}</b> more and get a <b>FREE {giftPick.heading.toLowerCase()}</b></>}
          </p>
          {!giftUnlocked && (
            <div className="mt-1.5 h-2 overflow-hidden rounded-full border border-ink/20 bg-background">
              <div className="h-full rounded-full bg-heart transition-all" style={{ width: `${Math.min(100, (restValue / Math.max(1, gift.threshold)) * 100)}%` }} />
            </div>
          )}
        </div>
      )}

      <ul className="divide-y divide-ink/10">
        {picks.map((p) => {
          const d = draft[p.kind] || { option: 0, charger: p.chargers?.preselect?.model };
          const o = p.options[d.option] || p.options[0];
          const free = giftUnlocked && !giftTaken && p.kind === gift.kind;
          const now = free ? 0 : offerPrice(o.price, settings.offers[p.kind]);
          const creator = p.kind === "magneto" && isFlagship(anchor.device.brand, anchor.device.model);
          return (
            <li key={p.kind} className="px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-lg border border-ink/15 bg-muted">
                  {o.image ? <img src={sizedImage(o.image, 120)} alt="" loading="lazy" className="size-full object-cover" /> : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 truncate text-sm font-bold leading-tight">
                    {p.heading}
                    {creator && <span className="rounded bg-ink px-1 text-[9px] font-bold uppercase tracking-wide text-background">Creator pick</span>}
                  </span>
                  <span className="mt-0.5 flex items-center gap-1 truncate text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                    <CheckIcon className="size-3 shrink-0" strokeWidth={3} /> {creator ? "Record 4K straight to an SSD" : p.fit}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className={cn("block text-sm font-extrabold tabular-nums", free && "text-heart")}>{free ? "FREE" : `₹${now}`}</span>
                  {now < o.price && <span className="block text-[11px] text-muted-foreground line-through tabular-nums">₹{o.price}</span>}
                </span>
                <button
                  type="button" onClick={() => void add(p)} disabled={adding === p.kind}
                  className="sticker-sm sticker-press grid size-9 shrink-0 place-items-center rounded-lg bg-brand text-brand-foreground"
                  aria-label={`Add ${p.heading}`}
                >
                  {adding === p.kind ? <LoaderIcon className="size-4 animate-spin" /> : <PlusIcon className="size-4" strokeWidth={3} />}
                </button>
              </div>
              {(p.options.length > 1 || p.chargers) && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-[3.75rem]">
                  {p.options.length > 1 && p.options.map((opt, i) => (
                    <button key={opt.variantId} type="button" onClick={() => setDraft((s) => ({ ...s, [p.kind]: { ...d, option: i } }))}
                      className={cn("rounded-full border-2 px-2 py-0.5 text-[11px] font-semibold", i === d.option ? "border-ink bg-ink text-background" : "border-ink/20")}>
                      {opt.label}
                    </button>
                  ))}
                  {p.chargers && (
                    <select value={d.charger || ""} onChange={(e) => setDraft((s) => ({ ...s, [p.kind]: { ...d, charger: e.target.value || undefined } }))}
                      className="h-7 min-w-0 max-w-full flex-1 rounded-md border-2 border-ink/20 bg-background px-1.5 text-xs font-semibold">
                      <option value="">Choose your charger…</option>
                      {p.chargers.options.map((c) => <option key={c.model} value={c.model}>{c.model}</option>)}
                    </select>
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
