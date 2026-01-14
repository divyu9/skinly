import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { useState, useMemo, useEffect } from "react";
import { useSearchParams, useParams } from "react-router-dom";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { findMockupImageUrl, extractSKU, extractBrand } from "@/lib/mockups.ts";
import { trackProductView } from "@/lib/analytics.ts";

export interface ProductState {
  selectedImage: string;
  selectedVariant: number;
  selectedCoverage: "only_back" | "full_body_wrap";
  showFullDescription: boolean;
  showStickyBar: boolean;
  showOffersCollapsed: boolean;
}

export interface MockupState {
  url: string | null;
  loading: boolean;
}

export function useProductDetail() {
  const [searchParams] = useSearchParams();
  const params = useParams();
  
  // URL params
  const productId = searchParams.get('id');
  const productSlug = params.slug || searchParams.get('slug');
  const phoneModel = searchParams.get('model');
  const phoneBrand = searchParams.get('brand');
  
  // Product state
  const [productState, setProductState] = useState<ProductState>({
    selectedImage: "",
    selectedVariant: 0,
    selectedCoverage: "full_body_wrap",
    showFullDescription: false,
    showStickyBar: false,
    showOffersCollapsed: false,
  });
  
  // Mockup state
  const [mockupState, setMockupState] = useState<MockupState>({
    url: null,
    loading: false,
  });
  
  // Queries
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
  const isLoading = productData === undefined;
  
  // Query mockup file URL from database
  // Use phoneBrand from URL params if available, otherwise try to extract from model name
  const mockupFileUrl = useQuery(
    api.mockups.getMockupFileId,
    phoneModel && productData
      ? {
          brand: phoneBrand || extractBrand(phoneModel) || "",
          model: phoneModel,
          sku: extractSKU(productData.title, productData.variants[0]?.sku) || "",
        }
      : "skip"
  );
  
  // Fetch applicable coupons
  const applicableCoupons = useQuery(
    api.coupons.getCouponsForProduct,
    productData && productData.variants[0]
      ? { productId: productData._id, variantId: productData.variants[0]._id }
      : "skip"
  );
  
  // Fetch cashback info
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
  }, [productData?._id]);
  
  // Fetch mockup image URL
  useEffect(() => {
    if (!phoneModel || !productData) {
      setMockupState({ url: null, loading: false });
      return;
    }
    
    const firstVariantSku = productData.variants[0]?.sku;
    const sku = extractSKU(productData.title, firstVariantSku);
    
    if (!sku) {
      setMockupState({ url: null, loading: false });
      return;
    }
    
    // If mockupFileUrl is undefined, it's still loading
    if (mockupFileUrl === undefined) {
      setMockupState(prev => ({ ...prev, loading: true }));
      return;
    }
    
    if (mockupFileUrl) {
      setMockupState({ url: mockupFileUrl, loading: false });
    } else {
      // No mockup in database, try legacy fallback
      setMockupState(prev => ({ ...prev, loading: true }));
      findMockupImageUrl(phoneModel, sku, null)
        .then(url => setMockupState({ url, loading: false }))
        .catch(() => setMockupState({ url: null, loading: false }));
    }
  }, [phoneModel, productData?._id, mockupFileUrl]);
  
  // Default logo image URL (used as placeholder when no product images uploaded)
  const DEFAULT_LOGO_IMAGE = "https://res.cloudinary.com/dcpjatdxs/image/upload/v1767710585/products/abstract-art-multi/img_2_1767710584949.webp";

  // Display images with mockup priority
  // Logic: If mockup exists, show mockup first. If only logo image exists, show it after mockup.
  const displayImages = useMemo(() => {
    if (!productData) return [];

    // Helper to check if an image is the default logo
    const isDefaultLogo = (url: string) => url.includes("img_2_1767710584949") || url === DEFAULT_LOGO_IMAGE;

    if (!phoneModel) {
      return productData.images;
    }

    const images = [];

    // Add mockup image if found
    if (mockupState.url) {
      images.push({
        url: mockupState.url,
        alt: `${productData.title} - ${phoneModel} Preview`,
        phoneModel: phoneModel,
      });
    }

    // Find model-specific images
    const modelSpecificImages = productData.images.filter(
      (img) => img.phoneModel?.toLowerCase() === phoneModel.toLowerCase()
    );

    if (modelSpecificImages.length > 0) {
      images.push(...modelSpecificImages);
    }

    // Add default images - but if mockup exists, push logo images to the end
    const defaultImages = productData.images.filter((img) => !img.phoneModel);

    if (mockupState.url) {
      // Separate logo images from other images
      const logoImages = defaultImages.filter(img => isDefaultLogo(img.url));
      const otherImages = defaultImages.filter(img => !isDefaultLogo(img.url));

      // Add non-logo images first, then logo images at the end
      images.push(...otherImages);
      images.push(...logoImages);
    } else {
      // No mockup - just add all default images in order
      images.push(...defaultImages);
    }

    return images.length > 0 ? images : productData.images;
  }, [productData, phoneModel, mockupState.url]);
  
  // Auto-select first image when displayImages changes
  useEffect(() => {
    if (displayImages.length > 0) {
      setProductState(prev => ({ ...prev, selectedImage: displayImages[0].url }));
    }
  }, [displayImages]);
  
  // Auto-select full body wrap when mockup loads
  useEffect(() => {
    if (phoneModel && mockupFileUrl) {
      setProductState(prev => ({ ...prev, selectedCoverage: "full_body_wrap" }));
    }
  }, [phoneModel, mockupFileUrl]);
  
  // Scroll listener for sticky bar
  useEffect(() => {
    const STICKY_THRESHOLD = 600;
    const handleScroll = () => {
      setProductState(prev => ({
        ...prev,
        showStickyBar: window.scrollY > STICKY_THRESHOLD
      }));
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);
  
  // SEO meta data
  const seoMeta = useMemo(() => {
    if (!productData) return null;
    
    const productUrl = `https://goskinly.com/products/${productData.slug || 'detail'}`;
    const productImage = displayImages[0]?.url || productData.images[0]?.url || 'https://cdn.hercules.app/file_Qd06a0OWqeC2LadTl4tLLvmv';
    const productPrice = productData.variants[productState.selectedVariant]?.price || 0;
    
    return {
      title: productData.metaTitle || `${productData.title} | Skinly`,
      description: productData.metaDescription || `Shop ${productData.title} at Skinly. Premium quality skins and wraps.`,
      url: productUrl,
      image: productImage,
      price: productPrice,
      isActive: productData.status === "active",
    };
  }, [productData, displayImages, productState.selectedVariant]);
  
  // Price display
  const priceDisplay = useMemo(() => {
    if (!productData) return "";
    const prices = productData.variants.map(v => v.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    return minPrice === maxPrice 
      ? `₹${minPrice.toFixed(0)}`
      : `₹${minPrice.toFixed(0)} - ₹${maxPrice.toFixed(0)}`;
  }, [productData]);
  
  // Update product state helper
  const updateProductState = (updates: Partial<ProductState>) => {
    setProductState(prev => ({ ...prev, ...updates }));
  };
  
  return {
    // URL params
    productId,
    productSlug,
    phoneModel,
    phoneBrand,
    
    // Data
    productData,
    isLoading,
    displayImages,
    applicableCoupons,
    cashbackInfo,
    seoMeta,
    priceDisplay,
    
    // State
    productState,
    updateProductState,
    mockupState,
  };
}
