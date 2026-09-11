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
    label: "20W charger \u2014 two angles",
    gadget: "charger",
    suffix: "charger",
    skuCodes: ["CH"],
    order: 0,
    isActive: true,
    prompt:
      "Two Apple 20W USB-C power adapters on a light oak desk, the same product shown from two "
        + "different sides: one in front turned to a three-quarter angle so its flat front face with the "
        + "single oval USB-C port is towards the camera, and one behind it, smaller in frame and rotated "
        + "away, showing its top face with the two round Indian-standard pins standing up. Each is a "
        + "small glossy white rounded-rectangle brick roughly the size of a matchbox. A vinyl skin covers "
        + "the large flat front and back faces. {{fidelity}} The skin is a thin die-cut vinyl sheet "
        + "applied only to the flat faces. It does not wrap over the rounded corners or the curved edges, "
        + "which stay bare glossy white plastic, and a clean straight cut edge is visible where the vinyl "
        + "ends. Real manufactured product, correct real-world proportions, crisp geometry, no melted or "
        + "warped edges, no smeared detail, nothing duplicated or mirrored. The USB-C port and the two "
        + "round metal pins stay completely uncovered. The two adapters sit at different distances with "
        + "their own separate shadows so they read as two photographs of one product, not a copy-paste. "
        + "No people and no hands anywhere in the frame. {{staging}} ",
  },
  {
    label: "MacBook charger \u2014 two angles",
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
        + "square faces. {{fidelity}} The skin is die-cut to the exact silhouette of the Apple logo: the "
        + "vinyl runs continuously across the face and stops only at the outline of the logo, leaving "
        + "just that apple shape bare. There is no circle, no ring, no disc, no plate and no border of "
        + "any kind around it. The skin is a thin die-cut vinyl sheet applied only to the flat faces. It "
        + "does not wrap over the rounded corners or the curved edges, which stay bare glossy white "
        + "plastic, and a clean straight cut edge is visible where the vinyl ends. Real manufactured "
        + "product, correct real-world proportions, crisp geometry, no melted or warped edges, no smeared "
        + "detail, nothing duplicated or mirrored. The USB-C port and the metal pins stay completely "
        + "uncovered. The two adapters sit at different distances with their own separate shadows so they "
        + "read as two photographs of one product, not a copy-paste. No people and no hands anywhere in "
        + "the frame. {{staging}} ",
  },
  {
    label: "20W charger \u2014 held",
    gadget: "charger",
    suffix: "charger-hand",
    skuCodes: ["CH"],
    order: 2,
    isActive: true,
    prompt:
      "A single Apple 20W USB-C power adapter held upright between the thumb and forefinger of one "
        + "hand against a softly blurred indoor background, shot close so its real size against the "
        + "fingers is obvious. It is a small glossy white rounded-rectangle brick with one oval USB-C "
        + "port on the front face and two round Indian-standard pins on top. A vinyl skin covers the flat "
        + "front face. {{fidelity}} The skin is a thin die-cut vinyl sheet applied only to the flat "
        + "faces. It does not wrap over the rounded corners or the curved edges, which stay bare glossy "
        + "white plastic, and a clean straight cut edge is visible where the vinyl ends. Real "
        + "manufactured product, correct real-world proportions, crisp geometry, no melted or warped "
        + "edges, no smeared detail, nothing duplicated or mirrored. A single adult hand holds it, "
        + "cropped at the wrist, skin tone neutral, nails plain and short, fingers placed so they cover "
        + "as little of the design as possible. The USB-C port and the two round pins stay completely "
        + "uncovered. {{staging}} ",
  },
  {
    label: "PS5 \u2014 standing",
    gadget: "console",
    suffix: "ps5",
    skuCodes: ["PS5"],
    order: 0,
    isActive: true,
    prompt:
      "A PlayStation 5 console standing vertically on its round base on a low wooden media unit, "
        + "photographed from a front three-quarter angle at console height so one faceplate faces the "
        + "camera, the black centre column is visible down the middle and the other plate is "
        + "foreshortened. A vinyl skin covers the two curved outer faceplates. {{fidelity}} The artwork "
        + "follows the curve of each plate. The skin is die-cut to the exact shape of the PlayStation "
        + "logo on the upper faceplate: the pattern runs continuously and stops only at the letterform, "
        + "leaving it bare, with no circle, plate or border around it. The vinyl covers only the "
        + "outward-facing surface of the two removable faceplates. It does not wrap around their edges: "
        + "the inward-facing inner side of each faceplate stays bare factory white, showing as a clean "
        + "white strip along both sides of the centre column, and a crisp cut edge is visible where the "
        + "vinyl ends. The black centre chassis between the plates is never skinned, and neither are the "
        + "blue light strip, the disc slot, the ports, the power and eject buttons, the SONY and "
        + "PlayStation lettering or the base stand. Real manufactured product, correct real-world "
        + "proportions, crisp geometry, no melted or warped edges. Behind it, dim and far out of focus, a "
        + "dark living-room wall with a hint of warm lamp light. No people and no hands anywhere in the "
        + "frame. {{staging}} ",
  },
  {
    label: "PS5 Slim \u2014 gaming setup",
    gadget: "console",
    suffix: "ps5-angle",
    skuCodes: ["PS5"],
    order: 1,
    isActive: true,
    prompt:
      "A PlayStation 5 Slim console lying flat and horizontal on a TV media unit below a large "
        + "wall-mounted screen, photographed from a low front three-quarter angle so the gaming corner is "
        + "readable and the console still dominates the frame. The Slim is the shorter, squarer console "
        + "with a split faceplate and a straight profile rather than the tall curved original. A vinyl "
        + "skin covers its outer faceplates. {{fidelity}} The vinyl covers only the outward-facing "
        + "surface of the two removable faceplates. It does not wrap around their edges: the "
        + "inward-facing inner side of each faceplate stays bare factory white, showing as a clean white "
        + "strip along both sides of the centre column, and a crisp cut edge is visible where the vinyl "
        + "ends. The black centre chassis between the plates is never skinned, and neither are the blue "
        + "light strip, the disc slot, the ports, the power and eject buttons, the SONY and PlayStation "
        + "lettering or the base stand. Real manufactured product, correct real-world proportions, crisp "
        + "geometry, no melted or warped edges. The room is evening-dark: the TV glows faintly, a strip "
        + "of blue and purple LED light runs behind the unit, and a DualSense controller lies beside the "
        + "console, all well out of focus. No people and no hands anywhere in the frame. {{staging}} ",
  },
  {
    label: "PS5 + controller \u2014 set",
    gadget: "console",
    suffix: "ps5-set",
    skuCodes: ["PS5"],
    order: 2,
    isActive: true,
    prompt:
      "A PlayStation 5 console standing vertically beside its DualSense controller, both facing the "
        + "camera against a clean white studio background, photographed straight on so the console fills "
        + "the left of the frame and the controller sits to its right at the lower third, the pair "
        + "reading as one matching set. A matching vinyl skin covers the console's two outer faceplates "
        + "and the two curved outer grips of the controller. {{fidelity}} The pattern reads as the same "
        + "design across both. The skin is die-cut to the exact shape of the PlayStation logo on the "
        + "upper faceplate: the pattern runs continuously and stops only at the letterform, leaving it "
        + "bare, with no circle, plate or border around it. The vinyl covers only the outward-facing "
        + "surface of the two removable faceplates. It does not wrap around their edges: the "
        + "inward-facing inner side of each faceplate stays bare factory white, showing as a clean white "
        + "strip along both sides of the centre column, and a crisp cut edge is visible where the vinyl "
        + "ends. The black centre chassis between the plates is never skinned, and neither are the blue "
        + "light strip, the disc slot, the ports, the power and eject buttons, the SONY and PlayStation "
        + "lettering or the base stand. On the controller the white front plate around the touchpad stays "
        + "bare, as do the D-pad, the face buttons, the thumbsticks, the touchpad and the light bar \u2014 the "
        + "vinyl covers only the outer shell of the two grips and stops with a clean edge where the white "
        + "plate begins. Real manufactured product, correct real-world proportions, crisp geometry, no "
        + "melted or warped edges. No people and no hands anywhere in the frame. {{staging}} ",
  },
  {
    label: "Series X \u2014 console",
    gadget: "console",
    suffix: "xbox-x",
    skuCodes: ["XBX"],
    order: 3,
    isActive: true,
    prompt:
      "A matte black Xbox Series X console standing upright on a low wooden media unit, photographed "
        + "from a front three-quarter angle at console height so the tall rectangular tower dominates the "
        + "frame. A vinyl skin covers the four flat outer side faces. {{fidelity}} The vinyl is a thin "
        + "die-cut sheet on the outward-facing flat surfaces only. It does not wrap around edges or into "
        + "recesses, which stay factory colour, and a crisp cut edge is visible where it ends. The black "
        + "circular ventilation grille on the top with its green interior, the disc slot, the front USB "
        + "port, the power button and the rubber foot all stay uncovered. Behind, dim and far out of "
        + "focus, a dark living-room wall with warm lamp light. Real manufactured product, correct "
        + "real-world proportions, crisp geometry, no melted or warped edges. No people and no hands "
        + "anywhere in the frame. {{staging}} ",
  },
  {
    label: "Series X + controllers",
    gadget: "console",
    suffix: "xbox-x-set",
    skuCodes: ["XBXC", "XBXC1", "XBXC2", "XBXCL1", "XBXCL2"],
    order: 4,
    isActive: true,
    prompt:
      "A matte black Xbox Series X console standing upright with two matching Xbox wireless "
        + "controllers in front of it, one on each side, against a clean white studio background, "
        + "photographed straight on so the group reads as one matching set and fills the frame. A "
        + "matching vinyl skin covers the console's four flat outer side faces and the outer shell of "
        + "both controllers. {{fidelity}} The pattern reads as the same design across all three pieces. "
        + "The vinyl is a thin die-cut sheet on the outward-facing flat surfaces only. It does not wrap "
        + "around edges or into recesses, which stay factory colour, and a crisp cut edge is visible "
        + "where it ends. On each controller the vinyl covers only the outer shell of the top face and "
        + "the two grips. The thumbsticks, the D-pad, the A/B/X/Y buttons, the triggers, the bumpers and "
        + "the centre Xbox button all stay bare, with the vinyl stopping cleanly around them. The "
        + "console's top ventilation grille, disc slot and ports stay uncovered. Real manufactured "
        + "product, correct real-world proportions, crisp geometry, no melted or warped edges. No people "
        + "and no hands anywhere in the frame. {{staging}} ",
  },
  {
    label: "Series S \u2014 console",
    gadget: "console",
    suffix: "xbox-s",
    skuCodes: ["XBXS", "XBS"],
    order: 5,
    isActive: true,
    prompt:
      "A white Xbox Series S console lying flat and horizontal on a low wooden media unit, "
        + "photographed from a front three-quarter angle slightly above so the wide flat body and the "
        + "large black circular grille on its top face both read clearly and the console dominates the "
        + "frame. A vinyl skin covers the flat white outer faces around the grille. {{fidelity}} The "
        + "vinyl is a thin die-cut sheet on the outward-facing flat surfaces only. It does not wrap "
        + "around edges or into recesses, which stay factory colour, and a crisp cut edge is visible "
        + "where it ends. The black circular grille, the front USB port, the power button and the rear "
        + "ports all stay uncovered, with the vinyl cut cleanly around the grille. Behind, dim and far "
        + "out of focus, a dark living-room wall with warm lamp light. Real manufactured product, correct "
        + "real-world proportions, crisp geometry, no melted or warped edges. No people and no hands "
        + "anywhere in the frame. {{staging}} ",
  },
  {
    label: "Series S + controllers",
    gadget: "console",
    suffix: "xbox-s-set",
    skuCodes: ["XBXSC", "XBXSC1", "XBXSC2", "XBXSCL1", "XBXSCL2"],
    order: 6,
    isActive: true,
    prompt:
      "A white Xbox Series S console lying flat with two matching Xbox wireless controllers arranged "
        + "in front of it, one on each side, against a clean white studio background, photographed from "
        + "slightly above so the group reads as one matching set and fills the frame. A matching vinyl "
        + "skin covers the console's flat outer faces and the outer shell of both controllers. "
        + "{{fidelity}} The pattern reads as the same design across all three pieces. The vinyl is a thin "
        + "die-cut sheet on the outward-facing flat surfaces only. It does not wrap around edges or into "
        + "recesses, which stay factory colour, and a crisp cut edge is visible where it ends. On each "
        + "controller the vinyl covers only the outer shell of the top face and the two grips. The "
        + "thumbsticks, the D-pad, the A/B/X/Y buttons, the triggers, the bumpers and the centre Xbox "
        + "button all stay bare, with the vinyl stopping cleanly around them. The console's black "
        + "circular grille and its ports stay uncovered, with the vinyl cut cleanly around the grille. "
        + "Real manufactured product, correct real-world proportions, crisp geometry, no melted or warped "
        + "edges. No people and no hands anywhere in the frame. {{staging}} ",
  },
  {
    label: "Xbox controller",
    gadget: "controller",
    suffix: "controller-xbox",
    skuCodes: ["CLX", "CLS", "CLO"],
    order: 0,
    isActive: true,
    prompt:
      "An Xbox wireless controller lying flat on a dark wooden surface, photographed from directly "
        + "above with the camera square to the surface so the controller is straight in frame with no "
        + "tilt and fills it. A vinyl skin covers the outer shell of the top face and the two grips. "
        + "{{fidelity}} The vinyl is a thin die-cut sheet on the outward-facing flat surfaces only. It "
        + "does not wrap around edges or into recesses, which stay factory colour, and a crisp cut edge "
        + "is visible where it ends. On each controller the vinyl covers only the outer shell of the top "
        + "face and the two grips. The thumbsticks, the D-pad, the A/B/X/Y buttons, the triggers, the "
        + "bumpers and the centre Xbox button all stay bare, with the vinyl stopping cleanly around them. "
        + "Real manufactured product, correct real-world proportions, crisp geometry, no melted or warped "
        + "edges. No people and no hands anywhere in the frame. {{staging}} ",
  },
  {
    label: "DualSense controller",
    gadget: "controller",
    suffix: "controller-ps5",
    skuCodes: ["PS5"],
    order: 1,
    isActive: true,
    prompt:
      "A PlayStation 5 DualSense controller lying flat on a dark wooden surface, photographed from "
        + "directly above with the camera square to the surface so the controller is straight in frame "
        + "with no tilt and fills it. A vinyl skin covers the outer shell of the two curved grips and the "
        + "outer top shoulders. {{fidelity}} The vinyl is a thin die-cut sheet on the outward-facing flat "
        + "surfaces only. It does not wrap around edges or into recesses, which stay factory colour, and "
        + "a crisp cut edge is visible where it ends. The white front plate around the touchpad stays "
        + "bare, as do the D-pad, the face buttons, the thumbsticks, the touchpad, the light bar and the "
        + "triggers \u2014 the vinyl stops with a clean edge where the white plate begins. Real manufactured "
        + "product, correct real-world proportions, crisp geometry, no melted or warped edges. No people "
        + "and no hands anywhere in the frame. {{staging}} ",
  },
  {
    label: "DualShock 4 controller",
    gadget: "controller",
    suffix: "controller-ps4",
    skuCodes: ["PS4"],
    order: 2,
    isActive: true,
    prompt:
      "A PlayStation 4 DualShock 4 controller lying flat on a dark wooden surface, photographed from "
        + "directly above with the camera square to the surface so the controller is straight in frame "
        + "with no tilt and fills it. A vinyl skin covers the outer shell of the top face and the two "
        + "grips. {{fidelity}} The vinyl is a thin die-cut sheet on the outward-facing flat surfaces "
        + "only. It does not wrap around edges or into recesses, which stay factory colour, and a crisp "
        + "cut edge is visible where it ends. The touchpad, the D-pad, the face buttons, the thumbsticks "
        + "and the light bar stay bare, with the vinyl stopping cleanly around them. Real manufactured "
        + "product, correct real-world proportions, crisp geometry, no melted or warped edges. No people "
        + "and no hands anywhere in the frame. {{staging}} ",
  },
  {
    label: "DualShock 3 controller",
    gadget: "controller",
    suffix: "controller-ps3",
    skuCodes: ["PS3"],
    order: 3,
    isActive: true,
    prompt:
      "A PlayStation 3 DualShock 3 controller lying flat on a dark wooden surface, photographed from "
        + "directly above with the camera square to the surface so the controller is straight in frame "
        + "with no tilt and fills it. A vinyl skin covers the outer shell of the top face and the two "
        + "grips. {{fidelity}} The vinyl is a thin die-cut sheet on the outward-facing flat surfaces "
        + "only. It does not wrap around edges or into recesses, which stay factory colour, and a crisp "
        + "cut edge is visible where it ends. The D-pad, the face buttons, the thumbsticks and the centre "
        + "PS button stay bare, with the vinyl stopping cleanly around them. Real manufactured product, "
        + "correct real-world proportions, crisp geometry, no melted or warped edges. No people and no "
        + "hands anywhere in the frame. {{staging}} ",
  },
  {
    label: "Drone only",
    gadget: "drone",
    suffix: "drone",
    skuCodes: ["DRO", "DRON"],
    order: 0,
    isActive: true,
    prompt:
      "A compact grey folding DJI camera drone on a light concrete surface with its four arms "
        + "unfolded, photographed from a front three-quarter angle slightly above so the top shell, the "
        + "arms and the gimbal camera all read clearly and the drone dominates the frame. A vinyl skin "
        + "covers the top shell of the body and the top of each arm. {{fidelity}} The artwork follows the "
        + "curve of the shell and continues onto the arms as one design. The skin is die-cut to the exact "
        + "shape of the DJI wordmark: the vinyl runs continuously across the shell and stops only at the "
        + "letterforms, leaving the bare DJI lettering showing through. There is no rectangle, no plate, "
        + "no panel and no border around the wordmark \u2014 the pattern touches the letters directly. The "
        + "gimbal camera and its lens, the propellers, the sensors underneath and the battery release "
        + "stay uncovered, with the vinyl stopping cleanly at their edges. Behind it, far out of focus, "
        + "open sky and a hint of green landscape. No people and no hands anywhere in the frame. "
        + "{{staging}} ",
  },
  {
    label: "Drone + controller \u2014 combo",
    gadget: "drone",
    suffix: "drone-rc",
    skuCodes: ["DRC", "DROC"],
    order: 1,
    isActive: true,
    prompt:
      "A compact grey folding DJI camera drone with its arms unfolded, and its remote controller, "
        + "arranged together on a light concrete surface \u2014 the drone behind, the controller in front and "
        + "slightly angled \u2014 photographed from a front three-quarter angle slightly above so the pair "
        + "fills the frame as one group. A matching vinyl skin covers the drone top shell and the flat "
        + "back panel of the controller. {{fidelity}} The pattern reads as the same design across both "
        + "pieces. The skin is die-cut to the exact shape of the DJI wordmark: the vinyl runs "
        + "continuously across the shell and stops only at the letterforms, leaving the bare DJI "
        + "lettering showing through. There is no rectangle, no plate, no panel and no border around the "
        + "wordmark \u2014 the pattern touches the letters directly. The gimbal camera, the propellers, the "
        + "controller's two removable control sticks, its front face, its screen and all its buttons stay "
        + "uncovered. Behind, far out of focus, open sky. No people and no hands anywhere in the frame. "
        + "{{staging}} ",
  },
  {
    label: "Controller \u2014 no display",
    gadget: "drone",
    suffix: "drone-rc-nodisplay",
    skuCodes: ["DRC", "DROC"],
    order: 2,
    isActive: true,
    prompt:
      "A DJI RC-N series remote controller lying flat on a light concrete surface, photographed from "
        + "directly above, camera square to the surface so the controller is straight in frame with no "
        + "tilt. This is the controller without a built-in screen: a wide grey rounded body with two "
        + "removable control sticks, a small DJI wordmark in the centre, a row of status LEDs, a power "
        + "button and a flight-mode switch, and folding clamp arms on top that hold a phone. A vinyl skin "
        + "covers the flat grey front face around the controls. {{fidelity}} The skin is die-cut to the "
        + "exact shape of the DJI wordmark: the vinyl runs continuously across the shell and stops only "
        + "at the letterforms, leaving the bare DJI lettering showing through. There is no rectangle, no "
        + "plate, no panel and no border around the wordmark \u2014 the pattern touches the letters directly. "
        + "The two control sticks, the buttons, the switch, the LEDs and the folding phone clamp stay "
        + "completely uncovered, with the vinyl stopping cleanly at their edges. No people and no hands "
        + "anywhere in the frame. {{staging}} ",
  },
  {
    label: "Controller \u2014 with display",
    gadget: "drone",
    suffix: "drone-rc-display",
    skuCodes: ["DRC", "DROC"],
    order: 3,
    isActive: true,
    prompt:
      "A DJI RC remote controller with a built-in screen, lying flat on a light concrete surface, "
        + "photographed from directly above, camera square to the surface so the controller is straight "
        + "in frame with no tilt. This is the controller with an integrated display: a wide grey rounded "
        + "body whose lower two thirds is a large dark glossy touchscreen, with two removable control "
        + "sticks above it, a power button, a flight-mode switch and a carry handle along the top edge. A "
        + "vinyl skin covers only the grey face above and around the screen. {{fidelity}} The skin is "
        + "die-cut to the exact shape of the DJI wordmark: the vinyl runs continuously across the shell "
        + "and stops only at the letterforms, leaving the bare DJI lettering showing through. There is no "
        + "rectangle, no plate, no panel and no border around the wordmark \u2014 the pattern touches the "
        + "letters directly. The screen stays completely bare and dark, and the control sticks, buttons, "
        + "switch and carry handle stay uncovered, with the vinyl stopping cleanly at the screen bezel. "
        + "No people and no hands anywhere in the frame. {{staging}} ",
  },
  {
    label: "Drone \u2014 held",
    gadget: "drone",
    suffix: "drone-hand",
    skuCodes: ["DRO", "DRON"],
    order: 4,
    isActive: true,
    prompt:
      "A compact grey folding DJI camera drone held in one hand with its arms folded against the "
        + "body, against a softly blurred outdoor background, photographed so the skinned top shell faces "
        + "the camera and the drone dominates the frame. A vinyl skin covers the top shell and the top of "
        + "each folded arm. {{fidelity}} The skin is die-cut to the exact shape of the DJI wordmark: the "
        + "vinyl runs continuously across the shell and stops only at the letterforms, leaving the bare "
        + "DJI lettering showing through. There is no rectangle, no plate, no panel and no border around "
        + "the wordmark \u2014 the pattern touches the letters directly. A single adult hand holds it, cropped "
        + "at the wrist, skin tone neutral, nails plain and short, fingers placed so they cover as little "
        + "of the design as possible. The gimbal camera and the propellers stay uncovered. {{staging}} ",
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
    label: "Mac Mini \u2014 top",
    gadget: "mac-mini",
    suffix: "macmini",
    skuCodes: ["MM"],
    order: 0,
    isActive: true,
    prompt:
      "An Apple Mac Mini sitting on a light oak desk, photographed from a front three-quarter angle "
        + "slightly above so the flat square top face and one aluminium side both read clearly and the "
        + "unit dominates the frame. It is a small flat square aluminium box with heavily rounded "
        + "corners. A vinyl skin covers the flat top face. {{fidelity}} The vinyl is a thin die-cut sheet "
        + "on the outward-facing flat surfaces only. It does not wrap around edges or into recesses, "
        + "which stay factory colour, and a crisp cut edge is visible where it ends. The skin is die-cut "
        + "to the exact silhouette of the Apple logo in the centre of the top: the pattern runs "
        + "continuously and stops only at the outline of the logo, leaving just that apple shape as bare "
        + "aluminium, with no circle, ring, disc, plate or border around it. The aluminium sides, the "
        + "rear ports, the power light and the round base stay uncovered. Beside it, softly out of focus, "
        + "a keyboard edge and a ceramic mug. Real manufactured product, correct real-world proportions, "
        + "crisp geometry, no melted or warped edges. No people and no hands anywhere in the frame. "
        + "{{staging}} ",
  },
  {
    label: "Mac Mini \u2014 held",
    gadget: "mac-mini",
    suffix: "macmini-hand",
    skuCodes: ["MM"],
    order: 1,
    isActive: true,
    prompt:
      "An Apple Mac Mini held flat on the open palm of one hand against a softly blurred indoor "
        + "background, photographed from slightly above so the skinned top face is towards the camera and "
        + "the unit dominates the frame, its real size against the hand obvious. A single adult hand, "
        + "cropped at the wrist, skin tone neutral, nails plain and short. A vinyl skin covers the flat "
        + "top face. {{fidelity}} The vinyl is a thin die-cut sheet on the outward-facing flat surfaces "
        + "only. It does not wrap around edges or into recesses, which stay factory colour, and a crisp "
        + "cut edge is visible where it ends. The skin is die-cut to the exact silhouette of the Apple "
        + "logo, leaving just that shape bare, with no circle or border around it. The aluminium sides "
        + "and the ports stay uncovered. Real manufactured product, correct real-world proportions, crisp "
        + "geometry, no melted or warped edges. {{staging}} ",
  },
  {
    label: "iPad \u2014 back",
    gadget: "tablet",
    suffix: "ipad",
    skuCodes: ["IPAD", "TAB", "TAB."],
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
