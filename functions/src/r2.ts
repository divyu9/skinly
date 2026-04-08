import { onCall } from "firebase-functions/v2/https";
import { S3Client, PutObjectCommand, PutBucketCorsCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const getR2Config = () => {
  const accountId = process.env.R2_ACCOUNT_ID || "";
  const accessKeyId = process.env.R2_ACCESS_KEY_ID || "";
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || "";
  const bucketName = process.env.R2_BUCKET_NAME || "skinly";
  const publicUrl = process.env.R2_PUBLIC_URL || "https://cdn.goskinly.com";
  
  if (!accountId || !accessKeyId || !secretAccessKey) {
      throw new Error("R2 credentials not configured.");
    }
  
  return { accountId, accessKeyId, secretAccessKey, bucketName, publicUrl };
};

// Admin function to setup CORS on the bucket
export const setupR2Cors = onCall({ memory: "256MiB", timeoutSeconds: 60, cors: true }, async (request: any) => {
  // In production, uncomment this to protect the endpoint
  // if (!request.auth?.token?.admin) {
  //   throw new Error("Unauthorized");
  // }

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
          AllowedOrigins: ["*"], // Allow all origins (can be restricted in production)
          AllowedMethods: ["GET", "PUT", "POST", "DELETE", "HEAD"],
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

export const generateUploadUrl = onCall({ memory: "256MiB", timeoutSeconds: 60, cors: true }, async (request: any) => {
  const data = request.data;
  // Authentication check
  // if (!context.auth?.token?.admin) {
  //   throw new functions.https.HttpsError("permission-denied", "Unauthorized");
  // }
  
  const { fileName, contentType } = data;
  if (!fileName || !contentType) {
    throw new Error("Missing file details");
  }

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

    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });
    
    return {
      success: true,
      uploadUrl,
      publicUrl: `${config.publicUrl}/${fileName}`
    };
  } catch (error: any) {
    throw new Error(error.message || "URL generation failed");
  }
});
