"use node";

import { v } from "convex/values";
import { action, internalAction, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { ConvexError } from "convex/values";
import type { Id } from "./_generated/dataModel.d.ts";

// Extract Google Drive folder ID from URL
function extractFolderId(url: string): string {
  // Handle various Google Drive URL formats:
  // https://drive.google.com/drive/folders/FOLDER_ID
  // https://drive.google.com/drive/u/0/folders/FOLDER_ID
  const match = url.match(/folders\/([a-zA-Z0-9_-]+)/);
  if (!match) {
    throw new ConvexError({
      message: "Invalid Google Drive folder URL",
      code: "BAD_REQUEST",
    });
  }
  return match[1];
}

// Interface for Google Drive API response
interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  webContentLink?: string;
}

interface DriveListResponse {
  files: DriveFile[];
  nextPageToken?: string;
}

// Fetch all files from a public Google Drive folder (recursively)
async function fetchAllFilesFromFolder(
  folderId: string,
  apiKey: string | undefined
): Promise<DriveFile[]> {
  const allFiles: DriveFile[] = [];
  
  // For public folders, we can use the Google Drive API without auth
  // Use the API key if provided, otherwise rely on public access
  const baseUrl = apiKey
    ? `https://www.googleapis.com/drive/v3/files?key=${apiKey}`
    : `https://www.googleapis.com/drive/v3/files`;
  
  let pageToken: string | undefined = undefined;
  
  do {
    const params = new URLSearchParams({
      q: `'${folderId}' in parents and trashed=false`,
      fields: "nextPageToken, files(id, name, mimeType, webContentLink)",
      pageSize: "1000",
    });
    
    if (pageToken) {
      params.append("pageToken", pageToken);
    }
    
    const url = `${baseUrl}&${params.toString()}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Google Drive API error: ${response.status} ${response.statusText}`);
    }
    
    const data: DriveListResponse = await response.json();
    
    // Process files
    for (const file of data.files) {
      if (file.mimeType === "application/vnd.google-apps.folder") {
        // Recursively fetch from subfolders
        const subFiles = await fetchAllFilesFromFolder(file.id, apiKey);
        allFiles.push(...subFiles);
      } else if (file.mimeType.startsWith("image/")) {
        // Only include image files
        allFiles.push(file);
      }
    }
    
    pageToken = data.nextPageToken;
  } while (pageToken);
  
  return allFiles;
}

// Download file from Google Drive
async function downloadGoogleDriveFile(fileId: string, apiKey: string | undefined): Promise<ArrayBuffer> {
  const url = apiKey
    ? `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${apiKey}`
    : `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Failed to download file: ${response.status}`);
  }
  
  return response.arrayBuffer();
}

// Start a new Google Drive import job
export const startGoogleDriveImport = action({
  args: {
    folderUrl: v.string(),
  },
  handler: async (ctx, args): Promise<{ jobId: Id<"importJobs"> }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }
    
    // Extract folder ID
    const folderId = extractFolderId(args.folderUrl);
    
    // Create import job
    const jobId: Id<"importJobs"> = await ctx.runMutation(internal.googleDriveImportPublic.createImportJob, {
      folderId,
      folderUrl: args.folderUrl,
    });
    
    // Start processing in background
    await ctx.scheduler.runAfter(0, internal.googleDriveImport.processImportJob, {
      jobId,
    });
    
    return { jobId };
  },
});

