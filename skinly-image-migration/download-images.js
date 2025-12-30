/**
 * SIMPLE IMAGE MIGRATION - Step 1: Download Only
 * 
 * This script downloads all Shopify images to a local folder.
 * Then you can manually upload them to Hostinger via File Manager.
 * 
 * SETUP:
 * 1. npm install convex node-fetch fs-extra cli-progress
 * 2. Update CONVEX_URL below
 * 3. Run: node download-images.js
 */

const { ConvexHttpClient } = require("convex/browser");
const fetch = require("node-fetch");
const fs = require("fs-extra");
const path = require("path");
const cliProgress = require("cli-progress");

// ============================================
// UPDATE THIS WITH YOUR CONVEX URL
// ============================================
const CONVEX_URL = "https://your-deployment.convex.cloud";
const OUTPUT_FOLDER = "./shopify_images";
const HOSTINGER_CDN_BASE = "https://goskinly.com/cdn/products"; // Your final CDN URL

// ============================================
// MAIN SCRIPT
// ============================================
async function main() {
  console.log("\n🚀 SKINLY IMAGE DOWNLOADER\n");
  console.log("This script will:");
  console.log("1. Find all Shopify CDN images in your database");
  console.log("2. Download them to a local folder");
  console.log("3. Create a URL mapping file for database update\n");

  const client = new ConvexHttpClient(CONVEX_URL);

  // Step 1: Get all products
  console.log("📦 Fetching products from Convex...");
  
  let products;
  try {
    // Try different API methods based on your setup
    products = await client.query("products:getAllProducts", {});
  } catch (e) {
    try {
      products = await client.query("products:list", {});
    } catch (e2) {
      console.error("❌ Could not fetch products. Check your API method name.");
      console.log("   Try updating the query name in this script.");
      return;
    }
  }

  console.log(`   Found ${products.length} products\n`);

  // Step 2: Extract Shopify URLs
  console.log("🔍 Finding Shopify CDN images...");
  
  const imageMap = []; // { productId, imageIndex, oldUrl, newFilename, newUrl }
  let imageCounter = 0;
  
  for (const product of products) {
    if (product.images && Array.isArray(product.images)) {
      product.images.forEach((img, index) => {
        if (img.url && img.url.includes("cdn.shopify.com")) {
          const ext = getExtension(img.url);
          const filename = `${sanitizeFilename(product.slug || product._id)}_${index}${ext}`;
          
          imageMap.push({
            productId: product._id,
            productSlug: product.slug,
            imageIndex: index,
            oldUrl: img.url,
            newFilename: filename,
            newUrl: `${HOSTINGER_CDN_BASE}/${filename}`,
            alt: img.alt || "",
          });
          imageCounter++;
        }
      });
    }
  }

  console.log(`   Found ${imageCounter} Shopify images to migrate\n`);

  if (imageCounter === 0) {
    console.log("✅ No Shopify images found! Nothing to migrate.");
    return;
  }

  // Step 3: Download images
  console.log("⬇️  Downloading images...\n");
  
  await fs.ensureDir(OUTPUT_FOLDER);
  
  const progressBar = new cliProgress.SingleBar({
    format: '   Progress |{bar}| {percentage}% | {value}/{total}',
    barCompleteChar: '█',
    barIncompleteChar: '░',
  });
  progressBar.start(imageMap.length, 0);
  
  let downloaded = 0;
  let failed = [];
  
  // Download in batches of 5
  for (let i = 0; i < imageMap.length; i += 5) {
    const batch = imageMap.slice(i, i + 5);
    
    await Promise.all(batch.map(async (item) => {
      try {
        const response = await fetch(item.oldUrl);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const buffer = await response.buffer();
        await fs.writeFile(path.join(OUTPUT_FOLDER, item.newFilename), buffer);
        downloaded++;
      } catch (error) {
        failed.push({ ...item, error: error.message });
      }
      progressBar.increment();
    }));
  }
  
  progressBar.stop();
  
  console.log(`\n   ✅ Downloaded: ${downloaded} images`);
  console.log(`   📁 Saved to: ${path.resolve(OUTPUT_FOLDER)}`);
  
  if (failed.length > 0) {
    console.log(`   ⚠️  Failed: ${failed.length} images`);
    await fs.writeJson("./failed_downloads.json", failed, { spaces: 2 });
  }

  // Step 4: Create mapping files
  console.log("\n📄 Creating mapping files...");
  
  // Full mapping for reference
  await fs.writeJson("./url_mapping.json", imageMap, { spaces: 2 });
  console.log("   ✅ url_mapping.json - Full mapping data");
  
  // Simple old → new URL mapping
  const simpleMapping = {};
  imageMap.forEach(item => {
    simpleMapping[item.oldUrl] = item.newUrl;
  });
  await fs.writeJson("./url_simple_mapping.json", simpleMapping, { spaces: 2 });
  console.log("   ✅ url_simple_mapping.json - Simple URL replacement map");
  
  // Generate SQL-like update statements for manual update
  const updateStatements = imageMap.map(item => 
    `UPDATE product ${item.productId} image[${item.imageIndex}] SET url = "${item.newUrl}"`
  );
  await fs.writeFile("./update_statements.txt", updateStatements.join("\n"));
  console.log("   ✅ update_statements.txt - Update reference");

  // Summary
  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║                    ✅ DOWNLOAD COMPLETE!                    ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  console.log("\n📋 NEXT STEPS:\n");
  console.log("1. Upload the ./shopify_images folder to Hostinger:");
  console.log(`   → Location: /public_html/cdn/products/`);
  console.log("   → Use Hostinger File Manager or FTP\n");
  console.log("2. Run the database update script:");
  console.log("   → node update-database.js\n");
  console.log("3. Verify images are loading from new URLs\n");
}

// Helper functions
function getExtension(url) {
  try {
    const pathname = new URL(url).pathname;
    const ext = path.extname(pathname).split("?")[0];
    return ext || ".jpg";
  } catch {
    return ".jpg";
  }
}

function sanitizeFilename(name) {
  return (name || "image")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "_")
    .slice(0, 40);
}

main().catch(console.error);
