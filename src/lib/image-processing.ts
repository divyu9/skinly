
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

/* -------------------------------------------------------------------------- *
 * Upload normalisation
 * -------------------------------------------------------------------------- */

export interface NormalizedUpload {
  /** The bytes to actually store. */
  bytes: Uint8Array;
  /** Truthful Content-Type for those bytes. */
  contentType: string;
  /** Extension matching contentType, no dot. Empty when the format is unknown,
   *  in which case the caller should leave its own key alone. */
  extension: string;
  /** 0 when the payload was never decoded (video, SVG, animation). */
  width: number;
  height: number;
  originalSize: number;
  /** True when the bytes were re-encoded rather than passed through. */
  converted: boolean;
}

interface SniffedFormat {
  mime: string;
  ext: string;
  /** False for anything a canvas would damage: video, vector, animation. */
  rasterizable: boolean;
}

/**
 * Identifies a payload from its leading bytes.
 *
 * The declared Content-Type cannot be trusted here: the media library used to
 * label every upload `image/webp` and name it `.webp` regardless of what was
 * actually sent, which is how five 2 MB PNGs ended up on the homepage wearing
 * WebP filenames. Magic bytes are the only honest source.
 */
function sniffFormat(bytes: Uint8Array): SniffedFormat {
  const ascii = (start: number, len: number) =>
    String.fromCharCode(...bytes.subarray(start, start + len));

  if (bytes[0] === 0x89 && ascii(1, 3) === "PNG") {
    return { mime: "image/png", ext: "png", rasterizable: true };
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { mime: "image/jpeg", ext: "jpg", rasterizable: true };
  }
  if (ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP") {
    // An animated WebP carries an ANIM chunk. Drawing one to a canvas keeps a
    // single frame and silently throws the animation away.
    const animated = ascii(12, 40).includes("ANIM");
    return { mime: "image/webp", ext: "webp", rasterizable: !animated };
  }
  if (ascii(0, 3) === "GIF") {
    // Always treated as animated: a canvas cannot round-trip one safely.
    return { mime: "image/gif", ext: "gif", rasterizable: false };
  }
  if (ascii(4, 4) === "ftyp") {
    const brand = ascii(8, 4);
    if (brand.startsWith("avif")) return { mime: "image/avif", ext: "avif", rasterizable: true };
    if (brand.startsWith("heic") || brand.startsWith("heix") || brand.startsWith("mif1")) {
      return { mime: "image/heic", ext: "heic", rasterizable: true };
    }
    if (brand.startsWith("qt")) return { mime: "video/quicktime", ext: "mov", rasterizable: false };
    return { mime: "video/mp4", ext: "mp4", rasterizable: false };
  }
  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) {
    return { mime: "video/webm", ext: "webm", rasterizable: false };
  }
  if (ascii(0, 5) === "<?xml" || ascii(0, 4) === "<svg") {
    return { mime: "image/svg+xml", ext: "svg", rasterizable: false };
  }
  // Unrecognised. An empty extension tells the caller to keep its own, which is
  // a better guess than anything invented from bytes we could not identify.
  return { mime: "", ext: "", rasterizable: false };
}

function base64ToBytes(base64: string): Uint8Array {
  const clean = base64.includes(",") ? base64.slice(base64.indexOf(",") + 1) : base64;
  const binary = atob(clean);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

async function decode(blob: Blob): Promise<ImageBitmap | HTMLImageElement> {
  try {
    // `from-image` applies EXIF orientation, so photos straight off a phone do
    // not come out sideways.
    return await createImageBitmap(blob, { imageOrientation: "from-image" });
  } catch {
    return await new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(blob);
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Could not decode image"));
      };
      img.src = url;
    });
  }
}

/**
 * Re-encodes an upload as WebP and reports what the bytes really are.
 *
 * Everything that reaches R2 goes through here, so the guarantee is narrow but
 * absolute: the returned contentType and extension always describe the returned
 * bytes. Payloads a canvas would damage — video, SVG, animated GIF/WebP — are
 * passed through untouched, but still get their real type back.
 *
 * A WebP that is already within `maxDimension` is passed through rather than
 * re-encoded; generation loss on an already-compressed file buys nothing, and
 * the mockup pipeline converts before it calls us.
 */
