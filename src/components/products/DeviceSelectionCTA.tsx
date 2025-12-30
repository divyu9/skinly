import { memo } from "react";
import { Button } from "@/components/ui/button.tsx";
import { Smartphone } from "lucide-react";

interface DeviceSelectionCTAProps {
  onSelectDevice: () => void;
}

export const DeviceSelectionCTA = memo(function DeviceSelectionCTA({
  onSelectDevice,
}: DeviceSelectionCTAProps) {
  return (
    <div className="mb-2 sm:mb-4">
      <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 border-2 border-primary/20 rounded-xl p-4 sm:p-6 text-center">
        <div className="max-w-2xl mx-auto space-y-3">
          <div className="inline-block p-3 bg-primary/10 rounded-full">
            <Smartphone className="size-6 sm:size-8 text-primary" />
          </div>
          <h3 className="text-base sm:text-lg font-bold">Select Your Device Model</h3>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Choose your exact device to see perfectly fitted skins
          </p>
          <Button 
            size="lg"
            onClick={onSelectDevice}
            className="font-semibold"
          >
            Choose Device Model
          </Button>
        </div>
      </div>
    </div>
  );
});
