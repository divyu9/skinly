import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { addDoc, collection, doc, getDocs, limit, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { db } from "@/lib/firebase";
import { useQuery } from "@/lib/firebase-hooks";
import { api } from "@/lib/firebase-api";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { AlertTriangleIcon, CheckCircle2Icon, CircleDashedIcon, Loader2Icon, RocketIcon, XCircleIcon } from "lucide-react";
import { DEFAULT_BLOCKS, type MockupShot, type SharedBlocks, type CutOrientation } from "@/lib/ai-mockup-shots.ts";
import { IMAGE_MODELS, formatInr } from "@/lib/ai-mockup-models.ts";
import { buildLaunchPlan, type LaunchDesign, type LaunchPlan } from "@/lib/launch-plan.ts";
import { loadDesignListings } from "@/lib/launch-plan-data.ts";
import { useTemplates } from "@/pages/admin/ai-mockups/templates.tsx";

/**
 * Plans a design launch, shows exactly what it will do, and hands it to the
 * server. Used by the phone launch page and inside the studio.
 */

/** Firestore refuses undefined anywhere in a document; plans have optional fields. */
const clean = (v: any): any =>
  Array.isArray(v) ? v.map(clean)
  : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined).map(([k, x]) => [k, clean(x)]))
  : v;

const pref = (key: string, fallback: string) => {
  try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
};
const setPref = (key: string, value: string) => {
  try { localStorage.setItem(key, value); } catch { /* storage blocked */ }
};

