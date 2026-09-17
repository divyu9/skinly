import {
  STARTER_SHOTS, LISTING_PRESETS, LISTING_SCOPES, FLAT_GADGETS, PHASE_1_LISTINGS, REFERENCE_PREAMBLE, TRUE_SIZE_CLAUSE,
  DEFAULT_SURFACE_CM,
  expandPrompt, listingOf, listingSlug, mockupFileStem, shotCodes,
  type MockupShot, type SharedBlocks, type CutOrientation, type PresetVariant,
} from "@/lib/ai-mockup-shots.ts";
import { resolveSize, USD_TO_INR, type ImageModel } from "@/lib/ai-mockup-models.ts";

/**
 * Works out everything a design launch will do, before anything is done.
 *
 * For one design (a roll or a cutout) it reads the listings that already use
 * the design's code and decides, listing by listing:
 *
 * - studio listings (they carry a listingKind) stay, with any variants their
 *   preset now has added or renamed — prices the admin set are kept;
 * - listings from before the studio are converted in place into the brand
 *   listing their gadget maps to (a phone listing becomes "Android Phone",
 *   an Xbox listing "Xbox Series X"): variants renamed and repriced to the
 *   preset, the words, tags and theme collections rewritten, the URL kept —
 *   so reviews, orders and whatever search engines know stay attached;
 * - a second old listing of the same kind, or one whose kind already has a
 *   studio listing, is retired and redirected to that listing;
 * - every listing kind in scope that still has none is created;
 * - pictures are planned for them: from a template where one is ready (free,
 *   true to scale), otherwise from the image model, skipping any picture this
 *   design already has.
 *
 * The plan is written to designLaunches/{id} and carried out by
 * functions/src/launch.ts, so nothing depends on this page staying open.
 */

export interface LaunchDesign {
  _id: string;
  code: string;
  name: string;
  source: "roll" | "cutout";
  finish?: string;
  rawImageUrl?: string;
  flatImageUrl?: string;
  flatPxPerCm?: number;
  flatWidthCm?: number;
  flatLengthCm?: number;
  usableFor?: string[];
}

export interface LaunchOptions {
  phaseOnly: boolean;
  publishNow: boolean;
  images: boolean;
  useTemplates: boolean;
  regenerateImages: boolean;
  /** Rewrite the title, description and SEO of listings the studio already made. */
  rewriteCopy?: boolean;
  model: ImageModel;
  aspect: string;
  orientations: CutOrientation[];
}

export interface ExistingVariant {
  id: string;
  sku: string;
  title: string;
  price: number;
  materialMultiplier: number;
  inventoryQuantity: number;
}

export interface ExistingListing {
  id: string;
  title: string;
  slug: string;
  status: string;
  gadget: string;
  listingKind: string;
  /** The listing's current pictures, to tell a picture it has from one sitting elsewhere. */
  imageUrls?: string[];
  variants: ExistingVariant[];
}

export type PlanStep = Record<string, any> & { id: string; type: string; label: string; status: "pending" };

export interface LaunchPlan {
  steps: PlanStep[];
  summary: { create: number; revise: number; retire: number; aiImages: number; templateImages: number; costInr: number };
  warnings: string[];
}

/** Proper-cased listing names and their gadget, from the built-in shots. */
const KIND_INFO = (() => {
  const m = new Map<string, { listing: string; gadget: string }>();
  for (const s of STARTER_SHOTS) {
    const listing = listingOf(s);
    const key = listing.toLowerCase();
    if (LISTING_PRESETS[key] && !m.has(key)) m.set(key, { listing, gadget: s.gadget });
  }
  return m;
})();

const is3d = (finish?: string) => /3d|emboss|textur/i.test(finish || "");
const isTranzy = (finish?: string) => /tranz|transparent|membrane/i.test(finish || "");

/** The preset a design gets for a listing kind, after its finish's rules. */
function presetForDesign(kind: string, finish?: string): PresetVariant[] {
  const preset = LISTING_PRESETS[kind] || [];
  // A Tranzy skin is lid-only film: no keyboard view.
  if (isTranzy(finish) && preset.some((p) => /LPK$/.test(p.tail))) return preset.filter((p) => !/LPK$/.test(p.tail));
  return preset;
}

const priceOf = (p: PresetVariant, finish?: string) => (p.price3d && is3d(finish) ? p.price3d : p.price);

