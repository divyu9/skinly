import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { addDoc, collection, doc, getDocs, limit, onSnapshot, orderBy, query, updateDoc, where } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { db } from "@/lib/firebase";
import { useQuery } from "@/lib/firebase-hooks";
import { api } from "@/lib/firebase-api";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { AlertTriangleIcon, CheckCircle2Icon, CircleDashedIcon, Loader2Icon, RocketIcon, RotateCcwIcon, XCircleIcon } from "lucide-react";
import { DEFAULT_BLOCKS, PHASE_1_LISTINGS, type MockupShot, type SharedBlocks, type CutOrientation } from "@/lib/ai-mockup-shots.ts";
import { IMAGE_MODELS, formatInr } from "@/lib/ai-mockup-models.ts";
import { buildLaunchPlan, type LaunchDesign, type LaunchPlan } from "@/lib/launch-plan.ts";
import { loadDesignListings } from "@/lib/launch-plan-data.ts";
import { useTemplates, templateRows, templateForShot, usesTemplate } from "@/pages/admin/ai-mockups/templates.tsx";

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
  const { templates, byListing, bySuffix } = useTemplates();

  const cheapest = [...IMAGE_MODELS].sort((a, b) => a.usd - b.usd)[0];
  const [phaseOnly, setPhaseOnly] = useState(pref("launch_phase1", "1") === "1");
  const [publishNow, setPublishNow] = useState(pref("launch_publish", "1") === "1");
  /*
   * One answer for where the pictures come from. It replaces a "Make
   * pictures" switch and a "Use templates where ready" switch that could both
   * be on, which left the plan mixing the two with nothing saying which angle
   * went where. Carried over from whatever those two were last set to.
   */
  const [pictures, setPictures] = useState<"templates" | "model" | "none">(() => {
    const saved = pref("launch_pictures", "");
    if (saved === "templates" || saved === "model" || saved === "none") return saved;
    if (pref("launch_images", "1") !== "1") return "none";
    return pref("launch_templates", "1") === "1" ? "templates" : "model";
  });
  const [regenerate, setRegenerate] = useState(false);
  const [rewriteCopy, setRewriteCopy] = useState(false);
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
  useEffect(() => { setPlan(null); }, [phaseOnly, publishNow, pictures, regenerate, rewriteCopy, modelId, orientation, design.code, design.finish, design.name, design.rawImageUrl, design.flatImageUrl]);

  const makePlan = async () => {
    setPlanning(true);
    try {
      const [existing, jobSnap] = await Promise.all([
        loadDesignListings(design.code),
        getDocs(query(collection(db, "designMockups"), where("rNumber", "==", design.code))),
      ]);
      /*
       * Templates keyed by the shot they are the photo for, plus the older
       * listing-level ones under the listing itself — the plan falls back to
       * those for a listing's first shot, so corners marked before templates
       * were per angle still count.
       */
      /*
       * Resolved angle by angle rather than read straight off the documents:
       * that way an angle switched to the image model on its card is left out,
       * and one borrowing another angle's photo arrives with the lender's
       * template — which is the document the renderer loads.
       */
      const readyTemplates = new Map<string, { _id: string; widthCm?: number; heightCm?: number }>();
      for (const r of templateRows(shots || [], false)) {
        const t = templateForShot({ bySuffix, byListing }, r.listing, r.shot.suffix, r.isFirstShot);
        if (usesTemplate(t)) readyTemplates.set(r.shot.suffix, { _id: t!._id, widthCm: t!.widthCm, heightCm: t!.heightCm });
      }
      // The older listing-level templates still answer for a listing's first
      // shot when nothing per-shot has been saved for it.
      byListing.forEach((t, k) => { if (usesTemplate(t) && !readyTemplates.has(k)) readyTemplates.set(k, { _id: t._id, widthCm: t.widthCm, heightCm: t.heightCm }); });
      // Angles set to take another angle's picture, from their own cards.
      const sharedPictures = new Map<string, string>();
      bySuffix.forEach((t, k) => { if (t.sameAs && t.sameAs !== k) sharedPictures.set(k, t.sameAs); });
      const p = buildLaunchPlan({
        design,
        existing,
        shots: shots || [],
        blocks: { ...DEFAULT_BLOCKS, ...(settings?.blocks || {}) },
        readyTemplates,
        sharedPictures,
        gadgetTypeIds: Object.fromEntries((gadgetTypes || []).map((g) => [String(g.name), g._id])),
        jobs: jobSnap.docs.map((d) => d.data() as any),
        options: {
          phaseOnly, publishNow, pictures, regenerateImages: regenerate, rewriteCopy, model, aspect: "1:1",
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
        options: { phaseOnly, publishNow, pictures, regenerate, rewriteCopy, model: pictures === "model" ? model.label : "Template" },
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

  /*
   * What each switch would actually do, counted rather than described. The
   * phase hint used to say "the 12 high-search listings" from when there were
   * twelve, and the templates hint promised "free and true to scale" whether
   * a single template existed or none did — so a launch that quietly used the
   * image model for everything looked the same as one that could not.
   */
  const phaseAngles = templateRows(shots || [], phaseOnly);
  const readyAngles = phaseAngles
    .filter((r) => usesTemplate(templateForShot({ bySuffix, byListing }, r.listing, r.shot.suffix, r.isFirstShot)));
  const needsCalibration = design.source === "roll" && !design.flatImageUrl;
  const byModel = phaseAngles.length - readyAngles.length;
  const modelCost = formatInr(model.usd * byModel);
  const pictureHint =
    pictures === "none"
      ? "Listings only — no pictures are made or paid for."
      : pictures === "model"
        ? `All ${phaseAngles.length} angles are generated, ${formatInr(model.usd)} each — ${formatInr(model.usd * phaseAngles.length)} in all. Templates are ignored on this run.`
        : needsCalibration && readyAngles.length
          ? `${readyAngles.length} angles are set to use a template, but this roll is not calibrated — calibrate it first or they fall to the model.`
          : `${readyAngles.length} of ${phaseAngles.length} angles come from a template at no cost; the other ${byModel} are generated, ${modelCost} in all. Set which is which on each card in AI Mockup Studio → Templates.`;

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
        {toggle("Phase 1 listings only", phaseOnly, setPhaseOnly, "launch_phase1", `The ${PHASE_1_LISTINGS.size} high-search listings. Old listings are converted whatever their kind.`)}
        {toggle("Publish new listings now", publishNow, setPublishNow, "launch_publish", "Off: new listings wait in draft for their first approved picture.")}
        {toggle("Make pictures again", regenerate, setRegenerate, undefined, "Off: pictures this design already has are skipped.")}
        {toggle("Rewrite titles & descriptions", rewriteCopy, setRewriteCopy, undefined, "Also for listings already made; links (slugs) stay the same.")}
      </div>

      {/* One source for the pictures, chosen outright — see LaunchOptions. */}
      <div className="space-y-1.5">
        <Label className="text-xs">Pictures</Label>
        <div className="flex gap-1 rounded-lg border bg-muted/40 p-1">
          {([
            ["templates", `As set per angle${readyAngles.length ? ` · ${readyAngles.length} free` : ""}`],
            ["model", "All from the image model"],
            ["none", "No pictures"],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={pictures === value}
              onClick={() => { setPictures(value); setPref("launch_pictures", value); }}
              className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition ${
                pictures === value ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{pictureHint}</p>
      </div>

      {pictures !== "none" && (
        <div className="flex flex-wrap items-center gap-2">
          {pictures === "model" && (
            <>
              <Label className="text-xs">Model</Label>
              <Select value={modelId} onValueChange={(v) => { setModelId(v); setPref("launch_model", v); }}>
                <SelectTrigger className="h-8 w-[240px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {IMAGE_MODELS.map((m) => <SelectItem key={m.id} value={m.id}>{m.label} · {formatInr(m.usd)}</SelectItem>)}
                </SelectContent>
              </Select>
            </>
          )}
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
/** Shown both inside a launch and in the recent-launches list, so the two agree. */
const STATUS_LABEL: Record<string, string> = {
  queued: "Waiting to start",
  running: "Working",
  "waiting-images": "Listings done · pictures rendering",
  done: "Done",
  "done-with-errors": "Done, with errors",
};

/**
 * Puts a launch's failed steps back to pending and its status back to
 * queued, so the worker — which only ever looks at queued, running and
 * waiting-images — picks it up again within its next two-minute tick. Steps
 * that already succeeded are left alone: a retry finishes what is left, it
 * does not start over.
 */
async function retryFailedSteps(launchId: string, steps: any[]) {
  const nextSteps = (steps || []).map((s) =>
    s.status === "failed" ? { ...s, status: "pending", tries: 0, note: "" } : s
  );
  await updateDoc(doc(db, "designLaunches", launchId), {
    steps: nextSteps,
    status: "queued",
    lastError: "",
    updatedAt: Date.now(),
  });
}

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
  // Above the early return, with the other hooks: the launch arrives a moment
  // after the first render, so a hook below it is called on the second render
  // and not the first, which is React error #310 and a blank page.
  const [retrying, setRetrying] = useState(false);

  if (!launch) return <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2Icon className="size-4 animate-spin" /> Loading…</p>;

  const busy = ["queued", "running", "waiting-images"].includes(launch.status);
  const retry = async () => {
    setRetrying(true);
    try {
      await retryFailedSteps(launchId, steps);
      toast.success(`Retrying ${counts.failed} failed step${counts.failed === 1 ? "" : "s"}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not retry");
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div className="space-y-3 rounded-xl border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono font-semibold">{launch.code}</span>
        <Badge className={busy ? "bg-violet-600" : launch.status === "done" ? "bg-emerald-600" : "bg-amber-500"}>
          {busy && <Loader2Icon className="mr-1 size-3 animate-spin" />}
          {STATUS_LABEL[launch.status] || launch.status}
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
      {launch.status === "done-with-errors" && (
        <Button variant="outline" className="w-full" disabled={retrying} onClick={() => void retry()}>
          {retrying ? <Loader2Icon className="mr-2 size-4 animate-spin" /> : <RotateCcwIcon className="mr-2 size-4" />}
          Retry {counts.failed} failed step{counts.failed === 1 ? "" : "s"}
        </Button>
      )}
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
  const [retryingId, setRetryingId] = useState<string | null>(null);
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
        const failed = steps.filter((s) => s.status === "failed").length;
        const erred = r.status === "done-with-errors";
        return (
          <div key={r._id} className="flex w-full items-center gap-2 rounded-lg border p-2 text-sm hover:bg-muted/50">
            <button onClick={() => onOpen(r._id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
              <span className="font-mono font-semibold">{r.code}</span>
              <span className="min-w-0 flex-1 truncate text-muted-foreground">{r.designName}</span>
              {/* What's left, at a glance — no need to open the design to
                  find out how much work a "done with errors" run left behind. */}
              <span className="text-xs tabular-nums text-muted-foreground">
                {done}/{steps.length}{erred ? ` · ${failed} failed` : ""}
              </span>
              <Badge variant="outline" className={`text-[10px] ${erred ? "border-amber-400 text-amber-700 dark:text-amber-400" : ""}`}>
                {STATUS_LABEL[r.status] || r.status}
              </Badge>
            </button>
            {erred && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 shrink-0 px-2"
                disabled={retryingId === r._id}
                onClick={async (e) => {
                  e.stopPropagation();
                  setRetryingId(r._id);
                  try {
                    await retryFailedSteps(r._id, steps);
                    toast.success(`${r.code}: retrying ${failed} failed step${failed === 1 ? "" : "s"}`);
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Could not retry");
                  } finally {
                    setRetryingId(null);
                  }
                }}
              >
                {retryingId === r._id ? <Loader2Icon className="size-3.5 animate-spin" /> : <RotateCcwIcon className="size-3.5" />}
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}
