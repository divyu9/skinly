import { Package2, Shield, Video, Zap, Glasses, ShoppingBag, Box } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Skeleton } from "@/components/ui/skeleton.tsx";

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
  // Get product categories, gadget types, and finish types
  const productCategories = useQuery(api.productCategories.listAllWithCounts, {});
  const gadgetTypes = useQuery(api.gadgetTypes.listAllActive, {});
  const finishTypes = useQuery(api.finishTypes.listAllActive, {});

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
      <div className="border-t border-gray-100 bg-gray-50/50 dark:bg-gray-900/50 dark:border-gray-800">
        <div className="container mx-auto px-2 sm:px-4 py-2 sm:py-3">
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {productCategories === undefined ? (
              // Loading skeleton
              <>
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 sm:h-10 w-24 sm:w-32 rounded-lg sm:rounded-xl flex-shrink-0" />
                ))}
              </>
            ) : (
              // Loaded categories
              productCategories.map((category) => {
                const config = categoryConfig[category.id as keyof typeof categoryConfig] || { icon: Box };
                const IconComponent = config.icon;
                
                return (
                  <button
                    key={category.id}
                    onClick={() => onUpdateFilters({ productType: category.id })}
                    className={`group relative flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 sm:px-5 sm:py-2.5 font-semibold whitespace-nowrap transition-all duration-200 ${
                      productCategory === category.id
                        ? 'bg-black text-white shadow-lg hover:shadow-xl rounded-lg sm:rounded-xl dark:bg-white dark:text-black'
                        : 'bg-white text-gray-700 hover:bg-gray-50 hover:shadow-md rounded-lg sm:rounded-xl border-2 border-gray-200 hover:border-gray-300 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700 dark:hover:bg-gray-750 dark:hover:border-gray-600'
                    }`}
                  >
                    <IconComponent className="size-3.5 sm:size-4.5" />
                    <span className="text-xs sm:text-sm">{category.displayName}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>
      
      {/* Animated Filter Bar - Shows when category is selected */}
      {productCategory && (
        <div className="border-t border-gray-100 bg-white dark:bg-gray-900 dark:border-gray-800 animate-in slide-in-from-top-2 duration-300">
          <div className="container mx-auto px-2 sm:px-4 py-2 sm:py-3">
            {/* Show full gadget selector when no gadget is selected */}
            {productCategory === 'skin' && !gadgetFilter && (
              <div className="flex gap-2 overflow-x-auto no-scrollbar">
                {gadgetTypes === undefined ? (
                  // Loading skeleton for gadget selector
                  <>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-8 sm:h-10 w-20 sm:w-24 rounded-lg sm:rounded-xl flex-shrink-0" />
                    ))}
                  </>
                ) : (
                  // Loaded gadget types
                  <>
                    <button
                      onClick={() => onUpdateFilters({ gadget: null })}
                      className="px-3 py-1.5 sm:px-5 sm:py-2.5 rounded-lg sm:rounded-xl bg-black dark:bg-white text-white dark:text-black font-semibold text-xs sm:text-sm whitespace-nowrap shadow-md hover:shadow-lg transition-all duration-200"
                    >
                      All Gadgets
                    </button>
                    {gadgetTypes
                      .filter((gt) => gt.name !== 'accessory' && gt.name !== 'cover')
                      .map((gadgetType) => (
                        <button
                          key={gadgetType._id}
                          onClick={() => onUpdateFilters({ gadget: gadgetType.name })}
                          className="px-3 py-1.5 sm:px-5 sm:py-2.5 rounded-lg sm:rounded-xl bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-medium text-xs sm:text-sm whitespace-nowrap border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-750 hover:shadow-sm transition-all duration-200"
                        >
                          {gadgetType.displayName}
                        </button>
                      ))}
                  </>
                )}
              </div>
            )}

            {/* Compact horizontal layout when gadget is selected */}
            {productCategory === 'skin' && gadgetFilter && (
              <div className="flex items-center gap-1.5 sm:gap-3">
                {gadgetTypes === undefined || finishTypes === undefined ? (
                  // Loading skeleton for compact layout
                  <>
                    <Skeleton className="h-8 sm:h-10 w-20 sm:w-32 rounded-lg flex-shrink-0" />
                    <div className="flex-1 flex gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <Skeleton key={i} className="h-8 sm:h-10 w-20 sm:w-28 rounded-lg flex-shrink-0" />
                      ))}
                    </div>
                  </>
                ) : (
                  // Loaded gadget and finish types
                  <>
                    {/* Left side - Selected Gadget (20% width on mobile) */}
                    <div className="w-[20%] sm:w-auto flex items-center gap-1 sm:gap-1.5 px-2 py-1.5 sm:px-3 sm:py-2 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex-shrink-0">
                      <div className="px-2 py-1 sm:px-2.5 sm:py-1 rounded bg-black dark:bg-white text-white dark:text-black font-semibold text-[10px] sm:text-xs truncate">
                        {gadgetTypes?.find(gt => gt.name === gadgetFilter)?.displayName || gadgetFilter}
                      </div>
                      <button
                        onClick={() => onUpdateFilters({ gadget: null })}
                        className="p-1 sm:p-1.5 rounded bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-sm transition-all duration-200 flex-shrink-0"
                        aria-label="Change gadget"
                      >
                        <svg className="size-3 sm:size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      </button>
                    </div>

                    {/* Right side - Finish Selector (80% width on mobile) */}
                    <div className="flex-1 flex gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar">
                      <button
                        onClick={() => onUpdateFilters({ finish: null })}
                        className={`px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-lg font-semibold text-[10px] sm:text-xs whitespace-nowrap transition-all duration-200 ${
                          !finishFilter
                            ? 'bg-black dark:bg-white text-white dark:text-black shadow-md hover:shadow-lg'
                            : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-medium border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-750 hover:shadow-sm'
                        }`}
                      >
                        All
                      </button>
                      {finishTypes.map((finishType) => (
                        <button
                          key={finishType._id}
                          onClick={() => onUpdateFilters({ finish: finishType.name })}
                          className={`px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-lg font-semibold text-[10px] sm:text-xs whitespace-nowrap transition-all duration-200 ${
                            finishFilter === finishType.name
                              ? 'bg-black dark:bg-white text-white dark:text-black shadow-md hover:shadow-lg'
                              : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-medium border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-750 hover:shadow-sm'
                          }`}
                        >
                          {finishType.displayName}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
