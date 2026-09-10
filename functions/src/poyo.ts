import { onCall, HttpsError } from "firebase-functions/v1/https";
import { requireAdmin } from "./auth";
import { enforceDailyRateLimit } from "./rate-limit";

/**
 * Thin proxy to PoYo (api.poyo.ai), used by the AI mockup studio in the admin.
 *
 * It exists for two reasons the browser cannot solve on its own: the API key is
 * a billed credential and must never reach the client, and PoYo's task and
 * storage hosts are not CORS-open to goskinly.com.
 *
 * PoYo is asynchronous — submit returns a task id, and the result is polled
 * until `status` reads "finished". See docs.poyo.ai/api-manual/overview.
 */

const POYO_BASE = "https://api.poyo.ai";

const getKey = () => {
  const key = process.env.POYO_API_KEY || "";
  if (!key) {
    throw new HttpsError(
      "failed-precondition",
      "POYO_API_KEY is not configured on the server"
    );
  }
  return key;
};

/** Aspect ratios PoYo accepts. Anything else is rejected upstream with a 4xx. */
const SIZES = ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"];

/** Models this endpoint is willing to bill against. */
const MODELS = ["nano-banana", "nano-banana-edit", "seedream-4", "gpt-4o-image", "gpt-image-1-5"];

const poyoRequest = async (path: string, init: RequestInit) => {
  let res: Response;
  try {
    res = await fetch(`${POYO_BASE}${path}`, init);
  } catch (e: any) {
    throw new HttpsError("unavailable", `Could not reach PoYo: ${e?.message || e}`);
  }

  const text = await res.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    // Fall through — a non-JSON body is reported verbatim below.
  }

  if (!res.ok) {
    const detail = body?.message || body?.error || text.slice(0, 300);
    throw new HttpsError(
      res.status === 401 || res.status === 403 ? "permission-denied" : "internal",
      `PoYo ${res.status}: ${detail || "request failed"}`
    );
  }
  return body;
};

/**
 * Starts a generation. Returns the task id to poll with poyoStatus.
 *
 * `imageUrls` must be publicly fetchable — PoYo pulls them itself and does not
 * accept base64. Raw design photos are uploaded to R2 first for exactly this.
 */
export const poyoSubmit = onCall(async (data: any, context: any) => {
  const { uid } = await requireAdmin(context);
  await enforceDailyRateLimit({
    key: `poyoSubmit_${uid}`,
    limit: Number(process.env.POYO_DAILY_LIMIT || 500),
  });

  const { model, prompt, imageUrls, size } = data || {};

  if (typeof prompt !== "string" || prompt.trim().length < 10) {
    throw new HttpsError("invalid-argument", "A prompt of at least 10 characters is required");
  }
  if (prompt.length > 5000) {
    throw new HttpsError("invalid-argument", "Prompt is too long");
  }
  if (!MODELS.includes(model)) {
    throw new HttpsError("invalid-argument", `Unsupported model: ${model}`);
  }
  if (size && !SIZES.includes(size)) {
    throw new HttpsError("invalid-argument", `Unsupported size: ${size}`);
  }

  const input: Record<string, unknown> = { prompt: prompt.trim() };
  if (size) input.size = size;

  if (Array.isArray(imageUrls) && imageUrls.length) {
    if (imageUrls.length > 6) {
      throw new HttpsError("invalid-argument", "At most 6 reference images");
    }
    for (const u of imageUrls) {
      if (typeof u !== "string" || !/^https:\/\//.test(u)) {
        throw new HttpsError("invalid-argument", "Reference images must be https URLs");
      }
    }
    input.image_urls = imageUrls;
  }

  const body = await poyoRequest("/api/generate/submit", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, input }),
  });

  const taskId = body?.data?.task_id || body?.task_id;
  if (!taskId) {
    throw new HttpsError("internal", "PoYo did not return a task id");
  }
  return { success: true, taskId };
});

/** Polls one task. `status` is "finished" when `files` is populated. */
export const poyoStatus = onCall(async (data: any, context: any) => {
  await requireAdmin(context);

  const taskId = data?.taskId;
  if (typeof taskId !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(taskId)) {
    throw new HttpsError("invalid-argument", "A valid taskId is required");
  }

  const body = await poyoRequest(`/api/generate/status/${taskId}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${getKey()}` },
  });

  const d = body?.data || {};
  const files = Array.isArray(d.files) ? d.files : [];
  return {
    success: true,
    status: d.status || "unknown",
    progress: typeof d.progress === "number" ? d.progress : null,
    error: d.error_message || null,
    fileUrl: files.find((f: any) => f?.file_type === "image")?.file_url || files[0]?.file_url || null,
  };
});

/**
 * Downloads a finished image and hands it back as base64.
 *
 * The browser cannot fetch storage.poyo.ai directly, and routing the bytes
 * through here also means the result goes through the same WebP normaliser as
 * every other upload rather than landing in R2 as a 2 MB PNG.
 */
export const poyoFetchImage = onCall(async (data: any, context: any) => {
  await requireAdmin(context);

  const url = data?.url;
  if (typeof url !== "string" || !/^https:\/\//.test(url)) {
    throw new HttpsError("invalid-argument", "A https url is required");
  }
  // Only PoYo's own hosts, so this cannot be used as an open fetch proxy.
  const host = (() => {
    try {
      return new URL(url).hostname;
    } catch {
      return "";
    }
  })();
  if (!/(^|\.)poyo\.ai$/.test(host)) {
    throw new HttpsError("permission-denied", `Refusing to fetch from ${host || "an unparseable url"}`);
  }

  let res: Response;
  try {
    res = await fetch(url);
  } catch (e: any) {
    throw new HttpsError("unavailable", `Could not download image: ${e?.message || e}`);
  }
  if (!res.ok) {
    throw new HttpsError("internal", `Image download failed: ${res.status}`);
  }

  const contentType = res.headers.get("content-type") || "image/png";
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength > 9 * 1024 * 1024) {
    throw new HttpsError("resource-exhausted", "Generated image is too large to relay");
  }

  return { success: true, contentType, base64: buf.toString("base64") };
});
