import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Link } from "react-router-dom";
import {
  TicketIcon,
  PlusIcon,
  EditIcon,
  TrashIcon,
  PackageIcon,
  CalendarIcon,
  UsersIcon,
  TrendingUpIcon,
  EyeIcon,
} from "lucide-react";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { SignInButton } from "@/components/ui/signin.tsx";
import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { useState } from "react";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { ScrollArea } from "@/components/ui/scroll-area.tsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs.tsx";
import { AdminLayout } from "@/components/admin-layout.tsx";

interface CouponFormData {
  code: string;
  description: string;
  discountType: "percentage" | "fixed";
  discountValue: string;
  minPurchase: string;
  maxDiscount: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  usageLimit: string;
  applicableVariantIds: string[];
  applicableCollectionIds: string[];
  applicableProductKeywords: string;
  minCartValue: string;
  minProductValue: string;
  allowedCustomerEmails: string;
}

function AdminCouponsPageInner() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Id<"coupons"> | null>(null);
  
  const coupons = useQuery(api.coupons.getAllCoupons, {});
  const collections = useQuery(api.collections.getAllCollections, {});
  // Only load products and variants when dialog is open to avoid massive query on page load
  const products = useQuery(
    api.products.getAllProductsBasic,
    showCreateDialog ? {} : "skip"
  );
  const variants = useQuery(
    api.products.getAllVariantsWithProducts, 
    showCreateDialog ? {} : "skip"
  );
  const deleteCoupon = useMutation(api.coupons.deleteCoupon);
  const createCoupon = useMutation(api.coupons.createCoupon);
  const updateCoupon = useMutation(api.coupons.updateCoupon);
  const [viewingEligibleProducts, setViewingEligibleProducts] = useState<Id<"coupons"> | null>(null);
  const [viewingStats, setViewingStats] = useState<Id<"coupons"> | null>(null);
  const [variantSearchQuery, setVariantSearchQuery] = useState("");
  const [collectionSearchQuery, setCollectionSearchQuery] = useState("");

  const eligibleProducts = useQuery(
    api.coupons.getEligibleProducts,
    viewingEligibleProducts ? { couponId: viewingEligibleProducts } : "skip"
  );

  const couponStats = useQuery(
    api.coupons.getCouponUsageStats,
    viewingStats ? { couponId: viewingStats } : "skip"
  );

  const [formData, setFormData] = useState<CouponFormData>({
    code: "",
    description: "",
    discountType: "percentage",
    discountValue: "",
    minPurchase: "",
    maxDiscount: "",
    startDate: new Date().toISOString().slice(0, 16),
    endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
    isActive: true,
    usageLimit: "",
    applicableVariantIds: [],
    applicableCollectionIds: [],
    applicableProductKeywords: "",
    minCartValue: "",
    minProductValue: "",
    allowedCustomerEmails: "",
  });

  const handleEdit = (couponId: Id<"coupons">) => {
    const coupon = coupons?.find((c) => c._id === couponId);
    if (!coupon) return;

    setFormData({
      code: coupon.code,
      description: coupon.description,
      discountType: coupon.discountType,
      discountValue: String(coupon.discountValue),
      minPurchase: coupon.minPurchase ? String(coupon.minPurchase) : "",
      maxDiscount: coupon.maxDiscount ? String(coupon.maxDiscount) : "",
      startDate: new Date(coupon.startDate).toISOString().slice(0, 16),
      endDate: new Date(coupon.endDate).toISOString().slice(0, 16),
      isActive: coupon.isActive,
      usageLimit: coupon.usageLimit ? String(coupon.usageLimit) : "",
      applicableVariantIds: coupon.applicableVariantIds || [],
      applicableCollectionIds: coupon.applicableCollectionIds || [],
      applicableProductKeywords: coupon.applicableProductKeywords?.join(", ") || "",
      minCartValue: coupon.minCartValue ? String(coupon.minCartValue) : "",
      minProductValue: coupon.minProductValue ? String(coupon.minProductValue) : "",
      allowedCustomerEmails: coupon.allowedCustomerEmails?.join(", ") || "",
    });
    setEditingCoupon(couponId);
    setShowCreateDialog(true);
  };

  const handleDelete = async (couponId: Id<"coupons">) => {
    if (!confirm("Are you sure you want to delete this coupon?")) return;

    try {
      await deleteCoupon({ couponId });
      toast.success("Coupon deleted successfully");
    } catch (error) {
      toast.error("Failed to delete coupon");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const data = {
        code: formData.code.toUpperCase(),
        description: formData.description,
        discountType: formData.discountType,
        discountValue: parseFloat(formData.discountValue),
        minPurchase: formData.minPurchase ? parseFloat(formData.minPurchase) : undefined,
        maxDiscount: formData.maxDiscount ? parseFloat(formData.maxDiscount) : undefined,
        startDate: new Date(formData.startDate).getTime(),
        endDate: new Date(formData.endDate).getTime(),
        isActive: formData.isActive,
        usageLimit: formData.usageLimit ? parseInt(formData.usageLimit, 10) : undefined,
        applicableVariantIds: formData.applicableVariantIds.length > 0 ? formData.applicableVariantIds as Array<Id<"variants">> : undefined,
        applicableCollectionIds: formData.applicableCollectionIds.length > 0 ? formData.applicableCollectionIds as Array<Id<"collections">> : undefined,
        applicableProductKeywords: formData.applicableProductKeywords
          ? formData.applicableProductKeywords.split(",").map((k) => k.trim()).filter(Boolean)
          : undefined,
        minCartValue: formData.minCartValue ? parseFloat(formData.minCartValue) : undefined,
        minProductValue: formData.minProductValue ? parseFloat(formData.minProductValue) : undefined,
        allowedCustomerEmails: formData.allowedCustomerEmails
          ? formData.allowedCustomerEmails.split(",").map((e) => e.trim()).filter(Boolean)
          : undefined,
      };

      if (editingCoupon) {
        await updateCoupon({
          couponId: editingCoupon,
          ...data,
        });
        toast.success("Coupon updated successfully");
      } else {
        await createCoupon(data);
        toast.success("Coupon created successfully");
      }

      setShowCreateDialog(false);
      setEditingCoupon(null);
      setVariantSearchQuery("");
      setCollectionSearchQuery("");
      setFormData({
        code: "",
        description: "",
        discountType: "percentage",
        discountValue: "",
        minPurchase: "",
        maxDiscount: "",
        startDate: new Date().toISOString().slice(0, 16),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
        isActive: true,
        usageLimit: "",
        applicableVariantIds: [],
        applicableCollectionIds: [],
        applicableProductKeywords: "",
        minCartValue: "",
        minProductValue: "",
        allowedCustomerEmails: "",
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save coupon");
    }
  };

  const handleToggleCollection = (collectionId: Id<"collections">) => {
    setFormData((prev) => ({
      ...prev,
      applicableCollectionIds: prev.applicableCollectionIds.includes(collectionId)
        ? prev.applicableCollectionIds.filter((id) => id !== collectionId)
        : [...prev.applicableCollectionIds, collectionId],
    }));
  };

  const handleToggleVariant = (variantId: Id<"variants">) => {
    setFormData((prev) => ({
      ...prev,
      applicableVariantIds: prev.applicableVariantIds.includes(variantId)
        ? prev.applicableVariantIds.filter((id) => id !== variantId)
        : [...prev.applicableVariantIds, variantId],
    }));
  };

  if (coupons === undefined || collections === undefined) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  const now = Date.now();

  // Filter variants and collections based on search
  const filteredVariants = variants ? variants.filter((variant) => {
    const searchLower = variantSearchQuery.toLowerCase();
    return (
      variant.productTitle.toLowerCase().includes(searchLower) ||
      variant.title.toLowerCase().includes(searchLower) ||
      variant.sku.toLowerCase().includes(searchLower)
    );
  }) : [];

  const filteredCollections = collections.filter((collection) => {
    return collection.name.toLowerCase().includes(collectionSearchQuery.toLowerCase());
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Coupons</h1>
          <p className="text-muted-foreground">Manage discount codes and promotions</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <PlusIcon className="size-4 mr-2" />
          Create Coupon
        </Button>
      </div>

      {coupons.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <TicketIcon />
            </EmptyMedia>
            <EmptyTitle>No coupons yet</EmptyTitle>
            <EmptyDescription>Create your first coupon to offer discounts</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={() => setShowCreateDialog(true)}>
              <PlusIcon className="size-4 mr-2" />
              Create Coupon
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="grid gap-4">
          {coupons.map((coupon) => {
            const isActive = coupon.isActive && coupon.startDate <= now && coupon.endDate >= now;
            const isExpired = coupon.endDate < now;
            const isUpcoming = coupon.startDate > now;

            return (
              <Card key={coupon._id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-2xl font-mono">{coupon.code}</CardTitle>
                        {isActive && (
                          <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
                            Active
                          </Badge>
                        )}
                        {isExpired && (
                          <Badge className="bg-gray-500/10 text-gray-500 border-gray-500/20">
                            Expired
                          </Badge>
                        )}
                        {isUpcoming && (
                          <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">
                            Upcoming
                          </Badge>
                        )}
                        {!coupon.isActive && (
                          <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
                            Inactive
                          </Badge>
                        )}
                      </div>
                      <CardDescription>{coupon.description}</CardDescription>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setViewingEligibleProducts(coupon._id)}
                      >
                        <PackageIcon className="size-4 mr-1" />
                        Eligible Products
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setViewingStats(coupon._id)}
                      >
                        <TrendingUpIcon className="size-4 mr-1" />
                        Stats
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleEdit(coupon._id)}>
                        <EditIcon className="size-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDelete(coupon._id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <TrashIcon className="size-3" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <div className="text-muted-foreground">Discount</div>
                      <div className="font-semibold">
                        {coupon.discountType === "percentage"
                          ? `${coupon.discountValue}% off`
                          : `₹${coupon.discountValue} off`}
                        {coupon.maxDiscount && coupon.discountType === "percentage" && (
                          <span className="text-xs text-muted-foreground ml-1">
                            (max ₹{coupon.maxDiscount})
                          </span>
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Usage</div>
                      <div className="font-semibold">
                        {coupon.usageCount}
                        {coupon.usageLimit && ` / ${coupon.usageLimit}`}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Valid From</div>
                      <div className="font-semibold">
                        {new Date(coupon.startDate).toLocaleDateString()}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Valid Until</div>
                      <div className="font-semibold">
                        {new Date(coupon.endDate).toLocaleDateString()}
                      </div>
                    </div>
                  </div>

                  {(coupon.minPurchase ||
                    coupon.minCartValue ||
                    coupon.minProductValue ||
                    coupon.applicableVariantIds?.length ||
                    coupon.applicableCollectionIds?.length ||
                    coupon.applicableProductKeywords?.length ||
                    coupon.allowedCustomerEmails?.length) && (
                    <div className="mt-4 pt-4 border-t space-y-2">
                      <div className="text-sm font-medium">Conditions:</div>
                      <div className="flex flex-wrap gap-2">
                        {coupon.minPurchase && (
                          <Badge variant="outline">Min purchase: ₹{coupon.minPurchase}</Badge>
                        )}
                        {coupon.minCartValue && (
                          <Badge variant="outline">Min cart: ₹{coupon.minCartValue}</Badge>
                        )}
                        {coupon.minProductValue && (
                          <Badge variant="outline">Min product: ₹{coupon.minProductValue}</Badge>
                        )}
                        {coupon.applicableVariantIds && coupon.applicableVariantIds.length > 0 && (
                          <Badge variant="outline">
                            {coupon.applicableVariantIds.length} specific variant(s)
                          </Badge>
                        )}
                        {coupon.applicableCollectionIds && coupon.applicableCollectionIds.length > 0 && (
                          <Badge variant="outline">
                            {coupon.applicableCollectionIds.length} collection(s)
                          </Badge>
                        )}
                        {coupon.applicableProductKeywords && coupon.applicableProductKeywords.length > 0 && (
                          <Badge variant="outline">
                            Keywords: {coupon.applicableProductKeywords.join(", ")}
                          </Badge>
                        )}
                        {coupon.allowedCustomerEmails && coupon.allowedCustomerEmails.length > 0 && (
                          <Badge variant="outline">
                            {coupon.allowedCustomerEmails.length} customer(s)
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{editingCoupon ? "Edit Coupon" : "Create Coupon"}</DialogTitle>
            <DialogDescription>
              Configure discount codes with custom conditions and restrictions
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
            <div className="flex-1 overflow-y-auto pr-4">
              <div className="space-y-6 py-4">
                {/* Basic Info */}
                <div className="space-y-4">
                  <h3 className="font-semibold">Basic Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="code">Coupon Code *</Label>
                      <Input
                        id="code"
                        value={formData.code}
                        onChange={(e) =>
                          setFormData({ ...formData, code: e.target.value.toUpperCase() })
                        }
                        placeholder="SUMMER2024"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="discountType">Discount Type *</Label>
                      <Select
                        value={formData.discountType}
                        onValueChange={(value: "percentage" | "fixed") =>
                          setFormData({ ...formData, discountType: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="percentage">Percentage (%)</SelectItem>
                          <SelectItem value="fixed">Fixed Amount (₹)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="description">Description *</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Describe what this coupon is for..."
                      required
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="discountValue">
                        {formData.discountType === "percentage" ? "Percentage *" : "Amount (₹) *"}
                      </Label>
                      <Input
                        id="discountValue"
                        type="number"
                        step="0.01"
                        value={formData.discountValue}
                        onChange={(e) =>
                          setFormData({ ...formData, discountValue: e.target.value })
                        }
                        required
                      />
                    </div>
                    {formData.discountType === "percentage" && (
                      <div>
                        <Label htmlFor="maxDiscount">Max Discount (₹)</Label>
                        <Input
                          id="maxDiscount"
                          type="number"
                          step="0.01"
                          value={formData.maxDiscount}
                          onChange={(e) =>
                            setFormData({ ...formData, maxDiscount: e.target.value })
                          }
                        />
                      </div>
                    )}
                    <div>
                      <Label htmlFor="minPurchase">Min Purchase (₹)</Label>
                      <Input
                        id="minPurchase"
                        type="number"
                        step="0.01"
                        value={formData.minPurchase}
                        onChange={(e) =>
                          setFormData({ ...formData, minPurchase: e.target.value })
                        }
                      />
                    </div>
                  </div>
                </div>

                {/* Date & Status */}
                <div className="space-y-4">
                  <h3 className="font-semibold">Date & Status</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="startDate">Start Date *</Label>
                      <Input
                        id="startDate"
                        type="datetime-local"
                        value={formData.startDate}
                        onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="endDate">End Date *</Label>
                      <Input
                        id="endDate"
                        type="datetime-local"
                        value={formData.endDate}
                        onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="isActive"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                      className="rounded"
                    />
                    <Label htmlFor="isActive">Active</Label>
                  </div>

                  <div>
                    <Label htmlFor="usageLimit">Usage Limit</Label>
                    <Input
                      id="usageLimit"
                      type="number"
                      value={formData.usageLimit}
                      onChange={(e) => setFormData({ ...formData, usageLimit: e.target.value })}
                      placeholder="Unlimited"
                    />
                  </div>
                </div>

                {/* Applicability */}
                <div className="space-y-4">
                  <h3 className="font-semibold">Applicability Conditions</h3>
                  <p className="text-xs text-muted-foreground">
                    Choose at least one condition. If multiple conditions are set, the coupon applies to products matching ANY condition.
                  </p>
                  
                  <div>
                    <Label>Specific Variants (SKUs)</Label>
                    <p className="text-xs text-muted-foreground mb-2">
                      Select specific product variants this coupon applies to
                    </p>
                    <Input
                      placeholder="Search by product name, variant, or SKU..."
                      value={variantSearchQuery}
                      onChange={(e) => setVariantSearchQuery(e.target.value)}
                      className="mb-2"
                    />
                    {formData.applicableVariantIds.length > 0 && (
                      <div className="mb-2 text-sm text-muted-foreground">
                        {formData.applicableVariantIds.length} variant(s) selected
                      </div>
                    )}
                    <div className="space-y-2 max-h-64 overflow-y-auto border rounded-md p-3">
                      {variants === undefined ? (
                        <div className="space-y-2">
                          {Array.from({ length: 3 }).map((_, i) => (
                            <Skeleton key={i} className="h-8 w-full" />
                          ))}
                        </div>
                      ) : variants.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No variants available</p>
                      ) : filteredVariants.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No variants match your search</p>
                      ) : (
                        filteredVariants.map((variant) => (
                          <div key={variant._id} className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id={`variant-${variant._id}`}
                              checked={formData.applicableVariantIds.includes(variant._id)}
                              onChange={() => handleToggleVariant(variant._id)}
                              className="rounded"
                            />
                            <Label htmlFor={`variant-${variant._id}`} className="font-normal text-sm cursor-pointer flex-1">
                              <span className="font-medium">{variant.productTitle}</span>
                              <span className="text-muted-foreground"> - {variant.title}</span>
                              <span className="text-xs text-muted-foreground"> (SKU: {variant.sku})</span>
                            </Label>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                  
                  <div>
                    <Label>Collections</Label>
                    <p className="text-xs text-muted-foreground mb-2">
                      Apply to all products in selected collections
                    </p>
                    <Input
                      placeholder="Search collections..."
                      value={collectionSearchQuery}
                      onChange={(e) => setCollectionSearchQuery(e.target.value)}
                      className="mb-2"
                    />
                    {formData.applicableCollectionIds.length > 0 && (
                      <div className="mb-2 text-sm text-muted-foreground">
                        {formData.applicableCollectionIds.length} collection(s) selected
                      </div>
                    )}
                    <div className="space-y-2 max-h-48 overflow-y-auto border rounded-md p-3">
                      {collections.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No collections available</p>
                      ) : filteredCollections.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No collections match your search</p>
                      ) : (
                        filteredCollections.map((collection) => (
                          <div key={collection._id} className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id={`collection-${collection._id}`}
                              checked={formData.applicableCollectionIds.includes(collection._id)}
                              onChange={() => handleToggleCollection(collection._id)}
                              className="rounded"
                            />
                            <Label htmlFor={`collection-${collection._id}`} className="font-normal cursor-pointer flex-1">
                              {collection.name}
                            </Label>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="keywords">Product Keywords (comma-separated)</Label>
                    <Input
                      id="keywords"
                      value={formData.applicableProductKeywords}
                      onChange={(e) =>
                        setFormData({ ...formData, applicableProductKeywords: e.target.value })
                      }
                      placeholder="magneto, autoapply, tempered"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Applies to products containing these keywords in their title
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="minCartValue">Min Cart Value (₹)</Label>
                      <Input
                        id="minCartValue"
                        type="number"
                        step="0.01"
                        value={formData.minCartValue}
                        onChange={(e) =>
                          setFormData({ ...formData, minCartValue: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="minProductValue">Min Product Value (₹)</Label>
                      <Input
                        id="minProductValue"
                        type="number"
                        step="0.01"
                        value={formData.minProductValue}
                        onChange={(e) =>
                          setFormData({ ...formData, minProductValue: e.target.value })
                        }
                      />
                    </div>
                  </div>
                </div>

                {/* Customer Restrictions */}
                <div className="space-y-4">
                  <h3 className="font-semibold">Customer Restrictions</h3>
                  <div>
                    <Label htmlFor="emails">Allowed Customer Emails (comma-separated)</Label>
                    <Textarea
                      id="emails"
                      value={formData.allowedCustomerEmails}
                      onChange={(e) =>
                        setFormData({ ...formData, allowedCustomerEmails: e.target.value })
                      }
                      placeholder="user@example.com, customer@example.com"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Leave empty to allow all customers
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="pt-4 border-t flex-shrink-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowCreateDialog(false);
                  setEditingCoupon(null);
                  setVariantSearchQuery("");
                  setCollectionSearchQuery("");
                }}
              >
                Cancel
              </Button>
              <Button type="submit">
                {editingCoupon ? "Update Coupon" : "Create Coupon"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Eligible Products Dialog */}
      <Dialog
        open={!!viewingEligibleProducts}
        onOpenChange={() => setViewingEligibleProducts(null)}
      >
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Eligible Products</DialogTitle>
            <DialogDescription>
              Products that qualify for this coupon based on current conditions
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            {eligibleProducts === undefined ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : eligibleProducts.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <PackageIcon />
                  </EmptyMedia>
                  <EmptyTitle>No eligible products</EmptyTitle>
                  <EmptyDescription>
                    No products match the conditions of this coupon
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <div className="space-y-4">
                {eligibleProducts.map((product) => (
                  <Card key={product._id}>
                    <CardContent className="p-4">
                      <div className="flex gap-4">
                        {product.images[0] && (
                          <img
                            src={product.images[0].url}
                            alt={product.title}
                            className="w-16 h-16 object-cover rounded"
                          />
                        )}
                        <div className="flex-1">
                          <h4 className="font-semibold">{product.title}</h4>
                          <p className="text-sm text-muted-foreground">
                            {product.variants.length} eligible variant(s)
                          </p>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {product.variants.slice(0, 3).map((v) => (
                              <Badge key={v._id} variant="outline" className="text-xs">
                                {v.title} - ₹{v.price}
                              </Badge>
                            ))}
                            {product.variants.length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{product.variants.length - 3} more
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Stats Dialog */}
      <Dialog open={!!viewingStats} onOpenChange={() => setViewingStats(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Coupon Statistics</DialogTitle>
            <DialogDescription>Usage data and analytics for this coupon</DialogDescription>
          </DialogHeader>
          {couponStats === undefined ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">Total Uses</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{couponStats.totalUsages}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">
                      Total Discount
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">₹{couponStats.totalDiscount}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">
                      Unique Users
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{couponStats.uniqueUsers}</div>
                  </CardContent>
                </Card>
              </div>

              {couponStats.recentUsages.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-3">Recent Usage</h4>
                  <div className="space-y-2">
                    {couponStats.recentUsages.map((usage) => (
                      <div
                        key={usage._id}
                        className="flex justify-between items-center p-3 bg-muted/50 rounded"
                      >
                        <div>
                          <div className="font-medium">{usage.userEmail}</div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(usage.usedAt).toLocaleString()}
                          </div>
                        </div>
                        <div className="font-semibold">-₹{usage.discountAmount}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function AdminCouponsPage() {
  return (
    <AdminLayout>
      <Unauthenticated>
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <TicketIcon />
              </EmptyMedia>
              <EmptyTitle>Please sign in to access admin</EmptyTitle>
              <EmptyDescription>
                You need to be logged in to manage coupons
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <SignInButton />
            </EmptyContent>
          </Empty>
        </Unauthenticated>
        <AuthLoading>
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        </AuthLoading>
      <Authenticated>
        <AdminCouponsPageInner />
      </Authenticated>
    </AdminLayout>
  );
}
