import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Separator } from "@/components/ui/separator.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import {
  TagIcon,
  WalletIcon,
  SparklesIcon,
  AlertCircleIcon,
  CheckCircleIcon,
  XIcon,
} from "lucide-react";
import type { Id } from "@/lib/firebase-api";

export interface CartItemData {
  productId: string;
  variant: string;
  productTitle: string;
  productImage?: string;
  price: number;
  quantity: number;
  phoneModel?: string;
  coverage?: "only_back" | "full_body_wrap";
  _id?: string;
}

export interface StockStatusItem {
  productId: string;
  variant: string;
  isOutOfStock: boolean;
}

export interface AppliedCoupon {
  coupon: {
    _id: Id<"coupons">;
    code: string;
    description: string;
    effectType?: "discount" | "wallet_credit";
  };
  discountAmount: number;
  eligibleItemsCount: number;
  isWalletCredit?: boolean;
  walletCreditAmount?: number;
}

export interface ShippingSettings {
  freeShippingThreshold: number;
  flatShippingFee: number;
}

export interface CodAvailabilityForSummary {
  available: boolean;
  prepaidAmount: number;
  codAmount: number;
}

export interface GstBreakdown {
  taxableAmount: number;
  isUttarPradesh: boolean;
  cgstAmount?: number;
  sgstAmount?: number;
  igstAmount?: number;
  totalGstAmount: number;
}

interface OrderSummaryPanelProps {
  cartItems: CartItemData[] | undefined;
  stockStatus: StockStatusItem[] | undefined;
  subtotal: number;
  shippingFee: number;
  shippingSettings: ShippingSettings | undefined | null;
  couponDiscount: number;
  walletAmount: number;
  walletTotal: number;
  codFee: number;
  finalTotal: number;
  totalCashback: number;
  gstBreakdown: GstBreakdown | null;
  couponCode: string;
  appliedCoupon: AppliedCoupon | null;
  isApplyingCoupon: boolean;
  couponMessage: { type: "success" | "error"; text: string } | null;
  paymentMethod: string;
  codAvailability: CodAvailabilityForSummary | undefined;
  onCouponCodeChange: (value: string) => void;
  onApplyCoupon: () => void;
  onRemoveCoupon: () => void;
  cardClassName?: string;
}

