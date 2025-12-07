import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { AlertCircleIcon, CheckCircleIcon, LoaderIcon, UploadIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth.ts";
import type { Id } from "@/convex/_generated/dataModel.d.ts";

interface BugReportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface UploadedFile {
  file: File;
  fileId?: Id<"_storage">;
  uploading: boolean;
  progress: number;
  error?: string;
}

export function BugReportModal({ open, onOpenChange }: BugReportModalProps) {
  const { user } = useAuth();
  const [email, setEmail] = useState(user?.profile.email || "");
  const [phone, setPhone] = useState("");
  const [bugDetails, setBugDetails] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const generateUploadUrl = useMutation(api.bugReports.generateUploadUrl);
  const submitBugReport = useMutation(api.bugReports.submitBugReport);
  const attachFileToBug = useMutation(api.bugReports.attachFileToBug);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    // Check total file count
    if (uploadedFiles.length + files.length > 5) {
      toast.error("Maximum of 5 files allowed per bug report");
      return;
    }

    // Validate each file
    for (const file of files) {
      // Check file size (20MB)
      if (file.size > 20 * 1024 * 1024) {
        toast.error(`${file.name} exceeds 20MB limit`);
        continue;
      }

      // Check file type
      const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp", "video/mp4", "video/webm", "video/mov", "video/quicktime"];
      if (!allowedTypes.includes(file.type.toLowerCase())) {
        toast.error(`${file.name} is not a supported file type`);
        continue;
      }

      // Add to uploaded files
      setUploadedFiles((prev) => [
        ...prev,
        {
          file,
          uploading: false,
          progress: 0,
        },
      ]);
    }

    // Reset input
    e.target.value = "";
  };

  const removeFile = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error("Please enter a valid email address");
      return;
    }

    // Validate phone
    const phoneRegex = /^(\+?\d{1,3})?[\s-]?\d{10}$/;
    if (!phoneRegex.test(phone)) {
      toast.error("Please enter a valid 10-digit phone number");
      return;
    }

    // Validate bug details
    if (bugDetails.length < 20) {
      toast.error("Bug details must be at least 20 characters long");
      return;
    }

    setIsSubmitting(true);

    try {
      // Submit bug report
      const result = await submitBugReport({
        userEmail: email,
        userPhone: phone,
        bugDetails,
      });

      // Upload files
      if (uploadedFiles.length > 0) {
        for (let i = 0; i < uploadedFiles.length; i++) {
          const fileData = uploadedFiles[i];
          
          // Update uploading status
          setUploadedFiles((prev) =>
            prev.map((f, idx) => (idx === i ? { ...f, uploading: true } : f))
          );

          try {
            // Get upload URL
            const uploadUrl = await generateUploadUrl();

            // Upload file
            const uploadResult = await fetch(uploadUrl, {
              method: "POST",
              headers: { "Content-Type": fileData.file.type },
              body: fileData.file,
            });

            if (!uploadResult.ok) {
              throw new Error("Failed to upload file");
            }

            const { storageId } = await uploadResult.json();

            // Attach file to bug
            await attachFileToBug({
              bugReportId: result.bugReportId,
              fileId: storageId,
              fileName: fileData.file.name,
              fileSize: fileData.file.size,
              fileType: fileData.file.type,
            });

            // Update file status
            setUploadedFiles((prev) =>
              prev.map((f, idx) =>
                idx === i ? { ...f, uploading: false, fileId: storageId } : f
              )
            );
          } catch (error) {
            console.error("File upload error:", error);
            setUploadedFiles((prev) =>
              prev.map((f, idx) =>
                idx === i
                  ? {
                      ...f,
                      uploading: false,
                      error: "Upload failed",
                    }
                  : f
              )
            );
          }
        }
      }

      // Show success message
      setSubmitSuccess(true);
      toast.success(`Bug report submitted successfully! Your bug ID: ${result.bugId}`);

      // Reset form after 2 seconds
      setTimeout(() => {
        resetForm();
        onOpenChange(false);
      }, 2000);
    } catch (error) {
      console.error("Submit error:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to submit bug report"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setEmail(user?.profile.email || "");
    setPhone("");
    setBugDetails("");
    setUploadedFiles([]);
    setIsSubmitting(false);
    setSubmitSuccess(false);
  };

  const handleClose = () => {
    if (!isSubmitting) {
      resetForm();
      onOpenChange(false);
    }
  };

  const getTotalFileSize = () => {
    return uploadedFiles.reduce((total, f) => total + f.file.size, 0);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Report a Bug</DialogTitle>
          <DialogDescription>
            Found an issue? Let us know and we'll fix it as soon as possible.
          </DialogDescription>
        </DialogHeader>

        {submitSuccess ? (
          <div className="flex flex-col items-center justify-center py-8">
            <CheckCircleIcon className="size-16 text-green-600 mb-4" />
            <h3 className="text-xl font-semibold mb-2">Bug Report Submitted!</h3>
            <p className="text-muted-foreground text-center">
              Thank you for helping us improve. We'll review your report and get back to you soon.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <Label htmlFor="email">
                Email Address <span className="text-red-500">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="your.email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isSubmitting}
              />
            </div>

            {/* Phone */}
            <div>
              <Label htmlFor="phone">
                Phone Number <span className="text-red-500">*</span>
              </Label>
              <Input
                id="phone"
                type="tel"
                placeholder="9876543210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                disabled={isSubmitting}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Enter a 10-digit phone number
              </p>
            </div>

            {/* Bug Details */}
            <div>
              <Label htmlFor="bugDetails">
                Bug Details <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="bugDetails"
                placeholder="Describe the bug you encountered..."
                value={bugDetails}
                onChange={(e) => setBugDetails(e.target.value)}
                required
                disabled={isSubmitting}
                rows={5}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {bugDetails.length} / 20 characters minimum
              </p>
            </div>

            {/* File Upload */}
            <div>
              <Label>Screenshots / Videos (Optional)</Label>
              <div className="mt-2">
                <label
                  htmlFor="file-upload"
                  className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <UploadIcon className="size-8 mb-2 text-muted-foreground" />
                    <p className="mb-2 text-sm text-muted-foreground">
                      <span className="font-semibold">Click to upload</span> or drag and drop
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Images or videos (max 5 files, 20MB each)
                    </p>
                  </div>
                  <input
                    id="file-upload"
                    type="file"
                    className="hidden"
                    multiple
                    accept="image/*,video/*"
                    onChange={handleFileSelect}
                    disabled={isSubmitting || uploadedFiles.length >= 5}
                  />
                </label>
              </div>

              {/* Uploaded Files List */}
              {uploadedFiles.length > 0 && (
                <div className="mt-4 space-y-2">
                  {uploadedFiles.map((fileData, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-muted rounded-lg"
                    >
                      <div className="flex-1">
                        <p className="text-sm font-medium truncate">
                          {fileData.file.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(fileData.file.size)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {fileData.uploading && (
                          <LoaderIcon className="size-4 animate-spin text-blue-600" />
                        )}
                        {fileData.error && (
                          <AlertCircleIcon className="size-4 text-red-600" />
                        )}
                        {!fileData.uploading && !isSubmitting && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeFile(index)}
                          >
                            <XIcon className="size-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                  <p className="text-xs text-muted-foreground">
                    {uploadedFiles.length} / 5 files ({formatFileSize(getTotalFileSize())} total)
                  </p>
                </div>
              )}
            </div>

            {/* Submit Button */}
            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <LoaderIcon className="size-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Submit Bug Report"
                )}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
