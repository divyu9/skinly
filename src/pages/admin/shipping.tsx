import { useState } from "react";
import { useQuery, useMutation } from "@/lib/firebase-hooks";
import { api } from "@/lib/firebase-api";
import { AdminLayout } from "@/components/admin-layout.tsx";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import { toast } from "sonner";
import { TruckIcon, Loader2Icon, SaveIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton.tsx";

export default function AdminShippingPage() {
  const shippingSettings = useQuery(api.shipping.getShippingSettings);
  const updateShippingSettings = useMutation(api.shipping.updateShippingSettings);
  
  const [freeThreshold, setFreeThreshold] = useState<string>("");
  const [flatFee, setFlatFee] = useState<string>("");
  const [includesTax, setIncludesTax] = useState<boolean>(false);
  const [pickupName, setPickupName] = useState<string>("");
  const [storeName, setStoreName] = useState<string>("");
  const [isInitialized, setIsInitialized] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Initialize form when settings load
  if (shippingSettings && !isInitialized) {
    setFreeThreshold(shippingSettings.freeShippingThreshold.toString());
    setFlatFee(shippingSettings.flatShippingFee.toString());
    setIncludesTax(shippingSettings.shippingIncludesTax);
    setPickupName((shippingSettings as any).rapidshypPickupName || "");
    setStoreName((shippingSettings as any).rapidshypStoreName || "");
    setIsInitialized(true);
  }
  
  const handleSave = async () => {
    const threshold = parseFloat(freeThreshold);
    const fee = parseFloat(flatFee);
    
    if (isNaN(threshold) || threshold < 0) {
      toast.error("Please enter a valid free shipping threshold");
      return;
    }
    
    if (isNaN(fee) || fee < 0) {
      toast.error("Please enter a valid shipping fee");
      return;
    }
    
    setIsSaving(true);
    try {
      await updateShippingSettings({
        freeShippingThreshold: threshold,
        flatShippingFee: fee,
        shippingIncludesTax: includesTax,
        rapidshypPickupName: pickupName.trim(),
        rapidshypStoreName: storeName.trim(),
      });
      toast.success("Shipping settings updated successfully!");
    } catch (error) {
      // The reason matters here: a denied write and a bad number are different
      // problems, and "Failed to update" told the admin neither.
      const e = error as { code?: string; message?: string };
      const denied = String(e?.code || "").includes("permission-denied");
      toast.error(
        denied
          ? "The database refused the save — sign out and back in, then try again"
          : e?.message || "Failed to update shipping settings",
        { description: e?.code ? `Code: ${e.code}` : undefined, duration: 10000 }
      );
      console.error("shipping settings save failed", error);
    } finally {
      setIsSaving(false);
    }
  };
  
  if (shippingSettings === undefined) {
    return (
      <AdminLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">Shipping Settings</h1>
            <p className="text-muted-foreground">Loading shipping configuration...</p>
          </div>
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-48" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-10 w-32" />
            </CardContent>
          </Card>
        </div>
      </AdminLayout>
    );
  }
  
  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Shipping Settings</h1>
          <p className="text-muted-foreground">
            Configure shipping rules and fees for your store
          </p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <TruckIcon className="size-5" />
              <CardTitle>Shipping Configuration</CardTitle>
            </div>
            <CardDescription>
              Set your shipping fees and free shipping threshold
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="freeThreshold">Free Shipping Threshold (₹)</Label>
              <Input
                id="freeThreshold"
                type="number"
                min="0"
                step="1"
                value={freeThreshold}
                onChange={(e) => setFreeThreshold(e.target.value)}
                placeholder="500"
              />
              <p className="text-sm text-muted-foreground">
                Orders above this amount qualify for free shipping
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="flatFee">Flat Shipping Fee (₹)</Label>
              <Input
                id="flatFee"
                type="number"
                min="0"
                step="1"
                value={flatFee}
                onChange={(e) => setFlatFee(e.target.value)}
                placeholder="50"
              />
              <p className="text-sm text-muted-foreground">
                This fee applies to orders below the free shipping threshold
              </p>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="includesTax"
                  checked={includesTax}
                  onCheckedChange={(checked) => setIncludesTax(checked as boolean)}
                />
                <div className="space-y-1">
                  <Label 
                    htmlFor="includesTax" 
                    className="font-medium cursor-pointer"
                  >
                    Shipping fees include GST/taxes
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Enable this if your shipping fees already include GST. This will be reflected in reports and tax calculations.
                  </p>
                </div>
              </div>
            </div>
            
            {/* RapidShyp matches the pickup name exactly and refuses the
                shipment when it differs, so renaming a pickup address in
                their panel has to be reflected here. */}
            <div className="space-y-4 pt-4 border-t">
              <div>
                <p className="text-sm font-medium">RapidShyp</p>
                <p className="text-sm text-muted-foreground">
                  Copy these from the RapidShyp panel, spelled exactly as they appear there. A mismatch
                  is the "Pickup address not found with pickup address name" error when creating a shipment.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="pickupName">Pickup location name</Label>
                  <Input
                    id="pickupName"
                    value={pickupName}
                    onChange={(e) => setPickupName(e.target.value)}
                    placeholder="e.g. bibhab"
                  />
                  <p className="text-sm text-muted-foreground">
                    RapidShyp → Settings → Pickup Addresses, the Location Name column
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="storeName">Store name</Label>
                  <Input
                    id="storeName"
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    placeholder="DEFAULT"
                  />
                  <p className="text-sm text-muted-foreground">
                    Leave as DEFAULT unless RapidShyp shows more than one channel
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t">
              <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                <p className="text-sm font-medium">Current Rules:</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Orders ≥ ₹{freeThreshold || "0"}: <span className="font-semibold text-green-600">FREE shipping</span></li>
                  <li>• Orders &lt; ₹{freeThreshold || "0"}: <span className="font-semibold">₹{flatFee || "0"} shipping fee</span></li>
                </ul>
              </div>
            </div>
            
            <Button 
              onClick={handleSave}
              disabled={isSaving}
              className="w-full sm:w-auto"
            >
              {isSaving ? (
                <>
                  <Loader2Icon className="size-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <SaveIcon className="size-4 mr-2" />
                  Save Settings
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
