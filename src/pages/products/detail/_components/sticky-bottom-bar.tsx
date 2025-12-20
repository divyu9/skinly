import { Button } from "@/components/ui/button.tsx";
import { ZapIcon } from "lucide-react";

interface StickyBottomBarProps {
  price: string;
  onBuyNow: () => void;
  disabled?: boolean;
  isLoading?: boolean;
  show: boolean;
}

export function StickyBottomBar({
  price,
  onBuyNow,
  disabled = false,
  isLoading = false,
  show,
}: StickyBottomBarProps) {
  if (!show) return null;

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border shadow-lg">
      <div className="container mx-auto px-4 py-3 flex items-center gap-3">
        <div className="flex-1">
          <p className="text-xs text-muted-foreground">Price</p>
          <p className="text-xl font-bold text-primary">{price}</p>
        </div>
        <Button
          size="lg"
          onClick={onBuyNow}
          disabled={disabled || isLoading}
          className="flex-1 max-w-[200px]"
        >
          <ZapIcon className="size-4 mr-2" />
          {isLoading ? "Processing..." : "Buy Now"}
        </Button>
      </div>
    </div>
  );
}
