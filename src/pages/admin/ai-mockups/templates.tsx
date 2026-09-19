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
import { CameraIcon, CheckIcon, CrosshairIcon, ImageIcon, Loader2Icon, RulerIcon, SparklesIcon, UploadIcon, WandSparklesIcon } from "lucide-react";
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
  /** The shot this template is the photo for. Missing on the first ones made. */
  suffix?: string;
  /** The real product photo this template was painted green from, if any. */
  sourcePhotoUrl?: string;
  /**
   * Which way this one angle's picture is made. Unset means the template when
   * it is ready, which is what everyone wants most of the time; "model" keeps
   * the image model on an angle a flat warp does not suit — a lens barrel, a
   * frame with two objects in it — even though its template is ready.
   */
  route?: "template" | "model";
  /**
   * Another angle's shot suffix, whose photo, corners and size this angle
   * borrows. Several brands ship the same adapter, so their charger angles are
   * the same photograph — made once, marked once, used by all of them.
   */
  sameAs?: string;
  shotLabel?: string;
  imageUrl?: string;
  quad?: Point[];
  widthCm?: number;
  heightCm?: number;
  status?: "generating" | "needs-corners" | "ready" | "failed";
  taskId?: string;
  error?: string;
  updatedAt?: number;
}

/*
 * One template per shot, not per listing.
 *
 * A listing is several pictures: a laptop's lid and its keyboard deck, a PS5
 * standing and a PS5 with its controllers, a camera with and without its lens.
 * Templates began as one photo per listing, which made only the first of those
 * — and because a listing with a ready template skipped the image model
 * entirely, turning a template on took the other angles away. Each shot now
 * carries its own template photo, corners and size, and any shot without one
 * still goes to the image model as before.
 *
 * The first templates were saved under the listing alone. Those still serve
 * the listing's first shot, so the corners already marked are not lost; saving
 * that card again writes it under the shot.
 */
export const templateId = (listing: string, suffix: string) => `template-${listingSlug(listing)}--${suffix}`;
export const legacyTemplateId = (listing: string) => `template-${listingSlug(listing)}`;

export interface TemplateIndex {
  bySuffix: Map<string, MockupTemplate>;
  byListing: Map<string, MockupTemplate>;
}

/**
 * The template for one shot, falling back to the listing's own for its first
 * shot, and following a link to another angle where one is set.
 *
 * The link is one hop on purpose: A may borrow B's photo, but B may not
 * itself be borrowing, so there is no chain to walk and no cycle to guard.
 * What comes back is the lender's document — its id is what the renderer
 * loads — carrying this angle's own route, which stays its own.
 */
export function templateForShot(index: TemplateIndex, listing: string, suffix: string, isFirstShot: boolean) {
  const own = index.bySuffix.get(suffix) || (isFirstShot ? index.byListing.get(String(listing).toLowerCase()) : undefined);
  if (!own?.sameAs) return own;
  const lent = index.bySuffix.get(own.sameAs);
  if (!lent || lent.sameAs) return own;
  return { ...lent, route: own.route ?? lent.route, sameAs: own.sameAs };
}

/** Angles whose template another angle may borrow: made here, not borrowed. */
export function lendableTemplates(index: TemplateIndex, rows: TemplateRow[], not: string) {
  return rows
    .filter((r) => r.shot.suffix !== not)
    .map((r) => ({ row: r, t: index.bySuffix.get(r.shot.suffix) }))
    .filter((x): x is { row: TemplateRow; t: MockupTemplate } => !!x.t?.imageUrl && !x.t.sameAs);
}

/** Will this angle's picture come from its template? Ready, and not sent to the model. */
export const usesTemplate = (t?: MockupTemplate) => t?.status === "ready" && t.route !== "model";

export interface TemplateRow {
  listing: string;
  gadget: string;
  shot: MockupShot;
  /** The listing's first shot, the one a listing-level template stands in for. */
  isFirstShot: boolean;
}

