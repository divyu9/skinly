import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
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

export function WalletSection({
  walletBalance,
  maxWalletUsage,
  walletAmount,
  totalAfterCoupon,
  useWallet,
  canUseWallet,
  onUseWalletChange,
}: WalletSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <WalletIcon className="size-5" />
          Wallet Balance
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
          <div>
            <p className="text-sm text-muted-foreground">Available Balance</p>
            <p className="text-2xl font-bold text-primary">₹{walletBalance.toFixed(2)}</p>
          </div>
          {maxWalletUsage > 0 && maxWalletUsage < walletBalance && (
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Max Usage</p>
              <p className="text-lg font-semibold">₹{maxWalletUsage.toFixed(2)}</p>
            </div>
          )}
        </div>

        {walletBalance > 0 && canUseWallet ? (
          <>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="useWallet"
                checked={useWallet}
                onCheckedChange={(checked) => onUseWalletChange(checked === true)}
              />
              <Label
                htmlFor="useWallet"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                Use wallet balance for this order
              </Label>
            </div>

            {useWallet && walletAmount > 0 && (
              <div className="flex items-start gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                <WalletIcon className="size-4 text-green-600 mt-0.5 shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-green-900 dark:text-green-100">
                    ₹{walletAmount.toFixed(2)} will be deducted from your wallet
                  </p>
                  {walletAmount >= totalAfterCoupon && (
                    <p className="text-green-700 dark:text-green-300 mt-1">
                      Your order will be fully paid with wallet balance!
                    </p>
                  )}
                </div>
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            {walletBalance === 0
              ? "Your wallet is empty. You can add funds after completing orders or redeeming coupons."
              : "Wallet cannot be used for this order."}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
