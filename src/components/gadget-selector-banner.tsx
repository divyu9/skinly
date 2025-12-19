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
        isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
      }`}
    >
      <Alert className="bg-gradient-to-r from-cyan-50 via-purple-50 to-pink-50 border-2 border-primary/40 shadow-lg">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="size-10 sm:size-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <CheckCircle2Icon className="size-5 sm:size-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base sm:text-lg font-bold text-foreground leading-tight mb-1">
              Yay – we got you covered!
            </h3>
            <AlertDescription className="text-xs sm:text-sm text-muted-foreground leading-snug">
              Your model <span className="font-semibold text-foreground whitespace-nowrap">{brandName} - {modelName}</span> is available. All pics are reference designs – we'll send it for your exact model.
            </AlertDescription>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {onChangeDevice && (
              <Button
                size="sm"
                className="font-semibold whitespace-nowrap shadow-sm hidden sm:flex"
                onClick={onChangeDevice}
              >
                <RefreshCwIcon className="size-3.5 mr-1.5" />
                Change Device
              </Button>
            )}
            {onChangeDevice && (
              <Button
                size="sm"
                className="font-semibold shadow-sm sm:hidden"
                onClick={onChangeDevice}
              >
                <RefreshCwIcon className="size-3.5" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="size-8 flex-shrink-0 hover:bg-primary/20"
              onClick={handleDismiss}
            >
              <XIcon className="size-4" />
            </Button>
          </div>
        </div>
      </Alert>
    </div>
  );
}
