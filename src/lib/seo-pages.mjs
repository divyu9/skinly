/**
 * What an SEO landing page is about, which products belong on it, and what its
 * title says.
 *
 * The 296 pages under /:slug were generated from keywords and stored with an
 * empty filterConfig, so every one of them showed the first eight products in
 * the catalogue: "Apple iPhone 14 skins" and "Google Pixel 10 Pro skins" had
 * the same grid. Nothing on the page says which device it is for, so this
 * works it out from the slug against the model database and the catalogue's
 * own vocabulary — gadgets, finishes, collections.
 *
 * Plain JS: scripts/prerender.mjs runs it at build time to write each page's
 * data file, and the app runs it as a fallback for pages created since.
 */

export const slugify = (s) =>
  String(s ?? "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const squash = (s) => slugify(s).replace(/-/g, "");

/** Words in a slug that name a gadget, mapped to gadgetCategory. */
const GADGET_WORDS = {
  phone: "phone", phones: "phone", mobile: "phone", smartphone: "phone",
  laptop: "laptop", laptops: "laptop", macbook: "laptop", notebook: "laptop",
  tablet: "tablet", ipad: "tablet", tab: "tablet", iphone: "phone",
  camera: "camera", dslr: "camera", gopro: "camera",
  lens: "lens", lenses: "lens",
  drone: "drone", drones: "drone", mavic: "drone",
  charger: "charger", chargers: "charger",
  console: "console", ps4: "console", ps5: "console", playstation: "console", xbox: "console", nintendo: "console", switch: "console",
  controller: "controller", gimbal: "gimbals", gimbals: "gimbals",
};
const MULTI_WORD_GADGETS = [["mac", "mini", "mac-mini"], ["mac", "studio", "mac-mini"]];

/** Words that name a finish, mapped to finishType. */
const FINISH_WORDS = {
  matte: "matte",
  "3d": "embossed", textured: "embossed", embossed: "embossed",
  transparent: "transparent", tranzy: "transparent", clear: "transparent",
  leather: "premium-leather",
};

/** Words that name a theme, mapped to collection names. */
const THEME_COLLECTIONS = {
  anime: ["Anime"], manga: ["Anime"],
  superhero: ["Marvel", "DC"], marvel: ["Marvel"], dc: ["DC"], comic: ["Marvel", "DC"],
  gaming: ["Gaming"], gamer: ["Gaming"],
  car: ["Cars & Bikes"], cars: ["Cars & Bikes"], bike: ["Cars & Bikes"], bikes: ["Cars & Bikes"],
  nature: ["Nature"], botanical: ["Nature"], floral: ["Nature"],
  space: ["Space & Cosmic"], galaxy: ["Space & Cosmic"], cosmic: ["Space & Cosmic"],
  minimal: ["Minimal"], minimalist: ["Minimal"],
  abstract: ["Abstract"], geometric: ["Abstract"],
  animal: ["Animals"], animals: ["Animals"],
  god: ["God & Religious"], religious: ["God & Religious"],
  quotes: ["Quotes & Typography"], typography: ["Quotes & Typography"],
  sports: ["Sports"], cricket: ["Sports"], football: ["Sports"],
  music: ["Music"],
};

/** Theme words with no collection behind them; matched against titles instead. */
const TITLE_WORDS = {
  camouflage: ["camo", "camouflage"], camo: ["camo", "camouflage"],
  marble: ["marble"], carbon: ["carbon"], wood: ["wood", "wooden"],
  cyberpunk: ["cyber", "cyberpunk", "neon"], neon: ["neon", "glow"],
  circuit: ["circuit", "cercuit", "cricuit", "tech"], tech: ["tech", "circuit", "cyber"],
  graffiti: ["graffiti", "street"], retro: ["retro", "vintage"], vintage: ["vintage", "retro"],
  pixel: ["pixel"], gradient: ["gradient"], pastel: ["pastel"], doodle: ["doodle", "doodles"],
  topography: ["topo", "topography"], flag: ["flag", "india", "tiranga"],
  cartoon: ["cartoon", "toon"], movie: ["movie", "film"], tribal: ["tribal"],
  watercolor: ["watercolor", "watercolour", "paint"], holographic: ["holographic", "holo"],
  metallic: ["metallic", "metal", "chrome"], gold: ["gold", "golden"], black: ["black"],
};

const GADGET_LABEL = {
  phone: "Phone", laptop: "Laptop", tablet: "Tablet", camera: "Camera", lens: "Lens",
  drone: "Drone", charger: "Charger", console: "Console", controller: "Controller",
  gimbals: "Gimbal", "mac-mini": "Mac Mini",
};

const FINISH_LABEL = { matte: "matte", embossed: "3D textured", transparent: "transparent", "premium-leather": "leather" };

/**
 * @param page  {slug, pageType, h1Heading}
 * @param models [{brandName, modelName, category, isActive}]
 * @returns {{
 *   kind: "model"|"family"|"brand"|"unlisted"|"gadget"|"finish"|"theme"|"keyword",
 *   brand?: string, model?: string, gadget?: string, finish?: string,
 *   collections?: string[], titleWords?: string[],
 *   models?: Array<{brand:string, model:string, category?:string}>
 * }}
 * "unlisted" is a brand we carry with a model we do not — the page promises a
 * device the model picker cannot offer, so its copy is left as written.
 */
export function resolveSeoTarget(page, models, collectionNames = []) {
  let base = String(page?.slug || "")
    .replace(/-\d+$/, "")
    .replace(/-(skins?|wraps?|stickers?)$/, "");
  let words = base.split("-").filter(Boolean);
  const series = words.includes("series");
  if (series) {
    words = words.filter((w) => w !== "series");
    base = words.join("-");
  }
  const active = (models || []).filter((m) => m && m.isActive !== false && m.brandName && m.modelName);

  // Gadget, finish and theme words. Only ever run over words that are not part
  // of a device name: "Galaxy" is not a space theme, "Pixel" is not pixel art,
  // and a ThinkPad X1 Carbon is not a carbon-fibre skin.
  const scan = (list) => {
    const t = {};
    for (const [a, b, g] of MULTI_WORD_GADGETS) {
      const i = list.indexOf(a);
      if (i !== -1 && list[i + 1] === b) t.gadget = g;
    }
    for (const w of list) {
      if (!t.gadget && GADGET_WORDS[w]) t.gadget = GADGET_WORDS[w];
      if (!t.finish && FINISH_WORDS[w]) t.finish = FINISH_WORDS[w];
      if (THEME_COLLECTIONS[w]) t.collections = [...new Set([...(t.collections || []), ...THEME_COLLECTIONS[w]])];
      if (TITLE_WORDS[w]) t.titleWords = [...new Set([...(t.titleWords || []), ...TITLE_WORDS[w]])];
    }
    return t;
  };

  // Brand and model pages. Device and skin-type pages never name a device.
  if (page?.pageType !== "device" && page?.pageType !== "skin-type" && words.length) {
    const exact = [];
    const prefixed = [];
    for (const m of active) {
      // "Galaxy A54 (5G)" is the Galaxy A54 a page names; drop network tags.
      const own = slugify(m.modelName).replace(/(^|-)(5g|4g|lte)(?=-|$)/g, "").replace(/^-+|-+$/g, "");
      const cands = [`${slugify(m.brandName)}-${own}`, own, `${squash(m.brandName)}-${own}`];
      if (cands.includes(base)) exact.push(m);
      else if (cands.some((c) => c.startsWith(base + "-"))) prefixed.push(m);
    }
    const majority = (list) => {
      const cats = {};
      for (const m of list) cats[m.category] = (cats[m.category] || 0) + 1;
      return Object.entries(cats).sort((x, y) => y[1] - x[1])[0]?.[0];
    };

    if ((exact.length || prefixed.length === 1) && !series) {
      const m = exact[0] || prefixed[0];
      /*
       * The brand's other models, so a model page is not a dead end.
       *
       * Somebody who lands on the Poco X8 Power page with a Poco X7 in their
       * pocket had nowhere to go, and the page passed nothing to its
       * siblings — which is what turns a hundred model pages into one topic
       * Google understands rather than a hundred unrelated documents.
       */
      const siblings = active
        .filter((x) => x.brandName === m.brandName && x.category === m.category && x.modelName !== m.modelName)
        .map((x) => ({ brand: x.brandName, model: x.modelName, category: x.category }));
      return { kind: "model", brand: m.brandName, model: m.modelName, gadget: m.category, models: siblings };
    }
    const family = [...exact, ...prefixed];
    if (family.length > 1 && words.length >= 2) {
      return {
        kind: "family",
        brand: family[0].brandName,
        gadget: majority(family),
        models: family.map((m) => ({ brand: m.brandName, model: m.modelName, category: m.category })),
      };
    }

    const brands = new Map();
    for (const m of active) {
      const key = squash(m.brandName);
      if (!brands.has(key)) brands.set(key, { name: m.brandName, models: [] });
      brands.get(key).models.push(m);
    }
    for (let n = Math.min(2, words.length); n >= 1; n--) {
      const b = brands.get(words.slice(0, n).join(""));
      if (!b) continue;
      const rest = words.slice(n);
      const v = scan(rest);
      const brandModels = b.models.map((m) => ({ brand: m.brandName, model: m.modelName, category: m.category }));
      const vocabulary = (w) =>
        GADGET_WORDS[w] || FINISH_WORDS[w] || THEME_COLLECTIONS[w] || TITLE_WORDS[w] ||
        MULTI_WORD_GADGETS.some(([a, c]) => w === a || w === c);
      if (!rest.length || page?.pageType === "brand" || rest.every(vocabulary)) {
        return { kind: "brand", brand: b.name, gadget: v.gadget || majority(b.models), models: brandModels };
      }
      // A model name we do not carry. Theme words in it are part of the name.
      return {
        kind: "unlisted",
        brand: b.name,
        gadget: v.gadget || majority(b.models),
        models: brandModels,
      };
    }
  }

  const target = { kind: "keyword", ...scan(words) };
  // Collections added since this list was written: a page whose slug contains
  // a collection's name is about that collection.
  for (const name of collectionNames || []) {
    const cs = slugify(name);
    if (!cs || !(`-${words.join("-")}-`).includes(`-${cs}-`)) continue;
    if (!(target.collections || []).includes(name)) target.collections = [...(target.collections || []), name];
  }
  if (target.collections?.length) target.kind = "theme";
  else if (target.finish && !target.titleWords) target.kind = "finish";
  else if (target.gadget && words.length <= 2) target.kind = "gadget";
  return target;
}

const stock = (v) => Number(v?.inventoryQuantity ?? v?.inventory_quantity ?? 0);
const live = (u) => typeof u === "string" && /^https?:\/\//.test(u) && !u.includes("res.cloudinary.com");

/**
 * Products for a target, best first: in stock before out of stock (those still
 * collect notify-me requests, so they stay listed), then newest.
 *
 * @param products all products (any status)
 * @param variantsByProduct Map<productId, variant[]>
 * @param collectionsByProduct Map<productId, Set<collectionName>>
 */
/**
 * The design-on-a-gadget a product row is a copy of.
 *
 * A design is a separate row for every gadget and brand it was cut for —
 * "Colourful Abstract Pattern Matte" exists 36 times, five of them phones —
 * and the SKU says which is which: R-41-IPH, R-41-SAM and R-41-OPL are all
 * R-41. The gadget is part of the key because R-19 alone spans eleven of
 * them: on a page that is not narrowed to one gadget, folding by the design
 * number would drop the laptop version into the phone version and lose ten
 * real products.
 *
 * Two things this deliberately leaves alone. The older series — L, M, T, A —
 * carry no brand suffix at all: one row each, sold for every model, and no
 * two of them share a number, so nothing of theirs is ever folded. And a SKU
 * that does not parse falls back to the row's own id, so an unusual one keeps
 * its place rather than joining somebody else's design.
 */
export const designKey = (p) => {
  const sku = (p?.variants || []).find((v) => v?.sku)?.sku || "";
  const m = String(sku).match(/^([A-Za-z]+-\d+)(?:-.+)?$/);
  const gadget = String(p?.gadgetCategory || "").toLowerCase();
  return m ? `${gadget}|${m[1].toUpperCase()}` : `id:${p?._id}`;
};

/**
 * One row per design, choosing the copy cut for the brand we care about.
 *
 * Preference order: the brand asked for, then the row that fits the most
 * brands (the generic "Android Phone Skin" over the OnePlus one), then
 * whichever came first, so the caller's ordering survives.
 */
export function oneRowPerDesign(rows, preferBrand) {
  const key = (b) => String(b ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const want = key(preferBrand);
  const rank = (p) => {
    const brands = (p.modelBrands || []).map(key).filter(Boolean);
    if (want && brands.includes(want)) return 0;
    return brands.length ? 2 : 1;
  };
  const width = (p) => (p.modelBrands || []).length || Infinity;
  const best = new Map();
  for (const p of rows) {
    const k = designKey(p);
    const seen = best.get(k);
    if (!seen || rank(p) < rank(seen) || (rank(p) === rank(seen) && width(p) > width(seen))) {
      best.set(k, p);
    }
  }
  return [...best.values()];
}

export function selectSeoProducts(target, products, variantsByProduct, collectionsByProduct) {
  const pool = products.filter((p) => p.status === "active" && p.slug && p.productCategory === "skin");
  const titleHas = (p, list) => {
    const t = ` ${slugify(p.title).replace(/-/g, " ")} `;
    return list.some((w) => t.includes(` ${w} `) || t.includes(` ${w}`));
  };

  let rows = pool;
  if (target.gadget) rows = rows.filter((p) => p.gadgetCategory === target.gadget);

  /*
   * A brand page shows that brand's listings.
   *
   * This filtered by gadget, finish, collection and title words and never by
   * brand — so /samsung-skins listed the OnePlus and Apple versions of a
   * design alongside the Samsung one, which is the wrong product on the page
   * a shopper reached by searching for their phone.
   *
   * A listing scoped to brands belongs on those brands' pages. One with no
   * scope is the older generic kind and fits any brand it does not exclude —
   * dropping those would empty half the catalogue off every brand page.
   */
  if (target.brand) {
    const key = (b) => String(b || "").toLowerCase().replace(/\s+/g, "");
    const want = key(target.brand);
    const scoped = (p) => (p.modelBrands || []).some((b) => key(b) === want);
    const excluded = (p) => (p.modelBrandsExclude || []).some((b) => key(b) === want);
    rows = rows.filter((p) => ((p.modelBrands || []).length ? scoped(p) : !excluded(p)));
    // The brand's own listings first: whoever came here searched for that name.
    rows = [...rows].sort((a, b) => Number(scoped(b)) - Number(scoped(a)));
  }
  if (target.finish) rows = rows.filter((p) => p.finishType === target.finish);
  if (target.collections?.length) {
    const want = new Set(target.collections);
    const inCollection = rows.filter((p) => [...(collectionsByProduct.get(p._id) || [])].some((c) => want.has(c)));
    rows = inCollection.length || !target.titleWords ? inCollection : rows;
  }
  if (target.titleWords?.length && (!target.collections?.length || rows.length === 0)) {
    rows = rows.filter((p) => titleHas(p, target.titleWords));
  }

  const decorated = rows.map((p) => {
    const vs = (variantsByProduct.get(p._id) || []).filter((v) => Number(v.price) > 0);
    return {
      p,
      vs,
      inStock: vs.some((v) => stock(v) > 0),
      created: Number(p._creationTime || p.createdAt || 0),
    };
  }).filter((r) => r.vs.length);

  decorated.sort((a, b) => Number(b.inStock) - Number(a.inStock) || b.created - a.created);

  // "From ₹X" must be a price someone can pay today: out-of-stock designs are
  // listed (they collect notify-me requests) but do not set the floor.
  const buyable = decorated.filter((r) => r.inStock);
  const prices = (buyable.length ? buyable : decorated).flatMap((r) =>
    r.vs.filter((v) => !buyable.length || stock(v) > 0).map((v) => Number(v.price)),
  );
  const finishes = [...new Set(decorated.map((r) => r.p.finishType).filter(Boolean))];

  return {
    total: decorated.length,
    inStock: decorated.filter((r) => r.inStock).length,
    minPrice: prices.length ? Math.min(...prices) : null,
    finishes,
    products: decorated.map(({ p, vs }) => ({
      _id: p._id,
      slug: p.slug,
      title: p.title,
      status: p.status,
      tags: "",
      productCategory: p.productCategory,
      gadgetCategory: p.gadgetCategory,
      finishType: p.finishType,
      /*
       * Which brands a design was cut for.
       *
       * The page carries one row per brand a design fits, so the grid needs
       * to know which is which — without this every version of a design looks
       * alike and the first one wins, which is how a page showing an iPhone
       * owner their own phone showed them a OnePlus instead.
       */
      ...(Array.isArray(p.modelBrands) && p.modelBrands.length ? { modelBrands: p.modelBrands } : {}),
      ...(Array.isArray(p.modelBrandsExclude) && p.modelBrandsExclude.length
        ? { modelBrandsExclude: p.modelBrandsExclude } : {}),
      images: (p.images || [])
        .map((i) => (typeof i === "string" ? { url: i } : i))
        .filter((i) => live(i?.url))
        .slice(0, 1)
        .map((i) => ({ url: i.url, alt: i.alt || p.title })),
      variants: vs.map((v) => ({
        _id: v._id,
        title: v.title,
        price: Number(v.price),
        compareAtPrice: v.compareAtPrice,
        sku: v.sku,
        inventory_quantity: stock(v),
        available: stock(v) > 0,
      })),
    })),
  };
}

const plural = (n) => (n >= 20 ? `${Math.floor(n / 10) * 10}+` : String(n));

/**
 * Title, description and the listing a page's "shop all" button should open.
 * Built from what the page actually offers, not from the keyword it was
 * generated for.
 */
export function seoCopy(page, targetIn, stats) {
  let target = targetIn;
  const n = stats?.total || 0;
  const from = stats?.minPrice ? ` | From ₹${stats.minPrice}` : "";
  const finishes = (stats?.finishes || []).map((f) => FINISH_LABEL[f]).filter(Boolean);
  const finishText = finishes.length
    ? `${finishes.slice(0, -1).join(", ")}${finishes.length > 1 ? " and " : ""}${finishes[finishes.length - 1]}`
    : "";
  const gadgetWord = (GADGET_LABEL[target.gadget] || "device").toLowerCase();
  const raw = page?.h1Heading || page?.metaTitle || "";
  // Generated headings are often all lowercase ("ps4 skins"); a title is not.
  const heading = raw === raw.toLowerCase()
    ? raw.replace(/\b([a-z])/g, (c) => c.toUpperCase())
    : raw.charAt(0).toUpperCase() + raw.slice(1);

  let title;
  let description;
  let listing = "/products?productType=skin";
  const params = new URLSearchParams({ productType: "skin" });
  if (target.gadget) params.set("gadget", target.gadget);
  if (target.finish) params.set("finish", target.finish);

  const tidy = (x) => String(x || "").replace(/\s+/g, " ").trim();
  if (target.kind === "model" && n) {
    target = { ...target, brand: tidy(target.brand), model: tidy(target.model) };
    title = `${target.model.startsWith(target.brand) ? "" : `${target.brand} `}${target.model} Skins – ${plural(n)} Designs, Custom Cut${from}`;
    description =
      `${plural(n)} skin designs printed and cut for the ${target.brand} ${target.model}` +
      (finishText ? ` in ${finishText} finishes` : "") +
      `${stats.minPrice ? `, from ₹${stats.minPrice}` : ""}. Exact cutouts for camera and ports. Free shipping above ₹499.`;
    params.set("brand", target.brand);
    params.set("model", target.model);
  } else if (target.kind === "brand" && n) {
    const count = target.models?.length || 0;
    title = `${target.brand} Skins – Cut for ${plural(count)} ${target.brand} Models${from}`;
    description =
      `Skins for ${plural(count)} ${target.brand} ${gadgetWord}s, each printed and cut to fit. ` +
      `${plural(n)} designs` + (finishText ? ` in ${finishText}` : "") +
      `${stats.minPrice ? ` from ₹${stats.minPrice}` : ""}. Free shipping above ₹499.`;
  } else if (n && target.kind !== "unlisted") {
    title = `${heading || "Skins"} – ${plural(n)} Designs, Custom Cut${from}`;
    description =
      `${plural(n)} ${heading ? heading.toLowerCase() : "skin"} designs, printed and cut for your exact ${gadgetWord}` +
      (finishText ? ` in ${finishText} finishes` : "") +
      `${stats.minPrice ? `, from ₹${stats.minPrice}` : ""}. Free shipping above ₹499.`;
  }

  if (title && title.length + " | GoSkinly".length <= 70) title += " | GoSkinly";
  listing = `/products?${params.toString()}`;
  return {
    title: title || page?.metaTitle || heading,
    description: description || page?.metaDescription || "",
    listing,
  };
}

export const gadgetLabel = (g) => GADGET_LABEL[g] || "";

/**
 * What a brand calls its own gadgets.
 *
 * "Apple Phones" is a phrase nobody says or searches — it is iPhone, MacBook
 * and iPad, and a hub row that says otherwise reads as though it were written
 * by somebody who does not sell them. Samsung's phones are Galaxy; Sony's
 * laptops have been VAIO for twenty years; Microsoft's console is an Xbox.
 *
 * Kept in step with COMBO_NAMES in functions/src/seoAuto.ts, which names the
 * pages themselves — the two have to agree or a link says one thing and the
 * page it opens says another.
 */
const BRAND_GADGET_LABELS = {
  "apple|phone": ["iPhone", "iPhones"],
  "apple|laptop": ["MacBook", "MacBooks"],
  "apple|tablet": ["iPad", "iPads"],
  "apple|mac-mini": ["Mac mini", "Mac mini"],
  "apple|charger": ["Charger", "Chargers"],
  "samsung|phone": ["Galaxy", "Galaxy phones"],
  "samsung|tablet": ["Galaxy Tab", "Galaxy Tabs"],
  "sony|laptop": ["VAIO", "VAIO laptops"],
  "microsoft|console": ["Xbox", "Xbox consoles"],
  // Checked against the models we carry: all 27 Google phones are Pixels, all
  // 7 LG laptops are Grams, all 13 Xiaomi tablets are a Pad, and every HMD
  // phone is named "HMD …". Same list the page generator names pages from.
  "google|phone": ["Pixel", "Pixels"],
  "lg|laptop": ["Gram", "Gram laptops"],
  "xiaomi|tablet": ["Pad", "Pads"],
  "hmd|phone": ["Nokia", "Nokia phones"],
  // Named for the line Samsung has shipped for years and will keep shipping,
  // not for the older notebooks still in the model list.
  "samsung|laptop": ["Galaxy Book", "Galaxy Books"],
  // Every OnePlus, Realme, Oppo and Honor tablet we carry is a Pad.
  "one-plus|tablet": ["Pad", "Pads"],
  "oneplus|tablet": ["Pad", "Pads"],
  "realme|tablet": ["Pad", "Pads"],
  "oppo|tablet": ["Pad", "Pads"],
  "honor|tablet": ["Pad", "Pads"],
  "motorola|tablet": ["Moto Pad", "Moto Pads"],
};

const PLAIN_GADGETS = {
  phone: ["Phone", "Phones"], laptop: ["Laptop", "Laptops"], tablet: ["Tablet", "Tablets"],
  camera: ["Camera", "Cameras"], lens: ["Lens", "Lenses"], controller: ["Controller", "Controllers"],
  console: ["Console", "Consoles"], drone: ["Drone", "Drones"], charger: ["Charger", "Chargers"],
  gimbals: ["Gimbal", "Gimbals"], gimbal: ["Gimbal", "Gimbals"], "mac-mini": ["Mac mini", "Mac mini"],
};

/**
 * "Apple" + "laptop" → "Apple MacBooks".
 *
 * @param plural true for a row of shelves ("Apple iPhones"), false for one
 *   thing ("Apple iPhone").
 */
export function brandGadgetLabel(brand, gadget, plural = false) {
  const key = `${slugify(String(brand || ""))}|${String(gadget || "").toLowerCase()}`;
  const pair = BRAND_GADGET_LABELS[key] || PLAIN_GADGETS[String(gadget || "").toLowerCase()];
  const word = pair ? pair[plural ? 1 : 0] : gadget;
  return `${brand} ${word}`.trim();
}

/**
 * The <title> of a product page, built the same way at build time and in the
 * browser.
 *
 * 781 of 1,447 product titles never said what the thing was — "RGB Zig Zag
 * OnePlus Phone | Skinly", "Black Board Doodles PS5 | Skinly" — so a search
 * for a PS5 skin had nothing on the page naming one. None said "mobile",
 * which is how most people in India search for a phone skin ("mobile back
 * skin"), and the brand was "Skinly" in 1,264 titles and "GoSkinly" in 43.
 * Now: a skin's title always names it a skin, a phone skin reads "Mobile Back
 * Skin", and every title ends "| GoSkinly", which matches the domain and is
 * not shared with the skincare brands called Skinly.
 */
export const SITE_NAME = "GoSkinly";

export function productSeoTitle(p) {
  const raw = String(p?.metaTitle || p?.title || "").trim();
  // Drop whatever brand suffix the stored title carried.
  let base = raw
    .replace(/\s*[|–-]\s*(go\s*skinly|skinly|premium finish)\s*$/i, "")
    .replace(/\s+by\s+(go\s*)?skinly(\.com)?\b/gi, "")
    .trim() || String(p?.title || "").trim();
  // "Sony Camera | Yellow Tech Circuit" names the device first; lead with the design.
  if (/\s\|\s/.test(base)) {
    const [device, ...rest] = base.split(/\s\|\s/);
    base = `${rest.join(" ")} ${device}`.trim();
  }
  const isSkin = p?.productCategory === "skin" || (!p?.productCategory && /\bskins?\b/i.test(base));
  if (isSkin) {
    if (p?.gadgetCategory === "phone") {
      // "… Phone Skin", "… Phone", "… Skin" all end as "… Mobile Back Skin".
      const core = base.replace(/\s*(?:[-–]\s*)?(?:(?:android|mobile)\s+)?(?:phone\s*)?(?:back\s*)?skins?$/i, "")
        .replace(/\s+phone$/i, "").trim();
      base = /\bmobile\b/i.test(core) ? `${core} Skin` : `${core} Mobile Back Skin`;
    } else if (!/\bskins?\b/i.test(base)) {
      base = `${base} Skin`;
    }
  }
  return `${base} | ${SITE_NAME}`;
}
