I have devised a fast and smart migration plan to move your product images from Shopify to Cloudinary.

### **The Plan**

1.  **Create `convex/migrateShopifyImages.ts`**:
    *   This will contain a new Convex Action: `migrateImagesFromShopify`.
    *   **Logic**:
        *   Query all `products` that have images containing `cdn.shopify.com`.
        *   Iterate through each product and its images.
        *   **Fetch & Upload**: For each Shopify URL, it will fetch the image blob and upload it directly to Cloudinary using your existing `uploadToCloudinary` logic.
        *   **Update Database**: Once uploaded, it will patch the product's `images` array with the new `res.cloudinaryUrl`.
        *   **Batching**: It will process products in small batches (e.g., 10 products at a time) to prevent timeouts and ensure reliability.
    *   **Status Tracking**: It will return a summary of how many images were migrated and if any failed.

2.  **Safety & Optimization**:
    *   **Idempotency**: The script will check if an image is already migrated (not a Shopify link) to avoid re-uploading.
    *   **WebP Conversion**: Cloudinary will automatically convert them to WebP (as per your existing config), making your site faster.
    *   **Metadata Preservation**: It will preserve the `alt` text and `phoneModel` tags associated with each image.

3.  **Execution**:
    *   I will provide you with a dashboard component or a simple button in the admin panel (e.g., under "Settings" or a temporary "Migration" page) to trigger this action and view progress.

### **Why this is the "Smart" way:**
*   **Zero Downtime**: Your site stays live.
*   **Direct Transfer**: Images go straight from your backend to Cloudinary.
*   **Future-Proof**: You fully own the assets on your Cloudinary account, allowing you to safely close the Shopify account.

I will now implement the migration action and a simple UI to run it.