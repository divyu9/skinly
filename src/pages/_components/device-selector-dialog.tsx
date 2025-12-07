import { useState, useMemo, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Button } from "@/components/ui/button.tsx";
import { SearchIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";

type DeviceType = "laptop" | "phone" | "camera" | "lens" | "tablet" | "macmini" | "console" | "drone" | "charger";

interface DeviceSelectorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialDeviceType?: DeviceType;
}

// Brand logo mapping - updated with new brand logos
const brandLogos: Record<string, string> = {
  "Apple": "https://cdn.hercules.app/file_qcbK94JAlKCQO3s4ECR3BDw8",
  "Asus": "https://cdn.hercules.app/file_0LL7DgU98xrDCPL00t5KFGTT",
  "CMF": "https://cdn.hercules.app/file_4c1OKYG0fSACOsMluL75owT2",
  "Canon": "https://cdn.hercules.app/file_off0gfWoUMcir0QQZCzi7GIU",
  "DJI": "https://cdn.hercules.app/file_EGoBVi2MqXFIfQ9azAk17mLW",
  "Google": "https://cdn.hercules.app/file_9C2bkc6R18Zlw3kzIlyEc37z",
  "HMD": "https://cdn.hercules.app/file_6SgBKQgyl2Yu5etoIDWd7brZ",
  "Honor": "https://cdn.hercules.app/file_we74pfzTJnEtTUdJhYuW5ThV",
  "Infinix": "https://cdn.hercules.app/file_9C2bkc6R18Zlw3kzIlyEc37z",
  "Lava": "https://cdn.hercules.app/file_7hHzwp413xD518fxJ5x0baw6",
  "Lenovo": "https://cdn.hercules.app/file_LFviHa1inqcy1Wep9Y5iFpO9",
  "Motorola": "https://cdn.hercules.app/file_mrd4R2pm62O76PqkzhyqHbeh",
  "Nikon": "https://cdn.hercules.app/file_ylLjoFqbjC30tGQqjNW6HyTr",
  "Nothing": "https://cdn.hercules.app/file_n1uEhYdL5ZtXcIo6CRLXRG9L",
  "One Plus": "https://cdn.hercules.app/file_CFmZ3JACXeL3XhcE9uOqiEGB",
  "Oppo": "https://cdn.hercules.app/file_MJ0Tzj4OvYrNYt0PiECFcoL3",
  "PlayStation": "https://cdn.hercules.app/file_G2wSLrMTBTW2Kcy9GtGCv5KW",
  "Poco": "https://cdn.hercules.app/file_DMUZvqLtfG3xqHV8GA1rnCJD",
  "Realme": "https://cdn.hercules.app/file_NrBIl0OOhvh0eLyAhLKluYU9",
  "Samsung": "https://cdn.hercules.app/file_8eVkxycD51p7VEELLLP3bxSy",
  "Tecno": "https://cdn.hercules.app/file_d4D7g77UjY356BBldBKW7HNo",
  "Vivo": "https://cdn.hercules.app/file_o3IQVV2jjv2h9nbO09Wf08D6",
  "Xbox": "https://cdn.hercules.app/file_RMC3F2D6573iOGnDKKenuTH7",
  "Xiaomi": "https://cdn.hercules.app/file_8B5z2x34UxKbxnje3MH1w59O",
  "iQOO": "https://cdn.hercules.app/file_m1bBgRqmZsG4VorENlmoX7w0",
};

