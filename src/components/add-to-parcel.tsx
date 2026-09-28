import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { toast } from "sonner";
import { CheckIcon, LoaderIcon, PackageOpenIcon, PlusIcon, TruckIcon } from "lucide-react";
import { db } from "@/lib/firebase";
import { loadCatalogue, loadModelCatalogue, type CatalogueModel, type CatalogueProduct } from "@/lib/catalogue";
import { sizedImage } from "@/lib/image-cdn";
import { buildSetupPicks, kindOf, offerPrice, withDefaults, type SetupPick, type SmartUpsellSettings } from "@/lib/smart-setup";
import { cn } from "@/lib/utils.ts";

/**
 * "Add to this parcel", on the customer's own order page while the order is
 * waiting to be packed: the Smart Setup add-ons that fit the phone in the
 * order, at the offer price, in the same parcel with no shipping. Choosing
 * some creates a small add-on order (createAddOnOrder, functions/src/addOns.ts)
 * and opens its payment page. Mirrors the server's window: confirmed, not yet
 * packed, within 72 hours.
 */

const WINDOW_MS = 72 * 3600 * 1000;

export function addOnWindowOpen(o: any): boolean {
  return !!o && !o.addOnTo && !!o.orderNumber && !o.isDeleted && !o.awbNumber && o.paymentStatus !== "failed" &&
    ["processing", "pending"].includes(String(o.status || "")) && Number(o.confirmedAt || o.createdAt || 0) > Date.now() - WINDOW_MS;
}

type Choice = { option: number; charger?: string };

