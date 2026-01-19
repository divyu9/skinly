import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Smartphone, X, Check, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDeviceDetection } from "@/hooks/useDeviceDetection";
import { UAParser } from "ua-parser-js";
import { useNavigate } from "react-router-dom";

export function DeviceDetectionAlert() {
  const { device, showPrompt, confirmDevice, dismissPrompt } = useDeviceDetection();
  const [detectedName, setDetectedName] = useState<string | null>(null);
  const [detectedBrand, setDetectedBrand] = useState<string | null>(null);
  const [detectedModel, setDetectedModel] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (showPrompt && !device) {
      const parser = new UAParser();
      const result = parser.getResult();
      
      const vendor = result.device.vendor || (result.os.name === "iOS" ? "Apple" : null);
      const model = result.device.model || (result.os.name === "iOS" ? "iPhone" : null);

      if (vendor && model) {
        setDetectedBrand(vendor);
        setDetectedModel(model);
        setDetectedName(`${vendor} ${model}`);
      }
    }
  }, [showPrompt, device]);

  if (!showPrompt || !detectedName || device) return null;

  const handleYes = () => {
    if (detectedBrand && detectedModel) {
        confirmDevice(detectedBrand, detectedModel);
        // Navigate to filtered products
        // If detected model is generic "iPhone", don't pass it as model param
        // This allows user to pick specific model on products page while still filtering by brand
        const params = new URLSearchParams();
        params.append("brand", detectedBrand);
        
        if (detectedModel !== "iPhone") {
          params.append("model", detectedModel);
        }
        
        params.append("fromGadgetSelector", "true");
        navigate(`/products?${params.toString()}`);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50"
      >
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl p-4 flex flex-col gap-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 p-2 rounded-lg">
                <Smartphone className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-sm">Browsing on {detectedName}?</p>
                <p className="text-xs text-muted-foreground">See skins made for your device.</p>
              </div>
            </div>
            <button 
              onClick={dismissPrompt}
              className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          
          <div className="flex gap-2">
            <Button 
              size="sm" 
              className="flex-1 text-xs" 
              onClick={handleYes}
            >
              <Check className="mr-1.5 h-3 w-3" />
              Yes, Show Skins
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="flex-1 text-xs"
              onClick={dismissPrompt}
            >
              No, Change Device
            </Button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
