import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { SettingsIcon, ClockIcon, TicketIcon, CalendarIcon } from "lucide-react";

export function AbandonedCartSettings() {
  const settings = useQuery(api.abandonedCartSettings.getSettings);
  const updateSettings = useMutation(api.abandonedCartSettings.updateSettings);
  const [saving, setSaving] = useState(false);

  // Local form state
  const [delayHours, setDelayHours] = useState<number>(1);
  const [couponDiscountType, setCouponDiscountType] = useState<"percentage" | "fixed">("percentage");
  const [couponDiscountValue, setCouponDiscountValue] = useState<number>(15);
  const [couponValidityDays, setCouponValidityDays] = useState<number>(7);
  const [couponPrefix, setCouponPrefix] = useState<string>("COMEBACK");

  // Initialize form when settings load
  useEffect(() => {
    if (settings) {
      setDelayHours(settings.delayHours);
      setCouponDiscountType(settings.couponDiscountType as "percentage" | "fixed");
      setCouponDiscountValue(settings.couponDiscountValue);
      setCouponValidityDays(settings.couponValidityDays);
      setCouponPrefix(settings.couponPrefix);
    }
  }, [settings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSettings({
        delayHours,
        couponDiscountType,
        couponDiscountValue,
        couponValidityDays,
        couponPrefix,
      });
      toast.success("Settings saved successfully!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  if (!settings) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <SettingsIcon className="h-6 w-6" />
          Abandoned Cart Settings
        </h2>
        <p className="text-muted-foreground">
          Configure when reminders are sent and what offers are provided
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Timing Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClockIcon className="h-5 w-5" />
              Reminder Timing
            </CardTitle>
            <CardDescription>
              How long to wait before sending a reminder
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="delayHours">Delay (Hours)</Label>
              <Input
                id="delayHours"
                type="number"
                min={0}
                max={168}
                value={delayHours}
                onChange={(e) => setDelayHours(Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">
                Wait {delayHours} hour{delayHours !== 1 ? "s" : ""} after cart abandonment before sending reminder
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Coupon Prefix */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TicketIcon className="h-5 w-5" />
              Coupon Code Format
            </CardTitle>
            <CardDescription>
              Customize the coupon code prefix
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="couponPrefix">Code Prefix</Label>
              <Input
                id="couponPrefix"
                type="text"
                value={couponPrefix}
                onChange={(e) => setCouponPrefix(e.target.value.toUpperCase())}
                maxLength={20}
              />
              <p className="text-xs text-muted-foreground">
                Example: {couponPrefix}ABC123
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Discount Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Discount Offer</CardTitle>
            <CardDescription>
              What discount to offer customers
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="discountType">Discount Type</Label>
              <Select
                value={couponDiscountType}
                onValueChange={(value) => setCouponDiscountType(value as "percentage" | "fixed")}
              >
                <SelectTrigger id="discountType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Percentage (%)</SelectItem>
                  <SelectItem value="fixed">Fixed Amount (₹)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="discountValue">
                {couponDiscountType === "percentage" ? "Discount Percentage" : "Discount Amount"}
              </Label>
              <Input
                id="discountValue"
                type="number"
                min={0}
                max={100}
                value={couponDiscountValue}
                onChange={(e) => setCouponDiscountValue(Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">
                Customers get{" "}
                {couponDiscountType === "percentage"
                  ? `${couponDiscountValue}% off`
                  : `₹${couponDiscountValue} off`}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Validity Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              Coupon Validity
            </CardTitle>
            <CardDescription>
              How long the coupon is valid for
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="validityDays">Valid For (Days)</Label>
              <Input
                id="validityDays"
                type="number"
                min={1}
                max={365}
                value={couponValidityDays}
                onChange={(e) => setCouponValidityDays(Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">
                Coupon expires after {couponValidityDays} day{couponValidityDays !== 1 ? "s" : ""}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} size="lg">
          {saving ? "Saving..." : "Save Settings"}
        </Button>
      </div>

      {/* Preview */}
      <Card className="bg-muted/50">
        <CardHeader>
          <CardTitle>Preview</CardTitle>
          <CardDescription>
            Here's how your abandoned cart recovery will work
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-start gap-2">
            <div className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold flex-shrink-0">
              1
            </div>
            <div>
              <strong>Customer abandons cart</strong>
              <p className="text-muted-foreground">Items left in cart without checkout</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <div className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold flex-shrink-0">
              2
            </div>
            <div>
              <strong>Wait {delayHours} hour{delayHours !== 1 ? "s" : ""}</strong>
              <p className="text-muted-foreground">System waits before sending reminder</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <div className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold flex-shrink-0">
              3
            </div>
            <div>
              <strong>Send reminder with coupon</strong>
              <p className="text-muted-foreground">
                Email & WhatsApp sent with {couponPrefix}XXXXXX code for{" "}
                {couponDiscountType === "percentage"
                  ? `${couponDiscountValue}% off`
                  : `₹${couponDiscountValue} off`}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <div className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold flex-shrink-0">
              4
            </div>
            <div>
              <strong>Coupon valid for {couponValidityDays} day{couponValidityDays !== 1 ? "s" : ""}</strong>
              <p className="text-muted-foreground">Customer has time to complete purchase</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
