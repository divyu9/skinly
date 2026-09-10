import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useQuery, useMutation, useAction } from "@/lib/firebase-hooks";
import { Authenticated, Unauthenticated, AuthLoading } from "@/lib/firebase-hooks";
import { api } from "@/lib/firebase-api";
import { AdminLayout } from "@/components/admin-layout.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import {
  SparklesIcon, UploadIcon, SearchIcon, RefreshCwIcon, ExternalLinkIcon,
  CheckCircle2Icon, AlertCircleIcon, Loader2Icon, ImageIcon, RotateCcwIcon, WandSparklesIcon,
} from "lucide-react";
import { MOCKUP_SHOTS, SHOT_BY_KEY, mockupFileStem, type MockupShot } from "@/lib/ai-mockup-shots.ts";

const SIZES = ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"];
const MODELS = ["nano-banana-edit", "nano-banana", "seedream-4", "gpt-4o-image", "gpt-image-1-5"];
const POLL_MS = 4000;

type Job = {
  _id: string;
  rNumber: string;
  designName?: string;
  shotKey: string;
  gadget: string;
  status: "queued" | "running" | "done" | "failed";
  taskId?: string;
  url?: string;
  r2Key?: string;
  error?: string;
  attempt?: number;
  createdAt: number;
};

export default function AdminAiMockupsPage() {
  return (
    <AdminLayout>
      <AuthLoading>
        <div className="space-y-4">
          <Skeleton className="h-9 w-64" />
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      </AuthLoading>
      <Unauthenticated>
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="space-y-4 text-center">
            <h2 className="text-xl font-semibold">Sign in required</h2>
            <p className="text-muted-foreground">Please sign in to generate mockups.</p>
            <SignInButton />
          </div>
        </div>
      </Unauthenticated>
      <Authenticated>
        <AiMockupsContent />
      </Authenticated>
    </AdminLayout>
  );
}

