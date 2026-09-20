import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useSearchParams } from "react-router-dom";
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
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog.tsx";
import {
  SparklesIcon, UploadIcon, SearchIcon, ExternalLinkIcon, PlusIcon, TrashIcon,
  CheckCircle2Icon, AlertCircleIcon, Loader2Icon, ImageIcon, CopyIcon, WandSparklesIcon,
  ThumbsUpIcon, ThumbsDownIcon, RefreshCwIcon, FolderIcon,
  RotateCwIcon, RotateCcwIcon, FilePlus2Icon,
} from "lucide-react";
import {
  saveLocally, chooseBackupFolder, getBackupFolder, supportsDirectoryPicker,
} from "@/lib/local-backup.ts";
import {
  STARTER_SHOTS, DEFAULT_BLOCKS, PLACEHOLDERS, REFERENCE_PREAMBLE, expandPrompt, mockupFileStem, listingOf, presetFor, shotCodes, scopeFor,
  isPhase1, listingSlug, TEMPLATE_GADGETS, deviceNameOf, cleanDesignName, TRUE_SIZE_CLAUSE, deviceAnchor,
  type MockupShot, type SharedBlocks, type DesignSource, type CutOrientation,
} from "@/lib/ai-mockup-shots.ts";
import { rotateImageDataUrl } from "@/lib/image-processing.ts";
import { TemplatesTab, RollCalibration, useTemplateMockups, useTruePiece, templateRows, templateForShot } from "./templates.tsx";
import { RetireListings } from "./retire-listings.tsx";
import { LaunchPanel } from "@/pages/admin/launch/launch-panel.tsx";
import {
  IMAGE_MODELS, MODEL_BY_ID, DEFAULT_MODEL_ID, formatInr, formatCredits, resolveSize, USD_TO_INR,
} from "@/lib/ai-mockup-models.ts";

const SIZES = ["1:1", "2:3", "3:2", "3:4", "4:3", "9:16", "16:9", "21:9"];

/**
 * What a design is printed on, in the words the prompt expander tests for.
 *
 * `match` is how an already-recorded finish is mapped back onto one of these —
 * the catalogue holds "3D Textured", "Matte Finish" and a great many blanks.
 *
 * Tranzy is a cutout-only option: rolls are printed on opaque vinyl and never
 * come as clear film, so offering it against a roll could only ever be a
 * mis-click that turns the design's light areas transparent.
 */
const FINISHES = [
  // "Matte Membrane" is a Tranzy, not a matte, so the matte test excludes it.
  { value: "Matte", label: "Matte", match: /^matte(?!.*membrane)/i, cutoutOnly: false },
  { value: "3D Textured", label: "3D Textured / Embossed", match: /3d|textur|emboss/i, cutoutOnly: false },
  { value: "Tranzy (transparent)", label: "Tranzy — transparent film", match: /tranz|transparent|membrane/i, cutoutOnly: true },
];
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
  /** Listing kinds this one picture belongs to, when angles share it. */
  listings?: string[];
  taskId?: string;
  url?: string;
  r2Key?: string;
  /** Staged object, before a human has decided anything. */
  pendingKey?: string;
  pendingUrl?: string;
  rejectedTo?: string;
  skuCodes?: string[];
  variantTitles?: string[];
  matchSingleVariant?: boolean;
  linkedCount?: number;
  error?: string;
  attempt?: number;
  designSource?: DesignSource;
  modelLabel?: string;
  aspect?: string;
  credits?: number;
  costInr?: number;
  createdAt: number;
  designName?: string;
  listing?: string;
  /** Exactly what the model was sent, so a surprising picture can be explained. */
  promptSent?: string;
  /** "16×10" when the model was given the device's own piece at true size. */
  pieceCm?: string;
  referenceUrl?: string;
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

interface Design {
  _id: string;
  source: DesignSource;
  code: string;
  name: string;
  rawImageUrl?: string;
  finish?: string;
  /** Metres for a roll, pieces for a cutout. */
  stock?: number;
  stockLabel: string;
  /** A roll photo flattened to true centimetres (template mockups). */
  flatImageUrl?: string;
  flatPxPerCm?: number;
  flatWidthCm?: number;
  flatLengthCm?: number;
  /** Gadgets this design can be cut for; empty means any. */
  usableFor?: string[];
  themes?: string[];
}

/**
 * The Templates tab, roll calibration and the template button. Set to false
 * to hide them.
 */
const TEMPLATE_TOOLS = true;

/** The pictures of one product, within a gadget. */
type ListingGroup = {
  key: string;
  gadget: string;
  gadgetTypeId?: string;
  listing: string;
  shots: MockupShot[];
};

const listingKey = (shot: MockupShot) =>
  `${String(shot.gadget).toLowerCase()}|${listingOf(shot).toLowerCase()}`;

type VariantRow = { skuTail: string; title: string; price: string; materialMultiplier: string };

const toRows = (res: any): VariantRow[] =>
  (res?.variants || []).map((v: any) => ({
    skuTail: String(v.skuTail || ""),
    title: String(v.title || "Default Title"),
    price: String(v.price ?? ""),
    materialMultiplier: String(Number(v.materialMultiplier) || 1),
  }));

const rowsProblem = (rows: VariantRow[]) => {
  if (!rows.length) return "Add at least one variant";
  if (rows.some((r) => !(Number(r.price) > 0))) return "Every variant needs a price";
  if (rows.some((r) => !r.title.trim())) return "Every variant needs a name";
  const tails = rows.map((r) => r.skuTail.trim().toUpperCase());
  if (new Set(tails).size !== tails.length) return "Two variants have the same SKU ending";
  return null;
};

/** Whether new listings go live at once or wait for their first picture. */
function usePublishNow() {
  const [on, setOn] = useState<boolean>(() => {
    try { return localStorage.getItem("studio_publish_now") !== "0"; } catch { return true; }
  });
  const set = (v: boolean) => {
    setOn(v);
    try { localStorage.setItem("studio_publish_now", v ? "1" : "0"); } catch { /* storage blocked */ }
  };
  return [on, set] as const;
}

function PublishNowSwitch({ on, set }: { on: boolean; set: (v: boolean) => void }) {
  return (
    <label className="flex items-start gap-2 rounded-lg border p-2 text-sm">
      <Switch checked={on} onCheckedChange={set} className="mt-0.5" />
      <span>
        <span className="font-medium">Publish now</span>
        <span className="block text-xs text-muted-foreground">
          {on
            ? "The listing goes live immediately, without a picture; approved mockups are added to it later."
            : "The listing stays a draft and goes live when its first mockup is approved."}
        </span>
      </span>
    </label>
  );
}

const rowsPayload = (rows: VariantRow[]) =>
  rows.map((r) => ({
    skuTail: r.skuTail.trim().toUpperCase(),
    title: r.title.trim(),
    price: Number(r.price),
    materialMultiplier: Number(r.materialMultiplier) || 1,
  }));

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
  const [tab, setTab] = useState<"studio" | "shots" | "templates">("studio");
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
          {(TEMPLATE_TOOLS ? (["studio", "templates", "shots"] as const) : (["studio", "shots"] as const)).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-md px-4 py-1.5 text-sm font-medium capitalize transition ${
                tab === t ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "shots" ? "Gadgets & prompts" : t === "templates" ? "Templates" : t}
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
      ) : tab === "templates" ? (
        <TemplatesTabWrapper />
      ) : (
        <ShotLibrary />
      )}
    </div>
  );
}

