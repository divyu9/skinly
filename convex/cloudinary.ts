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
      
      // Use the signed preset "webp-auto-convert" as requested
      const uploadParams: Record<string, string> = {
        upload_preset: "webp-auto-convert", 
        folder: args.folder,
        public_id: args.publicId,
        timestamp: timestamp,
        // Remove manual transformations since the preset handles them
        // The preset "webp-auto-convert" handles format and quality
      };

      // Generate signature for signed upload
      // Signature is SHA-1 of sorted parameters + api_secret
      const sortedParams = Object.keys(uploadParams)
        .sort()
        .map(key => `${key}=${uploadParams[key]}`)
        .join('&');
      
      // Use standard crypto API available in Convex runtime
      const signatureInput = sortedParams + apiSecret;
      
      // Since we can't easily use crypto.subtle in all environments or it might be complex,
      // we'll implement a simple SHA1 or use a library if available.
      // However, Convex has built-in crypto support.
      // Let's try to use a simple JS implementation or the web crypto API if available.
      
      // Actually, for signed uploads, we MUST provide a signature.
      // Let's check if we have a SHA1 helper or can use one.
      // Given the constraints, we will assume we can use the `crypto` module or a simple implementation.
      // But wait, the environment might be limited.
      // Let's try to use the `bun` style or `node` style crypto if available, or a pure JS one.
      
      // Re-evaluating: The user's screenshot shows the preset is "Signed".
      // This means we NEED a signature.
      
      // Let's assume we can use a helper function for SHA1 or use `require('crypto')` if node compatible.
      // Convex runs in a V8-like environment.
      
      // Using a simple SHA1 implementation for compatibility
      async function sha1(str: string): Promise<string> {
        const encoder = new TextEncoder();
        const data = encoder.encode(str);
        const hashBuffer = await crypto.subtle.digest('SHA-1', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      }
      
      const signature = await sha1(signatureInput);
      
      // Add api_key and signature to params (they are NOT part of the signature generation)
      const finalParams = {
        ...uploadParams,
        api_key: apiKey,
        signature: signature,
        file: args.imageBase64,
      };

      // Upload to Cloudinary
      const formData = new FormData();
      Object.entries(finalParams).forEach(([key, value]) => {
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
