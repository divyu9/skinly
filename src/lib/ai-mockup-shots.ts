/**
 * Helpers for the AI mockup studio's shot definitions.
 *
 * Shots live in Firestore (`gadgetMockupPrompts`), not here — the catalogue
 * grows (drones, GoPro, action cameras…) and each gadget wants however many
 * angles it wants, so nothing about the list can be fixed at build time. What
 * lives here is the starter pack offered on an empty database, and the text
 * expansion every prompt goes through on its way to the model.
 */

export interface MockupShot {
  _id: string;
  label: string;
  /** gadgetTypes doc id, so shots follow the product taxonomy. */
  gadgetTypeId?: string;
  /** Denormalised gadget name — used in filenames and grouping. */
  gadget: string;
  /** Filename tail: R-01-<suffix>.webp */
  suffix: string;
  /**
   * Variant SKU tails this shot is the picture for.
   *
   * A variant SKU is `<design code>-<view code>`: R-29-LP is "Only Top" and
   * R-29-LPK is "Top + Keyboard Area", both on the same laptop product. On
   * approval the image is linked to the products behind these codes. Matching
   * ignores case, because the catalogue holds both IPAD and iPAD.
   */
  skuCodes: string[];
  prompt: string;
  order: number;
  isActive: boolean;
}

/**
 * Text shared by every prompt, kept in one editable place.
 *
 * The fidelity block is the load-bearing one: it is what stops the model
 * inventing a pattern that merely resembles the printed roll. Duplicating it
 * into every shot would mean 40 edits to change it and one forgotten shot
 * quietly shipping a wrong design, so prompts reference it instead.
 */
export interface SharedBlocks {
  fidelity: string;
  staging: string;
}

export const DEFAULT_BLOCKS: SharedBlocks = {
  fidelity:
    "The supplied reference image is a photograph of the printed vinyl design. " +
    "Reproduce that exact artwork on the skin: same colours, same motifs, same scale and spacing. " +
    "Do not invent, restyle, recolour or substitute the pattern. " +
    "Ignore the lighting, glare, shadows, background, curl and perspective of the reference photo — " +
    "extract only the flat artwork from it and apply it cleanly to the device.",
  staging:
    "Photorealistic commercial product photograph. Soft, even studio lighting, gentle contact shadow, " +
    "clean uncluttered light neutral background. Sharp focus, true-to-life colour, no text, no watermark, " +
    "no logos other than those naturally on the device, no people, no hands.",
};

/** Placeholders a prompt may use. Unknown ones are left alone, not blanked. */
export function expandPrompt(
  prompt: string,
  blocks: SharedBlocks,
  vars: { rNumber?: string; designName?: string } = {}
): string {
  const table: Record<string, string> = {
    fidelity: blocks.fidelity,
    staging: blocks.staging,
    rNumber: vars.rNumber ?? "",
    designName: vars.designName ?? "",
  };
  return prompt.replace(/\{\{\s*(\w+)\s*\}\}/g, (whole, name: string) =>
    name in table ? table[name] : whole
  );
}

export const PLACEHOLDERS = ["fidelity", "staging", "rNumber", "designName"];

/** R-01 + laptop-top -> R-01-laptop-top. Kept ASCII-safe for use as an R2 key. */
export function mockupFileStem(rNumber: string, suffix: string, attempt = 1): string {
  const roll = rNumber.trim().toUpperCase().replace(/[^A-Z0-9-]/g, "");
  const tail = suffix.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "");
  const base = `${roll}-${tail || "shot"}`;
  return attempt > 1 ? `${base}-v${attempt}` : base;
}

/** Offered on an empty database. Once seeded these are ordinary editable rows. */
export const STARTER_SHOTS: Omit<MockupShot, "_id">[] = [
  {
    label: "Lid only",
    gadget: "laptop",
    suffix: "laptop-top",
    skuCodes: ["LP", "LPT", "LAP"],
    order: 0,
    isActive: true,
    prompt:
      "A closed modern 14-inch laptop photographed straight down from directly above, lid facing the camera and filling most of the frame. " +
      "The entire lid is covered edge to edge with a vinyl skin. {{fidelity}} " +
      "The skin follows the lid's rounded corners and stops cleanly at the edges. {{staging}}",
  },
  {
    label: "Open — lid + keyboard deck",
    gadget: "laptop",
    suffix: "laptop-open",
    skuCodes: ["LPK"],
    order: 1,
    isActive: true,
    prompt:
      "A modern 14-inch laptop open at roughly 110 degrees, shot from a three-quarter front angle so both the outer lid and the keyboard deck are visible. " +
      "A vinyl skin covers the outer lid and a matching skin covers the palm rest area around the keyboard. {{fidelity}} " +
      "Keys and trackpad stay uncovered and clearly visible. The screen is off and dark. {{staging}}",
  },
  {
    label: "Sony telephoto",
    gadget: "lens",
    suffix: "lens",
    skuCodes: ["LENS", "LS"],
    order: 0,
    isActive: true,
    prompt:
      "A Sony full-frame camera lens standing upright, photographed from the front three-quarter angle. " +
      "A vinyl skin is wrapped around the cylindrical barrel of the lens. {{fidelity}} " +
      "The artwork curves realistically around the barrel with correct perspective and shading. " +
      "The front glass element, focus ring markings and mount stay uncovered. {{staging}}",
  },
  {
    label: "Sony A7 IV body",
    gadget: "camera",
    suffix: "camera",
    skuCodes: ["CAM", "CAO"],
    order: 0,
    isActive: true,
    prompt:
      "A Sony A7 IV mirrorless camera body without a lens attached, photographed from a front three-quarter angle. " +
      "A vinyl skin covers the front and top plate of the camera body. {{fidelity}} " +
      "The artwork wraps around the grip with correct curvature. " +
      "The lens mount, buttons, dials, viewfinder and screen stay uncovered. {{staging}}",
  },
  {
    label: "PlayStation 5",
    gadget: "console",
    suffix: "ps5",
    skuCodes: ["PS5"],
    order: 0,
    isActive: true,
    prompt:
      "A PlayStation 5 console standing vertically, photographed from a front three-quarter angle. " +
      "Vinyl skins cover both outer side panels. {{fidelity}} " +
      "The artwork follows the curved contour of the panels. " +
      "The central black body, disc slot and ports stay uncovered. {{staging}}",
  },
  {
    label: "iPad — back",
    gadget: "tablet",
    suffix: "ipad",
    skuCodes: ["IPAD", "TAB"],
    order: 0,
    isActive: true,
    prompt:
      "An 11-inch tablet lying face down, photographed straight down from directly above so the whole back panel fills the frame. " +
      "A vinyl skin covers the back edge to edge. {{fidelity}} " +
      "The skin follows the rounded corners, with a clean cutout around the rear camera module. {{staging}}",
  },
  {
    label: "Apple 20W USB-C",
    gadget: "charger",
    suffix: "charger",
    skuCodes: ["CH"],
    order: 0,
    isActive: true,
    prompt:
      "A small square white 20W USB-C power adapter standing upright, photographed from a front three-quarter angle, filling most of the frame. " +
      "A vinyl skin covers the front and side faces of the adapter. {{fidelity}} " +
      "The artwork bends around the adapter's rounded edges. " +
      "The USB-C port and the folding prongs stay uncovered. {{staging}}",
  },
];
