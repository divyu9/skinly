import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { AdminLayout } from "@/components/admin-layout.tsx";
import { AdminPageWrapper } from "@/components/admin-page-wrapper.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { PlusIcon, EditIcon, TrashIcon, PackageIcon } from "lucide-react";
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
import type { Id } from "@/convex/_generated/dataModel.d.ts";

export default function CheckoutUpsellsPage() {
  const rules = useQuery(api.checkoutUpsells.listAllRules, {});
  const createRule = useMutation(api.checkoutUpsells.createRule);
  const updateRule = useMutation(api.checkoutUpsells.updateRule);
  const deleteRule = useMutation(api.checkoutUpsells.deleteRule);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<NonNullable<typeof rules>[0] | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Form state
  const [ruleName, setRuleName] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [priority, setPriority] = useState("50");
  const [matchLogic, setMatchLogic] = useState<"all" | "any">("all");

  const handleNewRule = () => {
    setEditingRule(null);
    setRuleName("");
    setIsActive(true);
    setPriority("50");
    setMatchLogic("all");
    setDialogOpen(true);
  };

  const handleEditRule = (rule: NonNullable<typeof rules>[0]) => {
    setEditingRule(rule);
    setRuleName(rule.ruleName);
    setIsActive(rule.isActive);
    setPriority(rule.priority.toString());
    setMatchLogic(rule.matchLogic);
    setDialogOpen(true);
  };

  const handleSaveRule = async () => {
    if (!ruleName.trim()) {
      toast.error("Please enter a rule name");
      return;
    }

    setIsLoading(true);
    try {
      if (editingRule) {
        await updateRule({
          ruleId: editingRule._id,
          ruleName,
          isActive,
          priority: parseInt(priority) || 50,
          matchLogic,
          upsellProducts: editingRule.upsellProducts,
          // Keep existing conditions
          cartValueMin: editingRule.cartValueMin,
          cartValueMax: editingRule.cartValueMax,
          cartValueOperator: editingRule.cartValueOperator,
          cartItemCountMin: editingRule.cartItemCountMin,
          cartItemCountMax: editingRule.cartItemCountMax,
          cartItemCountOperator: editingRule.cartItemCountOperator,
          containsProductIds: editingRule.containsProductIds,
          containsCollectionIds: editingRule.containsCollectionIds,
          containsVariantIds: editingRule.containsVariantIds,
          containsPhoneBrands: editingRule.containsPhoneBrands,
          containsGadgetCategories: editingRule.containsGadgetCategories,
        });
        toast.success("Rule updated successfully");
      } else {
        await createRule({
          ruleName,
          isActive,
          priority: parseInt(priority) || 50,
          matchLogic,
          upsellProducts: [],
        });
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
                    {/* Conditions Summary */}
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
                      </div>
                    </div>

                    {/* Upsell Products */}
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

        {/* Edit/Create Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingRule ? "Edit Rule" : "Create New Rule"}</DialogTitle>
              <DialogDescription>
                Configure basic rule settings. Add conditions and products after creating.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Rule Name</Label>
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
                    <SelectItem value="all">All conditions must match</SelectItem>
                    <SelectItem value="any">Any condition must match</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                  className="flex-1"
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button onClick={handleSaveRule} className="flex-1" disabled={isLoading}>
                  {isLoading ? "Saving..." : editingRule ? "Update" : "Create"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </AdminPageWrapper>
    </AdminLayout>
  );
}