export function OrderSummaryPanel({
  cartItems,
  stockStatus,
  subtotal,
  shippingFee,
  shippingSettings,
  couponDiscount,
  walletAmount,
  walletTotal,
  codFee,
  finalTotal,
  totalCashback,
  gstBreakdown,
  couponCode,
  appliedCoupon,
  isApplyingCoupon,
  couponMessage,
  paymentMethod,
  codAvailability,
  onCouponCodeChange,
  onApplyCoupon,
  onRemoveCoupon,
  cardClassName,
}: OrderSummaryPanelProps) {
  return (
    <Card className={cardClassName}>
      <CardHeader>
        <CardTitle>Order Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Items */}
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {cartItems &&
            cartItems.map((item, index) => {
              const stockInfo = stockStatus?.find(
                (s) => s.productId === item.productId && s.variant === item.variant
              );
              const isOutOfStock = stockInfo?.isOutOfStock || false;

              return (
                <div
                  key={item._id ? String(item._id) : `${item.productId}-${item.variant}-${index}`}
                  className={`flex gap-3 ${isOutOfStock ? "opacity-50" : ""}`}
                >
                  {item.productImage && (
                    <div className="size-16 bg-muted rounded-lg overflow-hidden shrink-0">
                      <img
                        src={item.productImage}
                        alt={item.productTitle}
                        className={`w-full h-full object-cover ${isOutOfStock ? "grayscale" : ""}`}
                        onError={(e) => {
                          e.currentTarget.src = "/logo.webp";
                        }}
                      />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium line-clamp-2">{item.productTitle}</p>
                      {isOutOfStock && (
                        <Badge variant="destructive" className="text-xs shrink-0">
                          Out of Stock
                        </Badge>
                      )}
                    </div>
                    {item.phoneModel && (
                      <p className="text-xs text-muted-foreground">{item.phoneModel}</p>
                    )}
                    {item.coverage && (
                      <p className="text-xs text-muted-foreground">
                        Coverage:{" "}
                        {item.coverage === "only_back" ? "Only Back" : "Full Body Wrap"}
                      </p>
                    )}
                    <p className="text-sm font-semibold text-primary">
                      ₹{item.price.toFixed(0)} × {item.quantity}
                    </p>
                  </div>
                </div>
              );
            })}
        </div>

        <Separator />

        {/* Coupon Code Section */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <TagIcon className="size-4" />
            <span>Have a Coupon?</span>
          </div>

          {!appliedCoupon ? (
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  placeholder="Enter coupon code"
                  value={couponCode}
                  onChange={(e) => onCouponCodeChange(e.target.value)}
                  disabled={isApplyingCoupon}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={onApplyCoupon}
                  disabled={!couponCode.trim() || isApplyingCoupon}
                >
                  {isApplyingCoupon ? "Applying..." : "Apply"}
                </Button>
              </div>

              {couponMessage && (
                <div
                  className={`flex items-start gap-2 p-2 rounded-lg text-sm ${
                    couponMessage.type === "success"
                      ? "bg-green-500/10 border border-green-500/20"
                      : "bg-red-500/10 border border-red-500/20"
                  }`}
                >
                  {couponMessage.type === "success" ? (
                    <CheckCircleIcon className="size-4 text-green-600 mt-0.5 shrink-0" />
                  ) : (
                    <AlertCircleIcon className="size-4 text-red-600 mt-0.5 shrink-0" />
                  )}
                  <p
                    className={`text-xs ${
                      couponMessage.type === "success"
                        ? "text-green-700 dark:text-green-300"
                        : "text-red-700 dark:text-red-300"
                    }`}
                  >
                    {couponMessage.text}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-start gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
              <TagIcon className="size-4 text-green-600 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-green-900 dark:text-green-100">
                    {appliedCoupon.coupon.code}
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={onRemoveCoupon}
                    className="h-6 w-6 p-0 text-green-600 hover:text-green-700"
                  >
                    <XIcon className="size-4" />
                  </Button>
                </div>
                <p className="text-xs text-green-700 dark:text-green-300 mt-0.5">
                  {appliedCoupon.coupon.description}
                </p>
                <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                  {appliedCoupon.isWalletCredit
                    ? `₹${appliedCoupon.walletCreditAmount} wallet credit on delivery`
                    : `You're saving ₹${appliedCoupon.discountAmount.toFixed(0)}`}
                </p>
              </div>
            </div>
          )}
        </div>

        <Separator />

        {/* Pricing */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Subtotal</span>
            <span>₹{subtotal.toFixed(0)}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span>Shipping</span>
            <span>
              {shippingFee === 0 ? (
                <span className="text-green-600 font-medium">FREE</span>
              ) : (
                `₹${shippingFee.toFixed(0)}`
              )}
            </span>
          </div>
          {couponDiscount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-green-600 flex items-center gap-1">
                <TagIcon className="size-3" />
                Coupon Discount
              </span>
              <span className="text-green-600 font-medium">-₹{couponDiscount.toFixed(0)}</span>
            </div>
          )}
          {walletAmount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-green-600 flex items-center gap-1">
                <WalletIcon className="size-3" />
                Wallet Deduction
              </span>
              <span className="text-green-600 font-medium">-₹{walletAmount.toFixed(0)}</span>
            </div>
          )}
          {codFee > 0 && (
            <div className="flex justify-between text-sm">
              <span>COD Fee</span>
              <span>₹{codFee.toFixed(0)}</span>
            </div>
          )}
          {shippingSettings && subtotal < shippingSettings.freeShippingThreshold && (
            <p className="text-xs text-muted-foreground">
              Add ₹{(shippingSettings.freeShippingThreshold - subtotal + 1).toFixed(0)} more for free
              shipping
            </p>
          )}
        </div>

        <Separator />

        <div className="flex justify-between items-center">
          <span className="font-semibold">
            {walletAmount > 0 ? "Amount to Pay" : "Total"}
          </span>
          <span className="text-2xl font-bold text-primary">₹{finalTotal.toFixed(0)}</span>
        </div>

        {/* Cashback Display */}
        {totalCashback > 0 && (
          <>
            <div className="flex items-start gap-2 p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
              <SparklesIcon className="size-4 text-purple-600 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-purple-900 dark:text-purple-100">
                  You'll earn ₹{totalCashback.toFixed(0)} cashback
                </p>
                <p className="text-xs text-purple-700 dark:text-purple-300 mt-0.5">
                  Credited to your wallet after delivery
                </p>
              </div>
            </div>

            <div className="flex justify-between items-center pt-2 border-t-2 border-purple-500/20">
              <span className="text-sm font-medium text-muted-foreground">Effective Cost</span>
              <span className="text-xl font-bold text-purple-600">
                ₹{(finalTotal - totalCashback).toFixed(0)}
              </span>
            </div>
          </>
        )}

        {walletAmount > 0 && walletAmount >= walletTotal && (
          <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
            <WalletIcon className="size-4 text-green-600" />
            <p className="text-sm font-medium text-green-900 dark:text-green-100">
              Fully paid with wallet!
            </p>
          </div>
        )}

        {/* Partial COD Breakdown */}
        {paymentMethod === "cod" &&
          codAvailability?.available &&
          codAvailability.prepaidAmount > 0 && (
            <div className="space-y-2 pt-2 border-t">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Pay Now (PhonePe)</span>
                <span className="font-medium text-blue-600">
                  ₹{codAvailability.prepaidAmount.toFixed(0)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Pay on Delivery</span>
                <span className="font-medium text-amber-600">
                  ₹{codAvailability.codAmount.toFixed(0)}
                </span>
              </div>
            </div>
          )}

        {/* GST Breakdown */}
        {gstBreakdown && (
          <>
            <Separator />
            <div className="space-y-2 bg-muted/50 p-3 rounded-lg">
              <p className="text-xs font-medium text-muted-foreground">
                GST Breakdown (Tax Included)
              </p>
              <div className="flex justify-between text-xs">
                <span>Taxable Amount</span>
                <span>₹{gstBreakdown.taxableAmount.toFixed(2)}</span>
              </div>
              {gstBreakdown.isUttarPradesh ? (
                <>
                  <div className="flex justify-between text-xs">
                    <span>CGST (9%)</span>
                    <span>₹{gstBreakdown.cgstAmount?.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span>SGST (9%)</span>
                    <span>₹{gstBreakdown.sgstAmount?.toFixed(2)}</span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between text-xs">
                  <span>IGST (18%)</span>
                  <span>₹{gstBreakdown.igstAmount?.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-xs font-medium pt-1 border-t">
                <span>Total GST</span>
                <span>₹{gstBreakdown.totalGstAmount.toFixed(2)}</span>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
