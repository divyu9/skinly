I will update the SKU parsing logic in both the backend and frontend to support SKUs starting with 'A', 'R', 'T' and optional suffixes like '-PH'.

### **1. Update Backend Logic (`convex/mockupsAdvanced.ts`)**
*   **Current Regex**: `/([LMSBF])-(\d+)/i`
*   **New Regex**: `/([LMSBFART])-(\d+)(?:-[A-Z0-9]+)?/i`
*   **Explanation**:
    *   Adds `A`, `R`, `T` to the allowed prefix list.
    *   Adds `(?:-[A-Z0-9]+)?` to allow an optional hyphen followed by alphanumeric characters (e.g., `-PH`).

### **2. Update Frontend Logic (`src/pages/admin/mockups-advanced.tsx`)**
*   Apply the same regex change to the `parseSKUFromFilename` helper function used for client-side file validation and preview.

### **3. Verification**
*   The system will correctly identify filenames like:
    *   `R-123.jpg` (Standard R-number)
    *   `R-123-PH.jpg` (R-number with suffix)
    *   `A-01.png` (A-series)
    *   `T-50.webp` (T-series)
