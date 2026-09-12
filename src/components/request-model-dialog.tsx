import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useMutation } from "@/lib/firebase-hooks";
import { api } from "@/lib/firebase-api";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog.tsx";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select.tsx";

/**
 * "We don't have your device — tell us and we'll add it."
 *
 * Lifted out of the homepage, where it lived inline with its own state. The
 * device picker can now be reached from the tab bar as well, and a shopper who
 * cannot find their model there needs the same way out; copying the form would
 * have meant two of them drifting apart.
 */
const CATEGORIES = [
  ["phone", "Phone"], ["tablet", "Tablet"], ["laptop", "Laptop"], ["camera", "Camera"],
  ["lens", "Lens"], ["drone", "Drone"], ["console", "Gaming Console"],
  ["charger", "Charger"], ["mac-mini", "Mac Mini"],
];

export function RequestModelDialog({
  open,
  onOpenChange,
  initialCategory = "",
  initialBrand = "",
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initialCategory?: string;
  initialBrand?: string;
}) {
  const createModelRequest = useMutation(api.modelRequests.createModelRequest);
  const [brand, setBrand] = useState(initialBrand);
  const [model, setModel] = useState("");
  const [category, setCategory] = useState(initialCategory);
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Opened from the picker, the brand and category are already known — asking
  // again for what the shopper just tapped is how a two-field form becomes four.
  useEffect(() => {
    if (open) {
      setBrand(initialBrand);
      setCategory(initialCategory);
    }
  }, [open, initialBrand, initialCategory]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brand || !model || !category || !phone) {
      toast.error("Please fill in all fields");
      return;
    }
    setSubmitting(true);
    try {
      await createModelRequest({
        brandName: brand,
        modelName: model,
        category,
        whatsappPhone: phone,
      });
      toast.success("Request submitted! We'll notify you when it's available.");
      onOpenChange(false);
      setBrand(""); setModel(""); setCategory(""); setPhone("");
    } catch (error) {
      toast.error("Failed to submit request. Please try again.");
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Request your model</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="request-brand">Brand name *</Label>
            <Input
              id="request-brand"
              placeholder="e.g., Apple, Samsung, OnePlus"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="request-model">Model name *</Label>
            <Input
              id="request-model"
              placeholder="e.g., iPhone 15 Pro Max"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="request-category">Device category *</Label>
            <Select value={category} onValueChange={setCategory} required>
              <SelectTrigger id="request-category">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="request-phone">WhatsApp number *</Label>
            <Input
              id="request-phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              placeholder="10-digit mobile"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">
              We'll message you when your model is available
            </p>
          </div>

          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={submitting} className="flex-1">
              {submitting ? "Submitting…" : "Submit request"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
