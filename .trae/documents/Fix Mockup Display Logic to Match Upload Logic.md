I will fix the mockup display issues by standardizing SKU extraction and optimizing the batch fetch mechanism.

### **1. Standardize SKU Extraction**
*   **Problem**: `useProductsData.ts` (listing page) currently reads `product.variants[0].sku` directly. This is brittle because SKUs in the database might have legacy prefixes (e.g., `Phone-M-174` instead of `M-174`).
*   **Solution**: I will update `useProductsData.ts` to import and use the robust `extractSKU` helper from `src/lib/mockups.ts`. This ensures the listing page extracts SKUs exactly like the PDP does (e.g., reliably parsing `M-174` from `Phone-M-174`).

### **2. Optimize Batch Fetch Query**
*   **Problem**: The backend `getBatchMockups` query has a hard limit of 100 documents. If you have 150 mockups for a model (e.g., "Nothing 3A"), and the products visible on the page correspond to mockups 101-150, the batch query will simply miss them because it cuts off after the first 100 matches in the index.
*   **Solution**: I will modify `convex/mockups.ts` to remove the arbitrary limit or implement a smarter loop that ensures all requested SKUs are searched for. Since the input is a list of specific SKUs (max 30 per page), we can efficiently query for *exactly those* SKUs instead of "first 100 for this model".

### **3. Fix Viewport Tracking**
*   **Problem**: The listing page has a `viewportStart` state intended to trigger batch fetches as you scroll, but the mechanism to update it (`updateViewport`) isn't actually connected to the product grid.
*   **Solution**: I will pass `updateViewport` from `useProductsData` down to the `ProductGrid` component and attach it to an intersection observer, ensuring that as users scroll, new batches of mockups are fetched automatically.

### **Verification Plan**
*   **Step 1**: Verify `extractSKU` is correctly cleaning SKUs on the listing page.
*   **Step 2**: Verify `getBatchMockups` returns results for products deep in the catalog (beyond the first 100).
*   **Step 3**: Verify scrolling on the products page triggers new network requests for mockups.
