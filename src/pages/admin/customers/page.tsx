import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@/lib/firebase-hooks";
import { api } from "@/lib/firebase-api";
import { AdminLayout } from "@/components/admin-layout.tsx";
import { Authenticated, Unauthenticated, AuthLoading } from "@/lib/firebase-hooks";
import { SignInButton } from "@/components/ui/signin.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty.tsx";
import {
  UsersIcon, SearchIcon, IndianRupeeIcon, RotateCcwIcon, WalletIcon,
  MessageCircleIcon, AlertTriangleIcon,
} from "lucide-react";

/**
 * The people, rather than the orders.
 *
 * There was no such page. Every order was an island: you could not ask
 * whether this customer had bought before, whether they had ever kept a
 * parcel, or how much of their money the shop was already holding. The one
 * question that costs real money — "should this person be allowed COD?" —
 * could not be asked at all, and this shop has more returned parcels than
 * delivered ones.
 *
 * Customers are grouped by email, because most orders here are guests' and a
 * guest never appears in the users collection. The phone covers the older
 * orders that carry no email at all.
 */

type Customer = {
  key: string; email: string; phone: string; name: string; city: string;
  userId: string | null; orders: number; spent: number;
  delivered: number; rto: number; cancelled: number; open: number;
  cod: number; prepaid: number; firstAt: number; lastAt: number;
  wallet: number; rtoRate: number; orderIds: string[];
};

const money = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const day = (ts: number) =>
  ts ? new Date(ts).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" }) : "—";

type Sort = "recent" | "spent" | "orders" | "risk";

