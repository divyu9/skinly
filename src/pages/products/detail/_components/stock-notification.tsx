import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card.tsx";
import { BellIcon, CheckIcon } from "lucide-react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import type { Id } from "@/convex/_generated/dataModel.d.ts";

interface StockNotificationProps {
  variantId: Id<"variants">;
  variantTitle: string;
}

export function StockNotification({ variantId, variantTitle }: StockNotificationProps) {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  
  const subscribeToNotification = useMutation(api.stockNotifications.subscribeToNotification);
  
  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate phone number
    if (!phoneNumber.trim()) {
      toast.error("Please enter your phone number");
      return;
    }
    
    // Basic phone number validation (Indian format)
    const phoneRegex = /^[6-9]\d{9}$/;
    if (!phoneRegex.test(phoneNumber.replace(/\D/g, ""))) {
      toast.error("Please enter a valid 10-digit phone number");
      return;
    }
    
    setIsSubscribing(true);
    
    try {
      const result = await subscribeToNotification({
        variantId,
        phoneNumber: phoneNumber.replace(/\D/g, ""),
      });
      
      if (result.alreadySubscribed) {
        toast.info("You're already subscribed to notifications for this product");
      } else {
        toast.success("You'll be notified when this product is back in stock!");
      }
      
      setIsSubscribed(true);
      setPhoneNumber("");
    } catch (error) {
      if (error instanceof ConvexError) {
        const { message } = error.data as { code: string; message: string };
        toast.error(message);
      } else {
        toast.error("Failed to subscribe. Please try again.");
      }
    } finally {
      setIsSubscribing(false);
    }
  };
  
  if (isSubscribed) {
    return (
      <Card className="border-green-500/20 bg-green-500/5">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3 text-green-600">
            <CheckIcon className="size-5 shrink-0" />
            <div>
              <div className="font-semibold">You're on the list!</div>
              <div className="text-sm text-muted-foreground">
                We'll send you a WhatsApp message when this product is back in stock
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader>
        <div className="flex items-center gap-2">
          <BellIcon className="size-5 text-primary" />
          <CardTitle className="text-lg">Out of Stock</CardTitle>
        </div>
        <CardDescription>
          Get notified on WhatsApp when this product is back in stock
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubscribe} className="space-y-3">
          <div>
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="Enter your 10-digit mobile number"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              maxLength={10}
              disabled={isSubscribing}
            />
          </div>
          <Button
            type="submit"
            className="w-full"
            disabled={isSubscribing}
          >
            <BellIcon className="size-4 mr-2" />
            {isSubscribing ? "Subscribing..." : "Notify Me"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
