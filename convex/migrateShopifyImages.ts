import { v } from "convex/values";
import { action, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

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
    } = await ctx.runMutation(internal.migrateShopifyImages.getProductsToMigrate, {
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
              // A. Fetch image from Shopify
              const response = await fetch(img.url);
              if (!response.ok) throw new Error(`Failed to fetch ${img.url}: ${response.statusText}`);
              const blob = await response.blob();
              
              // Convert blob to base64
              const base64 = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
              });

              // B. Upload to Cloudinary
              // Use existing logic from cloudinary.ts if possible, or replicate here for simplicity
              // We'll call the existing action logic directly or via fetch if internal call is tricky from action
              // Since we are inside an action, we can just call the upload logic.
              // Re-implementing upload logic here to avoid "calling action from action" complexity if not supported
              
              const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
              const apiKey = process.env.CLOUDINARY_API_KEY;
              const apiSecret = process.env.CLOUDINARY_API_SECRET;

              if (!cloudName || !apiKey) throw new Error("Cloudinary credentials missing");

              const timestamp = Math.floor(Date.now() / 1000).toString();
              const folder = `products/${product.slug}`; // Organized folder structure
              const publicId = `img_${i}_${Date.now()}`; // Unique ID

              // Prepare params for signature (excluding file, api_key, resource_type)
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
              
              // SHA-1 helper
              const sha1 = async (str: string): Promise<string> => {
                const encoder = new TextEncoder();
                const data = encoder.encode(str);
                const hashBuffer = await crypto.subtle.digest('SHA-1', data);
                const hashArray = Array.from(new Uint8Array(hashBuffer));
                return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
              };

              const signature = await sha1(signatureInput);

              const formData = new FormData();
              formData.append("file", base64);
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
              
              // C. Update URL
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
          await ctx.runMutation(internal.migrateShopifyImages.updateProductImages, {
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

/**
 * Internal Mutation: Get products that need migration
 * Returns products that have "shopify" in their image URLs
 */
export const getProductsToMigrate = internalMutation({
  args: {
    limit: v.number(),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // We iterate through all products to find ones with shopify links.
    // This is expensive but necessary for a one-time migration.
    // To optimize, we paginate through the whole table.
    
    const products = await ctx.db.query("products").paginate({ cursor: args.cursor || null, numItems: 50 });
    
    // Filter for Shopify images in memory
    const shopifyProducts = products.page.filter(p => 
      p.images.some(img => img.url.includes("cdn.shopify.com") || img.url.includes("shopify"))
    );

    // If we didn't find enough in this page, we might return fewer than 'limit'.
    // That's acceptable for a migration script; the client will just call again with the next cursor.
    // We prioritize returning *some* work to do.
    
    // Slice to requested limit
    const productsToProcess = shopifyProducts.slice(0, args.limit);

    // Calculate approximate remaining (just checking if pagination is done)
    const hasMore = !products.isDone || (shopifyProducts.length > args.limit);

    return {
      products: productsToProcess,
      nextCursor: products.continueCursor, // This advances the global cursor, skipping non-shopify products effectively
      totalRemaining: hasMore ? 999 : 0, // Placeholder
    };
  },
});

/**
 * Internal Mutation: Update product images
 */
export const updateProductImages = internalMutation({
  args: {
    productId: v.id("products"),
    images: v.array(v.object({
      url: v.string(),
      alt: v.optional(v.string()),
      phoneModel: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.productId, {
      images: args.images,
    });
  },
});
