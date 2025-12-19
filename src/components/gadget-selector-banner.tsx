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
      <div className="bg-black dark:bg-white text-white dark:text-black rounded-lg sm:rounded-xl shadow-lg border-2 border-black dark:border-white">
        <div className="flex items-center justify-between gap-2 sm:gap-3 px-3 py-2 sm:px-5 sm:py-4">
          <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
            <CheckCircle2Icon className="size-4 sm:size-5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] sm:text-sm font-bold leading-tight">
                {brandName} - {modelName} is available!
              </p>
              <p className="text-[9px] sm:text-xs font-medium leading-tight mt-0.5 sm:mt-1 opacity-80">
                All designs shown are reference – we'll send it for your exact model.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            {onChangeDevice && (
              <Button
                size="sm"
                variant="secondary"
                className="font-semibold whitespace-nowrap h-7 sm:h-9 text-[10px] sm:text-xs shadow-sm hover:shadow-md px-2 sm:px-4"
                onClick={onChangeDevice}
              >
                <RefreshCwIcon className="size-3 sm:size-3.5 sm:mr-1.5" />
                <span className="hidden sm:inline">Change Device</span>
              </Button>
            )}
            <button
              onClick={handleDismiss}
              className="size-7 sm:size-9 flex items-center justify-center rounded-lg hover:bg-white/10 dark:hover:bg-black/10 transition-colors flex-shrink-0"
              aria-label="Dismiss"
            >
              <XIcon className="size-3 sm:size-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
