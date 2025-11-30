import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { ConvexError } from "convex/values";

// PUBLIC API - Get all import jobs (for admin UI)
export const getAllImportJobs = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }
    
    return await ctx.db.query("importJobs").order("desc").take(20);
  },
});

// PUBLIC API - Get active import jobs (running or pending)
export const getActiveImportJobs = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }
    
    const allJobs = await ctx.db.query("importJobs").order("desc").collect();
    return allJobs.filter(job => 
      job.status === "running" || 
      job.status === "pending" || 
      job.status === "paused"
    );
  },
});

// PUBLIC API - Get specific import job status
export const getImportJobStatus = query({
  args: {
    jobId: v.id("importJobs"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }
    
    const job = await ctx.db.get(args.jobId);
    if (!job) {
      throw new ConvexError({
        message: "Import job not found",
        code: "NOT_FOUND",
      });
    }
    
    return job;
  },
});

// PUBLIC API - Pause import job
export const pauseImportJob = mutation({
  args: {
    jobId: v.id("importJobs"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }
    
    await ctx.db.patch(args.jobId, {
      status: "paused",
      lastActivityAt: Date.now(),
    });
  },
});

// PUBLIC API - Resume import job
export const resumeImportJob = mutation({
  args: {
    jobId: v.id("importJobs"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }
    
    const job = await ctx.db.get(args.jobId);
    if (!job) {
      throw new ConvexError({
        message: "Import job not found",
        code: "NOT_FOUND",
      });
    }
    
    // Update status to pending
    await ctx.db.patch(args.jobId, {
      status: "pending",
      lastActivityAt: Date.now(),
    });
    
    // Restart processing
    await ctx.scheduler.runAfter(0, internal.googleDriveImport.processImportJob, {
      jobId: args.jobId,
    });
  },
});

// PUBLIC API - Cancel import job
export const cancelImportJob = mutation({
  args: {
    jobId: v.id("importJobs"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }
    
    await ctx.db.patch(args.jobId, {
      status: "failed",
      errorMessage: "Cancelled by user",
      completedAt: Date.now(),
    });
  },
});

// PUBLIC API - Retry failed files in an import job (targets only failed files)
export const retryFailedFiles = mutation({
  args: {
    jobId: v.id("importJobs"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }
    
    const job = await ctx.db.get(args.jobId);
    if (!job) {
      throw new ConvexError({
        message: "Import job not found",
        code: "NOT_FOUND",
      });
    }
    
    if (!job.failedFiles || job.failedFiles.length === 0) {
      throw new ConvexError({
        message: "No failed files to retry",
        code: "BAD_REQUEST",
      });
    }
    
    const failedCount = job.failedFiles.length;
    
    // Start retry process (targets only failed files)
    await ctx.scheduler.runAfter(0, internal.googleDriveImport.retryFailedFilesOnly, {
      jobId: args.jobId,
    });
    
    return { retriedCount: failedCount };
  },
});

// PUBLIC API - Delete completed/failed import job
export const deleteImportJob = mutation({
  args: {
    jobId: v.id("importJobs"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }
    
    const job = await ctx.db.get(args.jobId);
    if (!job) {
      throw new ConvexError({
        message: "Import job not found",
        code: "NOT_FOUND",
      });
    }
    
    // Only allow deletion of completed or failed jobs
    if (job.status === "running" || job.status === "pending") {
      throw new ConvexError({
        message: "Cannot delete active import job. Cancel it first.",
        code: "BAD_REQUEST",
      });
    }
    
    await ctx.db.delete(args.jobId);
  },
});

// INTERNAL - Check for duplicate filenames
export const checkDuplicatesQuery = internalMutation({
  args: {
    filenames: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const allMockups = await ctx.db.query("mockups").collect();
    
    const existingSet = new Set<string>();
    
    for (const mockup of allMockups) {
      const normalizedModel = mockup.model.replace(/\s+/g, '_');
      const filename1 = `${mockup.brand}_${normalizedModel}_${mockup.sku}`.toLowerCase();
      const filename2 = `${normalizedModel}_${mockup.sku}`.toLowerCase();
      existingSet.add(filename1);
      existingSet.add(filename2);
    }
    
    const existingFilenames: string[] = [];
    const missingFilenames: string[] = [];
    
    for (const filename of args.filenames) {
      const normalized = filename
        .replace(/\.(jpg|jpeg|png|webp)$/i, '')
        .toLowerCase();
      
      if (existingSet.has(normalized)) {
        existingFilenames.push(filename);
      } else {
        missingFilenames.push(filename);
      }
    }
    
    return {
      existingFilenames,
      missingFilenames,
    };
  },
});

// INTERNAL - Generate upload URL
export const generateUploadUrl = internalMutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

