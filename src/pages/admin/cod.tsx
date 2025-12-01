import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { AdminHeader } from "@/components/admin-header.tsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { toast } from "sonner";
import { useState, useEffect, useMemo } from "react";
import { Separator } from "@/components/ui/separator.tsx";
import { 
  BanknoteIcon, 
  SettingsIcon, 
  PackageIcon, 
  TagIcon, 
  LayoutListIcon,
  DollarSignIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  HashIcon,
  CheckCircleIcon,
  XCircleIcon,
} from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel.d.ts";

export default function AdminCOD() {
  const settings = useQuery(api.cod.getCodSettings, {});
  const updateSettings = useMutation(api.cod.updateCodSettings);
  const initializeSettings = useMutation(api.cod.initializeCodSettings);
  
  const products = useQuery(api.products.getAllProducts, {});
  const collections = useQuery(api.collections.getAllCollections, {});
  const variants = useQuery(api.products.getAllVariants, {});

  // Form state
  const [enabled, setEnabled] = useState(false);
  const [matchMode, setMatchMode] = useState<"ALL" | "ANY">("ALL");
  
  // Conditions
  const [productIdsEnabled, setProductIdsEnabled] = useState(false);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  
  const [collectionIdsEnabled, setCollectionIdsEnabled] = useState(false);
  const [selectedCollectionIds, setSelectedCollectionIds] = useState<string[]>([]);
  
  const [variantIdsEnabled, setVariantIdsEnabled] = useState(false);
  const [selectedVariantIds, setSelectedVariantIds] = useState<string[]>([]);
  
  const [minOrderAmountEnabled, setMinOrderAmountEnabled] = useState(false);
  const [minOrderAmount, setMinOrderAmount] = useState(0);
  
  const [maxOrderAmountEnabled, setMaxOrderAmountEnabled] = useState(false);
  const [maxOrderAmount, setMaxOrderAmount] = useState(0);
  
  const [minProductCountEnabled, setMinProductCountEnabled] = useState(false);
  const [minProductCount, setMinProductCount] = useState(0);
  
  const [maxProductCountEnabled, setMaxProductCountEnabled] = useState(false);
  const [maxProductCount, setMaxProductCount] = useState(0);
  
  // Fee configuration
  const [codFeeType, setCodFeeType] = useState<"fixed" | "percentage">("fixed");
  const [codFeeValue, setCodFeeValue] = useState(0);
  
  // Partial COD
  const [partialCodEnabled, setPartialCodEnabled] = useState(false);
  const [prepaidType, setPrepaidType] = useState<"fixed" | "percentage">("fixed");
  const [prepaidValue, setPrepaidValue] = useState(0);

  const [saving, setSaving] = useState(false);

  // Search states
  const [productSearchTerm, setProductSearchTerm] = useState("");
  const [collectionSearchTerm, setCollectionSearchTerm] = useState("");
  const [variantSearchTerm, setVariantSearchTerm] = useState("");

  // Filtered lists
  const filteredProducts = useMemo(() => {
    if (!products) return [];
    if (!productSearchTerm) return products;
    const term = productSearchTerm.toLowerCase();
    return products.filter((p) => p.title.toLowerCase().includes(term));
  }, [products, productSearchTerm]);

  const filteredCollections = useMemo(() => {
    if (!collections) return [];
    if (!collectionSearchTerm) return collections;
    const term = collectionSearchTerm.toLowerCase();
    return collections.filter((c) => c.name.toLowerCase().includes(term));
  }, [collections, collectionSearchTerm]);

  const filteredVariants = useMemo(() => {
    if (!variants) return [];
    if (!variantSearchTerm) return variants;
    const term = variantSearchTerm.toLowerCase();
    return variants.filter((v) => 
      v.sku.toLowerCase().includes(term) || 
      v.title.toLowerCase().includes(term)
    );
  }, [variants, variantSearchTerm]);

  // Load settings into form
  useEffect(() => {
    if (settings) {
      setEnabled(settings.enabled);
      setMatchMode(settings.matchMode);
      setProductIdsEnabled(settings.productIdsEnabled);
      setSelectedProductIds(settings.productIds);
      setCollectionIdsEnabled(settings.collectionIdsEnabled);
      setSelectedCollectionIds(settings.collectionIds);
      setVariantIdsEnabled(settings.variantIdsEnabled);
      setSelectedVariantIds(settings.variantIds);
      setMinOrderAmountEnabled(settings.minOrderAmountEnabled);
      setMinOrderAmount(settings.minOrderAmount);
      setMaxOrderAmountEnabled(settings.maxOrderAmountEnabled);
      setMaxOrderAmount(settings.maxOrderAmount);
      setMinProductCountEnabled(settings.minProductCountEnabled);
      setMinProductCount(settings.minProductCount);
      setMaxProductCountEnabled(settings.maxProductCountEnabled);
      setMaxProductCount(settings.maxProductCount);
      setCodFeeType(settings.codFeeType);
      setCodFeeValue(settings.codFeeValue);
      setPartialCodEnabled(settings.partialCodEnabled);
      setPrepaidType(settings.prepaidType);
      setPrepaidValue(settings.prepaidValue);
    }
  }, [settings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSettings({
        enabled,
        matchMode,
        productIdsEnabled,
        productIds: selectedProductIds as Id<"products">[],
        collectionIdsEnabled,
        collectionIds: selectedCollectionIds as Id<"collections">[],
        variantIdsEnabled,
        variantIds: selectedVariantIds as Id<"variants">[],
        minOrderAmountEnabled,
        minOrderAmount,
        maxOrderAmountEnabled,
        maxOrderAmount,
        minProductCountEnabled,
        minProductCount,
        maxProductCountEnabled,
        maxProductCount,
        codFeeType,
        codFeeValue,
        partialCodEnabled,
        prepaidType,
        prepaidValue,
      });
      toast.success("COD settings saved successfully");
    } catch (error) {
      toast.error("Failed to save COD settings");
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const handleInitialize = async () => {
    try {
      await initializeSettings({});
      toast.success("COD settings initialized");
    } catch (error) {
      toast.error("Failed to initialize settings");
    }
  };

  // Count active conditions
  const activeConditions = [
    productIdsEnabled,
    collectionIdsEnabled,
    variantIdsEnabled,
    minOrderAmountEnabled,
    maxOrderAmountEnabled,
    minProductCountEnabled,
    maxProductCountEnabled,
  ].filter(Boolean).length;

  if (settings === undefined || products === undefined || collections === undefined || variants === undefined) {
    return (
      <div className="min-h-screen bg-background">
        <AdminHeader />
        <div className="container mx-auto py-8 space-y-6">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-60 w-full" />
          <Skeleton className="h-60 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader />
      
      <div className="container mx-auto py-8 space-y-6 max-w-5xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <BanknoteIcon className="size-8" />
              COD Settings
            </h1>
            <p className="text-muted-foreground mt-1">
              Configure Cash on Delivery availability, fees, and conditions
            </p>
          </div>
          <div className="flex items-center gap-2">
            {enabled ? (
              <Badge variant="default" className="gap-1">
                <CheckCircleIcon className="size-3" />
                COD Enabled
              </Badge>
            ) : (
              <Badge variant="secondary" className="gap-1">
                <XCircleIcon className="size-3" />
                COD Disabled
              </Badge>
            )}
          </div>
        </div>

        {/* Master Toggle */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SettingsIcon className="size-5" />
              Master Control
            </CardTitle>
            <CardDescription>
              Enable or disable Cash on Delivery payment option for customers
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div className="space-y-1">
                <Label className="text-base font-semibold">Enable COD</Label>
                <p className="text-sm text-muted-foreground">
                  Allow customers to pay cash on delivery
                </p>
              </div>
              <Switch
                checked={enabled}
                onCheckedChange={setEnabled}
              />
            </div>
          </CardContent>
        </Card>

        {/* Match Logic */}
        {enabled && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Match Logic
              </CardTitle>
              <CardDescription>
                Define how conditions should be evaluated
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <Label className="text-sm font-medium">
                    When determining COD availability:
                  </Label>
                  <Select value={matchMode} onValueChange={(v) => setMatchMode(v as "ALL" | "ANY")}>
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Match ALL conditions</SelectItem>
                      <SelectItem value="ANY">Match ANY condition</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                  {matchMode === "ALL" ? (
                    <>✓ All enabled conditions must be satisfied for COD to be available</>
                  ) : (
                    <>✓ At least one enabled condition must be satisfied for COD to be available</>
                  )}
                </div>
                {activeConditions > 0 && (
                  <Badge variant="outline">
                    {activeConditions} condition{activeConditions !== 1 ? 's' : ''} active
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Conditions */}
        {enabled && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LayoutListIcon className="size-5" />
                Availability Conditions
              </CardTitle>
              <CardDescription>
                Set rules for when COD should be available to customers
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Product IDs */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <PackageIcon className="size-4 text-muted-foreground" />
                    <Label className="text-sm font-medium">Specific Products</Label>
                  </div>
                  <Switch
                    checked={productIdsEnabled}
                    onCheckedChange={setProductIdsEnabled}
                  />
                </div>
                {productIdsEnabled && (
                  <div className="ml-6 space-y-3">
                    <Input
                      type="text"
                      placeholder="Search products..."
                      value={productSearchTerm}
                      onChange={(e) => setProductSearchTerm(e.target.value)}
                      className="w-full"
                    />
                    {filteredProducts.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">
                            {filteredProducts.length} product(s) found
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const visibleIds = filteredProducts.map((p) => p._id);
                              setSelectedProductIds([...new Set([...selectedProductIds, ...visibleIds])]);
                            }}
                          >
                            Select All Visible
                          </Button>
                        </div>
                        <div className="max-h-48 overflow-y-auto space-y-1 border rounded-md p-2">
                          {filteredProducts.map((product) => (
                            <div key={product._id} className="flex items-center gap-2 p-2 hover:bg-muted rounded">
                              <Checkbox
                                checked={selectedProductIds.includes(product._id)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setSelectedProductIds([...selectedProductIds, product._id]);
                                  } else {
                                    setSelectedProductIds(selectedProductIds.filter((id) => id !== product._id));
                                  }
                                }}
                              />
                              <span className="text-sm flex-1">{product.title}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {selectedProductIds.length > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-2">Selected ({selectedProductIds.length}):</p>
                        <div className="flex flex-wrap gap-2">
                          {selectedProductIds.map((id) => {
                            const product = products.find((p) => p._id === id);
                            return (
                              <Badge key={id} variant="secondary" className="gap-1">
                                {product?.title || id}
                                <button
                                  onClick={() => setSelectedProductIds(selectedProductIds.filter((pid) => pid !== id))}
                                  className="ml-1 hover:text-destructive"
                                >
                                  ×
                                </button>
                              </Badge>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <Separator />

              {/* Collection IDs */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TagIcon className="size-4 text-muted-foreground" />
                    <Label className="text-sm font-medium">Specific Collections</Label>
                  </div>
                  <Switch
                    checked={collectionIdsEnabled}
                    onCheckedChange={setCollectionIdsEnabled}
                  />
                </div>
                {collectionIdsEnabled && (
                  <div className="ml-6 space-y-3">
                    <Input
                      type="text"
                      placeholder="Search collections..."
                      value={collectionSearchTerm}
                      onChange={(e) => setCollectionSearchTerm(e.target.value)}
                      className="w-full"
                    />
                    {filteredCollections.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">
                            {filteredCollections.length} collection(s) found
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const visibleIds = filteredCollections.map((c) => c._id);
                              setSelectedCollectionIds([...new Set([...selectedCollectionIds, ...visibleIds])]);
                            }}
                          >
                            Select All Visible
                          </Button>
                        </div>
                        <div className="max-h-48 overflow-y-auto space-y-1 border rounded-md p-2">
                          {filteredCollections.map((collection) => (
                            <div key={collection._id} className="flex items-center gap-2 p-2 hover:bg-muted rounded">
                              <Checkbox
                                checked={selectedCollectionIds.includes(collection._id)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setSelectedCollectionIds([...selectedCollectionIds, collection._id]);
                                  } else {
                                    setSelectedCollectionIds(selectedCollectionIds.filter((id) => id !== collection._id));
                                  }
                                }}
                              />
                              <span className="text-sm flex-1">{collection.name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {selectedCollectionIds.length > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-2">Selected ({selectedCollectionIds.length}):</p>
                        <div className="flex flex-wrap gap-2">
                          {selectedCollectionIds.map((id) => {
                            const collection = collections.find((c) => c._id === id);
                            return (
                              <Badge key={id} variant="secondary" className="gap-1">
                                {collection?.name || id}
                                <button
                                  onClick={() => setSelectedCollectionIds(selectedCollectionIds.filter((cid) => cid !== id))}
                                  className="ml-1 hover:text-destructive"
                                >
                                  ×
                                </button>
                              </Badge>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <Separator />

              {/* Variant IDs */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <LayoutListIcon className="size-4 text-muted-foreground" />
                    <Label className="text-sm font-medium">Specific Variants (SKUs)</Label>
                  </div>
                  <Switch
                    checked={variantIdsEnabled}
                    onCheckedChange={setVariantIdsEnabled}
                  />
                </div>
                {variantIdsEnabled && (
                  <div className="ml-6 space-y-3">
                    <Input
                      type="text"
                      placeholder="Search by SKU or title..."
                      value={variantSearchTerm}
                      onChange={(e) => setVariantSearchTerm(e.target.value)}
                      className="w-full"
                    />
                    {filteredVariants.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">
                            {filteredVariants.length} variant(s) found
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const visibleIds = filteredVariants.map((v) => v._id);
                              setSelectedVariantIds([...new Set([...selectedVariantIds, ...visibleIds])]);
                            }}
                          >
                            Select All Visible
                          </Button>
                        </div>
                        <div className="max-h-48 overflow-y-auto space-y-1 border rounded-md p-2">
                          {filteredVariants.map((variant) => (
                            <div key={variant._id} className="flex items-center gap-2 p-2 hover:bg-muted rounded">
                              <Checkbox
                                checked={selectedVariantIds.includes(variant._id)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setSelectedVariantIds([...selectedVariantIds, variant._id]);
                                  } else {
                                    setSelectedVariantIds(selectedVariantIds.filter((id) => id !== variant._id));
                                  }
                                }}
                              />
                              <span className="text-sm flex-1">{variant.sku} - {variant.title}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {selectedVariantIds.length > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-2">Selected ({selectedVariantIds.length}):</p>
                        <div className="flex flex-wrap gap-2">
                          {selectedVariantIds.map((id) => {
                            const variant = variants.find((v) => v._id === id);
                            return (
                              <Badge key={id} variant="secondary" className="gap-1">
                                {variant?.sku || id}
                                <button
                                  onClick={() => setSelectedVariantIds(selectedVariantIds.filter((vid) => vid !== id))}
                                  className="ml-1 hover:text-destructive"
                                >
                                  ×
                                </button>
                              </Badge>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <Separator />

              {/* Min Order Amount */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUpIcon className="size-4 text-muted-foreground" />
                    <Label className="text-sm font-medium">Minimum Order Amount</Label>
                  </div>
                  <Switch
                    checked={minOrderAmountEnabled}
                    onCheckedChange={setMinOrderAmountEnabled}
                  />
                </div>
                {minOrderAmountEnabled && (
                  <div className="ml-6">
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      value={minOrderAmount}
                      onChange={(e) => setMinOrderAmount(Number(e.target.value))}
                      placeholder="Enter minimum amount..."
                      className="w-48"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      COD available only if order total ≥ ₹{minOrderAmount}
                    </p>
                  </div>
                )}
              </div>

              <Separator />

              {/* Max Order Amount */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingDownIcon className="size-4 text-muted-foreground" />
                    <Label className="text-sm font-medium">Maximum Order Amount</Label>
                  </div>
                  <Switch
                    checked={maxOrderAmountEnabled}
                    onCheckedChange={setMaxOrderAmountEnabled}
                  />
                </div>
                {maxOrderAmountEnabled && (
                  <div className="ml-6">
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      value={maxOrderAmount}
                      onChange={(e) => setMaxOrderAmount(Number(e.target.value))}
                      placeholder="Enter maximum amount..."
                      className="w-48"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      COD available only if order total ≤ ₹{maxOrderAmount}
                    </p>
                  </div>
                )}
              </div>

              <Separator />

              {/* Min Product Count */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <HashIcon className="size-4 text-muted-foreground" />
                    <Label className="text-sm font-medium">Minimum Product Count</Label>
                  </div>
                  <Switch
                    checked={minProductCountEnabled}
                    onCheckedChange={setMinProductCountEnabled}
                  />
                </div>
                {minProductCountEnabled && (
                  <div className="ml-6">
                    <Input
                      type="number"
                      min="1"
                      step="1"
                      value={minProductCount}
                      onChange={(e) => setMinProductCount(Number(e.target.value))}
                      placeholder="Enter minimum count..."
                      className="w-48"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      COD available only if cart has ≥ {minProductCount} products
                    </p>
                  </div>
                )}
              </div>

              <Separator />

              {/* Max Product Count */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <HashIcon className="size-4 text-muted-foreground" />
                    <Label className="text-sm font-medium">Maximum Product Count</Label>
                  </div>
                  <Switch
                    checked={maxProductCountEnabled}
                    onCheckedChange={setMaxProductCountEnabled}
                  />
                </div>
                {maxProductCountEnabled && (
                  <div className="ml-6">
                    <Input
                      type="number"
                      min="1"
                      step="1"
                      value={maxProductCount}
                      onChange={(e) => setMaxProductCount(Number(e.target.value))}
                      placeholder="Enter maximum count..."
                      className="w-48"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      COD available only if cart has ≤ {maxProductCount} products
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* COD Fee Configuration */}
        {enabled && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSignIcon className="size-5" />
                COD Fee Configuration
              </CardTitle>
              <CardDescription>
                Set the fee charged for Cash on Delivery orders
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <Label className="text-sm font-medium w-24">Fee Type:</Label>
                <Select value={codFeeType} onValueChange={(v) => setCodFeeType(v as "fixed" | "percentage")}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">Fixed Amount (₹)</SelectItem>
                    <SelectItem value="percentage">Percentage (%)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-4">
                <Label className="text-sm font-medium w-24">Fee Value:</Label>
                <Input
                  type="number"
                  min="0"
                  step={codFeeType === "percentage" ? "0.1" : "1"}
                  value={codFeeValue}
                  onChange={(e) => setCodFeeValue(Number(e.target.value))}
                  className="w-48"
                />
                <span className="text-sm text-muted-foreground">
                  {codFeeType === "fixed" ? "₹" : "%"}
                </span>
              </div>
              <div className="bg-muted/50 p-3 rounded-lg text-sm">
                <strong>Preview:</strong>{" "}
                {codFeeType === "fixed" 
                  ? `₹${codFeeValue} fee on all COD orders` 
                  : `${codFeeValue}% fee on order total`}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Partial COD Configuration */}
        {enabled && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BanknoteIcon className="size-5" />
                Partial COD (Split Payment)
              </CardTitle>
              <CardDescription>
                Require customers to pay a portion upfront via PhonePe, with the balance on delivery
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <div className="space-y-1">
                  <Label className="text-base font-semibold">Enable Partial COD</Label>
                  <p className="text-sm text-muted-foreground">
                    Split payment between prepaid and COD
                  </p>
                </div>
                <Switch
                  checked={partialCodEnabled}
                  onCheckedChange={setPartialCodEnabled}
                />
              </div>
              
              {partialCodEnabled && (
                <>
                  <Separator />
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <Label className="text-sm font-medium w-32">Prepaid Type:</Label>
                      <Select value={prepaidType} onValueChange={(v) => setPrepaidType(v as "fixed" | "percentage")}>
                        <SelectTrigger className="w-48">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="fixed">Fixed Amount (₹)</SelectItem>
                          <SelectItem value="percentage">Percentage (%)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-4">
                      <Label className="text-sm font-medium w-32">Prepaid Value:</Label>
                      <Input
                        type="number"
                        min="0"
                        step={prepaidType === "percentage" ? "0.1" : "1"}
                        value={prepaidValue}
                        onChange={(e) => setPrepaidValue(Number(e.target.value))}
                        className="w-48"
                      />
                      <span className="text-sm text-muted-foreground">
                        {prepaidType === "fixed" ? "₹" : "%"}
                      </span>
                    </div>
                    <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-lg space-y-2">
                      <strong className="text-sm">Example (₹1000 order):</strong>
                      <div className="text-sm space-y-1">
                        <p>• Prepaid via PhonePe: ₹{prepaidType === "fixed" ? prepaidValue : (1000 * prepaidValue / 100).toFixed(2)}</p>
                        <p>• COD Fee: ₹{codFeeType === "fixed" ? codFeeValue : (1000 * codFeeValue / 100).toFixed(2)}</p>
                        <p>• Balance on Delivery: ₹{(
                          1000 
                          - (prepaidType === "fixed" ? prepaidValue : 1000 * prepaidValue / 100)
                          + (codFeeType === "fixed" ? codFeeValue : 1000 * codFeeValue / 100)
                        ).toFixed(2)}</p>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Save Button */}
        <div className="flex items-center justify-end gap-4">
          <Button variant="outline" onClick={handleInitialize}>
            Reset to Defaults
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </div>
    </div>
  );
}