function TemplatesTabWrapper() {
  const { shots, blocks, loading } = useShotLibrary();
  if (loading) return <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}</div>;
  return <TemplatesTab shots={shots} blocks={blocks} />;
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
  // Starter shots added to the code after this library was seeded — the
  // no-logo laptop lid, for one. Matched on gadget and file name, so a shot the
  // admin renamed is not offered twice.
  const missingStarters = STARTER_SHOTS.filter(
    (st) => !shots.some((s) => s.gadget === st.gadget && s.suffix === st.suffix)
  );
  // Built-in shots whose prompt has since been improved in the code (the
  // phone shots now skin the camera module). Saved shots are never changed
  // behind the admin's back; this offers the update.
  const staleStarters = shots
    .map((s) => ({ s, st: STARTER_SHOTS.find((st) => st.gadget === s.gadget && st.suffix === s.suffix) }))
    .filter((x): x is { s: MockupShot; st: (typeof STARTER_SHOTS)[number] } => !!x.st && x.s.prompt !== x.st.prompt);
  const [showStale, setShowStale] = useState(false);
  const availableGadgets = (gadgetTypes || [])
    .map((g) => String(g.name || "").trim())
    .filter(Boolean)
    .sort();

  /**
   * Other shots of the same gadget showing the same view — the part of the
   * label after the dash: every phone's "back", every charger's "port view".
   * One uploaded reference is meant for all of them.
   */
  const viewOf = (label: string) => (label.split(" — ")[1] || "").replace(/\s*\(copy\)$/, "").trim().toLowerCase();
  const viewSiblings = (shot: MockupShot) =>
    shots.filter((o) => o._id !== shot._id && o.gadget === shot.gadget && viewOf(o.label) === viewOf(shot.label));

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

      {staleStarters.length > 0 && (
        <div className="space-y-2 rounded-xl border border-sky-200 bg-sky-50 p-3 dark:border-sky-900 dark:bg-sky-950/30">
          <div className="flex flex-wrap items-center gap-3">
            <RefreshCwIcon className="size-4 text-sky-600" />
            <p className="min-w-0 flex-1 text-sm">
              {staleStarters.length} built-in shot{staleStarters.length === 1 ? " has" : "s have"} a newer prompt
              {" "}(phones: two-phone view with the camera module skinned; chargers: pins and port views, fully wrapped).
              <button className="ml-2 text-xs text-sky-700 underline" onClick={() => setShowStale(!showStale)}>
                {showStale ? "hide" : "which?"}
              </button>
            </p>
            <Button
              size="sm"
              disabled={seeding}
              onClick={async () => {
                if (!confirm(`Replace the prompt of ${staleStarters.length} shot(s) with the built-in one? Any edits you made to those prompts are lost.`)) return;
                setSeeding(true);
                try {
                  for (const { s, st } of staleStarters) await updateShot({ promptId: s._id, prompt: st.prompt, label: st.label });
                  toast.success(`${staleStarters.length} prompt${staleStarters.length === 1 ? "" : "s"} updated`);
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Could not update");
                } finally { setSeeding(false); }
              }}
            >
              {seeding ? <Loader2Icon className="mr-1.5 size-3.5 animate-spin" /> : <RefreshCwIcon className="mr-1.5 size-3.5" />}
              Update {staleStarters.length === 1 ? "it" : "them"}
            </Button>
          </div>
          {showStale && (
            <p className="text-xs text-muted-foreground">{staleStarters.map(({ s }) => `${s.gadget} · ${s.label}`).join(", ")}</p>
          )}
        </div>
      )}

      {shots.length > 0 && missingStarters.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-violet-200 bg-violet-50 p-3 dark:border-violet-900 dark:bg-violet-950/30">
          <SparklesIcon className="size-4 text-violet-600" />
          <p className="min-w-0 flex-1 text-sm">
            {missingStarters.length} new built-in shot{missingStarters.length === 1 ? "" : "s"}:{" "}
            <span className="text-muted-foreground">
              {missingStarters.map((m) => `${m.gadget} · ${m.label}`).join(", ")}
            </span>
          </p>
          <Button
            size="sm"
            disabled={seeding}
            onClick={async () => {
              setSeeding(true);
              try {
                for (const st of missingStarters) {
                  const gt = (gadgetTypes || []).find((g) => g.name === st.gadget);
                  await createShot({ ...st, gadgetTypeId: gt?._id || "", createdAt: Date.now() });
                }
                // The lid shot that was simply "Lid only" is the with-logo one;
                // say so now that a without-logo one sits beside it.
                const oldLid = shots.find((s) => s.gadget === "laptop" && s.suffix === "laptop-top" && s.label === "Lid only");
                if (oldLid) await updateShot({ promptId: oldLid._id, label: "Lid only — with Apple logo" });
                toast.success(`${missingStarters.length} shot${missingStarters.length === 1 ? "" : "s"} added`);
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Could not add");
              } finally { setSeeding(false); }
            }}
          >
            {seeding ? <Loader2Icon className="mr-1.5 size-3.5 animate-spin" /> : <PlusIcon className="mr-1.5 size-3.5" />}
            Add {missingStarters.length === 1 ? "it" : "them"}
          </Button>
        </div>
      )}

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
              Load the {STARTER_SHOTS.length} starter shots
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
              siblings={viewSiblings(shot)}
              onShareReference={async (url) => {
                const targets = viewSiblings(shot);
                for (const t of targets) await updateShot({ promptId: t._id, referenceUrl: url });
                toast.success(`Reference applied to ${targets.length} more shot${targets.length === 1 ? "" : "s"}`);
              }}
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

