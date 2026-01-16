import { useState, useMemo, useRef } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { AdminLayout } from "@/components/admin-layout.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
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
  ImageIcon,
  UploadIcon,
  XIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { SignInButton } from "@/components/ui/signin.tsx";
import { ScrollArea } from "@/components/ui/scroll-area.tsx";
import type { Id } from "@/convex/_generated/dataModel.d.ts";

// Product categories
const PRODUCT_CATEGORIES = [
  { value: "skin", label: "Skin" },
  { value: "case-cover", label: "Case/Cover" },
  { value: "camera-ring", label: "Camera Ring" },
  { value: "magneto-x", label: "Magneto X" },
  { value: "glass", label: "Glass" },
  { value: "accessory", label: "Accessory" },
] as const;

type ProductCategory = typeof PRODUCT_CATEGORIES[number]["value"];

interface ProductImage {
  url: string;
  alt?: string;
}

interface ProductRow {
  id: string;
  title: string;
  productCategory: ProductCategory;
  gadgetTypeId: Id<"gadgetTypes"> | "";
  finishTypeId: Id<"finishTypes"> | "";
  sku: string;
  price: string;
  compareAtPrice: string;
  inventoryQuantity: string;
  status: "active" | "draft";
  useCustomDescription: boolean;
  customDescription: string;
  images: ProductImage[];
  isExpanded: boolean;
}

function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

