import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useAction, useMutation, useQuery } from "@/lib/firebase-hooks";
import { api } from "@/lib/firebase-api";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog.tsx";
import { CrosshairIcon, ImageIcon, Loader2Icon, RulerIcon, SparklesIcon, UploadIcon, WandSparklesIcon } from "lucide-react";
import {
  DEFAULT_BLOCKS, DEFAULT_SURFACE_CM, TEMPLATE_GADGETS, expandPrompt, isPhase1, listingOf, listingSlug, presetFor, shotCodes,
  type MockupShot, type SharedBlocks,
} from "@/lib/ai-mockup-shots.ts";
import { IMAGE_MODELS, resolveSize, formatInr } from "@/lib/ai-mockup-models.ts";
import {
  canvasToWebp, composite, dataToCanvas, greenSwatch, imageToData, largestGreenQuad, loadImage, rectifyRoll, truePiece,
  type Point,
} from "@/lib/mockup-composite.ts";

/**
 * Template mockups in the studio.
 *
 * A template is one photo per listing — its device with the skin area in flat
 * green — plus the corners and real size of that surface. Made once (by the
 * image model, a few rupees, or uploaded), it turns every design into that
 * listing's picture for free, at the design's true scale. Only flat skins are
 * templated; controllers, drones and the like stay with the image model.
 */

export interface MockupTemplate {
  _id: string;
  kind: "template";
  listing: string;
  gadget: string;
  imageUrl?: string;
  quad?: Point[];
  widthCm?: number;
  heightCm?: number;
  status?: "generating" | "needs-corners" | "ready" | "failed";
  taskId?: string;
  error?: string;
  updatedAt?: number;
}

export const templateId = (listing: string) => `template-${listingSlug(listing)}`;

export function useTemplates() {
  const rows = useQuery(api.aiMockups.getTemplates) as MockupTemplate[] | undefined;
  const byListing = useMemo(() => {
    const m = new Map<string, MockupTemplate>();
    (rows || []).forEach((t) => m.set(String(t.listing).toLowerCase(), t));
    return m;
  }, [rows]);
  return { templates: rows, byListing };
}

/** An R2 image as something a canvas may read, whatever the bucket's CORS says. */
export function useCanvasImage() {
  const getObject = useAction(api.r2.getR2Object);
  return useCallback(async (url: string) => {
    try {
      const img = await loadImage(`${url}${url.includes("?") ? "&" : "?"}cv=1`);
      imageToData(img); // throws if the canvas would be tainted
      return img;
    } catch {
      const key = decodeURIComponent(new URL(url).pathname.replace(/^\/+/, ""));
      const obj: any = await getObject({ key });
      return loadImage(`data:${obj.contentType || "image/webp"};base64,${obj.base64}`);
    }
  }, [getObject]);
}

const GREEN_FIDELITY =
  "The skin is a flat, perfectly uniform chroma-key green — pure #00FF00 — with no pattern, no print, no "
  + "texture and no gradient of its own. Use the supplied reference only for that colour. The device's real "
  + "lighting, soft shading and reflections still fall across the green so it reads as a lit surface. Nothing "
  + "else in the picture is green: no plants, no green props, no green light. ";

const TEST_CHECKER = (() => {
  // 1 cm squares at 20 px/cm, for checking a template's scale by eye.
  let data: ImageData | null = null;
  return () => {
    if (data) return data;
    const ppc = 20, size = 60 * ppc;
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const ctx = c.getContext("2d")!;
    for (let y = 0; y < 60; y++) for (let x = 0; x < 60; x++) {
      ctx.fillStyle = (x + y) % 2 ? "#f4f1ea" : (x % 5 === 0 || y % 5 === 0 ? "#d9480f" : "#1c7ed6");
      ctx.fillRect(x * ppc, y * ppc, ppc, ppc);
    }
    data = ctx.getImageData(0, 0, size, size);
    return data;
  };
})();

/* --------------------------------------------------------------- templates tab */

