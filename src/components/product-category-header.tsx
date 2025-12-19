import { useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { Package2, Shield, Video, Zap, Glasses, ShoppingBag, Box } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";

interface ProductCategoryHeaderProps {
  productCategory: string | null;
  gadgetFilter: string | null;
  finishFilter: string | null;
  onUpdateFilters: (updates: {
    productType?: string | null;
    gadget?: string | null;
    finish?: string | null;
  }) => void;
}

export function ProductCategoryHeader({
  productCategory,
  gadgetFilter,
  finishFilter,
  onUpdateFilters,
}: ProductCategoryHeaderProps) {
  const location = useLocation();
  
  // Get product categories, gadget types, and finish types
  const productCategories = useQuery(api.productCategories.listAllWithCounts, {});
  const gadgetTypes = useQuery(api.gadgetTypes.listAllActive, {});
  const finishTypes = useQuery(api.finishTypes.listAllActive, {});

  // Initialize from URL on mount
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const urlProductType = params.get('productType');
    const urlGadget = params.get('gadget');
    const urlFinish = params.get('finish');
    
    if (urlProductType !== productCategory || urlGadget !== gadgetFilter || urlFinish !== finishFilter) {
      onUpdateFilters({
        productType: urlProductType,
        gadget: urlGadget,
        finish: urlFinish,
      });
    }
  }, [location.search]);

  const categoryConfig = {
    'skin': { icon: Package2 },
    'case-cover': { icon: Shield },
    'camera-ring': { icon: Video },
    'magneto-x': { icon: Zap },
    'glass': { icon: Glasses },
    'accessory': { icon: ShoppingBag },
  };

  return (
    <>
      {/* Product Category Extension Bar */}
      {productCategories && (
        <div className="border-t border-gray-100 bg-gray-50/50 dark:bg-gray-900/50 dark:border-gray-800">
          <div className="container mx-auto px-2 sm:px-4 py-4">
            <div className="flex gap-2 overflow-x-auto no-scrollbar">
              {productCategories.map((category) => {
                const config = categoryConfig[category.id as keyof typeof categoryConfig] || { icon: Box };
                const IconComponent = config.icon;
                
                return (
                  <button
                    key={category.id}
                    onClick={() => onUpdateFilters({ productType: category.id })}
                    className={`group relative flex items-center gap-2 px-5 py-2.5 font-semibold whitespace-nowrap transition-all duration-200 ${
                      productCategory === category.id
                        ? 'bg-black text-white shadow-lg hover:shadow-xl rounded-xl dark:bg-white dark:text-black'
                        : 'bg-white text-gray-700 hover:bg-gray-50 hover:shadow-md rounded-xl border-2 border-gray-200 hover:border-gray-300 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700 dark:hover:bg-gray-750 dark:hover:border-gray-600'
                    }`}
                  >
                    <IconComponent className="size-4.5" />
                    <span className="text-sm">{category.displayName}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
      
      {/* Animated Filter Bar - Shows when category is selected */}
      {productCategory && (
        <div className="border-t border-gray-100 bg-white dark:bg-gray-900 dark:border-gray-800 animate-in slide-in-from-top-2 duration-300">
          <div className="container mx-auto px-2 sm:px-4 py-4">
            {/* Show full gadget selector when no gadget is selected */}
            {productCategory === 'skin' && !gadgetFilter && gadgetTypes && (
              <div className="flex gap-2 overflow-x-auto no-scrollbar">
                <button
                  onClick={() => onUpdateFilters({ gadget: null })}
                  className="px-5 py-2.5 rounded-xl bg-black dark:bg-white text-white dark:text-black font-semibold text-sm whitespace-nowrap shadow-lg hover:shadow-xl transition-all duration-200"
                >
                  All Gadgets
                </button>
                {gadgetTypes
                  .filter((gt) => gt.name !== 'accessory' && gt.name !== 'cover')
                  .map((gadgetType) => (
                    <button
                      key={gadgetType._id}
                      onClick={() => onUpdateFilters({ gadget: gadgetType.name })}
                      className="px-5 py-2.5 rounded-xl bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-medium text-sm whitespace-nowrap border-2 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-750 hover:shadow-md transition-all duration-200"
                    >
                      {gadgetType.displayName}
                    </button>
                  ))}
              </div>
            )}

            {/* Compact horizontal layout when gadget is selected */}
            {productCategory === 'skin' && gadgetFilter && finishTypes && (
              <div className="flex items-center gap-3">
                {/* Left side - Selected Gadget */}
                <div className="flex items-center gap-2 min-w-fit px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700">
                  <div className="px-3 py-1.5 rounded-lg bg-black dark:bg-white text-white dark:text-black font-semibold text-sm">
                    {gadgetTypes?.find(gt => gt.name === gadgetFilter)?.displayName || gadgetFilter}
                  </div>
                  <button
                    onClick={() => onUpdateFilters({ gadget: null })}
                    className="px-3 py-1.5 rounded-lg bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 font-medium text-sm whitespace-nowrap border-2 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-sm transition-all duration-200"
                  >
                    Change
                  </button>
                </div>

                {/* Visual Separator */}
                <div className="h-8 w-px bg-gray-200 dark:bg-gray-700" />

                {/* Right side - Finish Selector */}
                <div className="flex-1 flex gap-2 overflow-x-auto no-scrollbar">
                  <button
                    onClick={() => onUpdateFilters({ finish: null })}
                    className={`px-5 py-2.5 rounded-xl font-semibold text-sm whitespace-nowrap transition-all duration-200 ${
                      !finishFilter
                        ? 'bg-black dark:bg-white text-white dark:text-black shadow-lg hover:shadow-xl'
                        : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-medium border-2 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-750 hover:shadow-md'
                    }`}
                  >
                    All Finishes
                  </button>
                  {finishTypes.map((finishType) => (
                    <button
                      key={finishType._id}
                      onClick={() => onUpdateFilters({ finish: finishType.name })}
                      className={`px-5 py-2.5 rounded-xl font-semibold text-sm whitespace-nowrap transition-all duration-200 ${
                        finishFilter === finishType.name
                          ? 'bg-black dark:bg-white text-white dark:text-black shadow-lg hover:shadow-xl'
                          : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-medium border-2 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-750 hover:shadow-md'
                      }`}
                    >
                      {finishType.displayName}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
