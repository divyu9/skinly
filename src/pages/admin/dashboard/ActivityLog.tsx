import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { getFunctions, httpsCallable } from "firebase/functions";
import { toast } from "sonner";
import {
  ActivityIcon, BellRingIcon, CheckIcon, ChevronRightIcon, RefreshCwIcon, ShoppingBagIcon, ShoppingCartIcon,
  SmartphoneIcon, StarIcon, TruckIcon, XIcon,
} from "lucide-react";
import { adminStatusLabel, STATUS_BADGE } from "@/lib/order-label.ts";
import { cn } from "@/lib/utils.ts";

type Event = {
  id: string;
  kind: "order" | "delivery" | "model" | "review" | "stock" | "cart";
  at: number;
  title: string;
  sub?: string;
  link: string;
  status?: string;
  reviewId?: string;
  phone?: string;
  name?: string;
  items?: { title: string; image?: string; device?: string; coverage?: string; variant?: string; price: number; qty: number }[];
};

const firstName = (n?: string) => {
  const f = String(n || "").trim().split(/\s+/)[0] || "";
  return /^\d+$/.test(f) ? "" : f.charAt(0).toUpperCase() + f.slice(1).toLowerCase();
};

/** The ready-to-send WhatsApp message for this row (opens wa.me with it typed in). */
function waMessage(e: Event): string {
  const hi = `Hi${firstName(e.name) ? ` ${firstName(e.name)}` : ""}, Skinly se baat kar rahe hain 🙂`;
  const what = (e.items || []).map((i) => `• ${i.title}${i.device ? ` — ${i.device}` : ""}${i.coverage ? ` (${i.coverage})` : ""}`).join("\n");
  switch (e.kind) {
    case "cart":
      return `${hi}\n\nAapne ye checkout mein add kiya tha:\n${what}\n\nOrder complete karne mein koi dikkat aayi? Model, payment ya delivery ke baare mein kuch bhi poochna ho to yahin reply kariye — hum turant help kar denge.`;
    case "order":
      return `${hi}\n\nAapka order mil gaya hai, thank you!\n${what}\n\nKoi bhi sawaal ho to yahin message kariye.`;
    case "model":
      return `${hi}\n\nAapne ${e.title.replace(/^.*requested /, "")} ke skin ki request ki thi. Hum aapko update dete hain jaise hi ye ready hota hai.`;
    case "stock":
      return `${hi}\n\nAapne ${e.title.replace(/^.*wants /, "").replace(/ back in stock$/, "")} ke liye stock alert lagaya tha.`;
    default:
      return hi;
  }
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.79-1.47-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.5h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.62.71.23 1.36.2 1.87.12.57-.08 1.75-.72 2-1.41.25-.69.25-1.29.17-1.41-.07-.12-.27-.2-.57-.35M12.05 21.5h-.01a9.4 9.4 0 0 1-4.8-1.31l-.34-.2-3.57.93.95-3.48-.22-.36a9.4 9.4 0 0 1-1.44-5.02c0-5.2 4.24-9.44 9.45-9.44a9.4 9.4 0 0 1 6.68 2.77 9.38 9.38 0 0 1 2.76 6.68c0 5.21-4.24 9.44-9.45 9.44m8.04-17.48A11.3 11.3 0 0 0 12.05.7C5.78.7.68 5.8.68 12.06c0 2 .52 3.96 1.52 5.68L.6 23.3l5.7-1.5a11.33 11.33 0 0 0 5.74 1.47h.01c6.27 0 11.37-5.1 11.37-11.37 0-3.04-1.18-5.9-3.33-8.04" />
    </svg>
  );
}

const KIND: Record<Event["kind"], { icon: ReactNode; tone: string }> = {
  order: { icon: <ShoppingBagIcon className="size-4" />, tone: "bg-brand text-brand-foreground" },
  delivery: { icon: <TruckIcon className="size-4" />, tone: "bg-heart text-white" },
  model: { icon: <SmartphoneIcon className="size-4" />, tone: "bg-sunny text-ink" },
  review: { icon: <StarIcon className="size-4" />, tone: "bg-blush text-ink" },
  stock: { icon: <BellRingIcon className="size-4" />, tone: "bg-muted text-ink" },
  cart: { icon: <ShoppingCartIcon className="size-4" />, tone: "bg-card text-ink border-2 border-ink/15" },
};

