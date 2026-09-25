import * as functionsV1 from "firebase-functions/v1";
import * as admin from "firebase-admin";
import * as crypto from "crypto";
import * as zlib from "zlib";

/**
 * The cutting files, as the Windows PC sees them.
 *
 * Every model the shop can actually cut has a PLT file on the plotter PC, in
 * the cutting software's own folder. The website's model list was kept by
 * hand beside it, so the two drift: a model gets a cut file and never reaches
 * the picker, or the picker offers a model nobody can cut.
 *
 * tools/plt-sync/plt-sync.ps1 runs on that PC once a day and posts the list of
 * files here — path, size, modified time, one line each, gzipped. It does
 * nothing else, so the rules that turn "Samsung/S24 Ultra - Back B1.plt" into
 * one model live on the server and change without touching the PC.
 *
 * Kept in Firestore, which only the server reads (no rule opens pltSync), not
 * in R2, whose bucket is public.
 */

const CHUNK_CHARS = 700_000;
const MAX_FILES = 300_000;

function keyOk(given: unknown): boolean {
  const want = process.env.PLT_SYNC_KEY || "";
  if (!want || typeof given !== "string") return false;
  const a = Buffer.from(want);
  const b = Buffer.from(given);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export const pltInventoryUpload = functionsV1
  .runWith({ memory: "512MB", timeoutSeconds: 120 })
  .https.onRequest(async (req, res) => {
    if (req.method !== "POST") { res.status(405).send("POST only"); return; }
    if (!keyOk(req.get("x-plt-key"))) { res.status(401).send("bad key"); return; }

    let text: string;
    try {
      const raw: Buffer = (req as any).rawBody || Buffer.alloc(0);
      const gz = raw.length > 2 && raw[0] === 0x1f && raw[1] === 0x8b;
      text = (gz ? zlib.gunzipSync(raw) : raw).toString("utf8").replace(/^﻿/, "");
    } catch {
      res.status(400).send("could not read the body");
      return;
    }

    // One file per line: relative path <TAB> bytes <TAB> modified (unix seconds).
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length > MAX_FILES) { res.status(413).send("too many files"); return; }
    const machine = String(req.get("x-plt-machine") || "").slice(0, 80);
    let root = String(req.get("x-plt-root") || "");
    try { root = decodeURIComponent(root); } catch { /* sent plain */ }
    root = root.slice(0, 300);

    const db = admin.firestore();
    const now = Date.now();
    const runId = new Date(now).toISOString().replace(/[:.]/g, "-");
    const runRef = db.collection("pltSync").doc(runId);

    const body = lines.join("\n");
    const chunks: string[] = [];
    for (let i = 0; i < body.length; i += CHUNK_CHARS) chunks.push(body.slice(i, i + CHUNK_CHARS));
    for (const [i, c] of chunks.entries()) {
      await runRef.collection("chunks").doc(String(i).padStart(4, "0")).set({ text: c });
    }

    const byExt: Record<string, number> = {};
    for (const l of lines) {
      const ext = (/\.([A-Za-z0-9]{1,6})(?:\t|$)/.exec(l.split("\t")[0])?.[1] || "none").toLowerCase();
      byExt[ext] = (byExt[ext] || 0) + 1;
    }
    const summary = { runId, receivedAt: now, machine, root, fileCount: lines.length, chunks: chunks.length, byExt };
    await runRef.set(summary);
    await db.collection("pltSync").doc("latest").set(summary);

    console.log("pltInventoryUpload", { machine, files: lines.length, chunks: chunks.length });
    res.json({ ok: true, files: lines.length });
  });
