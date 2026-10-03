import { useEffect, useMemo, useState } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";
import { toast } from "sonner";
import { BookUserIcon, DownloadIcon, LoaderIcon, RefreshCwIcon, SearchIcon } from "lucide-react";
import { AdminLayout } from "@/components/admin-layout.tsx";
import { Authenticated } from "@/lib/firebase-hooks";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";

/**
 * Admin › WhatsApp Contacts: every number the shop has, one row each, built
 * live from orders, model requests, Notify me, carts and accounts
 * (functions/src/contacts.ts). Filters for the usual segments and a CSV for
 * Authkey's broadcast upload.
 *
 * Offers go only to people who said yes: an order message is not permission
 * for marketing. Until the opt-in checkbox is live almost nobody is "opted
 * in", and the page says so rather than inviting a blast to everyone.
 */

type Contact = {
  phone: string; name: string; email: string; city: string;
  orders: number; spent: number; lastOrderAt: number; firstSeenAt: number; lastSeenAt: number;
  devices: string[]; sources: string[]; requested: string[]; waitingFor: string[];
  abandonedCart: boolean; optIn: boolean | null; optOut: boolean;
};

type Segment = "all" | "optin" | "buyers" | "repeat" | "lapsed" | "never" | "cart" | "requests" | "notify";
const SEGMENTS: { key: Segment; label: string; test: (c: Contact) => boolean }[] = [
  { key: "all", label: "Everyone", test: () => true },
  { key: "optin", label: "Opted in for offers", test: (c) => c.optIn === true && !c.optOut },
  { key: "buyers", label: "Customers", test: (c) => c.orders > 0 },
  { key: "repeat", label: "Repeat (2+ orders)", test: (c) => c.orders >= 2 },
  { key: "lapsed", label: "No order in 30+ days", test: (c) => c.orders > 0 && Date.now() - c.lastOrderAt > 30 * 86400000 },
  { key: "never", label: "Never ordered", test: (c) => c.orders === 0 },
  { key: "cart", label: "Left a cart", test: (c) => c.abandonedCart },
  { key: "requests", label: "Asked for a model", test: (c) => c.requested.length > 0 },
  { key: "notify", label: "Waiting for restock", test: (c) => c.waitingFor.length > 0 },
];

