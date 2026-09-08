import { useQuery, useMutation } from "@/lib/firebase-hooks";
import { api } from "@/lib/firebase-api";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Link } from "react-router-dom";
import { PackageIcon, PlusIcon, EditIcon, TrashIcon, SearchIcon, SaveIcon, ImageIcon, UploadIcon, FileSpreadsheetIcon, ImagesIcon, MoreVerticalIcon, DollarSignIcon, ChevronDownIcon, ChevronUpIcon, ChevronRightIcon, ExternalLinkIcon, TagIcon, ArrowUpIcon, ArrowDownIcon, SlidersHorizontalIcon, XIcon, LayersIcon, CheckCircle2Icon, FileEditIcon } from "lucide-react";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Authenticated, Unauthenticated, AuthLoading } from "@/lib/firebase-hooks";
import { SignInButton } from "@/components/ui/signin.tsx";
import { AdminLayout } from "@/components/admin-layout.tsx";
import { toast } from "sonner";
import type { Id } from "@/lib/firebase-api";
import { useState, useMemo, useRef, useEffect, Fragment } from "react";
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
import { TagManagerDialog } from "./_components/tag-manager-dialog.tsx";

// Module refresh - Force recompilation v788


type StockLevel = { availableUnits: number; rNumber: string | null; designName: string | null } | undefined;

/** Units still cuttable from the roll. `null` R-number means the item isn't roll-based. */
function MaterialStock({ stock }: { stock: StockLevel }) {
  if (!stock) return <span className="text-sm text-muted-foreground">—</span>;
  if (stock.rNumber === null) return <span className="text-sm text-muted-foreground">N/A</span>;

  const { availableUnits } = stock;
  if (availableUnits >= 999999) {
    return <span className="text-sm text-muted-foreground">∞</span>;
  }

  const isOut = availableUnits === 0;
  const isLow = availableUnits > 0 && availableUnits <= 10;
  return (
    <div className="flex items-center gap-1.5">
      <span
        className={`text-sm font-medium tabular-nums ${
          isOut
            ? "text-rose-600 dark:text-rose-400"
            : isLow
              ? "text-amber-600 dark:text-amber-400"
              : "text-emerald-700 dark:text-emerald-400"
        }`}
      >
        {availableUnits}
      </span>
      {isOut && <Badge className="border-rose-200 bg-rose-100 px-1 py-0 text-[10px] text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300">Out</Badge>}
      {isLow && (
        <Badge className="border-amber-200 bg-amber-100 px-1 py-0 text-[10px] text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
          Low
        </Badge>
      )}
    </div>
  );
}

const STAT_TONES = {
  indigo: "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950/50 dark:text-indigo-300",
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300",
  amber: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300",
  sky: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/50 dark:text-sky-300",
} as const;

