import { onCall, HttpsError } from "firebase-functions/v1/https";
import { S3Client, PutObjectCommand, PutBucketCorsCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { requireAdmin } from "./auth";
import { enforceDailyRateLimit } from "./rate-limit";

const getR2Config = () => {
  const accountId = process.env.R2_ACCOUNT_ID || "";
  const accessKeyId = process.env.R2_ACCESS_KEY_ID || "";
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || "";
  const bucketName = process.env.R2_BUCKET_NAME || "skinly";
  const publicUrl = process.env.R2_PUBLIC_URL || "https://cdn.goskinly.com";

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new HttpsError("failed-precondition", "R2 credentials are not configured");
  }

  return { accountId, accessKeyId, secretAccessKey, bucketName, publicUrl };
};

const getAllowedOrigins = () => {
  const env = process.env.R2_ALLOWED_ORIGINS;
  const origins = (env ? env.split(",") : ["https://goskinly.com", "https://www.goskinly.com"])
    .map((s) => s.trim())
    .filter(Boolean);

  if (process.env.NODE_ENV !== "production") {
    origins.push("http://localhost:5173", "http://localhost:4173");
  }

  return Array.from(new Set(origins));
};

// Validates the shape of the object key rather than listing folders. The old
// fixed prefix list rejected the folders actually in use ("banners",
// "media-library") and every new folder an admin creates, and it also rejected
// mockup keys, which contain spaces (mockups/Apple/iPhone 17 Pro Max/M-1.webp).
// Callers are already admin-only and rate limited; what matters here is that a
// key cannot escape the bucket layout or land at its root.
const validateKey = (key: string) => {
  if (!key) throw new HttpsError("invalid-argument", "Missing fileName");
  if (key.length > 512) throw new HttpsError("invalid-argument", "fileName is too long");
  if (key.startsWith("/") || key.endsWith("/")) throw new HttpsError("invalid-argument", "fileName must not start or end with /");
  if (!/^[a-zA-Z0-9 /_\-.()]+$/.test(key)) throw new HttpsError("invalid-argument", "fileName has unsupported characters");

  const segments = key.split("/");
  if (segments.length < 2) throw new HttpsError("invalid-argument", "fileName must include a folder");
  if (segments.some((s) => s === "" || s === "." || s === "..")) {
    throw new HttpsError("invalid-argument", "fileName has an invalid path segment");
  }
};

// Admin function to setup CORS on the bucket
export const setupR2Cors = onCall(async (data: any, context: any) => {
  const { uid } = await requireAdmin(context);
  await enforceDailyRateLimit({ key: `setupR2Cors_${uid}`, limit: Number(process.env.R2_CORS_DAILY_LIMIT || 20) });

  const config = getR2Config();

  const s3 = new S3Client({
    region: "auto",
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });

  const command = new PutBucketCorsCommand({
    Bucket: config.bucketName,
    CORSConfiguration: {
      CORSRules: [
        {
          AllowedOrigins: getAllowedOrigins(),
          AllowedMethods: ["GET", "PUT", "POST", "HEAD"],
          AllowedHeaders: ["*"],
          ExposeHeaders: ["ETag"],
          MaxAgeSeconds: 3600,
        },
      ],
    },
  });

  try {
    await s3.send(command);
    return { success: true, message: "CORS configured successfully on bucket: " + config.bucketName };
  } catch (error: any) {
    console.error("CORS setup failed:", error);
    throw new Error(error.message || "Failed to configure CORS");
  }
});

export const generateUploadUrl = onCall(async (data: any, context: any) => {
  const { uid } = await requireAdmin(context);
  await enforceDailyRateLimit({ key: `generateUploadUrl_${uid}`, limit: Number(process.env.R2_UPLOAD_DAILY_LIMIT || 2000) });

  const { fileName, contentType } = data;
  if (!fileName || !contentType) {
    throw new HttpsError("invalid-argument", "Missing file details");
  }
  if (typeof contentType !== "string" || !/^(image|video)\//.test(contentType)) {
    throw new HttpsError("invalid-argument", `Unsupported content type: ${contentType}`);
  }
  validateKey(fileName);

  const config = getR2Config();

  const s3 = new S3Client({
    region: "auto",
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });

  try {
    const command = new PutObjectCommand({
      Bucket: config.bucketName,
      Key: fileName,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: Number(process.env.R2_SIGNED_URL_TTL_SECONDS || 300) });

    return {
      success: true,
      uploadUrl,
      publicUrl: `${config.publicUrl}/${fileName}`
    };
  } catch (error: any) {
    console.error("generateUploadUrl presign failed:", error);
    throw new HttpsError("internal", error?.message || "Could not create the upload URL");
  }
});
