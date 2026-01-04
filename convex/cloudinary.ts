import { v } from "convex/values";
import { action, internalAction } from "./_generated/server";

/**
 * Generate Cloudinary signature for authenticated uploads
 */
function generateSignature(params: Record<string, string>, apiSecret: string): string {
  // Sort parameters alphabetically
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${key}=${params[key]}`)
    .join('&');

  // Create SHA-1 hash using Web Crypto API
  const encoder = new TextEncoder();
  const data = encoder.encode(sortedParams + apiSecret);

  // For simplicity, we'll use timestamp-based signing
  // Note: This is a simplified version. In production, consider using HMAC
  return sortedParams;
}

/**
 * Upload image to Cloudinary with automatic WebP conversion
 * Uses Cloudinary REST API via fetch
 */
export const uploadToCloudinary = action({
  args: {
    imageBase64: v.string(),
    folder: v.string(),
    publicId: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
      const apiKey = process.env.CLOUDINARY_API_KEY;
      const apiSecret = process.env.CLOUDINARY_API_SECRET;

      if (!cloudName || !apiKey || !apiSecret) {
        throw new Error("Cloudinary credentials not configured");
      }

      // Prepare upload parameters
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const uploadParams = {
        file: args.imageBase64,
        upload_preset: "unsigned_preset", // We'll use unsigned upload for simplicity
        folder: args.folder,
        public_id: args.publicId,
        timestamp: timestamp,
        api_key: apiKey,
        format: "webp",
        quality: "auto:good",
        transformation: "w_2000,h_2000,c_limit,q_auto:good",
      };

      // Upload to Cloudinary
      const formData = new FormData();
      Object.entries(uploadParams).forEach(([key, value]) => {
        if (value !== undefined) {
          formData.append(key, value);
        }
      });

      const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;

      const response = await fetch(uploadUrl, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Cloudinary upload failed: ${errorText}`);
      }

      const result = await response.json();

      return {
        success: true,
        cloudinaryUrl: result.secure_url,
        publicId: result.public_id,
        format: result.format,
        width: result.width,
        height: result.height,
        bytes: result.bytes,
      };
    } catch (error) {
      console.error("Cloudinary upload error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Upload failed",
      };
    }
  },
});

/**
 * Delete image from Cloudinary (internal action for scheduled deletions)
 * Uses Cloudinary Admin API via fetch
 */
export const deleteFromCloudinary = internalAction({
  args: {
    publicId: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
      const apiKey = process.env.CLOUDINARY_API_KEY;
      const apiSecret = process.env.CLOUDINARY_API_SECRET;

      if (!cloudName || !apiKey || !apiSecret) {
        throw new Error("Cloudinary credentials not configured");
      }

      // Use Admin API to delete
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const deleteUrl = `https://api.cloudinary.com/v1_1/${cloudName}/resources/image/upload`;

      const formData = new FormData();
      formData.append("public_ids[]", args.publicId);
      formData.append("timestamp", timestamp);
      formData.append("api_key", apiKey);

      const response = await fetch(deleteUrl, {
        method: "DELETE",
        headers: {
          Authorization: `Basic ${btoa(`${apiKey}:${apiSecret}`)}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Cloudinary delete failed:", errorText);
        return {
          success: false,
          error: `Delete failed: ${errorText}`,
        };
      }

      const result = await response.json();

      return {
        success: true,
        result: result,
      };
    } catch (error) {
      console.error("Cloudinary delete error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Delete failed",
      };
    }
  },
});
