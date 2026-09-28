import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { getFunctions, httpsCallable } from "firebase/functions";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  AlertTriangleIcon, ArrowDownRightIcon, ArrowUpRightIcon, BellRingIcon, BugIcon, CheckCircle2Icon, ChevronRightIcon,
  ClockIcon, CreditCardIcon, ExternalLinkIcon, FlameIcon, PackageIcon, PlusIcon, RefreshCwIcon, RocketIcon,
  ShoppingBagIcon, SmartphoneIcon, SparklesIcon, StarIcon, TruckIcon, WalletIcon,
} from "lucide-react";
import { AdminLayout } from "@/components/admin-layout.tsx";
import { Authenticated, AuthLoading, Unauthenticated } from "@/lib/firebase-hooks";
import { SignInButton } from "@/components/ui/signin.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { auth } from "@/lib/firebase";
import { sizedImage } from "@/lib/image-cdn";
import { designNameOf } from "@/lib/pack-list";
import { adminStatusLabel, STATUS_BADGE } from "@/lib/order-label.ts";
import { cn } from "@/lib/utils.ts";

/**
 * Admin home. One callable (adminDashboard) returns every figure on the
 * page; the last answer is kept in sessionStorage so coming back to this tab
 * paints at once and refreshes underneath, and it refreshes itself every
 * five minutes while open.
 */

type Period = { orders: number; sales: number };
type Dashboard = {
  generatedAt: number;
  kpis: {
    today: Period; yesterdaySoFar: Period; yesterday: Period; month: Period; lastMonth: Period;
    last30: Period; prev30: Period; aov30: number; aovPrev30: number; codShare: number; repeat30: number;
  };
  daily: Array<{ day: string; orders: number; sales: number }>;
  hours: number[];
  topProducts: Array<{ productId: string; title: string; image: string; qty: number; sales: number }>;
  topModels: Array<{ model: string; qty: number }>;
  tasks: {
    toPack: number; oldestToPackHours: number; readyToShip: number; pickupLate: number; inTransit: number; slow: number;
    undelivered: number; rto30: number; unpaid: number; unpaidValue: number; carts: number; cartsValue: number;
    reviews: number; followUps?: number; modelRequests: number; stockAlerts: number; bugs: number;
  };
  stock: {
    low: Array<{ code: string; name: string; left: number; unit: string; sold30: number; daysLeft: number | null }>;
    lowCount: number; soldOut: number; designs: number; outOfStockListings: number;
    demand: Array<{ title: string; sku: string; slug: string; count: number; latest: number }>;
  };
  wantedModels: Array<{ model: string; category: string; count: number }>;
  recentOrders: Array<{
    _id: string; orderNumber: string; customer: string; city: string; total: number; cod: boolean;
    status: string; createdAt: number; items: number; image: string;
  }>;
};

const CACHE = "skinly_admin_dashboard_v1";
const inr = (n: number) => `₹${Math.round(n || 0).toLocaleString("en-IN")}`;
const inrShort = (n: number) => (n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : n >= 1000 ? `₹${(n / 1000).toFixed(1)}k` : inr(n));
const pct = (now: number, before: number) => (before > 0 ? ((now - before) / before) * 100 : null);

function readCache(): Dashboard | null {
  try { return JSON.parse(sessionStorage.getItem(CACHE) || "null"); } catch { return null; }
}

function useDashboard() {
  const [data, setData] = useState<Dashboard | null>(readCache);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await httpsCallable(getFunctions(), "adminDashboard")({});
      const d = res.data as Dashboard;
      setData(d);
      setError(null);
      try { sessionStorage.setItem(CACHE, JSON.stringify(d)); } catch { /* storage full or blocked: the page still works */ }
    } catch (e: any) {
      setError(e?.message || "Could not load the dashboard");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
    const t = setInterval(() => { if (document.visibilityState === "visible") void load(); }, 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [load]);
  return { data, loading, error, reload: load };
}

/** "just now", "4 min ago": re-rendered each minute so it never goes stale on screen. */
function useAgo(ts?: number) {
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 60_000); return () => clearInterval(t); }, []);
  if (!ts) return "";
  const m = Math.floor((Date.now() - ts) / 60000);
  return m < 1 ? "just now" : m < 60 ? `${m} min ago` : `${Math.floor(m / 60)} h ago`;
}

