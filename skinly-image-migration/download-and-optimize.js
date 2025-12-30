/**
 * SKINLY IMAGE DOWNLOADER + OPTIMIZER
 * 
 * Downloads Shopify images AND optimizes them:
 * - Converts to WebP (30% smaller)
 * - Compresses (quality 82 - visually identical)
 * - Resizes large images (max 1200px)
 * - Keeps aspect ratio
 * 
 * SETUP:
 * npm install convex node-fetch fs-extra cli-progress sharp
 * 
 * USAGE:
 * node download-and-optimize.js
 */

const { ConvexHttpClient } = require("convex/browser");
const fetch = require("node-fetch");
const fs = require("fs-extra");
const path = require("path");
const cliProgress = require("cli-progress");
const sharp = require("sharp");

// ============================================
// CONFIGURATION
// ============================================
const CONFIG = {
  // Your Convex deployment URL
  CONVEX_URL: "https://impartial-kangaroo-784.convex.cloud",
  
  // Your Hostinger CDN base URL
  HOSTINGER_CDN_BASE: "https://goskinly.com/cdn/products",
  
  // Output folders
  OUTPUT_ORIGINAL: "./images_original",  // Original downloads (backup)
  OUTPUT_OPTIMIZED: "./images_optimized", // Optimized for upload
  
  // Optimization settings
  OPTIMIZATION: {
    // Output format: 'webp', 'jpeg', or 'both'
    FORMAT: "webp",
    
    // Quality (1-100) - 82 is sweet spot for quality/size
    QUALITY: 82,
    
    // Max dimensions (maintains aspect ratio)
    MAX_WIDTH: 1200,
    MAX_HEIGHT: 1200,
    
    // Keep original as backup?
    KEEP_ORIGINAL: true,
  },
  
  // Parallel processing
  BATCH_SIZE: 5,
};

// ============================================
// OPTIMIZATION FUNCTION
// ============================================
async function optimizeImage(inputPath, outputPath, filename) {
  try {
    const image = sharp(inputPath);
    const metadata = await image.metadata();
    
    // Calculate new dimensions (maintain aspect ratio)
    let width = metadata.width;
    let height = metadata.height;
    
    if (width > CONFIG.OPTIMIZATION.MAX_WIDTH || height > CONFIG.OPTIMIZATION.MAX_HEIGHT) {
      const ratio = Math.min(
        CONFIG.OPTIMIZATION.MAX_WIDTH / width,
        CONFIG.OPTIMIZATION.MAX_HEIGHT / height
      );
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
    }
    
    // Get output filename with correct extension
    const baseName = path.basename(filename, path.extname(filename));
    
    if (CONFIG.OPTIMIZATION.FORMAT === "webp") {
      // WebP only
      const webpPath = path.join(outputPath, `${baseName}.webp`);
      await image
        .resize(width, height, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: CONFIG.OPTIMIZATION.QUALITY })
        .toFile(webpPath);
      
      return { filename: `${baseName}.webp`, format: "webp" };
      
    } else if (CONFIG.OPTIMIZATION.FORMAT === "jpeg") {
      // JPEG only
      const jpegPath = path.join(outputPath, `${baseName}.jpg`);
      await image
        .resize(width, height, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: CONFIG.OPTIMIZATION.QUALITY, progressive: true })
        .toFile(jpegPath);
      
      return { filename: `${baseName}.jpg`, format: "jpeg" };
      
    } else if (CONFIG.OPTIMIZATION.FORMAT === "both") {
      // Both formats (for <picture> tag fallback)
      const webpPath = path.join(outputPath, `${baseName}.webp`);
      const jpegPath = path.join(outputPath, `${baseName}.jpg`);
      
      await Promise.all([
        image
          .clone()
          .resize(width, height, { fit: "inside", withoutEnlargement: true })
          .webp({ quality: CONFIG.OPTIMIZATION.QUALITY })
          .toFile(webpPath),
        image
          .resize(width, height, { fit: "inside", withoutEnlargement: true })
          .jpeg({ quality: CONFIG.OPTIMIZATION.QUALITY, progressive: true })
          .toFile(jpegPath),
      ]);
      
      return { 
        filename: `${baseName}.webp`, 
        fallback: `${baseName}.jpg`,
        format: "both" 
      };
    }
  } catch (error) {
    throw new Error(`Optimization failed: ${error.message}`);
  }
}

