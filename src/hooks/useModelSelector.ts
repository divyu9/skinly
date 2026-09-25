import { useQuery, useMutation } from "@/lib/firebase-hooks";
import { api } from "@/lib/firebase-api";
import { useState, useMemo, useCallback, useEffect } from "react";
import { brandInScope } from "@/lib/device-fit";
import { searchModels } from "@/lib/laptop-body";
import { siblingListingFor, type ListingLike } from "@/lib/listing-siblings";
import { brandKey, loadCatalogue } from "@/lib/catalogue";
import { useSearchParams, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";

interface ModelSelectorState {
  dialogOpen: boolean;
  selectedBrand: string;
  searchQuery: string;
}

interface RequestFormState {
  dialogOpen: boolean;
  brand: string;
  newBrand: string;
  isNewBrand: boolean;
  model: string;
  category: string;
  whatsApp: string;
  confirmedNotMatch: boolean;
  isSubmitting: boolean;
}

export function useModelSelector(
  deviceCategory: string = "phone",
  // The listing's brands: an "Apple iPad Skin" offers iPads only.
  brandScope: { modelBrands?: string[]; modelBrandsExclude?: string[] } = {},
  // This listing, so a brand it leaves to its own listing can be sent there.
  listing: ListingLike = {}
) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const params = useParams();
  
  const productId = searchParams.get('id');
  const productSlug = params.slug || searchParams.get('slug');
  
  // Model selector state
  const [selectorState, setSelectorState] = useState<ModelSelectorState>({
    dialogOpen: false,
    selectedBrand: "",
    searchQuery: "",
  });
  
  // Request form state
  const [requestState, setRequestState] = useState<RequestFormState>({
    dialogOpen: false,
    brand: "",
    newBrand: "",
    isNewBrand: false,
    model: "",
    category: "phone",
    whatsApp: "",
    confirmedNotMatch: false,
    isSubmitting: false,
  });
  
  // Fetch models from database
  const deviceModelsFromDb = useQuery(
    api.supportedModels.listAll,
    selectorState.dialogOpen || requestState.dialogOpen
      ? { category: deviceCategory, isActive: true }
      : "skip"
  );
  
  // Group models by brand
  const modelsByBrand = useMemo(() => {
    if (!deviceModelsFromDb) return {};
    
    const grouped: Record<string, string[]> = {};
    // Only a listing's own-brand list narrows the picker. Brands a catch-all
    // leaves to their own listing are still offered: picking one goes there
    // (handleModelSelect), instead of the shopper finding no Samsung on the
    // Android Phone listing and leaving.
    const onlyScope = { modelBrands: brandScope.modelBrands };
    deviceModelsFromDb.forEach(model => {
      if (!brandInScope(onlyScope, model.brandName)) return;
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
  }, [deviceModelsFromDb, (brandScope.modelBrands || []).join("|"), (brandScope.modelBrandsExclude || []).join("|")]);
  
  // All brands list
  const allBrands = useMemo(() => {
    return Object.keys(modelsByBrand).sort();
  }, [modelsByBrand]);
  
  /*
   * Open on the models, not the brands, whenever the brand is already known.
   *
   * One brand to choose from is no choice. Neither is arriving from
   * /vivo-phone-skins and being asked which brand you own — the page that
   * sent you here answered that, and its product links now carry `?brand=`.
   * Matched loosely because the link spells it as the catalogue does ("One
   * Plus") and the model list may not.
   */
  const urlBrand = searchParams.get("brand");
  useEffect(() => {
    if (!selectorState.dialogOpen || selectorState.selectedBrand) return;
    if (allBrands.length === 1) {
      setSelectorState(prev => ({ ...prev, selectedBrand: allBrands[0] }));
      return;
    }
    if (!urlBrand) return;
    const key = (b: string) => b.toLowerCase().replace(/[^a-z0-9]/g, "");
    const hit = allBrands.find((b) => key(b) === key(urlBrand));
    if (hit) setSelectorState(prev => ({ ...prev, selectedBrand: hit }));
  }, [selectorState.dialogOpen, selectorState.selectedBrand, allBrands, urlBrand]);

  // Filter models based on search. Spacing and hyphens don't matter ("15s fq"
  // finds "15S FQ1107TU"), and a laptop's sticker number also finds the
  // models that share its body (src/lib/laptop-body.ts).
  const { filteredModels, sameBodyModels } = useMemo(() => {
    const models = modelsByBrand[selectorState.selectedBrand] || [];
    const r = searchModels(selectorState.selectedBrand, models, selectorState.searchQuery, deviceCategory);
    return { filteredModels: r.models, sameBodyModels: r.sameBody };
  }, [selectorState.selectedBrand, selectorState.searchQuery, modelsByBrand, deviceCategory]);
  
  // Similar models for request form
  const similarModels = useQuery(
    api.modelRequests.findSimilarModels,
    requestState.model.trim().length >= 2
      ? {
          brandName: !requestState.isNewBrand && requestState.brand ? requestState.brand : undefined,
          modelName: requestState.model,
          category: requestState.category as "phone" | "tablet" | "laptop" | "console" | "charger" | "drone" | "camera" | "lens" | "mac-mini" | undefined,
        }
      : "skip"
  );
  
  const createModelRequest = useMutation(api.modelRequests.createModelRequest);
  
  // Handle model selection
  const handleModelSelect = useCallback(async (model: string, brand: string) => {
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.set('model', model);
    newSearchParams.set('brand', brand);

    // A brand this listing leaves to its own listing: go to that one.
    const excluded = (brandScope.modelBrandsExclude || []).some((b) => brandKey(b) === brandKey(brand));
    if (excluded) {
      const cat = await loadCatalogue().catch(() => null);
      const slug = cat ? siblingListingFor(listing, brand, cat.products as ListingLike[]) : null;
      if (slug) {
        newSearchParams.delete('slug');
        newSearchParams.delete('id');
        setSelectorState({ dialogOpen: false, selectedBrand: "", searchQuery: "" });
        navigate({ pathname: `/products/${slug}`, search: newSearchParams.toString() });
        return;
      }
    }
    
    // Land on the canonical /products/<slug> whenever the slug is known,
    // including from an old /products/detail?slug= link.
    if (productSlug) {
      newSearchParams.delete('slug');
      newSearchParams.delete('id');
      navigate({
        pathname: `/products/${productSlug}`,
        search: newSearchParams.toString(),
      });
    } else {
      if (productId) newSearchParams.set('id', productId);
      navigate({
        pathname: '/products/detail',
        search: newSearchParams.toString(),
      });
    }
    
    setSelectorState({
      dialogOpen: false,
      selectedBrand: "",
      searchQuery: "",
    });
  }, [searchParams, navigate, productId, productSlug, params.slug, (brandScope.modelBrandsExclude || []).join("|"), listing.slug, listing.title]);
  
  // Submit model request
  const handleSubmitRequest = useCallback(async () => {
    const finalBrand = requestState.isNewBrand ? requestState.newBrand : requestState.brand;
    
    if (!finalBrand.trim()) {
      toast.error("Please select or enter a brand");
      return;
    }
    if (!requestState.model.trim()) {
      toast.error("Please enter a model name");
      return;
    }
    if (!requestState.category) {
      toast.error("Please select a device category");
      return;
    }
    if (!requestState.whatsApp.trim()) {
      toast.error("Please enter your WhatsApp number");
      return;
    }
    
    const cleanedPhone = requestState.whatsApp.replace(/\D/g, "");
    if (cleanedPhone.length !== 10) {
      toast.error("Please enter a valid 10-digit phone number");
      return;
    }
    
    if (similarModels && similarModels.length > 0 && !requestState.confirmedNotMatch) {
      toast.error("Please confirm that your model doesn't match any of the similar models listed");
      return;
    }

    setRequestState(prev => ({ ...prev, isSubmitting: true }));
    
    try {
      await createModelRequest({
        brandName: finalBrand,
        modelName: requestState.model.trim(),
        category: requestState.category as "phone" | "tablet" | "laptop" | "console" | "charger" | "drone" | "camera" | "lens" | "mac-mini",
        whatsappPhone: "+91" + cleanedPhone,
      });
      
      toast.success("Request submitted! We'll notify you on WhatsApp when it's added.");
      resetRequestForm();
    } catch (error) {
      toast.error("Failed to submit request. Please try again.");
      console.error(error);
    } finally {
      setRequestState(prev => ({ ...prev, isSubmitting: false }));
    }
  }, [requestState, similarModels, createModelRequest]);
  
  // Helper functions
  const openSelector = useCallback(() => {
    setSelectorState(prev => ({ ...prev, dialogOpen: true }));
  }, []);
  
  const closeSelector = useCallback(() => {
    setSelectorState({
      dialogOpen: false,
      selectedBrand: "",
      searchQuery: "",
    });
  }, []);
  
  const selectBrand = useCallback((brand: string) => {
    setSelectorState(prev => ({ ...prev, selectedBrand: brand }));
  }, []);
  
  const setSearchQuery = useCallback((query: string) => {
    setSelectorState(prev => ({ ...prev, searchQuery: query }));
  }, []);
  
  const goBackToBrands = useCallback(() => {
    setSelectorState(prev => ({ ...prev, selectedBrand: "", searchQuery: "" }));
  }, []);
  
  const openRequestForm = useCallback(() => {
    setRequestState(prev => ({ ...prev, dialogOpen: true }));
  }, []);
  
  const resetRequestForm = useCallback(() => {
    setRequestState({
      dialogOpen: false,
      brand: "",
      newBrand: "",
      isNewBrand: false,
      model: "",
      category: "phone",
      whatsApp: "",
      confirmedNotMatch: false,
      isSubmitting: false,
    });
  }, []);
  
  const updateRequestForm = useCallback((updates: Partial<RequestFormState>) => {
    setRequestState(prev => ({ ...prev, ...updates }));
  }, []);
  
  return {
    // Selector state
    selectorState,
    openSelector,
    closeSelector,
    selectBrand,
    setSearchQuery,
    goBackToBrands,
    handleModelSelect,
    
    // Data
    modelsByBrand,
    allBrands,
    filteredModels,
    sameBodyModels,
    
    // Request form
    requestState,
    openRequestForm,
    resetRequestForm,
    updateRequestForm,
    handleSubmitRequest,
    similarModels,
  };
}
