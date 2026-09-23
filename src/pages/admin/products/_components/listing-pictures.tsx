import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useQuery } from "@/lib/firebase-hooks";
import { api } from "@/lib/firebase-api";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { Link } from "react-router-dom";
import { ImageIcon, Loader2Icon, SparklesIcon, ExternalLinkIcon } from "lucide-react";
import {
  DEFAULT_BLOCKS, type CutOrientation, type MockupShot, type SharedBlocks,
} from "@/lib/ai-mockup-shots.ts";
import { IMAGE_MODELS, formatInr, resolveSize } from "@/lib/ai-mockup-models.ts";
import { useTemplates, templateForShot, usesTemplate, useTemplateMockups, templateRows } from "@/pages/admin/ai-mockups/templates.tsx";
import { useRunShot, type ShotDesign } from "@/pages/admin/ai-mockups/run-shot.ts";

interface Job {
  _id: string;
  suffix: string;
  status: string;
  url?: string;
  attempt?: number;
  shotLabel?: string;
}

/**
 * The pictures this one listing is meant to have, and a way to make the ones
 * it does not.
 *
 * A gap is noticed here — an Oppo charger with no port view, a Sony camera
 * missing its with-lens shot — while looking at the listing, not while looking
 * at the design it came from. Walking back to the studio, finding the design
 * among sixty and ticking one box was the long way round to a picture worth
 * ₹0.63. The angles are the same ones a launch would plan for this listing,
 * each made the way its card in the studio says, and they land in the same
 * review queue as everything else.
 */
/*
 * Every button here is type="button".
 *
 * This card sits inside the product edit page's <form>, and a <button> in a
 * form submits it unless told otherwise. So "Make pictures" saved the product
 * instead — and a product with no picture fails the save's own check, "Please
 * add at least one product image". The one listing this button exists for was
 * the one it could never help.
 */