// ─── Building blocks ─────────────────────────────────────────────────────────

function Panel({ title, icon, action, children, className }: { title: string; icon?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("tile flex flex-col rounded-2xl", className)}>
      <header className="flex items-center justify-between gap-3 border-b-2 border-ink/10 px-5 py-3.5">
        <h2 className="flex items-center gap-2 text-sm font-bold tracking-tight">
          {icon}
          {title}
        </h2>
        {action}
      </header>
      <div className="flex-1 p-5">{children}</div>
    </section>
  );
}

function PanelLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="flex items-center gap-0.5 text-xs font-semibold text-brand-deep hover:underline">
      {children} <ChevronRightIcon className="size-3.5" />
    </Link>
  );
}

function Delta({ value, suffix = "" }: { value: number | null; suffix?: string }) {
  if (value === null || !Number.isFinite(value)) return <span className="text-xs font-medium text-muted-foreground">no earlier data</span>;
  const up = value >= 0;
  return (
    <span className={cn(
      "inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[11px] font-bold tabular-nums",
      up ? "border-emerald-600/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "border-heart/25 bg-heart/10 text-heart",
    )}>
      {up ? <ArrowUpRightIcon className="size-3" /> : <ArrowDownRightIcon className="size-3" />}
      {Math.abs(value).toFixed(0)}%{suffix}
    </span>
  );
}