export function DeviceSelectorDialog({ open, onOpenChange, initialDeviceType }: DeviceSelectorDialogProps) {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedDeviceType, setSelectedDeviceType] = useState<DeviceType | null>(null);
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Map UI device types to database categories
  const getDbCategory = (deviceType: DeviceType): "phone" | "tablet" | "laptop" | "console" | "charger" | "drone" | "camera" | "lens" | "mac-mini" => {
    if (deviceType === "macmini") return "mac-mini";
    return deviceType as "phone" | "tablet" | "laptop" | "console" | "charger" | "drone" | "camera" | "lens";
  };

  // Fetch metadata from cache (super fast!)
  const metadata = useQuery(api.supportedModels.getMetadata);
  
  // Lazy-load models for selected brand + category (only when brand is selected)
  const brandModels = useQuery(
    api.supportedModels.getBrandModels,
    selectedBrand && selectedDeviceType
      ? { brand: selectedBrand, category: getDbCategory(selectedDeviceType) }
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
    
    const categoryKey = selectedDeviceType === "macmini" ? "macMini" : selectedDeviceType;
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

  const handleDeviceTypeSelect = (type: DeviceType) => {
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
    
    // For phones, redirect to confirmation page; for other devices, go directly to products
    if (selectedDeviceType === "phone") {
      navigate(`/products/confirm?brand=${encodeURIComponent(selectedBrand)}&model=${encodeURIComponent(model)}`);
    } else {
      navigate(`/products?brand=${encodeURIComponent(selectedBrand)}&model=${encodeURIComponent(model)}&showFinish=true`);
    }
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

  const getDeviceTypeLabel = (type: DeviceType): string => {
    switch (type) {
      case "laptop": return "Laptop";
      case "phone": return "Phone";
      case "camera": return "Camera";
      case "lens": return "Lens";
      case "tablet": return "Tablet";
      case "macmini": return "Mac Mini";
      case "console": return "Gaming Console";
      case "drone": return "Drone";
      case "charger": return "Charger";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-3xl">
            {step === 1 && "What Needs a Makeover?"}
            {step === 2 && `Select Your ${getDeviceTypeLabel(selectedDeviceType!)} Brand`}
            {step === 3 && `Select Your ${selectedBrand} Model`}
          </DialogTitle>
          <div className="flex items-center justify-between">
            <p className="text-muted-foreground">
              {step === 1 && "Choose your device type to continue"}
              {step === 2 && "Choose your device brand to continue"}
              {step === 3 && "Choose your phone model to see compatible skins"}
            </p>
            {step !== 1 && (
              <Button variant="ghost" size="sm" onClick={handleBack}>
                ← Back
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="py-6">
          {/* Step 1: Device Type Selection */}
          {step === 1 && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <button
                onClick={() => handleDeviceTypeSelect("laptop")}
                className="p-6 rounded-xl border-2 border-border hover:border-primary hover:shadow-lg transition-all flex flex-col items-center gap-3"
              >
                <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center text-3xl">
                  💻
                </div>
                <span className="font-semibold">Laptop</span>
              </button>

              <button
                onClick={() => handleDeviceTypeSelect("phone")}
                className="p-6 rounded-xl border-2 border-border hover:border-primary hover:shadow-lg transition-all flex flex-col items-center gap-3"
              >
                <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center text-3xl">
                  📱
                </div>
                <span className="font-semibold">Phones</span>
              </button>
              
              <button
                onClick={() => handleDeviceTypeSelect("camera")}
                className="p-6 rounded-xl border-2 border-border hover:border-primary hover:shadow-lg transition-all flex flex-col items-center gap-3"
              >
                <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center text-3xl">
                  📷
                </div>
                <span className="font-semibold">Camera</span>
              </button>

              <button
                onClick={() => handleDeviceTypeSelect("lens")}
                className="p-6 rounded-xl border-2 border-border hover:border-primary hover:shadow-lg transition-all flex flex-col items-center gap-3"
              >
                <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center text-3xl">
                  🔍
                </div>
                <span className="font-semibold">Lenses</span>
              </button>

              <button
                onClick={() => handleDeviceTypeSelect("tablet")}
                className="p-6 rounded-xl border-2 border-border hover:border-primary hover:shadow-lg transition-all flex flex-col items-center gap-3"
              >
                <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center text-3xl">
                  📱
                </div>
                <span className="font-semibold">iPad/Tablet</span>
              </button>

              <button
                onClick={() => handleDeviceTypeSelect("macmini")}
                className="p-6 rounded-xl border-2 border-border hover:border-primary hover:shadow-lg transition-all flex flex-col items-center gap-3"
              >
                <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center text-3xl">
                  💻
                </div>
                <span className="font-semibold">Mac Mini</span>
              </button>

              <button
                onClick={() => handleDeviceTypeSelect("drone")}
                className="p-6 rounded-xl border-2 border-border hover:border-primary hover:shadow-lg transition-all flex flex-col items-center gap-3"
              >
                <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center text-3xl">
                  🚁
                </div>
                <span className="font-semibold">Drones</span>
              </button>

              <button
                onClick={() => handleDeviceTypeSelect("charger")}
                className="p-6 rounded-xl border-2 border-border hover:border-primary hover:shadow-lg transition-all flex flex-col items-center gap-3"
              >
                <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center text-3xl">
                  🔌
                </div>
                <span className="font-semibold">Chargers</span>
              </button>

              <button
                onClick={() => handleDeviceTypeSelect("console")}
                className="p-6 rounded-xl border-2 border-border hover:border-primary hover:shadow-lg transition-all flex flex-col items-center gap-3"
              >
                <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center text-3xl">
                  🎮
                </div>
                <span className="font-semibold">Gaming Console</span>
              </button>
            </div>
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
                <div className="text-center py-12">
                  <p className="text-muted-foreground mb-4">No brands available for this device type</p>
                  <Button variant="outline" onClick={handleBack}>
                    Choose Another Device
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {availableBrands.map(brand => (
                    <button
                      key={brand}
                      onClick={() => handleBrandSelect(brand)}
                      className="p-6 rounded-xl border-2 border-border hover:border-primary hover:shadow-lg transition-all flex flex-col items-center gap-3"
                    >
                      {brandLogos[brand] ? (
                        <div className="size-16 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                          <img 
                            src={brandLogos[brand]} 
                            alt={brand}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center text-2xl font-bold">
                          {brand[0]}
                        </div>
                      )}
                      <span className="font-semibold text-center">{brand}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Model Selection */}
          {step === 3 && (
            <div>
              {/* Search Input */}
              <div className="relative mb-6">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search models..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Model List */}
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {brandModels === undefined ? (
                  // Loading state
                  <div className="flex flex-col items-center justify-center py-12 gap-3">
                    <div className="size-8 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
                    <p className="text-sm text-muted-foreground">Loading models...</p>
                  </div>
                ) : availableModels.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No models found
                  </p>
                ) : (
                  availableModels.map((model, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleModelSelect(model)}
                      className="w-full flex items-center justify-between p-4 rounded-lg border-2 border-border hover:border-primary hover:bg-muted/50 transition-all text-left"
                    >
                      <span className="font-medium">{model}</span>
                      <span className="text-primary">Select →</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
