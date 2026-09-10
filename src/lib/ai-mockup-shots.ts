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
    "Photorealistic commercial product photograph shot on a full-frame camera with an 85mm lens. The "
      + "device is the single obvious subject and fills roughly 70 percent of the frame; everything else "
      + "is context and stays small, dim and out of focus. Soft directional daylight from the left, "
      + "gentle contact shadow under the device, shallow depth of field so the device is razor sharp and "
      + "the background falls away. True-to-life colour, natural reflections, no text, no watermark, no "
      + "people, no hands. ",
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
      "A modern 14-inch MacBook-style aluminium laptop resting on a light oak desk, opened just far "
        + "enough \u2014 about 20 degrees \u2014 that the hinge and the edge of the screen are visible, photographed "
        + "from slightly above and in front so the whole outer lid faces the camera and fills most of the "
        + "frame while still reading unmistakably as a laptop: visible chassis thickness, rounded corners, "
        + "hinge and a sliver of the dark screen. The entire outer lid is covered edge to edge with a vinyl "
        + "skin. {{fidelity}} The skin is die-cut to the exact silhouette of the Apple logo: the vinyl "
        + "pattern runs continuously across the entire lid and stops only at the outline of the logo "
        + "itself, leaving just that apple shape as bare aluminium. There is no circle, no ring, no disc, "
        + "no rounded plate and no border of any kind around the logo \u2014 the pattern touches the logo "
        + "outline directly on every side. The skin follows the lid rounded corners and stops cleanly at "
        + "the edges. Around the laptop, a few softly out-of-focus props placed off to the sides \u2014 a small "
        + "green plant, a closed notebook, a ceramic mug \u2014 muted and low-contrast so they frame the laptop "
        + "without competing with the design. {{staging}} ",
  },
  {
    label: "Keyboard deck — top down",
    gadget: "laptop",
    suffix: "laptop-open",
    skuCodes: ["LPK"],
    order: 1,
    isActive: true,
    prompt:
      "A modern 14-inch MacBook-style aluminium laptop open on a light oak desk, photographed straight "
        + "down from directly above the keyboard, camera parallel to the desk, so the keyboard deck and "
        + "palm rest fill the frame and the open screen is foreshortened along the top edge of the picture. "
        + "A vinyl skin covers the whole keyboard deck: the palm rest, the area around the trackpad, and "
        + "the flat surface between and around every single key, so the pattern reads as one continuous "
        + "design running through the gaps in the keyboard. {{fidelity}} The keycaps themselves stay bare "
        + "with their normal legends, and the trackpad, the speaker grilles on either side of the keyboard "
        + "and the power button stay completely uncovered \u2014 the vinyl stops cleanly at their edges. Around "
        + "the laptop, a few softly out-of-focus props at the edges of the frame \u2014 a small green plant, a "
        + "closed notebook, a ceramic mug \u2014 muted and low-contrast so they frame the laptop without "
        + "competing with the design. {{staging}} ",
  },
  {
    label: "Sony telephoto",
    gadget: "lens",
    suffix: "lens",
    skuCodes: ["LENS", "LS"],
    order: 0,
    isActive: true,
    prompt:
      "A Sony full-frame telephoto camera lens standing upright on a dark walnut desk, photographed "
        + "from a front three-quarter angle at lens height so the barrel dominates the frame. A vinyl skin "
        + "is wrapped around the cylindrical barrel. {{fidelity}} The artwork curves realistically around "
        + "the barrel with correct perspective, and the pattern compresses slightly towards the left and "
        + "right edges the way a wrap on a cylinder does. The front glass element with its reflections, the "
        + "focus and zoom ring markings, and the metal mount all stay uncovered, with the vinyl stopping "
        + "cleanly at their edges. Behind and to the side, well out of focus, a camera body and a coiled "
        + "leather strap suggest a photographer desk without drawing the eye. {{staging}} ",
  },
  {
    label: "Sony A7 IV body",
    gadget: "camera",
    suffix: "camera",
    skuCodes: ["CAM", "CAO"],
    order: 0,
    isActive: true,
    prompt:
      "A Sony A7 IV mirrorless camera body with no lens attached, standing on a dark walnut desk, "
        + "photographed from a front three-quarter angle slightly above eye level so the front plate and "
        + "grip both read clearly and the body dominates the frame. A vinyl skin covers the front plate and "
        + "the top plate of the body. {{fidelity}} The artwork wraps around the curve of the grip with "
        + "correct shading. The lens mount and its silver ring, the shutter button, the mode and control "
        + "dials, the viewfinder hump and the rear screen all stay uncovered, with the vinyl stopping "
        + "cleanly at their edges. Behind it, softly out of focus, a lens cap and an open notebook suggest "
        + "a working desk without drawing the eye. {{staging}} ",
  },
  {
    label: "PlayStation 5",
    gadget: "console",
    suffix: "ps5",
    skuCodes: ["PS5"],
    order: 0,
    isActive: true,
    prompt:
      "A PlayStation 5 console standing vertically on a low wooden media unit, photographed from a "
        + "front three-quarter angle at console height so the console dominates the frame. Vinyl skins "
        + "cover both outer side panels. {{fidelity}} The artwork follows the curved contour of the panels "
        + "and the pattern bends with them. The central black body, the disc slot, the ports and the base "
        + "stand all stay uncovered, with the vinyl stopping cleanly at their edges. Behind it, dim and far "
        + "out of focus, a dark living-room wall with a hint of warm lamp light and a controller resting on "
        + "the unit. {{staging}} ",
  },
  {
    label: "iPad — back",
    gadget: "tablet",
    suffix: "ipad",
    skuCodes: ["IPAD", "TAB"],
    order: 0,
    isActive: true,
    prompt:
      "An 11-inch tablet lying face down on a light oak desk, photographed from almost directly above "
        + "with a very slight tilt so the back panel dominates the frame and the thin edge of the chassis "
        + "is just visible along one side, giving it depth. A vinyl skin covers the back edge to edge. "
        + "{{fidelity}} The skin follows the rounded corners and has a clean cutout around the rear camera "
        + "module, with the camera lenses and the metal edges left uncovered. Around it, softly out of "
        + "focus at the edges of the frame, a stylus and a ceramic mug suggest a desk without drawing the "
        + "eye. {{staging}} ",
  },
  {
    label: "Apple 20W USB-C",
    gadget: "charger",
    suffix: "charger",
    skuCodes: ["CH"],
    order: 0,
    isActive: true,
    prompt:
      "A small square white 20W USB-C power adapter standing upright on a light oak desk, photographed "
        + "close up from a front three-quarter angle so this small object still dominates the frame. A "
        + "vinyl skin covers the front face and the visible side faces of the adapter. {{fidelity}} The "
        + "artwork bends around the adapter rounded edges and the pattern stays sharp at this close "
        + "distance. The USB-C port and the folding metal prongs stay uncovered, with the vinyl stopping "
        + "cleanly at their edges. Behind it, well out of focus, a loosely coiled white charging cable and "
        + "a hint of a plant suggest a desk without drawing the eye. {{staging}} ",
  },
];
