/**
 * Image models the mockup studio can bill against, cheapest first.
 *
 * Every entry points at an *edit* variant. The text-to-image variants ignore
 * `image_urls`, which would mean generating a plausible-looking pattern instead
 * of the one printed on the roll — the exact failure this whole tool exists to
 * avoid. If a text-to-image id ever gets added here, the reference photo is
 * silently thrown away.
 *
 * Prices are PoYo's published per-generation rates. INR is derived rather than
 * stored so there is one number to update when the rate moves.
 */

/** USD→INR used for the cost hints. 95.13 on 9 Sep 2026; round number on purpose. */
export const USD_TO_INR = 95;

export interface ImageModel {
  /** Stable key we store on jobs. */
  id: string;
  label: string;
  /** Sent to PoYo as `model`. */
  apiModel: string;
  credits: number;
  usd: number;
  /** `size` values this model accepts. */
  sizes: string[];
  /** Extra input fields some families require. */
  resolution?: string;
  quality?: string;
  note?: string;
}

const RATIOS = ["1:1", "2:3", "3:2", "3:4", "4:3", "9:16", "16:9", "21:9"];

export const IMAGE_MODELS: ImageModel[] = [
  {
    id: "gpt-image-2-medium-1k",
    label: "GPT Image 2.5 — medium, 1K",
    apiModel: "gpt-image-2-edit",
    credits: 2.95,
    usd: 0.015,
    sizes: RATIOS,
    quality: "medium",
    resolution: "1K",
    note: "Cheapest. Good first pass while you tune a prompt.",
  },
  {
    id: "gpt-4o-image",
    label: "GPT-4o Image",
    apiModel: "gpt-4o-image-edit",
    credits: 4,
    usd: 0.02,
    // This family is fussy: only these three ratios are accepted.
    sizes: ["1:1", "2:3", "3:2"],
  },
  {
    id: "nano-banana",
    label: "Nano Banana",
    apiModel: "nano-banana-edit",
    credits: 5,
    usd: 0.025,
    sizes: RATIOS,
  },
  {
    id: "seedream-4-5",
    label: "Seedream 4.5",
    apiModel: "seedream-4.5-edit",
    credits: 5,
    usd: 0.025,
    sizes: RATIOS,
    note: "Strong at holding a reference pattern.",
  },
  {
    id: "seedream-5-0-lite",
    label: "Seedream 5.0 Lite",
    apiModel: "seedream-5.0-lite-edit",
    credits: 5,
    usd: 0.025,
    sizes: RATIOS,
  },
  {
    id: "gpt-image-2-medium-2k",
    label: "GPT Image 2.5 — medium, 2K",
    apiModel: "gpt-image-2-edit",
    credits: 5.99,
    usd: 0.03,
    sizes: RATIOS,
    quality: "medium",
    resolution: "2K",
  },
  {
    id: "nano-banana-pro-1k",
    label: "Nano Banana Pro — 1K/2K",
    apiModel: "nano-banana-pro-edit",
    credits: 8,
    usd: 0.04,
    sizes: RATIOS,
    resolution: "1K",
    note: "Dearest, and usually the most faithful. Worth it for the final run.",
  },
];

export const MODEL_BY_ID = Object.fromEntries(IMAGE_MODELS.map((m) => [m.id, m]));
export const DEFAULT_MODEL_ID = "seedream-4-5";

export function inr(usd: number): number {
  return usd * USD_TO_INR;
}

/** "₹2.38" — two decimals, because the whole point is comparing small numbers. */
export function formatInr(usd: number): string {
  return `₹${inr(usd).toFixed(2)}`;
}

const ratioOf = (s: string): number | null => {
  const m = /^(\d+):(\d+)$/.exec(s);
  return m ? Number(m[1]) / Number(m[2]) : null;
};

/**
 * Nearest size the model will actually accept.
 *
 * Shots pick the ratio that suits the device — 4:3 for a laptop lid, 3:4 for an
 * iPad back — but GPT-4o Image only takes three ratios. Rather than fail the
 * generation, fall back to the closest one it does take.
 */
export function resolveSize(model: ImageModel, wanted: string): string {
  if (model.sizes.includes(wanted)) return wanted;
  const target = ratioOf(wanted);
  if (target == null) return model.sizes[0];
  let best = model.sizes[0];
  let bestGap = Infinity;
  for (const candidate of model.sizes) {
    const r = ratioOf(candidate);
    if (r == null) continue;
    const gap = Math.abs(Math.log(r / target));
    if (gap < bestGap) {
      bestGap = gap;
      best = candidate;
    }
  }
  return best;
}
