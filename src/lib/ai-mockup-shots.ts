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
    "The supplied reference image is a photograph of the printed vinyl design. Reproduce that exact "
      + "artwork on the skin: same colours, same motifs, same scale and spacing. Do not invent, "
      + "restyle, recolour or substitute the pattern. Ignore the lighting, glare, shadows, background, "
      + "curl and perspective of the reference photo \u2014 extract only the flat artwork from it and apply "
      + "it cleanly to the device. ",
  staging:
    "Photorealistic commercial product photograph shot on a full-frame camera with an 85mm lens. "
      + "The device is the single obvious subject and fills roughly 70 percent of the frame; everything "
      + "else is context and stays small, dim and out of focus. Soft directional daylight from the "
      + "left, gentle contact shadow, shallow depth of field so the device is razor sharp and the "
      + "background falls away. True-to-life colour, natural reflections, no text and no watermark "
      + "anywhere. ",
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
    label: "Sony A7 body",
    gadget: "camera",
    suffix: "camera",
    skuCodes: ["CAM", "CAO"],
    order: 0,
    isActive: true,
    prompt:
      "A Sony Alpha mirrorless camera body with no lens attached, standing on a dark walnut desk, "
        + "photographed from a front three-quarter angle slightly above eye level so the front plate, the "
        + "grip and the raised viewfinder hump on top all read clearly and the body dominates the frame. "
        + "A vinyl skin covers the front plate and the top plate including the viewfinder hump. "
        + "{{fidelity}} The artwork wraps around the curve of the grip with correct shading. The skin is "
        + "die-cut to the exact shape of the SONY wordmark on the viewfinder hump: the vinyl runs "
        + "continuously across the top plate and stops only at the letterforms, leaving the raised SONY "
        + "lettering bare. There is no rectangle, no plate, no panel and no border around the wordmark \u2014 "
        + "the pattern touches the letters directly. The lens mount with its silver ring, the shutter "
        + "button, the mode and control dials and the rear screen stay uncovered, with the vinyl stopping "
        + "cleanly at their edges. Behind it, softly out of focus, a lens cap and an open notebook. No "
        + "people and no hands anywhere in the frame. {{staging}} ",
  },
  {
    label: "Held in hand",
    gadget: "camera",
    suffix: "camera-hand",
    skuCodes: ["CAM", "CAO"],
    order: 1,
    isActive: true,
    prompt:
      "A Sony Alpha mirrorless camera body held up in one hand at chest height against a softly "
        + "blurred outdoor background, photographed from a front three-quarter angle so the skinned front "
        + "plate and the top plate both read clearly and the camera dominates the frame. A single adult "
        + "hand holds the device, cropped at the wrist, skin tone neutral, nails plain and short, fingers "
        + "placed so they cover as little of the design as possible. A vinyl skin covers the front plate "
        + "and the top plate. {{fidelity}} The skin is die-cut to the exact shape of the SONY wordmark on "
        + "the viewfinder hump: the vinyl runs continuously across the top plate and stops only at the "
        + "letterforms, leaving the raised SONY lettering bare. There is no rectangle, no plate, no panel "
        + "and no border around the wordmark \u2014 the pattern touches the letters directly. The lens mount, "
        + "dials and rear screen stay uncovered. {{staging}} ",
  },
  {
    label: "20W charger \u2014 front + angle",
    gadget: "charger",
    suffix: "charger",
    skuCodes: ["CH"],
    order: 0,
    isActive: true,
    prompt:
      "Two views of the same small white Apple 20W USB-C power adapter arranged side by side in one "
        + "photograph on a light oak desk: on the left the flat front face square to the camera, on the "
        + "right the same adapter turned to a three-quarter angle so a side face and the two round "
        + "Indian-standard pins are visible. Shot close so the pair fills the frame. A vinyl skin covers "
        + "the front face and the visible side faces of both. {{fidelity}} The artwork bends around the "
        + "rounded edges and stays sharp at this close distance. The USB-C port and the two round metal "
        + "pins stay uncovered, with the vinyl stopping cleanly at their edges. Behind, well out of "
        + "focus, a loosely coiled white cable. No people and no hands anywhere in the frame. {{staging}} ",
  },
  {
    label: "MacBook charger \u2014 front + angle",
    gadget: "charger",
    suffix: "charger-macbook",
    skuCodes: ["CH"],
    order: 1,
    isActive: true,
    prompt:
      "Two views of the same large square white Apple MacBook USB-C power adapter arranged side by "
        + "side in one photograph on a light oak desk: on the left the flat front face square to the "
        + "camera, on the right the same adapter turned to a three-quarter angle so a side face and the "
        + "folded Indian-standard pin attachment are visible. Shot so the pair fills the frame. A vinyl "
        + "skin covers the front face and the visible side faces of both. {{fidelity}} The skin is "
        + "die-cut to the exact silhouette of the Apple logo: the vinyl pattern runs continuously across "
        + "the whole panel and stops only at the outline of the logo itself, leaving just that apple "
        + "shape as bare metal. There is no circle, no ring, no disc, no rounded plate and no border of "
        + "any kind around the logo \u2014 the pattern touches the logo outline directly on every side. The "
        + "USB-C port and the metal pins stay uncovered, with the vinyl stopping cleanly at their edges. "
        + "Behind, well out of focus, a coiled white USB-C cable. No people and no hands anywhere in the "
        + "frame. {{staging}} ",
  },
  {
    label: "Held in fingers",
    gadget: "charger",
    suffix: "charger-hand",
    skuCodes: ["CH"],
    order: 2,
    isActive: true,
    prompt:
      "A small white Apple 20W USB-C power adapter held between the thumb and forefinger of one hand "
        + "against a softly blurred indoor background, photographed close up so the adapter dominates the "
        + "frame and its real size against the fingers is obvious. A single adult hand holds the device, "
        + "cropped at the wrist, skin tone neutral, nails plain and short, fingers placed so they cover "
        + "as little of the design as possible. A vinyl skin covers the front and visible side faces. "
        + "{{fidelity}} The USB-C port and the two round Indian-standard pins stay uncovered. {{staging}} ",
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
        + "cover both outer side panels. {{fidelity}} The artwork follows the curved contour of the "
        + "panels and the pattern bends with them. The central black body, the disc slot, the ports and "
        + "the base stand all stay uncovered, with the vinyl stopping cleanly at their edges. Behind it, "
        + "dim and far out of focus, a dark living-room wall with a hint of warm lamp light and a "
        + "controller resting on the unit. {{staging}} ",
  },
  {
    label: "Angled \u2014 side panel detail",
    gadget: "console",
    suffix: "ps5-angle",
    skuCodes: ["PS5"],
    order: 1,
    isActive: true,
    prompt:
      "A PlayStation 5 console standing vertically on a low wooden media unit, photographed from a "
        + "low side three-quarter angle close to the console so one skinned side panel sweeps across the "
        + "frame and its curve and the texture of the vinyl are clearly visible. A vinyl skin covers the "
        + "outer side panel. {{fidelity}} The artwork follows the curve of the panel. The central black "
        + "body, the disc slot and the ports stay uncovered, with the vinyl stopping cleanly at their "
        + "edges. Behind, dim and far out of focus, a dark living-room wall with warm lamp light. No "
        + "people and no hands anywhere in the frame. {{staging}} ",
  },
  {
    label: "Drone only",
    gadget: "drone",
    suffix: "drone",
    skuCodes: ["DRO", "DRON"],
    order: 0,
    isActive: true,
    prompt:
      "A compact folding camera drone sitting on a light concrete surface with its arms unfolded, "
        + "photographed from a front three-quarter angle slightly above so the top of the body, the arms "
        + "and the gimbal camera all read clearly and the drone dominates the frame. A vinyl skin covers "
        + "the top shell of the body and the top of each arm. {{fidelity}} The artwork follows the curve "
        + "of the shell and continues onto the arms as one design. The gimbal camera and its lens, the "
        + "propellers, the sensors underneath and the battery release stay uncovered, with the vinyl "
        + "stopping cleanly at their edges. Behind it, far out of focus, an open sky and a hint of green "
        + "landscape. No people and no hands anywhere in the frame. {{staging}} ",
  },
  {
    label: "Drone + RC controller",
    gadget: "drone",
    suffix: "drone-rc",
    skuCodes: ["DRC", "DROC"],
    order: 1,
    isActive: true,
    prompt:
      "A compact folding camera drone and its matching remote controller arranged together on a light "
        + "concrete surface, the drone behind with arms unfolded and the controller in front, "
        + "photographed from a front three-quarter angle slightly above so both fill the frame as one "
        + "group. A matching vinyl skin covers the top shell of the drone and the back of the controller. "
        + "{{fidelity}} The pattern reads as the same design across both pieces. The gimbal camera, the "
        + "propellers, the controller sticks, its screen and its buttons stay uncovered, with the vinyl "
        + "stopping cleanly at their edges. Behind, far out of focus, open sky. No people and no hands "
        + "anywhere in the frame. {{staging}} ",
  },
  {
    label: "Held in hand",
    gadget: "drone",
    suffix: "drone-hand",
    skuCodes: ["DRO", "DRON"],
    order: 2,
    isActive: true,
    prompt:
      "A compact folding camera drone held in one hand with its arms folded, against a softly blurred "
        + "outdoor background, photographed so the skinned top shell faces the camera and the drone "
        + "dominates the frame. A single adult hand holds the device, cropped at the wrist, skin tone "
        + "neutral, nails plain and short, fingers placed so they cover as little of the design as "
        + "possible. A vinyl skin covers the top shell and the top of each folded arm. {{fidelity}} The "
        + "gimbal camera and the propellers stay uncovered. {{staging}} ",
  },
  {
    label: "Lid only",
    gadget: "laptop",
    suffix: "laptop-top",
    skuCodes: ["LP", "LPT", "LAP"],
    order: 0,
    isActive: true,
    prompt:
      "A modern 14-inch MacBook-style aluminium laptop resting on a light oak desk, opened just far "
        + "enough \u2014 about 20 degrees \u2014 that the hinge and the edge of the screen are visible, "
        + "photographed from slightly above and in front so the whole outer lid faces the camera and "
        + "fills most of the frame while still reading unmistakably as a laptop: visible chassis "
        + "thickness, rounded corners, hinge and a sliver of the dark screen. The entire outer lid is "
        + "covered edge to edge with a vinyl skin. {{fidelity}} The skin is die-cut to the exact "
        + "silhouette of the Apple logo: the vinyl pattern runs continuously across the entire lid and "
        + "stops only at the outline of the logo itself, leaving just that apple shape as bare aluminium. "
        + "There is no circle, no ring, no disc, no rounded plate and no border of any kind around the "
        + "logo \u2014 the pattern touches the logo outline directly on every side. The skin follows the lid "
        + "rounded corners and stops cleanly at the edges. Around the laptop, a few softly out-of-focus "
        + "props placed off to the sides \u2014 a small green plant, a closed notebook, a ceramic mug \u2014 muted "
        + "and low-contrast so they frame the laptop without competing with the design. {{staging}} ",
  },
  {
    label: "Keyboard deck \u2014 top down",
    gadget: "laptop",
    suffix: "laptop-open",
    skuCodes: ["LPK"],
    order: 1,
    isActive: true,
    prompt:
      "A modern 14-inch MacBook-style aluminium laptop open on a light oak desk, photographed "
        + "straight down from directly above the keyboard, camera parallel to the desk, so the keyboard "
        + "deck and palm rest fill the frame and the open screen is foreshortened along the top edge of "
        + "the picture. A vinyl skin covers the whole keyboard deck: the palm rest, the area around the "
        + "trackpad, and the flat surface between and around every single key, so the pattern reads as "
        + "one continuous design running through the gaps in the keyboard. {{fidelity}} The keycaps "
        + "themselves stay bare with their normal legends, and the trackpad, the speaker grilles on "
        + "either side of the keyboard and the power button stay completely uncovered \u2014 the vinyl stops "
        + "cleanly at their edges. Around the laptop, a few softly out-of-focus props at the edges of the "
        + "frame \u2014 a small green plant, a closed notebook, a ceramic mug \u2014 muted and low-contrast so they "
        + "frame the laptop without competing with the design. {{staging}} ",
  },
  {
    label: "Held \u2014 closed, carried",
    gadget: "laptop",
    suffix: "laptop-hand",
    skuCodes: ["LP", "LPT", "LAP"],
    order: 2,
    isActive: true,
    prompt:
      "A closed 14-inch MacBook-style aluminium laptop held upright in one hand against a softly "
        + "blurred indoor background, as if being carried, photographed from the front so the skinned lid "
        + "faces the camera and fills most of the frame at a slight angle. A single adult hand holds the "
        + "device, cropped at the wrist, skin tone neutral, nails plain and short, fingers placed so they "
        + "cover as little of the design as possible. The lid is covered edge to edge with a vinyl skin. "
        + "{{fidelity}} The skin is die-cut to the exact silhouette of the Apple logo: the vinyl pattern "
        + "runs continuously across the whole panel and stops only at the outline of the logo itself, "
        + "leaving just that apple shape as bare metal. There is no circle, no ring, no disc, no rounded "
        + "plate and no border of any kind around the logo \u2014 the pattern touches the logo outline "
        + "directly on every side. {{staging}} ",
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
        + "from a front three-quarter angle at lens height so the barrel dominates the frame. A vinyl "
        + "skin is wrapped around the cylindrical barrel. {{fidelity}} The artwork curves realistically "
        + "around the barrel with correct perspective, and the pattern compresses slightly towards the "
        + "left and right edges the way a wrap on a cylinder does. The front glass element with its "
        + "reflections, the focus and zoom ring markings, and the metal mount all stay uncovered, with "
        + "the vinyl stopping cleanly at their edges. Behind and to the side, well out of focus, a camera "
        + "body and a coiled leather strap suggest a photographer desk without drawing the eye. "
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
      "A Sony full-frame telephoto camera lens held horizontally in one hand against a softly blurred "
        + "indoor background, photographed side on so the wrapped barrel runs across the frame and "
        + "dominates it. A single adult hand holds the device, cropped at the wrist, skin tone neutral, "
        + "nails plain and short, fingers placed so they cover as little of the design as possible. A "
        + "vinyl skin is wrapped around the cylindrical barrel. {{fidelity}} The artwork curves around "
        + "the barrel and compresses towards the top and bottom edges the way a wrap on a cylinder does. "
        + "The front glass, the focus and zoom ring markings and the metal mount stay uncovered. "
        + "{{staging}} ",
  },
  {
    label: "iPad \u2014 back",
    gadget: "tablet",
    suffix: "ipad",
    skuCodes: ["IPAD", "TAB"],
    order: 0,
    isActive: true,
    prompt:
      "An 11-inch tablet lying face down on a light oak desk, photographed from directly overhead "
        + "with the camera square to the desk so the back panel is perfectly straight in the frame, edges "
        + "parallel to the picture edges, no tilt and no perspective skew. A vinyl skin covers the back "
        + "edge to edge. {{fidelity}} The skin is die-cut to the exact silhouette of the Apple logo: the "
        + "vinyl pattern runs continuously across the whole panel and stops only at the outline of the "
        + "logo itself, leaving just that apple shape as bare metal. There is no circle, no ring, no "
        + "disc, no rounded plate and no border of any kind around the logo \u2014 the pattern touches the "
        + "logo outline directly on every side. The skin follows the rounded corners and has a clean "
        + "cutout around the rear camera module, with the camera lenses and the metal edges left "
        + "uncovered. At the very edges of the frame, softly out of focus, a stylus and a ceramic mug "
        + "suggest a desk without drawing the eye. No people and no hands anywhere in the frame. "
        + "{{staging}} ",
  },
  {
    label: "Held in hand",
    gadget: "tablet",
    suffix: "ipad-hand",
    skuCodes: ["IPAD", "TAB"],
    order: 1,
    isActive: true,
    prompt:
      "An 11-inch tablet held in one hand with the skinned back panel facing the camera, against a "
        + "softly blurred indoor background, photographed at a slight angle so the thin chassis edge is "
        + "visible and the tablet dominates the frame. A single adult hand holds the device, cropped at "
        + "the wrist, skin tone neutral, nails plain and short, fingers placed so they cover as little of "
        + "the design as possible. A vinyl skin covers the back edge to edge. {{fidelity}} The skin is "
        + "die-cut to the exact silhouette of the Apple logo: the vinyl pattern runs continuously across "
        + "the whole panel and stops only at the outline of the logo itself, leaving just that apple "
        + "shape as bare metal. There is no circle, no ring, no disc, no rounded plate and no border of "
        + "any kind around the logo \u2014 the pattern touches the logo outline directly on every side. The "
        + "rear camera module has a clean cutout and the metal edges stay uncovered. {{staging}} ",
  },
];
