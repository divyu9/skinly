import { useState, useMemo, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Button } from "@/components/ui/button.tsx";
import { 
  SearchIcon, 
  SmartphoneIcon,
  LaptopIcon,
  TabletIcon,
  CameraIcon,
  ScanIcon,
  PlaneIcon,
  CableIcon,
  BoxIcon,
  PackageIcon,
  MonitorIcon,
  GamepadIcon,
  ChevronRightIcon
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@/lib/firebase-hooks";
import { api } from "@/lib/firebase-api";
import type { LucideIcon } from "lucide-react";

interface DeviceSelectorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialDeviceType?: string;
  onRequestModel?: (category: string, brand: string) => void;
}

// Brand logo mapping removed
const brandLogos: Record<string, string> = {};

// Icon mapping for gadget types
const gadgetIcons: Record<string, LucideIcon> = {
  "laptop": LaptopIcon,
  "phone": SmartphoneIcon,
  "camera": CameraIcon,
  "lens": ScanIcon,
  "tablet": TabletIcon,
  "mac-mini": MonitorIcon,
  "console": GamepadIcon,
  "drone": PlaneIcon,
  "charger": CableIcon,
  "cover": BoxIcon,
  "accessory": PackageIcon,
};

export function DeviceSelectorDialog({ open, onOpenChange, initialDeviceType, onRequestModel }: DeviceSelectorDialogProps) {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedDeviceType, setSelectedDeviceType] = useState<string | null>(null);
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch active gadget types from database
  const gadgetTypes = useQuery(api.gadgetTypes.listAllActive);

  // Fetch metadata from cache (super fast!)
  const metadata = useQuery(api.supportedModels.getMetadata);
  
  // Lazy-load models for selected brand + category (only when brand is selected)
  const brandModels = useQuery(
    api.supportedModels.getBrandModels,
    selectedBrand && selectedDeviceType
      ? { brand: selectedBrand, category: selectedDeviceType }
      : "skip"
  );

  // Update state when dialog opens with initialDeviceType
  useEffect(() => {
    if (open && initialDeviceType) {
      setSelectedDeviceType(initialDeviceType);
      setStep(2);
    } else if (!open) {
      // Reset when dialog closes
      setStep(1);
      setSelectedDeviceType(null);
      setSelectedBrand(null);
      setSearchQuery("");
    }
  }, [open, initialDeviceType]);

  // Get brands for selected device type from cache
  const availableBrands = useMemo(() => {
    if (!metadata || !selectedDeviceType) return [];
    
    const categoryKey = selectedDeviceType === "mac-mini" ? "macMini" : selectedDeviceType;
    const categoryData = metadata.byCategory[categoryKey as keyof typeof metadata.byCategory];
    
    return categoryData?.brands || [];
  }, [metadata, selectedDeviceType]);

  // Get models for selected brand with search filter
  const availableModels = useMemo(() => {
    if (!brandModels) return [];
    const models = brandModels.map(m => m.modelName);
    
    if (!searchQuery) return models;
    
    const query = searchQuery.toLowerCase();
    return models.filter(model => model.toLowerCase().includes(query));
  }, [brandModels, searchQuery]);

  const handleDeviceTypeSelect = (type: string) => {
    setSelectedDeviceType(type);
    setStep(2);
  };

  const handleBrandSelect = (brand: string) => {
    setSelectedBrand(brand);
    setSearchQuery("");
    setStep(3);
  };

  const handleModelSelect = (model: string) => {
    if (!selectedBrand) return;
    
    // All devices go directly to products page with smart filters
    navigate(`/products?brand=${encodeURIComponent(selectedBrand)}&model=${encodeURIComponent(model)}&fromGadgetSelector=true`);
    onOpenChange(false);
    
    // Reset state
    setStep(1);
    setSelectedDeviceType(null);
    setSelectedBrand(null);
    setSearchQuery("");
  };

  const handleBack = () => {
    if (step === 3) {
      setStep(2);
      setSelectedBrand(null);
      setSearchQuery("");
    } else if (step === 2) {
      setStep(1);
      setSelectedDeviceType(null);
    }
  };

  const getGadgetIcon = (name: string): LucideIcon => {
    return gadgetIcons[name] || PackageIcon; // Default icon
  };

  // Get selected gadget display name
  const selectedGadgetDisplayName = useMemo(() => {
    if (!selectedDeviceType || !gadgetTypes) return "";
    const gadget = gadgetTypes.find(g => g.name === selectedDeviceType);
    return gadget?.displayName || selectedDeviceType;
  }, [selectedDeviceType, gadgetTypes]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader className="space-y-3">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-2xl font-bold">
              {step === 1 && "Choose Device Type"}
              {step === 2 && `Select ${selectedGadgetDisplayName} Brand`}
              {step === 3 && `Select ${selectedBrand} Model`}
            </DialogTitle>
            {step !== 1 && (
              <Button variant="ghost" size="sm" onClick={handleBack}>
                ← Back
              </Button>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {step === 1 && "What needs a skin? Pick your gadget category"}
            {step === 2 && "Select the brand of your device"}
            {step === 3 && "Find your exact model to browse skins"}
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4 px-1">
          {/* Step 1: Device Type Selection */}
          {step === 1 && (
            <>
              {gadgetTypes === undefined ? (
                // Loading state
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <div className="size-8 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
                  <p className="text-sm text-muted-foreground">Loading device types...</p>
                </div>
              ) : gadgetTypes.length === 0 ? (
                // Empty state
                <div className="text-center py-12">
                  <p className="text-muted-foreground">No device types available</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {gadgetTypes.map((gadget) => {
                    const Icon = getGadgetIcon(gadget.name);
                    return (
                      <button
                        key={gadget._id}
                        onClick={() => handleDeviceTypeSelect(gadget.name)}
                        className="group relative p-4 rounded-lg border-2 border-border hover:border-primary hover:bg-primary/5 transition-all duration-200 flex flex-col items-center gap-2"
                      >
                        <div className="size-12 rounded-full bg-muted group-hover:bg-primary/10 flex items-center justify-center transition-colors">
                          <Icon className="size-6 text-muted-foreground group-hover:text-primary transition-colors" />
                        </div>
                        <span className="text-sm font-medium text-center leading-tight">{gadget.displayName}</span>
                        <ChevronRightIcon className="absolute top-2 right-2 size-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* Step 2: Brand Selection */}
          {step === 2 && (
            <div>
              {metadata === undefined ? (
                // Loading state
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <div className="size-8 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
                  <p className="text-sm text-muted-foreground">Loading brands...</p>
                </div>
              ) : availableBrands.length === 0 ? (
                // Empty state
                <div className="text-center py-12 space-y-4">
                  <p className="text-muted-foreground">No brands available for this device type</p>
                  <Button variant="outline" onClick={handleBack}>
                    Choose Another Device
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {availableBrands.map(brand => (
                    <button
                      key={brand}
                      onClick={() => handleBrandSelect(brand)}
                      className="group relative p-4 rounded-lg border-2 border-border hover:border-primary hover:bg-primary/5 transition-all duration-200 flex flex-col items-center gap-2"
                    >
                      {brandLogos[brand] ? (
                        <div className="size-12 rounded-full bg-background border border-border flex items-center justify-center overflow-hidden group-hover:border-primary transition-colors">
                          <img 
                            src={brandLogos[brand]} 
                            alt={brand}
                            className="w-10 h-10 object-contain"
                          />
                        </div>
                      ) : (
                        <div className="size-12 rounded-full bg-muted group-hover:bg-primary/10 flex items-center justify-center transition-colors">
                          <span className="text-xl font-bold text-muted-foreground group-hover:text-primary transition-colors">
                            {brand[0]}
                          </span>
                        </div>
                      )}
                      <span className="text-sm font-medium text-center leading-tight">{brand}</span>
                      <ChevronRightIcon className="absolute top-2 right-2 size-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Model Selection */}
          {step === 3 && (
            <div className="space-y-4">
              {/* Search Input */}
              <div className="relative sticky top-0 bg-background z-10 pb-2">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search your model..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-10"
                  autoFocus
                />
              </div>

              {/* Model List */}
              <div className="space-y-2">
                {brandModels === undefined ? (
                  // Loading state
                  <div className="flex flex-col items-center justify-center py-12 gap-3">
                    <div className="size-8 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
                    <p className="text-sm text-muted-foreground">Loading models...</p>
                  </div>
                ) : availableModels.length === 0 ? (
                  <div className="text-center py-8 space-y-3">
                    <p className="text-sm text-muted-foreground">
                      {searchQuery ? "No models match your search" : "No models available"}
                    </p>
                    <div className="flex flex-col items-center gap-2 pt-2">
                      <p className="text-xs text-muted-foreground">Can't find your device?</p>
                      <Button
                        size="sm"
                        onClick={() => {
                          onOpenChange(false);
                          if (onRequestModel && selectedDeviceType && selectedBrand) {
                            onRequestModel(selectedDeviceType, selectedBrand);
                          }
                        }}
                        className="gap-2"
                      >
                        Request Your Model
                      </Button>
                      <p className="text-xs text-muted-foreground">We'll add it with priority</p>
                    </div>
                  </div>
                ) : (
                  <>
                    {availableModels.map((model, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleModelSelect(model)}
                        className="w-full flex items-center justify-between p-3 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-all duration-200 text-left group"
                      >
                        <span className="text-sm font-medium">{model}</span>
                        <ChevronRightIcon className="size-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                      </button>
                    ))}
                    {/* Request Your Model button at the bottom */}
                    <div className="mt-4 pt-4 border-t border-border">
                      <div className="flex flex-col items-center gap-2">
                        <p className="text-xs text-muted-foreground">Can't find your device?</p>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            onOpenChange(false);
                            if (onRequestModel && selectedDeviceType && selectedBrand) {
                              onRequestModel(selectedDeviceType, selectedBrand);
                            }
                          }}
                          className="gap-2"
                        >
                          Request Your Model
                        </Button>
                        <p className="text-xs text-muted-foreground">We'll add it with priority</p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