/**
 * Every shot a template could be made for, grouped listing by listing and in a
 * fixed order. The order matters twice: the first shot is the one an older
 * listing-level template belongs to, and a row is generated from its own shot,
 * so taking them in whatever order the shot library returned could put a phone
 * photo on the laptop's template.
 */
export function templateRows(shots: MockupShot[], phaseOnly: boolean): TemplateRow[] {
  const byListing = new Map<string, { listing: string; gadget: string; shots: MockupShot[] }>();
  for (const s of shots) {
    if (!TEMPLATE_GADGETS.has(s.gadget) || s.isActive === false) continue;
    const listing = listingOf(s);
    if (!presetFor(listing)) continue;
    if (phaseOnly && !isPhase1(listing)) continue;
    const k = listing.toLowerCase();
    const row = byListing.get(k) || { listing, gadget: s.gadget, shots: [] };
    row.shots.push(s);
    byListing.set(k, row);
  }
  const out: TemplateRow[] = [];
  for (const row of [...byListing.values()].sort((a, b) => a.gadget.localeCompare(b.gadget) || a.listing.localeCompare(b.listing))) {
    row.shots.sort((a, b) => (a.order ?? 99) - (b.order ?? 99) || String(a.label).localeCompare(String(b.label)));
    row.shots.forEach((shot, i) => out.push({ listing: row.listing, gadget: row.gadget, shot, isFirstShot: i === 0 }));
  }
  return out;
}

/**
 * The job suffix for a template picture. The listing's first shot keeps the
 * suffix template pictures have always had, so reruns recognise the picture
 * they already made instead of making a second one beside it.
 */
export const templateJobSuffix = (row: TemplateRow, rotate90: boolean) =>
  `tpl-${row.isFirstShot ? listingSlug(row.listing) : row.shot.suffix}${rotate90 ? "-wid" : ""}`;

