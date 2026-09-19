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
   * which view it is, so a shot can say it takes them.
   *
   * Two shots on the same gadget may both set it where both pictures belong on
   * that one listing — the iPhone and the Samsung are two photographs of one
   * phone skin. Do not set it on shots that show different products, or each
   * will attach its image to the other's listing.
   */
  matchSingleVariant?: boolean;
  /**
   * Which listing this image belongs to, within its gadget.
   *
   * One gadget can be several listings: under "console" a PS5 skin, an Xbox
   * Series X skin and an Xbox Series S skin are three products; under "drone"
   * the drone skin (Drone Only / Drone + RC) is one and a controller-only skin
   * (with or without display) is another. Each listing can want several
   * pictures, so the studio offers one "Create listing" per listing, not one
   * per picture. Unset means the default for the shot's file suffix, and
   * failing that, one listing for the whole gadget.
   */
  listing?: string;
  /**
   * A finished mockup whose camera angle, framing and skin coverage this shot
   * should copy — sent to the model as a second image. Its colours and
   * pattern are ignored.
   */
  referenceUrl?: string;
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
  //
  // Only cutouts come in Tranzy. Rolls are printed on opaque vinyl, so the
  // clause about white being peel-off backing is not merely unnecessary there —
  // it would tell the model to punch holes through a design that has none.
  // Relief applies to both: a roll can be 3D embossed just as a sheet can.
  const isCutout = vars.source === "cutout";
  const isTranzy = isCutout && /tranz|transparent|membrane/i.test(vars.finish || "");
  const isRelief = /3d|textur|emboss/i.test(vars.finish || "");
  const fidelity =
    (isCutout ? blocks.fidelityCutout : blocks.fidelity)
    + (isTranzy ? TRANZY_CLAUSE : "")
    + (isRelief ? RELIEF_CLAUSE : "");
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

/** Said first when a shot sends an angle reference alongside the design photo. */
export const REFERENCE_PREAMBLE =
  "Two images are supplied. The FIRST is the printed design to put on the device — it is the only source of "
  + "the artwork. The SECOND is a composition reference only: copy its camera angle, framing, the device's "
  + "pose and exactly how the skin covers the device, its camera area and its edges; ignore the second "
  + "image's colours, pattern, text and watermarks entirely. "
  // The reference is often a template photo, where the skinned surfaces have
  // been painted flat green. That is the most useful reference there is — it
  // draws the coverage exactly — as long as the green is read as a marking
  // and never as a colour.
  + "If that second image shows the device with some of its surfaces in flat bright green, the green is not "
  + "a colour to copy: it marks precisely which surfaces the skin covers and which stay bare. Put the "
  + "printed design on exactly those green surfaces, leave everything the reference leaves unpainted — its "
  + "ports, pins, buttons, lenses, grips and logo — exactly as it shows them, and put no green anywhere in "
  + "the picture. ";

/**
 * Said when the design image is the device's own piece of the roll, cut to
 * true size from a calibrated photo, rather than the whole roll.
 *
 * The measurements are spelled out: a model shown a 16 x 10 cm piece for a
 * controller and a 26 x 39 cm one for a console has nothing left to guess
 * about how big the motifs are.
 */
/**
 * Said before anything else: what the photograph is of.
 *
 * With a true-size crop the model is handed a flat rectangle of pattern and no
 * device at all, and on the cheapest quality setting it would sometimes keep
 * the staging and the skin but invent the object under them — a pair of
 * headphones or a vape wrapped in a laptop skin. Naming the gadget first, and
 * forbidding the substitution outright, is what a long prompt with the device
 * buried in a descriptive clause was not doing.
 */
export function deviceAnchor(gadget: string, listing?: string): string {
  const noun = (GADGET_NOUNS[String(gadget || "").toLowerCase()] || "device").toLowerCase();
  const named = listing && !new RegExp(noun, "i").test(listing) ? `${listing} ${noun}` : listing || noun;
  return `This photograph is of one ${named}, and of nothing else. The object in the frame is a ${noun}: `
    + `do not replace it with, or turn it into, any other product — no headphones, no speaker, no bottle, `
    + `no case, no box, no vape and no other gadget. If the instructions below conflict with that, the `
    + `${noun} wins. `;
}

export const TRUE_SIZE_CLAUSE = (widthCm: number, heightCm: number) =>
  `The design image is the exact piece of printed vinyl cut for this device: ${widthCm} cm by ${heightCm} cm `
  + "of the roll, at true size, already turned the way it sits on the device. That piece covers the device's "
  + "main skinned face. Keep every motif at exactly this size relative to the device, and in this "
  + "orientation — do not shrink, enlarge, rotate or add repeats of the pattern. Where the skin is cut into "
  + "several pieces, every piece is cut from this same stretch, so the motifs stay this size all over. ";

export const PLACEHOLDERS = ["fidelity", "staging", "rNumber", "designName", "cutOrientation"];

/** Where a design comes from. Rolls repeat; cutouts are one fixed artwork. */
export type DesignSource = "roll" | "cutout";

/**
 * Listings for the starter shots, by file suffix, for shots saved before the
 * listing field existed. Every gadget is now one listing per device brand
 * (see BRAND_LISTINGS); anything not named here falls back to the gadget.
 */
const LISTING_BY_SUFFIX: Record<string, string> = {
  "ps5": "PS5",
  "ps5-angle": "PS5",
  "ps5-set": "PS5",
  "switch": "Nintendo Switch",
  "controller-ps5": "PlayStation Controller",
  "controller-ps4": "PlayStation Controller",
  "controller-ps3": "PlayStation Controller",
  "controller-xbox": "Xbox Controller",
  "ipad": "Apple iPad",
  "ipad-hand": "Apple iPad",
  "samsung-tab": "Samsung Galaxy Tab",
  "xiaomi-pad": "Xiaomi Pad",
  "tablet-generic": "Tablet",
  "xbox-x": "Xbox Series X",
  "xbox-x-set": "Xbox Series X",
  "xbox-s": "Xbox Series S",
  "xbox-s-set": "Xbox Series S",
  "drone": "DJI Drone",
  "drone-rc": "DJI Drone",
  "drone-hand": "DJI Drone",
  "drone-rc-nodisplay": "DJI Drone Controller",
  "drone-rc-display": "DJI Drone Controller",
  "phone-iphone": "Apple iPhone",
  "phone-samsung": "Samsung Galaxy",
  "laptop-top": "MacBook",
  "laptop-top-nologo": "MacBook",
  "laptop-open": "MacBook",
  "laptop-hand": "MacBook",
  "charger": "Apple Charger",
  // The 20W port view is Apple's too. Unmapped, it fell back to the gadget's
  // own name and made an Apple charger photo for the unbranded Charger listing.
  "charger-port": "Apple Charger",
  "charger-macbook": "Apple Charger",
  "charger-hand": "Apple Charger",
  "camera": "Sony Camera",
  "camera-hand": "Sony Camera",
  "camera-lens": "Sony Camera",
  "lens": "Sony Lens",
  "lens-hand": "Sony Lens",
  "macmini": "Mac mini",
  "macmini-hand": "Mac mini",
};

