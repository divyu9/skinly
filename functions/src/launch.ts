import * as functionsV1 from "firebase-functions/v1";
import * as admin from "firebase-admin";
import { createListing, reviseListing, moveRestockRequests, type CreateListingSpec, type VariantOp } from "./listings";
import { submitPoyoTask, poyoTaskStatus } from "./poyo";
import { putR2Object } from "./r2";
import { renderTemplateMockup, renderTrueSizeCrop } from "./composite";
import sharp from "sharp";

/**
 * The design launch pipeline.
 *
 * The studio (or the phone launch page) works out a plan for one design — the
 * listings to create, the old listings to bring into shape or retire, the
 * pictures to make — and writes it to designLaunches/{id}. From there it runs
 * here, step by step, with nothing left open in a browser: a trigger starts
 * it, and a worker every two minutes resumes anything unfinished (a function
 * that ran out of time, a picture still rendering). Each step records its own
 * outcome, so a failure is visible and a re-run does not repeat finished work.
 *
 * Pictures land in the studio's review queue like any other; approving is
 * still a person's call.
 */

type StepStatus = "pending" | "done" | "failed" | "skipped";

interface BaseStep {
  id: string;
  type: string;
  label: string;
  status: StepStatus;
  note?: string;
  /** How many times this step has been run, for the one retry a failure gets. */
  tries?: number;
}

type Step =
  | (BaseStep & { type: "create"; listing: string; spec: Omit<CreateListingSpec, "designCode" | "designName" | "finish" | "source" | "imageUrl" | "themes"> })
  | (BaseStep & { type: "revise"; listing: string; productId: string; variantOps: VariantOp[]; rewriteCopy: boolean; modelBrands?: string[]; modelBrandsExclude?: string[] })
  | (BaseStep & { type: "retire"; productId: string; redirectKind?: string; redirectTo?: string })
  | (BaseStep & { type: "sync" })
  | (BaseStep & { type: "rebuild" })
  | (BaseStep & {
      type: "image";
      job: Record<string, any>;
      request: { model: string; prompt: string; imageUrls: string[]; size?: string; resolution?: string; quality?: string };
      /** Send the device's own piece of the calibrated roll instead of the whole photo. */
      crop?: { widthCm: number; heightCm: number; rotate90?: boolean };
    })
  | (BaseStep & { type: "template"; templateId: string; rotate90: boolean; job: Record<string, any> });

interface Launch {
  code: string;
  source: "roll" | "cutout";
  designName: string;
  finish?: string;
  themes?: string[];
  designImageUrl?: string;
  flat?: { url: string; pxPerCm: number; widthCm: number; lengthCm: number } | null;
  steps: Step[];
  status: string;
  leaseUntil?: number;
  created?: Record<string, { productId: string; slug: string }>;
}

const LEASE_MS = 9 * 60 * 1000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const kindKey = (s: string) => String(s || "").trim().toLowerCase();

/** Takes the launch for this run, unless another run holds it. */
async function acquire(ref: admin.firestore.DocumentReference): Promise<Launch | null> {
  return admin.firestore().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return null;
    const l = snap.data() as Launch;
    if (!["queued", "running", "waiting-images"].includes(l.status)) return null;
    if ((l.leaseUntil || 0) > Date.now()) return null;
    tx.update(ref, { leaseUntil: Date.now() + LEASE_MS, status: l.status === "queued" ? "running" : l.status, updatedAt: Date.now() });
    return l;
  });
}

/** The live listing of a kind for this design: made in this run, or before. */
async function listingOfKind(db: admin.firestore.Firestore, launch: Launch, kind: string) {
  const made = launch.created?.[kindKey(kind)];
  if (made) return made;
  const snap = await db.collection("products")
    .where("createdFromDesign", "==", launch.code)
    .where("listingKind", "==", kind)
    .limit(5)
    .get();
  const doc = snap.docs.find((d) => (d.data() as any).status !== "archived");
  return doc ? { productId: doc.id, slug: String((doc.data() as any).slug || "") } : null;
}