/** "just now", "12 min ago", "3 hours ago", "2 days ago". */
function ago(t: number) {
  const m = Math.floor((Date.now() - t) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.floor(h / 24);
  return `${d} day${d === 1 ? "" : "s"} ago`;
}

/** Whether the event still wants something from the admin. */
const needsAction = (e: Event) =>
  e.kind === "delivery" || e.kind === "cart" ||
  (e.kind === "review" && !!e.reviewId) ||
  (e.kind === "model" && e.status === "pending") ||
  (e.kind === "stock" && e.status === "waiting") ||
  (e.kind === "order" && ["processing", "confirmed", "pending"].includes(String(e.status)));

/**
 * The latest things that happened in the shop (20, or up to 200 with Show more), newest first (functions:
 * adminActivity): orders, failed deliveries, model requests, reviews, stock
 * alerts, checkouts left. Each row opens the page to act on it; a pending
 * review can be approved or rejected right here. Refreshes every minute.
 */
export function ActivityLog() {
  const [events, setEvents] = useState<Event[] | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [onlyAction, setOnlyAction] = useState(false);
  const [busy, setBusy] = useState("");
  const [, tick] = useState(0);
  // How far back: 20, then "Show more" goes to 50, 100 and 200.
  const [limit, setLimit] = useState(20);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res: any = await httpsCallable(getFunctions(), "adminActivity")({ limit });
      setEvents(res.data?.events || []);
      setError("");
    } catch (e: any) {
      setError(e?.message || "Could not load activity");
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    void load();
    // Every minute only for the short list: a 200-event read each minute would cost ~1,450 reads a go.
    const t = limit <= 20 ? setInterval(() => { void load(); }, 60_000) : undefined;
    const relabel = setInterval(() => tick((n) => n + 1), 30_000);
    const onFocus = () => { void load(); };
    window.addEventListener("focus", onFocus);
    return () => { if (t) clearInterval(t); clearInterval(relabel); window.removeEventListener("focus", onFocus); };
  }, [load, limit]);

  const moderate = async (e: Event, action: "approve" | "reject") => {
    if (!e.reviewId) return;
    setBusy(e.id);
    try {
      await httpsCallable(getFunctions(), "moderateReview")({ reviewId: e.reviewId, action });
      toast.success(action === "approve" ? "Review approved" : "Review rejected");
      setEvents((list) => (list || []).map((x) => (x.id === e.id ? { ...x, status: action === "approve" ? "approved" : "rejected", reviewId: undefined } : x)));
    } catch (err: any) {
      toast.error(err?.message || "Could not update the review");
    } finally {
      setBusy("");
    }
  };

  const shown = (events || []).filter((e) => !onlyAction || needsAction(e));
  const pendingCount = (events || []).filter(needsAction).length;

  return (
    <section className="tile flex flex-col rounded-2xl">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-ink/10 px-5 py-3.5">
        <h2 className="flex items-center gap-2 text-sm font-bold tracking-tight">
          <ActivityIcon className="size-4 text-brand" />
          Activity
          <span className="text-xs font-medium text-muted-foreground">last {limit} events</span>
        </h2>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border-2 border-ink/10 p-0.5 text-xs font-semibold">
            <button type="button" onClick={() => setOnlyAction(false)} className={cn("rounded-md px-2.5 py-1", !onlyAction && "bg-ink text-background")}>All</button>
            <button type="button" onClick={() => setOnlyAction(true)} className={cn("rounded-md px-2.5 py-1", onlyAction && "bg-ink text-background")}>
              Needs action{pendingCount ? ` · ${pendingCount}` : ""}
            </button>
          </div>
          <button type="button" onClick={() => void load()} disabled={loading} className="grid size-8 place-items-center rounded-lg border-2 border-ink/10 hover:border-ink/30" aria-label="Refresh activity">
            <RefreshCwIcon className={cn("size-4", loading && "animate-spin")} />
          </button>
        </div>
      </header>

      <div className="flex-1 p-2 sm:p-3">
        {error && <p className="px-3 py-2 text-sm text-heart">{error}</p>}
        {events === null && !error ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">Loading…</p>
        ) : shown.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">{onlyAction ? "Nothing waiting on you." : "No activity yet."}</p>
        ) : (
          <ul className="divide-y divide-ink/5">
            {shown.map((e) => {
              const k = KIND[e.kind];
              const orderBadge = (e.kind === "order" || e.kind === "delivery") && e.status;
              return (
                <li key={e.id} className="group relative flex items-start gap-3 rounded-xl px-3 py-2.5 hover:bg-muted/60">
                  <span className={cn("mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg", k.tone)}>{k.icon}</span>
                  <Link to={e.link} className="min-w-0 flex-1 after:absolute after:inset-0">
                    <p className="text-sm font-semibold leading-snug">{e.title}</p>
                    {e.sub && <p className="mt-0.5 truncate text-xs text-muted-foreground">{e.sub}</p>}
                    {!!e.items?.length && (
                      <div className="mt-1.5 flex flex-col gap-1.5">
                        {e.items.slice(0, 3).map((i, n) => (
                          <div key={n} className="flex items-center gap-2">
                            {i.image
                              ? <img src={i.image} alt="" loading="lazy" className="size-10 shrink-0 rounded-md border border-ink/10 bg-muted object-cover" />
                              : <span className="size-10 shrink-0 rounded-md border border-ink/10 bg-muted" />}
                            <div className="min-w-0 text-xs leading-tight">
                              <p className="truncate font-medium">{i.title}</p>
                              <p className="truncate text-muted-foreground">
                                {[i.device, i.coverage || (i.variant && i.variant !== i.device ? i.variant : ""), `₹${i.price}${i.qty > 1 ? ` × ${i.qty}` : ""}`].filter(Boolean).join(" · ")}
                              </p>
                            </div>
                          </div>
                        ))}
                        {e.items.length > 3 && <p className="text-[11px] text-muted-foreground">+{e.items.length - 3} more</p>}
                      </div>
                    )}
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{ago(e.at)}</p>
                  </Link>
                  <div className="relative z-10 flex shrink-0 flex-col items-end gap-1.5">
                    {orderBadge && (
                      <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", (STATUS_BADGE as any)[e.status!] || "bg-muted")}>
                        {adminStatusLabel(e.status as any)}
                      </span>
                    )}
                    {e.kind === "model" && (
                      <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", e.status === "pending" ? "bg-sunny text-ink" : "bg-muted text-muted-foreground")}>
                        {e.status === "pending" ? "Pending" : e.status}
                      </span>
                    )}
                    {e.kind === "review" && e.reviewId ? (
                      <div className="flex gap-1">
                        <button type="button" disabled={busy === e.id} onClick={() => moderate(e, "approve")}
                          className="flex items-center gap-1 rounded-md border-2 border-ink bg-brand px-2 py-1 text-[11px] font-bold text-brand-foreground disabled:opacity-50">
                          <CheckIcon className="size-3" /> Approve
                        </button>
                        <button type="button" disabled={busy === e.id} onClick={() => moderate(e, "reject")}
                          className="flex items-center gap-1 rounded-md border-2 border-ink/20 px-2 py-1 text-[11px] font-bold disabled:opacity-50">
                          <XIcon className="size-3" /> Reject
                        </button>
                      </div>
                    ) : e.kind === "review" ? (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">{e.status}</span>
                    ) : null}
                    {e.phone && e.kind !== "review" && (
                      <a href={`https://wa.me/91${e.phone}?text=${encodeURIComponent(waMessage(e))}`} target="_blank" rel="noopener noreferrer"
                        onClick={(ev) => ev.stopPropagation()} title={`WhatsApp ${e.phone}`}
                        className="flex items-center gap-1 rounded-md border-2 border-ink bg-[#25D366] px-2 py-1 text-[11px] font-bold text-ink hover:brightness-95">
                        <WhatsAppIcon className="size-3.5" /> WhatsApp
                      </a>
                    )}
                    {e.kind !== "review" && <ChevronRightIcon className="size-4 text-muted-foreground group-hover:text-ink" />}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {events !== null && (
          <div className="flex justify-center gap-2 px-3 pb-1 pt-2">
            {limit < 200 && events.length >= limit && (
              <button type="button" disabled={loading} onClick={() => setLimit((n) => (n < 50 ? 50 : n < 100 ? 100 : 200))}
                className="rounded-lg border-2 border-ink/15 px-3 py-1.5 text-xs font-bold hover:border-ink/40 disabled:opacity-50">
                {loading ? "Loading…" : `Show older events (${limit < 50 ? 50 : limit < 100 ? 100 : 200})`}
              </button>
            )}
            {limit > 20 && (
              <button type="button" onClick={() => setLimit(20)} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-ink">
                Show fewer
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
