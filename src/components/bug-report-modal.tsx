import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import {
  UploadIcon,
  XIcon,
  LoaderIcon,
  CheckCircleIcon,
  AlertCircleIcon,
} from "lucide-react";

import { toast } from "sonner";
import { useUser } from "@clerk/clerk-react";

/* ---------------------------------- TYPES --------------------------------- */

interface BugReportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface UploadedFile {
  file: File;
  uploading: boolean;
  error?: string;
  storageId?: Id<"_storage">;
}

/* -------------------------------- COMPONENT -------------------------------- */

export function BugReportModal({
  open,
  onOpenChange,
}: BugReportModalProps) {
  const { user, isLoaded } = useUser();

  /* ------------------------------- FORM STATE ------------------------------- */

  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [details, setDetails] = useState("");
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  /* ------------------------------- CONVEX ----------------------------------- */

  const generateUploadUrl = useMutation(api.bugReports.generateUploadUrl);
  const submitBugReport = useMutation(api.bugReports.submitBugReport);
  const attachFile = useMutation(api.bugReports.attachFileToBug);

  /* ------------------------------- AUTO EMAIL -------------------------------- */

  useEffect(() => {
    if (!isLoaded) return;

    const primaryEmail = user?.emailAddresses?.[0]?.emailAddress;
    if (primaryEmail) {
      setEmail(primaryEmail);
    }
  }, [user, isLoaded]);

  /* ------------------------------ FILE HANDLING ------------------------------ */

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);

    if (files.length + selected.length > 5) {
      toast.error("Maximum 5 files allowed");
      return;
    }

    const valid: UploadedFile[] = [];

    for (const file of selected) {
      if (file.size > 20 * 1024 * 1024) {
        toast.error(`${file.name} exceeds 20MB`);
        continue;
      }

      valid.push({ file, uploading: false });
    }

    setFiles((prev) => [...prev, ...valid]);
    e.target.value = "";
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  /* -------------------------------- SUBMIT ---------------------------------- */

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !email.includes("@")) {
      toast.error("Enter valid email");
      return;
    }

    if (!/^\d{10}$/.test(phone)) {
      toast.error("Enter valid 10-digit phone");
      return;
    }

    if (details.trim().length < 20) {
      toast.error("Bug details minimum 20 characters");
      return;
    }

    setSubmitting(true);

    try {
      const res = await submitBugReport({
        userEmail: email,
        userPhone: phone,
        bugDetails: details,
      });

      for (let i = 0; i < files.length; i++) {
        const f = files[i];

        setFiles((prev) =>
          prev.map((x, idx) =>
            idx === i ? { ...x, uploading: true } : x
          )
        );

        const uploadUrl = await generateUploadUrl();

        const uploadRes = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": f.file.type },
          body: f.file,
        });

        if (!uploadRes.ok) throw new Error("Upload failed");

        const { storageId } = await uploadRes.json();

        await attachFile({
          bugReportId: res.bugReportId,
          fileId: storageId,
          fileName: f.file.name,
          fileSize: f.file.size,
          fileType: f.file.type,
        });

        setFiles((prev) =>
          prev.map((x, idx) =>
            idx === i
              ? { ...x, uploading: false, storageId }
              : x
          )
        );
      }

      toast.success(`Bug submitted • ID ${res.bugId}`);
      setSuccess(true);

      setTimeout(() => {
        resetForm();
        onOpenChange(false);
      }, 2000);
    } catch (err) {
      console.error(err);
      toast.error("Failed to submit bug");
    } finally {
      setSubmitting(false);
    }
  };

  /* -------------------------------- RESET ----------------------------------- */

  const resetForm = () => {
    setPhone("");
    setDetails("");
    setFiles([]);
    setSuccess(false);
  };

  /* --------------------------------- RENDER --------------------------------- */

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Report a Bug</DialogTitle>
          <DialogDescription>
            Help us improve by reporting issues
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="flex flex-col items-center py-10">
            <CheckCircleIcon className="size-14 text-green-600 mb-4" />
            <p className="text-lg font-semibold">
              Bug submitted successfully
            </p>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            {/* EMAIL */}
            <div>
              <Label>Email</Label>
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={submitting}
              />
            </div>

            {/* PHONE */}
            <div>
              <Label>Phone</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={submitting}
                placeholder="9876543210"
              />
            </div>

            {/* DETAILS */}
            <div>
              <Label>Bug Details</Label>
              <Textarea
                rows={5}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                disabled={submitting}
              />
            </div>

            {/* FILE UPLOAD */}
            <div>
              <Label>Attachments (optional)</Label>
              <label className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg h-32 cursor-pointer">
                <UploadIcon className="size-6 mb-2" />
                <span className="text-sm">Click to upload</span>
                <input
                  type="file"
                  multiple
                  className="hidden"
                  onChange={onFileSelect}
                  disabled={submitting || files.length >= 5}
                />
              </label>

              {files.map((f, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between mt-2 bg-muted p-2 rounded"
                >
                  <span className="text-sm truncate">{f.file.name}</span>
                  <div className="flex gap-2">
                    {f.uploading && (
                      <LoaderIcon className="size-4 animate-spin" />
                    )}
                    {!submitting && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(i)}
                      >
                        <XIcon className="size-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* ACTIONS */}
            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Submitting..." : "Submit"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
