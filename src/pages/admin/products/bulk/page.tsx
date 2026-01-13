import { useState, useMemo } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { AdminLayout } from "@/components/admin-layout.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import {
  ChevronLeftIcon,
  PlusIcon,
  TrashIcon,
  SparklesIcon,
  Loader2Icon,
  CheckCircleIcon,
  XCircleIcon,
  PackageIcon,
  CopyIcon,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { SignInButton } from "@/components/ui/signin.tsx";
import { ScrollArea } from "@/components/ui/scroll-area.tsx";
import type { Id } from "@/convex/_generated/dataModel.d.ts";

interface ProductRow {
  id: string;
  title: string;
  gadgetTypeId: Id<"gadgetTypes"> | "";
  finishTypeId: Id<"finishTypes"> | "";
  sku: string;
  price: string;
  compareAtPrice: string;
  inventoryQuantity: string;
  status: "active" | "draft";
}

function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

function BulkProductCreatorInner() {
  const gadgetTypes = useQuery(api.gadgetTypes.listActive, {});
  const finishTypes = useQuery(api.finishTypes.listActive, {});
  const createBulkProducts = useAction(api.bulkProductCreator.createBulkProducts);

  // Default values for new rows
  const [defaultGadgetTypeId, setDefaultGadgetTypeId] = useState<Id<"gadgetTypes"> | "">("");
  const [defaultFinishTypeId, setDefaultFinishTypeId] = useState<Id<"finishTypes"> | "">("");
  const [defaultPrice, setDefaultPrice] = useState("299");
  const [defaultCompareAtPrice, setDefaultCompareAtPrice] = useState("399");
  const [defaultInventory, setDefaultInventory] = useState("100");
  const [defaultStatus, setDefaultStatus] = useState<"active" | "draft">("active");
  const [generateSEO, setGenerateSEO] = useState(true);

  // Product rows
  const [rows, setRows] = useState<ProductRow[]>([
    {
      id: generateId(),
      title: "",
      gadgetTypeId: "",
      finishTypeId: "",
      sku: "",
      price: "299",
      compareAtPrice: "399",
      inventoryQuantity: "100",
      status: "active",
    },
  ]);

  const [isCreating, setIsCreating] = useState(false);
  const [results, setResults] = useState<{
    success: { title: string; productId: string }[];
    failed: { title: string; error: string }[];
  } | null>(null);

  // Get gadget category from selected gadget type
  const getGadgetCategory = (gadgetTypeId: Id<"gadgetTypes"> | "") => {
    if (!gadgetTypeId || !gadgetTypes) return "phone";
    const gadgetType = gadgetTypes.find(g => g._id === gadgetTypeId);
    return gadgetType?.category || "phone";
  };

  // Add a new row
  const addRow = () => {
    setRows([
      ...rows,
      {
        id: generateId(),
        title: "",
        gadgetTypeId: defaultGadgetTypeId,
        finishTypeId: defaultFinishTypeId,
        sku: "",
        price: defaultPrice,
        compareAtPrice: defaultCompareAtPrice,
        inventoryQuantity: defaultInventory,
        status: defaultStatus,
      },
    ]);
  };

  // Add multiple rows
  const addMultipleRows = (count: number) => {
    const newRows: ProductRow[] = [];
    for (let i = 0; i < count; i++) {
      newRows.push({
        id: generateId(),
        title: "",
        gadgetTypeId: defaultGadgetTypeId,
        finishTypeId: defaultFinishTypeId,
        sku: "",
        price: defaultPrice,
        compareAtPrice: defaultCompareAtPrice,
        inventoryQuantity: defaultInventory,
        status: defaultStatus,
      });
    }
    setRows([...rows, ...newRows]);
  };

  // Remove a row
  const removeRow = (id: string) => {
    if (rows.length > 1) {
      setRows(rows.filter(r => r.id !== id));
    }
  };

  // Update a row
  const updateRow = (id: string, field: keyof ProductRow, value: string) => {
    setRows(rows.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  // Apply defaults to all rows
  const applyDefaultsToAll = () => {
    setRows(rows.map(r => ({
      ...r,
      gadgetTypeId: defaultGadgetTypeId || r.gadgetTypeId,
      finishTypeId: defaultFinishTypeId || r.finishTypeId,
      price: defaultPrice || r.price,
      compareAtPrice: defaultCompareAtPrice || r.compareAtPrice,
      inventoryQuantity: defaultInventory || r.inventoryQuantity,
      status: defaultStatus,
    })));
    toast.success("Defaults applied to all rows");
  };

  // Auto-generate SKUs
  const autoGenerateSKUs = () => {
    const selectedFinish = finishTypes?.find(f => f._id === defaultFinishTypeId);
    const prefix = selectedFinish?.displayName?.substring(0, 3).toUpperCase() || "SKU";

    setRows(rows.map((r, idx) => ({
      ...r,
      sku: r.sku || `${prefix}-${String(idx + 1).padStart(3, "0")}`,
    })));
    toast.success("SKUs auto-generated");
  };

  // Validate rows
  const validation = useMemo(() => {
    const errors: string[] = [];
    const validRows = rows.filter(r => r.title.trim());

    if (validRows.length === 0) {
      errors.push("Add at least one product with a title");
    }

    validRows.forEach((r, idx) => {
      if (!r.gadgetTypeId) errors.push(`Row ${idx + 1}: Select gadget type`);
      if (!r.finishTypeId) errors.push(`Row ${idx + 1}: Select finish type`);
      if (!r.sku.trim()) errors.push(`Row ${idx + 1}: Enter SKU`);
      if (!r.price || parseFloat(r.price) <= 0) errors.push(`Row ${idx + 1}: Enter valid price`);
    });

    // Check for duplicate SKUs
    const skus = validRows.map(r => r.sku.trim().toLowerCase());
    const duplicates = skus.filter((sku, idx) => skus.indexOf(sku) !== idx);
    if (duplicates.length > 0) {
      errors.push(`Duplicate SKUs found: ${[...new Set(duplicates)].join(", ")}`);
    }

    return {
      isValid: errors.length === 0 && validRows.length > 0,
      errors,
      validRowCount: validRows.length,
    };
  }, [rows]);

  // Handle bulk creation
  const handleCreate = async () => {
    if (!validation.isValid) {
      validation.errors.forEach(e => toast.error(e));
      return;
    }

    setIsCreating(true);
    setResults(null);

    try {
      const validRows = rows.filter(r => r.title.trim());
      const products = validRows.map(r => ({
        title: r.title.trim(),
        gadgetTypeId: r.gadgetTypeId as Id<"gadgetTypes">,
        finishTypeId: r.finishTypeId as Id<"finishTypes">,
        gadgetCategory: getGadgetCategory(r.gadgetTypeId as Id<"gadgetTypes">),
        sku: r.sku.trim(),
        price: parseFloat(r.price),
        compareAtPrice: r.compareAtPrice ? parseFloat(r.compareAtPrice) : undefined,
        inventoryQuantity: parseInt(r.inventoryQuantity) || 0,
        status: r.status,
      }));

      const result = await createBulkProducts({
        products,
        generateSEO,
      });

      setResults(result);

      if (result.success.length > 0) {
        toast.success(`${result.success.length} products created successfully!`);
      }
      if (result.failed.length > 0) {
        toast.error(`${result.failed.length} products failed to create`);
      }

      // Clear successful rows
      if (result.success.length > 0 && result.failed.length === 0) {
        setRows([{
          id: generateId(),
          title: "",
          gadgetTypeId: defaultGadgetTypeId,
          finishTypeId: defaultFinishTypeId,
          sku: "",
          price: defaultPrice,
          compareAtPrice: defaultCompareAtPrice,
          inventoryQuantity: defaultInventory,
          status: defaultStatus,
        }]);
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to create products");
    } finally {
      setIsCreating(false);
    }
  };

  // Clear all rows
  const clearAll = () => {
    setRows([{
      id: generateId(),
      title: "",
      gadgetTypeId: defaultGadgetTypeId,
      finishTypeId: defaultFinishTypeId,
      sku: "",
      price: defaultPrice,
      compareAtPrice: defaultCompareAtPrice,
      inventoryQuantity: defaultInventory,
      status: defaultStatus,
    }]);
    setResults(null);
  };

  if (gadgetTypes === undefined || finishTypes === undefined) {
    return <Skeleton className="h-screen w-full" />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/backend-skinly/products">
            <Button type="button" variant="ghost" size="sm">
              <ChevronLeftIcon className="size-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Bulk Product Creator</h1>
            <p className="text-muted-foreground">Create multiple skin products at once with AI-generated SEO</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={clearAll} disabled={isCreating}>
            Clear All
          </Button>
          <Button
            onClick={handleCreate}
            disabled={isCreating || !validation.isValid}
          >
            {isCreating ? (
              <>
                <Loader2Icon className="size-4 mr-2 animate-spin" />
                Creating {validation.validRowCount} Products...
              </>
            ) : (
              <>
                <PackageIcon className="size-4 mr-2" />
                Create {validation.validRowCount} Products
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Results */}
      {results && (
        <Card className={results.failed.length > 0 ? "border-destructive" : "border-green-500"}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {results.failed.length === 0 ? (
                <CheckCircleIcon className="size-5 text-green-500" />
              ) : (
                <XCircleIcon className="size-5 text-destructive" />
              )}
              Creation Results
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              {results.success.length > 0 && (
                <div className="p-4 bg-green-500/10 rounded-lg">
                  <h4 className="font-medium text-green-600 mb-2">
                    ✓ {results.success.length} Succeeded
                  </h4>
                  <ul className="text-sm space-y-1 max-h-32 overflow-auto">
                    {results.success.map((s, i) => (
                      <li key={i} className="text-green-700">{s.title}</li>
                    ))}
                  </ul>
                </div>
              )}
              {results.failed.length > 0 && (
                <div className="p-4 bg-destructive/10 rounded-lg">
                  <h4 className="font-medium text-destructive mb-2">
                    ✗ {results.failed.length} Failed
                  </h4>
                  <ul className="text-sm space-y-1 max-h-32 overflow-auto">
                    {results.failed.map((f, i) => (
                      <li key={i} className="text-destructive">
                        {f.title}: {f.error}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Default Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Default Settings</CardTitle>
          <CardDescription>Set defaults that will be applied to new rows</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            <div>
              <Label>Gadget Type</Label>
              <Select
                value={defaultGadgetTypeId || undefined}
                onValueChange={(v) => setDefaultGadgetTypeId(v as Id<"gadgetTypes">)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  {gadgetTypes.map(g => (
                    <SelectItem key={g._id} value={g._id}>{g.displayName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Finish Type</Label>
              <Select
                value={defaultFinishTypeId || undefined}
                onValueChange={(v) => setDefaultFinishTypeId(v as Id<"finishTypes">)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  {finishTypes.map(f => (
                    <SelectItem key={f._id} value={f._id}>{f.displayName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Price (₹)</Label>
              <Input
                type="number"
                value={defaultPrice}
                onChange={(e) => setDefaultPrice(e.target.value)}
              />
            </div>
            <div>
              <Label>Compare At (₹)</Label>
              <Input
                type="number"
                value={defaultCompareAtPrice}
                onChange={(e) => setDefaultCompareAtPrice(e.target.value)}
              />
            </div>
            <div>
              <Label>Inventory</Label>
              <Input
                type="number"
                value={defaultInventory}
                onChange={(e) => setDefaultInventory(e.target.value)}
              />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={defaultStatus} onValueChange={(v: "active" | "draft") => setDefaultStatus(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button variant="outline" onClick={applyDefaultsToAll} className="w-full">
                <CopyIcon className="size-4 mr-2" />
                Apply to All
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-6 mt-4 pt-4 border-t">
            <div className="flex items-center gap-2">
              <Checkbox
                id="generateSEO"
                checked={generateSEO}
                onCheckedChange={(c) => setGenerateSEO(c === true)}
              />
              <Label htmlFor="generateSEO" className="flex items-center gap-2 cursor-pointer">
                <SparklesIcon className="size-4 text-primary" />
                Generate SEO with AI
              </Label>
            </div>
            <span className="text-sm text-muted-foreground">
              {generateSEO
                ? "AI will generate title, description, meta tags, and slug for each product"
                : "Products will be created with basic fallback content"}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Product Rows */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Products ({rows.length})</CardTitle>
              <CardDescription>Enter product details. Only rows with titles will be created.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={autoGenerateSKUs}>
                Auto-generate SKUs
              </Button>
              <Button variant="outline" size="sm" onClick={() => addMultipleRows(5)}>
                +5 Rows
              </Button>
              <Button variant="outline" size="sm" onClick={() => addMultipleRows(10)}>
                +10 Rows
              </Button>
              <Button size="sm" onClick={addRow}>
                <PlusIcon className="size-4 mr-2" />
                Add Row
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px]">
            <div className="space-y-3 pr-4">
              {/* Header Row */}
              <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground px-2 sticky top-0 bg-background py-2 border-b">
                <div className="col-span-3">Product Title *</div>
                <div className="col-span-2">Gadget Type *</div>
                <div className="col-span-2">Finish Type *</div>
                <div>SKU *</div>
                <div>Price *</div>
                <div>Compare</div>
                <div>Stock</div>
                <div>Actions</div>
              </div>

              {/* Data Rows */}
              {rows.map((row, index) => (
                <div
                  key={row.id}
                  className={`grid grid-cols-12 gap-2 items-center p-2 rounded-lg ${
                    row.title.trim() ? "bg-muted/50" : "bg-background"
                  }`}
                >
                  <div className="col-span-3">
                    <Input
                      placeholder="e.g., Matte Black Skin"
                      value={row.title}
                      onChange={(e) => updateRow(row.id, "title", e.target.value)}
                      className="text-sm"
                    />
                  </div>
                  <div className="col-span-2">
                    <Select
                      value={row.gadgetTypeId || undefined}
                      onValueChange={(v) => updateRow(row.id, "gadgetTypeId", v)}
                    >
                      <SelectTrigger className="text-sm">
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        {gadgetTypes.map(g => (
                          <SelectItem key={g._id} value={g._id}>{g.displayName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2">
                    <Select
                      value={row.finishTypeId || undefined}
                      onValueChange={(v) => updateRow(row.id, "finishTypeId", v)}
                    >
                      <SelectTrigger className="text-sm">
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        {finishTypes.map(f => (
                          <SelectItem key={f._id} value={f._id}>{f.displayName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Input
                      placeholder="SKU"
                      value={row.sku}
                      onChange={(e) => updateRow(row.id, "sku", e.target.value)}
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <Input
                      type="number"
                      placeholder="299"
                      value={row.price}
                      onChange={(e) => updateRow(row.id, "price", e.target.value)}
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <Input
                      type="number"
                      placeholder="399"
                      value={row.compareAtPrice}
                      onChange={(e) => updateRow(row.id, "compareAtPrice", e.target.value)}
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <Input
                      type="number"
                      placeholder="100"
                      value={row.inventoryQuantity}
                      onChange={(e) => updateRow(row.id, "inventoryQuantity", e.target.value)}
                      className="text-sm"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <Select
                      value={row.status}
                      onValueChange={(v: "active" | "draft") => updateRow(row.id, "status", v)}
                    >
                      <SelectTrigger className="h-8 text-xs w-20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="draft">Draft</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeRow(row.id)}
                      disabled={rows.length <= 1}
                      className="h-8 w-8 p-0"
                    >
                      <TrashIcon className="size-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          {/* Validation Errors */}
          {validation.errors.length > 0 && (
            <div className="mt-4 p-4 bg-destructive/10 rounded-lg">
              <h4 className="font-medium text-destructive mb-2">Validation Errors:</h4>
              <ul className="text-sm text-destructive space-y-1">
                {validation.errors.slice(0, 5).map((e, i) => (
                  <li key={i}>• {e}</li>
                ))}
                {validation.errors.length > 5 && (
                  <li>• ... and {validation.errors.length - 5} more</li>
                )}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function BulkProductCreatorPage() {
  return (
    <AdminLayout>
      <Unauthenticated>
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <PackageIcon className="size-16 text-muted-foreground mb-4" />
          <h2 className="text-2xl font-bold mb-2">Sign in required</h2>
          <p className="text-muted-foreground mb-6">
            Please sign in to access the bulk product creator
          </p>
          <SignInButton />
        </div>
      </Unauthenticated>
      <AuthLoading>
        <Skeleton className="h-screen w-full" />
      </AuthLoading>
      <Authenticated>
        <BulkProductCreatorInner />
      </Authenticated>
    </AdminLayout>
  );
}