function BulkProductCreatorInner() {
  const gadgetTypes = useQuery(api.gadgetTypes.listActive, {});
  const finishTypes = useQuery(api.finishTypes.listActive, {});
  const createBulkProducts = useAction(api.bulkProductCreator.createBulkProducts);
  const uploadToCloudinary = useAction(api.cloudinary.uploadToCloudinary);

  // Default values for new rows
  const [defaultProductCategory, setDefaultProductCategory] = useState<ProductCategory>("skin");
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
      productCategory: "skin",
      gadgetTypeId: "",
      finishTypeId: "",
      sku: "",
      price: "299",
      compareAtPrice: "399",
      inventoryQuantity: "100",
      status: "active",
      useCustomDescription: false,
      customDescription: "",
      images: [],
      isExpanded: false,
    },
  ]);

  const [isCreating, setIsCreating] = useState(false);
  const [uploadingRowId, setUploadingRowId] = useState<string | null>(null);
  const [results, setResults] = useState<{
    success: { title: string; productId: string }[];
    failed: { title: string; error: string }[];
  } | null>(null);

  // File input refs for each row
  const fileInputRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  // Get gadget category from selected gadget type
  const getGadgetCategory = (gadgetTypeId: Id<"gadgetTypes"> | "") => {
    if (!gadgetTypeId || !gadgetTypes) return "phone";
    const gadgetType = gadgetTypes.find(g => g._id === gadgetTypeId);
    return gadgetType?.name || "phone";
  };

  // Add a new row
  const addRow = () => {
    setRows([
      ...rows,
      {
        id: generateId(),
        title: "",
        productCategory: defaultProductCategory,
        gadgetTypeId: defaultGadgetTypeId,
        finishTypeId: defaultFinishTypeId,
        sku: "",
        price: defaultPrice,
        compareAtPrice: defaultCompareAtPrice,
        inventoryQuantity: defaultInventory,
        status: defaultStatus,
        useCustomDescription: false,
        customDescription: "",
        images: [],
        isExpanded: false,
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
        productCategory: defaultProductCategory,
        gadgetTypeId: defaultGadgetTypeId,
        finishTypeId: defaultFinishTypeId,
        sku: "",
        price: defaultPrice,
        compareAtPrice: defaultCompareAtPrice,
        inventoryQuantity: defaultInventory,
        status: defaultStatus,
        useCustomDescription: false,
        customDescription: "",
        images: [],
        isExpanded: false,
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
  const updateRow = (id: string, field: keyof ProductRow, value: any) => {
    setRows(rows.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  // Toggle row expansion
  const toggleRowExpansion = (id: string) => {
    setRows(rows.map(r => r.id === id ? { ...r, isExpanded: !r.isExpanded } : r));
  };

  // Apply defaults to all rows
  const applyDefaultsToAll = () => {
    setRows(rows.map(r => ({
      ...r,
      productCategory: defaultProductCategory,
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

  // Handle image upload for a row
  const handleImageUpload = async (rowId: string, files: FileList) => {
    const row = rows.find(r => r.id === rowId);
    if (!row) return;

    const currentImageCount = row.images.length;
    const remainingSlots = 5 - currentImageCount;

    if (remainingSlots <= 0) {
      toast.error("Maximum 5 images per product");
      return;
    }

    const filesToUpload = Array.from(files).slice(0, remainingSlots);
    setUploadingRowId(rowId);

    try {
      const newImages: ProductImage[] = [];
      const slug = row.title?.toLowerCase().replace(/[^a-z0-9]/g, "-").slice(0, 30) || "bulk-product";

      for (let i = 0; i < filesToUpload.length; i++) {
        const file = filesToUpload[i];

        if (!file.type.startsWith("image/")) {
          toast.error(`${file.name} is not an image`);
          continue;
        }

        if (file.size > 10 * 1024 * 1024) {
          toast.error(`${file.name} is too large (max 10MB)`);
          continue;
        }

        // Convert to base64
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
        });

        // Upload to Cloudinary
        const result = await uploadToCloudinary({
          imageBase64: base64,
          folder: `products/${slug}`,
          publicId: `bulk_${rowId}_${Date.now()}_${i}`,
        });

        if (result.success && result.cloudinaryUrl) {
          newImages.push({
            url: result.cloudinaryUrl,
            alt: file.name.replace(/\.[^/.]+$/, ""),
          });
        }
      }

      if (newImages.length > 0) {
        updateRow(rowId, "images", [...row.images, ...newImages]);
        toast.success(`${newImages.length} image(s) uploaded`);
      }
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload images");
    } finally {
      setUploadingRowId(null);
    }
  };

  // Remove image from row
  const removeImageFromRow = (rowId: string, imageIndex: number) => {
    const row = rows.find(r => r.id === rowId);
    if (!row) return;

    const newImages = row.images.filter((_, i) => i !== imageIndex);
    updateRow(rowId, "images", newImages);
  };

  // Validate rows
  const validation = useMemo(() => {
    const errors: string[] = [];
    const validRows = rows.filter(r => r.title.trim());

    if (validRows.length === 0) {
      errors.push("Add at least one product with a title");
    }

    validRows.forEach((r, idx) => {
      if (!r.sku.trim()) errors.push(`Row ${idx + 1}: Enter SKU`);
      if (!r.price || parseFloat(r.price) <= 0) errors.push(`Row ${idx + 1}: Enter valid price`);
      // Gadget type and finish type are now optional for non-skin categories
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
        productCategory: r.productCategory,
        gadgetTypeId: r.gadgetTypeId ? r.gadgetTypeId as Id<"gadgetTypes"> : undefined,
        finishTypeId: r.finishTypeId ? r.finishTypeId as Id<"finishTypes"> : undefined,
        gadgetCategory: getGadgetCategory(r.gadgetTypeId as Id<"gadgetTypes">),
        sku: r.sku.trim(),
        price: parseFloat(r.price),
        compareAtPrice: r.compareAtPrice ? parseFloat(r.compareAtPrice) : undefined,
        inventoryQuantity: parseInt(r.inventoryQuantity) || 0,
        status: r.status,
        customDescription: r.useCustomDescription ? r.customDescription : undefined,
        images: r.images.length > 0 ? r.images : undefined,
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
          productCategory: defaultProductCategory,
          gadgetTypeId: defaultGadgetTypeId,
          finishTypeId: defaultFinishTypeId,
          sku: "",
          price: defaultPrice,
          compareAtPrice: defaultCompareAtPrice,
          inventoryQuantity: defaultInventory,
          status: defaultStatus,
          useCustomDescription: false,
          customDescription: "",
          images: [],
          isExpanded: false,
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
      productCategory: defaultProductCategory,
      gadgetTypeId: defaultGadgetTypeId,
      finishTypeId: defaultFinishTypeId,
      sku: "",
      price: defaultPrice,
      compareAtPrice: defaultCompareAtPrice,
      inventoryQuantity: defaultInventory,
      status: defaultStatus,
      useCustomDescription: false,
      customDescription: "",
      images: [],
      isExpanded: false,
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
            <p className="text-muted-foreground">Create multiple products at once with AI-generated SEO</p>
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
                    {results.success.length} Succeeded
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
                    {results.failed.length} Failed
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
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
            <div>
              <Label>Category</Label>
              <Select
                value={defaultProductCategory}
                onValueChange={(v) => setDefaultProductCategory(v as ProductCategory)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRODUCT_CATEGORIES.map(cat => (
                    <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
              <Label>Price</Label>
              <Input
                type="number"
                value={defaultPrice}
                onChange={(e) => setDefaultPrice(e.target.value)}
              />
            </div>
            <div>
              <Label>Compare At</Label>
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
                Apply All
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
                ? "AI will generate description, meta tags, and slug (unless custom description is provided)"
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
              <CardDescription>Enter product details. Click expand to add description/images. Only rows with titles will be created.</CardDescription>
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
          <ScrollArea className="h-[600px]">
            <div className="space-y-3 pr-4">
              {/* Header Row */}
              <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground px-2 sticky top-0 bg-background py-2 border-b z-10">
                <div className="col-span-2">Title *</div>
                <div>Category</div>
                <div>Gadget</div>
                <div>Finish</div>
                <div>SKU *</div>
                <div>Price *</div>
                <div>Compare</div>
                <div>Stock</div>
                <div>Status</div>
                <div className="col-span-2">Actions</div>
              </div>

              {/* Data Rows */}
              {rows.map((row) => (
                <div key={row.id} className="space-y-2">
                  {/* Main Row */}
                  <div
                    className={`grid grid-cols-12 gap-2 items-center p-2 rounded-lg ${
                      row.title.trim() ? "bg-muted/50" : "bg-background"
                    }`}
                  >
                    <div className="col-span-2">
                      <Input
                        placeholder="Product title"
                        value={row.title}
                        onChange={(e) => updateRow(row.id, "title", e.target.value)}
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <Select
                        value={row.productCategory}
                        onValueChange={(v) => updateRow(row.id, "productCategory", v)}
                      >
                        <SelectTrigger className="text-xs h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PRODUCT_CATEGORIES.map(cat => (
                            <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Select
                        value={row.gadgetTypeId || undefined}
                        onValueChange={(v) => updateRow(row.id, "gadgetTypeId", v)}
                      >
                        <SelectTrigger className="text-xs h-9">
                          <SelectValue placeholder="..." />
                        </SelectTrigger>
                        <SelectContent>
                          {gadgetTypes.map(g => (
                            <SelectItem key={g._id} value={g._id}>{g.displayName}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Select
                        value={row.finishTypeId || undefined}
                        onValueChange={(v) => updateRow(row.id, "finishTypeId", v)}
                      >
                        <SelectTrigger className="text-xs h-9">
                          <SelectValue placeholder="..." />
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
                    <div>
                      <Select
                        value={row.status}
                        onValueChange={(v: "active" | "draft") => updateRow(row.id, "status", v)}
                      >
                        <SelectTrigger className="h-9 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="draft">Draft</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2 flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleRowExpansion(row.id)}
                        className="h-8 px-2"
                        title="Expand for description & images"
                      >
                        {row.isExpanded ? (
                          <ChevronUpIcon className="size-4" />
                        ) : (
                          <ChevronDownIcon className="size-4" />
                        )}
                      </Button>
                      {row.images.length > 0 && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <ImageIcon className="size-3" />
                          {row.images.length}
                        </span>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeRow(row.id)}
                        disabled={rows.length <= 1}
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      >
                        <TrashIcon className="size-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Expanded Section - Description & Images */}
                  {row.isExpanded && (
                    <div className="ml-4 p-4 bg-muted/30 rounded-lg space-y-4 border-l-2 border-primary/20">
                      {/* Custom Description Toggle */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id={`custom-desc-${row.id}`}
                            checked={row.useCustomDescription}
                            onCheckedChange={(c) => updateRow(row.id, "useCustomDescription", c === true)}
                          />
                          <Label htmlFor={`custom-desc-${row.id}`} className="text-sm cursor-pointer">
                            Use custom description (overrides AI SEO generation)
                          </Label>
                        </div>
                        {row.useCustomDescription && (
                          <Textarea
                            placeholder="Enter product description..."
                            value={row.customDescription}
                            onChange={(e) => updateRow(row.id, "customDescription", e.target.value)}
                            rows={3}
                            className="text-sm"
                          />
                        )}
                      </div>

                      {/* Image Upload */}
                      <div className="space-y-2">
                        <Label className="text-sm">Product Images (max 5)</Label>
                        <div className="flex items-start gap-3">
                          {/* Upload Button */}
                          <div>
                            <input
                              type="file"
                              accept="image/*"
                              multiple
                              className="hidden"
                              ref={(el) => {
                                if (el) fileInputRefs.current.set(row.id, el);
                              }}
                              onChange={(e) => {
                                if (e.target.files) {
                                  handleImageUpload(row.id, e.target.files);
                                }
                                e.target.value = "";
                              }}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => fileInputRefs.current.get(row.id)?.click()}
                              disabled={uploadingRowId === row.id || row.images.length >= 5}
                            >
                              {uploadingRowId === row.id ? (
                                <>
                                  <Loader2Icon className="size-4 mr-2 animate-spin" />
                                  Uploading...
                                </>
                              ) : (
                                <>
                                  <UploadIcon className="size-4 mr-2" />
                                  Upload Images
                                </>
                              )}
                            </Button>
                          </div>

                          {/* Image Previews */}
                          <div className="flex flex-wrap gap-2">
                            {row.images.map((img, imgIdx) => (
                              <div key={imgIdx} className="relative group">
                                <img
                                  src={img.url}
                                  alt={img.alt || `Image ${imgIdx + 1}`}
                                  className="w-16 h-16 object-cover rounded border"
                                />
                                <button
                                  type="button"
                                  onClick={() => removeImageFromRow(row.id, imgIdx)}
                                  className="absolute -top-1 -right-1 bg-destructive text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <XIcon className="size-3" />
                                </button>
                              </div>
                            ))}
                            {row.images.length === 0 && (
                              <span className="text-xs text-muted-foreground italic">
                                No images - will use default logo
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
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
                  <li key={i}>{e}</li>
                ))}
                {validation.errors.length > 5 && (
                  <li>... and {validation.errors.length - 5} more</li>
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
