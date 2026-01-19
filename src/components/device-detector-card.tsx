import { motion } from "framer-motion";
import { Smartphone, ArrowRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface DeviceDetectorCardProps {
  detectedBrand: string;
  detectedModel: string;
  onDismiss: () => void;
}

export function DeviceDetectorCard({ detectedBrand, detectedModel, onDismiss }: DeviceDetectorCardProps) {
  const navigate = useNavigate();

  const handleCheckout = () => {
    const params = new URLSearchParams({
      brand: detectedBrand,
      fromGadgetSelector: "true",
    });
    
    // Only add model if it's specific (not generic iPhone/MacBook)
    if (detectedModel !== "iPhone" && detectedModel !== "MacBook") {
      params.append("model", detectedModel);
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
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <Button 
              onClick={handleCheckout}
              size="lg" 
              className="group bg-green-600 text-white hover:bg-green-700 w-full sm:w-auto border-none"
            >
              Yes, Show Skins
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Button>
            
            <Button 
              onClick={onDismiss}
              variant="ghost" 
              size="lg"
              className="text-zinc-400 hover:text-white hover:bg-white/10 w-full sm:w-auto"
            >
              <X className="mr-2 h-4 w-4" />
              No, Change Device
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