/** A tiny trend line, drawn by hand: a chart library per tile would be four times the weight. */
function Sparkline({ values, className }: { values: number[]; className?: string }) {
  const w = 120, h = 36;
  const max = Math.max(1, ...values);
  const pts = values.map((v, i) => [(i / Math.max(1, values.length - 1)) * w, h - 3 - (v / max) * (h - 6)] as const);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={cn("h-9 w-full", className)} preserveAspectRatio="none" aria-hidden>
      <path d={`${line} L${w},${h} L0,${h} Z`} className="fill-brand/15" />
      <path d={line} className="fill-none stroke-brand" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function Kpi({ label, value, delta, compare, spark, icon, tone }: {
  label: string; value: string; delta: number | null; compare: string; spark?: number[]; icon: ReactNode; tone: string;
}) {
  return (
    <div className="tile relative overflow-hidden rounded-2xl p-5">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">{label}</span>
        <span className={cn("grid size-8 place-items-center rounded-lg border-2 border-ink", tone)}>{icon}</span>
      </div>
      <div className="mt-2 text-[2rem] font-extrabold leading-none tracking-tight tabular-nums">{value}</div>
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <Delta value={delta} />
        <span className="text-xs text-muted-foreground">{compare}</span>
      </div>
      {spark && <Sparkline values={spark} className="mt-3" />}
    </div>
  );
}

function TaskRow({ to, icon, tone, label, hint, count, urgent }: {
  to: string; icon: ReactNode; tone: string; label: string; hint: string; count: number | string; urgent?: boolean;
}) {
  const zero = count === 0 || count === "0";
  return (
    <Link to={to} className={cn("group flex items-center gap-3 rounded-xl px-2.5 py-2 transition-colors hover:bg-muted", zero && "opacity-55")}>
      <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg", tone)}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold leading-tight">{label}</span>
        <span className="block truncate text-xs text-muted-foreground">{hint}</span>
      </span>
      {zero ? (
        <CheckCircle2Icon className="size-5 text-emerald-600" />
      ) : (
        <span className={cn(
          "min-w-9 rounded-lg border-2 border-ink px-2 py-0.5 text-center text-sm font-extrabold tabular-nums shadow-[2px_2px_0_0_var(--ink)]",
          urgent ? "bg-sunny text-ink" : "bg-card",
        )}>{count}</span>
      )}
      <ChevronRightIcon className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

function ChartTip({ active, payload, metric }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border-2 border-ink bg-card px-3 py-2 text-xs shadow-[3px_3px_0_0_var(--ink)]">
      <p className="font-bold">{new Date(p.day + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}</p>
      <p className="mt-0.5 tabular-nums"><b>{inr(p.sales)}</b> · {p.orders} order{p.orders === 1 ? "" : "s"}</p>
      {metric === "orders" && p.orders > 0 && <p className="text-muted-foreground">avg {inr(p.sales / p.orders)}</p>}
    </div>
  );
}

function Thumb({ src, alt }: { src: string; alt: string }) {
  const [broken, setBroken] = useState(false);
  return (
    <span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-lg border-2 border-ink/15 bg-muted">
      {src && !broken
        ? <img src={sizedImage(src, 96)} alt={alt} loading="lazy" onError={() => setBroken(true)} className="size-full object-cover" />
        : <PackageIcon className="size-4 text-muted-foreground" />}
    </span>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

function DashboardInner() {
  const { data, loading, error, reload } = useDashboard();
  const [metric, setMetric] = useState<"sales" | "orders">("sales");
  const ago = useAgo(data?.generatedAt);
  const name = (auth.currentUser?.displayName || "").split(" ")[0];

  const chart = useMemo(() => (data?.daily || []).map((d) => ({ ...d, label: new Date(d.day + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" }) })), [data]);

  if (!data) {
    return error ? (
      <div className="tile mx-auto mt-16 max-w-md rounded-2xl p-8 text-center">
        <AlertTriangleIcon className="mx-auto size-8 text-heart" />
        <p className="mt-3 font-bold">Dashboard didn't load</p>
        <p className="mt-1 text-sm text-muted-foreground">{error}</p>
        <button onClick={() => void reload()} className="tile tile-press mt-5 rounded-lg bg-brand px-4 py-2 text-sm font-bold text-brand-foreground">Try again</button>
      </div>
    ) : <DashboardSkeleton />;
  }

  const { kpis: k, tasks: t, stock } = data;
  const last7 = data.daily.slice(-7);
  const shipTotal = t.toPack + t.pickupLate + t.slow + t.undelivered;
  const peakHour = data.hours.indexOf(Math.max(...data.hours));
  const hourLabel = (h: number) => `${h % 12 || 12}${h < 12 ? "am" : "pm"}`;
  const maxModel = Math.max(1, ...data.topModels.map((m) => m.qty));
  const maxTop = Math.max(1, ...data.topProducts.map((p) => p.qty));

  return (
    <div className="admin-brandy space-y-6 pb-10">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <div className="halftone sticker relative overflow-hidden rounded-3xl px-6 py-6 md:px-8">
        {/* Doodles from the sleeve, kept to the corner the buttons never reach. */}
        <div className="pointer-events-none absolute -right-14 -top-20 size-40 rounded-full border-2 border-ink bg-blush/70" />
        <div className="pointer-events-none absolute right-28 -top-3 hidden size-7 rotate-12 rounded-md border-2 border-ink bg-sunny md:block" />
        <div className="pointer-events-none absolute right-16 top-[4.5rem] hidden size-3.5 rounded-full border-2 border-ink bg-brand md:block" />
        <div className="relative flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-deep">
              {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
            </p>
            <h1 className="mt-1 text-3xl font-extrabold tracking-tight md:text-4xl">
              {greeting()}{name ? `, ${name}` : ""} <span className="inline-block origin-bottom-right animate-[wave_1.6s_ease-in-out_1]">👋</span>
            </h1>
            <p className="mt-2 max-w-xl text-sm text-foreground/75">
              {k.today.orders
                ? <>Aaj ab tak <b>{k.today.orders} order{k.today.orders === 1 ? "" : "s"}</b> · <b>{inr(k.today.sales)}</b> ki bikri.</>
                : <>Aaj abhi tak koi order nahi — kal is waqt tak {k.yesterdaySoFar.orders} the.</>}
              {shipTotal > 0 ? <> {shipTotal} kaam aapka wait kar rahe hain.</> : <> Sab kaam clear hai. ✨</>}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => void reload()}
              className="flex items-center gap-1.5 rounded-lg border-2 border-ink/20 bg-card/80 px-3 py-2 text-xs font-semibold text-muted-foreground backdrop-blur hover:text-foreground"
              title="Refresh"
            >
              <RefreshCwIcon className={cn("size-3.5", loading && "animate-spin")} />
              {loading ? "Updating…" : `Updated ${ago}`}
            </button>
            <Link to="/backend-skinly/launch" className="sticker-sm sticker-press flex items-center gap-1.5 rounded-lg bg-card px-3.5 py-2 text-sm font-bold">
              <RocketIcon className="size-4" /> Quick Launch
            </Link>
            <Link to="/backend-skinly/orders" className="sticker-sm sticker-press flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-2 text-sm font-bold text-brand-foreground">
              <PlusIcon className="size-4" /> Orders
            </Link>
          </div>
        </div>
      </div>

      {error && (
        <p className="flex items-center gap-2 rounded-lg border border-heart/30 bg-heart/10 px-3 py-2 text-sm text-heart">
          <AlertTriangleIcon className="size-4" /> Showing the last figures — refresh failed: {error}
        </p>
      )}

      {/* ── KPIs ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="Today's sales" value={inr(k.today.sales)}
          delta={pct(k.today.sales, k.yesterdaySoFar.sales)} compare={`vs ${inr(k.yesterdaySoFar.sales)} yesterday by now`}
          spark={last7.map((d) => d.sales)} icon={<WalletIcon className="size-4" />} tone="bg-brand text-brand-foreground"
        />
        <Kpi
          label="Orders today" value={String(k.today.orders)}
          delta={pct(k.today.orders, k.yesterdaySoFar.orders)} compare={`${k.yesterday.orders} all of yesterday`}
          spark={last7.map((d) => d.orders)} icon={<ShoppingBagIcon className="size-4" />} tone="bg-sunny text-ink"
        />
        <Kpi
          label="This month" value={inr(k.month.sales)}
          delta={pct(k.month.sales, k.lastMonth.sales)} compare={`${k.month.orders} orders · vs last month so far`}
          spark={data.daily.map((d) => d.sales)} icon={<FlameIcon className="size-4" />} tone="bg-blush text-ink"
        />
        <Kpi
          label="Avg order value" value={inr(k.aov30)}
          delta={pct(k.aov30, k.aovPrev30)} compare={`30 days · ${Math.round(k.codShare * 100)}% COD · ${k.repeat30} repeat`}
          icon={<CreditCardIcon className="size-4" />} tone="bg-card text-ink"
        />
      </div>

      {/* ── Trend + tasks ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Panel
          className="xl:col-span-2"
          title="Last 30 days"
          icon={<SparklesIcon className="size-4 text-brand" />}
          action={
            <div className="flex rounded-lg border-2 border-ink p-0.5 text-xs font-bold">
              {(["sales", "orders"] as const).map((m) => (
                <button key={m} onClick={() => setMetric(m)}
                  className={cn("rounded-md px-2.5 py-1 capitalize transition-colors", metric === m ? "bg-ink text-background" : "text-muted-foreground hover:text-foreground")}>
                  {m}
                </button>
              ))}
            </div>
          }
        >
          <div className="mb-4 flex flex-wrap items-baseline gap-x-6 gap-y-1">
            <div>
              <span className="text-2xl font-extrabold tabular-nums">{metric === "sales" ? inr(k.last30.sales) : k.last30.orders}</span>
              <span className="ml-2 text-xs text-muted-foreground">{metric === "sales" ? "sales" : "orders"} in 30 days</span>
            </div>
            <Delta value={metric === "sales" ? pct(k.last30.sales, k.prev30.sales) : pct(k.last30.orders, k.prev30.orders)} suffix=" vs previous 30" />
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chart} margin={{ left: -12, right: 4, top: 6, bottom: 0 }}>
                <defs>
                  <linearGradient id="dashFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--brand)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--brand)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="3 4" stroke="var(--border)" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} interval="preserveStartEnd" minTickGap={24} />
                <YAxis tickLine={false} axisLine={false} width={48} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  tickFormatter={(v) => (metric === "sales" ? inrShort(v) : String(v))} allowDecimals={false} />
                <Tooltip content={<ChartTip metric={metric} />} cursor={{ stroke: "var(--ink)", strokeWidth: 1, strokeDasharray: "3 3" }} />
                <Area type="monotone" dataKey={metric} stroke="var(--brand)" strokeWidth={2.5} fill="url(#dashFill)"
                  activeDot={{ r: 5, stroke: "var(--ink)", strokeWidth: 2, fill: "var(--brand)" }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Aaj ke kaam" icon={<CheckCircle2Icon className="size-4 text-brand" />}>
          <div className="-mx-2.5 space-y-0.5">
            <TaskRow to="/backend-skinly/orders?status=processing" icon={<PackageIcon className="size-4" />} tone="bg-purple-500/15 text-purple-700 dark:text-purple-300"
              label="Pack karna hai" hint={t.toPack ? `Sabse purana ${t.oldestToPackHours}h se` : "Kuch pack karna baaki nahi"} count={t.toPack} urgent={t.oldestToPackHours >= 24} />
            <TaskRow to="/backend-skinly/orders?status=ready_to_ship" icon={<TruckIcon className="size-4" />} tone="bg-sky-500/15 text-sky-700 dark:text-sky-300"
              label="Pickup baaki" hint={t.pickupLate ? `${t.pickupLate} ko 2+ din ho gaye` : `${t.readyToShip} packed, courier ka wait`} count={t.readyToShip} urgent={t.pickupLate > 0} />
            <TaskRow to="/backend-skinly/orders?status=undelivered" icon={<AlertTriangleIcon className="size-4" />} tone="bg-amber-500/15 text-amber-700 dark:text-amber-300"
              label="Delivery atki" hint={`${t.undelivered} failed · ${t.slow} 6+ din se transit mein`} count={t.undelivered + t.slow} urgent />
            <TaskRow to="/backend-skinly/orders?status=pending_payment" icon={<CreditCardIcon className="size-4" />} tone="bg-yellow-500/15 text-yellow-700 dark:text-yellow-300"
              label="Payment adhoori (24h)" hint={t.unpaid ? `${inr(t.unpaidValue)} — ek reminder door` : "Koi adhoori payment nahi"} count={t.unpaid} />
            <TaskRow to="/backend-skinly/abandoned-carts" icon={<ShoppingBagIcon className="size-4" />} tone="bg-blush/60 text-ink"
              label="Abandoned carts (48h)" hint={t.carts ? `${inr(t.cartsValue)} cart mein pada hai` : "Sab clear"} count={t.carts} />
            <div className="mx-2.5 my-1.5 border-t border-dashed border-ink/15" />
            <TaskRow to="/backend-skinly/reviews" icon={<StarIcon className="size-4" />} tone="bg-sunny/40 text-ink"
              label="Reviews approve karne" hint="Approve pe cashback jaata hai" count={t.reviews} />
            <TaskRow to="/backend-skinly/reviews" icon={<AlertTriangleIcon className="size-4" />} tone="bg-heart/15 text-heart"
              label="Naraaz customers (1–3★)" hint="Call karke problem solve karo" count={t.followUps || 0} urgent />
            <TaskRow to="/backend-skinly/models?tab=requests" icon={<SmartphoneIcon className="size-4" />} tone="bg-brand/15 text-brand-deep"
              label="Model requests" hint="Naye phones ki maang" count={t.modelRequests} />
            <TaskRow to="/backend-skinly/stock-notifications" icon={<BellRingIcon className="size-4" />} tone="bg-indigo-500/15 text-indigo-700 dark:text-indigo-300"
              label="Stock alerts" hint="Log wapas aane ka wait kar rahe hain" count={t.stockAlerts} />
            <TaskRow to="/backend-skinly/bugs" icon={<BugIcon className="size-4" />} tone="bg-heart/15 text-heart"
              label="Bug reports" hint="Customers ki bheji problems" count={t.bugs} />
          </div>
        </Panel>
      </div>

      {/* ── Orders · bestsellers · stock ─────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
        <Panel title="Latest orders" icon={<ShoppingBagIcon className="size-4 text-brand" />} action={<PanelLink to="/backend-skinly/orders?status=all">All orders</PanelLink>}>
          <ul className="-my-1 divide-y divide-ink/10">
            {data.recentOrders.map((o) => (
              <li key={o._id}>
                <Link to={`/backend-skinly/orders/${o._id}`} className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-muted">
                  <Thumb src={o.image} alt="" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 text-sm font-bold">
                      {o.orderNumber}
                      {o.cod && <span className="rounded border border-ink/20 px-1 text-[10px] font-bold text-muted-foreground">COD</span>}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {o.customer || "Customer"}{o.city ? ` · ${o.city}` : ""} · {o.items} item{o.items === 1 ? "" : "s"}
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="block text-sm font-bold tabular-nums">{inr(o.total)}</span>
                    <span className={cn("mt-0.5 inline-block rounded-full border px-1.5 text-[10px] font-semibold", STATUS_BADGE[o.status])}>{adminStatusLabel(o.status)}</span>
                  </span>
                </Link>
              </li>
            ))}
            {!data.recentOrders.length && <li className="py-8 text-center text-sm text-muted-foreground">No orders yet</li>}
          </ul>
        </Panel>

        <Panel title="Bestsellers · 7 days" icon={<FlameIcon className="size-4 text-heart" />} action={<PanelLink to="/backend-skinly/products">Products</PanelLink>}>
          <ol className="space-y-3">
            {data.topProducts.map((p, i) => (
              <li key={p.productId || p.title}>
                <Link to={p.productId ? `/backend-skinly/products/${p.productId}` : "/backend-skinly/products"} className="group flex items-center gap-3">
                  <span className={cn("grid size-6 shrink-0 place-items-center rounded-md text-xs font-extrabold", i === 0 ? "border-2 border-ink bg-sunny" : "text-muted-foreground")}>{i + 1}</span>
                  <Thumb src={p.image} alt={p.title} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold group-hover:underline">{designNameOf(p.title)}</span>
                    <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-muted">
                      <span className="block h-full rounded-full bg-brand" style={{ width: `${(p.qty / maxTop) * 100}%` }} />
                    </span>
                  </span>
                  <span className="w-12 text-right text-sm font-bold tabular-nums">{p.qty} <span className="text-[10px] font-medium text-muted-foreground">pcs</span></span>
                </Link>
              </li>
            ))}
            {!data.topProducts.length && <li className="py-8 text-center text-sm text-muted-foreground">No sales this week yet</li>}
          </ol>
          {data.topModels.length > 0 && (
            <div className="mt-5 border-t border-dashed border-ink/15 pt-4">
              <p className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Top phones · 30 days</p>
              <div className="space-y-1.5">
                {data.topModels.map((m) => (
                  <div key={m.model} className="flex items-center gap-2 text-xs">
                    <span className="w-40 truncate font-medium">{m.model.replace(/\s+/g, " ")}</span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <span className="block h-full rounded-full bg-ink/70" style={{ width: `${(m.qty / maxModel) * 100}%` }} />
                    </span>
                    <span className="w-6 text-right font-bold tabular-nums">{m.qty}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Panel>

        <Panel
          className="lg:col-span-2 xl:col-span-1"
          title="Stock watch"
          icon={<AlertTriangleIcon className="size-4 text-amber-600" />}
          action={<span className="text-xs text-muted-foreground">{stock.soldOut} of {stock.designs} designs at zero</span>}
        >
          <p className="mb-3 text-xs text-muted-foreground">
            Designs that sold in the last 30 days and are out, or will be within 2 weeks at this pace.
          </p>
          <ul className="space-y-2">
            {stock.low.map((s) => {
              const out = s.left <= 0;
              const soon = !out && s.daysLeft !== null && s.daysLeft <= 7;
              return (
                <li key={s.code} className="flex items-center gap-3 rounded-xl border-2 border-ink/10 px-3 py-2">
                  <span className="rounded-md border-2 border-ink bg-card px-1.5 py-0.5 font-mono text-[11px] font-bold">{s.code}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{s.name || s.code}</span>
                    <span className="block text-xs text-muted-foreground">{s.sold30} sold in 30d · {s.left} {s.unit} left</span>
                  </span>
                  <span className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold",
                    out ? "bg-heart text-white" : soon ? "bg-sunny text-ink" : "bg-muted text-foreground",
                  )}>
                    {out ? "Sold out" : s.daysLeft !== null ? `~${s.daysLeft}d left` : "Low"}
                  </span>
                </li>
              );
            })}
            {!stock.low.length && (
              <li className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted-foreground">
                <CheckCircle2Icon className="size-6 text-emerald-600" /> Every selling design has stock
              </li>
            )}
          </ul>
          {stock.lowCount > stock.low.length && <p className="mt-3 text-xs text-muted-foreground">+{stock.lowCount - stock.low.length} more</p>}
        </Panel>
      </div>

      {/* ── Demand ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Panel title="Customers are waiting for" icon={<BellRingIcon className="size-4 text-indigo-600" />} action={<PanelLink to="/backend-skinly/stock-notifications">Stock alerts</PanelLink>}>
          <ul className="space-y-2.5">
            {stock.demand.map((d) => (
              <li key={d.title + d.sku} className="flex items-center gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg border-2 border-ink bg-sunny text-sm font-extrabold tabular-nums">{d.count}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{designNameOf(d.title)}</span>
                  <span className="block text-xs text-muted-foreground">{d.sku ? `${d.sku.toUpperCase()} · ` : ""}{d.count === 1 ? "1 person" : `${d.count} people`} waiting</span>
                </span>
                {d.slug && (
                  <a href={`/products/${d.slug}`} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground" title="Open listing">
                    <ExternalLinkIcon className="size-4" />
                  </a>
                )}
              </li>
            ))}
            {!stock.demand.length && <li className="py-6 text-center text-sm text-muted-foreground">Nobody waiting on stock</li>}
          </ul>
        </Panel>

        <Panel title="Most requested models" icon={<SmartphoneIcon className="size-4 text-brand" />} action={<PanelLink to="/backend-skinly/models?tab=requests">Requests</PanelLink>}>
          <ul className="space-y-2.5">
            {data.wantedModels.map((m) => (
              <li key={m.model} className="flex items-center gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg border-2 border-ink bg-brand/20 text-sm font-extrabold tabular-nums">{m.count}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{m.model}</span>
                  <span className="block text-xs capitalize text-muted-foreground">{m.category} · pending</span>
                </span>
              </li>
            ))}
            {!data.wantedModels.length && <li className="py-6 text-center text-sm text-muted-foreground">No pending requests</li>}
          </ul>
        </Panel>

        <Panel title="When people order" icon={<ClockIcon className="size-4 text-brand" />}>
          <p className="text-sm">
            Busiest around <b>{hourLabel(peakHour)}–{hourLabel((peakHour + 1) % 24)}</b>
            <span className="text-muted-foreground"> · last 30 days</span>
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">Ads aur WhatsApp broadcasts isse thoda pehle chalao.</p>
          <div className="mt-4 h-36">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.hours.map((n, h) => ({ h, n }))} margin={{ left: -28, right: 0, top: 4, bottom: 0 }}>
                <XAxis dataKey="h" tickLine={false} axisLine={false} interval={5} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickFormatter={hourLabel} />
                <YAxis hide allowDecimals={false} />
                <Tooltip cursor={{ fill: "var(--muted)" }} content={({ active, payload }: any) => active && payload?.length ? (
                  <div className="rounded-md border-2 border-ink bg-card px-2 py-1 text-xs font-semibold shadow-[2px_2px_0_0_var(--ink)]">
                    {hourLabel(payload[0].payload.h)} · {payload[0].payload.n} orders
                  </div>
                ) : null} />
                <Bar dataKey="n" radius={[4, 4, 0, 0]} fill="var(--brand)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg bg-muted px-3 py-2">
              <p className="text-muted-foreground">In transit</p>
              <p className="text-lg font-extrabold tabular-nums">{t.inTransit}</p>
            </div>
            <div className="rounded-lg bg-muted px-3 py-2">
              <p className="text-muted-foreground">RTO · 30d</p>
              <p className={cn("text-lg font-extrabold tabular-nums", t.rto30 > 0 && "text-heart")}>{t.rto30}</p>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-36 w-full rounded-3xl" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Skeleton className="h-96 rounded-2xl xl:col-span-2" />
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    </div>
  );
}

export default function AdminDashboardPage() {
  return (
    <AdminLayout>
      <Unauthenticated>
        <div className="py-20 text-center"><SignInButton /></div>
      </Unauthenticated>
      <AuthLoading><DashboardSkeleton /></AuthLoading>
      <Authenticated><DashboardInner /></Authenticated>
    </AdminLayout>
  );
}
