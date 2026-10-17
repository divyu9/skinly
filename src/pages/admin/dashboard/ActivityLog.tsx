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
};

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
 * The last 20 things that happened in the shop, newest first (functions:
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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res: any = await httpsCallable(getFunctions(), "adminActivity")({ limit: 20 });
      setEvents(res.data?.events || []);
      setError("");
    } catch (e: any) {
      setError(e?.message || "Could not load activity");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(() => { void load(); }, 60_000);
    const relabel = setInterval(() => tick((n) => n + 1), 30_000);
    const onFocus = () => { void load(); };
    window.addEventListener("focus", onFocus);
    return () => { clearInterval(t); clearInterval(relabel); window.removeEventListener("focus", onFocus); };
  }, [load]);

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
          <span className="text-xs font-medium text-muted-foreground">last 20 events</span>
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
                    {e.kind !== "review" && <ChevronRightIcon className="size-4 text-muted-foreground group-hover:text-ink" />}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
