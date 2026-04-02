import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Label } from "@/components/ui/label.tsx";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { AlertCircleIcon, CreditCardIcon } from "lucide-react";

export interface CodAvailability {
  available: boolean;
  showOption: boolean;
  codFee: number;
  isMixedCart: boolean;
  prepaidAmount: number;
  codAmount: number;
}

interface PaymentMethodSelectorProps {
  paymentMethod: string;
  codAvailability: CodAvailability | undefined;
  onPaymentMethodChange: (value: string) => void;
}

export function PaymentMethodSelector({
  paymentMethod,
  codAvailability,
  onPaymentMethodChange,
}: PaymentMethodSelectorProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCardIcon className="size-5" />
          Payment Method
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <RadioGroup value={paymentMethod} onValueChange={onPaymentMethodChange}>
          <div className="flex items-center space-x-2 p-4 border rounded-lg hover:bg-muted/50 transition-colors">
            <RadioGroupItem value="phonepe" id="phonepe" />
            <Label htmlFor="phonepe" className="flex-1 cursor-pointer">
              <div className="font-medium">PhonePe Payment Gateway</div>
              <div className="text-sm text-muted-foreground">
                Pay securely with UPI, Cards, Net Banking & more
              </div>
            </Label>
          </div>

          {codAvailability?.available && codAvailability?.showOption ? (
            <div className="flex items-center space-x-2 p-4 border rounded-lg hover:bg-muted/50 transition-colors">
              <RadioGroupItem value="cod" id="cod" />
              <Label htmlFor="cod" className="flex-1 cursor-pointer">
                <div className="flex items-center gap-2">
                  <span className="font-medium">Cash on Delivery</span>
                  {codAvailability.codFee > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      +₹{codAvailability.codFee.toFixed(0)} fee
                    </Badge>
                  )}
                  {codAvailability.isMixedCart && (
                    <Badge variant="outline" className="text-xs">
                      Mixed Cart
                    </Badge>
                  )}
                </div>
                <div className="text-sm text-muted-foreground">
                  {codAvailability.prepaidAmount > 0
                    ? `Pay ₹${codAvailability.prepaidAmount.toFixed(0)} now, ₹${codAvailability.codAmount.toFixed(0)} on delivery`
                    : "Pay cash when your order is delivered"}
                </div>
              </Label>
            </div>
          ) : null}
        </RadioGroup>

        {paymentMethod === "cod" && codAvailability?.available && codAvailability.codFee > 0 && (
          <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
            <AlertCircleIcon className="size-4 text-amber-600 mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-amber-900 dark:text-amber-100">
                COD fee of ₹{codAvailability.codFee.toFixed(0)} will be added to your order
              </p>
              {codAvailability.prepaidAmount > 0 && (
                <p className="text-amber-700 dark:text-amber-300 mt-1">
                  You'll pay ₹{codAvailability.prepaidAmount.toFixed(0)} now via PhonePe, and ₹{codAvailability.codAmount.toFixed(0)} on delivery
                </p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
