"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { api } from "./_generated/api.js";
import OpenAI from "openai";

// Default logo image URL for products without images
const DEFAULT_LOGO_IMAGE = "https://res.cloudinary.com/dcpjatdxs/image/upload/v1767710585/products/abstract-art-multi/img_2_1767710584949.webp";

// Generate SEO content for a product title
async function generateSEOContent(
  openai: OpenAI,
  title: string,
  gadgetCategory: string,
  finishType: string
) {
  const systemPrompt = `You are Skinly's SEO Product Content Generator AI.
Generate high-quality, SEO-friendly product content for mobile skins and wraps.

OUTPUT FORMAT - Return ONLY valid JSON:
{
  "metaTitle": "your meta title here (max 70 chars)",
  "description": "your full product description here (250-350 words with emojis and formatting)",
  "metaDescription": "your meta description here (150-160 chars)",
  "tags": ["tag1", "tag2", "tag3"],
  "slug": "url-friendly-slug-here",
  "imageAlt": "descriptive alt text for product image"
}

RULES:
- Description: 250-350 words, premium style, include emojis and sections
- Meta Title: Max 70 chars, include "Skinly"
- Meta Description: 150-160 chars with CTA
- Tags: 8-15 relevant tags
- Slug: lowercase, hyphens, no special chars
- Image Alt: 50-100 chars describing product`;

  const userPrompt = `Generate SEO content for: ${title}
Category: ${gadgetCategory}
Finish: ${finishType}`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ],
    temperature: 0.7,
    max_tokens: 2000,
  });

  const responseText = completion.choices[0]?.message?.content?.trim();
  if (!responseText) {
    throw new Error("OpenAI returned empty response");
  }

  const cleanedResponse = responseText
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();

  return JSON.parse(cleanedResponse);
}

// Action to create multiple products with SEO generation
export const createBulkProducts = action({
  args: {
    products: v.array(v.object({
      title: v.string(),
      gadgetTypeId: v.id("gadgetTypes"),
      finishTypeId: v.id("finishTypes"),
      gadgetCategory: v.string(),
      sku: v.string(),
      price: v.number(),
      compareAtPrice: v.optional(v.number()),
      inventoryQuantity: v.number(),
      status: v.union(v.literal("active"), v.literal("draft")),
    })),
    generateSEO: v.boolean(),
  },
  handler: async (ctx, args) => {
    // Check auth
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    // Get OpenAI API key if SEO generation requested
    let openai: OpenAI | null = null;
    if (args.generateSEO) {
      const apiKeyRecord = await ctx.runQuery(api.settings.getSetting, { key: "OPENAI_API_KEY" });
      if (!apiKeyRecord) {
        throw new ConvexError({
          message: "OpenAI API key not configured. Please add it in Settings.",
          code: "NOT_FOUND",
        });
      }
      const apiKey = String(apiKeyRecord.value);
      if (!apiKey.trim()) {
        throw new ConvexError({
          message: "OpenAI API key is empty.",
          code: "BAD_REQUEST",
        });
      }
      openai = new OpenAI({ apiKey });
    }

    // Get finish types for display names
    const finishTypes = await ctx.runQuery(api.finishTypes.listActive, {});
    const finishTypeMap = new Map(finishTypes.map(f => [f._id, f.displayName]));

    const results: {
      success: { title: string; productId: string }[];
      failed: { title: string; error: string }[];
    } = {
      success: [],
      failed: [],
    };

    // Process each product
    for (const product of args.products) {
      try {
        const finishTypeName = finishTypeMap.get(product.finishTypeId) || "";

        // Generate SEO content if requested
        let seoContent = {
          metaTitle: `${product.title} | Skinly`,
          description: product.title,
          metaDescription: `Shop ${product.title} at Skinly. Premium quality skin wrap.`,
          tags: [product.gadgetCategory, "skin", "wrap", "premium"],
          slug: product.title.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-"),
          imageAlt: `${product.title} - Skinly`,
        };

        if (args.generateSEO && openai) {
          try {
            seoContent = await generateSEOContent(
              openai,
              product.title,
              product.gadgetCategory,
              finishTypeName
            );
          } catch (seoError) {
            console.error(`SEO generation failed for ${product.title}:`, seoError);
            // Continue with fallback SEO
          }
        }

        // Create the product
        const productId = await ctx.runMutation(api.products.createProduct, {
          title: product.title,
          slug: seoContent.slug,
          description: seoContent.description,
          metaTitle: seoContent.metaTitle,
          metaDescription: seoContent.metaDescription,
          tags: Array.isArray(seoContent.tags) ? seoContent.tags : [],
          status: product.status,
          images: [{ url: DEFAULT_LOGO_IMAGE, alt: seoContent.imageAlt }],
          gadgetCategory: product.gadgetCategory as any,
          gadgetTypeId: product.gadgetTypeId,
          finishTypeId: product.finishTypeId,
          productCategory: "skin",
          productType: "physical",
          hasMultipleVariants: false,
          length: 10,
          breadth: 10,
          height: 2,
          weight: 100,
        });

        // Create the variant
        await ctx.runMutation(api.products.createVariant, {
          productId,
          sku: product.sku,
          title: "Default",
          price: product.price,
          compareAtPrice: product.compareAtPrice,
          inventoryQuantity: product.inventoryQuantity,
          isDefaultVariant: true,
        });

        results.success.push({
          title: product.title,
          productId: productId,
        });
      } catch (error) {
        results.failed.push({
          title: product.title,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return results;
  },
});
