import { useQuery, useMutation } from "@/lib/firebase-hooks";
import { api } from "@/lib/firebase-api";
import { useState, useMemo, useCallback } from "react";
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

export function useModelSelector(deviceCategory: string = "phone") {
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
  
  // All brands list
  const allBrands = useMemo(() => {
    return Object.keys(modelsByBrand).sort();
  }, [modelsByBrand]);
  
  // Filter models based on search
  const filteredModels = useMemo(() => {
    const models = modelsByBrand[selectorState.selectedBrand] || [];
    
    if (!selectorState.searchQuery.trim()) return models;
    
    const searchTerms = selectorState.searchQuery
      .toLowerCase()
      .split(/\s+/)
      .filter(term => term.length > 0);
    
    return models.filter(model => {
      const modelLower = model.toLowerCase();
      return searchTerms.every(term => modelLower.includes(term));
    });
  }, [selectorState.selectedBrand, selectorState.searchQuery, modelsByBrand]);
  
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
  const handleModelSelect = useCallback((model: string, brand: string) => {
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.set('model', model);
    newSearchParams.set('brand', brand);
    
    if (productId) {
      newSearchParams.set('id', productId);
    }
    if (productSlug && !params.slug) {
      newSearchParams.set('slug', productSlug);
    }
    
    if (params.slug) {
      navigate({
        pathname: `/products/${params.slug}`,
        search: newSearchParams.toString(),
      });
    } else {
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
  }, [searchParams, navigate, productId, productSlug, params.slug]);
  
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
    
    // Request form
    requestState,
    openRequestForm,
    resetRequestForm,
    updateRequestForm,
    handleSubmitRequest,
    similarModels,
  };
}
