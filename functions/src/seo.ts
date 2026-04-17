import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v1/https";
import { requireAdmin } from "./auth";
import { enforceDailyRateLimit } from "./rate-limit";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PageType = "brand" | "device" | "product" | "skin-type" | "keyword";

interface GenerateArgs {
  pageType: PageType;
  keywords: string[];
  brandName?: string;
  deviceCategory?: string;
  productType?: string;
  designType?: string;
  modelNames?: string[];   // caller-supplied override; otherwise auto-fetched for brand pages
  notes?: string;
}

interface ParsedContent {
  contentHTML: string;
  faqs: Array<{ question: string; answer: string }>;
  imageAltTexts: string[];
}

// ---------------------------------------------------------------------------
// API key — Firestore only (doc id == key name, value field holds the secret)
// Frontend uses the same convention: settings.getSetting({ key: "openaiApiKey" })
// ---------------------------------------------------------------------------

const resolveOpenAIKey = async (): Promise<string> => {
  const snap = await admin.firestore().collection("settings").doc("openaiApiKey").get();
  const value = snap.exists ? (snap.data()?.value as string | undefined) : undefined;
  if (value) return value;
  throw new HttpsError(
    "failed-precondition",
    "OpenAI API key not configured. Go to Admin → Settings → AI Configuration to add it."
  );
};

// ---------------------------------------------------------------------------
// Auto-fetch top models from supportedModels collection (brand pages)
// ---------------------------------------------------------------------------

const fetchTopModelsForBrand = async (brandName: string, limit = 6): Promise<string[]> => {
  try {
    const snap = await admin
      .firestore()
      .collection("supportedModels")
      .where("brandName", "==", brandName)
      .where("isActive", "==", true)
      .limit(limit)
      .get();
    return snap.docs.map((d) => d.data().modelName as string).filter(Boolean);
  } catch {
    return [];
  }
};

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are an SEO content writer for GoSkinly, an Indian phone and gadget skin brand. Write in a friendly, conversational Indian English tone — like a knowledgeable friend, not a corporate brochure.

BRAND FACTS (always accurate):
- Brand name: GoSkinly
- Products: vinyl skins/wraps for phones, laptops, tablets, cameras, drones, chargers, gaming consoles, Mac Mini
- Price: starting from ₹149
- Shipping: free delivery across India, COD available
- Models supported: 1000+ device models
- Finish types: matte, 3D textured/embossed, transparent
- Popular design themes: anime, 3D textured, carbon fiber, marble, camouflage, god/religious, gaming, abstract

SKIN DEFINITION — CRITICAL:
A GoSkinly skin is ALWAYS a protective vinyl decal applied TO an electronic device. It features a themed design ON TOP.
- "Anime skin" = vinyl skin WITH anime artwork, applied TO a phone
- NEVER write as if skin is applied to a car, god, animal etc.

BANNED PHRASES — never use these:
"in conclusion", "it's worth noting", "certainly", "as an AI", "years of experience", "expert craftsmanship", "we are dedicated to", "top-notch", "look no further"

TONE: Direct, friendly, slightly casual. Like a consumer-smart YouTube creator — no corporate fluff.

