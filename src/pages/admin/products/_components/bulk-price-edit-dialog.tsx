import { useState, useMemo } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group.tsx";
import { ScrollArea } from "@/components/ui/scroll-area.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { toast } from "sonner";
import { ArrowRightIcon, CheckIcon } from "lucide-react";

type Variant = {
  _id: Id<"variants">;
  sku: string;
  title: string;
  price: number;
};

type Product = {
  _id: Id<"products">;
  title: string;
  variants: Variant[];
};

type ChangeType = "percentage" | "fixed" | "set";

interface BulkPriceEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: Product[];
}

export function BulkPriceEditDialog({
  open,
  onOpenChange,
  products,
}: BulkPriceEditDialogProps) {
  const [changeType, setChangeType] = useState<ChangeType>("percentage");
  const [changeValue, setChangeValue] = useState("");
  const [selectedVariants, setSelectedVariants] = useState<Set<Id<"variants">>>(
    new Set()
  );
  const [hasCalculated, setHasCalculated] = useState(false);

  const bulkUpdatePrices = useMutation(api.products.bulkUpdateVariantPrices);

  // Build preview data
  const previewData = useMemo(() => {
    // Calculate new prices based on change type and value
    const calculateNewPrice = (currentPrice: number): number => {
      const value = parseFloat(changeValue);
      if (isNaN(value)) return currentPrice;

      switch (changeType) {
        case "percentage":
          return currentPrice + (currentPrice * value) / 100;
        case "fixed":
          return currentPrice + value;
        case "set":
          return value;
        default:
          return currentPrice;
      }
    };

    return products.map((product) => {
      const variants = product.variants.map((variant) => {
        const newPrice = calculateNewPrice(variant.price);
        const change = newPrice - variant.price;
        return {
          ...variant,
          newPrice: Math.round(newPrice * 100) / 100, // Round to 2 decimals
          change: Math.round(change * 100) / 100,
        };
      });
      return { ...product, variants };
    });
  }, [products, changeType, changeValue]);

  // Calculate summary
  const summary = useMemo(() => {
    const selectedCount = selectedVariants.size;
    let totalChange = 0;

    previewData.forEach((product) => {
      product.variants.forEach((variant) => {
        if (selectedVariants.has(variant._id)) {
          totalChange += variant.change;
        }
      });
    });

    return {
      selectedCount,
      totalChange: Math.round(totalChange * 100) / 100,
    };
  }, [previewData, selectedVariants]);

  const handleCalculate = () => {
    if (!changeValue || isNaN(parseFloat(changeValue))) {
      toast.error("Please enter a valid number");
      return;
    }
    setHasCalculated(true);
    // Auto-select all variants after calculation
    const allVariantIds = new Set<Id<"variants">>();
    products.forEach((product) => {
      product.variants.forEach((variant) => {
        allVariantIds.add(variant._id);
      });
    });
    setSelectedVariants(allVariantIds);
  };

  const handleSelectAll = () => {
    const allVariantIds = new Set<Id<"variants">>();
    products.forEach((product) => {
      product.variants.forEach((variant) => {
        allVariantIds.add(variant._id);
      });
    });
    setSelectedVariants(allVariantIds);
  };

  const handleDeselectAll = () => {
    setSelectedVariants(new Set());
  };

  const handleToggleVariant = (variantId: Id<"variants">) => {
    const newSelected = new Set(selectedVariants);
    if (newSelected.has(variantId)) {
      newSelected.delete(variantId);
    } else {
      newSelected.add(variantId);
    }
    setSelectedVariants(newSelected);
  };

  const handleToggleProduct = (product: Product) => {
    const allSelected = product.variants.every((v) =>
      selectedVariants.has(v._id)
    );
    const newSelected = new Set(selectedVariants);

    if (allSelected) {
      // Deselect all variants of this product
      product.variants.forEach((v) => newSelected.delete(v._id));
    } else {
      // Select all variants of this product
      product.variants.forEach((v) => newSelected.add(v._id));
    }
    setSelectedVariants(newSelected);
  };

  const handleApply = async () => {
    if (selectedVariants.size === 0) {
      toast.error("Please select at least one variant to update");
      return;
    }

    // Check for negative prices
    const hasNegativePrices = previewData.some((product) =>
      product.variants.some(
        (v) => selectedVariants.has(v._id) && v.newPrice < 0
      )
    );

    if (hasNegativePrices) {
      toast.error("Cannot set negative prices. Please adjust your values.");
      return;
    }

    try {
      const updates = previewData.flatMap((product) =>
        product.variants
          .filter((v) => selectedVariants.has(v._id))
          .map((v) => ({
            variantId: v._id,
            newPrice: v.newPrice,
          }))
      );

      const result = await bulkUpdatePrices({ updates });

      if (result.errorCount > 0) {
        toast.warning(
          `Updated ${result.successCount} variants, ${result.errorCount} errors`
        );
      } else {
        toast.success(`Successfully updated ${result.successCount} variants!`);
      }

      // Reset and close
      onOpenChange(false);
      setChangeValue("");
      setSelectedVariants(new Set());
      setHasCalculated(false);
    } catch (error) {
      toast.error(
        `Failed to update prices: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setChangeValue("");
    setSelectedVariants(new Set());
    setHasCalculated(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0">
        <div className="px-6 pt-6">
          <DialogHeader>
            <DialogTitle>Bulk Edit Prices</DialogTitle>
            <DialogDescription>
              {products.length} products with{" "}
              {products.reduce((sum, p) => sum + p.variants.length, 0)} total
              variants
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Price Change Settings */}
        <div className="space-y-4 border-b pb-4 px-6">
          <RadioGroup
            value={changeType}
            onValueChange={(value) => {
              setChangeType(value as ChangeType);
              setHasCalculated(false);
            }}
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="percentage" id="percentage" />
              <Label htmlFor="percentage" className="font-normal cursor-pointer">
                Percentage Increase/Decrease
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="fixed" id="fixed" />
              <Label htmlFor="fixed" className="font-normal cursor-pointer">
                Fixed Amount Increase/Decrease
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="set" id="set" />
              <Label htmlFor="set" className="font-normal cursor-pointer">
                Set to Specific Price
              </Label>
            </div>
          </RadioGroup>

          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Label>
                {changeType === "percentage" && "Percentage (use negative for decrease)"}
                {changeType === "fixed" && "Amount (use negative for decrease)"}
                {changeType === "set" && "New Price"}
              </Label>
              <div className="flex items-center gap-2 mt-1">
                {changeType === "fixed" && (
                  <span className="text-muted-foreground">₹</span>
                )}
                <Input
                  type="number"
                  step="0.01"
                  value={changeValue}
                  onChange={(e) => {
                    setChangeValue(e.target.value);
                    setHasCalculated(false);
                  }}
                  placeholder={
                    changeType === "percentage"
                      ? "e.g., 10 or -10"
                      : changeType === "fixed"
                        ? "e.g., 50 or -50"
                        : "e.g., 499"
                  }
                />
                {changeType === "percentage" && (
                  <span className="text-muted-foreground">%</span>
                )}
                {changeType === "set" && (
                  <span className="text-muted-foreground">₹</span>
                )}
              </div>
            </div>
            <Button onClick={handleCalculate} disabled={!changeValue}>
              Calculate Preview
            </Button>
          </div>
        </div>

        {/* Preview List */}
        {hasCalculated && (
          <>
            <div className="flex items-center justify-between px-6 py-2">
              <div className="text-sm text-muted-foreground">
                Select variants to update
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleSelectAll}
                  className="h-8"
                >
                  Select All
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleDeselectAll}
                  className="h-8"
                >
                  Deselect All
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-hidden px-6">
              <ScrollArea className="h-full border rounded-lg">
                <div className="p-4 space-y-4">
                {previewData.map((product) => {
                  const allSelected = product.variants.every((v) =>
                    selectedVariants.has(v._id)
                  );
                  const someSelected = product.variants.some((v) =>
                    selectedVariants.has(v._id)
                  );

                  return (
                    <Card key={product._id}>
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={allSelected}
                            onCheckedChange={() => handleToggleProduct(product)}
                            className={someSelected && !allSelected ? "data-[state=checked]:bg-muted" : ""}
                          />
                          <h4 className="font-semibold">{product.title}</h4>
                          <span className="text-xs text-muted-foreground">
                            ({product.variants.length} variants)
                          </span>
                        </div>

                        <div className="space-y-2 pl-6">
                          {product.variants.map((variant) => {
                            const isSelected = selectedVariants.has(variant._id);
                            const changeColor =
                              variant.change > 0
                                ? "text-green-600"
                                : variant.change < 0
                                  ? "text-red-600"
                                  : "text-muted-foreground";

                            return (
                              <div
                                key={variant._id}
                                className="flex items-center justify-between py-2 border-b last:border-0"
                              >
                                <div className="flex items-center gap-2 flex-1">
                                  <Checkbox
                                    checked={isSelected}
                                    onCheckedChange={() =>
                                      handleToggleVariant(variant._id)
                                    }
                                  />
                                  <div className="flex-1">
                                    <div className="text-sm font-medium">
                                      {variant.title}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      SKU: {variant.sku}
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 text-sm">
                                  <span className="font-medium">
                                    ₹{variant.price}
                                  </span>
                                  <ArrowRightIcon className="size-4 text-muted-foreground" />
                                  <span
                                    className={`font-semibold ${variant.newPrice < 0 ? "text-red-600" : ""}`}
                                  >
                                    ₹{variant.newPrice}
                                  </span>
                                  <span className={`text-xs ${changeColor} min-w-[60px] text-right`}>
                                    {variant.change > 0 ? "+" : ""}
                                    ₹{variant.change}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
                </div>
              </ScrollArea>
            </div>
          </>
        )}

        <DialogFooter className="border-t pt-4 px-6 pb-6">
          <div className="flex items-center justify-between w-full">
            <div className="text-sm">
              {hasCalculated && (
                <>
                  <span className="font-semibold">{summary.selectedCount}</span>{" "}
                  variants selected •{" "}
                  <span
                    className={`font-semibold ${summary.totalChange >= 0 ? "text-green-600" : "text-red-600"}`}
                  >
                    {summary.totalChange >= 0 ? "+" : ""}₹{summary.totalChange}
                  </span>{" "}
                  total change
                </>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={handleApply}
                disabled={!hasCalculated || selectedVariants.size === 0}
              >
                <CheckIcon className="size-4 mr-2" />
                Apply Changes
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
