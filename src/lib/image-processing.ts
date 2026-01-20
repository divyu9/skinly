/**
 * Converts an image file to WebP format using the browser's Canvas API.
 * This performs client-side compression to reduce upload size and bypass
 * the need for server-side transformations.
 *
 * @param file The original image file
 * @param quality Quality from 0 to 1 (default 0.85)
 * @param timeoutMs Timeout in milliseconds (default 30000 = 30s)
 * @returns Promise resolving to a Blob
 */
export async function convertImageToWebP(file: File, quality = 0.85, timeoutMs = 30000): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    let url: string | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let settled = false;

    const cleanup = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      if (url) {
        URL.revokeObjectURL(url);
        url = null;
      }
    };

    const settle = (error?: Error, result?: Blob) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (error) {
        reject(error);
      } else if (result) {
        resolve(result);
      }
    };

    // Set timeout
    timeoutId = setTimeout(() => {
      settle(new Error(`Image conversion timed out after ${timeoutMs}ms for file: ${file.name}`));
    }, timeoutMs);

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          settle(new Error(`Failed to get canvas context for: ${file.name}`));
          return;
        }

        // Draw image to canvas
        ctx.drawImage(img, 0, 0);

        // Convert to WebP blob
        canvas.toBlob(
          (blob) => {
            if (blob) {
              settle(undefined, blob);
            } else {
              settle(new Error(`Failed to convert to WebP blob: ${file.name}`));
            }
          },
          'image/webp',
          quality
        );
      } catch (error) {
        settle(new Error(`Canvas error for ${file.name}: ${error instanceof Error ? error.message : 'Unknown'}`));
      }
    };

    img.onerror = (event) => {
      const errorMsg = event instanceof ErrorEvent ? event.message : 'Unknown load error';
      settle(new Error(`Failed to load image ${file.name}: ${errorMsg}`));
    };

    // Create object URL and start loading
    try {
      url = URL.createObjectURL(file);
      img.src = url;
    } catch (error) {
      settle(new Error(`Failed to create object URL for ${file.name}: ${error instanceof Error ? error.message : 'Unknown'}`));
    }
  });
}

/**
 * Reads a Blob as a Base64 string
 */
export async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
