"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateUploadUrl = exports.setupR2Cors = void 0;
const https_1 = require("firebase-functions/v2/https");
const client_s3_1 = require("@aws-sdk/client-s3");
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
const auth_1 = require("./auth");
const rate_limit_1 = require("./rate-limit");
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
const validateKey = (key) => {
    if (!key)
        throw new Error("Missing fileName");
    if (key.includes(".."))
        throw new Error("Invalid fileName");
    if (key.startsWith("/"))
        throw new Error("Invalid fileName");
    if (!/^[a-zA-Z0-9/_\-.]+$/.test(key))
        throw new Error("Invalid fileName");
    const allowedPrefixes = ["general/", "homepage/", "products/", "mockups/", "seo/"];
    if (!allowedPrefixes.some((p) => key.startsWith(p))) {
        throw new Error("Invalid fileName");
    }
};
// Admin function to setup CORS on the bucket
exports.setupR2Cors = (0, https_1.onCall)({ memory: "256MiB", timeoutSeconds: 60, cors: true }, async (request) => {
    const { uid } = await (0, auth_1.requireAdmin)(request);
    await (0, rate_limit_1.enforceDailyRateLimit)({ key: `setupR2Cors_${uid}`, limit: Number(process.env.R2_CORS_DAILY_LIMIT || 20) });
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
    }
    catch (error) {
        console.error("CORS setup failed:", error);
        throw new Error(error.message || "Failed to configure CORS");
    }
});
exports.generateUploadUrl = (0, https_1.onCall)({ memory: "256MiB", timeoutSeconds: 60, cors: true }, async (request) => {
    const { uid } = await (0, auth_1.requireAdmin)(request);
    await (0, rate_limit_1.enforceDailyRateLimit)({ key: `generateUploadUrl_${uid}`, limit: Number(process.env.R2_UPLOAD_DAILY_LIMIT || 2000) });
    const data = request.data;
    const { fileName, contentType } = data;
    if (!fileName || !contentType) {
        throw new Error("Missing file details");
    }
    if (typeof contentType !== "string" || !contentType.startsWith("image/")) {
        throw new Error("Invalid contentType");
    }
    validateKey(fileName);
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
        const uploadUrl = await (0, s3_request_presigner_1.getSignedUrl)(s3, command, { expiresIn: Number(process.env.R2_SIGNED_URL_TTL_SECONDS || 300) });
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