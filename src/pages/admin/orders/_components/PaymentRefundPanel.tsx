import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import { BanknoteIcon, CheckIcon } from "lucide-react";

export interface RefundFormData {
  amount: string;
  reason: string;
}

interface PaymentRefundPanelProps {
  paymentMethod: string;
  total: number;
  subtotal: number;
  shippingFee: number;
  codFee?: number;
  prepaidAmount?: number;
  codAmount?: number;
  totalGstAmount?: number;
  cgstAmount?: number;
  sgstAmount?: number;
  cgstRate?: number;
  sgstRate?: number;
  igstAmount?: number;
  igstRate?: number;
  // Refund state
  refundedToWallet?: boolean;
  refundAmount?: number;
  refundedAt?: number;
  refundedBy?: string;
  refundReason?: string;
  orderStatus: string;
  // Dialog
  showRefundDialog: boolean;
  refundForm: RefundFormData;
  isRefunding: boolean;
  onOpenRefund: () => void;
  onCloseRefund: () => void;
  onRefundFormChange: (form: RefundFormData) => void;
  onConfirmRefund: () => void;
}

function formatDate(timestamp: number) {
  return new Date(timestamp).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function PaymentRefundPanel({
  paymentMethod,
  total,
  subtotal,
  shippingFee,
  codFee,
  prepaidAmount,
  codAmount,
  totalGstAmount,
  cgstAmount,
  sgstAmount,
  cgstRate,
  sgstRate,
  igstAmount,
  igstRate,
  refundedToWallet,
  refundAmount,
  refundedAt,
  refundedBy,
  refundReason,
  orderStatus,
  showRefundDialog,
  refundForm,
  isRefunding,
  onOpenRefund,
  onCloseRefund,
  onRefundFormChange,
  onConfirmRefund,
}: PaymentRefundPanelProps) {
  const showCancelledPanels = orderStatus === "cancelled" || orderStatus === "rto";

  return (
    <>
      {/* Order Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Order Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span>₹{subtotal.toFixed(0)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Shipping</span>
            <span>
              {shippingFee === 0 ? (
                <span className="text-green-600 font-medium">FREE</span>
              ) : (
                `₹${shippingFee.toFixed(0)}`
              )}
            </span>
          </div>
          {codFee !== undefined && codFee > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">COD Fee</span>
              <span>₹{codFee.toFixed(0)}</span>
            </div>
          )}
          {totalGstAmount !== undefined && (
            <>
              <div className="pt-2 border-t">
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  GST Breakdown (Included)
                </p>
                <div className="space-y-1">
                  {cgstAmount !== undefined && sgstAmount !== undefined ? (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">CGST ({(cgstRate! * 100)}%)</span>
                        <span>₹{cgstAmount.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">SGST ({(sgstRate! * 100)}%)</span>
                        <span>₹{sgstAmount.toFixed(2)}</span>
                      </div>
                    </>
                  ) : igstAmount !== undefined ? (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">IGST ({(igstRate! * 100)}%)</span>
                      <span>₹{igstAmount.toFixed(2)}</span>
                    </div>
                  ) : null}
                  <div className="flex justify-between text-sm font-medium">
                    <span>Total GST</span>
                    <span>₹{totalGstAmount.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </>
          )}
          <div className="flex justify-between text-lg font-bold pt-2 border-t">
            <span>Total</span>
            <span className="text-primary">₹{total.toFixed(0)}</span>
          </div>
          <div className="text-xs text-muted-foreground pt-1">
            Payment Method: {paymentMethod}
          </div>
        </CardContent>
      </Card>

      {/* COD Payment Breakdown */}
      {paymentMethod === "cod" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Badge variant="secondary" className="bg-amber-500/10 text-amber-700 border-amber-500/20">
                COD
              </Badge>
              Payment Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {prepaidAmount && prepaidAmount > 0 ? (
              <>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Prepaid Amount (PhonePe)</span>
                    <span className="font-medium text-blue-600">₹{prepaidAmount.toFixed(0)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Amount on Delivery</span>
                    <span className="font-medium text-amber-600">₹{(codAmount ?? 0).toFixed(0)}</span>
                  </div>
                </div>
                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground">
                    Partial COD: Customer paid ₹{prepaidAmount.toFixed(0)} upfront.
                    Collect ₹{(codAmount ?? 0).toFixed(0)} on delivery.
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Amount on Delivery</span>
                  <span className="font-medium text-amber-600">₹{total.toFixed(0)}</span>
                </div>
                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground">Full COD: Collect full payment on delivery.</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Refund to Wallet — only for cancelled/rto */}
      {showCancelledPanels && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BanknoteIcon className="size-5" />
              Refund to Wallet
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {refundedToWallet ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <CheckIcon className="size-4 text-green-600" />
                  <span className="text-sm font-medium text-green-900">
                    Refunded to customer's wallet
                  </span>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Refund Amount:</span>
                    <span className="font-semibold">₹{refundAmount?.toFixed(0)}</span>
                  </div>
                  {refundedAt && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Date: </span>
                      <span>{formatDate(refundedAt)}</span>
                    </div>
                  )}
                  {refundedBy && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">By: </span>
                      <span>{refundedBy}</span>
                    </div>
                  )}
                  {refundReason && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Reason: </span>
                      <span>{refundReason}</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <BanknoteIcon className="size-4 text-blue-600" />
                  <span className="text-sm text-blue-900">No refund processed yet</span>
                </div>
                <Button className="w-full" onClick={onOpenRefund}>
                  <BanknoteIcon className="size-4 mr-2" />
                  Process Refund
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Refund Dialog */}
      <Dialog open={showRefundDialog} onOpenChange={onCloseRefund}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Refund to Wallet</DialogTitle>
            <DialogDescription>
              Process a refund and credit the amount to customer's wallet
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="refund-amount">Refund Amount (₹)</Label>
              <Input
                id="refund-amount"
                type="number"
                min="0"
                max={total}
                step="0.01"
                placeholder="Enter refund amount"
                value={refundForm.amount}
                onChange={(e) => onRefundFormChange({ ...refundForm, amount: e.target.value })}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Maximum: ₹{total.toFixed(2)}
              </p>
            </div>
            <div>
              <Label htmlFor="refund-reason">Reason (Optional)</Label>
              <Input
                id="refund-reason"
                placeholder="Enter reason for refund"
                value={refundForm.reason}
                onChange={(e) => onRefundFormChange({ ...refundForm, reason: e.target.value })}
              />
            </div>
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-900">
                <strong>Note:</strong> The refund amount will be credited to the customer's Skinly Wallet and can be used on their next purchase.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { onCloseRefund(); onRefundFormChange({ amount: "", reason: "" }); }}
              disabled={isRefunding}
            >
              Cancel
            </Button>
            <Button
              onClick={onConfirmRefund}
              disabled={isRefunding || !refundForm.amount || parseFloat(refundForm.amount) <= 0}
            >
              {isRefunding ? (
                <>
                  <Spinner className="size-4 mr-2" />
                  Processing...
                </>
              ) : (
                <>
                  <BanknoteIcon className="size-4 mr-2" />
                  Confirm Refund
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
