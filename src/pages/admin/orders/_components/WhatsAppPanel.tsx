import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import { SendIcon } from "lucide-react";

export type EmailType =
  | "order_confirmed"
  | "order_dispatched"
  | "order_delivered"
  | "order_cancelled"
  | "payment_failed";

interface WhatsAppPanelProps {
  showEmailDialog: boolean;
  emailDialogData: {
    newStatus?: string;
    oldStatus?: string;
    isPaymentStatus?: boolean;
  };
  selectedEmailType: EmailType;
  sendingEmail: boolean;
  sendWhatsApp: boolean;
  onCloseEmailDialog: () => void;
  onEmailTypeChange: (type: EmailType) => void;
  onSendWhatsAppChange: (checked: boolean) => void;
  onSendEmail: () => void;
}

export function WhatsAppPanel({
  showEmailDialog,
  emailDialogData,
  selectedEmailType,
  sendingEmail,
  sendWhatsApp,
  onCloseEmailDialog,
  onEmailTypeChange,
  onSendWhatsAppChange,
  onSendEmail,
}: WhatsAppPanelProps) {
  return (
    <Dialog open={showEmailDialog} onOpenChange={onCloseEmailDialog}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send Email Notification?</DialogTitle>
          <DialogDescription>
            {emailDialogData.isPaymentStatus
              ? `Payment status changed to ${emailDialogData.newStatus}.`
              : `Order status changed from ${emailDialogData.oldStatus} to ${emailDialogData.newStatus}.`}
            <br />
            Would you like to send an email notification to the customer?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="email-type">Email Type</Label>
            <Select
              value={selectedEmailType}
              onValueChange={(v) => onEmailTypeChange(v as EmailType)}
            >
              <SelectTrigger id="email-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="order_confirmed">Order Confirmed</SelectItem>
                <SelectItem value="order_dispatched">Order Dispatched</SelectItem>
                <SelectItem value="order_delivered">Order Delivered</SelectItem>
                <SelectItem value="order_cancelled">Order Cancelled</SelectItem>
                <SelectItem value="payment_failed">Payment Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="send-whatsapp"
              checked={sendWhatsApp}
              onCheckedChange={(checked) => onSendWhatsAppChange(checked === true)}
            />
            <Label htmlFor="send-whatsapp" className="text-sm font-normal cursor-pointer">
              Also send WhatsApp notification
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCloseEmailDialog} disabled={sendingEmail}>
            Skip
          </Button>
          <Button onClick={onSendEmail} disabled={sendingEmail}>
            {sendingEmail ? (
              <>
                <Spinner className="size-4 mr-2" />
                Sending...
              </>
            ) : (
              <>
                <SendIcon className="size-4 mr-2" />
                Send Email
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
