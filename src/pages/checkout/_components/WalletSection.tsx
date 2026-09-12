import { Card, CardContent } from "@/components/ui/card.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import { Label } from "@/components/ui/label.tsx";
import { WalletIcon } from "lucide-react";

interface WalletSectionProps {
  walletBalance: number;
  maxWalletUsage: number;
  walletAmount: number;
  totalAfterCoupon: number;
  useWallet: boolean;
  canUseWallet: boolean;
  onUseWalletChange: (checked: boolean) => void;
}

/**
 * Wallet, in one row.
 *
 * This used to be a full card — a header, a ₹ figure at text-2xl in its own
 * tinted panel, a checkbox on its own line, then a green confirmation box —
 * roughly a third of a phone screen for a toggle most shoppers flick once.
 * Everything it said still gets said; it just says it on the line it lives on.
 */
export function WalletSection({
  walletBalance,
  maxWalletUsage,
  walletAmount,
  totalAfterCoupon,
  useWallet,
  canUseWallet,
  onUseWalletChange,
}: WalletSectionProps) {
  const usable = walletBalance > 0 && canUseWallet;
  const capped = maxWalletUsage > 0 && maxWalletUsage < walletBalance;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <WalletIcon className="size-4 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <Label
              htmlFor="useWallet"
              className={`block text-sm font-medium ${usable ? "cursor-pointer" : ""}`}
            >
              Pay with Skinly Wallet
            </Label>
            <p className="text-xs text-muted-foreground">
              ₹{walletBalance.toFixed(0)} available
              {capped && ` · up to ₹${maxWalletUsage.toFixed(0)} on this order`}
            </p>
          </div>
          {usable ? (
            <Switch
              id="useWallet"
              checked={useWallet}
              onCheckedChange={onUseWalletChange}
              className="shrink-0"
            />
          ) : (
            <span className="shrink-0 text-xs text-muted-foreground">
              {walletBalance === 0 ? "Empty" : "Not usable"}
            </span>
          )}
        </div>

        {usable && useWallet && walletAmount > 0 && (
          <p className="mt-2.5 rounded-md bg-green-500/10 px-3 py-2 text-xs font-medium text-green-700 dark:text-green-300">
            ₹{walletAmount.toFixed(0)} will be deducted
            {walletAmount >= totalAfterCoupon
              ? " — this order is fully covered."
              : "."}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