function StatPill({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: keyof typeof STAT_TONES;
}) {
  return (
    <div className={`flex items-center gap-2.5 rounded-xl border px-3.5 py-2 shadow-sm ${STAT_TONES[tone]}`}>
      <span className="opacity-80">{icon}</span>
      <div className="leading-tight">
        <div className="text-base font-semibold tabular-nums">{value.toLocaleString()}</div>
        <div className="text-[11px] font-medium uppercase tracking-wide opacity-70">{label}</div>
      </div>
    </div>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-20 shrink-0 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
        active
          ? "border-indigo-600 bg-indigo-600 text-white shadow-sm"
          : "border-border bg-card text-muted-foreground hover:border-indigo-400 hover:bg-indigo-50 hover:text-indigo-700 dark:hover:bg-indigo-950/40 dark:hover:text-indigo-300"
      }`}
    >
      {children}
    </button>
  );
}

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

  const cancel = () => {
    setEditValue(String(value));
    setIsEditing(false);
  };

  const handleSave = async () => {
    const raw = editValue.trim();

    // Clicking away without changing anything shouldn't cost a write.
    if (raw === String(value).trim()) {
      setIsEditing(false);
      return;
    }

    let update: Record<string, string | number>;
    if (type === "number") {
      const numValue = parseFloat(raw);
      if (isNaN(numValue) || numValue < 0) {
        toast.error(`Enter a valid ${field === "price" ? "price" : "quantity"}`);
        cancel();
        return;
      }
      update = { [field]: numValue };
    } else {
      if (!raw) {
        toast.error("SKU cannot be empty");
        cancel();
        return;
      }
      update = { sku: raw };
    }

    setIsSaving(true);
    try {
      await updateVariant({ variantId, ...update });
      toast.success(field === "sku" ? "SKU updated" : "Updated");
      setIsEditing(false);
    } catch (error) {
      // Surface what actually failed instead of a generic message.
      toast.error(error instanceof Error ? error.message : "Failed to update");
      cancel();
    } finally {
      setIsSaving(false);
    }
  };

  if (!isEditing) {
    return (
      <button
        onClick={() => {
          // Seed from the current value, not the one this cell mounted with —
          // the row may have changed under it (bulk price edit, another tab).
          setEditValue(String(value));
          setIsEditing(true);
        }}
        title="Click to edit"
        className="-mx-1.5 w-full rounded px-1.5 py-0.5 text-left text-sm transition-colors hover:bg-foreground/5 hover:ring-1 hover:ring-border"
      >
        {value === "" || value === null || value === undefined ? (
          <span className="text-muted-foreground">—</span>
        ) : type === "number" && field === "price" ? (
          <span className="font-medium tabular-nums text-emerald-700 dark:text-emerald-400">₹{value}</span>
        ) : type === "number" ? (
          <span className="tabular-nums">{value}</span>
        ) : (
          value
        )}
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
            cancel();
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
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [managingImagesProduct, setManagingImagesProduct] = useState<{id: Id<"products">; title: string; images: Array<{url: string; alt?: string}>} | null>(null);
  const [selectedProducts, setSelectedProducts] = useState<Array<Id<"products">>>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [skuLetterFilter, setSkuLetterFilter] = useState<"all" | "M" | "L" | "T" | "R">("all");
  const [skuSortOrder, setSkuSortOrder] = useState<"asc" | "desc">("asc");
  const [gadgetCategoryFilter, setGadgetCategoryFilter] = useState<string>("all");
  const [showBulkPriceEdit, setShowBulkPriceEdit] = useState(false);
  const [skuFilterCondition, setSkuFilterCondition] = useState<"starts-with" | "contains">("starts-with");
  const [skuFilterValue, setSkuFilterValue] = useState("");
  const [productNameCondition, setProductNameCondition] = useState<"starts-with" | "contains">("contains");
  const [productNameValue, setProductNameValue] = useState("");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "draft" | "archived">("all");
  const [expandedProducts, setExpandedProducts] = useState<Set<Id<"products">>>(new Set());

  // Tag manager state
  const [managingTagsProduct, setManagingTagsProduct] = useState<{
    id: Id<"products">;
    title: string;
    tags: string[];
  } | null>(null);

  // State for active tab
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  // Inventory sorting state
  const [inventorySortOrder, setInventorySortOrder] = useState<"asc" | "desc">("desc");
  const [activeSortColumn, setActiveSortColumn] = useState<"sku" | "inventory" | null>(null);

  // Backend sort option (for efficient sorting)
  const [backendSortBy, setBackendSortBy] = useState<"latest" | "oldest" | "title_asc" | "title_desc">("latest");

  // Queries and mutations
  const products = useQuery(api.products.getAllProductsBasic, { sortBy: backendSortBy });
  const collections = useQuery(api.collections.getAllCollections, {});
  const gadgetTypes = useQuery(api.gadgetTypes.list, {});
  // Both tabs need this: Rolls Management lists it, and the products table
  // shows a Material Stock column per row.
  const stockLevelsArray = useQuery(api.rollsManagement.getStockLevels, {});
  const exportData = useQuery(api.products.exportProductsForBulkEdit, 
    selectedProducts.length > 0 ? { productIds: selectedProducts } : "skip"
  );
  
  // Convert stock levels array to map for easy lookup
  const stockLevels = useMemo(() => {
    if (!stockLevelsArray) return null;
    const map: Record<string, typeof stockLevelsArray[0]> = {};
    for (const level of stockLevelsArray) {
      map[level.variantId] = level;
    }
    return map;
  }, [stockLevelsArray]);
  const deleteProduct = useMutation(api.products.deleteProduct);
  const updateProduct = useMutation(api.products.updateProduct);
  const deleteAllProducts = useMutation(api.products.deleteAllProducts);
  const bulkUpdateVariants = useMutation(api.products.bulkUpdateVariants);
  const cloneProduct = useMutation(api.products.cloneProduct);

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

  const handleClone = async (productId: Id<"products">) => {
    try {
      const clonedProductId = await cloneProduct({ productId });
      toast.success("Product cloned successfully! Redirecting to edit page...");
      // Use window.location to navigate to the cloned product
      window.location.href = `/backend-skinly/products/${clonedProductId}`;
    } catch (error) {
      toast.error("Failed to clone product");
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
        return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300";
      case "draft":
        return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-300";
      case "archived":
        return "border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400";
      default:
        return "";
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      // Select all products on current page
      setSelectedProducts((prev) => {
        const newSelection = new Set(prev);
        paginatedProducts.forEach((p) => newSelection.add(p._id));
        return Array.from(newSelection);
      });
    } else {
      // Deselect all products on current page
      setSelectedProducts((prev) => {
        const pageIds = new Set(paginatedProducts.map((p) => p._id));
        return prev.filter((id) => !pageIds.has(id));
      });
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


  // Handle column sort toggle
  const handleSortColumn = (column: "sku" | "inventory") => {
    if (activeSortColumn === column) {
      // Toggle order if same column
      if (column === "sku") {
        setSkuSortOrder(skuSortOrder === "asc" ? "desc" : "asc");
      } else {
        setInventorySortOrder(inventorySortOrder === "asc" ? "desc" : "asc");
      }
    } else {
      // Switch to new column
      setActiveSortColumn(column);
    }
  };

  const gadgetTypeNameById = useMemo(
    () => new Map<string, string>((gadgetTypes || []).map((g: any) => [g._id, g.name])),
    [gadgetTypes]
  );

  // Only offer categories that actually have products behind them.
  const gadgetCategoryOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const product of products || []) {
      const name = gadgetTypeNameById.get(product.gadgetTypeId);
      if (name) counts.set(name, (counts.get(name) || 0) + 1);
    }
    const options = (gadgetTypes || [])
      .filter((g: any) => counts.has(g.name))
      .map((g: any) => ({ value: g.name, label: g.displayName || g.name, count: counts.get(g.name)! }))
      .sort((a, b) => b.count - a.count);
    return [{ value: "all", label: "All", count: products?.length ?? 0 }, ...options];
  }, [products, gadgetTypes, gadgetTypeNameById]);

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
          product.variantSkus.some((sku) => sku.toLowerCase().includes(query))
        );
      });
    }

    // Apply SKU letter filter
    if (skuLetterFilter !== "all") {
      filtered = filtered.filter((product) => {
        return product.variantSkus.some((sku) => {
          const { letter } = parseSku(sku);
          return letter === skuLetterFilter;
        });
      });
    }

    // Apply gadget category filter. Products carry gadgetTypeId, so match on
    // that rather than guessing from the title — most skin titles never name
    // the device ("Rage Of Naruto PS 5 3D Finish Skin" is a phone skin).
    if (gadgetCategoryFilter !== "all") {
      filtered = filtered.filter(
        (product) => gadgetTypeNameById.get(product.gadgetTypeId) === gadgetCategoryFilter
      );
    }

    // Apply advanced SKU filter
    if (skuFilterValue.trim()) {
      const value = skuFilterValue.toLowerCase().trim();
      filtered = filtered.filter((product) => {
        return product.variantSkus.some((sku) => {
          const skuLower = sku.toLowerCase();
          if (skuFilterCondition === "starts-with") {
            return skuLower.startsWith(value);
          } else {
            return skuLower.includes(value);
          }
        });
      });
    }

    // Apply advanced product name filter
    if (productNameValue.trim()) {
      const value = productNameValue.toLowerCase().trim();
      filtered = filtered.filter((product) => {
        const title = product.title.toLowerCase();
        if (productNameCondition === "starts-with") {
          return title.startsWith(value);
        } else {
          return title.includes(value);
        }
      });
    }

    // Apply status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((product) => product.status === statusFilter);
    }

    // Sort based on active column
    const sorted = [...filtered].sort((a, b) => {
      if (activeSortColumn === "inventory") {
        // Sort by total inventory
        const diff = a.totalInventory - b.totalInventory;
        return inventorySortOrder === "asc" ? diff : -diff;
      } else if (activeSortColumn === "sku") {
        // Sort by SKU numeric value
        const aFirstSku = a.variantSkus[0];
        const bFirstSku = b.variantSkus[0];
        
        if (!aFirstSku || !bFirstSku) return 0;
        
        const aParsed = parseSku(aFirstSku);
        const bParsed = parseSku(bFirstSku);
        
        // Sort by number
        const diff = aParsed.number - bParsed.number;
        return skuSortOrder === "asc" ? diff : -diff;
      }
      
      // Default: no sorting if no active column
      return 0;
    });

    return sorted;
  }, [products, gadgetTypeNameById, searchQuery, skuLetterFilter, skuSortOrder, gadgetCategoryFilter, skuFilterValue, productNameValue, skuFilterCondition, productNameCondition, statusFilter, activeSortColumn, inventorySortOrder]);

  // Reset to page 1 whenever filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, skuLetterFilter, skuSortOrder, gadgetCategoryFilter, skuFilterValue, productNameValue, skuFilterCondition, productNameCondition, statusFilter, itemsPerPage]);

  // Paginate filtered products
  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredProducts.slice(startIndex, endIndex);
  }, [filteredProducts, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);

  const resetAllFilters = () => {
    setSkuLetterFilter("all");
    setSkuSortOrder("asc");
    setGadgetCategoryFilter("all");
    setSkuFilterValue("");
    setProductNameValue("");
    setStatusFilter("all");
    setActiveSortColumn(null);
    setInventorySortOrder("desc");
    setBackendSortBy("latest");
    setSearchQuery("");
  };

  // One removable chip per filter that is actually narrowing the list.
  const activeFilterChips = useMemo(() => {
    const chips: { label: string; clear: () => void }[] = [];
    if (searchQuery.trim()) chips.push({ label: `Search: "${searchQuery.trim()}"`, clear: () => setSearchQuery("") });
    if (statusFilter !== "all") chips.push({ label: `Status: ${statusFilter}`, clear: () => setStatusFilter("all") });
    if (gadgetCategoryFilter !== "all") {
      const label = gadgetCategoryOptions.find((c) => c.value === gadgetCategoryFilter)?.label ?? gadgetCategoryFilter;
      chips.push({ label: `Category: ${label}`, clear: () => setGadgetCategoryFilter("all") });
    }
    if (skuLetterFilter !== "all") chips.push({ label: `SKU prefix: ${skuLetterFilter}`, clear: () => setSkuLetterFilter("all") });
    if (skuFilterValue.trim()) {
      chips.push({
        label: `SKU ${skuFilterCondition === "starts-with" ? "starts with" : "contains"}: ${skuFilterValue.trim()}`,
        clear: () => setSkuFilterValue(""),
      });
    }
    if (productNameValue.trim()) {
      chips.push({
        label: `Name ${productNameCondition === "starts-with" ? "starts with" : "contains"}: ${productNameValue.trim()}`,
        clear: () => setProductNameValue(""),
      });
    }
    return chips;
  }, [searchQuery, statusFilter, gadgetCategoryFilter, skuLetterFilter, skuFilterValue, skuFilterCondition, productNameValue, productNameCondition]);

  const activeFilterCount = activeFilterChips.length;

  // Headline counts, computed off the unfiltered list so they stay stable.
  const stats = useMemo(() => {
    if (!products) return { total: 0, active: 0, draft: 0, variants: 0 };
    return {
      total: products.length,
      active: products.filter((p) => p.status === "active").length,
      draft: products.filter((p) => p.status === "draft").length,
      variants: products.reduce((sum, p) => sum + (p.variantCount || 0), 0),
    };
  }, [products]);

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
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Products</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your product catalog and vinyl rolls inventory
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatPill icon={<PackageIcon className="size-4" />} label="Products" value={stats.total} tone="indigo" />
          <StatPill icon={<CheckCircle2Icon className="size-4" />} label="Active" value={stats.active} tone="emerald" />
          <StatPill icon={<FileEditIcon className="size-4" />} label="Draft" value={stats.draft} tone="amber" />
          <StatPill icon={<LayersIcon className="size-4" />} label="Variants" value={stats.variants} tone="sky" />
        </div>
      </div>

      <Tabs defaultValue="products" className="space-y-6">
        <TabsList>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="rolls">Rolls Management</TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="space-y-4">
          {/* Toolbar: search, sort, filter toggle, and the primary actions */}
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-1 items-center gap-2 min-w-0">
              <div className="relative flex-1 min-w-0 max-w-md">
                <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search by title, SKU, tag..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9 bg-card"
                />
              </div>
              <Select value={backendSortBy} onValueChange={(v) => setBackendSortBy(v as typeof backendSortBy)}>
                <SelectTrigger className="h-9 w-40 bg-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="latest">Newest first</SelectItem>
                  <SelectItem value="oldest">Oldest first</SelectItem>
                  <SelectItem value="title_asc">Title A–Z</SelectItem>
                  <SelectItem value="title_desc">Title Z–A</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                className={`h-9 shrink-0 ${
                  showAdvancedFilters || activeFilterCount > 0
                    ? "border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 hover:text-indigo-800 dark:border-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300"
                    : ""
                }`}
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              >
                <SlidersHorizontalIcon className="size-4 mr-2" />
                Filters
                {activeFilterCount > 0 && (
                  <Badge className="ml-2 h-5 min-w-5 justify-center bg-indigo-600 px-1 text-[11px] text-white">
                    {activeFilterCount}
                  </Badge>
                )}
              </Button>
            </div>

            <div className="flex items-center gap-2">
              {products.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9">
                      <MoreVerticalIcon className="size-4 mr-2" />
                      Bulk actions
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setShowBulkPriceEdit(true)}>
                      <DollarSignIcon className="size-4 mr-2" />
                      Bulk edit prices
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={handleClearAll}
                      disabled={isDeleting}
                      className="text-destructive focus:text-destructive"
                    >
                      <TrashIcon className="size-4 mr-2" />
                      {isDeleting ? "Clearing..." : "Delete all products"}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              <Link to="/backend-skinly/products/bulk">
                <Button variant="outline" size="sm" className="h-9">
                  <FileSpreadsheetIcon className="size-4 mr-2" />
                  Bulk create
                </Button>
              </Link>
              <Link to="/backend-skinly/products/new">
                <Button size="sm" className="h-9">
                  <PlusIcon className="size-4 mr-2" />
                  Add product
                </Button>
              </Link>
            </div>
          </div>

          {/* Filter panel */}
          {showAdvancedFilters && products.length > 0 && (
            <Card className="border-dashed border-indigo-200 bg-indigo-50/30 dark:border-indigo-900 dark:bg-indigo-950/20">
              <CardContent className="p-4 space-y-4">
                <FilterRow label="Status">
                  {(["all", "active", "draft", "archived"] as const).map((v) => (
                    <FilterChip key={v} active={statusFilter === v} onClick={() => setStatusFilter(v)}>
                      {v === "all" ? "All" : v.charAt(0).toUpperCase() + v.slice(1)}
                    </FilterChip>
                  ))}
                </FilterRow>

                <FilterRow label="Category">
                  {gadgetCategoryOptions.map(({ value, label, count }) => (
                    <FilterChip
                      key={value}
                      active={gadgetCategoryFilter === value}
                      onClick={() => setGadgetCategoryFilter(value)}
                    >
                      {label}
                      <span className="ml-1.5 opacity-60 tabular-nums">{count}</span>
                    </FilterChip>
                  ))}
                </FilterRow>

                <FilterRow label="SKU prefix">
                  {(["all", "M", "L", "T", "R"] as const).map((v) => (
                    <FilterChip key={v} active={skuLetterFilter === v} onClick={() => setSkuLetterFilter(v)}>
                      {v === "all" ? "All" : v}
                    </FilterChip>
                  ))}
                </FilterRow>

                <div className="grid gap-3 sm:grid-cols-2 pt-1">
                  <div className="flex items-center gap-2">
                    <Select value={skuFilterCondition} onValueChange={(v) => setSkuFilterCondition(v as "starts-with" | "contains")}>
                      <SelectTrigger className="h-9 w-36 shrink-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="starts-with">SKU starts</SelectItem>
                        <SelectItem value="contains">SKU contains</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      placeholder="e.g. M-102"
                      value={skuFilterValue}
                      onChange={(e) => setSkuFilterValue(e.target.value)}
                      className="h-9"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Select value={productNameCondition} onValueChange={(v) => setProductNameCondition(v as "starts-with" | "contains")}>
                      <SelectTrigger className="h-9 w-36 shrink-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="starts-with">Name starts</SelectItem>
                        <SelectItem value="contains">Name contains</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      placeholder="e.g. Aurora"
                      value={productNameValue}
                      onChange={(e) => setProductNameValue(e.target.value)}
                      className="h-9"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Result count, active filters, and the selection action bar */}
          <div className="flex flex-wrap items-center gap-2 min-h-9">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{filteredProducts.length.toLocaleString()}</span>
              {filteredProducts.length !== products.length && ` of ${products.length.toLocaleString()}`}
              {" "}products
            </p>

            {activeFilterChips.map((chip) => (
              <Badge
                key={chip.label}
                className="gap-1 border-indigo-200 bg-indigo-50 pl-2 pr-1 font-normal text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950/50 dark:text-indigo-300"
              >
                {chip.label}
                <button
                  onClick={chip.clear}
                  className="rounded-sm p-0.5 hover:bg-indigo-200/60 dark:hover:bg-indigo-800/60"
                  aria-label={`Clear ${chip.label}`}
                >
                  <XIcon className="size-3" />
                </button>
              </Badge>
            ))}
            {activeFilterCount > 0 && (
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={resetAllFilters}>
                Clear all
              </Button>
            )}

            {selectedProducts.length > 0 && (
              <div className="ml-auto flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 shadow-sm dark:border-indigo-800 dark:bg-indigo-950/50">
                <span className="text-sm font-medium text-indigo-700 dark:text-indigo-300">{selectedProducts.length} selected</span>
                <div className="h-4 w-px bg-indigo-300 dark:bg-indigo-700" />
                <Button size="sm" variant="ghost" className="h-7" onClick={handleExport} disabled={isExporting}>
                  <FileSpreadsheetIcon className="size-3.5 mr-1.5" />
                  {isExporting ? "Exporting..." : "Export"}
                </Button>
                <Button size="sm" variant="ghost" className="h-7" onClick={handleImport} disabled={isImporting}>
                  <UploadIcon className="size-3.5 mr-1.5" />
                  {isImporting ? "Importing..." : "Import"}
                </Button>
                <Button size="sm" variant="ghost" className="h-7" onClick={() => setSelectedProducts([])}>
                  <XIcon className="size-3.5" />
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>
            )}
          </div>
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
            <Link to="/backend-skinly/products/new">
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
        <Card className="overflow-hidden py-0">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full border-separate border-spacing-0">
                <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-900/80 backdrop-blur">
                  <tr>
                    <th className="border-b border-slate-200 dark:border-slate-800 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400 w-12">
                      <Checkbox
                        checked={paginatedProducts.length > 0 && paginatedProducts.every((p) => selectedProducts.includes(p._id))}
                        onCheckedChange={handleSelectAll}
                      />
                    </th>
                    <th className="border-b border-slate-200 dark:border-slate-800 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400 w-16">Image</th>
                    <th className="border-b border-slate-200 dark:border-slate-800 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">Product Name</th>
                    <th className="border-b border-slate-200 dark:border-slate-800 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400 w-32">
                      <button
                        onClick={() => handleSortColumn("sku")}
                        className="flex items-center gap-1 hover:text-foreground transition-colors"
                      >
                        <span>SKU</span>
                        {activeSortColumn === "sku" ? (
                          skuSortOrder === "asc" ? (
                            <ArrowUpIcon className="size-4" />
                          ) : (
                            <ArrowDownIcon className="size-4" />
                          )
                        ) : (
                          <div className="size-4 flex flex-col items-center justify-center opacity-40">
                            <ChevronUpIcon className="size-3 -mb-1" />
                            <ChevronDownIcon className="size-3 -mt-1" />
                          </div>
                        )}
                      </button>
                    </th>
                    <th className="border-b border-slate-200 dark:border-slate-800 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400 w-28">Price</th>
                    <th className="border-b border-slate-200 dark:border-slate-800 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400 w-24">
                      <button
                        onClick={() => handleSortColumn("inventory")}
                        className="flex items-center gap-1 hover:text-foreground transition-colors"
                      >
                        <span>Inventory</span>
                        {activeSortColumn === "inventory" ? (
                          inventorySortOrder === "asc" ? (
                            <ArrowUpIcon className="size-4" />
                          ) : (
                            <ArrowDownIcon className="size-4" />
                          )
                        ) : (
                          <div className="size-4 flex flex-col items-center justify-center opacity-40">
                            <ChevronUpIcon className="size-3 -mb-1" />
                            <ChevronDownIcon className="size-3 -mt-1" />
                          </div>
                        )}
                      </button>
                    </th>
                    <th className="border-b border-slate-200 dark:border-slate-800 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400 w-28">Material Stock</th>
                    <th className="border-b border-slate-200 dark:border-slate-800 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400 w-32">Collection</th>
                    <th className="border-b border-slate-200 dark:border-slate-800 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400 w-32">Tags</th>
                    <th className="border-b border-slate-200 dark:border-slate-800 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400 w-28">Status</th>
                    <th className="border-b border-slate-200 dark:border-slate-800 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400 w-40">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedProducts.map((product) => {
                    const firstVariant = product.firstVariant;
                    const totalInventory = product.totalInventory;
                    const productCollections = (product.collectionIds || [])
                      .map((id: string) => collectionsMap.get(id))
                      .filter(Boolean);
                    const isSelected = selectedProducts.includes(product._id);

                    const isExpanded = expandedProducts.has(product._id);
                    const hasMultipleVariants = product.variantCount > 1;

                    return (
                      <Fragment key={product._id}>
                      <tr
                        className={`group transition-colors ${
                          isSelected
                            ? "bg-indigo-50/80 dark:bg-indigo-950/30"
                            : "odd:bg-slate-50/60 dark:odd:bg-slate-900/20"
                        } hover:bg-indigo-50 dark:hover:bg-indigo-950/40`}
                      >
                        <td className="border-b px-3 py-2.5 align-middle">
                          <div className="flex items-center gap-2">
                            {hasMultipleVariants ? (
                              <button
                                onClick={() => {
                                  const newExpanded = new Set(expandedProducts);
                                  if (isExpanded) {
                                    newExpanded.delete(product._id);
                                  } else {
                                    newExpanded.add(product._id);
                                  }
                                  setExpandedProducts(newExpanded);
                                }}
                                className="p-0.5 hover:bg-muted rounded"
                              >
                                {isExpanded ? (
                                  <ChevronDownIcon className="size-4 text-muted-foreground" />
                                ) : (
                                  <ChevronRightIcon className="size-4 text-muted-foreground" />
                                )}
                              </button>
                            ) : (
                              <div className="size-5" />
                            )}
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={(checked) => handleSelectProduct(product._id, !!checked)}
                            />
                          </div>
                        </td>
                        <td className="border-b px-3 py-2.5 align-middle">
                          <div className="relative">
                            {product.images.length > 0 ? (
                              <button
                                onClick={() => setSelectedImage(product.images[0].url)}
                                className="size-11 bg-muted rounded-md overflow-hidden ring-1 ring-border hover:ring-2 hover:ring-primary transition-all"
                              >
                                <img
                                  src={product.images[0].url}
                                  alt={product.images[0].alt || product.title}
                                  className="w-full h-full object-cover"
                                />
                              </button>
                            ) : (
                              <div className="size-11 bg-muted rounded-md ring-1 ring-border flex items-center justify-center">
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
                        <td className="border-b px-3 py-2.5 align-middle max-w-[280px]">
                          <div className="min-w-0">
                            <Link
                              to={`/backend-skinly/products/${product._id}`}
                              className="block truncate font-medium text-slate-900 dark:text-slate-100 hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline underline-offset-2"
                              title={product.title}
                            >
                              {product.title}
                            </Link>
                            <p className="text-xs text-muted-foreground truncate">
                              {product.variantCount > 1 && `${product.variantCount} variants · `}
                              /{product.slug}
                            </p>
                          </div>
                        </td>
                        <td className="border-b px-3 py-2.5 align-middle">
                          {firstVariant ? (
                            <div>
                              <EditableCell
                                variantId={firstVariant._id}
                                value={firstVariant.sku}
                                type="text"
                                field="sku"
                              />

                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </td>
                        <td className="border-b px-3 py-2.5 align-middle">
                          {firstVariant ? (
                            <div>
                              <EditableCell
                                variantId={firstVariant._id}
                                value={firstVariant.price}
                                type="number"
                                field="price"
                              />

                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </td>
                        <td className="border-b px-3 py-2.5 align-middle">
                          {firstVariant ? (
                            <div>
                              <EditableCell
                                variantId={firstVariant._id}
                                value={firstVariant.inventoryQuantity}
                                type="number"
                                field="inventoryQuantity"
                              />
                              {product.variantCount > 1 && (
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {totalInventory} total
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </td>
                        <td className="border-b px-3 py-2.5 align-middle">
                          <MaterialStock stock={firstVariant ? stockLevels?.[firstVariant._id] : undefined} />
                        </td>
                        <td className="border-b px-3 py-2.5 align-middle">
                          {productCollections.length > 0 ? (
                            <div
                              className="flex items-center gap-1"
                              title={productCollections.map((c: any) => c.name).join(", ")}
                            >
                              {productCollections.slice(0, 1).map((c: any) => (
                                <Badge
                                  key={c._id}
                                  className="max-w-[112px] truncate border-violet-200 bg-violet-50 text-xs font-normal text-violet-700 dark:border-violet-900 dark:bg-violet-950/50 dark:text-violet-300"
                                >
                                  {c.name}
                                </Badge>
                              ))}
                              {productCollections.length > 1 && (
                                <Badge
                                  variant="outline"
                                  className="shrink-0 border-violet-200 text-xs font-normal text-violet-600 dark:border-violet-900 dark:text-violet-400"
                                >
                                  +{productCollections.length - 1}
                                </Badge>
                              )}
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="border-b px-3 py-2.5 align-middle">
                          <div className="flex items-center gap-2">
                            {product.tags.length > 0 ? (
                              <div className="flex items-center gap-1" title={product.tags.join(", ")}>
                                {product.tags.slice(0, 1).map((tag) => (
                                  <Badge
                                    key={tag}
                                    className="max-w-[112px] truncate border-sky-200 bg-sky-50 text-xs font-normal text-sky-700 dark:border-sky-900 dark:bg-sky-950/50 dark:text-sky-300"
                                  >
                                    {tag}
                                  </Badge>
                                ))}
                                {product.tags.length > 1 && (
                                  <Badge
                                    variant="outline"
                                    className="shrink-0 border-sky-200 text-xs font-normal text-sky-600 dark:border-sky-900 dark:text-sky-400"
                                  >
                                    +{product.tags.length - 1}
                                  </Badge>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">No tags</span>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setManagingTagsProduct({
                                id: product._id,
                                title: product.title,
                                tags: product.tags,
                              })}
                              title="Manage Tags"
                              className="h-6 w-6 p-0"
                            >
                              <TagIcon className="size-3" />
                            </Button>
                          </div>
                        </td>
                        <td className="border-b px-3 py-2.5 align-middle">
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
                        <td className="border-b px-3 py-2.5 align-middle">
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => window.open(`https://goskinly.com/${product.slug}`, '_blank')}
                              title="View Product on Live Site"
                            >
                              <ExternalLinkIcon className="size-3" />
                            </Button>
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
                            <Link to={`/backend-skinly/products/${product._id}`}>
                              <Button size="sm" variant="outline" title="Edit Product">
                                <EditIcon className="size-3" />
                              </Button>
                            </Link>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button size="sm" variant="outline" title="More Actions">
                                  <MoreVerticalIcon className="size-3" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleClone(product._id)}>
                                  <SaveIcon className="size-4 mr-2" />
                                  Clone Product
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleDelete(product._id)}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <TrashIcon className="size-4 mr-2" />
                                  Delete Product
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </td>
                      </tr>

                      {/* Variant breakdown, opened from the chevron */}
                      {isExpanded && product.variants.map((variant: any) => {
                        const stock = stockLevels?.[variant._id];
                        return (
                          <tr key={variant._id} className="bg-indigo-50/40 text-sm dark:bg-indigo-950/20">
                            <td className="border-b px-3 py-2" />
                            <td className="border-b px-3 py-2" />
                            <td className="border-b px-3 py-2 text-muted-foreground">
                              <span className="inline-flex items-center gap-2">
                                <span className="text-muted-foreground/60">└</span>
                                {variant.title || "Default"}
                              </span>
                            </td>
                            <td className="border-b px-3 py-2">
                              <EditableCell variantId={variant._id} value={variant.sku ?? ""} type="text" field="sku" />
                            </td>
                            <td className="border-b px-3 py-2">
                              <EditableCell variantId={variant._id} value={variant.price ?? 0} type="number" field="price" />
                            </td>
                            <td className="border-b px-3 py-2">
                              <EditableCell
                                variantId={variant._id}
                                value={variant.inventoryQuantity ?? 0}
                                type="number"
                                field="inventoryQuantity"
                              />
                            </td>
                            <td className="border-b px-3 py-2">
                              <MaterialStock stock={stock} />
                            </td>
                            <td className="border-b px-3 py-2" colSpan={4}>
                              {variant.rNumber && (
                                <span className="text-xs text-muted-foreground">Roll {variant.rNumber}</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pagination Controls */}
      {filteredProducts.length > itemsPerPage && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <p className="text-sm text-muted-foreground">
              {((currentPage - 1) * itemsPerPage) + 1}–{Math.min(currentPage * itemsPerPage, filteredProducts.length)} of {filteredProducts.length.toLocaleString()}
            </p>
            <Select value={String(itemsPerPage)} onValueChange={(v) => { setItemsPerPage(Number(v)); setCurrentPage(1); }}>
              <SelectTrigger className="h-8 w-28 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="25">25 / page</SelectItem>
                <SelectItem value="50">50 / page</SelectItem>
                <SelectItem value="100">100 / page</SelectItem>
                <SelectItem value="200">200 / page</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                // Show first 3, last 2, or pages around current
                let pageNum: number;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                
                return (
                  <Button
                    key={pageNum}
                    variant={currentPage === pageNum ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCurrentPage(pageNum)}
                    className="min-w-9"
                  >
                    {pageNum}
                  </Button>
                );
              })}
              {totalPages > 5 && currentPage < totalPages - 2 && (
                <>
                  <span className="px-2 text-muted-foreground">...</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(totalPages)}
                    className="min-w-9"
                  >
                    {totalPages}
                  </Button>
                </>
              )}
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
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


      {/* Bulk Price Edit Dialog - Temporarily disabled (needs full product data with variants) 
      <BulkPriceEditDialog
        open={showBulkPriceEdit}
        onOpenChange={setShowBulkPriceEdit}
        products={[]}
        selectedProductIds={selectedProducts}
      /> */}

      {/* Tag Manager Dialog */}
      {managingTagsProduct && (
        <TagManagerDialog
          open={!!managingTagsProduct}
          onOpenChange={(open) => !open && setManagingTagsProduct(null)}
          productId={managingTagsProduct.id}
          productTitle={managingTagsProduct.title}
          currentTags={managingTagsProduct.tags}
        />
      )}
    </div>
  );
}

export default function AdminProductsPage() {
  return (
    <AdminLayout>
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
    </AdminLayout>
  );
}
