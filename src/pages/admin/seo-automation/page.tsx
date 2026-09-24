import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery } from "@/lib/firebase-hooks";
import { api } from "@/lib/firebase-api";
import { AdminLayout } from "@/components/admin-layout.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { toast } from "sonner";
import { Loader2, RefreshCw, Sparkles, Wand2, FileWarning, Clock3 } from "lucide-react";

/*
 * SEO Automation — the landing pages that write themselves.
 *
 * Moved out of Settings, where it sat between the backup button and the
 * low-stock levels. What it answers, at a glance: how many pages exist, how
 * many could be written tonight, which new models are waiting (and on what),
 * what is sitting as a draft and why, and how many old pages still carry the
 * first generator's claims.
 *
 * The numbers are computed on the server and stored (it reads every model,
 * product and mockup), refreshed each night after the run and whenever this
 * page's Refresh is pressed.
 */

type Queue = Array<{ slug: string; name: string; kind: string; gadget: string | null; score: number; why: string; fresh: boolean }>;
type Status = {
  updatedAt: number;
  facts: { models: number; brands: number; designs: number };
  settings: { perDay: number; autoPublish: boolean };
  pages: { total: number; published: number; drafts: number; needRewrite: number };
  byKind: Record<string, { total: number; have: number; ready: number; waitingMockups: number; hubCovers: number }>;
  newModels: { total: number; withPage: number; ready: number; waitingMockups: number; hubCovers: number; waitingNames: string[] };
  queue: Queue;
  drafts: Array<{ slug: string; issues: string[] }>;
};

const KIND_LABEL: Record<string, string> = {
  model: "Model pages",
  "brand-gadget": "Brand + gadget hubs",
  theme: "Themes",
  "theme-gadget": "Theme + gadget",
};

const ago = (t?: number) => {
  if (!t) return "never";
  const m = Math.round((Date.now() - t) / 60000);
  return m < 1 ? "just now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`;
};

