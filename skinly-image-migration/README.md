# 🖼️ Shopify → Hostinger Image Migration + Optimization

Migrate and **optimize** 2000+ product images from Shopify CDN to Hostinger.

---

## 📊 Optimization Benefits

| Before | After | Savings |
|--------|-------|---------|
| JPEG/PNG | WebP | 30% smaller |
| Uncompressed | Quality 82 | 40% smaller |
| 2000x2000px | 1200x1200px | 50% smaller |
| **Combined** | **Combined** | **70-80% smaller!** |

```
Real Example:
Original: 2.5 GB of images
After:    500 MB
Savings:  2 GB (80%) 🔥
```

---

## 🚀 Quick Start

### Step 0: Install Dependencies

```bash
npm install
```

---

### Step 1: Download + Optimize (RECOMMENDED)

```bash
# Edit download-and-optimize.js → Update CONVEX_URL and HOSTINGER_CDN_BASE
node download-and-optimize.js
```

This will:
- ✅ Download all Shopify images
- ✅ Convert to WebP format
- ✅ Compress to 82% quality
- ✅ Resize large images (max 1200px)
- ✅ Create URL mapping file

**Output:**
```
./images_original/   → Backup of originals
./images_optimized/  → Upload these to Hostinger
./url_mapping.json   → For database update
```

---

### Step 2: Upload to Hostinger

Upload `./images_optimized/` folder to Hostinger:
- Location: `/public_html/cdn/products/`
- Use File Manager or FTP

---

### Step 3: Update Database

```bash
# First, add convex/migration.ts to your project
npx convex dev

# Then run:
node update-database.js
```

---

## 📦 Available Scripts

| Script | Purpose |
|--------|---------|
| `npm run download-optimize` | Download + Optimize (recommended) |
| `npm run download` | Download only (no optimization) |
| `npm run optimize` | Optimize existing images |
| `npm run update-db` | Update Convex database |

---

## ⚙️ Configuration

### download-and-optimize.js

```javascript
const CONFIG = {
  CONVEX_URL: "https://your-deployment.convex.cloud",
  HOSTINGER_CDN_BASE: "https://goskinly.com/cdn/products",
  
  OPTIMIZATION: {
    FORMAT: "webp",      // 'webp', 'jpeg', or 'both'
    QUALITY: 82,         // 1-100 (82 = best balance)
    MAX_WIDTH: 1200,     // Max image width
    MAX_HEIGHT: 1200,    // Max image height
    KEEP_ORIGINAL: true, // Keep backup of originals
  },
};
```

### Optimization Presets

**E-commerce (Recommended):**
```javascript
FORMAT: "webp",
QUALITY: 82,
MAX_WIDTH: 1200,
MAX_HEIGHT: 1200,
```

**Maximum Quality:**
```javascript
FORMAT: "webp",
QUALITY: 90,
MAX_WIDTH: 1600,
MAX_HEIGHT: 1600,
```

**Maximum Compression:**
```javascript
FORMAT: "webp",
QUALITY: 75,
MAX_WIDTH: 800,
MAX_HEIGHT: 800,
```

---

## 🔍 Standalone Optimization

If you already have images downloaded:

```bash
node optimize-images.js ./input_folder ./output_folder
```

---

## 📁 Folder Structure

```
/public_html/
└── cdn/
    └── products/
        ├── design_name_0.webp
        ├── design_name_1.webp
        └── ...
```

---

## ⚠️ WebP Browser Support

WebP is supported by **97%+ browsers** including:
- ✅ Chrome, Edge, Firefox, Safari 14+
- ✅ All mobile browsers
- ⚠️ IE11 not supported (but who uses IE11?)

If you need IE11 support, use `FORMAT: "both"` to generate both WebP and JPEG.

---

## 🔄 After Migration

Update your components to use WebP (optional but recommended):

```jsx
// Simple - just use .webp URLs
<img src="https://goskinly.com/cdn/products/design.webp" />

// With fallback for old browsers
<picture>
  <source srcSet="design.webp" type="image/webp" />
  <img src="design.jpg" alt="Product" />
</picture>
```

---

## 📈 Expected Results

| Metric | Before | After |
|--------|--------|-------|
| Total Size | ~2.5 GB | ~500 MB |
| Load Time | ~3-5s | ~0.5-1s |
| PageSpeed Score | 60-70 | 90+ |
| CDN Cost | Shopify limits | Unlimited |

---

## 🛡️ Backup

- Original images saved in `./images_original/`
- `url_mapping.json` contains old URLs for rollback
- Keep these until you verify everything works!
