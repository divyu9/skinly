I will update the plan to explicitly cover "Explore by Category", "Explore By Brand", and "Explore By Gadget" sections.

**Analysis:**
- **Explore by Category/Gadget**: These sections typically pull images from the `categoryDisplaySettings` table, which has an `imageUrl` field. My plan includes scanning this table.
- **Explore by Brand**: Manual cards for these sections are stored in the `homepageSectionCards` table, which has an `imageUrl` field. My plan includes scanning this table.
- **Dynamic Configs**: Some sections store image URLs directly in their `config` JSON (e.g., `Why Skinly` icons). My plan includes a deep scan of the `homepageSections` config.

### **Revised Plan:**

1.  **Backend - Comprehensive Scanner (`convex/internalMigration.ts`)**:
    *   Add `getHomepageAssetsToMigrate` to scan the following tables for "hercules" URLs:
        *   `categoryDisplaySettings` (`imageUrl`) -> **Covers Explore by Category/Gadget**
        *   `homepageSectionCards` (`imageUrl`) -> **Covers Explore by Brand (manual cards)**
        *   `homepageSections` (Deep scan of `config` JSON) -> **Covers generic section assets**
        *   `heroSlides` (`imageUrl`)
        *   `featureBanners` (`backgroundImage`)
        *   `homepageSettings` (`logoImageUrl`)
    *   Add `updateHomepageAsset` mutation to apply the changes.

2.  **Backend - Migration Action (`convex/migrateShopifyImages.ts`)**:
    *   Add `migrateHomepageAssets` action to orchestrate the upload to Cloudinary and database update.

3.  **Frontend - Admin UI (`src/pages/admin/migration.tsx`)**:
    *   Add a "Homepage Assets" section to the Hercules migration tab with its own progress tracking.

This ensures all database-driven images for these sections are migrated. Note: Any images *hardcoded* in the React components (source code) cannot be changed via database migration and would need a separate code update.