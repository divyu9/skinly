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
  /**
   * Variant titles this shot is the picture for, as a fallback when the SKU
   * carries no view code.
   *
   * Some laptop SKUs encode the view in the number rather than a suffix —
   * LP-3d-07 is "Only Top" and LP-3d-08 is "Top + Keyboard Area", odd and even
   * in consecutive pairs — and the LP/L prefix contradicts that on three of
   * them. Renaming production SKUs to suit this tool would be the tail wagging
   * the dog, so the title is read instead; it is correct on every one of those
   * rows.
   *
   * Leave empty where the title cannot decide: every Xbox variant says
   * "Console + 1 Controller" whether it is a Series X or a Series S.
   */
  variantTitles?: string[];
  /**
   * Claim a product that has exactly one variant and matched nothing else.
   *
   * Phones, lenses, chargers and the Tranzy laptops are sold as one thing with
   * one variant — no view code in the SKU, and a title of "Default Title" or
   * "Only Top" that decides nothing. With one variant there is no question
   * which view it is, so the gadget's primary shot can say it takes them. Set
   * on one shot per gadget only, or two will both claim it.
   */
  matchSingleVariant?: boolean;
  prompt: string;
  order: number;
  isActive: boolean;
  /**
   * Ask which way the design was cut before generating.
   *
   * A phone skin is cut out of a 29.5 cm roll either along the web or across
   * it, and the two give completely different-looking skins from one design —
   * upright motifs versus sideways ones. The model cannot guess, so shots that
   * set this are queued once per chosen orientation.
   */
  askCutOrientation?: boolean;
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
  /** For rolls: printed by the metre, a pattern that repeats. */
  fidelity: string;
  /**
   * For cutouts: one fixed artwork on a sheet, not a repeat.
   *
   * A roll prompt tells the model to hold "scale and spacing", which is exactly
   * the wrong instruction for a Joker or a Lambo — that has to land whole and
   * centred, never tiled or cropped into.
   */
  fidelityCutout: string;
  staging: string;
}

export const DEFAULT_BLOCKS: SharedBlocks = {
  fidelityCutout:
    "The supplied reference image is a photograph of a printed cutout sheet: one fixed artwork, not a repeating "
    + "pattern. Reproduce that exact artwork on the skin — same composition, same subject, same colours, at the "
    + "same proportions. Do not tile it, do not repeat it, do not crop into it, and do not extend or invent "
    + "anything beyond its edges. Place the whole artwork on the device's main face, centred and filling it. "
    + "Ignore the lighting, glare, shadows, background and perspective of the reference photo, and any surface it "
    + "is resting on. Ignore any small printed text in the margins or corners of the sheet — design numbers, "
    + "order codes and factory or brand names such as Trink, Modern Mart or Virus. Those are trim marks on the "
    + "raw sheet, cut away before the skin is applied; they are not part of the artwork and must not appear "
    + "anywhere in the picture. ",
  fidelity:
    "The supplied reference image is a photograph of the printed vinyl design. Reproduce that exact "
      + "artwork on the skin: same colours, same motifs, same scale and spacing. Do not invent, "
      + "restyle, recolour or substitute the pattern. Ignore the lighting, glare, shadows, background, "
      + "curl and perspective of the reference photo — extract only the flat artwork from it and apply "
      + "it cleanly to the device. ",
  staging:
    "Photorealistic commercial product photograph shot on a full-frame camera with an 85mm lens. "
      + "The device is the single obvious subject and fills roughly 70 percent of the frame; everything "
      + "else is context and stays small, dim and out of focus. The setting is bright and light "
      + "throughout: pale surfaces — light oak, white stone, off-white paper — a clean light-grey or "
      + "warm white background, and soft airy daylight from the left with a gentle contact shadow. "
      + "Never a dark table, a dark wall, a dim or evening room, or moody low-key lighting. Nothing in "
      + "the surroundings may be darker, warmer or more saturated than the product, and no coloured "
      + "light may fall on it, so the skin's colours read exactly as printed. Shallow depth of field so "
      + "the device is razor sharp and the background falls away. True-to-life colour, natural "
      + "reflections, no text and no watermark anywhere. ",
};

/**
 * The Tranzy clause.
 *
 * A Tranzy sheet is printed on clear film, so the flat white in the photograph
 * is the paper backing — peeled off before the skin goes on. Told nothing, the
 * model paints that white onto the device and the result is a white sticker
 * instead of a silhouette sitting on bare metal.
 */
const TRANZY_CLAUSE =
  "This is a Tranzy skin: the artwork is printed on clear transparent film, and the flat white areas "
  + "in the reference photograph are the peel-off paper backing, not part of the design. Render no "
  + "white there at all. Everywhere the reference is white, the device's own bare surface shows "
  + "through instead — brushed silver-grey aluminium on a MacBook or tablet — and only the printed "
  + "silhouette, linework and colours sit on top of it, as though screen-printed straight onto the "
  + "metal. The skin itself is invisible; only its ink is visible. ";

const RELIEF_CLAUSE =
  "The skin has a raised 3D textured finish: the artwork carries a fine tactile relief that catches "
  + "the light across its raised areas, subtle and even, never glossy. ";

/** How a phone skin was cut out of the roll. Changes the whole look. */
export const CUT_ORIENTATIONS = {
  lengthwise:
    "The skin was cut from the roll lengthwise, along the web: the design's natural upright direction "
    + "runs along the phone's long axis, so motifs stand the right way up when the phone is held "
    + "upright in portrait. ",
  widthwise:
    "The skin was cut from the roll across the web, rotated a quarter turn: the design's natural "
    + "upright direction runs across the phone's short axis, so every motif reads sideways — rotated "
    + "90 degrees — when the phone is held upright in portrait. Rotate the reference artwork a quarter "
    + "turn before applying it. ",
} as const;

export type CutOrientation = keyof typeof CUT_ORIENTATIONS;

/** Placeholders a prompt may use. Unknown ones are left alone, not blanked. */
export function expandPrompt(
  prompt: string,
  blocks: SharedBlocks,
  vars: {
    rNumber?: string;
    designName?: string;
    source?: DesignSource;
    finish?: string;
    cutOrientation?: CutOrientation;
  } = {}
): string {
  // {{fidelity}} resolves differently per design source, so one set of shot
  // prompts serves both rolls and cutouts.
  const isTranzy = /tranz|transparent|membrane/i.test(vars.finish || "");
  const isRelief = /3d|textur|emboss/i.test(vars.finish || "");
  const fidelity =
    vars.source === "cutout"
      ? blocks.fidelityCutout + (isTranzy ? TRANZY_CLAUSE : "") + (isRelief ? RELIEF_CLAUSE : "")
      : blocks.fidelity + (isTranzy ? TRANZY_CLAUSE : "");
  const table: Record<string, string> = {
    fidelity,
    staging: blocks.staging,
    rNumber: vars.rNumber ?? "",
    designName: vars.designName ?? "",
    cutOrientation: vars.cutOrientation ? CUT_ORIENTATIONS[vars.cutOrientation] : "",
  };
  return prompt.replace(/\{\{\s*(\w+)\s*\}\}/g, (whole, name: string) =>
    name in table ? table[name] : whole
  );
}