OUTPUT FORMAT: Respond with valid JSON only. No markdown fences, no backticks, no explanation outside the JSON object.`;

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

const DESIGN_THEMES = "anime, 3D textured, carbon fiber, marble, camouflage, god/religious, gaming, abstract, matte black, transparent";

// Per-brand canonical model lists for the four biggest brands.
// For any other brand, models come from Firestore or the caller.
const KNOWN_BRAND_MODELS: Record<string, string> = {
  samsung:  "Galaxy S25 Ultra, S24, A55, A35, M34, F55",
  apple:    "iPhone 17, 16 Pro Max, 15, 14, SE",
  oneplus:  "OnePlus 13, 12, Nord 4, Nord CE 4",
  xiaomi:   "Redmi Note 13 Pro, Note 14, POCO F6",
};

function primaryKeyword(args: GenerateArgs): string {
  switch (args.pageType) {
    case "brand":    return `${args.brandName || args.keywords[0]} Phone Skins`;
    case "device":   return `${args.deviceCategory || args.keywords[0]} Skins`;
    case "skin-type":return `${args.designType || args.keywords[0]} Phone Skins`;
    case "product":  return `${args.productType || args.keywords[0]} Skins`;
    case "keyword":  return args.keywords[0];
  }
}

function brandSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function buildPrompt(args: GenerateArgs & { resolvedModels: string }): string {
  const pk = primaryKeyword(args);
  const brand = args.brandName || args.deviceCategory || args.designType || args.productType || args.keywords[0];
  const bSlug = brandSlug(brand);
  const notesSection = args.notes ? `\nADDITIONAL NOTES: ${args.notes}` : "";

  // Resolve model list: caller override → known brands → Firestore-fetched
  const knownKey = (args.brandName || "").toLowerCase();
  const modelsList =
    args.resolvedModels ||
    KNOWN_BRAND_MODELS[knownKey] ||
    args.keywords.join(", ");

  const pageTypeLabel: Record<PageType, string> = {
    brand:      "Brand Landing Page",
    device:     "Device Model Landing Page",
    product:    "Product Type Landing Page",
    "skin-type":"Skin Design / Theme Landing Page",
    keyword:    "SEO Keyword Landing Page",
  };

  return `Generate complete SEO content for a GoSkinly landing page.

PAGE TYPE: ${pageTypeLabel[args.pageType]}
PRIMARY KEYWORD: ${pk}
BRAND NAME: ${args.brandName || "N/A"}
DEVICE MODELS TO MENTION: ${modelsList}
DESIGN TYPES AVAILABLE: ${DESIGN_THEMES}${notesSection}

OUTPUT: Valid JSON only, no markdown, no backticks.

{
  "contentHTML": "<h2>Best ${pk} in India — Starting ₹149</h2>...",
  "faqs": [...],
  "imageAltTexts": [...]
}

CONTENT RULES:

1. LENGTH: 750–900 words. Not more, not less.

2. STRUCTURE (use exactly this order):
   <h2>Best ${pk} in India — Starting ₹149</h2>
   [2-paragraph intro — mention GoSkinly brand, ₹149 price, COD available]

   <h2>Popular ${brand} Models We Support</h2>
   [mention 6–8 specific models by exact name from DEVICE MODELS TO MENTION]

   <h2>Design Themes for ${brand} Skins</h2>
   [anime, 3D textured, carbon fiber, matte, etc.]

   <h2>Why GoSkinly?</h2>
   [4–5 bullet points — specific, no fluff, no banned phrases]

   <h2>How to Apply Your Skin</h2>
   [3–4 step numbered list]

3. KEYWORDS:
   - Primary keyword "${pk}": use 4–5 times naturally
   - Include these LSI terms at least once each:
     "phone skin India", "mobile skin online", "buy phone skin",
     "vinyl wrap", "matte finish skin", "scratch protection", "no residue removal"

4. INDIA CONTEXT — MANDATORY:
   - Mention "starting from ₹149" in intro paragraph
   - Mention "COD available" or "cash on delivery"
   - Mention "free delivery across India"
   - Use ₹ symbol (not $ or Rs)

5. INTERNAL LINK ANCHORS — exactly 3:
   Place naturally within the content. Use slugs derived from the brand/models mentioned.
   Examples:
     <a href="/${bSlug}-skins">${brand} Skins</a>
     <a href="/${bSlug}-galaxy-s25-ultra-skins">${brand} Galaxy S25 Ultra Skins</a>
     <a href="/matte-finish-phone-skins">Matte Finish Phone Skins</a>

6. FAQS — exactly 7:
   - First 3 questions MUST contain the primary keyword "${pk}"
   - Questions must be exact-match search queries people actually type
   - Good: "Which ${pk} are available under ₹200 in India?"
   - Bad: "Are the skins good quality?"
   - Answers: 2–3 sentences, include keyword naturally

