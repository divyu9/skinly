import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { WhatsAppOptIn } from "@/components/whatsapp-opt-in.tsx";
import { DidYouMean, type SuggestedModel } from "@/components/did-you-mean.tsx";

type SimilarModel = SuggestedModel;

interface RequestModelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allBrands: string[];
  formState: {
    brand: string;
    newBrand: string;
    isNewBrand: boolean;
    model: string;
    category: string;
    whatsApp: string;
    email: string;
    marketingOptIn?: boolean;
    confirmedNotMatch: boolean;
    isSubmitting: boolean;
  };
  similarModels?: SimilarModel[] | null;
  onUpdateForm: (updates: Partial<RequestModelDialogProps["formState"]>) => void;
  onSubmit: () => void;
  onClose: () => void;
  /** A suggested model was tapped: go to its skins. */
  onPickSimilar?: (m: SimilarModel) => void;
}

const DEVICE_CATEGORIES = [
  { value: "phone", label: "Phone" },
  { value: "tablet", label: "Tablet" },
  { value: "laptop", label: "Laptop" },
  { value: "console", label: "Gaming Console" },
  { value: "charger", label: "Charger" },
  { value: "drone", label: "Drone" },
  { value: "camera", label: "Camera" },
  { value: "lens", label: "Camera Lens" },
  { value: "mac-mini", label: "Mac Mini" },
];

export function RequestModelDialog({
  open,
  onOpenChange,
  allBrands,
  formState,
  similarModels,
  onUpdateForm,
  onSubmit,
  onClose,
  onPickSimilar,
}: RequestModelDialogProps) {
  const handleBrandChange = (value: string) => {
    if (value === "other_new_brand") {
      onUpdateForm({ isNewBrand: true, brand: "" });
    } else {
      onUpdateForm({ isNewBrand: false, brand: value });
    }
  };
  
  const handlePhoneChange = (value: string) => {
    const cleaned = value.replace(/\D/g, "").slice(0, 10);
    onUpdateForm({ whatsApp: cleaned });
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Request a Device Model</DialogTitle>
          <DialogDescription>
            Can't find your device? Let us know and we'll add it to our database.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Brand Selection */}
          <div className="space-y-2">
            <Label>Brand *</Label>
            <Select 
              value={formState.isNewBrand ? "other_new_brand" : formState.brand} 
              onValueChange={handleBrandChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a brand" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {allBrands.map((brand) => (
                  <SelectItem key={brand} value={brand}>
                    {brand}
                  </SelectItem>
                ))}
                <SelectItem value="other_new_brand">Other (New Brand)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Custom Brand Input */}
          {formState.isNewBrand && (
            <div className="space-y-2">
              <Label>Enter New Brand Name *</Label>
              <Input
                type="text"
                placeholder="Enter brand name"
                value={formState.newBrand}
                onChange={(e) => onUpdateForm({ newBrand: e.target.value })}
              />
            </div>
          )}

          {/* Model Name */}
          <div className="space-y-2">
            <Label>Model Name *</Label>
            <Input
              type="text"
              placeholder="e.g., iPhone 15 Pro Max"
              value={formState.model}
              onChange={(e) => onUpdateForm({ model: e.target.value })}
            />
          </div>

          {/* Models we already list that this names: one tap to their skins */}
          <DidYouMean models={similarModels} onPick={(m) => onPickSimilar?.(m)} />
          {similarModels && similarModels.length > 0 && (
            <div className="flex items-start gap-2 rounded-lg bg-muted/60 p-3">
              <Checkbox
                id="confirm-not-match"
                checked={formState.confirmedNotMatch}
                onCheckedChange={(checked) =>
                  onUpdateForm({ confirmedNotMatch: checked === true })
                }
              />
              <label
                htmlFor="confirm-not-match"
                className="text-sm font-medium leading-tight cursor-pointer"
              >
                My device is different from the models above
              </label>
            </div>
          )}

          {/* Category Selection */}
          <div className="space-y-2">
            <Label>Device Category *</Label>
            <Select 
              value={formState.category} 
              onValueChange={(value) => onUpdateForm({ category: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {DEVICE_CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* WhatsApp Number */}
          <div className="space-y-2">
            <Label>WhatsApp Number *</Label>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground px-3 py-2 bg-muted rounded-md">
                +91
              </span>
              <Input
                type="tel"
                placeholder="9876543210"
                value={formState.whatsApp}
                onChange={(e) => handlePhoneChange(e.target.value)}
                className="flex-1"
                maxLength={10}
              />
            </div>
          </div>

          {/* Email — the same two messages go here too, in case WhatsApp does not reach. */}
          <div className="space-y-2">
            <Label>Email *</Label>
            <Input
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={formState.email}
              onChange={(e) => onUpdateForm({ email: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              We'll tell you on WhatsApp and email when your device is added
            </p>
          </div>

          <WhatsAppOptIn checked={!!formState.marketingOptIn} onCheckedChange={(v) => onUpdateForm({ marketingOptIn: v })} />

          {/* Submit Button */}
          <div className="flex gap-3 pt-4">
            <Button
              onClick={onSubmit}
              disabled={formState.isSubmitting}
              className="flex-1"
            >
              {formState.isSubmitting ? "Submitting..." : "Submit Request"}
            </Button>
            <Button
              variant="outline"
              onClick={onClose}
              disabled={formState.isSubmitting}
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
