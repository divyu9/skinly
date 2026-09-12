import { Button } from "@/components/ui/button.tsx";
import { CheckIcon, RefreshCwIcon } from "lucide-react";

interface DeviceSelectorCardProps {
  deviceCategory: string;
  phoneModel?: string | null;
  onSelectClick: () => void;
}

/**
 * Confirms the model once one is chosen.
 *
 * The "no model yet" prompt this used to render has been dropped: the primary
 * CTA below now reads "Select your device" and opens the same picker, so the
 * amber card was asking for the same thing twice, a few pixels apart.
 */
export function DeviceSelectorCard({
  phoneModel,
  onSelectClick,
}: DeviceSelectorCardProps) {
  if (!phoneModel) return null;

  return (
    <div className="flex items-center gap-3 rounded-2xl border-2 border-ink/15 bg-brand/10 p-3.5">
      <span className="sticker-sm inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand text-brand-foreground">
        <CheckIcon className="size-5" strokeWidth={3} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium uppercase tracking-wide text-brand/80">
          Cutting for
        </p>
        <p className="truncate font-bold text-foreground">{phoneModel}</p>
      </div>
      <Button
        size="sm"
        variant="ghost"
        onClick={onSelectClick}
        className="shrink-0 font-semibold text-brand hover:bg-brand/10 hover:text-brand"
      >
        <RefreshCwIcon className="mr-1 size-3.5" />
        Change
      </Button>
    </div>
  );
}
