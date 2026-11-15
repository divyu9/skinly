/**
 * The hand-written guides (shape: src/lib/guides.mjs).
 *
 * Written from what the shop actually makes and how it is made: printed vinyl
 * cut on a plotter from each model's own template, packed with an install kit
 * in Agra. No prices in the prose — they move with every sale, and the
 * product page shows the live one. Links point at pages the live sitemap
 * carried on 15 Nov 2026; the build warns if one stops existing.
 *
 * Images: each has a prompt to generate it from (docs/guide-image-prompts.md
 * lists them). An image is shown only once it has a `src` — the file goes in
 * public/guides/<slug>/<key>.webp.
 */

const UPDATED = "2026-11-15";


export const GUIDES = [
  /* ───────────────────────────────────────────────────────────── finishes */
  {
    slug: "what-is-a-matte-skin",
    cluster: "finishes",
    title: "What Is a Matte Skin? Matte vs Glossy, Explained",
    metaTitle: "What Is a Matte Phone Skin? Matte vs Glossy Explained | GoSkinly",
    description: "A matte skin is printed vinyl with a low-sheen surface that hides fingerprints and small scratches. How it looks, feels and compares with glossy.",
    updated: UPDATED,
    answer: "A **matte skin** is a thin printed vinyl wrap with a soft, low-sheen surface. It scatters light instead of reflecting it, so it hides fingerprints, smudges and fine scratches far better than a glossy finish, feels dry and slightly grippy in the hand, and keeps the colours of the design calm rather than shiny. It is the finish most people choose for a phone they use all day.",
    cover: "cover",
    images: {
      cover: {
        alt: "A phone with a matte printed skin on its back, lying on a wooden desk in soft daylight",
        prompt: "Photorealistic product photo, 16:9. A modern smartphone lying face-down on a light oak desk, its back covered edge to edge by a printed vinyl skin with an abstract pastel wave pattern. The skin has a true matte finish: soft, even, non-reflective surface, no glare, no shine, colours slightly muted. Soft window daylight from the left, shallow depth of field, a coffee cup and a notebook blurred in the background. Clean, minimal, Indian home-office feel. No text, no logos, no watermark.",
      },
      compare: {
        alt: "Matte and glossy surfaces side by side under the same light: the glossy one shows glare and fingerprints",
        caption: "Same light, same design: matte (left) diffuses the light, glossy (right) throws it back.",
        prompt: "Photorealistic close-up macro product photo, 4:3. Two identical smartphones lying side by side on a neutral grey surface, both with the same blue-and-white abstract printed back skin. The left skin is matte: flat, soft, no reflections. The right skin is high-gloss: a bright window reflection streak across it and a few visible fingerprint smudges. A single soft light from the top-right makes the difference obvious. No text, no logos.",
      },
    },
    sections: [
      {
        id: "what-matte-means",
        h2: "What “matte” actually means",
        blocks: [
          "Matte describes the surface, not the design. Any artwork — a solid black, a marble, an anime panel — can be printed and finished matte. The surface is very slightly rough at a scale you can't see, so light that hits it scatters in every direction instead of bouncing back in one bright streak. That is why a matte skin never shows a hot spot of glare from a tube light or the sun.",
          "The practical result is a phone that looks the same from every angle and keeps looking clean between wipes. On a glossy surface every fingerprint is a little patch of oil that reflects light differently from the area around it; on matte, those patches mostly disappear into the texture.",
          { img: "compare" },
        ],
      },
      {
        id: "matte-vs-glossy",
        h2: "Matte vs glossy: the honest comparison",
        blocks: [
          {
            table: {
              head: ["", "Matte", "Glossy"],
              rows: [
                ["Fingerprints and smudges", "Barely visible", "Show up straight away"],
                ["Fine scratches", "Hidden by the texture", "Catch the light and show"],
                ["Feel in the hand", "Dry, slightly grippy", "Smooth, can feel slippery"],
                ["Colours", "Calm, soft, true to print", "Punchy and saturated"],
                ["Glare under lights", "None", "Strong reflections"],
                ["Best for", "Daily carry, work phones, dark designs", "Display pieces, very bright artwork"],
              ],
            },
          },
          "Glossy has one real advantage: bright, saturated designs look a little more vivid behind a shiny surface. For a phone that lives in your hand and pocket, though, the things that make glossy look good on day one — the shine, the depth — are the same things that make it look worn by week two.",
          { note: "Our printed skins come in **matte** and **3D textured** finishes, plus **Tranzy** (printed on clear film). We don't make a high-gloss phone skin, for the reasons above." },
        ],
      },
      {
        id: "who-should-choose-matte",
        h2: "Who should choose a matte skin",
        blocks: [
          {
            ul: [
              "**You hate wiping your phone.** Matte is the lowest-maintenance surface you can put on the back of a device.",
              "**Your phone has a glass back.** Glass backs are slippery and collect smudges; a matte skin gives them grip and hides prints.",
              "**You like dark designs.** Black, navy and deep colours show every fingerprint when glossy — matte keeps them looking solid. Browse [matte black skins](/matte-black-skins).",
              "**You use a clear case.** A matte skin under a clear case shows the design without doubling up on shine.",
              "**It's a work device.** A matte laptop lid looks clean in a meeting room under bright lights.",
            ],
          },
        ],
      },
      {
        id: "what-a-matte-skin-protects",
        h2: "What a matte skin protects against — and what it doesn't",
        blocks: [
          "A skin is a thin layer of vinyl. It takes the everyday wear that would otherwise land on your phone's own back: key scratches in a pocket, scuffs from a desk, the dull haze a glass back picks up over months. When you peel it off, the original back underneath looks the way it did when you put the skin on — which matters when you sell or exchange the phone.",
          "What it can't do is absorb a fall. If drop protection matters to you, put the skin on and add a clear case over it — see [phone skin vs back cover](/guides/phone-skin-vs-back-cover) for how to combine the two.",
        ],
      },
      {
        id: "how-ours-are-made",
        h2: "How our matte skins are made",
        blocks: [
          {
            ol: [
              "You pick a design and your exact device model.",
              "The design is printed on vinyl and given its matte finish.",
              "A plotter cuts it from that model's own template, with openings for every camera, sensor, port and button.",
              "It's packed with an install kit — wet and dry wipes, a dust absorber, a squeegee and a microfiber cloth — and photographed at our packing table in Agra before it ships. You can see those photos on [real photos](/real-photos).",
            ],
          },
          { tip: "Matte hides small dust specks less well than you'd think during install — a speck under the skin shows as a tiny bump. Use the dust absorber from the kit before you start. The [step-by-step install guide](/how-to-apply) shows exactly how." },
        ],
      },
      {
        id: "matte-or-3d",
        h2: "Matte or 3D textured?",
        blocks: [
          "If matte is the calm, clean option, [3D textured](/guides/what-is-a-3d-textured-skin) is the one you can feel: the artwork carries a raised relief that catches the light at an angle. Most people who want the design to be the star and don't want to think about it pick matte; people who want the skin to feel like a material — leather, carbon, stone — pick 3D. The full side-by-side is in [matte vs 3D vs Tranzy vs leather](/guides/skin-finishes-compared).",
        ],
      },
    ],
    faqs: [
      { q: "Does a matte skin get dirty easily?", a: "No — it hides fingerprints and smudges better than any glossy surface. Wipe it with a dry or slightly damp microfiber cloth when it needs it; see [cleaning and care](/guides/skin-care-cleaning-and-removal)." },
      { q: "Will a matte skin fade?", a: "Normal use, pockets and hands don't fade it in any noticeable way. Long hours in direct, strong sun (a car dashboard in summer) are what age any printed vinyl fastest." },
      { q: "Is a matte skin slippery?", a: "Less than a bare glass back. The low-sheen surface feels dry and gives a little more grip." },
      { q: "Can I put a case over a matte skin?", a: "Yes. A skin is thin enough that most cases fit over it; a clear case shows off the design and adds drop protection." },
    ],
    related: ["what-is-a-3d-textured-skin", "skin-finishes-compared", "phone-skin-vs-back-cover"],
    shop: [
      { label: "Matte phone skins", href: "/matte-phone-skins" },
      { label: "Matte laptop skins", href: "/matte-laptop-skin" },
      { label: "Matte black skins", href: "/matte-black-skins" },
    ],
  },

  {
    slug: "what-is-a-3d-textured-skin",
    cluster: "finishes",
    title: "What Is a 3D Textured (Embossed) Skin?",
    metaTitle: "What Is a 3D Textured Skin? Embossed Phone Skins Explained | GoSkinly",
    description: "A 3D textured skin has a raised relief you can feel — leather, carbon, stone and more. How it differs from matte, how it feels, and who it suits.",
    updated: UPDATED,
    answer: "A **3D textured skin** (also called an embossed skin) is a printed vinyl wrap whose surface carries a raised relief you can feel with your fingertip. The texture catches light at an angle, so a carbon-fibre, leather or stone design looks and feels closer to the real material than a flat print can. It costs a little more than matte, adds grip, and is the finish people choose when they want the back of the phone to feel special.",
    cover: "cover",
    images: {
      cover: {
        alt: "Close-up of a phone back with a 3D textured skin, light raking across its raised pattern",
        prompt: "Photorealistic macro product photo, 16:9. The back of a smartphone covered by a vinyl skin with a dark carbon-fibre weave design that has a real raised, embossed texture. Low raking light from the side picks out the tiny ridges of the relief so the 3D texture is clearly visible; no gloss, a satin sheen at most. Camera cut-out visible at the top corner, crisp edges. Dark slate background. No text, no logos, no watermark.",
      },
      finger: {
        alt: "A fingertip running across the raised texture of an embossed phone skin",
        caption: "The relief is fine but real — you feel it before you see it.",
        prompt: "Photorealistic close-up, 4:3. A person's fingertip gently touching the back of a phone covered in an embossed vinyl skin with a tan leather-grain design; the raised grain is visible in side light. Warm indoor light, shallow depth of field, Indian skin tone hand, natural nails. No text, no logos.",
      },
    },
    sections: [
      {
        id: "what-3d-means",
        h2: "What makes a skin “3D”",
        blocks: [
          "A regular skin is flat: the design is printed and the surface is smooth. On a 3D textured skin the surface itself has depth — a fine, even relief pressed into or built up on the vinyl. You can feel it with your thumb, and when light comes from the side, the raised areas catch it and the low areas fall into shadow.",
          "You'll see the same finish called **3D**, **3D textured**, **embossed** or **3D embossed**. On our site they all mean the same thing. The look is never glossy — it reads as satin or matte, with the texture doing the work.",
          { img: "finger" },
        ],
      },
      {
        id: "designs-that-suit-3d",
        h2: "Designs that come alive in 3D",
        blocks: [
          "Texture makes the most difference on designs that imitate a material, because your eye and your fingers both get the cue:",
          {
            ul: [
              "**Carbon fibre and weave patterns** — the classic; the ridges make the weave look real.",
              "**Leather and grain** — see [leather finish skins](/leather-finish-skins).",
              "**Marble and stone** — veins with depth instead of a photo of veins. Browse [marble texture skins](/marble-texture-skins).",
              "**Metal, wood and rock textures** — anything that should feel rough.",
            ],
          },
          "It works on bold graphic and character designs too; there the texture is less about realism and more about grip and a premium feel. Every 3D design we make is in [3D textured finish skins](/3d-textured-finish-skins), and phone ones in [3D embossed phone skins](/3d-embossed-phone-skins).",
        ],
      },
      {
        id: "3d-vs-matte",
        h2: "3D textured vs matte",
        blocks: [
          {
            table: {
              head: ["", "3D textured", "Matte"],
              rows: [
                ["Surface", "Raised relief you can feel", "Smooth, low-sheen"],
                ["Grip", "The grippiest finish we make", "Better than bare glass"],
                ["Fingerprints", "Hidden", "Hidden"],
                ["Look", "Changes with the angle of light", "The same from every angle"],
                ["Feel", "Like a material", "Clean, dry, minimal"],
                ["Price", "A step above matte", "Our everyday finish"],
              ],
            },
          },
          "Both hide fingerprints. The choice is really about whether you want the skin to disappear into the design (matte) or to be a thing you notice every time you pick the phone up (3D). Read [what is a matte skin](/guides/what-is-a-matte-skin) for the other side.",
        ],
      },
      {
        id: "installing-3d",
        h2: "Installing a 3D skin",
        blocks: [
          "The install is the same as any of our skins — clean, de-dust, start from the bottom ports, squeegee upwards. Two things are worth knowing:",
          {
            ul: [
              "Press with the squeegee and then with your thumb along the edges: the textured surface spreads pressure a little less evenly than a flat one, and a firm final press helps the adhesive bond everywhere.",
              "On a full body wrap, the corner flaps on curved edges set best with a couple of seconds of gentle warmth, exactly as the [install guide](/how-to-apply) shows. Keep heat brief so the texture isn't flattened.",
            ],
          },
        ],
      },
      {
        id: "is-3d-worth-it",
        h2: "Is 3D worth the extra?",
        blocks: [
          "If you hold your phone a lot, keep it without a case, or simply love the idea of a carbon or leather back, yes — the feel is the whole point, and it's something a photo on a product page can't fully show. If you plan to cover the skin with a case most of the time, matte gives you the same look for less, since nobody will feel the texture through a case.",
        ],
      },
    ],
    faqs: [
      { q: "Is embossed the same as 3D textured?", a: "Yes. On GoSkinly “3D”, “3D textured” and “embossed” all describe the same raised-relief finish." },
      { q: "Does a 3D skin make the phone thicker?", a: "Very slightly more than a flat skin, because of the relief — still far thinner than any case." },
      { q: "Can I use a case over a 3D textured skin?", a: "Yes. It fits under most cases; you just won't feel the texture while the case is on." },
      { q: "Does the texture wear smooth?", a: "The relief holds up to normal handling. Like any skin, heavy friction in the same spot over a long time is what wears it, and you can always replace it — it peels off clean." },
    ],
    related: ["what-is-a-matte-skin", "skin-finishes-compared", "what-is-a-tranzy-skin"],
    shop: [
      { label: "3D textured finish skins", href: "/3d-textured-finish-skins" },
      { label: "3D embossed phone skins", href: "/3d-embossed-phone-skins" },
      { label: "3D embossed laptop skins", href: "/3d-embossed-phone-laptop-skins" },
    ],
  },

  {
    slug: "what-is-a-tranzy-skin",
    cluster: "finishes",
    title: "What Is a Tranzy Skin? Transparent Skins Explained",
    metaTitle: "What Is a Tranzy (Transparent) Skin? How Clear Skins Work | GoSkinly",
    description: "A Tranzy skin is artwork printed on clear film, so your device's own colour shows through. Which devices it suits best, and what to expect.",
    updated: UPDATED,
    answer: "A **Tranzy skin** is a design printed on clear, transparent film. Only the ink is visible — everywhere the artwork is empty, your device's own colour and finish show through, so the design looks as if it were printed straight onto the phone or laptop. It works best on light-coloured devices (silver, white, pastel) where the ink stands out, and on phones it covers the back panel only.",
    cover: "cover",
    images: {
      cover: {
        alt: "A silver laptop lid with a transparent skin: printed artwork sits directly on the bare aluminium",
        prompt: "Photorealistic product photo, 16:9. A silver aluminium laptop lid seen from slightly above on a white desk. A transparent vinyl skin covers the lid but is invisible: only its printed black-and-red line artwork of a race car is visible, and everywhere else the brushed silver metal shows through as if the art were screen-printed directly onto the aluminium. No white background on the skin, no visible film edge except a very faint cut line. Bright soft daylight. No text, no brand logos.",
      },
      darklight: {
        alt: "The same transparent design on a silver phone and a black phone: it stands out on silver and fades on black",
        caption: "Same Tranzy design: crisp on a light device, much quieter on a black one.",
        prompt: "Photorealistic product photo, 4:3. Two smartphones lying face-down side by side on a light grey surface. Both have the same transparent printed skin showing dark navy line-art of a city street. On the left phone (silver back) the artwork is crisp and clearly visible with the silver showing through. On the right phone (matte black back) the same dark artwork almost disappears into the black. Even soft light. No text, no logos.",
      },
    },
    sections: [
      {
        id: "how-tranzy-works",
        h2: "How a Tranzy skin works",
        blocks: [
          "A regular skin is printed on opaque vinyl: what you see is the skin, and your device is hidden under it. A Tranzy sheet is printed on **clear film** instead. When it arrives, the white you see around the design is the peel-off paper backing, not part of the skin — once it's on, that area becomes see-through and your device shows through it.",
          "So the finished look is a silhouette, a piece of line art or a pattern sitting directly on your device's own surface — brushed aluminium on a MacBook, the factory colour on a phone. Our Tranzy sheets have a matte surface, so there's no plastic shine over the device either.",
        ],
      },
      {
        id: "which-devices-suit-tranzy",
        h2: "Which devices suit Tranzy — and which don't",
        blocks: [
          "This is the single most important thing to know before you order one. A transparent skin can only add ink; it can't make your device lighter. Colours that are darker than your device show clearly, and colours close to your device's own colour fade into it.",
          { img: "darklight" },
          {
            table: {
              head: ["Device colour", "How a Tranzy design looks"],
              rows: [
                ["Silver, white, starlight, light grey", "Best — dark and bright ink both stand out crisply"],
                ["Pastels (light blue, pink, mint)", "Very good — the device colour becomes the background"],
                ["Gold, mid-grey, mid-blue", "Good with dark or high-contrast designs"],
                ["Black, midnight, deep navy", "Dark parts of the design will disappear — choose an opaque skin instead"],
              ],
            },
          },
          { tip: "If your phone is black or very dark, pick a [matte](/guides/what-is-a-matte-skin) or [3D textured](/guides/what-is-a-3d-textured-skin) skin — those are opaque, so the design looks the same on any colour." },
        ],
      },
      {
        id: "coverage",
        h2: "Coverage: back only on phones, top only on laptops",
        blocks: [
          "Tranzy phone skins are cut for the **back panel only**, not as a full body wrap — clear film reads best on the flat back, and the sides look cleaner bare. On laptops, Tranzy covers the **top lid**. If you want the sides of your phone covered too, choose an opaque skin with [full body wrap](/guides/full-body-wrap-vs-only-back).",
        ],
      },
      {
        id: "installing-tranzy",
        h2: "Installing a Tranzy skin: be extra careful with dust",
        blocks: [
          "Because you can see through it, anything trapped underneath shows — a speck of dust or a hair is visible in a way it never is under an opaque skin. Clean more carefully than you think you need to:",
          {
            ol: [
              "Wipe with the wet wipe, then the dry wipe, until the surface is spotless and completely dry.",
              "Go over the whole area with the dust absorber, twice.",
              "Peel the skin off its backing slowly, and line it up from the bottom edge.",
              "Squeegee from the centre outwards to push any air to the edges.",
            ],
          },
          "The full walkthrough, with video, is in [how to apply your skin](/how-to-apply).",
        ],
      },
      {
        id: "is-tranzy-for-you",
        h2: "Is Tranzy right for you?",
        blocks: [
          "Choose Tranzy if you like your device's own colour and want to add to it rather than cover it — a sticker-bomb look on a silver MacBook, a minimal line drawing on a white phone. Choose an opaque finish if your device is dark, if you want to hide existing scratches, or if you want full body coverage. See every finish side by side in [matte vs 3D vs Tranzy vs leather](/guides/skin-finishes-compared).",
        ],
      },
    ],
    faqs: [
      { q: "Is a Tranzy skin the same as a clear case?", a: "No. A clear case is a rigid shell for drop protection. A Tranzy skin is a thin printed film that sticks to the device and adds a design; you can use both together." },
      { q: "Will a Tranzy skin show on a black phone?", a: "Only the light parts of the design will show clearly; dark artwork fades into a black back. For dark phones an opaque matte or 3D skin is the better choice." },
      { q: "Why is the skin white when it arrives?", a: "That white is the paper backing you peel off. The skin itself is clear — once applied, those areas let your device show through." },
      { q: "Does a Tranzy skin hide scratches?", a: "No — it's see-through, so existing scratches still show. It does protect the surface from new ones." },
    ],
    related: ["skin-finishes-compared", "what-is-a-matte-skin", "laptop-and-macbook-skin-guide"],
    shop: [
      { label: "Transparent (Tranzy) skins", href: "/transparent-skins" },
      { label: "Transparent phone skins", href: "/transparent-phone-skin" },
      { label: "Laptop skins", href: "/laptop-skins" },
    ],
  },

  {
    slug: "skin-finishes-compared",
    cluster: "finishes",
    title: "Matte vs 3D Textured vs Tranzy vs Leather: Which Skin Finish to Pick",
    metaTitle: "Matte vs 3D vs Tranzy vs Leather Skins — Which Finish? | GoSkinly",
    description: "Every skin finish side by side: how matte, 3D textured, Tranzy and leather look, feel and suit different devices, with a quick way to choose.",
    updated: UPDATED,
    answer: "Pick **matte** for a clean, fingerprint-free everyday skin on any device; **3D textured** when you want to feel the design (carbon, leather, stone) and get the most grip; **Tranzy** when your device is light-coloured and you want its own colour to show through the artwork; and a **leather finish** for a classic, premium look. Matte suits most people, and is the safest choice on a dark device.",
    cover: "cover",
    images: {
      cover: {
        alt: "Four phones side by side showing matte, 3D textured, transparent and leather finish skins",
        prompt: "Photorealistic flat-lay product photo, 16:9. Four smartphones lying face-down in a neat row on a warm beige surface, each with a different vinyl skin: (1) a matte pastel abstract print with no shine, (2) a dark carbon-fibre skin with visible raised 3D texture, (3) a silver phone with a transparent skin where only black line-art is visible on the bare silver, (4) a brown leather-grain finish skin. Soft even top light, subtle shadows. Clean editorial style. No text, no logos, no watermark.",
      },
    },
    sections: [
      {
        id: "at-a-glance",
        h2: "All four finishes at a glance",
        blocks: [
          {
            table: {
              head: ["", "Matte", "3D textured", "Tranzy", "Leather finish"],
              rows: [
                ["Look", "Soft, no shine", "Relief that catches light", "Art on your device's own colour", "Grain, classic"],
                ["Feel", "Smooth, dry", "Raised, grippiest", "Smooth, matte", "Textured grain"],
                ["Hides fingerprints", "Yes", "Yes", "Mostly", "Yes"],
                ["Hides old scratches", "Yes", "Yes", "No — it's clear", "Yes"],
                ["Works on dark devices", "Yes", "Yes", "Poorly", "Yes"],
                ["Phone coverage", "Back or full body", "Back or full body", "Back only", "As listed"],
                ["Best for", "Everyday, any device", "Hands-on, no-case users", "Silver / white devices", "A premium, formal look"],
              ],
            },
          },
        ],
      },
      {
        id: "quick-chooser",
        h2: "Choose in three questions",
        blocks: [
          {
            ol: [
              "**Is your device black or very dark?** Skip Tranzy — go matte or 3D.",
              "**Will a case cover the skin most of the time?** Go matte. Nobody feels a texture through a case, so 3D's extra is wasted.",
              "**Do you want the back to feel like a material, or just look great?** Feel → [3D textured](/guides/what-is-a-3d-textured-skin) or leather. Look → [matte](/guides/what-is-a-matte-skin). Want your device's own colour to stay? → [Tranzy](/guides/what-is-a-tranzy-skin).",
            ],
          },
        ],
      },
      {
        id: "matte",
        h2: "Matte: the everyday default",
        blocks: [
          "Matte is printed vinyl with a low-sheen surface. It doesn't reflect lights, hides fingerprints and fine scratches, and keeps colours calm and accurate. It's our widest range — almost every design, on almost every device we cut for. If you're unsure, this is the one. [Matte phone skins](/matte-phone-skins) · [matte laptop skins](/matte-laptop-skin).",
        ],
      },
      {
        id: "3d",
        h2: "3D textured: the one you can feel",
        blocks: [
          "Also sold as embossed. The surface carries a fine raised relief, so material designs — carbon fibre, leather, marble, rock — look real and feel real. It's the grippiest finish, and the one people notice when they pick your phone up. [3D textured finish skins](/3d-textured-finish-skins).",
        ],
      },
      {
        id: "tranzy",
        h2: "Tranzy: art on your device's own colour",
        blocks: [
          "Printed on clear film. Only the ink shows, and your device's colour is the background — beautiful on a silver MacBook or a white phone, poor on a black one because dark ink disappears. Phone Tranzy skins cover the back only. [Transparent skins](/transparent-skins).",
        ],
      },
      {
        id: "leather",
        h2: "Leather finish: the classic",
        blocks: [
          "A leather-grain look and feel for people who want their device to read as premium and understated — think a diary or a wallet rather than a poster. [Leather finish skins](/leather-finish-skins).",
        ],
      },
      {
        id: "same-everywhere",
        h2: "What's the same whatever you choose",
        blocks: [
          {
            ul: [
              "Every skin is cut for your **exact model** from its own template — see [how to find your exact model](/guides/find-your-exact-device-model).",
              "Every one comes with the install kit and peels off without residue.",
              "Every one guards against scratches and scuffs — none of them protects against drops. Pair with a case if you need that: [skin vs back cover](/guides/phone-skin-vs-back-cover).",
            ],
          },
        ],
      },
    ],
    faqs: [
      { q: "Which skin finish is the most popular?", a: "Matte — it suits every device and colour, hides fingerprints and costs the least. 3D textured is the most popular upgrade." },
      { q: "Which finish is best for a black phone?", a: "Matte or 3D textured. Both are opaque, so the design looks exactly as pictured. A transparent (Tranzy) skin loses its dark artwork against black." },
      { q: "Which finish has the best grip?", a: "3D textured, because of its raised relief. Matte comes next and is still grippier than a bare glass back." },
      { q: "Do you make glossy skins?", a: "Not for phones. Glossy shows every fingerprint and scratch within days, so our printed skins are matte, 3D textured or Tranzy." },
    ],
    related: ["what-is-a-matte-skin", "what-is-a-3d-textured-skin", "what-is-a-tranzy-skin"],
    shop: [
      { label: "All skins", href: "/skins" },
      { label: "Phone skins", href: "/phone-skins" },
      { label: "Laptop skins", href: "/laptop-skins" },
    ],
  },

  /* ───────────────────────────────────────────────────────────── choosing */
  {
    slug: "phone-skin-vs-back-cover",
    cluster: "choosing",
    title: "Phone Skin vs Back Cover: Which Is Better?",
    metaTitle: "Phone Skin vs Back Cover — Which Is Better for You? | GoSkinly",
    description: "Skin or back cover? What each protects against, how they feel, and why many people use a thin skin under a clear case for the best of both.",
    updated: UPDATED,
    answer: "A **phone skin** is a thin printed vinyl wrap: it changes the look, keeps the phone slim, adds grip and protects the back from scratches — but not from drops. A **back cover** (case) adds bulk and protects against drops and corners hitting the floor. If you want both, put a skin on and a **clear case** over it: you see the design and get drop protection.",
    cover: "cover",
    images: {
      cover: {
        alt: "A slim phone with a skin next to the same phone in a thick back cover",
        prompt: "Photorealistic product photo, 16:9. Two identical smartphones standing upright side by side on a white desk, shot from a low angle to show their thickness. Left: a slim phone wrapped in a bold geometric printed vinyl skin, edges crisp, almost no added thickness. Right: the same phone inside a thick black rugged back cover with raised corners. Soft studio light, clean background. No text, no logos.",
      },
      combo: {
        alt: "A phone with a printed skin inside a clear transparent case",
        caption: "Skin + clear case: the design shows, and the case takes the falls.",
        prompt: "Photorealistic product photo, 4:3. A smartphone lying at a slight angle on a light wooden table, inside a crystal-clear transparent case, with a colourful anime-style printed vinyl skin visible through the case on the phone's back. Natural daylight, a few soft reflections on the clear case. No text, no logos.",
      },
    },
    sections: [
      {
        id: "what-each-does",
        h2: "What each one actually does",
        blocks: [
          {
            table: {
              head: ["", "Skin", "Back cover / case"],
              rows: [
                ["Drop protection", "No", "Yes — depends on the case"],
                ["Scratch and scuff protection", "Yes", "Yes"],
                ["Thickness added", "Barely any", "Noticeable"],
                ["Feel", "The phone's own shape", "The case's shape"],
                ["Design choice", "Hundreds of printed designs", "Usually a few colours"],
                ["Fits the exact phone", "Cut for your model", "Moulded for your model"],
                ["Wireless charging", "Works through a thin skin", "Works through most thin cases"],
              ],
            },
          },
          "The two aren't really competitors — they solve different problems. A case is insurance against falls. A skin is about how the phone looks and feels every day, and about keeping its original back in mint condition.",
        ],
      },
      {
        id: "choose-a-skin-if",
        h2: "Choose a skin if…",
        blocks: [
          {
            ul: [
              "You bought a slim phone because it's slim, and a case undoes that.",
              "You rarely drop your phone, or you're fine with the risk.",
              "You want a design that says something about you — anime, gaming, minimal, quotes. Browse [anime](/anime-skins), [gaming](/gaming-phone-skins) or [minimal](/minimal-phone-skins) phone skins.",
              "You want the original back untouched for resale or exchange.",
              "A glass back feels slippery and you want grip without bulk.",
            ],
          },
        ],
      },
      {
        id: "choose-a-cover-if",
        h2: "Choose a back cover if…",
        blocks: [
          {
            ul: [
              "You drop your phone often, or work somewhere it's likely to fall on a hard floor.",
              "Your phone's screen and corners need cushioning — a skin does nothing for the screen.",
              "You want card slots, a kickstand or a MagSafe wallet attachment.",
            ],
          },
        ],
      },
      {
        id: "best-of-both",
        h2: "The best of both: skin under a clear case",
        blocks: [
          "This is what many of our customers end up doing. The skin carries the design and keeps the back scratch-free; a clear case over it takes the falls and shows the design through. Because a skin is so thin, most cases fit over it the way they would on the bare phone.",
          { img: "combo" },
          "A few tips for the combination:",
          {
            ul: [
              "Choose **only back** coverage if your case is very tight around the sides — the sides then stay as they were. See [full body wrap vs only back](/guides/full-body-wrap-vs-only-back).",
              "Give the skin a few hours to bond before putting the case on.",
              "A matte skin under a clear case looks best; it avoids a double layer of shine.",
              "We stock [transparent MagSafe cases](/cases-covers) for iPhone and Samsung models, and [camera rings](/camera-rings) and [screen protectors](/screen-protectors) to finish the setup.",
            ],
          },
        ],
      },
      {
        id: "myths",
        h2: "Common worries, answered",
        blocks: [
          "**“A skin will make my phone hot.”** A thin vinyl wrap traps far less heat than a thick rubber case. More on this in [do skins cause heating or block charging](/guides/do-phone-skins-cause-heating-or-block-charging).",
          "**“Taking it off will ruin the back.”** Our skins peel off without residue, leaving the original finish as it was.",
          "**“It won't fit my exact phone.”** Every skin is cut from your model's own template, with openings for each camera and button — which is why getting the [exact model](/guides/find-your-exact-device-model) right matters.",
        ],
      },
    ],
    faqs: [
      { q: "Can I use a skin and a back cover together?", a: "Yes. A skin is thin enough that most cases fit over it. A clear case shows the design and adds drop protection." },
      { q: "Does a skin protect my phone if it falls?", a: "No. A skin protects the surface from scratches and scuffs; it doesn't cushion a fall. Use a case for that." },
      { q: "Is a skin better than a cover for resale value?", a: "A skin keeps the original back free of scratches and peels off clean, so the phone looks closer to new when you sell or exchange it." },
      { q: "Does a skin protect the screen?", a: "No — it covers the back and, with full body wrap, the sides. Use a screen protector for the front." },
    ],
    related: ["full-body-wrap-vs-only-back", "do-phone-skins-cause-heating-or-block-charging", "skin-finishes-compared"],
    shop: [
      { label: "Phone skins", href: "/phone-skins" },
      { label: "Clear & MagSafe cases", href: "/cases-covers" },
      { label: "Screen protectors", href: "/screen-protectors" },
    ],
  },

  {
    slug: "full-body-wrap-vs-only-back",
    cluster: "choosing",
    title: "Full Body Wrap vs Only Back: Which Phone Skin Coverage to Choose",
    metaTitle: "Full Body Wrap vs Only Back Phone Skin — Which to Choose? | GoSkinly",
    description: "Full body wrap covers the back and sides of your phone; only back covers the back panel. How they differ in look, install and use with a case.",
    updated: UPDATED,
    answer: "**Full body wrap** covers the back of the phone and wraps around its sides, so the whole phone takes on the design and the frame is protected from scuffs too. **Only back** covers the flat back panel and leaves the sides as they are. Choose full body for the complete look on a phone you carry without a case; choose only back if you use a tight case or want the quickest install.",
    cover: "cover",
    images: {
      cover: {
        alt: "Two phones from the side: one with the skin wrapping the sides, one with the skin on the back only",
        prompt: "Photorealistic product photo, 16:9. Two smartphones lying face-down at a three-quarter angle on a light grey surface so both the back and one long side are visible. Left phone: a printed vinyl skin with a green camouflage design covers the back and wraps continuously around the curved side edge (full body wrap). Right phone: the same design covers only the flat back panel, and the metal side frame is bare. Even studio light. No text, no logos.",
      },
      corners: {
        alt: "Pressing down a skin corner flap on the curved edge of a phone",
        caption: "Full body wrap corners on curved edges set with a couple of seconds of warmth, then a firm press.",
        prompt: "Photorealistic close-up, 4:3. A thumb pressing down the corner of a printed vinyl skin where it wraps around the rounded corner of a phone's side frame. Clean desk, soft light, shallow depth of field. A small plastic squeegee lies nearby. No flame, no text, no logos.",
      },
    },
    sections: [
      {
        id: "difference",
        h2: "The difference in one table",
        blocks: [
          {
            table: {
              head: ["", "Full body wrap", "Only back"],
              rows: [
                ["Covers", "Back + sides", "Back panel"],
                ["Look", "The whole phone in the design", "Design on the back, factory frame on the sides"],
                ["Protects the frame from scuffs", "Yes", "No"],
                ["Install time", "A few minutes more (sides and corners)", "Quickest"],
                ["With a tight case", "Can feel snug", "Fits like the bare phone"],
                ["Available on Tranzy", "No", "Yes — Tranzy is back only"],
              ],
            },
          },
        ],
      },
      {
        id: "when-full-body",
        h2: "When full body wrap is the better choice",
        blocks: [
          {
            ul: [
              "You carry the phone without a case and want it to look like a finished object, not a phone with a sticker on the back.",
              "Your phone's metal or plastic frame already has scuffs you'd like to hide, or you want to keep it from getting them.",
              "You've chosen a bold design — camouflage, carbon, marble — that looks best continuous around the edges.",
            ],
          },
        ],
      },
      {
        id: "when-only-back",
        h2: "When only back is the better choice",
        blocks: [
          {
            ul: [
              "You use a snug case. With only back coverage the sides stay exactly as thick as the case was designed for.",
              "You want the easiest, fastest install — there are no side flaps or corners to set.",
              "You like your phone's frame colour (a titanium or coloured aluminium frame) and want it to show.",
              "You're choosing a [Tranzy (transparent) skin](/guides/what-is-a-tranzy-skin) — those are cut for the back only.",
            ],
          },
        ],
      },
      {
        id: "installing-full-body",
        h2: "Installing a full body wrap without lifting corners",
        blocks: [
          "The back goes on exactly like an only-back skin: start at the bottom ports and work up. Then the sides:",
          {
            ol: [
              "Press each long side down along the frame with your thumb, from the middle outwards.",
              "On curved edges, the four corner flaps may want to stand up. Warm each one for about two seconds — a hair dryer is the easiest way — and press it down at once.",
              "Finish with a firm press all round and a wipe with the microfiber cloth. The hold keeps getting stronger over the next few hours.",
            ],
          },
          { img: "corners" },
          "The [install guide and video](/how-to-apply) shows every step, including how far to keep any heat from the skin.",
        ],
      },
    ],
    faqs: [
      { q: "Does full body wrap cover the screen?", a: "No. It covers the back and the sides of the phone; the screen and its edges stay uncovered." },
      { q: "Will a case fit over a full body wrap?", a: "Most cases do, because the skin is thin. A very tight case can feel snugger on the sides — choose only back if you use one." },
      { q: "Why do the corners of a full body wrap lift?", a: "Curved corners pull the vinyl. A couple of seconds of gentle warmth on each corner flap, then a firm press, sets them." },
      { q: "Can I get a transparent skin as a full body wrap?", a: "No — Tranzy (transparent) phone skins are cut for the back panel only." },
    ],
    related: ["phone-skin-vs-back-cover", "find-your-exact-device-model", "skin-care-cleaning-and-removal"],
    shop: [
      { label: "Phone skins", href: "/phone-skins" },
      { label: "iPhone skins", href: "/apple-iphone-skins" },
      { label: "Samsung skins", href: "/samsung-skins" },
    ],
  },

  {
    slug: "find-your-exact-device-model",
    cluster: "choosing",
    title: "How to Find Your Exact Phone, Laptop or Tablet Model",
    metaTitle: "How to Find Your Exact Phone or Laptop Model (Before You Buy a Skin) | GoSkinly",
    description: "Skins are cut per model, so “Galaxy S25” and “S25 Ultra” are different cuts. How to find the exact model name on iPhone, Android, MacBook, Windows and iPad.",
    updated: UPDATED,
    answer: "Every skin is cut for one exact model, so check the name in your device's settings before ordering. **iPhone:** Settings → General → About → Model Name. **Android:** Settings → About phone. **MacBook:** Apple menu → About This Mac. **Windows laptop:** the sticker under the laptop, or Settings → System → About. **iPad:** Settings → General → About. Match that full name — including Pro, Plus, Ultra, 5G or the year — on our site.",
    cover: "cover",
    images: {
      cover: {
        alt: "A phone showing its About screen with the model name, next to a laptop",
        prompt: "Photorealistic product photo, 16:9. A hand holding a smartphone whose screen shows a generic settings 'About phone' page with a highlighted 'Model name' row (generic UI, no real brand logos, text kept minimal and blurred except the words 'Model name'). A laptop is partly visible, out of focus, in the background on a desk. Soft daylight. No real brand names or logos.",
      },
      cameras: {
        alt: "Two phones of the same series with different camera layouts",
        caption: "Same series, different camera bumps — which is why a skin for one won't fit the other.",
        prompt: "Photorealistic product photo, 4:3. Two smartphones of the same generic design family lying face-down side by side, one standard size with a two-lens camera bump and one larger 'Ultra' size with a four-lens camera bump in a different position. Neutral background, even light. No logos, no text.",
      },
    },
    sections: [
      {
        id: "why-it-matters",
        h2: "Why the exact model matters",
        blocks: [
          "A skin isn't a stretchy cover; it's a flat piece of vinyl cut on a plotter from a template of one device — its outline, its corner radius, and the exact position of every camera, flash, sensor, port and button. Phones that share a name can differ in all of those. A Galaxy S25 and an S25 Ultra are different sizes with different camera layouts; an iPhone 16 Pro and 16 Pro Max differ by more than you'd think; a laptop's lid changes between model years even when the name barely does.",
          { img: "cameras" },
          "So the one thing to get right before you order is the full model name.",
        ],
      },
      {
        id: "iphone",
        h2: "iPhone",
        blocks: [
          { ol: ["Open **Settings → General → About**.", "Read **Model Name** — for example “iPhone 16 Pro Max”.", "Pick exactly that on our site: [iPhone skins](/apple-iphone-skins)."] },
          "Watch for: Pro vs Pro Max, Plus vs standard, and the SE generations, which look alike but differ.",
        ],
      },
      {
        id: "android",
        h2: "Android phones (Samsung, OnePlus, Xiaomi, Vivo, Oppo, Realme and others)",
        blocks: [
          { ol: ["Open **Settings → About phone** (on some phones: Settings → System → About).", "Read the **device name** or **model name** — for example “Galaxy S25 Ultra” or “OnePlus 13”.", "If it shows only a code (like SM-S938B), search that code online to get the marketing name."] },
          "Watch for: 4G vs 5G versions, Pro/Plus/Ultra/Neo/Lite suffixes, and FE (Fan Edition) models. They are often physically different phones. Find yours in [Samsung](/samsung-skins), [OnePlus](/oneplus-skins) or all [supported devices](/devices).",
        ],
      },
      {
        id: "macbook",
        h2: "MacBook",
        blocks: [
          { ol: ["Click the **Apple menu → About This Mac**.", "Note the line like “MacBook Air 13-inch, M2, 2022” — size, chip and year all matter.", "Not booting? The model number (A followed by four digits, e.g. A2681) is printed in small text on the bottom case."] },
          "Our MacBook pages carry those names and A-numbers so you can match either one: [MacBook skins](/apple-macbook-skins). More in the [laptop and MacBook skin guide](/guides/laptop-and-macbook-skin-guide).",
        ],
      },
      {
        id: "windows-laptop",
        h2: "Windows laptops (HP, Dell, Lenovo, Asus, Acer, MSI)",
        blocks: [
          { ul: ["Turn the laptop over: the label underneath carries the exact model (e.g. “HP Pavilion 15-eg…” or “Lenovo IdeaPad Slim 3 15IAU7”).", "Or open **Settings → System → About** and read the device name and model.", "Measure the screen diagonal if a series comes in 14 and 15.6-inch versions."] },
          "Then pick it from [laptop skins](/laptop-skins).",
        ],
      },
      {
        id: "ipad-tablet",
        h2: "iPad and Android tablets",
        blocks: [
          "On iPad open **Settings → General → About → Model Name** (for example “iPad Air 11-inch (M2)”); the A-number is on the back in small print. On Android tablets use **Settings → About tablet**. Then go to [iPad and tablet skins](/ipad-tablet-skins), or read the [iPad and tablet skin guide](/guides/ipad-and-tablet-skin-guide).",
        ],
      },
      {
        id: "not-listed",
        h2: "Your model isn't listed?",
        blocks: [
          "Request it from the site. We add the template for your model and tell you on WhatsApp when it's ready to order. New phones are usually added soon after they launch in India.",
        ],
      },
    ],
    faqs: [
      { q: "Will a skin for the standard model fit the Pro or Ultra?", a: "No. Different sizes and camera layouts mean a different cut. Always choose the exact model." },
      { q: "Is the 4G version the same as the 5G version?", a: "Not always — some brands change the back or camera between them. Check the exact name in Settings → About phone." },
      { q: "Where is the model number on a MacBook?", a: "Apple menu → About This Mac shows the size, chip and year. The A-number (like A2681) is printed on the bottom case." },
      { q: "What if I choose the wrong model?", a: "Message us on WhatsApp before the order is dispatched and we'll correct it; skins are cut to order, so once it's cut the model can't be changed." },
    ],
    related: ["full-body-wrap-vs-only-back", "laptop-and-macbook-skin-guide", "ipad-and-tablet-skin-guide"],
    shop: [
      { label: "All supported devices", href: "/devices" },
      { label: "Phone skins", href: "/phone-skins" },
      { label: "Laptop skins", href: "/laptop-skins" },
    ],
  },

  /* ────────────────────────────────────────────────────────────── gadgets */
  {
    slug: "laptop-and-macbook-skin-guide",
    cluster: "gadgets",
    title: "Laptop & MacBook Skins: Only Top vs Top + Keyboard Area, Fit and Finish",
    metaTitle: "Laptop & MacBook Skin Guide — Only Top vs Top + Keyboard Area | GoSkinly",
    description: "How laptop and MacBook skins work: lid only or lid plus keyboard area, matte vs 3D vs Tranzy, finding your exact model and installing on a big flat panel.",
    updated: UPDATED,
    answer: "A laptop skin is a printed vinyl sheet cut for your exact model. **Only Top** covers the lid; **Top + Keyboard Area** also covers the palm rest around the keyboard and trackpad, so the laptop looks finished when it's open too. Choose matte for a clean work look, 3D textured for grip and feel, or Tranzy on a silver MacBook to let the aluminium show through the artwork. Match the model by its full name and year — on a MacBook, also by its A-number.",
    cover: "cover",
    images: {
      cover: {
        alt: "An open laptop with a skin on the lid and palm rest, on a work desk",
        prompt: "Photorealistic product photo, 16:9. A modern thin laptop half-open on a clean wooden work desk, shot from the front-left so both the outside of the lid and the palm rest are visible. Both the lid and the palm rest around the keyboard and trackpad are covered in a matching printed vinyl skin with a minimal dark green and beige geometric design; keys and trackpad left bare with clean cut edges. Soft window light, a plant and a mug blurred behind. No text, no brand logos.",
      },
      palm: {
        alt: "Close-up of a skin cut around a laptop's keyboard and trackpad",
        caption: "Top + Keyboard Area: the palm rest is skinned, the keys and trackpad stay bare.",
        prompt: "Photorealistic close-up, 4:3. The palm rest area of an open silver laptop covered by a printed matte vinyl skin with a navy marble design, cut precisely around the keyboard deck and the trackpad, which stay bare silver. Soft top light, sharp detail on the cut edge. No text, no logos.",
      },
    },
    sections: [
      {
        id: "coverage-options",
        h2: "Only Top or Top + Keyboard Area?",
        blocks: [
          {
            table: {
              head: ["", "Only Top", "Top + Keyboard Area"],
              rows: [
                ["Covers", "The outside of the lid", "The lid + the palm rest around the keyboard and trackpad"],
                ["Looks finished when", "The laptop is closed", "Closed and open"],
                ["Protects", "Lid from bag scratches", "Lid + palm rest from wrist wear and shine"],
                ["Install", "One big panel", "Lid + one shaped piece for the deck"],
                ["Uses", "One sheet of the design", "Two sheets of the design"],
              ],
            },
          },
          "The palm rest is where laptops age first — wrists polish it shiny and watch straps scratch it — so if you keep a laptop for years, Top + Keyboard Area is the one that keeps it looking newer. Only Top is the right call if you mostly want the lid to look great in a café or a meeting.",
          { img: "palm" },
        ],
      },
      {
        id: "which-finish",
        h2: "Which finish suits a laptop",
        blocks: [
          {
            ul: [
              "**Matte** — the professional choice. No glare under office lights, hides fingerprints on a big surface. [Matte laptop skins](/matte-laptop-skin).",
              "**3D textured** — adds grip and a material feel; the lid stops being slippery in your hands. [3D embossed laptop skins](/3d-embossed-phone-laptop-skins).",
              "**Tranzy** — printed on clear film, so a silver MacBook's aluminium becomes the background of the design. Lid only. Read [what is a Tranzy skin](/guides/what-is-a-tranzy-skin) first if your laptop is dark — dark ink disappears on dark lids.",
            ],
          },
          "Looking for a theme? [Gaming](/gaming-laptop-skin), [anime](/anime-laptop-skin), [minimal](/minimal-laptop-skins) and [nature](/nature-laptop-skins) are the most-browsed laptop styles.",
        ],
      },
      {
        id: "macbook",
        h2: "MacBook: getting the model right",
        blocks: [
          "MacBooks change shape more often than their names suggest. A 13-inch MacBook Air from 2020 (M1) and one from 2022 (M2) have different bodies, and the 14-inch and 16-inch Pros differ by year and chip. Before ordering:",
          {
            ol: [
              "Apple menu → **About This Mac** → note size, chip and year (e.g. “MacBook Air 15-inch, M4, 2025”).",
              "Turn it over and read the **A-number** printed on the bottom case (A followed by four digits).",
              "Match either on [MacBook skins](/apple-macbook-skins) — our model pages list both.",
            ],
          },
          "We also cut skins for the [Mac mini](/apple-mac-mini-skins) and for Apple's power adapters, if you want the desk to match.",
        ],
      },
      {
        id: "windows-laptops",
        h2: "Windows laptops",
        blocks: [
          "The exact model is on the label underneath (e.g. Lenovo LOQ 15IRX9, HP Spectre x360, Asus TUF Gaming A15). The full code matters: gaming laptops in particular change vents and lid shapes between versions. Browse [HP](/hp-laptop-skins), [Dell](/dell-laptop-skins), [Lenovo](/lenovo-laptop-skins), [Asus](/asus-laptop-skins), [Acer](/acer-laptop-skins) or [MSI](/msi-laptop-skins), or see the [model-finding guide](/guides/find-your-exact-device-model).",
        ],
      },
      {
        id: "installing",
        h2: "Installing a laptop skin on a big flat panel",
        blocks: [
          "A lid is the largest piece you'll ever apply, which makes alignment more important than speed.",
          {
            ol: [
              "Close the laptop and clean the lid with the wet then dry wipe. Dust-absorb the whole surface.",
              "Peel back only the top third of the backing. Line up the skin against the hinge edge and its corners first.",
              "Squeegee from the centre of that edge outwards, then peel the backing down a little at a time and keep squeegeeing towards the front edge.",
              "For the keyboard area: line up the trackpad opening first, then work outwards to the edges of the deck.",
              "Press every edge firmly and leave the laptop closed for a few hours so the bond builds.",
            ],
          },
          { tip: "Apply on a big clean table with the laptop flat and the light behind you — you'll see any trapped speck before it's sealed in. The full method is in [how to apply your skin](/how-to-apply)." },
        ],
      },
    ],
    faqs: [
      { q: "Does a laptop skin cover the Apple logo?", a: "It covers the lid as cut for your model. If you want the glowing or shiny logo to show, check the product photos for that design before ordering." },
      { q: "Will a laptop skin affect heat or the fans?", a: "No. Vents, hinges and ports are left uncovered by the cut, and the lid isn't where a laptop sheds heat." },
      { q: "Can I put a laptop skin under a hard shell case?", a: "Usually yes; a skin is thin. A shell hides the design, though, so most people use one or the other." },
      { q: "Does the keyboard area skin cover the keys?", a: "No. It covers the palm rest around the keyboard and trackpad; keys and trackpad stay bare." },
    ],
    related: ["find-your-exact-device-model", "what-is-a-tranzy-skin", "skin-finishes-compared"],
    shop: [
      { label: "Laptop skins", href: "/laptop-skins" },
      { label: "MacBook skins", href: "/apple-macbook-skins" },
      { label: "Matte laptop skins", href: "/matte-laptop-skin" },
    ],
  },

  {
    slug: "ipad-and-tablet-skin-guide",
    cluster: "gadgets",
    title: "iPad & Tablet Skins: What's Covered, Which Model, and Using a Cover",
    metaTitle: "iPad & Tablet Skin Guide — Fit, Coverage and Covers | GoSkinly",
    description: "How iPad and Android tablet skins work: back-only coverage, the matching 20W charger skin, finding your exact iPad, and using a skin with a folio cover.",
    updated: UPDATED,
    answer: "A tablet skin covers the **back** of your iPad or Android tablet, cut for its exact model with openings for the cameras, speakers and connectors. You can add a **matching skin for the 20W charger**. It keeps the aluminium back free of scratches, adds grip, and fits under most folio covers. Get the model from Settings → General → About → Model Name on iPad — iPad, iPad Air, iPad mini and iPad Pro generations all differ.",
    cover: "cover",
    images: {
      cover: {
        alt: "An iPad-style tablet with a printed skin on its back, with a matching skinned charger",
        prompt: "Photorealistic product photo, 16:9. A modern tablet lying face-down on a pale wooden desk, its back covered by a printed matte vinyl skin with a soft watercolour floral design, camera cut-out crisp at the top corner. Beside it a small white 20W USB-C wall charger wrapped in the same floral skin. Soft daylight, minimal styling, a stylus resting nearby. No text, no brand logos.",
      },
    },
    sections: [
      {
        id: "whats-covered",
        h2: "What a tablet skin covers",
        blocks: [
          "A tablet's back is a large flat panel, and it's the part that slides across desks and gets scratched in bags. Our tablet skins cover that back, cut from your model's template so the camera bump, microphones, speaker grilles, Smart Connector or keyboard pins, and the side buttons stay clear.",
          {
            table: {
              head: ["Option", "What arrives"],
              rows: [
                ["Only Back", "The back skin for your tablet"],
                ["Back + 20W Charger", "The back skin, plus a matching skin for a 20W charger"],
              ],
            },
          },
          { note: "We don't make a front (bezel) skin for tablets — the screen and its border stay as they are, so screen protectors and folio covers work normally." },
        ],
      },
      {
        id: "find-your-ipad",
        h2: "Finding your exact iPad",
        blocks: [
          "iPads are the trickiest devices to identify by eye: the 10th-generation iPad, the iPad Air (4th, 5th, M2/M3) and the 11-inch iPad Pro look similar but have different sizes, camera bumps and connectors.",
          {
            ol: [
              "Open **Settings → General → About** and read **Model Name** — e.g. “iPad Air 11-inch (M2)” or “iPad Pro 13-inch (M4)”.",
              "If it shows a model number instead, the A-number is also printed in small text on the back.",
              "Find it on [iPad skins](/apple-ipad-skins) — or go straight to [iPad Air](/apple-ipad-air-skins), [iPad mini](/apple-ipad-mini-skins), [iPad Pro 11 M4](/apple-ipad-pro-11-m4-skins) or [iPad Pro 13 M4](/apple-ipad-pro-13-m4-skins).",
            ],
          },
          "Android tablets: **Settings → About tablet**. We cut for [Samsung Galaxy Tab](/samsung-galaxy-tab-skins), [OnePlus Pad](/oneplus-pad-skins), [Lenovo](/lenovo-tablet-skins) and more — all in [iPad and tablet skins](/ipad-tablet-skins).",
        ],
      },
      {
        id: "with-a-cover",
        h2: "Using a skin with a folio cover or keyboard case",
        blocks: [
          "Most people use a tablet in a cover at least some of the time. A skin and a cover work together:",
          {
            ul: [
              "**Magnetic folio covers** (the kind that snap on the back) attach normally over a thin skin.",
              "**Keyboard cases** connect through the pins or Smart Connector, which the skin leaves uncovered.",
              "**Hard shell cases** fit over a skin like over a bare tablet; a clear shell shows the design.",
              "**Pencil charging** on the side of an iPad works as usual — the side magnet strip isn't covered by a back skin.",
            ],
          },
        ],
      },
      {
        id: "finish",
        h2: "Which finish for a tablet",
        blocks: [
          "Matte is the most popular for tablets: a big back panel in a glossy finish would show every fingerprint. If you hold the tablet one-handed a lot (reading, drawing), 3D textured adds noticeable grip. Compare them in [matte vs 3D vs Tranzy vs leather](/guides/skin-finishes-compared).",
        ],
      },
      {
        id: "install",
        h2: "Installing on a tablet",
        blocks: [
          "Same method as a phone, with more surface to keep clean: wipe, dust-absorb twice, then line up the **camera cut-out first** on a tablet (it's the feature you can't get wrong), and squeegee from there towards the far edges. Keep the backing on the part you haven't laid down yet. Full steps: [how to apply your skin](/how-to-apply).",
        ],
      },
    ],
    faqs: [
      { q: "Does an iPad skin cover the screen?", a: "No. It covers the back. The screen and bezel stay uncovered, so screen protectors and covers work normally." },
      { q: "Will Apple Pencil still charge with a skin on?", a: "Yes. A back skin doesn't cover the magnetic strip on the side where the Pencil attaches." },
      { q: "Can I use a Magic Keyboard or folio cover with a skin?", a: "Yes — the connector is left uncovered and a thin skin doesn't stop magnetic covers attaching." },
      { q: "Is the 20W charger skin for any charger?", a: "It's cut for a 20W charger of the shape shown on the listing; check the photos to match yours." },
    ],
    related: ["find-your-exact-device-model", "laptop-and-macbook-skin-guide", "skin-finishes-compared"],
    shop: [
      { label: "iPad & tablet skins", href: "/ipad-tablet-skins" },
      { label: "iPad skins", href: "/apple-ipad-skins" },
      { label: "Charger skins", href: "/chargers-skins" },
    ],
  },

  {
    slug: "camera-and-lens-skin-guide",
    cluster: "gadgets",
    title: "Camera & Lens Skins: What They Cover and How to Choose",
    metaTitle: "Camera & Lens Skin Guide — Canon, Nikon, Sony, Fujifilm | GoSkinly",
    description: "How camera and lens skins work: body with or without the kit lens, what stays uncovered, protecting resale value, and choosing for Canon, Nikon, Sony and Fujifilm.",
    updated: UPDATED,
    answer: "A camera skin is printed vinyl cut for your exact camera body. It covers the flat front plate and top plate — the rubber grip, dials, buttons and rear screen stay uncovered — and you can order it **with the kit lens** wrapped to match, or **without**. Lens skins wrap the lens barrel while the front glass, focus and zoom markings and the mount stay bare. A skin hides your kit, protects the body from scuffs and helps resale value.",
    cover: "cover",
    images: {
      cover: {
        alt: "A mirrorless camera and lens wrapped in a matching printed skin",
        prompt: "Photorealistic product photo, 16:9. A modern mirrorless camera with a zoom lens attached, standing on a dark wooden table, three-quarter front view. The camera's flat front plate and top plate and the lens barrel are wrapped in a matching matte printed vinyl skin with a desert camouflage pattern; the black rubber grip, dials, buttons, front glass and the lens focus/zoom ring markings are left bare with clean cut edges. Moody side light. No text, no brand logos or wordmarks.",
      },
      lens: {
        alt: "A camera lens with a printed skin on its barrel and bare markings",
        caption: "A lens skin wraps the barrel; the glass, ring markings and mount stay clear.",
        prompt: "Photorealistic close-up product photo, 4:3. A prime camera lens standing upright on a light grey surface, its barrel wrapped in a printed vinyl skin with a navy and white geometric pattern. The front glass, the focus ring markings and the metal mount at the bottom are uncovered with crisp cut edges. Soft studio light. No text, no logos.",
      },
    },
    sections: [
      {
        id: "why-skin-a-camera",
        h2: "Why people skin their cameras",
        blocks: [
          {
            ul: [
              "**Resale value.** Cameras and lenses are resold far more than phones, and buyers judge by cosmetic condition. A skin takes the strap rub and bag scuffs; peel it off before you sell.",
              "**Low profile.** A camouflaged or plain-patterned body draws less attention than a recognisable black camera on a street or in a crowd.",
              "**Your gear, at a glance.** At a shoot with five identical bodies, yours is the one in your design.",
              "**Grip on the plates.** A matte or 3D textured surface is less slippery than painted metal or plastic.",
            ],
          },
        ],
      },
      {
        id: "what-is-covered",
        h2: "What's covered — and what isn't",
        blocks: [
          {
            table: {
              head: ["Covered", "Left uncovered"],
              rows: [
                ["Front plate around the lens mount", "Rubber grip (it has its own texture)"],
                ["Top plate", "Mode dial, control dials and buttons"],
                ["Lens barrel (on With Lens, or a lens skin)", "Rear screen and viewfinder eyecup"],
                ["", "Lens front glass, focus and zoom ring markings, the mount"],
              ],
            },
          },
          "Everything you touch to operate the camera stays exactly as it was. That's deliberate: a skin over a dial or ring marking would make the camera harder to use.",
          { img: "lens" },
        ],
      },
      {
        id: "with-or-without-lens",
        h2: "With lens or without lens?",
        blocks: [
          "**Without Lens** is the body only — the right choice if you shoot with different lenses or use primes. **With Lens** adds a matching wrap for the camera's kit lens, so the whole setup is one design. For other lenses, there are separate lens skins cut for each lens: [Canon](/canon-lens-skins), [Nikon](/nikon-lens-skins), [Fujifilm](/fujifilm-lens-skins), plus Sigma and Tamron models.",
        ],
      },
      {
        id: "find-your-camera",
        h2: "Finding your exact camera",
        blocks: [
          "The model name is printed on the body — usually on the front plate or top plate (EOS R50, Z50 II, α6400, X-T30). Mark II and Mark III versions are different bodies, as are the R6 and R6 Mark II. Pick yours from [Canon](/canon-camera-skins), [Nikon](/nikon-camera-skins), [Sony](/sony-camera-skins) or [Fujifilm](/fujifilm-camera-skins), or browse all [camera skins](/camera-skins) and [lens skins](/lenses-skins).",
        ],
      },
      {
        id: "install",
        h2: "Installing a camera skin",
        blocks: [
          {
            ol: [
              "Remove the lens, strap and any L-bracket. Cap the sensor opening.",
              "Clean the plates with the wet then dry wipe and dust-absorb them.",
              "Apply the front plate piece first, lining it up around the mount, then the top plate around the dials.",
              "Press every edge firmly; on curved edges a couple of seconds of gentle warmth helps the vinyl follow the shape.",
              "For a lens: start at the seam line shown on the piece, wrap around the barrel, and press the seam down last.",
            ],
          },
          "General technique, with video: [how to apply your skin](/how-to-apply).",
        ],
      },
    ],
    faqs: [
      { q: "Does a camera skin cover the grip?", a: "No. The rubber grip has its own texture and stays uncovered, as do the dials, buttons and screen." },
      { q: "Will a lens skin affect focusing or zoom?", a: "No. It wraps the barrel only; the rings, their markings, the glass and the mount stay bare." },
      { q: "Can I remove a camera skin before selling?", a: "Yes — it peels off without residue, which is exactly why it helps resale value." },
      { q: "Do you make skins for action cameras and gimbals?", a: "Yes, for GoPro, DJI Osmo, Insta360 and DJI and Zhiyun gimbals — see [DJI skins](/dji-skins)." },
    ],
    related: ["find-your-exact-device-model", "skin-finishes-compared", "skin-care-cleaning-and-removal"],
    shop: [
      { label: "Camera skins", href: "/camera-skins" },
      { label: "Lens skins", href: "/lenses-skins" },
      { label: "Gimbal & drone skins", href: "/dji-skins" },
    ],
  },

  {
    slug: "ps5-console-and-controller-skin-guide",
    cluster: "gadgets",
    title: "PS5, Xbox & Controller Skins: Which Version, What's Covered, How to Apply",
    metaTitle: "PS5, Xbox & Controller Skin Guide — Fit and Bundles | GoSkinly",
    description: "Console and controller skins explained: PS5 Disc vs Digital vs Slim vs Pro, Xbox Series X and S, console + controller bundles, and what stays uncovered.",
    updated: UPDATED,
    answer: "A console skin is printed vinyl cut for one exact console version — PS5 Disc, PS5 Digital, PS5 Slim (Disc or Digital), PS5 Pro, Xbox Series X or Series S — because their panels differ in shape. It covers the outer panels and leaves vents, ports, buttons and the disc slot clear. You can order the console alone or with skins for **one or two controllers**; controller skins wrap the shell while sticks, buttons, triggers and the light bar stay bare.",
    cover: "cover",
    images: {
      cover: {
        alt: "A skinned games console with two matching skinned controllers in a living room",
        prompt: "Photorealistic product photo, 16:9. A tall white games console standing upright on a light wooden media unit in a cosy living room, its two curved outer side panels wrapped in a printed matte vinyl skin with a neon purple and blue cyberpunk city design; the black centre section left bare. Two matching wireless controllers lie in front, their shells wrapped in the same design with sticks, buttons and triggers bare. Warm evening light, TV glow in the background. No brand logos, no text.",
      },
      controller: {
        alt: "A game controller with a printed skin on its shell and bare buttons",
        caption: "Controller skins wrap the shell; everything you press stays bare.",
        prompt: "Photorealistic close-up product photo, 4:3. A modern wireless game controller held in two hands, its outer shell wrapped in a printed vinyl skin with a red and black graffiti design. Thumbsticks, face buttons, D-pad, triggers and the light strip are uncovered with clean cut edges. Soft light, shallow depth of field. No brand logos, no text.",
      },
    },
    sections: [
      {
        id: "which-version",
        h2: "Which console do you have?",
        blocks: [
          "Console skins are not interchangeable between versions. The original PS5, the Slim and the Pro have different panel shapes, and the Disc and Digital editions differ where the drive sits.",
          {
            table: {
              head: ["Console", "How to tell"],
              rows: [
                ["PS5 Disc (original)", "Tall, with a disc slot; one-piece curved side panels"],
                ["PS5 Digital (original)", "Same shape, no disc slot — slimmer on that side"],
                ["PS5 Slim Disc / Slim Digital", "Smaller; the panels are split into a glossy top section and a matte lower section"],
                ["PS5 Pro", "Black band through the middle with vents; no built-in drive"],
                ["Xbox Series X", "Tall black tower"],
                ["Xbox Series S", "Small white box with a round black vent"],
              ],
            },
          },
          "The model is also printed on the label at the back or underneath. Pick yours from [PlayStation](/playstation-console-skins), [Xbox](/xbox-console-skins) or [Nintendo Switch](/nintendo-switch-skins) — all in [gaming console skins](/gaming-console-skins).",
        ],
      },
      {
        id: "bundles",
        h2: "Console, + 1 controller, or + 2 controllers",
        blocks: [
          "Every console design comes three ways: the **console** alone, the console **+ 1 controller**, or the console **+ 2 controllers** — so the setup matches when a friend picks up the second pad. Controller skins are also sold on their own, cut for the DualSense, DualSense Edge, DualShock 4, PS3 controller, and Xbox One and Series controllers: see [controller skins](/gaming-controller-skins).",
        ],
      },
      {
        id: "whats-covered",
        h2: "What's covered and what stays clear",
        blocks: [
          {
            ul: [
              "**PS5:** the outer side panels. The black centre section, vents, ports, power and eject buttons and disc slot stay uncovered.",
              "**Xbox Series X:** the outer faces of the tower; the top vent and ports stay clear.",
              "**Controllers:** the outer shell, in one continuous wrap. Thumbsticks, face buttons, D-pad, triggers, touchpad edges, the light bar and charging port stay bare.",
            ],
          },
          { img: "controller" },
          "Nothing that moves air or that you press is covered, so a skin doesn't change how the console cools or how the controller plays.",
        ],
      },
      {
        id: "why",
        h2: "Why skin a console",
        blocks: [
          "Consoles live in a setup you look at every day, and a white PS5 shows scuffs and yellowing on its panels over the years. A skin changes the look of the whole setup for far less than a replacement cover plate, protects the panels from scratches, and peels off clean if you sell. Controller skins add grip that matters in long sessions, especially with a [3D textured](/guides/what-is-a-3d-textured-skin) finish. For themes, see [gaming skins](/gaming-skins) and [abstract console skins](/abstract-console-skins).",
        ],
      },
      {
        id: "install",
        h2: "Installing console and controller skins",
        blocks: [
          {
            ol: [
              "Switch off and unplug the console. For a PS5, the side panels can be removed — it's easier to skin them lying flat.",
              "Clean each panel with the wet then dry wipe and dust-absorb it.",
              "Line each piece up against one straight edge first, then squeegee across the panel.",
              "On controllers, start with the flat back of the grips, then work round each grip; a couple of seconds of gentle warmth helps the vinyl follow the curves.",
              "Press every edge firmly and leave the controllers for a few hours before a long session.",
            ],
          },
          "More on technique: [how to apply your skin](/how-to-apply).",
        ],
      },
    ],
    faqs: [
      { q: "Will a PS5 skin fit the PS5 Slim?", a: "No. The Slim's panels are a different size and split into two parts. Choose the exact version." },
      { q: "Does a console skin cause overheating?", a: "No. Vents are left uncovered, and the skin sits on outer panels that aren't where the console moves its air." },
      { q: "Can I buy controller skins separately?", a: "Yes — for DualSense, DualSense Edge, DualShock 4, PS3 and Xbox controllers." },
      { q: "Do controller skins affect the buttons?", a: "No. Sticks, buttons, triggers and the light bar stay uncovered." },
    ],
    related: ["what-is-a-3d-textured-skin", "skin-care-cleaning-and-removal", "find-your-exact-device-model"],
    shop: [
      { label: "Gaming console skins", href: "/gaming-console-skins" },
      { label: "Controller skins", href: "/gaming-controller-skins" },
      { label: "PlayStation skins", href: "/playstation-skins" },
    ],
  },

  /* ─────────────────────────────────────────────────────────────── living */
  {
    slug: "do-phone-skins-cause-heating-or-block-charging",
    cluster: "living",
    title: "Do Phone Skins Cause Heating, Block Wireless Charging or Void Warranty?",
    metaTitle: "Do Phone Skins Cause Heating or Block Wireless Charging? | GoSkinly",
    description: "Straight answers on phone skins and heat, wireless and MagSafe charging, warranty, residue and resale — what a thin vinyl skin does and doesn't do.",
    updated: UPDATED,
    answer: "A thin vinyl skin doesn't make a phone noticeably hotter — it holds in far less heat than a thick case. Wireless charging works through it, and MagSafe accessories still attach (a 3D textured skin adds a touch more distance than a flat one). A skin is removable and peels off without residue; take it off before a service-centre visit so there's nothing on the phone to question.",
    cover: "cover",
    images: {
      cover: {
        alt: "A skinned phone charging on a wireless charging pad",
        prompt: "Photorealistic product photo, 16:9. A smartphone with a minimal beige-and-black printed matte vinyl skin lying face-down on a round white wireless charging pad on a bedside table; a soft glowing status light on the pad. Warm evening lamp light, cosy bedroom background blurred. No text, no logos.",
      },
    },
    sections: [
      {
        id: "heating",
        h2: "Does a skin make my phone heat up?",
        blocks: [
          "No, not in any way you'd notice. Phones get rid of heat through their whole body — the frame, the back and the screen. A skin is a thin layer of vinyl on the back; a typical back cover is several times thicker and made of rubber or plastic that insulates much more. If a phone with a skin runs hot, the skin is not the cause: gaming, video calls, fast charging, weak signal or a hot room are.",
          { tip: "If your phone runs hot while charging, take off any **case** before you take off the skin — the case is the much bigger insulator." },
        ],
      },
      {
        id: "wireless-charging",
        h2: "Does wireless charging work through a skin?",
        blocks: [
          "Yes. Wireless (Qi) charging works through thin non-metallic layers, and printed vinyl is thin and contains no metal. A skin adds far less distance between the coils than an ordinary case does, and most phones charge wirelessly through cases.",
          { h3: "And MagSafe?" },
          "MagSafe chargers, wallets and stands still snap on over a skin, because a thin vinyl layer barely changes the gap to the magnets. A 3D textured skin's relief adds a little more distance than a flat matte one, so a heavy MagSafe accessory may hold slightly less firmly on 3D. If MagSafe accessories are central to how you use your phone, choose matte. We also stock [MagSafe-ready clear cases](/cases-covers).",
        ],
      },
      {
        id: "warranty",
        h2: "Will a skin void my warranty?",
        blocks: [
          "A skin doesn't modify, open or damage the phone, and it comes off cleanly. In practice, what matters is the visit to the service centre: technicians want to inspect the bare device. So peel the skin off before you go — it takes a minute, leaves no residue, and means there's nothing on the phone to question. You can apply a fresh one afterwards.",
        ],
      },
      {
        id: "residue-and-damage",
        h2: "Will it leave residue or damage the back?",
        blocks: [
          "Our skins peel off without leaving sticky residue, on glass, metal or plastic backs. Peel slowly from a corner at a low angle; a few seconds of warmth from a hair dryer softens the adhesive if it has been on for a long time. Step-by-step removal is in [care, cleaning and removal](/guides/skin-care-cleaning-and-removal).",
          "The opposite is the real benefit: while the skin is on, it takes the scratches. A two-year-old phone that wore a skin usually looks far newer underneath than one that didn't — which shows up in resale and exchange offers.",
        ],
      },
      {
        id: "cameras-sensors",
        h2: "Does it affect the camera, flash, NFC or fingerprint sensor?",
        blocks: [
          {
            ul: [
              "**Cameras and flash:** every lens, flash and sensor has its own opening in the cut — nothing covers them.",
              "**NFC and contactless payments:** work through a thin vinyl skin, the same way they work through a case.",
              "**Rear fingerprint sensors** (on phones that have one): cut out, so you touch the sensor directly.",
              "**Buttons and ports:** left uncovered or cut around, so they press and plug in as before.",
            ],
          },
          "That precision is why the model must be exact — see [how to find your exact model](/guides/find-your-exact-device-model).",
        ],
      },
      {
        id: "protection",
        h2: "What a skin does protect against",
        blocks: [
          {
            ul: [
              "Scratches from keys, coins and desks.",
              "Scuffs and the dull haze glass backs pick up.",
              "Frame scuffs, with [full body wrap](/guides/full-body-wrap-vs-only-back).",
              "Slipping out of your hand — matte and 3D are grippier than glass.",
            ],
          },
          "What it doesn't do is cushion drops; pair it with a case for that ([skin vs back cover](/guides/phone-skin-vs-back-cover)).",
        ],
      },
    ],
    faqs: [
      { q: "Does a phone skin cause overheating?", a: "No. A thin vinyl skin holds in far less heat than a thick case. Heat comes from gaming, fast charging, weak signal or a hot room." },
      { q: "Does wireless charging work with a skin?", a: "Yes. Qi wireless charging works through a thin vinyl skin, and MagSafe accessories still attach." },
      { q: "Will a skin void my phone's warranty?", a: "A skin doesn't modify the phone and peels off clean. Remove it before a service-centre visit so the technician sees the bare device." },
      { q: "Does a skin affect the camera?", a: "No. Every camera, flash and sensor has its own opening in the cut." },
      { q: "Does NFC or tap-to-pay work through a skin?", a: "Yes — a thin vinyl skin doesn't block NFC." },
    ],
    related: ["skin-care-cleaning-and-removal", "phone-skin-vs-back-cover", "what-is-a-3d-textured-skin"],
    shop: [
      { label: "Phone skins", href: "/phone-skins" },
      { label: "Matte phone skins", href: "/matte-phone-skins" },
      { label: "Clear & MagSafe cases", href: "/cases-covers" },
    ],
  },

  {
    slug: "skin-care-cleaning-and-removal",
    cluster: "living",
    title: "How to Clean, Care For and Remove a Device Skin",
    metaTitle: "How to Clean and Remove a Phone or Laptop Skin (No Residue) | GoSkinly",
    description: "Keep a skin looking new for longer: how to clean it, fix lifting edges and bubbles, what to avoid, when to replace it, and how to remove it without residue.",
    updated: UPDATED,
    answer: "Clean a skin with a dry or slightly damp microfiber cloth — no harsh solvents. Fix a lifting edge with a few seconds of gentle warmth and a firm press. Keep it out of long, direct, strong sun. To remove it, warm it briefly, then peel slowly from a corner at a low angle; it comes off without residue, and any trace of adhesive wipes away.",
    cover: "cover",
    images: {
      cover: {
        alt: "Wiping a skinned phone with a microfiber cloth",
        prompt: "Photorealistic product photo, 16:9. Hands gently wiping the back of a smartphone with a light-grey microfiber cloth; the phone wears a printed matte vinyl skin with a pastel abstract design. Clean bright table, soft daylight, shallow depth of field. No text, no logos.",
      },
      peel: {
        alt: "Peeling a skin off a phone slowly from one corner at a low angle",
        caption: "Remove from a corner, slowly and low — not straight up.",
        prompt: "Photorealistic close-up, 4:3. Fingers peeling a printed vinyl skin off the back of a phone, starting from one corner, pulling slowly back on itself at a low angle; the clean, residue-free glass back is visible underneath. Soft side light, neutral background. No text, no logos.",
      },
    },
    sections: [
      {
        id: "first-day",
        h2: "The first 24 hours",
        blocks: [
          "The adhesive keeps bonding for several hours after you apply a skin. For the best hold, give it a firm press all over when you finish, avoid putting a tight case on for a few hours, and don't leave the device somewhere very hot or very cold that day. If you haven't applied it yet, start with the [install guide](/how-to-apply).",
        ],
      },
      {
        id: "cleaning",
        h2: "Cleaning a skin",
        blocks: [
          {
            ul: [
              "**Everyday:** a dry microfiber cloth (the one in your install kit is ideal).",
              "**Marks and grime:** a cloth slightly dampened with water, or water with a drop of mild soap; then dry it.",
              "**3D textured skins:** wipe along the texture, not hard across it, and use a soft brush for dirt in the relief.",
              "**Avoid:** acetone, nail polish remover, thinner, abrasive scrubbers and soaking the device. Strong solvents can dull the print and weaken the adhesive at the edges.",
            ],
          },
        ],
      },
      {
        id: "fixes",
        h2: "Fixing common problems",
        blocks: [
          { h3: "A lifting edge or corner" },
          "Warm the edge for two or three seconds with a hair dryer, then press it down firmly with your thumb and hold for a few seconds. Lifting usually happens on curved corners or where the edge was touched with oily fingers during install.",
          { h3: "A bubble" },
          "Air bubbles push out towards the nearest edge with the squeegee or a thumbnail through a cloth. A bubble with a dust speck in it needs that area lifted gently, dabbed with the dust absorber or tape, and pressed down again.",
          { h3: "Dirt along the edges" },
          "Pocket lint collects where the skin meets the frame. Run a dry cloth along the edge; don't pick at it with a fingernail, which lifts it.",
        ],
      },
      {
        id: "what-ages-a-skin",
        h2: "What ages a skin fastest",
        blocks: [
          {
            ul: [
              "**Strong direct sun for hours** — a phone on a car dashboard in summer is the classic. Heat and UV are what fade any printed vinyl.",
              "**Constant friction in one spot** — keys in the same pocket, a ring on the hand that holds the phone.",
              "**Solvents and sanitiser soaked into the edges.**",
              "**Repeatedly lifting it to re-align** — the adhesive weakens each time.",
            ],
          },
          "How long a skin lasts depends almost entirely on these. Many people replace theirs for a new design long before it wears out — the beauty of a skin is that changing your look costs a fraction of a new case or a new phone.",
        ],
      },
      {
        id: "removal",
        h2: "Removing a skin without residue",
        blocks: [
          {
            ol: [
              "Warm the skin for 10–20 seconds with a hair dryer on low, moving it around — just warm to the touch.",
              "Lift one corner with a fingernail.",
              "Peel slowly, pulling the skin back on itself at a **low angle**, close to the surface — not straight up.",
              "If it resists, warm the next section and continue.",
              "If any trace of adhesive remains, wipe it off with a microfiber cloth; a little rubbing with your thumb rolls it away.",
            ],
          },
          { img: "peel" },
          "Then clean the device and apply your next skin straight away, or keep it bare. Need a new look? Browse [phone skins](/phone-skins), [laptop skins](/laptop-skins) or every style in [all skins](/skins).",
        ],
      },
    ],
    faqs: [
      { q: "Can I reuse a skin after removing it?", a: "Not reliably. The vinyl stretches and the adhesive picks up dust when it comes off, so it won't sit as flat again. Skins are made to be replaced." },
      { q: "What should I clean a skin with?", a: "A dry or slightly damp microfiber cloth. Avoid acetone, thinner, abrasive pads and soaking." },
      { q: "How do I fix a corner that keeps lifting?", a: "Warm it for two or three seconds with a hair dryer and press it down firmly for a few seconds." },
      { q: "Will removing a skin damage my phone?", a: "No. Peeled slowly at a low angle, it comes off without residue and leaves the original finish as it was." },
    ],
    related: ["do-phone-skins-cause-heating-or-block-charging", "full-body-wrap-vs-only-back", "what-is-a-matte-skin"],
    shop: [
      { label: "How to apply a skin", href: "/how-to-apply" },
      { label: "Phone skins", href: "/phone-skins" },
      { label: "Real photos of our skins", href: "/real-photos" },
    ],
  },
];

export const GUIDE_SLUGS = new Set(GUIDES.map((g) => g.slug));