export function TemplatesTab({ shots, blocks }: { shots: MockupShot[]; blocks: SharedBlocks }) {
  const { templates, byListing } = useTemplates();
  const saveTemplate = useMutation(api.aiMockups.saveTemplate);
  const submit = useAction(api.poyo.poyoSubmit);
  const status = useAction(api.poyo.poyoStatus);
  const upload = useAction(api.r2.uploadToR2);
  const [phaseOnly, setPhaseOnly] = useState(true);
  const cheapest = [...IMAGE_MODELS].sort((a, b) => a.usd - b.usd)[0];
  const [modelId, setModelId] = useState(cheapest.id);
  const [editing, setEditing] = useState<{ listing: string; gadget: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadFor = useRef<{ listing: string; gadget: string } | null>(null);
  const greenUrl = useRef<string | null>(null);
  const polling = useRef(new Set<string>());

  // One row per flat listing that has shots.
  const listings = useMemo(() => {
    const m = new Map<string, { listing: string; gadget: string; shots: MockupShot[] }>();
    for (const s of shots) {
      if (!TEMPLATE_GADGETS.has(s.gadget) || s.isActive === false) continue;
      const listing = listingOf(s);
      if (!presetFor(listing)) continue;
      const k = listing.toLowerCase();
      const row = m.get(k) || { listing, gadget: s.gadget, shots: [] };
      row.shots.push(s);
      m.set(k, row);
    }
    /*
     * Each row's shots in a fixed order, because the first one is the shot the
     * template is generated from. Taken in whatever order the shot library
     * happened to return, "Laptop" could be generated from a shot that is not
     * the laptop's own — and the card then shows the wrong device with the
     * right name on it, which is only spotted by eye.
     */
    for (const row of m.values()) {
      row.shots.sort((a, b) => (a.order ?? 99) - (b.order ?? 99) || String(a.label).localeCompare(String(b.label)));
    }
    return [...m.values()]
      .filter((r) => !phaseOnly || isPhase1(r.listing))
      .sort((a, b) => a.gadget.localeCompare(b.gadget) || a.listing.localeCompare(b.listing));
  }, [shots, phaseOnly]);

  // Collect finished generations.
  useEffect(() => {
    const pending = (templates || []).filter((t) => t.status === "generating" && t.taskId);
    if (!pending.length) return;
    const id = setInterval(() => {
      for (const t of pending) {
        if (polling.current.has(t._id)) continue;
        polling.current.add(t._id);
        void (async () => {
          try {
            const res: any = await status({ taskId: t.taskId, withImage: true });
            if (res.status === "failed" || res.error) {
              await saveTemplate({ id: t._id, status: "failed", error: res.error || "Generation failed", taskId: "" });
            } else if (res.status === "finished" && res.base64) {
              const up: any = await upload({
                fileBase64: res.base64,
                key: `mockup-templates/${listingSlug(t.listing)}-${Date.now()}.webp`,
                contentType: res.contentType || "image/webp",
              });
              const url = up?.url || up?.publicUrl;
              if (!url) throw new Error("Upload failed");
              await saveTemplate({ id: t._id, status: "needs-corners", imageUrl: url, taskId: "", quad: null });
              toast.success(`${t.listing}: template ready — mark its corners`);
            }
          } catch (e) {
            await saveTemplate({ id: t._id, status: "failed", error: e instanceof Error ? e.message : "Collect failed", taskId: "" });
          } finally {
            polling.current.delete(t._id);
          }
        })();
      }
    }, 5000);
    return () => clearInterval(id);
  }, [templates, status, upload, saveTemplate]);

  const model = IMAGE_MODELS.find((m) => m.id === modelId) || cheapest;

  const generate = async (row: { listing: string; gadget: string; shots: MockupShot[] }) => {
    setBusy(row.listing);
    try {
      if (!greenUrl.current) {
        const up: any = await upload({ fileBase64: greenSwatch(), key: "mockup-templates/green-reference.png", contentType: "image/png" });
        greenUrl.current = up?.url || up?.publicUrl;
        if (!greenUrl.current) throw new Error("Could not upload the green reference");
      }
      const shot = row.shots[0];
      const res: any = await submit({
        model: model.apiModel,
        size: resolveSize(model, "1:1"),
        resolution: model.resolution,
        quality: model.quality,
        prompt: expandPrompt(shot.prompt, { ...DEFAULT_BLOCKS, ...blocks, fidelity: GREEN_FIDELITY }, { source: "roll", finish: "" }),
        imageUrls: [greenUrl.current],
      });
      await saveTemplate({
        id: templateId(row.listing),
        kind: "template",
        listing: row.listing,
        gadget: row.gadget,
        status: "generating",
        taskId: res.taskId,
        error: "",
      });
      toast.success(`${row.listing}: generating (${formatInr(model.usd)})`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start");
    } finally {
      setBusy(null);
    }
  };

  const onUpload = async (file: File) => {
    const target = uploadFor.current;
    if (!target) return;
    setBusy(target.listing);
    try {
      const dataUrl = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(String(r.result));
        r.onerror = rej;
        r.readAsDataURL(file);
      });
      const up: any = await upload({
        fileBase64: dataUrl,
        key: `mockup-templates/${listingSlug(target.listing)}-${Date.now()}.webp`,
        contentType: file.type || "image/jpeg",
      });
      const url = up?.url || up?.publicUrl;
      if (!url) throw new Error("Upload failed");
      await saveTemplate({
        id: templateId(target.listing), kind: "template", listing: target.listing, gadget: target.gadget,
        imageUrl: url, status: "needs-corners", quad: null, error: "",
      });
      setEditing(target);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(null);
      uploadFor.current = null;
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  if (templates === undefined) {
    return <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2Icon className="size-4 animate-spin" /> Loading templates…</p>;
  }

  const ready = listings.filter((r) => byListing.get(r.listing.toLowerCase())?.status === "ready").length;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3 p-4">
          <div>
            <h3 className="font-semibold">Template mockups</h3>
            <p className="text-sm text-muted-foreground">
              One photo per listing with the skin in flat green. Once its corners and real size are set, every
              design becomes that listing's picture at no cost and at true scale. Make each template once:
              generate it (the cheapest model is enough), or upload your own photo with a green skin.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={phaseOnly} onCheckedChange={setPhaseOnly} />
              Phase 1 listings only
            </label>
            <div className="flex items-center gap-2">
              <Label className="text-xs">Model</Label>
              <Select value={modelId} onValueChange={setModelId}>
                <SelectTrigger className="h-8 w-[240px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {IMAGE_MODELS.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.label} · {formatInr(m.usd)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Badge variant="outline">{ready} of {listings.length} ready</Badge>
          </div>
        </CardContent>
      </Card>

      <input ref={fileRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void onUpload(f); }} />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {listings.map((row) => {
          const t = byListing.get(row.listing.toLowerCase());
          const isBusy = busy === row.listing || t?.status === "generating";
          return (
            <Card key={row.listing}>
              <CardContent className="space-y-2 p-3">
                <div className="relative aspect-square overflow-hidden rounded-lg bg-muted">
                  {t?.imageUrl ? (
                    <img src={t.imageUrl} alt={`${row.listing} template`} className="size-full object-cover" />
                  ) : (
                    <div className="flex size-full items-center justify-center text-muted-foreground/50">
                      {t?.status === "generating" ? <Loader2Icon className="size-6 animate-spin" /> : <ImageIcon className="size-7" />}
                    </div>
                  )}
                  <span className="absolute left-2 top-2">
                    {t?.status === "ready" ? <Badge className="bg-emerald-600 text-[10px]">ready</Badge>
                      : t?.status === "needs-corners" ? <Badge className="bg-amber-500 text-[10px]">mark corners</Badge>
                      : t?.status === "generating" ? <Badge className="bg-violet-600 text-[10px]">generating</Badge>
                      : t?.status === "failed" ? <Badge variant="destructive" className="text-[10px]">failed</Badge>
                      : <Badge variant="outline" className="bg-background text-[10px]">no template</Badge>}
                  </span>
                </div>
                <div>
                  <p className="font-medium">{row.listing}</p>
                  <p className="text-xs capitalize text-muted-foreground">
                    {row.gadget}
                    {t?.widthCm && t?.heightCm ? ` · ${t.widthCm} × ${t.heightCm} cm` : ""}
                  </p>
                  {/* Which shot the photo is generated from, so a template
                      showing the wrong device is read off the card instead of
                      spotted later in a listing. */}
                  <p className="truncate text-[11px] text-muted-foreground/80" title={row.shots[0]?.label}>
                    from “{row.shots[0]?.label || "no shot"}”
                  </p>
                  {t?.status === "failed" && <p className="text-[11px] text-rose-600">{t.error}</p>}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Button size="sm" variant="outline" className="h-7 text-xs" disabled={isBusy} onClick={() => void generate(row)}>
                    <SparklesIcon className="mr-1 size-3" />
                    {t?.imageUrl ? "Regenerate" : "Generate"}
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs" disabled={isBusy}
                    onClick={() => { uploadFor.current = { listing: row.listing, gadget: row.gadget }; fileRef.current?.click(); }}>
                    <UploadIcon className="mr-1 size-3" />
                    Upload
                  </Button>
                  {t?.imageUrl && (
                    <Button size="sm" className="h-7 text-xs" disabled={isBusy} onClick={() => setEditing({ listing: row.listing, gadget: row.gadget })}>
                      <CrosshairIcon className="mr-1 size-3" />
                      Corners &amp; size
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {editing && byListing.get(editing.listing.toLowerCase())?.imageUrl && (
        <CornerEditor
          template={byListing.get(editing.listing.toLowerCase())!}
          onClose={() => setEditing(null)}
          onSave={async (quad, widthCm, heightCm) => {
            await saveTemplate({ id: templateId(editing.listing), quad, widthCm, heightCm, status: "ready" });
            toast.success(`${editing.listing}: template ready`);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- point picker */

const LABELS = ["top-left", "top-right", "bottom-right", "bottom-left"];

/** Click four corners on an image, in order; shows them numbered and joined. */
function PointPicker({ src, points, setPoints, naturalSize }: {
  src: string;
  points: Point[];
  setPoints: (p: Point[]) => void;
  naturalSize: { w: number; h: number } | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<number | null>(null);
  const toNatural = (e: React.PointerEvent) => {
    const box = ref.current!.getBoundingClientRect();
    return {
      x: ((e.clientX - box.left) / box.width) * (naturalSize?.w || 1),
      y: ((e.clientY - box.top) / box.height) * (naturalSize?.h || 1),
    };
  };
  const pct = (p: Point) => ({
    left: `${(p.x / (naturalSize?.w || 1)) * 100}%`,
    top: `${(p.y / (naturalSize?.h || 1)) * 100}%`,
  });
  return (
    <div
      ref={ref}
      className="relative mx-auto w-full max-w-[560px] cursor-crosshair select-none overflow-hidden rounded-lg border"
      onPointerDown={(e) => {
        if (!naturalSize) return;
        const p = toNatural(e);
        // Grab a point near the pointer to move it; otherwise place the next one.
        const near = points.findIndex((q) => Math.hypot(q.x - p.x, q.y - p.y) < naturalSize.w * 0.03);
        if (near >= 0) { setDrag(near); (e.target as Element).setPointerCapture?.(e.pointerId); return; }
        if (points.length < 4) setPoints([...points, p]);
      }}
      onPointerMove={(e) => {
        if (drag === null) return;
        const p = toNatural(e);
        setPoints(points.map((q, i) => (i === drag ? p : q)));
      }}
      onPointerUp={() => setDrag(null)}
    >
      <img src={src} alt="" className="block w-full" draggable={false} />
      {points.length > 1 && naturalSize && (
        <svg className="pointer-events-none absolute inset-0 size-full" viewBox={`0 0 ${naturalSize.w} ${naturalSize.h}`} preserveAspectRatio="none">
          <polygon
            points={points.map((p) => `${p.x},${p.y}`).join(" ")}
            fill="rgba(124,58,237,0.15)"
            stroke="#7c3aed"
            strokeWidth={Math.max(2, naturalSize.w / 300)}
          />
        </svg>
      )}
      {points.map((p, i) => (
        <span
          key={i}
          className="pointer-events-none absolute flex size-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-violet-600 text-[10px] font-bold text-white shadow"
          style={pct(p)}
        >
          {i + 1}
        </span>
      ))}
    </div>
  );
}

function useNaturalSize(src: string | undefined) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    if (!src) return;
    const img = new Image();
    img.onload = () => setSize({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = src;
  }, [src]);
  return size;
}

/* --------------------------------------------------------------- corner editor */

function CornerEditor({ template, onClose, onSave }: {
  template: MockupTemplate;
  onClose: () => void;
  onSave: (quad: Point[], widthCm: number, heightCm: number) => Promise<void>;
}) {
  const loadCanvasImage = useCanvasImage();
  const natural = useNaturalSize(template.imageUrl);
  const [points, setPoints] = useState<Point[]>(template.quad || []);
  const def = DEFAULT_SURFACE_CM[template.gadget] || [10, 10];
  const [w, setW] = useState(String(template.widthCm ?? def[0]));
  const [h, setH] = useState(String(template.heightCm ?? def[1]));
  const [preview, setPreview] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const autoDetect = async () => {
    setWorking(true);
    try {
      const quad = largestGreenQuad(imageToData(await loadCanvasImage(template.imageUrl!)));
      if (!quad) throw new Error("No green area found in this photo");
      setPoints(quad);
      toast.info("Corners found — drag any that sit inside the real edge (a camera bar or logo can hide one)");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not read the photo");
    } finally {
      setWorking(false);
    }
  };

  const runPreview = async () => {
    if (points.length !== 4) return;
    setWorking(true);
    try {
      const data = imageToData(await loadCanvasImage(template.imageUrl!));
      const out = composite(data, { quad: points, widthCm: Number(w), heightCm: Number(h) }, TEST_CHECKER(), { pxPerCm: 20 });
      setPreview(canvasToWebp(dataToCanvas(out), 0.85));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Preview failed");
    } finally {
      setWorking(false);
    }
  };

  const valid = points.length === 4 && Number(w) > 0 && Number(h) > 0;

  return (
    <Dialog open onOpenChange={(o) => { if (!o && !working) onClose(); }}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{template.listing}: corners and size</DialogTitle>
          <DialogDescription>
            Click the four outer corners of the skinned surface in order — {LABELS.join(", ")} — where the real
            device edge is, even if a camera bar or logo covers that spot. Drag a point to move it. Then give the
            surface's real size and check the preview: every square is 1 cm, every fifth line orange.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <PointPicker src={template.imageUrl!} points={points} setPoints={(p) => { setPoints(p); setPreview(null); }} naturalSize={natural} />
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" disabled={working} onClick={() => void autoDetect()}>
                <WandSparklesIcon className="mr-1 size-3.5" /> Auto-detect
              </Button>
              <Button size="sm" variant="ghost" disabled={working} onClick={() => { setPoints([]); setPreview(null); }}>Clear</Button>
              <span className="self-center text-xs text-muted-foreground">
                {points.length < 4 ? `Next: ${LABELS[points.length]}` : "All four set"}
              </span>
            </div>
          </div>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Width (corner 1 → 2), cm</Label>
                <Input inputMode="decimal" value={w} onChange={(e) => { setW(e.target.value); setPreview(null); }} />
              </div>
              <div>
                <Label className="text-xs">Height (corner 1 → 4), cm</Label>
                <Input inputMode="decimal" value={h} onChange={(e) => { setH(e.target.value); setPreview(null); }} />
              </div>
            </div>
            <Button size="sm" variant="outline" disabled={!valid || working} onClick={() => void runPreview()}>
              <RulerIcon className="mr-1 size-3.5" /> Preview scale
            </Button>
            <div className="aspect-square overflow-hidden rounded-lg border bg-muted">
              {working ? (
                <div className="flex size-full items-center justify-center"><Loader2Icon className="size-5 animate-spin" /></div>
              ) : preview ? (
                <img src={preview} alt="Scale preview" className="size-full object-contain" />
              ) : (
                <div className="flex size-full items-center justify-center p-4 text-center text-xs text-muted-foreground">
                  The preview lays a 1 cm grid on the surface. Count the squares across: they should match the width.
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={working} onClick={onClose}>Cancel</Button>
          <Button disabled={!valid || working} onClick={() => void onSave(points, Number(w), Number(h))}>Save template</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------ roll calibration */

const ROLL_WIDTH_CM = 29.5;
const FLAT_PX_PER_CM = 40;

/**
 * The device's own piece of a calibrated roll, uploaded and ready to hand to
 * the image model in place of the whole roll photo. Returns null when the roll
 * has no calibration or the gadget's face has no measurement — then the whole
 * photo is sent, as before.
 */
export function useTruePiece() {
  const loadCanvasImage = useCanvasImage();
  const upload = useAction(api.r2.uploadToR2);
  return useCallback(async (
    design: { code: string; source?: string; flatImageUrl?: string; flatPxPerCm?: number },
    gadget: string,
    rotate90 = false
  ): Promise<{ url: string; widthCm: number; heightCm: number } | null> => {
    const surface = DEFAULT_SURFACE_CM[String(gadget || "").toLowerCase()];
    if (design.source === "cutout" || !design.flatImageUrl || !surface) return null;
    const flat = imageToData(await loadCanvasImage(design.flatImageUrl));
    const piece = truePiece(flat, {
      pxPerCm: design.flatPxPerCm || FLAT_PX_PER_CM,
      widthCm: surface[0],
      heightCm: surface[1],
      rotate90,
    });
    const key = `design-pieces/${design.code.toUpperCase().replace(/[^A-Z0-9-]/g, "")}-${String(gadget).toLowerCase()}${rotate90 ? "-wid" : ""}-${Date.now()}.webp`;
    const up: any = await upload({ fileBase64: canvasToWebp(dataToCanvas(piece), 0.92), key, contentType: "image/webp" });
    const url = up?.url || up?.publicUrl;
    return url ? { url, widthCm: surface[0], heightCm: surface[1] } : null;
  }, [loadCanvasImage, upload]);
}

export function RollCalibration({ roll, onClose, onSaved }: {
  roll: { _id: string; code: string; rawImageUrl?: string };
  onClose: () => void;
  onSaved: (fields: { flatImageUrl: string; flatPxPerCm: number; flatWidthCm: number; flatLengthCm: number }) => Promise<void>;
}) {
  const loadCanvasImage = useCanvasImage();
  const upload = useAction(api.r2.uploadToR2);
  const natural = useNaturalSize(roll.rawImageUrl);
  const [points, setPoints] = useState<Point[]>([]);
  const [width, setWidth] = useState(String(ROLL_WIDTH_CM));
  const [length, setLength] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const flat = useRef<ImageData | null>(null);

  // Rolls are photographed as they are stored: lying with the length running
  // left to right and the 29.5 cm width top to bottom. So the marked top edge
  // follows the length, and the side edge is the roll's width.
  //
  // The flattened design still comes out width-across, length-down, because
  // everything downstream — the template mockups, the true-size pieces — reads
  // it that way. Passing the corners round by one turns the picture upright.
  const marked = useMemo(() => {
    if (points.length !== 4) return null;
    const along = Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y);
    const across = Math.hypot(points[3].x - points[0].x, points[3].y - points[0].y);
    return across > 0 && along > 0 ? { along, across } : null;
  }, [points]);

  // What the shape says the marked length is: the photo is shot straight down,
  // so the rectangle's sides keep close to their real ratio.
  const guess = marked ? (marked.along / marked.across) * Number(width || ROLL_WIDTH_CM) : 0;

  useEffect(() => {
    if (!guess || length) return;
    setLength(guess.toFixed(1));
  }, [guess]);

  // A length that fights the shape stretches the pattern, and every mockup
  // made from it is then the wrong size. The usual cause is a photo standing
  // the other way round — the roll's length running down the picture — which
  // the shape gives away: it matches the two measurements swapped.
  const off = guess && Number(length) > 0 ? Number(length) / guess : 1;
  const upright =
    guess > 0 && Number(width) > 0 && Number(length) > 0 &&
    Math.abs(guess / (Number(width) * Number(width) / Number(length)) - 1) < 0.15;
  const lengthWarning = !(off > 1.25 || off < 0.8)
    ? ""
    : upright
      ? "This photo looks like it is standing upright — the roll's length running top to bottom. Turn it a quarter turn so the length runs left to right, then mark it again."
      : `The marked rectangle looks about ${guess.toFixed(0)} cm long, not ${length} cm. Either type the length of the rectangle you marked, or mark a longer stretch of the roll.`;

  const run = async () => {
    setWorking(true);
    try {
      const raw = imageToData(await loadCanvasImage(roll.rawImageUrl!));
      // bottom-left, top-left, top-right, bottom-right: the first edge is the
      // roll's width, which is the x axis of every flat design we store.
      const turned = [points[3], points[0], points[1], points[2]];
      flat.current = rectifyRoll(raw, turned, Number(width), Number(length), FLAT_PX_PER_CM);
      setPreview(canvasToWebp(dataToCanvas(flat.current), 0.8));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not flatten the photo");
    } finally {
      setWorking(false);
    }
  };

  const save = async () => {
    if (!flat.current) return;
    setWorking(true);
    try {
      const up: any = await upload({
        fileBase64: canvasToWebp(dataToCanvas(flat.current), 0.92),
        key: `design-flat/${roll.code.toUpperCase().replace(/[^A-Z0-9-]/g, "")}-${Date.now()}.webp`,
        contentType: "image/webp",
      });
      const url = up?.url || up?.publicUrl;
      if (!url) throw new Error("Upload failed");
      await onSaved({ flatImageUrl: url, flatPxPerCm: FLAT_PX_PER_CM, flatWidthCm: Number(width), flatLengthCm: Number(length) });
      toast.success(`${roll.code}: calibrated`);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setWorking(false);
    }
  };

  const valid = points.length === 4 && Number(width) > 0 && Number(length) > 0;

  return (
    <Dialog open onOpenChange={(o) => { if (!o && !working) onClose(); }}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Calibrate {roll.code}</DialogTitle>
          <DialogDescription>
            Photograph the roll as you store it: lying down, its length running left to right and its
            {" "}{ROLL_WIDTH_CM} cm width top to bottom. Mark a rectangle whose left and right edges run the
            roll's full width, edge to edge: click {LABELS.join(", ")}. Enter how long that stretch is —
            measure it along the roll. The photo is then flattened to true centimetres, which is what keeps
            mockups at the right scale.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            {roll.rawImageUrl && (
              <PointPicker src={roll.rawImageUrl} points={points} setPoints={(p) => { setPoints(p); setPreview(null); }} naturalSize={natural} />
            )}
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => { setPoints([]); setLength(""); setPreview(null); }}>Clear</Button>
              <span className="self-center text-xs text-muted-foreground">
                {points.length < 4 ? `Next: ${LABELS[points.length]}` : "All four set"}
              </span>
            </div>
          </div>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Length marked, cm</Label>
                <Input inputMode="decimal" value={length} placeholder="measure it" onChange={(e) => { setLength(e.target.value); setPreview(null); }} />
                <p className="mt-0.5 text-[10px] text-muted-foreground">left to right</p>
              </div>
              <div>
                <Label className="text-xs">Width (roll), cm</Label>
                <Input inputMode="decimal" value={width} onChange={(e) => { setWidth(e.target.value); setPreview(null); }} />
                <p className="mt-0.5 text-[10px] text-muted-foreground">top to bottom</p>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              The length is estimated from the shape; measure the real roll for accuracy — it sets the
              pattern's scale along the roll. The width is the same on almost every roll.
            </p>
            {lengthWarning && (
              <p className="rounded-md bg-amber-50 p-2 text-[11px] text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                {lengthWarning}
              </p>
            )}
            <Button size="sm" variant="outline" disabled={!valid || working} onClick={() => void run()}>
              <RulerIcon className="mr-1 size-3.5" /> Flatten
            </Button>
            <div className="rounded-lg border bg-muted p-2">
              {working ? (
                <div className="flex h-40 items-center justify-center"><Loader2Icon className="size-5 animate-spin" /></div>
              ) : preview ? (
                <>
                  {/* Shown whole, at the shape the entered centimetres make, with
                      a 5 cm bar: if the bar does not look like 5 cm of real
                      vinyl, the marked length is wrong and every mockup made
                      from it will be off. */}
                  <div className="relative mx-auto w-fit">
                    <img src={preview} alt="Flattened roll" className="max-h-[340px] w-auto rounded" />
                    <div className="absolute bottom-1.5 left-1.5 right-1.5">
                      <div className="h-1.5 rounded-sm bg-white/90 ring-1 ring-black/40" style={{ width: `${Math.min(100, (5 / Number(width || ROLL_WIDTH_CM)) * 100)}%` }} />
                      <span className="mt-0.5 block text-[10px] font-medium text-white drop-shadow">5 cm</span>
                    </div>
                  </div>
                  <p className="mt-1 text-center text-[11px] text-muted-foreground">
                    Flattened to {width} × {length} cm · {Math.round(Number(width) * FLAT_PX_PER_CM)} × {Math.round(Number(length) * FLAT_PX_PER_CM)} px
                  </p>
                </>
              ) : (
                <div className="flex h-40 items-center justify-center p-4 text-center text-xs text-muted-foreground">
                  The flattened design appears here. It should look straight-on, with the pattern square.
                </div>
              )}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={working} onClick={onClose}>Cancel</Button>
          <Button disabled={!preview || working} onClick={() => void save()}>Save calibration</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------- mockups from templates */

export interface TemplateDesign {
  code: string;
  name: string;
  source: "roll" | "cutout";
  rawImageUrl?: string;
  flatImageUrl?: string;
  flatPxPerCm?: number;
  flatWidthCm?: number;
  flatLengthCm?: number;
}

/**
 * Makes every templated listing's picture for one design and puts each in the
 * review queue as an ordinary job, so approve, reject and linking work as for
 * generated images.
 */
export function useTemplateMockups() {
  const { byListing } = useTemplates();
  const loadCanvasImage = useCanvasImage();
  const upload = useAction(api.r2.uploadToR2);
  const createJob = useMutation(api.aiMockups.createDesignMockup);

  const run = useCallback(async (
    design: TemplateDesign,
    groups: Array<{ listing: string; gadget: string; shots: MockupShot[] }>,
    orientations: Array<"lengthwise" | "widthwise">,
    existingJobs: Array<{ suffix: string; attempt?: number }>,
    onProgress?: (done: number, total: number) => void
  ) => {
    const usable = groups.filter((g) => byListing.get(g.listing.toLowerCase())?.status === "ready");
    if (!usable.length) throw new Error("No listing here has a ready template yet");
    const isRoll = design.source === "roll";
    if (isRoll && !design.flatImageUrl) throw new Error("Calibrate this roll first");
    const src = imageToData(await loadCanvasImage(isRoll ? design.flatImageUrl! : design.rawImageUrl!));
    const ppc = isRoll ? Number(design.flatPxPerCm) || FLAT_PX_PER_CM : 0;
    const rollW = isRoll ? Number(design.flatWidthCm) || src.width / ppc : 0;
    const rollL = isRoll ? Number(design.flatLengthCm) || src.height / ppc : 0;

    const tasks = usable.flatMap((g) =>
      (g.gadget === "phone" && isRoll ? orientations : (["lengthwise"] as const)).map((o) => ({ g, o }))
    );
    let done = 0;
    for (const { g, o } of tasks) {
      const t = byListing.get(g.listing.toLowerCase())!;
      const tpl = imageToData(await loadCanvasImage(t.imageUrl!));
      const rotate90 = o === "widthwise";
      const pieceW = rotate90 ? t.heightCm! : t.widthCm!;
      const pieceH = rotate90 ? t.widthCm! : t.heightCm!;
      // The middle of the photographed stretch, where the photo is sharpest.
      const offsetCm = isRoll
        ? { x: Math.max(0, (rollW - pieceW) / 2), y: Math.max(0, (rollL - pieceH) / 2) }
        : undefined;
      const out = composite(tpl, { quad: t.quad!, widthCm: t.widthCm!, heightCm: t.heightCm! }, src, { pxPerCm: ppc, rotate90, offsetCm });
      const suffix = `tpl-${listingSlug(g.listing)}${rotate90 ? "-wid" : ""}`;
      const attempt = existingJobs.filter((j) => j.suffix === suffix).reduce((n, j) => Math.max(n, j.attempt || 1), 0) + 1;
      const key = `ai-mockups-pending/${design.code.toUpperCase().replace(/[^A-Z0-9-]/g, "")}-${suffix}-${Date.now()}.webp`;
      const up: any = await upload({ fileBase64: canvasToWebp(dataToCanvas(out), 0.9), key, contentType: "image/webp" });
      const url = up?.url || up?.publicUrl;
      if (!url) throw new Error("Upload failed");
      await createJob({
        rNumber: design.code,
        designName: design.name || "",
        designSource: design.source,
        shotLabel: `Template · ${g.listing}${rotate90 ? " · across the roll" : ""}`,
        gadget: g.gadget,
        listing: g.listing,
        suffix,
        skuCodes: [...new Set(g.shots.flatMap((s) => shotCodes(s)))],
        variantTitles: [],
        matchSingleVariant: g.shots.some((s) => s.matchSingleVariant),
        sourceUrl: isRoll ? design.flatImageUrl : design.rawImageUrl,
        status: "review",
        pendingKey: up?.key || key,
        pendingUrl: url,
        attempt,
        modelLabel: "Template",
        aspect: "",
        credits: 0,
        costInr: 0,
        createdAt: Date.now(),
      });
      done++;
      onProgress?.(done, tasks.length);
    }
    return done;
  }, [byListing, loadCanvasImage, upload, createJob]);

  return { run, byListing };
}
