import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useAction, useMutation, useQuery } from "@/lib/firebase-hooks";
import { Authenticated, AuthLoading, Unauthenticated } from "@/lib/firebase-hooks";
import { api } from "@/lib/firebase-api";
import { AdminLayout } from "@/components/admin-layout.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { CameraIcon, Loader2Icon, RotateCcwIcon, RotateCwIcon, RulerIcon, SparklesIcon } from "lucide-react";
import { rotateImageDataUrl } from "@/lib/image-processing.ts";
import { RollCalibration } from "@/pages/admin/ai-mockups/templates.tsx";
import { LaunchPanel, LaunchProgress, RecentLaunches } from "./launch-panel.tsx";
import type { LaunchDesign } from "@/lib/launch-plan.ts";

/**
 * One design, from a phone: find or add it, photograph it, confirm what the
 * photo suggests, launch. Everything after that runs on the server — the
 * listings, their words, collections and stock, and the pictures, which then
 * wait in the studio for approval.
 */

const FINISHES = ["Matte", "3D Textured", "Tranzy (transparent)"];
const normCode = (s: string) => s.trim().toUpperCase().replace(/\s+/g, "");
const sameCode = (a: string, b: string) => normCode(a).replace(/-0+(\d)/g, "-$1") === normCode(b).replace(/-0+(\d)/g, "-$1");

export default function QuickLaunchPage() {
  return (
    <AdminLayout>
      <AuthLoading><Skeleton className="h-64 w-full" /></AuthLoading>
      <Unauthenticated>
        <div className="flex min-h-[60vh] items-center justify-center"><SignInButton /></div>
      </Unauthenticated>
      <Authenticated><QuickLaunch /></Authenticated>
    </AdminLayout>
  );
}