export function AddToParcel({ order, orderId }: { order: any; orderId: string }) {
  const [data, setData] = useState<{ byId: Map<string, CatalogueProduct>; models: CatalogueModel[]; settings: SmartUpsellSettings } | null>(null);
  const [chosen, setChosen] = useState<Record<string, Choice>>({});
  const [busy, setBusy] = useState(false);
  const open = addOnWindowOpen(order) && order?.access !== "limited";

  useEffect(() => {
    if (!open) return;
    Promise.all([
      loadCatalogue(), loadModelCatalogue(),
      getDoc(doc(db, "settings", "smartUpsell")).then((s) => withDefaults(s.data())).catch(() => withDefaults(null)),
    ]).then(([c, m, s]) => c && setData({ byId: new Map(c.products.map((p) => [p._id, p])), models: m?.models || [], settings: s }));
  }, [open]);

  const { picks, device } = useMemo(() => {
    if (!data || !order) return { picks: [] as SetupPick[], device: null };
    const items: any[] = Array.isArray(order.items) ? order.items : [];
    const anchor = items.map((it) => ({ it, p: data.byId.get(String(it.productId)) }))
      .find(({ it, p }) => p && p.productCategory === "skin" && p.gadgetCategory !== "charger" && it.phoneModel && !it.upsellRuleId);
    if (!anchor?.p) return { picks: [] as SetupPick[], device: null };
    const dev = { brand: String(anchor.it.phoneBrand || ""), model: String(anchor.it.phoneModel), category: String(anchor.p.gadgetCategory || "phone") };
    const have = new Set(items.map((it) => kindOf(data.byId.get(String(it.productId)) || { title: "" })).filter(Boolean));
    const list = buildSetupPicks(anchor.p, dev, [...data.byId.values()], data.models, data.settings).filter((p) => !have.has(p.kind)).slice(0, 4);
    return { picks: list, device: dev };
  }, [data, order]);

  if (!open || !data || !picks.length || !device) return null;

  const draft = (p: SetupPick): Choice => chosen[p.kind] || { option: 0, charger: p.chargers?.preselect?.model };
  const priceOf = (p: SetupPick, c: Choice) => offerPrice((p.options[c.option] || p.options[0]).price, data.settings.offers[p.kind]);
  const selected = picks.filter((p) => chosen[p.kind]);
  const total = selected.reduce((s, p) => s + priceOf(p, chosen[p.kind]), 0);

  const toggle = (p: SetupPick) => setChosen((s) => {
    if (s[p.kind]) { const { [p.kind]: _, ...rest } = s; return rest; }
    return { ...s, [p.kind]: draft(p) };
  });
  const setChoice = (p: SetupPick, patch: Partial<Choice>) => setChosen((s) => ({ ...s, [p.kind]: { ...draft(p), ...patch } }));

  const pay = async () => {
    const missing = selected.find((p) => p.chargers && !p.chargers.options.some((c) => c.model === chosen[p.kind].charger));
    if (missing) { toast.error("Choose your charger for the charger skin"); return; }
    setBusy(true);
    try {
      const items = selected.map((p) => {
        const c = chosen[p.kind];
        const o = p.options[c.option] || p.options[0];
        const charger = p.chargers?.options.find((x) => x.model === c.charger);
        return {
          productId: o.productId, variant: o.variant, productImage: o.image, upsellRuleId: `smart:${p.kind}`,
          ...(charger ? { phoneBrand: charger.brand, phoneModel: charger.model } : {}),
        };
      });
      const k = new URLSearchParams(window.location.search).get("k") || undefined;
      const res: any = (await httpsCallable(getFunctions(), "createAddOnOrder")({ orderId, k, items })).data;
      window.location.href = res.payPath;
    } catch (e: any) {
      toast.error(e?.message || "Could not add to this order");
      setBusy(false);
    }
  };

  return (
    <section className="overflow-hidden rounded-2xl border-2 border-ink bg-card shadow-[3px_3px_0_0_var(--ink)]">
      <header className="flex items-start gap-3 border-b-2 border-ink/10 bg-sunny/40 px-4 py-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full border-2 border-ink bg-card"><PackageOpenIcon className="size-4" /></span>
        <div>
          <h3 className="text-sm font-extrabold">Add to this parcel before we pack it</h3>
          <p className="mt-0.5 text-xs text-foreground/75">
            <TruckIcon className="mr-1 inline size-3.5 align-[-2px]" />Same box, <b>no extra shipping</b> — picked for your {device.model}
          </p>
        </div>
      </header>
      <ul className="divide-y divide-ink/10">
        {picks.map((p) => {
          const on = !!chosen[p.kind];
          const c = draft(p);
          const o = p.options[c.option] || p.options[0];
          const now = priceOf(p, c);
          return (
            <li key={p.kind} className={cn("transition-colors", on && "bg-brand/[0.07]")}>
              <button type="button" onClick={() => toggle(p)} aria-pressed={on} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                <span className={cn("grid size-6 shrink-0 place-items-center rounded-md border-2 border-ink", on ? "bg-brand text-brand-foreground" : "bg-background")}>
                  {on ? <CheckIcon className="size-4" strokeWidth={3} /> : <PlusIcon className="size-3.5" strokeWidth={3} />}
                </span>
                <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-lg border border-ink/15 bg-muted">
                  {o.image ? <img src={sizedImage(o.image, 120)} alt="" loading="lazy" className="size-full object-cover" /> : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold">{p.heading}</span>
                  <span className="mt-0.5 block truncate text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">✓ {p.fit}</span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-sm font-extrabold tabular-nums">₹{now}</span>
                  {now < o.price && <span className="block text-[11px] text-muted-foreground line-through tabular-nums">₹{o.price}</span>}
                </span>
              </button>
              {on && (p.options.length > 1 || p.chargers) && (
                <div className="flex flex-wrap items-center gap-1.5 px-4 pb-3 pl-[3.25rem]">
                  {p.options.length > 1 && p.options.map((opt, i) => (
                    <button key={opt.variantId} type="button" onClick={() => setChoice(p, { option: i })}
                      className={cn("rounded-full border-2 px-2.5 py-0.5 text-[11px] font-semibold", i === c.option ? "border-ink bg-ink text-background" : "border-ink/20")}>
                      {opt.label}
                    </button>
                  ))}
                  {p.chargers && (
                    <select value={c.charger || ""} onChange={(e) => setChoice(p, { charger: e.target.value || undefined })}
                      className="h-7 min-w-0 max-w-full flex-1 rounded-md border-2 border-ink/20 bg-background px-1.5 text-xs font-semibold">
                      <option value="">Choose your charger…</option>
                      {p.chargers.options.map((x) => <option key={x.model} value={x.model}>{x.model}</option>)}
                    </select>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <div className="flex items-center justify-between gap-3 border-t-2 border-ink/10 px-4 py-3">
        <p className="text-xs text-muted-foreground">{selected.length ? <>Pay online · ships with <b className="text-foreground">#{String(order.orderNumber).replace(/^#/, "")}</b></> : "Tap to add — we pack within a few hours"}</p>
        <button type="button" onClick={() => void pay()} disabled={!selected.length || busy}
          className="sticker-sm sticker-press flex shrink-0 items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-bold text-brand-foreground disabled:opacity-50">
          {busy && <LoaderIcon className="size-4 animate-spin" />}
          {selected.length ? `Pay ₹${total}` : "Add"}
        </button>
      </div>
    </section>
  );
}

/** On an add-on's own page: it rides in the parent's parcel. */
export function AddOnOfBanner({ order }: { order: any }) {
  if (!order?.addOnTo) return null;
  return (
    <div className="flex items-start gap-3 rounded-2xl border-2 border-brand/40 bg-brand/10 p-4 text-sm">
      <PackageOpenIcon className="mt-0.5 size-5 shrink-0 text-brand-deep" />
      <p>
        <b>Added to order {order.parentOrderNumber ? `#${String(order.parentOrderNumber).replace(/^#/, "")}` : ""}.</b>{" "}
        These items go in the same parcel — track it on <Link to={`/orders/${order.addOnTo}`} className="font-semibold text-brand-deep underline">that order</Link>.
      </p>
    </div>
  );
}
