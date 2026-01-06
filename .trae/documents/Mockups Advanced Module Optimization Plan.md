I will implement the requested modifications and optimizations for the `/mockups-advanced` module.

### Backend Changes (`convex/mockupsAdvanced.ts`)
1.  **Add `deleteMockupsBySKU` mutation**: This will accept a `sku` string, find all mockups with that SKU across all models, delete them from Cloudinary and Convex storage, and remove the database records.

### Frontend Changes (`src/pages/admin/mockups-advanced.tsx`)
1.  **Upload Improvements**:
    *   Update `UploadMockupsDialog` to support **folder uploads** by adding `webkitdirectory` and `directory` attributes to the input.
    *   Enhance `parseSKUFromFilename` to explicitly ignore `_B`, `_B1`, `_B2` suffixes to ensure consistent matching.

2.  **Model Card Actions**:
    *   **Add Delete Button**: Add a "Delete All" trash icon button to each `ModelCard`. This will trigger a confirmation dialog and then call the existing `deleteAllMockupsForModel` mutation.
    *   **Enable "View" Button**: Replace the "Coming Soon" toast with a functional `ViewMockupsDialog`.

3.  **New `ViewMockupsDialog`**:
    *   Create a "very intuitive" and beginner-friendly gallery view.
    *   Display all mockups for a selected model in a grid/table.
    *   Show Image preview, SKU, and a "Delete" button for individual mockups.

4.  **Global "Delete by SKU" Feature**:
    *   Add a "Delete by SKU" button to the main toolbar.
    *   Create a dialog allowing users to enter a SKU (e.g., "L-01") and delete it from *all* models instantly.

5.  **Safety & UI**:
    *   Ensure all deletions perform proper cleanup (Cloudinary + DB).
    *   Add confirmation steps for destructive actions.
