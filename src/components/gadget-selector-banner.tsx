import { useState, useEffect } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert.tsx";
import { Button } from "@/components/ui/button.tsx";
import { CheckCircle2Icon, XIcon } from "lucide-react";

interface GadgetSelectorBannerProps {
  modelName: string;
}

export function GadgetSelectorBanner({ modelName }: GadgetSelectorBannerProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [shouldRender, setShouldRender] = useState(true);

  // Check if banner was dismissed in this session
  useEffect(() => {
    const dismissed = sessionStorage.getItem('gadgetSelectorBannerDismissed');
    if (dismissed === 'true') {
      setIsVisible(false);
      setShouldRender(false);
    }
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
    sessionStorage.setItem('gadgetSelectorBannerDismissed', 'true');
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
        <div className="flex items-start gap-3">
          <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
            <CheckCircle2Icon className="size-6 text-primary" />
          </div>
          <div className="flex-1 space-y-2">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-foreground leading-tight">
                  Yay – we got you covered!
                </h3>
                <AlertDescription className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                  Your model <span className="font-semibold text-foreground">{modelName}</span> is available with us. 
                  All pics are reference designs – choose your design and we'll send it for your exact model only.
                </AlertDescription>
              </div>
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
        </div>
      </Alert>
    </div>
  );
}
