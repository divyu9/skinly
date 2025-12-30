/**
 * Skinly Image Migration Script
 * Migrates images from Shopify CDN to Hostinger
 * 
 * SETUP:
 * 1. npm install node-fetch fs-extra convex ssh2-sftp-client cli-progress
 * 2. Create .env file with Hostinger FTP credentials
 * 3. Run: node migrate-images.js
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "./convex/_generated/api.js";
import fetch from "node-fetch";
import fs from "fs-extra";
import path from "path";
import SftpClient from "ssh2-sftp-client";
import cliProgress from "cli-progress";

// ============================================
// CONFIGURATION - UPDATE THESE VALUES
// ============================================
const CONFIG = {
  // Convex
  CONVEX_URL: process.env.CONVEX_URL || "https://your-project.convex.cloud",
  
  // Hostinger SFTP/FTP credentials
  HOSTINGER_HOST: process.env.HOSTINGER_HOST || "ftp.yourdomain.com",
  HOSTINGER_USER: process.env.HOSTINGER_USER || "u123456789",
  HOSTINGER_PASSWORD: process.env.HOSTINGER_PASSWORD || "your-password",
  HOSTINGER_PORT: 22, // 22 for SFTP, 21 for FTP
  
  // Remote path on Hostinger (where images will be uploaded)
  REMOTE_PATH: "/public_html/cdn/images/products",
  
  // Your Hostinger domain for new URLs
  CDN_BASE_URL: "https://yourdomain.com/cdn/images/products",
  
  // Local temp folder for downloads
  LOCAL_TEMP: "./temp_images",
  
  // Batch sizes
  DOWNLOAD_BATCH_SIZE: 10, // Parallel downloads
  UPLOAD_BATCH_SIZE: 5,    // Parallel uploads
};

// ============================================
// STEP 1: EXTRACT ALL SHOPIFY URLS FROM CONVEX
// ============================================
async function extractShopifyUrls(client) {
  console.log("\n📦 Step 1: Extracting Shopify URLs from Convex...\n");
  
  const urlMap = {
    products: [],      // { _id, imageIndex, oldUrl }
    homepage: [],      // { _id, field, oldUrl }
    collections: [],   // { _id, imageField, oldUrl }
  };
  
  // Get all products
  const products = await client.query(api.products.getAllProducts, {});
  
  for (const product of products) {
    if (product.images && Array.isArray(product.images)) {
      product.images.forEach((img, index) => {
        if (img.url && img.url.includes("cdn.shopify.com")) {
          urlMap.products.push({
            _id: product._id,
            imageIndex: index,
            oldUrl: img.url,
            alt: img.alt || "",
          });
        }
      });
    }
  }
  
  console.log(`   Found ${urlMap.products.length} Shopify product images`);
  
  // Get homepage sections (if applicable)
  try {
    const homepageSections = await client.query(api.homepage.getActiveHomepageSections, {});
    for (const section of homepageSections) {
      if (section.config) {
        // Check for image URLs in config
        const configStr = JSON.stringify(section.config);
        const shopifyMatches = configStr.match(/https:\/\/cdn\.shopify\.com[^"'\s]*/g);
        if (shopifyMatches) {
          shopifyMatches.forEach(url => {
            urlMap.homepage.push({
              _id: section._id,
              oldUrl: url,
            });
          });
        }
      }
    }
    console.log(`   Found ${urlMap.homepage.length} Shopify homepage images`);
  } catch (e) {
    console.log("   No homepage sections to migrate");
  }
  
  // Get collections (if applicable)
  try {
    const collections = await client.query(api.collections.getAllCollections, {});
    for (const col of collections) {
      if (col.image && col.image.includes("cdn.shopify.com")) {
        urlMap.collections.push({
          _id: col._id,
          oldUrl: col.image,
        });
      }
    }
    console.log(`   Found ${urlMap.collections.length} Shopify collection images`);
  } catch (e) {
    console.log("   No collections to migrate");
  }
  
  const totalImages = urlMap.products.length + urlMap.homepage.length + urlMap.collections.length;
  console.log(`\n   ✅ Total Shopify images found: ${totalImages}`);
  
  // Save URL map for reference
  await fs.writeJson("./url_map.json", urlMap, { spaces: 2 });
  console.log("   📄 Saved URL map to ./url_map.json");
  
  return urlMap;
}

