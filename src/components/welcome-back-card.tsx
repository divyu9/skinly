import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { ArrowRight, Smartphone, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";

interface WelcomeBackCardProps {
  onRequestChangeModel: () => void;
}

export function WelcomeBackCard({ onRequestChangeModel }: WelcomeBackCardProps) {
  const lastDevice = useQuery(api.orders.getLastOrderedDevice);
  const navigate = useNavigate();

  // Don't render anything if loading or no device found
  if (lastDevice === undefined) {
    return (
      <div className="container mx-auto px-4 py-6">
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    );
  }

  if (lastDevice === null) {
    return null;
  }

  const handleCheckoutNewDesigns = () => {
    // Navigate to products page with pre-selected filters
    const params = new URLSearchParams({
      brand: lastDevice.brand,
      model: lastDevice.model,
      fromGadgetSelector: "true", // Triggers smart filters
    });
    navigate(`/products?${params.toString()}`);
  };

  return (
    <div className="container mx-auto px-4 pt-6 pb-2">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative overflow-hidden rounded-2xl border border-white/20 bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-800 p-6 sm:p-8 shadow-xl"
      >
        {/* Background decorative elements */}
        <div className="absolute top-0 right-0 -mt-16 -mr-16 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute bottom-0 left-0 -mb-16 -ml-16 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />
        
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="flex items-center gap-2 text-primary/80 text-sm font-medium tracking-wider uppercase">
              <Smartphone className="h-4 w-4" />
              <span>Welcome back, {lastDevice.userName}</span>
            </div>
            
            <h2 className="text-2xl sm:text-3xl font-bold text-white leading-tight">
              Ready to restyle your <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-primary">{lastDevice.brand} {lastDevice.model}</span>?
            </h2>
            
            <p className="text-zinc-400 text-sm sm:text-base">
              We've curated the latest trending designs specifically for your {lastDevice.gadgetDisplayName.toLowerCase()}.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <Button 
              onClick={handleCheckoutNewDesigns}
              size="lg" 
              className="group bg-white text-black hover:bg-zinc-200 w-full sm:w-auto"
            >
              Checkout New Designs
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Button>
            
            <Button 
              onClick={onRequestChangeModel}
              variant="outline" 
              size="lg"
              className="border-white/10 text-white hover:bg-white/10 hover:text-white w-full sm:w-auto"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Change Model
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