function Stat({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <div className="rounded-xl border-2 border-ink/10 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{typeof value === "number" ? value.toLocaleString("en-IN") : value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export default function SeoAutomationPage() {
  const run = useMutation(api.seo.runSeoAutoPages);
  const updateSetting = useMutation(api.settings.updateSetting);
  const perDaySetting = useQuery(api.settings.getSetting, { key: "SEO_AUTO_PAGES_PER_DAY" });
  const publishSetting = useQuery(api.settings.getSetting, { key: "SEO_AUTO_PUBLISH" });

  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [perDay, setPerDay] = useState("");
  const [publish, setPublish] = useState(false);
  const [writeCount, setWriteCount] = useState("10");
  const [picked, setPicked] = useState<Set<string>>(new Set());

  useEffect(() => {
    const v = (perDaySetting as any)?.value;
    if (v !== undefined && v !== null) setPerDay(String(v));
  }, [perDaySetting]);
  useEffect(() => { setPublish((publishSetting as any)?.value === true); }, [publishSetting]);

  const load = async (refresh = false) => {
    setLoading(true);
    try {
      const res: any = await run({ status: true, refresh });
      setStatus(res?.status || null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load the numbers");
    } finally {
      setLoading(false);
    }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void load(false); }, []);

  const act = async (name: string, args: Record<string, unknown>) => {
    setBusy(name);
    try {
      const res: any = await run(args);
      toast.success(res?.message || "Done", {
        description: (res?.slugs || []).slice(0, 8).join(", ") || undefined,
        duration: 20000,
      });
      if (!args.dryRun) { setPicked(new Set()); await load(false); }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "That did not run");
    } finally {
      setBusy(null);
    }
  };

  const saveSettings = async () => {
    setBusy("save");
    try {
      await Promise.all([
        updateSetting({ key: "SEO_AUTO_PAGES_PER_DAY", value: Math.max(0, Math.min(40, Math.floor(Number(perDay) || 0))) }),
        updateSetting({ key: "SEO_AUTO_PUBLISH", value: publish }),
      ]);
      toast.success("Saved — tonight's run will use these");
    } catch {
      toast.error("Could not save that");
    } finally {
      setBusy(null);
    }
  };

  const s = status;
  const model = s?.byKind?.model;
  const toggle = (slug: string) => setPicked((prev) => {
    const next = new Set(prev);
    if (next.has(slug)) next.delete(slug); else if (next.size < 30) next.add(slug);
    return next;
  });

  return (
    <AdminLayout>
      <div className="container mx-auto max-w-6xl space-y-6 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-3xl font-bold"><Sparkles className="h-7 w-7" /> SEO Automation</h1>
            <p className="mt-1 max-w-3xl text-muted-foreground">
              Landing pages for models, brand + gadget hubs and themes, written from what the catalogue actually holds
              and checked before they go live. New models get their page on the night after they become ready — nothing to click.
            </p>
          </div>
          <Button variant="outline" onClick={() => load(true)} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Refresh numbers
          </Button>
        </div>
        <p className="-mt-3 text-xs text-muted-foreground">
          Numbers updated {ago(s?.updatedAt)}{loading ? " — working them out (about a minute)…" : ""}
        </p>

        {/* At a glance */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Pages live" value={s?.pages.published ?? "—"} hint={s ? `${s.pages.total} in total` : undefined} />
          <Stat label="Ready to write" value={s ? Object.values(s.byKind).reduce((n, k) => n + k.ready, 0) : "—"} hint="pass the gates below" />
          <Stat label="Old pages to rewrite" value={s?.pages.needRewrite ?? "—"} hint="stale price, counts or thin" />
          <Stat label="Drafts to check" value={s?.pages.drafts ?? "—"} hint="failed the quality check" />
        </div>

        {/* New models */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Clock3 className="h-5 w-5" /> New models (last 30 days)</CardTitle>
            <CardDescription>
              When a model is added (or a request approved), its page is written automatically on the next nightly run —
              once it is ready. A phone is ready when it has {`${20}`} mockups of its own, or as soon as a customer orders or asks
              for it. A laptop, tablet or camera model gets its own page only once someone orders or asks for it; until then the
              brand + gadget hub ("Dell Laptop Skins") serves it, which keeps near-identical pages off the site.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              <Stat label="Added" value={s?.newModels.total ?? "—"} />
              <Stat label="Have a page" value={s?.newModels.withPage ?? "—"} />
              <Stat label="Written tonight" value={s?.newModels.ready ?? "—"} hint={s?.settings.perDay ? "ready" : "turn the nightly run on"} />
              <Stat label="Waiting for mockups" value={s?.newModels.waitingMockups ?? "—"} />
              <Stat label="Served by hub page" value={s?.newModels.hubCovers ?? "—"} />
            </div>
            {!!s?.newModels.waitingNames?.length && (
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Waiting for mockups: </span>
                {s.newModels.waitingNames.join(", ")}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Nightly run */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Wand2 className="h-5 w-5" /> Nightly run</CardTitle>
            <CardDescription>
              Every night at 1:30 am: write up to this many ready pages (new models first, then what customers have ordered or
              asked for, then hub pages, then the rest), spend what is left of the number rewriting old pages, then rebuild the
              store. About ₹3 of OpenAI per page. Only pages that pass the quality check are published; the rest wait below.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-end gap-3">
              <div className="w-40">
                <Label htmlFor="per-day">Pages a night</Label>
                <Input id="per-day" className="mt-1.5" inputMode="numeric" placeholder="0 = off"
                  value={perDay} onChange={(e) => setPerDay(e.target.value)} />
              </div>
              <label className="flex items-center gap-2 pb-2 text-sm">
                <input type="checkbox" className="size-4" checked={publish} onChange={(e) => setPublish(e.target.checked)} />
                Publish pages that pass the check
              </label>
              <Button onClick={saveSettings} disabled={busy !== null}>
                {busy === "save" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Coverage by kind */}
        <Card>
          <CardHeader>
            <CardTitle>Coverage</CardTitle>
            <CardDescription>
              {s ? `${s.facts.models.toLocaleString("en-IN")} models from ${s.facts.brands} brands, ${s.facts.designs} designs.` : " "}
              {" "}Model pages are held back when a model has nothing of its own to show.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pr-4">Kind</th><th className="py-2 pr-4 text-right">Pages</th>
                    <th className="py-2 pr-4 text-right">Ready</th><th className="py-2 pr-4 text-right">Waiting for mockups</th>
                    <th className="py-2 text-right">Served by hub</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {Object.entries(s?.byKind || {}).map(([k, v]) => (
                    <tr key={k} className="border-b last:border-0">
                      <td className="py-2 pr-4 font-medium">{KIND_LABEL[k] || k}</td>
                      <td className="py-2 pr-4 text-right">{v.have} / {v.total}</td>
                      <td className="py-2 pr-4 text-right">{v.ready}</td>
                      <td className="py-2 pr-4 text-right">{v.waitingMockups || "—"}</td>
                      <td className="py-2 text-right">{v.hubCovers || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {model && (
              <p className="mt-3 text-xs text-muted-foreground">
                {model.waitingMockups.toLocaleString("en-IN")} phone models become ready as their mockups are made;
                {" "}{model.hubCovers.toLocaleString("en-IN")} other models are covered by their brand + gadget page.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Queue */}
        <Card>
          <CardHeader>
            <CardTitle>Ready to write</CardTitle>
            <CardDescription>
              The order tonight's run will take. Tick pages to write them now, or write the top ones.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-end gap-2">
              <div className="w-24">
                <Label htmlFor="n">How many</Label>
                <Input id="n" className="mt-1.5" inputMode="numeric" value={writeCount} onChange={(e) => setWriteCount(e.target.value)} />
              </div>
              <Button variant="outline" disabled={busy !== null}
                onClick={() => act("preview", { dryRun: true, limit: Number(writeCount) || 10 })}>
                {busy === "preview" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Preview
              </Button>
              <Button disabled={busy !== null}
                onClick={() => act("write", { limit: Number(writeCount) || 10 })}>
                {busy === "write" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Write top {Number(writeCount) || 10} now
              </Button>
              <Button variant="secondary" disabled={busy !== null || picked.size === 0}
                onClick={() => act("picked", { slugs: [...picked] })}>
                {busy === "picked" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Write {picked.size || ""} selected
              </Button>
              <span className="pb-2 text-xs text-muted-foreground">Up to 30 at a time; a run takes a few minutes.</span>
            </div>
            <div className="max-h-[28rem] overflow-y-auto rounded-lg border">
              {(s?.queue || []).length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">{loading ? "Loading…" : "Nothing ready to write."}</p>
              ) : (
                <ul className="divide-y">
                  {s!.queue.map((q) => (
                    <li key={q.slug} className="flex items-center gap-3 px-3 py-2 text-sm">
                      <input type="checkbox" className="size-4" checked={picked.has(q.slug)} onChange={() => toggle(q.slug)} />
                      <span className="min-w-0 flex-1 truncate">
                        <span className="font-medium">{q.name}</span>
                        <span className="ml-2 text-xs text-muted-foreground">/{q.slug}</span>
                      </span>
                      <Badge variant="outline" className="shrink-0">{KIND_LABEL[q.kind] || q.kind}</Badge>
                      <span className="hidden w-56 shrink-0 truncate text-right text-xs text-muted-foreground md:block">{q.why}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Rewrite + drafts */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Old pages</CardTitle>
              <CardDescription>
                Pages written by the first generator, or that state a fixed price, "1000+ models", COD, or are thin. The new
                copy replaces the old only if it passes the check; the old text is kept on the page record.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-2">
              <span className="text-2xl font-bold tabular-nums">{s?.pages.needRewrite ?? "—"}</span>
              <span className="text-sm text-muted-foreground">to rewrite</span>
              <Button variant="outline" size="sm" className="ml-auto" disabled={busy !== null}
                onClick={() => act("rewrite-preview", { rewrite: true, dryRun: true, limit: 30 })}>Preview</Button>
              <Button size="sm" disabled={busy !== null || !s?.pages.needRewrite}
                onClick={() => act("rewrite", { rewrite: true, limit: 12 })}>
                {busy === "rewrite" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Rewrite 12 now
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><FileWarning className="h-5 w-5" /> Drafts that failed the check</CardTitle>
              <CardDescription>Saved but not published. Open one in SEO Pages, fix it and publish, or delete it.</CardDescription>
            </CardHeader>
            <CardContent>
              {(s?.drafts || []).length === 0 ? (
                <p className="text-sm text-muted-foreground">None.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {s!.drafts.map((d) => (
                    <li key={d.slug}>
                      <Link to={`/backend-skinly/seo-pages?q=${encodeURIComponent(d.slug)}`} className="font-medium underline-offset-2 hover:underline">
                        /{d.slug}
                      </Link>
                      <span className="ml-2 text-xs text-muted-foreground">{d.issues.join("; ")}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
