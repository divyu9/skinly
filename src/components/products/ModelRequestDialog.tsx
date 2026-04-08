import { memo, useState, useCallback } from "react";
import { useMutation } from "@/lib/firebase-hooks";
import { api } from "@/lib/firebase-api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";

interface ModelRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DEVICE_CATEGORIES = [
  { value: "phone", label: "Phone" },
  { value: "laptop", label: "Laptop" },
  { value: "tablet", label: "Tablet" },
  { value: "camera", label: "Camera" },
  { value: "lens", label: "Lens" },
  { value: "console", label: "Gaming Console" },
  { value: "drone", label: "Drone" },
  { value: "charger", label: "Charger" },
  { value: "mac-mini", label: "Mac Mini" },
];

export const ModelRequestDialog = memo(function ModelRequestDialog({
  open,
  onOpenChange,
}: ModelRequestDialogProps) {
  const [formState, setFormState] = useState({
    brand: "",
    model: "",
    category: "",
    phone: "",
  });
  
  const createModelRequest = useMutation(api.modelRequests.createModelRequest);
  
  const updateField = useCallback((field: string, value: string) => {
    setFormState(prev => ({ ...prev, [field]: value }));
  }, []);
  
  const resetForm = useCallback(() => {
    setFormState({ brand: "", model: "", category: "", phone: "" });
  }, []);
  
  const handleSubmit = useCallback(async () => {
    const { brand, model, category, phone } = formState;
    
    if (!brand.trim() || !model.trim() || !category || !phone.trim()) {
      toast.error("Please fill in all fields");
      return;
    }
    
    try {
      await createModelRequest({
        brandName: brand.trim(),
        modelName: model.trim(),
        category: category,
        whatsappPhone: phone.trim(),
      });
      toast.success("Model request submitted! We'll notify you when it's added.");
      onOpenChange(false);
      resetForm();
    } catch (error) {
      toast.error("Failed to submit request. Please try again.");
      console.error("Model request error:", error);
    }
  }, [formState, createModelRequest, onOpenChange, resetForm]);
  
  const isValid = formState.brand.trim() && 
    formState.model.trim() && 
    formState.category && 
    formState.phone.trim();
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Request Your Model</DialogTitle>
          <DialogDescription>
            Can't find your device? Let us know and we'll add it!
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="brand">Brand *</Label>
            <Input
              id="brand"
              placeholder="e.g., Apple, Samsung, OnePlus"
              value={formState.brand}
              onChange={(e) => updateField("brand", e.target.value)}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="model">Model Name *</Label>
            <Input
              id="model"
              placeholder="e.g., iPhone 15 Pro Max"
              value={formState.model}
              onChange={(e) => updateField("model", e.target.value)}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="category">Device Type *</Label>
            <Select 
              value={formState.category} 
              onValueChange={(value) => updateField("category", value)}
            >
              <SelectTrigger id="category">
                <SelectValue placeholder="Select device type" />
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
          
          <div className="space-y-2">
            <Label htmlFor="phone">WhatsApp Number *</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="e.g., +919876543210"
              value={formState.phone}
              onChange={(e) => updateField("phone", e.target.value)}
            />
          </div>
          
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={handleSubmit}
              disabled={!isValid}
            >
              Submit Request
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
});
