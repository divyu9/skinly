"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { api } from "./_generated/api.js";
import OpenAI from "openai";

// Generate SEO content for a single product
export const generateProductSEO = action({
  args: { 
    productId: v.id("products"),
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

    // Get OpenAI API key from settings
    const apiKeyRecord = await ctx.runQuery(api.settings.getSetting, { key: "OPENAI_API_KEY" });
    if (!apiKeyRecord) {
      throw new ConvexError({
        message: "OpenAI API key not configured. Please add OPENAI_API_KEY in the settings.",
        code: "NOT_FOUND",
      });
    }

    const apiKey = String(apiKeyRecord.value);
    if (!apiKey || apiKey.trim() === "") {
      throw new ConvexError({
        message: "OpenAI API key is empty. Please configure it in settings.",
        code: "BAD_REQUEST",
      });
    }

    // Fetch the product
    const product = await ctx.runQuery(api.products.getProduct, { productId: args.productId });

    if (!product) {
      throw new ConvexError({
        message: "Product not found",
        code: "NOT_FOUND",
      });
    }

    // Initialize OpenAI client
    const openai = new OpenAI({ apiKey });

    // Determine product category/type for better context
    const categoryName = product.gadgetCategory ? product.gadgetCategory.replace(/-/g, " ") : "product";
    
    // Get finish type display name if available
    let finishType = "";
    if (product.finishTypeId) {
      const finishTypeData = await ctx.runQuery(api.finishTypes.get, { id: product.finishTypeId });
      if (finishTypeData) {
        finishType = ` (${finishTypeData.displayName} finish)`;
      }
    }

    // Create the system prompt with user's rules
    const systemPrompt = `You are Skinly's SEO Product Content Generator AI.

Your task is to generate *high-quality, SEO-friendly, engaging product content* based ONLY on the product's existing title and category (mobile skin, laptop skin, tablet skin, camera skin, gaming skins, tempered glasses, cases, accessories etc.)

-----------------------------------------------------
PRODUCT DESCRIPTION – RULES
-----------------------------------------------------
•  Description must be 250–350 words, written in a premium modern style.
•  Format the content cleanly with *bold text, *italic text, line breaks, emojis, bullets and short paragraphs.
•  Make the layout look beautiful and easy to read (like a Shopify or Apple product page).
•  Avoid keyword stuffing, but use natural SEO variations related to the product.
•  Description must match the product title.
•  Include these sections inside description:
  - ⭐ *Introduction paragraph* about the product
  - 🎨 *Design & Material Quality*
  - 🎯 *Precision Fit*
  - 🛡️ *Protection & Durability*
  - 🔧 *Easy Application*
  - 📦 *What You Get* (small bullet list)
  - ❓ *Mini FAQ section* (2–3 questions)

-----------------------------------------------------
META TITLE – RULES
-----------------------------------------------------
•  Use the product title properly.
•  Max length 65–70 characters.
•  Must include 1 keyword variation naturally (not forced).
•  Add brand name "Skinly" at the end if space allows.

-----------------------------------------------------
META DESCRIPTION – RULES
-----------------------------------------------------
•  Length: 150–160 characters.
•  Must include value + keyword + CTA.
•  No keyword stuffing.
Example style:
"Premium skin for iPhone 15 Pro Max. Scratch protection, perfect fit, stylish finish. Shop now at Skinly."

-----------------------------------------------------
SEO TAGS – RULES
-----------------------------------------------------
•  Output 8–15 comma-separated tags.
•  Include: device, model, material type, finish type, product type.
•  Example: "iPhone skins, matte vinyl skins, camera wrap, precision cut skin, stylish skins"
-----------------------------------------------------
STYLE RULES
-----------------------------------------------------
•  Maintain SEO best practices
•  Avoid repeating same lines between products
•  Tone: clean, modern, premium
•  No over-optimization
•  Human-like, high-quality writing
•  Description must visually look attractive

-----------------------------------------------------
OUTPUT FORMAT
-----------------------------------------------------
You must respond with ONLY a valid JSON object (no markdown, no code blocks) in this exact format:
{
  "metaTitle": "your meta title here",
  "description": "your full product description here",
  "metaDescription": "your meta description here",
  "tags": ["tag1", "tag2", "tag3"]
}`;

    const userPrompt = `Generate SEO content for this product:

Product Title: ${product.title}
Product Category: ${categoryName}${finishType}

Return ONLY the JSON object with metaTitle, description, metaDescription, and tags.`;

    try {
      // Call OpenAI API (using gpt-4o for better quality)
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
        throw new ConvexError({
          message: "OpenAI returned an empty response",
          code: "EXTERNAL_SERVICE_ERROR",
        });
      }

      // Parse the JSON response
      let seoContent: {
        metaTitle: string;
        description: string;
        metaDescription: string;
        tags: string[];
      };

      try {
        // Remove markdown code blocks if present
        const cleanedResponse = responseText
          .replace(/```json\n?/g, "")
          .replace(/```\n?/g, "")
          .trim();
        
        seoContent = JSON.parse(cleanedResponse);
      } catch (parseError) {
        console.error("Failed to parse OpenAI response:", responseText);
        throw new ConvexError({
          message: "Failed to parse AI response. Please try again.",
          code: "EXTERNAL_SERVICE_ERROR",
        });
      }

      // Validate the response structure
      if (!seoContent.metaTitle || !seoContent.description || !seoContent.metaDescription || !Array.isArray(seoContent.tags)) {
        throw new ConvexError({
          message: "AI response is missing required fields",
          code: "EXTERNAL_SERVICE_ERROR",
        });
      }

      return {
        productId: args.productId,
        metaTitle: seoContent.metaTitle,
        description: seoContent.description,
        metaDescription: seoContent.metaDescription,
        tags: seoContent.tags,
      };
    } catch (error) {
      console.error("OpenAI API error:", error);
      
      if (error instanceof ConvexError) {
        throw error;
      }

      throw new ConvexError({
        message: `Failed to generate SEO content: ${error instanceof Error ? error.message : "Unknown error"}`,
        code: "EXTERNAL_SERVICE_ERROR",
      });
    }
  },
});

// Bulk generate SEO content for multiple products
export const bulkGenerateProductSEO = action({
  args: {
    productIds: v.array(v.id("products")),
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

    const results: {
      success: { productId: string; title: string }[];
      failed: { productId: string; title: string; error: string }[];
    } = {
      success: [],
      failed: [],
    };

    // Process each product sequentially
    for (const productId of args.productIds) {
      try {
        // Get product title for logging
        const product = await ctx.runQuery(api.products.getProduct, { productId });
        
        if (!product) {
          results.failed.push({
            productId,
            title: "Unknown",
            error: "Product not found",
          });
          continue;
        }

        // Generate SEO content
        const seoContent = await ctx.runAction(api.seoProductGenerator.generateProductSEO, { productId });

        // Update the product with generated content
        await ctx.runMutation(api.products.updateProduct, {
          productId,
          metaTitle: seoContent.metaTitle,
          description: seoContent.description,
          metaDescription: seoContent.metaDescription,
          tags: seoContent.tags,
        });

        results.success.push({
          productId,
          title: product.title,
        });
      } catch (error) {
        // Get product title for error logging
        const product = await ctx.runQuery(api.products.getProduct, { productId }).catch(() => null);
        
        results.failed.push({
          productId,
          title: product?.title || "Unknown",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return results;
  },
});
