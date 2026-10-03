import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { collection, getDocs, limit, orderBy, query, startAfter, type QueryDocumentSnapshot } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { db } from "@/lib/firebase-db";
import { useMutation } from "@/lib/firebase-hooks";
import { api } from "@/lib/firebase-api";
import { WHATSAPP_MESSAGES } from "@/lib/whatsapp-registry";
import { AdminLayout } from "@/components/admin-layout.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog.tsx";
import { LoaderIcon, MessageSquareIcon, RefreshCwIcon, SearchIcon, SendIcon } from "lucide-react";
import { toast } from "sonner";

/*
 * Every WhatsApp message the site queued, newest first, and what became of it.
 *
 * "Sent" only means the provider took the message. Whether the phone got it
 * comes later, from Fast2SMS's delivery reports, which whatsappDeliverySync
 * copies onto each message every 15 minutes (or now, with "Refresh delivery
 * status"): delivered, read, or failed with Meta's reason in plain words.
 *
 * This page used to load an arbitrary 50 documents (a limit with no order),
 * ran one filter at a time, and kept the reason a message failed inside a
 * dialog. It now reads the newest 200 by createdAt, filters them together
 * here, and says why on the row.
 */

type Msg = {
  _id: string; usecaseKey: string; recipientPhone: string; status: string; createdAt: number;
  sentAt?: number; deliveredAt?: number; readAt?: number; failureReason?: string; test?: boolean;
  provider?: string; providerResponse?: string; providerTemplateId?: string; variables?: Record<string, string>;
  headerImage?: string; retryCount?: number;
};

const PAGE = 200;
const LABEL = new Map(WHATSAPP_MESSAGES.map((m) => [m.key, m.label]));
const STATUSES = ["all", "failed", "skipped", "pending", "sent", "delivered", "read"] as const;
const STATUS_STYLE: Record<string, string> = {
  failed: "bg-destructive/10 text-destructive border-destructive/40",
  skipped: "bg-muted text-muted-foreground border-muted-foreground/30",
  pending: "bg-[#fff4d6] text-ink border-ink/30",
  processing: "bg-[#fff4d6] text-ink border-ink/30",
  sent: "bg-muted text-ink border-ink/30",
  delivered: "bg-[#d6f5ec] text-[#1b7462] border-[#1b7462]/40",
  read: "bg-[#28a58b] text-ink border-ink",
};
const when = (t?: number) => t ? new Date(t).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "";

