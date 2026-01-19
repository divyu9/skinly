import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { ArrowRight, Smartphone, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";

interface WelcomeBackCardProps {
  onRequestChangeModel: () => void;
  detectedDevice?: { brand: string; model: string } | null;
  onUseDetectedDevice?: () => void;
}

export function WelcomeBackCard({ onRequestChangeModel, detectedDevice, onUseDetectedDevice }: WelcomeBackCardProps) {
  const lastDevice = useQuery(api.orders.getLastOrderedDevice);
  const navigate = useNavigate();

  // If no last device AND no detected device, don't show anything
  // The parent component should handle showing the fallback DeviceDetectorCard
  if (lastDevice === null && !detectedDevice) {
    return null;
  }

  // If loading last device, show skeleton
  if (lastDevice === undefined) {
    return (
      <div className="container mx-auto px-4 py-6">
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    );
  }

  // Determine which device to show primarily (Last Order takes precedence)
  const displayDevice = lastDevice ? {
    brand: lastDevice.brand,
    model: lastDevice.model,
    displayName: `${lastDevice.brand} ${lastDevice.model}`,
    gadgetType: lastDevice.gadgetDisplayName,
    userName: lastDevice.userName,
    isLastOrder: true
  } : detectedDevice ? {
    brand: detectedDevice.brand,
    model: detectedDevice.model,
    displayName: `${detectedDevice.brand} ${detectedDevice.model}`,
    gadgetType: "Device",
    userName: "there",
    isLastOrder: false
  } : null;

  if (!displayDevice) return null;

  const handleCheckout = () => {
    const params = new URLSearchParams({
      brand: displayDevice.brand,
      fromGadgetSelector: "true",
    });
    
    // Only add model if it's specific (not generic iPhone/MacBook)
    if (displayDevice.model !== "iPhone" && displayDevice.model !== "MacBook") {
      params.append("model", displayDevice.model);
    }
    
    navigate(`/products?${params.toString()}`);
  };

  const theme = displayDevice.isLastOrder ? {
    accent: "indigo",
    bgAccent: "bg-indigo-500/20",
    textAccent: "text-indigo-400",
    buttonBg: "bg-indigo-600 hover:bg-indigo-700",
    iconColor: "text-indigo-400",
    title: `Welcome back${displayDevice.userName !== "there" ? `, ${displayDevice.userName}` : ""}`,
    subtitle: "We've curated the latest trending designs specifically for your",
    showBetaWarning: false
  } : {
    accent: "green",
    bgAccent: "bg-green-500/20",
    textAccent: "text-green-400",
    buttonBg: "bg-green-600 hover:bg-green-700",
    iconColor: "text-green-400",
    title: "Device Detected",
    subtitle: "See the best skins and wraps designed specifically for your",
    showBetaWarning: true
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
        <div className={`absolute top-0 right-0 -mt-16 -mr-16 h-64 w-64 rounded-full ${theme.bgAccent} blur-3xl`} />
        <div className="absolute bottom-0 left-0 -mb-16 -ml-16 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />
        
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className={`flex items-center gap-2 ${theme.iconColor} text-sm font-medium tracking-wider uppercase`}>
              <Smartphone className="h-4 w-4" />
              <span>{theme.title}</span>
            </div>
            
            <h2 className="text-2xl sm:text-3xl font-bold text-white leading-tight">
              Ready to restyle your <span className={theme.textAccent}>{displayDevice.displayName}</span>?
            </h2>
            
            <p className="text-zinc-400 text-sm sm:text-base">
              {theme.subtitle} {displayDevice.gadgetType.toLowerCase()}.
            </p>

            {theme.showBetaWarning && (
              <p className="text-xs text-zinc-500 mt-2">
                * This feature is in beta and detects limited models. If incorrect, please select your gadget from "Choose another Model".
              </p>
            )}
          </div>

          <div className="flex flex-col gap-3 w-full sm:w-auto">
            <div className="flex flex-col sm:flex-row gap-3">
              <Button 
                onClick={handleCheckout}
                size="lg" 
                className={`group ${theme.buttonBg} text-white w-full sm:w-auto border-none`}
              >
                View Designs for {displayDevice.model}
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
              
              <Button 
                onClick={onRequestChangeModel}
                variant="outline" 
                size="lg"
                className="border-zinc-700 text-white bg-transparent hover:bg-zinc-800 hover:text-white w-full sm:w-auto"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                {displayDevice.isLastOrder ? "Change Model" : "Choose another Model"}
              </Button>
            </div>

            {/* If we have both last order AND detected device, and they are different, show option to switch */}
            {lastDevice && detectedDevice && (lastDevice.model !== detectedDevice.model) && onUseDetectedDevice && (
              <Button
                onClick={onUseDetectedDevice}
                variant="ghost"
                size="sm"
                className="text-zinc-400 hover:text-white justify-start sm:justify-center px-0 sm:px-4"
              >
                Not using {lastDevice.model}? Switch to {detectedDevice.brand} {detectedDevice.model}
              </Button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
