import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { EditIcon } from "lucide-react";

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
                <p className="font-medium">{shippingAddress.phone}</p>
              </div>
              {email && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase mb-1">Email</p>
                  <p className="font-medium break-all">{email}</p>
                </div>
              )}
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
                <p className="text-sm font-medium">{shippingAddress.pincode}</p>
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