// Process import job (internal action - runs in background)
export const processImportJob = internalAction({
  args: {
    jobId: v.id("importJobs"),
  },
  handler: async (ctx, args) => {
    try {
      // Get job details
      const job = await ctx.runMutation(internal.googleDriveImportPublic.getImportJob, {
        jobId: args.jobId,
      });
      
      if (!job) {
        throw new Error("Import job not found");
      }
      
      if (job.status === "paused" || job.status === "completed") {
        return; // Don't process if paused or completed
      }
      
      // Update status to running
      await ctx.runMutation(internal.googleDriveImportPublic.updateImportJobStatus, {
        jobId: args.jobId,
        status: "running",
      });
      
      // Get Google Drive API key from environment (optional)
      const apiKey = process.env.GOOGLE_DRIVE_API_KEY;
      
      // Fetch all files from folder
      console.log(`Fetching files from folder ${job.folderId}...`);
      const files = await fetchAllFilesFromFolder(job.folderId, apiKey);
      
      console.log(`Found ${files.length} image files`);
      
      // Update total files count
      await ctx.runMutation(internal.googleDriveImportPublic.updateImportJobTotalFiles, {
        jobId: args.jobId,
        totalFiles: files.length,
      });
      
      // Process files in batches
      const BATCH_SIZE = 100;
      const CONCURRENT_UPLOADS = 5;
      
      for (let i = 0; i < files.length; i += BATCH_SIZE) {
        // Check if job was paused
        const currentJob = await ctx.runMutation(internal.googleDriveImportPublic.getImportJob, {
          jobId: args.jobId,
        });
        
        if (currentJob?.status === "paused") {
          console.log("Job paused, stopping processing");
          return;
        }
        
        const batch = files.slice(i, Math.min(i + BATCH_SIZE, files.length));
        
        // Check for duplicates in this batch
        const filenames = batch.map(f => f.name);
        const duplicateCheck = await ctx.runMutation(internal.googleDriveImportPublic.checkDuplicatesQuery, {
          filenames,
        });
        
        const missingSet = new Set(duplicateCheck.missingFilenames);
        const filesToUpload = batch.filter(f => missingSet.has(f.name));
        
        // Update skipped count
        const skippedInBatch = batch.length - filesToUpload.length;
        await ctx.runMutation(internal.googleDriveImportPublic.incrementJobProgress, {
          jobId: args.jobId,
          filesChecked: batch.length,
          filesSkipped: skippedInBatch,
        });
        
        // Upload files in parallel (limited concurrency)
        for (let j = 0; j < filesToUpload.length; j += CONCURRENT_UPLOADS) {
          const uploadGroup = filesToUpload.slice(j, Math.min(j + CONCURRENT_UPLOADS, filesToUpload.length));
          
          await Promise.all(uploadGroup.map(async (file) => {
            try {
              // Update current file
              await ctx.runMutation(internal.googleDriveImportPublic.updateImportJobCurrentFile, {
                jobId: args.jobId,
                currentFile: file.name,
              });
              
              // Download file from Google Drive
              const fileData = await downloadGoogleDriveFile(file.id, apiKey);
              
              // Upload to Convex storage
              const blob = new Blob([fileData]);
              const uploadUrl = await ctx.runMutation(internal.googleDriveImportPublic.generateUploadUrl, {});
              
              const uploadResult = await fetch(uploadUrl, {
                method: "POST",
                body: blob,
              });
              
              if (!uploadResult.ok) {
                throw new Error(`Upload failed: ${uploadResult.status}`);
              }
              
              const { storageId } = await uploadResult.json();
              
              // Store mockup with filename
              await ctx.runMutation(internal.googleDriveImportPublic.storeMockupFile, {
                storageId,
                filename: file.name,
              });
              
              // Increment uploaded count
              await ctx.runMutation(internal.googleDriveImportPublic.incrementJobProgress, {
                jobId: args.jobId,
                filesUploaded: 1,
              });
              
            } catch (error) {
              console.error(`Failed to process ${file.name}:`, error);
              
              // Record failed file
              await ctx.runMutation(internal.googleDriveImportPublic.recordFailedFile, {
                jobId: args.jobId,
                filename: file.name,
                reason: error instanceof Error ? error.message : "Unknown error",
              });
            }
          }));
        }
        
        // Update checkpoint
        await ctx.runMutation(internal.googleDriveImportPublic.updateImportJobCheckpoint, {
          jobId: args.jobId,
          checkpoint: i + batch.length,
        });
      }
      
      // Mark job as completed
      await ctx.runMutation(internal.googleDriveImportPublic.updateImportJobStatus, {
        jobId: args.jobId,
        status: "completed",
        completedAt: Date.now(),
      });
      
    } catch (error) {
      console.error("Import job failed:", error);
      
      // Mark job as failed
      await ctx.runMutation(internal.googleDriveImportPublic.updateImportJobStatus, {
        jobId: args.jobId,
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
});