// ============================================
// MAIN SCRIPT
// ============================================
async function main() {
  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║      SKINLY IMAGE DOWNLOADER + OPTIMIZER                   ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");
  
  console.log("📋 Settings:");
  console.log(`   Format: ${CONFIG.OPTIMIZATION.FORMAT.toUpperCase()}`);
  console.log(`   Quality: ${CONFIG.OPTIMIZATION.QUALITY}%`);
  console.log(`   Max Size: ${CONFIG.OPTIMIZATION.MAX_WIDTH}x${CONFIG.OPTIMIZATION.MAX_HEIGHT}px\n`);

  const client = new ConvexHttpClient(CONFIG.CONVEX_URL);

  // Step 1: Get all products
  console.log("📦 Fetching products from Convex...");
  
  let products;
  try {
    products = await client.query("products:getAllProducts", {});
  } catch (e) {
    try {
      products = await client.query("products:list", {});
    } catch (e2) {
      console.error("❌ Could not fetch products. Update API method name.");
      return;
    }
  }

  console.log(`   Found ${products.length} products\n`);

  // Step 2: Extract Shopify URLs
  console.log("🔍 Finding Shopify CDN images...");
  
  const imageMap = [];
  let imageCounter = 0;
  
  for (const product of products) {
    if (product.images && Array.isArray(product.images)) {
      product.images.forEach((img, index) => {
        if (img.url && img.url.includes("cdn.shopify.com")) {
          const baseName = sanitizeFilename(product.slug || product._id);
          const originalFilename = `${baseName}_${index}${getExtension(img.url)}`;
          
          // WebP filename for optimized version
          const optimizedFilename = CONFIG.OPTIMIZATION.FORMAT === "jpeg" 
            ? `${baseName}_${index}.jpg`
            : `${baseName}_${index}.webp`;
          
          imageMap.push({
            productId: product._id,
            productSlug: product.slug,
            imageIndex: index,
            oldUrl: img.url,
            originalFilename,
            optimizedFilename,
            newUrl: `${CONFIG.HOSTINGER_CDN_BASE}/${optimizedFilename}`,
            alt: img.alt || "",
          });
          imageCounter++;
        }
      });
    }
  }

  console.log(`   Found ${imageCounter} Shopify images\n`);

  if (imageCounter === 0) {
    console.log("✅ No Shopify images found!");
    return;
  }

  // Create directories
  await fs.ensureDir(CONFIG.OUTPUT_ORIGINAL);
  await fs.ensureDir(CONFIG.OUTPUT_OPTIMIZED);

  // Step 3: Download and optimize
  console.log("⬇️  Downloading and optimizing images...\n");
  
  const progressBar = new cliProgress.SingleBar({
    format: '   Progress |{bar}| {percentage}% | {value}/{total} | {status}',
    barCompleteChar: '█',
    barIncompleteChar: '░',
  });
  progressBar.start(imageMap.length, 0, { status: 'Starting...' });
  
  let downloaded = 0;
  let optimized = 0;
  let failed = [];
  let totalOriginalSize = 0;
  let totalOptimizedSize = 0;
  
  // Process in batches
  for (let i = 0; i < imageMap.length; i += CONFIG.BATCH_SIZE) {
    const batch = imageMap.slice(i, i + CONFIG.BATCH_SIZE);
    
    await Promise.all(batch.map(async (item) => {
      const originalPath = path.join(CONFIG.OUTPUT_ORIGINAL, item.originalFilename);
      
      try {
        // Download
        progressBar.update(i, { status: 'Downloading...' });
        const response = await fetch(item.oldUrl);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const buffer = await response.buffer();
        totalOriginalSize += buffer.length;
        
        // Save original
        if (CONFIG.OPTIMIZATION.KEEP_ORIGINAL) {
          await fs.writeFile(originalPath, buffer);
        }
        downloaded++;
        
        // Optimize
        progressBar.update(i, { status: 'Optimizing...' });
        
        // Write buffer to temp file for sharp
        const tempPath = path.join(CONFIG.OUTPUT_ORIGINAL, `temp_${item.originalFilename}`);
        await fs.writeFile(tempPath, buffer);
        
        const result = await optimizeImage(
          tempPath,
          CONFIG.OUTPUT_OPTIMIZED,
          item.originalFilename
        );
        
        // Update item with final filename
        item.optimizedFilename = result.filename;
        item.newUrl = `${CONFIG.HOSTINGER_CDN_BASE}/${result.filename}`;
        
        // Get optimized file size
        const optimizedPath = path.join(CONFIG.OUTPUT_OPTIMIZED, result.filename);
        const optimizedStats = await fs.stat(optimizedPath);
        totalOptimizedSize += optimizedStats.size;
        
        // Clean up temp file
        await fs.remove(tempPath);
        
        optimized++;
        
      } catch (error) {
        failed.push({ ...item, error: error.message });
      }
      
      progressBar.increment({ status: 'Processing...' });
    }));
  }
  
  progressBar.stop();
  
  // Calculate savings
  const savedBytes = totalOriginalSize - totalOptimizedSize;
  const savedPercent = totalOriginalSize > 0 
    ? Math.round((savedBytes / totalOriginalSize) * 100) 
    : 0;
  
  console.log(`\n📊 Results:`);
  console.log(`   Downloaded: ${downloaded} images`);
  console.log(`   Optimized: ${optimized} images`);
  console.log(`   Failed: ${failed.length} images`);
  console.log(`\n💾 Size Comparison:`);
  console.log(`   Original:  ${formatBytes(totalOriginalSize)}`);
  console.log(`   Optimized: ${formatBytes(totalOptimizedSize)}`);
  console.log(`   Saved:     ${formatBytes(savedBytes)} (${savedPercent}%) 🔥`);
  
  if (failed.length > 0) {
    await fs.writeJson("./failed_images.json", failed, { spaces: 2 });
    console.log(`\n   ⚠️  See failed_images.json for errors`);
  }

  // Step 4: Create mapping files
  console.log("\n📄 Creating mapping files...");
  
  // Full mapping
  await fs.writeJson("./url_mapping.json", imageMap, { spaces: 2 });
  console.log("   ✅ url_mapping.json");
  
  // Simple mapping
  const simpleMapping = {};
  imageMap.forEach(item => {
    simpleMapping[item.oldUrl] = item.newUrl;
  });
  await fs.writeJson("./url_simple_mapping.json", simpleMapping, { spaces: 2 });
  console.log("   ✅ url_simple_mapping.json");

  // Summary
  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║                    ✅ OPTIMIZATION COMPLETE!               ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  console.log("\n📋 NEXT STEPS:\n");
  console.log(`1. Upload ./images_optimized/ folder to Hostinger:`);
  console.log(`   Location: /public_html/cdn/products/\n`);
  console.log(`2. Run database update:`);
  console.log(`   node update-database.js\n`);
  console.log(`3. Verify images on your website\n`);
  
  console.log(`💡 TIP: Your images are now ${savedPercent}% smaller!`);
  console.log(`   This means faster page loads and better SEO.\n`);
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

function formatBytes(bytes) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

main().catch(console.error);
