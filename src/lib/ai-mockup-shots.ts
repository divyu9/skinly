/**
 * The shots the AI mockup studio can generate, one per product image we need.
 *
 * These are defaults, not the source of truth: the studio merges any document
 * in `gadgetMockupPrompts` with a matching `key` over the top, so prompts stay
 * editable from the admin without a deploy. Editing writes an override; the
 * "Reset" button deletes it and this text comes back.
 *
 * Every prompt is written for `nano-banana-edit`, which takes the raw design
 * photo as a reference image. The wording leans hard on reproducing the supplied
 * pattern exactly, because the customer receives the printed design and any
 * drift between the listing and the product is a return.
 */

export interface MockupShot {
  key: string;
  label: string;
  /** Matches gadgetTypes.name so generated images can be routed to products. */
  gadget: string;
  /** Appended to the R2 filename after the roll number: R-01-laptop-top.webp */
  suffix: string;
  model: string;
  size: string;
  prompt: string;
}

const FIDELITY =
  "The supplied reference image is a photograph of the printed vinyl design. " +
  "Reproduce that exact artwork on the skin: same colours, same motifs, same scale and spacing. " +
  "Do not invent, restyle, recolour or substitute the pattern. " +
  "Ignore the lighting, glare, shadows, background, curl and perspective of the reference photo — " +
  "extract only the flat artwork from it and apply it cleanly to the device.";

const STAGING =
  "Photorealistic commercial product photograph. Soft, even studio lighting, gentle contact shadow, " +
  "clean uncluttered light neutral background. Sharp focus, true-to-life colour, no text, no watermark, " +
  "no logos other than those naturally on the device, no people, no hands.";

export const MOCKUP_SHOTS: MockupShot[] = [
  {
    key: "laptop-top",
    label: "Laptop — lid only",
    gadget: "laptop",
    suffix: "laptop-top",
    model: "nano-banana-edit",
    size: "4:3",
    prompt:
      "A closed modern 14-inch laptop photographed straight down from directly above, lid facing the camera and filling most of the frame. " +
      "The entire lid is covered edge to edge with a vinyl skin. " +
      FIDELITY +
      " The skin follows the lid's rounded corners and stops cleanly at the edges. " +
      STAGING,
  },
  {
    key: "laptop-keyboard",
    label: "Laptop — open, lid + keyboard deck",
    gadget: "laptop",
    suffix: "laptop-open",
    model: "nano-banana-edit",
    size: "4:3",
    prompt:
      "A modern 14-inch laptop open at roughly 110 degrees, shot from a three-quarter front angle so both the outer lid and the keyboard deck are visible. " +
      "A vinyl skin covers the outer lid and a matching skin covers the palm rest area around the keyboard. " +
      FIDELITY +
      " Keys and trackpad stay uncovered and clearly visible. The screen is off and dark. " +
      STAGING,
  },
  {
    key: "lens-sony",
    label: "Lens — Sony telephoto",
    gadget: "lens",
    suffix: "lens",
    model: "nano-banana-edit",
    size: "1:1",
    prompt:
      "A Sony full-frame camera lens standing upright, photographed from the front three-quarter angle. " +
      "A vinyl skin is wrapped around the cylindrical barrel of the lens. " +
      FIDELITY +
      " The artwork curves realistically around the barrel with correct perspective and shading. " +
      "The front glass element, focus ring markings and mount stay uncovered. " +
      STAGING,
  },
  {
    key: "camera-a7iv",
    label: "Camera — Sony A7 IV body",
    gadget: "camera",
    suffix: "camera",
    model: "nano-banana-edit",
    size: "4:3",
    prompt:
      "A Sony A7 IV mirrorless camera body without a lens attached, photographed from a front three-quarter angle. " +
      "A vinyl skin covers the front and top plate of the camera body. " +
      FIDELITY +
      " The artwork wraps around the grip with correct curvature. " +
      "The lens mount, buttons, dials, viewfinder and screen stay uncovered. " +
      STAGING,
  },
  {
    key: "ps5",
    label: "PlayStation 5 console",
    gadget: "console",
    suffix: "ps5",
    model: "nano-banana-edit",
    size: "4:3",
    prompt:
      "A PlayStation 5 console standing vertically, photographed from a front three-quarter angle. " +
      "Vinyl skins cover both outer side panels. " +
      FIDELITY +
      " The artwork follows the curved contour of the panels. " +
      "The central black body, disc slot and ports stay uncovered. " +
      STAGING,
  },
  {
    key: "ipad",
    label: "iPad — back",
    gadget: "tablet",
    suffix: "ipad",
    model: "nano-banana-edit",
    size: "3:4",
    prompt:
      "An 11-inch tablet lying face down, photographed straight down from directly above so the whole back panel fills the frame. " +
      "A vinyl skin covers the back edge to edge. " +
      FIDELITY +
      " The skin follows the rounded corners, with a clean cutout around the rear camera module. " +
      STAGING,
  },
  {
    key: "charger-20w",
    label: "Charger — Apple 20W USB-C",
    gadget: "charger",
    suffix: "charger",
    model: "nano-banana-edit",
    size: "1:1",
    prompt:
      "A small square white 20W USB-C power adapter standing upright, photographed from a front three-quarter angle, filling most of the frame. " +
      "A vinyl skin covers the front and side faces of the adapter. " +
      FIDELITY +
      " The artwork bends around the adapter's rounded edges. " +
      "The USB-C port and the folding prongs stay uncovered. " +
      STAGING,
  },
];

export const SHOT_BY_KEY = Object.fromEntries(MOCKUP_SHOTS.map((s) => [s.key, s]));

/** R-01 + laptop-top -> R-01-laptop-top. Kept ASCII-safe for use as an R2 key. */
export function mockupFileStem(rNumber: string, suffix: string, attempt = 1): string {
  const roll = rNumber.trim().toUpperCase().replace(/[^A-Z0-9-]/g, "");
  const base = `${roll}-${suffix}`;
  return attempt > 1 ? `${base}-v${attempt}` : base;
}
