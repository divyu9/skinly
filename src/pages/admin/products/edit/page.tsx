import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { Link, useNavigate, useParams } from "react-router-dom";
import { PackageIcon, PlusIcon, TrashIcon, ChevronLeftIcon, SaveIcon } from "lucide-react";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { SignInButton } from "@/components/ui/signin.tsx";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty.tsx";
import type { Id } from "@/convex/_generated/dataModel.d.ts";

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
    collectionId: Id<"collections"> | "";
    status: "active" | "draft" | "archived";
    images: Array<{ url: string; alt?: string }>;
    tags: string;
  }>({
    title: "",
    slug: "",
    description: "",
    metaDescription: "",
    collectionId: "",
    status: "active",
    images: [{ url: "", alt: "" }],
    tags: "",
  });

  const [variants, setVariants] = useState<Variant[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Populate form when product loads
  useEffect(() => {
    if (product) {
      setFormData({
        title: product.title,
        slug: product.slug,
        description: product.description,
        metaDescription: product.metaDescription || "",
        collectionId: product.collectionId || "",
        status: product.status,
        images: product.images.length > 0 ? product.images : [{ url: "", alt: "" }],
        tags: product.tags.join(", "),
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
        collectionId: formData.collectionId ? (formData.collectionId as Id<"collections">) : undefined,
        status: formData.status,
        images: formData.images.filter((img) => img.url),
        tags: formData.tags.split(",").map((t) => t.trim()).filter((t) => t),
      });

      // Update or create variants
      for (const variant of variants) {
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
          });
        }
      }

      toast.success("Product updated successfully");
      navigate("/admin/products");
    } catch (error) {
      toast.error("Failed to update product");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (collections === undefined || product === undefined) {
    return <Skeleton className="h-screen w-full" />;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/admin/products">
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
              {variants.map((variant, index) => (
                <div key={index} className="p-4 border rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">
                      {variant._id ? "Existing Variant" : "New Variant"} {index + 1}
                    </h4>
                    {variants.length > 1 && (
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
                    <div>
                      <Label>Title</Label>
                      <Input
                        placeholder="Default"
                        value={variant.title}
                        onChange={(e) => updateVariantLocal(index, "title", e.target.value)}
                      />
                    </div>
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
              <Button type="button" variant="outline" size="sm" onClick={addVariant}>
                <PlusIcon className="size-4 mr-2" />
                Add Variant
              </Button>
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
                    <Link to="/admin/collections" className="text-primary underline">
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
            </CardContent>
          </Card>
        </div>
      </div>
    </form>
  );
}

export default function EditProductPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2">
              <img
                src="https://cdn.hercules.app/file_Qd06a0OWqeC2LadTl4tLLvmv"
                alt="Skinly"
                className="h-8"
              />
            </Link>
            <nav className="flex items-center gap-6">
              <Link to="/admin/products" className="text-sm font-medium text-primary">
                Products
              </Link>
              <Link to="/admin/collections" className="text-sm font-medium hover:text-primary transition-colors">
                Collections
              </Link>
              <Link to="/admin/orders" className="text-sm font-medium hover:text-primary transition-colors">
                Orders
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-7xl">
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
      </div>
    </div>
  );
}
