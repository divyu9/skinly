import { useQuery, useMutation } from "@/lib/firebase-hooks";
import { Authenticated, Unauthenticated, AuthLoading } from "@/lib/firebase-hooks";
import { api } from "@/lib/firebase-api";
import { AdminLayout } from "@/components/admin-layout.tsx";
import { AdminPageWrapper } from "@/components/admin-page-wrapper.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { PlusIcon, EditIcon, TrashIcon, PackageIcon, XIcon, SearchIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs.tsx";
import type { Id } from "@/lib/firebase-api";

function CheckoutUpsellsPageInner() {
  const rules = useQuery(api.checkoutUpsells.listAllRules, {});
  const createRule = useMutation(api.checkoutUpsells.createRule);
  const updateRule = useMutation(api.checkoutUpsells.updateRule);
  const deleteRule = useMutation(api.checkoutUpsells.deleteRule);
  const products = useQuery(api.products.getAllProductsPaginated, { paginationOpts: { numItems: 1000, cursor: null } });
  const brands = useQuery(api.supportedModels.getBrands, {});

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<NonNullable<typeof rules>[0] | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Basic settings
  const [ruleName, setRuleName] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [priority, setPriority] = useState("50");
  const [matchLogic, setMatchLogic] = useState<"all" | "any">("all");

  // Conditions
  const [cartValueOperator, setCartValueOperator] = useState<">=" | "<=" | "between" | undefined>(undefined);
  const [cartValueMin, setCartValueMin] = useState("");
  const [cartValueMax, setCartValueMax] = useState("");
  const [cartItemCountOperator, setCartItemCountOperator] = useState<">=" | "<=" | "between" | undefined>(undefined);
  const [cartItemCountMin, setCartItemCountMin] = useState("");
  const [cartItemCountMax, setCartItemCountMax] = useState("");
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<Array<"phone" | "laptop" | "tablet" | "camera" | "lens" | "drone" | "charger" | "console" | "mac-mini" | "cover" | "accessory">>([]);

  // Upsell products
  const [upsellProducts, setUpsellProducts] = useState<Array<{
    productId: Id<"products">;
    variantId: Id<"variants">;
    discountedPrice?: number;
  }>>([]);
  const [productSearch, setProductSearch] = useState("");

  const categories = ["phone", "laptop", "tablet", "camera", "lens", "drone", "charger", "console", "mac-mini", "cover", "accessory"];

  const handleNewRule = () => {
    setEditingRule(null);
    setRuleName("");
    setIsActive(true);
    setPriority("50");
    setMatchLogic("all");
    setCartValueOperator(undefined);
    setCartValueMin("");
    setCartValueMax("");
    setCartItemCountOperator(undefined);
    setCartItemCountMin("");
    setCartItemCountMax("");
    setSelectedBrands([]);
    setSelectedCategories([]);
    setUpsellProducts([]);
    setDialogOpen(true);
  };

  const handleEditRule = (rule: NonNullable<typeof rules>[0]) => {
    setEditingRule(rule);
    setRuleName(rule.ruleName);
    setIsActive(rule.isActive);
    setPriority(rule.priority.toString());
    setMatchLogic(rule.matchLogic);
    setCartValueOperator(rule.cartValueOperator || undefined);
    setCartValueMin(rule.cartValueMin?.toString() || "");
    setCartValueMax(rule.cartValueMax?.toString() || "");
    setCartItemCountOperator(rule.cartItemCountOperator || undefined);
    setCartItemCountMin(rule.cartItemCountMin?.toString() || "");
    setCartItemCountMax(rule.cartItemCountMax?.toString() || "");
    setSelectedBrands(rule.containsPhoneBrands || []);
    setSelectedCategories(rule.containsGadgetCategories || []);
    setUpsellProducts(rule.upsellProducts);
    setDialogOpen(true);
  };

  const handleSaveRule = async () => {
    if (!ruleName.trim()) {
      toast.error("Please enter a rule name");
      return;
    }

    setIsLoading(true);
    try {
      const ruleData = {
        ruleName,
        isActive,
        priority: parseInt(priority) || 50,
        matchLogic,
        cartValueMin: cartValueMin ? parseFloat(cartValueMin) : undefined,
        cartValueMax: cartValueMax ? parseFloat(cartValueMax) : undefined,
        cartValueOperator: cartValueOperator || undefined,
        cartItemCountMin: cartItemCountMin ? parseInt(cartItemCountMin) : undefined,
        cartItemCountMax: cartItemCountMax ? parseInt(cartItemCountMax) : undefined,
        cartItemCountOperator: cartItemCountOperator || undefined,
        containsPhoneBrands: selectedBrands.length > 0 ? selectedBrands : undefined,
        containsGadgetCategories: selectedCategories.length > 0 ? selectedCategories : undefined,
        upsellProducts,
      };

      if (editingRule) {
        await updateRule({
          ruleId: editingRule._id,
          ...ruleData,
        });
        toast.success("Rule updated successfully");
      } else {
        await createRule(ruleData);
        toast.success("Rule created successfully");
      }
      setDialogOpen(false);
    } catch (error) {
      toast.error("Failed to save rule");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteRule = async (ruleId: Id<"checkoutUpsells">) => {
    if (!confirm("Are you sure you want to delete this rule?")) {
      return;
    }

    try {
      await deleteRule({ ruleId });
      toast.success("Rule deleted successfully");
    } catch (error) {
      toast.error("Failed to delete rule");
      console.error(error);
    }
  };

  const addUpsellProduct = (productId: Id<"products">, variantId: Id<"variants">) => {
    if (!upsellProducts.find(p => p.variantId === variantId)) {
      setUpsellProducts([...upsellProducts, { productId, variantId }]);
      setProductSearch("");
    }
  };

  const removeUpsellProduct = (variantId: Id<"variants">) => {
    setUpsellProducts(upsellProducts.filter(p => p.variantId !== variantId));
  };

  const updateUpsellDiscount = (variantId: Id<"variants">, discountedPrice: number | undefined) => {
    setUpsellProducts(upsellProducts.map(p =>
      p.variantId === variantId ? { ...p, discountedPrice } : p
    ));
  };

  const filteredProducts = products?.page.filter(p =>
    p.title.toLowerCase().includes(productSearch.toLowerCase())
  ).slice(0, 10) || [];

  return (
    <AdminLayout>
      <AdminPageWrapper>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Checkout Upsells</h1>
            <p className="text-muted-foreground mt-1">
              Configure product upsells displayed on the checkout page
            </p>
          </div>
          <Button onClick={handleNewRule}>
            <PlusIcon className="size-4 mr-2" />
            New Rule
          </Button>
        </div>

        {rules === undefined ? (
          <Card>
            <CardContent className="p-12 text-center text-muted-foreground">
              Loading rules...
            </CardContent>
          </Card>
        ) : rules.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <PackageIcon className="size-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="font-semibold mb-2">No upsell rules yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first rule to start showing product upsells on checkout
              </p>
              <Button onClick={handleNewRule}>
                <PlusIcon className="size-4 mr-2" />
                Create First Rule
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {rules.map((rule) => (
              <Card key={rule._id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <CardTitle>{rule.ruleName}</CardTitle>
                        <Badge variant={rule.isActive ? "default" : "secondary"}>
                          {rule.isActive ? "Active" : "Inactive"}
                        </Badge>
                        <Badge variant="outline">Priority: {rule.priority}</Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Match Logic: <span className="font-medium">{rule.matchLogic === "all" ? "All conditions" : "Any condition"}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEditRule(rule)}
                      >
                        <EditIcon className="size-4 mr-2" />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDeleteRule(rule._id)}
                      >
                        <TrashIcon className="size-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <h4 className="text-sm font-semibold mb-2">Conditions:</h4>
                      <div className="flex flex-wrap gap-2">
                        {rule.cartValueOperator && (
                          <Badge variant="secondary" className="text-xs">
                            Cart Value: {rule.cartValueOperator} ₹{rule.cartValueMin || 0}
                            {rule.cartValueOperator === "between" && ` - ₹${rule.cartValueMax || 0}`}
                          </Badge>
                        )}
                        {rule.cartItemCountOperator && (
                          <Badge variant="secondary" className="text-xs">
                            Item Count: {rule.cartItemCountOperator} {rule.cartItemCountMin || 0}
                            {rule.cartItemCountOperator === "between" && ` - ${rule.cartItemCountMax || 0}`}
                          </Badge>
                        )}
                        {rule.containsPhoneBrands && rule.containsPhoneBrands.length > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            Brands: {rule.containsPhoneBrands.join(", ")}
                          </Badge>
                        )}
                        {rule.containsGadgetCategories && rule.containsGadgetCategories.length > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            Categories: {rule.containsGadgetCategories.join(", ")}
                          </Badge>
                        )}
                        {!rule.cartValueOperator && !rule.cartItemCountOperator && 
                         (!rule.containsPhoneBrands || rule.containsPhoneBrands.length === 0) &&
                         (!rule.containsGadgetCategories || rule.containsGadgetCategories.length === 0) && (
                          <Badge variant="secondary" className="text-xs">No conditions (always match)</Badge>
                        )}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold mb-2">Upsell Products ({rule.upsellProducts.length}):</h4>
                      {rule.upsellProducts.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No products configured</p>
                      ) : (
                        <div className="space-y-2">
                          {rule.upsellProductsWithDetails?.slice(0, 3).map((product, idx) => (
                            <div key={idx} className="flex items-center justify-between p-2 bg-muted/50 rounded text-sm">
                              <div>
                                <p className="font-medium">{product.productTitle}</p>
                                <p className="text-xs text-muted-foreground">{product.variantTitle}</p>
                              </div>
                              <div className="text-right">
                                {product.discountedPrice ? (
                                  <>
                                    <p className="text-xs text-muted-foreground line-through">
                                      ₹{product.originalPrice.toFixed(0)}
                                    </p>
                                    <p className="font-semibold text-green-600">
                                      ₹{product.discountedPrice.toFixed(0)}
                                    </p>
                                  </>
                                ) : (
                                  <p className="font-semibold">₹{product.originalPrice.toFixed(0)}</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Comprehensive Edit/Create Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingRule ? "Edit Rule" : "Create New Rule"}</DialogTitle>
              <DialogDescription>
                Configure conditions and products for checkout upsells
              </DialogDescription>
            </DialogHeader>

            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="basic">Basic Settings</TabsTrigger>
                <TabsTrigger value="conditions">Conditions</TabsTrigger>
                <TabsTrigger value="products">Upsell Products</TabsTrigger>
              </TabsList>

              {/* Basic Settings Tab */}
              <TabsContent value="basic" className="space-y-4 mt-4">
                <div>
                  <Label>Rule Name *</Label>
                  <Input
                    value={ruleName}
                    onChange={(e) => setRuleName(e.target.value)}
                    placeholder="e.g., Camera Protector for iPhone Users"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label>Active</Label>
                  <Switch checked={isActive} onCheckedChange={setIsActive} />
                </div>

                <div>
                  <Label>Priority (1-100)</Label>
                  <Input
                    type="number"
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    min="1"
                    max="100"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Higher priority rules are checked first
                  </p>
                </div>

                <div>
                  <Label>Match Logic</Label>
                  <Select value={matchLogic} onValueChange={(value: "all" | "any") => setMatchLogic(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All conditions must match (AND)</SelectItem>
                      <SelectItem value="any">Any condition must match (OR)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </TabsContent>

              {/* Conditions Tab */}
              <TabsContent value="conditions" className="space-y-6 mt-4">
                {/* Cart Value */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Cart Value</Label>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label className="text-xs">Operator</Label>
                      <Select value={cartValueOperator || "none"} onValueChange={(v) => setCartValueOperator(v === "none" ? undefined : v as ">=" | "<=" | "between")}>
                        <SelectTrigger>
                          <SelectValue placeholder="None" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          <SelectItem value=">=">Greater than or equal</SelectItem>
                          <SelectItem value="<=">Less than or equal</SelectItem>
                          <SelectItem value="between">Between</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Min (₹)</Label>
                      <Input
                        type="number"
                        value={cartValueMin}
                        onChange={(e) => setCartValueMin(e.target.value)}
                        placeholder="0"
                        disabled={!cartValueOperator}
                      />
                    </div>
                    {cartValueOperator === "between" && (
                      <div>
                        <Label className="text-xs">Max (₹)</Label>
                        <Input
                          type="number"
                          value={cartValueMax}
                          onChange={(e) => setCartValueMax(e.target.value)}
                          placeholder="1000"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Cart Item Count */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Cart Item Count</Label>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label className="text-xs">Operator</Label>
                      <Select value={cartItemCountOperator || "none"} onValueChange={(v) => setCartItemCountOperator(v === "none" ? undefined : v as ">=" | "<=" | "between")}>
                        <SelectTrigger>
                          <SelectValue placeholder="None" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          <SelectItem value=">=">Greater than or equal</SelectItem>
                          <SelectItem value="<=">Less than or equal</SelectItem>
                          <SelectItem value="between">Between</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Min</Label>
                      <Input
                        type="number"
                        value={cartItemCountMin}
                        onChange={(e) => setCartItemCountMin(e.target.value)}
                        placeholder="0"
                        disabled={!cartItemCountOperator}
                      />
                    </div>
                    {cartItemCountOperator === "between" && (
                      <div>
                        <Label className="text-xs">Max</Label>
                        <Input
                          type="number"
                          value={cartItemCountMax}
                          onChange={(e) => setCartItemCountMax(e.target.value)}
                          placeholder="10"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Phone Brands */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Contains Phone Brands</Label>
                  <div className="flex flex-wrap gap-2">
                    {brands?.map((brand) => (
                      <Button
                        key={brand}
                        type="button"
                        size="sm"
                        variant={selectedBrands.includes(brand) ? "default" : "outline"}
                        onClick={() => {
                          if (selectedBrands.includes(brand)) {
                            setSelectedBrands(selectedBrands.filter(b => b !== brand));
                          } else {
                            setSelectedBrands([...selectedBrands, brand]);
                          }
                        }}
                      >
                        {brand}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Gadget Categories */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Contains Gadget Categories</Label>
                  <div className="flex flex-wrap gap-2">
                    {categories.map((category) => (
                      <Button
                        key={category}
                        type="button"
                        size="sm"
                        variant={selectedCategories.includes(category as never) ? "default" : "outline"}
                        onClick={() => {
                          const cat = category as "phone" | "laptop" | "tablet" | "camera" | "lens" | "drone" | "charger" | "console" | "mac-mini" | "cover" | "accessory";
                          if (selectedCategories.includes(cat)) {
                            setSelectedCategories(selectedCategories.filter(c => c !== cat));
                          } else {
                            setSelectedCategories([...selectedCategories, cat]);
                          }
                        }}
                      >
                        {category}
                      </Button>
                    ))}
                  </div>
                </div>
              </TabsContent>

              {/* Upsell Products Tab */}
              <TabsContent value="products" className="space-y-4 mt-4">
                <div>
                  <Label className="text-base font-semibold">Search and Add Products</Label>
                  <div className="relative mt-2">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      placeholder="Search products..."
                      className="pl-10"
                    />
                  </div>
                  {productSearch && filteredProducts.length > 0 && (
                    <div className="mt-2 border rounded-md max-h-60 overflow-y-auto">
                      {filteredProducts.map((product) => (
                        <div key={product._id} className="p-3 hover:bg-muted/50 border-b last:border-0">
                          <p className="font-medium text-sm">{product.title}</p>
                          <div className="mt-2 space-y-2">
                            {/* Select All Variants Button */}
                            {product.variants && product.variants.length > 1 && (
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                className="mr-2 mb-1"
                                onClick={() => {
                                  product.variants?.forEach((variant) => {
                                    if (!upsellProducts.some(p => p.variantId === variant._id)) {
                                      addUpsellProduct(product._id, variant._id);
                                    }
                                  });
                                }}
                              >
                                + Add All Variants ({product.variants.length})
                              </Button>
                            )}
                            {/* Individual Variant Buttons */}
                            <div className="flex flex-wrap gap-1">
                              {product.variants?.map((variant) => (
                                <Button
                                  key={variant._id}
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => addUpsellProduct(product._id, variant._id)}
                                  disabled={upsellProducts.some(p => p.variantId === variant._id)}
                                >
                                  {variant.title} - ₹{variant.price}
                                </Button>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <Label className="text-base font-semibold">Selected Upsell Products ({upsellProducts.length})</Label>
                  {upsellProducts.length === 0 ? (
                    <p className="text-sm text-muted-foreground mt-2">No products selected</p>
                  ) : (
                    <div className="mt-2 space-y-3">
                      {upsellProducts.map((upsell) => {
                        const product = products?.page.find(p => p._id === upsell.productId);
                        const variant = product?.variants?.find(v => v._id === upsell.variantId);
                        return (
                          <div key={upsell.variantId} className="flex items-center gap-3 p-3 border rounded-md">
                            <div className="flex-1">
                              <p className="font-medium text-sm">{product?.title}</p>
                              <p className="text-xs text-muted-foreground">{variant?.title} - ₹{variant?.price}</p>
                            </div>
                            <div className="w-32">
                              <Input
                                type="number"
                                placeholder="Discount ₹"
                                value={upsell.discountedPrice || ""}
                                onChange={(e) => updateUpsellDiscount(
                                  upsell.variantId,
                                  e.target.value ? parseFloat(e.target.value) : undefined
                                )}
                                className="text-sm"
                              />
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => removeUpsellProduct(upsell.variantId)}
                            >
                              <XIcon className="size-4" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground mt-2">
                    Maximum 6 products will be shown to customers. Add discount price to show special offers.
                  </p>
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex gap-2 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => setDialogOpen(false)}
                className="flex-1"
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button onClick={handleSaveRule} className="flex-1" disabled={isLoading}>
                {isLoading ? "Saving..." : editingRule ? "Update Rule" : "Create Rule"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </AdminPageWrapper>
    </AdminLayout>
  );
}

export default function CheckoutUpsellsPage() {
  return (
    <>
      <Unauthenticated>
        <div className="flex items-center justify-center min-h-screen">
          <Card className="w-full max-w-md">
            <CardContent className="p-12 text-center">
              <h2 className="text-2xl font-bold mb-4">Authentication Required</h2>
              <p className="text-muted-foreground mb-6">
                You need to sign in to access the admin panel
              </p>
              <SignInButton />
            </CardContent>
          </Card>
        </div>
      </Unauthenticated>
      <AuthLoading>
        <div className="flex items-center justify-center min-h-screen">
          <Skeleton className="h-96 w-full max-w-4xl" />
        </div>
      </AuthLoading>
      <Authenticated>
        <CheckoutUpsellsPageInner />
      </Authenticated>
    </>
  );
}