export function LaunchPanel({ design, themes, onLaunched }: {
  design: LaunchDesign;
  /** Theme and colour words for the copywriter and collections. */
  themes?: string[];
  onLaunched?: (launchId: string) => void;
}) {
  const shots = useQuery(api.aiMockups.getPrompts) as MockupShot[] | undefined;
  const settings = useQuery(api.aiMockups.getSettings) as { blocks?: SharedBlocks } | null | undefined;
  const gadgetTypes = useQuery(api.gadgetTypes.list) as any[] | undefined;
  const { templates, byListing } = useTemplates();

  const cheapest = [...IMAGE_MODELS].sort((a, b) => a.usd - b.usd)[0];
  const [phaseOnly, setPhaseOnly] = useState(pref("launch_phase1", "1") === "1");
  const [publishNow, setPublishNow] = useState(pref("launch_publish", "1") === "1");
  const [images, setImages] = useState(pref("launch_images", "1") === "1");
  const [templatesOn, setTemplatesOn] = useState(pref("launch_templates", "1") === "1");
  const [regenerate, setRegenerate] = useState(false);
  const [modelId, setModelId] = useState(pref("launch_model", cheapest.id));
  const [orientation, setOrientation] = useState<CutOrientation | "both">((pref("launch_orient", "lengthwise") as any) || "lengthwise");
  const [plan, setPlan] = useState<LaunchPlan | null>(null);
  const [planning, setPlanning] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [launchId, setLaunchId] = useState<string | null>(null);
  const [showSteps, setShowSteps] = useState(false);

  const model = IMAGE_MODELS.find((m) => m.id === modelId) || cheapest;
  const ready = shots !== undefined && settings !== undefined && gadgetTypes !== undefined && templates !== undefined;

  // Any change to the options makes the shown plan stale.
  useEffect(() => { setPlan(null); }, [phaseOnly, publishNow, images, templatesOn, regenerate, modelId, orientation, design.code, design.finish, design.name, design.rawImageUrl, design.flatImageUrl]);

  const makePlan = async () => {
    setPlanning(true);
    try {
      const [existing, jobSnap] = await Promise.all([
        loadDesignListings(design.code),
        getDocs(query(collection(db, "designMockups"), where("rNumber", "==", design.code))),
      ]);
      const readyTemplates = new Map<string, { _id: string }>();
      byListing.forEach((t, k) => { if (t.status === "ready") readyTemplates.set(k, { _id: t._id }); });
      const p = buildLaunchPlan({
        design,
        existing,
        shots: shots || [],
        blocks: { ...DEFAULT_BLOCKS, ...(settings?.blocks || {}) },
        readyTemplates,
        gadgetTypeIds: Object.fromEntries((gadgetTypes || []).map((g) => [String(g.name), g._id])),
        jobs: jobSnap.docs.map((d) => d.data() as any),
        options: {
          phaseOnly, publishNow, images, useTemplates: templatesOn, regenerateImages: regenerate, model, aspect: "1:1",
          orientations: orientation === "both" ? ["lengthwise", "widthwise"] : [orientation],
        },
      });
      setPlan(p);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not plan the launch");
    } finally {
      setPlanning(false);
    }
  };

  const launch = async () => {
    if (!plan) return;
    setLaunching(true);
    try {
      const ref = await addDoc(collection(db, "designLaunches"), clean({
        code: design.code.toUpperCase(),
        source: design.source,
        designName: design.name || "",
        finish: design.finish || "",
        themes: themes || [],
        designImageUrl: design.rawImageUrl || "",
        flat: design.flatImageUrl
          ? { url: design.flatImageUrl, pxPerCm: design.flatPxPerCm || 40, widthCm: design.flatWidthCm || 29.5, lengthCm: design.flatLengthCm || 0 }
          : null,
        options: { phaseOnly, publishNow, images, useTemplates: templatesOn, regenerate, model: model.label },
        summary: plan.summary,
        warnings: plan.warnings,
        steps: plan.steps,
        status: "queued",
        createdAt: Date.now(),
        createdBy: getAuth().currentUser?.email || "",
      }));
      setLaunchId(ref.id);
      onLaunched?.(ref.id);
      toast.success("Launched — it runs on the server; you can close this page");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not launch");
    } finally {
      setLaunching(false);
    }
  };

  if (launchId) return <LaunchProgress launchId={launchId} />;

  const toggle = (label: string, on: boolean, set: (v: boolean) => void, key?: string, hint?: string) => (
    <label className="flex items-start gap-2 text-sm">
      <Switch checked={on} onCheckedChange={(v) => { set(v); if (key) setPref(key, v ? "1" : "0"); }} className="mt-0.5" />
      <span>
        {label}
        {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
      </span>
    </label>
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {toggle("Phase 1 listings only", phaseOnly, setPhaseOnly, "launch_phase1", "The 12 high-search listings. Old listings are converted whatever their kind.")}
        {toggle("Publish new listings now", publishNow, setPublishNow, "launch_publish", "Off: new listings wait in draft for their first approved picture.")}
        {toggle("Make pictures", images, setImages, "launch_images")}
        {toggle("Use templates where ready", templatesOn, setTemplatesOn, "launch_templates", "Free and true to scale; needs a calibrated roll.")}
        {toggle("Make pictures again", regenerate, setRegenerate, undefined, "Off: pictures this design already has are skipped.")}
      </div>
      {images && (
        <div className="flex flex-wrap items-center gap-2">
          <Label className="text-xs">Model</Label>
          <Select value={modelId} onValueChange={(v) => { setModelId(v); setPref("launch_model", v); }}>
            <SelectTrigger className="h-8 w-[240px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {IMAGE_MODELS.map((m) => <SelectItem key={m.id} value={m.id}>{m.label} · {formatInr(m.usd)}</SelectItem>)}
            </SelectContent>
          </Select>
          {design.source === "roll" && (
            <>
              <Label className="text-xs">Phone cut</Label>
              <Select value={orientation} onValueChange={(v) => { setOrientation(v as any); setPref("launch_orient", v); }}>
                <SelectTrigger className="h-8 w-[170px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="lengthwise">Lengthwise</SelectItem>
                  <SelectItem value="widthwise">Widthwise</SelectItem>
                  <SelectItem value="both">Both</SelectItem>
                </SelectContent>
              </Select>
            </>
          )}
        </div>
      )}

      {!plan ? (
        <Button className="w-full" disabled={!ready || planning} onClick={() => void makePlan()}>
          {planning ? <Loader2Icon className="mr-2 size-4 animate-spin" /> : null}
          {planning ? "Reading this design's listings…" : "Plan the launch"}
        </Button>
      ) : (
        <div className="space-y-3 rounded-xl border p-3">
          <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
            <Figure n={plan.summary.create} label="new listings" />
            <Figure n={plan.summary.revise} label="updated" />
            <Figure n={plan.summary.retire} label="retired" />
            <Figure n={plan.summary.templateImages} label="template pictures · ₹0" />
            <Figure n={plan.summary.aiImages} label={`AI pictures · ${formatInr(plan.summary.costInr / 95)}`} />
          </div>
          {plan.warnings.map((w) => (
            <p key={w} className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
              <AlertTriangleIcon className="mt-0.5 size-3.5 shrink-0" /> {w}
            </p>
          ))}
          <button className="text-xs text-violet-600 underline" onClick={() => setShowSteps(!showSteps)}>
            {showSteps ? "Hide" : "Show"} all {plan.steps.length} steps
          </button>
          {showSteps && <StepList steps={plan.steps} />}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setPlan(null)}>Change options</Button>
            <Button className="flex-1" disabled={launching || !plan.steps.length} onClick={() => void launch()}>
              {launching ? <Loader2Icon className="mr-2 size-4 animate-spin" /> : <RocketIcon className="mr-2 size-4" />}
              Launch
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Figure({ n, label }: { n: number; label: string }) {
  return (
    <div className="rounded-lg bg-muted/50 px-2 py-1.5">
      <div className="text-lg font-semibold tabular-nums">{n}</div>
      <div className="text-[11px] leading-tight text-muted-foreground">{label}</div>
    </div>
  );
}

function StepList({ steps }: { steps: Array<{ id: string; label: string; status: string; note?: string; type: string }> }) {
  return (
    <ul className="max-h-72 space-y-1 overflow-auto text-xs">
      {steps.map((s) => (
        <li key={s.id} className="flex items-start gap-1.5">
          {s.status === "done" ? <CheckCircle2Icon className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
            : s.status === "failed" ? <XCircleIcon className="mt-0.5 size-3.5 shrink-0 text-rose-600" />
            : s.status === "skipped" ? <CircleDashedIcon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
            : <CircleDashedIcon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/50" />}
          <span className="min-w-0">
            {s.label}
            {s.note && <span className={`block truncate ${s.status === "failed" ? "text-rose-600" : "text-muted-foreground"}`}>{s.note}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** A launch's live progress, from its document. */
export function LaunchProgress({ launchId }: { launchId: string }) {
  const [launch, setLaunch] = useState<any>(null);
  const [images, setImages] = useState<{ running: number; review: number; failed: number; approved: number }>({ running: 0, review: 0, failed: 0, approved: 0 });

  useEffect(() => onSnapshot(doc(db, "designLaunches", launchId), (s) => setLaunch(s.exists() ? { _id: s.id, ...s.data() } : null)), [launchId]);
  useEffect(() => onSnapshot(
    query(collection(db, "designMockups"), where("launchId", "==", launchId)),
    (s) => {
      const c = { running: 0, review: 0, failed: 0, approved: 0 };
      s.docs.forEach((d) => {
        const st = String((d.data() as any).status);
        if (st === "running" || st === "queued") c.running++;
        else if (st === "review") c.review++;
        else if (st === "failed") c.failed++;
        else if (st === "approved") c.approved++;
      });
      setImages(c);
    }
  ), [launchId]);

  const steps: any[] = launch?.steps || [];
  const counts = useMemo(() => ({
    done: steps.filter((s) => s.status === "done" || s.status === "skipped").length,
    failed: steps.filter((s) => s.status === "failed").length,
  }), [steps]);

  if (!launch) return <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2Icon className="size-4 animate-spin" /> Loading…</p>;

  const statusLabel: Record<string, string> = {
    queued: "Waiting to start",
    running: "Working",
    "waiting-images": "Listings done · pictures rendering",
    done: "Done",
    "done-with-errors": "Done, with errors",
  };
  const busy = ["queued", "running", "waiting-images"].includes(launch.status);

  return (
    <div className="space-y-3 rounded-xl border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono font-semibold">{launch.code}</span>
        <Badge className={busy ? "bg-violet-600" : launch.status === "done" ? "bg-emerald-600" : "bg-amber-500"}>
          {busy && <Loader2Icon className="mr-1 size-3 animate-spin" />}
          {statusLabel[launch.status] || launch.status}
        </Badge>
        <span className="text-xs text-muted-foreground tabular-nums">
          {counts.done}/{steps.length} steps{counts.failed ? ` · ${counts.failed} failed` : ""}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-violet-600 transition-all" style={{ width: `${steps.length ? ((counts.done + counts.failed) / steps.length) * 100 : 0}%` }} />
      </div>
      <p className="text-xs text-muted-foreground">
        Pictures: {images.running} rendering · <strong className="text-foreground">{images.review} to review</strong> · {images.approved} approved
        {images.failed ? ` · ${images.failed} failed` : ""}. It keeps going on the server if you close this page.
      </p>
      {launch.lastError && <p className="text-xs text-rose-600">{launch.lastError}</p>}
      <StepList steps={steps} />
      {images.review > 0 && (
        <Button asChild className="w-full">
          <Link to={`/backend-skinly/ai-mockups?design=${encodeURIComponent(launch.code)}`}>Review {images.review} picture{images.review === 1 ? "" : "s"}</Link>
        </Button>
      )}
    </div>
  );
}

/** Recent launches, newest first. */
export function RecentLaunches({ onOpen }: { onOpen: (id: string) => void }) {
  const [rows, setRows] = useState<any[] | null>(null);
  useEffect(() => onSnapshot(
    query(collection(db, "designLaunches"), orderBy("createdAt", "desc"), limit(15)),
    (s) => setRows(s.docs.map((d) => ({ _id: d.id, ...d.data() })))
  ), []);
  if (!rows?.length) return null;
  return (
    <div className="space-y-1.5">
      {rows.map((r) => {
        const steps: any[] = r.steps || [];
        const done = steps.filter((s) => s.status !== "pending").length;
        return (
          <button key={r._id} onClick={() => onOpen(r._id)} className="flex w-full items-center gap-2 rounded-lg border p-2 text-left text-sm hover:bg-muted/50">
            <span className="font-mono font-semibold">{r.code}</span>
            <span className="min-w-0 flex-1 truncate text-muted-foreground">{r.designName}</span>
            <span className="text-xs tabular-nums text-muted-foreground">{done}/{steps.length}</span>
            <Badge variant="outline" className="text-[10px]">{r.status}</Badge>
          </button>
        );
      })}
    </div>
  );
}
