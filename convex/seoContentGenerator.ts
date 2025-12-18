"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { api } from "./_generated/api.js";

// AI Content Generator
export const generateSEOContent = action({
  args: {
    pageType: v.union(
      v.literal("brand"),
      v.literal("device"),
      v.literal("product"),
      v.literal("skin-type"),
      v.literal("keyword")
    ),
    keywords: v.array(v.string()),
    brandName: v.optional(v.string()),
    deviceCategory: v.optional(v.string()),
    productType: v.optional(v.string()),
    designType: v.optional(v.string()),
    modelNames: v.optional(v.array(v.string())), // For compatibility lists
    notes: v.optional(v.string()), // Custom notes from admin
  },
  handler: async (ctx, args) => {
    // Check if OpenAI API key is configured
    const apiKeySetting = await ctx.runQuery(api.settings.getSetting, {
      key: "openaiApiKey",
    });

    if (!apiKeySetting || !apiKeySetting.value) {
      return {
        success: false,
        error:
          "OpenAI API key not configured. Please add your API key in Settings → AI Configuration to enable AI content generation.",
        contentHTML: "",
        faqs: [],
        imageAltTexts: [],
      };
    }

    const apiKey = apiKeySetting.value as string;

    try {
      // Build context-specific prompt based on page type
      const prompt = buildPrompt(args);

      // Call OpenAI API
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o", // Using GPT-4o as GPT-5 may not be available yet
          messages: [
            {
              role: "system",
              content:
                "You are an expert SEO content writer for GoSkinly, a premium mobile and device skin brand. Write engaging, SEO-optimized, plagiarism-free content that converts visitors into customers. Never include specific location references unless explicitly requested.",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          temperature: 0.7,
          max_tokens: 2500,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        return {
          success: false,
          error: `OpenAI API error: ${errorData.error?.message || "Unknown error"}`,
          contentHTML: "",
          faqs: [],
          imageAltTexts: [],
        };
      }

      const data = await response.json();
      const generatedText = data.choices[0]?.message?.content || "";

      // Parse the generated content
      const parsed = parseGeneratedContent(generatedText);

      return {
        success: true,
        contentHTML: parsed.contentHTML,
        faqs: parsed.faqs,
        imageAltTexts: parsed.imageAltTexts,
      };
    } catch (error) {
      console.error("AI content generation error:", error);
      return {
        success: false,
        error: `Failed to generate content: ${error instanceof Error ? error.message : "Unknown error"}`,
        contentHTML: "",
        faqs: [],
        imageAltTexts: [],
      };
    }
  },
});

// Build prompt based on page type and data
function buildPrompt(args: {
  pageType: "brand" | "device" | "product" | "skin-type" | "keyword";
  keywords: string[];
  brandName?: string;
  deviceCategory?: string;
  productType?: string;
  designType?: string;
  modelNames?: string[];
  notes?: string;
}): string {
  const keywordsList = args.keywords.join(", ");
  const notesSection = args.notes ? `\n\nAdditional Notes: ${args.notes}` : "";

  let contextSection = "";

  switch (args.pageType) {
    case "brand":
      if (!args.brandName) {
        console.warn("⚠️ SEO Content Generation: Missing brandName - content quality will be poor");
      }
      contextSection = `
Page Type: Brand Landing Page
Brand Name: ${args.brandName || "[ERROR: BRAND NAME MISSING]"}
Device Types: Mobiles, Tablets, Laptops, Cameras, Drones, Chargers, Consoles, etc.

Create content that showcases all ${args.brandName || "[BRAND]"} devices we support.`;
      break;

    case "device":
      if (!args.deviceCategory) {
        console.warn("⚠️ SEO Content Generation: Missing deviceCategory - content quality will be poor");
      }
      contextSection = `
Page Type: Device Category Landing Page
Device Category: ${args.deviceCategory || "[ERROR: DEVICE CATEGORY MISSING]"}
Models Supported: ${args.modelNames?.join(", ") || "Various models"}

Create content focused on ${args.deviceCategory || "[DEVICE]"} skins with emphasis on perfect fit and model compatibility.`;
      break;

    case "product":
      if (!args.productType) {
        console.warn("⚠️ SEO Content Generation: Missing productType - content quality will be poor");
      }
      contextSection = `
Page Type: Product Type Landing Page
Product Type: ${args.productType || "[ERROR: PRODUCT TYPE MISSING]"}

Create content highlighting the features and benefits of ${args.productType || "[PRODUCT]"} skins.`;
      break;

    case "skin-type":
      if (!args.designType) {
        console.warn("⚠️ SEO Content Generation: Missing designType - content quality will be poor");
      }
      contextSection = `
Page Type: Skin Design Landing Page
Design Type: ${args.designType || "[ERROR: DESIGN TYPE MISSING]"}

Create content showcasing the unique style and benefits of ${args.designType || "[DESIGN]"} skins.`;
      break;

    case "keyword":
      contextSection = `
Page Type: SEO Keyword Landing Page
Target Keywords: ${keywordsList}

Create comprehensive SEO content targeting these keywords naturally.`;
      break;
  }

  return `Generate complete SEO content for a GoSkinly landing page with the following specifications:

${contextSection}

Target Keywords: ${keywordsList}${notesSection}

Please provide the content in the following JSON format:

{
  "contentHTML": "1000-1500 word HTML content with proper H2 and H3 structure. Include:
    - Compelling introduction (2-3 paragraphs)
    - Benefits section with bullet points
    - Features and quality highlights
    - Installation guide (brief)
    - Compatibility information
    - Why choose GoSkinly section
    - Use semantic HTML tags: <h2>, <h3>, <p>, <ul>, <li>, <strong>
    - Make it engaging, conversion-focused, and plagiarism-free
    - DO NOT include any location or city references",
  
  "faqs": [
    {"question": "Question 1?", "answer": "Detailed answer with keywords"},
    {"question": "Question 2?", "answer": "Detailed answer with keywords"},
    ... (5-8 FAQs total)
  ],
  
  "imageAltTexts": [
    "Alt text 1 with keywords",
    "Alt text 2 with keywords",
    ... (15-20 variations)
  ]
}

CRITICAL REQUIREMENTS:
- Write naturally, avoid keyword stuffing
- Make content unique and engaging
- Focus on benefits and conversion
- Use proper HTML formatting
- Make FAQs schema-ready
- Ensure all content is plagiarism-free
- NEVER include location references (no city names, no "Noida", no "India" unless specifically required)
- Keep sentences complete and professional`;
}

// Parse AI-generated content
function parseGeneratedContent(text: string): {
  contentHTML: string;
  faqs: Array<{ question: string; answer: string }>;
  imageAltTexts: string[];
} {
  try {
    // Try to extract JSON from the response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        contentHTML: parsed.contentHTML || "",
        faqs: parsed.faqs || [],
        imageAltTexts: parsed.imageAltTexts || [],
      };
    }
  } catch (error) {
    console.error("Failed to parse AI response as JSON:", error);
  }

  // Fallback: treat entire response as HTML content
  return {
    contentHTML: text,
    faqs: [],
    imageAltTexts: [],
  };
}

