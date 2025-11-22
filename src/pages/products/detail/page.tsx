import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { useState, useMemo, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { 
  ArrowLeftIcon, 
  PackageIcon, 
  ShoppingCartIcon, 
  CheckIcon, 
  RefreshCwIcon, 
  StarIcon,
  ShieldCheckIcon,
  TruckIcon,
  SparklesIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  InfoIcon,
  ZapIcon,
  MapPinIcon,
  XCircleIcon,
  BanknoteIcon,
  PackageCheckIcon,
  AlertTriangleIcon,
  TagIcon,
  CopyIcon
} from "lucide-react";
import { CartButton } from "@/components/cart.tsx";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth.ts";
import { useGuestCart } from "@/hooks/use-guest-cart.ts";
import { ConvexError } from "convex/values";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { findMockupImageUrl, extractSKU, extractBrand } from "@/lib/mockups.ts";

// Phone models data
const phoneModels: Record<string, string[]> = {
  "Apple": [
    "iPhone 17 Pro Max", "iPhone 17 Pro", "iPhone 17 Air", "iPhone 17",
    "iPhone 16E", "iPhone 16 Pro Max", "iPhone 16 pro max", "iPhone 16 pro",
    "iPhone 16 Plus", "iPhone 16", "iPhone 15 Pro Max", "iPhone 15 Pro",
    "iPhone 15 Plus", "iPhone 15", "iPhone 14 Pro Max", "iPhone 14 Pro",
    "iPhone 14 Plus", "iPhone 14", "iPhone 13 Pro Max", "iPhone 13 Pro",
    "iPhone 13 Mini", "iPhone 13", "iPhone 12 Pro Max", "iPhone 12 Pro",
    "iPhone 12 Mini", "iPhone 12", "iPhone 11 Pro Max", "iPhone 11 Pro",
    "iPhone 11", "iPhone XS Max", "iPhone XS", "iPhone XR", "iPhone X",
    "iPhone 8 Plus", "iPhone 8", "iPhone 7 Plus", "iPhone 7",
    "iPhone 6S Plus", "iPhone 6S", "iPhone 6 Plus", "iPhone 6",
    "iPhone SE", "iPhone 5E", "iPhone 5S", "iPhone 5"
  ],
  "Samsung": [
    "Samsung Galaxy S25 Edge", "Samsung Galaxy S25 Plus", "Samsung Galaxy S25 Ultra (5G)",
    "Samsung Galaxy S25 (5G)", "Samsung Galaxy S24 Ultra (5G)", "Samsung Galaxy S24 Plus",
    "Samsung Galaxy S24 (5G)", "Samsung Galaxy S24 FE (5G)", "Samsung Galaxy S23 FE (5G)",
    "Samsung Galaxy S23 (5G)", "Samsung Galaxy S22 Ultra", "Samsung Galaxy S22 Plus",
    "Samsung Galaxy S22", "Samsung Galaxy S21 Ultra 5G", "Samsung Galaxy S21 Plus 5G",
    "Samsung Galaxy S21 FE 5G", "Samsung Galaxy S21 5G", "Samsung Galaxy Z Fold 5",
    "Samsung Galaxy Z Fold 4", "Samsung Galaxy Z Flip 5", "Samsung Galaxy Z Flip 4"
  ],
  "OnePlus": [
    "OnePlus 13 Pro", "OnePlus 13", "OnePlus 12", "OnePlus 11 5G", "OnePlus 10 Pro 5G",
    "OnePlus 9 Pro", "OnePlus 9", "OnePlus 8T", "OnePlus 8 Pro", "OnePlus Nord 4",
    "OnePlus Nord 3", "OnePlus Nord CE 4", "OnePlus Nord CE 3"
  ],
  "Nothing": [
    "Nothing Phone 3A Pro", "Nothing Phone 3A", "Nothing Phone 2A",
    "Nothing Phone 2", "Nothing Phone 1 5G"
  ],
  "Oppo": [
    "Oppo Find 8X Pro (5G)", "Oppo Find 8X (5G)", "Oppo Reno 14 Pro 5G",
    "Oppo Reno 14 5G", "Oppo Reno 13 Pro (5G)", "Oppo Reno 12 Pro (5G)",
    "Oppo F31 Pro Plus 5G", "Oppo F29 Pro (5G)", "Oppo F27 Pro Plus (5G)"
  ],
  "Realme": [
    "Realme GT 7T 5G", "Realme GT7 Pro 5G", "Realme P4 Pro 5G", "Realme P4 5G",
    "Realme 15 Pro 5G", "Realme 14 Pro Plus (5G)", "Realme 13 Pro Plus 5G",
    "Realme 12 Pro Plus (5G)", "Realme 11 Pro Plus"
  ],
  "Vivo": [
    "Vivo X200 Pro (5G)", "Vivo X200 (5G)", "Vivo X100 Pro", "Vivo V60 5G",
    "Vivo V50 5G", "Vivo V40 5G", "Vivo V30 Pro (5G)", "Vivo V29 Pro (5G)"
  ],
  "Xiaomi": [
    "Xiaomi 15 Ultra", "Xiaomi 15 Pro", "Xiaomi 15", "Xiaomi 14 Ultra",
    "Xiaomi 14 Pro", "Xiaomi 14", "Xiaomi 13 Pro", "Redmi Note 14 Pro Plus 5G",
    "Redmi Note 13 Pro Plus", "Poco X7 Pro", "Poco F6"
  ],
  "CMF": ["CMF Phone 2 Pro", "CMF Phone 1"],
  "Motorola": [
    "Motorola Edge 60 Ultra", "Motorola Edge 50 Pro", "Motorola Edge 40",
    "Moto G85", "Moto G75", "Moto G64"
  ],
  "Google": ["Google Pixel 9 Pro XL", "Google Pixel 9 Pro", "Google Pixel 8 Pro"]
};

// USP bullet points
const skinUSPs = [
  { icon: InfoIcon, text: "Model images are for reference only - You will receive the skin for your selected model", highlighted: true },
  { icon: ShieldCheckIcon, text: "Precision Cut for Perfect Fit", highlighted: false },
  { icon: SparklesIcon, text: "High-Resolution Print Quality", highlighted: false },
  { icon: TruckIcon, text: "Bubble-Free Application", highlighted: false },
  { icon: CheckIcon, text: "Easy to Remove & Residue-Free", highlighted: false },
  { icon: CheckIcon, text: "Easy Installation", highlighted: false },
  { icon: PackageIcon, text: "Premium Installation Kit Included", highlighted: false },
];

export default function ProductDetailPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const productSlug = searchParams.get('slug');
  const phoneModel = searchParams.get('model');
  const phoneBrand = searchParams.get('brand');
  
  // Model selector state
  const [modelDialogOpen, setModelDialogOpen] = useState(false);
  const [selectedBrand, setSelectedBrand] = useState<string>("");
  const [modelSearch, setModelSearch] = useState("");
  
  // UI state
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewTitle, setReviewTitle] = useState("");
  const [reviewComment, setReviewComment] = useState("");
  const [crossSellDialogOpen, setCrossSellDialogOpen] = useState(false);
  
  // Mockup image state
  const [mockupUrl, setMockupUrl] = useState<string | null>(null);
  const [mockupLoading, setMockupLoading] = useState(false);
  
  // Filter models based on search
  const filteredModels = useMemo(() => {
    if (!modelSearch.trim()) return phoneModels[selectedBrand] || [];
    
    const searchTerms = modelSearch
      .toLowerCase()
      .split(/\s+/)
      .filter((term) => term.length > 0);
    
    return (phoneModels[selectedBrand] || []).filter((model) => {
      const modelLower = model.toLowerCase();
      return searchTerms.every((term) => modelLower.includes(term));
    });
  }, [selectedBrand, modelSearch]);
  
  // Handle model selection
  const handleModelSelect = (model: string, brand: string) => {
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.set('model', model);
    newSearchParams.set('brand', brand);
    navigate({
      pathname: '/products/detail',
      search: newSearchParams.toString(),
    });
    setModelDialogOpen(false);
    setSelectedBrand("");
    setModelSearch("");
  };
  
  // Query local database
  const productData = useQuery(
    api.products.getProductBySlug, 
    productSlug ? { slug: productSlug } : "skip"
  );
  
  const reviews = useQuery(
    api.reviews.getProductReviews,
    productData ? { productId: productData._id } : "skip"
  );
  
  const reviewStats = useQuery(
    api.reviews.getReviewStats,
    productData ? { productId: productData._id } : "skip"
  );
  
  // Fetch active coupons
  const activeCoupons = useQuery(api.coupons.getActiveCoupons);
  
  // Query mockup file URL from database
  const mockupFileUrl = useQuery(
    api.mockups.getMockupFileId,
    phoneModel && productData
      ? {
          brand: extractBrand(phoneModel) || "",
          model: phoneModel,
          sku: extractSKU(productData.title, productData.variants[0]?.sku) || "",
        }
      : "skip"
  );
  
  // Filter coupons to only show applicable ones for this product
  const applicableCoupons = useMemo(() => {
    if (!activeCoupons || !productData) return [];
    
    return activeCoupons.filter((coupon) => {
      // If coupon has no product restrictions, show it for all products
      if (!coupon.applicableProductKeywords || coupon.applicableProductKeywords.length === 0) {
        return true;
      }
      
      // Check if current product matches any of the keywords
      const productTitle = productData.title.toLowerCase();
      return coupon.applicableProductKeywords.some((keyword) =>
        productTitle.includes(keyword.toLowerCase())
      );
    });
  }, [activeCoupons, productData]);
  
  // Fetch mockup image URL asynchronously when phone model or product changes
  useEffect(() => {
    if (!phoneModel || !productData) {
      setMockupUrl(null);
      setMockupLoading(false);
      return;
    }
    
    const firstVariantSku = productData.variants[0]?.sku;
    const sku = extractSKU(productData.title, firstVariantSku);
    
    if (!sku) {
      setMockupUrl(null);
      setMockupLoading(false);
      return;
    }
    
    // If mockupFileUrl is undefined, it's still loading - don't reset mockupUrl
    if (mockupFileUrl === undefined) {
      setMockupLoading(true);
      return;
    }
    
    // mockupFileUrl is either null (not found) or a string (found)
    if (mockupFileUrl) {
      setMockupUrl(mockupFileUrl);
      setMockupLoading(false);
    } else {
      // No mockup in database, try legacy fallback
      setMockupLoading(true);
      findMockupImageUrl(phoneModel, sku, null)
        .then(url => {
          setMockupUrl(url);
          setMockupLoading(false);
        })
        .catch(error => {
          console.error('Error loading mockup:', error);
          setMockupUrl(null);
          setMockupLoading(false);
        });
    }
  }, [phoneModel, productData, mockupFileUrl]);
  
  // Filter images based on selected phone model and mockup URLs
  const displayImages = useMemo(() => {
    if (!productData) return [];
    
    // If no phone model is selected, show all images (or default ones)
    if (!phoneModel) {
      return productData.images;
    }
    
    const images = [];
    
    // Add mockup image if found
    if (mockupUrl) {
      images.push({
        url: mockupUrl,
        alt: `${productData.title} - ${phoneModel} Preview`,
        phoneModel: phoneModel,
      });
    }
    
    // Find images that match the selected phone model from database
    const modelSpecificImages = productData.images.filter(
      (img) => img.phoneModel?.toLowerCase() === phoneModel.toLowerCase()
    );
    
    // Add model-specific images from database
    if (modelSpecificImages.length > 0) {
      images.push(...modelSpecificImages);
    }
    
    // Add default images (without phoneModel tags)
    const defaultImages = productData.images.filter((img) => !img.phoneModel);
    images.push(...defaultImages);
    
    // If we have images, return them; otherwise fall back to all product images
    return images.length > 0 ? images : productData.images;
  }, [productData, phoneModel, mockupUrl]);
  
  // Determine if this product needs phone model selection
  // Includes: phone skins and membranes
  // Excludes: cases, covers, camera rings, tempered glass
  const isPhoneSkin = productData ? (() => {
    const titleLower = productData.title.toLowerCase();
    const tagsLower = productData.tags?.map(t => t.toLowerCase()) || [];
    
    // Check if it's a membrane (matte or gloss) - these need phone selector
    const isMembrane = 
      (titleLower.includes("membrane") && titleLower.includes("3 layer")) ||
      (titleLower.includes("matte membrane") || titleLower.includes("gloss membrane"));
    
    if (isMembrane) return true;
    
    // Exclude products that are not skins
    const isNotSkin = 
      titleLower.includes("case") ||
      titleLower.includes("cover") ||
      titleLower.includes("camera ring") ||
      titleLower.includes("tempered") ||
      titleLower.includes("glass") ||
      titleLower.includes("screen guard") ||
      titleLower.includes("protector");
    
    if (isNotSkin) return false;
    
    // Check if it's actually a phone skin
    const isSkin = titleLower.includes("phone skin") ||
      titleLower.includes("skin") && (titleLower.includes("phone") || titleLower.includes("matte") || titleLower.includes("3d embossed") || titleLower.includes("transparent"));
    
    return isSkin;
  })() : false;
  
  // Fetch cross-sell products
  const crossSellProducts = useQuery(
    api.products.getCrossSellProducts,
    phoneBrand && isPhoneSkin
      ? { phoneBrand: phoneBrand, isPhoneSkin: true }
      : "skip"
  );
  
  const addToCart = useMutation(api.cart.addToCart);
  const addReview = useMutation(api.reviews.addReview);
  const { user } = useAuth();
  const { addToGuestCart } = useGuestCart();
  const [selectedImage, setSelectedImage] = useState<string>("");
  const [selectedVariant, setSelectedVariant] = useState<number>(0);
  const [selectedCoverage, setSelectedCoverage] = useState<"only_back" | "full_body_wrap">("only_back");
  const [isAdding, setIsAdding] = useState(false);
  
  const isLoading = productData === undefined;
  const product = productData;
  
  // Automatically select the first image when displayImages changes (e.g., when mockup loads)
  useEffect(() => {
    if (displayImages.length > 0) {
      // Always select the first image (which will be the mockup if it exists)
      setSelectedImage(displayImages[0].url);
    }
  }, [displayImages]);

  const handleAddToCart = async () => {
    if (!product) return;
    // Only require phoneModel for phone skins
    if (isPhoneSkin && !phoneModel) return;
    
    setIsAdding(true);
    
    try {
      const cartItem = {
        productId: product._id,
        productTitle: product.title,
        productImage: displayImages[0]?.url || product.images[0]?.url,
        variant: product.variants[selectedVariant].title,
        price: product.variants[selectedVariant].price,
        quantity: 1,
        phoneModel: phoneModel || undefined,
        phoneBrand: phoneBrand || undefined,
        coverage: isPhoneSkin ? selectedCoverage : undefined,
      };
      
      if (user) {
        await addToCart(cartItem);
      } else {
        addToGuestCart(cartItem);
      }
      
      toast.success("Added to cart!");
      setCrossSellDialogOpen(false);
    } catch (error) {
      if (error instanceof ConvexError && error.data.code === "UNAUTHENTICATED") {
        addToGuestCart({
          productId: product._id,
          productTitle: product.title,
          productImage: displayImages[0]?.url || product.images[0]?.url,
          variant: product.variants[selectedVariant].title,
          price: product.variants[selectedVariant].price,
          quantity: 1,
          phoneModel: phoneModel || undefined,
          phoneBrand: phoneBrand || undefined,
          coverage: isPhoneSkin ? selectedCoverage : undefined,
        });
        toast.success("Added to cart!");
        setCrossSellDialogOpen(false);
      } else {
        toast.error("Failed to add to cart");
      }
    } finally {
      setIsAdding(false);
    }
  };

  const handleAddReview = async () => {
    if (!product) return;
    
    if (!reviewTitle.trim() || !reviewComment.trim()) {
      toast.error("Please fill in all review fields");
      return;
    }
    
    try {
      await addReview({
        productId: product._id,
        rating: reviewRating,
        title: reviewTitle,
        comment: reviewComment,
      });
      toast.success("Review added successfully!");
      setReviewDialogOpen(false);
      setReviewTitle("");
      setReviewComment("");
      setReviewRating(5);
    } catch (error) {
      if (error instanceof ConvexError) {
        const { message } = error.data as { code: string; message: string };
        toast.error(message);
      } else {
        toast.error("Failed to add review");
      }
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <nav className="fixed top-0 w-full bg-background/80 backdrop-blur-lg border-b border-border z-50">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2">
              <img 
                src="https://cdn.hercules.app/file_Qd06a0OWqeC2LadTl4tLLvmv" 
                alt="Skinly" 
                className="h-10"
              />
            </Link>
          </div>
        </nav>

        <div className="pt-24 pb-20 px-4">
          <div className="container mx-auto max-w-6xl">
            <Skeleton className="h-8 w-32 mb-8" />
            <div className="grid lg:grid-cols-2 gap-8">
              <Skeleton className="aspect-square w-full rounded-xl" />
              <div className="space-y-4">
                <Skeleton className="h-10 w-3/4" />
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    if (!isLoading) {
      return (
        <div className="min-h-screen bg-background">
          <nav className="fixed top-0 w-full bg-background/80 backdrop-blur-lg border-b border-border z-50">
            <div className="container mx-auto px-4 py-4 flex items-center justify-between">
              <Link to="/" className="flex items-center gap-2">
                <img 
                  src="https://cdn.hercules.app/file_Qd06a0OWqeC2LadTl4tLLvmv" 
                  alt="Skinly" 
                  className="h-10"
                />
              </Link>
            </div>
          </nav>

          <div className="pt-24 pb-20 px-4">
            <div className="container mx-auto max-w-2xl text-center">
              <PackageIcon className="size-16 text-muted-foreground mx-auto mb-4" />
              <h1 className="text-3xl font-bold mb-4">Product Not Found</h1>
              <Button asChild>
                <Link to="/products">Browse All Products</Link>
              </Button>
            </div>
          </div>
        </div>
      );
    }
    return null;
  }

  const minPrice = Math.min(...product.variants.map(v => v.price));
  const maxPrice = Math.max(...product.variants.map(v => v.price));
  const priceDisplay = minPrice === maxPrice 
    ? `₹${minPrice.toFixed(0)}`
    : `₹${minPrice.toFixed(0)} - ₹${maxPrice.toFixed(0)}`;

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 w-full bg-background/80 backdrop-blur-lg border-b border-border z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img 
              src="https://cdn.hercules.app/file_Qd06a0OWqeC2LadTl4tLLvmv" 
              alt="Skinly" 
              className="h-10"
            />
          </Link>
          <div className="flex items-center gap-6">
            <Link to="/products" className="text-sm font-medium hover:text-primary transition-colors">
              All Products
            </Link>
            <CartButton />
          </div>
        </div>
      </nav>

      {/* Product Detail Section */}
      <section className="pt-20 pb-12 px-4">
        <div className="container mx-auto max-w-6xl">
          <Button variant="ghost" size="sm" asChild className="mb-6">
            <Link to="/products">
              <ArrowLeftIcon className="size-4 mr-2" />
              Back to Products
            </Link>
          </Button>

          <div className="grid md:grid-cols-[45%_1fr] lg:grid-cols-[450px_1fr] gap-8 mb-12">
            {/* Image Gallery */}
            <div className="space-y-3 md:sticky md:top-24 md:self-start">
              <div className="aspect-square overflow-hidden rounded-xl bg-muted border border-border relative">
                {selectedImage ? (
                  <>
                    <img
                      src={selectedImage}
                      alt={product.title}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        // If mockup image fails to load, show next available image
                        const nextImage = displayImages.find(img => img.url !== selectedImage);
                        if (nextImage) {
                          setSelectedImage(nextImage.url);
                        }
                      }}
                    />
                    {phoneModel && mockupUrl && selectedImage === mockupUrl && (
                      <div className="absolute top-3 right-3 bg-primary text-primary-foreground px-3 py-1 rounded-full text-xs font-semibold shadow-lg">
                        Preview on {phoneModel}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <PackageIcon className="size-12 text-muted-foreground" />
                  </div>
                )}
              </div>
              
              {/* Thumbnail Gallery */}
              {displayImages.length > 1 && (
                <div className="grid grid-cols-4 gap-2">
                  {displayImages.slice(0, 4).map((image, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedImage(image.url)}
                      className={`aspect-square overflow-hidden rounded-lg border-2 transition-all ${
                        selectedImage === image.url
                          ? "border-primary"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <img
                        src={image.url}
                        alt={image.alt || product.title}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          // Hide thumbnail if image fails to load (e.g., mockup doesn't exist)
                          (e.target as HTMLImageElement).parentElement!.style.display = 'none';
                        }}
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Product Info */}
            <div className="space-y-6">
              <div>
                <h1 className="text-3xl font-bold mb-2">{product.title}</h1>
                <div className="flex items-center gap-4 mb-4">
                  <div className="text-2xl font-bold text-primary">{priceDisplay}</div>
                  {reviewStats && reviewStats.totalReviews > 0 && (
                    <div className="flex items-center gap-2">
                      <div className="flex items-center">
                        {[...Array(5)].map((_, i) => (
                          <StarIcon
                            key={i}
                            className={`size-4 ${
                              i < Math.round(reviewStats.averageRating)
                                ? "fill-yellow-400 text-yellow-400"
                                : "fill-muted text-muted"
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {reviewStats.averageRating} ({reviewStats.totalReviews} reviews)
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* USPs - Only for phone skins */}
              {isPhoneSkin && (
                <div className="space-y-3">
                  {skinUSPs.map((usp, idx) => (
                    <div 
                      key={idx} 
                      className={`flex items-start gap-2 text-sm ${
                        usp.highlighted 
                          ? "bg-amber-500/10 border border-amber-500/30 rounded-lg p-3" 
                          : ""
                      }`}
                    >
                      <usp.icon className={`size-4 shrink-0 mt-0.5 ${
                        usp.highlighted ? "text-amber-600" : "text-primary"
                      }`} />
                      <span className={usp.highlighted ? "text-foreground font-medium" : "text-muted-foreground"}>
                        {usp.text}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Description */}
              {product.description && (
                <div className="border border-border rounded-lg p-4">
                  <button
                    onClick={() => setShowFullDescription(!showFullDescription)}
                    className="flex items-center justify-between w-full text-left"
                  >
                    <h3 className="font-semibold text-sm">Product Description</h3>
                    {showFullDescription ? (
                      <ChevronUpIcon className="size-4" />
                    ) : (
                      <ChevronDownIcon className="size-4" />
                    )}
                  </button>
                  {showFullDescription && (
                    <div 
                      className="mt-3 text-sm text-muted-foreground prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: product.description }}
                    />
                  )}
                </div>
              )}

              {/* Phone Model Selection - Only for phone skins */}
              {isPhoneSkin && (
                phoneModel ? (
                  <div className="space-y-4">
                    <Card className="border-primary/20 bg-primary/5">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <CheckIcon className="size-5 text-primary shrink-0" />
                          <div className="flex-1">
                            <p className="text-xs text-muted-foreground">Selected Model</p>
                            <p className="font-semibold">{phoneModel}</p>
                          </div>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => setModelDialogOpen(true)}
                          >
                            <RefreshCwIcon className="size-3 mr-1" />
                            Change
                          </Button>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Coverage Selection */}
                    <div className="space-y-2">
                      <label className="text-sm font-semibold">Select Coverage</label>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          onClick={() => setSelectedCoverage("only_back")}
                          className={`p-4 rounded-lg border-2 transition-all text-left ${
                            selectedCoverage === "only_back"
                              ? "border-primary bg-primary/10"
                              : "border-border hover:border-primary/50"
                          }`}
                        >
                          <div className="font-medium text-sm">Only Back</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            Back coverage only
                          </div>
                        </button>
                        <button
                          onClick={() => setSelectedCoverage("full_body_wrap")}
                          className={`p-4 rounded-lg border-2 transition-all text-left ${
                            selectedCoverage === "full_body_wrap"
                              ? "border-primary bg-primary/10"
                              : "border-border hover:border-primary/50"
                          }`}
                        >
                          <div className="font-medium text-sm">Full Body Wrap</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            Complete protection
                          </div>
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <Card className="border-amber-500/50 bg-amber-500/10">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="text-xl shrink-0">📱</div>
                        <div className="flex-1">
                          <p className="text-sm font-semibold">Select Your Phone Model</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Ensure perfect fit for your device
                          </p>
                        </div>
                        <Button 
                          size="sm"
                          onClick={() => setModelDialogOpen(true)}
                        >
                          Select
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              )}
              
              {/* Variant Selection */}
              {product.variants.length > 1 && (
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Select Finish</label>
                  <div className="grid grid-cols-2 gap-2">
                    {product.variants.map((variant, idx) => (
                      <button
                        key={variant._id}
                        onClick={() => setSelectedVariant(idx)}
                        className={`p-3 rounded-lg border-2 transition-all text-left ${
                          selectedVariant === idx
                            ? "border-primary bg-primary/10"
                            : "border-border hover:border-primary/50"
                        }`}
                      >
                        <div className="font-medium text-sm">{variant.title}</div>
                        <div className="font-bold text-primary text-sm">
                          ₹{variant.price.toFixed(0)}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Add to Cart */}
              <Button
                className="w-full"
                size="lg"
                onClick={() => {
                  // Only require phone model for phone skins
                  if (isPhoneSkin && !phoneModel) {
                    toast.error("Please select your phone model first");
                    return;
                  }
                  
                  // Show cross-sell dialog if products available, otherwise add directly
                  if (crossSellProducts && crossSellProducts.length > 0) {
                    setCrossSellDialogOpen(true);
                  } else {
                    handleAddToCart();
                  }
                }}
                disabled={isAdding || (isPhoneSkin && !phoneModel)}
              >
                <ShoppingCartIcon className="size-5 mr-2" />
                {isAdding ? "Adding..." : "Add to Cart"}
              </Button>

              {/* Shipping & Delivery Info */}
              <div className="border-t border-border pt-6">
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <ZapIcon className="size-4 text-primary shrink-0" />
                    <span className="text-muted-foreground">Fast Shipping</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <XCircleIcon className="size-4 text-red-500 shrink-0" />
                    <span className="text-muted-foreground">Non Returnable</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <MapPinIcon className="size-4 text-primary shrink-0" />
                    <span className="text-muted-foreground">Pan India Delivery</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <BanknoteIcon className="size-4 text-red-500 shrink-0" />
                    <span className="text-muted-foreground">COD Not Available</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm col-span-2">
                    <PackageCheckIcon className="size-4 text-primary shrink-0" />
                    <span className="text-muted-foreground">Safe Packaging</span>
                  </div>
                </div>
                
                {isPhoneSkin && (
                  <div className="flex items-start gap-2 text-sm bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 mt-4">
                    <AlertTriangleIcon className="size-4 text-amber-600 shrink-0 mt-0.5" />
                    <span className="text-foreground">
                      <strong>Custom Cut Product:</strong> No order cancellation or changes allowed after order confirmation. Your product is custom-cut upon order placement.
                    </span>
                  </div>
                )}
                
                {/* Active Offers Section */}
                {applicableCoupons && applicableCoupons.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <TagIcon className="size-4 text-primary" />
                      <span>Active Offers</span>
                    </div>
                    <div className="space-y-2">
                      {applicableCoupons.map((coupon) => {
                        const discountText = coupon.discountType === "percentage" 
                          ? `${coupon.discountValue}% OFF${coupon.maxDiscount ? ` (max ₹${coupon.maxDiscount})` : ''}`
                          : `₹${coupon.discountValue} OFF`;
                        
                        return (
                          <div 
                            key={coupon._id}
                            className="border border-primary/30 rounded-lg p-3 bg-primary/5"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <code className="px-2 py-0.5 bg-primary text-primary-foreground rounded text-xs font-bold">
                                    {coupon.code}
                                  </code>
                                  <span className="text-xs font-bold text-primary">
                                    {discountText}
                                  </span>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  {coupon.description}
                                </p>
                                {coupon.minPurchase && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    Min. purchase: ₹{coupon.minPurchase}
                                  </p>
                                )}
                              </div>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(coupon.code);
                                  toast.success("Coupon code copied!");
                                }}
                                className="shrink-0 p-2 hover:bg-primary/10 rounded transition-colors"
                              >
                                <CopyIcon className="size-4 text-primary" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Reviews Section */}
          <div className="border-t border-border pt-12">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">Customer Reviews</h2>
              <Button 
                onClick={() => {
                  if (user) {
                    setReviewDialogOpen(true);
                  } else {
                    toast.error("Please sign in to post a review");
                  }
                }}
              >
                Post A Review
              </Button>
            </div>

            {reviewStats && reviewStats.totalReviews > 0 ? (
              <div className="space-y-6">
                {/* Rating Summary */}
                <Card>
                  <CardContent className="p-6">
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="flex items-center gap-4">
                        <div className="text-center">
                          <div className="text-4xl font-bold">{reviewStats.averageRating}</div>
                          <div className="flex items-center justify-center mt-1">
                            {[...Array(5)].map((_, i) => (
                              <StarIcon
                                key={i}
                                className={`size-4 ${
                                  i < Math.round(reviewStats.averageRating)
                                    ? "fill-yellow-400 text-yellow-400"
                                    : "fill-muted text-muted"
                                }`}
                              />
                            ))}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {reviewStats.totalReviews} reviews
                          </p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {[5, 4, 3, 2, 1].map((rating) => (
                          <div key={rating} className="flex items-center gap-2">
                            <span className="text-sm w-3">{rating}</span>
                            <StarIcon className="size-3 fill-yellow-400 text-yellow-400" />
                            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-yellow-400"
                                style={{
                                  width: `${
                                    reviewStats.totalReviews > 0
                                      ? (reviewStats.ratingDistribution[rating as 1 | 2 | 3 | 4 | 5] /
                                          reviewStats.totalReviews) *
                                        100
                                      : 0
                                  }%`,
                                }}
                              />
                            </div>
                            <span className="text-sm text-muted-foreground w-8">
                              {reviewStats.ratingDistribution[rating as 1 | 2 | 3 | 4 | 5]}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Reviews List */}
                <div className="space-y-4">
                  {reviews && reviews.map((review) => (
                    <Card key={review._id}>
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold">{review.userName}</span>
                              {review.verified && (
                                <span className="text-xs bg-green-500/10 text-green-600 px-2 py-0.5 rounded">
                                  Verified Purchase
                                </span>
                              )}
                            </div>
                            <div className="flex items-center">
                              {[...Array(5)].map((_, i) => (
                                <StarIcon
                                  key={i}
                                  className={`size-4 ${
                                    i < review.rating
                                      ? "fill-yellow-400 text-yellow-400"
                                      : "fill-muted text-muted"
                                  }`}
                                />
                              ))}
                            </div>
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {new Date(review._creationTime).toLocaleDateString()}
                          </span>
                        </div>
                        <h4 className="font-semibold mb-2">{review.title}</h4>
                        <p className="text-sm text-muted-foreground">{review.comment}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ) : (
              <Card>
                <CardContent className="p-12 text-center">
                  <StarIcon className="size-12 text-muted-foreground mx-auto mb-3" />
                  <h3 className="text-lg font-semibold mb-2">No reviews yet</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Be the first to review this product
                  </p>
                  <Button 
                    onClick={() => {
                      if (user) {
                        setReviewDialogOpen(true);
                      } else {
                        toast.error("Please sign in to post a review");
                      }
                    }}
                  >
                    Post A Review
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </section>
      
      {/* Model Selector Dialog */}
      <Dialog open={modelDialogOpen} onOpenChange={setModelDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          {!selectedBrand ? (
            <>
              <DialogHeader>
                <DialogTitle>Select Phone Brand</DialogTitle>
                <DialogDescription>Choose your phone brand to see available models</DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 overflow-y-auto pr-2">
                {Object.keys(phoneModels).sort().map((brand) => (
                  <Button
                    key={brand}
                    variant="outline"
                    className="h-auto py-4"
                    onClick={() => setSelectedBrand(brand)}
                  >
                    {brand}
                  </Button>
                ))}
              </div>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Select {selectedBrand} Model</DialogTitle>
                <DialogDescription>
                  {filteredModels.length} models available
                </DialogDescription>
              </DialogHeader>
              <Input
                placeholder={`Search ${selectedBrand} models...`}
                value={modelSearch}
                onChange={(e) => setModelSearch(e.target.value)}
                className="mb-2"
              />
              <div className="flex-1 overflow-y-auto pr-2 space-y-2">
                {filteredModels.length > 0 ? (
                  filteredModels.map((model) => (
                    <Button
                      key={model}
                      variant="outline"
                      className="w-full justify-start text-left h-auto py-3"
                      onClick={() => handleModelSelect(model, selectedBrand)}
                    >
                      {model}
                    </Button>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
                    <p className="text-muted-foreground">No models found matching "{modelSearch}"</p>
                    <a
                      href={`https://wa.me/919761011121?text=${encodeURIComponent("I Want to request a model on Skinly")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"
                    >
                      Request Your Model
                    </a>
                  </div>
                )}
              </div>
              <div className="pt-4 border-t">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setSelectedBrand("");
                    setModelSearch("");
                  }}
                  className="w-full"
                >
                  ← Back to Brands
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Review Dialog */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Write a Review</DialogTitle>
            <DialogDescription>Share your experience with this product</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-semibold mb-2 block">Rating</label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((rating) => (
                  <button
                    key={rating}
                    onClick={() => setReviewRating(rating)}
                    className="transition-transform hover:scale-110"
                  >
                    <StarIcon
                      className={`size-8 ${
                        rating <= reviewRating
                          ? "fill-yellow-400 text-yellow-400"
                          : "fill-muted text-muted"
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-semibold mb-2 block">Title</label>
              <Input
                placeholder="Summarize your review"
                value={reviewTitle}
                onChange={(e) => setReviewTitle(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-semibold mb-2 block">Review</label>
              <Textarea
                placeholder="Share your thoughts about this product..."
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                rows={4}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setReviewDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddReview}>
                Submit Review
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cross-Sell Dialog */}
      <Dialog open={crossSellDialogOpen} onOpenChange={setCrossSellDialogOpen}>
        <DialogContent className="max-w-md max-h-[80vh] flex flex-col p-0">
          <DialogHeader className="px-5 pt-5 pb-3">
            <DialogTitle className="text-lg leading-tight">The skin's got your back... but what about the front?</DialogTitle>
            <DialogDescription className="text-xs">
              Complete 360° protection
            </DialogDescription>
          </DialogHeader>
          
          {/* Scrollable content area */}
          <div className="flex-1 overflow-y-auto px-5">
            <div className="grid grid-cols-2 gap-2 pb-3">
              {crossSellProducts?.map((crossSellProduct) => {
                const minPrice = crossSellProduct.variants.length > 0 
                  ? Math.min(...crossSellProduct.variants.map(v => v.price))
                  : 0;
                
                return (
                  <button
                    key={crossSellProduct._id}
                    onClick={() => {
                      navigate(`/products/detail?slug=${crossSellProduct.slug}`);
                      setCrossSellDialogOpen(false);
                    }}
                    className="group relative overflow-hidden rounded-md border border-border hover:border-primary transition-all text-left"
                  >
                    <div className="aspect-[4/3] overflow-hidden bg-muted">
                      {crossSellProduct.images[0] ? (
                        <img
                          src={crossSellProduct.images[0].url}
                          alt={crossSellProduct.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <PackageIcon className="size-6 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <div className="p-2">
                      <h4 className="font-medium text-[10px] leading-tight mb-0.5 line-clamp-2">
                        {crossSellProduct.title}
                      </h4>
                      <div className="text-primary font-bold text-xs">
                        ₹{minPrice.toFixed(0)}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Fixed action buttons */}
          <div className="flex flex-col gap-2 px-5 pb-5 pt-3 border-t bg-background">
            <Button 
              size="default" 
              onClick={handleAddToCart}
              disabled={isAdding}
              className="w-full"
            >
              {isAdding ? "Adding..." : "Just Add The Skin"}
            </Button>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setCrossSellDialogOpen(false)}
              className="w-full text-xs h-8"
            >
              Continue Shopping
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