export const PLACEHOLDERS = ["fidelity", "staging", "rNumber", "designName", "cutOrientation"];

/** Where a design comes from. Rolls repeat; cutouts are one fixed artwork. */
export type DesignSource = "roll" | "cutout";

/** R-01 + laptop-top -> R-01-laptop-top. Kept ASCII-safe for use as an R2 key. */
export function mockupFileStem(rNumber: string, suffix: string, attempt = 1): string {
  const roll = rNumber.trim().toUpperCase().replace(/[^A-Z0-9-]/g, "");
  const tail = suffix.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "");
  const base = `${roll}-${tail || "shot"}`;
  return attempt > 1 ? `${base}-v${attempt}` : base;
}

/**
 * Said in every prompt that shows a moulded plastic product.
 *
 * The first pass came back with melted corners and bloated bodies — a PS5 twice
 * its real depth, chargers with smeared edges. Naming the failure is what
 * stops it.
 */
const REAL =
  "Real manufactured product photographed as it actually is: exact factory proportions, crisp "
  + "machined geometry, sharp defined edges and consistent wall thickness. Do not fatten, inflate, "
  + "round over, stretch or squash the body, and do not melt, warp, smear or duplicate any part of "
  + "it. ";

/** Offered on an empty database. Once seeded these are ordinary editable rows. */
export const STARTER_SHOTS: Omit<MockupShot, "_id">[] = [
  {
    label: "Sony A7 body",
    gadget: "camera",
    suffix: "camera",
    skuCodes: ["CAM", "CAO"],
    variantTitles: ["Without Lens"],
    order: 0,
    isActive: true,
    prompt:
      "A Sony Alpha a7 IV mirrorless camera body with no lens attached, standing on a light oak desk, "
        + "photographed from a front three-quarter angle slightly above eye level so the front plate, the "
        + "grip and the raised viewfinder hump on top all read clearly and the body dominates the frame. "
        + "A vinyl skin covers the flat front plate to the left of the grip and the flat top plate "
        + "including the sides of the viewfinder hump. {{fidelity}} The moulded rubber hand grip on the "
        + "right of the body is NOT skinned: skins do not stick to it. It stays bare factory black "
        + "rubber with its fine pebbled texture, and the vinyl stops with a clean straight cut edge "
        + "exactly where the flat front plate meets the rubber. The vinyl on the top plate is one "
        + "continuous sheet with the SONY wordmark knocked out of it as negative space: four "
        + "letter-shaped holes following the exact outlines of S, O, N and Y, through which the bare "
        + "raised metal lettering shows. The pattern runs right up to each letterform and touches it on "
        + "every side. There is absolutely no rectangle, box, panel, plate, badge, label, patch or "
        + "border of bare metal around the wordmark — the only bare metal on the top plate is the four "
        + "letters themselves. The lens mount with its silver ring, the shutter button, the mode and "
        + "control dials and the rear screen stay uncovered, with the vinyl stopping cleanly at their "
        + "edges. Behind it, softly out of focus, a lens cap and an open notebook on a pale surface. No "
        + "people and no hands anywhere in the frame. " + REAL + "{{staging}} ",
  },
  {
    label: "Held in hand",
    gadget: "camera",
    suffix: "camera-hand",
    skuCodes: ["CAM", "CAO"],
    variantTitles: ["Without Lens"],
    order: 1,
    isActive: true,
    prompt:
      "A Sony Alpha a7 IV mirrorless camera body held up in one hand at chest height against a bright, "
        + "softly blurred outdoor background, photographed from a front three-quarter angle so the "
        + "skinned front plate and the top plate both read clearly and the camera dominates the frame. A "
        + "single adult hand holds the device by its rubber grip, cropped at the wrist, skin tone "
        + "neutral, nails plain and short, fingers placed so they cover as little of the design as "
        + "possible. A vinyl skin covers the flat front plate and the flat top plate. {{fidelity}} The "
        + "moulded rubber hand grip is NOT skinned — it stays bare factory black rubber with its pebbled "
        + "texture, and the vinyl stops with a clean straight cut edge where the flat front plate meets "
        + "it. The vinyl on the top plate is one continuous sheet with the SONY wordmark knocked out of "
        + "it as negative space: four letter-shaped holes following the exact outlines of S, O, N and Y, "
        + "through which the bare raised lettering shows, the pattern touching each letter on every "
        + "side. There is absolutely no rectangle, box, panel, plate, badge or border of bare metal "
        + "around the wordmark. The lens mount, dials and rear screen stay uncovered. " + REAL
        + "{{staging}} ",
  },
  {
    label: "Sony A7 + lens",
    gadget: "camera",
    suffix: "camera-lens",
    skuCodes: ["CAML", "CALS"],
    variantTitles: ["With Lens"],
    order: 2,
    isActive: true,
    prompt:
      "A Sony Alpha a7 IV mirrorless camera body with a telephoto lens mounted, standing on a light oak "
        + "desk, photographed from a front three-quarter angle slightly above so the skinned body, the "
        + "raised viewfinder hump and the wrapped lens barrel all read clearly and the pair dominates "
        + "the frame. A matching vinyl skin covers the camera's flat front plate and top plate and is "
        + "wrapped around the lens barrel. {{fidelity}} The pattern reads as the same design across body "
        + "and lens, curving around the barrel and compressing towards its edges the way a wrap on a "
        + "cylinder does. The moulded rubber hand grip is NOT skinned — it stays bare factory black "
        + "rubber with its pebbled texture and the vinyl stops with a clean cut edge where the flat "
        + "front plate meets it. The vinyl on the top plate has the SONY wordmark knocked out of it as "
        + "negative space — four letter-shaped holes following the exact letterforms, the pattern "
        + "touching each letter directly, with no rectangle, box, panel, plate or border of bare metal "
        + "around them. The front glass, the focus and zoom ring markings, the shutter button, the dials "
        + "and the rear screen stay uncovered. Behind, softly out of focus, a lens cap and an open "
        + "notebook on a pale surface. No people and no hands anywhere in the frame. " + REAL
        + "{{staging}} ",
  },
  {
    label: "20W charger — two angles",
    gadget: "charger",
    suffix: "charger",
    skuCodes: ["CH"],
    matchSingleVariant: true,
    order: 0,
    isActive: true,
    prompt:
      "Two Apple 20W USB-C power adapters (Indian model, two round pins) on a light oak desk, the same "
        + "product shown from two different sides: one in front turned to a three-quarter angle so its "
        + "flat front face with the single oval USB-C port is towards the camera, and one behind it, "
        + "smaller in frame and rotated away, showing its top face with the two round pins standing up. "
        + "Each is a small glossy white cuboid the size of a matchbox — about 27 by 27 by 36 millimetres "
        + "— with softly rounded corners and a fine seam running around the body. A vinyl skin covers "
        + "the flat faces of the body. {{fidelity}} The skin is a thin die-cut vinyl sheet lying "
        + "perfectly flat on those faces, with no bubbles, no lift and no thickness of its own. It does "
        + "not wrap over the rounded corners or the curved edges, which stay bare glossy white plastic, "
        + "and a clean straight cut edge is visible where the vinyl ends. The oval USB-C port and the "
        + "two round metal pins stay completely uncovered. The two adapters sit at different distances "
        + "with their own separate shadows so they read as two photographs of one product, not a "
        + "copy-paste. No people and no hands anywhere in the frame. " + REAL + "{{staging}} ",
  },
  {
    label: "MacBook charger — two angles",
    gadget: "charger",
    suffix: "charger-macbook",
    skuCodes: ["CH"],
    order: 1,
    isActive: true,
    prompt:
      "Two Apple MacBook USB-C power adapters on a light oak desk, the same product shown from two "
        + "different sides: one in front turned to a three-quarter angle showing its large flat square "
        + "face, and one behind it, smaller in frame and rotated away, showing the side with the "
        + "detachable Indian-standard pin head fitted. Each is a thick glossy white square brick with "
        + "softly rounded corners, roughly the size of a coaster. A vinyl skin covers the large flat "
        + "square faces. {{fidelity}} The vinyl on the face is one continuous sheet with the Apple logo "
        + "knocked out of it as negative space: a single apple-shaped hole following the exact "
        + "silhouette of the logo, leaf and bite included, through which the bare white plastic shows. "
        + "The pattern touches that outline directly on every side. There is absolutely no circle, ring, "
        + "disc, square, panel, plate, badge or border of bare white around it — the only bare plastic "
        + "on that face is the apple shape itself. The skin is a thin die-cut vinyl sheet lying "
        + "perfectly flat, with no bubbles, no lift and no thickness of its own. It does not wrap over "
        + "the rounded corners or the curved edges, which stay bare glossy white plastic, and a clean "
        + "straight cut edge is visible where the vinyl ends. The USB-C port and the metal pins stay "
        + "completely uncovered. The two adapters sit at different distances with their own separate "
        + "shadows so they read as two photographs of one product, not a copy-paste. No people and no "
        + "hands anywhere in the frame. " + REAL + "{{staging}} ",
  },
  {
    label: "20W charger — held",
    gadget: "charger",
    suffix: "charger-hand",
    skuCodes: ["CH"],
    order: 2,
    isActive: true,
    prompt:
      "A single Apple 20W USB-C power adapter (Indian model, two round pins) held upright between the "
        + "thumb and forefinger of one hand against a bright, softly blurred indoor background, shot "
        + "close so its real size against the fingers is obvious. It is a small glossy white cuboid the "
        + "size of a matchbox with softly rounded corners, one oval USB-C port on the front face and two "
        + "round pins on top. A vinyl skin covers the flat front face. {{fidelity}} The skin is a thin "
        + "die-cut vinyl sheet lying perfectly flat on that face, with no bubbles, no lift and no "
        + "thickness of its own. It does not wrap over the rounded corners or the curved edges, which "
        + "stay bare glossy white plastic, and a clean straight cut edge is visible where the vinyl "
        + "ends. A single adult hand holds it, cropped at the wrist, skin tone neutral, nails plain and "
        + "short, fingers placed so they cover as little of the design as possible. The USB-C port and "
        + "the two round pins stay completely uncovered. " + REAL + "{{staging}} ",
  },
  {
    label: "PS5 — standing",
    gadget: "console",
    suffix: "ps5",
    skuCodes: ["PS5"],
    matchSingleVariant: true,
    order: 0,
    isActive: true,
    prompt:
      "A PlayStation 5 Disc Edition console standing vertically on its round base on a light wooden "
        + "media unit, photographed from a front three-quarter angle at console height so one faceplate "
        + "faces the camera, the black centre column is visible down the middle and the other plate is "
        + "foreshortened. Hold the real proportions exactly: the PS5 is a tall, slim, narrow tower — "
        + "about 39 cm tall, 26 cm wide and only 10 cm deep — with two thin white plates that curve away "
        + "from the black core like the covers of a book left standing open. It is emphatically not "
        + "fat, chunky, bloated, squat or barrel-shaped; the depth is small next to the height, and the "
        + "plates are thin shells, not thick slabs. A vinyl skin covers the two curved outer faceplates. "
        + "{{fidelity}} The artwork follows the curve of each plate. The vinyl on the upper plate has "
        + "the PlayStation logo knocked out of it as negative space: a logo-shaped hole following the "
        + "exact letterform, through which the bare white plastic shows, with the pattern touching it "
        + "directly and no circle, disc, panel, plate or border of bare white around it. The vinyl "
        + "covers only the outward-facing surface of the two removable faceplates. It does not wrap "
        + "around their edges: the inward-facing inner side of each faceplate stays bare factory white, "
        + "showing as a clean white strip along both sides of the centre column, and a crisp cut edge is "
        + "visible where the vinyl ends. The black centre chassis between the plates is never skinned, "
        + "and neither are the blue light strip, the disc slot, the ports, the power and eject buttons, "
        + "the SONY and PlayStation lettering or the base stand. Behind it, softly out of focus, a "
        + "bright living-room wall in daylight. No people and no hands anywhere in the frame. " + REAL
        + "{{staging}} ",
  },
  {
    label: "PS5 Slim — gaming setup",
    gadget: "console",
    suffix: "ps5-angle",
    skuCodes: ["PS5"],
    order: 1,
    isActive: true,
    prompt:
      "A PlayStation 5 Slim console lying flat and horizontal on a light wooden TV unit below a large "
        + "wall-mounted screen, photographed from a low front three-quarter angle so the gaming corner "
        + "is readable and the console still dominates the frame. The Slim is the shorter, squarer "
        + "console with a split faceplate and a straight profile rather than the tall curved original. "
        + "Hold its real proportions exactly: a long, low, slim slab — thin front to back, with flat "
        + "plates, not a fat or inflated body. A vinyl skin covers its outer faceplates. {{fidelity}} "
        + "The vinyl covers only the outward-facing surface of the two removable faceplates. It does not "
        + "wrap around their edges: the inward-facing inner side of each faceplate stays bare factory "
        + "white, showing as a clean white strip along both sides of the centre column, and a crisp cut "
        + "edge is visible where the vinyl ends. The black centre chassis between the plates is never "
        + "skinned, and neither are the blue light strip, the disc slot, the ports, the power and eject "
        + "buttons, the SONY and PlayStation lettering or the stand. The room is bright and daylit — "
        + "a pale wall, a light rug, a window out of frame — and a DualSense controller lies beside the "
        + "console, well out of focus. No dark or moody ambience, no coloured LED wash on the console. "
        + "No people and no hands anywhere in the frame. " + REAL + "{{staging}} ",
  },
  {
    label: "PS5 + controller — set",
    gadget: "console",
    suffix: "ps5-set",
    skuCodes: ["PS5"],
    order: 2,
    isActive: true,
    prompt:
      "A PlayStation 5 Disc Edition console standing vertically beside its DualSense controller, both "
        + "facing the camera against a clean white studio background, photographed straight on so the "
        + "console fills the left of the frame and the controller sits to its right at the lower third, "
        + "the pair reading as one matching set. Hold the console's real proportions exactly: a tall, "
        + "slim, narrow tower — about 39 cm tall, 26 cm wide and only 10 cm deep — with two thin curved "
        + "white plates, never fat, chunky, bloated or squat. A matching vinyl skin covers the console's "
        + "two outer faceplates and the outer shell of the controller. {{fidelity}} The pattern reads as "
        + "the same design across both. The vinyl on the upper plate has the PlayStation logo knocked "
        + "out of it as negative space, the pattern touching the letterform directly with no circle, "
        + "disc, panel or border of bare white around it. The vinyl covers only the outward-facing "
        + "surface of the two removable faceplates; the inward-facing inner side of each stays bare "
        + "factory white as a clean strip along the centre column, with a crisp cut edge where the vinyl "
        + "ends. The black centre chassis, the blue light strip, the disc slot, the ports, the buttons, "
        + "the SONY and PlayStation lettering and the base stand are never skinned. On the controller "
        + "the vinyl wraps the full outer shell as a single continuous piece — both curved grips all the "
        + "way round their outer and under sides, the two shoulder humps, and the front face panels on "
        + "either side of the touchpad — following every compound curve tightly with no bubbles, no lift "
        + "and no gaps of bare white left between panels. The touchpad, the D-pad, the face buttons, the "
        + "thumbsticks, the light bar, the triggers and the central PS button stay bare, with the vinyl "
        + "die-cut cleanly around each of them. No people and no hands anywhere in the frame. " + REAL
        + "{{staging}} ",
  },
  {
    label: "Series X — console",
    gadget: "console",
    suffix: "xbox-x",
    skuCodes: ["XBX"],
    order: 3,
    isActive: true,
    prompt:
      "A matte black Xbox Series X console standing upright on a light wooden media unit, photographed "
        + "from a front three-quarter angle at console height so the tall rectangular tower dominates "
        + "the frame. Hold its real proportions exactly: a clean rectangular block roughly 30 cm tall "
        + "and 15 cm square, with flat faces and sharp edges — never fattened, tapered or rounded over. "
        + "A vinyl skin covers the four flat outer side faces. {{fidelity}} The vinyl is a thin die-cut "
        + "sheet lying flat on the outward-facing surfaces only. It does not wrap around edges or into "
        + "recesses, which stay factory colour, and a crisp cut edge is visible where it ends. The black "
        + "circular ventilation grille on the top with its green interior, the disc slot, the front USB "
        + "port, the power button and the rubber foot all stay uncovered. Behind, softly out of focus, a "
        + "bright daylit living-room wall. No people and no hands anywhere in the frame. " + REAL
        + "{{staging}} ",
  },
  {
    label: "Series X + controllers",
    gadget: "console",
    suffix: "xbox-x-set",
    skuCodes: ["XBXC", "XBXC1", "XBXC2", "XBXCL1", "XBXCL2"],
    order: 4,
    isActive: true,
    prompt:
      "A matte black Xbox Series X console standing upright with two matching Xbox wireless controllers "
        + "in front of it, one on each side, against a clean white studio background, photographed "
        + "straight on so the group reads as one matching set and fills the frame. A matching vinyl skin "
        + "covers the console's four flat outer side faces and the outer shell of both controllers. "
        + "{{fidelity}} The pattern reads as the same design across all three pieces. On the console the "
        + "vinyl is a thin die-cut sheet on the outward-facing flat surfaces only; it does not wrap "
        + "around edges or into recesses, which stay factory colour, and a crisp cut edge is visible "
        + "where it ends. On each controller the vinyl wraps the full outer shell as one continuous "
        + "piece — the top face, both grips all the way round their outer and under sides, and the "
        + "shoulder humps — following every compound curve tightly with no bubbles, no lift and no gaps "
        + "of bare shell showing between panels. The thumbsticks, the D-pad, the A/B/X/Y buttons, the "
        + "triggers, the bumpers and the centre Xbox button all stay bare, with the vinyl die-cut "
        + "cleanly around each of them. The console's top ventilation grille, disc slot and ports stay "
        + "uncovered. No people and no hands anywhere in the frame. " + REAL + "{{staging}} ",
  },
  {
    label: "Series S — console",
    gadget: "console",
    suffix: "xbox-s",
    skuCodes: ["XBXS", "XBS"],
    order: 5,
    isActive: true,
    prompt:
      "A white Xbox Series S console lying flat and horizontal on a light wooden media unit, "
        + "photographed from a front three-quarter angle slightly above so the wide flat body and the "
        + "large black circular grille on its top face both read clearly and the console dominates the "
        + "frame. Hold its real proportions exactly: a thin, low, wide slab — never fattened or "
        + "inflated. A vinyl skin covers the flat white outer faces around the grille. {{fidelity}} The "
        + "vinyl is a thin die-cut sheet on the outward-facing flat surfaces only. It does not wrap "
        + "around edges or into recesses, which stay factory colour, and a crisp cut edge is visible "
        + "where it ends. The black circular grille, the front USB port, the power button and the rear "
        + "ports all stay uncovered, with the vinyl cut cleanly around the grille. Behind, softly out of "
        + "focus, a bright daylit living-room wall. No people and no hands anywhere in the frame. "
        + REAL + "{{staging}} ",
  },
  {
    label: "Series S + controllers",
    gadget: "console",
    suffix: "xbox-s-set",
    skuCodes: ["XBXSC", "XBXSC1", "XBXSC2", "XBXSCL1", "XBXSCL2"],
    order: 6,
    isActive: true,
    prompt:
      "A white Xbox Series S console lying flat with two matching Xbox wireless controllers arranged in "
        + "front of it, one on each side, against a clean white studio background, photographed from "
        + "slightly above so the group reads as one matching set and fills the frame. A matching vinyl "
        + "skin covers the console's flat outer faces and the outer shell of both controllers. "
        + "{{fidelity}} The pattern reads as the same design across all three pieces. On the console the "
        + "vinyl is a thin die-cut sheet on the outward-facing flat surfaces only; it does not wrap "
        + "around edges or into recesses, which stay factory colour, and a crisp cut edge is visible "
        + "where it ends. On each controller the vinyl wraps the full outer shell as one continuous "
        + "piece — the top face, both grips all the way round their outer and under sides, and the "
        + "shoulder humps — following every compound curve tightly with no bubbles, no lift and no gaps "
        + "of bare shell showing between panels. The thumbsticks, the D-pad, the A/B/X/Y buttons, the "
        + "triggers, the bumpers and the centre Xbox button all stay bare, with the vinyl die-cut "
        + "cleanly around each of them. The console's black circular grille and its ports stay "
        + "uncovered, with the vinyl cut cleanly around the grille. No people and no hands anywhere in "
        + "the frame. " + REAL + "{{staging}} ",
  },
  {
    label: "Xbox controller",
    gadget: "controller",
    suffix: "controller-xbox",
    skuCodes: ["CLX", "CLS", "CLO"],
    matchSingleVariant: true,
    order: 0,
    isActive: true,
    prompt:
      "An Xbox wireless controller lying flat on a pale light-grey surface in bright daylight, "
        + "photographed from directly above with the camera square to the surface so the controller is "
        + "straight in frame with no tilt and fills it. A vinyl skin wraps the outer shell. "
        + "{{fidelity}} The vinyl is applied as one continuous piece over the whole outer shell — the "
        + "top face between and around the controls, both grips all the way round their outer and under "
        + "sides, and the shoulder humps at the top — following every compound curve tightly, conforming "
        + "to the shape like heat-shrunk film, with no bubbles, no lift, no wrinkles, and no gaps of "
        + "bare factory shell left showing between panels. The thumbsticks, the D-pad, the A/B/X/Y "
        + "buttons, the triggers, the bumpers, the view and menu buttons and the centre Xbox button all "
        + "stay bare, with the vinyl die-cut precisely around each of them so the cut follows the exact "
        + "outline of the recess. No people and no hands anywhere in the frame. " + REAL + "{{staging}} ",
  },
  {
    label: "DualSense controller",
    gadget: "controller",
    suffix: "controller-ps5",
    skuCodes: ["PS5"],
    order: 1,
    isActive: true,
    prompt:
      "A PlayStation 5 DualSense controller lying flat on a pale light-grey surface in bright daylight, "
        + "photographed from directly above with the camera square to the surface so the controller is "
        + "straight in frame with no tilt and fills it. A vinyl skin wraps the outer shell. "
        + "{{fidelity}} The vinyl is applied as one continuous piece over the whole outer shell — both "
        + "curved grips all the way round their outer and under sides, the two shoulder humps at the "
        + "top, and the two front face panels on either side of the touchpad — following every compound "
        + "curve tightly, conforming to the shape like heat-shrunk film, with no bubbles, no lift, no "
        + "wrinkles, and no gaps of bare white shell left showing between panels. The pattern is "
        + "continuous across the grip and the face panel above it, not two separate stickers. The "
        + "touchpad, the D-pad, the four face buttons, the two thumbsticks, the light bar around the "
        + "touchpad, the triggers and bumpers, the create and options buttons and the central PS button "
        + "all stay bare factory white or black, with the vinyl die-cut precisely around each of them so "
        + "the cut follows the exact outline of the recess. No people and no hands anywhere in the "
        + "frame. " + REAL + "{{staging}} ",
  },
  {
    label: "DualShock 4 controller",
    gadget: "controller",
    suffix: "controller-ps4",
    skuCodes: ["PS4"],
    order: 2,
    isActive: true,
    prompt:
      "A PlayStation 4 DualShock 4 controller lying flat on a pale light-grey surface in bright "
        + "daylight, photographed from directly above with the camera square to the surface so the "
        + "controller is straight in frame with no tilt and fills it. A vinyl skin wraps the outer "
        + "shell. {{fidelity}} The vinyl is applied as one continuous piece over the whole outer shell "
        + "— the top face around the controls, both grips all the way round their outer and under "
        + "sides, and the shoulder humps — following every compound curve tightly with no bubbles, no "
        + "lift and no gaps of bare factory shell showing between panels. The touchpad, the D-pad, the "
        + "face buttons, the thumbsticks, the light bar, the triggers and the bumpers stay bare, with "
        + "the vinyl die-cut precisely around each of them. No people and no hands anywhere in the "
        + "frame. " + REAL + "{{staging}} ",
  },
  {
    label: "DualShock 3 controller",
    gadget: "controller",
    suffix: "controller-ps3",
    skuCodes: ["PS3"],
    order: 3,
    isActive: true,
    prompt:
      "A PlayStation 3 DualShock 3 controller lying flat on a pale light-grey surface in bright "
        + "daylight, photographed from directly above with the camera square to the surface so the "
        + "controller is straight in frame with no tilt and fills it. A vinyl skin wraps the outer "
        + "shell. {{fidelity}} The vinyl is applied as one continuous piece over the whole outer shell "
        + "— the top face around the controls and both grips all the way round their outer and under "
        + "sides — following every curve tightly with no bubbles, no lift and no gaps of bare factory "
        + "shell showing. The D-pad, the face buttons, the thumbsticks, the start and select buttons and "
        + "the centre PS button stay bare, with the vinyl die-cut precisely around each of them. No "
        + "people and no hands anywhere in the frame. " + REAL + "{{staging}} ",
  },
  {
    label: "Drone only",
    gadget: "drone",
    suffix: "drone",
    skuCodes: ["DRO", "DRON"],
    variantTitles: ["Drone Only"],
    matchSingleVariant: true,
    order: 0,
    isActive: true,
    prompt:
      "A compact grey folding DJI camera drone on a light concrete surface in bright daylight with its "
        + "four arms unfolded, photographed from a front three-quarter angle slightly above so the top "
        + "shell, the arms and the gimbal camera all read clearly and the drone dominates the frame. A "
        + "vinyl skin covers the top shell of the body and the top of each arm. {{fidelity}} The artwork "
        + "follows the curve of the shell and continues onto the arms as one design. The vinyl on the "
        + "shell has the DJI wordmark knocked out of it as negative space: three letter-shaped holes "
        + "following the exact outlines of D, J and I, through which the bare grey shell shows, with the "
        + "pattern touching each letter directly. There is absolutely no rectangle, box, panel, plate, "
        + "badge or border of bare shell around the wordmark. The gimbal camera and its lens, the "
        + "propellers, the sensors underneath and the battery release stay uncovered, with the vinyl "
        + "stopping cleanly at their edges. Behind it, far out of focus, bright open sky and a hint of "
        + "green landscape. No people and no hands anywhere in the frame. " + REAL + "{{staging}} ",
  },
  {
    label: "Drone + controller — combo",
    gadget: "drone",
    suffix: "drone-rc",
    skuCodes: ["DRC", "DROC"],
    variantTitles: ["Drone + RC"],
    order: 1,
    isActive: true,
    prompt:
      "A compact grey folding DJI camera drone with its arms unfolded, and its RC-N series remote "
        + "controller, arranged together on a light concrete surface in bright daylight — the drone "
        + "behind, the controller in front and slightly angled — photographed from a front "
        + "three-quarter angle slightly above so the pair fills the frame as one group. A matching vinyl "
        + "skin covers the drone's top shell and the controller's shell. {{fidelity}} The pattern reads "
        + "as the same design across both pieces. On the drone the vinyl has the DJI wordmark knocked "
        + "out of it as negative space — three letter-shaped holes following the exact letterforms, the "
        + "pattern touching them directly, with no rectangle, box, panel, plate or border of bare shell "
        + "around them. On the controller the vinyl is applied as one continuous piece over the whole "
        + "front face and both rounded hand grips, wrapping around their outer and under sides and "
        + "conforming tightly to every curve like heat-shrunk film, with no bubbles, no lift and no gaps "
        + "of bare grey shell left showing between panels. The controller's two removable control "
        + "sticks, its phone clamp, its screen, its status LEDs and all its buttons and switches stay "
        + "uncovered, with the vinyl die-cut precisely around each of them. Behind, far out of focus, "
        + "bright open sky. No people and no hands anywhere in the frame. " + REAL + "{{staging}} ",
  },
  {
    label: "Controller — no display",
    gadget: "drone",
    suffix: "drone-rc-nodisplay",
    skuCodes: ["DRC", "DROC"],
    order: 2,
    isActive: true,
    prompt:
      "A DJI RC-N series remote controller lying flat on a pale light-grey surface in bright daylight, "
        + "photographed from directly above, camera square to the surface so the controller is straight "
        + "in frame with no tilt and fills it. This is the controller without a built-in screen: a wide "
        + "grey rounded body with two removable control sticks seated in the lower face, a small DJI "
        + "wordmark in the centre, a row of status LEDs, a power button and a flight-mode switch, and "
        + "folding clamp arms on top that hold a phone. A vinyl skin wraps the shell. {{fidelity}} The "
        + "vinyl is applied as one continuous piece over the whole outer shell — the flat grey front "
        + "face between and around the controls, and both rounded hand grips all the way round their "
        + "outer and under sides — following every compound curve tightly, conforming to the shape like "
        + "heat-shrunk film, with no bubbles, no lift, no wrinkles and no gaps of bare grey shell left "
        + "showing between panels. The vinyl has the DJI wordmark knocked out of it as negative space: "
        + "three letter-shaped holes following the exact letterforms, the pattern touching them "
        + "directly, with no rectangle, box, panel, plate or border of bare shell around them. The two "
        + "control sticks, the buttons, the switch, the status LEDs and the folding phone clamp stay "
        + "completely uncovered, with the vinyl die-cut precisely around each of them so the cut follows "
        + "the exact outline of the recess. No people and no hands anywhere in the frame. " + REAL
        + "{{staging}} ",
  },
  {
    label: "Controller — with display",
    gadget: "drone",
    suffix: "drone-rc-display",
    skuCodes: ["DRC", "DROC"],
    order: 3,
    isActive: true,
    prompt:
      "A DJI RC remote controller with a built-in screen, lying flat on a pale light-grey surface in "
        + "bright daylight, photographed from directly above, camera square to the surface so the "
        + "controller is straight in frame with no tilt and fills it. This is the controller with an "
        + "integrated display: a wide grey rounded body whose centre is a large dark glossy touchscreen, "
        + "with two removable control sticks above it, a power button, a flight-mode switch and a carry "
        + "handle along the top edge. A vinyl skin wraps the shell around the screen. {{fidelity}} The "
        + "vinyl is applied as one continuous piece over every grey surface of the body — the bezel "
        + "above, below and to both sides of the screen, and both rounded hand grips all the way round "
        + "their outer and under sides — following every compound curve tightly, conforming like "
        + "heat-shrunk film, with no bubbles, no lift and no gaps of bare grey shell left showing "
        + "between panels. The vinyl has the DJI wordmark knocked out of it as negative space, the "
        + "pattern touching the letterforms directly with no rectangle, panel, plate or border of bare "
        + "shell around them. The screen stays completely bare and dark, and the control sticks, "
        + "buttons, switch and carry handle stay uncovered, with the vinyl stopping in a crisp cut "
        + "exactly at the screen bezel and die-cut precisely around every control. No people and no "
        + "hands anywhere in the frame. " + REAL + "{{staging}} ",
  },
  {
    label: "Drone — held",
    gadget: "drone",
    suffix: "drone-hand",
    skuCodes: ["DRO", "DRON"],
    variantTitles: ["Drone Only"],
    order: 4,
    isActive: true,
    prompt:
      "A compact grey folding DJI camera drone held in one hand with its arms folded against the body, "
        + "against a bright, softly blurred outdoor background, photographed so the skinned top shell "
        + "faces the camera and the drone dominates the frame. A vinyl skin covers the top shell and the "
        + "top of each folded arm. {{fidelity}} The vinyl has the DJI wordmark knocked out of it as "
        + "negative space — three letter-shaped holes following the exact letterforms, the pattern "
        + "touching them directly, with no rectangle, box, panel, plate or border of bare shell around "
        + "them. A single adult hand holds it, cropped at the wrist, skin tone neutral, nails plain and "
        + "short, fingers placed so they cover as little of the design as possible. The gimbal camera "
        + "and the propellers stay uncovered. " + REAL + "{{staging}} ",
  },
  {
    label: "Lid only",
    gadget: "laptop",
    suffix: "laptop-top",
    skuCodes: ["LP", "LPT", "LAP"],
    variantTitles: ["Only Top"],
    matchSingleVariant: true,
    order: 0,
    isActive: true,
    prompt:
      "A modern 14-inch MacBook-style aluminium laptop resting on a light oak desk, opened just far "
        + "enough — about 20 degrees — that the hinge and the edge of the screen are visible, "
        + "photographed from slightly above and in front so the whole outer lid faces the camera and "
        + "fills most of the frame while still reading unmistakably as a laptop: visible chassis "
        + "thickness, rounded corners, hinge and a sliver of the dark screen. The entire outer lid is "
        + "covered edge to edge with a vinyl skin. {{fidelity}} The vinyl is one continuous sheet with "
        + "the Apple logo knocked out of it as negative space: a single apple-shaped hole following the "
        + "exact silhouette of the logo, leaf and bite included, through which the bare aluminium shows. "
        + "The pattern touches that outline directly on every side. There is absolutely no circle, ring, "
        + "disc, square, rounded plate, panel, badge or border of bare metal around it — the only bare "
        + "metal on the lid is the apple shape itself. The skin follows the lid's rounded corners and "
        + "stops cleanly at the edges. Around the laptop, a few softly out-of-focus props placed off to "
        + "the sides — a small green plant, a closed notebook, a ceramic mug — muted and low-contrast so "
        + "they frame the laptop without competing with the design. {{staging}} ",
  },
  {
    label: "Keyboard deck — top down",
    gadget: "laptop",
    suffix: "laptop-open",
    skuCodes: ["LPK"],
    variantTitles: ["Top + Keyboard Area", "Top+Keyboard", "Top + Keyboad Area"],
    order: 1,
    isActive: true,
    prompt:
      "A modern 14-inch MacBook-style aluminium laptop open on a light oak desk, photographed straight "
        + "down from directly above the keyboard, camera parallel to the desk, so the keyboard deck and "
        + "palm rest fill the frame and the open screen is foreshortened along the top edge of the "
        + "picture. A vinyl skin covers the entire keyboard deck as one single continuous printed "
        + "surface. {{fidelity}} Critically: the whole aluminium deck is skinned, including every "
        + "millimetre of the narrow flat channel visible in the gaps BETWEEN and AROUND the individual "
        + "keycaps. There is no bare silver aluminium anywhere on the deck. Looking down into the gap "
        + "between any two adjacent keys you see the printed design there, not metal. Think of the deck "
        + "as a single printed sheet laid down first, with the keycaps then sitting in their wells on "
        + "top of it — so the pattern is visibly continuous and correctly aligned as it passes through "
        + "every gap in the key grid, across the palm rest and around the trackpad, reading as one "
        + "uninterrupted artwork rather than a set of separate pieces. Every one of the roughly eighty "
        + "inter-key gaps shows the pattern. The keycaps themselves stay bare with their normal legends, "
        + "and the trackpad, the speaker grilles on either side of the keyboard and the power button "
        + "stay completely uncovered — the vinyl stops cleanly at their edges. Around the laptop, a few "
        + "softly out-of-focus props at the edges of the frame — a small green plant, a closed notebook, "
        + "a ceramic mug — muted and low-contrast so they frame the laptop without competing with the "
        + "design. {{staging}} ",
  },
  {
    label: "Held — closed, carried",
    gadget: "laptop",
    suffix: "laptop-hand",
    skuCodes: ["LP", "LPT", "LAP"],
    variantTitles: ["Only Top"],
    order: 2,
    isActive: true,
    prompt:
      "A closed 14-inch MacBook-style aluminium laptop held upright in one hand against a bright, "
        + "softly blurred indoor background, as if being carried, photographed from the front so the "
        + "skinned lid faces the camera and fills most of the frame at a slight angle. A single adult "
        + "hand holds the device, cropped at the wrist, skin tone neutral, nails plain and short, "
        + "fingers placed so they cover as little of the design as possible. The lid is covered edge to "
        + "edge with a vinyl skin. {{fidelity}} The vinyl is one continuous sheet with the Apple logo "
        + "knocked out of it as negative space: a single apple-shaped hole following the exact "
        + "silhouette of the logo, through which the bare aluminium shows, the pattern touching that "
        + "outline directly on every side. There is absolutely no circle, ring, disc, rounded plate, "
        + "panel or border of bare metal around it. {{staging}} ",
  },
  {
    label: "Sony telephoto",
    gadget: "lens",
    suffix: "lens",
    skuCodes: ["LENS", "LS"],
    matchSingleVariant: true,
    order: 0,
    isActive: true,
    prompt:
      "A Sony full-frame telephoto camera lens standing upright on a light oak desk, photographed from "
        + "a front three-quarter angle at lens height so the barrel dominates the frame. A vinyl skin is "
        + "wrapped around the cylindrical barrel. {{fidelity}} The artwork curves realistically around "
        + "the barrel with correct perspective, and the pattern compresses slightly towards the left and "
        + "right edges the way a wrap on a cylinder does. The front glass element with its reflections, "
        + "the focus and zoom ring markings, and the metal mount all stay uncovered, with the vinyl "
        + "stopping cleanly at their edges. Behind and to the side, well out of focus, a camera body and "
        + "a coiled leather strap suggest a photographer's desk without drawing the eye. " + REAL
        + "{{staging}} ",
  },
  {
    label: "Held in hand",
    gadget: "lens",
    suffix: "lens-hand",
    skuCodes: ["LENS", "LS"],
    order: 1,
    isActive: true,
    prompt:
      "A Sony full-frame telephoto camera lens held horizontally in one hand against a bright, softly "
        + "blurred indoor background, photographed side on so the wrapped barrel runs across the frame "
        + "and dominates it. A single adult hand holds the device, cropped at the wrist, skin tone "
        + "neutral, nails plain and short, fingers placed so they cover as little of the design as "
        + "possible. A vinyl skin is wrapped around the cylindrical barrel. {{fidelity}} The artwork "
        + "curves around the barrel and compresses towards the top and bottom edges the way a wrap on a "
        + "cylinder does. The front glass, the focus and zoom ring markings and the metal mount stay "
        + "uncovered. " + REAL + "{{staging}} ",
  },
  {
    label: "Mac Mini — top",
    gadget: "mac-mini",
    suffix: "macmini",
    skuCodes: ["MM"],
    matchSingleVariant: true,
    order: 0,
    isActive: true,
    prompt:
      "An Apple Mac Mini M4 sitting on a light oak desk, photographed from a front three-quarter angle "
        + "slightly above so the flat square top face and two of the four aluminium side faces all read "
        + "clearly and the unit dominates the frame. This is the 2024 M4 model: a small square aluminium "
        + "block only about 12.7 cm on each side and 5 cm tall, with tightly rounded corners, a power "
        + "button and two USB-C ports plus a headphone jack on the front edge, and a recessed circular "
        + "base ring underneath. A vinyl skin covers the flat top face AND all four flat side faces. "
        + "{{fidelity}} The pattern runs continuously over the top and down each side, wrapping the "
        + "rounded vertical corners so the unit reads as a single printed block with no bare aluminium "
        + "band anywhere around it. Only the ports are left out: the vinyl is die-cut precisely around "
        + "the front USB-C ports, the headphone jack, the power button and every rear port and vent, "
        + "each cut following the exact outline of its opening. The underside and the recessed circular "
        + "base ring are not skinned. The vinyl on the top face has the Apple logo knocked out of it as "
        + "negative space: a single apple-shaped hole following the exact silhouette of the logo, "
        + "through which the bare aluminium shows, the pattern touching that outline directly on every "
        + "side, with absolutely no circle, ring, disc, square, plate, panel or border of bare metal "
        + "around it. Beside it, softly out of focus, the edge of a keyboard and a ceramic mug on a pale "
        + "desk. No people and no hands anywhere in the frame. " + REAL + "{{staging}} ",
  },
  {
    label: "Mac Mini — held",
    gadget: "mac-mini",
    suffix: "macmini-hand",
    skuCodes: ["MM"],
    order: 1,
    isActive: true,
    prompt:
      "An Apple Mac Mini M4 held flat on the open palm of one hand against a bright, softly blurred "
        + "indoor background, photographed from a three-quarter angle slightly above so the skinned top "
        + "face and one skinned side both read clearly and the unit dominates the frame, its real size "
        + "against the hand obvious. This is the 2024 M4 model: a small square aluminium block only "
        + "about 12.7 cm on each side and 5 cm tall, with tightly rounded corners. A single adult hand "
        + "holds it, cropped at the wrist, skin tone neutral, nails plain and short. A vinyl skin covers "
        + "the flat top face AND all four flat side faces. {{fidelity}} The pattern runs continuously "
        + "over the top and down each side, wrapping the rounded vertical corners so the unit reads as a "
        + "single printed block with no bare aluminium band around it. Only the ports are left out, the "
        + "vinyl die-cut precisely around the front USB-C ports, the headphone jack, the power button "
        + "and every rear port. The underside and the circular base ring are not skinned. The vinyl on "
        + "the top has the Apple logo knocked out of it as negative space, the pattern touching the "
        + "silhouette directly with no circle, disc, plate or border of bare metal around it. " + REAL
        + "{{staging}} ",
  },
  {
    label: "iPhone 17 Pro Max — back",
    gadget: "phone",
    suffix: "phone-iphone",
    skuCodes: ["PH", "IPH"],
    matchSingleVariant: true,
    askCutOrientation: true,
    order: 0,
    isActive: true,
    prompt:
      "An iPhone 17 Pro Max lying face down on a light oak desk, photographed from directly overhead "
        + "with the camera square to the desk so the back panel is perfectly straight in the frame, its "
        + "edges parallel to the picture edges, with no tilt and no perspective skew. The phone fills "
        + "most of the frame. It is a large flat slab with a flat polished titanium band around its "
        + "edge, tightly rounded corners, and across the top of the back a wide raised camera plateau "
        + "spanning the full width of the phone, carrying three large lenses in a triangle on its left "
        + "with the flash and sensor to their right. A vinyl skin covers the back panel edge to edge. "
        + "{{fidelity}} {{cutOrientation}} The skin follows the rounded corners and stops cleanly at the "
        + "titanium side band, which stays bare polished metal. It is die-cut around the camera plateau: "
        + "the vinyl lies flat on the back below and around it, and the plateau itself, the three lenses, "
        + "the flash and the microphone stay completely uncovered, the cut following the exact outline "
        + "of the plateau. No Apple logo is visible — it sits under the skin. At the very edges of the "
        + "frame, softly out of focus, a pair of earphones and a ceramic mug suggest a desk without "
        + "drawing the eye. No people and no hands anywhere in the frame. " + REAL + "{{staging}} ",
  },
  {
    label: "Samsung S26 Ultra — back",
    gadget: "phone",
    suffix: "phone-samsung",
    skuCodes: ["PH", "SAM"],
    askCutOrientation: true,
    order: 1,
    isActive: true,
    prompt:
      "A Samsung Galaxy S26 Ultra lying face down on a light oak desk, photographed from directly "
        + "overhead with the camera square to the desk so the back panel is perfectly straight in the "
        + "frame, its edges parallel to the picture edges, with no tilt and no perspective skew. The "
        + "phone fills most of the frame. It is a large flat slab with an almost square profile, gently "
        + "rounded corners, a flat metal side rail, and down the upper left of the back a vertical "
        + "column of individually raised camera lenses — no camera bump plate, each lens ring standing "
        + "proud of the back panel on its own. A vinyl skin covers the back panel edge to edge. "
        + "{{fidelity}} {{cutOrientation}} The skin follows the rounded corners and stops cleanly at the "
        + "metal side rail, which stays bare. It is die-cut with a separate circular hole around each "
        + "camera lens and around the flash, every cut following the exact outline of its ring, so the "
        + "lenses and flash stay completely uncovered while the vinyl lies flat on the panel between and "
        + "around them. No Samsung logo is visible — it sits under the skin. At the very edges of the "
        + "frame, softly out of focus, an S Pen and a ceramic mug suggest a desk without drawing the "
        + "eye. No people and no hands anywhere in the frame. " + REAL + "{{staging}} ",
  },
  {
    label: "iPad — back",
    gadget: "tablet",
    suffix: "ipad",
    skuCodes: ["IPAD", "TAB", "TAB."],
    variantTitles: ["Only Back"],
    matchSingleVariant: true,
    order: 0,
    isActive: true,
    prompt:
      "An 11-inch tablet lying face down on a light oak desk, photographed from directly overhead with "
        + "the camera square to the desk so the back panel is perfectly straight in the frame, edges "
        + "parallel to the picture edges, no tilt and no perspective skew. A vinyl skin covers the back "
        + "edge to edge. {{fidelity}} The vinyl is one continuous sheet with the Apple logo knocked out "
        + "of it as negative space: a single apple-shaped hole following the exact silhouette of the "
        + "logo, through which the bare aluminium shows, the pattern touching that outline directly on "
        + "every side. There is absolutely no circle, ring, disc, rounded plate, panel or border of bare "
        + "metal around it. The skin follows the rounded corners and has a clean cutout around the rear "
        + "camera module, with the camera lenses and the metal edges left uncovered. At the very edges "
        + "of the frame, softly out of focus, a stylus and a ceramic mug suggest a desk without drawing "
        + "the eye. No people and no hands anywhere in the frame. " + REAL + "{{staging}} ",
  },
  {
    label: "Held in hand",
    gadget: "tablet",
    suffix: "ipad-hand",
    skuCodes: ["IPAD", "TAB"],
    variantTitles: ["Only Back"],
    order: 1,
    isActive: true,
    prompt:
      "An 11-inch tablet held in one hand with the skinned back panel facing the camera, against a "
        + "bright, softly blurred indoor background, photographed at a slight angle so the thin chassis "
        + "edge is visible and the tablet dominates the frame. A single adult hand holds the device, "
        + "cropped at the wrist, skin tone neutral, nails plain and short, fingers placed so they cover "
        + "as little of the design as possible. A vinyl skin covers the back edge to edge. {{fidelity}} "
        + "The vinyl is one continuous sheet with the Apple logo knocked out of it as negative space: a "
        + "single apple-shaped hole following the exact silhouette of the logo, through which the bare "
        + "aluminium shows, the pattern touching that outline directly on every side, with absolutely no "
        + "circle, ring, disc, rounded plate, panel or border of bare metal around it. The rear camera "
        + "module has a clean cutout and the metal edges stay uncovered. " + REAL + "{{staging}} ",
  },
];
