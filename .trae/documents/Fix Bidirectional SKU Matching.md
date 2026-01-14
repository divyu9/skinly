I will fix the SKU matching logic to correctly link uploaded images (e.g., `R-01.jpg`) to their corresponding product SKUs in the database, regardless of whether the database SKU has a suffix (e.g., `R-01-PH`) or not.

### **1. Backend Logic Update (`convex/mockupsAdvanced.ts`)**
I will modify `getModelMockupStats` to implement **bidirectional matching**:
*   **Current Logic**: Strips `-PH` from uploaded SKU and checks if it exists in DB. This fails if DB has `R-01-PH` and upload is `R-01`.
*   **New Logic**: 
    *   Iterate through all uploaded SKUs.
    *   For each upload (e.g., `R-01`), check if it matches a DB SKU directly OR if `R-01-PH` exists in the DB.
    *   If a match is found, mark the *DB SKU* (e.g., `R-01-PH`) as "covered".
    *   This ensures that `R-01` upload correctly "checks off" `R-01-PH` from the missing list.

### **2. Frontend Reversion (`src/pages/admin/mockups-advanced.tsx`)**
I will revert the change that stripped `-PH` in `parseSKUFromFilename`.
*   **Reason**: The filename should be parsed "as is". If the file is `R-01-PH.jpg`, we want `R-01-PH`. If it's `R-01.jpg`, we want `R-01`. The backend will handle the flexible matching.

### **Verification**
*   **Case A**: DB has `R-01`, Upload has `R-01`. Match: **Yes**.
*   **Case B**: DB has `R-01-PH`, Upload has `R-01`. Match: **Yes** (New logic handles this).
*   **Case C**: DB has `R-01-PH`, Upload has `R-01-PH`. Match: **Yes**.
*   **Case D**: DB has `R-01`, Upload has `R-01-PH`. Match: **Yes** (Logic handles suffix stripping too).