const titleCase = (s: string) => s.replace(/(^|[\s-])(\w)/g, (_, a, b) => a + b.toUpperCase());

/** The listing a shot's image belongs to. */
export function listingOf(shot: Pick<MockupShot, "listing" | "suffix" | "gadget">): string {
  const own = String(shot.listing || "").trim();
  if (own) return own;
  // A duplicated shot carries a "-2" tail; it still belongs where its original does.
  const suffix = String(shot.suffix || "").toLowerCase().replace(/-\d+$/, "");
  return LISTING_BY_SUFFIX[suffix] || titleCase(String(shot.gadget || "other"));
}

export interface PresetVariant {
  /** SKU tail after the design code: R-12-PS5SDG. One segment, no dashes. */
  tail: string;
  title: string;
  price: number;
  /** Price when the design is 3D textured, where that costs more. */
  price3d?: number;
  materialMultiplier: number;
}

const bundle = (tail: string, name: string, prices: [number, number, number]): PresetVariant[] => [
  { tail, title: `${name} — Console`, price: prices[0], materialMultiplier: 1 },
  { tail: `${tail}C1`, title: `${name} + 1 Controller`, price: prices[1], materialMultiplier: 1 },
  { tail: `${tail}C2`, title: `${name} + 2 Controller`, price: prices[2], materialMultiplier: 1 },
];

const CONSOLE_PRICES: [number, number, number] = [799, 999, 1199];

/** A tablet skin is the back, or the back plus front bezel and charger. */
const tabletViews = (tail: string): PresetVariant[] => [
  { tail, title: "Only Back", price: 249, materialMultiplier: 1 },
  { tail: `${tail}F`, title: "Back + Front Bezel + Charger", price: 399, materialMultiplier: 1 },
];

/**
 * Which device brands a listing is for, so its model picker offers only
 * those. The "Tablet" listing is every tablet brand without its own listing.
 */
export const LISTING_SCOPES: Record<string, { modelBrands?: string[]; modelBrandsExclude?: string[] }> = {
  "apple ipad": { modelBrands: ["Apple"] },
  "samsung galaxy tab": { modelBrands: ["Samsung"] },
  "xiaomi pad": { modelBrands: ["Xiaomi", "Redmi", "Poco"] },
  "tablet": { modelBrandsExclude: ["Apple", "Samsung", "Xiaomi", "Redmi", "Poco"] },
  "ps5": { modelBrands: ["PlayStation", "Sony"] },
  "xbox series x": { modelBrands: ["Xbox", "Microsoft"] },
  "xbox series s": { modelBrands: ["Xbox", "Microsoft"] },
  "nintendo switch": { modelBrands: ["Nintendo"] },
  "playstation controller": { modelBrands: ["PlayStation", "Sony", "Snoy"] },
  "xbox controller": { modelBrands: ["Xbox", "Microsoft"] },
};

export const scopeFor = (listing: string) => LISTING_SCOPES[String(listing || "").trim().toLowerCase()];

/**
 * The fixed variant set for listings whose shape is decided, not copied.
 *
 * Consoles are one listing per family with the models as variants, each
 * sold alone or with one or two controller skins (the shape the Xbox listings
 * already use, at their prices). Controllers are one PlayStation and one Xbox
 * listing. The catalogue's older PS5 listings are a single "Default Title"
 * row, so copying the catalogue would repeat exactly that; these win.
 *
 * Keyed by listing name, lower-cased. Prices are starting points the admin
 * edits in the dialog.
 */
export const LISTING_PRESETS: Record<string, PresetVariant[]> = {
  "ps5": [
    ...bundle("PS5D", "PS5 Disc", CONSOLE_PRICES),
    ...bundle("PS5DG", "PS5 Digital", CONSOLE_PRICES),
    ...bundle("PS5SD", "PS5 Slim Disc", CONSOLE_PRICES),
    ...bundle("PS5SDG", "PS5 Slim Digital", CONSOLE_PRICES),
    ...bundle("PS5PRO", "PS5 Pro", CONSOLE_PRICES),
  ],
  "xbox series x": [
    { tail: "XBX", title: "Console", price: 799, materialMultiplier: 1 },
    { tail: "XBXCL1", title: "Console + 1 Controller", price: 999, materialMultiplier: 1 },
    { tail: "XBXCL2", title: "Console + 2 Controller", price: 1199, materialMultiplier: 1 },
  ],
  "xbox series s": [
    { tail: "XBXS", title: "Console", price: 799, materialMultiplier: 1 },
    { tail: "XBXSCL1", title: "Console + 1 Controller", price: 999, materialMultiplier: 1 },
    { tail: "XBXSCL2", title: "Console + 2 Controller", price: 1199, materialMultiplier: 1 },
  ],
  "nintendo switch": [
    ...bundle("NSW", "Switch", [599, 749, 899]),
    ...bundle("NSWO", "Switch OLED", [599, 749, 899]),
    ...bundle("NSW2", "Switch 2", [699, 849, 999]),
  ],
  "playstation controller": [
    { tail: "DS5", title: "PS5 DualSense", price: 399, materialMultiplier: 1 },
    { tail: "DS5E", title: "PS5 DualSense Edge", price: 449, materialMultiplier: 1 },
    { tail: "DS4", title: "PS4 DualShock 4", price: 399, materialMultiplier: 1 },
    { tail: "DS3", title: "PS3 Controller", price: 399, materialMultiplier: 1 },
  ],
  "apple ipad": tabletViews("IPAD"),
  "samsung galaxy tab": tabletViews("SGT"),
  "xiaomi pad": tabletViews("XPD"),
  "tablet": tabletViews("TABB"),
  "xbox controller": [
    { tail: "XBC", title: "Xbox Series X|S", price: 399, materialMultiplier: 1 },
    { tail: "XBC1", title: "Xbox One", price: 399, materialMultiplier: 1 },
  ],
};

export const presetFor = (listing: string) => LISTING_PRESETS[String(listing || "").trim().toLowerCase()];

/**
 * The SKU view codes an image for this shot may land on: the shot's own plus
 * its listing's preset tails, so a picture finds a listing made from the
 * preset as well as the older ones.
 */
export function shotCodes(shot: Pick<MockupShot, "skuCodes" | "listing" | "suffix" | "gadget">): string[] {
  const preset = presetFor(listingOf(shot)) || [];
  return [...new Set([...(shot.skuCodes || []), ...preset.map((p) => p.tail)].map((c) => c.toUpperCase()))];
}

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
/**
 * How a phone skin treats the camera module: it is skinned too.
 *
 * The first shots left the whole module bare, which is not the product — the
 * skin carries on over the raised module and only the lens glass, flash,
 * sensors and microphone show through small cut-outs.
 */
const CAMERA_COVERED =
  "The skin also covers the raised camera module: the same design carries on without a break up over "
  + "the module's top face and down its sides, so the module reads as part of the skinned back, not as a "
  + "bare island. Only small, precise holes are cut in it — a round hole exactly the size of each camera "
  + "lens's glass, and small holes for the flash, the sensors and the microphone. The lens glass and those "
  + "openings are the only uncovered parts of the back; the printed vinyl runs right up to the edge of "
  + "every lens. ";