function AiMockupsContent() {
  const [tab, setTab] = useState<"studio" | "prompts">("studio");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <WandSparklesIcon className="size-6 text-violet-600" />
            AI Mockup Studio
          </h1>
          <p className="text-sm text-muted-foreground">
            Turn a raw photo of a printed roll into product images, one design at a time.
          </p>
        </div>
        <div className="flex gap-1 rounded-lg border bg-muted/40 p-1">
          {(["studio", "prompts"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-md px-4 py-1.5 text-sm font-medium capitalize transition ${
                tab === t ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {tab === "studio" ? <Studio /> : <PromptsEditor />}
    </div>
  );
}

/* ------------------------------------------------------------------ prompts */

/** Default text from code, with any saved override merged over the top. */
function useResolvedShots(): (MockupShot & { promptId?: string; isOverride: boolean })[] {
  const overrides = useQuery(api.aiMockups.getPrompts) as any[] | undefined;
  return useMemo(() => {
    const byKey = new Map((overrides || []).map((o) => [o.key, o]));
    return MOCKUP_SHOTS.map((shot) => {
      const o = byKey.get(shot.key);
      return o
        ? { ...shot, prompt: o.prompt ?? shot.prompt, model: o.model ?? shot.model, size: o.size ?? shot.size, promptId: o._id, isOverride: true }
        : { ...shot, isOverride: false };
    });
  }, [overrides]);
}

function PromptsEditor() {
  const shots = useResolvedShots();
  const createPrompt = useMutation(api.aiMockups.createMockupPrompt);
  const updatePrompt = useMutation(api.aiMockups.updateMockupPrompt);
  const deletePrompt = useMutation(api.aiMockups.deleteMockupPrompt);
  const [draft, setDraft] = useState<Record<string, { prompt: string; model: string; size: string }>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const valueFor = (s: (typeof shots)[0]) => draft[s.key] ?? { prompt: s.prompt, model: s.model, size: s.size };
  const edit = (key: string, patch: Partial<{ prompt: string; model: string; size: string }>) => {
    const s = shots.find((x) => x.key === key)!;
    setDraft((d) => ({ ...d, [key]: { ...(d[key] ?? { prompt: s.prompt, model: s.model, size: s.size }), ...patch } }));
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
        Every prompt tells the model to copy the reference artwork exactly rather than reinterpret it. Keep that
        instruction when you edit &mdash; the customer receives the printed design, so a listing that shows a
        different pattern becomes a return.
      </div>

      {shots.map((shot) => {
        const v = valueFor(shot);
        const dirty = !!draft[shot.key] && (v.prompt !== shot.prompt || v.model !== shot.model || v.size !== shot.size);
        return (
          <Card key={shot.key}>
            <CardContent className="space-y-3 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{shot.label}</span>
                  <Badge variant="outline" className="text-[10px]">{shot.gadget}</Badge>
                  <code className="rounded bg-muted px-1.5 py-0.5 text-[11px]">…-{shot.suffix}</code>
                  {shot.isOverride && <Badge className="bg-violet-600 text-[10px]">edited</Badge>}
                </div>
                <div className="flex items-center gap-2">
                  <Select value={v.model} onValueChange={(x) => edit(shot.key, { model: x })}>
                    <SelectTrigger className="h-8 w-[170px] text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{MODELS.map((m) => <SelectItem key={m} value={m} className="text-xs">{m}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={v.size} onValueChange={(x) => edit(shot.key, { size: x })}>
                    <SelectTrigger className="h-8 w-[80px] text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{SIZES.map((s) => <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>

              <Textarea
                value={v.prompt}
                onChange={(e) => edit(shot.key, { prompt: e.target.value })}
                rows={6}
                className="font-mono text-xs leading-relaxed"
              />

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  disabled={!dirty || saving === shot.key}
                  onClick={async () => {
                    setSaving(shot.key);
                    try {
                      const payload = { key: shot.key, label: shot.label, gadget: shot.gadget, ...v, updatedAt: Date.now() };
                      if (shot.promptId) await updatePrompt({ promptId: shot.promptId, ...payload });
                      else await createPrompt(payload);
                      setDraft((d) => { const n = { ...d }; delete n[shot.key]; return n; });
                      toast.success("Prompt saved");
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Could not save");
                    } finally { setSaving(null); }
                  }}
                >
                  {saving === shot.key ? <Loader2Icon className="mr-1 size-3.5 animate-spin" /> : null}
                  Save
                </Button>
                {dirty && (
                  <Button size="sm" variant="ghost" onClick={() => setDraft((d) => { const n = { ...d }; delete n[shot.key]; return n; })}>
                    Discard
                  </Button>
                )}
                {shot.isOverride && !dirty && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      if (!confirm("Reset this prompt to the built-in default?")) return;
                      await deletePrompt({ promptId: shot.promptId });
                      toast.success("Reset to default");
                    }}
                  >
                    <RotateCcwIcon className="mr-1 size-3.5" />
                    Reset to default
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------- studio */

function Studio() {
  const rolls = useQuery(api.rollsManagement.getRollInventory) as any[] | undefined;
  const jobs = useQuery(api.aiMockups.getJobs, { take: 300 }) as Job[] | undefined;
  const shots = useResolvedShots();

  const [search, setSearch] = useState("");
  const [selectedRollId, setSelectedRollId] = useState<string | null>(null);
  const [picked, setPicked] = useState<string[]>(["laptop-top"]);

  const sortedRolls = useMemo(() => {
    const list = (rolls || []).map((r) => ({ ...r, rNumber: String(r.rNumber || "").trim() }));
    const q = search.trim().toLowerCase();
    return list
      .filter((r) => !q || r.rNumber.toLowerCase().includes(q) || String(r.designName || "").toLowerCase().includes(q))
      .sort((a, b) => a.rNumber.localeCompare(b.rNumber, undefined, { numeric: true }));
  }, [rolls, search]);

  const selected = sortedRolls.find((r) => r._id === selectedRollId) || null;
  const jobsForRoll = useMemo(
    () => (jobs || []).filter((j) => selected && j.rNumber === selected.rNumber),
    [jobs, selected]
  );

  if (rolls === undefined) {
    return <div className="space-y-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <div className="space-y-3">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search R-number or design" className="pl-9" />
        </div>
        <p className="text-xs text-muted-foreground">{sortedRolls.length} rolls</p>
        <div className="max-h-[70vh] space-y-1.5 overflow-y-auto pr-1">
          {sortedRolls.map((r) => {
            const done = (jobs || []).filter((j) => j.rNumber === r.rNumber && j.status === "done").length;
            return (
              <button
                key={r._id}
                onClick={() => setSelectedRollId(r._id)}
                className={`flex w-full items-center gap-2.5 rounded-lg border p-2 text-left transition ${
                  selectedRollId === r._id ? "border-violet-400 bg-violet-50 dark:bg-violet-950/40" : "hover:bg-muted/60"
                }`}
              >
                <div className="size-10 shrink-0 overflow-hidden rounded-md bg-muted">
                  {r.rawImageUrl ? (
                    <img src={r.rawImageUrl} alt="" className="size-full object-cover" />
                  ) : (
                    <div className="flex size-full items-center justify-center"><ImageIcon className="size-4 text-muted-foreground/40" /></div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-xs font-semibold">{r.rNumber}</span>
                    {done > 0 && <Badge variant="outline" className="h-4 px-1 text-[10px]">{done}</Badge>}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{r.designName || "Untitled"}</p>
                </div>
                {!r.rawImageUrl && <span className="shrink-0 text-[10px] text-amber-600">no photo</span>}
              </button>
            );
          })}
        </div>
      </div>

      {selected ? (
        <RollPanel
          key={selected._id}
          roll={selected}
          shots={shots}
          picked={picked}
          setPicked={setPicked}
          jobs={jobsForRoll}
        />
      ) : (
        <Card><CardContent className="flex min-h-[300px] items-center justify-center text-muted-foreground">
          Pick a design on the left to start.
        </CardContent></Card>
      )}
    </div>
  );
}

function RollPanel({ roll, shots, picked, setPicked, jobs }: {
  roll: any;
  shots: ReturnType<typeof useResolvedShots>;
  picked: string[];
  setPicked: (v: string[]) => void;
  jobs: Job[];
}) {
  const uploadToLibrary = useAction(api.mediaLibrary.uploadAndAddToLibrary);
  const updateRoll = useMutation(api.rollsManagement.updateRollInventory);
  const createJob = useMutation(api.aiMockups.createDesignMockup);
  const updateJob = useMutation(api.aiMockups.updateDesignMockup);
  const submit = useAction(api.poyo.poyoSubmit);

  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [starting, setStarting] = useState(false);

  useJobPoller(jobs, updateJob, uploadToLibrary);

  const onUploadRaw = async (file: File) => {
    setUploading(true);
    try {
      const base64 = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(String(r.result));
        r.onerror = rej;
        r.readAsDataURL(file);
      });
      const stem = String(roll.rNumber).trim().toUpperCase().replace(/[^A-Z0-9-]/g, "");
      const result: any = await uploadToLibrary({
        fileBase64: base64,
        key: `design-raw/${stem}.webp`,
        filename: `${stem}.webp`,
        folder: "design-raw",
        contentType: file.type || "image/jpeg",
        tags: ["raw-design", stem],
      });
      const url = result?.url || result?.publicUrl;
      if (!url) throw new Error(result?.error || "Upload failed");
      await updateRoll({ id: roll._id, rawImageUrl: url });
      toast.success("Raw design saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const generate = async () => {
    if (!roll.rawImageUrl) return toast.error("Upload the raw design photo first");
    if (!picked.length) return toast.error("Pick at least one gadget");
    setStarting(true);
    let started = 0;
    for (const key of picked) {
      const shot = shots.find((s) => s.key === key);
      if (!shot) continue;
      const attempt = jobs.filter((j) => j.shotKey === key).length + 1;
      let jobId: string | null = null;
      try {
        jobId = (await createJob({
          rNumber: String(roll.rNumber).trim(),
          designName: roll.designName || "",
          shotKey: key,
          gadget: shot.gadget,
          suffix: shot.suffix,
          sourceUrl: roll.rawImageUrl,
          status: "queued",
          attempt,
          createdAt: Date.now(),
        })) as string;

        const res: any = await submit({
          model: shot.model,
          size: shot.size,
          prompt: shot.prompt,
          imageUrls: [roll.rawImageUrl],
        });
        await updateJob({ mockupId: jobId, taskId: res.taskId, status: "running" });
        started++;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Submit failed";
        if (jobId) await updateJob({ mockupId: jobId, status: "failed", error: msg });
        toast.error(`${shot.label}: ${msg}`);
      }
    }
    setStarting(false);
    if (started) toast.success(`${started} image${started > 1 ? "s" : ""} generating…`);
  };

  return (
    <div className="space-y-5">
      <Card>
        <CardContent className="flex flex-col gap-4 p-4 sm:flex-row">
          <div className="size-40 shrink-0 overflow-hidden rounded-xl border bg-muted">
            {roll.rawImageUrl ? (
              <img src={roll.rawImageUrl} alt="Raw design" className="size-full object-cover" />
            ) : (
              <div className="flex size-full flex-col items-center justify-center gap-1 text-muted-foreground/50">
                <ImageIcon className="size-7" />
                <span className="text-[11px]">No raw photo</span>
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <span className="font-mono text-lg font-bold">{roll.rNumber}</span>
              <Badge variant="outline">{roll.metersAvailable ?? 0} m left</Badge>
            </div>
            <p className="text-muted-foreground">{roll.designName || "Untitled design"}</p>
            <p className="text-xs text-muted-foreground">
              This photo is sent to the model as the reference. Shoot the roll flat, straight down, in soft
              daylight with no flash &mdash; glare is what the model copies worst.
            </p>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void onUploadRaw(f); }}
            />
            <Button size="sm" variant="outline" disabled={uploading} onClick={() => fileRef.current?.click()}>
              {uploading ? <Loader2Icon className="mr-1.5 size-3.5 animate-spin" /> : <UploadIcon className="mr-1.5 size-3.5" />}
              {roll.rawImageUrl ? "Replace raw photo" : "Upload raw photo"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-4">
          <Label>Which images should we make?</Label>
          <div className="grid gap-2 sm:grid-cols-2">
            {shots.map((s) => {
              const on = picked.includes(s.key);
              return (
                <button
                  key={s.key}
                  onClick={() => setPicked(on ? picked.filter((k) => k !== s.key) : [...picked, s.key])}
                  className={`flex items-center gap-2.5 rounded-lg border p-2.5 text-left text-sm transition ${
                    on ? "border-violet-400 bg-violet-50 dark:bg-violet-950/40" : "hover:bg-muted/60"
                  }`}
                >
                  <span className={`flex size-4 shrink-0 items-center justify-center rounded border ${on ? "border-violet-600 bg-violet-600 text-white" : "border-muted-foreground/40"}`}>
                    {on && <CheckCircle2Icon className="size-3" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{s.label}</span>
                    <code className="text-[10px] text-muted-foreground">
                      {mockupFileStem(String(roll.rNumber), s.suffix)}.webp
                    </code>
                  </span>
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={generate} disabled={starting || !roll.rawImageUrl || !picked.length}>
              {starting ? <Loader2Icon className="mr-1.5 size-4 animate-spin" /> : <SparklesIcon className="mr-1.5 size-4" />}
              Generate {picked.length} image{picked.length === 1 ? "" : "s"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setPicked(MOCKUP_SHOTS.map((s) => s.key))}>Select all</Button>
            <Button size="sm" variant="ghost" onClick={() => setPicked([])}>Clear</Button>
          </div>
        </CardContent>
      </Card>

      {jobs.length > 0 && (
        <div className="space-y-2">
          <Label>Generated ({jobs.length})</Label>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {jobs.map((j) => <JobCard key={j._id} job={j} />)}
          </div>
        </div>
      )}
    </div>
  );
}

function JobCard({ job }: { job: Job }) {
  const shot = SHOT_BY_KEY[job.shotKey];
  return (
    <Card>
      <CardContent className="space-y-2 p-3">
        <div className="aspect-square overflow-hidden rounded-lg bg-muted">
          {job.url ? (
            <img src={job.url} alt={job.shotKey} className="size-full object-cover" />
          ) : (
            <div className="flex size-full flex-col items-center justify-center gap-2 text-muted-foreground">
              {job.status === "failed" ? (
                <><AlertCircleIcon className="size-6 text-rose-500" /><span className="px-2 text-center text-[11px] text-rose-600">{job.error || "Failed"}</span></>
              ) : (
                <><Loader2Icon className="size-6 animate-spin" /><span className="text-[11px] capitalize">{job.status}</span></>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-xs font-medium">{shot?.label || job.shotKey}</p>
            <code className="text-[10px] text-muted-foreground">
              {mockupFileStem(job.rNumber, job.gadget === "laptop" ? shot?.suffix || job.shotKey : shot?.suffix || job.shotKey, job.attempt || 1)}
            </code>
          </div>
          {job.url && (
            <a href={job.url} target="_blank" rel="noreferrer" className="shrink-0 text-muted-foreground hover:text-foreground">
              <ExternalLinkIcon className="size-3.5" />
            </a>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Drives every unfinished job to completion.
 *
 * PoYo is asynchronous, so the browser polls. Job state lives in Firestore
 * rather than component state so that closing the tab mid-generation loses
 * nothing: reopening the page picks the same jobs back up.
 */
function useJobPoller(
  jobs: Job[],
  updateJob: (a: any) => Promise<any>,
  uploadToLibrary: (a: any) => Promise<any>
) {
  const status = useAction(api.poyo.poyoStatus);
  const fetchImage = useAction(api.poyo.poyoFetchImage);
  const inFlight = useRef<Set<string>>(new Set());

  const tick = useCallback(async () => {
    const pending = jobs.filter((j) => j.status === "running" && j.taskId && !inFlight.current.has(j._id));
    for (const job of pending) {
      inFlight.current.add(job._id);
      try {
        const res: any = await status({ taskId: job.taskId });
        if (res.status === "failed" || res.error) {
          await updateJob({ mockupId: job._id, status: "failed", error: res.error || "Generation failed" });
        } else if (res.status === "finished" && res.fileUrl) {
          const shot = SHOT_BY_KEY[job.shotKey];
          const stem = mockupFileStem(job.rNumber, shot?.suffix || job.shotKey, job.attempt || 1);
          // Relayed through the function because storage.poyo.ai is not
          // CORS-open; going via base64 also puts the bytes through the same
          // WebP normaliser as every other upload.
          const img: any = await fetchImage({ url: res.fileUrl });
          const uploaded: any = await uploadToLibrary({
            fileBase64: img.base64,
            key: `ai-mockups/${stem}.webp`,
            filename: `${stem}.webp`,
            folder: "ai-mockups",
            contentType: img.contentType,
            tags: ["ai-mockup", job.rNumber, job.gadget],
          });
          const url = uploaded?.url || uploaded?.publicUrl;
          if (!url) throw new Error(uploaded?.error || "Upload to media library failed");
          await updateJob({ mockupId: job._id, status: "done", url, r2Key: uploaded?.key || `ai-mockups/${stem}.webp` });
        }
      } catch (e) {
        await updateJob({
          mockupId: job._id,
          status: "failed",
          error: e instanceof Error ? e.message : "Polling failed",
        });
      } finally {
        inFlight.current.delete(job._id);
      }
    }
  }, [jobs, status, fetchImage, updateJob, uploadToLibrary]);

  useEffect(() => {
    if (!jobs.some((j) => j.status === "running")) return;
    const id = setInterval(() => { void tick(); }, POLL_MS);
    return () => clearInterval(id);
  }, [jobs, tick]);
}
