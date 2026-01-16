import { useMutation, useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import { Link, useNavigate } from "react-router-dom";
import { PackageIcon, PlusIcon, TrashIcon, ChevronLeftIcon, SparklesIcon, ImageIcon } from "lucide-react";
import { ProductImageUploader } from "../_components/product-image-uploader.tsx";
import { AdminLayout } from "@/components/admin-layout.tsx";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { SignInButton } from "@/components/ui/signin.tsx";
import { toast } from "sonner";
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty.tsx";
import type { Id } from "@/convex/_generated/dataModel.d.ts";

interface Variant {
  sku: string;
  title: string;
  price: string;
  compareAtPrice?: string;
  inventoryQuantity: string;
  consumptionPresetId?: string;
  customMultiplier?: string;
}

function NewProductPageInner() {
  const navigate = useNavigate();
  const collections = useQuery(api.collections.getAllCollections, {});
  const finishTypes = useQuery(api.finishTypes.listActive, {});
  const gadgetTypes = useQuery(api.gadgetTypes.listActive, {});
  const productCategories = useQuery(api.productCategories.listActive, {});
  const createProduct = useMutation(api.products.createProduct);
  const createVariant = useMutation(api.products.createVariant);
  const generateSEO = useAction(api.seoProductGenerator.generateSEOFromFormData);

  const [formData, setFormData] = useState<{
    title: string;
    slug: string;
    description: string;
    metaDescription: string;
    metaTitle: string;
    collectionId: Id<"collections"> | "";
    status: "active" | "draft" | "archived";
    images: Array<{ url: string; alt: string }>;
    tags: string;
    gadgetCategory: "phone" | "laptop" | "tablet" | "camera" | "lens" | "drone" | "charger" | "console" | "mac-mini" | "cover" | "accessory";
    gadgetTypeId: Id<"gadgetTypes"> | "";
    finishTypeId: Id<"finishTypes"> | "";
    productCategory: string;
    length: string;
    breadth: string;
    height: string;
    weight: string;
    productType: "physical" | "digital";
    hasMultipleVariants: boolean;
  }>({
    title: "",
    slug: "",
    description: "",
    metaDescription: "",
    metaTitle: "",
    collectionId: "",
    status: "active",
    images: [{ url: "", alt: "" }],
    tags: "",
    gadgetCategory: "phone", // Default to phone
    gadgetTypeId: "",
    finishTypeId: "",
    productCategory: "",
    length: "10",
    breadth: "10",
    height: "2",
    weight: "100",
    productType: "physical",
    hasMultipleVariants: false, // Default to single variant
  });

  const [variants, setVariants] = useState<Variant[]>([
    { sku: "", title: "Default", price: "", compareAtPrice: "", inventoryQuantity: "0", consumptionPresetId: "", customMultiplier: "" },
  ]);

  // Get presets for selected gadget type
  const variantPresets = useQuery(
    api.variantConsumptionPresets.listByGadgetType,
    formData.gadgetTypeId ? { gadgetTypeId: formData.gadgetTypeId as Id<"gadgetTypes"> } : "skip"
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingSEO, setIsGeneratingSEO] = useState(false);
  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(false);

  // Generate slug from title
  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "") // Remove special characters
      .replace(/\s+/g, "-") // Replace spaces with hyphens
      .replace(/-+/g, "-") // Replace multiple hyphens with single
      .replace(/^-|-$/g, ""); // Remove leading/trailing hyphens
  };

  // Handle title change - auto-update slug if not manually edited
  const handleTitleChange = (newTitle: string) => {
    setFormData(prev => ({
      ...prev,
      title: newTitle,
      // Only auto-update slug if it hasn't been manually edited
      slug: isSlugManuallyEdited ? prev.slug : generateSlug(newTitle),
    }));
  };

  // Handle slug change - mark as manually edited
  const handleSlugChange = (newSlug: string) => {
    setIsSlugManuallyEdited(true);
    setFormData(prev => ({ ...prev, slug: newSlug }));
  };

  // Get selected finish type display name
  const selectedFinishType = finishTypes?.find(f => f._id === formData.finishTypeId);

  // Default logo image URL for products without images
  const DEFAULT_LOGO_IMAGE = "https://res.cloudinary.com/dcpjatdxs/image/upload/v1767710585/products/abstract-art-multi/img_2_1767710584949.webp";

  const handleGenerateSEO = async () => {
    if (!formData.title.trim()) {
      toast.error("Please enter a product title first");
      return;
    }

    setIsGeneratingSEO(true);
    try {
      const result = await generateSEO({
        title: formData.title,
        gadgetCategory: formData.gadgetCategory,
        finishType: selectedFinishType?.displayName,
      });

      // Update form with generated SEO content including slug and image alt
      setFormData(prev => ({
        ...prev,
        metaTitle: result.metaTitle,
        description: result.description,
        metaDescription: result.metaDescription,
        tags: result.tags.join(", "),
        slug: result.slug,
        // Update first image alt text, or add default image with alt if no images
        images: prev.images.length > 0 && prev.images[0].url
          ? prev.images.map((img, i) => i === 0 ? { ...img, alt: result.imageAlt } : img)
          : [{ url: DEFAULT_LOGO_IMAGE, alt: result.imageAlt }],
      }));

      toast.success("SEO content generated successfully!");
    } catch (error: any) {
      toast.error(error.message || "Failed to generate SEO content");
    } finally {
      setIsGeneratingSEO(false);
    }
  };

  const addVariant = () => {
    setVariants([...variants, { sku: "", title: "", price: "", compareAtPrice: "", inventoryQuantity: "0", consumptionPresetId: "", customMultiplier: "" }]);
  };

  const removeVariant = (index: number) => {
    setVariants(variants.filter((_, i) => i !== index));
  };

  const updateVariant = (index: number, field: keyof Variant, value: string) => {
    const newVariants = [...variants];
    newVariants[index][field] = value;
    setVariants(newVariants);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Validate
      if (formData.images.filter((img) => img.url).length === 0) {
        toast.error("Please add at least one product image");
        setIsSubmitting(false);
        return;
      }

      if (variants.some((v) => !v.sku || !v.price)) {
        toast.error("All variants must have SKU and price");
        setIsSubmitting(false);
        return;
      }

      // Create product
      const productId = await createProduct({
        title: formData.title,
        slug: formData.slug,
        description: formData.description,
        metaDescription: formData.metaDescription || undefined,
        metaTitle: formData.metaTitle || undefined,
        collectionId: formData.collectionId ? (formData.collectionId as Id<"collections">) : undefined,
        status: formData.status,
        images: formData.images.filter((img) => img.url),
        tags: formData.tags.split(",").map((t) => t.trim()).filter((t) => t),
        gadgetCategory: formData.gadgetCategory,
        gadgetTypeId: formData.gadgetTypeId ? (formData.gadgetTypeId as Id<"gadgetTypes">) : undefined,
        finishTypeId: formData.finishTypeId ? (formData.finishTypeId as Id<"finishTypes">) : undefined,
        productCategory: formData.productCategory || undefined,
        length: formData.length ? parseFloat(formData.length) : undefined,
        breadth: formData.breadth ? parseFloat(formData.breadth) : undefined,
        height: formData.height ? parseFloat(formData.height) : undefined,
        weight: formData.weight ? parseFloat(formData.weight) : undefined,
        productType: formData.productType,
        hasMultipleVariants: formData.hasMultipleVariants,
      });

      // Create variants
      for (let i = 0; i < variants.length; i++) {
        const variant = variants[i];
        await createVariant({
          productId,
          sku: variant.sku,
          title: variant.title,
          price: parseFloat(variant.price),
          compareAtPrice: variant.compareAtPrice ? parseFloat(variant.compareAtPrice) : undefined,
          inventoryQuantity: parseInt(variant.inventoryQuantity),
          isDefaultVariant: !formData.hasMultipleVariants && i === 0,
          consumptionPresetId: variant.consumptionPresetId ? (variant.consumptionPresetId as Id<"variantConsumptionPresets">) : undefined,
          customMultiplier: variant.customMultiplier ? parseFloat(variant.customMultiplier) : undefined,
        });
      }

      toast.success("Product created successfully");
      navigate("/backend-skinly/products");
    } catch (error) {
      toast.error("Failed to create product");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (collections === undefined || gadgetTypes === undefined || finishTypes === undefined) {
    return <Skeleton className="h-screen w-full" />;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/backend-skinly/products">
            <Button type="button" variant="ghost" size="sm">
              <ChevronLeftIcon className="size-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Create Product</h1>
            <p className="text-muted-foreground">Add a new product to your catalog</p>
          </div>
        </div>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Creating..." : "Create Product"}
        </Button>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="title">Product Title</Label>
                <Input
                  id="title"
                  required
                  placeholder="Matte Black Phone Skin"
                  value={formData.title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="slug">Slug</Label>
                <Input
                  id="slug"
                  required
                  placeholder="matte-black-phone-skin"
                  value={formData.slug}
                  onChange={(e) => handleSlugChange(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {isSlugManuallyEdited ? "Custom slug" : "Auto-generated from title"}
                </p>
              </div>

              <div>
                <Label htmlFor="metaTitle">Meta Title (SEO)</Label>
                <div className="space-y-1">
                  <Input
                    id="metaTitle"
                    placeholder="SEO-optimized title (50-60 chars recommended)"
                    value={formData.metaTitle}
                    onChange={(e) => setFormData({ ...formData, metaTitle: e.target.value })}
                    maxLength={100}
                  />
                  <p className="text-xs text-muted-foreground">
                    {formData.metaTitle.length}/100 characters • Falls back to Product Title if empty
                  </p>
                </div>
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  required
                  placeholder="Detailed product description..."
                  rows={4}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="metaDescription">Meta Description (SEO)</Label>
                <Textarea
                  id="metaDescription"
                  placeholder="SEO-friendly description..."
                  rows={2}
                  value={formData.metaDescription}
                  onChange={(e) => setFormData({ ...formData, metaDescription: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="tags">Tags (comma-separated)</Label>
                <Input
                  id="tags"
                  placeholder="matte, black, premium"
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                />
              </div>
            </CardContent>
          </Card>

          {/* AI SEO Generator Card */}
          <Card className="border-dashed border-primary/30 bg-primary/5">
            <CardHeader>
              <div className="flex items-center gap-2">
                <SparklesIcon className="h-5 w-5 text-primary" />
                <CardTitle>AI SEO Content Generator</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Generate optimized SEO content including meta title, description, and tags using AI.
              </p>
              <Button
                type="button"
                onClick={handleGenerateSEO}
                disabled={isGeneratingSEO || !formData.title.trim()}
                variant="default"
                className="w-full"
              >
                <SparklesIcon className="h-4 w-4 mr-2" />
                {isGeneratingSEO ? "Generating..." : "Generate SEO Content with AI"}
              </Button>
              {!formData.title.trim() && (
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  Enter a product title first to generate SEO content
                </p>
              )}
            </CardContent>
          </Card>

          {/* Images */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ImageIcon className="size-5" />
                Product Images
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ProductImageUploader
                images={formData.images}
                onImagesChange={(images) => setFormData({ ...formData, images })}
                productSlug={formData.slug || formData.title}
              />
            </CardContent>
          </Card>

          {/* Variants */}
          <Card>
            <CardHeader>
              <CardTitle>Variants & Inventory</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Multiple Variants Toggle */}
              <div className="flex items-start space-x-3 p-4 bg-muted/50 rounded-lg">
                <Checkbox
                  id="hasMultipleVariants"
                  checked={formData.hasMultipleVariants}
                  onCheckedChange={(checked) => {
                    setFormData({ ...formData, hasMultipleVariants: checked === true });
                    // Reset variants when toggling
                    if (checked === false && variants.length > 1) {
                      setVariants([variants[0]]);
                    }
                  }}
                />
                <div className="grid gap-1.5 leading-none">
                  <Label
                    htmlFor="hasMultipleVariants"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    This product has multiple variants
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    {formData.hasMultipleVariants
                      ? "Multiple variants will be displayed with their variant titles (e.g., 'Red', 'Blue', 'Large')."
                      : "Only one variant with no variant title selection on product page."}
                  </p>
                </div>
              </div>

              {variants.map((variant, index) => (
                <div key={index} className="p-4 border rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Variant {index + 1}</h4>
                    {formData.hasMultipleVariants && variants.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeVariant(index)}
                      >
                        <TrashIcon className="size-4" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>SKU</Label>
                      <Input
                        required
                        placeholder="SKU-001"
                        value={variant.sku}
                        onChange={(e) => updateVariant(index, "sku", e.target.value)}
                      />
                    </div>
                    {formData.hasMultipleVariants && (
                      <div>
                        <Label>Variant Title</Label>
                        <Input
                          required={formData.hasMultipleVariants}
                          placeholder="e.g., Red, Blue, Large"
                          value={variant.title}
                          onChange={(e) => updateVariant(index, "title", e.target.value)}
                        />
                      </div>
                    )}
                    <div>
                      <Label>Price (₹)</Label>
                      <Input
                        required
                        type="number"
                        step="0.01"
                        placeholder="299"
                        value={variant.price}
                        onChange={(e) => updateVariant(index, "price", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Compare At Price (₹)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="399 (optional)"
                        value={variant.compareAtPrice}
                        onChange={(e) => updateVariant(index, "compareAtPrice", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Inventory</Label>
                      <Input
                        required
                        type="number"
                        placeholder="100"
                        value={variant.inventoryQuantity}
                        onChange={(e) => updateVariant(index, "inventoryQuantity", e.target.value)}
                      />
                    </div>
                  </div>
                  {/* Roll consumption settings */}
                  {formData.gadgetTypeId && (
                    <div className="pt-3 border-t space-y-3">
                      <h5 className="text-sm font-medium text-muted-foreground">Roll Consumption (Optional)</h5>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label>Consumption Preset</Label>
                          <Select
                            value={variant.consumptionPresetId || "none"}
                            onValueChange={(value) => updateVariant(index, "consumptionPresetId", value === "none" ? "" : value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="None" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">None</SelectItem>
                              {variantPresets?.map((preset) => (
                                <SelectItem key={preset._id} value={preset._id}>
                                  {preset.name} ({preset.multiplier}x)
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground mt-1">
                            Preset multipliers for roll material
                          </p>
                        </div>
                        <div>
                          <Label>Custom Multiplier</Label>
                          <Input
                            type="number"
                            step="0.1"
                            min="0"
                            placeholder="e.g., 1.5"
                            value={variant.customMultiplier}
                            onChange={(e) => updateVariant(index, "customMultiplier", e.target.value)}
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Overrides preset if set
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {formData.hasMultipleVariants && (
                <Button type="button" variant="outline" size="sm" onClick={addVariant}>
                  <PlusIcon className="size-4 mr-2" />
                  Add Variant
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Organization</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value: "active" | "draft" | "archived") =>
                    setFormData({ ...formData, status: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="collection">Collection (Optional)</Label>
                {collections.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No collections yet.{" "}
                    <Link to="/backend-skinly/collections" className="text-primary underline">
                      Create one
                    </Link>
                  </p>
                ) : (
                  <Select
                    value={formData.collectionId || undefined}
                    onValueChange={(value) => setFormData({ ...formData, collectionId: value as Id<"collections"> })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select collection" />
                    </SelectTrigger>
                    <SelectContent>
                      {collections.map((collection) => (
                        <SelectItem key={collection._id} value={collection._id}>
                          {collection.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div>
                <Label htmlFor="productCategory">Product Category (Optional)</Label>
                <Select
                  value={formData.productCategory || undefined}
                  onValueChange={(value) => setFormData({ ...formData, productCategory: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select product category" />
                  </SelectTrigger>
                  <SelectContent>
                    {productCategories?.map((cat) => (
                      <SelectItem key={cat.slug} value={cat.slug}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="gadgetCategory">Gadget Category</Label>
                <Select
                  value={formData.gadgetCategory}
                  onValueChange={(value: typeof formData.gadgetCategory) =>
                    setFormData({ ...formData, gadgetCategory: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="phone">Phone</SelectItem>
                    <SelectItem value="laptop">Laptop</SelectItem>
                    <SelectItem value="tablet">Tablet</SelectItem>
                    <SelectItem value="camera">Camera</SelectItem>
                    <SelectItem value="lens">Lens</SelectItem>
                    <SelectItem value="drone">Drone</SelectItem>
                    <SelectItem value="charger">Charger</SelectItem>
                    <SelectItem value="console">Console</SelectItem>
                    <SelectItem value="mac-mini">Mac Mini</SelectItem>
                    <SelectItem value="cover">Cover</SelectItem>
                    <SelectItem value="accessory">Accessory</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="gadgetType">Gadget Type (Optional)</Label>
                {gadgetTypes === undefined ? (
                  <Skeleton className="h-10 w-full" />
                ) : gadgetTypes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No gadget types available
                  </p>
                ) : (
                  <Select
                    value={formData.gadgetTypeId || undefined}
                    onValueChange={(value) => setFormData({ ...formData, gadgetTypeId: value as Id<"gadgetTypes"> })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select gadget type" />
                    </SelectTrigger>
                    <SelectContent>
                      {gadgetTypes.map((gadgetType) => (
                        <SelectItem key={gadgetType._id} value={gadgetType._id}>
                          {gadgetType.displayName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  Required for variant consumption presets
                </p>
              </div>

              <div>
                <Label htmlFor="finishType">Finish Type (Optional)</Label>
                {finishTypes === undefined ? (
                  <Skeleton className="h-10 w-full" />
                ) : finishTypes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No finish types available
                  </p>
                ) : (
                  <Select
                    value={formData.finishTypeId || undefined}
                    onValueChange={(value) => setFormData({ ...formData, finishTypeId: value as Id<"finishTypes"> })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select finish type" />
                    </SelectTrigger>
                    <SelectContent>
                      {finishTypes.map((finish) => (
                        <SelectItem key={finish._id} value={finish._id}>
                          {finish.displayName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Shipping Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="productType">Product Type</Label>
                <Select
                  value={formData.productType}
                  onValueChange={(value: "physical" | "digital") =>
                    setFormData({ ...formData, productType: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="physical">Physical</SelectItem>
                    <SelectItem value="digital">Digital</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label htmlFor="length">Length</Label>
                  <div className="flex items-center gap-1">
                    <Input
                      id="length"
                      type="number"
                      step="0.1"
                      min="0"
                      required
                      value={formData.length}
                      onChange={(e) => setFormData({ ...formData, length: e.target.value })}
                      className="text-sm"
                    />
                    <span className="text-xs text-muted-foreground whitespace-nowrap">cm</span>
                  </div>
                </div>
                <div>
                  <Label htmlFor="breadth">Breadth</Label>
                  <div className="flex items-center gap-1">
                    <Input
                      id="breadth"
                      type="number"
                      step="0.1"
                      min="0"
                      required
                      value={formData.breadth}
                      onChange={(e) => setFormData({ ...formData, breadth: e.target.value })}
                      className="text-sm"
                    />
                    <span className="text-xs text-muted-foreground whitespace-nowrap">cm</span>
                  </div>
                </div>
                <div>
                  <Label htmlFor="height">Height</Label>
                  <div className="flex items-center gap-1">
                    <Input
                      id="height"
                      type="number"
                      step="0.1"
                      min="0"
                      required
                      value={formData.height}
                      onChange={(e) => setFormData({ ...formData, height: e.target.value })}
                      className="text-sm"
                    />
                    <span className="text-xs text-muted-foreground whitespace-nowrap">cm</span>
                  </div>
                </div>
              </div>

              <div>
                <Label htmlFor="weight">Weight</Label>
                <div className="flex items-center gap-1">
                  <Input
                    id="weight"
                    type="number"
                    step="1"
                    min="0"
                    required
                    value={formData.weight}
                    onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                  />
                  <span className="text-xs text-muted-foreground whitespace-nowrap">grams</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Used for calculating shipping costs
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </form>
  );
}

export default function NewProductPage() {
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
                You need to be logged in to create products
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <SignInButton />
            </EmptyContent>
          </Empty>
        </Unauthenticated>
        <AuthLoading>
          <Skeleton className="h-screen w-full" />
        </AuthLoading>
        <Authenticated>
          <NewProductPageInner />
      </Authenticated>
    </AdminLayout>
  );
}
