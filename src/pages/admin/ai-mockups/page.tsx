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
import { Switch } from "@/components/ui/switch.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import {
  SparklesIcon, UploadIcon, SearchIcon, ExternalLinkIcon, PlusIcon, TrashIcon,
  CheckCircle2Icon, AlertCircleIcon, Loader2Icon, ImageIcon, CopyIcon, WandSparklesIcon,
  ThumbsUpIcon, ThumbsDownIcon, RefreshCwIcon, FolderIcon,
} from "lucide-react";
import {
  saveLocally, chooseBackupFolder, getBackupFolder, supportsDirectoryPicker,
} from "@/lib/local-backup.ts";
import {
  STARTER_SHOTS, DEFAULT_BLOCKS, PLACEHOLDERS, expandPrompt, mockupFileStem,
  type MockupShot, type SharedBlocks,
} from "@/lib/ai-mockup-shots.ts";
import {
  IMAGE_MODELS, MODEL_BY_ID, DEFAULT_MODEL_ID, formatInr, formatCredits, resolveSize, USD_TO_INR,
} from "@/lib/ai-mockup-models.ts";

const SIZES = ["1:1", "2:3", "3:2", "3:4", "4:3", "9:16", "16:9", "21:9"];
const DEFAULT_ASPECT = "4:3";
const POLL_MS = 4000;

