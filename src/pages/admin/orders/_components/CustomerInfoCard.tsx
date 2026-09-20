import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { EditIcon, CopyIcon, AlertTriangleIcon, MessageCircleIcon, CheckIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export interface CustomerFormData {
  fullName: string;
  phone: string;
  email: string;
}

export interface AddressFormData {
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  pincode: string;
}

export interface ShippingAddress {
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pincode: string;
}

interface CustomerInfoCardProps {
  shippingAddress: ShippingAddress;
  email?: string;
  // Customer dialog
  showEditCustomerDialog: boolean;
  customerForm: CustomerFormData;
  onOpenEditCustomer: () => void;
  onCloseEditCustomer: () => void;
  onCustomerFormChange: (form: CustomerFormData) => void;
  onSaveCustomer: () => void;
  // Address dialog
  showEditAddressDialog: boolean;
  addressForm: AddressFormData;
  onOpenEditAddress: () => void;
  onCloseEditAddress: () => void;
  onAddressFormChange: (form: AddressFormData) => void;
  onSaveAddress: () => void;
}


/**
 * One click instead of a careful selection.
 *
 * Packing an order means reading a phone number or an address off this screen
 * and typing it somewhere else, which is exactly where a digit gets lost.
 */
function Copy({ value, what, label }: { value: string; what: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      title={`Copy ${what.toLowerCase()}`}
      className={label
        ? "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted"
        : "text-muted-foreground hover:text-foreground"}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          toast.success(`${what} copied`);
          setTimeout(() => setDone(false), 1500);
        } catch {
          toast.error("Could not copy — your browser blocked it");
        }
      }}
    >
      {done ? <CheckIcon className="size-3.5 text-green-600" /> : <CopyIcon className="size-3.5" />}
      {label}
    </button>
  );
}

export function CustomerInfoCard({
  shippingAddress,
  email,
  showEditCustomerDialog,
  customerForm,
  onOpenEditCustomer,
  onCloseEditCustomer,
  onCustomerFormChange,
  onSaveCustomer,
  showEditAddressDialog,
  addressForm,
  onOpenEditAddress,
  onCloseEditAddress,
  onAddressFormChange,
  onSaveAddress,
}: CustomerInfoCardProps) {
  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Customer & Shipping Details</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Customer Info */}
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase">Customer</p>
                <Button variant="outline" size="sm" onClick={onOpenEditCustomer}>
                  <EditIcon className="size-3 mr-1" />
                  Edit
                </Button>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase mb-1">Name</p>
                <p className="font-medium">{shippingAddress.fullName}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase mb-1">Phone</p>
                <div className="flex items-center gap-1.5">
                  <p className="font-medium tabular-nums">{shippingAddress.phone || "—"}</p>
                  {shippingAddress.phone && (
                    <>
                      <Copy value={shippingAddress.phone} what="Phone" />
                      <a
                        href={`https://wa.me/91${String(shippingAddress.phone).replace(/\D/g, "").slice(-10)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Message this customer on WhatsApp"
                        className="text-muted-foreground hover:text-green-600"
                      >
                        <MessageCircleIcon className="size-3.5" />
                      </a>
                    </>
                  )}
                </div>
              </div>
              {/*
                A missing email used to render nothing at all, so nobody ever
                noticed one. It is the address every confirmation, dispatch and
                delivery note goes to, and the credential a guest tracks their
                order with — so its absence is said out loud, with the way to
                fix it beside it.
              */}
              <div>
                <p className="text-xs text-muted-foreground uppercase mb-1">Email</p>
                {email ? (
                  <div className="flex items-center gap-1.5">
                    <p className="font-medium break-all">{email}</p>
                    <Copy value={email} what="Email" />
                  </div>
                ) : (
                  <div className="rounded-lg border-2 border-amber-500/30 bg-amber-500/10 p-2.5">
                    <p className="flex items-start gap-1.5 text-sm font-medium text-amber-800 dark:text-amber-200">
                      <AlertTriangleIcon className="mt-0.5 size-3.5 shrink-0" />
                      No email on this order
                    </p>
                    <p className="mt-1 text-xs text-amber-800/80 dark:text-amber-200/80">
                      No confirmation, dispatch or delivery note can be sent, and the customer
                      cannot track it themselves.
                    </p>
                    <Button variant="outline" size="sm" className="mt-2 h-7" onClick={onOpenEditCustomer}>
                      Add an email
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Shipping Address */}
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase">Shipping Address</p>
                <Button variant="outline" size="sm" onClick={onOpenEditAddress}>
                  <EditIcon className="size-3 mr-1" />
                  Edit
                </Button>
              </div>
              <div>
                <p className="text-sm leading-relaxed">
                  {shippingAddress.addressLine1}
                  {shippingAddress.addressLine2 && `, ${shippingAddress.addressLine2}`}
                </p>
                <p className="text-sm leading-relaxed">
                  {shippingAddress.city}, {shippingAddress.state}
                </p>
                <p className="text-sm font-medium tabular-nums">{shippingAddress.pincode}</p>
                {/* Copied as one block, the way it goes onto a label. */}
                <div className="mt-2">
                  <Copy
                    label="Copy address"
                    what="Address"
                    value={[
                      shippingAddress.fullName,
                      shippingAddress.addressLine1,
                      shippingAddress.addressLine2,
                      `${shippingAddress.city}, ${shippingAddress.state} ${shippingAddress.pincode}`,
                      shippingAddress.phone,
                    ].filter(Boolean).join("\n")}
                  />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit Customer Dialog */}
      <Dialog open={showEditCustomerDialog} onOpenChange={onCloseEditCustomer}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Customer Information</DialogTitle>
            <DialogDescription>Update customer name, phone, and email</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="customer-name">Full Name</Label>
              <Input
                id="customer-name"
                value={customerForm.fullName}
                onChange={(e) => onCustomerFormChange({ ...customerForm, fullName: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="customer-phone">Phone</Label>
              <Input
                id="customer-phone"
                value={customerForm.phone}
                onChange={(e) => onCustomerFormChange({ ...customerForm, phone: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="customer-email">Email</Label>
              <Input
                id="customer-email"
                type="email"
                value={customerForm.email}
                onChange={(e) => onCustomerFormChange({ ...customerForm, email: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onCloseEditCustomer}>Cancel</Button>
            <Button onClick={onSaveCustomer}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Shipping Address Dialog */}
      <Dialog open={showEditAddressDialog} onOpenChange={onCloseEditAddress}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Shipping Address</DialogTitle>
            <DialogDescription>Update the shipping address for this order</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="address-line1">Address Line 1</Label>
              <Input
                id="address-line1"
                value={addressForm.addressLine1}
                onChange={(e) => onAddressFormChange({ ...addressForm, addressLine1: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="address-line2">Address Line 2 (Optional)</Label>
              <Input
                id="address-line2"
                value={addressForm.addressLine2}
                onChange={(e) => onAddressFormChange({ ...addressForm, addressLine2: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={addressForm.city}
                  onChange={(e) => onAddressFormChange({ ...addressForm, city: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="state">State</Label>
                <Input
                  id="state"
                  value={addressForm.state}
                  onChange={(e) => onAddressFormChange({ ...addressForm, state: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="pincode">Pincode</Label>
              <Input
                id="pincode"
                value={addressForm.pincode}
                onChange={(e) => onAddressFormChange({ ...addressForm, pincode: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onCloseEditAddress}>Cancel</Button>
            <Button onClick={onSaveAddress}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