async function runStep(db: admin.firestore.Firestore, launch: Launch, step: Step, launchId: string): Promise<{ status: StepStatus; note?: string }> {
  switch (step.type) {
    case "create": {
      try {
        const out = await createListing(db, {
          ...step.spec,
          designCode: launch.code,
          designName: launch.designName,
          finish: launch.finish,
          source: launch.source,
          imageUrl: launch.designImageUrl,
          themes: launch.themes,
        });
        launch.created = { ...(launch.created || {}), [kindKey(step.listing)]: { productId: out.productId, slug: out.slug } };
        return { status: "done", note: `${out.title} · /products/${out.slug}` };
      } catch (e: any) {
        if (e?.code === "already-exists") return { status: "skipped", note: e.message };
        throw e;
      }
    }
    case "revise": {
      const out = await reviseListing(db, {
        productId: step.productId,
        designCode: launch.code,
        designName: launch.designName,
        listing: step.listing,
        finish: launch.finish,
        source: launch.source,
        modelBrands: step.modelBrands,
        modelBrandsExclude: step.modelBrandsExclude,
        themes: launch.themes,
        variantOps: step.variantOps,
        rewriteCopy: step.rewriteCopy,
      });
      launch.created = { ...(launch.created || {}), [kindKey(step.listing)]: { productId: out.productId, slug: out.slug } };
      return { status: "done", note: `/products/${out.slug}${out.moved ? ` · moved ${out.moved} restock request(s)` : ""}` };
    }
    case "retire": {
      const target = step.redirectKind ? await listingOfKind(db, launch, step.redirectKind) : null;
      const redirectTo = target ? `/products/${target.slug}` : step.redirectTo || "/products";
      let moved = 0;
      if (target) {
        const [from, to] = await Promise.all([
          db.collection("variants").where("productId", "==", step.productId).get(),
          db.collection("variants").where("productId", "==", target.productId).get(),
        ]);
        for (const v of from.docs) {
          const mult = Number((v.data() as any).materialMultiplier) || 1;
          const match = to.docs.find((t) => (Number((t.data() as any).materialMultiplier) || 1) === mult) || to.docs[0];
          if (match) moved += await moveRestockRequests(db, v.id, String((match.data() as any).sku || ""));
        }
      }
      await db.collection("products").doc(step.productId).update({
        status: "archived",
        redirectTo,
        retiredAt: Date.now(),
        updatedAt: Date.now(),
      });
      return { status: "done", note: `→ ${redirectTo}${moved ? ` · moved ${moved} restock request(s)` : ""}` };
    }
    case "sync": {
      const { syncStockForDesign } = await import("./materials");
      const out = await syncStockForDesign(db, [launch.code]);
      return { status: "done", note: `${out.length} variant(s) counted` };
    }
    case "rebuild": {
      // Hostinger deploys prod-ready on every push; the repository's "Rebuild
      // storefront" workflow pushes an empty commit when asked.
      const token = process.env.GITHUB_REBUILD_TOKEN || "";
      const repo = process.env.GITHUB_REPO || "divyu9/skinly";
      const hook = process.env.HOSTINGER_DEPLOY_WEBHOOK || "";
      if (token) {
        const res = await fetch(`https://api.github.com/repos/${repo}/dispatches`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github+json",
            "Content-Type": "application/json",
            "User-Agent": "skinly-launch",
          },
          body: JSON.stringify({ event_type: "rebuild", client_payload: { design: launch.code } }),
        });
        return { status: res.ok ? "done" : "failed", note: res.ok ? "rebuild requested (deploys in ~5 min)" : `GitHub ${res.status}: ${(await res.text()).slice(0, 120)}` };
      }
      if (hook) {
        const res = await fetch(hook, { method: "POST" });
        return { status: res.ok ? "done" : "failed", note: `webhook ${res.status}` };
      }
      return { status: "skipped", note: "GITHUB_REBUILD_TOKEN is not set; the nightly rebuild picks this up" };
    }
    case "image": {
      const request = { ...step.request, imageUrls: [...step.request.imageUrls] };
      let sourceUrl = step.job.sourceUrl;
      if (step.crop && launch.flat?.url) {
        const piece = await renderTrueSizeCrop({
          designUrl: launch.flat.url,
          pxPerCm: Number(launch.flat.pxPerCm) || 40,
          widthCm: step.crop.widthCm,
          heightCm: step.crop.heightCm,
          rotate90: step.crop.rotate90,
        });
        const code = launch.code.replace(/[^A-Za-z0-9-]/g, "");
        sourceUrl = await putR2Object(`ai-mockups-pending/pieces/${code}-${step.job.suffix}-${Date.now()}.jpg`, piece, "image/jpeg");
        request.imageUrls[0] = sourceUrl;
      }
      const taskId = await submitPoyoTask(request);
      await db.collection("designMockups").add({
        ...step.job,
        sourceUrl,
        taskId,
        status: "running",
        launchId,
        serverManaged: true,
        createdAt: Date.now(),
      });
      // PoYo allows about one request every two seconds.
      await sleep(2300);
      return { status: "done", note: "submitted" };
    }
    case "template": {
      const tpl = await db.collection("gadgetMockupSettings").doc(step.templateId).get();
      const t = tpl.data() as any;
      if (!t || t.status !== "ready" || !t.imageUrl || !Array.isArray(t.quad)) {
        return { status: "skipped", note: "template not ready" };
      }
      const isRoll = launch.source === "roll";
      if (isRoll && !launch.flat?.url) return { status: "skipped", note: "roll not calibrated" };
      const webp = await renderTemplateMockup({
        templateUrl: t.imageUrl,
        quad: t.quad,
        widthCm: Number(t.widthCm),
        heightCm: Number(t.heightCm),
        designUrl: isRoll ? launch.flat!.url : String(launch.designImageUrl || ""),
        pxPerCm: isRoll ? Number(launch.flat!.pxPerCm) : 0,
        designWidthCm: launch.flat?.widthCm,
        designLengthCm: launch.flat?.lengthCm,
        rotate90: step.rotate90,
      });
      const key = `ai-mockups-pending/${launch.code.replace(/[^A-Za-z0-9-]/g, "")}-${step.job.suffix}-${Date.now()}.webp`;
      const url = await putR2Object(key, webp, "image/webp");
      await db.collection("designMockups").add({
        ...step.job,
        status: "review",
        pendingKey: key,
        pendingUrl: url,
        launchId,
        serverManaged: true,
        createdAt: Date.now(),
      });
      return { status: "done", note: "ready for review" };
    }
  }
}