export function ListingPictures({ product }: {
  product: {
    _id: string;
    title?: string;
    listingKind?: string;
    images?: Array<{ url?: string; listing?: string }>;
    variants?: Array<{ sku?: string }>;
  };
}) {
  const kind = String(product.listingKind || "").trim().toLowerCase();
  const rolls = useQuery(api.rollsManagement.getRollInventory) as any[] | undefined;
  const cutouts = useQuery(api.aiMockups.getCutouts) as any[] | undefined;
  const shots = useQuery(api.aiMockups.getPrompts) as MockupShot[] | undefined;
  const settings = useQuery(api.aiMockups.getSettings) as { blocks?: SharedBlocks } | null | undefined;
  const templateIndex = useTemplates();
  const templateMockups = useTemplateMockups();

  const cheapest = [...IMAGE_MODELS].sort((a, b) => a.usd - b.usd)[0];
  const [modelId, setModelId] = useState(cheapest.id);
  const [cut, setCut] = useState<CutOrientation>("lengthwise");
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState<{ done: number; total: number } | null>(null);
  const model = IMAGE_MODELS.find((m) => m.id === modelId) || cheapest;

  /** The design this listing was cut from, found by the longest SKU prefix that names one. */
  const design = useMemo<ShotDesign | null>(() => {
    if (!rolls || !cutouts) return null;
    const all: ShotDesign[] = [
      ...rolls.map((r) => ({
        _id: r._id, code: String(r.rNumber || "").trim(), name: r.designName || "", source: "roll" as const,
        finish: r.finish, rawImageUrl: r.rawImageUrl, flatImageUrl: r.flatImageUrl,
        flatPxPerCm: r.flatPxPerCm, flatWidthCm: r.flatWidthCm, flatLengthCm: r.flatLengthCm,
      })),
      ...cutouts.map((c) => ({
        _id: c._id, code: String(c.cutoutNumber || "").trim(), name: c.designName || "",
        source: "cutout" as const, finish: c.finish, rawImageUrl: c.rawImageUrl,
      })),
    ].filter((d) => d.code);
    const byCode = new Map(all.map((d) => [d.code.toUpperCase(), d]));
    for (const v of product.variants || []) {
      const parts = String(v.sku || "").split("-");
      for (let k = parts.length; k >= 1; k--) {
        const hit = byCode.get(parts.slice(0, k).join("-").toUpperCase());
        if (hit) return hit;
      }
    }
    return null;
  }, [rolls, cutouts, product.variants]);

  const jobRows = useQuery(
    api.aiMockups.getJobs,
    design ? { rNumber: design.code } : "skip"
  ) as Job[] | undefined;
  // Stable between renders, or every memo below recomputes on each one.
  const jobs = useMemo(() => jobRows || [], [jobRows]);

  const rows = useMemo(
    () => templateRows(shots || [], false).filter((r) => r.listing.toLowerCase() === kind),
    [shots, kind]
  );

  /** Angles that belong here, each with what it already has. */
  const angles = useMemo(() => {
    const onProduct = new Set((product.images || []).map((i) => i?.url).filter(Boolean) as string[]);
    return rows.map((row) => {
      const t = templateForShot(templateIndex, row.listing, row.shot.suffix, row.isFirstShot);
      const fromTemplate = usesTemplate(t);
      // A picture is "here" only when it is actually on this product; approved
      // and sitting on a different listing is somebody else's picture.
      const mine = jobs.filter((j) =>
        j.suffix === row.shot.suffix ||
        j.suffix === `${row.shot.suffix}-len` ||
        j.suffix === `${row.shot.suffix}-wid` ||
        j.suffix === `tpl-${row.shot.suffix}`
      );
      const live = mine.some((j) => j.status === "approved" && j.url && onProduct.has(j.url));
      const waiting = mine.some((j) => ["review", "running", "queued"].includes(j.status));
      return { row, fromTemplate, state: live ? "live" : waiting ? "waiting" : "missing" as const };
    });
  }, [rows, jobs, product.images, templateIndex]);

  const missing = angles.filter((a) => a.state === "missing");
  const aiPicked = angles.filter((a) => picked.includes(a.row.shot.suffix) && !a.fromTemplate).length;
  const needsCut = angles.some((a) => picked.includes(a.row.shot.suffix) && a.row.shot.askCutOrientation);

  const runShot = useRunShot(design || { _id: "", code: "", source: "roll" }, jobs, {
    ...DEFAULT_BLOCKS, ...(settings?.blocks || {}),
  });

  const generate = async () => {
    if (!design) return toast.error("This listing's SKUs do not name a design in the roll or cutout list");
    const chosen = angles.filter((a) => picked.includes(a.row.shot.suffix));
    if (!chosen.length) return;
    const blocks: SharedBlocks = { ...DEFAULT_BLOCKS, ...(settings?.blocks || {}) };
    setBusy({ done: 0, total: chosen.length });
    let made = 0;
    try {
      const viaTemplate = chosen.filter((a) => a.fromTemplate).map((a) => a.row);
      if (viaTemplate.length) {
        made += await templateMockups.run(design as any, viaTemplate, [cut], jobs);
        setBusy({ done: made, total: chosen.length });
      }
      for (const a of chosen.filter((x) => !x.fromTemplate)) {
        const ok = await runShot(
          a.row.shot, model, resolveSize(model, "1:1"),
          a.row.shot.askCutOrientation && design.source === "roll" ? cut : undefined
        );
        if (ok) made++;
        setBusy({ done: made, total: chosen.length });
      }
      setPicked([]);
      toast.success(made
        ? `${made} picture${made === 1 ? "" : "s"} on the way — approve ${made === 1 ? "it" : "them"} in AI Mockup Studio`
        : "Nothing was made");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not make the pictures");
    } finally {
      setBusy(null);
    }
  };

  // Below every hook: a listing with no angles of its own has nothing to
  // show, but React counts the hooks before it cares what is rendered.
  if (!kind || (shots && !rows.length)) return null;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2">
          <ImageIcon className="size-4" />
          Pictures for this listing
        </CardTitle>
        {design && (
          <Button asChild size="sm" variant="ghost" className="h-7 text-xs">
            <Link to={`/backend-skinly/ai-mockups?design=${encodeURIComponent(design.code)}`}>
              {design.code} in the studio <ExternalLinkIcon className="ml-1 size-3" />
            </Link>
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {!design ? (
          <p className="text-sm text-muted-foreground">
            No roll or cutout matches this listing's SKUs, so there is nothing to make a picture from.
          </p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              The {angles.length} angle{angles.length === 1 ? "" : "s"} a launch plans for this listing.
              {missing.length
                ? ` ${missing.length} ${missing.length === 1 ? "is" : "are"} missing.`
                : " All of them are on the listing."}
            </p>
            <div className="space-y-1.5">
              {angles.map(({ row, fromTemplate, state }) => (
                <label
                  key={row.shot.suffix}
                  className={`flex items-center gap-2.5 rounded-lg border p-2 text-sm ${
                    state === "missing" ? "cursor-pointer hover:bg-muted/50" : "opacity-70"
                  }`}
                >
                  <Checkbox
                    checked={picked.includes(row.shot.suffix)}
                    disabled={!!busy}
                    onCheckedChange={(v) => setPicked((p) =>
                      v ? [...p, row.shot.suffix] : p.filter((x) => x !== row.shot.suffix))}
                  />
                  <span className="min-w-0 flex-1 truncate">{row.shot.label}</span>
                  <Badge variant="outline" className="shrink-0 text-[10px]">
                    {fromTemplate ? "Template · ₹0" : `AI · ${formatInr(model.usd)}`}
                  </Badge>
                  {state === "live" ? (
                    <Badge className="shrink-0 bg-emerald-600 text-[10px]">on the listing</Badge>
                  ) : state === "waiting" ? (
                    <Badge className="shrink-0 bg-amber-500 text-[10px]">in review</Badge>
                  ) : (
                    <Badge variant="outline" className="shrink-0 text-[10px] text-muted-foreground">missing</Badge>
                  )}
                </label>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button type="button"
                size="sm"
                disabled={!picked.length || !!busy}
                onClick={() => void generate()}
              >
                {busy ? <Loader2Icon className="mr-1.5 size-3.5 animate-spin" /> : <SparklesIcon className="mr-1.5 size-3.5" />}
                {busy
                  ? `Making ${busy.done}/${busy.total}`
                  : `Make ${picked.length || ""} ${picked.length === 1 ? "picture" : "pictures"}${aiPicked ? ` · ${formatInr(model.usd * aiPicked)}` : picked.length ? " · ₹0" : ""}`}
              </Button>
              {missing.length > 0 && !busy && (
                <Button type="button" size="sm" variant="ghost" className="h-8 text-xs"
                  onClick={() => setPicked(missing.map((a) => a.row.shot.suffix))}>
                  Pick the {missing.length} missing
                </Button>
              )}
              {aiPicked > 0 && (
                <div className="flex items-center gap-1.5">
                  <Label className="text-xs">Model</Label>
                  <Select value={modelId} onValueChange={setModelId}>
                    <SelectTrigger className="h-8 w-[210px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {IMAGE_MODELS.map((m) => <SelectItem key={m.id} value={m.id}>{m.label} · {formatInr(m.usd)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {needsCut && design.source === "roll" && (
                <div className="flex items-center gap-1.5">
                  <Label className="text-xs">Phone cut</Label>
                  <Select value={cut} onValueChange={(v) => setCut(v as CutOrientation)}>
                    <SelectTrigger className="h-8 w-[140px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="lengthwise">Lengthwise</SelectItem>
                      <SelectItem value="widthwise">Widthwise</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Each angle is made the way its card in AI Mockup Studio → Templates is set. Finished pictures
              wait for approval in the studio, as they do after a launch.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
