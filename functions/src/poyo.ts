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

/**
 * Models this endpoint is willing to bill against.
 *
 * Only the -edit variants, deliberately: the studio always sends the roll photo
 * as a reference, and a text-to-image model would quietly ignore it and invent
 * a pattern. The client-side registry in ai-mockup-models.ts must stay a subset
 * of this list.
 */
const MODELS = [
  // gpt-image-2.5-flare has no separate -edit id: a non-empty image_urls picks
  // editing. It is still only ever called with a reference, enforced below.
  "gpt-image-2.5-flare",
  "gpt-image-2.5-sunburst",
  "gpt-4o-image-edit",
  "nano-banana-edit",
  "seedream-4.5-edit",
  "seedream-5.0-lite-edit",
  "nano-banana-pro-edit",
];

const RESOLUTIONS = ["1K", "2K", "4K"];
const QUALITIES = ["low", "medium", "high", "xhigh", "max"];

const poyoRequest = async (path: string, init: RequestInit, attempt = 0): Promise<any> => {
  let res: Response;
  try {
    res = await fetch(`${POYO_BASE}${path}`, init);
  } catch (e: any) {
    throw new HttpsError("unavailable", `Could not reach PoYo: ${e?.message || e}`);
  }

  if (res.status === 429 && attempt < 2) {
    await new Promise((r) => setTimeout(r, 2200));
    return poyoRequest(path, init, attempt + 1);
  }

  const text = await res.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    // Fall through — a non-JSON body is reported verbatim below.
  }

  if (!res.ok) {
    // PoYo returns `error` as an object about as often as a string, and
    // "[object Object]" is useless at 2am when a batch is failing.
    const asText = (v: any): string =>
      typeof v === "string" ? v : v == null ? "" : JSON.stringify(v);
    const detail =
      asText(body?.message) || asText(body?.error) || asText(body?.data) || text.slice(0, 300);

    // The model refused the job, not the request. Say which half it objected to
    // and what actually helps, because "does not comply with the platform
    // regulations" reads like our bug and is not one.
    if (/comply|policy|regulation|content.{0,12}(filter|violat)|safety|moderat/i.test(detail)) {
      throw new HttpsError(
        "invalid-argument",
        "The model refused this design. Its safety filter reads the reference photo as well as the prompt, " +
        "so artwork with weapons, gore or a recognisable licensed character is often rejected. " +
        "Try Redo with a different model — the filters differ — and if every model refuses it, " +
        "that design needs a photograph rather than a generation. " +
        `(upstream: ${detail.slice(0, 160)})`
      );
    }
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

  const { model, prompt, imageUrls, size, resolution, quality } = data || {};

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
  if (resolution && !RESOLUTIONS.includes(resolution)) {
    throw new HttpsError("invalid-argument", `Unsupported resolution: ${resolution}`);
  }
  if (quality && !QUALITIES.includes(quality)) {
    throw new HttpsError("invalid-argument", `Unsupported quality: ${quality}`);
  }

  const input: Record<string, unknown> = { prompt: prompt.trim() };
  if (size) input.size = size;
  // Only sent when the model family defines them; PoYo rejects strays.
  if (resolution) input.resolution = resolution;
  if (quality) input.quality = quality;

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
  } else {
    throw new HttpsError(
      "invalid-argument",
      `${model} must be called with a reference image; none was supplied`
    );
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

/**
 * Polls one task, and hands back the image in the same breath.
 *
 * PoYo allows one request per task per two seconds. Checking the status and
 * then fetching the result were two calls milliseconds apart against the same
 * task, which tripped that limit every single time a job finished. With
 * `withImage` the bytes come back on the poll that first sees "finished", so a
 * task is only ever asked about once.
 *
 * Relaying the bytes also keeps CORS out of it and puts them through the same
 * WebP normaliser as every other upload. The result URL is read from PoYo's own
 * response, so nothing client-supplied is ever fetched.
 */
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
  const fileUrl = files.find((f: any) => f?.file_type === "image")?.file_url || files[0]?.file_url || null;

  const out: Record<string, unknown> = {
    success: true,
    status: d.status || "unknown",
    progress: typeof d.progress === "number" ? d.progress : null,
    error: d.error_message || null,
    fileUrl,
  };

  if (data?.withImage && fileUrl && /^https:\/\//.test(String(fileUrl))) {
    let img: Response;
    try {
      img = await fetch(fileUrl);
    } catch (e: any) {
      throw new HttpsError("unavailable", `Could not download image: ${e?.message || e}`);
    }
    if (!img.ok) throw new HttpsError("internal", `Image download failed: ${img.status}`);

    const buf = Buffer.from(await img.arrayBuffer());
    if (buf.byteLength > 9 * 1024 * 1024) {
      throw new HttpsError("resource-exhausted", "Generated image is too large to relay");
    }
    out.contentType = img.headers.get("content-type") || "image/png";
    out.base64 = buf.toString("base64");
  }

  return out;
});
