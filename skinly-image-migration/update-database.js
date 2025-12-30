/**
 * UPDATE DATABASE - Step 2: After uploading images to Hostinger
 * 
 * Run this AFTER you've uploaded images to Hostinger
 * It will update all product image URLs in Convex
 * 
 * SETUP:
 * 1. Make sure you've uploaded images to Hostinger first!
 * 2. Add migration.ts to your convex/ folder
 * 3. Run: npx convex dev (to deploy the migration functions)
 * 4. Run: node update-database.js
 */

const { ConvexHttpClient } = require("convex/browser");
const fs = require("fs-extra");
const cliProgress = require("cli-progress");

// ============================================
// UPDATE THIS WITH YOUR CONVEX URL
// ============================================
const CONVEX_URL = "https://your-deployment.convex.cloud";

async function main() {
  console.log("\n🔄 SKINLY DATABASE UPDATER\n");
  
  // Load mapping file
  if (!await fs.pathExists("./url_mapping.json")) {
    console.error("❌ url_mapping.json not found!");
    console.log("   Run download-images.js first.");
    return;
  }
  
  const imageMap = await fs.readJson("./url_mapping.json");
  console.log(`📄 Loaded ${imageMap.length} image mappings\n`);
  
  // Group by product
  const productUpdates = new Map();
  
  for (const item of imageMap) {
    if (!productUpdates.has(item.productId)) {
      productUpdates.set(item.productId, {
        productId: item.productId,
        imageUpdates: [],
      });
    }
    productUpdates.get(item.productId).imageUpdates.push({
      index: item.imageIndex,
      newUrl: item.newUrl,
      alt: item.alt,
    });
  }
  
  console.log(`📦 Products to update: ${productUpdates.size}\n`);
  
  const client = new ConvexHttpClient(CONVEX_URL);
  
  // Progress bar
  const progressBar = new cliProgress.SingleBar({
    format: '   Updating |{bar}| {percentage}% | {value}/{total}',
    barCompleteChar: '█',
    barIncompleteChar: '░',
  });
  progressBar.start(productUpdates.size, 0);
  
  let success = 0;
  let failed = [];
  
  for (const [productId, data] of productUpdates) {
    try {
      await client.mutation("migration:updateProductImages", {
        productId: data.productId,
        imageUpdates: data.imageUpdates,
      });
      success++;
    } catch (error) {
      failed.push({ productId, error: error.message });
    }
    progressBar.increment();
  }
  
  progressBar.stop();
  
  console.log(`\n✅ Updated: ${success} products`);
  
  if (failed.length > 0) {
    console.log(`⚠️  Failed: ${failed.length} products`);
    await fs.writeJson("./failed_updates.json", failed, { spaces: 2 });
    console.log("   See failed_updates.json for details");
  }
  
  // Verify
  console.log("\n🔍 Verifying migration...");
  try {
    const stats = await client.query("migration:getShopifyImageCount", {});
    console.log(`\n   Total Images: ${stats.totalImages}`);
    console.log(`   Shopify CDN: ${stats.shopifyImages}`);
    console.log(`   Migrated: ${stats.migratedImages}`);
    console.log(`   Progress: ${stats.percentMigrated}%`);
    
    if (stats.shopifyImages === 0) {
      console.log("\n🎉 ALL IMAGES MIGRATED SUCCESSFULLY!");
    } else {
      console.log(`\n⚠️  ${stats.shopifyImages} images still on Shopify CDN`);
    }
  } catch (e) {
    console.log("   Could not verify. Check manually.");
  }
  
  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║                    ✅ UPDATE COMPLETE!                      ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");
}

main().catch(console.error);
