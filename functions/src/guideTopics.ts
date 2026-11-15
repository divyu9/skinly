/**
 * What the guide writer (guidesAuto.ts) writes about, in order.
 *
 * The first thirteen guides were written by hand (src/content/guides.mjs) and
 * are listed in HAND_WRITTEN so nothing here repeats them. Each topic names
 * the question a shopper actually has, the angle that makes the answer worth
 * reading, and the words that pick which of our landing pages it links to.
 *
 * More topics can be queued without a deploy: a document in `guideTopics`
 * with { slug, cluster, title, angle, keywords, status: "queued" } is written
 * before anything here.
 */

export interface GuideTopic {
  slug: string;
  cluster: "finishes" | "choosing" | "gadgets" | "living";
  title: string;
  angle: string;
  /** Matched against landing-page slugs to choose what the article may link to. */
  keywords: string[];
}

export const HAND_WRITTEN: Array<{ slug: string; title: string }> = [
  { slug: "what-is-a-matte-skin", title: "What Is a Matte Skin? Matte vs Glossy, Explained" },
  { slug: "what-is-a-3d-textured-skin", title: "What Is a 3D Textured (Embossed) Skin?" },
  { slug: "what-is-a-tranzy-skin", title: "What Is a Tranzy Skin? Transparent Skins Explained" },
  { slug: "skin-finishes-compared", title: "Matte vs 3D Textured vs Tranzy vs Leather: Which Skin Finish to Pick" },
  { slug: "phone-skin-vs-back-cover", title: "Phone Skin vs Back Cover: Which Is Better?" },
  { slug: "full-body-wrap-vs-only-back", title: "Full Body Wrap vs Only Back: Which Phone Skin Coverage to Choose" },
  { slug: "find-your-exact-device-model", title: "How to Find Your Exact Phone, Laptop or Tablet Model" },
  { slug: "laptop-and-macbook-skin-guide", title: "Laptop & MacBook Skins: Only Top vs Top + Keyboard Area, Fit and Finish" },
  { slug: "ipad-and-tablet-skin-guide", title: "iPad & Tablet Skins: What's Covered, Which Model, and Using a Cover" },
  { slug: "camera-and-lens-skin-guide", title: "Camera & Lens Skins: What They Cover and How to Choose" },
  { slug: "ps5-console-and-controller-skin-guide", title: "PS5, Xbox & Controller Skins: Which Version, What's Covered, How to Apply" },
  { slug: "do-phone-skins-cause-heating-or-block-charging", title: "Do Phone Skins Cause Heating, Block Wireless Charging or Void Warranty?" },
  { slug: "skin-care-cleaning-and-removal", title: "How to Clean, Care For and Remove a Device Skin" },
];

