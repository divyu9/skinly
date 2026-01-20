import { v } from "convex/values";
import { action, internalAction } from "./_generated/server";
import { AwsClient } from "aws4fetch";

// Helper to get R2 credentials - must be called inside handler
function getR2Config() {
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const accountId = process.env.R2_ACCOUNT_ID;
  const bucketName = process.env.R2_BUCKET_NAME || "skinly";
  const publicDomain = process.env.R2_PUBLIC_DOMAIN || "https://pub-db30b224c5eb4a378f7b3fd8fd5f2272.r2.dev";

  if (!accessKeyId || !secretAccessKey || !accountId) {
    throw new Error(`R2 credentials not configured. accessKeyId=${!!accessKeyId}, secretAccessKey=${!!secretAccessKey}, accountId=${!!accountId}`);
  }

  const client = new AwsClient({
    accessKeyId,
    secretAccessKey,
    service: "s3",
    region: "auto",
  });

  return { client, accountId, bucketName, publicDomain };
}

/**
 * Upload file to Cloudflare R2
 * Expects base64 encoded file
 */
export const uploadToR2 = action({
  args: {
    fileBase64: v.string(), // Base64 encoded file
    key: v.string(), // Desired file path/key (e.g. "mockups/brand/model/sku.webp")
    contentType: v.string(), // e.g. "image/webp"
  },
  handler: async (_ctx, args) => {
    try {
      const { client, accountId, bucketName, publicDomain } = getR2Config();

      // Convert base64 to ArrayBuffer
      // Format is usually "data:image/webp;base64,..." or just raw base64
      let base64Data = args.fileBase64;
      if (base64Data.includes(",")) {
        base64Data = base64Data.split(",")[1];
      }

      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Upload to R2 using S3 API
      // Endpoint: https://<ACCOUNT_ID>.r2.cloudflarestorage.com/<BUCKET_NAME>/<KEY>
      const endpoint = `https://${accountId}.r2.cloudflarestorage.com/${bucketName}/${args.key}`;

      const response = await client.fetch(endpoint, {
        method: "PUT",
        headers: {
          "Content-Type": args.contentType,
          "Content-Length": bytes.length.toString(),
        },
        body: bytes,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`R2 upload failed: ${response.status} ${errorText}`);
      }

      // Construct public URL
      // If R2_PUBLIC_DOMAIN is set (e.g. cdn.hercules.app), use it
      // Otherwise use the worker/bucket URL
      const publicUrl = `${publicDomain}/${args.key}`;

      return {
        success: true,
        url: publicUrl,
        key: args.key,
        bucket: bucketName
      };
    } catch (error) {
      console.error("R2 upload error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown R2 upload error"
      };
    }
  },
});

/**
 * Delete file from R2
 */
export const deleteFromR2 = internalAction({
  args: {
    key: v.string(),
  },
  handler: async (_ctx, args) => {
    try {
      const { client, accountId, bucketName } = getR2Config();

      const endpoint = `https://${accountId}.r2.cloudflarestorage.com/${bucketName}/${args.key}`;

      const response = await client.fetch(endpoint, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error(`R2 delete failed: ${response.status}`);
      }

      return { success: true };
    } catch (error) {
      console.error("R2 delete error:", error);
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  },
});
