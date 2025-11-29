import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { toast } from "sonner";
import { UploadIcon, TrashIcon, FileTextIcon, CopyIcon, ImageIcon, DownloadIcon, AlertCircleIcon, CheckCircleIcon, FolderIcon, ExternalLinkIcon, PlayIcon, PauseIcon, XIcon, RefreshCwIcon, ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { useConvex } from "convex/react";
import { SignInButton } from "@/components/ui/signin.tsx";
import type { Id } from "@/convex/_generated/dataModel";

interface FailedFile {
  filename: string;
  reason: string;
}

interface BrokenMockup {
  id: string;
  brand: string;
  model: string;
  sku: string;
  fileId: Id<"_storage">;
}

export default function MockupsPage() {
  const [csvData, setCsvData] = useState("");
  const [importing, setImporting] = useState(false);
  const [fileListData, setFileListData] = useState("");
  const [generatedCsv, setGeneratedCsv] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{
    total: number;
    broken: number;
    brokenMockups: BrokenMockup[];
  } | null>(null);
  const [expandedJobs, setExpandedJobs] = useState<Set<string>>(new Set());
  const [activeJobIds, setActiveJobIds] = useState<Set<string>>(new Set());
  const [pausedJobs, setPausedJobs] = useState<Map<string, File[]>>(new Map());
  const [interruptedJobs, setInterruptedJobs] = useState<Set<string>>(new Set());
  const [resumeJobId, setResumeJobId] = useState<Id<"uploadJobs"> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const resumeFileInputRef = useRef<HTMLInputElement>(null);
  const wakeLockRef = useRef<unknown>(null);
  const uploadAbortRefs = useRef<Map<string, boolean>>(new Map());
  
  const MAX_CONCURRENT_JOBS = 3;
  
  const convex = useConvex();
  const mockupsCount = useQuery(api.mockups.getMockupsCount);
  const recentMockups = useQuery(api.mockups.getRecentMockups, { limit: 10 });
  const bulkImport = useMutation(api.mockups.bulkImportMockups);
  const clearAll = useMutation(api.mockups.clearAllMockups);
  const storeMockupFile = useMutation(api.mockupsUpload.storeMockupFile);
  
  // Upload job queries and mutations
  const activeJobs = useQuery(api.uploadJobs.getActiveUploadJobs);
  const allJobs = useQuery(api.uploadJobs.getAllUploadJobs);
  const createJob = useMutation(api.uploadJobs.createUploadJob);
  const updateJobStatus = useMutation(api.uploadJobs.updateJobStatus);
  const updateJobProgress = useMutation(api.uploadJobs.updateJobProgress);
  const addFailedFile = useMutation(api.uploadJobs.addFailedFile);
  const pauseJob = useMutation(api.uploadJobs.pauseUploadJob);
  const resumeJob = useMutation(api.uploadJobs.resumeUploadJob);
  const cancelJob = useMutation(api.uploadJobs.cancelUploadJob);
  const deleteJob = useMutation(api.uploadJobs.deleteUploadJob);
  
  /**
   * Request wake lock to prevent browser/device from sleeping during upload
   */
  const requestWakeLock = async () => {
    try {
      if ('wakeLock' in navigator) {
        interface WakeLockAPI {
          request: (type: 'screen') => Promise<unknown>;
        }
        interface NavigatorWithWakeLock {
          wakeLock: WakeLockAPI;
        }
        const nav = navigator as unknown as NavigatorWithWakeLock;
        wakeLockRef.current = await nav.wakeLock.request('screen');
        console.log('Wake lock acquired - device will stay awake during upload');
      }
    } catch (error) {
      console.warn('Wake lock not supported or failed:', error);
    }
  };
  
  /**
   * Release wake lock when upload is complete
   */
  const releaseWakeLock = async () => {
    try {
      if (wakeLockRef.current) {
        interface WakeLockSentinel {
          release: () => Promise<void>;
        }
        await (wakeLockRef.current as WakeLockSentinel).release();
        wakeLockRef.current = null;
        console.log('Wake lock released');
      }
    } catch (error) {
      console.warn('Failed to release wake lock:', error);
    }
  };
  
  /**
   * Detect interrupted/stuck upload jobs on page load
   */
  useEffect(() => {
    if (!activeJobs) return;
    
    const interrupted = new Set<string>();
    const now = Date.now();
    const FIVE_MINUTES = 5 * 60 * 1000;
    
    for (const job of activeJobs) {
      // Check if job is "running" but not in our active state
      // OR if lastActivityAt is more than 5 minutes ago
      const isStale = job.lastActivityAt ? (now - job.lastActivityAt) > FIVE_MINUTES : false;
      const isNotActive = job.status === "running" && !activeJobIds.has(job._id);
      
      if (isStale || isNotActive) {
        interrupted.add(job._id);
      }
    }
    
    setInterruptedJobs(interrupted);
    
    // Show toast if there are interrupted jobs
    if (interrupted.size > 0) {
      toast.warning(`${interrupted.size} upload job(s) were interrupted`, {
        description: "Click Resume to continue uploading the remaining files",
        duration: 10000,
      });
    }
  }, [activeJobs, activeJobIds]);
  
  const handleBulkImport = async () => {
    if (!csvData.trim()) {
      toast.error("Please paste CSV data");
      return;
    }
    
    setImporting(true);
    try {
      // Parse CSV
      const lines = csvData.trim().split('\n');
      const mockupData = [];
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        // Skip header row if present
        if (i === 0 && line.toLowerCase().startsWith('brand')) {
          continue;
        }
        
        const parts = line.split(',').map(p => p.trim());
        
        if (parts.length < 4) {
          toast.error(`Invalid format on line ${i + 1}. Expected: brand,model,sku,fileId`);
          setImporting(false);
          return;
        }
        
        mockupData.push({
          brand: parts[0],
          model: parts[1],
          sku: parts[2],
          fileId: parts[3] as Id<"_storage">,
        });
      }
      
      if (mockupData.length === 0) {
        toast.error("No valid mockup data found");
        setImporting(false);
        return;
      }
      
      // Import to database
      const result = await bulkImport({ mockups: mockupData });
      
      toast.success(
        `Import complete! ${result.imported} new, ${result.updated} updated, ${result.skipped} skipped`
      );
      setCsvData("");
    } catch (error) {
      console.error('Import error:', error);
      toast.error("Failed to import mockups");
    } finally {
      setImporting(false);
    }
  };
  
  const handleClearAll = async () => {
    if (!confirm('Are you sure you want to delete all mockup mappings? This cannot be undone.')) {
      return;
    }
    
    try {
      let totalDeleted = 0;
      let hasMore = true;
      
      // Keep calling the mutation until all mockups are deleted
      while (hasMore) {
        const result = await clearAll();
        totalDeleted += result.deleted;
        hasMore = result.hasMore;
        
        // Show progress
        if (hasMore) {
          toast.loading(`Deleting mockups... ${totalDeleted} deleted so far`);
        }
      }
      
      toast.success(`Deleted ${totalDeleted} mockups successfully`);
    } catch (error) {
      console.error('Clear error:', error);
      toast.error("Failed to clear mockups");
    }
  };
  
  /**
   * Recursively collect all image files from a directory and its subdirectories
   */
  const collectImagesFromDirectory = async (dirHandle: unknown): Promise<File[]> => {
    const imageFiles: File[] = [];
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
    
    // Cast to handle File System Access API types
    const handle = dirHandle as { values: () => AsyncIterableIterator<{ kind: string; name: string; getFile?: () => Promise<File> }> };
    
    for await (const entry of handle.values()) {
      if (entry.kind === 'file' && entry.getFile) {
        const file = await entry.getFile();
        const hasImageExtension = imageExtensions.some(ext => 
          file.name.toLowerCase().endsWith(ext)
        );
        if (hasImageExtension) {
          imageFiles.push(file);
        }
      } else if (entry.kind === 'directory') {
        // Recursively collect from subdirectories
        const subFiles = await collectImagesFromDirectory(entry);
        imageFiles.push(...subFiles);
      }
    }
    
    return imageFiles;
  };

  /**
   * Handle folder selection using File System Access API
   */
  const handleFolderUpload = async () => {
    try {
      // Check if the File System Access API is supported
      if (!('showDirectoryPicker' in window)) {
        toast.error("Folder upload not supported in this browser. Please use Chrome, Edge, or another Chromium-based browser.");
        return;
      }
      
      // Check if we're in an iframe (Hercules preview)
      if (window !== window.top) {
        toast.error("Folder upload doesn't work in preview mode", {
          description: "Open this page in a new tab to use folder upload, or use 'Select Files' instead",
          duration: 6000,
        });
        return;
      }
      
      // Show directory picker
      interface WindowWithDirectoryPicker extends Window {
        showDirectoryPicker: () => Promise<unknown>;
      }
      const dirHandle = await (window as WindowWithDirectoryPicker).showDirectoryPicker();
      
      toast.info("Scanning folder and subfolders for images...");
      
      // Collect all image files recursively
      const imageFiles = await collectImagesFromDirectory(dirHandle);
      
      if (imageFiles.length === 0) {
        toast.error("No image files found in the selected folder");
        return;
      }
      
      toast.success(`Found ${imageFiles.length} images. Starting upload...`);
      
      // Process the collected files
      await processFilesUpload(imageFiles);
      
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        // User cancelled the picker
        return;
      }
      
      // Check for iframe/security error
      if ((error as Error).message?.includes('Cross origin') || (error as Error).message?.includes('sub frame')) {
        toast.error("Folder upload requires opening in a new tab", {
          description: "Right-click the page and select 'Open in new tab', or use 'Select Files' instead",
          duration: 8000,
        });
        return;
      }
      
      console.error('Folder selection error:', error);
      toast.error("Failed to access folder");
    }
  };

  /**
   * Process file upload with job tracking (batched)
   */
  const processFilesUpload = async (files: File[] | FileList, resumeFromBatch?: number, existingJobId?: Id<"uploadJobs">) => {
    // Check if at max concurrent jobs
    if (!existingJobId && activeJobIds.size >= MAX_CONCURRENT_JOBS) {
      toast.error(`Maximum ${MAX_CONCURRENT_JOBS} concurrent uploads. Please wait for one to finish.`);
      return;
    }
    
    const fileArray = Array.from(files);
    const BATCH_SIZE = 50;
    
    // Check which files already exist in the database (for both new AND resumed jobs)
    let filesToUpload = fileArray;
    let alreadySkipped = 0;
    
    toast.info("Checking for duplicate files...", { duration: 2000 });
    
    try {
      const filenames = fileArray.map(f => f.name);
      const checkResult = await convex.query(api.mockups.checkExistingMockupFilenames, {
        filenames,
      });
      
      // Filter to only upload missing files
      const missingSet = new Set(checkResult.missingFilenames);
      filesToUpload = fileArray.filter(file => missingSet.has(file.name));
      alreadySkipped = checkResult.existing;
      
      if (alreadySkipped > 0) {
        const message = existingJobId 
          ? `Resuming: ${alreadySkipped} files already uploaded! Processing ${filesToUpload.length} remaining files.`
          : `${alreadySkipped} files already uploaded! Processing ${filesToUpload.length} remaining files.`;
        toast.success(message, { duration: 5000 });
      }
      
      if (filesToUpload.length === 0) {
        toast.info("All files have already been uploaded!");
        if (existingJobId) {
          // Mark job as completed since all files are already uploaded
          await updateJobStatus({ jobId: existingJobId, status: "completed" });
        }
        return;
      }
    } catch (error) {
      console.error("Failed to check existing mockups:", error);
      toast.warning("Could not check for existing files. Uploading all files...");
    }
    
    // Create or use existing upload job
    const jobId = existingJobId || await createJob({
      jobName: `Upload ${filesToUpload.length} files`,
      totalFiles: filesToUpload.length,
    });
    
    // Track this job as active
    setActiveJobIds(prev => new Set(prev).add(jobId));
    uploadAbortRefs.current.set(jobId, false);
    
    // Acquire wake lock
    await requestWakeLock();
    
    // Update job to running
    await updateJobStatus({ jobId, status: "running" });
    
    const startBatch = resumeFromBatch || 0;
    let filesUploaded = 0;
    let filesFailed = 0;
    
    try {
      // Process files in batches
      for (let batchNum = startBatch; batchNum < Math.ceil(filesToUpload.length / BATCH_SIZE); batchNum++) {
        // Check if upload was paused or cancelled
        if (uploadAbortRefs.current.get(jobId)) {
          const isPaused = pausedJobs.has(jobId);
          await updateJobStatus({ 
            jobId, 
            status: isPaused ? "paused" : "cancelled" 
          });
          break;
        }
        
        const startIdx = batchNum * BATCH_SIZE;
        const endIdx = Math.min(startIdx + BATCH_SIZE, filesToUpload.length);
        const batch = filesToUpload.slice(startIdx, endIdx);
        
        console.log(`[Job ${jobId}] Processing batch ${batchNum + 1}/${Math.ceil(filesToUpload.length / BATCH_SIZE)}: ${batch.length} files`);
        
        // Process each file in the batch
        for (let i = 0; i < batch.length; i++) {
          // Check pause/cancel again
          if (uploadAbortRefs.current.get(jobId)) {
            break;
          }
          
          const file = batch[i];
          const fileIndex = startIdx + i;
          
          try {
            // Update current file
            await updateJobProgress({
              jobId,
              currentFile: file.name,
              currentBatch: batchNum,
              filesChecked: fileIndex + 1,
            });
            
            // Validate filename
            const filename = file.name;
            const hasValidExtension = /\.(jpg|jpeg|png|webp)$/i.test(filename);
            if (!hasValidExtension) {
              await addFailedFile({
                jobId,
                filename,
                reason: "Invalid file extension. Expected: .jpg, .jpeg, .png, or .webp"
              });
              filesFailed++;
              continue;
            }
            
            const nameWithoutExt = filename.replace(/\.(jpg|jpeg|png|webp)$/i, '');
            const hasMinimumParts = nameWithoutExt.split('_').length >= 2;
            if (!hasMinimumParts) {
              await addFailedFile({
                jobId,
                filename,
                reason: "Invalid filename format. Expected at least: Model_SKU.jpg"
              });
              filesFailed++;
              continue;
            }
            
            // Upload to storage
            const uploadUrl = await convex.mutation(api.mockups.generateUploadUrl, {});
            const uploadResult = await fetch(uploadUrl, {
              method: "POST",
              headers: { "Content-Type": file.type },
              body: file,
            });
            
            if (!uploadResult.ok) {
              throw new Error(`Upload failed with status ${uploadResult.status}`);
            }
            
            const { storageId } = await uploadResult.json() as { storageId: Id<"_storage"> };
            
            // Store mockup
            const result = await storeMockupFile({
              fileId: storageId,
              filename,
            });
            
            if (result.action === "created" || result.action === "updated") {
              filesUploaded++;
              await updateJobProgress({
                jobId,
                filesUploaded,
              });
            }
            
          } catch (error) {
            console.error(`Failed to upload ${file.name}:`, error);
            const errorMessage = error instanceof Error ? error.message : "Upload or processing error";
            
            await addFailedFile({
              jobId,
              filename: file.name,
              reason: errorMessage
            });
            filesFailed++;
          }
        }
        
        // Small pause between batches
        if (batchNum < Math.ceil(filesToUpload.length / BATCH_SIZE) - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      // Mark job as complete if not cancelled/paused
      if (!uploadAbortRefs.current.get(jobId)) {
        await updateJobStatus({ jobId, status: "completed" });
        toast.success(`Upload complete! ${filesUploaded} uploaded, ${filesFailed} failed`);
      }
      
    } catch (error) {
      console.error('Upload error:', error);
      await updateJobStatus({ 
        jobId, 
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "Unknown error"
      });
      toast.error("Upload job failed");
    } finally {
      await releaseWakeLock();
      // Remove from active jobs
      setActiveJobIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(jobId);
        return newSet;
      });
      uploadAbortRefs.current.delete(jobId);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  /**
   * Handle file input change (user selected files)
   */
  const handleBulkUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    await processFilesUpload(files);
  };

  /**
   * Handle pause button
   */
  const handlePause = async (jobId: Id<"uploadJobs">) => {
    const job = await convex.query(api.uploadJobs.getUploadJob, { jobId });
    if (!job) return;
    
    // Store files for this job
    setPausedJobs(prev => {
      const newMap = new Map(prev);
      newMap.set(jobId, []); // Files will need to be re-selected on resume
      return newMap;
    });
    
    uploadAbortRefs.current.set(jobId, true);
    await pauseJob({ jobId });
    toast.info("Upload paused");
  };

  /**
   * Handle resume button (files)
   */
  const handleResume = async (jobId: Id<"uploadJobs">) => {
    const job = await convex.query(api.uploadJobs.getUploadJob, { jobId });
    if (!job) return;
    
    // Store job ID for resume
    setResumeJobId(jobId);
    
    // Remove from interrupted jobs set
    setInterruptedJobs(prev => {
      const newSet = new Set(prev);
      newSet.delete(jobId);
      return newSet;
    });
    
    // Trigger file picker
    toast.info("Select ALL original files to resume", {
      description: "The system will automatically skip already uploaded files and continue from where it stopped.",
      duration: 8000,
    });
    
    resumeFileInputRef.current?.click();
  };

  /**
   * Handle resume button (folder)
   */
  const handleResumeFolder = async (jobId: Id<"uploadJobs">) => {
    const job = await convex.query(api.uploadJobs.getUploadJob, { jobId });
    if (!job) return;
    
    try {
      // Check if the File System Access API is supported
      if (!('showDirectoryPicker' in window)) {
        toast.error("Folder upload not supported in this browser. Use 'Resume with Files' instead.");
        return;
      }
      
      // Check if we're in an iframe (Hercules preview)
      if (window !== window.top) {
        toast.error("Folder resume doesn't work in preview mode", {
          description: "Open this page in a new tab to resume with folder, or use 'Resume with Files' instead",
          duration: 6000,
        });
        return;
      }
      
      // Remove from interrupted jobs set
      setInterruptedJobs(prev => {
        const newSet = new Set(prev);
        newSet.delete(jobId);
        return newSet;
      });
      
      // Show directory picker
      interface WindowWithDirectoryPicker extends Window {
        showDirectoryPicker: () => Promise<unknown>;
      }
      const dirHandle = await (window as WindowWithDirectoryPicker).showDirectoryPicker();
      
      toast.info("Scanning folder for images...", {
        description: "Already uploaded files will be automatically skipped",
        duration: 5000,
      });
      
      // Collect all image files recursively
      const imageFiles = await collectImagesFromDirectory(dirHandle);
      
      if (imageFiles.length === 0) {
        toast.error("No image files found in the selected folder");
        return;
      }
      
      toast.success(`Found ${imageFiles.length} images. Resuming upload...`);
      
      // Process the collected files with the existing job ID
      await processFilesUpload(imageFiles, 0, jobId);
      
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        // User cancelled the picker
        // Re-add to interrupted jobs since they didn't complete the resume
        setInterruptedJobs(prev => new Set(prev).add(jobId));
        return;
      }
      
      // Check for iframe/security error
      if ((error as Error).message?.includes('Cross origin') || (error as Error).message?.includes('sub frame')) {
        toast.error("Folder resume requires opening in a new tab", {
          description: "Right-click the page and select 'Open in new tab', or use 'Resume with Files' instead",
          duration: 8000,
        });
        return;
      }
      
      console.error('Folder selection error:', error);
      toast.error("Failed to access folder. Try 'Resume with Files' instead.");
    }
  };

  /**
   * Handle cancel button
   */
  const handleCancel = async (jobId: Id<"uploadJobs">) => {
    uploadAbortRefs.current.set(jobId, true);
    await cancelJob({ jobId });
    
    // Clean up
    setPausedJobs(prev => {
      const newMap = new Map(prev);
      newMap.delete(jobId);
      return newMap;
    });
    
    toast.info("Upload cancelled");
  };

  /**
   * Handle retry failed files
   */
  const handleRetryFailed = async (jobId: Id<"uploadJobs">) => {
    const failedFiles = await convex.query(api.uploadJobs.getFailedFilesForRetry, { jobId });
    
    if (failedFiles.length === 0) {
      toast.info("No failed files to retry");
      return;
    }
    
    toast.info(`Retrying ${failedFiles.length} failed files...`);
    
    // Since we can't recreate File objects from filenames, we'll need to ask user to reselect
    toast.warning("Please reselect the failed files to retry upload", {
      description: "The system cannot retry files automatically. Please select them again.",
      duration: 8000,
    });
  };

  /**
   * Toggle job expansion
   */
  const toggleJobExpansion = (jobId: string) => {
    setExpandedJobs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(jobId)) {
        newSet.delete(jobId);
      } else {
        newSet.add(jobId);
      }
      return newSet;
    });
  };
  
  const handleParseFileList = () => {
    if (!fileListData.trim()) {
      toast.error("Please paste file list data");
      return;
    }
    
    try {
      const lines = fileListData.trim().split('\n');
      const csvLines = ['brand,model,sku,fileId'];
      let parsed = 0;
      let skipped = 0;
      
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        
        // Extract file ID (pattern: file_xxxxx or https://cdn.hercules.app/file_xxxxx)
        let fileId = '';
        if (trimmed.startsWith('file_')) {
          fileId = trimmed.split(/[\s,\t]/)[0];
        } else if (trimmed.includes('file_')) {
          const match = trimmed.match(/file_[a-zA-Z0-9]+/);
          if (match) fileId = match[0];
        }
        
        if (!fileId) {
          skipped++;
          continue;
        }
        
        // Extract filename (look for pattern before .jpg, .png, .jpeg)
        let filename = '';
        const filenameMatch = trimmed.match(/([a-zA-Z0-9_-]+)\.(jpg|jpeg|png|webp)/i);
        if (filenameMatch) {
          filename = filenameMatch[1];
        } else {
          // Try to find filename in the line
          const parts = trimmed.split(/[\s,\t]/);
          for (const part of parts) {
            if (part.includes('_') && !part.startsWith('file_')) {
              filename = part.replace(/\.(jpg|jpeg|png|webp)$/i, '');
              break;
            }
          }
        }
        
        if (!filename) {
          skipped++;
          continue;
        }
        
        // Parse filename: Brand_Model_SKU.jpg or Model_SKU.jpg (for iPhone/iPad)
        // Examples:
        // - Apple_iPhone 15 Pro_M-174.jpg
        // - iPhone 16 Plus_M-174.jpg (auto-detects Apple)
        // - Samsung_Galaxy S24_M-174.jpg
        // - Oppo_15 Pro_M-174.jpg
        const parts = filename.split('_');
        
        if (parts.length < 2) {
          skipped++;
          continue;
        }
        
        // Last part is always SKU
        const sku = parts[parts.length - 1];
        
        // Check if filename contains iPhone or iPad to auto-detect Apple brand
        const filenameLower = filename.toLowerCase();
        const isAppleDevice = filenameLower.includes('iphone') || filenameLower.includes('ipad');
        
        let brand: string;
        let model: string;
        
        if (isAppleDevice) {
          // Auto-detect Apple brand
          brand = 'Apple';
          // Model is everything except the last part (SKU)
          model = parts.slice(0, -1).join(' ');
        } else if (parts.length === 2) {
          // Format: Model_SKU.jpg (no brand specified) - skip non-Apple devices
          skipped++;
          continue;
        } else {
          // Format: Brand_Model_SKU.jpg (3+ parts)
          brand = parts[0];
          // Model is everything between brand and SKU
          model = parts.slice(1, -1).join(' ');
        }
        
        if (!brand || !model || !sku) {
          skipped++;
          continue;
        }
        
        csvLines.push(`${brand},${model},${sku},${fileId}`);
        parsed++;
      }
      
      if (parsed === 0) {
        toast.error("No valid files parsed. Check your file naming convention: Brand_Model_SKU.jpg or iPhone_Model_SKU.jpg");
        return;
      }
      
      const csv = csvLines.join('\n');
      setGeneratedCsv(csv);
      toast.success(`Parsed ${parsed} files! ${skipped} skipped. Review and copy to import.`);
    } catch (error) {
      console.error('Parse error:', error);
      toast.error("Failed to parse file list");
    }
  };
  

  const handleVerifyMockups = async () => {
    setVerifying(true);
    try {
      const result = await convex.query(api.mockups.verifyMockupFiles, {});
      setVerificationResult(result);
      
      if (result.broken === 0) {
        toast.success(`✓ All ${result.total} mockups verified successfully!`);
      } else {
        toast.error(`Found ${result.broken} broken mockup links out of ${result.total} total`);
      }
    } catch (error) {
      console.error('Verification error:', error);
      toast.error("Failed to verify mockups");
    } finally {
      setVerifying(false);
    }
  };
  
  const handleDownloadBrokenReport = () => {
    if (!verificationResult || verificationResult.broken === 0) {
      toast.error("No broken mockups to download");
      return;
    }
    
    // Generate CSV report
    const csvLines = ['Brand,Model,SKU,FileID'];
    verificationResult.brokenMockups.forEach(mockup => {
      csvLines.push(`${mockup.brand},${mockup.model},${mockup.sku},${mockup.fileId}`);
    });
    
    const csvContent = csvLines.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `mockup-broken-links-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    
    toast.success(`Downloaded report with ${verificationResult.broken} broken mockups`);
  };
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Release wake lock if component unmounts
      if (wakeLockRef.current) {
        releaseWakeLock();
      }
    };
  }, []);
  
  return (
    <>
      <Unauthenticated>
        <div className="container mx-auto py-16 px-4 text-center">
          <h1 className="text-3xl font-bold mb-4">Mockup Management</h1>
          <p className="text-muted-foreground mb-6">
            Please sign in to access the mockup management system
          </p>
          <SignInButton />
        </div>
      </Unauthenticated>
      
      <AuthLoading>
        <div className="container mx-auto py-8 px-4">
          <Skeleton className="h-12 w-64 mb-4" />
          <Skeleton className="h-64 w-full" />
        </div>
      </AuthLoading>
      
      <Authenticated>
        <div className="container mx-auto py-8 px-4">
          <div className="mb-6 flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold">Mockup Management</h1>
              <p className="text-muted-foreground mt-2">
                Upload mockup images with automatic parsing and import
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => window.location.href = '/admin/google-drive-import'}
              >
                <FolderIcon className="h-4 w-4 mr-2" />
                Google Drive Import
              </Button>
              <Button
                variant="outline"
                onClick={() => window.location.href = '/admin/mockups/missing'}
              >
                <AlertCircleIcon className="h-4 w-4 mr-2" />
                Check Missing Mockups
              </Button>
            </div>
          </div>
        
        {/* Large Upload Warning */}
        <Card className="mb-6 border-orange-200 bg-orange-50/50">
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <AlertCircleIcon className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
              <div className="space-y-2 text-sm">
                <p className="font-semibold text-orange-900">
                  ⚠️ Uploading 1,000+ files? Use your published app instead!
                </p>
                <p className="text-orange-800">
                  The preview environment has session timeouts that can interrupt large uploads. For bulk uploads over 1,000 files, <strong>publish your app first</strong> and upload through the live site for best reliability.
                </p>
                <div className="flex gap-2 pt-1">
                  <Button 
                    size="sm" 
                    variant="secondary"
                    className="border-orange-300"
                    onClick={() => window.open('/admin/mockups', '_blank')}
                  >
                    Open in New Tab
                  </Button>
                  <Button 
                    size="sm" 
                    variant="secondary"
                    className="border-orange-300"
                    onClick={() => toast.info("Click the 'Publish' button in the top right of the App Builder")}
                  >
                    How to Publish
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Recommended Method: Direct Upload */}
        <Card className="mb-6 border-green-200 bg-green-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-700">
              <ImageIcon className="h-5 w-5" />
              ⭐ Recommended: Bulk Upload Mockups
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-white border border-green-200 rounded p-4 text-sm space-y-3">
              <p className="font-semibold text-green-800">
                ✨ Upload 100k+ files directly - No manual work required!
              </p>
              <ol className="space-y-1.5 list-decimal list-inside ml-2">
                <li>Name your files: <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">Brand_Model_SKU.jpg</code></li>
                <li>Either select individual files or choose a folder (scans all subfolders automatically)</li>
                <li>Upload below - Automatic parsing & import!</li>
              </ol>
              <div className="bg-amber-50 border border-amber-200 rounded p-3 text-xs">
                <p className="font-semibold mb-1">Examples:</p>
                <ul className="space-y-0.5 ml-4 list-disc">
                  <li><code>Apple_iPhone15Pro_M-174.jpg</code></li>
                  <li><code>iPhone 16 Plus_M-174.jpg</code> <span className="text-amber-700">(Spaces OK!)</span></li>
                  <li><code>iPhone16_M-174.jpg</code> <span className="text-amber-700">(Auto-detects Apple)</span></li>
                  <li><code>Google Pixel 9A_L-03.jpg</code> <span className="text-amber-700">(Auto-detects Google)</span></li>
                  <li><code>Google_Pixel_9A_L-03.jpg</code> <span className="text-amber-700">(Underscores OK!)</span></li>
                  <li><code>Samsung_GalaxyS24_M-174.jpg</code></li>
                  <li><code>Oppo_15Pro_M-174.jpg</code></li>
                </ul>
                <div className="mt-2 space-y-1">
                  <p className="text-amber-800 font-medium">
                    💡 Files with "iPhone", "iPad", or starting with "Google" automatically detect brand
                  </p>
                  <p className="text-green-700 font-medium">
                    ✅ Spaces in model names don't matter - "iPhone 16 Plus" matches "iPhone16Plus"
                  </p>
                </div>
              </div>
              
              {/* Folder Upload Info */}
              {window !== window.top && (
                <div className="bg-blue-50 border border-blue-200 rounded p-3 text-xs">
                  <p className="font-semibold text-blue-800 mb-1.5">
                    📁 To use "Select Folder":
                  </p>
                  <p className="text-blue-700 mb-2">
                    Folder upload requires opening this page in a new tab due to browser security restrictions.
                  </p>
                  <a 
                    href={window.location.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-blue-800 font-semibold hover:text-blue-900 underline"
                  >
                    Open Admin Mockups in New Tab
                    <ExternalLinkIcon className="h-3.5 w-3.5" />
                  </a>
                </div>
              )}
            </div>
            
            <div className="border-2 border-dashed border-green-300 rounded-lg p-8 text-center bg-white">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => handleBulkUpload(e.target.files)}
                disabled={activeJobIds.size >= MAX_CONCURRENT_JOBS}
              />
              <input
                ref={resumeFileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={async (e) => {
                  if (e.target.files && resumeJobId) {
                    await processFilesUpload(e.target.files, 0, resumeJobId);
                    setResumeJobId(null);
                    if (resumeFileInputRef.current) {
                      resumeFileInputRef.current.value = '';
                    }
                  }
                }}
              />
              
              <ImageIcon className="h-12 w-12 mx-auto text-green-600 mb-3" />
              
              {/* Upload slots indicator */}
              {activeJobIds.size > 0 && (
                <div className="mb-4 inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-full text-sm">
                  <UploadIcon className="h-4 w-4 text-blue-600" />
                  <span className="font-medium text-blue-700">
                    {activeJobIds.size} / {MAX_CONCURRENT_JOBS} upload slots used
                  </span>
                </div>
              )}
              
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button
                  size="lg"
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-green-600 hover:bg-green-700"
                  disabled={activeJobIds.size >= MAX_CONCURRENT_JOBS}
                >
                  <UploadIcon className="h-5 w-5 mr-2" />
                  Select Files
                </Button>
                <Button
                  size="lg"
                  onClick={handleFolderUpload}
                  variant="secondary"
                  className="border-2 border-green-600"
                  disabled={activeJobIds.size >= MAX_CONCURRENT_JOBS}
                >
                  <FolderIcon className="h-5 w-5 mr-2" />
                  Select Folder
                </Button>
              </div>
              <p className="text-sm text-muted-foreground mt-3">
                Supports JPG, PNG, WEBP • Folder selection scans all subfolders
              </p>
              {activeJobIds.size >= MAX_CONCURRENT_JOBS && (
                <p className="text-sm text-amber-600 font-medium mt-2">
                  Maximum concurrent uploads reached. Wait for one to finish.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
        
        {/* Active Upload Jobs */}
        {activeJobs && activeJobs.length > 0 && (
          <Card className="mb-6 border-blue-200 bg-blue-50/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-700">
                <UploadIcon className="h-5 w-5" />
                Active Upload Jobs ({activeJobs.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {activeJobs.map((job) => {
                const progress = job.totalFiles > 0 
                  ? ((job.filesChecked / job.totalFiles) * 100).toFixed(1)
                  : 0;
                const isRunning = job.status === "running";
                const isPaused = job.status === "paused";
                const isInterrupted = interruptedJobs.has(job._id);
                
                return (
                  <div key={job._id} className={`bg-white border rounded p-4 ${isInterrupted ? 'border-amber-400 bg-amber-50/30' : 'border-blue-200'}`}>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold">{job.jobName}</h3>
                          {isInterrupted && (
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full flex items-center gap-1">
                              <AlertCircleIcon className="h-3 w-3" />
                              Interrupted
                            </span>
                          )}
                          {isRunning && !isInterrupted && (
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                              Running
                            </span>
                          )}
                          {isPaused && (
                            <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded-full">
                              Paused
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {job.filesChecked} / {job.totalFiles} files checked
                          {job.currentFile && <span className="ml-2">• Current: {job.currentFile}</span>}
                        </p>
                        {isInterrupted && (
                          <p className="text-sm text-amber-700 mt-1 font-medium">
                            Upload was interrupted. Choose how to resume:
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {isInterrupted && (
                          <>
                            <Button
                              size="sm"
                              variant="default"
                              className="bg-amber-600 hover:bg-amber-700"
                              onClick={() => handleResume(job._id)}
                            >
                              <PlayIcon className="h-4 w-4 mr-1" />
                              Resume with Files
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => handleResumeFolder(job._id)}
                            >
                              <FolderIcon className="h-4 w-4 mr-1" />
                              Resume with Folder
                            </Button>
                          </>
                        )}
                        {isRunning && !isInterrupted && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handlePause(job._id)}
                          >
                            <PauseIcon className="h-4 w-4" />
                          </Button>
                        )}
                        {isPaused && !isInterrupted && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleResume(job._id)}
                          >
                            <PlayIcon className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleCancel(job._id)}
                        >
                          <XIcon className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    
                    <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    
                    <div className="grid grid-cols-4 gap-2 text-xs">
                      <div className="text-center">
                        <div className="font-semibold text-green-600">{job.filesUploaded}</div>
                        <div className="text-muted-foreground">Uploaded</div>
                      </div>
                      <div className="text-center">
                        <div className="font-semibold text-gray-600">{job.filesSkipped}</div>
                        <div className="text-muted-foreground">Skipped</div>
                      </div>
                      <div className="text-center">
                        <div className="font-semibold text-red-600">{job.filesFailed}</div>
                        <div className="text-muted-foreground">Failed</div>
                      </div>
                      <div className="text-center">
                        <div className="font-semibold text-blue-600">{progress}%</div>
                        <div className="text-muted-foreground">Progress</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}
        
        {/* Upload Job History */}
        {allJobs && allJobs.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileTextIcon className="h-5 w-5" />
                Upload Job History
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {allJobs.slice(0, 10).map((job) => {
                const isExpanded = expandedJobs.has(job._id);
                const statusColor = 
                  job.status === "completed" ? "text-green-600" :
                  job.status === "failed" ? "text-red-600" :
                  job.status === "cancelled" ? "text-gray-600" :
                  "text-blue-600";
                
                return (
                  <div key={job._id} className="border rounded p-3">
                    <div 
                      className="flex items-center justify-between cursor-pointer"
                      onClick={() => toggleJobExpansion(job._id)}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">{job.jobName}</h4>
                          <span className={`text-xs font-semibold ${statusColor} capitalize`}>
                            {job.status}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {new Date(job.startedAt || 0).toLocaleString()} • 
                          {job.filesUploaded} uploaded, {job.filesFailed} failed
                        </p>
                      </div>
                      <Button variant="ghost" size="sm">
                        {isExpanded ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />}
                      </Button>
                    </div>
                    
                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t space-y-3">
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div>
                            <div className="font-semibold">Total Files</div>
                            <div className="text-muted-foreground">{job.totalFiles}</div>
                          </div>
                          <div>
                            <div className="font-semibold">Uploaded</div>
                            <div className="text-green-600">{job.filesUploaded}</div>
                          </div>
                          <div>
                            <div className="font-semibold">Failed</div>
                            <div className="text-red-600">{job.filesFailed}</div>
                          </div>
                        </div>
                        
                        {job.failedFiles.length > 0 && (
                          <div className="bg-red-50 border border-red-200 rounded p-2">
                            <p className="text-xs font-semibold text-red-800 mb-2">
                              Failed Files ({job.failedFiles.length})
                            </p>
                            <div className="max-h-32 overflow-y-auto space-y-1">
                              {job.failedFiles.map((file, idx) => (
                                <div key={idx} className="text-xs">
                                  <span className="font-mono">{file.filename}</span>
                                  <span className="text-muted-foreground ml-2">- {file.reason}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        <div className="flex gap-2">
                          {job.filesFailed > 0 && job.status === "completed" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRetryFailed(job._id)}
                            >
                              <RefreshCwIcon className="h-3 w-3 mr-1" />
                              Retry Failed
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => deleteJob({ jobId: job._id })}
                          >
                            <TrashIcon className="h-3 w-3 mr-1" />
                            Delete
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}
        
        <div className="mb-4 text-center text-sm text-muted-foreground">
          — OR use alternative methods below —
        </div>
        
        {/* Step 1: Filename Parser */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileTextIcon className="h-5 w-5" />
              Step 1: Extract File List (Auto-Generate CSV)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded p-4 text-sm space-y-3">
              <div>
                <h4 className="font-semibold mb-2">📋 Quick Method (Recommended):</h4>
                <ol className="space-y-1 list-decimal list-inside ml-2">
                  <li>Name files: <code className="bg-white px-1">Brand_Model_SKU.jpg</code> or <code className="bg-white px-1">iPhone_Model_SKU.jpg</code></li>
                  <li>Upload to Files & Media tab</li>
                  <li>Open browser console (F12 or Right-click → Inspect)</li>
                  <li>Paste this script and press Enter:</li>
                </ol>
                <div className="relative">
                  <div className="bg-gray-900 text-green-400 p-3 rounded text-xs font-mono overflow-x-auto">
                    {`// Extract all file info from Files & Media page
const files = [];
document.querySelectorAll('[data-file-id], img[src*="file_"]').forEach(el => {
  const fileId = el.dataset?.fileId || el.src?.match(/file_[a-zA-Z0-9]+/)?.[0];
  const filename = el.alt || el.title || el.textContent || '';
  if (fileId && filename) files.push(\`\${fileId} \${filename}\`);
});
console.log(files.join('\\n'));
copy(files.join('\\n'));
alert('Copied ' + files.length + ' files to clipboard!');`}
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="absolute top-2 right-2"
                    onClick={() => {
                      const script = `// Extract all file info from Files & Media page
const files = [];
document.querySelectorAll('[data-file-id], img[src*="file_"]').forEach(el => {
  const fileId = el.dataset?.fileId || el.src?.match(/file_[a-zA-Z0-9]+/)?.[0];
  const filename = el.alt || el.title || el.textContent || '';
  if (fileId && filename) files.push(\`\${fileId} \${filename}\`);
});
console.log(files.join('\\n'));
copy(files.join('\\n'));
alert('Copied ' + files.length + ' files to clipboard!');`;
                      navigator.clipboard.writeText(script);
                      toast.success("Script copied! Paste in browser console.");
                    }}
                  >
                    <CopyIcon className="h-3 w-3 mr-1" />
                    Copy
                  </Button>
                </div>
                <p className="mt-2 text-xs text-amber-700">
                  ⚡ Script automatically extracts and copies file list
                </p>
              </div>
              
              <div className="border-t pt-3">
                <h4 className="font-semibold mb-2">📝 Manual Method:</h4>
                <p className="text-xs">
                  Manually copy file URLs/IDs from Files & Media in any format
                </p>
              </div>
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">
                Paste File List (any format):
              </label>
              <Textarea
                placeholder="Paste file URLs, file IDs, or filenames here...
Examples:
https://cdn.hercules.app/file_abc123
file_abc123 Apple_iPhone15Pro_M-174.jpg
Samsung_GalaxyS24_M-174.jpg"
                value={fileListData}
                onChange={(e) => setFileListData(e.target.value)}
                className="h-40 font-mono text-xs"
              />
            </div>
            
            <Button onClick={handleParseFileList} className="w-full">
              Generate CSV from File List
            </Button>
            
            {generatedCsv && (
              <div>
                <label className="text-sm font-medium mb-2 block text-green-600">
                  ✓ Generated CSV (copy this to Step 2):
                </label>
                <Textarea
                  value={generatedCsv}
                  readOnly
                  className="h-40 font-mono text-xs bg-green-50"
                />
                <Button
                  variant="outline"
                  onClick={() => {
                    setCsvData(generatedCsv);
                    toast.success("CSV copied to import section below!");
                  }}
                  className="w-full mt-2"
                >
                  Copy to Step 2 Import
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
        
        <div className="grid gap-6 md:grid-cols-2">
          {/* Import Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UploadIcon className="h-5 w-5" />
                Step 2: Import CSV to Database
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">
                  CSV Format (one per line):
                </label>
                <div className="bg-muted p-3 rounded text-xs font-mono mb-3">
                  brand,model,sku,fileId<br/>
                  Apple,iPhone 15 Pro,M-174,file_abc123<br/>
                  Samsung,Galaxy S24,M-174,file_xyz789
                </div>
                
                <Textarea
                  placeholder="Paste CSV data here..."
                  value={csvData}
                  onChange={(e) => setCsvData(e.target.value)}
                  className="h-64 font-mono text-xs"
                />
              </div>
              
              <div className="flex gap-2">
                <Button
                  onClick={handleBulkImport}
                  disabled={importing || !csvData.trim()}
                  className="flex-1"
                >
                  {importing ? "Importing..." : "Import Mockups"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setCsvData("")}
                  disabled={!csvData.trim()}
                >
                  Clear
                </Button>
              </div>
            </CardContent>
          </Card>
          
          {/* Stats Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileTextIcon className="h-5 w-5" />
                Database Stats
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {mockupsCount === undefined ? (
                <Skeleton className="h-20 w-full" />
              ) : (
                <>
                  <div className="bg-muted p-4 rounded">
                    <div className="text-3xl font-bold">{mockupsCount.toLocaleString()}</div>
                    <div className="text-sm text-muted-foreground">Total mockups in database</div>
                  </div>
                  
                  <div className="space-y-2">
                    <h3 className="font-medium text-sm">How to add mockups:</h3>
                    <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                      <li>Upload images to Files & Media tab</li>
                      <li>Copy file IDs (starts with "file_")</li>
                      <li>Create CSV: brand,model,sku,fileId</li>
                      <li>Paste CSV and click Import</li>
                    </ol>
                  </div>
                  
                  {mockupsCount > 0 && (
                    <Button
                      variant="destructive"
                      onClick={handleClearAll}
                      className="w-full"
                    >
                      <TrashIcon className="h-4 w-4 mr-2" />
                      Clear All Mockups
                    </Button>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
        
        {/* Verification Card */}
        {mockupsCount && mockupsCount > 0 && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircleIcon className="h-5 w-5" />
                Verify Mockup Files
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded p-4 text-sm">
                <p className="font-semibold text-blue-800 mb-2">
                  🔍 Check for broken mockup links
                </p>
                <p className="text-blue-700">
                  This will verify that all mockup file IDs in your database actually exist in storage.
                  Broken links occur when files are deleted or when file IDs are incorrect.
                </p>
              </div>
              
              <Button
                onClick={handleVerifyMockups}
                disabled={verifying}
                className="w-full"
                size="lg"
              >
                {verifying ? "Verifying..." : "Verify All Mockups"}
              </Button>
              
              {verificationResult && (
                <div className={`border rounded p-4 ${
                  verificationResult.broken === 0 
                    ? 'bg-green-50 border-green-200' 
                    : 'bg-red-50 border-red-200'
                }`}>
                  <div className="flex items-center gap-2 mb-3">
                    {verificationResult.broken === 0 ? (
                      <>
                        <CheckCircleIcon className="h-5 w-5 text-green-600" />
                        <h3 className="font-semibold text-green-800">
                          ✓ All mockups verified!
                        </h3>
                      </>
                    ) : (
                      <>
                        <AlertCircleIcon className="h-5 w-5 text-red-600" />
                        <h3 className="font-semibold text-red-800">
                          Found {verificationResult.broken} broken link{verificationResult.broken !== 1 ? 's' : ''}
                        </h3>
                      </>
                    )}
                  </div>
                  
                  <div className="text-sm mb-3">
                    <p>Total mockups: <strong>{verificationResult.total}</strong></p>
                    <p className={verificationResult.broken === 0 ? 'text-green-700' : 'text-red-700'}>
                      Broken links: <strong>{verificationResult.broken}</strong>
                    </p>
                  </div>
                  
                  {verificationResult.broken > 0 && (
                    <>
                      <div className="max-h-48 overflow-y-auto border border-red-100 rounded mb-3 bg-white">
                        <table className="w-full text-xs">
                          <thead className="bg-red-100 sticky top-0">
                            <tr>
                              <th className="text-left p-2 font-semibold">Brand</th>
                              <th className="text-left p-2 font-semibold">Model</th>
                              <th className="text-left p-2 font-semibold">SKU</th>
                              <th className="text-left p-2 font-semibold">File ID</th>
                            </tr>
                          </thead>
                          <tbody>
                            {verificationResult.brokenMockups.map((mockup) => (
                              <tr key={mockup.id} className="border-t border-red-100">
                                <td className="p-2">{mockup.brand}</td>
                                <td className="p-2">{mockup.model}</td>
                                <td className="p-2">{mockup.sku}</td>
                                <td className="p-2 font-mono text-xs">{mockup.fileId}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      
                      <div className="flex gap-2">
                        <Button
                          onClick={handleDownloadBrokenReport}
                          variant="destructive"
                          className="flex-1"
                          size="sm"
                        >
                          <DownloadIcon className="h-4 w-4 mr-2" />
                          Download Report (CSV)
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => setVerificationResult(null)}
                          size="sm"
                        >
                          Clear
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}
        
        {/* Preview Recent Mockups */}
        {recentMockups && recentMockups.length > 0 && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Recent Mockups (Last 10)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b">
                    <tr className="text-left">
                      <th className="p-2">Brand</th>
                      <th className="p-2">Model</th>
                      <th className="p-2">SKU</th>
                      <th className="p-2">File ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentMockups.map((mockup) => (
                      <tr key={mockup._id} className="border-b">
                        <td className="p-2">{mockup.brand}</td>
                        <td className="p-2">{mockup.model}</td>
                        <td className="p-2">{mockup.sku}</td>
                        <td className="p-2 font-mono text-xs">{mockup.fileId}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
        </div>
      </Authenticated>
    </>
  );
}