function CustomersPageInner() {
  const customers = useQuery(api.admin.customers.getAll) as Customer[] | undefined;
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<Sort>("recent");
  const [riskOnly, setRiskOnly] = useState(false);

  const rows = useMemo(() => {
    let list = customers || [];
    const q = search.trim().toLowerCase();
    if (q) {
      const digits = q.replace(/\D/g, "");
      list = list.filter((c) =>
        c.name.toLowerCase().includes(q) ||
        c.email.includes(q) ||
        (digits.length >= 4 && c.phone.includes(digits)) ||
        c.city.toLowerCase().includes(q)
      );
    }
    // Somebody who has sent a parcel back at least once, and more than they kept.
    if (riskOnly) list = list.filter((c) => c.rto > 0);
    const sorted = [...list];
    if (sort === "spent") sorted.sort((a, b) => b.spent - a.spent);
    else if (sort === "orders") sorted.sort((a, b) => b.orders - a.orders);
    else if (sort === "risk") sorted.sort((a, b) => b.rto - a.rto || b.rtoRate - a.rtoRate);
    else sorted.sort((a, b) => b.lastAt - a.lastAt);
    return sorted;
  }, [customers, search, sort, riskOnly]);

  const totals = useMemo(() => {
    const list = customers || [];
    return {
      people: list.length,
      repeat: list.filter((c) => c.orders > 1).length,
      risky: list.filter((c) => c.rto > 0).length,
      wallet: list.reduce((n, c) => n + c.wallet, 0),
    };
  }, [customers]);

  if (customers === undefined) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="admin-brandy space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Customers</h1>
        <div className="mt-1.5 h-1 w-14 rounded-full bg-brand" />
        <p className="mt-2 text-sm text-muted-foreground">
          {totals.people} people · {totals.repeat} have ordered more than once · {totals.risky} have
          had a parcel come back · {money(totals.wallet)} sitting in wallets
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[16rem] flex-1">
          <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Name, email, phone or city…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {([
          ["recent", "Recent"],
          ["spent", "Spent most"],
          ["orders", "Most orders"],
          ["risk", "Most returns"],
        ] as const).map(([v, label]) => (
          <Button
            key={v}
            variant={sort === v ? "default" : "outline"}
            size="sm"
            onClick={() => setSort(v)}
          >
            {label}
          </Button>
        ))}
        <Button
          variant={riskOnly ? "default" : "outline"}
          size="sm"
          onClick={() => setRiskOnly((x) => !x)}
        >
          <AlertTriangleIcon className="mr-1.5 size-3.5" />
          Returned before
        </Button>
      </div>

      {rows.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon"><UsersIcon /></EmptyMedia>
            <EmptyTitle>Nobody here</EmptyTitle>
            <EmptyDescription>
              {search ? "No customer matches that." : "Customers appear once they have placed an order."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="tile overflow-hidden rounded-xl">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b-2 border-ink/10 bg-muted/60">
                <tr className="[&>th]:px-3 [&>th]:py-2.5 [&>th]:text-left [&>th]:text-[11px] [&>th]:font-semibold [&>th]:uppercase [&>th]:tracking-wider [&>th]:text-muted-foreground">
                  <th>Customer</th>
                  <th className="!text-right">Orders</th>
                  <th className="!text-right">Spent</th>
                  <th>Outcome</th>
                  <th>Pays by</th>
                  <th className="!text-right">Wallet</th>
                  <th>Last order</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((c) => {
                  // Two returns, or more back than kept, is the shape worth seeing.
                  const risky = c.rto >= 2 || (c.rto > 0 && c.rtoRate >= 0.5);
                  return (
                    <tr key={c.key} className="transition-colors hover:bg-brand/[0.04]">
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{c.name || "—"}</span>
                          {c.phone && (
                            <a
                              href={`https://wa.me/91${c.phone}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Message on WhatsApp"
                              className="text-muted-foreground hover:text-green-600"
                            >
                              <MessageCircleIcon className="size-3.5" />
                            </a>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {c.email || (c.phone ? `+91 ${c.phone}` : "no email")}
                          {c.city ? ` · ${c.city}` : ""}
                        </div>
                      </td>

                      <td className="px-3 py-2.5 text-right">
                        <div className="text-sm font-semibold tabular-nums">{c.orders}</div>
                        {c.open > 0 && <div className="text-xs text-muted-foreground">{c.open} open</div>}
                      </td>

                      <td className="px-3 py-2.5 text-right">
                        <div className="text-sm font-semibold tabular-nums">{money(c.spent)}</div>
                        <div className="text-xs text-muted-foreground">
                          {c.orders > 0 ? money(c.spent / c.orders) : "—"} avg
                        </div>
                      </td>

                      {/*
                        The COD decision lives in this column: what happened to
                        the parcels this person has already been sent.
                      */}
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="rounded-full bg-green-500/10 px-2 py-0.5 font-medium text-green-700 dark:text-green-400">
                            {c.delivered} kept
                          </span>
                          {c.rto > 0 && (
                            <span className={`rounded-full px-2 py-0.5 font-medium ${
                              risky
                                ? "bg-red-500/15 text-red-700 dark:text-red-400"
                                : "bg-orange-500/10 text-orange-700 dark:text-orange-400"
                            }`}>
                              <RotateCcwIcon className="mr-1 inline size-3" />
                              {c.rto} back
                            </span>
                          )}
                        </div>
                        {risky && (
                          <div className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">
                            Ask for prepaid
                          </div>
                        )}
                      </td>

                      <td className="px-3 py-2.5 text-xs text-muted-foreground">
                        {c.cod > 0 && <div>{c.cod} COD</div>}
                        {c.prepaid > 0 && <div>{c.prepaid} prepaid</div>}
                      </td>

                      <td className="px-3 py-2.5 text-right">
                        {c.wallet > 0 ? (
                          <span className="inline-flex items-center gap-1 text-sm font-medium tabular-nums text-brand">
                            <WalletIcon className="size-3.5" />
                            {money(c.wallet)}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>

                      <td className="px-3 py-2.5">
                        <div className="text-sm">{day(c.lastAt)}</div>
                        <Link
                          to={`/backend-skinly/orders?q=${encodeURIComponent(c.email || c.phone)}`}
                          className="text-xs text-brand hover:underline"
                        >
                          See orders
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        <IndianRupeeIcon className="mr-1 inline size-3" />
        Spent counts orders whose payment arrived, or that were delivered — so a COD parcel on its
        way is not money yet.
      </p>
    </div>
  );
}

export default function AdminCustomersPage() {
  return (
    <AdminLayout>
      <Unauthenticated>
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon"><UsersIcon /></EmptyMedia>
            <EmptyTitle>Please sign in to access admin</EmptyTitle>
            <EmptyDescription>You need to be logged in to view customers</EmptyDescription>
          </EmptyHeader>
          <SignInButton />
        </Empty>
      </Unauthenticated>
      <AuthLoading>
        <Skeleton className="h-96 w-full" />
      </AuthLoading>
      <Authenticated>
        <CustomersPageInner />
      </Authenticated>
    </AdminLayout>
  );
}
