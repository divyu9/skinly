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
  JoystickIcon,
  VideoIcon,
  HeadphonesIcon,
  ChevronRightIcon
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@/lib/firebase-hooks";
import { Sheet, SheetContent } from "@/components/ui/sheet.tsx";
import { useIsMobile } from "@/hooks/use-mobile";
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
  // These three fell through to the generic box, so half the grid showed the
  // same icon.
  "controller": JoystickIcon,
  "gimbals": VideoIcon,
  "accessory": HeadphonesIcon,
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

  // "128 models" under each type is the detail that makes the picker feel
  // considered rather than decorative.
  const modelCountFor = (name: string): number | null => {
    if (!metadata) return null;
    const key = name === "mac-mini" ? "macMini" : name;
    const c = (metadata.byCategory as any)?.[key]?.count;
    return typeof c === "number" && c > 0 ? c : null;
  };

  // Get selected gadget display name
  const selectedGadgetDisplayName = useMemo(() => {
    if (!selectedDeviceType || !gadgetTypes) return "";
    const gadget = gadgetTypes.find(g => g.name === selectedDeviceType);
    return gadget?.displayName || selectedDeviceType;
  }, [selectedDeviceType, gadgetTypes]);

  return (
    <Shell open={open} onOpenChange={onOpenChange}>
        <DialogHeader className="space-y-3">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-[22px] font-semibold tracking-tight">
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
                <div className="flex flex-col gap-2 sm:grid sm:grid-cols-3 sm:gap-2.5">
                  {gadgetTypes.map((gadget) => {
                    const Icon = getGadgetIcon(gadget.name);
                    const count = modelCountFor(gadget.name);
                    return (
                      <button
                        key={gadget._id}
                        onClick={() => handleDeviceTypeSelect(gadget.name)}
                        className="group flex items-center gap-3 rounded-2xl border border-border/60 bg-card p-3 text-left transition-all duration-200 hover:border-foreground/25 sm:block sm:p-4 sm:hover:-translate-y-px sm:hover:shadow-[0_6px_20px_-8px_rgb(0_0_0/0.18)]"
                      >
                        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground transition-colors duration-200 group-hover:bg-foreground group-hover:text-background sm:mb-3">
                          <Icon className="size-5" strokeWidth={1.75} />
                        </span>
                        <span className="min-w-0 flex-1 sm:block">
                          <p className="truncate text-[15px] font-semibold leading-tight tracking-tight">
                            {gadget.displayName}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {count ? `${count} models` : "Browse designs"}
                          </p>
                        </span>
                        <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground/50 sm:hidden" />
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
                <div className="flex flex-col gap-2 sm:grid sm:grid-cols-3 sm:gap-2.5">
                  {availableBrands.map(brand => (
                    <button
                      key={brand}
                      onClick={() => handleBrandSelect(brand)}
                      className="group flex items-center gap-3 rounded-2xl border border-border/60 bg-card p-3.5 text-left transition-all duration-200 hover:-translate-y-px hover:border-foreground/25 hover:shadow-[0_6px_20px_-8px_rgb(0_0_0/0.18)]"
                    >
                      {brandLogos[brand] ? (
                        <span className="inline-flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted">
                          <img src={brandLogos[brand]} alt={brand} className="size-8 object-contain" />
                        </span>
                      ) : (
                        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-[15px] font-semibold text-muted-foreground transition-colors duration-200 group-hover:bg-foreground group-hover:text-background">
                          {brand[0].toUpperCase()}
                        </span>
                      )}
                      <span className="min-w-0 flex-1 truncate text-[15px] font-medium tracking-tight">{brand}</span>
                      <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground/50 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-foreground" />
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
                        className="group flex w-full items-center justify-between rounded-xl border border-border/60 bg-card px-4 py-3 text-left transition-all duration-200 hover:border-foreground/25 hover:shadow-[0_4px_14px_-8px_rgb(0_0_0/0.2)]"
                      >
                        <span className="text-[15px] font-medium tracking-tight">{model}</span>
                        <ChevronRightIcon className="size-4 text-muted-foreground/50 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-foreground" />
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
    </Shell>
  );
}

/**
 * A centred dialog on a desktop, a sheet rising from the bottom on a phone.
 *
 * The step logic underneath is identical either way — rebuilding these three
 * screens inside the tab bar's sheet would have meant a second copy of the
 * brand cache, the model search and the request-a-model path, which is exactly
 * how two pickers start disagreeing about what devices exist.
 */
function Shell({
  open, onOpenChange, children,
}: { open: boolean; onOpenChange: (v: boolean) => void; children: React.ReactNode }) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="flex max-h-[88vh] flex-col overflow-hidden rounded-t-2xl p-4"
        >
          {children}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[86vh] max-w-2xl flex-col overflow-hidden rounded-2xl p-6">
        {children}
      </DialogContent>
    </Dialog>
  );
}
