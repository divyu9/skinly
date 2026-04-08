"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateUploadUrl = exports.setupR2Cors = void 0;
const https_1 = require("firebase-functions/v2/https");
const client_s3_1 = require("@aws-sdk/client-s3");
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
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
exports.setupR2Cors = (0, https_1.onCall)({ memory: "256MiB", timeoutSeconds: 60, cors: true }, async (request) => {
    // In production, uncomment this to protect the endpoint
    // if (!request.auth?.token?.admin) {
    //   throw new Error("Unauthorized");
    // }
    const config = getR2Config();
    const s3 = new client_s3_1.S3Client({
        region: "auto",
        endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
        credentials: {
            accessKeyId: config.accessKeyId,
            secretAccessKey: config.secretAccessKey,
        },
    });
    const command = new client_s3_1.PutBucketCorsCommand({
        Bucket: config.bucketName,
        CORSConfiguration: {
            CORSRules: [
                {
                    AllowedOrigins: ["*"],
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
    }
    catch (error) {
        console.error("CORS setup failed:", error);
        throw new Error(error.message || "Failed to configure CORS");
    }
});
exports.generateUploadUrl = (0, https_1.onCall)({ memory: "256MiB", timeoutSeconds: 60, cors: true }, async (request) => {
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
    const s3 = new client_s3_1.S3Client({
        region: "auto",
        endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
        credentials: {
            accessKeyId: config.accessKeyId,
            secretAccessKey: config.secretAccessKey,
        },
    });
    try {
        const command = new client_s3_1.PutObjectCommand({
            Bucket: config.bucketName,
            Key: fileName,
            ContentType: contentType,
        });
        const uploadUrl = await (0, s3_request_presigner_1.getSignedUrl)(s3, command, { expiresIn: 3600 });
        return {
            success: true,
            uploadUrl,
            publicUrl: `${config.publicUrl}/${fileName}`
        };
    }
    catch (error) {
        throw new Error(error.message || "URL generation failed");
    }
});
//# sourceMappingURL=r2.js.map