// Generate FAQs only
export const generateFAQs = action({
  args: {
    pageType: v.union(
      v.literal("brand"),
      v.literal("device"),
      v.literal("product"),
      v.literal("skin-type"),
      v.literal("keyword")
    ),
    topic: v.string(),
    keywords: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const apiKeySetting = await ctx.runQuery(api.settings.getSetting, {
      key: "openaiApiKey",
    });

    if (!apiKeySetting || !apiKeySetting.value) {
      return {
        success: false,
        error: "OpenAI API key not configured",
        faqs: [],
      };
    }

    const apiKey = apiKeySetting.value as string;

    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content:
                "You are an SEO expert. Generate FAQs in JSON format with schema markup support.",
            },
            {
              role: "user",
              content: `Generate 5-8 frequently asked questions and detailed answers about ${args.topic} for GoSkinly. Include keywords: ${args.keywords.join(", ")}. Format: [{"question": "...", "answer": "..."}]`,
            },
          ],
          temperature: 0.7,
          max_tokens: 1000,
        }),
      });

      const data = await response.json();
      const generatedText = data.choices[0]?.message?.content || "[]";

      // Try to parse JSON array
      const jsonMatch = generatedText.match(/\[[\s\S]*\]/);
      const faqs = jsonMatch ? JSON.parse(jsonMatch[0]) : [];

      return {
        success: true,
        faqs,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to generate FAQs: ${error instanceof Error ? error.message : "Unknown error"}`,
        faqs: [],
      };
    }
  },
});

// Generate image alt texts
export const generateAltTexts = action({
  args: {
    topic: v.string(),
    keywords: v.array(v.string()),
    count: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const apiKeySetting = await ctx.runQuery(api.settings.getSetting, {
      key: "openaiApiKey",
    });

    if (!apiKeySetting || !apiKeySetting.value) {
      return {
        success: false,
        error: "OpenAI API key not configured",
        altTexts: [],
      };
    }

    const apiKey = apiKeySetting.value as string;
    const count = args.count || 15;

    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: "You are an SEO expert. Generate diverse image alt texts.",
            },
            {
              role: "user",
              content: `Generate ${count} unique, SEO-optimized image alt text variations for ${args.topic}. Include keywords: ${args.keywords.join(", ")}. Return as JSON array: ["alt text 1", "alt text 2", ...]`,
            },
          ],
          temperature: 0.8,
          max_tokens: 500,
        }),
      });

      const data = await response.json();
      const generatedText = data.choices[0]?.message?.content || "[]";

      // Try to parse JSON array
      const jsonMatch = generatedText.match(/\[[\s\S]*\]/);
      const altTexts = jsonMatch ? JSON.parse(jsonMatch[0]) : [];

      return {
        success: true,
        altTexts,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to generate alt texts: ${error instanceof Error ? error.message : "Unknown error"}`,
        altTexts: [],
      };
    }
  },
});