// ============================================
// STEP 2: DOWNLOAD ALL IMAGES
// ============================================
async function downloadImages(urlMap) {
  console.log("\n⬇️  Step 2: Downloading images from Shopify CDN...\n");
  
  // Create temp directory
  await fs.ensureDir(CONFIG.LOCAL_TEMP);
  
  // Collect all unique URLs
  const allUrls = new Map(); // url -> { sources: [...], localPath, newFilename }
  
  // Add product images
  urlMap.products.forEach(item => {
    if (!allUrls.has(item.oldUrl)) {
      const filename = generateFilename(item.oldUrl, allUrls.size);
      allUrls.set(item.oldUrl, {
        sources: [],
        localPath: path.join(CONFIG.LOCAL_TEMP, filename),
        newFilename: filename,
      });
    }
    allUrls.get(item.oldUrl).sources.push({ type: "product", ...item });
  });
  
  // Add homepage images
  urlMap.homepage.forEach(item => {
    if (!allUrls.has(item.oldUrl)) {
      const filename = generateFilename(item.oldUrl, allUrls.size);
      allUrls.set(item.oldUrl, {
        sources: [],
        localPath: path.join(CONFIG.LOCAL_TEMP, filename),
        newFilename: filename,
      });
    }
    allUrls.get(item.oldUrl).sources.push({ type: "homepage", ...item });
  });
  
  // Add collection images
  urlMap.collections.forEach(item => {
    if (!allUrls.has(item.oldUrl)) {
      const filename = generateFilename(item.oldUrl, allUrls.size);
      allUrls.set(item.oldUrl, {
        sources: [],
        localPath: path.join(CONFIG.LOCAL_TEMP, filename),
        newFilename: filename,
      });
    }
    allUrls.get(item.oldUrl).sources.push({ type: "collection", ...item });
  });
  
  console.log(`   Unique images to download: ${allUrls.size}`);
  
  // Progress bar
  const progressBar = new cliProgress.SingleBar({
    format: '   Downloading |{bar}| {percentage}% | {value}/{total} images',
    barCompleteChar: '█',
    barIncompleteChar: '░',
  });
  progressBar.start(allUrls.size, 0);
  
  // Download in batches
  const urlArray = Array.from(allUrls.entries());
  let downloaded = 0;
  let failed = [];
  
  for (let i = 0; i < urlArray.length; i += CONFIG.DOWNLOAD_BATCH_SIZE) {
    const batch = urlArray.slice(i, i + CONFIG.DOWNLOAD_BATCH_SIZE);
    
    await Promise.all(batch.map(async ([url, data]) => {
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const buffer = await response.buffer();
        await fs.writeFile(data.localPath, buffer);
        downloaded++;
      } catch (error) {
        failed.push({ url, error: error.message });
      }
      progressBar.increment();
    }));
  }
  
  progressBar.stop();
  
  console.log(`\n   ✅ Downloaded: ${downloaded} images`);
  if (failed.length > 0) {
    console.log(`   ⚠️  Failed: ${failed.length} images`);
    await fs.writeJson("./failed_downloads.json", failed, { spaces: 2 });
  }
  
  // Save URL mapping with new filenames
  const urlMappingForUpload = {};
  allUrls.forEach((data, url) => {
    urlMappingForUpload[url] = {
      newFilename: data.newFilename,
      newUrl: `${CONFIG.CDN_BASE_URL}/${data.newFilename}`,
      sources: data.sources,
    };
  });
  await fs.writeJson("./url_mapping_complete.json", urlMappingForUpload, { spaces: 2 });
  
  return urlMappingForUpload;
}

// Generate unique filename from Shopify URL
function generateFilename(url, index) {
  try {
    const urlObj = new URL(url);
    const originalName = path.basename(urlObj.pathname);
    // Remove query params and add index for uniqueness
    const ext = path.extname(originalName) || ".jpg";
    const name = path.basename(originalName, ext).slice(0, 50); // Limit length
    return `${name}_${index}${ext}`;
  } catch {
    return `image_${index}.jpg`;
  }
}

// ============================================
// STEP 3: UPLOAD TO HOSTINGER VIA SFTP
// ============================================
async function uploadToHostinger(urlMapping) {
  console.log("\n⬆️  Step 3: Uploading images to Hostinger...\n");
  
  const sftp = new SftpClient();
  
  try {
    // Connect to Hostinger
    console.log("   Connecting to Hostinger SFTP...");
    await sftp.connect({
      host: CONFIG.HOSTINGER_HOST,
      port: CONFIG.HOSTINGER_PORT,
      username: CONFIG.HOSTINGER_USER,
      password: CONFIG.HOSTINGER_PASSWORD,
    });
    console.log("   ✅ Connected!");
    
    // Ensure remote directory exists
    try {
      await sftp.mkdir(CONFIG.REMOTE_PATH, true);
    } catch (e) {
      // Directory might already exist
    }
    
    // Get list of files to upload
    const files = Object.values(urlMapping).map(data => ({
      local: path.join(CONFIG.LOCAL_TEMP, data.newFilename),
      remote: `${CONFIG.REMOTE_PATH}/${data.newFilename}`,
    }));
    
    // Progress bar
    const progressBar = new cliProgress.SingleBar({
      format: '   Uploading |{bar}| {percentage}% | {value}/{total} images',
      barCompleteChar: '█',
      barIncompleteChar: '░',
    });
    progressBar.start(files.length, 0);
    
    // Upload files
    let uploaded = 0;
    let failedUploads = [];
    
    for (const file of files) {
      try {
        if (await fs.pathExists(file.local)) {
          await sftp.put(file.local, file.remote);
          uploaded++;
        }
      } catch (error) {
        failedUploads.push({ file: file.local, error: error.message });
      }
      progressBar.increment();
    }
    
    progressBar.stop();
    
    console.log(`\n   ✅ Uploaded: ${uploaded} images`);
    if (failedUploads.length > 0) {
      console.log(`   ⚠️  Failed: ${failedUploads.length} images`);
      await fs.writeJson("./failed_uploads.json", failedUploads, { spaces: 2 });
    }
    
  } finally {
    await sftp.end();
    console.log("   Disconnected from SFTP");
  }
}

