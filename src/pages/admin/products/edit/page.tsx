import { useMutation, useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import { Link, useNavigate, useParams } from "react-router-dom";
import { PackageIcon, PlusIcon, TrashIcon, ChevronLeftIcon, SaveIcon, SparklesIcon } from "lucide-react";
import { AdminLayout } from "@/components/admin-layout.tsx";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { SignInButton } from "@/components/ui/signin.tsx";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty.tsx";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { SEOPreviewDialog } from "../_components/seo-preview-dialog.tsx";

interface Variant {
  _id?: Id<"variants">;
  sku: string;
  title: string;
  price: string;
  compareAtPrice?: string;
  inventoryQuantity: string;
}

function EditProductPageInner() {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const collections = useQuery(api.collections.getAllCollections, {});
  const finishTypes = useQuery(api.finishTypes.listActive, {});
  const gadgetTypes = useQuery(api.gadgetTypes.listActive, {});
  const product = useQuery(api.products.getProduct, { productId: productId as Id<"products"> });
  const updateProduct = useMutation(api.products.updateProduct);
  const createVariant = useMutation(api.products.createVariant);
  const updateVariant = useMutation(api.products.updateVariant);
  const deleteVariant = useMutation(api.products.deleteVariant);

  const [formData, setFormData] = useState<{
    title: string;
    slug: string;
    description: string;
    metaDescription: string;
    metaTitle: string;
    collectionId: Id<"collections"> | "";
    status: "active" | "draft" | "archived";
    images: Array<{ url: string; alt?: string }>;
    tags: string;
    length: string;
    breadth: string;
    height: string;
    weight: string;
    productType: "physical" | "digital";
    gadgetTypeId: Id<"gadgetTypes"> | "";
    finishTypeId: Id<"finishTypes"> | "";
    productCategory: string;
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
    length: "10",
    breadth: "10",
    height: "2",
    weight: "100",
    productType: "physical",
    gadgetTypeId: "",
    finishTypeId: "",
    productCategory: "",
    hasMultipleVariants: false,
  });

  const [variants, setVariants] = useState<Variant[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // SEO generation state
  const generateSEO = useAction(api.seoProductGenerator.generateProductSEO);
  const [isGeneratingSEO, setIsGeneratingSEO] = useState(false);
  const [showSEOPreview, setShowSEOPreview] = useState(false);
  const [generatedSEO, setGeneratedSEO] = useState<{
    metaTitle: string;
    description: string;
    metaDescription: string;
    tags: string[];
  } | null>(null);

  // Populate form when product loads
  useEffect(() => {
    if (product) {
      setFormData({
        title: product.title,
        slug: product.slug,
        description: product.description,
        metaDescription: product.metaDescription || "",
        metaTitle: product.metaTitle || "",
        collectionId: product.collectionId || "",
        status: product.status,
        images: product.images.length > 0 ? product.images : [{ url: "", alt: "" }],
        tags: product.tags.join(", "),
        length: (product.length ?? 10).toString(),
        breadth: (product.breadth ?? 10).toString(),
        height: (product.height ?? 2).toString(),
        weight: (product.weight ?? 100).toString(),
        productType: product.productType ?? "physical",
        gadgetTypeId: product.gadgetTypeId || "",
        finishTypeId: product.finishTypeId || "",
        productCategory: product.productCategory || "",
        hasMultipleVariants: product.hasMultipleVariants ?? false,
      });

      setVariants(
        product.variants.map((v) => ({
          _id: v._id,
          sku: v.sku,
          title: v.title,
          price: v.price.toString(),
          compareAtPrice: v.compareAtPrice?.toString() || "",
          inventoryQuantity: v.inventoryQuantity.toString(),
        }))
      );
    }
  }, [product]);

  const addImage = () => {
    setFormData({
      ...formData,
      images: [...formData.images, { url: "", alt: "" }],
    });
  };

  const removeImage = (index: number) => {
    setFormData({
      ...formData,
      images: formData.images.filter((_, i) => i !== index),
    });
  };

  const updateImage = (index: number, field: "url" | "alt", value: string) => {
    const newImages = [...formData.images];
    newImages[index][field] = value;
    setFormData({ ...formData, images: newImages });
  };

  const addVariant = () => {
    setVariants([...variants, { sku: "", title: "", price: "", compareAtPrice: "", inventoryQuantity: "0" }]);
  };

  const removeVariant = async (index: number) => {
    const variant = variants[index];
    if (variant._id) {
      // Delete from database
      if (!confirm("Are you sure you want to delete this variant?")) {
        return;
      }
      try {
        await deleteVariant({ variantId: variant._id as Id<"variants"> });
        toast.success("Variant deleted");
      } catch (error) {
        toast.error("Failed to delete variant");
        return;
      }
    }
    setVariants(variants.filter((_, i) => i !== index));
  };

  const updateVariantLocal = (
    index: number, 
    field: Exclude<keyof Variant, "_id">, 
    value: string
  ) => {
    const newVariants = [...variants];
    newVariants[index][field] = value;
    setVariants(newVariants);
  };

  const handleGenerateSEO = async () => {
    if (!productId) return;
    
    setIsGeneratingSEO(true);
    try {
      const result = await generateSEO({ productId: productId as Id<"products"> });
      setGeneratedSEO({
        metaTitle: result.metaTitle,
        description: result.description,
        metaDescription: result.metaDescription,
        tags: result.tags,
      });
      setShowSEOPreview(true);
      toast.success("SEO content generated successfully!");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to generate SEO content";
      toast.error(errorMessage);
      console.error("SEO generation error:", error);
    } finally {
      setIsGeneratingSEO(false);
    }
  };

  const handleApplySEO = () => {
    if (!generatedSEO) return;
    
    setFormData({
      ...formData,
      metaTitle: generatedSEO.metaTitle,
      description: generatedSEO.description,
      metaDescription: generatedSEO.metaDescription,
      tags: generatedSEO.tags.join(", "),
    });
    setShowSEOPreview(false);
    toast.success("SEO content applied! Remember to save your changes.");
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

      // Update product
      await updateProduct({
        productId: productId as Id<"products">,
        title: formData.title,
        slug: formData.slug,
        description: formData.description,
        metaDescription: formData.metaDescription || undefined,
        metaTitle: formData.metaTitle || undefined,
        collectionId: formData.collectionId ? (formData.collectionId as Id<"collections">) : undefined,
        status: formData.status,
        images: formData.images.filter((img) => img.url),
        tags: formData.tags.split(",").map((t) => t.trim()).filter((t) => t),
        length: parseFloat(formData.length),
        breadth: parseFloat(formData.breadth),
        height: parseFloat(formData.height),
        weight: parseFloat(formData.weight),
        productType: formData.productType,
        gadgetTypeId: formData.gadgetTypeId ? (formData.gadgetTypeId as Id<"gadgetTypes">) : undefined,
        finishTypeId: formData.finishTypeId ? (formData.finishTypeId as Id<"finishTypes">) : undefined,
        productCategory: formData.productCategory ? (formData.productCategory as "skin" | "case-cover" | "camera-ring" | "magneto-x" | "glass" | "accessory") : undefined,
        hasMultipleVariants: formData.hasMultipleVariants,
      });

      // Update or create variants
      for (let i = 0; i < variants.length; i++) {
        const variant = variants[i];
        const compareAtPriceNum = variant.compareAtPrice ? parseFloat(variant.compareAtPrice) : undefined;
        
        if (variant._id) {
          // Update existing variant
          await updateVariant({
            variantId: variant._id as Id<"variants">,
            sku: variant.sku,
            title: variant.title,
            price: parseFloat(variant.price),
            compareAtPrice: compareAtPriceNum,
            inventoryQuantity: parseInt(variant.inventoryQuantity),
            isDefaultVariant: !formData.hasMultipleVariants && i === 0,
          });
        } else {
          // Create new variant
          await createVariant({
            productId: productId as Id<"products">,
            sku: variant.sku,
            title: variant.title,
            price: parseFloat(variant.price),
            compareAtPrice: compareAtPriceNum,
            inventoryQuantity: parseInt(variant.inventoryQuantity),
            isDefaultVariant: !formData.hasMultipleVariants && i === 0,
          });
        }
      }

      toast.success("Product updated successfully");
      navigate("/backend-skinly/products");
    } catch (error) {
      toast.error("Failed to update product");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (collections === undefined || product === undefined || gadgetTypes === undefined) {
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
            <h1 className="text-3xl font-bold">Edit Product</h1>
            <p className="text-muted-foreground">Update product details</p>
          </div>
        </div>
        <Button type="submit" disabled={isSubmitting}>
          <SaveIcon className="size-4 mr-2" />
          {isSubmitting ? "Saving..." : "Save Changes"}
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
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="slug">Slug</Label>
                <Input
                  id="slug"
                  required
                  placeholder="matte-black-phone-skin"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                />
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

          {/* AI SEO Generation */}
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <div className="flex items-center gap-2">
                <SparklesIcon className="h-5 w-5 text-primary" />
                <CardTitle>AI SEO Content Generator</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Generate high-quality, SEO-optimized content for this product using AI. This will create a meta title, product description, meta description, and tags.
              </p>
              <Button
                type="button"
                onClick={handleGenerateSEO}
                disabled={isGeneratingSEO}
                variant="default"
              >
                <SparklesIcon className="h-4 w-4 mr-2" />
                {isGeneratingSEO ? "Generating..." : "Generate SEO Content with AI"}
              </Button>
            </CardContent>
          </Card>

          {/* Images */}
          <Card>
            <CardHeader>
              <CardTitle>Product Images</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {formData.images.map((image, index) => (
                <div key={index} className="flex gap-2">
                  <div className="flex-1">
                    <Input
                      placeholder="Image URL"
                      value={image.url}
                      onChange={(e) => updateImage(index, "url", e.target.value)}
                    />
                  </div>
                  <div className="flex-1">
                    <Input
                      placeholder="Alt text"
                      value={image.alt}
                      onChange={(e) => updateImage(index, "alt", e.target.value)}
                    />
                  </div>
                  {formData.images.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeImage(index)}
                    >
                      <TrashIcon className="size-4" />
                    </Button>
                  )}
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={addImage}>
                <PlusIcon className="size-4 mr-2" />
                Add Image
              </Button>
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
                    // Reset variants when toggling to single variant
                    if (checked === false && variants.length > 1) {
                      if (confirm("Switching to single variant mode will keep only the first variant. Continue?")) {
                        setVariants([variants[0]]);
                      }
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
                    <h4 className="font-medium">
                      {variant._id ? "Existing Variant" : "New Variant"} {index + 1}
                    </h4>
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
                        onChange={(e) => updateVariantLocal(index, "sku", e.target.value)}
                      />
                    </div>
                    {formData.hasMultipleVariants && (
                      <div>
                        <Label>Variant Title</Label>
                        <Input
                          required={formData.hasMultipleVariants}
                          placeholder="e.g., Red, Blue, Large"
                          value={variant.title}
                          onChange={(e) => updateVariantLocal(index, "title", e.target.value)}
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
                        onChange={(e) => updateVariantLocal(index, "price", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>MRP (₹)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="499"
                        value={variant.compareAtPrice}
                        onChange={(e) => updateVariantLocal(index, "compareAtPrice", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Inventory</Label>
                      <Input
                        required
                        type="number"
                        placeholder="100"
                        value={variant.inventoryQuantity}
                        onChange={(e) => updateVariantLocal(index, "inventoryQuantity", e.target.value)}
                      />
                    </div>
                  </div>
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
        <div className="lg:col-span-1 space-y-6">
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
                    <SelectItem value="skin">Skin</SelectItem>
                    <SelectItem value="case-cover">Cover & Case</SelectItem>
                    <SelectItem value="camera-ring">Camera Rings</SelectItem>
                    <SelectItem value="magneto-x">Magneto & More</SelectItem>
                    <SelectItem value="glass">Membrane / Protectors</SelectItem>
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
                <div className="flex items-center gap-2">
                  <Input
                    id="weight"
                    type="number"
                    step="1"
                    min="0"
                    required
                    value={formData.weight}
                    onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                  />
                  <span className="text-sm text-muted-foreground whitespace-nowrap">grams</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* SEO Preview Dialog */}
      {generatedSEO && (
        <SEOPreviewDialog
          open={showSEOPreview}
          onOpenChange={setShowSEOPreview}
          currentContent={{
            metaTitle: formData.metaTitle,
            description: formData.description,
            metaDescription: formData.metaDescription,
            tags: formData.tags.split(",").map(t => t.trim()).filter(t => t),
          }}
          generatedContent={generatedSEO}
          onApply={handleApplySEO}
        />
      )}
    </form>
  );
}

export default function EditProductPage() {
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
                You need to be logged in to edit products
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
          <EditProductPageInner />
      </Authenticated>
    </AdminLayout>
  );
}
