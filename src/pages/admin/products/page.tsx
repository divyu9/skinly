import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Link } from "react-router-dom";
import { PackageIcon, PlusIcon, EditIcon, TrashIcon, DownloadIcon, SearchIcon, CheckCircleIcon, XCircleIcon, AlertCircleIcon, SaveIcon, ImageIcon, UploadIcon, FileSpreadsheetIcon, ImagesIcon, MoreVerticalIcon, DollarSignIcon } from "lucide-react";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { SignInButton } from "@/components/ui/signin.tsx";
import { AdminHeader } from "@/components/admin-header.tsx";
import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { useState, useMemo, useRef } from "react";
import { Input } from "@/components/ui/input.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs.tsx";
import { ScrollArea } from "@/components/ui/scroll-area.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import { ImageManager } from "./_components/image-manager.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
import { BulkPriceEditDialog } from "./_components/bulk-price-edit-dialog.tsx";
import { RollsManagement } from "./_components/rolls-management.tsx";

// Inline editable cell component
function EditableCell({
  variantId,
  value,
  type,
  field,
}: {
  variantId: Id<"variants">;
  value: string | number;
  type: "text" | "number";
  field: "sku" | "price" | "inventoryQuantity";
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(String(value));
  const updateVariant = useMutation(api.products.updateVariant);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (type === "number") {
      const numValue = parseFloat(editValue);
      if (isNaN(numValue) || numValue < 0) {
        toast.error(`Please enter a valid ${field === "price" ? "price" : "quantity"}`);
        return;
      }
      setIsSaving(true);
      try {
        await updateVariant({
          variantId,
          [field]: numValue,
        });
        toast.success("Updated successfully");
        setIsEditing(false);
      } catch (error) {
        toast.error("Failed to update");
      } finally {
        setIsSaving(false);
      }
    } else {
      if (!editValue.trim()) {
        toast.error("SKU cannot be empty");
        return;
      }
      setIsSaving(true);
      try {
        await updateVariant({
          variantId,
          sku: editValue.trim(),
        });
        toast.success("SKU updated successfully");
        setIsEditing(false);
      } catch (error) {
        toast.error("Failed to update SKU");
      } finally {
        setIsSaving(false);
      }
    }
  };

  if (!isEditing) {
    return (
      <button
        onClick={() => setIsEditing(true)}
        className="text-left hover:bg-muted/50 px-2 py-1 rounded transition-colors w-full"
      >
        {type === "number" && field === "price" ? `₹${value}` : value}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      {type === "number" && field === "price" && (
        <span className="text-muted-foreground">₹</span>
      )}
      <Input
        type={type}
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            handleSave();
          } else if (e.key === "Escape") {
            setEditValue(String(value));
            setIsEditing(false);
          }
        }}
        autoFocus
        disabled={isSaving}
        className="h-8 text-sm"
      />
    </div>
  );
}