export function useTemplates(): TemplateIndex & { templates: MockupTemplate[] | undefined } {
  const rows = useQuery(api.aiMockups.getTemplates) as MockupTemplate[] | undefined;
  const index = useMemo<TemplateIndex>(() => {
    const bySuffix = new Map<string, MockupTemplate>();
    const byListing = new Map<string, MockupTemplate>();
    for (const t of rows || []) {
      if (t.suffix) bySuffix.set(String(t.suffix), t);
      else byListing.set(String(t.listing).toLowerCase(), t);
    }
    return { bySuffix, byListing };
  }, [rows]);
  return { templates: rows, ...index };
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

/**
 * Turns a real product photo into a template.
 *
 * Generating the device from nothing but a prompt is where templates went
 * wrong: the model drew chargers with the port on the front, a Mac mini with
 * its ports down one side, a laptop that was a phone. A photograph settles all
 * of that — the object, the angle, the framing and the lighting are already
 * right — so the model is asked to change one thing only: paint the skinned
 * surfaces flat chroma green and leave everything else exactly as it is.
 */
const GREEN_FROM_PHOTO =
  "The supplied image is a photograph of a real product. Reproduce that photograph exactly: the same "
  + "object, the same model, the same angle, the same framing and crop, the same background and the same "
  + "lighting and shadows. Do not restyle it, do not move the camera, do not redraw the product and do "
  + "not change its proportions, its markings or where its openings are. "
  + "Change one thing only: every surface a vinyl skin would cover is repainted chroma-key green. Its own "
  + "colour, print, pattern, texture and lettering are gone — the hue underneath is now pure green, "
  + "#00FF00 — but everything the light was doing to that surface is untouched. "
  + "This is the same photograph with the paint changed, not a flat green shape pasted over the product. "
  + "Keep the whole range of it: the lit side stays bright and the shaded side stays dark, the gradient "
  + "that runs across a curve stays exactly where it was, the darkening as a surface turns away from the "
  + "camera stays, the ambient occlusion in every corner and seam stays, and every glossy highlight, "
  + "specular streak and soft reflection stays where it is and as bright as it is — a highlight that was "
  + "nearly white stays nearly white. A dull surface stays dull and a glossy one stays glossy. The green "
  + "should read as a lit, three-dimensional object; if any part of it comes out as one even fill of "
  + "colour, the lighting has been lost and the picture is wrong. "
  + "A raised camera bump, plateau or island is part of the skinned body, not an exception: the green "
  + "carries on without a break up over its top face and down its sides, so it reads as part of the "
  + "skinned back rather than a bare tile sitting on it. The same goes for every panel, rail and rounded "
  + "edge of the body — if a skin would cover it, it is green. "
  + "What stays exactly as the photograph shows it, in its original colour and material, is only what a "
  + "skin is cut around: the round glass of each camera lens and the flash and sensor holes beside them, "
  + "ports, sockets and connectors, metal pins and plugs, buttons, switches and dials, the screen, rubber "
  + "grips, speaker grilles, vents, hinges, and any brand logo that is knocked out of the skin. Those "
  + "openings are small and follow their own outlines — a lens is a circle the size of its glass, not a "
  + "rectangle around the whole camera. Nothing else in the picture is green: not the background, not the "
  + "surface it stands on, not any prop. ";

const GREEN_FIDELITY =
  "The skin's own colour is chroma-key green — pure #00FF00 — with no pattern, no print, no texture and no "
  + "lettering of its own. Use the supplied reference only for that colour. Its lighting, though, is a real "
  + "surface's: the lit side bright and the shaded side dark, the gradient running across every curve, the "
  + "darkening where a surface turns away, the occlusion in every corner and seam, and the glossy highlights "
  + "and soft reflections a vinyl wrap catches. The green must read as a lit, three-dimensional object, never "
  + "as one even fill of colour. Nothing else in the picture is green: no plants, no green props, no green "
  + "light. ";

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
  const { templates, ...index } = useTemplates();
  const saveTemplate = useMutation(api.aiMockups.saveTemplate);
  const submit = useAction(api.poyo.poyoSubmit);
  const status = useAction(api.poyo.poyoStatus);
  const upload = useAction(api.r2.uploadToR2);
  const updateShot = useMutation(api.aiMockups.updateMockupPrompt);
  const [phaseOnly, setPhaseOnly] = useState(true);
  const cheapest = [...IMAGE_MODELS].sort((a, b) => a.usd - b.usd)[0];
  const [modelId, setModelId] = useState(cheapest.id);
  const [editing, setEditing] = useState<TemplateRow | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadFor = useRef<{ row: TemplateRow; greenIt: boolean } | null>(null);
  const greenUrl = useRef<string | null>(null);
  const polling = useRef(new Set<string>());

  // One row per shot of a templatable listing — one angle, one template.
  const rows = useMemo<TemplateRow[]>(() => templateRows(shots, phaseOnly), [shots, phaseOnly]);

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
              /*
               * The greened photo is the best reference the image model can
               * have for this angle: the same pose and framing as the real
               * product, and the green draws exactly which surfaces the skin
               * covers. It replaces the raw photo set when the upload
               * started — only for an angle whose template came from a photo,
               * never for one the model invented, which would be a reference
               * to a guess.
               */
              if (t.sourcePhotoUrl && t.suffix) {
                const shot = (shots || []).find((x) => x.suffix === t.suffix);
                if (shot?._id) await updateShot({ promptId: shot._id, referenceUrl: url });
              }
              toast.success(`${t.shotLabel || t.listing}: template ready — mark its corners`);
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
  }, [templates, status, upload, saveTemplate, updateShot, shots]);

  const model = IMAGE_MODELS.find((m) => m.id === modelId) || cheapest;

  const rowKey = (row: TemplateRow) => row.shot.suffix;

  const generate = async (row: TemplateRow) => {
    setBusy(rowKey(row));
    try {
      if (!greenUrl.current) {
        const up: any = await upload({ fileBase64: greenSwatch(), key: "mockup-templates/green-reference.png", contentType: "image/png" });
        greenUrl.current = up?.url || up?.publicUrl;
        if (!greenUrl.current) throw new Error("Could not upload the green reference");
      }
      const res: any = await submit({
        model: model.apiModel,
        size: resolveSize(model, "1:1"),
        resolution: model.resolution,
        quality: model.quality,
        prompt: expandPrompt(row.shot.prompt, { ...DEFAULT_BLOCKS, ...blocks, fidelity: GREEN_FIDELITY }, { source: "roll", finish: "" }),
        imageUrls: [greenUrl.current],
      });
      await saveTemplate({
        id: templateId(row.listing, row.shot.suffix),
        kind: "template",
        listing: row.listing,
        gadget: row.gadget,
        suffix: row.shot.suffix,
        shotLabel: row.shot.label,
        status: "generating",
        taskId: res.taskId,
        error: "",
      });
      toast.success(`${row.shot.label}: generating (${formatInr(model.usd)})`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start");
    } finally {
      setBusy(null);
    }
  };

  const onUpload = async (file: File) => {
    const picked = uploadFor.current;
    if (!picked) return;
    const { row: target, greenIt } = picked;
    setBusy(rowKey(target));
    try {
      const dataUrl = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(String(r.result));
        r.onerror = rej;
        r.readAsDataURL(file);
      });
      const up: any = await upload({
        fileBase64: dataUrl,
        key: `mockup-templates/${greenIt ? "source/" : ""}${listingSlug(target.listing)}-${target.shot.suffix}-${Date.now()}.webp`,
        contentType: file.type || "image/jpeg",
      });
      const url = up?.url || up?.publicUrl;
      if (!url) throw new Error("Upload failed");
      const common = {
        id: templateId(target.listing, target.shot.suffix), kind: "template" as const,
        listing: target.listing, gadget: target.gadget, suffix: target.shot.suffix, shotLabel: target.shot.label,
        error: "",
      };
      if (greenIt) {
        // The photo is the product; the model only paints the skin green.
        const res: any = await submit({
          model: model.apiModel,
          size: resolveSize(model, "1:1"),
          resolution: model.resolution,
          quality: model.quality,
          prompt: GREEN_FROM_PHOTO,
          imageUrls: [url],
        });
        await saveTemplate({ ...common, status: "generating", taskId: res.taskId, sourcePhotoUrl: url, quad: null });
        /*
         * The same photograph is what the image model needs too. As this
         * angle's reference it fixes the pose, the framing and where the
         * ports and pins are — which is exactly what the model was getting
         * wrong on chargers — so one upload serves both routes and the two
         * agree with each other.
         */
        if (target.shot._id) {
          await updateShot({ promptId: target.shot._id, referenceUrl: url });
        }
        toast.success(`${target.shot.label}: painting the skin green (${formatInr(model.usd)}) · also set as the AI reference`);
        return;
      }
      await saveTemplate({ ...common, imageUrl: url, status: "needs-corners", quad: null });
      // A hand-greened photo is as good a reference as one we greened.
      if (target.shot._id) await updateShot({ promptId: target.shot._id, referenceUrl: url });
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

  const ready = rows.filter((r) => usesTemplate(templateForShot(index, r.listing, r.shot.suffix, r.isFirstShot))).length;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3 p-4">
          <div>
            <h3 className="font-semibold">Template mockups</h3>
            <p className="text-sm text-muted-foreground">
              One photo per angle with the skin in flat green — a laptop's lid and its keyboard deck are two.
              Once an angle's corners and real size are set, every design becomes that picture at no cost and
              at true scale; any angle without a template still goes to the image model. Best route first:
              <strong> From a photo</strong> takes a normal photo of the real device and paints only its
              skinned surfaces green, so the ports, pins and proportions are the real ones.
              <strong> Upload green</strong> is for a photo you have already greened, and
              <strong> Generate</strong> lets the model invent the device. Mark only the flat face — a
              phone's side wrap and rounded edges fill themselves in.
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
            <Badge variant="outline">{ready} of {rows.length} ready</Badge>
          </div>
        </CardContent>
      </Card>

      <input ref={fileRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void onUpload(f); }} />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((row) => {
          const t = templateForShot(index, row.listing, row.shot.suffix, row.isFirstShot);
          const isBusy = busy === rowKey(row) || t?.status === "generating";
          const borrowedFrom = index.bySuffix.get(row.shot.suffix)?.sameAs || "";
          const lendable = lendableTemplates(index, rows, row.shot.suffix);
          return (
            <Card key={row.shot.suffix}>
              <CardContent className="space-y-2 p-3">
                <div className="relative aspect-square overflow-hidden rounded-lg bg-muted">
                  {t?.imageUrl ? (
                    <img src={t.imageUrl} alt={`${row.shot.label} template`} className="size-full object-cover" />
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
                  {/* The angle this template is for, so a photo of the wrong
                      device is read off the card instead of spotted later in a
                      listing. */}
                  <p className="truncate text-[11px] text-muted-foreground/80" title={row.shot.label}>
                    {row.shot.label}
                  </p>
                  {t?.status === "failed" && <p className="text-[11px] text-rose-600">{t.error}</p>}
                </div>

                {/* Which way this one angle goes. A template is free and exact
                    on a flat face; the image model is the better answer where
                    a flat warp cannot follow the shape, or where the frame
                    holds two objects and one set of corners cannot cover
                    both. Picked per angle, so a launch is right everywhere. */}
                <div>
                  <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Make this picture with
                  </p>
                  <div className="flex gap-1 rounded-lg bg-muted p-1 text-[11px]">
                    {([["template", "Template · ₹0"], ["model", `AI · ${formatInr(model.usd)}`]] as const).map(([value, label]) => {
                      const chosen = (usesTemplate(t) ? "template" : "model") === value;
                      const canTemplate = t?.status === "ready";
                      const off = isBusy || (value === "template" && !canTemplate);
                      return (
                        <button
                          key={value}
                          type="button"
                          aria-pressed={chosen}
                          disabled={off}
                          title={value === "template" && !canTemplate ? "Make this angle's template first" : undefined}
                          onClick={async () => {
                            try {
                              await saveTemplate({
                                id: templateId(row.listing, row.shot.suffix), kind: "template",
                                listing: row.listing, gadget: row.gadget,
                                suffix: row.shot.suffix, shotLabel: row.shot.label, route: value,
                                // An older listing-level template comes across
                                // with the choice; without this, saving a route
                                // on a listing's first angle would create an
                                // empty per-shot document that shadows it and
                                // the photo and corners would read as missing.
                                ...(t && !t.suffix
                                  ? { imageUrl: t.imageUrl, quad: t.quad, widthCm: t.widthCm, heightCm: t.heightCm, status: t.status }
                                  : {}),
                              });
                            } catch (e) {
                              toast.error(e instanceof Error ? e.message : "Could not save");
                            }
                          }}
                          className={`flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-1.5 font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
                            chosen
                              ? value === "template"
                                ? "bg-emerald-600 text-white shadow-sm"
                                : "bg-violet-600 text-white shadow-sm"
                              : "text-muted-foreground hover:bg-background/70 hover:text-foreground"
                          }`}
                        >
                          {chosen && <CheckIcon className="size-3" />}
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                {/* Several brands ship the same adapter, so their angles are
                    the same photograph. Borrowing one costs nothing to make
                    and nothing to mark, and the pictures stay in step. */}
                <div className="flex items-center gap-1.5">
                  <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Photo</span>
                  <select
                    className="h-7 min-w-0 flex-1 rounded-md border bg-background px-1.5 text-[11px]"
                    value={borrowedFrom || ""}
                    disabled={isBusy}
                    onChange={async (e) => {
                      const from = e.target.value;
                      try {
                        await saveTemplate({
                          id: templateId(row.listing, row.shot.suffix), kind: "template",
                          listing: row.listing, gadget: row.gadget,
                          suffix: row.shot.suffix, shotLabel: row.shot.label, sameAs: from,
                        });
                        toast.success(from ? "Linked — it uses that angle's photo" : "Unlinked — it has its own photo again");
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : "Could not save");
                      }
                    }}
                  >
                    <option value="">Its own</option>
                    {lendable.map(({ row: r }) => (
                      <option key={r.shot.suffix} value={r.shot.suffix}>Same as {r.shot.label}</option>
                    ))}
                  </select>
                </div>

                <div className={`flex flex-wrap gap-1.5 ${borrowedFrom ? "hidden" : ""}`}>
                  {/* Three ways to a template, in the order they are worth
                      trying: a photo of the real thing beats anything the
                      model invents, and inventing it is the last resort. */}
                  <Button
                    size="sm" variant="outline" className="h-7 text-xs" disabled={isBusy}
                    title="Upload a normal photo of the real device. The model paints the skinned surfaces green and leaves the ports, pins, lenses and logo alone."
                    onClick={() => { uploadFor.current = { row, greenIt: true }; fileRef.current?.click(); }}
                  >
                    <CameraIcon className="mr-1 size-3" />
                    From a photo
                  </Button>
                  <Button
                    size="sm" variant="outline" className="h-7 text-xs" disabled={isBusy}
                    title="Upload a photo whose skin area is already flat green."
                    onClick={() => { uploadFor.current = { row, greenIt: false }; fileRef.current?.click(); }}
                  >
                    <UploadIcon className="mr-1 size-3" />
                    Upload green
                  </Button>
                  <Button
                    size="sm" variant="outline" className="h-7 text-xs" disabled={isBusy}
                    title="Let the model invent the device from the shot's prompt."
                    onClick={() => void generate(row)}
                  >
                    <SparklesIcon className="mr-1 size-3" />
                    {t?.imageUrl ? "Regenerate" : "Generate"}
                  </Button>
                  {t?.imageUrl && !borrowedFrom && (
                    <Button size="sm" className="h-7 text-xs" disabled={isBusy} onClick={() => setEditing(row)}>
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

      {editing && templateForShot(index, editing.listing, editing.shot.suffix, editing.isFirstShot)?.imageUrl && (
        <CornerEditor
          template={templateForShot(index, editing.listing, editing.shot.suffix, editing.isFirstShot)!}
          onClose={() => setEditing(null)}
          onSave={async (quad, widthCm, heightCm) => {
            // Saving moves an older listing-level template onto its shot, so
            // the photo and the corners already marked carry over.
            const from = templateForShot(index, editing.listing, editing.shot.suffix, editing.isFirstShot)!;
            await saveTemplate({
              id: templateId(editing.listing, editing.shot.suffix),
              kind: "template", listing: editing.listing, gadget: editing.gadget,
              suffix: editing.shot.suffix, shotLabel: editing.shot.label,
              imageUrl: from.imageUrl, quad, widthCm, heightCm, status: "ready", error: "",
            });
            toast.success(`${editing.shot.label}: template ready`);
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
 * Makes a picture for every angle that has a ready template and puts each in
 * the review queue as an ordinary job, so approve, reject and linking work as
 * they do for generated images. Angles without a template are left alone —
 * the image model still makes those.
 */
export function useTemplateMockups() {
  const { templates, ...index } = useTemplates();
  const loadCanvasImage = useCanvasImage();
  const upload = useAction(api.r2.uploadToR2);
  const createJob = useMutation(api.aiMockups.createDesignMockup);

  const run = useCallback(async (
    design: TemplateDesign,
    rows: TemplateRow[],
    orientations: Array<"lengthwise" | "widthwise">,
    existingJobs: Array<{ suffix: string; attempt?: number }>,
    onProgress?: (done: number, total: number) => void
  ) => {
    const usable = rows
      .map((row) => ({ row, t: templateForShot(index, row.listing, row.shot.suffix, row.isFirstShot) }))
      .filter((x): x is { row: TemplateRow; t: MockupTemplate } => usesTemplate(x.t));
    if (!usable.length) throw new Error("No angle here is set to use a template");
    const isRoll = design.source === "roll";
    if (isRoll && !design.flatImageUrl) throw new Error("Calibrate this roll first");
    const src = imageToData(await loadCanvasImage(isRoll ? design.flatImageUrl! : design.rawImageUrl!));
    const ppc = isRoll ? Number(design.flatPxPerCm) || FLAT_PX_PER_CM : 0;
    const rollW = isRoll ? Number(design.flatWidthCm) || src.width / ppc : 0;
    const rollL = isRoll ? Number(design.flatLengthCm) || src.height / ppc : 0;

    const tasks = usable.flatMap(({ row, t }) =>
      (row.gadget === "phone" && isRoll ? orientations : (["lengthwise"] as const)).map((o) => ({ row, t, o }))
    );
    let done = 0;
    for (const { row, t, o } of tasks) {
      const tpl = imageToData(await loadCanvasImage(t.imageUrl!));
      const rotate90 = o === "widthwise";
      const pieceW = rotate90 ? t.heightCm! : t.widthCm!;
      const pieceH = rotate90 ? t.widthCm! : t.heightCm!;
      // The middle of the photographed stretch, where the photo is sharpest.
      const offsetCm = isRoll
        ? { x: Math.max(0, (rollW - pieceW) / 2), y: Math.max(0, (rollL - pieceH) / 2) }
        : undefined;
      const out = composite(tpl, { quad: t.quad!, widthCm: t.widthCm!, heightCm: t.heightCm! }, src, { pxPerCm: ppc, rotate90, offsetCm });
      const suffix = templateJobSuffix(row, rotate90);
      const attempt = existingJobs.filter((j) => j.suffix === suffix).reduce((n, j) => Math.max(n, j.attempt || 1), 0) + 1;
      const key = `ai-mockups-pending/${design.code.toUpperCase().replace(/[^A-Z0-9-]/g, "")}-${suffix}-${Date.now()}.webp`;
      const up: any = await upload({ fileBase64: canvasToWebp(dataToCanvas(out), 0.9), key, contentType: "image/webp" });
      const url = up?.url || up?.publicUrl;
      if (!url) throw new Error("Upload failed");
      await createJob({
        rNumber: design.code,
        designName: design.name || "",
        designSource: design.source,
        shotLabel: `Template · ${row.shot.label}${rotate90 ? " · across the roll" : ""}`,
        gadget: row.gadget,
        listing: row.listing,
        suffix,
        skuCodes: shotCodes(row.shot),
        variantTitles: row.shot.variantTitles || [],
        matchSingleVariant: row.shot.matchSingleVariant || false,
        sourceUrl: isRoll ? design.flatImageUrl : design.rawImageUrl,
        status: "review",
        pendingKey: up?.key || key,
        pendingUrl: url,
        attempt,
        modelLabel: "Template",
        // A template's scale is exact by construction — the surface's real
        // size is what the corners were measured against. Without this the
        // review card said "scale is the model's guess", which is the one
        // thing a template picture is not.
        pieceCm: `${t.widthCm}×${t.heightCm}`,
        aspect: "",
        credits: 0,
        costInr: 0,
        createdAt: Date.now(),
      });
      done++;
      onProgress?.(done, tasks.length);
    }
    return done;
  }, [index, loadCanvasImage, upload, createJob]);

  return { run, templates, ...index };
}