function ShotCard({ shot, onSave, onDelete, onDuplicate, siblings, onShareReference }: {
  shot: MockupShot;
  onSave: (patch: Partial<MockupShot>) => Promise<any>;
  onDelete: () => Promise<any>;
  onDuplicate: () => Promise<any>;
  siblings: MockupShot[];
  onShareReference: (url: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState<Partial<MockupShot> | null>(null);
  const [saving, setSaving] = useState(false);
  const [refBusy, setRefBusy] = useState(false);
  const uploadRef = useAction(api.r2.uploadToR2);
  const refInput = useRef<HTMLInputElement>(null);
  const v = { ...shot, ...(draft || {}) };

  const onReference = async (file: File) => {
    setRefBusy(true);
    try {
      const dataUrl = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(String(r.result));
        r.onerror = rej;
        r.readAsDataURL(file);
      });
      const up: any = await uploadRef({
        fileBase64: dataUrl,
        key: `shot-references/${shot.gadget}-${shot.suffix}-${Date.now()}.webp`,
        contentType: file.type || "image/png",
      });
      const url = up?.url || up?.publicUrl;
      if (!url) throw new Error("Upload failed");
      // Saved at once: a reference is not a draft edit worth losing.
      await onSave({ referenceUrl: url });
      toast.success("Angle reference saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setRefBusy(false);
      if (refInput.current) refInput.current.value = "";
    }
  };
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
            <span className="text-[11px] text-muted-foreground">listing</span>
            <Input
              value={v.listing ?? ""}
              onChange={(e) => edit({ listing: e.target.value })}
              className="h-8 w-[150px] text-xs"
              placeholder={listingOf({ ...v, listing: "" })}
              title="Shots with the same listing name are pictures of one product"
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

        <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/30 p-2">
          <div className="size-16 shrink-0 overflow-hidden rounded-md border bg-background">
            {shot.referenceUrl
              ? <img src={shot.referenceUrl} alt="Angle reference" className="size-full object-contain" />
              : <div className="flex size-full items-center justify-center"><ImageIcon className="size-5 text-muted-foreground/40" /></div>}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium">Angle reference</p>
            <p className="text-[11px] text-muted-foreground">
              A finished mockup to copy the angle, framing and skin coverage from. Sent to the model with the
              design; its colours and pattern are ignored.
            </p>
          </div>
          <input ref={refInput} type="file" accept="image/*" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void onReference(f); }} />
          <Button size="sm" variant="outline" className="h-7 text-xs" disabled={refBusy} onClick={() => refInput.current?.click()}>
            {refBusy ? <Loader2Icon className="mr-1 size-3 animate-spin" /> : <UploadIcon className="mr-1 size-3" />}
            {shot.referenceUrl ? "Replace" : "Upload"}
          </Button>
          {shot.referenceUrl && siblings.length > 0 && (
            <Button size="sm" className="h-7 text-xs" disabled={refBusy}
              title={siblings.map((x) => x.label).join(", ")}
              onClick={async () => {
                if (!confirm(`Use this reference for ${siblings.length} other ${shot.gadget} shot(s) with the same view?\n\n${siblings.map((x) => x.label).join("\n")}`)) return;
                setRefBusy(true);
                try { await onShareReference(shot.referenceUrl!); } finally { setRefBusy(false); }
              }}>
              Use for all {siblings.length + 1} “{(shot.label.split(" — ")[1] || "same view")}” shots
            </Button>
          )}
          {shot.referenceUrl && (
            <Button size="sm" variant="ghost" className="h-7 text-xs" disabled={refBusy}
              onClick={async () => { await onSave({ referenceUrl: "" }); toast.success("Reference removed"); }}>
              Remove
            </Button>
          )}
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
  const cutouts = useQuery(api.aiMockups.getCutouts) as any[] | undefined;
  const approvedCounts = useQuery(api.aiMockups.getApprovedCounts) as Record<string, number> | undefined;
  const { shots, blocks, loading } = useShotLibrary();
  const [search, setSearch] = useState("");
  const [source, setSource] = useState<DesignSource | "all">("all");

  const activeShots = shots.filter((s) => s.isActive !== false);

  const designs = useMemo<Design[]>(() => {
    const fromRolls: Design[] = (rolls || []).map((r) => ({
      _id: r._id, source: "roll", code: String(r.rNumber || "").trim(), name: r.designName || "",
      rawImageUrl: r.rawImageUrl, finish: r.finish, stock: r.metersAvailable,
      stockLabel: `${r.metersAvailable ?? 0} m`,
      flatImageUrl: r.flatImageUrl, flatPxPerCm: r.flatPxPerCm, flatWidthCm: r.flatWidthCm, flatLengthCm: r.flatLengthCm,
      themes: r.designThemes,
    }));
    const fromCutouts: Design[] = (cutouts || []).map((c) => ({
      _id: c._id, source: "cutout", code: String(c.cutoutNumber || "").trim(), name: c.designName || "",
      rawImageUrl: c.rawImageUrl, finish: c.finish, stock: Number(c.sheetsAvailable) || 0,
      stockLabel: `${Number(c.sheetsAvailable) || 0} ${c.kind === "precut" ? "piece" : "sheet"}${Number(c.sheetsAvailable) === 1 ? "" : "s"}`,
      usableFor: Array.isArray(c.usableFor) ? c.usableFor : undefined,
      themes: c.designThemes,
    }));
    const q = search.trim().toLowerCase();
    return [...fromRolls, ...fromCutouts]
      .filter((d) => d.code)
      .filter((d) => source === "all" || d.source === source)
      .filter((d) => !q || d.code.toLowerCase().includes(q) || d.name.toLowerCase().includes(q))
      .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
  }, [rolls, cutouts, search, source]);

  // "Open in studio" from the coverage table: /backend-skinly/ai-mockups?design=R-12
  const [params] = useSearchParams();
  const wanted = params.get("design");
  useEffect(() => {
    if (!wanted || !rolls || !cutouts) return;
    const norm = (s: string) => s.toUpperCase().replace(/-0+(\d)/g, "-$1");
    const hit = [...rolls.map((r) => ({ id: r._id, code: String(r.rNumber || "") })), ...cutouts.map((c) => ({ id: c._id, code: String(c.cutoutNumber || "") }))]
      .find((d) => norm(d.code) === norm(wanted));
    if (hit) setSelectedRollId(hit.id);
  }, [wanted, rolls, cutouts]);

  const selected = designs.find((d) => d._id === selectedRollId) || null;
  // This design's own mockups, asked for by design code. Reading a page of
  // recent ones and filtering it here lost a design's work to the next day's.
  const jobsForRoll = (useQuery(
    api.aiMockups.getJobs,
    selected ? { rNumber: selected.code } : "skip"
  ) as Job[] | undefined) || [];

  if (rolls === undefined || cutouts === undefined || loading) {
    return <div className="space-y-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <div className="space-y-3">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search code or design" className="pl-9" />
        </div>
        <div className="flex gap-1 rounded-lg border bg-muted/40 p-1 text-xs">
          {([["all", "All"], ["roll", "Rolls"], ["cutout", "Cutouts"]] as const).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setSource(k)}
              className={`flex-1 rounded-md px-2 py-1 font-medium transition ${
                source === k ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{designs.length} designs</p>
        <div className="max-h-[70vh] space-y-1.5 overflow-y-auto pr-1">
          {designs.map((d) => {
            const done = approvedCounts?.[d.code] || 0;
            return (
              <button
                key={d._id}
                onClick={() => setSelectedRollId(d._id)}
                className={`flex w-full items-center gap-2.5 rounded-lg border p-2 text-left transition ${
                  selectedRollId === d._id ? "border-violet-400 bg-violet-50 dark:bg-violet-950/40" : "hover:bg-muted/60"
                }`}
              >
                <div className="size-10 shrink-0 overflow-hidden rounded-md bg-muted">
                  {d.rawImageUrl ? <img src={d.rawImageUrl} alt="" className="size-full object-cover" />
                    : <div className="flex size-full items-center justify-center"><ImageIcon className="size-4 text-muted-foreground/40" /></div>}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-xs font-semibold">{d.code}</span>
                    {d.source === "cutout" && (
                      <span className="rounded bg-sky-100 px-1 text-[9px] font-semibold text-sky-700 dark:bg-sky-950 dark:text-sky-300">cut</span>
                    )}
                    {done > 0 && <Badge variant="outline" className="h-4 px-1 text-[10px]">{done}</Badge>}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{d.name || "Untitled"}</p>
                </div>
                {!d.rawImageUrl && <span className="shrink-0 text-[10px] text-amber-600">no photo</span>}
              </button>
            );
          })}
        </div>
      </div>

      {selected ? (
        <RollPanel
          key={selected._id}
          roll={selected}
          shots={selected.usableFor?.length ? activeShots.filter((s) => selected.usableFor!.includes(s.gadget)) : activeShots}
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
  roll: Design;
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
  const updateCutout = useMutation(api.aiMockups.updateCutoutInventory);
  const createJob = useMutation(api.aiMockups.createDesignMockup);
  const updateJob = useMutation(api.aiMockups.updateDesignMockup);
  const submit = useAction(api.poyo.poyoSubmit);
  const linkTargets = useQuery(api.aiMockups.getLinkTargets, { rNumber: roll.code }) as any[] | undefined;
  const getTemplate = useAction(api.listings.getListingTemplate);
  const createListing = useAction(api.listings.createListingForDesign);
  const copyObject = useAction(api.r2.copyR2Object);
  const getObject = useAction(api.r2.getR2Object);
  const deleteObject = useAction(api.r2.deleteR2Object);
  const addMediaItem = useMutation(api.mediaLibrary.createMediaItem);
  const linkToProducts = useMutation(api.aiMockups.linkMockupToProducts);
  const truePieceFor = useTruePiece();
  const tidyImages = useMutation(api.aiMockups.tidyListingImages);
  const [tidying, setTidying] = useState(false);
  const tidy = async () => {
    setTidying(true);
    try {
      const res: any = await tidyImages({ rNumber: roll.code });
      toast.success(res?.changed
        ? `Photos fixed on ${res.changed} listing${res.changed > 1 ? "s" : ""} · ${res.moved} moved to the right listing · ${res.removed} removed`
        : "Every listing already has the right photos");
      if (res?.hidden?.length) {
        toast.message(`Back in draft until a photo is approved: ${res.hidden.join(", ")}`, { duration: 10000 });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not fix the photos");
    } finally { setTidying(false); }
  };
  const model = MODEL_BY_ID[modelId] ?? MODEL_BY_ID[DEFAULT_MODEL_ID];
  // One ratio for the whole run, and it wins: a shot no longer carries its own.
  // The model still gets the last word, because a ratio it does not accept is a
  // 400 rather than a preference.
  const effectiveSize = resolveSize(model, aspect);

  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  // The photo is held here, unsent, until the admin has turned it the right way
  // up. Which way up the design sits is the one thing the model copies
  // literally, so guessing costs a whole run.
  const [staged, setStaged] = useState<{ dataUrl: string; turns: number } | null>(null);
  // Phones are cut out of the roll either along the web or across it, and the
  // two give completely different skins from one design.
  const [cutOrientation, setCutOrientation] = useState<CutOrientation | "both">("lengthwise");
  const [starting, setStarting] = useState(false);
  const [busyJob, setBusyJob] = useState<string | null>(null);
  const [redoJob, setRedoJob] = useState<Job | null>(null);
  // A listing made in this session will not show up in linkTargets until that
  // query re-runs, so remember it here and let the row say so straight away.
  const [newListing, setNewListing] = useState<ListingGroup | null>(null);
  const [bulkListings, setBulkListings] = useState(false);
  const [justCreated, setJustCreated] = useState<Record<string, string>>({});
  const [backupFolder, setBackupFolder] = useState<string | null>(null);
  // Phase 1: only the high-search listings are created and templated.
  const [phaseOnly, setPhaseOnlyState] = useState<boolean>(() => {
    try { return localStorage.getItem("studio_phase1") !== "0"; } catch { return true; }
  });
  const setPhaseOnly = (v: boolean) => {
    setPhaseOnlyState(v);
    try { localStorage.setItem("studio_phase1", v ? "1" : "0"); } catch { /* storage blocked */ }
  };
  const [calibrating, setCalibrating] = useState(false);
  const [retiring, setRetiring] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [approvingAll, setApprovingAll] = useState<{ done: number; total: number } | null>(null);
  const [rejectingAll, setRejectingAll] = useState<{ done: number; total: number } | null>(null);
  const [tplProgress, setTplProgress] = useState<{ done: number; total: number } | null>(null);
  const templateMockups = useTemplateMockups();
  const updatePrompt = useMutation(api.aiMockups.updateMockupPrompt);
  // Shots whose saved prompt is older than the built-in one of the same name.
  const staleShots = useMemo(() => shots.filter((s) => {
    const st = STARTER_SHOTS.find((x) => x.gadget === s.gadget && x.suffix === s.suffix);
    return !!st && st.prompt !== s.prompt;
  }), [shots]);
  const staleIds = useMemo(() => new Set(staleShots.map((s) => s._id)), [staleShots]);
  const [updatingPrompts, setUpdatingPrompts] = useState(false);
  const updateStale = async () => {
    setUpdatingPrompts(true);
    try {
      for (const s of staleShots) {
        const st = STARTER_SHOTS.find((x) => x.gadget === s.gadget && x.suffix === s.suffix)!;
        await updatePrompt({ promptId: s._id, prompt: st.prompt, label: st.label });
      }
      toast.success(`${staleShots.length} prompt${staleShots.length === 1 ? "" : "s"} updated`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update");
    } finally { setUpdatingPrompts(false); }
  };

  useEffect(() => {
    void getBackupFolder().then((h: any) => setBackupFolder(h?.name ?? null));
  }, []);

  useJobPoller(jobs, updateJob);

  const grouped = groupByGadget(shots);

  /** Products a shot's image would attach to for this design, right now. */
  const targetsFor = useCallback((shot: MockupShot) => {
    const fresh = justCreated[listingKey(shot)];
    if (fresh) return [fresh];
    if (!linkTargets) return null;
    const codes = shotCodes(shot);
    // "Default" says nothing about which view a variant is, and appears on
    // every gadget, so it is never allowed to match.
    const titles = (shot.variantTitles || [])
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t && t !== "default" && t !== "default title");
    // Grouped by product, because the single-variant rule is about the product
    // and not the row: the linker will claim a one-variant product whose SKU
    // carries no view code, and the preview has to say the same thing or the
    // admin is told there is nowhere to put an image that in fact has one.
    const gadget = String(shot.gadget).toLowerCase();
    // A brand listing (a preset) exists only once one was made for that brand:
    // the old one-size listings of the gadget do not stand in for it, or no
    // design could ever get its brand listings.
    const kind = presetFor(listingOf(shot)) ? listingOf(shot).toLowerCase() : null;
    const byProduct = new Map<string, { title: string; rows: any[] }>();
    for (const t of linkTargets) {
      if (t.gadget !== gadget) continue;
      if (kind && String(t.listingKind || "").toLowerCase() !== kind) continue;
      const entry = byProduct.get(t.productId) || { title: t.productTitle, rows: [] };
      entry.rows.push(t);
      byProduct.set(t.productId, entry);
    }

    const seen = new Map<string, string>();
    for (const [productId, { title, rows }] of byProduct) {
      const hit = rows.some((t) =>
        codes.includes(t.code) ||
        codes.includes(t.codeHead) ||
        titles.includes(String(t.variantTitle || "").toLowerCase())
      );
      if (hit || (shot.matchSingleVariant && rows.length === 1)) seen.set(productId, title);
    }
    return [...seen.values()];
  }, [linkTargets, justCreated]);

  const saveFinish = async (finish: string) => {
    try {
      const save = roll.source === "cutout" ? updateCutout : updateRoll;
      await save({ id: roll._id, finish });
      toast.success(`${roll.code}: ${finish}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save the finish");
    }
  };

  const onPickRaw = async (file: File) => {
    const base64 = await new Promise<string>((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result));
      r.onerror = rej;
      r.readAsDataURL(file);
    });
    setStaged({ dataUrl: base64, turns: 0 });
    if (fileRef.current) fileRef.current.value = "";
  };

  const onUploadRaw = async () => {
    if (!staged) return;
    setUploading(true);
    try {
      const base64 = staged.turns
        ? await rotateImageDataUrl(staged.dataUrl, staged.turns * 90)
        : staged.dataUrl;
      const stem = roll.code.toUpperCase().replace(/[^A-Z0-9-]/g, "");
      // A key named only after the roll code overwrote the same R2 object on
      // every replacement — same key, same public URL — so the browser and
      // R2's own edge cache kept serving the old bytes at that URL forever,
      // even though the write to Firestore had gone through. A fresh key per
      // upload makes a replacement a genuinely new object with its own URL.
      const result: any = await uploadToLibrary({
        fileBase64: base64,
        key: `design-raw/${stem}-${Date.now()}.webp`,
        filename: `${stem}.webp`,
        folder: "design-raw",
        contentType: staged.turns ? "image/webp" : (/data:([^;,]+)/.exec(base64)?.[1] || "image/jpeg"),
        tags: ["raw-design", stem],
      });
      const url = result?.url || result?.publicUrl;
      if (!url) throw new Error(result?.error || "Upload failed");
      const save = roll.source === "cutout" ? updateCutout : updateRoll;
      // A calibration belongs to the photo it was marked on.
      await save({ id: roll._id, rawImageUrl: url, ...(roll.source === "roll" && roll.flatImageUrl ? { flatImageUrl: "" } : {}) });
      setStaged(null);
      toast.success(roll.source === "roll" && roll.flatImageUrl ? "Raw design saved — calibrate it again" : "Raw design saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const runShot = async (
    shot: MockupShot,
    useModel: typeof model,
    useSize: string,
    orientation?: CutOrientation
  ) => {
    // Two cuts of one design are two different pictures, so they need two
    // filenames; without the tail the second would overwrite the first.
    const suffix = orientation ? `${shot.suffix}-${orientation === "widthwise" ? "wid" : "len"}` : shot.suffix;
    // Numbered by file name, not by shot: two shots that share a suffix used to
    // both be attempt 1, write the same file, and the second approval then
    // failed because the first had already moved it away.
    const attempt = jobs.filter((j) => j.suffix === suffix).reduce((n, j) => Math.max(n, j.attempt || 1), 0) + 1;
    const label = orientation ? `${shot.label} · ${orientation === "widthwise" ? "across" : "along"} the roll` : shot.label;
    let jobId: string | null = null;
    // A calibrated roll hands the model the device's own piece at true size,
    // the way the launch pipeline does, so the motifs come out life-size. The
    // piece is already turned, so the prompt must not turn it again.
    let piece: { url: string; widthCm: number; heightCm: number } | null = null;
    try {
      piece = await truePieceFor(roll, shot.gadget, orientation === "widthwise");
    } catch {
      piece = null; // Fall back to the whole roll photo rather than not shooting.
    }
    const designUrl = piece?.url || roll.rawImageUrl;
    const promptSent = deviceAnchor(shot.gadget, listingOf(shot))
      + (shot.referenceUrl ? REFERENCE_PREAMBLE : "")
      + (piece ? TRUE_SIZE_CLAUSE(piece.widthCm, piece.heightCm) : "")
      + expandPrompt(shot.prompt, blocks, {
        rNumber: roll.code,
        designName: roll.name,
        source: roll.source,
        finish: roll.finish,
        cutOrientation: piece ? undefined : orientation,
      });
    try {
      jobId = (await createJob({
        promptSent,
        referenceUrl: shot.referenceUrl || "",
        rNumber: roll.code,
        designName: roll.name || "",
        designSource: roll.source,
        shotId: shot._id,
        shotLabel: label,
        gadget: shot.gadget,
        listing: listingOf(shot),
        suffix,
        skuCodes: shotCodes(shot),
        variantTitles: shot.variantTitles || [],
        matchSingleVariant: shot.matchSingleVariant || false,
        sourceUrl: designUrl,
        pieceCm: piece ? `${piece.widthCm}×${piece.heightCm}` : "",
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
        prompt: promptSent,
        imageUrls: shot.referenceUrl ? [designUrl, shot.referenceUrl] : [designUrl],
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

  /** How many images a pick actually costs, once cut orientations are counted. */
  const orientationsFor = useCallback(
    (shot: MockupShot): Array<CutOrientation | undefined> => {
      if (!shot.askCutOrientation || roll.source !== "roll") return [undefined];
      return cutOrientation === "both" ? ["lengthwise", "widthwise"] : [cutOrientation];
    },
    [cutOrientation, roll.source]
  );

  const activeShotIds = useMemo(() => shots.map((s) => s._id), [shots]);
  const allPicked = activeShotIds.length > 0 && activeShotIds.every((id) => picked.includes(id));

  /**
   * The shots grouped the way products are: by gadget, then by listing.
   *
   * A listing can want several pictures (a laptop's lid, keyboard deck and
   * carried shot all land on one product), and one gadget can be several
   * listings (PS5, Series X and Series S are all "console"). Creating a listing
   * is offered once per listing, never once per picture.
   */
  const listingGroups = useMemo(() => {
    const byKey = new Map<string, ListingGroup>();
    for (const shot of shots) {
      const key = listingKey(shot);
      const g = byKey.get(key) || {
        key,
        gadget: shot.gadget,
        gadgetTypeId: shot.gadgetTypeId,
        listing: listingOf(shot),
        shots: [],
      };
      if (!g.gadgetTypeId && shot.gadgetTypeId) g.gadgetTypeId = shot.gadgetTypeId;
      g.shots.push(shot);
      byKey.set(key, g);
    }
    return [...byKey.values()];
  }, [shots]);

  /** Products this listing's pictures would land on; null while checking. */
  const targetsForGroup = useCallback((group: ListingGroup) => {
    const fresh = justCreated[group.key];
    if (fresh) return [fresh];
    const seen = new Set<string>();
    for (const shot of group.shots) {
      const t = targetsFor(shot);
      if (t === null) return null;
      t.forEach((x) => seen.add(x));
    }
    return [...seen];
  }, [targetsFor, justCreated]);

  /** Listings this design has pictures for but no product to hang them on. */
  const missingListings = useMemo(() => {
    if (!linkTargets) return [] as ListingGroup[];
    return listingGroups.filter((g) => {
      if (phaseOnly && !isPhase1(g.listing)) return false;
      const t = targetsForGroup(g);
      return t !== null && t.length === 0;
    });
  }, [listingGroups, linkTargets, targetsForGroup, phaseOnly]);

  // Listings on this design made before the studio, which carry no kind.
  // Launch converts these into their brand listing; creating the missing ones
  // by hand would leave a second listing beside each of them.
  const legacyListings = useMemo(() => {
    if (!linkTargets) return 0;
    const ids = new Set(linkTargets.filter((t) => !String(t.listingKind || "").trim()).map((t) => t.productId));
    return ids.size;
  }, [linkTargets]);

  /**
   * The angles a template can make for this design right now — one row per
   * shot, not per listing, so a laptop's lid and its keyboard deck each get
   * their own picture and an angle with no template is simply left out.
   */
  const templatedRows = useMemo(
    () => templateRows(shots, phaseOnly).filter((r) =>
      templateForShot(templateMockups, r.listing, r.shot.suffix, r.isFirstShot)?.status === "ready"),
    [shots, phaseOnly, templateMockups]
  );

  const makeTemplateMockups = async () => {
    if (!templatedRows.length) return toast.error("No angle has a ready template yet — set them up in the Templates tab");
    if (roll.source === "roll" && !roll.flatImageUrl) return toast.error("Calibrate this roll first");
    setTplProgress({ done: 0, total: templatedRows.length });
    try {
      const n = await templateMockups.run(
        roll,
        templatedRows,
        cutOrientation === "both" ? ["lengthwise", "widthwise"] : [cutOrientation],
        jobs,
        (done, total) => setTplProgress({ done, total })
      );
      toast.success(`${n} template mockup${n === 1 ? "" : "s"} ready for review · ₹0`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not make the mockups");
    } finally {
      setTplProgress(null);
    }
  };

  // The listing template is read by a Cloud Function that walks the gadget's
  // catalogue, which took seven or eight seconds after "Create listing" was
  // pressed. It is fetched as soon as a listing is known to be missing, so the
  // dialog usually opens already filled in.
  const templateCache = useRef(new Map<string, Promise<any>>());
  const loadTemplate = useCallback((group: ListingGroup) => {
    const cacheKey = `${group.key}|${roll.finish || ""}`;
    let pending = templateCache.current.get(cacheKey);
    // Consoles and controllers have a decided shape; no need to ask the catalogue.
    const preset = presetFor(group.listing);
    if (!pending && preset) {
      pending = Promise.resolve({
        precedent: true,
        preset: true,
        variants: preset.map((v) => ({
          skuTail: v.tail,
          title: v.title,
          price: v.price3d && /3d|emboss|textur/i.test(roll.finish || "") ? v.price3d : v.price,
          materialMultiplier: v.materialMultiplier,
        })),
      });
      templateCache.current.set(cacheKey, pending);
    }
    if (!pending) {
      pending = getTemplate({
        gadgetTypeId: group.gadgetTypeId || "",
        gadget: group.gadget,
        listing: group.listing,
        finish: roll.finish || "",
        skuCodes: [...new Set(group.shots.flatMap((s) => shotCodes(s)))],
        variantTitles: [...new Set(group.shots.flatMap((s) => s.variantTitles || []))],
      }).catch((e: unknown) => {
        templateCache.current.delete(cacheKey);
        throw e;
      });
      templateCache.current.set(cacheKey, pending);
    }
    return pending;
  }, [getTemplate, roll.finish]);

  useEffect(() => {
    missingListings.forEach((g) => { void loadTemplate(g).catch(() => {}); });
  }, [missingListings, loadTemplate]);

  const pickedShots = useMemo(
    () => picked.map((id) => shots.find((s) => s._id === id)).filter((s): s is MockupShot => !!s),
    [picked, shots]
  );
  const imageCount = pickedShots.reduce((n, s) => n + orientationsFor(s).length, 0);
  const asksOrientation = pickedShots.some((s) => s.askCutOrientation) && roll.source === "roll";

  const generate = async () => {
    if (!roll.rawImageUrl) return toast.error("Upload the raw design photo first");
    if (!picked.length) return toast.error("Pick at least one shot");
    setStarting(true);
    let started = 0;
    for (const shot of pickedShots) {
      for (const orientation of orientationsFor(shot)) {
        if (await runShot(shot, model, effectiveSize, orientation)) started++;
      }
    }
    setStarting(false);
    if (started) toast.success(`${started} image${started > 1 ? "s" : ""} generating…`);
  };

  const approve = async (job: Job) => {
    if (!job.pendingKey) return;
    setBusyJob(job._id);
    try {
      // A file name that says what the picture is — design, device, "skin" —
      // is a small search signal of its own; the design code keeps it unique.
      const device = deviceNameOf(job.listing || "", job.gadget || "");
      const design = cleanDesignName(job.designName || "");
      const stem = job.listing && design
        ? [
            listingSlug(design),
            listingSlug(device),
            "skin",
            listingSlug(job.rNumber),
            listingSlug(job.suffix).slice(0, 40),
            (job.attempt || 1) > 1 ? `v${job.attempt}` : "",
          ].filter(Boolean).join("-")
        : mockupFileStem(job.rNumber, job.suffix, job.attempt || 1);
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
          variantTitles: job.variantTitles,
          matchSingleVariant: job.matchSingleVariant,
          gadget: job.gadget,
          listing: job.listing || "",
          // Several listings when angles share a picture; one otherwise.
          listings: (job as any).listings || undefined,
          url,
          alt: job.listing && design
            ? `${design} ${device} skin`
            : job.designName || job.shotLabel || "",
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

  const reject = async (job: Job, quiet = false) => {
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
      if (!quiet) toast.success(saved.where === "folder" ? `Saved to ${backupFolder}` : "Saved to Downloads");
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
      const wasWidth = /-wid$/.test(job.suffix);
      const wasLength = /-len$/.test(job.suffix);
      const ok = await runShot(
        shot, m, resolveSize(m, useAspect),
        wasWidth ? "widthwise" : wasLength ? "lengthwise" : undefined
      );
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
      {bulkListings && (
        <BulkListingsDialog
          groups={missingListings}
          design={roll}
          loadTemplate={loadTemplate}
          createListing={createListing}
          onClose={() => setBulkListings(false)}
          onCreated={(key, title) => setJustCreated((p) => ({ ...p, [key]: title }))}
        />
      )}
      {newListing && (
        <CreateListingDialog
          group={newListing}
          design={roll}
          loadTemplate={loadTemplate}
          createListing={createListing}
          onClose={() => setNewListing(null)}
          onCreated={(key, title) => setJustCreated((p) => ({ ...p, [key]: title }))}
        />
      )}
      <Card>
        <CardContent className="flex flex-col gap-4 p-4 sm:flex-row">
          <div className="size-40 shrink-0 overflow-hidden rounded-xl border bg-muted">
            {roll.rawImageUrl ? <img src={roll.rawImageUrl} alt="Raw design" className="size-full object-cover" />
              : <div className="flex size-full flex-col items-center justify-center gap-1 text-muted-foreground/50">
                  <ImageIcon className="size-7" /><span className="text-[11px]">No raw photo</span>
                </div>}
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-lg font-bold">{roll.code}</span>
              <Badge variant="outline">{roll.stockLabel}</Badge>
              {roll.source === "cutout" && <Badge className="bg-sky-600">cutout</Badge>}
              {/*
                The finish is not decoration. On a cutout, Tranzy means the white
                in the reference photo is backing paper that gets peeled off —
                told nothing, the model paints it onto the laptop and the result
                is a white sticker instead of a silhouette on bare metal. On
                either source, 3D Textured adds the relief. Almost nothing has a
                finish recorded, so it is set here, where the run is about to
                happen.
              */}
              <Select
                value={FINISHES.find((f) => f.match.test(roll.finish || ""))?.value || ""}
                onValueChange={(v) => void saveFinish(v)}
              >
                <SelectTrigger className="h-7 w-[190px] text-xs">
                  <SelectValue placeholder="Finish — not set" />
                </SelectTrigger>
                <SelectContent>
                  {FINISHES.filter((f) => !f.cutoutOnly || roll.source === "cutout").map((f) => (
                    <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-muted-foreground">{roll.name || "Untitled design"}</p>
            <p className="text-xs text-muted-foreground">
              This photo is sent to the model as the reference. Shoot it flat, straight down, in soft daylight
              with no flash &mdash; glare is what the model copies worst.
              {roll.source === "cutout" && " Get the whole sheet in frame: a cutout is one fixed artwork and the model is told to place it whole, so anything cropped out here is lost."}
            </p>
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void onPickRaw(f); }} />
            {staged ? (
              <div className="space-y-2 rounded-xl border bg-muted/30 p-3">
                <div className="flex items-start gap-3">
                  <div className="size-28 shrink-0 overflow-hidden rounded-lg border bg-background">
                    <img
                      src={staged.dataUrl}
                      alt="New raw design"
                      className="size-full object-contain transition-transform"
                      style={{ transform: `rotate(${staged.turns * 90}deg)` }}
                    />
                  </div>
                  <div className="min-w-0 flex-1 space-y-2">
                    <p className="text-xs text-muted-foreground">
                      Turn it until the design is the right way up. The model copies this
                      orientation exactly.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => setStaged({ ...staged, turns: staged.turns - 1 })}>
                        <RotateCcwIcon className="mr-1.5 size-3.5" />
                        Left
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setStaged({ ...staged, turns: staged.turns + 1 })}>
                        <RotateCwIcon className="mr-1.5 size-3.5" />
                        Right
                      </Button>
                      <Button size="sm" disabled={uploading} onClick={() => void onUploadRaw()}>
                        {uploading ? <Loader2Icon className="mr-1.5 size-3.5 animate-spin" /> : <UploadIcon className="mr-1.5 size-3.5" />}
                        Save this photo
                      </Button>
                      <Button size="sm" variant="ghost" disabled={uploading} onClick={() => setStaged(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" disabled={uploading} onClick={() => fileRef.current?.click()}>
                  <UploadIcon className="mr-1.5 size-3.5" />
                  {roll.rawImageUrl ? "Replace raw photo" : "Upload raw photo"}
                </Button>
                {TEMPLATE_TOOLS && roll.source === "roll" && roll.rawImageUrl && (
                  <Button size="sm" variant={roll.flatImageUrl ? "ghost" : "default"} onClick={() => setCalibrating(true)}>
                    {roll.flatImageUrl ? "Re-calibrate" : "Calibrate for template mockups"}
                  </Button>
                )}
                {TEMPLATE_TOOLS && roll.source === "roll" && (
                  <span className={`text-[11px] ${roll.flatImageUrl ? "text-emerald-600" : "text-muted-foreground"}`}>
                    {roll.flatImageUrl ? `calibrated · ${roll.flatWidthCm} × ${roll.flatLengthCm} cm` : "not calibrated"}
                  </span>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label>Which images should we make?</Label>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant={allPicked ? "secondary" : "default"}
                className="h-7 text-xs"
                onClick={() => setPicked(allPicked ? [] : activeShotIds)}
              >
                <CheckCircle2Icon className="mr-1 size-3" />
                {allPicked ? "Clear all" : `Select all ${activeShotIds.length} shots`}
              </Button>
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground" title="Only the high-search listings are created and templated">
                <Switch checked={phaseOnly} onCheckedChange={setPhaseOnly} />
                Phase 1
              </label>
              {TEMPLATE_TOOLS && <Button
                size="sm"
                variant="outline"
                className="h-7 border-emerald-400 text-xs text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300"
                disabled={!!tplProgress || !templatedRows.length}
                title={templatedRows.length ? "" : "Set up templates in the Templates tab first"}
                onClick={() => void makeTemplateMockups()}
              >
                {tplProgress ? <Loader2Icon className="mr-1 size-3 animate-spin" /> : <ImageIcon className="mr-1 size-3" />}
                {tplProgress
                  ? `Making ${tplProgress.done}/${tplProgress.total}…`
                  : `Template mockups (${templatedRows.length}) · ₹0`}
              </Button>}
              {missingListings.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 border-amber-400 text-xs text-amber-700 hover:bg-amber-50 dark:text-amber-300"
                  onClick={() => setBulkListings(true)}
                >
                  <FilePlus2Icon className="mr-1 size-3" />
                  Create {missingListings.length} missing listing{missingListings.length === 1 ? "" : "s"}
                </Button>
              )}
              {missingListings.length > 0 && legacyListings > 0 && (
                <span className="text-[11px] text-amber-700 dark:text-amber-400">
                  {legacyListings} old listing{legacyListings === 1 ? "" : "s"} here — Launch converts {legacyListings === 1 ? "it" : "them"} instead of adding duplicates
                </span>
              )}
              <Button size="sm" className="h-7 bg-violet-600 text-xs hover:bg-violet-700" onClick={() => setLaunching(true)}>
                <SparklesIcon className="mr-1 size-3" />
                Launch (auto)
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setRetiring(true)}>
                Retire old listings
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs" disabled={tidying} onClick={tidy}>
                {tidying && <Loader2Icon className="mr-1 size-3 animate-spin" />}
                Fix listing photos
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onManageShots}>
                Manage gadgets &amp; prompts
              </Button>
            </div>
          </div>

          {staleShots.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-sm dark:border-amber-900 dark:bg-amber-950/30">
              <AlertCircleIcon className="size-4 shrink-0 text-amber-600" />
              <span className="min-w-0 flex-1">
                {staleShots.length} shot{staleShots.length === 1 ? " still uses its" : "s still use their"} old prompt —
                the old pose and the bare camera module. Generate after updating.
              </span>
              <Button size="sm" disabled={updatingPrompts} onClick={() => void updateStale()}>
                {updatingPrompts ? <Loader2Icon className="mr-1.5 size-3.5 animate-spin" /> : <RefreshCwIcon className="mr-1.5 size-3.5" />}
                Update prompts
              </Button>
            </div>
          )}

          {shots.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              No shots defined yet.{" "}
              <button className="font-medium text-violet-600 underline" onClick={onManageShots}>
                Add a gadget and its prompts
              </button>{" "}
              to start.
            </div>
          ) : (
            grouped.map(([gadget]) => {
              const groups = listingGroups.filter((g) => g.gadget === gadget);
              return (
                <div key={gadget} className="space-y-2 rounded-xl border p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold capitalize">{gadget}</span>
                    <span className="text-[11px] text-muted-foreground">
                      {groups.length} listing{groups.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  {groups.map((group) => {
                    const ids = group.shots.map((r) => r._id);
                    const allOn = ids.every((id) => picked.includes(id));
                    return (
                      <div key={group.key} className="space-y-1.5 rounded-lg bg-muted/30 p-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            {group.listing}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {group.shots.length} image{group.shots.length === 1 ? "" : "s"}
                          </span>
                          <button
                            className="text-[11px] text-violet-600 hover:underline"
                            onClick={() => setPicked(allOn ? picked.filter((p) => !ids.includes(p)) : [...new Set([...picked, ...ids])])}
                          >
                            {allOn ? "clear" : "select all"}
                          </button>
                          <span className="ml-auto min-w-0">
                            <LinkTargets titles={targetsForGroup(group)} onCreate={() => setNewListing(group)} />
                          </span>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {group.shots.map((s) => {
                            const on = picked.includes(s._id);
                            return (
                              <button
                                key={s._id}
                                onClick={() => setPicked(on ? picked.filter((k) => k !== s._id) : [...picked, s._id])}
                                className={`flex items-center gap-2.5 rounded-lg border bg-background p-2.5 text-left text-sm transition ${
                                  on ? "border-violet-400 bg-violet-50 dark:bg-violet-950/40" : "hover:bg-muted/60"
                                }`}
                              >
                                <span className={`flex size-4 shrink-0 items-center justify-center rounded border ${on ? "border-violet-600 bg-violet-600 text-white" : "border-muted-foreground/40"}`}>
                                  {on && <CheckCircle2Icon className="size-3" />}
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="flex items-center gap-1">
                                    <span className="truncate font-medium">{s.label}</span>
                                    {staleIds.has(s._id) && <span className="shrink-0 rounded bg-amber-500 px-1 text-[9px] font-semibold text-white">old prompt</span>}
                                    {s.referenceUrl && <span className="shrink-0 rounded bg-sky-600 px-1 text-[9px] font-semibold text-white">ref</span>}
                                  </span>
                                  <code className="block truncate text-[10px] text-muted-foreground">
                                    {mockupFileStem(roll.code, s.suffix)}.webp
                                  </code>
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })
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
                {formatInr(model.usd)} &times; {imageCount} ={" "}
                <strong className="text-foreground">{formatInr(model.usd * imageCount)}</strong>
                <span className="ml-1 opacity-70">({formatCredits(model.credits * imageCount)})</span>
              </span>
            </div>
            {asksOrientation && (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-background p-2">
                <Label className="text-xs">Phone cut</Label>
                <Select value={cutOrientation} onValueChange={(v) => setCutOrientation(v as CutOrientation | "both")}>
                  <SelectTrigger className="h-9 w-[260px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lengthwise">Lengthwise — design stands upright</SelectItem>
                    <SelectItem value="widthwise">Widthwise — design reads sideways</SelectItem>
                    <SelectItem value="both">Both — one image of each</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-[11px] text-muted-foreground">
                  A phone skin is cut out of the 29.5 cm roll either along the web or across it, and
                  the two look nothing alike. Picking <em>Both</em> doubles the phone shots.
                </span>
              </div>
            )}
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
              Generate {imageCount} image{imageCount === 1 ? "" : "s"} &middot; {formatInr(model.usd * imageCount)}
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
            {reviewCount > 1 && (
              <Button
                size="sm"
                className="h-7 bg-emerald-600 text-xs hover:bg-emerald-700"
                disabled={!!approvingAll || !!rejectingAll}
                onClick={async () => {
                  const pending = jobs.filter((j) => j.status === "review" && j.pendingKey);
                  if (!confirm(`Approve all ${pending.length} pictures? Each is added to the media library and its listings. Reject the bad ones first.`)) return;
                  setApprovingAll({ done: 0, total: pending.length });
                  for (let i = 0; i < pending.length; i++) {
                    await approve(pending[i]);
                    setApprovingAll({ done: i + 1, total: pending.length });
                  }
                  setApprovingAll(null);
                  void tidy();
                }}
              >
                {approvingAll ? <Loader2Icon className="mr-1 size-3 animate-spin" /> : <ThumbsUpIcon className="mr-1 size-3" />}
                {approvingAll ? `Approving ${approvingAll.done}/${approvingAll.total}` : `Approve all ${reviewCount}`}
              </Button>
            )}
            {reviewCount > 1 && (
              /* A whole run can be wrong at once — a template that turned out
                 not to suit the shape, a prompt since fixed. Each still goes
                 to the reject folder on the way out, exactly as one does. */
              <Button
                size="sm"
                variant="outline"
                className="h-7 border-rose-200 text-xs text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:border-rose-900 dark:hover:bg-rose-950/40"
                disabled={!!approvingAll || !!rejectingAll}
                onClick={async () => {
                  const pending = jobs.filter((j) => j.status === "review" && j.pendingKey);
                  const where = backupFolder ? backupFolder : "Downloads";
                  if (!confirm(`Reject all ${pending.length} pictures? Each is saved to ${where} first, and none is added to a listing.`)) return;
                  setRejectingAll({ done: 0, total: pending.length });
                  for (let i = 0; i < pending.length; i++) {
                    await reject(pending[i], true);
                    setRejectingAll({ done: i + 1, total: pending.length });
                  }
                  setRejectingAll(null);
                  toast.success(`${pending.length} rejected · saved to ${where}`);
                }}
              >
                {rejectingAll ? <Loader2Icon className="mr-1 size-3 animate-spin" /> : <ThumbsDownIcon className="mr-1 size-3" />}
                {rejectingAll ? `Rejecting ${rejectingAll.done}/${rejectingAll.total}` : `Reject all ${reviewCount}`}
              </Button>
            )}
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

      {retiring && <RetireListings design={roll} onClose={() => setRetiring(false)} />}

      {launching && (
        <Dialog open onOpenChange={(o) => { if (!o) setLaunching(false); }}>
          {/* grid-cols-[minmax(0,1fr)]: a dialog is a CSS grid, and a grid
              item's automatic minimum is its min-content width, so one wide
              row inside stretched the column past the dialog and everything —
              the description, the progress card's right border — was cut off
              against it. */}
          <DialogContent className="max-h-[90vh] grid-cols-[minmax(0,1fr)] overflow-y-auto overflow-x-hidden sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Launch {roll.code}</DialogTitle>
              <DialogDescription>
                Creates the missing listings, brings existing ones into shape, retires duplicates, recounts stock and
                makes the pictures — on the server. Pictures come back here for approval.
              </DialogDescription>
            </DialogHeader>
            {!roll.name || !roll.finish ? (
              <p className="text-sm text-amber-700">Give this design a name and a finish first (Quick Launch, or the design's record).</p>
            ) : (
              <LaunchPanel
                design={{
                  _id: roll._id, code: roll.code, name: roll.name, source: roll.source, finish: roll.finish,
                  rawImageUrl: roll.rawImageUrl, flatImageUrl: roll.flatImageUrl || undefined, flatPxPerCm: roll.flatPxPerCm,
                  flatWidthCm: roll.flatWidthCm, flatLengthCm: roll.flatLengthCm, usableFor: roll.usableFor,
                }}
                themes={roll.themes}
                // Already on the review queue's own page: close, do not navigate.
                onReview={() => setLaunching(false)}
              />
            )}
          </DialogContent>
        </Dialog>
      )}

      {calibrating && (
        <RollCalibration
          roll={roll}
          onClose={() => setCalibrating(false)}
          onSaved={async (fields) => { await updateRoll({ id: roll._id, ...fields }); }}
        />
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
/**
 * Builds the listing a design is missing, for one listing of one gadget.
 *
 * The variant shape is read off the catalogue — the listings of this kind that
 * already exist — so the admin mostly sets prices. Where there is no precedent
 * (a new kind of listing, like a drone controller on its own) the rows are
 * editable: name, SKU ending, sheets used and price. The words are generated.
 */
function CreateListingDialog({ group, design, onClose, onCreated, loadTemplate, createListing }: {
  group: ListingGroup;
  design: Design;
  onClose: () => void;
  onCreated: (key: string, title: string) => void;
  loadTemplate: (group: ListingGroup) => Promise<any>;
  createListing: (args: any) => Promise<any>;
}) {
  const [rows, setRows] = useState<VariantRow[] | null>(null);
  const [publishNow, setPublishNow] = usePublishNow();
  const [precedent, setPrecedent] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    loadTemplate(group)
      .then((res: any) => {
        if (!live) return;
        setRows(toRows(res));
        setPrecedent(res?.precedent !== false);
      })
      .catch((e: unknown) => {
        if (live) setLoadError(e instanceof Error ? e.message : "Could not read the template");
      });
    return () => { live = false; };
  }, [group.key]);

  const submit = async () => {
    if (!rows) return;
    const problem = rowsProblem(rows);
    if (problem) return toast.error(problem);
    setBusy(true);
    try {
      const res: any = await createListing({
        designCode: design.code,
        designName: design.name || "",
        gadgetTypeId: group.gadgetTypeId || "",
        gadget: group.gadget,
        listing: group.listing,
        ...(scopeFor(group.listing) || {}),
        publishNow,
        finish: design.finish || "",
        source: design.source,
        imageUrl: design.rawImageUrl || "",
        variants: rowsPayload(rows),
      });
      onCreated(group.key, res.title);
      // A new window, so the studio keeps its queue and the admin can check the
      // generated copy side by side.
      window.open(`/backend-skinly/products/${res.productId}`, "_blank", "noopener");
      toast.success(publishNow
        ? `Created ${res.skus.join(", ")} · live now`
        : `Created ${res.skus.join(", ")} as a draft · it goes live when its first mockup is approved`);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create the listing");
    } finally { setBusy(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o && !busy) onClose(); }}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create the {group.listing} listing for {design.code}</DialogTitle>
          <DialogDescription>
            {group.shots.length} picture{group.shots.length === 1 ? "" : "s"} will land on it:{" "}
            {group.shots.map((s) => s.label).join(", ")}. The title, slug, description, meta tags and
            collections are written for you.
          </DialogDescription>
        </DialogHeader>

        {loadError ? (
          <p className="text-sm text-rose-600">{loadError}</p>
        ) : !rows ? (
          <LoadingLine text={`Reading how existing ${group.listing} listings are set up — this can take a few seconds…`} />
        ) : (
          <div className="space-y-3">
            <VariantRowsEditor rows={rows} setRows={setRows} code={design.code} precedent={precedent} stockLabel={design.stockLabel} />
            <PublishNowSwitch on={publishNow} set={setPublishNow} />
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={() => void submit()} disabled={busy || !rows?.length}>
            {busy ? <Loader2Icon className="mr-1.5 size-4 animate-spin" /> : <FilePlus2Icon className="mr-1.5 size-4" />}
            {busy ? "Writing the listing…" : "Create and open"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LoadingLine({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-3 text-sm text-violet-800 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-200">
      <Loader2Icon className="size-4 shrink-0 animate-spin" />
      <span>{text}</span>
    </div>
  );
}

function VariantRowsEditor({ rows, setRows, code, precedent, stockLabel }: {
  rows: VariantRow[];
  setRows: (rows: VariantRow[]) => void;
  code: string;
  precedent: boolean;
  stockLabel?: string;
}) {
  const set = (i: number, patch: Partial<VariantRow>) => setRows(rows.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  return (
    <div className="space-y-2">
      {!precedent && (
        <p className="rounded-md bg-amber-50 px-2 py-1.5 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          No existing listing of this kind to copy. Set the variants yourself — one row per option the customer picks.
        </p>
      )}
      <div className="grid grid-cols-[1fr_7rem_4.5rem_5.5rem_2rem] items-center gap-2 px-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        <span>Variant name</span><span>SKU ending</span><span>Sheets</span><span>Price ₹</span><span />
      </div>
      {rows.map((r, i) => (
        <div key={i} className="grid grid-cols-[1fr_7rem_4.5rem_5.5rem_2rem] items-center gap-2 rounded-lg border p-1.5">
          <Input className="h-8 text-sm" value={r.title} onChange={(e) => set(i, { title: e.target.value })} />
          <div className="flex items-center">
            <span className="mr-0.5 truncate font-mono text-[10px] text-muted-foreground" title={code}>-</span>
            <Input className="h-8 font-mono text-xs uppercase" value={r.skuTail} placeholder="(none)" onChange={(e) => set(i, { skuTail: e.target.value })} />
          </div>
          <Input className="h-8 text-sm" inputMode="decimal" value={r.materialMultiplier} onChange={(e) => set(i, { materialMultiplier: e.target.value })} />
          <Input className="h-8 text-sm" inputMode="numeric" value={r.price} onChange={(e) => set(i, { price: e.target.value })} />
          <Button size="sm" variant="ghost" className="h-8 px-0 text-rose-600" title="Remove" onClick={() => setRows(rows.filter((_, j) => j !== i))}>
            <TrashIcon className="size-3.5" />
          </Button>
        </div>
      ))}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button size="sm" variant="outline" onClick={() => setRows([...rows, { skuTail: "", title: "", price: "", materialMultiplier: "1" }])}>
          <PlusIcon className="mr-1 size-3.5" /> Add variant
        </Button>
        <code className="text-[10px] text-muted-foreground">
          SKUs: {rows.map((r) => `${code}${r.skuTail.trim() ? `-${r.skuTail.trim().toUpperCase()}` : ""}`).join(", ")}
        </code>
      </div>
      {stockLabel && (
        <p className="text-[11px] text-muted-foreground">
          Stock starts from the design's own shelf — {stockLabel} — as soon as the listing exists.
        </p>
      )}
    </div>
  );
}

/**
 * Creates every listing a design is missing, in one pass.
 *
 * A design that is new to the catalogue is missing most listings, and making
 * them one dialog at a time is the same decisions over and over. The variant
 * shapes and prices still come from the catalogue; the admin reviews a list
 * and presses once.
 */
function BulkListingsDialog({ groups, design, onClose, onCreated, loadTemplate, createListing }: {
  groups: ListingGroup[];
  design: Design;
  onClose: () => void;
  onCreated: (key: string, title: string) => void;
  loadTemplate: (group: ListingGroup) => Promise<any>;
  createListing: (args: any) => Promise<any>;
}) {
  type Row = {
    group: ListingGroup;
    variants: VariantRow[];
    precedent: boolean;
    state: "loading" | "ready" | "creating" | "done" | "error";
    note?: string;
  };
  const [rows, setRows] = useState<Row[]>(groups.map((group) => ({ group, variants: [], precedent: true, state: "loading" })));
  const [publishNow, setPublishNow] = usePublishNow();
  const [running, setRunning] = useState(false);

  useEffect(() => {
    let live = true;
    groups.forEach((group, i) => {
      loadTemplate(group)
        .then((res: any) => {
          if (!live) return;
          setRows((prev) => prev.map((r, j) => j !== i ? r : {
            ...r, state: "ready", variants: toRows(res), precedent: res?.precedent !== false,
          }));
        })
        .catch((e: unknown) => {
          if (!live) return;
          setRows((prev) => prev.map((r, j) => j !== i ? r : {
            ...r, state: "error", note: e instanceof Error ? e.message : "Could not read the template",
          }));
        });
    });
    return () => { live = false; };
  }, []);

  const createAll = async () => {
    setRunning(true);
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (row.state !== "ready") continue;
      const problem = rowsProblem(row.variants);
      if (problem) {
        setRows((prev) => prev.map((r, j) => j === i ? { ...r, note: problem } : r));
        continue;
      }
      setRows((prev) => prev.map((r, j) => j === i ? { ...r, state: "creating", note: undefined } : r));
      try {
        const res: any = await createListing({
          designCode: design.code,
          designName: design.name || "",
          gadgetTypeId: row.group.gadgetTypeId || "",
          gadget: row.group.gadget,
          listing: row.group.listing,
          ...(scopeFor(row.group.listing) || {}),
          publishNow,
          finish: design.finish || "",
          source: design.source,
          imageUrl: design.rawImageUrl || "",
          variants: rowsPayload(row.variants),
        });
        onCreated(row.group.key, res.title);
        setRows((prev) => prev.map((r, j) => j === i ? { ...r, state: "done", note: res.skus.join(", ") } : r));
      } catch (e) {
        setRows((prev) => prev.map((r, j) => j === i ? {
          ...r, state: "error", note: e instanceof Error ? e.message : "Could not create",
        } : r));
      }
    }
    setRunning(false);
  };

  const ready = rows.filter((r) => r.state === "ready").length;
  const loading = rows.filter((r) => r.state === "loading").length;
  const done = rows.filter((r) => r.state === "done").length;

  return (
    <Dialog open onOpenChange={(o) => { if (!o && !running) onClose(); }}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Create the {groups.length} missing listing{groups.length === 1 ? "" : "s"} for {design.code}</DialogTitle>
          <DialogDescription>
            One product per listing. Variants and prices come from what the catalogue already uses;
            titles, descriptions, meta tags and collections are written for each.
          </DialogDescription>
        </DialogHeader>

        {loading > 0 && <LoadingLine text={`Reading ${loading} listing template${loading === 1 ? "" : "s"}…`} />}
        <PublishNowSwitch on={publishNow} set={setPublishNow} />

        <div className="space-y-2">
          {rows.map((row, i) => (
            <div key={row.group.key} className="rounded-lg border p-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">
                  {row.group.listing}
                  <span className="ml-2 text-xs font-normal capitalize text-muted-foreground">{row.group.gadget}</span>
                </span>
                {row.state === "loading" && <Loader2Icon className="size-4 animate-spin text-muted-foreground" />}
                {row.state === "creating" && <Loader2Icon className="size-4 animate-spin text-violet-600" />}
                {row.state === "done" && <Badge className="bg-emerald-600 text-[10px]">created</Badge>}
                {row.state === "error" && <Badge variant="destructive" className="text-[10px]">failed</Badge>}
              </div>
              {row.state === "ready" && (
                <div className="mt-2">
                  <VariantRowsEditor
                    rows={row.variants}
                    code={design.code}
                    precedent={row.precedent}
                    setRows={(next) => setRows((prev) => prev.map((r, j) => (j === i ? { ...r, variants: next } : r)))}
                  />
                </div>
              )}
              {row.note && (
                <p className={`mt-1 text-[11px] ${row.state === "done" ? "text-muted-foreground" : "text-rose-600"}`}>
                  {row.note}
                </p>
              )}
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={running}>
            {done ? "Done" : "Cancel"}
          </Button>
          <Button onClick={() => void createAll()} disabled={running || !ready}>
            {running ? <Loader2Icon className="mr-1.5 size-4 animate-spin" /> : <FilePlus2Icon className="mr-1.5 size-4" />}
            Create {ready} listing{ready === 1 ? "" : "s"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Says where an approved image would land, before anything is generated. */
function LinkTargets({ titles, onCreate }: { titles: string[] | null; onCreate?: () => void }) {
  if (titles === null) return <span className="text-[10px] text-muted-foreground">checking listings…</span>;
  if (!titles.length) {
    return (
      <span className="mt-0.5 flex items-center gap-1.5">
        <span className="text-[10px] text-amber-600">no listing for this design</span>
        {onCreate && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => { e.stopPropagation(); onCreate(); }}
            onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); onCreate(); } }}
            className="inline-flex cursor-pointer items-center gap-1 rounded border border-violet-300 bg-violet-50 px-1.5 py-0.5 text-[10px] font-medium text-violet-700 hover:bg-violet-100 dark:border-violet-800 dark:bg-violet-950/50 dark:text-violet-300"
          >
            <FilePlus2Icon className="size-3" />
            Create listing
          </span>
        )}
      </span>
    );
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
                <>
                  <AlertCircleIcon className="size-6 text-rose-500" />
                  <span className="px-2 text-center text-[11px] leading-snug text-rose-600">
                    {/refused this design/.test(job.error || "") ? "Refused by the model's safety filter" : job.error || "Failed"}
                  </span>
                  {/refused this design/.test(job.error || "") && (
                    <span className="px-3 text-center text-[10px] leading-snug text-muted-foreground">
                      It reads the reference photo too. Redo with a different model, or shoot this one.
                    </span>
                  )}
                </>
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
            <p className="truncate text-[10px] text-muted-foreground">
              {job.promptSent === undefined
                ? "sent before prompts were recorded"
                : job.referenceUrl
                  ? <>angle reference sent · <a className="underline" href={job.referenceUrl} target="_blank" rel="noreferrer">view</a></>
                  : "no angle reference"}
              {job.promptSent && (
                <>
                  {" · "}
                  <button className="underline" onClick={() => { void navigator.clipboard?.writeText(job.promptSent!); toast.success("Prompt copied"); }}>
                    copy prompt
                  </button>
                  {/^Two identical|Two images are supplied/.test(job.promptSent) ? " · new pose" : " · old pose"}
                </>
              )}
            </p>
            {/* Whether the model saw the device's own piece of the roll, which
                is what decides the pattern's scale. */}
            <p className="truncate text-[10px]">
              {job.pieceCm
                ? <span className="text-emerald-600 dark:text-emerald-400">true size · {job.pieceCm} cm piece</span>
                : <span className="text-amber-600 dark:text-amber-400">whole roll photo · scale is the model's guess</span>}
            </p>
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
    // Launch jobs are collected on the server; polling them here too would
    // store the same picture twice.
    const pending = jobs.filter((j) => j.status === "running" && j.taskId && !(j as any).serverManaged && !inFlight.current.has(j._id));
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
          // The job id keeps two staged images from ever sharing a file.
          const pendingKey = `ai-mockups-pending/${stem}-${job._id}.webp`;
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
    if (!jobs.some((j) => j.status === "running" && !(j as any).serverManaged)) return;
    const id = setInterval(() => { void tick(); }, POLL_MS);
    return () => clearInterval(id);
  }, [jobs, tick]);
}