/**
 * The phone pose every phone shot uses — the classic skin-shop product view:
 * the skinned back at a three-quarter turn with its side showing, and a second
 * identical phone behind it showing the front, so the shopper sees the device
 * whole and the skin's coverage at a glance.
 */
const PHONE_POSE = (device: string) =>
  `Two identical ${device} phones standing upright side by side on a light oak desk, photographed at eye `
  + "level. The phone in front shows its back, turned about thirty degrees so its right side frame is "
  + "visible; the phone just behind it and slightly to the left shows its front, the black screen turned "
  + "off, angled so its left side frame and buttons are visible. Both are sharp and fill most of the "
  + "frame, the back phone the larger and nearer of the two. The device itself is reproduced exactly as "
  + "manufactured — its true proportions, camera layout, corner radius and buttons — with nothing "
  + "redesigned. ";

const PHONE_COVERAGE =
  "The vinyl skin covers the whole back edge to edge and wraps around the rounded edges onto the side "
  + "frame of both phones, so the sides carry the same design; the buttons, ports and the screen stay "
  + "bare. {{fidelity}} {{cutOrientation}} ";

const LOGO_CUT = (logo: string) =>
  `The ${logo} is knocked out of the skin as negative space, a cut-out following its exact outline so the `
  + "phone's own finish shows through only that shape, with no plate or border around it. ";

const CHARGER_COVERAGE =
  "A vinyl skin covers the whole body — every flat face and the rounded edges between them — as one "
  + "continuous wrap with the design running across the edges. {{fidelity}} Only the metal pins and the "
  + "USB port opening are left unskinned, wherever on the body they happen to be, the vinyl cut cleanly "
  + "around them. The skin is thin and perfectly smooth, with no bubbles and no lift. ";

/**
 * Where a wall charger's openings are, said per view.
 *
 * An Indian adapter has its pins on one face and its USB port on the opposite
 * one, so a single view never shows both. Left unsaid, the model put a port on
 * the face it was pointing at whichever view was asked for, and every charger
 * came out with its port on the front.
 */
const PINS_VIEW =
  "The pins are on the face pointing away from the camera and only their metal tips show above the "
  + "body. The USB port is on the opposite face and is NOT visible in this view: the face towards the "
  + "camera is one unbroken surface with no port, no socket, no opening, no vent, no lettering and no "
  + "moulded detail of any kind on it. ";

