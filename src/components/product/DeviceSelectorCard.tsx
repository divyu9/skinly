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
    <div className="flex items-center gap-3 rounded-2xl bg-gradient-to-r from-emerald-500/12 to-emerald-500/5 p-3.5 ring-1 ring-emerald-500/25">
      <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-sm shadow-emerald-500/30">
        <CheckIcon className="size-5" strokeWidth={3} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium uppercase tracking-wide text-emerald-700/70 dark:text-emerald-400/70">
          Cutting for
        </p>
        <p className="truncate font-semibold text-emerald-800 dark:text-emerald-200">{phoneModel}</p>
      </div>
      <Button
        size="sm"
        variant="ghost"
        onClick={onSelectClick}
        className="shrink-0 text-emerald-700 hover:bg-emerald-500/10 hover:text-emerald-800 dark:text-emerald-300"
      >
        <RefreshCwIcon className="mr-1 size-3.5" />
        Change
      </Button>
    </div>
  );
}
