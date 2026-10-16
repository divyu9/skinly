import { useState } from "react";
import { useMutation, useQuery, useConvex } from "@/lib/firebase-hooks";
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
import { ORDER_STATUSES, type OrderStatus } from "@/lib/normalize-order.ts";
import { ADMIN_STATUS_LABELS } from "@/lib/order-label.ts";
import { PlusIcon, TrashIcon } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area.tsx";
import { SearchPicker } from "./_components/SearchPicker.tsx";
import { LensSelector, isWithLensVariant } from "@/components/product/LensSelector.tsx";

type OrderItem = {
  productId: string;
  productTitle: string;
  variant: string;
  sku: string;
  price: number;
  quantity: number;
  phoneModel?: string;
  phoneBrand?: string;
  lensModel?: string;
  /** The listing's device kind (phone, camera, laptop…): which models the model search offers. */
  gadget?: string;
};

/**
 * The device a skin is cut for, searched like the product page's picker:
 * the models of the listing's own kind (phones for a phone skin, cameras for
 * a camera skin), brand filled in with the model.
 */
function ModelPicker({ gadget, brand, model, onPick }: {
  gadget: string;
  brand?: string;
  model?: string;
  onPick: (brand: string, model: string) => void;
}) {
  const models = useQuery(api.supportedModels.listAll, { category: gadget, isActive: true });
  return (
    <SearchPicker<any>
      rows={models}
      value={model ? [brand, model].filter(Boolean).join(" ") : ""}
      onPick={(m) => onPick(String(m.brandName || ""), String(m.modelName || ""))}
      label={(m) => `${m.brandName} ${m.modelName}`}
      placeholder={`Search ${gadget} model`}
      searchPlaceholder="e.g. iphone 15 pro, s24fe, a7iii"
      emptyText="No model matches — type it in the boxes below."
    />
  );
}

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
  const convex = useConvex();

  // A coupon, checked the way checkout checks it (coupons.validateCoupon).
  const [couponInput, setCouponInput] = useState("");
  const [coupon, setCoupon] = useState<{ id: string; code: string; discount: number; walletCredit: number } | null>(null);
  const [couponBusy, setCouponBusy] = useState(false);

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
  const [status, setStatus] = useState<OrderStatus>("processing");
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

    // Its first priced variant, with SKU and price, so the line is ready to go.
    const variants = ((product as any).variants || []).filter((v: any) => Number(v?.price) > 0);
    const v = variants[0];
    const newItems = [...items];
    newItems[index] = {
      ...newItems[index],
      productId: product._id,
      productTitle: product.title,
      gadget: String((product as any).gadgetCategory || "phone"),
      ...(v ? { variant: String(v.title || ""), sku: String(v.sku || ""), price: Number(v.price) || 0 } : {}),
      lensModel: "",
    };
    setItems(newItems);
  };

  const handleVariantSelect = (index: number, title: string) => {
    const product = products?.find(p => p._id === items[index].productId);
    const v = ((product as any)?.variants || []).find((x: any) => x.title === title);
    const newItems = [...items];
    newItems[index] = { ...newItems[index], variant: title, ...(v ? { sku: String(v.sku || ""), price: Number(v.price) || 0 } : {}), lensModel: "" };
    setItems(newItems);
  };

  const calculateSubtotal = () => {
    return items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  };

  const couponDiscount = coupon ? Math.min(coupon.discount, calculateSubtotal()) : 0;
  const calculateTotal = () => {
    return Math.max(0, calculateSubtotal() - couponDiscount) + shippingFee + codFee;
  };

  const applyCoupon = async () => {
    const code = couponInput.trim().toUpperCase();
    if (!code) return;
    if (!items.some((i) => i.productId && i.price > 0)) { toast.error("Add an item first"); return; }
    setCouponBusy(true);
    try {
      const r: any = await convex.query(api.coupons.validateCoupon, {
        code,
        cartTotal: calculateSubtotal(),
        userEmail: customerEmail || undefined,
        cartItems: items.filter((i) => i.productId).map((i) => ({ productId: i.productId, productTitle: i.productTitle, variant: i.variant, price: i.price, quantity: i.quantity })),
      });
      if (!r) { toast.error("That coupon could not be found"); return; }
      setCoupon({ id: String(r.coupon?._id || ""), code, discount: r.isWalletCredit ? 0 : Number(r.discountAmount) || 0, walletCredit: r.isWalletCredit ? Number(r.walletCreditAmount) || 0 : 0 });
      toast.success(r.isWalletCredit ? `${code}: ₹${r.walletCreditAmount} wallet credit on delivery` : `${code}: ₹${Math.round(Number(r.discountAmount) || 0)} off`);
    } catch (e: any) {
      toast.error(e?.data?.message || e?.message || "Coupon could not be applied");
    } finally {
      setCouponBusy(false);
    }
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
    setCoupon(null);
    setCouponInput("");
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
    // An order with no email can be told nothing and looked up by nobody —
    // no confirmation, no dispatch note, and no guest tracking.
    if (!customerEmail.trim()) {
      toast.error("Customer email is required");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(customerEmail.trim())) {
      toast.error("Please enter a valid email address");
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
      /*
       * The order as checkout writes it: customerName, phone, email and a
       * shippingAddress object, items with their picture and variant id,
       * itemsTotal / total / amountPayable. The dialog used to send flat
       * fields that createManualOrder read from `args.orderData`, which it
       * never sent — so it saved an empty order (three fields), showed
       * "created", and the order list had nothing to show. Order number and
       * invoice follow from orderConfirm.ts once it is paid or COD.
       */
      const phone10 = customerPhone.replace(/\D/g, "").slice(-10);
      const phone = phone10 ? `+91${phone10}` : customerPhone.trim();
      const itemsTotal = calculateSubtotal();
      const total = calculateTotal();
      const orderData: Record<string, any> = {
        source: "manual",
        customerName: customerName.trim(),
        phone,
        email: customerEmail.trim().toLowerCase(),
        shippingAddress: {
          fullName: customerName.trim(), phone,
          addressLine1: addressLine1.trim(), addressLine2: addressLine2.trim(),
          city: city.trim(), state, pincode: pincode.trim(),
        },
        items: items.map((item) => {
          const product: any = products?.find((p) => p._id === item.productId);
          const v = (product?.variants || []).find((x: any) => x.title === item.variant);
          return {
            productId: item.productId,
            productTitle: item.productTitle,
            productImage: String(product?.images?.find((i: any) => i?.url)?.url || ""),
            variant: item.variant,
            ...(v?._id ? { variantId: v._id } : {}),
            ...(item.sku ? { sku: item.sku } : {}),
            price: item.price,
            quantity: item.quantity,
            ...(item.phoneModel ? { phoneModel: item.phoneModel } : {}),
            ...(item.phoneBrand ? { phoneBrand: item.phoneBrand } : {}),
            ...(item.lensModel ? { lensModel: item.lensModel } : {}),
          };
        }),
        itemsTotal,
        shippingFee,
        codFee,
        couponCode: coupon?.code || "",
        couponId: coupon?.id || null,
        couponDiscount,
        ...(coupon?.walletCredit ? { walletCreditCouponAmount: coupon.walletCredit } : {}),
        total,
        amountPayable: total,
        paymentMethod: paymentMethod.toLowerCase() === "cod" ? "cod" : paymentMethod,
        paymentStatus,
        status,
        statusChangedAt: Date.now(),
        ...(awbNumber ? { awbNumber } : {}),
        ...(trackingUrl ? { trackingUrl } : {}),
        ...(courierName ? { courierName } : {}),
      };
      const orderId = await createManualOrder({ orderData });
      toast.success(paymentStatus === "success" || orderData.paymentMethod === "cod"
        ? "Order created — its order number and invoice follow in a moment"
        : "Order created (payment pending: no order number until it is paid)");
      void orderId;
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
                  <Label htmlFor="customerEmail">Email *</Label>
                  <Input
                    id="customerEmail"
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="customer@example.com"
                    required
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
                      <SearchPicker<any>
                        rows={products as any[] | undefined}
                        value={item.productTitle}
                        onPick={(p) => handleProductSelect(index, p._id)}
                        label={(p) => String(p.title || "")}
                        sub={(p) => [p.status !== "active" ? p.status : "", ...(p.variants || []).slice(0, 3).map((v: any) => `${v.title} ₹${v.price}`)].filter(Boolean).join(" · ")}
                        full={(p) => `${p.title} ${(p.tags || []).join(" ")} ${(p.variantSkus || []).join(" ")}`}
                        placeholder="Search product"
                        searchPlaceholder="Design name, device or SKU, e.g. R-76 sony"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Variant *</Label>
                      {(() => {
                        const pv = (((products as any[] | undefined)?.find((p) => p._id === item.productId))?.variants || []).filter((v: any) => Number(v?.price) > 0);
                        return pv.length ? (
                          <Select value={item.variant} onValueChange={(v) => handleVariantSelect(index, v)}>
                            <SelectTrigger><SelectValue placeholder="Select variant" /></SelectTrigger>
                            <SelectContent>
                              {pv.map((v: any) => (
                                <SelectItem key={v._id || v.title} value={v.title}>{v.title} · ₹{v.price}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            value={item.variant}
                            onChange={(e) => handleItemChange(index, "variant", e.target.value)}
                            placeholder="e.g., Matte Black"
                          />
                        );
                      })()}
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
                    {item.productId && (
                      <div className="col-span-2 space-y-2">
                        <Label>Device model</Label>
                        <ModelPicker
                          gadget={item.gadget || "phone"}
                          brand={item.phoneBrand}
                          model={item.phoneModel}
                          onPick={(b, m) => {
                            const n = [...items];
                            n[index] = { ...n[index], phoneBrand: b, phoneModel: m, lensModel: "" };
                            setItems(n);
                          }}
                        />
                      </div>
                    )}
                    {item.gadget === "camera" && isWithLensVariant(item.variant) && (
                      <div className="col-span-2">
                        <LensSelector
                          brand={item.phoneBrand || ""}
                          value={item.lensModel || ""}
                          onChange={(l) => handleItemChange(index, "lensModel", l)}
                        />
                      </div>
                    )}
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
                      {ORDER_STATUSES.map((st) => (
                        <SelectItem key={st} value={st}>{ADMIN_STATUS_LABELS[st]}</SelectItem>
                      ))}
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

            {/* Coupon */}
            <div className="space-y-2">
              <Label>Coupon code</Label>
              {coupon ? (
                <div className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                  <span><b>{coupon.code}</b> · {coupon.walletCredit ? `₹${coupon.walletCredit} wallet credit on delivery` : `₹${couponDiscount.toFixed(0)} off`}</span>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setCoupon(null)}>Remove</Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input value={couponInput} onChange={(e) => setCouponInput(e.target.value.toUpperCase())} placeholder="e.g. BBD50"
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void applyCoupon(); } }} />
                  <Button type="button" variant="outline" onClick={applyCoupon} disabled={couponBusy || !couponInput.trim()}>
                    {couponBusy ? "Checking…" : "Apply"}
                  </Button>
                </div>
              )}
            </div>

            {/* Order Summary */}
            <div className="p-4 bg-muted rounded-lg space-y-2">
              <h3 className="font-semibold text-sm">Order Summary</h3>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>₹{calculateSubtotal().toFixed(2)}</span>
                </div>
                {couponDiscount > 0 && (
                  <div className="flex justify-between text-green-700">
                    <span>Coupon ({coupon?.code}):</span>
                    <span>−₹{couponDiscount.toFixed(2)}</span>
                  </div>
                )}
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
