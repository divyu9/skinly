import { motion } from "framer-motion";
import { Smartphone, ArrowRight, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

interface DeviceDetectorCardProps {
  detectedBrand: string;
  detectedModel: string;
  onDismiss: () => void;
}

export function DeviceDetectorCard({ detectedBrand, detectedModel, onDismiss }: DeviceDetectorCardProps) {
  const navigate = useNavigate();
  const [modelSearchOpen, setModelSearchOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>("");

  // Get models for the detected brand to populate dropdown
  const detectedBrandModels = useQuery(api.products.getModelsByBrand, { brand: detectedBrand });

  // Helper to determine gadget type based on model name
  const getGadgetCategory = (model: string) => {
    const lowerModel = model.toLowerCase();
    if (lowerModel.includes("macbook") || lowerModel.includes("laptop")) return "laptop";
    if (lowerModel.includes("ipad") || lowerModel.includes("tablet")) return "tablet";
    return "phone"; // Default
  };

  const handleCheckout = () => {
    const modelToUse = selectedModel || detectedModel;
    const gadgetCategory = getGadgetCategory(modelToUse);

    const params = new URLSearchParams({
      brand: detectedBrand,
      fromGadgetSelector: "true",
      category: "skins", // Default to skins
      gadget: gadgetCategory, // Pass correct gadget type
    });
    
    // Only add model if it's specific (not generic iPhone/MacBook) OR if user explicitly selected it
    if (modelToUse !== "iPhone" && modelToUse !== "MacBook") {
      params.append("model", modelToUse);
    }
    
    navigate(`/products?${params.toString()}`);
  };

  return (
    <div className="container mx-auto px-4 pt-6 pb-2">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 p-6 sm:p-8 shadow-xl"
      >
        {/* Background decorative elements */}
        <div className="absolute top-0 right-0 -mt-16 -mr-16 h-64 w-64 rounded-full bg-green-500/20 blur-3xl" />
        <div className="absolute bottom-0 left-0 -mb-16 -ml-16 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />
        
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="flex items-center gap-2 text-green-400 text-sm font-medium tracking-wider uppercase">
              <Smartphone className="h-4 w-4" />
              <span>Device Detected</span>
            </div>
            
            <h2 className="text-2xl sm:text-3xl font-bold text-white leading-tight">
              Browsing on <span className="text-green-400">{detectedBrand} {detectedModel}</span>?
            </h2>
            
            <p className="text-zinc-400 text-sm sm:text-base">
              See the best skins and wraps designed specifically for your device.
            </p>

            <div className="space-y-2 pt-2">
              <p className="text-xs text-zinc-500">
                * Beta feature. Correct model not detected? Select below:
              </p>
              {/* Inline Model Selector */}
              <Popover open={modelSearchOpen} onOpenChange={setModelSearchOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" aria-expanded={modelSearchOpen} className="w-full sm:w-[250px] justify-between border-zinc-700 text-zinc-300 bg-black/20">
                    {selectedModel || `Select ${detectedBrand} Model...`}
                    <ArrowRight className="ml-2 h-4 w-4 shrink-0 opacity-50 rotate-90" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[250px] p-0 bg-zinc-900 border-zinc-700 text-white">
                  <Command className="bg-transparent">
                    <CommandInput placeholder={`Search ${detectedBrand} models...`} className="h-9" />
                    <CommandList>
                      <CommandEmpty>No model found.</CommandEmpty>
                      <CommandGroup>
                        {detectedBrandModels?.map((model) => (
                          <CommandItem
                            key={model}
                            value={model}
                            onSelect={(currentValue) => {
                              setSelectedModel(currentValue === selectedModel ? "" : currentValue);
                              setModelSearchOpen(false);
                            }}
                            className="text-white hover:bg-zinc-800"
                          >
                            {model}
                            <Check
                              className={cn(
                                "ml-auto h-4 w-4",
                                selectedModel === model ? "opacity-100" : "opacity-0"
                              )}
                            />
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto self-end">
            <Button 
              onClick={handleCheckout}
              size="lg" 
              className="group bg-green-600 text-white hover:bg-green-700 w-full sm:w-auto border-none"
            >
              Show Skins {selectedModel ? `for ${selectedModel}` : ""}
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Button>
            
            <Button 
              onClick={onDismiss}
              variant="ghost" 
              size="lg"
              className="text-zinc-400 hover:text-white hover:bg-white/10 w-full sm:w-auto"
            >
              <X className="mr-2 h-4 w-4" />
              Wrong Device
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