export default function WhatsAppMessagesPage() {
  const [rows, setRows] = useState<Msg[] | null>(null);
  const [cursor, setCursor] = useState<QueryDocumentSnapshot | null>(null);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("all");
  const [usecase, setUsecase] = useState("all");
  const [q, setQ] = useState("");
  const [hideTests, setHideTests] = useState(false);
  const [open, setOpen] = useState<Msg | null>(null);
  const retryMessage = useMutation(api.whatsappMessaging.retryMessage);

  const load = async (next = false) => {
    setLoading(true);
    try {
      const base = query(collection(db, "whatsappMessages"), orderBy("createdAt", "desc"), limit(PAGE));
      const snap = await getDocs(next && cursor ? query(base, startAfter(cursor)) : base);
      const got = snap.docs.map((d) => ({ _id: d.id, ...(d.data() as any) }) as Msg);
      setRows((prev) => (next ? [...(prev || []), ...got] : got));
      setCursor(snap.docs[snap.docs.length - 1] || null);
      setMore(snap.size === PAGE);
    } catch (e: any) {
      toast.error(e?.message || "Could not load messages");
    } finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const syncDelivery = async () => {
    setSyncing(true);
    try {
      const r: any = (await httpsCallable(getFunctions(), "syncWhatsAppDelivery")({})).data;
      toast.success(`${r.updated} message${r.updated === 1 ? "" : "s"} updated from ${r.reports} delivery reports`);
      await load();
    } catch (e: any) { toast.error(e?.message || "Could not reach Fast2SMS"); }
    finally { setSyncing(false); }
  };

  const sendQueued = async () => {
    try {
      await httpsCallable(getFunctions(), "triggerWhatsAppWorker")({});
      toast.success("Queued messages sent");
      await load();
    } catch (e: any) { toast.error(e?.message || "Could not run the worker"); }
  };

  const retry = async (m: Msg) => {
    try {
      await retryMessage({ messageId: m._id, retryCount: m.retryCount || 0 });
      toast.success("Queued again — it goes out on the next run, or press Send queued now");
      await load();
    } catch (e: any) { toast.error(e?.message || "Could not retry"); }
  };

  const base = useMemo(() => (rows || []).filter((m) => !hideTests || !m.test), [rows, hideTests]);
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: base.length };
    for (const m of base) c[m.status] = (c[m.status] || 0) + 1;
    return c;
  }, [base]);
  const usecases = useMemo(() => [...new Set((rows || []).map((m) => m.usecaseKey))].sort(), [rows]);
  const list = useMemo(() => {
    const digits = q.replace(/\D/g, "");
    return base.filter((m) =>
      (status === "all" || m.status === status) &&
      (usecase === "all" || m.usecaseKey === usecase) &&
      (!digits || String(m.recipientPhone || "").replace(/\D/g, "").includes(digits)));
  }, [base, status, usecase, q]);

  return (
    <AdminLayout>
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-3xl font-extrabold"><MessageSquareIcon className="size-7" /> WhatsApp Messages</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Newest first. <b>Sent</b> = Fast2SMS took it; <b>Delivered / Read</b> = it reached the phone; <b>Failed</b> says why. Delivery updates every 15 minutes.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => void syncDelivery()} disabled={syncing}>
              {syncing ? <LoaderIcon className="mr-2 size-4 animate-spin" /> : <RefreshCwIcon className="mr-2 size-4" />}Refresh delivery status
            </Button>
            <Button variant="outline" size="sm" onClick={() => void sendQueued()}><SendIcon className="mr-2 size-4" />Send queued now</Button>
            <Button variant="outline" size="sm" asChild><Link to="/backend-skinly/whatsapp">Templates</Link></Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className={`rounded-full border-2 px-3 py-1 text-sm font-semibold capitalize ${status === s ? "border-ink bg-[#28a58b] text-ink" : "border-muted bg-background text-muted-foreground hover:border-ink"}`}
            >
              {s} <span className="opacity-70">{rows ? counts[s] || 0 : ""}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search phone number…" className="pl-9" inputMode="numeric" />
          </div>
          <select value={usecase} onChange={(e) => setUsecase(e.target.value)} className="h-9 rounded-md border bg-background px-3 text-sm">
            <option value="all">All messages</option>
            {usecases.map((k) => <option key={k} value={k}>{LABEL.get(k) || k}</option>)}
          </select>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={hideTests} onChange={(e) => setHideTests(e.target.checked)} /> Hide tests
          </label>
        </div>

        {!rows ? (
          <div className="flex items-center gap-2 text-muted-foreground"><LoaderIcon className="size-4 animate-spin" /> Loading…</div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border-2 border-ink bg-card">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="border-b-2 border-ink bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr><th className="p-3">When</th><th className="p-3">Message</th><th className="p-3">To</th><th className="p-3">Status</th><th className="p-3">Why / detail</th><th className="p-3" /></tr>
              </thead>
              <tbody>
                {list.map((m) => (
                  <tr key={m._id} className="border-b align-top last:border-0">
                    <td className="whitespace-nowrap p-3 text-muted-foreground">{when(m.createdAt)}</td>
                    <td className="p-3">
                      <div className="font-semibold">{LABEL.get(m.usecaseKey) || m.usecaseKey}</div>
                      {m.test && <span className="rounded bg-[#ffd166] px-1.5 text-[10px] font-bold uppercase">test</span>}
                    </td>
                    <td className="whitespace-nowrap p-3 font-mono text-xs">{m.recipientPhone}</td>
                    <td className="p-3">
                      <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-bold capitalize ${STATUS_STYLE[m.status] || STATUS_STYLE.sent}`}>{m.status}</span>
                      <div className="mt-1 text-[11px] text-muted-foreground">
                        {m.readAt ? `read ${when(m.readAt)}` : m.deliveredAt ? `delivered ${when(m.deliveredAt)}` : m.sentAt ? `sent ${when(m.sentAt)}` : ""}
                      </div>
                    </td>
                    <td className={`max-w-[340px] p-3 text-xs ${m.status === "failed" ? "text-destructive" : "text-muted-foreground"}`}>
                      {m.failureReason || (m.status === "sent" ? "Waiting for the delivery report" : "")}
                    </td>
                    <td className="whitespace-nowrap p-3 text-right">
                      <button type="button" className="text-xs underline" onClick={() => setOpen(m)}>Details</button>
                      {(m.status === "failed" || m.status === "skipped") && !m.test && (
                        <button type="button" className="ml-3 text-xs font-semibold underline" onClick={() => void retry(m)}>Retry</button>
                      )}
                    </td>
                  </tr>
                ))}
                {!list.length && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Nothing matches these filters.</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {more && (
          <div className="text-center">
            <Button variant="outline" onClick={() => void load(true)} disabled={loading}>{loading ? "Loading…" : `Load ${PAGE} older`}</Button>
          </div>
        )}
      </div>

      <Dialog open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>{open ? LABEL.get(open.usecaseKey) || open.usecaseKey : ""}</DialogTitle></DialogHeader>
          {open && (
            <div className="space-y-3 text-sm">
              <p>To <b className="font-mono">{open.recipientPhone}</b> · {open.status} · {open.provider || "—"} template <span className="font-mono">{open.providerTemplateId || "—"}</span></p>
              <p className="text-muted-foreground">Created {when(open.createdAt)}{open.sentAt ? ` · sent ${when(open.sentAt)}` : ""}{open.deliveredAt ? ` · delivered ${when(open.deliveredAt)}` : ""}{open.readAt ? ` · read ${when(open.readAt)}` : ""}</p>
              {open.failureReason && <p className="rounded bg-destructive/10 p-2 text-destructive">{open.failureReason}</p>}
              {open.headerImage && <img src={open.headerImage} alt="" className="max-h-40 rounded border" />}
              {open.variables && (
                <pre className="whitespace-pre-wrap break-all rounded bg-muted p-2 text-xs">{JSON.stringify(open.variables, null, 2)}</pre>
              )}
              {open.providerResponse && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground">Provider's reply</p>
                  <pre className="whitespace-pre-wrap break-all rounded bg-muted p-2 text-xs">{open.providerResponse}</pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