function QuickLaunch() {
  const rolls = useQuery(api.rollsManagement.getRollInventory) as any[] | undefined;
  const cutouts = useQuery(api.aiMockups.getCutouts) as any[] | undefined;
  const addRoll = useMutation(api.rollsManagement.addRollInventory);
  const updateRoll = useMutation(api.rollsManagement.updateRollInventory);
  const updateCutout = useMutation(api.aiMockups.updateCutoutInventory);
  const upload = useAction(api.mediaLibrary.uploadAndAddToLibrary);
  const suggest = useAction(api.listings.suggestDesignDetails);

  const [codeInput, setCodeInput] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [openLaunch, setOpenLaunch] = useState<string | null>(null);

  const designs = useMemo(() => [
    ...(rolls || []).map((r) => ({ ...r, _source: "roll" as const, _code: String(r.rNumber || "") })),
    ...(cutouts || []).map((c) => ({ ...c, _source: "cutout" as const, _code: String(c.cutoutNumber || "") })),
  ], [rolls, cutouts]);
  const matches = useMemo(() => {
    const q = normCode(codeInput);
    if (!q) return [];
    return designs.filter((d) => normCode(d._code).includes(q) || String(d.designName || "").toUpperCase().includes(q)).slice(0, 8);
  }, [designs, codeInput]);
  const selected = designs.find((d) => d._id === selectedId) || null;
  const exact = designs.find((d) => sameCode(d._code, codeInput));

  // Editable details of the chosen design.
  const [name, setName] = useState("");
  const [finish, setFinish] = useState("");
  const [themes, setThemes] = useState("");
  const [stock, setStock] = useState("");
  useEffect(() => {
    if (!selected) return;
    setName(String(selected.designName || ""));
    setFinish(String(selected.finish || ""));
    setThemes((selected.designThemes || []).join(", "));
    setStock(String(selected._source === "roll" ? selected.metersAvailable ?? "" : selected.sheetsAvailable ?? ""));
  }, [selectedId]);

  const [staged, setStaged] = useState<{ dataUrl: string; turns: number } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [calibrating, setCalibrating] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const save = async (fields: Record<string, unknown>) => {
    if (!selected) return;
    if (selected._source === "roll") await updateRoll({ id: selected._id, ...fields });
    else await updateCutout({ id: selected._id, ...fields });
  };

  const createRoll = async () => {
    const code = normCode(codeInput);
    if (!/^R-\d+$/.test(code)) return toast.error("A new roll code looks like R-123");
    setBusy("create");
    try {
      const id: any = await addRoll({ rNumber: code, designName: "", metersAvailable: 0, isContinuous: true, createdAt: Date.now() });
      setSelectedId(String(id));
      toast.success(`${code} added`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add the roll");
    } finally { setBusy(null); }
  };

  const onPhoto = async (file: File) => {
    const dataUrl = await new Promise<string>((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result));
      r.onerror = rej;
      r.readAsDataURL(file);
    });
    setStaged({ dataUrl, turns: 0 });
    if (fileRef.current) fileRef.current.value = "";
  };

  const savePhoto = async () => {
    if (!staged || !selected) return;
    setBusy("photo");
    try {
      const base64 = staged.turns ? await rotateImageDataUrl(staged.dataUrl, staged.turns * 90) : staged.dataUrl;
      const stem = normCode(selected._code).replace(/[^A-Z0-9-]/g, "");
      const result: any = await upload({
        fileBase64: base64,
        key: `design-raw/${stem}-${Date.now()}.webp`,
        filename: `${stem}.webp`,
        folder: "design-raw",
        contentType: staged.turns ? "image/webp" : (/data:([^;,]+)/.exec(base64)?.[1] || "image/jpeg"),
        tags: ["raw-design", stem],
      });
      const url = result?.url || result?.publicUrl;
      if (!url) throw new Error(result?.error || "Upload failed");
      // A new photo invalidates an old calibration.
      await save({ rawImageUrl: url, ...(selected._source === "roll" ? { flatImageUrl: "" } : {}) });
      setStaged(null);
      toast.success("Photo saved — reading the design…");
      setBusy("suggest");
      try {
        const s: any = await suggest({ imageUrl: url });
        if (s?.name && !name) setName(s.name);
        if (s?.finish) setFinish(s.finish);
        const words = [...(s?.themes || []), ...(s?.colors || [])];
        if (words.length) setThemes(words.join(", "));
      } catch {
        toast.info("Could not read the design — fill the details in yourself");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally { setBusy(null); }
  };

  const saveDetails = async () => {
    setBusy("details");
    try {
      const n = Number(stock);
      await save({
        designName: name.trim(),
        finish,
        designThemes: themes.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean),
        ...(Number.isFinite(n) && stock !== "" ? (selected?._source === "roll" ? { metersAvailable: n } : { sheetsAvailable: Math.max(0, Math.round(n)) }) : {}),
      });
      toast.success("Details saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally { setBusy(null); }
  };

  if (rolls === undefined || cutouts === undefined) return <Skeleton className="h-64 w-full" />;

  const design: LaunchDesign | null = selected ? {
    _id: selected._id,
    code: normCode(selected._code),
    name: name.trim(),
    source: selected._source,
    finish,
    rawImageUrl: selected.rawImageUrl,
    flatImageUrl: selected.flatImageUrl || undefined,
    flatPxPerCm: selected.flatPxPerCm,
    flatWidthCm: selected.flatWidthCm,
    flatLengthCm: selected.flatLengthCm,
    usableFor: Array.isArray(selected.usableFor) ? selected.usableFor : undefined,
  } : null;
  const detailsSaved = selected && name.trim() === String(selected.designName || "") && finish === String(selected.finish || "");

  return (
    <div className="mx-auto max-w-xl space-y-4 pb-16">
      <div>
        <h1 className="text-2xl font-bold">Quick launch</h1>
        <p className="text-sm text-muted-foreground">
          Photograph a roll or sheet, check the details, launch. Listings, words, collections, stock and pictures
          are made on the server.
        </p>
      </div>

      {openLaunch ? (
        <div className="space-y-2">
          <Button variant="ghost" size="sm" onClick={() => setOpenLaunch(null)}>← Back</Button>
          <LaunchProgress launchId={openLaunch} />
        </div>
      ) : (
        <>
          <Card>
            <CardContent className="space-y-3 p-4">
              <Label>1 · Design</Label>
              <Input
                value={codeInput}
                onChange={(e) => { setCodeInput(e.target.value); setSelectedId(null); }}
                placeholder="R-12, L-239 or a design name"
                className="h-11 text-base"
                autoCapitalize="characters"
              />
              {!selected && matches.length > 0 && (
                <div className="space-y-1">
                  {matches.map((d) => (
                    <button key={d._id} onClick={() => { setSelectedId(d._id); setCodeInput(d._code); }}
                      className="flex w-full items-center gap-2 rounded-lg border p-2 text-left text-sm hover:bg-muted/50">
                      <div className="size-10 shrink-0 overflow-hidden rounded bg-muted">
                        {d.rawImageUrl && <img src={d.rawImageUrl} alt="" className="size-full object-cover" />}
                      </div>
                      <span className="font-mono font-semibold">{d._code}</span>
                      <span className="min-w-0 flex-1 truncate text-muted-foreground">{d.designName || "untitled"}</span>
                      <Badge variant="outline" className="text-[10px]">{d._source === "roll" ? "roll" : d.kind === "precut" ? "pre-cut" : "sheet"}</Badge>
                    </button>
                  ))}
                </div>
              )}
              {!selected && codeInput && !exact && /^R-?\d+$/i.test(normCode(codeInput)) && (
                <Button variant="outline" className="w-full" disabled={busy === "create"} onClick={() => void createRoll()}>
                  Add {normCode(codeInput).replace(/^R(\d)/, "R-$1")} as a new roll
                </Button>
              )}
            </CardContent>
          </Card>

          {selected && (
            <Card>
              <CardContent className="space-y-3 p-4">
                <Label>2 · Photo</Label>
                <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) void onPhoto(f); }} />
                {staged ? (
                  <div className="space-y-2">
                    <div className="flex justify-center rounded-lg border bg-muted/30 p-2">
                      <img src={staged.dataUrl} alt="New photo" className="max-h-72 object-contain" style={{ transform: `rotate(${staged.turns * 90}deg)` }} />
                    </div>
                    <p className="text-xs text-muted-foreground">Turn it until the design is the right way up.</p>
                    <div className="grid grid-cols-4 gap-2">
                      <Button variant="outline" onClick={() => setStaged({ ...staged, turns: staged.turns - 1 })}><RotateCcwIcon className="size-4" /></Button>
                      <Button variant="outline" onClick={() => setStaged({ ...staged, turns: staged.turns + 1 })}><RotateCwIcon className="size-4" /></Button>
                      <Button variant="ghost" disabled={!!busy} onClick={() => setStaged(null)}>Cancel</Button>
                      <Button disabled={!!busy} onClick={() => void savePhoto()}>
                        {busy === "photo" ? <Loader2Icon className="size-4 animate-spin" /> : "Save"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="size-24 shrink-0 overflow-hidden rounded-lg border bg-muted">
                      {selected.rawImageUrl && <img src={selected.rawImageUrl} alt="" className="size-full object-cover" />}
                    </div>
                    <div className="space-y-2">
                      <Button onClick={() => fileRef.current?.click()}>
                        <CameraIcon className="mr-2 size-4" /> {selected.rawImageUrl ? "Retake photo" : "Take photo"}
                      </Button>
                      <p className="text-xs text-muted-foreground">
                        Flat, straight down, daylight, no flash{selected._source === "roll" ? ", with both edges of the roll in frame" : ", the whole sheet in frame"}.
                      </p>
                    </div>
                  </div>
                )}
                {selected._source === "roll" && selected.rawImageUrl && !staged && (
                  <div className="flex items-center justify-between gap-2 rounded-lg bg-muted/40 p-2 text-sm">
                    <span className={selected.flatImageUrl ? "text-emerald-700" : "text-amber-700"}>
                      {selected.flatImageUrl ? `Calibrated · ${selected.flatWidthCm} × ${selected.flatLengthCm} cm` : "Not calibrated — template pictures need it"}
                    </span>
                    <Button size="sm" variant="outline" onClick={() => setCalibrating(true)}>
                      <RulerIcon className="mr-1.5 size-3.5" /> {selected.flatImageUrl ? "Redo" : "Calibrate"}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {selected && (
            <Card>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-center justify-between">
                  <Label>3 · Details</Label>
                  {busy === "suggest" && <span className="flex items-center gap-1 text-xs text-violet-600"><SparklesIcon className="size-3" /> reading the photo…</span>}
                </div>
                <div>
                  <Label className="text-xs">Design name</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Retro Pac-Man Maze" className="h-11 text-base" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Finish</Label>
                    <Select value={finish} onValueChange={setFinish}>
                      <SelectTrigger className="h-11"><SelectValue placeholder="Pick one" /></SelectTrigger>
                      <SelectContent>
                        {FINISHES.filter((f) => selected._source === "cutout" || !/tranzy/i.test(f)).map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">{selected._source === "roll" ? "Metres in stock" : "Pieces in stock"}</Label>
                    <Input inputMode="decimal" value={stock} onChange={(e) => setStock(e.target.value)} className="h-11 text-base" />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Themes and colours</Label>
                  <Input value={themes} onChange={(e) => setThemes(e.target.value)} placeholder="gaming, retro, black, blue" className="h-11 text-base" />
                  <p className="mt-1 text-[11px] text-muted-foreground">Used for tags and to place the listings in collections.</p>
                </div>
                <Button className="w-full" variant={detailsSaved ? "outline" : "default"} disabled={busy === "details"} onClick={() => void saveDetails()}>
                  {busy === "details" ? <Loader2Icon className="mr-2 size-4 animate-spin" /> : null} Save details
                </Button>
              </CardContent>
            </Card>
          )}

          {selected && design && (
            <Card>
              <CardContent className="space-y-3 p-4">
                <Label>4 · Launch</Label>
                {!design.rawImageUrl || !design.name || !design.finish ? (
                  <p className="text-sm text-muted-foreground">Add a photo, a name and a finish first.</p>
                ) : !detailsSaved ? (
                  <p className="text-sm text-amber-700">Save the details first, so the listings use them.</p>
                ) : (
                  <LaunchPanel
                    key={design.code}
                    design={design}
                    themes={themes.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean)}
                  />
                )}
              </CardContent>
            </Card>
          )}

          <div className="space-y-2">
            <Label>Recent launches</Label>
            <RecentLaunches onOpen={setOpenLaunch} />
          </div>
        </>
      )}

      {calibrating && selected && (
        <RollCalibration
          roll={{ _id: selected._id, code: selected._code, rawImageUrl: selected.rawImageUrl }}
          onClose={() => setCalibrating(false)}
          onSaved={async (fields) => { await updateRoll({ id: selected._id, ...fields }); }}
        />
      )}
    </div>
  );
}
