import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

/**
 * Create a new upload job
 */
export const createUploadJob = mutation({
  args: {
    jobName: v.string(),
    totalFiles: v.number(),
  },
  handler: async (ctx, args) => {
    const jobId = await ctx.db.insert("uploadJobs", {
      jobName: args.jobName,
      status: "pending",
      totalFiles: args.totalFiles,
      filesChecked: 0,
      filesSkipped: 0,
      filesUploaded: 0,
      filesFailed: 0,
      currentBatch: 0,
      startedAt: Date.now(),
      lastActivityAt: Date.now(),
      failedFiles: [],
    });

    return jobId;
  },
});

/**
 * Update job status
 */
export const updateJobStatus = mutation({
  args: {
    jobId: v.id("uploadJobs"),
    status: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("paused"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("cancelled")
    ),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const updates: {
      status: "pending" | "running" | "paused" | "completed" | "failed" | "cancelled";
      lastActivityAt: number;
      completedAt?: number;
      errorMessage?: string;
    } = {
      status: args.status,
      lastActivityAt: Date.now(),
    };

    if (args.status === "completed" || args.status === "failed" || args.status === "cancelled") {
      updates.completedAt = Date.now();
    }

    if (args.errorMessage) {
      updates.errorMessage = args.errorMessage;
    }

    await ctx.db.patch(args.jobId, updates);
  },
});

/**
 * Update job progress
 */
export const updateJobProgress = mutation({
  args: {
    jobId: v.id("uploadJobs"),
    currentFile: v.optional(v.string()),
    currentBatch: v.optional(v.number()),
    filesChecked: v.optional(v.number()),
    filesSkipped: v.optional(v.number()),
    filesUploaded: v.optional(v.number()),
    filesFailed: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const updates: {
      lastActivityAt: number;
      currentFile?: string;
      currentBatch?: number;
      filesChecked?: number;
      filesSkipped?: number;
      filesUploaded?: number;
      filesFailed?: number;
    } = {
      lastActivityAt: Date.now(),
    };

    if (args.currentFile !== undefined) updates.currentFile = args.currentFile;
    if (args.currentBatch !== undefined) updates.currentBatch = args.currentBatch;
    if (args.filesChecked !== undefined) updates.filesChecked = args.filesChecked;
    if (args.filesSkipped !== undefined) updates.filesSkipped = args.filesSkipped;
    if (args.filesUploaded !== undefined) updates.filesUploaded = args.filesUploaded;
    if (args.filesFailed !== undefined) updates.filesFailed = args.filesFailed;

    await ctx.db.patch(args.jobId, updates);
  },
});

/**
 * Add a failed file to the job
 */
export const addFailedFile = mutation({
  args: {
    jobId: v.id("uploadJobs"),
    filename: v.string(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) {
      throw new Error("Job not found");
    }

    const updatedFailedFiles = [...job.failedFiles, {
      filename: args.filename,
      reason: args.reason,
    }];

    await ctx.db.patch(args.jobId, {
      failedFiles: updatedFailedFiles,
      filesFailed: job.filesFailed + 1,
      lastActivityAt: Date.now(),
    });
  },
});

/**
 * Get all upload jobs (recent first)
 */
export const getAllUploadJobs = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("uploadJobs")
      .order("desc")
      .take(50);
  },
});

/**
 * Get active upload jobs (running or paused)
 */
export const getActiveUploadJobs = query({
  args: {},
  handler: async (ctx) => {
    const jobs = await ctx.db
      .query("uploadJobs")
      .withIndex("by_status")
      .order("desc")
      .collect();

    return jobs.filter(job => 
      job.status === "running" || 
      job.status === "paused" || 
      job.status === "pending"
    );
  },
});

/**
 * Get a single upload job by ID
 */
export const getUploadJob = query({
  args: { jobId: v.id("uploadJobs") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.jobId);
  },
});

/**
 * Pause an upload job
 */
export const pauseUploadJob = mutation({
  args: { jobId: v.id("uploadJobs") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jobId, {
      status: "paused",
      lastActivityAt: Date.now(),
    });
  },
});

/**
 * Resume an upload job
 */
export const resumeUploadJob = mutation({
  args: { jobId: v.id("uploadJobs") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jobId, {
      status: "running",
      lastActivityAt: Date.now(),
    });
  },
});

/**
 * Cancel an upload job
 */
export const cancelUploadJob = mutation({
  args: { jobId: v.id("uploadJobs") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jobId, {
      status: "cancelled",
      completedAt: Date.now(),
      lastActivityAt: Date.now(),
    });
  },
});

/**
 * Delete an upload job
 */
export const deleteUploadJob = mutation({
  args: { jobId: v.id("uploadJobs") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.jobId);
  },
});

/**
 * Retry failed files from a job
 * Returns the list of failed filenames for the client to retry
 */
export const getFailedFilesForRetry = query({
  args: { jobId: v.id("uploadJobs") },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) {
      throw new Error("Job not found");
    }

    return job.failedFiles;
  },
});

/**
 * Clear failed files from a job (called after retry starts)
 */
export const clearFailedFiles = mutation({
  args: { jobId: v.id("uploadJobs") },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) {
      throw new Error("Job not found");
    }

    await ctx.db.patch(args.jobId, {
      failedFiles: [],
      filesFailed: 0,
      lastActivityAt: Date.now(),
    });
  },
});
