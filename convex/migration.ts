"use node";

import { action } from "./_generated/server";
import { internal } from "./_generated/api";

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

export const migrateFromShopify = action({
  args: {},
  handler: async (ctx) => {
    const shopDomain = process.env.SHOPIFY_SHOP_DOMAIN;
    const accessToken = process.env.SHOPIFY_ADMIN_API_TOKEN;
    const apiVersion = process.env.SHOPIFY_API_VERSION || "2024-01";

    if (!shopDomain || !accessToken) {
      throw new Error("Shopify credentials not configured");
    }

    const url = `https://${shopDomain}/admin/api/${apiVersion}/products.json?limit=250&status=active`;

    try {
      const response = await fetch(url, {
        headers: {
          "X-Shopify-Access-Token": accessToken,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Shopify API error: ${response.statusText}`);
      }

      const data = await response.json();
      const products = data.products as ShopifyProduct[];

      const migrationResults = {
        total: products.length,
        successful: 0,
        failed: 0,
        errors: [] as string[],
      };

      // Migrate each product
      for (const shopifyProduct of products) {
        try {
          // Create slug from handle
          const slug = shopifyProduct.handle;

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
        } catch (error) {
          migrationResults.failed++;
          migrationResults.errors.push(
            `Failed to migrate "${shopifyProduct.title}": ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }

      return migrationResults;
    } catch (error) {
      throw new Error(
        `Migration failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  },
});