const PORT_VIEW =
  "This is the face that carries the USB port, and it is the only opening in frame. The pins are on the "
  + "opposite face, pointing away from the camera, and are NOT visible in this view. ";

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
    label: "20W charger — pins view",
    gadget: "charger",
    suffix: "charger",
    skuCodes: ["CH"],
    matchSingleVariant: true,
    order: 0,
    isActive: true,
    prompt:
      "A single Apple 20W USB-C power adapter, Indian model with two round pins, standing upright on a light "
        + "oak desk and photographed straight on at its own height, the pins pointing straight up. It is a "
        + "small glossy white cuboid about 27 by 27 by 36 millimetres with softly rounded vertical edges, "
        + "reproduced exactly as manufactured. The broad front face fills the centre of the frame with the two "
        + "chrome pins rising from its top. " + PINS_VIEW + CHARGER_COVERAGE
        + "Soft daylight, a gentle contact shadow beneath it, a softly blurred plant and mug far behind. "
        + "No people and no hands anywhere in the frame. " + REAL + "{{staging}} ",
  },
  {
    label: "20W charger — port view",
    gadget: "charger",
    suffix: "charger-port",
    skuCodes: ["CH"],
    matchSingleVariant: true,
    order: 1,
    isActive: true,
    prompt:
      "A single Apple 20W USB-C power adapter lying on its back on a light oak desk and photographed straight "
        + "down at its bottom face, which fills the centre of the frame: a rounded rectangle with the single "
        + "oval USB-C port in the middle. It is reproduced exactly as manufactured, with softly rounded edges. "
        + PORT_VIEW + CHARGER_COVERAGE
        + "Soft daylight, a gentle shadow, the desk grain softly out of focus around it. No people and no hands "
        + "anywhere in the frame. " + REAL + "{{staging}} ",
  },
  {
    label: "MacBook charger",
    gadget: "charger",
    suffix: "charger-macbook",
    skuCodes: ["CH"],
    order: 2,
    isActive: true,
    prompt:
      "A single Apple MacBook USB-C power adapter with its detachable Indian-standard pin head fitted, standing "
        + "on a light oak desk and photographed straight on so its large square face fills the frame. It is a "
        + "thick glossy white square brick with softly rounded corners, reproduced exactly as manufactured. "
        + CHARGER_COVERAGE + LOGO_CUT("Apple logo in the centre of the face").replace("phone's", "adapter's")
        + "No people and no hands anywhere in the frame. " + REAL + "{{staging}} ",
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
        + "round pins on top. " + CHARGER_COVERAGE + "A single adult hand holds it, cropped at the wrist, skin tone neutral, nails plain and "
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
        + "way round their outer and under sides, the two shoulder humps, the front face panels on "
        + "either side of the touchpad and the touchpad itself, skinned over with the pattern running "
        + "straight across it — following every compound curve tightly with no bubbles, no lift and no "
        + "gaps of bare white left between panels. The D-pad, the face buttons, the thumbsticks, the "
        + "thin light bar strip, the triggers and the central PS button stay bare, with the vinyl "
        + "die-cut cleanly around each of them. No people and no hands anywhere in the frame. " + REAL
        + "{{staging}} ",
  },
  {
    label: "Nintendo Switch 2 — docked",
    gadget: "console",
    suffix: "switch",
    listing: "Nintendo Switch",
    skuCodes: ["NSW", "NSWO", "NSW2"],
    order: 0,
    isActive: true,
    prompt:
      "A Nintendo Switch 2 console standing in its dock on a light oak media unit, photographed from a "
        + "front three-quarter angle at dock height so the dock's front face and the console's screen edge "
        + "are both clearly visible and fill most of the frame. The two detachable Joy-Con controllers are "
        + "attached to either side of the console. A vinyl skin covers the front face of the dock and the "
        + "outer faces of both Joy-Con controllers. {{fidelity}} The console's screen stays dark and "
        + "uncovered, and every button, stick, trigger, port and the Switch logo stay completely bare, "
        + "with the vinyl stopping cleanly at their edges. Behind and to the side, well out of focus, a "
        + "small plant and a closed game case, muted and low-contrast. " + REAL + "{{staging}} ",
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
        + "top, the two front face panels on either side of the touchpad, and the touchpad itself, "
        + "which is skinned over with the pattern running straight across it — following every compound "
        + "curve tightly, conforming to the shape like heat-shrunk film, with no bubbles, no lift, no "
        + "wrinkles, and no gaps of bare white shell left showing between panels. The whole upper face "
        + "is covered: no white factory shell is left anywhere between the D-pad, the face buttons and "
        + "the touchpad, and none around or below the touchpad. The pattern is continuous across the "
        + "grip, the face panel above it and the touchpad, not separate stickers. The D-pad, the four "
        + "face buttons, the two thumbsticks, the thin light bar strip along the touchpad's edges, the "
        + "triggers and bumpers, the create and options buttons, the speaker holes and the central PS "
        + "button stay bare factory white or black, with the vinyl die-cut precisely around each of "
        + "them so the cut follows the exact outline of the recess. No people and no hands anywhere in "
        + "the frame. " + REAL + "{{staging}} ",
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
        + "— the top face around the controls, the touchpad, which is skinned over with the pattern "
        + "running straight across it, both grips all the way round their outer and under sides, and "
        + "the shoulder humps — following every compound curve tightly with no bubbles, no lift and no "
        + "gaps of bare factory shell showing between panels. The D-pad, the face buttons, the "
        + "thumbsticks, the thin light bar strip, the triggers and the bumpers stay bare, with the "
        + "vinyl die-cut precisely around each of them. No people and no hands anywhere in the "
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
    label: "Lid only — with Apple logo",
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
    label: "Lid only — without logo",
    gadget: "laptop",
    suffix: "laptop-top-nologo",
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
        + "covered edge to edge with a vinyl skin. {{fidelity}} The vinyl is one continuous, unbroken "
        + "sheet with no cut-out of any kind: there is no logo on the lid at all — no Apple logo, no "
        + "brand mark, no hole, no outline and no bare metal anywhere on the lid. The printed artwork "
        + "runs uninterrupted across the whole lid, including the centre where a logo would normally "
        + "sit. The skin follows the lid's rounded corners and stops cleanly at the edges. Around the "
        + "laptop, a few softly out-of-focus props placed off to the sides — a small green plant, a "
        + "closed notebook, a ceramic mug — muted and low-contrast so they frame the laptop without "
        + "competing with the design. {{staging}} ",
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
        + "block only about 12.7 cm on each side and 5 cm tall, with tightly rounded corners and a "
        + "recessed circular base ring underneath. Its openings sit where Apple puts them and nowhere "
        + "else: two USB-C ports and a headphone jack on the FRONT edge, and the power socket, Ethernet, "
        + "HDMI and the Thunderbolt ports in a row across the BACK face. The left and right side faces "
        + "are completely plain aluminium — no ports, no sockets, no slots, no vents and no lettering on "
        + "either of them. A vinyl skin covers the flat top face AND all four flat side faces. "
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
      PHONE_POSE("iPhone 17 Pro Max")
        + "Each is a large slab with a polished side band, tightly rounded corners and, across the top of the "
        + "back, a wide raised camera plateau spanning the full width with three large lenses in a triangle "
        + "and the flash beside them. "
        + PHONE_COVERAGE + CAMERA_COVERED + LOGO_CUT("Apple logo in the centre of the back")
        + "No people and no hands anywhere in the frame. " + REAL + "{{staging}} ",
  },
  {
    /*
     * The flat lay. The standing pair shows the phone whole; this one shows
     * the design, flat to the camera and filling the frame, which is what a
     * shopper is really buying. The obvious angle to make from a real photo:
     * one top-down shot of the phone, greened, and every design after it is
     * that photograph.
     */
    label: "iPhone — top down, flat lay",
    gadget: "phone",
    suffix: "phone-iphone-flat",
    listing: "Apple iPhone",
    skuCodes: ["PH", "IPH"],
    matchSingleVariant: true,
    askCutOrientation: true,
    order: 1,
    isActive: true,
    prompt:
      "A single iPhone 17 Pro Max lying face down on a warm cream stone surface, photographed straight "
        + "down from directly above so the whole back is flat and square to the camera, none of it "
        + "foreshortened, filling most of the frame with a little space around it. Soft daylight falls "
        + "across the surface with the dappled shadow of leaves over it; one green leaf reaches in at the "
        + "top left corner and the pale rim of a ceramic dish at the top right, both softly out of focus. "
        + "The phone is reproduced exactly as manufactured: a large slab with a polished side band, "
        + "tightly rounded corners and, across the top of the back, a wide raised camera plateau spanning "
        + "the full width with three large lenses in a triangle and the flash beside them. "
        + PHONE_COVERAGE + CAMERA_COVERED + LOGO_CUT("Apple logo in the centre of the back")
        + "No people and no hands anywhere in the frame. " + REAL + "{{staging}} ",
  },
  {
    label: "Samsung S26 Ultra — back",
    gadget: "phone",
    suffix: "phone-samsung",
    skuCodes: ["PH", "SAM"],
    // A phone design is one listing with one variant whose SKU is the bare
    // design code, so neither a view code nor a title can find it — and both
    // phone pictures belong on that same listing.
    matchSingleVariant: true,
    askCutOrientation: true,
    order: 1,
    isActive: true,
    prompt:
      PHONE_POSE("Samsung Galaxy S26 Ultra")
        + "Each is a large flat slab with an almost square profile, gently rounded corners, a flat metal side "
        + "rail, and down the upper left of the back a vertical column of individually raised camera lenses "
        + "with the flash beside them — no camera bump plate, each lens ring standing proud on its own. "
        + PHONE_COVERAGE
        + "The skin is die-cut with a round hole exactly the size of each lens's glass and small holes for the "
        + "flash and sensor, the printed vinyl running right up to every lens; nothing else on the back is "
        + "uncovered. " + LOGO_CUT("SAMSUNG wordmark low on the back")
        + "No people and no hands anywhere in the frame. " + REAL + "{{staging}} ",
  },
  {
    label: "Galaxy Tab — back",
    gadget: "tablet",
    suffix: "samsung-tab",
    listing: "Samsung Galaxy Tab",
    skuCodes: ["SGT", "SGTF"],
    matchSingleVariant: true,
    order: 2,
    isActive: true,
    prompt:
      "A Samsung Galaxy Tab S-series tablet lying face down on a light oak desk, photographed from "
        + "slightly above so the whole back panel faces the camera and fills most of the frame, with "
        + "its thin aluminium edges and rounded corners visible. The back panel is covered edge to edge "
        + "with a vinyl skin. {{fidelity}} The two separate round camera lenses in the top-left corner, "
        + "the magnetic S Pen strip and the small SAMSUNG wordmark area stay bare metal, with the vinyl "
        + "cut cleanly around each of them; nothing else on the back is uncovered. A stylus and a "
        + "closed notebook sit off to one side, softly out of focus. " + REAL + "{{staging}} ",
  },
  {
    label: "Xiaomi Pad — back",
    gadget: "tablet",
    suffix: "xiaomi-pad",
    listing: "Xiaomi Pad",
    skuCodes: ["XPD", "XPDF"],
    matchSingleVariant: true,
    order: 3,
    isActive: true,
    prompt:
      "A Xiaomi Pad tablet lying face down on a light oak desk, photographed from slightly above so "
        + "the whole back panel faces the camera and fills most of the frame, with its thin edges and "
        + "rounded corners visible. The back panel is covered edge to edge with a vinyl skin. "
        + "{{fidelity}} The raised square camera island in the top-left corner and the lens on it stay "
        + "bare, with the vinyl cut cleanly around the island's outline; nothing else on the back is "
        + "uncovered. A stylus and a closed notebook sit off to one side, softly out of focus. "
        + REAL + "{{staging}} ",
  },
  {
    label: "Tablet — back (other brands)",
    gadget: "tablet",
    suffix: "tablet-generic",
    listing: "Tablet",
    skuCodes: ["TABB", "TABBF"],
    matchSingleVariant: true,
    order: 4,
    isActive: true,
    prompt:
      "A modern Android tablet with slim bezels lying face down on a light oak desk, photographed "
        + "from slightly above so the whole back panel faces the camera and fills most of the frame. "
        + "It carries no brand logo. The back panel is covered edge to edge with a vinyl skin. "
        + "{{fidelity}} The single camera bump in the top-left corner stays bare, with the vinyl cut "
        + "cleanly around it; nothing else on the back is uncovered. A stylus and a closed notebook "
        + "sit off to one side, softly out of focus. " + REAL + "{{staging}} ",
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

/* ------------------------------------------------------------------ brands */

/**
 * One listing per device brand, for every gadget.
 *
 * Stock is held once per design, so a listing per brand costs nothing on the
 * shelf and gives each brand its own title, photo and page — and its own
 * traffic figures, which is how real demand shows up. `code` prefixes the
 * SKU tail so the listings of one design never share a SKU (R-12-OPL,
 * R-12-HPLP). The "other" listing of a gadget takes every brand the named
 * ones do not.
 */
interface BrandListing {
  listing: string;
  code: string;
  brands?: string[];
  /** Photo subject for the generated shot(s); omitted where a shot exists. */
  device?: string;
  /** Phones: how the camera module looks, so the cut can follow it. */
  camera?: string;
  /** Laptops: the lid logo to knock out, if any. */
  logo?: string;
}

const PHONE_BRANDS: BrandListing[] = [
  { listing: "Apple iPhone", code: "IPH", brands: ["Apple"] },
  { listing: "Samsung Galaxy", code: "SAM", brands: ["Samsung"] },
  { listing: "OnePlus", code: "OPL", brands: ["One Plus", "OnePlus"], logo: "OnePlus logo in the centre of the back", device: "A OnePlus 13 smartphone", camera: "the large circular camera module in the upper left, carrying three lenses and the flash" },
  { listing: "Google Pixel", code: "PXL", brands: ["Google"], logo: "Google G logo in the centre of the back", device: "A Google Pixel 9 Pro smartphone", camera: "the raised pill-shaped camera bar running across the upper back, carrying three lenses and the flash" },
  { listing: "Nothing Phone", code: "NTH", brands: ["Nothing", "CMF"], device: "A Nothing Phone (3a) smartphone", camera: "the horizontal pill-shaped camera housing near the top centre, carrying its lenses and flash; its transparent back is fully hidden under the opaque skin" },
  { listing: "Xiaomi Redmi", code: "XRM", brands: ["Xiaomi", "Redmi"], device: "A Redmi Note 14 Pro smartphone", camera: "the square camera island in the upper left, carrying three lenses and the flash" },
  { listing: "Poco", code: "PCO", brands: ["Poco"], device: "A Poco X7 Pro smartphone", camera: "the camera island in the upper left, carrying its lenses and the flash" },
  { listing: "Realme", code: "RLM", brands: ["Realme"], device: "A realme 14 Pro smartphone", camera: "the circular camera module near the top centre, carrying its lenses and the flash" },
  { listing: "Vivo", code: "VIV", brands: ["Vivo"], device: "A vivo V50 smartphone", camera: "the vertical pill-shaped camera module in the upper left, carrying two lenses and the ring flash" },
  { listing: "iQOO", code: "IQO", brands: ["iQOO"], device: "An iQOO 13 smartphone", camera: "the square camera module in the upper left, carrying three lenses and the flash" },
  { listing: "Oppo", code: "OPO", brands: ["Oppo"], device: "An OPPO Reno 13 smartphone", camera: "the camera island in the upper left, carrying its lenses and the flash" },
  { listing: "Motorola", code: "MOT", brands: ["Motorola"], logo: "Motorola batwing logo in the centre of the back", device: "A Motorola Edge 50 Pro smartphone", camera: "the raised camera island in the upper left, carrying three lenses and the flash" },
  { listing: "Infinix", code: "INF", brands: ["Infinix"], device: "An Infinix Note 40 smartphone", camera: "the camera module in the upper left, carrying its lenses and the flash" },
  { listing: "Tecno", code: "TEC", brands: ["Tecno"], device: "A Tecno Camon 30 smartphone", camera: "the camera module in the upper left, carrying its lenses and the flash" },
  { listing: "Lava", code: "LAV", brands: ["Lava"], device: "A Lava Agni 3 smartphone", camera: "the camera module in the upper left, carrying its lenses and the flash" },
  // The catch-all Android listing needs a phone that reads as Android at a
  // glance. "A modern Android smartphone with no brand logo" left the model
  // free to draw an iPhone, which is what it drew. The Phone (2a)'s stacked
  // centre lenses and Glyph strips can be nothing else.
  {
    listing: "Android Phone", code: "AND",
    device: "A Nothing Phone (2a) smartphone",
    camera: "the two large circular camera lenses stacked one above the other in the top centre of the back, with the small flash beside them",
    logo: "pair of curved Glyph LED light strips that loop around the camera lenses",
  },
];

const LAPTOP_BRANDS: BrandListing[] = [
  { listing: "MacBook", code: "MB", brands: ["Apple"] },
  { listing: "HP Laptop", code: "HP", brands: ["HP"], device: "An HP Pavilion 15 laptop", logo: "the round HP logo in the centre of the lid" },
  { listing: "Dell Laptop", code: "DEL", brands: ["Dell", "Alienware"], device: "A Dell Inspiron 15 laptop", logo: "the round DELL logo in the centre of the lid" },
  { listing: "Lenovo Laptop", code: "LEN", brands: ["Lenovo"], device: "A Lenovo IdeaPad Slim 5 laptop", logo: "the small Lenovo wordmark near one corner of the lid" },
  { listing: "Asus Laptop", code: "ASU", brands: ["Asus"], device: "An ASUS Vivobook 15 laptop", logo: "the ASUS wordmark on the lid" },
  { listing: "Acer Laptop", code: "ACR", brands: ["Acer"], device: "An Acer Aspire 7 laptop", logo: "the acer wordmark in the centre of the lid" },
  { listing: "MSI Laptop", code: "MSI", brands: ["MSI"], device: "An MSI gaming laptop", logo: "the MSI dragon shield logo in the centre of the lid" },
  { listing: "Laptop", code: "WL", device: "A modern 15-inch Windows laptop with no brand logo" },
];

const CHARGER_BRANDS: BrandListing[] = [
  { listing: "Apple Charger", code: "APCH", brands: ["Apple"] },
  { listing: "Samsung Charger", code: "SMCH", brands: ["Samsung"], device: "A Samsung 25W USB-C power adapter (Indian model, two round pins), a small white cuboid with rounded edges" },
  { listing: "OnePlus Charger", code: "OPCH", brands: ["One Plus", "OnePlus"], device: "A OnePlus SUPERVOOC power adapter (Indian model, two round pins), a white rounded cuboid" },
  { listing: "Realme Charger", code: "RMCH", brands: ["Realme"], device: "A realme SUPERVOOC power adapter (Indian model, two round pins), a white rounded cuboid" },
  { listing: "Oppo Charger", code: "OOCH", brands: ["Oppo"], device: "An OPPO SUPERVOOC power adapter (Indian model, two round pins), a white rounded cuboid" },
  { listing: "Vivo Charger", code: "VVCH", brands: ["Vivo", "iQOO"], device: "A vivo FlashCharge power adapter (Indian model, two round pins), a white rounded cuboid" },
  { listing: "Xiaomi Charger", code: "XMCH", brands: ["Xiaomi", "Redmi", "Poco"], device: "A Xiaomi HyperCharge power adapter (Indian model, two round pins), a white rounded cuboid" },
  { listing: "Charger", code: "CHG", device: "A white USB-C phone power adapter (Indian model, two round pins) with no brand marking" },
];

const CAMERA_BRANDS: BrandListing[] = [
  { listing: "Sony Camera", code: "SNY", brands: ["Sony"] },
  { listing: "Canon Camera", code: "CAN", brands: ["Canon"], device: "A Canon EOS R6 Mark II mirrorless camera", logo: "Canon" },
  { listing: "Nikon Camera", code: "NIK", brands: ["Nikon"], device: "A Nikon Z6 III mirrorless camera", logo: "Nikon" },
];

const LENS_BRANDS: BrandListing[] = [
  { listing: "Sony Lens", code: "SNYL", brands: ["Sony"] },
  { listing: "Canon Lens", code: "CANL", brands: ["Canon"], device: "A Canon RF 24-105mm f/4 L zoom lens" },
  { listing: "Nikon Lens", code: "NIKL", brands: ["Nikon"], device: "A Nikon NIKKOR Z 24-120mm f/4 S zoom lens" },
  { listing: "Sigma Lens", code: "SIGL", brands: ["SIGMA"], device: "A Sigma 24-70mm f/2.8 DG DN Art zoom lens" },
  { listing: "Tamron Lens", code: "TAML", brands: ["TAMRON"], device: "A Tamron 28-75mm f/2.8 Di III zoom lens" },
  { listing: "Fujifilm Lens", code: "FUJL", brands: ["FUJIFILM"], device: "A Fujifilm XF 16-55mm f/2.8 zoom lens" },
  { listing: "Camera Lens", code: "LNS", device: "A black mirrorless-camera zoom lens with no brand marking" },
];

const GIMBAL_BRANDS: BrandListing[] = [
  { listing: "DJI Gimbal", code: "DJG", brands: ["DJI"], device: "A DJI RS 4 camera gimbal" },
  { listing: "Zhiyun Gimbal", code: "ZHG", brands: ["ZHIYUN"], device: "A Zhiyun Crane 4 camera gimbal" },
  { listing: "Gimbal", code: "GMB", device: "A black handheld camera gimbal with no brand marking" },
];

const allBrandsOf = (list: BrandListing[]) => list.flatMap((b) => b.brands || []);
const scopeOf = (b: BrandListing, list: BrandListing[]) =>
  b.brands ? { modelBrands: b.brands } : { modelBrandsExclude: allBrandsOf(list) };

const PRESET_BUILDERS: Array<[BrandListing[], (b: BrandListing) => PresetVariant[]]> = [
  [PHONE_BRANDS, (b) => [{ tail: b.code, title: "Back Skin", price: 149, price3d: 249, materialMultiplier: 1 }]],
  [LAPTOP_BRANDS, (b) => [
    { tail: `${b.code}LP`, title: "Only Top", price: 249, price3d: 399, materialMultiplier: 1 },
    { tail: `${b.code}LPK`, title: "Top + Keyboard Area", price: 449, price3d: 649, materialMultiplier: 2 },
  ]],
  [CHARGER_BRANDS, (b) => [{ tail: b.code, title: "Charger Skin", price: 119, price3d: 149, materialMultiplier: 1 }]],
  [CAMERA_BRANDS, (b) => [
    { tail: `${b.code}CAM`, title: "Without Lens", price: 499, materialMultiplier: 1 },
    { tail: `${b.code}CAML`, title: "With Lens", price: 699, materialMultiplier: 2 },
  ]],
  [LENS_BRANDS, (b) => [{ tail: b.code, title: "Lens Skin", price: 299, price3d: 349, materialMultiplier: 1 }]],
  [GIMBAL_BRANDS, (b) => [{ tail: b.code, title: "Gimbal Skin", price: 399, materialMultiplier: 1 }]],
];
for (const [list, build] of PRESET_BUILDERS) {
  for (const b of list) {
    LISTING_PRESETS[b.listing.toLowerCase()] = build(b);
    LISTING_SCOPES[b.listing.toLowerCase()] = scopeOf(b, list);
  }
}
Object.assign(LISTING_PRESETS, {
  "dji drone": [
    { tail: "DJDRO", title: "Drone Only", price: 699, price3d: 799, materialMultiplier: 1 },
    { tail: "DJDRC", title: "Drone + RC", price: 999, materialMultiplier: 1.7 },
  ],
  "dji drone controller": [
    { tail: "DJRC", title: "RC — Without Display", price: 399, materialMultiplier: 1 },
    { tail: "DJRCD", title: "RC — With Display", price: 449, materialMultiplier: 1 },
  ],
  "mac mini": [{ tail: "MM", title: "Mac mini Skin", price: 599, materialMultiplier: 1 }],
});
Object.assign(LISTING_SCOPES, {
  "dji drone": { modelBrands: ["DJI"] },
  "dji drone controller": { modelBrands: ["DJI"] },
  "mac mini": { modelBrands: ["Apple"] },
  // Android Phone is the phone-family catch-all: "everyone but Apple", not
  // "everyone without their own named phone listing". The generic scopeOf()
  // rule excludes every brand PHONE_BRANDS names — Samsung, OnePlus, Xiaomi,
  // Vivo and the rest — which is only right once each of those has its own
  // live listing (Phase 1 off). Under Phase 1, those brands have nowhere
  // else to pick their model, so Android Phone has to keep taking them.
  "android phone": { modelBrandsExclude: ["Apple"] },
});

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const phoneShot = (b: BrandListing): Omit<MockupShot, "_id"> => ({
  label: `${b.listing} — back`,
  gadget: "phone",
  suffix: `phone-${slug(b.listing)}`,
  listing: b.listing,
  skuCodes: [b.code],
  matchSingleVariant: true,
  askCutOrientation: true,
  order: 5,
  isActive: true,
  prompt:
    PHONE_POSE(b.device!.replace(/^an? /i, "").replace(/ smartphone$/i, ""))
    + `Each has ${b.camera}. `
    + PHONE_COVERAGE + CAMERA_COVERED
    + (b.logo ? LOGO_CUT(b.logo) : "Any brand logo on the back sits under the skin. ")
    + "No people and no hands anywhere in the frame. " + REAL + "{{staging}} ",
});

const laptopShots = (b: BrandListing): Omit<MockupShot, "_id">[] => [
  {
    label: `${b.listing} — lid`,
    gadget: "laptop",
    suffix: `laptop-${slug(b.listing)}-top`,
    listing: b.listing,
    skuCodes: [`${b.code}LP`],
    variantTitles: ["Only Top"],
    order: 5,
    isActive: true,
    prompt:
      `${b.device} resting on a light oak desk, opened just far enough — about 20 degrees — that the hinge `
      + "and the edge of the screen are visible, photographed from slightly above and in front so the whole "
      + "outer lid faces the camera and fills most of the frame while still reading unmistakably as a laptop. "
      + "The entire outer lid is covered edge to edge with a vinyl skin. {{fidelity}} "
      + (b.logo
        ? `The vinyl is one continuous sheet with ${b.logo} knocked out of it as negative space, following the `
          + "logo's exact outline so the bare lid shows only through that shape; there is no circle, plate or "
          + "border of bare metal around it. "
        : "The vinyl is one continuous sheet with no cut-out of any kind. ")
      + "The skin follows the lid's rounded corners and stops cleanly at the edges. Around the laptop, a few "
      + "softly out-of-focus props — a small green plant, a closed notebook, a ceramic mug — muted and "
      + "low-contrast. " + REAL + "{{staging}} ",
  },
  {
    label: `${b.listing} — keyboard deck`,
    gadget: "laptop",
    suffix: `laptop-${slug(b.listing)}-open`,
    listing: b.listing,
    skuCodes: [`${b.code}LPK`],
    variantTitles: ["Top + Keyboard Area"],
    order: 6,
    isActive: true,
    prompt:
      `${b.device}, open on a light oak desk, photographed straight down from above the keyboard so the `
      + "keyboard deck and palm rest fill the frame and the open screen is foreshortened along the top edge. "
      + "A vinyl skin covers the whole deck around the keyboard and the palm rest as one continuous printed "
      + "surface. {{fidelity}} The keycaps, the touchpad, the speaker grilles and the power button stay "
      + "completely uncovered, with the vinyl stopping cleanly at their edges. Softly out-of-focus props at "
      + "the edges of the frame — a small plant, a closed notebook — muted and low-contrast. "
      + REAL + "{{staging}} ",
  },
];

const chargerShots = (b: BrandListing): Omit<MockupShot, "_id">[] => [
  {
    label: `${b.listing} — pins view`,
    gadget: "charger",
    suffix: `charger-${slug(b.listing)}`,
    listing: b.listing,
    skuCodes: [b.code],
    matchSingleVariant: true,
    order: 5,
    isActive: true,
    prompt:
      `${b.device}, standing upright on a light oak desk and photographed straight on at its own height with `
      + "the pins pointing up; its broad front face fills the centre of the frame. It is reproduced exactly as "
      + "manufactured. " + PINS_VIEW + CHARGER_COVERAGE
      + "Soft daylight and a gentle contact shadow. No people and no hands anywhere in the frame. "
      + REAL + "{{staging}} ",
  },
  {
    label: `${b.listing} — port view`,
    gadget: "charger",
    suffix: `charger-${slug(b.listing)}-port`,
    listing: b.listing,
    skuCodes: [b.code],
    matchSingleVariant: true,
    order: 6,
    isActive: true,
    prompt:
      `${b.device}, lying on its back on a light oak desk and photographed straight down at the face with its `
      + "USB port, which fills the centre of the frame. It is reproduced exactly as manufactured. "
      + PORT_VIEW + CHARGER_COVERAGE
      + "Soft daylight and a gentle shadow. No people and no hands anywhere in the frame. " + REAL + "{{staging}} ",
  },
];

const cameraShots = (b: BrandListing): Omit<MockupShot, "_id">[] => [
  {
    label: `${b.listing} — body`,
    gadget: "camera",
    suffix: `camera-${slug(b.listing)}`,
    listing: b.listing,
    skuCodes: [`${b.code}CAM`],
    variantTitles: ["Without Lens"],
    order: 5,
    isActive: true,
    prompt:
      `${b.device} body with no lens attached, standing on a light oak desk, photographed from a front `
      + "three-quarter angle slightly above eye level so the front plate, the grip and the top plate read "
      + "clearly. A vinyl skin covers the flat front plate and the flat top plate. {{fidelity}} The rubber "
      + "hand grip is not skinned and stays bare textured rubber, the vinyl stopping with a clean edge where "
      + `the plate meets it. The ${b.logo} wordmark on the front is knocked out of the vinyl as letter-shaped `
      + "holes with no box or border around them. The lens mount, buttons, dials and rear screen stay "
      + "uncovered. No people and no hands anywhere in the frame. " + REAL + "{{staging}} ",
  },
  {
    label: `${b.listing} — with lens`,
    gadget: "camera",
    suffix: `camera-${slug(b.listing)}-lens`,
    listing: b.listing,
    skuCodes: [`${b.code}CAML`],
    variantTitles: ["With Lens"],
    order: 6,
    isActive: true,
    prompt:
      `${b.device} with a standard zoom lens attached, standing on a light oak desk, photographed from a `
      + "front three-quarter angle. A vinyl skin covers the flat front and top plates of the body and wraps "
      + "the lens barrel between its rings, as one matching design. {{fidelity}} The rubber grip, the zoom "
      + "and focus rings, the lens markings, the front glass, the buttons and the dials stay uncovered. No "
      + "people and no hands anywhere in the frame. " + REAL + "{{staging}} ",
  },
];

const lensShot = (b: BrandListing): Omit<MockupShot, "_id"> => ({
  label: `${b.listing} — standing`,
  gadget: "lens",
  suffix: `lens-${slug(b.listing)}`,
  listing: b.listing,
  skuCodes: [b.code],
  matchSingleVariant: true,
  order: 5,
  isActive: true,
  prompt:
    `${b.device} standing upright on a light oak desk, photographed from a front three-quarter angle at lens `
    + "height so the barrel dominates the frame. A vinyl skin is wrapped around the smooth sections of the "
    + "barrel. {{fidelity}} The artwork curves realistically around the cylinder. The zoom and focus rings, "
    + "the markings, the front glass and the mount stay uncovered, the vinyl stopping cleanly at their edges. "
    + "No people and no hands anywhere in the frame. " + REAL + "{{staging}} ",
});

const gimbalShot = (b: BrandListing): Omit<MockupShot, "_id"> => ({
  label: `${b.listing} — standing`,
  gadget: "gimbals",
  suffix: `gimbal-${slug(b.listing)}`,
  listing: b.listing,
  skuCodes: [b.code],
  matchSingleVariant: true,
  order: 0,
  isActive: true,
  prompt:
    `${b.device} standing on its tripod legs on a light oak desk, arms unfolded, photographed from a front `
    + "three-quarter angle so the handle and the arms fill the frame. A vinyl skin covers the flat faces of "
    + "the handle and the arms. {{fidelity}} The motors, the joints, the buttons, the joystick, the screen "
    + "and the camera plate stay uncovered, the vinyl stopping cleanly at their edges. No people and no "
    + "hands anywhere in the frame. " + REAL + "{{staging}} ",
});

/**
 * The catch-all Android listing's second picture: the brands it covers, laid
 * out together in one design, so a shopper on a Realme or a Vivo can see their
 * own phone in the listing rather than infer it from one unbranded handset.
 */
const ANDROID_GROUP_SHOT: Omit<MockupShot, "_id"> = {
  label: "Android Phone — four brands, 2×2",
  gadget: "phone",
  suffix: "phone-android-group",
  listing: "Android Phone",
  skuCodes: ["AND"],
  matchSingleVariant: true,
  askCutOrientation: true,
  order: 6,
  isActive: true,
  prompt:
    "Four different Android smartphones lying face down on a light oak desk in a neat two-by-two grid, "
    + "photographed straight down from directly above so every back is flat and square to the camera and "
    + "none is foreshortened. All four stand upright in the frame, their long axes parallel, spaced evenly "
    + "with a clear even gap between them — roughly a finger's width — so that NO phone touches, overlaps "
    + "or casts itself over another. Each one is whole and completely visible, none cropped by the frame. "
    + "They are a realme in the top left, a CMF in the top right, a vivo in the bottom left and a Motorola "
    + "in the bottom right, each reproduced exactly as that brand makes it — its own camera layout, its own "
    + "corner radius, its own proportions — so the four read as four different phones at a glance: the "
    + "realme's circular camera module near the top centre, the CMF's exposed industrial screw detailing, "
    + "the vivo's vertical pill-shaped module in the upper left, the Motorola's raised island with its "
    + "batwing logo. "
    + "All four wear the same vinyl skin, in the same design at the same scale and the same orientation, as "
    + "though cut from one sheet. {{fidelity}} {{cutOrientation}} "
    + "On each phone the skin covers the whole back edge to edge and carries on up over the raised camera "
    + "module; only the camera lens glass, the flash and the sensor holes are cut out. No brand wordmark, "
    + "logo or text is visible on any of the skins. Soft even daylight, a gentle shadow under each phone, "
    + "no props, no people and no hands anywhere in the frame. " + REAL + "{{staging}} ",
};

STARTER_SHOTS.push(
  ANDROID_GROUP_SHOT,
  ...PHONE_BRANDS.filter((b) => b.device).map(phoneShot),
  ...LAPTOP_BRANDS.filter((b) => b.device).flatMap(laptopShots),
  ...CHARGER_BRANDS.filter((b) => b.device).flatMap(chargerShots),
  ...CAMERA_BRANDS.filter((b) => b.device).flatMap(cameraShots),
  ...LENS_BRANDS.filter((b) => b.device).map(lensShot),
  ...GIMBAL_BRANDS.filter((b) => b.device).map(gimbalShot),
);

/* ------------------------------------------------------------------ phases */

/**
 * Listings in the first, measured roll-out.
 *
 * Phase 1 is the high-search listings on a handful of designs, so the
 * brand-listing model can be judged on real impressions and orders before the
 * rest are made. The studio creates only these while its phase switch is on.
 */
export const PHASE_1_LISTINGS = new Set([
  "apple iphone", "samsung galaxy", "oneplus", "android phone",
  "macbook", "laptop",
  "apple ipad", "samsung galaxy tab",
  "ps5", "xbox series x", "xbox series s",
  "playstation controller", "xbox controller",
  "dji drone", "dji drone controller",
  // A gadget joins the phase as a whole family, never as its leading brand
  // alone: a listing's scope is "this brand" or "every brand none of the
  // others named", so leaving Sigma, Tamron and Fujifilm out would leave 137
  // lens models with no listing at all to land on — not even the catch-all,
  // which excludes exactly the brands that do have one.
  "sony camera", "canon camera", "nikon camera",
  "sony lens", "canon lens", "nikon lens", "sigma lens", "tamron lens", "fujifilm lens", "camera lens",
  "dji gimbal", "zhiyun gimbal", "gimbal",
  "apple charger", "samsung charger", "oneplus charger", "realme charger", "oppo charger",
  "vivo charger", "xiaomi charger", "charger",
  "mac mini", "tablet",
]);

export const isPhase1 = (listing: string) => PHASE_1_LISTINGS.has(String(listing || "").trim().toLowerCase());

/**
 * Gadgets whose picture can be made from a template rather than by AI.
 *
 * A template is one photo with the skin area in flat chroma green, four
 * corners marking its main face and that face's real size. The renderer warps
 * the design onto those corners at true scale and then carries it on across
 * every green pixel joined to them, so the parts that curve away — a phone's
 * side wrap, a charger's other faces, a lens barrel, a controller's shoulders
 * — take the print too instead of staying green. The face is exact; what
 * wraps is an approximation, without the foreshortening a real curve has, so
 * a template suits a gadget whose skin is mostly one face and falls short of
 * the image model where the device is all curve.
 *
 * A gadget listed here still needs its own template marked ready before
 * anything changes: without one the launch plan uses the image model, as it
 * always did.
 */
export const TEMPLATE_GADGETS = new Set([
  "phone", "laptop", "tablet", "mac-mini",
  "console", "controller", "drone", "camera", "lens", "gimbals", "charger",
]);

/**
 * The face a skin covers, in cm (width × height), by gadget.
 *
 * Two jobs: the size a template's corners default to, and — for a roll with a
 * calibrated photo — the piece cut out of it and sent to the image model, so
 * the motifs come out the size they really are. Without it the model sees a
 * whole roll and guesses, which makes the pattern far too large on small
 * things like controllers and far too small on a console.
 *
 * These are the dominant skinned face of a typical device, not every piece in
 * the kit: a controller's top shell, a console's side panel, the wrap around a
 * lens barrel (its circumference by its length).
 */
export const DEFAULT_SURFACE_CM: Record<string, [number, number]> = {
  phone: [7.6, 16.3],
  laptop: [31.0, 22.0],
  tablet: [17.9, 24.8],
  "mac-mini": [12.7, 12.7],
  console: [26.0, 39.0],
  controller: [16.0, 10.0],
  drone: [20.0, 12.0],
  camera: [13.0, 10.0],
  lens: [27.0, 12.0],
  gimbals: [20.0, 10.0],
  charger: [6.0, 6.0],
};

export { slug as listingSlug };

/**
 * The device as a shopper names it — "OnePlus" alone does not say phone.
 * Kept in step with deviceNameFor in functions/src/listings.ts.
 */
const SAYS_DEVICE = /phone|laptop|macbook|\btab\b|tablet|ipad|\bpad\b|charger|camera|lens|gimbal|drone|controller|console|ps5|xbox|switch|mac mini/i;
const GADGET_NOUNS: Record<string, string> = {
  phone: "Phone", tablet: "Tablet", laptop: "Laptop", charger: "Charger", lens: "Lens", camera: "Camera",
  gimbals: "Gimbal", controller: "Controller", console: "Console", drone: "Drone",
  "mac-mini": "Mac mini",
};
export function deviceNameOf(listing: string, gadget: string): string {
  const name = String(listing || "").trim();
  if (!name || SAYS_DEVICE.test(name)) return name;
  const noun = GADGET_NOUNS[String(gadget || "").toLowerCase()];
  return noun ? `${name} ${noun}` : name;
}

/** A roll named after its whole old listing title ("… Matte Finish Skin") loses the tail. */
export const cleanDesignName = (name: string) =>
  String(name || "").replace(/\s+(\w+\s+)?finish(\s+skin)?\s*$/i, "").replace(/\s+skins?\s*$/i, "").trim();
