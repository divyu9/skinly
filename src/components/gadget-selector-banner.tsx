import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog.tsx";
import { Alert, AlertDescription } from "@/components/ui/alert.tsx";
import { Button } from "@/components/ui/button.tsx";
import { CheckCircle2Icon, XIcon, RefreshCwIcon } from "lucide-react";

interface GadgetSelectorBannerProps {
  brandName: string;
  modelName: string;
  onChangeDevice?: () => void;
}

/*
 * The same message as a popup the first time a phone's listing opens in a
 * visit (owner, 10 Nov 2026): the designs are shown on reference photos, and
 * the shopper should read that before scrolling, not discover it later. OK
 * closes it; the banner stays above the designs as before. Once per phone per
 * browser session, so it does not return on every visit to the page.
 */
const seenKey = (brand: string, model: string) => `skinly_ref_notice:${brand}|${model}`.toLowerCase();

export function GadgetSelectorBanner({ brandName, modelName, onChangeDevice }: GadgetSelectorBannerProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [shouldRender, setShouldRender] = useState(true);
  const [notice, setNotice] = useState(false);

  useEffect(() => {
    try {
      if (!sessionStorage.getItem(seenKey(brandName, modelName))) setNotice(true);
    } catch { /* no storage: the banner alone carries the message */ }
  }, [brandName, modelName]);

  const closeNotice = () => {
    setNotice(false);
    try { sessionStorage.setItem(seenKey(brandName, modelName), "1"); } catch { /* fine */ }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    // Remove from DOM after animation
    setTimeout(() => setShouldRender(false), 300);
  };

  const popup = (
    <Dialog open={notice} onOpenChange={(o) => { if (!o) closeNotice(); }}>
      <DialogContent className="max-w-sm rounded-3xl border-2 border-ink p-6 text-center">
        <span className="mx-auto inline-flex size-12 items-center justify-center rounded-full border-2 border-ink bg-brand text-brand-foreground">
          <CheckCircle2Icon className="size-6" />
        </span>
        <DialogTitle className="mt-2 text-lg font-extrabold leading-snug">
          {brandName} - {modelName} is available!
        </DialogTitle>
        <DialogDescription className="text-sm text-foreground/80">
          All designs shown are reference.
          <br />
          We'll send it for your exact model.
        </DialogDescription>
        <Button
          size="lg"
          onClick={closeNotice}
          className="sticker sticker-press mt-2 h-12 w-full rounded-2xl bg-brand text-base font-extrabold text-brand-foreground hover:bg-brand/90"
        >
          OK, show designs
        </Button>
      </DialogContent>
    </Dialog>
  );

  if (!shouldRender) return popup;

  return (
    <>
    {popup}
    <div 
      className={`transition-all duration-300 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
      }`}
    >
      <div className="rounded-lg border-2 border-ink bg-brand text-brand-foreground shadow-md">
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
    </>
  );
}
