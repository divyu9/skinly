I will implement **Client-Side WebP Conversion** with **Concurrency set to 5**.

### **Implementation Steps**

1.  **Create Image Processor**
    *   Create `src/lib/image-processing.ts` to handle high-quality WebP conversion in the browser.

2.  **Upgrade Upload Manager (`mockups-advanced.tsx`)**
    *   **Conversion**: Integrate the WebP converter before upload.
    *   **Concurrency**: Set strictly to **5** parallel uploads.
    *   **Robustness**: Add auto-retry (3 attempts) and explicit error tracking in the UI.
    *   **Cleanup**: Ensure memory is released after each batch.

This will solve the limit issues and get your bulk uploads running smoothly again.
