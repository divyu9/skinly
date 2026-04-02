import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { AlertCircleIcon, TruckIcon } from "lucide-react";
import { Link } from "react-router-dom";

export interface FormData {
  fullName: string;
  email: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  pincode: string;
  paymentMethod: string;
}

interface AddressFormProps {
  formData: FormData;
  isPhoneValid: boolean;
  otpVerified: boolean;
  isAuthenticated: boolean;
  onFieldChange: (field: keyof FormData, value: string) => void;
  onPhoneChange: (value: string) => void;
}

export function AddressForm({
  formData,
  isPhoneValid,
  otpVerified,
  isAuthenticated,
  onFieldChange,
  onPhoneChange,
}: AddressFormProps) {
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TruckIcon className="size-5" />
            Shipping Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="fullName">Full Name</Label>
            <Input
              id="fullName"
              required
              placeholder="John Smith"
              value={formData.fullName}
              onChange={(e) => onFieldChange("fullName", e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              required
              placeholder="john@example.com"
              value={formData.email}
              onChange={(e) => onFieldChange("email", e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-1">
              We'll send your order confirmation and tracking link to this email
            </p>
          </div>

          <div>
            <Label htmlFor="phone">Phone Number</Label>
            <div className="flex items-stretch gap-0">
              <div className="flex items-center justify-center px-3 bg-muted border border-r-0 rounded-l-md text-sm font-medium">
                +91
              </div>
              <Input
                id="phone"
                type="tel"
                required
                placeholder="9876543210"
                value={formData.phone}
                onChange={(e) => onPhoneChange(e.target.value)}
                disabled={otpVerified}
                className="rounded-l-none"
                maxLength={10}
                pattern="[0-9]{10}"
              />
            </div>
            {formData.phone && !isPhoneValid && (
              <p className="text-xs text-red-600 mt-1">
                Please enter a valid 10-digit mobile number
              </p>
            )}
            {otpVerified && (
              <p className="text-xs text-green-600 mt-1">
                ✓ Verified for COD orders
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="addressLine1">Address Line 1</Label>
            <Input
              id="addressLine1"
              required
              placeholder="House/Flat No., Building Name"
              value={formData.addressLine1}
              maxLength={99}
              onChange={(e) => onFieldChange("addressLine1", e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-1">
              {formData.addressLine1.length}/99 characters
            </p>
          </div>

          <div>
            <Label htmlFor="addressLine2">Address Line 2</Label>
            <Input
              id="addressLine2"
              required
              placeholder="Street, Area, Locality"
              value={formData.addressLine2}
              maxLength={99}
              onChange={(e) => onFieldChange("addressLine2", e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-1">
              {formData.addressLine2.length}/99 characters
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                required
                placeholder="Mumbai"
                value={formData.city}
                onChange={(e) => onFieldChange("city", e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="state">State</Label>
              <Input
                id="state"
                required
                placeholder="Maharashtra"
                value={formData.state}
                onChange={(e) => onFieldChange("state", e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="pincode">Pincode</Label>
              <Input
                id="pincode"
                required
                placeholder="400001"
                value={formData.pincode}
                onChange={(e) => onFieldChange("pincode", e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {!isAuthenticated && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start gap-3 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <AlertCircleIcon className="size-5 text-blue-600 mt-0.5 shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-blue-900 dark:text-blue-100">
                  Guest Checkout
                </p>
                <p className="text-blue-700 dark:text-blue-300 mt-1">
                  You're checking out as a guest. We'll send your order confirmation to your email.
                </p>
                <p className="text-blue-700 dark:text-blue-300 mt-1">
                  Want to track your orders easily?{" "}
                  <Link to="/" className="underline font-medium">Sign in</Link> or create an account.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