function AdminProductsPageInner() {
  // State declarations first
  const [isMigrating, setIsMigrating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCheckingCount, setIsCheckingCount] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [managingImagesProduct, setManagingImagesProduct] = useState<{id: Id<"products">; title: string; images: Array<{url: string; alt?: string}>} | null>(null);
  const [selectedProducts, setSelectedProducts] = useState<Array<Id<"products">>>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [skuLetterFilter, setSkuLetterFilter] = useState<"all" | "M" | "L" | "T">("all");
  const [skuSortOrder, setSkuSortOrder] = useState<"asc" | "desc">("asc");
  const [gadgetCategoryFilter, setGadgetCategoryFilter] = useState<"all" | "phone" | "laptop" | "camera" | "mac-mini" | "tablet" | "console" | "lens" | "drone" | "charger">("all");
  const [showBulkPriceEdit, setShowBulkPriceEdit] = useState(false);
  const [migrationReport, setMigrationReport] = useState<{
    total: number;
    successful: number;
    skipped: number;
    failed: number;
    successfulProducts: string[];
    skippedProducts: Array<{ title: string; reason: string }>;
    failedProducts: Array<{ title: string; reason: string }>;
  } | null>(null);
  const [showReportDialog, setShowReportDialog] = useState(false);

  // Queries and mutations
  const products = useQuery(api.products.getAllProducts, {});
  const collections = useQuery(api.collections.getAllCollections, {});
  const exportData = useQuery(api.products.exportProductsForBulkEdit, 
    selectedProducts.length > 0 ? { productIds: selectedProducts } : "skip"
  );
  const deleteProduct = useMutation(api.products.deleteProduct);
  const updateProduct = useMutation(api.products.updateProduct);
  const deleteAllProducts = useMutation(api.products.deleteAllProducts);
  const bulkUpdateVariants = useMutation(api.products.bulkUpdateVariants);
  const migrateFromShopify = useAction(api.migration.migrateFromShopify);
  const checkProductCount = useAction(api.migration.checkShopifyProductCount);

  const handleCheckCount = async () => {
    setIsCheckingCount(true);
    try {
      const result = await checkProductCount({});
      const message = `
Shopify: ${result.shopifyTotal} products
Local DB: ${result.localTotal} products
Missing: ${result.missing} products

${result.missing > 0 ? "Click 'Import from Shopify' to import missing products." : "All products are synced!"}
      `.trim();

      if (result.missing > 0) {
        toast.warning(message);
      } else {
        toast.success(message);
      }
    } catch (error) {
      toast.error(
        `Failed to check product count: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    } finally {
      setIsCheckingCount(false);
    }
  };

  const handleMigration = async () => {
    if (
      !confirm(
        "This will import all active products from Shopify. Products already in your database will be skipped automatically. Continue?"
      )
    ) {
      return;
    }

    setIsMigrating(true);
    try {
      const result = await migrateFromShopify({ forceReimport: false });

      // Store the full report
      setMigrationReport(result);

      const parts = [
        `${result.successful} imported`,
        result.skipped > 0 ? `${result.skipped} skipped` : null,
        result.failed > 0 ? `${result.failed} failed` : null,
      ].filter(Boolean);

      toast.success(
        `Migration complete! ${parts.join(", ")}. Click "View Details" to see full report.`
      );

      // Show the dialog with detailed report
      setShowReportDialog(true);
    } catch (error) {
      toast.error(
        `Migration failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    } finally {
      setIsMigrating(false);
    }
  };

  const handleClearAll = async () => {
    if (
      !confirm(
        "⚠️ WARNING: This will permanently delete ALL products and variants from your database. This action cannot be undone. Are you absolutely sure?"
      )
    ) {
      return;
    }

    // Double confirmation for safety
    if (!confirm("Last chance! Type 'DELETE' in the next dialog to confirm.")) {
      return;
    }

    const userInput = prompt("Type 'DELETE' to confirm deletion of all products:");
    if (userInput !== "DELETE") {
      toast.error("Deletion cancelled - confirmation text did not match.");
      return;
    }

    setIsDeleting(true);
    try {
      const result = await deleteAllProducts({});
      toast.success(
        `All products cleared! Deleted ${result.deletedProducts} products and ${result.deletedVariants} variants.`
      );
    } catch (error) {
      toast.error(
        `Failed to delete products: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDelete = async (productId: Id<"products">) => {
    if (
      !confirm(
        "Are you sure you want to delete this product? This will also delete all variants."
      )
    ) {
      return;
    }

    try {
      await deleteProduct({ productId });
      toast.success("Product deleted successfully");
    } catch (error) {
      toast.error("Failed to delete product");
    }
  };

  const handleStatusChange = async (productId: Id<"products">, status: "active" | "draft" | "archived") => {
    try {
      await updateProduct({ productId, status });
      toast.success("Status updated");
    } catch (error) {
      toast.error("Failed to update status");
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-500/10 text-green-500 border-green-500/20";
      case "draft":
        return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
      case "archived":
        return "bg-gray-500/10 text-gray-500 border-gray-500/20";
      default:
        return "";
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedProducts(filteredProducts.map((p) => p._id));
    } else {
      setSelectedProducts([]);
    }
  };

  const handleSelectProduct = (productId: Id<"products">, checked: boolean) => {
    if (checked) {
      setSelectedProducts((prev) => [...prev, productId]);
    } else {
      setSelectedProducts((prev) => prev.filter((id) => id !== productId));
    }
  };

  const handleExport = () => {
    if (selectedProducts.length === 0) {
      toast.error("Please select products to export");
      return;
    }

    if (!exportData) {
      toast.error("Export data not ready");
      return;
    }

    setIsExporting(true);
    
    try {
      // Create CSV content with UTF-8 BOM
      const headers = [
        "Product ID",
        "Product Title",
        "Product Slug",
        "Product Status",
        "Collection Name",
        "Variant ID",
        "Variant Title",
        "SKU",
        "Price",
        "Compare At Price",
        "Inventory Quantity",
        "Weight",
        "Weight Unit",
      ];

      const csvContent = [
        headers.join(","),
        ...exportData.map((row) =>
          [
            row.productId,
            `"${row.productTitle.replace(/"/g, '""')}"`,
            row.productSlug,
            row.productStatus,
            `"${row.collectionName.replace(/"/g, '""')}"`,
            row.variantId,
            `"${row.variantTitle.replace(/"/g, '""')}"`,
            row.sku,
            row.price,
            row.compareAtPrice,
            row.inventoryQuantity,
            row.weight,
            row.weightUnit,
          ].join(",")
        ),
      ].join("\n");

      // Add UTF-8 BOM
      const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `products-export-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(`Exported ${exportData.length} variant rows`);
    } catch (error) {
      toast.error("Failed to export products");
    } finally {
      setIsExporting(false);
    }
  };

  const handleImport = () => {
    fileInputRef.current?.click();
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);

    try {
      const text = await file.text();
      const lines = text.split("\n").filter((line) => line.trim());
      
      if (lines.length < 2) {
        toast.error("CSV file is empty or invalid");
        setIsImporting(false);
        return;
      }

      // Parse CSV (skip header)
      const updates = [];
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Simple CSV parsing (handles quoted fields)
        const fields: string[] = [];
        let currentField = "";
        let inQuotes = false;

        for (let j = 0; j < line.length; j++) {
          const char = line[j];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === "," && !inQuotes) {
            fields.push(currentField);
            currentField = "";
          } else {
            currentField += char;
          }
        }
        fields.push(currentField);

        if (fields.length < 13) continue;

        const variantId = fields[5].trim();
        const variantTitle = fields[6].replace(/^"|"$/g, "");
        const sku = fields[7].trim();
        const price = parseFloat(fields[8]);
        const compareAtPrice = fields[9].trim() ? parseFloat(fields[9]) : null;
        const inventoryQuantity = parseInt(fields[10], 10);
        const weight = fields[11].trim() ? parseFloat(fields[11]) : null;
        const weightUnit = fields[12].trim() || null;

        updates.push({
          variantId: variantId as Id<"variants">,
          variantTitle,
          sku,
          price,
          compareAtPrice,
          inventoryQuantity,
          weight,
          weightUnit,
        });
      }

      if (updates.length === 0) {
        toast.error("No valid data found in CSV");
        setIsImporting(false);
        return;
      }

      const result = await bulkUpdateVariants({ updates });
      
      if (result.errorCount > 0) {
        toast.warning(
          `Updated ${result.successCount} variants, ${result.errorCount} errors. Check console for details.`
        );
        console.error("Import errors:", result.errors);
      } else {
        toast.success(`Successfully updated ${result.successCount} variants`);
      }

      // Clear selection and reset file input
      setSelectedProducts([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      toast.error(`Import failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsImporting(false);
    }
  };

  // Helper function to parse SKU
  const parseSku = (sku: string): { letter: string; number: number } => {
    const match = sku.match(/^([A-Z]+)-?(\d+)/i);
    if (match) {
      return {
        letter: match[1].toUpperCase(),
        number: parseInt(match[2], 10),
      };
    }
    return { letter: "", number: 0 };
  };

  // Helper function to detect gadget category from product title
  const detectGadgetCategory = (title: string): string | null => {
    const lowerTitle = title.toLowerCase();
    
    if (lowerTitle.includes("phone")) return "phone";
    if (lowerTitle.includes("laptop")) return "laptop";
    if (lowerTitle.includes("camera")) return "camera";
    if (lowerTitle.includes("mac mini")) return "mac-mini";
    if (lowerTitle.includes("tablet")) return "tablet";
    if (lowerTitle.includes("console") || lowerTitle.includes("playstation") || lowerTitle.includes("xbox")) return "console";
    if (lowerTitle.includes("lens")) return "lens";
    if (lowerTitle.includes("drone")) return "drone";
    if (lowerTitle.includes("charger")) return "charger";
    
    return null;
  };

  // Filter products based on search query, SKU letter filter, and sort order
  const filteredProducts = useMemo(() => {
    if (!products) return [];
    
    let filtered = products;

    // Apply text search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter((product) => {
        return (
          product.title.toLowerCase().includes(query) ||
          product.description.toLowerCase().includes(query) ||
          product.slug.toLowerCase().includes(query) ||
          product.tags.some((tag) => tag.toLowerCase().includes(query)) ||
          product.variants.some((v) => v.sku.toLowerCase().includes(query))
        );
      });
    }

    // Apply SKU letter filter
    if (skuLetterFilter !== "all") {
      filtered = filtered.filter((product) => {
        return product.variants.some((v) => {
          const { letter } = parseSku(v.sku);
          return letter === skuLetterFilter;
        });
      });
    }

    // Apply gadget category filter
    if (gadgetCategoryFilter !== "all") {
      filtered = filtered.filter((product) => {
        const category = detectGadgetCategory(product.title);
        return category === gadgetCategoryFilter;
      });
    }

    // Sort by SKU numeric value
    const sorted = [...filtered].sort((a, b) => {
      const aFirstVariant = a.variants[0];
      const bFirstVariant = b.variants[0];
      
      if (!aFirstVariant || !bFirstVariant) return 0;
      
      const aParsed = parseSku(aFirstVariant.sku);
      const bParsed = parseSku(bFirstVariant.sku);
      
      // Sort by number
      const diff = aParsed.number - bParsed.number;
      return skuSortOrder === "asc" ? diff : -diff;
    });

    return sorted;
  }, [products, searchQuery, skuLetterFilter, skuSortOrder, gadgetCategoryFilter]);

  // Build collections map
  const collectionsMap = useMemo(() => {
    if (!collections) return new Map();
    return new Map(collections.map((c) => [c._id, c]));
  }, [collections]);

  if (products === undefined) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Products</h1>
        <p className="text-muted-foreground mt-1">
          Manage your product catalog and vinyl rolls inventory
        </p>
      </div>

      <Tabs defaultValue="products" className="space-y-6">
        <TabsList>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="rolls">Rolls Management</TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="space-y-6">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {searchQuery || skuLetterFilter !== "all" || gadgetCategoryFilter !== "all"
                ? `${filteredProducts.length} of ${products.length} products`
                : `${products.length} products`}
              {selectedProducts.length > 0 && ` • ${selectedProducts.length} selected`}
              {skuLetterFilter !== "all" && ` • SKU: ${skuLetterFilter}`}
              {gadgetCategoryFilter !== "all" && ` • Category: ${gadgetCategoryFilter.charAt(0).toUpperCase() + gadgetCategoryFilter.slice(1).replace("-", " ")}`}
            </p>
            <div className="flex items-center gap-2">
          {selectedProducts.length > 0 && (
            <>
              <Button
                variant="outline"
                onClick={handleExport}
                disabled={isExporting}
              >
                <FileSpreadsheetIcon className="size-4 mr-2" />
                {isExporting ? "Exporting..." : "Export CSV"}
              </Button>
              <Button
                variant="outline"
                onClick={handleImport}
                disabled={isImporting}
              >
                <UploadIcon className="size-4 mr-2" />
                {isImporting ? "Importing..." : "Import CSV"}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
              />
            </>
          )}
          {products && products.length > 0 && (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">
                    <MoreVerticalIcon className="size-4 mr-2" />
                    Bulk Actions
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setShowBulkPriceEdit(true)}>
                    <DollarSignIcon className="size-4 mr-2" />
                    Bulk Edit Prices
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                variant="outline"
                onClick={handleClearAll}
                disabled={isDeleting}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <TrashIcon className="size-4 mr-2" />
                {isDeleting ? "Clearing..." : "Clear All"}
              </Button>
            </>
          )}
          <Button variant="secondary" onClick={handleCheckCount} disabled={isCheckingCount}>
            <PackageIcon className="size-4 mr-2" />
            {isCheckingCount ? "Checking..." : "Check Product Count"}
          </Button>
          <Button variant="outline" onClick={handleMigration} disabled={isMigrating}>
            <DownloadIcon className="size-4 mr-2" />
            {isMigrating ? "Importing..." : "Import from Shopify"}
          </Button>
          {migrationReport && (
            <Button
              variant="ghost"
              onClick={() => setShowReportDialog(true)}
              className="text-xs"
            >
              View Last Report
            </Button>
          )}
          <Link to="/admin/products/new">
            <Button>
              <PlusIcon className="size-4 mr-2" />
              Add Product
            </Button>
          </Link>
        </div>
      </div>

      {/* Search Bar */}
      {products.length > 0 && (
        <div className="max-w-md">
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search products by title, description, SKU, tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      )}

      {/* SKU Filters */}
      {products.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="space-y-4">
              {/* SKU and Sort Filters */}
              <div className="flex items-center gap-6 flex-wrap">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-muted-foreground">SKU Filter:</span>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant={skuLetterFilter === "all" ? "default" : "outline"}
                      onClick={() => setSkuLetterFilter("all")}
                    >
                      All
                    </Button>
                    <Button
                      size="sm"
                      variant={skuLetterFilter === "M" ? "default" : "outline"}
                      onClick={() => setSkuLetterFilter("M")}
                    >
                      M
                    </Button>
                    <Button
                      size="sm"
                      variant={skuLetterFilter === "L" ? "default" : "outline"}
                      onClick={() => setSkuLetterFilter("L")}
                    >
                      L
                    </Button>
                    <Button
                      size="sm"
                      variant={skuLetterFilter === "T" ? "default" : "outline"}
                      onClick={() => setSkuLetterFilter("T")}
                    >
                      T
                    </Button>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-muted-foreground">Sort Order:</span>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant={skuSortOrder === "asc" ? "default" : "outline"}
                      onClick={() => setSkuSortOrder("asc")}
                    >
                      Ascending ↑
                    </Button>
                    <Button
                      size="sm"
                      variant={skuSortOrder === "desc" ? "default" : "outline"}
                      onClick={() => setSkuSortOrder("desc")}
                    >
                      Descending ↓
                    </Button>
                  </div>
                </div>
              </div>

              {/* Category Filter */}
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-sm font-medium text-muted-foreground">Category:</span>
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    size="sm"
                    variant={gadgetCategoryFilter === "all" ? "default" : "outline"}
                    onClick={() => setGadgetCategoryFilter("all")}
                  >
                    All
                  </Button>
                  <Button
                    size="sm"
                    variant={gadgetCategoryFilter === "phone" ? "default" : "outline"}
                    onClick={() => setGadgetCategoryFilter("phone")}
                  >
                    Phone
                  </Button>
                  <Button
                    size="sm"
                    variant={gadgetCategoryFilter === "laptop" ? "default" : "outline"}
                    onClick={() => setGadgetCategoryFilter("laptop")}
                  >
                    Laptop
                  </Button>
                  <Button
                    size="sm"
                    variant={gadgetCategoryFilter === "camera" ? "default" : "outline"}
                    onClick={() => setGadgetCategoryFilter("camera")}
                  >
                    Camera
                  </Button>
                  <Button
                    size="sm"
                    variant={gadgetCategoryFilter === "mac-mini" ? "default" : "outline"}
                    onClick={() => setGadgetCategoryFilter("mac-mini")}
                  >
                    Mac Mini
                  </Button>
                  <Button
                    size="sm"
                    variant={gadgetCategoryFilter === "tablet" ? "default" : "outline"}
                    onClick={() => setGadgetCategoryFilter("tablet")}
                  >
                    Tablet
                  </Button>
                  <Button
                    size="sm"
                    variant={gadgetCategoryFilter === "console" ? "default" : "outline"}
                    onClick={() => setGadgetCategoryFilter("console")}
                  >
                    Console
                  </Button>
                  <Button
                    size="sm"
                    variant={gadgetCategoryFilter === "lens" ? "default" : "outline"}
                    onClick={() => setGadgetCategoryFilter("lens")}
                  >
                    Lens
                  </Button>
                  <Button
                    size="sm"
                    variant={gadgetCategoryFilter === "drone" ? "default" : "outline"}
                    onClick={() => setGadgetCategoryFilter("drone")}
                  >
                    Drone
                  </Button>
                  <Button
                    size="sm"
                    variant={gadgetCategoryFilter === "charger" ? "default" : "outline"}
                    onClick={() => setGadgetCategoryFilter("charger")}
                  >
                    Charger
                  </Button>
                </div>
              </div>

              {/* Reset Button */}
              {(skuLetterFilter !== "all" || skuSortOrder !== "asc" || gadgetCategoryFilter !== "all") && (
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setSkuLetterFilter("all");
                      setSkuSortOrder("asc");
                      setGadgetCategoryFilter("all");
                    }}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    Reset Filters
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {products.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <PackageIcon />
            </EmptyMedia>
            <EmptyTitle>No products yet</EmptyTitle>
            <EmptyDescription>Create your first product to start selling</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Link to="/admin/products/new">
              <Button>
                <PlusIcon className="size-4 mr-2" />
                Create Product
              </Button>
            </Link>
          </EmptyContent>
        </Empty>
      ) : filteredProducts.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SearchIcon />
            </EmptyMedia>
            <EmptyTitle>No products found</EmptyTitle>
            <EmptyDescription>
              No products match your search &quot;{searchQuery}&quot;
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={() => setSearchQuery("")} variant="outline">
              Clear Search
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b bg-muted/50">
                  <tr>
                    <th className="p-3 text-left text-sm font-medium w-12">
                      <Checkbox
                        checked={selectedProducts.length === filteredProducts.length && filteredProducts.length > 0}
                        onCheckedChange={handleSelectAll}
                      />
                    </th>
                    <th className="p-3 text-left text-sm font-medium w-16">Image</th>
                    <th className="p-3 text-left text-sm font-medium">Product Name</th>
                    <th className="p-3 text-left text-sm font-medium w-32">SKU</th>
                    <th className="p-3 text-left text-sm font-medium w-28">Price</th>
                    <th className="p-3 text-left text-sm font-medium w-24">Inventory</th>
                    <th className="p-3 text-left text-sm font-medium w-32">Collection</th>
                    <th className="p-3 text-left text-sm font-medium w-28">Status</th>
                    <th className="p-3 text-left text-sm font-medium w-32">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((product) => {
                    const firstVariant = product.variants[0];
                    const totalInventory = product.variants.reduce(
                      (sum, v) => sum + v.inventoryQuantity,
                      0
                    );
                    const collection = product.collectionId
                      ? collectionsMap.get(product.collectionId)
                      : null;
                    const isSelected = selectedProducts.includes(product._id);

                    return (
                      <tr key={product._id} className="border-b hover:bg-muted/30 transition-colors">
                        <td className="p-3">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) => handleSelectProduct(product._id, !!checked)}
                          />
                        </td>
                        <td className="p-3">
                          <div className="relative">
                            {product.images.length > 0 ? (
                              <button
                                onClick={() => setSelectedImage(product.images[0].url)}
                                className="size-12 bg-muted rounded overflow-hidden hover:ring-2 hover:ring-primary transition-all"
                              >
                                <img
                                  src={product.images[0].url}
                                  alt={product.images[0].alt || product.title}
                                  className="w-full h-full object-cover"
                                />
                              </button>
                            ) : (
                              <div className="size-12 bg-muted rounded flex items-center justify-center">
                                <ImageIcon className="size-5 text-muted-foreground" />
                              </div>
                            )}
                            {product.images.length > 1 && (
                              <Badge 
                                className="absolute -bottom-1 -right-1 size-5 flex items-center justify-center p-0 text-[10px]"
                                variant="secondary"
                              >
                                {product.images.length}
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="p-3">
                          <div>
                            <p className="font-medium">{product.title}</p>
                            {product.variants.length > 1 && (
                              <p className="text-xs text-muted-foreground">
                                {product.variants.length} variants
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="p-3">
                          {firstVariant ? (
                            <div>
                              <EditableCell
                                variantId={firstVariant._id}
                                value={firstVariant.sku}
                                type="text"
                                field="sku"
                              />
                              {product.variants.length > 1 && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  +{product.variants.length - 1} more
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </td>
                        <td className="p-3">
                          {firstVariant ? (
                            <div>
                              <EditableCell
                                variantId={firstVariant._id}
                                value={firstVariant.price}
                                type="number"
                                field="price"
                              />
                              {product.variants.length > 1 && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  +{product.variants.length - 1} more
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </td>
                        <td className="p-3">
                          {firstVariant ? (
                            <div>
                              <EditableCell
                                variantId={firstVariant._id}
                                value={firstVariant.inventoryQuantity}
                                type="number"
                                field="inventoryQuantity"
                              />
                              {product.variants.length > 1 && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Total: {totalInventory}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </td>
                        <td className="p-3">
                          <span className="text-sm">
                            {collection ? collection.name : "-"}
                          </span>
                        </td>
                        <td className="p-3">
                          <Select
                            value={product.status}
                            onValueChange={(value: "active" | "draft" | "archived") =>
                              handleStatusChange(product._id, value)
                            }
                          >
                            <SelectTrigger
                              className={`h-8 text-xs ${getStatusBadgeColor(product.status)}`}
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="active">Active</SelectItem>
                              <SelectItem value="draft">Draft</SelectItem>
                              <SelectItem value="archived">Archived</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setManagingImagesProduct({
                                id: product._id,
                                title: product.title,
                                images: product.images,
                              })}
                              title="Manage Images"
                            >
                              <ImagesIcon className="size-3" />
                            </Button>
                            <Link to={`/admin/products/${product._id}`}>
                              <Button size="sm" variant="outline">
                                <EditIcon className="size-3" />
                              </Button>
                            </Link>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDelete(product._id)}
                              className="text-destructive hover:text-destructive"
                            >
                              <TrashIcon className="size-3" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
        </TabsContent>

        <TabsContent value="rolls" className="space-y-6">
          <RollsManagement />
        </TabsContent>
      </Tabs>

      {/* Image Preview Dialog */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Product Image</DialogTitle>
          </DialogHeader>
          {selectedImage && (
            <div className="w-full">
              <img
                src={selectedImage}
                alt="Product preview"
                className="w-full h-auto rounded-lg"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Image Manager Dialog */}
      <Dialog open={!!managingImagesProduct} onOpenChange={() => setManagingImagesProduct(null)}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage Product Images</DialogTitle>
            <DialogDescription>
              {managingImagesProduct?.title}
            </DialogDescription>
          </DialogHeader>
          {managingImagesProduct && (
            <ImageManager
              productId={managingImagesProduct.id}
              images={managingImagesProduct.images}
              onImagesUpdate={(updatedImages) => {
                // Update the local state to reflect changes
                setManagingImagesProduct({
                  ...managingImagesProduct,
                  images: updatedImages,
                });
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Migration Report Dialog */}
      <Dialog open={showReportDialog} onOpenChange={setShowReportDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Import Report</DialogTitle>
            <DialogDescription>
              {migrationReport && (
                <>
                  Imported {migrationReport.successful} of {migrationReport.total} products from
                  Shopify
                  {migrationReport.skipped > 0 && ` (${migrationReport.skipped} skipped)`}
                  {migrationReport.failed > 0 && ` (${migrationReport.failed} failed)`}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {migrationReport && (
            <Tabs defaultValue="skipped" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="skipped" className="flex items-center gap-2">
                  <AlertCircleIcon className="size-4" />
                  Skipped ({migrationReport.skipped})
                </TabsTrigger>
                <TabsTrigger value="successful" className="flex items-center gap-2">
                  <CheckCircleIcon className="size-4" />
                  Imported ({migrationReport.successful})
                </TabsTrigger>
                <TabsTrigger value="failed" className="flex items-center gap-2">
                  <XCircleIcon className="size-4" />
                  Failed ({migrationReport.failed})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="skipped">
                <ScrollArea className="h-[400px] w-full rounded-md border p-4">
                  {migrationReport.skippedProducts.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">
                      No products were skipped
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {migrationReport.skippedProducts.map((product, idx) => (
                        <Card key={idx}>
                          <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                              <AlertCircleIcon className="size-5 text-yellow-500 mt-0.5 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <h4 className="font-semibold text-sm">{product.title}</h4>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {product.reason}
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>

              <TabsContent value="successful">
                <ScrollArea className="h-[400px] w-full rounded-md border p-4">
                  {migrationReport.successfulProducts.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">
                      No products were imported
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {migrationReport.successfulProducts.map((title, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-2 p-3 rounded-lg bg-muted/50"
                        >
                          <CheckCircleIcon className="size-4 text-green-500 flex-shrink-0" />
                          <span className="text-sm">{title}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>

              <TabsContent value="failed">
                <ScrollArea className="h-[400px] w-full rounded-md border p-4">
                  {migrationReport.failedProducts.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">
                      No products failed to import
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {migrationReport.failedProducts.map((product, idx) => (
                        <Card key={idx}>
                          <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                              <XCircleIcon className="size-5 text-red-500 mt-0.5 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <h4 className="font-semibold text-sm">{product.title}</h4>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {product.reason}
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* Bulk Price Edit Dialog */}
      <BulkPriceEditDialog
        open={showBulkPriceEdit}
        onOpenChange={setShowBulkPriceEdit}
        products={filteredProducts}
        selectedProductIds={selectedProducts}
      />
    </div>
  );
}

export default function AdminProductsPage() {
  return (
    <div className="min-h-screen bg-background">
      <AdminHeader />

      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <Unauthenticated>
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <PackageIcon />
              </EmptyMedia>
              <EmptyTitle>Please sign in to access admin</EmptyTitle>
              <EmptyDescription>
                You need to be logged in to manage products
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
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        </AuthLoading>
        <Authenticated>
          <AdminProductsPageInner />
        </Authenticated>
      </div>
    </div>
  );
}