export const GUIDE_TOPICS: GuideTopic[] = [
  // Gadgets — each has landing pages and few good answers online.
  { slug: "drone-and-remote-skin-guide", cluster: "gadgets", title: "DJI Drone & Remote Controller Skins: What's Covered and Why", angle: "Drone Only, Drone + RC, RC with or without display; what stays uncovered (sensors, props, gimbal, vents); protecting resale; spotting your own drone at a group shoot.", keywords: ["drone", "dji", "mavic", "controller"] },
  { slug: "gimbal-skin-guide", cluster: "gadgets", title: "Gimbal Skins for DJI & Zhiyun: Grip, Protection and Fit", angle: "Why handheld gimbals get scuffed, which parts a skin covers and which stay clear (motors, joints, buttons, joystick), identifying your exact gimbal model.", keywords: ["gimbal", "dji", "zhiyun", "rs4"] },
  { slug: "action-camera-skin-guide", cluster: "gadgets", title: "GoPro, DJI Osmo Action & Insta360 Skins: A Practical Guide", angle: "Full body skins on action cameras, what stays uncovered (lenses, screens, doors, mounts), using skins with mounts and housings, telling Hero generations apart.", keywords: ["gopro", "insta360", "osmo", "action", "dji"] },
  { slug: "dji-osmo-pocket-skin-guide", cluster: "gadgets", title: "DJI Osmo Pocket Skins: Is It Worth Skinning a Pocket Camera?", angle: "A pocket camera lives in pockets and bags; scuff protection, grip, what the cut leaves free (gimbal head, screen, buttons, port).", keywords: ["pocket", "osmo", "dji"] },
  { slug: "charger-skin-guide", cluster: "gadgets", title: "Charger Skins: Why People Skin Their Phone and Laptop Chargers", angle: "Telling identical white chargers apart at home, office and hostel; matching the phone; which chargers we cut for (Apple 20W, MacBook adapters, Samsung, OnePlus, Xiaomi); pins and ports stay bare.", keywords: ["charger", "adapter", "20w", "30w", "140w"] },
  { slug: "mac-mini-skin-guide", cluster: "gadgets", title: "Mac mini Skins: Making a Desk Setup Match", angle: "What a Mac mini skin covers (as the listing photos show), vents and ports left clear, matching it with a MacBook or charger, identifying Intel vs M-series minis.", keywords: ["mac-mini", "macbook", "apple"] },
  { slug: "nintendo-switch-skin-guide", cluster: "gadgets", title: "Nintendo Switch Skins: Console, Joy-Con and Dock", angle: "What a Switch skin covers (as the listing photos show — the console, Joy-Cons and the dock front), what stays clear (screen, rails, buttons, vents), why the Switch, OLED and Lite need different cuts.", keywords: ["nintendo", "switch"] },
  { slug: "xbox-series-x-and-s-skin-guide", cluster: "gadgets", title: "Xbox Series X & Series S Skins: Fit, Vents and Controllers", angle: "Series X tower faces vs Series S box, the top vent and ports left clear, matching controller skins, console + controller bundles.", keywords: ["xbox", "controller"] },
  { slug: "galaxy-tab-and-android-tablet-skin-guide", cluster: "gadgets", title: "Samsung Galaxy Tab & Android Tablet Skins: Choosing the Right Cut", angle: "Tab S, Tab A and FE lines look alike but differ; S Pen magnet areas; keyboard covers; finding the exact model in Settings.", keywords: ["galaxy-tab", "tablet", "oneplus-pad", "xiaomi-pad", "lenovo-tablet"] },
  { slug: "gaming-laptop-skin-guide", cluster: "gadgets", title: "Gaming Laptop Skins: Legion, TUF, ROG, LOQ and Omen", angle: "Big lids with RGB logos and vents; fingerprints on black plastic; exact model codes matter; heat myths; Top vs Top + Keyboard Area on gaming decks.", keywords: ["gaming", "legion", "tuf", "rog", "loq", "omen", "msi", "laptop"] },
  { slug: "macbook-air-vs-pro-skins", cluster: "gadgets", title: "MacBook Air vs MacBook Pro Skins: Why the Cut Differs by Year", angle: "How lids and palm rests changed across M1, M2, M3, M4, M5; notch-era vs older bodies; A-numbers; why a 2020 Air skin won't fit a 2022 Air.", keywords: ["macbook-air", "macbook-pro", "macbook"] },
  { slug: "iphone-17-skin-guide", cluster: "gadgets", title: "iPhone 17, 17 Pro & 17 Pro Max Skins: Fit, Camera and Finish", angle: "The camera plateau and cut-outs, MagSafe with a skin, full body on the frame, which finish suits each colour, Pro vs Pro Max sizes.", keywords: ["iphone-17", "iphone", "apple"] },
  { slug: "samsung-galaxy-s-series-skin-guide", cluster: "gadgets", title: "Samsung Galaxy S25 & S26 Skins: Ultra vs Plus vs Standard vs FE", angle: "Camera layouts across S-series sizes, the S Pen slot on Ultra, Edge models, flat vs curved frames for full body wrap.", keywords: ["samsung-galaxy-s2", "samsung", "galaxy"] },
  { slug: "nothing-phone-skin-guide", cluster: "gadgets", title: "Nothing Phone Skins: Keeping the Glyph Look (or Hiding It)", angle: "Transparent backs and Glyph lights; Tranzy vs opaque choices; what's cut out; which models we cut for.", keywords: ["nothing", "transparent"] },
  { slug: "oneplus-skin-guide", cluster: "gadgets", title: "OnePlus Skins: Number Series, R, Nord and CE Explained", angle: "Why Nord, Nord CE and R models need different cuts, camera island shapes, finding the model, alert slider/buttons left clear.", keywords: ["oneplus", "one-plus", "nord"] },
  { slug: "google-pixel-skin-guide", cluster: "gadgets", title: "Google Pixel Skins: Working Around the Camera Bar", angle: "The full-width camera bar and how a skin is cut around it, Pro vs standard vs a-series, full body vs only back.", keywords: ["google", "pixel"] },
  { slug: "sony-alpha-camera-skin-guide", cluster: "gadgets", title: "Sony Alpha Camera Skins: a6000 Series to A7 and A9", angle: "Rangefinder-style a6x00 bodies vs A7 bodies, what is covered, lens skins for Sony E-mount primes and zooms, resale on second-hand market.", keywords: ["sony-alpha", "sony", "sigma", "sony-e", "sony-fe"] },
  { slug: "lens-skins-for-primes-and-zooms", cluster: "gadgets", title: "Lens Skins for Primes and Zooms: Sigma, Tamron, Canon, Nikon", angle: "Why lens barrels get scuffed, what a lens skin leaves bare (glass, ring markings, mount, switches), primes vs zooms, identifying the exact lens version.", keywords: ["lens", "sigma", "tamron", "nikkor", "fujifilm-xf"] },

  // Choosing — designs, combinations, gifting.
  { slug: "anime-skins-guide", cluster: "choosing", title: "Anime Skins: Picking a Design You Won't Get Tired Of", angle: "Character vs scenery vs minimal anime art, matching finish to artwork, phone vs laptop placement of the art, changing designs every season.", keywords: ["anime"] },
  { slug: "god-and-spiritual-skins-guide", cluster: "choosing", title: "God & Spiritual Skins: Choosing Respectfully for Your Device", angle: "Popular devotional designs, choosing for a gift, handling the device respectfully, removing and replacing cleanly.", keywords: ["god", "religious"] },
  { slug: "minimal-skins-guide", cluster: "choosing", title: "Minimal Skins: Clean Designs for Work Phones and Laptops", angle: "Why minimal designs age best, professional settings, pairing with clear cases, matte vs 3D for minimal art.", keywords: ["minimal"] },
  { slug: "carbon-fibre-and-textured-skins", cluster: "choosing", title: "Carbon Fibre Skins: Why Texture Makes Them Look Real", angle: "Carbon weave as a design vs a 3D relief, grip, the sporty look on phones and laptops, matching chargers.", keywords: ["textured", "3d", "black-specials", "matte-black"] },
  { slug: "camouflage-and-marble-skins", cluster: "choosing", title: "Camouflage and Marble Skins: Patterns That Hide Wear", angle: "Busy patterns hide scuffs and dust, full body continuity, which colours suit which devices.", keywords: ["camouflage", "marble"] },
  { slug: "gaming-themed-skins-guide", cluster: "choosing", title: "Gaming Skins: Setups That Match from Phone to Console", angle: "Building a theme across phone, laptop, console and controllers; neon and cyberpunk; textured grips for long sessions.", keywords: ["gaming", "cyberpunk", "neon", "controller", "console"] },
  { slug: "matching-device-setup-guide", cluster: "choosing", title: "How to Build a Matching Setup: Phone, Laptop, Charger and More", angle: "Same design across devices, which design styles scale from a phone back to a laptop lid, ordering everything for one look.", keywords: ["charger", "laptop", "phone", "mac-mini"] },
  { slug: "skin-vs-sticker-vs-wrap", cluster: "choosing", title: "Skin vs Sticker vs Wrap: What's the Difference?", angle: "Die-cut device skin vs generic sticker vs car-style wrap: fit, adhesive, residue, cut-outs and finish.", keywords: ["custom", "phone-skins", "skins"] },
  { slug: "scratched-phone-back-skin-or-replace", cluster: "choosing", title: "Scratched Phone Back: Cover It With a Skin or Replace the Glass?", angle: "Hairline scratches vs cracks, what a skin hides and what it can't, when back-glass replacement is the right call, safety with cracked glass.", keywords: ["phone-skins", "matte"] },
  { slug: "new-phone-day-one-checklist", cluster: "choosing", title: "Got a New Phone? What to Put on It on Day One", angle: "Screen protector, camera ring, skin, case — what each does, in what order to fit them, what's optional.", keywords: ["screen-protectors", "camera-rings", "cases-covers", "phone-skins"] },
  { slug: "skins-as-gifts-guide", cluster: "choosing", title: "Device Skins as Gifts: Getting the Model Right Without Asking", angle: "How to find someone's exact model discreetly, choosing a design for their taste, gifting for gamers, students and professionals.", keywords: ["phone-skins", "laptop-skins", "anime", "minimal"] },
  { slug: "resale-value-and-skins", cluster: "choosing", title: "Selling or Exchanging Your Phone? How a Skin Protects Its Value", angle: "How buyers and exchange offers judge cosmetic condition, keeping the back and frame mint, removing the skin before the sale.", keywords: ["phone-skins", "full"] },
  { slug: "tranzy-vs-clear-case", cluster: "finishes", title: "Tranzy Skin vs Clear Case: Two Ways to Show Your Phone's Colour", angle: "Printed clear film vs a rigid clear shell, yellowing, drop protection, using both together, which phone colours suit each.", keywords: ["transparent", "cases-covers"] },
  { slug: "best-finish-for-black-phones", cluster: "finishes", title: "The Best Skin Finish for a Black or Dark Phone", angle: "Why dark devices change which finishes work, matte vs 3D on black, which designs pop, why Tranzy fades on black.", keywords: ["matte-black", "black-specials", "matte"] },

  // Living with it.
  { slug: "fix-bubbles-under-a-skin", cluster: "living", title: "Bubbles Under a Phone Skin: Why They Happen and How to Fix Them", angle: "Air vs dust bubbles, fixing during and after install, preventing them, when to start over.", keywords: ["phone-skins"] },
  { slug: "skins-in-indian-summer-and-monsoon", cluster: "living", title: "Skins in Indian Summers and Monsoons: Heat, Sun and Humidity", angle: "Dashboard heat, UV, sweaty hands, applying in humid weather, keeping edges down in the monsoon.", keywords: ["phone-skins", "matte"] },
  { slug: "applying-skins-on-curved-edges", cluster: "living", title: "Applying a Skin on Curved Edges and Corners", angle: "Why curves fight vinyl, warming corners safely, pressing technique, curved-edge phones vs flat frames.", keywords: ["phone-skins", "samsung"] },
  { slug: "skin-with-screen-protector-and-camera-ring", cluster: "living", title: "Using a Skin With a Screen Protector and Camera Ring", angle: "Order of installation, gaps around the camera, tempered glass vs film, camera rings over a skin's cut-out.", keywords: ["screen-protectors", "camera-rings", "phone-skins"] },
  { slug: "do-you-need-a-camera-lens-ring", cluster: "living", title: "Camera Lens Rings: Do You Need One?", angle: "What camera rings protect against, flare and photo quality worries, fit per model, using with a skin and case.", keywords: ["camera-rings", "iphone", "samsung"] },
  { slug: "how-often-to-change-a-skin", cluster: "living", title: "How Often Should You Change Your Skin?", angle: "Signs of wear, changing for a new look, seasonal/festival switches, what happens to the adhesive over time.", keywords: ["phone-skins", "skins"] },
];