type Job = {
  _id: string;
  rNumber: string;
  shotId?: string;
  shotLabel?: string;
  gadget: string;
  suffix: string;
  status: "queued" | "running" | "review" | "approved" | "rejected" | "failed";
  taskId?: string;
  url?: string;
  r2Key?: string;
  /** Staged object, before a human has decided anything. */
  pendingKey?: string;
  pendingUrl?: string;
  rejectedTo?: string;
  skuCodes?: string[];
  linkedCount?: number;
  error?: string;
  attempt?: number;
  modelLabel?: string;
  aspect?: string;
  credits?: number;
  costInr?: number;
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

/** Shots and shared blocks, straight from Firestore. */
function useShotLibrary() {
  const shots = useQuery(api.aiMockups.getPrompts) as MockupShot[] | undefined;
  const settings = useQuery(api.aiMockups.getSettings) as { blocks?: SharedBlocks } | null | undefined;
  const blocks: SharedBlocks = { ...DEFAULT_BLOCKS, ...(settings?.blocks || {}) };
  const loading = shots === undefined || settings === undefined;
  return { shots: shots || [], blocks, loading };
}

function groupByGadget<T extends { gadget: string }>(rows: T[]): [string, T[]][] {
  const map = new Map<string, T[]>();
  for (const r of rows) {
    const g = r.gadget || "other";
    if (!map.has(g)) map.set(g, []);
    map.get(g)!.push(r);
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

function AiMockupsContent() {
  const [tab, setTab] = useState<"studio" | "shots">("studio");
  // Held above the tabs: switching to Shots unmounts Studio, and losing your
  // place every time you tweak a prompt is maddening.
  const [selectedRollId, setSelectedRollId] = useState<string | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [modelId, setModelId] = useState<string>(DEFAULT_MODEL_ID);
  const [aspect, setAspect] = useState<string>(DEFAULT_ASPECT);

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
          {(["studio", "shots"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-md px-4 py-1.5 text-sm font-medium capitalize transition ${
                tab === t ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "shots" ? "Gadgets & prompts" : t}
            </button>
          ))}
        </div>
      </div>

      {tab === "studio" ? (
        <Studio
          selectedRollId={selectedRollId}
          setSelectedRollId={setSelectedRollId}
          picked={picked}
          setPicked={setPicked}
          modelId={modelId}
          setModelId={setModelId}
          aspect={aspect}
          setAspect={setAspect}
          onManageShots={() => setTab("shots")}
        />
      ) : (
        <ShotLibrary />
      )}
    </div>
  );
}

/* --------------------------------------------------- gadgets & prompts tab */

function ShotLibrary() {
  const { shots, blocks, loading } = useShotLibrary();
  const gadgetTypes = useQuery(api.gadgetTypes.list) as any[] | undefined;
  const createShot = useMutation(api.aiMockups.createMockupPrompt);
  const updateShot = useMutation(api.aiMockups.updateMockupPrompt);
  const deleteShot = useMutation(api.aiMockups.deleteMockupPrompt);
  const saveSettings = useMutation(api.aiMockups.updateMockupSettings);

  const [seeding, setSeeding] = useState(false);
  const [newGadget, setNewGadget] = useState("");

  const grouped = groupByGadget(shots);
  const usedGadgets = new Set(shots.map((s) => s.gadget));
  const availableGadgets = (gadgetTypes || [])
    .map((g) => String(g.name || "").trim())
    .filter(Boolean)
    .sort();

  const addShot = async (gadget: string, gadgetTypeId?: string) => {
    const siblings = shots.filter((s) => s.gadget === gadget);
    await createShot({
      label: siblings.length ? `Angle ${siblings.length + 1}` : "Main shot",
      gadget,
      gadgetTypeId: gadgetTypeId || (gadgetTypes || []).find((g) => g.name === gadget)?._id || "",
      suffix: siblings.length ? `${gadget}-${siblings.length + 1}` : gadget,
      skuCodes: [],
      order: siblings.length,
      isActive: true,
      prompt:
        `A <describe the device> photographed from <describe the angle>, filling most of the frame. ` +
        `A vinyl skin covers <describe which surface>. {{fidelity}} {{staging}}`,
      createdAt: Date.now(),
    });
    toast.success(`Shot added to ${gadget}`);
  };

  if (loading) {
    return <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}</div>;
  }

  return (
    <div className="space-y-5">
      <SharedBlocksEditor blocks={blocks} onSave={(b) => saveSettings({ blocks: b })} />

      <div className="flex flex-wrap items-center gap-2 rounded-xl border p-3">
        <Label className="text-sm">Add a gadget</Label>
        <Select value={newGadget} onValueChange={setNewGadget}>
          <SelectTrigger className="h-9 w-[220px]"><SelectValue placeholder="Pick a gadget type" /></SelectTrigger>
          <SelectContent>
            {availableGadgets.map((g) => (
              <SelectItem key={g} value={g}>
                {g}{usedGadgets.has(g) ? " · already has shots" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          disabled={!newGadget}
          onClick={async () => { await addShot(newGadget); setNewGadget(""); }}
        >
          <PlusIcon className="mr-1 size-3.5" />
          Add shot
        </Button>
        <p className="text-xs text-muted-foreground">
          The list comes from your gadget types, so a new gadget added there — drone, GoPro, action
          camera — shows up here without a code change.
        </p>
      </div>

      {shots.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <ImageIcon className="size-8 text-muted-foreground/40" />
            <p className="text-muted-foreground">No shots defined yet.</p>
            <Button
              disabled={seeding}
              onClick={async () => {
                setSeeding(true);
                try {
                  for (const s of STARTER_SHOTS) {
                    const gt = (gadgetTypes || []).find((g) => g.name === s.gadget);
                    await createShot({ ...s, gadgetTypeId: gt?._id || "", createdAt: Date.now() });
                  }
                  toast.success(`${STARTER_SHOTS.length} starter shots added`);
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Could not seed");
                } finally { setSeeding(false); }
              }}
            >
              {seeding ? <Loader2Icon className="mr-1.5 size-4 animate-spin" /> : <SparklesIcon className="mr-1.5 size-4" />}
              Load the 7 starter shots
            </Button>
            <p className="max-w-md text-xs text-muted-foreground">
              Laptop (lid and open), lens, camera body, PS5, iPad and charger. They become ordinary
              rows you can edit, duplicate or delete.
            </p>
          </CardContent>
        </Card>
      )}

      {grouped.map(([gadget, rows]) => (
        <div key={gadget} className="space-y-2">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold capitalize">{gadget}</h3>
            <Badge variant="outline" className="text-[10px]">{rows.length} image{rows.length === 1 ? "" : "s"} per design</Badge>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => addShot(gadget)}>
              <PlusIcon className="mr-1 size-3" />
              Add another angle
            </Button>
          </div>
          {rows.map((shot) => (
            <ShotCard
              key={shot._id}
              shot={shot}
              onSave={(patch) => updateShot({ promptId: shot._id, ...patch })}
              onDelete={() => deleteShot({ promptId: shot._id })}
              onDuplicate={() =>
                createShot({
                  ...shot, _id: undefined,
                  label: `${shot.label} (copy)`,
                  suffix: `${shot.suffix}-2`,
                  order: (shot.order || 0) + 1,
                  createdAt: Date.now(),
                })
              }
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function SharedBlocksEditor({ blocks, onSave }: { blocks: SharedBlocks; onSave: (b: SharedBlocks) => Promise<any> }) {
  const [draft, setDraft] = useState<SharedBlocks | null>(null);
  const [saving, setSaving] = useState(false);
  const v = draft ?? blocks;
  const dirty = !!draft && (draft.fidelity !== blocks.fidelity || draft.staging !== blocks.staging);

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div>
          <h3 className="text-sm font-semibold">Shared prompt blocks</h3>
          <p className="text-xs text-muted-foreground">
            Written once and pulled into any prompt with <code className="rounded bg-muted px-1">{"{{fidelity}}"}</code> and{" "}
            <code className="rounded bg-muted px-1">{"{{staging}}"}</code>. Editing here changes every shot at once
            &mdash; which is the point: the fidelity block is what stops the model inventing a pattern, and it
            must not drift shot by shot.
          </p>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          {(["fidelity", "staging"] as const).map((k) => (
            <div key={k} className="space-y-1">
              <Label className="text-xs capitalize">{k}</Label>
              <Textarea
                rows={5}
                className="font-mono text-[11px] leading-relaxed"
                value={v[k]}
                onChange={(e) => setDraft({ ...v, [k]: e.target.value })}
              />
            </div>
          ))}
        </div>
        {dirty && (
          <div className="flex gap-2">
            <Button size="sm" disabled={saving} onClick={async () => {
              setSaving(true);
              try { await onSave(v); setDraft(null); toast.success("Shared blocks saved"); }
              catch (e) { toast.error(e instanceof Error ? e.message : "Could not save"); }
              finally { setSaving(false); }
            }}>
              {saving && <Loader2Icon className="mr-1 size-3.5 animate-spin" />}
              Save
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setDraft(null)}>Discard</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ShotCard({ shot, onSave, onDelete, onDuplicate }: {
  shot: MockupShot;
  onSave: (patch: Partial<MockupShot>) => Promise<any>;
  onDelete: () => Promise<any>;
  onDuplicate: () => Promise<any>;
}) {
  const [draft, setDraft] = useState<Partial<MockupShot> | null>(null);
  const [saving, setSaving] = useState(false);
  const v = { ...shot, ...(draft || {}) };
  const dirty = !!draft && Object.entries(draft).some(([k, val]) => (shot as any)[k] !== val);
  const edit = (patch: Partial<MockupShot>) => setDraft({ ...(draft || {}), ...patch });

  return (
    <Card className={v.isActive ? "" : "opacity-60"}>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={v.label}
            onChange={(e) => edit({ label: e.target.value })}
            className="h-8 w-[220px] font-medium"
            placeholder="Shot name"
          />
          <div className="flex items-center gap-1">
            <span className="text-[11px] text-muted-foreground">file</span>
            <Input
              value={v.suffix}
              onChange={(e) => edit({ suffix: e.target.value })}
              className="h-8 w-[150px] font-mono text-xs"
              placeholder="laptop-top"
            />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[11px] text-muted-foreground">SKU</span>
            <Input
              value={(v.skuCodes || []).join(", ")}
              onChange={(e) => edit({ skuCodes: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })}
              className="h-8 w-[170px] font-mono text-xs"
              placeholder="LP, LPT"
            />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Switch checked={v.isActive !== false} onCheckedChange={(c) => edit({ isActive: c })} />
            <Button size="sm" variant="ghost" className="h-8 px-2" onClick={onDuplicate} title="Duplicate">
              <CopyIcon className="size-3.5" />
            </Button>
            <Button
              size="sm" variant="ghost" className="h-8 px-2 text-rose-600" title="Delete"
              onClick={async () => { if (confirm(`Delete "${shot.label}"?`)) { await onDelete(); toast.success("Shot deleted"); } }}
            >
              <TrashIcon className="size-3.5" />
            </Button>
          </div>
        </div>

        <Textarea
          rows={5}
          value={v.prompt}
          onChange={(e) => edit({ prompt: e.target.value })}
          className="font-mono text-xs leading-relaxed"
        />
        <p className="text-[11px] text-muted-foreground">
          Placeholders: {PLACEHOLDERS.map((p) => <code key={p} className="mr-1 rounded bg-muted px-1">{`{{${p}}}`}</code>)}
        </p>
        <p className="text-[11px] text-muted-foreground">
          On approval this image is attached to every product whose variant SKU ends{" "}
          {(v.skuCodes || []).length
            ? (v.skuCodes || []).map((c) => <code key={c} className="mr-1 rounded bg-muted px-1">-{c}</code>)
            : <span className="text-amber-600">— no SKU codes set, so it will not link to anything</span>}
        </p>

        {dirty && (
          <div className="flex gap-2">
            <Button size="sm" disabled={saving} onClick={async () => {
              setSaving(true);
              try { await onSave(draft!); setDraft(null); toast.success("Saved"); }
              catch (e) { toast.error(e instanceof Error ? e.message : "Could not save"); }
              finally { setSaving(false); }
            }}>
              {saving && <Loader2Icon className="mr-1 size-3.5 animate-spin" />}
              Save
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setDraft(null)}>Discard</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------- studio tab */

function Studio({ selectedRollId, setSelectedRollId, picked, setPicked, modelId, setModelId, aspect, setAspect, onManageShots }: {
  selectedRollId: string | null;
  setSelectedRollId: (v: string | null) => void;
  picked: string[];
  setPicked: (v: string[]) => void;
  modelId: string;
  setModelId: (v: string) => void;
  aspect: string;
  setAspect: (v: string) => void;
  onManageShots: () => void;
}) {
  const rolls = useQuery(api.rollsManagement.getRollInventory) as any[] | undefined;
  const jobs = useQuery(api.aiMockups.getJobs, { take: 300 }) as Job[] | undefined;
  const { shots, blocks, loading } = useShotLibrary();
  const [search, setSearch] = useState("");

  const activeShots = shots.filter((s) => s.isActive !== false);

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

  if (rolls === undefined || loading) {
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
            const done = (jobs || []).filter((j) => j.rNumber === r.rNumber && j.status === "approved").length;
            return (
              <button
                key={r._id}
                onClick={() => setSelectedRollId(r._id)}
                className={`flex w-full items-center gap-2.5 rounded-lg border p-2 text-left transition ${
                  selectedRollId === r._id ? "border-violet-400 bg-violet-50 dark:bg-violet-950/40" : "hover:bg-muted/60"
                }`}
              >
                <div className="size-10 shrink-0 overflow-hidden rounded-md bg-muted">
                  {r.rawImageUrl ? <img src={r.rawImageUrl} alt="" className="size-full object-cover" />
                    : <div className="flex size-full items-center justify-center"><ImageIcon className="size-4 text-muted-foreground/40" /></div>}
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
          shots={activeShots}
          blocks={blocks}
          picked={picked}
          setPicked={setPicked}
          modelId={modelId}
          setModelId={setModelId}
          aspect={aspect}
          setAspect={setAspect}
          jobs={jobsForRoll}
          onManageShots={onManageShots}
        />
      ) : (
        <Card><CardContent className="flex min-h-[300px] items-center justify-center text-muted-foreground">
          Pick a design on the left to start.
        </CardContent></Card>
      )}
    </div>
  );
}

function RollPanel({ roll, shots, blocks, picked, setPicked, modelId, setModelId, aspect, setAspect, jobs, onManageShots }: {
  roll: any;
  shots: MockupShot[];
  blocks: SharedBlocks;
  picked: string[];
  setPicked: (v: string[]) => void;
  modelId: string;
  setModelId: (v: string) => void;
  aspect: string;
  setAspect: (v: string) => void;
  jobs: Job[];
  onManageShots: () => void;
}) {
  const uploadToLibrary = useAction(api.mediaLibrary.uploadAndAddToLibrary);
  const updateRoll = useMutation(api.rollsManagement.updateRollInventory);
  const createJob = useMutation(api.aiMockups.createDesignMockup);
  const updateJob = useMutation(api.aiMockups.updateDesignMockup);
  const submit = useAction(api.poyo.poyoSubmit);
  const linkTargets = useQuery(api.aiMockups.getLinkTargets, { rNumber: String(roll.rNumber).trim() }) as any[] | undefined;
  const copyObject = useAction(api.r2.copyR2Object);
  const getObject = useAction(api.r2.getR2Object);
  const deleteObject = useAction(api.r2.deleteR2Object);
  const addMediaItem = useMutation(api.mediaLibrary.createMediaItem);
  const linkToProducts = useMutation(api.aiMockups.linkMockupToProducts);
  const model = MODEL_BY_ID[modelId] ?? MODEL_BY_ID[DEFAULT_MODEL_ID];
  // One ratio for the whole run, and it wins: a shot no longer carries its own.
  // The model still gets the last word, because a ratio it does not accept is a
  // 400 rather than a preference.
  const effectiveSize = resolveSize(model, aspect);

  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [starting, setStarting] = useState(false);
  const [busyJob, setBusyJob] = useState<string | null>(null);
  const [redoJob, setRedoJob] = useState<Job | null>(null);
  const [backupFolder, setBackupFolder] = useState<string | null>(null);

  useEffect(() => {
    void getBackupFolder().then((h: any) => setBackupFolder(h?.name ?? null));
  }, []);

  useJobPoller(jobs, updateJob);

  const grouped = groupByGadget(shots);

  /** Products a shot's image would attach to for this design, right now. */
  const targetsFor = useCallback((shot: MockupShot) => {
    if (!linkTargets) return null;
    const codes = (shot.skuCodes || []).map((c) => c.toUpperCase());
    const seen = new Map<string, string>();
    for (const t of linkTargets) {
      if (codes.includes(t.code) && t.gadget === String(shot.gadget).toLowerCase()) {
        seen.set(t.productId, t.productTitle);
      }
    }
    return [...seen.values()];
  }, [linkTargets]);

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

  const runShot = async (shot: MockupShot, useModel: typeof model, useSize: string) => {
    const attempt = jobs.filter((j) => j.shotId === shot._id).length + 1;
    let jobId: string | null = null;
    try {
      jobId = (await createJob({
        rNumber: String(roll.rNumber).trim(),
        designName: roll.designName || "",
        shotId: shot._id,
        shotLabel: shot.label,
        gadget: shot.gadget,
        suffix: shot.suffix,
        skuCodes: shot.skuCodes || [],
        sourceUrl: roll.rawImageUrl,
        status: "queued",
        attempt,
        modelLabel: useModel.label,
        aspect: useSize,
        credits: useModel.credits,
        costInr: Number((useModel.usd * USD_TO_INR).toFixed(2)),
        createdAt: Date.now(),
      })) as string;

      const res: any = await submit({
        model: useModel.apiModel,
        size: useSize,
        resolution: useModel.resolution,
        quality: useModel.quality,
        prompt: expandPrompt(shot.prompt, blocks, { rNumber: roll.rNumber, designName: roll.designName }),
        imageUrls: [roll.rawImageUrl],
      });
      await updateJob({ mockupId: jobId, taskId: res.taskId, status: "running" });
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Submit failed";
      if (jobId) await updateJob({ mockupId: jobId, status: "failed", error: msg });
      toast.error(`${shot.label}: ${msg}`);
      return false;
    }
  };

  const generate = async () => {
    if (!roll.rawImageUrl) return toast.error("Upload the raw design photo first");
    if (!picked.length) return toast.error("Pick at least one shot");
    setStarting(true);
    let started = 0;
    for (const shotId of picked) {
      const shot = shots.find((s) => s._id === shotId);
      if (!shot) continue;
      if (await runShot(shot, model, effectiveSize)) started++;
    }
    setStarting(false);
    if (started) toast.success(`${started} image${started > 1 ? "s" : ""} generating…`);
  };

  const approve = async (job: Job) => {
    if (!job.pendingKey) return;
    setBusyJob(job._id);
    try {
      const stem = mockupFileStem(job.rNumber, job.suffix, job.attempt || 1);
      const finalKey = `ai-mockups/${stem}.webp`;
      // Copied server-side; there is no reason to pull a megabyte through the
      // browser just to push it back.
      const copied: any = await copyObject({ fromKey: job.pendingKey, toKey: finalKey, contentType: "image/webp" });
      const url = copied?.url;
      if (!url) throw new Error("Copy failed");
      await addMediaItem({
        cloudinaryUrl: url,
        cloudinaryPublicId: finalKey,
        filename: `${stem}.webp`,
        folder: "ai-mockups",
        mediaType: "image",
        format: "webp",
        width: 0,
        height: 0,
        bytes: 0,
        tags: ["ai-mockup", job.rNumber, job.gadget],
        createdAt: Date.now(),
      });
      // Link before marking approved, so a failure here does not leave a job
      // claiming to be done when nothing was attached to a product.
      let linked = 0;
      if ((job.skuCodes || []).length) {
        const res: any = await linkToProducts({
          rNumber: job.rNumber,
          skuCodes: job.skuCodes,
          gadget: job.gadget,
          url,
          alt: job.designName || job.shotLabel || "",
        });
        linked = res?.linked ?? 0;
      }
      await updateJob({ mockupId: job._id, status: "approved", url, r2Key: finalKey, pendingKey: "", linkedCount: linked });
      void deleteObject({ key: job.pendingKey }).catch(() => {});
      toast.success(
        linked
          ? `Approved · added to the media library and ${linked} product${linked > 1 ? "s" : ""}`
          : "Approved and added to the media library"
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not approve");
    } finally { setBusyJob(null); }
  };

  const reject = async (job: Job) => {
    if (!job.pendingKey) return;
    setBusyJob(job._id);
    try {
      const stem = mockupFileStem(job.rNumber, job.suffix, job.attempt || 1);
      const obj: any = await getObject({ key: job.pendingKey });
      const saved = await saveLocally(obj.base64, `${stem}.webp`, obj.contentType || "image/webp");
      await updateJob({
        mockupId: job._id,
        status: "rejected",
        rejectedTo: saved.where === "folder" ? (backupFolder || "backup folder") : "Downloads",
        pendingKey: "",
        pendingUrl: "",
      });
      void deleteObject({ key: job.pendingKey }).catch(() => {});
      toast.success(saved.where === "folder" ? `Saved to ${backupFolder}` : "Saved to Downloads");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save the reject");
    } finally { setBusyJob(null); }
  };

  const redo = async (job: Job, useModelId: string, useAspect: string) => {
    const shot = shots.find((x) => x._id === job.shotId);
    if (!shot) return toast.error("That shot no longer exists");
    const m = MODEL_BY_ID[useModelId] ?? model;
    setBusyJob(job._id);
    try {
      if (job.pendingKey) void deleteObject({ key: job.pendingKey }).catch(() => {});
      await updateJob({ mockupId: job._id, status: "rejected", rejectedTo: "discarded on redo", pendingKey: "", pendingUrl: "" });
      const ok = await runShot(shot, m, resolveSize(m, useAspect));
      if (ok) toast.success(`Regenerating with ${m.label}`);
    } finally {
      setBusyJob(null);
      setRedoJob(null);
    }
  };

  /** The task already finished and was paid for; only the ingest broke. */
  const retryDownload = async (job: Job) => {
    setBusyJob(job._id);
    try {
      await updateJob({ mockupId: job._id, status: "running", error: "" });
      toast.success("Collecting the image again…");
    } finally { setBusyJob(null); }
  };

  const ratioCoerced = effectiveSize !== aspect;
  const reviewCount = jobs.filter((j) => j.status === "review").length;

  return (
    <div className="space-y-5">
      <Card>
        <CardContent className="flex flex-col gap-4 p-4 sm:flex-row">
          <div className="size-40 shrink-0 overflow-hidden rounded-xl border bg-muted">
            {roll.rawImageUrl ? <img src={roll.rawImageUrl} alt="Raw design" className="size-full object-cover" />
              : <div className="flex size-full flex-col items-center justify-center gap-1 text-muted-foreground/50">
                  <ImageIcon className="size-7" /><span className="text-[11px]">No raw photo</span>
                </div>}
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
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void onUploadRaw(f); }} />
            <Button size="sm" variant="outline" disabled={uploading} onClick={() => fileRef.current?.click()}>
              {uploading ? <Loader2Icon className="mr-1.5 size-3.5 animate-spin" /> : <UploadIcon className="mr-1.5 size-3.5" />}
              {roll.rawImageUrl ? "Replace raw photo" : "Upload raw photo"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label>Which images should we make?</Label>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onManageShots}>
              Manage gadgets &amp; prompts
            </Button>
          </div>

          {shots.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              No shots defined yet.{" "}
              <button className="font-medium text-violet-600 underline" onClick={onManageShots}>
                Add a gadget and its prompts
              </button>{" "}
              to start.
            </div>
          ) : (
            grouped.map(([gadget, rows]) => (
              <div key={gadget} className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{gadget}</span>
                  <button
                    className="text-[11px] text-violet-600 hover:underline"
                    onClick={() => {
                      const ids = rows.map((r) => r._id);
                      const allOn = ids.every((id) => picked.includes(id));
                      setPicked(allOn ? picked.filter((p) => !ids.includes(p)) : [...new Set([...picked, ...ids])]);
                    }}
                  >
                    toggle all
                  </button>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {rows.map((s) => {
                    const on = picked.includes(s._id);
                    return (
                      <button
                        key={s._id}
                        onClick={() => setPicked(on ? picked.filter((k) => k !== s._id) : [...picked, s._id])}
                        className={`flex items-center gap-2.5 rounded-lg border p-2.5 text-left text-sm transition ${
                          on ? "border-violet-400 bg-violet-50 dark:bg-violet-950/40" : "hover:bg-muted/60"
                        }`}
                      >
                        <span className={`flex size-4 shrink-0 items-center justify-center rounded border ${on ? "border-violet-600 bg-violet-600 text-white" : "border-muted-foreground/40"}`}>
                          {on && <CheckCircle2Icon className="size-3" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{s.label}</span>
                          <code className="block truncate text-[10px] text-muted-foreground">
                            {mockupFileStem(String(roll.rNumber), s.suffix)}.webp
                          </code>
                          <LinkTargets titles={targetsFor(s)} />
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}

          <div className="space-y-2 rounded-xl border bg-muted/30 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Label className="text-xs">Model</Label>
              <Select value={modelId} onValueChange={setModelId}>
                <SelectTrigger className="h-9 w-[290px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {IMAGE_MODELS.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      <span className="flex w-full items-center justify-between gap-4">
                        <span>{m.label}</span>
                        <span className="tabular-nums text-muted-foreground">
                          {formatInr(m.usd)} · {formatCredits(m.credits)}
                        </span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Label className="ml-2 text-xs">Aspect</Label>
              <Select value={aspect} onValueChange={setAspect}>
                <SelectTrigger className="h-9 w-[110px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SIZES.map((sz) => <SelectItem key={sz} value={sz}>{sz}</SelectItem>)}
                </SelectContent>
              </Select>
              <span className="text-xs text-muted-foreground">
                {formatInr(model.usd)} &times; {picked.length} ={" "}
                <strong className="text-foreground">{formatInr(model.usd * picked.length)}</strong>
                <span className="ml-1 opacity-70">({formatCredits(model.credits * picked.length)})</span>
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Every image in this run is generated at {effectiveSize}, whatever the shot says.
            </p>
            {model.note && <p className="text-[11px] text-muted-foreground">{model.note}</p>}
            {ratioCoerced && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400">
                {model.label} does not accept {aspect}; {effectiveSize} will be used instead.
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={generate} disabled={starting || !roll.rawImageUrl || !picked.length}>
              {starting ? <Loader2Icon className="mr-1.5 size-4 animate-spin" /> : <SparklesIcon className="mr-1.5 size-4" />}
              Generate {picked.length} image{picked.length === 1 ? "" : "s"} &middot; {formatInr(model.usd * picked.length)}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setPicked(shots.map((s) => s._id))}>Select all</Button>
            <Button size="sm" variant="ghost" onClick={() => setPicked([])}>Clear</Button>
          </div>
        </CardContent>
      </Card>

      {jobs.length > 0 && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label>
              Generated ({jobs.length})
              {reviewCount > 0 && (
                <span className="ml-2 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-semibold text-white">
                  {reviewCount} awaiting review
                </span>
              )}
            </Label>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <FolderIcon className="size-3.5" />
              {backupFolder ? (
                <>Rejects go to <strong className="text-foreground">{backupFolder}</strong></>
              ) : supportsDirectoryPicker() ? (
                <>Rejects go to Downloads</>
              ) : (
                <>Rejects download (this browser cannot write to a folder)</>
              )}
              {supportsDirectoryPicker() && (
                <Button size="sm" variant="ghost" className="h-6 px-2 text-xs"
                  onClick={async () => {
                    try {
                      const h: any = await chooseBackupFolder();
                      if (h) { setBackupFolder(h.name); toast.success(`Rejects will be saved to ${h.name}`); }
                    } catch { /* the picker was dismissed */ }
                  }}>
                  {backupFolder ? "Change folder" : "Choose folder"}
                </Button>
              )}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {jobs.map((j) => (
              <JobCard
                key={j._id}
                job={j}
                busy={busyJob === j._id}
                onApprove={approve}
                onReject={reject}
                onRetryDownload={retryDownload}
                onRedo={(job) => setRedoJob(job)}
              />
            ))}
          </div>
        </div>
      )}

      {redoJob && (
        <RedoDialog
          job={redoJob}
          defaultModelId={modelId}
          defaultAspect={aspect}
          onCancel={() => setRedoJob(null)}
          onConfirm={(m, a) => void redo(redoJob, m, a)}
        />
      )}
    </div>
  );
}

/** Redo asks which model to spend on this time, rather than silently repeating. */
function RedoDialog({ job, defaultModelId, defaultAspect, onCancel, onConfirm }: {
  job: Job;
  defaultModelId: string;
  defaultAspect: string;
  onCancel: () => void;
  onConfirm: (modelId: string, aspect: string) => void;
}) {
  const [m, setM] = useState(defaultModelId);
  const [a, setA] = useState(defaultAspect);
  const model = MODEL_BY_ID[m];
  const coerced = resolveSize(model, a);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onCancel}>
      <Card className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <CardContent className="space-y-4 p-5">
          <div>
            <h3 className="font-semibold">Generate again</h3>
            <p className="text-sm text-muted-foreground">
              {job.shotLabel || job.suffix} for {job.rNumber}. The current image is discarded.
            </p>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Model</Label>
            <Select value={m} onValueChange={setM}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {IMAGE_MODELS.map((x) => (
                  <SelectItem key={x.id} value={x.id}>
                    <span className="flex w-full items-center justify-between gap-4">
                      <span>{x.label}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {formatInr(x.usd)} · {formatCredits(x.credits)}
                      </span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {job.modelLabel && (
              <p className="text-[11px] text-muted-foreground">Last time: {job.modelLabel}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Aspect</Label>
            <Select value={a} onValueChange={setA}>
              <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
              <SelectContent>{SIZES.map((sz) => <SelectItem key={sz} value={sz}>{sz}</SelectItem>)}</SelectContent>
            </Select>
            {coerced !== a && (
              <p className="text-[11px] text-amber-600">{model.label} does not accept {a}; {coerced} will be used.</p>
            )}
          </div>

          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={onCancel}>Cancel</Button>
            <Button className="flex-1" onClick={() => onConfirm(m, a)}>
              <RefreshCwIcon className="mr-1.5 size-4" />
              Generate · {formatInr(model.usd)}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * One generated image and its verdict.
 *
 * Approve promotes the staged object into the media library, reject writes it
 * to the admin's machine and clears the staging copy, redo throws it away and
 * generates again with a model you pick at that moment.
 */
/** Says where an approved image would land, before anything is generated. */
function LinkTargets({ titles }: { titles: string[] | null }) {
  if (titles === null) return <span className="text-[10px] text-muted-foreground">checking listings…</span>;
  if (!titles.length) {
    return <span className="block text-[10px] text-amber-600">no listing for this design — will not link</span>;
  }
  if (titles.length === 1) {
    return <span className="block truncate text-[10px] text-emerald-600" title={titles[0]}>→ {titles[0]}</span>;
  }
  return (
    <span className="block truncate text-[10px] text-amber-600" title={titles.join(" · ")}>
      → {titles.length} listings share this SKU: {titles.join(" · ")}
    </span>
  );
}

function JobCard({ job, onApprove, onReject, onRedo, onRetryDownload, busy }: {
  job: Job;
  onApprove: (job: Job) => Promise<void>;
  onReject: (job: Job) => Promise<void>;
  onRedo: (job: Job) => void;
  onRetryDownload: (job: Job) => Promise<void>;
  busy: boolean;
}) {
  const preview = job.url || job.pendingUrl;
  const inReview = job.status === "review";

  const badge =
    job.status === "approved" ? { text: "Approved", cls: "bg-emerald-600" }
    : job.status === "rejected" ? { text: "Rejected", cls: "bg-rose-600" }
    : job.status === "review" ? { text: "Needs review", cls: "bg-amber-500" }
    : null;

  return (
    <Card className={job.status === "rejected" ? "opacity-70" : ""}>
      <CardContent className="space-y-2 p-3">
        <div className="relative aspect-square overflow-hidden rounded-lg bg-muted">
          {preview ? (
            <img src={preview} alt={job.shotLabel || job.suffix} className="size-full object-cover" />
          ) : (
            <div className="flex size-full flex-col items-center justify-center gap-2 text-muted-foreground">
              {job.status === "failed" ? (
                <><AlertCircleIcon className="size-6 text-rose-500" /><span className="px-2 text-center text-[11px] text-rose-600">{job.error || "Failed"}</span></>
              ) : (
                <><Loader2Icon className="size-6 animate-spin" /><span className="text-[11px] capitalize">{job.status}</span></>
              )}
            </div>
          )}
          {badge && (
            <span className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white ${badge.cls}`}>
              {badge.text}
            </span>
          )}
        </div>

        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-xs font-medium">{job.shotLabel || job.suffix}</p>
            <code className="block truncate text-[10px] text-muted-foreground">
              {mockupFileStem(job.rNumber, job.suffix, job.attempt || 1)}
            </code>
            {job.modelLabel && (
              <p className="truncate text-[10px] text-muted-foreground">
                {job.modelLabel}{job.aspect ? ` \u00b7 ${job.aspect}` : ""}{typeof job.costInr === "number" ? ` \u00b7 \u20b9${job.costInr.toFixed(2)}` : ""}{typeof job.credits === "number" ? ` \u00b7 ${job.credits} cr` : ""}
              </p>
            )}
            {job.status === "rejected" && job.rejectedTo && (
              <p className="truncate text-[10px] text-muted-foreground">saved to {job.rejectedTo}</p>
            )}
            {job.status === "approved" && (
              <p className="truncate text-[10px] text-emerald-600">
                {job.linkedCount ? `linked to ${job.linkedCount} product${job.linkedCount > 1 ? "s" : ""}` : "media library only"}
              </p>
            )}
            {job.status === "review" && (job.skuCodes || []).length > 0 && (
              <p className="truncate text-[10px] text-muted-foreground">
                will link {(job.skuCodes || []).map((c) => `${job.rNumber}-${c}`).join(", ")}
              </p>
            )}
          </div>
          {preview && (
            <a href={preview} target="_blank" rel="noreferrer" className="shrink-0 text-muted-foreground hover:text-foreground">
              <ExternalLinkIcon className="size-3.5" />
            </a>
          )}
        </div>

        {inReview && (
          <div className="grid grid-cols-3 gap-1.5">
            <Button size="sm" disabled={busy} onClick={() => void onApprove(job)}
              className="h-8 bg-emerald-600 px-0 text-xs hover:bg-emerald-700">
              {busy ? <Loader2Icon className="size-3.5 animate-spin" /> : <><ThumbsUpIcon className="mr-1 size-3.5" />Approve</>}
            </Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => onRedo(job)} className="h-8 px-0 text-xs">
              <RefreshCwIcon className="mr-1 size-3.5" />Redo
            </Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => void onReject(job)}
              className="h-8 px-0 text-xs text-rose-600 hover:text-rose-700">
              <ThumbsDownIcon className="mr-1 size-3.5" />Reject
            </Button>
          </div>
        )}

        {job.status === "failed" && (
          <div className="grid gap-1.5">
            {job.taskId && (
              <Button size="sm" variant="outline" disabled={busy} className="h-8 w-full text-xs"
                onClick={() => void onRetryDownload(job)}>
                {busy ? <Loader2Icon className="mr-1 size-3.5 animate-spin" /> : <RefreshCwIcon className="mr-1 size-3.5" />}
                Retry download &mdash; free
              </Button>
            )}
            <Button size="sm" variant="ghost" className="h-8 w-full text-xs" onClick={() => onRedo(job)}>
              Generate again
            </Button>
          </div>
        )}
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
function useJobPoller(jobs: Job[], updateJob: (a: any) => Promise<any>) {
  const status = useAction(api.poyo.poyoStatus);
  const stageUpload = useAction(api.r2.uploadToR2);
  const inFlight = useRef<Set<string>>(new Set());

  const tick = useCallback(async () => {
    const pending = jobs.filter((j) => j.status === "running" && j.taskId && !inFlight.current.has(j._id));
    for (const job of pending) {
      inFlight.current.add(job._id);
      try {
        // withImage: the bytes ride back on the poll that first sees "finished".
        // Asking separately was a second request against the same task inside
        // PoYo's one-per-two-seconds window, and failed every time.
        const res: any = await status({ taskId: job.taskId, withImage: true });
        if (res.status === "failed" || res.error) {
          await updateJob({ mockupId: job._id, status: "failed", error: res.error || "Generation failed" });
        } else if (res.status === "finished" && res.base64) {
          const stem = mockupFileStem(job.rNumber, job.suffix, job.attempt || 1);
          const img = { base64: res.base64, contentType: res.contentType };
          // Staged, not published. Nothing reaches the media library until a
          // human has looked at it — an AI mockup that quietly went live with a
          // wrong pattern is the failure this whole tool guards against.
          const pendingKey = `ai-mockups-pending/${stem}.webp`;
          const staged: any = await stageUpload({
            fileBase64: img.base64,
            key: pendingKey,
            contentType: img.contentType,
          });
          const url = staged?.url || staged?.publicUrl;
          if (!url) throw new Error(staged?.error || "Could not stage the image");
          await updateJob({ mockupId: job._id, status: "review", pendingKey: staged?.key || pendingKey, pendingUrl: url });
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
  }, [jobs, status, stageUpload, updateJob]);

  useEffect(() => {
    if (!jobs.some((j) => j.status === "running")) return;
    const id = setInterval(() => { void tick(); }, POLL_MS);
    return () => clearInterval(id);
  }, [jobs, tick]);
}
