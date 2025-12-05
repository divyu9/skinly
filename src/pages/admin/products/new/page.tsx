import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { Link, useNavigate } from "react-router-dom";
import { PackageIcon, PlusIcon, TrashIcon, ChevronLeftIcon } from "lucide-react";
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
  inventoryQuantity: string;
}

function NewProductPageInner() {
  const navigate = useNavigate();
  const collections = useQuery(api.collections.getAllCollections, {});
  const createProduct = useMutation(api.products.createProduct);
  const createVariant = useMutation(api.products.createVariant);

  const [formData, setFormData] = useState<{
    title: string;
    slug: string;
    description: string;
    metaDescription: string;
    collectionId: Id<"collections"> | "";
    status: "active" | "draft" | "archived";
    images: Array<{ url: string; alt: string }>;
    tags: string;
    gadgetCategory: "phone" | "laptop" | "tablet" | "camera" | "lens" | "drone" | "charger" | "console" | "mac-mini" | "cover" | "accessory";
  }>({
    title: "",
    slug: "",
    description: "",
    metaDescription: "",
    collectionId: "",
    status: "active",
    images: [{ url: "", alt: "" }],
    tags: "",
    gadgetCategory: "phone", // Default to phone
  });

  const [variants, setVariants] = useState<Variant[]>([
    { sku: "", title: "Default", price: "", inventoryQuantity: "0" },
  ]);

  const [isSubmitting, setIsSubmitting] = useState(false);

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
    setVariants([...variants, { sku: "", title: "", price: "", inventoryQuantity: "0" }]);
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
        collectionId: formData.collectionId ? (formData.collectionId as Id<"collections">) : undefined,
        status: formData.status,
        images: formData.images.filter((img) => img.url),
        tags: formData.tags.split(",").map((t) => t.trim()).filter((t) => t),
        gadgetCategory: formData.gadgetCategory,
      });

      // Create variants
      for (const variant of variants) {
        await createVariant({
          productId,
          sku: variant.sku,
          title: variant.title,
          price: parseFloat(variant.price),
          inventoryQuantity: parseInt(variant.inventoryQuantity),
        });
      }

      toast.success("Product created successfully");
      navigate("/admin/products");
    } catch (error) {
      toast.error("Failed to create product");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (collections === undefined) {
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
                    <h4 className="font-medium">Variant {index + 1}</h4>
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
                        onChange={(e) => updateVariant(index, "sku", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Title</Label>
                      <Input
                        placeholder="Default"
                        value={variant.title}
                        onChange={(e) => updateVariant(index, "title", e.target.value)}
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
                        onChange={(e) => updateVariant(index, "price", e.target.value)}
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