const rupees = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const day = (t: number) => (t ? new Date(t).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" }) : "—");

export default function AdminContactsPage() {
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [builtAt, setBuiltAt] = useState(0);
  const [loading, setLoading] = useState(false);
  const [segment, setSegment] = useState<Segment>("all");
  const [brand, setBrand] = useState("");
  const [q, setQ] = useState("");
  const [shown, setShown] = useState(100);

  const load = async () => {
    setLoading(true);
    try {
      const r: any = (await httpsCallable(getFunctions(), "listContacts")({})).data;
      setContacts(r.contacts || []);
      setBuiltAt(r.builtAt || Date.now());
    } catch (e: any) {
      toast.error(e?.message || "Could not load contacts");
    } finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  // Where replies to the business number are sent, so a STOP opts the sender out (whatsappInbound).
  const [inboundUrl, setInboundUrl] = useState("");
  useEffect(() => {
    httpsCallable(getFunctions(), "whatsappInboundUrl")({}).then((r: any) => setInboundUrl(r.data?.url || "")).catch(() => {});
  }, []);

  /** What the customer asked for, recorded by hand (a call, a chat): stop offers, or start again. */
  const setOffers = async (c: Contact, change: { optOut?: boolean; optIn?: boolean }) => {
    try {
      await httpsCallable(getFunctions(), "setContactMarketing")({ phone: c.phone, ...change });
      setContacts((all) => (all || []).map((x) => x.phone !== c.phone ? x
        : { ...x, optOut: change.optOut === true, optIn: change.optIn === true ? true : x.optIn }));
      toast.success(change.optOut ? `${c.phone} won't get offers` : `${c.phone} will get offers`);
    } catch (e: any) {
      toast.error(e?.message || "Could not save");
    }
  };

  const brands = useMemo(() => {
    const n = new Map<string, number>();
    for (const c of contacts || []) for (const d of [...c.devices, ...c.requested]) {
      const b = d.split(" ")[0];
      if (b) n.set(b, (n.get(b) || 0) + 1);
    }
    return [...n.entries()].sort((a, b) => b[1] - a[1]).map(([b]) => b);
  }, [contacts]);

  const counts = useMemo(() => Object.fromEntries(SEGMENTS.map((s) => [s.key, (contacts || []).filter(s.test).length])), [contacts]);

  const list = useMemo(() => {
    const seg = SEGMENTS.find((s) => s.key === segment)!;
    const needle = q.trim().toLowerCase();
    return (contacts || []).filter((c) =>
      seg.test(c) &&
      (!brand || [...c.devices, ...c.requested].some((d) => d.split(" ")[0] === brand)) &&
      (!needle || [c.phone, c.name, c.email, c.city, ...c.devices, ...c.requested].join(" ").toLowerCase().includes(needle))
    );
  }, [contacts, segment, brand, q]);

  const csv = () => {
    const head = ["phone", "name", "email", "city", "orders", "spent", "last_order", "devices", "sources", "asked_for", "waiting_for", "left_cart", "opt_in"];
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const rows = list.map((c) => [
      `91${c.phone}`, c.name, c.email, c.city, c.orders, Math.round(c.spent), day(c.lastOrderAt),
      c.devices.join(" | "), c.sources.join(" | "), c.requested.join(" | "), c.waitingFor.join(" | "),
      c.abandonedCart ? "yes" : "", c.optOut ? "opted out" : c.optIn === true ? "yes" : c.optIn === false ? "no" : "not asked",
    ].map(esc).join(","));
    const blob = new Blob(["﻿" + [head.join(","), ...rows].join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `goskinly-contacts-${segment}${brand ? `-${brand}` : ""}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const buyers = counts.buyers || 0;
  const spent = (contacts || []).reduce((s, c) => s + c.spent, 0);

  return (
    <AdminLayout>
      <Authenticated>
        <div className="mx-auto max-w-6xl space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="flex items-center gap-2 text-3xl font-extrabold"><BookUserIcon className="size-7" /> WhatsApp Contacts</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Built automatically from orders, model requests, Notify me, carts and accounts{builtAt ? ` · updated ${new Date(builtAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}` : ""}.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => void load()} disabled={loading}>
                {loading ? <LoaderIcon className="mr-2 size-4 animate-spin" /> : <RefreshCwIcon className="mr-2 size-4" />}Refresh
              </Button>
              <Button onClick={csv} disabled={!list.length}><DownloadIcon className="mr-2 size-4" />Download CSV ({list.length})</Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["Contacts", (contacts?.length ?? 0).toLocaleString("en-IN")],
              ["Customers", buyers.toLocaleString("en-IN")],
              ["Repeat customers", (counts.repeat || 0).toLocaleString("en-IN")],
              ["Lifetime sales", rupees(spent)],
            ].map(([k, v]) => (
              <div key={k} className="rounded-2xl border-2 border-ink bg-card p-4 shadow-[3px_3px_0_0_var(--ink)]">
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{k}</p>
                <p className="mt-1 text-2xl font-extrabold">{contacts ? v : "…"}</p>
              </div>
            ))}
          </div>

          <div className="rounded-xl border-2 border-ink bg-[#fff4d6] p-3 text-sm">
            <b>Offers only to "Opted in".</b> An order or shipping message is not permission for marketing — sending offers to everyone gets the number reported and restricted.
            {(counts.optin || 0) === 0 && " Nobody has opted in yet; the opt-in checkbox is live at checkout, in the model-request forms and on Notify me."}
            {" "}A customer who replies STOP is opted out automatically once the webhook below is set in Fast2SMS.
          </div>

          {inboundUrl && (
            <details className="rounded-xl border-2 border-dashed border-ink/40 p-3 text-sm">
              <summary className="cursor-pointer font-semibold">STOP replies: webhook URL for Fast2SMS</summary>
              <p className="mt-2 text-muted-foreground">Fast2SMS › WhatsApp › Webhook (incoming messages): paste this URL. Keep it private — it carries a secret.</p>
              <code className="mt-2 block break-all rounded bg-muted p-2 text-xs">{inboundUrl}</code>
              <Button size="sm" variant="outline" className="mt-2" onClick={() => { void navigator.clipboard.writeText(inboundUrl); toast.success("Copied"); }}>Copy</Button>
            </details>
          )}

          <div className="flex flex-wrap gap-2">
            {SEGMENTS.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => { setSegment(s.key); setShown(100); }}
                className={`rounded-full border-2 px-3 py-1 text-sm font-semibold ${segment === s.key ? "border-ink bg-[#28a58b] text-ink" : "border-muted bg-background text-muted-foreground hover:border-ink"}`}
              >
                {s.label} <span className="opacity-70">{contacts ? counts[s.key] : ""}</span>
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => { setQ(e.target.value); setShown(100); }} placeholder="Search name, number, city, device…" className="pl-9" />
            </div>
            <select value={brand} onChange={(e) => { setBrand(e.target.value); setShown(100); }} className="h-9 rounded-md border bg-background px-3 text-sm">
              <option value="">All devices</option>
              {brands.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>

          {!contacts ? (
            <div className="flex items-center gap-2 text-muted-foreground"><LoaderIcon className="size-4 animate-spin" /> Building the list…</div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border-2 border-ink bg-card">
              <table className="w-full min-w-[820px] text-sm">
                <thead className="border-b-2 border-ink bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="p-3">Contact</th><th className="p-3">City</th><th className="p-3 text-right">Orders</th>
                    <th className="p-3 text-right">Spent</th><th className="p-3">Last order</th><th className="p-3">Device / interest</th>
                    <th className="p-3">Source</th><th className="p-3">Offers</th>
                  </tr>
                </thead>
                <tbody>
                  {list.slice(0, shown).map((c) => (
                    <tr key={c.phone} className="border-b last:border-0 align-top">
                      <td className="p-3">
                        <p className="font-semibold">{c.name || "—"}</p>
                        <p className="text-xs text-muted-foreground">+91 {c.phone}{c.email ? ` · ${c.email}` : ""}</p>
                      </td>
                      <td className="p-3 text-muted-foreground">{c.city || "—"}</td>
                      <td className="p-3 text-right font-semibold">{c.orders || "—"}</td>
                      <td className="p-3 text-right">{c.spent ? rupees(c.spent) : "—"}</td>
                      <td className="p-3 text-muted-foreground">{day(c.lastOrderAt)}</td>
                      <td className="p-3 text-xs">
                        {c.devices.slice(0, 2).join(", ")}
                        {c.requested.length > 0 && <p className="text-muted-foreground">Asked: {c.requested.slice(0, 2).join(", ")}</p>}
                        {c.waitingFor.length > 0 && <p className="text-muted-foreground">Waiting: {c.waitingFor[0]}</p>}
                        {c.abandonedCart && <p className="font-semibold text-[#b4432a]">Left a cart</p>}
                      </td>
                      <td className="p-3 text-xs text-muted-foreground">{c.sources.join(", ")}</td>
                      <td className="p-3 text-xs font-semibold">
                        {c.optOut ? <span className="text-destructive">Opted out</span> : c.optIn === true ? <span className="text-[#1b7462]">Yes</span> : <span className="text-muted-foreground">Not asked</span>}
                        <div className="mt-1">
                          {c.optOut
                            ? <button type="button" className="font-normal text-muted-foreground underline" onClick={() => void setOffers(c, { optOut: false })}>Undo opt-out</button>
                            : <button type="button" className="font-normal text-muted-foreground underline" onClick={() => void setOffers(c, { optOut: true })}>Opt out</button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!list.length && <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Nobody matches these filters.</td></tr>}
                </tbody>
              </table>
              {list.length > shown && (
                <div className="border-t p-3 text-center">
                  <Button variant="outline" size="sm" onClick={() => setShown((n) => n + 200)}>Show more ({list.length - shown} left)</Button>
                </div>
              )}
            </div>
          )}
        </div>
      </Authenticated>
    </AdminLayout>
  );
}
