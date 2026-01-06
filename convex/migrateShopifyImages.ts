"use node";

import { v } from "convex/values";
import { action, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import crypto from "crypto";

/**
 * Migration Action: Moves images from Shopify CDN to Cloudinary
 * 
 * Strategy:
 * 1. Find products with "cdn.shopify.com" in their image URLs.
 * 2. Process in batches to avoid timeouts.
 * 3. Upload to Cloudinary.
 * 4. Update the product record.
 */
export const migrateImagesFromShopify = action({
  args: {
    batchSize: v.optional(v.number()), // Default 5
    cursor: v.optional(v.string()), // Pagination cursor
  },
  handler: async (ctx, args): Promise<{
    processed: number;
    success: number;
    failed: number;
    hasMore: boolean;
    nextCursor: string | null;
    remaining: number;
    errors: string[];
  }> => {
    const batchSize = args.batchSize || 5;
    
    // 1. Get batch of products that need migration
    // We can't easily query "contains" in Convex without full scan, 
    // so we'll fetch products and filter in memory or use a helper query.
    // For efficiency, we'll call an internal query to get a chunk of products.
    const result: {
        products: any[];
        nextCursor: string | null;
        totalRemaining: number;
    } = await ctx.runMutation(internal.internalMigration.getProductsToMigrate, {
      limit: batchSize,
      cursor: args.cursor,
    });

    const { products, nextCursor, totalRemaining } = result;

    if (products.length === 0) {
      return {
        processed: 0,
        success: 0,
        failed: 0,
        hasMore: false,
        nextCursor: null,
        remaining: 0,
        errors: [],
      };
    }

    let successCount = 0;
    let failCount = 0;
    const errors: string[] = [];

    // 2. Process each product
    for (const product of products) {
      try {
        const newImages = [...product.images];
        let productModified = false;

        // Process each image in the product
        for (let i = 0; i < newImages.length; i++) {
          const img = newImages[i];
          
          // Only migrate Shopify URLs
          if (img.url.includes("cdn.shopify.com") || img.url.includes("shopify")) {
            console.log(`Migrating image for ${product.title}: ${img.url}`);
            
            try {
              // A. Prepare Cloudinary Upload (Direct URL Fetch)
              // We pass the Shopify URL directly to Cloudinary, saving bandwidth and processing time.
              
              const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
              const apiKey = process.env.CLOUDINARY_API_KEY;
              const apiSecret = process.env.CLOUDINARY_API_SECRET;

              if (!cloudName || !apiKey) throw new Error("Cloudinary credentials missing");

              const timestamp = Math.floor(Date.now() / 1000).toString();
              const folder = `products/${product.slug}`; // Organized folder structure
              const publicId = `img_${i}_${Date.now()}`; // Unique ID

              // Prepare params for signature
              const uploadParams: Record<string, string> = {
                folder: folder,
                public_id: publicId,
                timestamp: timestamp,
                upload_preset: "webp-auto-convert",
              };

              // Generate signature
              const sortedParams = Object.keys(uploadParams)
                .sort()
                .map(key => `${key}=${uploadParams[key]}`)
                .join('&');
              
              const signatureInput = sortedParams + apiSecret;
              
              // SHA-1 helper using Node.js crypto
              const sha1 = (str: string): string => {
                return crypto.createHash('sha1').update(str).digest('hex');
              };

              const signature = sha1(signatureInput);

              const formData = new FormData();
              // Pass the Shopify URL directly as the "file"
              formData.append("file", img.url);
              formData.append("api_key", apiKey);
              formData.append("signature", signature);
              
              // Append signed params
              Object.entries(uploadParams).forEach(([key, value]) => {
                formData.append(key, value);
              });

              const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
                method: "POST",
                body: formData,
              });

              if (!uploadRes.ok) {
                const errText = await uploadRes.text();
                throw new Error(`Cloudinary upload failed: ${errText}`);
              }

              const uploadData = await uploadRes.json();
              
              // B. Update URL
              newImages[i] = {
                ...img,
                url: uploadData.secure_url,
              };
              productModified = true;
              
            } catch (imgError) {
              console.error(`Failed to migrate image ${img.url}:`, imgError);
              errors.push(`Product "${product.title}" Image ${i + 1}: ${imgError instanceof Error ? imgError.message : "Unknown error"}`);
            }
          }
        }

        // 3. Save updates if modified
        if (productModified) {
          await ctx.runMutation(internal.internalMigration.updateProductImages, {
            productId: product._id,
            images: newImages,
          });
          successCount++;
        } else {
          // No changes needed (maybe processed by another thread)
          successCount++; 
        }

      } catch (err) {
        failCount++;
        errors.push(`Product "${product.title}": ${err instanceof Error ? err.message : "Unknown error"}`);
      }
    }

    return {
      processed: products.length,
      success: successCount,
      failed: failCount,
      hasMore: !!nextCursor,
      nextCursor,
      remaining: totalRemaining - products.length, // Approx
      errors,
    };
  },
});

