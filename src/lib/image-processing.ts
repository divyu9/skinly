
/**
 * Converts an image file to WebP format using the browser's Canvas API.
 * This performs client-side compression to reduce upload size and bypass
 * the need for server-side transformations.
 * 
 * @param file The original image file
 * @param quality Quality from 0 to 1 (default 0.85)
 * @returns Promise resolving to a Blob
 */
export async function convertImageToWebP(file: File, quality = 0.85): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error("Failed to get canvas context"));
        return;
      }
      
      // Draw image to canvas
      ctx.drawImage(img, 0, 0);
      
      // Convert to WebP blob
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error("Failed to convert image to WebP"));
          }
        },
        'image/webp',
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image for conversion"));
    };

    img.src = url;
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