export async function normalizeImageForUpload(
  base64: string,
  declaredContentType?: string,
  options: { quality?: number; maxDimension?: number } = {}
): Promise<NormalizedUpload> {
  const { quality = 0.85, maxDimension = 2400 } = options;

  const original = base64ToBytes(base64);
  const format = sniffFormat(original);
  const passthrough = (): NormalizedUpload => ({
    bytes: original,
    // Fall back to whatever the caller claimed only when sniffing found nothing.
    contentType: format.mime || declaredContentType || "application/octet-stream",
    extension: format.ext,
    width: 0,
    height: 0,
    originalSize: original.byteLength,
    converted: false,
  });

  if (!format.rasterizable) return passthrough();

  try {
    const source = await decode(new Blob([original as BlobPart], { type: format.mime }));
    const sourceWidth = source.width;
    const sourceHeight = source.height;
    const scale = Math.min(1, maxDimension / Math.max(sourceWidth, sourceHeight));

    if (format.mime === "image/webp" && scale === 1) {
      if ("close" in source) source.close();
      return { ...passthrough(), width: sourceWidth, height: sourceHeight };
    }

    const width = Math.round(sourceWidth * scale);
    const height = Math.round(sourceHeight * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No 2D context");
    // Left transparent on purpose — logos and mockups rely on their alpha, and
    // WebP carries it.
    ctx.drawImage(source as CanvasImageSource, 0, 0, width, height);
    if ("close" in source) source.close();

    const encoded = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", quality)
    );
    if (!encoded) throw new Error("WebP encoding returned nothing");

    // Re-encoding can lose: a small, already-tight JPEG sometimes grows. Keep
    // whichever is smaller, as long as no resize was needed to fit the cap.
    if (encoded.size >= original.byteLength && scale === 1) {
      return { ...passthrough(), width: sourceWidth, height: sourceHeight };
    }

    return {
      bytes: new Uint8Array(await encoded.arrayBuffer()),
      contentType: "image/webp",
      extension: "webp",
      width,
      height,
      originalSize: original.byteLength,
      converted: true,
    };
  } catch (error) {
    // A failed conversion must not fail the upload; store the original, just
    // labelled honestly.
    console.warn("WebP conversion skipped, uploading original:", error);
    return passthrough();
  }
}

/** Swaps a key's extension so it matches the bytes being stored. */
export function withExtension(key: string, extension: string): string {
  return key.replace(/\.[^/.]+$/, "") + "." + extension;
}

/**
 * Turns a picture a quarter or half turn, as a data URL.
 *
 * Raw design photos are shot on a phone over a table and land in whatever
 * orientation the phone decided. Which way up the design sits is the one thing
 * the mockup model copies literally, so the admin has to be able to fix it
 * before the photo is sent — and fixing it here, once, beats re-shooting.
 */
export async function rotateImageDataUrl(dataUrl: string, degrees: number): Promise<string> {
  const turns = ((Math.round(degrees / 90) % 4) + 4) % 4;
  if (!turns) return dataUrl;

  const comma = dataUrl.indexOf(",");
  const meta = dataUrl.slice(0, comma);
  const declared = /data:([^;,]+)/.exec(meta)?.[1] || "image/jpeg";
  const bytes = base64ToBytes(dataUrl.slice(comma + 1));
  const source = await decode(new Blob([bytes as BlobPart], { type: declared }));

  const w = "width" in source ? source.width : (source as HTMLImageElement).naturalWidth;
  const h = "height" in source ? source.height : (source as HTMLImageElement).naturalHeight;
  const swap = turns % 2 === 1;

  const canvas = document.createElement("canvas");
  canvas.width = swap ? h : w;
  canvas.height = swap ? w : h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not rotate the image");
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((turns * Math.PI) / 2);
  ctx.drawImage(source as CanvasImageSource, -w / 2, -h / 2);
  if ("close" in source) (source as ImageBitmap).close();

  // WebP out regardless of what came in: this result goes straight to the
  // uploader, which would re-encode it anyway.
  return canvas.toDataURL("image/webp", 0.9);
}