7. IMAGE ALT TEXTS — exactly 15:
   Pattern: "[design] [brand] [model] phone skin India"
   Example: "anime Naruto Samsung Galaxy S24 phone skin India"
   Include ₹149 price mention in exactly 3 of them.
   Example: "matte black Samsung skin ₹149 India"

8. AVOID:
   - Any competitor brand names
   - All phrases from the BANNED PHRASES list
   - Keyword stuffing (max 1 primary keyword per paragraph)
   - Duplicate sentences`;
}

// ---------------------------------------------------------------------------
// Response parser — uses JSON mode response; regex fallback for safety
// ---------------------------------------------------------------------------

function parseGeneratedContent(text: string): ParsedContent {
  try {
    const parsed = JSON.parse(text);
    return {
      contentHTML: parsed.contentHTML || "",
      faqs: Array.isArray(parsed.faqs) ? parsed.faqs : [],
      imageAltTexts: Array.isArray(parsed.imageAltTexts) ? parsed.imageAltTexts : [],
    };
  } catch {
    // GPT occasionally wraps JSON in markdown fences despite instructions
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          contentHTML: parsed.contentHTML || "",
          faqs: Array.isArray(parsed.faqs) ? parsed.faqs : [],
          imageAltTexts: Array.isArray(parsed.imageAltTexts) ? parsed.imageAltTexts : [],
        };
      } catch { /* fall through */ }
    }
  }
  // Last resort: treat whole response as raw HTML
  return { contentHTML: text, faqs: [], imageAltTexts: [] };
}

// ---------------------------------------------------------------------------
// Cloud Function
// ---------------------------------------------------------------------------

export const generateSEOContent = onCall(async (data: any, context: any) => {
  const { uid } = await requireAdmin(context);
  await enforceDailyRateLimit({
    key: `generateSEOContent_${uid}`,
    limit: Number(process.env.SEO_DAILY_LIMIT || 100),
  });

  // Validate
  const validTypes: PageType[] = ["brand", "device", "product", "skin-type", "keyword"];
  const pageType: PageType = data?.pageType;
  if (!pageType || !validTypes.includes(pageType)) {
    throw new HttpsError("invalid-argument", `pageType must be one of: ${validTypes.join(", ")}`);
  }
  if (!Array.isArray(data?.keywords) || data.keywords.length === 0) {
    throw new HttpsError("invalid-argument", "keywords must be a non-empty array");
  }

  // Auto-fetch models for brand pages when caller hasn't supplied them
  let resolvedModels = "";
  if (pageType === "brand" && data.brandName) {
    const callerModels: string[] = Array.isArray(data.modelNames) ? data.modelNames : [];
    if (callerModels.length > 0) {
      resolvedModels = callerModels.join(", ");
    } else {
      const fetched = await fetchTopModelsForBrand(data.brandName, 6);
      resolvedModels = fetched.join(", ");
    }
  } else if (Array.isArray(data.modelNames) && data.modelNames.length > 0) {
    resolvedModels = data.modelNames.join(", ");
  }

  const args: GenerateArgs & { resolvedModels: string } = {
    pageType,
    keywords:       data.keywords,
    brandName:      data.brandName,
    deviceCategory: data.deviceCategory,
    productType:    data.productType,
    designType:     data.designType,
    modelNames:     data.modelNames,
    notes:          data.notes,
    resolvedModels,
  };

  const [apiKey, prompt] = await Promise.all([
    resolveOpenAIKey(),
    Promise.resolve(buildPrompt(args)),
  ]);

  const fetch = require("node-fetch");
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user",   content: prompt },
      ],
      temperature: 0.65,
      max_tokens: 3000,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("OpenAI API error:", errorText);
    throw new HttpsError("internal", "OpenAI API request failed");
  }

  const responseData: any = await response.json();
  const generatedText: string = responseData.choices?.[0]?.message?.content || "";

  if (!generatedText) {
    throw new HttpsError("internal", "OpenAI returned an empty response");
  }

  const parsed = parseGeneratedContent(generatedText);

  return {
    success:       true,
    contentHTML:   parsed.contentHTML,
    faqs:          parsed.faqs,
    imageAltTexts: parsed.imageAltTexts,
  };
});
