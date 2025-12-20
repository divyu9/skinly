import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert.tsx";
import { Button } from "@/components/ui/button.tsx";
import { CheckCircle2Icon, XIcon, RefreshCwIcon } from "lucide-react";

interface GadgetSelectorBannerProps {
  brandName: string;
  modelName: string;
  onChangeDevice?: () => void;
}

export function GadgetSelectorBanner({ brandName, modelName, onChangeDevice }: GadgetSelectorBannerProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [shouldRender, setShouldRender] = useState(true);

  const handleDismiss = () => {
    setIsVisible(false);
    // Remove from DOM after animation
    setTimeout(() => setShouldRender(false), 300);
  };

  if (!shouldRender) return null;

  return (
    <div 
      className={`transition-all duration-300 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
      }`}
    >
      <div className="bg-black dark:bg-white text-white dark:text-black rounded-lg shadow-md border border-black dark:border-white">
        <div className="flex items-center justify-between gap-1.5 sm:gap-2 px-2 py-1.5 sm:px-3 sm:py-2">
          <div className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0">
            <CheckCircle2Icon className="size-3.5 sm:size-4 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] sm:text-xs font-bold leading-tight">
                {brandName} - {modelName} is available!
              </p>
              <p className="text-[8px] sm:text-[10px] font-normal leading-tight mt-0.5 opacity-70">
                All designs shown are reference.
              </p>
              <p className="text-[8px] sm:text-[10px] font-normal leading-tight opacity-70">
                We'll send it for your exact model.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
            {onChangeDevice && (
              <Button
                size="sm"
                variant="secondary"
                className="font-semibold whitespace-nowrap h-6 sm:h-8 text-[9px] sm:text-xs shadow-sm hover:shadow-md px-1.5 sm:px-3"
                onClick={onChangeDevice}
              >
                <RefreshCwIcon className="size-2.5 sm:size-3 sm:mr-1" />
                <span className="hidden sm:inline">Change</span>
              </Button>
            )}
            <button
              onClick={handleDismiss}
              className="size-6 sm:size-8 flex items-center justify-center rounded hover:bg-white/10 dark:hover:bg-black/10 transition-colors flex-shrink-0"
              aria-label="Dismiss"
            >
              <XIcon className="size-2.5 sm:size-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
