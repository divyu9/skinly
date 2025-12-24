"use node";

import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

interface ShopifyProduct {
  id: number;
  title: string;
  handle: string;
  body_html: string;
  vendor: string;
  product_type: string;
  tags: string;
  status: string;
  images: Array<{
    id: number;
    src: string;
    alt: string | null;
  }>;
  variants: Array<{
    id: number;
    title: string;
    price: string;
    sku: string;
    inventory_quantity: number;
    weight: number;
    weight_unit: string;
  }>;
}

// Diagnostic action to check Shopify product counts
export const checkShopifyProductCount = action({
  args: {},
  handler: async (ctx): Promise<{ shopifyTotal: number; localTotal: number; missing: number }> => {
    const shopDomain = process.env.SHOPIFY_SHOP_DOMAIN;
    const accessToken = process.env.SHOPIFY_ADMIN_API_TOKEN;
    const apiVersion = process.env.SHOPIFY_API_VERSION || "2024-01";

    if (!shopDomain || !accessToken) {
      throw new Error("Shopify credentials not configured");
    }

    try {
      // Get product count from Shopify
      const countResponse = await fetch(
        `https://${shopDomain}/admin/api/${apiVersion}/products/count.json?status=active`,
        {
          headers: {
            "X-Shopify-Access-Token": accessToken,
            "Content-Type": "application/json",
          },
        }
      );

      if (!countResponse.ok) {
        throw new Error(`Shopify API error: ${countResponse.statusText}`);
      }

      const countData: { count: number } = await countResponse.json();

      // Get local product count
      const localProducts: number = await ctx.runQuery(internal.migrationInternal.getProductCount, {});

      return {
        shopifyTotal: countData.count,
        localTotal: localProducts,
        missing: countData.count - localProducts,
      };
    } catch (error) {
      throw new Error(
        `Check failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  },
});

export const migrateFromShopify = action({
  args: { forceReimport: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const shopDomain = process.env.SHOPIFY_SHOP_DOMAIN;
    const accessToken = process.env.SHOPIFY_ADMIN_API_TOKEN;
    const apiVersion = process.env.SHOPIFY_API_VERSION || "2024-01";

    if (!shopDomain || !accessToken) {
      throw new Error("Shopify credentials not configured");
    }

    try {
      // Collect all products from all pages
      const allProducts: ShopifyProduct[] = [];
      let nextPageUrl: string | null = `https://${shopDomain}/admin/api/${apiVersion}/products.json?limit=250&status=active`;
      let pageCount = 0;

      // Loop through all pages using pagination
      while (nextPageUrl) {
        pageCount++;
        console.log(`Fetching page ${pageCount} from Shopify...`);
        
        const response: Response = await fetch(nextPageUrl, {
          headers: {
            "X-Shopify-Access-Token": accessToken,
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          throw new Error(`Shopify API error: ${response.statusText}`);
        }

        const data: { products: ShopifyProduct[] } = await response.json();
        const products = data.products;
        console.log(`Page ${pageCount}: Fetched ${products.length} products (Total so far: ${allProducts.length + products.length})`);
        allProducts.push(...products);

        // Check for next page in Link header
        const linkHeader: string | null = response.headers.get("Link");
        nextPageUrl = null;

        if (linkHeader) {
          // Parse Link header for rel="next"
          const links: string[] = linkHeader.split(",");
          for (const link of links) {
            const match: RegExpMatchArray | null = link.match(/<([^>]+)>;\s*rel="next"/);
            if (match) {
              nextPageUrl = match[1];
              console.log(`Next page URL found: ${nextPageUrl}`);
              break;
            }
          }
        } else {
          console.log(`No more pages. Total products fetched: ${allProducts.length}`);
        }
      }

      const migrationResults = {
        total: allProducts.length,
        successful: 0,
        skipped: 0,
        failed: 0,
        errors: [] as string[],
        skippedProducts: [] as Array<{ title: string; reason: string }>,
        failedProducts: [] as Array<{ title: string; reason: string }>,
        successfulProducts: [] as string[],
      };

      console.log(`\n=== Starting migration of ${allProducts.length} products ===\n`);

      // Migrate each product
      for (const shopifyProduct of allProducts) {
        try {
          // Create slug from handle
          const slug = shopifyProduct.handle;

          // Check if product already exists (skip unless forceReimport is true)
          if (!args.forceReimport) {
            const existingProducts = await ctx.runQuery(internal.migrationInternal.checkProductExists, {
              slug,
            });

            if (existingProducts) {
              migrationResults.skipped++;
              migrationResults.skippedProducts.push({
                title: shopifyProduct.title,
                reason: "Already exists in database",
              });
              console.log(`⏭️  SKIPPED: "${shopifyProduct.title}" - Already exists`);
              continue; // Skip this product
            }
          }

          // Parse tags
          const tags = shopifyProduct.tags
            ? shopifyProduct.tags.split(",").map((t) => t.trim()).filter((t) => t)
            : [];

          // Map images
          const images = shopifyProduct.images.map((img) => ({
            url: img.src,
            alt: img.alt || undefined,
          }));

          // Extract plain text description (remove HTML)
          const description = shopifyProduct.body_html
            ? shopifyProduct.body_html.replace(/<[^>]*>/g, "").trim()
            : shopifyProduct.title;

          // Create product in local database
          const productId = await ctx.runMutation(internal.migrationInternal.createProductInternal, {
            title: shopifyProduct.title,
            slug,
            description,
            status: "active",
            images: images.slice(0, 5), // Limit to 5 images
            tags,
          });

          // Create variants
          for (const variant of shopifyProduct.variants) {
            await ctx.runMutation(internal.migrationInternal.createVariantInternal, {
              productId,
              sku: variant.sku || `SKU-${variant.id}`,
              title: variant.title,
              price: parseFloat(variant.price),
              inventoryQuantity: variant.inventory_quantity || 0,
              weight: variant.weight || undefined,
              weightUnit: variant.weight_unit || undefined,
            });
          }

          migrationResults.successful++;
          migrationResults.successfulProducts.push(shopifyProduct.title);
          console.log(`✅ SUCCESS: "${shopifyProduct.title}" - Imported with ${shopifyProduct.variants.length} variant(s)`);
        } catch (error) {
          migrationResults.failed++;
          const errorMessage = error instanceof Error ? error.message : String(error);
          migrationResults.errors.push(
            `Failed to migrate "${shopifyProduct.title}": ${errorMessage}`
          );
          migrationResults.failedProducts.push({
            title: shopifyProduct.title,
            reason: errorMessage,
          });
          console.error(`❌ FAILED: "${shopifyProduct.title}" - ${errorMessage}`);
        }
      }

      console.log(`\n=== Migration Complete ===`);
      console.log(`Total: ${migrationResults.total}`);
      console.log(`✅ Successful: ${migrationResults.successful}`);
      console.log(`⏭️  Skipped: ${migrationResults.skipped}`);
      console.log(`❌ Failed: ${migrationResults.failed}\n`);

      return migrationResults;
    } catch (error) {
      throw new Error(
        `Migration failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  },
});
