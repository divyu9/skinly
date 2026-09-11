"use strict";
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteR2Object = exports.getR2Object = exports.copyR2Object = exports.generateUploadUrl = exports.setupR2Cors = void 0;
const https_1 = require("firebase-functions/v1/https");
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
        throw new https_1.HttpsError("failed-precondition", "R2 credentials are not configured");
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
const validateKey = (key) => {
    if (!key)
        throw new https_1.HttpsError("invalid-argument", "Missing fileName");
    if (key.length > 512)
        throw new https_1.HttpsError("invalid-argument", "fileName is too long");
    if (key.startsWith("/") || key.endsWith("/"))
        throw new https_1.HttpsError("invalid-argument", "fileName must not start or end with /");
    if (!/^[a-zA-Z0-9 /_\-.()]+$/.test(key))
        throw new https_1.HttpsError("invalid-argument", "fileName has unsupported characters");
    const segments = key.split("/");
    if (segments.length < 2)
        throw new https_1.HttpsError("invalid-argument", "fileName must include a folder");
    if (segments.some((s) => s === "" || s === "." || s === "..")) {
        throw new https_1.HttpsError("invalid-argument", "fileName has an invalid path segment");
    }
};
// Admin function to setup CORS on the bucket
exports.setupR2Cors = (0, https_1.onCall)(async (data, context) => {
    const { uid } = await (0, auth_1.requireAdmin)(context);
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
exports.generateUploadUrl = (0, https_1.onCall)(async (data, context) => {
    const { uid } = await (0, auth_1.requireAdmin)(context);
    await (0, rate_limit_1.enforceDailyRateLimit)({ key: `generateUploadUrl_${uid}`, limit: Number(process.env.R2_UPLOAD_DAILY_LIMIT || 2000) });
    const { fileName, contentType } = data;
    if (!fileName || !contentType) {
        throw new https_1.HttpsError("invalid-argument", "Missing file details");
    }
    if (typeof contentType !== "string" || !/^(image|video)\//.test(contentType)) {
        throw new https_1.HttpsError("invalid-argument", `Unsupported content type: ${contentType}`);
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
        console.error("generateUploadUrl presign failed:", error);
        throw new https_1.HttpsError("internal", (error === null || error === void 0 ? void 0 : error.message) || "Could not create the upload URL");
    }
});
/* -------------------------------------------------------------------------- *
 * Object moves, for the AI mockup review queue
 *
 * Generated images are staged under a pending prefix and only promoted once a
 * human has looked at them. Approving copies server-side rather than pushing
 * megabytes back through the browser; rejecting needs the bytes locally, so
 * that one does come through, then deletes the staged object.
 * -------------------------------------------------------------------------- */
const r2Client = () => {
    const config = getR2Config();
    return {
        config,
        s3: new client_s3_1.S3Client({
            region: "auto",
            endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
            credentials: {
                accessKeyId: config.accessKeyId,
                secretAccessKey: config.secretAccessKey,
            },
        }),
    };
};
exports.copyR2Object = (0, https_1.onCall)(async (data, context) => {
    const { uid } = await (0, auth_1.requireAdmin)(context);
    await (0, rate_limit_1.enforceDailyRateLimit)({ key: `copyR2Object_${uid}`, limit: Number(process.env.R2_COPY_DAILY_LIMIT || 2000) });
    const { fromKey, toKey, contentType } = data || {};
    validateKey(fromKey);
    validateKey(toKey);
    const { s3, config } = r2Client();
    await s3.send(new client_s3_1.CopyObjectCommand({
        Bucket: config.bucketName,
        // CopySource is a path, so the source key needs encoding but the slashes do not.
        CopySource: `${config.bucketName}/${fromKey.split("/").map(encodeURIComponent).join("/")}`,
        Key: toKey,
        ContentType: typeof contentType === "string" ? contentType : undefined,
        MetadataDirective: contentType ? "REPLACE" : "COPY",
    }));
    return { success: true, key: toKey, url: `${config.publicUrl.replace(/\/$/, "")}/${toKey}` };
});
exports.getR2Object = (0, https_1.onCall)(async (data, context) => {
    var _a, e_1, _b, _c;
    await (0, auth_1.requireAdmin)(context);
    const { key } = data || {};
    validateKey(key);
    const { s3, config } = r2Client();
    const res = await s3.send(new client_s3_1.GetObjectCommand({ Bucket: config.bucketName, Key: key }));
    const body = res.Body;
    if (!body)
        throw new https_1.HttpsError("not-found", `No object at ${key}`);
    const chunks = [];
    try {
        for (var _d = true, body_1 = __asyncValues(body), body_1_1; body_1_1 = await body_1.next(), _a = body_1_1.done, !_a;) {
            _c = body_1_1.value;
            _d = false;
            try {
                const chunk = _c;
                chunks.push(Buffer.from(chunk));
            }
            finally {
                _d = true;
            }
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (!_d && !_a && (_b = body_1.return)) await _b.call(body_1);
        }
        finally { if (e_1) throw e_1.error; }
    }
    const buf = Buffer.concat(chunks);
    if (buf.byteLength > 9 * 1024 * 1024) {
        throw new https_1.HttpsError("resource-exhausted", "Object is too large to relay");
    }
    return {
        success: true,
        contentType: res.ContentType || "application/octet-stream",
        base64: buf.toString("base64"),
    };
});
exports.deleteR2Object = (0, https_1.onCall)(async (data, context) => {
    const { uid } = await (0, auth_1.requireAdmin)(context);
    await (0, rate_limit_1.enforceDailyRateLimit)({ key: `deleteR2Object_${uid}`, limit: Number(process.env.R2_DELETE_DAILY_LIMIT || 2000) });
    const { key } = data || {};
    validateKey(key);
    const { s3, config } = r2Client();
    await s3.send(new client_s3_1.DeleteObjectCommand({ Bucket: config.bucketName, Key: key }));
    return { success: true };
});
//# sourceMappingURL=r2.js.map