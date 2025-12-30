import { Card, CardContent } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { CheckIcon, RefreshCwIcon } from "lucide-react";

interface DeviceSelectorCardProps {
  deviceCategory: string;
  phoneModel?: string | null;
  onSelectClick: () => void;
}

const DEVICE_EMOJIS: Record<string, string> = {
  phone: "📱",
  laptop: "💻",
  tablet: "📱",
  camera: "📷",
  lens: "🔍",
  drone: "🚁",
  console: "🎮",
  charger: "🔌",
};

export function DeviceSelectorCard({
  deviceCategory,
  phoneModel,
  onSelectClick,
}: DeviceSelectorCardProps) {
  const emoji = DEVICE_EMOJIS[deviceCategory] || "📦";
  
  if (phoneModel) {
    return (
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <CheckIcon className="size-5 text-primary shrink-0" />
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Selected Model</p>
              <p className="font-semibold">{phoneModel}</p>
            </div>
            <Button 
              size="sm" 
              variant="outline"
              onClick={onSelectClick}
            >
              <RefreshCwIcon className="size-3 mr-1" />
              Change
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className="border-amber-500/50 bg-amber-500/10">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="text-xl shrink-0">{emoji}</div>
          <div className="flex-1">
            <p className="text-sm font-semibold">Select Your Device</p>
            <p className="text-xs text-muted-foreground mt-1">
              Ensure perfect fit for your device
            </p>
          </div>
          <Button size="sm" onClick={onSelectClick}>
            Select
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