// INTERNAL - Store mockup file
export const storeMockupFile = internalMutation({
  args: {
    storageId: v.id("_storage"),
    filename: v.string(),
  },
  handler: async (ctx, args) => {
    // Parse filename: Brand_Model_SKU.jpg or Model_SKU.jpg (for iPhone/iPad)
    const nameWithoutExt = args.filename.replace(/\.(jpg|jpeg|png|webp)$/i, '');
    const parts = nameWithoutExt.split('_');
    
    if (parts.length < 2) {
      throw new Error("Invalid filename format");
    }
    
    // Last part is always SKU
    const sku = parts[parts.length - 1];
    
    // Model portion is everything before the SKU (joined with spaces to handle underscores or spaces)
    const modelPortion = parts.slice(0, -1).join(' ');
    const modelPortionLower = modelPortion.toLowerCase();
    
    // Check if filename contains iPhone, iPad, Google, Nothing, or CMF to auto-detect brand
    const isAppleDevice = modelPortionLower.includes('iphone') || modelPortionLower.includes('ipad');
    const isGoogleDevice = modelPortionLower.startsWith('google');
    const isNothingDevice = modelPortionLower.startsWith('nothing');
    const isCMFDevice = modelPortionLower.startsWith('cmf');
    
    let brand: string;
    let model: string;
    
    if (isAppleDevice) {
      brand = 'Apple';
      model = modelPortion;
    } else if (isGoogleDevice) {
      brand = 'Google';
      model = modelPortion.replace(/^google\s*/i, '').trim();
      if (!model) {
        throw new Error("Google device must have a model name");
      }
    } else if (isNothingDevice) {
      brand = 'Nothing';
      model = modelPortion.replace(/^nothing\s*/i, '').trim();
      if (!model) {
        throw new Error("Nothing device must have a model name");
      }
    } else if (isCMFDevice) {
      brand = 'CMF';
      model = modelPortion.replace(/^cmf\s*/i, '').trim();
      if (!model) {
        throw new Error("CMF device must have a model name");
      }
    } else if (parts.length === 2) {
      throw new Error("Non-Apple/Google/Nothing/CMF devices must include brand in filename");
    } else {
      brand = parts[0];
      model = parts.slice(1, -1).join(' ');
    }
    
    // Check if mockup already exists
    const existing = await ctx.db
      .query("mockups")
      .withIndex("by_brand_model_sku", (q) =>
        q.eq("brand", brand).eq("model", model).eq("sku", sku)
      )
      .first();
    
    if (existing) {
      // Update existing
      await ctx.db.patch(existing._id, {
        fileId: args.storageId,
      });
      return { action: "updated" };
    } else {
      // Create new
      await ctx.db.insert("mockups", {
        brand,
        model,
        sku,
        fileId: args.storageId,
      });
      return { action: "created" };
    }
  },
});

// INTERNAL - Create import job
export const createImportJob = internalMutation({
  args: {
    folderId: v.string(),
    folderUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const jobId = await ctx.db.insert("importJobs", {
      folderId: args.folderId,
      folderUrl: args.folderUrl,
      status: "pending",
      filesChecked: 0,
      filesSkipped: 0,
      filesUploaded: 0,
      filesFailed: 0,
      startedAt: Date.now(),
      lastActivityAt: Date.now(),
    });
    
    return jobId;
  },
});

// INTERNAL - Get import job
export const getImportJob = internalMutation({
  args: {
    jobId: v.id("importJobs"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.jobId);
  },
});

// INTERNAL - Update import job status
export const updateImportJobStatus = internalMutation({
  args: {
    jobId: v.id("importJobs"),
    status: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("paused"),
      v.literal("completed"),
      v.literal("failed")
    ),
    completedAt: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jobId, {
      status: args.status,
      lastActivityAt: Date.now(),
      ...(args.completedAt && { completedAt: args.completedAt }),
      ...(args.errorMessage && { errorMessage: args.errorMessage }),
    });
  },
});

// INTERNAL - Update total files count
export const updateImportJobTotalFiles = internalMutation({
  args: {
    jobId: v.id("importJobs"),
    totalFiles: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jobId, {
      totalFiles: args.totalFiles,
      lastActivityAt: Date.now(),
    });
  },
});

// INTERNAL - Update current file
export const updateImportJobCurrentFile = internalMutation({
  args: {
    jobId: v.id("importJobs"),
    currentFile: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jobId, {
      currentFile: args.currentFile,
      lastActivityAt: Date.now(),
    });
  },
});

// INTERNAL - Increment job progress
export const incrementJobProgress = internalMutation({
  args: {
    jobId: v.id("importJobs"),
    filesChecked: v.optional(v.number()),
    filesSkipped: v.optional(v.number()),
    filesUploaded: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) return;
    
    await ctx.db.patch(args.jobId, {
      filesChecked: job.filesChecked + (args.filesChecked || 0),
      filesSkipped: job.filesSkipped + (args.filesSkipped || 0),
      filesUploaded: job.filesUploaded + (args.filesUploaded || 0),
      lastActivityAt: Date.now(),
    });
  },
});

// INTERNAL - Update checkpoint
export const updateImportJobCheckpoint = internalMutation({
  args: {
    jobId: v.id("importJobs"),
    checkpoint: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jobId, {
      lastCheckpoint: args.checkpoint,
      lastActivityAt: Date.now(),
    });
  },
});

// INTERNAL - Record failed file
export const recordFailedFile = internalMutation({
  args: {
    jobId: v.id("importJobs"),
    fileId: v.string(),
    filename: v.string(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) return;
    
    const failedFiles = job.failedFiles || [];
    failedFiles.push({
      fileId: args.fileId,
      filename: args.filename,
      reason: args.reason,
    });
    
    await ctx.db.patch(args.jobId, {
      filesFailed: job.filesFailed + 1,
      failedFiles,
      lastActivityAt: Date.now(),
    });
  },
});

// INTERNAL - Clear failed files list
export const clearFailedFiles = internalMutation({
  args: {
    jobId: v.id("importJobs"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jobId, {
      filesFailed: 0,
      failedFiles: [],
      lastActivityAt: Date.now(),
    });
  },
});