/** Collects finished generations into the review queue. Returns how many are still rendering. */
async function collect(db: admin.firestore.Firestore, launchId: string, code: string, deadline: number): Promise<number> {
  const running = await db.collection("designMockups")
    .where("launchId", "==", launchId)
    .where("status", "==", "running")
    .get();
  let left = running.size;
  for (const d of running.docs) {
    if (Date.now() > deadline) break;
    const job = d.data() as any;
    try {
      const r = await poyoTaskStatus(String(job.taskId), true);
      if (r.status === "failed" || r.error) {
        await d.ref.update({ status: "failed", error: r.error || "Generation failed" });
        left--;
      } else if (r.status === "finished" && r.buffer) {
        // Stored as WebP, as the studio's own uploads are: approval copies it
        // to a .webp name, and a PNG in that file would be served mislabelled.
        const webp = await sharp(r.buffer)
          .resize({ width: 2048, height: 2048, fit: "inside", withoutEnlargement: true })
          .webp({ quality: 88 })
          .toBuffer();
        const key = `ai-mockups-pending/${code.replace(/[^A-Za-z0-9-]/g, "")}-${job.suffix}-${d.id}.webp`;
        const url = await putR2Object(key, webp, "image/webp");
        await d.ref.update({ status: "review", pendingKey: key, pendingUrl: url });
        left--;
      }
    } catch (e: any) {
      await d.ref.update({ status: "failed", error: e?.message || "Collect failed" });
      left--;
    }
    await sleep(2300);
  }
  return left;
}

export async function runLaunch(launchId: string, budgetMs: number) {
  const db = admin.firestore();
  const ref = db.collection("designLaunches").doc(launchId);
  const launch = await acquire(ref);
  if (!launch) return;
  const deadline = Date.now() + budgetMs;
  const save = (extra: Record<string, unknown> = {}) =>
    ref.update({ steps: launch.steps, created: launch.created || {}, updatedAt: Date.now(), leaseUntil: Date.now() + LEASE_MS, ...extra });

  // One more go at a listing that failed on its own — the copywriter
  // occasionally returns a half-written answer — but only where nothing was
  // written, so a retry can never leave two listings of the same kind.
  for (const step of launch.steps) {
    if (step.type !== "create" || step.status !== "failed" || (step.tries || 0) >= 2) continue;
    if (await listingOfKind(db, launch, step.listing)) continue;
    step.status = "pending";
  }

  try {
    for (const step of launch.steps) {
      if (step.status !== "pending") continue;
      if (Date.now() > deadline - 60_000) {
        await save({ leaseUntil: 0 });
        return;
      }
      step.tries = (step.tries || 0) + 1;
      try {
        const out = await runStep(db, launch, step, launchId);
        step.status = out.status;
        step.note = out.note || "";
      } catch (e: any) {
        step.status = "failed";
        step.note = String(e?.message || e).slice(0, 300);
        console.error(`launch ${launchId} step ${step.id} failed`, e);
      }
      await save();
    }

    const left = await collect(db, launchId, launch.code, deadline - 20_000);
    const failed = launch.steps.filter((s) => s.status === "failed").length;
    await save({
      status: left > 0 ? "waiting-images" : failed ? "done-with-errors" : "done",
      leaseUntil: 0,
      ...(left > 0 ? {} : { finishedAt: Date.now() }),
    });
  } catch (e: any) {
    console.error(`launch ${launchId} stopped`, e);
    await ref.update({ leaseUntil: 0, lastError: String(e?.message || e).slice(0, 300), updatedAt: Date.now() });
  }
}

export const onDesignLaunchCreated = functionsV1
  .runWith({ timeoutSeconds: 540, memory: "1GB" })
  .firestore.document("designLaunches/{launchId}")
  .onCreate(async (_snap, context) => {
    await runLaunch(context.params.launchId as string, 500_000);
    return null;
  });

/** Resumes launches that ran out of time and collects pictures still rendering. */
export const designLaunchWorker = functionsV1
  .runWith({ timeoutSeconds: 540, memory: "1GB" })
  .pubsub.schedule("every 2 minutes")
  .timeZone("Asia/Kolkata")
  .onRun(async () => {
    const db = admin.firestore();
    const open = await db.collection("designLaunches")
      .where("status", "in", ["queued", "running", "waiting-images"])
      .limit(10)
      .get();
    const now = Date.now();
    const started = Date.now();
    for (const d of open.docs) {
      const l = d.data() as Launch;
      if ((l.leaseUntil || 0) > now) continue;
      const spent = Date.now() - started;
      if (spent > 420_000) break;
      await runLaunch(d.id, 480_000 - spent);
    }
    return null;
  });