/** Which brand listing an old one-size listing becomes. */
function legacyKind(l: ExistingListing): string | null {
  const title = l.title.toLowerCase();
  const tails = l.variants.map((v) => v.sku.toUpperCase());
  switch (l.gadget) {
    case "phone": return "android phone";
    case "laptop": return "laptop";
    case "tablet": return "tablet";
    case "charger": return "charger";
    case "lens": return "camera lens";
    case "gimbals": return "gimbal";
    case "camera": return "sony camera";
    case "mac-mini": return "mac mini";
    case "drone": return "dji drone";
    case "controller": return "playstation controller";
    case "console":
      if (/series\s*s\b/.test(title)) return "xbox series s";
      if (/series\s*x\b/.test(title)) return "xbox series x";
      if (tails.some((s) => /-(XBXS|XBS|XBOXS)/.test(s))) return "xbox series s";
      if (tails.some((s) => /-XBX/.test(s))) return "xbox series x";
      return "ps5";
    default:
      return null;
  }
}

/** Which preset row an existing variant is, or null when it belongs elsewhere. */
function presetIndex(kind: string, preset: PresetVariant[], v: ExistingVariant, code: string): number | null {
  const tail = v.sku.toUpperCase().slice(code.length + 1).split("-")[0];
  const exact = preset.findIndex((p) => p.tail === tail);
  if (exact >= 0) return exact;
  const t = v.title.toLowerCase();
  const at = (i: number) => (i < preset.length ? i : 0);
  if (preset.some((p) => /LPK$/.test(p.tail))) return at(/key\s*b?oa?r?d/.test(t) ? 1 : 0);
  if (/galaxy tab|ipad|xiaomi pad|^tablet$/.test(kind)) return at(/bezel|front|charger/.test(t) ? 1 : 0);
  if (/camera$/.test(kind)) return at(/with lens/.test(t) || /CAML|CALS/.test(tail) ? 1 : 0);
  if (kind === "dji drone") return at(/\brc\b|controller/.test(t) || /DRC|DROC/.test(tail) ? 1 : 0);
  if (kind === "dji drone controller") return at(/display/.test(t) && !/without|no display/.test(t) ? 1 : 0);
  if (kind === "xbox series x" || kind === "xbox series s" || kind === "ps5" || kind === "nintendo switch") {
    return at(/2\s*controller|\+\s*2/.test(t) ? 2 : /1\s*controller|\+\s*1/.test(t) ? 1 : 0);
  }
  if (kind === "playstation controller") {
    if (/station\s*5|ps\s*5|dualsense/.test(t)) return 0;
    if (/station\s*4|ps\s*4|dualshock/.test(t)) return 2;
    if (/station\s*3|ps\s*3/.test(t)) return 3;
    return null;
  }
  if (kind === "xbox controller") return /xbox/.test(t) || /^(CLX|CLS|CLO|CXO|CON)$/.test(tail) ? at(/one/.test(t) ? 1 : 0) : null;
  return 0;
}

interface OpsResult {
  ops: any[];
  /** Kinds a deleted variant's customers are moved to. */
  needsKinds: string[];
}

function variantOps(kind: string, finish: string | undefined, code: string, variants: ExistingVariant[], keepPrices: boolean): OpsResult {
  const preset = presetForDesign(kind, finish);
  const skuOf = (p: PresetVariant) => `${code}-${p.tail}`.toUpperCase();
  const slots = new Map<number, ExistingVariant[]>();
  const ops: any[] = [];
  const needsKinds: string[] = [];
  for (const v of variants) {
    const idx = presetIndex(kind, preset, v, code);
    if (idx === null) {
      // An Xbox controller variant on the PlayStation listing: its customers
      // go to the Xbox controller listing, which the launch makes.
      const xbox = presetForDesign("xbox controller", finish);
      const target = /one/i.test(v.title) ? xbox[1] : xbox[0];
      ops.push({ op: "delete", id: v.id, moveToSku: target ? `${code}-${target.tail}` : undefined });
      needsKinds.push("xbox controller");
      continue;
    }
    slots.set(idx, [...(slots.get(idx) || []), v]);
  }
  preset.forEach((p, i) => {
    const list = (slots.get(i) || []).sort((a, b) => b.inventoryQuantity - a.inventoryQuantity);
    const [keep, ...extra] = list;
    const price = priceOf(p, finish);
    if (!keep) {
      ops.push({ op: "create", sku: skuOf(p), title: p.title, price, materialMultiplier: p.materialMultiplier });
      return;
    }
    const changed =
      keep.sku.toUpperCase() !== skuOf(p) ||
      keep.title !== p.title ||
      keep.materialMultiplier !== p.materialMultiplier ||
      (!keepPrices && keep.price !== price);
    if (changed) {
      ops.push({
        op: "update",
        id: keep.id,
        sku: skuOf(p),
        title: p.title,
        materialMultiplier: p.materialMultiplier,
        ...(keepPrices && keep.price > 0 ? {} : { price }),
      });
    }
    for (const x of extra) ops.push({ op: "delete", id: x.id, moveToSku: skuOf(p) });
  });
  // Variants in rows beyond this finish's preset (a Tranzy keyboard view).
  for (const [i, list] of slots) {
    if (i < preset.length) continue;
    for (const x of list) ops.push({ op: "delete", id: x.id, moveToSku: preset[0] ? skuOf(preset[0]) : undefined });
  }
  return { ops, needsKinds };
}