// ============================================
// STEP 4: UPDATE CONVEX DATABASE
// ============================================
async function updateConvexDatabase(client, urlMapping) {
  console.log("\n🔄 Step 4: Updating Convex database with new URLs...\n");
  
  // Group updates by product ID
  const productUpdates = new Map(); // productId -> { images: [...] }
  const homepageUpdates = [];
  const collectionUpdates = [];
  
  Object.entries(urlMapping).forEach(([oldUrl, data]) => {
    data.sources.forEach(source => {
      if (source.type === "product") {
        if (!productUpdates.has(source._id)) {
          productUpdates.set(source._id, { _id: source._id, imageUpdates: [] });
        }
        productUpdates.get(source._id).imageUpdates.push({
          index: source.imageIndex,
          newUrl: data.newUrl,
          alt: source.alt,
        });
      } else if (source.type === "homepage") {
        homepageUpdates.push({
          _id: source._id,
          oldUrl,
          newUrl: data.newUrl,
        });
      } else if (source.type === "collection") {
        collectionUpdates.push({
          _id: source._id,
          newUrl: data.newUrl,
        });
      }
    });
  });
  
  console.log(`   Product updates: ${productUpdates.size}`);
  console.log(`   Homepage updates: ${homepageUpdates.length}`);
  console.log(`   Collection updates: ${collectionUpdates.length}`);
  
  // Progress bar
  const total = productUpdates.size + homepageUpdates.length + collectionUpdates.length;
  const progressBar = new cliProgress.SingleBar({
    format: '   Updating DB |{bar}| {percentage}% | {value}/{total}',
    barCompleteChar: '█',
    barIncompleteChar: '░',
  });
  progressBar.start(total, 0);
  
  let updated = 0;
  let failed = [];
  
  // Update products
  for (const [productId, data] of productUpdates) {
    try {
      await client.mutation(api.migration.updateProductImages, {
        productId: data._id,
        imageUpdates: data.imageUpdates,
      });
      updated++;
    } catch (error) {
      failed.push({ type: "product", id: productId, error: error.message });
    }
    progressBar.increment();
  }
  
  // Update homepage sections
  for (const update of homepageUpdates) {
    try {
      await client.mutation(api.migration.updateHomepageImage, {
        sectionId: update._id,
        oldUrl: update.oldUrl,
        newUrl: update.newUrl,
      });
      updated++;
    } catch (error) {
      failed.push({ type: "homepage", id: update._id, error: error.message });
    }
    progressBar.increment();
  }
  
  // Update collections
  for (const update of collectionUpdates) {
    try {
      await client.mutation(api.migration.updateCollectionImage, {
        collectionId: update._id,
        newUrl: update.newUrl,
      });
      updated++;
    } catch (error) {
      failed.push({ type: "collection", id: update._id, error: error.message });
    }
    progressBar.increment();
  }
  
  progressBar.stop();
  
  console.log(`\n   ✅ Updated: ${updated} records`);
  if (failed.length > 0) {
    console.log(`   ⚠️  Failed: ${failed.length} records`);
    await fs.writeJson("./failed_db_updates.json", failed, { spaces: 2 });
  }
}

// ============================================
// CLEANUP
// ============================================
async function cleanup() {
  console.log("\n🧹 Cleaning up temporary files...");
  await fs.remove(CONFIG.LOCAL_TEMP);
  console.log("   ✅ Done!");
}

// ============================================
// MAIN
// ============================================
async function main() {
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║     SKINLY IMAGE MIGRATION: Shopify → Hostinger            ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  
  const client = new ConvexHttpClient(CONFIG.CONVEX_URL);
  
  try {
    // Step 1: Extract URLs
    const urlMap = await extractShopifyUrls(client);
    
    if (urlMap.products.length === 0 && urlMap.homepage.length === 0 && urlMap.collections.length === 0) {
      console.log("\n✅ No Shopify images found. Nothing to migrate!");
      return;
    }
    
    // Step 2: Download images
    const urlMapping = await downloadImages(urlMap);
    
    // Step 3: Upload to Hostinger
    await uploadToHostinger(urlMapping);
    
    // Step 4: Update database
    await updateConvexDatabase(client, urlMapping);
    
    // Cleanup
    await cleanup();
    
    console.log("\n╔════════════════════════════════════════════════════════════╗");
    console.log("║                    ✅ MIGRATION COMPLETE!                   ║");
    console.log("╚════════════════════════════════════════════════════════════╝");
    console.log("\n📄 Check these files for details:");
    console.log("   - url_mapping_complete.json (old URL → new URL mapping)");
    console.log("   - failed_*.json (any errors)\n");
    
  } catch (error) {
    console.error("\n❌ Migration failed:", error);
    process.exit(1);
  }
}

main();
