import { Button } from "@/components/ui/button.tsx";
import { ZapIcon, SmartphoneIcon } from "lucide-react";

interface StickyBottomBarProps {
  price: string;
  onBuyNow: () => void;
  /** Opens the model picker when no device has been chosen yet. */
  onSelectDevice: () => void;
  /** True while no device model is chosen. */
  needsDevice?: boolean;
  isLoading?: boolean;
  show: boolean;
  /** Rupees of Skinly Coins this purchase earns, 0 when there is no rule. */
  coinsBack?: number;
}

/**
 * On mobile this bar is the CTA most people actually press. It used to render a
 * greyed-out "Buy Now" until a model was picked, with nothing saying why — so
 * the most-tapped control on the page was dead. It now asks for the model
 * instead, and only turns into Buy Now once the order can be placed.
 */
export function StickyBottomBar({
  price,
  onBuyNow,
  onSelectDevice,
  needsDevice = false,
  isLoading = false,
  show,
  coinsBack = 0,
}: StickyBottomBarProps) {
  if (!show) return null;

  /*
   * Sits on top of the app tab bar rather than under it.
   *
   * Both were `fixed bottom-0 z-50`, and the tab bar renders later in the
   * tree, so it painted over the price and the Buy button — the one control
   * this bar exists to keep reachable. The offset matches the tab bar exactly:
   * its items are h-14 plus the home-indicator inset, and it disappears at
   * `sm`, so this drops back to the floor at the same breakpoint.
   */
  return (
    <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-50 border-t-2 border-ink/20 bg-background/90 backdrop-blur-xl sm:bottom-0 md:hidden">
      <div className="container mx-auto flex items-center gap-3 px-4 py-3">
        <div className="flex-1">
          <p className="text-[11px] text-muted-foreground">Price</p>
          <p className="text-xl font-extrabold text-brand">
            {price}
          </p>
          {coinsBack ? (
            <p className="text-[11px] font-semibold text-ink/70">
              +₹{coinsBack} back in coins
            </p>
          ) : null}
        </div>
        <Button
          size="lg"
          onClick={needsDevice ? onSelectDevice : onBuyNow}
          disabled={isLoading}
          className="sticker sticker-press h-12 max-w-[220px] flex-1 rounded-xl bg-brand font-bold text-brand-foreground hover:bg-brand/90"
        >
          {needsDevice ? (
            <>
              <SmartphoneIcon className="mr-2 size-4" />
              Select device
            </>
          ) : (
            <>
              <ZapIcon className="mr-2 size-4" />
              {isLoading ? "Processing..." : "Buy Now"}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
