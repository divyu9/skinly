/**
 * STANDALONE IMAGE OPTIMIZER
 * 
 * Use this if you already have images downloaded
 * and just want to optimize them.
 * 
 * SETUP:
 * npm install fs-extra cli-progress sharp
 * 
 * USAGE:
 * node optimize-images.js ./input_folder ./output_folder
 */

const fs = require("fs-extra");
const path = require("path");
const cliProgress = require("cli-progress");
const sharp = require("sharp");

// ============================================
// CONFIGURATION
// ============================================
const CONFIG = {
  // Output format: 'webp', 'jpeg', 'png', or 'auto' (same as input)
  FORMAT: "webp",
  
  // Quality (1-100)
  QUALITY: 82,
  
  // Max dimensions
  MAX_WIDTH: 1200,
  MAX_HEIGHT: 1200,
  
  // Supported input formats
  SUPPORTED_FORMATS: [".jpg", ".jpeg", ".png", ".gif", ".webp", ".tiff"],
};

// ============================================
// OPTIMIZE SINGLE IMAGE
// ============================================
async function optimizeImage(inputPath, outputPath) {
  const image = sharp(inputPath);
  const metadata = await image.metadata();
  
  // Calculate dimensions
  let width = metadata.width;
  let height = metadata.height;
  
  if (width > CONFIG.MAX_WIDTH || height > CONFIG.MAX_HEIGHT) {
    const ratio = Math.min(
      CONFIG.MAX_WIDTH / width,
      CONFIG.MAX_HEIGHT / height
    );
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }
  
  // Resize
  let pipeline = image.resize(width, height, {
    fit: "inside",
    withoutEnlargement: true,
  });
  
  // Convert format
  const ext = path.extname(inputPath).toLowerCase();
  const baseName = path.basename(inputPath, ext);
  let outputFilename;
  
  switch (CONFIG.FORMAT) {
    case "webp":
      pipeline = pipeline.webp({ quality: CONFIG.QUALITY });
      outputFilename = `${baseName}.webp`;
      break;
    case "jpeg":
    case "jpg":
      pipeline = pipeline.jpeg({ quality: CONFIG.QUALITY, progressive: true });
      outputFilename = `${baseName}.jpg`;
      break;
    case "png":
      pipeline = pipeline.png({ quality: CONFIG.QUALITY, compressionLevel: 9 });
      outputFilename = `${baseName}.png`;
      break;
    default:
      // Keep original format
      if (ext === ".png") {
        pipeline = pipeline.png({ quality: CONFIG.QUALITY });
      } else if (ext === ".webp") {
        pipeline = pipeline.webp({ quality: CONFIG.QUALITY });
      } else {
        pipeline = pipeline.jpeg({ quality: CONFIG.QUALITY, progressive: true });
      }
      outputFilename = `${baseName}${ext}`;
  }
  
  const finalPath = path.join(outputPath, outputFilename);
  await pipeline.toFile(finalPath);
  
  // Get sizes
  const inputStats = await fs.stat(inputPath);
  const outputStats = await fs.stat(finalPath);
  
  return {
    inputSize: inputStats.size,
    outputSize: outputStats.size,
    saved: inputStats.size - outputStats.size,
    outputFilename,
  };
}

// ============================================
// MAIN
// ============================================
async function main() {
  // Get input/output folders from args
  const args = process.argv.slice(2);
  const inputFolder = args[0] || "./images_original";
  const outputFolder = args[1] || "./images_optimized";
  
  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║              SKINLY IMAGE OPTIMIZER                        ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");
  
  console.log(`📂 Input:  ${path.resolve(inputFolder)}`);
  console.log(`📂 Output: ${path.resolve(outputFolder)}`);
  console.log(`🎨 Format: ${CONFIG.FORMAT.toUpperCase()}`);
  console.log(`📊 Quality: ${CONFIG.QUALITY}%`);
  console.log(`📐 Max Size: ${CONFIG.MAX_WIDTH}x${CONFIG.MAX_HEIGHT}px\n`);
  
  // Check input folder
  if (!await fs.pathExists(inputFolder)) {
    console.error(`❌ Input folder not found: ${inputFolder}`);
    console.log("\nUsage: node optimize-images.js [input_folder] [output_folder]");
    return;
  }
  
  // Create output folder
  await fs.ensureDir(outputFolder);
  
  // Get all images
  const files = await fs.readdir(inputFolder);
  const imageFiles = files.filter(f => 
    CONFIG.SUPPORTED_FORMATS.includes(path.extname(f).toLowerCase())
  );
  
  console.log(`🖼️  Found ${imageFiles.length} images to optimize\n`);
  
  if (imageFiles.length === 0) {
    console.log("No images found!");
    return;
  }
  
  // Progress bar
  const progressBar = new cliProgress.SingleBar({
    format: '   Optimizing |{bar}| {percentage}% | {value}/{total}',
    barCompleteChar: '█',
    barIncompleteChar: '░',
  });
  progressBar.start(imageFiles.length, 0);
  
  let totalInputSize = 0;
  let totalOutputSize = 0;
  let processed = 0;
  let failed = [];
  
  // Process images
  for (const file of imageFiles) {
    try {
      const result = await optimizeImage(
        path.join(inputFolder, file),
        outputFolder
      );
      totalInputSize += result.inputSize;
      totalOutputSize += result.outputSize;
      processed++;
    } catch (error) {
      failed.push({ file, error: error.message });
    }
    progressBar.increment();
  }
  
  progressBar.stop();
  
  // Results
  const savedBytes = totalInputSize - totalOutputSize;
  const savedPercent = totalInputSize > 0 
    ? Math.round((savedBytes / totalInputSize) * 100) 
    : 0;
  
  console.log(`\n📊 Results:`);
  console.log(`   Processed: ${processed} images`);
  console.log(`   Failed: ${failed.length} images`);
  console.log(`\n💾 Size Comparison:`);
  console.log(`   Before: ${formatBytes(totalInputSize)}`);
  console.log(`   After:  ${formatBytes(totalOutputSize)}`);
  console.log(`   Saved:  ${formatBytes(savedBytes)} (${savedPercent}%) 🔥`);
  
  if (failed.length > 0) {
    console.log(`\n⚠️  Failed images:`);
    failed.forEach(f => console.log(`   - ${f.file}: ${f.error}`));
  }
  
  console.log("\n✅ Optimization complete!");
  console.log(`   Optimized images saved to: ${path.resolve(outputFolder)}\n`);
}

function formatBytes(bytes) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

main().catch(console.error);
