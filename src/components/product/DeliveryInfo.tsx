import { useState } from "react";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { toast } from "sonner";
import {
  ZapIcon,
  MapPinIcon,
  XCircleIcon,
  BanknoteIcon,
  AlertTriangleIcon,
  TruckIcon,
  ClockIcon,
  CheckCircleIcon,
} from "lucide-react";

interface DeliveryInfoProps {
  isSkinProduct: boolean;
}

export function DeliveryInfo({ isSkinProduct }: DeliveryInfoProps) {
  const [pincode, setPincode] = useState("");
  const [pincodeChecked, setPincodeChecked] = useState(false);
  
  const handlePincodeCheck = () => {
    if (!/^\d{6}$/.test(pincode)) {
      toast.error("Please enter a valid 6-digit pincode");
      return;
    }
    setPincodeChecked(true);
  };
  
  const deliveryStartDate = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000);
  const deliveryEndDate = new Date(Date.now() + 6 * 24 * 60 * 60 * 1000);
  
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };
  
  return (
    <div className="space-y-4">
      {/* Pincode Checker */}
      <div className="space-y-3">
        <div className="flex gap-2">
          <Input
            type="text"
            placeholder="Enter Pincode"
            className="flex-1 !border-2 !border-foreground"
            value={pincode}
            onChange={(e) => {
              const value = e.target.value.replace(/\D/g, '').slice(0, 6);
              setPincode(value);
              setPincodeChecked(false);
            }}
            maxLength={6}
          />
          <Button
            variant="outline"
            className="!border-2 !border-foreground"
            onClick={handlePincodeCheck}
          >
            Check
          </Button>
        </div>
        
        {pincodeChecked && /^\d{6}$/.test(pincode) && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircleIcon className="size-4 text-green-600 shrink-0" />
              <span className="text-green-700 font-semibold">
                Yay, delivery is available!
              </span>
            </div>
            <div className="flex items-start gap-2 text-sm">
              <TruckIcon className="size-4 text-green-600 shrink-0 mt-0.5" />
              <span className="text-green-700">
                Estimated delivery: {formatDate(deliveryStartDate)} - {formatDate(deliveryEndDate)}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <ClockIcon className="size-4 text-green-600 shrink-0" />
              <span className="text-green-700">Dispatches next working day</span>
            </div>
          </div>
        )}
      </div>

      {/* Shipping & Delivery Info */}
      <div className="border border-border rounded-lg p-4">
        <h3 className="font-semibold text-sm mb-3">Delivery & Policy</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2 text-sm">
            <ZapIcon className="size-4 text-primary shrink-0" />
            <span className="text-muted-foreground text-xs">Fast Shipping</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <MapPinIcon className="size-4 text-primary shrink-0" />
            <span className="text-muted-foreground text-xs">Pan India</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <XCircleIcon className="size-4 text-red-500 shrink-0" />
            <span className="text-muted-foreground text-xs">Non Returnable</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <BanknoteIcon className="size-4 text-red-500 shrink-0" />
            <span className="text-muted-foreground text-xs">COD Not Available</span>
          </div>
        </div>
        
        {isSkinProduct && (
          <div className="flex items-start gap-2 text-sm bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 mt-3">
            <AlertTriangleIcon className="size-4 text-amber-600 shrink-0 mt-0.5" />
            <span className="text-foreground text-xs">
              <strong>Custom Cut:</strong> No cancellation or changes after confirmation.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
