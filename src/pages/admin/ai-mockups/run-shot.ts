import { useCallback } from "react";
import { toast } from "sonner";
import { useAction, useMutation } from "@/lib/firebase-hooks";
import { api } from "@/lib/firebase-api";
import {
  REFERENCE_PREAMBLE, TRUE_SIZE_CLAUSE, deviceAnchor, expandPrompt, listingOf, shotCodes,
  type CutOrientation, type DesignSource, type MockupShot, type SharedBlocks,
} from "@/lib/ai-mockup-shots.ts";
import { USD_TO_INR, type ImageModel } from "@/lib/ai-mockup-models.ts";
import { useTruePiece } from "./templates.tsx";

/** The design a picture is made from — a roll or a cutout. */
export interface ShotDesign {
  _id: string;
  code: string;
  name?: string;
  source: DesignSource;
  finish?: string;
  rawImageUrl?: string;
  flatImageUrl?: string;
  flatPxPerCm?: number;
  flatWidthCm?: number;
  flatLengthCm?: number;
}

/**
 * Sends one angle of one design to the image model.
 *
 * Lifted out of the studio so the product page can ask for a picture too: a
 * listing that is missing one of its angles is noticed while looking at the
 * listing, not while looking at the design, and walking back to the studio to
 * tick one box was the long way round. One copy, so the two routes cannot
 * drift into making subtly different pictures.
 */
export function useRunShot(
  design: ShotDesign,
  jobs: Array<{ suffix: string; attempt?: number }>,
  blocks: SharedBlocks
) {
  const createJob = useMutation(api.aiMockups.createDesignMockup);
  const updateJob = useMutation(api.aiMockups.updateDesignMockup);
  const submit = useAction(api.poyo.poyoSubmit);
  const truePieceFor = useTruePiece();

  return useCallback(async (
    shot: MockupShot,
    model: ImageModel,
    size: string,
    orientation?: CutOrientation
  ): Promise<boolean> => {
    // Two cuts of one design are two different pictures, so they need two
    // filenames; without the tail the second would overwrite the first.
    const suffix = orientation ? `${shot.suffix}-${orientation === "widthwise" ? "wid" : "len"}` : shot.suffix;
    // Numbered by file name, not by shot: two shots that share a suffix used to
    // both be attempt 1, write the same file, and the second approval then
    // failed because the first had already moved it away.
    const attempt = jobs.filter((j) => j.suffix === suffix).reduce((n, j) => Math.max(n, j.attempt || 1), 0) + 1;
    const label = orientation ? `${shot.label} · ${orientation === "widthwise" ? "across" : "along"} the roll` : shot.label;
    let jobId: string | null = null;
    // A calibrated roll hands the model the device's own piece at true size,
    // the way the launch pipeline does, so the motifs come out life-size. The
    // piece is already turned, so the prompt must not turn it again.
    let piece: { url: string; widthCm: number; heightCm: number } | null = null;
    try {
      piece = await truePieceFor(design, shot.gadget, orientation === "widthwise");
    } catch {
      piece = null; // Fall back to the whole roll photo rather than not shooting.
    }
    const designUrl = piece?.url || design.rawImageUrl;
    const promptSent = deviceAnchor(shot.gadget, listingOf(shot))
      + (shot.referenceUrl ? REFERENCE_PREAMBLE : "")
      + (piece ? TRUE_SIZE_CLAUSE(piece.widthCm, piece.heightCm) : "")
      + expandPrompt(shot.prompt, blocks, {
        rNumber: design.code,
        designName: design.name,
        source: design.source,
        finish: design.finish,
        cutOrientation: piece ? undefined : orientation,
      });
    try {
      jobId = (await createJob({
        promptSent,
        referenceUrl: shot.referenceUrl || "",
        rNumber: design.code,
        designName: design.name || "",
        designSource: design.source,
        shotId: shot._id,
        shotLabel: label,
        gadget: shot.gadget,
        listing: listingOf(shot),
        suffix,
        skuCodes: shotCodes(shot),
        variantTitles: shot.variantTitles || [],
        matchSingleVariant: shot.matchSingleVariant || false,
        sourceUrl: designUrl,
        pieceCm: piece ? `${piece.widthCm}×${piece.heightCm}` : "",
        status: "queued",
        attempt,
        modelLabel: model.label,
        aspect: size,
        credits: model.credits,
        costInr: Number((model.usd * USD_TO_INR).toFixed(2)),
        createdAt: Date.now(),
      })) as string;

      const res: any = await submit({
        model: model.apiModel,
        size,
        resolution: model.resolution,
        quality: model.quality,
        prompt: promptSent,
        imageUrls: shot.referenceUrl ? [designUrl, shot.referenceUrl] : [designUrl],
      });
      await updateJob({ mockupId: jobId, taskId: res.taskId, status: "running" });
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Submit failed";
      if (jobId) await updateJob({ mockupId: jobId, status: "failed", error: msg });
      toast.error(`${shot.label}: ${msg}`);
      return false;
    }
  }, [design, jobs, blocks, createJob, updateJob, submit, truePieceFor]);
}
