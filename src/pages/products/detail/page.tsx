import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { useState, useMemo, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Link, useSearchParams, useNavigate, useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
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
  CopyIcon,
  MessageCircleIcon,
  CheckCircleIcon,
  ClockIcon,
  AlertCircleIcon,
  CoinsIcon
} from "lucide-react";
import { CartButton } from "@/components/cart.tsx";
import { HeaderSearch } from "@/components/header-search.tsx";
import { ProductCategoryHeader } from "@/components/product-category-header.tsx";
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
import { Label } from "@/components/ui/label.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { findMockupImageUrl, extractSKU, extractBrand } from "@/lib/mockups.ts";
import { trackProductView, trackAddToCart } from "@/lib/analytics.ts";
import { StockNotification } from "./_components/stock-notification.tsx";
import { ProductShareButton } from "./_components/product-share.tsx";
import { StickyBottomBar } from "./_components/sticky-bottom-bar.tsx";
import { FormattedDescription } from "./_components/formatted-description.tsx";
import { MobileHeader } from "@/components/mobile-header.tsx";
import { MobileNav } from "@/components/mobile-nav.tsx";
import { AnnouncementBar } from "@/components/announcement-bar.tsx";

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
  const params = useParams();
  const productId = searchParams.get('id');
  // Prioritize slug from URL params over query params
  const productSlug = params.slug || searchParams.get('slug');
  const phoneModel = searchParams.get('model');
  const phoneBrand = searchParams.get('brand');
  
  // Extended header filter state
  const [productCategory, setProductCategory] = useState<string | null>(
    searchParams.get('productType')
  );
  const [gadgetFilter, setGadgetFilter] = useState<string | null>(
    searchParams.get('gadget')
  );
  const [finishFilter, setFinishFilter] = useState<string | null>(
    searchParams.get('finish')
  );
  
  // Update filters callback
  const updateFilters = useCallback((updates: {
    productType?: string | null;
    gadget?: string | null;
    finish?: string | null;
  }) => {
    const newParams = new URLSearchParams(searchParams);
    
    if (updates.productType !== undefined) {
      setProductCategory(updates.productType);
      if (updates.productType) {
        newParams.set('productType', updates.productType);
      } else {
        newParams.delete('productType');
      }
      // Clear gadget and finish when changing category
      if (updates.gadget === undefined && updates.finish === undefined) {
        newParams.delete('gadget');
        newParams.delete('finish');
        setGadgetFilter(null);
        setFinishFilter(null);
      }
    }
    
    if (updates.gadget !== undefined) {
      setGadgetFilter(updates.gadget);
      if (updates.gadget) {
        newParams.set('gadget', updates.gadget);
      } else {
        newParams.delete('gadget');
      }
    }
    
    if (updates.finish !== undefined) {
      setFinishFilter(updates.finish);
      if (updates.finish) {
        newParams.set('finish', updates.finish);
      } else {
        newParams.delete('finish');
      }
    }
    
    navigate(`/products?${newParams.toString()}`, { replace: true });
  }, [searchParams, navigate]);
  
  // Model selector state
  const [modelDialogOpen, setModelDialogOpen] = useState(false);
  const [selectedBrand, setSelectedBrand] = useState<string>("");
  const [modelSearch, setModelSearch] = useState("");
  
  // UI state
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showStickyBar, setShowStickyBar] = useState(false);
  const [showOffersCollapsed, setShowOffersCollapsed] = useState(true);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewTitle, setReviewTitle] = useState("");
  const [reviewComment, setReviewComment] = useState("");
  const [reviewImages, setReviewImages] = useState<File[]>([]);
  const [reviewVideos, setReviewVideos] = useState<File[]>([]);
  const [uploadingReview, setUploadingReview] = useState(false);
  
  // Mockup image state
  const [mockupUrl, setMockupUrl] = useState<string | null>(null);
  const [mockupLoading, setMockupLoading] = useState(false);
  
  // Pincode state
  const [pincode, setPincode] = useState("");
  const [pincodeChecked, setPincodeChecked] = useState(false);
  
  // Model request dialog state
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);
  const [requestBrand, setRequestBrand] = useState("");
  const [requestNewBrand, setRequestNewBrand] = useState("");
  const [isNewBrand, setIsNewBrand] = useState(false);
  const [requestModel, setRequestModel] = useState("");
  const [requestCategory, setRequestCategory] = useState<string>("phone");
  const [requestWhatsApp, setRequestWhatsApp] = useState("");
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [confirmedNotMatch, setConfirmedNotMatch] = useState(false);
  
  // Query local database - support both id and slug parameters
  const productDataById = useQuery(
    api.products.getProduct, 
    productId ? { productId: productId as Id<"products"> } : "skip"
  );
  
  const productDataBySlug = useQuery(
    api.products.getProductBySlug, 
    productSlug ? { slug: productSlug } : "skip"
  );
  
  // Use whichever data loaded (prioritize id lookup)
  const productData = productDataById || productDataBySlug;
  
  // Determine device category from product data
  const deviceCategory = productData?.gadgetCategory || "phone";
  
  // Fetch models from database for the specific device category
  const deviceModelsFromDb = useQuery(api.supportedModels.listAll, { 
    category: deviceCategory as "phone" | "laptop" | "tablet" | "camera" | "lens" | "drone" | "charger" | "console" | "mac-mini",
    isActive: true 
  });
  
  // Group device models by brand from database
  const deviceModelsByBrand = useMemo(() => {
    if (!deviceModelsFromDb) return {};
    
    const grouped: Record<string, string[]> = {};
    deviceModelsFromDb.forEach(model => {
      if (!grouped[model.brandName]) {
        grouped[model.brandName] = [];
      }
      grouped[model.brandName].push(model.modelName);
    });
    
    // Sort models within each brand
    Object.keys(grouped).forEach(brand => {
      grouped[brand].sort();
    });
    
    return grouped;
  }, [deviceModelsFromDb]);
  
  // Keep phoneModelsByBrand for backward compatibility
  const phoneModelsByBrand = deviceModelsByBrand;
  
  // Filter models based on search
  const filteredModels = useMemo(() => {
    if (!modelSearch.trim()) return phoneModelsByBrand[selectedBrand] || [];
    
    const searchTerms = modelSearch
      .toLowerCase()
      .split(/\s+/)
      .filter((term) => term.length > 0);
    
    return (phoneModelsByBrand[selectedBrand] || []).filter((model) => {
      const modelLower = model.toLowerCase();
      return searchTerms.every((term) => modelLower.includes(term));
    });
  }, [selectedBrand, modelSearch, phoneModelsByBrand]);
  
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
  
  const reviews = useQuery(
    api.reviews.getProductReviews,
    productData ? { productId: productData._id } : "skip"
  );
  
  const reviewStats = useQuery(
    api.reviews.getReviewStats,
    productData ? { productId: productData._id } : "skip"
  );
  
  // Model request mutations and queries
  const createModelRequest = useMutation(api.modelRequests.createModelRequest);
  const similarModels = useQuery(
    api.modelRequests.findSimilarModels,
    requestModel.trim().length >= 2
      ? {
          brandName: !isNewBrand && requestBrand ? requestBrand : undefined,
          modelName: requestModel,
          category: requestCategory ? (requestCategory as "phone" | "tablet" | "laptop" | "console" | "charger" | "drone" | "camera" | "lens" | "mac-mini") : undefined,
        }
      : "skip"
  );
  
  // Get all brands for the request dialog
  const allBrands = useMemo(() => {
    if (!deviceModelsFromDb) return [];
    const brands = new Set(deviceModelsFromDb.map(m => m.brandName));
    return Array.from(brands).sort();
  }, [deviceModelsFromDb]);
  
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
  
  // Fetch applicable coupons for this product
  const applicableCoupons = useQuery(
    api.coupons.getCouponsForProduct,
    productData && productData.variants[0]
      ? { productId: productData._id, variantId: productData.variants[0]._id }
      : "skip"
  );
  
  // Fetch cashback info for this product
  const cashbackInfo = useQuery(
    api.cashbackHelpers.getProductCashbackInfo,
    productData ? { productId: productData._id } : "skip"
  );
  
  // Track product view
  useEffect(() => {
    if (productData && productData.variants.length > 0) {
      trackProductView(
        productData._id,
        productData.title,
        productData.variants[0].price
      );
    }
  }, [productData]);
  
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
  
  // Determine if this product needs device model selection
  // Includes: skins for phones, laptops, cameras, tablets, drones, etc.
  // Excludes: cases, covers, camera rings, tempered glass, accessories
  const needsDeviceSelector = productData ? (() => {
    const titleLower = productData.title.toLowerCase();
    const category = productData.gadgetCategory;
    
    // Exclude products that don't need model selection
    const isAccessory = 
      category === "accessory" ||
      category === "cover" ||
      titleLower.includes("case") ||
      titleLower.includes("cover") ||
      titleLower.includes("camera ring") ||
      titleLower.includes("tempered") ||
      titleLower.includes("glass") ||
      titleLower.includes("screen guard") ||
      titleLower.includes("protector");
    
    if (isAccessory) return false;
    
    // If it has a gadgetCategory that's device-specific, it needs selector
    if (category && ["phone", "laptop", "tablet", "camera", "lens", "drone", "console", "charger", "mac-mini"].includes(category)) {
      return true;
    }
    
    // Fallback: check if it's a skin
    const isSkin = titleLower.includes("skin") || titleLower.includes("membrane");
    return isSkin;
  })() : false;
  
  // Keep isPhoneSkin for backward compatibility (check if it's specifically a phone product)
  const isPhoneSkin = needsDeviceSelector && (deviceCategory === "phone" || !productData?.gadgetCategory);
  
  // Determine if product is a skin based on finishType field
  const isSkinProduct = !!productData?.finishType;
  
  // Fetch cross-sell products
  const crossSellProducts = useQuery(
    api.products.getCrossSellProducts,
    phoneBrand && isSkinProduct
      ? { phoneBrand: phoneBrand, isPhoneSkin: true }
      : "skip"
  );
  
  const addToCart = useMutation(api.cart.addToCart);
  const addReview = useMutation(api.reviews.addReview);
  const generateUploadUrl = useMutation(api.reviews.generateUploadUrl);
  const { user } = useAuth();
  const { addToGuestCart } = useGuestCart();
  const [selectedImage, setSelectedImage] = useState<string>("");
  const [selectedVariant, setSelectedVariant] = useState<number>(0);
  const [selectedCoverage, setSelectedCoverage] = useState<"only_back" | "full_body_wrap">("only_back");
  const [isAdding, setIsAdding] = useState(false);
  const [isBuyingNow, setIsBuyingNow] = useState(false);
  
  const isLoading = productData === undefined;
  const product = productData;
  
  // Automatically select the first image when displayImages changes (e.g., when mockup loads)
  useEffect(() => {
    if (displayImages.length > 0) {
      // Always select the first image (which will be the mockup if it exists)
      setSelectedImage(displayImages[0].url);
    }
  }, [displayImages]);
  
  // Automatically select "Full Body Wrap" when a mockup preview is loaded
  useEffect(() => {
    if (phoneModel && mockupFileUrl && isPhoneSkin) {
      setSelectedCoverage("full_body_wrap");
    }
  }, [phoneModel, mockupFileUrl, isPhoneSkin]);

  // Scroll listener for sticky bottom bar
  useEffect(() => {
    const handleScroll = () => {
      // Show sticky bar when scrolled past the buy now buttons
      const scrollPosition = window.scrollY;
      setShowStickyBar(scrollPosition > 600);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleAddToCart = async () => {
    if (!product) return;
    // Require model selection only for skin products
    if (isSkinProduct && needsDeviceSelector && !phoneModel) return;
    
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
      
      // Track add to cart event
      trackAddToCart(
        product._id,
        `${product.title} - ${product.variants[selectedVariant].title}`,
        product.variants[selectedVariant].price,
        1
      );
      
      toast.success("Added to cart!");
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
        
        // Track add to cart event
        trackAddToCart(
          product._id,
          `${product.title} - ${product.variants[selectedVariant].title}`,
          product.variants[selectedVariant].price,
          1
        );
        
        toast.success("Added to cart!");
      } else {
        toast.error("Failed to add to cart");
      }
    } finally {
      setIsAdding(false);
    }
  };

  const handleBuyNow = async () => {
    if (!product) return;
    // Require model selection only for skin products
    if (isSkinProduct && needsDeviceSelector && !phoneModel) {
      toast.error("Please select your device model first");
      return;
    }
    
    setIsBuyingNow(true);
    
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
      
      // Track add to cart event
      trackAddToCart(
        product._id,
        `${product.title} - ${product.variants[selectedVariant].title}`,
        product.variants[selectedVariant].price,
        1
      );
      
      // Navigate to checkout immediately
      navigate("/checkout");
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
        
        // Track add to cart event
        trackAddToCart(
          product._id,
          `${product.title} - ${product.variants[selectedVariant].title}`,
          product.variants[selectedVariant].price,
          1
        );
        
        // Navigate to checkout immediately
        navigate("/checkout");
      } else {
        toast.error("Failed to add to cart");
      }
    } finally {
      setIsBuyingNow(false);
    }
  };

  const handleAddReview = async () => {
    if (!product) return;
    
    if (!reviewTitle.trim() || !reviewComment.trim()) {
      toast.error("Please fill in all review fields");
      return;
    }
    
    setUploadingReview(true);
    
    try {
      // Upload images
      const imageStorageIds: string[] = [];
      for (const image of reviewImages) {
        const uploadUrl = await generateUploadUrl();
        const result = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": image.type },
          body: image,
        });
        const { storageId } = await result.json();
        imageStorageIds.push(storageId);
      }
      
      // Upload videos
      const videoStorageIds: string[] = [];
      for (const video of reviewVideos) {
        const uploadUrl = await generateUploadUrl();
        const result = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": video.type },
          body: video,
        });
        const { storageId } = await result.json();
        videoStorageIds.push(storageId);
      }
      
      // Submit review
      await addReview({
        productId: product._id,
        rating: reviewRating,
        title: reviewTitle,
        comment: reviewComment,
        images: imageStorageIds.length > 0 ? imageStorageIds : undefined,
        videos: videoStorageIds.length > 0 ? videoStorageIds : undefined,
      });
      
      toast.success("Review added successfully!");
      setReviewDialogOpen(false);
      setReviewTitle("");
      setReviewComment("");
      setReviewRating(5);
      setReviewImages([]);
      setReviewVideos([]);
    } catch (error) {
      if (error instanceof ConvexError) {
        const { message } = error.data as { code: string; message: string };
        toast.error(message);
      } else {
        toast.error("Failed to add review");
      }
    } finally {
      setUploadingReview(false);
    }
  };
  
  const handleSubmitRequest = async () => {
    // Validate form
    const finalBrand = isNewBrand ? requestNewBrand : requestBrand;
    if (!finalBrand.trim()) {
      toast.error("Please select or enter a brand");
      return;
    }
    if (!requestModel.trim()) {
      toast.error("Please enter a model name");
      return;
    }
    if (!requestCategory) {
      toast.error("Please select a device category");
      return;
    }
    if (!requestWhatsApp.trim()) {
      toast.error("Please enter your WhatsApp number");
      return;
    }
    
    // Validate WhatsApp number format (10 digits)
    const cleanedPhone = requestWhatsApp.replace(/\D/g, "");
    if (cleanedPhone.length !== 10) {
      toast.error("Please enter a valid 10-digit phone number");
      return;
    }
    
    // If similar models exist and user hasn't confirmed, show warning
    if (similarModels && similarModels.length > 0 && !confirmedNotMatch) {
      toast.error("Please confirm that your model doesn't match any of the similar models listed");
      return;
    }

    setIsSubmittingRequest(true);
    try {
      await createModelRequest({
        brandName: finalBrand,
        modelName: requestModel.trim(),
        category: requestCategory as "phone" | "tablet" | "laptop" | "console" | "charger" | "drone" | "camera" | "lens" | "mac-mini",
        whatsappPhone: "+91" + cleanedPhone,
      });
      
      toast.success("Request submitted! We'll notify you on WhatsApp when it's added.");
      
      // Reset form
      setRequestDialogOpen(false);
      setRequestBrand("");
      setRequestNewBrand("");
      setIsNewBrand(false);
      setRequestModel("");
      setRequestCategory("phone");
      setRequestWhatsApp("");
      setConfirmedNotMatch(false);
    } catch (error) {
      toast.error("Failed to submit request. Please try again.");
      console.error(error);
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background pb-20">
        {/* Announcement Bar */}
        <AnnouncementBar />
        
        {/* Mobile-First Header */}
        <MobileHeader 
          onMenuClick={() => setIsMobileMenuOpen(true)}
          onRequestModelClick={() => setRequestDialogOpen(true)}
        />

        {/* Mobile Navigation Sheet */}
        <MobileNav 
          open={isMobileMenuOpen}
          onOpenChange={setIsMobileMenuOpen}
        />

        <div className="pt-32 px-4">
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
        <div className="min-h-screen bg-background pb-20">
          {/* Announcement Bar */}
          <AnnouncementBar />
          
          {/* Mobile-First Header */}
          <MobileHeader 
            onMenuClick={() => setIsMobileMenuOpen(true)}
            onRequestModelClick={() => setRequestDialogOpen(true)}
          />

          {/* Mobile Navigation Sheet */}
          <MobileNav 
            open={isMobileMenuOpen}
            onOpenChange={setIsMobileMenuOpen}
          />

          <div className="pt-32 px-4">
            <div className="container mx-auto max-w-2xl text-center space-y-6">
              <div className="flex justify-center">
                <div className="size-20 rounded-full bg-muted flex items-center justify-center">
                  <AlertTriangleIcon className="size-10 text-muted-foreground" />
                </div>
              </div>
              <div className="space-y-2">
                <h1 className="text-3xl font-bold">Product Not Found</h1>
                <p className="text-muted-foreground text-lg">
                  Sorry, the product you're looking for doesn't exist or may have been removed.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
                <Button asChild size="lg">
                  <Link to="/products">
                    <PackageIcon className="size-4 mr-2" />
                    Browse All Products
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link to="/">
                    <ArrowLeftIcon className="size-4 mr-2" />
                    Back to Home
                  </Link>
                </Button>
              </div>
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

  // Get product URL
  const productUrl = `https://goskinly.com/products/${product?.slug || 'detail'}`;
  
  // Get product image for OG tags
  const productImage = displayImages[0]?.url || product?.images[0]?.url || 'https://cdn.hercules.app/file_Qd06a0OWqeC2LadTl4tLLvmv';
  
  // Get product price for OG tags
  const productPrice = product?.variants[selectedVariant]?.price || minPrice;

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* SEO Meta Tags */}
      <Helmet>
        <title>{productData?.metaTitle || productData?.title || "Product"} | Skinly</title>
        {productData?.metaDescription && (
          <meta name="description" content={productData.metaDescription} />
        )}
        
        {/* Open Graph Tags */}
        <meta property="og:type" content="product" />
        <meta property="og:title" content={`${productData?.metaTitle || productData?.title || "Product"} | Skinly`} />
        <meta property="og:description" content={productData?.metaDescription || `Shop ${productData?.title} at Skinly. Premium quality phone skins and accessories.`} />
        <meta property="og:url" content={productUrl} />
        <meta property="og:image" content={productImage} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:site_name" content="Skinly" />
        
        {/* Product-specific OG tags */}
        <meta property="product:price:amount" content={productPrice.toString()} />
        <meta property="product:price:currency" content="INR" />
        {product?.status === "active" && (
          <meta property="product:availability" content="in stock" />
        )}
        
        {/* Twitter Card Tags */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={`${productData?.metaTitle || productData?.title || "Product"} | Skinly`} />
        <meta name="twitter:description" content={productData?.metaDescription || `Shop ${productData?.title} at Skinly. Premium quality phone skins and accessories.`} />
        <meta name="twitter:image" content={productImage} />
        <meta name="twitter:site" content="@goskinly" />
      </Helmet>

      {/* Announcement Bar */}
      <AnnouncementBar />
      
      {/* Mobile-First Header */}
      <MobileHeader 
        onMenuClick={() => setIsMobileMenuOpen(true)}
        onRequestModelClick={() => setRequestDialogOpen(true)}
      />

      {/* Mobile Navigation Sheet */}
      <MobileNav 
        open={isMobileMenuOpen}
        onOpenChange={setIsMobileMenuOpen}
      />

      {/* Product Detail Section */}
      <section className="pt-24 pb-12 px-4">
        <div className="container mx-auto max-w-6xl">
          <Button variant="ghost" size="sm" asChild className="mb-4">
            <Link to="/products">
              <ArrowLeftIcon className="size-4 mr-2" />
              Back
            </Link>
          </Button>

          {/* Reference Message Banner - Above Images */}
          {isSkinProduct && (
            <div className="mb-4 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
              <div className="flex items-start gap-2 text-sm">
                <InfoIcon className="size-4 text-amber-600 shrink-0 mt-0.5" />
                <span className="text-foreground">
                  Model images are for reference only - You will receive the skin for your selected model
                </span>
              </div>
            </div>
          )}

          <div className="grid md:grid-cols-[45%_1fr] lg:grid-cols-[450px_1fr] gap-6 md:gap-8 mb-12">
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
                      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 md:bottom-auto md:top-3 md:left-auto md:right-3 md:translate-x-0 bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-xs font-semibold shadow-lg text-center leading-tight">
                        <div>Preview on {phoneModel}</div>
                        <div className="text-[10px] mt-0.5 opacity-90">Full Body Wrap</div>
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
              {/* Title and Share */}
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h1 className="text-2xl md:text-3xl font-bold flex-1">{product.title}</h1>
                  <ProductShareButton
                    productTitle={product.title}
                    productUrl={productUrl}
                  />
                </div>
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

              {/* USPs - Only for skin products */}
              {isSkinProduct && (
                <div className="space-y-2">
                  {skinUSPs.slice(1).map((usp, idx) => (
                    <div 
                      key={idx} 
                      className="flex items-start gap-2 text-sm"
                    >
                      <usp.icon className="size-4 shrink-0 mt-0.5 text-primary" />
                      <span className="text-muted-foreground">{usp.text}</span>
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
                    <div className="mt-3">
                      <FormattedDescription description={product.description} />
                    </div>
                  )}
                </div>
              )}

              {/* Device Model Selection - Only for skin products */}
              {isSkinProduct && needsDeviceSelector && (
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

                    {/* Coverage Selection - Only for skin products */}
                    {isSkinProduct && (
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
                    )}
                  </div>
                ) : (
                  <Card className="border-amber-500/50 bg-amber-500/10">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="text-xl shrink-0">
                          {deviceCategory === "phone" && "📱"}
                          {deviceCategory === "laptop" && "💻"}
                          {deviceCategory === "tablet" && "📱"}
                          {deviceCategory === "camera" && "📷"}
                          {deviceCategory === "lens" && "🔍"}
                          {deviceCategory === "drone" && "🚁"}
                          {deviceCategory === "console" && "🎮"}
                          {deviceCategory === "charger" && "🔌"}
                          {!deviceCategory && "📦"}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-semibold">Select Your Device</p>
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
              
              {/* Add to Cart and Buy Now buttons */}
              {productData.variants[selectedVariant].inventoryQuantity > 0 ? (
                <div className="flex gap-3">
                  <Button
                    className="flex-1"
                    size="lg"
                    variant="outline"
                    onClick={() => {
                      // Only require device model for skin products
                      if (isSkinProduct && needsDeviceSelector && !phoneModel) {
                        toast.error("Please select your device model first");
                        return;
                      }
                      handleAddToCart();
                    }}
                    disabled={isAdding || isBuyingNow || (isSkinProduct && needsDeviceSelector && !phoneModel)}
                  >
                    <ShoppingCartIcon className="size-5 mr-2" />
                    {isAdding ? "Adding..." : "Add to Cart"}
                  </Button>
                  <Button
                    className="flex-1 animate-shake"
                    size="lg"
                    onClick={handleBuyNow}
                    disabled={isAdding || isBuyingNow || (isSkinProduct && needsDeviceSelector && !phoneModel)}
                  >
                    <ZapIcon className="size-5 mr-2" />
                    {isBuyingNow ? "Processing..." : "Buy Now"}
                  </Button>
                </div>
              ) : (
                <StockNotification
                  variantId={productData.variants[selectedVariant]._id}
                  variantTitle={productData.variants[selectedVariant].title}
                />
              )}
              
              {/* Pincode Delivery Checker */}
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    type="text"
                    placeholder="Enter Pincode"
                    value={pincode}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                      setPincode(value);
                      setPincodeChecked(false);
                    }}
                    maxLength={6}
                    className="flex-1"
                  />
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (!/^\d{6}$/.test(pincode)) {
                        toast.error("Please enter a valid 6-digit pincode");
                        return;
                      }
                      setPincodeChecked(true);
                    }}
                  >
                    Check
                  </Button>
                </div>
                
                {pincodeChecked && /^\d{6}$/.test(pincode) && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircleIcon className="size-4 text-green-600 shrink-0" />
                      <span className="text-green-700 font-semibold">Yay, delivery is available!</span>
                    </div>
                    <div className="flex items-start gap-2 text-sm">
                      <TruckIcon className="size-4 text-green-600 shrink-0 mt-0.5" />
                      <span className="text-green-700">
                        Estimated delivery: {new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} - {new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <ClockIcon className="size-4 text-green-600 shrink-0" />
                      <span className="text-green-700">Dispatches next working day</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Shipping & Delivery Info - Compact Icon-Based */}
              <div className="border border-border rounded-lg p-4">
                <h3 className="font-semibold text-sm mb-3">Delivery & Policy</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2 text-sm">
                    <ZapIcon className="size-4 text-primary shrink-0" />
                    <span className="text-muted-foreground text-xs">Fast Shipping</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <MapPinIcon className="size-4 text-primary shrink-0" />
                    <span className="text-muted-foreground text-xs">Pan India</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <XCircleIcon className="size-4 text-red-500 shrink-0" />
                    <span className="text-muted-foreground text-xs">Non Returnable</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <BanknoteIcon className="size-4 text-red-500 shrink-0" />
                    <span className="text-muted-foreground text-xs">COD Not Available</span>
                  </div>
                </div>
                
                {isSkinProduct && (
                  <div className="flex items-start gap-2 text-sm bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 mt-3">
                    <AlertTriangleIcon className="size-4 text-amber-600 shrink-0 mt-0.5" />
                    <span className="text-foreground text-xs">
                      <strong>Custom Cut:</strong> No cancellation or changes after confirmation.
                    </span>
                  </div>
                )}
              </div>
              
              {/* Active Offers Section - Collapsible */}
              {applicableCoupons && applicableCoupons.length > 0 && (
                <div className="border border-border rounded-lg">
                  <button
                    onClick={() => setShowOffersCollapsed(!showOffersCollapsed)}
                    className="w-full flex items-center justify-between p-4"
                  >
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <TagIcon className="size-4 text-primary" />
                      <span>Offers ({applicableCoupons.length})</span>
                    </div>
                    {showOffersCollapsed ? (
                      <ChevronDownIcon className="size-4" />
                    ) : (
                      <ChevronUpIcon className="size-4" />
                    )}
                  </button>
                  
                  {!showOffersCollapsed && (
                    <div className="px-4 pb-4 space-y-2">
                      {applicableCoupons.map((coupon: { _id: string; code: string; discountType: string; discountValue: number; maxDiscount?: number; description: string; minPurchase?: number }) => {
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
                  )}
                </div>
              )}
              
              {/* Cashback Section */}
              {cashbackInfo && cashbackInfo.hasCashback && (
                <div className="border border-amber-500/50 rounded-lg p-3 bg-gradient-to-r from-amber-500/10 to-yellow-500/10">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center size-10 rounded-full bg-amber-500/20 shrink-0">
                      <CoinsIcon className="size-5 text-amber-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-bold text-amber-900 dark:text-amber-100">
                          Earn {cashbackInfo.displayText} Skinly Coins
                        </span>
                      </div>
                      <p className="text-xs text-amber-800 dark:text-amber-200">
                        Get cashback on this purchase! Redeem on your next order.
                      </p>
                    </div>
                    <SparklesIcon className="size-5 text-amber-500 shrink-0" />
                  </div>
                </div>
              )}
              
              {/* WhatsApp Support Button - Secondary */}
              <Button
                variant="outline"
                className="w-full border-[#25D366] text-[#25D366] hover:bg-[#25D366]/10"
                size="lg"
                onClick={() => {
                  const phoneNumber = "917505273504";
                  const message = encodeURIComponent("Hey Skinly Team , I have a query regarding my purchase");
                  window.open(`https://wa.me/${phoneNumber}?text=${message}`, "_blank");
                }}
              >
                <MessageCircleIcon className="size-5 mr-2" />
                WhatsApp Support
              </Button>
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
                        <p className="text-sm text-muted-foreground mb-3">{review.comment}</p>
                        
                        {/* Review Media */}
                        {((review.imageUrls && review.imageUrls.length > 0) ||
                          (review.videoUrls && review.videoUrls.length > 0)) && (
                          <div className="space-y-3 mt-4">
                            {/* Images */}
                            {review.imageUrls && review.imageUrls.length > 0 && (
                              <div className="flex gap-2 overflow-x-auto">
                                {review.imageUrls.map((url, idx) => (
                                  <img
                                    key={idx}
                                    src={url}
                                    alt={`Review image ${idx + 1}`}
                                    className="h-32 w-32 rounded-lg object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                    onClick={() => window.open(url, '_blank')}
                                  />
                                ))}
                              </div>
                            )}
                            {/* Videos */}
                            {review.videoUrls && review.videoUrls.length > 0 && (
                              <div className="flex gap-2 overflow-x-auto">
                                {review.videoUrls.map((url, idx) => (
                                  <video
                                    key={idx}
                                    src={url}
                                    controls
                                    className="h-40 rounded-lg"
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-muted/30 rounded-lg p-8 text-center">
                <StarIcon className="size-10 text-muted-foreground mx-auto mb-3" />
                <h3 className="text-base font-semibold mb-2">No reviews yet</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Be the first to review this product
                </p>
                <Button 
                  size="sm"
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
                <DialogTitle>Select Device Brand</DialogTitle>
                <DialogDescription>Choose your device brand to see available models</DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 overflow-y-auto pr-2">
                {Object.keys(phoneModelsByBrand).sort().map((brand) => (
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
                    <p className="text-sm text-muted-foreground">Can't find your model?</p>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setModelDialogOpen(false);
                        setRequestDialogOpen(true);
                      }}
                    >
                      Request Your Model →
                    </Button>
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
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
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
            
            {/* Image Upload */}
            <div>
              <label className="text-sm font-semibold mb-2 block">
                Images {reviewImages.length > 0 && `(${reviewImages.length})`}
              </label>
              <Input
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  setReviewImages((prev) => [...prev, ...files]);
                }}
              />
              {reviewImages.length > 0 && (
                <div className="mt-2 flex gap-2 flex-wrap">
                  {reviewImages.map((file, idx) => (
                    <div key={idx} className="relative">
                      <img
                        src={URL.createObjectURL(file)}
                        alt={`Preview ${idx + 1}`}
                        className="h-20 w-20 rounded object-cover"
                      />
                      <Button
                        size="icon"
                        variant="destructive"
                        className="absolute -right-2 -top-2 size-6 rounded-full"
                        onClick={() => {
                          setReviewImages((prev) => prev.filter((_, i) => i !== idx));
                        }}
                      >
                        ×
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {/* Video Upload */}
            <div>
              <label className="text-sm font-semibold mb-2 block">
                Videos {reviewVideos.length > 0 && `(${reviewVideos.length})`}
              </label>
              <Input
                type="file"
                accept="video/*"
                multiple
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  setReviewVideos((prev) => [...prev, ...files]);
                }}
              />
              {reviewVideos.length > 0 && (
                <div className="mt-2 flex gap-2 flex-wrap">
                  {reviewVideos.map((file, idx) => (
                    <div key={idx} className="relative">
                      <video
                        src={URL.createObjectURL(file)}
                        className="h-20 rounded"
                        controls
                      />
                      <Button
                        size="icon"
                        variant="destructive"
                        className="absolute -right-2 -top-2 size-6 rounded-full"
                        onClick={() => {
                          setReviewVideos((prev) => prev.filter((_, i) => i !== idx));
                        }}
                      >
                        ×
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="flex gap-2 justify-end">
              <Button 
                variant="outline" 
                onClick={() => {
                  setReviewDialogOpen(false);
                  setReviewImages([]);
                  setReviewVideos([]);
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleAddReview} disabled={uploadingReview}>
                {uploadingReview ? "Uploading..." : "Submit Review"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Request Model Dialog */}
      <Dialog 
        open={requestDialogOpen} 
        onOpenChange={(open) => {
          setRequestDialogOpen(open);
          if (!open) {
            // Reset form when dialog closes
            setRequestBrand("");
            setRequestNewBrand("");
            setIsNewBrand(false);
            setRequestModel("");
            setRequestCategory("phone");
            setRequestWhatsApp("");
            setConfirmedNotMatch(false);
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">Request a Device Model</DialogTitle>
            <DialogDescription>
              Can't find your device? Let us know and we'll add it to our database.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Brand Selection */}
            <div className="space-y-2">
              <Label>Brand *</Label>
              <Select 
                value={isNewBrand ? "other_new_brand" : requestBrand} 
                onValueChange={(value) => {
                  if (value === "other_new_brand") {
                    setIsNewBrand(true);
                    setRequestBrand("");
                  } else {
                    setIsNewBrand(false);
                    setRequestBrand(value);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a brand" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {allBrands.map((brand) => (
                    <SelectItem key={brand} value={brand}>
                      {brand}
                    </SelectItem>
                  ))}
                  <SelectItem value="other_new_brand">Other (New Brand)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Custom Brand Input */}
            {isNewBrand && (
              <div className="space-y-2">
                <Label>Enter New Brand Name *</Label>
                <Input
                  type="text"
                  placeholder="Enter brand name"
                  value={requestNewBrand}
                  onChange={(e) => setRequestNewBrand(e.target.value)}
                />
              </div>
            )}

            {/* Model Name */}
            <div className="space-y-2">
              <Label>Model Name *</Label>
              <Input
                type="text"
                placeholder="e.g., iPhone 15 Pro Max"
                value={requestModel}
                onChange={(e) => setRequestModel(e.target.value)}
              />
            </div>

            {/* Similar Models Warning */}
            {similarModels && similarModels.length > 0 && (
              <div className="p-4 border-2 border-yellow-500/50 bg-yellow-500/5 rounded-lg space-y-3">
                <div className="flex items-start gap-2">
                  <AlertCircleIcon className="size-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-semibold text-yellow-900 dark:text-yellow-100 mb-2">
                      Similar models found in our database:
                    </p>
                    <ul className="space-y-1 mb-3">
                      {similarModels.slice(0, 5).map((model, idx) => (
                        <li key={idx} className="text-sm text-yellow-800 dark:text-yellow-200">
                          • {model.brandName} {model.modelName}
                        </li>
                      ))}
                    </ul>
                    <div className="flex items-start gap-2 mt-3 p-3 bg-yellow-500/10 rounded">
                      <Checkbox
                        id="confirm-not-match"
                        checked={confirmedNotMatch}
                        onCheckedChange={(checked) => setConfirmedNotMatch(checked === true)}
                      />
                      <label
                        htmlFor="confirm-not-match"
                        className="text-sm font-medium leading-tight cursor-pointer"
                      >
                        I confirm my device model is different from the models listed above
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Category Selection */}
            <div className="space-y-2">
              <Label>Device Category *</Label>
              <Select value={requestCategory} onValueChange={setRequestCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="phone">Phone</SelectItem>
                  <SelectItem value="tablet">Tablet</SelectItem>
                  <SelectItem value="laptop">Laptop</SelectItem>
                  <SelectItem value="console">Gaming Console</SelectItem>
                  <SelectItem value="charger">Charger</SelectItem>
                  <SelectItem value="drone">Drone</SelectItem>
                  <SelectItem value="camera">Camera</SelectItem>
                  <SelectItem value="lens">Camera Lens</SelectItem>
                  <SelectItem value="mac-mini">Mac Mini</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* WhatsApp Number */}
            <div className="space-y-2">
              <Label>WhatsApp Number *</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground px-3 py-2 bg-muted rounded-md">
                  +91
                </span>
                <Input
                  type="tel"
                  placeholder="9876543210"
                  value={requestWhatsApp}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, "").slice(0, 10);
                    setRequestWhatsApp(value);
                  }}
                  className="flex-1"
                  maxLength={10}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                We'll notify you on WhatsApp when your device is added
              </p>
            </div>

            {/* Submit Button */}
            <div className="flex gap-3 pt-4">
              <Button
                onClick={handleSubmitRequest}
                disabled={isSubmittingRequest}
                className="flex-1"
              >
                {isSubmittingRequest ? "Submitting..." : "Submit Request"}
              </Button>
              <Button
                variant="outline"
                onClick={() => setRequestDialogOpen(false)}
                disabled={isSubmittingRequest}
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Sticky Bottom Bar */}
      <StickyBottomBar
        price={priceDisplay}
        onBuyNow={handleBuyNow}
        disabled={isSkinProduct && needsDeviceSelector && !phoneModel}
        isLoading={isBuyingNow}
        show={showStickyBar}
      />
    </div>
  );
}
