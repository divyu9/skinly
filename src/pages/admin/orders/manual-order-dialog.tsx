import { useState } from "react";
import { useMutation, useQuery } from "@/lib/firebase-hooks";
import { api } from "@/lib/firebase-api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { toast } from "sonner";
import { PlusIcon, TrashIcon } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area.tsx";

type OrderItem = {
  productId: string;
  productTitle: string;
  variant: string;
  sku: string;
  price: number;
  quantity: number;
  phoneModel?: string;
  phoneBrand?: string;
};

interface ManualOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand",
  "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur",
  "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab",
  "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura",
  "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry"
];

export function ManualOrderDialog({ open, onOpenChange }: ManualOrderDialogProps) {
  const createManualOrder = useMutation(api.admin.orders.createManualOrder);
  const products = useQuery(api.products.getAllProducts);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Customer information
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");

  // Shipping address
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [pincode, setPincode] = useState("");

  // Order items
  const [items, setItems] = useState<OrderItem[]>([
    { productId: "", productTitle: "", variant: "", sku: "", price: 0, quantity: 1 }
  ]);

  // Order details
  const [paymentMethod, setPaymentMethod] = useState("COD");
  const [shippingFee, setShippingFee] = useState(0);
  const [codFee, setCodFee] = useState(0);
  const [status, setStatus] = useState<"processing" | "shipped" | "delivered" | "cancelled" | "rto">("processing");
  const [paymentStatus, setPaymentStatus] = useState<"pending" | "success" | "failed">("success");

  // Optional shipping info
  const [awbNumber, setAwbNumber] = useState("");
  const [trackingUrl, setTrackingUrl] = useState("");
  const [courierName, setCourierName] = useState("");

  const handleAddItem = () => {
    setItems([...items, { productId: "", productTitle: "", variant: "", sku: "", price: 0, quantity: 1 }]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length === 1) {
      toast.error("At least one item is required");
      return;
    }
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: keyof OrderItem, value: string | number) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const handleProductSelect = (index: number, productId: string) => {
    const product = products?.find(p => p._id === productId);
    if (!product) return;

    const newItems = [...items];
    newItems[index] = {
      ...newItems[index],
      productId: product._id,
      productTitle: product.title,
    };
    setItems(newItems);
  };

  const calculateSubtotal = () => {
    return items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  };

  const calculateTotal = () => {
    return calculateSubtotal() + shippingFee + codFee;
  };

  const resetForm = () => {
    setCustomerName("");
    setCustomerPhone("");
    setCustomerEmail("");
    setAddressLine1("");
    setAddressLine2("");
    setCity("");
    setState("");
    setPincode("");
    setItems([{ productId: "", productTitle: "", variant: "", sku: "", price: 0, quantity: 1 }]);
    setPaymentMethod("COD");
    setShippingFee(0);
    setCodFee(0);
    setStatus("processing");
    setPaymentStatus("success");
    setAwbNumber("");
    setTrackingUrl("");
    setCourierName("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!customerName.trim()) {
      toast.error("Customer name is required");
      return;
    }
    if (!customerPhone.trim()) {
      toast.error("Customer phone is required");
      return;
    }
    if (!addressLine1.trim()) {
      toast.error("Address line 1 is required");
      return;
    }
    if (!city.trim()) {
      toast.error("City is required");
      return;
    }
    if (!state) {
      toast.error("State is required");
      return;
    }
    if (!pincode.trim()) {
      toast.error("Pincode is required");
      return;
    }
    if (items.length === 0 || items.some(item => !item.productTitle || !item.variant || item.price <= 0)) {
      toast.error("Please fill all item details");
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await createManualOrder({
        customerName,
        customerPhone,
        customerEmail: customerEmail || undefined,
        addressLine1,
        addressLine2: addressLine2 || undefined,
        city,
        state,
        pincode,
        items: items.map(item => ({
          productId: item.productId,
          productTitle: item.productTitle,
          variant: item.variant,
          sku: item.sku || undefined,
          price: item.price,
          quantity: item.quantity,
          phoneModel: item.phoneModel || undefined,
          phoneBrand: item.phoneBrand || undefined,
        })),
        paymentMethod,
        shippingFee,
        codFee: codFee > 0 ? codFee : undefined,
        status,
        paymentStatus,
        awbNumber: awbNumber || undefined,
        trackingUrl: trackingUrl || undefined,
        courierName: courierName || undefined,
      });

      toast.success(`Order ${result.orderNumber} created successfully!`);
      resetForm();
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to create manual order:", error);
      toast.error(error instanceof Error ? error.message : "Failed to create order");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Create Manual Order</DialogTitle>
          <DialogDescription>
            Create a new order manually. All fields marked with * are required.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-180px)] pr-4">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Customer Information */}
            <div className="space-y-4">
              <h3 className="font-semibold text-sm">Customer Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="customerName">Full Name *</Label>
                  <Input
                    id="customerName"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="John Doe"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customerPhone">Phone *</Label>
                  <Input
                    id="customerPhone"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="9876543210"
                  />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="customerEmail">Email (Optional)</Label>
                  <Input
                    id="customerEmail"
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="customer@example.com"
                  />
                </div>
              </div>
            </div>

            {/* Shipping Address */}
            <div className="space-y-4">
              <h3 className="font-semibold text-sm">Shipping Address</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="addressLine1">Address Line 1 *</Label>
                  <Input
                    id="addressLine1"
                    value={addressLine1}
                    onChange={(e) => setAddressLine1(e.target.value)}
                    placeholder="House/Flat number, Building name"
                  />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="addressLine2">Address Line 2 (Optional)</Label>
                  <Input
                    id="addressLine2"
                    value={addressLine2}
                    onChange={(e) => setAddressLine2(e.target.value)}
                    placeholder="Street, Landmark"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city">City *</Label>
                  <Input
                    id="city"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Mumbai"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">State *</Label>
                  <Select value={state} onValueChange={setState}>
                    <SelectTrigger id="state">
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                    <SelectContent>
                      {INDIAN_STATES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pincode">Pincode *</Label>
                  <Input
                    id="pincode"
                    value={pincode}
                    onChange={(e) => setPincode(e.target.value)}
                    placeholder="400001"
                    maxLength={6}
                  />
                </div>
              </div>
            </div>

            {/* Order Items */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">Order Items</h3>
                <Button type="button" variant="outline" size="sm" onClick={handleAddItem}>
                  <PlusIcon className="w-4 h-4 mr-2" />
                  Add Item
                </Button>
              </div>
              {items.map((item, index) => (
                <div key={index} className="p-4 border rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Item {index + 1}</span>
                    {items.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveItem(index)}
                      >
                        <TrashIcon className="w-4 h-4 text-red-500" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2 space-y-2">
                      <Label>Product *</Label>
                      <Select
                        value={item.productId}
                        onValueChange={(value) => handleProductSelect(index, value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select product" />
                        </SelectTrigger>
                        <SelectContent>
                          {products?.map((p) => (
                            <SelectItem key={p._id} value={p._id}>
                              {p.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Variant *</Label>
                      <Input
                        value={item.variant}
                        onChange={(e) => handleItemChange(index, "variant", e.target.value)}
                        placeholder="e.g., Matte Black"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>SKU</Label>
                      <Input
                        value={item.sku}
                        onChange={(e) => handleItemChange(index, "sku", e.target.value)}
                        placeholder="e.g., M-174"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Price *</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.price}
                        onChange={(e) => handleItemChange(index, "price", parseFloat(e.target.value) || 0)}
                        placeholder="299"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Quantity *</Label>
                      <Input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(index, "quantity", parseInt(e.target.value) || 1)}
                        placeholder="1"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Phone Brand</Label>
                      <Input
                        value={item.phoneBrand || ""}
                        onChange={(e) => handleItemChange(index, "phoneBrand", e.target.value)}
                        placeholder="e.g., Apple"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Phone Model</Label>
                      <Input
                        value={item.phoneModel || ""}
                        onChange={(e) => handleItemChange(index, "phoneModel", e.target.value)}
                        placeholder="e.g., iPhone 15 Pro"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Order Details */}
            <div className="space-y-4">
              <h3 className="font-semibold text-sm">Order Details</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Payment Method *</Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="COD">Cash on Delivery</SelectItem>
                      <SelectItem value="Prepaid">Prepaid</SelectItem>
                      <SelectItem value="UPI">UPI</SelectItem>
                      <SelectItem value="Card">Card</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Payment Status *</Label>
                  <Select value={paymentStatus} onValueChange={(v) => setPaymentStatus(v as "pending" | "success" | "failed")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="success">Success</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Order Status *</Label>
                  <Select value={status} onValueChange={(v) => setStatus(v as any)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="processing">Processing</SelectItem>
                      <SelectItem value="shipped">Shipped</SelectItem>
                      <SelectItem value="delivered">Delivered</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                      <SelectItem value="rto">RTO</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Shipping Fee *</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={shippingFee}
                    onChange={(e) => setShippingFee(parseFloat(e.target.value) || 0)}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label>COD Fee</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={codFee}
                    onChange={(e) => setCodFee(parseFloat(e.target.value) || 0)}
                    placeholder="0"
                  />
                </div>
              </div>
            </div>

            {/* Shipping Information (Optional) */}
            <div className="space-y-4">
              <h3 className="font-semibold text-sm">Shipping Information (Optional)</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>AWB Number</Label>
                  <Input
                    value={awbNumber}
                    onChange={(e) => setAwbNumber(e.target.value)}
                    placeholder="e.g., 1234567890"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Courier Name</Label>
                  <Input
                    value={courierName}
                    onChange={(e) => setCourierName(e.target.value)}
                    placeholder="e.g., DTDC"
                  />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>Tracking URL</Label>
                  <Input
                    value={trackingUrl}
                    onChange={(e) => setTrackingUrl(e.target.value)}
                    placeholder="https://..."
                  />
                </div>
              </div>
            </div>

            {/* Order Summary */}
            <div className="p-4 bg-muted rounded-lg space-y-2">
              <h3 className="font-semibold text-sm">Order Summary</h3>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>₹{calculateSubtotal().toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Shipping Fee:</span>
                  <span>₹{shippingFee.toFixed(2)}</span>
                </div>
                {codFee > 0 && (
                  <div className="flex justify-between">
                    <span>COD Fee:</span>
                    <span>₹{codFee.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-base pt-2 border-t">
                  <span>Total:</span>
                  <span>₹{calculateTotal().toFixed(2)}</span>
                </div>
              </div>
            </div>
          </form>
        </ScrollArea>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Creating..." : "Create Order"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