let seq = 0;
const stepId = () => `s${Date.now().toString(36)}${(seq++).toString(36)}`;

export function buildLaunchPlan(input: {
  design: LaunchDesign;
  existing: ExistingListing[];
  shots: MockupShot[];
  blocks: SharedBlocks;
  readyTemplates: Map<string, { _id: string }>;
  gadgetTypeIds: Record<string, string>;
  jobs: Array<{ suffix: string; status: string; attempt?: number; url?: string }>;
  options: LaunchOptions;
}): LaunchPlan {
  const { design, existing, shots, blocks, readyTemplates, gadgetTypeIds, jobs, options } = input;
  const code = design.code.toUpperCase();
  const warnings: string[] = [];
  const creates: PlanStep[] = [];
  const revises: PlanStep[] = [];
  const retires: PlanStep[] = [];
  const covered = new Set<string>();
  /** The listing that stays for each kind, when one already exists. */
  const keptFor = new Map<string, ExistingListing>();
  const needed = new Set<string>();

  const inScope = (kind: string) => {
    const info = KIND_INFO.get(kind);
    if (!info) return false;
    if (design.usableFor?.length && !design.usableFor.includes(info.gadget)) return false;
    return !options.phaseOnly || PHASE_1_LISTINGS.has(kind);
  };
  const scopeFields = (kind: string) => {
    const s = LISTING_SCOPES[kind] || {};
    return { modelBrands: s.modelBrands || [], modelBrandsExclude: s.modelBrandsExclude || [] };
  };
  const proper = (kind: string) => KIND_INFO.get(kind)?.listing || kind;

  // Studio listings: keep, topping up their variants.
  const live = existing.filter((l) => l.status !== "archived");
  for (const l of live.filter((x) => x.listingKind)) {
    const kind = l.listingKind.toLowerCase();
    // A kind the presets no longer name (an early "Controller") is handled
    // below with the pre-studio listings.
    if (!LISTING_PRESETS[kind]) continue;
    if (covered.has(kind)) {
      retires.push({ id: stepId(), type: "retire", label: `Retire duplicate ${l.title}`, status: "pending", productId: l.id, redirectKind: proper(kind) });
      continue;
    }
    covered.add(kind);
    keptFor.set(kind, l);
    const { ops, needsKinds } = variantOps(kind, design.finish, code, l.variants, true);
    needsKinds.forEach((k) => needed.add(k));
    if (ops.length || options.rewriteCopy) {
      revises.push({
        id: stepId(), type: "revise",
        label: ops.length ? `Update variants of ${proper(kind)}` : `Rewrite the words of ${proper(kind)}`,
        status: "pending",
        listing: proper(kind), productId: l.id, variantOps: ops, rewriteCopy: !!options.rewriteCopy, ...scopeFields(kind),
      });
    }
  }

  // Listings from before the studio: convert one per kind, retire the rest.
  const legacy = live.filter((x) => !x.listingKind || !LISTING_PRESETS[x.listingKind.toLowerCase()]);
  const byKind = new Map<string, ExistingListing[]>();
  for (const l of legacy) {
    const kind = legacyKind(l);
    if (!kind || !LISTING_PRESETS[kind]) {
      warnings.push(`"${l.title}" (${l.gadget || "no gadget"}) has no listing kind to become — left as it is`);
      continue;
    }
    byKind.set(kind, [...(byKind.get(kind) || []), l]);
  }
  for (const [kind, list] of byKind) {
    list.sort((a, b) =>
      Number(b.status === "active") - Number(a.status === "active") ||
      b.variants.reduce((n, v) => n + v.inventoryQuantity, 0) - a.variants.reduce((n, v) => n + v.inventoryQuantity, 0)
    );
    const [primary, ...rest] = list;
    if (!covered.has(kind)) {
      covered.add(kind);
      keptFor.set(kind, primary);
      const { ops, needsKinds } = variantOps(kind, design.finish, code, primary.variants, false);
      needsKinds.forEach((k) => needed.add(k));
      revises.push({
        id: stepId(), type: "revise", label: `Convert "${primary.title}" into ${proper(kind)}`, status: "pending",
        listing: proper(kind), productId: primary.id, variantOps: ops, rewriteCopy: true, ...scopeFields(kind),
      });
    } else {
      rest.unshift(primary);
    }
    for (const l of rest) {
      retires.push({ id: stepId(), type: "retire", label: `Retire "${l.title}" → ${proper(kind)}`, status: "pending", productId: l.id, redirectKind: proper(kind) });
    }
  }

  // Missing kinds.
  const kinds = [...KIND_INFO.keys()].filter((k) => (inScope(k) || needed.has(k)) && !covered.has(k));
  for (const kind of kinds) {
    const info = KIND_INFO.get(kind)!;
    const preset = presetForDesign(kind, design.finish);
    if (!preset.length) continue;
    covered.add(kind);
    creates.push({
      id: stepId(), type: "create", label: `Create ${info.listing}`, status: "pending", listing: info.listing,
      spec: {
        gadget: info.gadget,
        gadgetTypeId: gadgetTypeIds[info.gadget] || "",
        listing: info.listing,
        publishNow: options.publishNow,
        ...scopeFields(kind),
        variants: preset.map((p) => ({ skuTail: p.tail, title: p.title, price: priceOf(p, design.finish), materialMultiplier: p.materialMultiplier })),
      },
    });
  }

  // Pictures, for the kinds this launch leaves in place and in scope.
  const images: PlanStep[] = [];
  let aiImages = 0, templateImages = 0, costInr = 0;
  const attemptFor = (suffix: string) =>
    jobs.filter((j) => j.suffix === suffix).reduce((n, j) => Math.max(n, j.attempt || 1), 0) + 1;
  // A picture counts as made when one is on its way, or when an approved one
  // is on this kind's listing. An approved picture sitting on another listing
  // (the old iPad shot on the generic Tablet listing) does not count, or the
  // listing it belongs to never gets one.
  const already = (suffix: string, kind: string) => {
    if (options.regenerateImages) return false;
    const onListing = new Set(keptFor.get(kind)?.imageUrls || []);
    return jobs.some((j) =>
      j.suffix === suffix &&
      (["review", "running", "queued"].includes(j.status) || (j.status === "approved" && !!j.url && onListing.has(j.url)))
    );
  };
  const isRoll = design.source === "roll";
  if (!design.rawImageUrl) warnings.push("No raw design photo yet — pictures cannot be made");

  if (options.images && design.rawImageUrl) {
    // Pictures go to the listings of this phase, and to any older listing
    // that is already live — an out-of-phase listing that was converted
    // (Charger) still needs its photo. A draft listing outside the phase,
    // made ahead of its turn, waits: nobody can see it yet.
    for (const kind of covered) {
      if (!inScope(kind) && keptFor.get(kind)?.status !== "active") continue;
      const info = KIND_INFO.get(kind)!;
      const kindShots = shots.filter((s) => s.isActive !== false && listingOf(s).toLowerCase() === kind);
      const template = readyTemplates.get(kind);
      const canTemplate = options.useTemplates && FLAT_GADGETS.has(info.gadget) && template && (!isRoll || design.flatImageUrl);
      const codes = [...new Set([...kindShots.flatMap((s) => shotCodes(s)), ...presetForDesign(kind, design.finish).map((p) => p.tail)])];
      if (canTemplate) {
        const orients: CutOrientation[] = info.gadget === "phone" && isRoll ? options.orientations : ["lengthwise"];
        for (const o of orients) {
          const suffix = `tpl-${listingSlug(info.listing)}${o === "widthwise" ? "-wid" : ""}`;
          if (already(suffix, kind)) continue;
          templateImages++;
          images.push({
            id: stepId(), type: "template", label: `Template picture · ${info.listing}${o === "widthwise" ? " · across" : ""}`, status: "pending",
            templateId: template!._id, rotate90: o === "widthwise",
            job: {
              rNumber: code, designName: design.name || "", designSource: design.source,
              shotLabel: `Template · ${info.listing}${o === "widthwise" ? " · across the roll" : ""}`,
              gadget: info.gadget, listing: info.listing, suffix, skuCodes: codes, variantTitles: [],
              matchSingleVariant: kindShots.some((s) => s.matchSingleVariant) || presetForDesign(kind, design.finish).length === 1,
              sourceUrl: isRoll ? design.flatImageUrl : design.rawImageUrl,
              attempt: attemptFor(suffix), modelLabel: "Template", aspect: "", credits: 0, costInr: 0,
            },
          });
        }
        continue;
      }
      if (!kindShots.length) {
        warnings.push(`${info.listing}: no shots in the studio yet (Gadgets & prompts → add the built-in shots) — no picture planned`);
        continue;
      }
      // A calibrated roll sends the model the device's own piece at true size,
      // so the motifs come out as big as they really are — for every gadget
      // whose face is measured, not only the flat ones a template can cover.
      const surface = isRoll && design.flatImageUrl ? DEFAULT_SURFACE_CM[info.gadget] : undefined;
      for (const shot of kindShots) {
        const orients: Array<CutOrientation | undefined> = shot.askCutOrientation && isRoll ? options.orientations : [undefined];
        for (const o of orients) {
          const suffix = o ? `${shot.suffix}-${o === "widthwise" ? "wid" : "len"}` : shot.suffix;
          if (already(suffix, kind)) continue;
          const crop = surface ? { widthCm: surface[0], heightCm: surface[1], rotate90: o === "widthwise" } : undefined;
          const promptSent = (shot.referenceUrl ? REFERENCE_PREAMBLE : "")
            + (crop ? TRUE_SIZE_CLAUSE(crop.widthCm, crop.heightCm) : "")
            + expandPrompt(shot.prompt, blocks, {
            rNumber: code, designName: design.name, source: design.source, finish: design.finish,
            // The piece is already turned; saying so again would turn it twice.
            cutOrientation: crop ? undefined : o,
          });
          const size = resolveSize(options.model, options.aspect);
          const cost = Number((options.model.usd * USD_TO_INR).toFixed(2));
          aiImages++;
          costInr += cost;
          images.push({
            id: stepId(), type: "image", label: `Picture · ${shot.label}${o ? ` · ${o === "widthwise" ? "across" : "along"}` : ""}`, status: "pending",
            request: {
              model: options.model.apiModel, prompt: promptSent, size,
              ...(options.model.resolution ? { resolution: options.model.resolution } : {}),
              ...(options.model.quality ? { quality: options.model.quality } : {}),
              imageUrls: shot.referenceUrl ? [design.rawImageUrl, shot.referenceUrl] : [design.rawImageUrl],
            },
            ...(crop ? { crop } : {}),
            job: {
              rNumber: code, designName: design.name || "", designSource: design.source, shotId: shot._id,
              shotLabel: o ? `${shot.label} · ${o === "widthwise" ? "across" : "along"} the roll` : shot.label,
              gadget: shot.gadget, listing: info.listing, suffix, skuCodes: shotCodes(shot),
              variantTitles: shot.variantTitles || [], matchSingleVariant: shot.matchSingleVariant || false,
              sourceUrl: design.rawImageUrl, attempt: attemptFor(suffix), modelLabel: options.model.label,
              pieceCm: crop ? `${crop.widthCm}×${crop.heightCm}` : "",
              aspect: size, credits: options.model.credits, costInr: cost, promptSent, referenceUrl: shot.referenceUrl || "",
            },
          });
        }
      }
    }
  }
  if (isRoll && options.useTemplates && !design.flatImageUrl) {
    warnings.push("Roll not calibrated — phone, laptop and tablet pictures fall back to the image model");
  }

  // Revisions free the SKUs new listings need (an old "R-26-IPAD" tablet
  // variant becomes R-26-TABB before the Apple iPad listing claims IPAD), so
  // they run first — except those whose deleted variants hand their waiting
  // customers to a listing this launch has yet to create.
  const ownSkus = (step: PlanStep) => new Set(step.variantOps.filter((o: any) => o.op !== "delete").map((o: any) => String(o.sku).toUpperCase()));
  const dependsOnNew = (step: PlanStep) => {
    const own = ownSkus(step);
    return step.variantOps.some((o: any) => o.op === "delete" && o.moveToSku && !own.has(String(o.moveToSku).toUpperCase()));
  };
  const steps: PlanStep[] = [
    ...revises.filter((r) => !dependsOnNew(r)),
    ...creates,
    ...revises.filter(dependsOnNew),
    ...retires,
    { id: stepId(), type: "sync", label: "Recount stock", status: "pending" },
    { id: stepId(), type: "rebuild", label: "Rebuild the storefront", status: "pending" },
    ...images,
  ];
  return {
    steps,
    summary: { create: creates.length, revise: revises.length, retire: retires.length, aiImages, templateImages, costInr: Number(costInr.toFixed(2)) },
    warnings,
  };
}

/** A file stem shown in previews, matching the studio's naming. */
export const previewStem = (code: string, suffix: string) => mockupFileStem(code, suffix);
