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
  onDeviceSelectorClick?: () => void;
}

export function ProductCategoryHeader({
  productCategory,
  gadgetFilter,
  finishFilter,
  onUpdateFilters,
  onDeviceSelectorClick,
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
      <div className="relative border-t border-gray-200/50 bg-gradient-to-r from-purple-50 via-blue-50 to-pink-50 dark:from-purple-950/30 dark:via-blue-950/30 dark:to-pink-950/30 dark:border-gray-700/50 overflow-hidden">
        {/* Animated gradient shimmer */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent dark:via-white/10 animate-shimmer" style={{
          backgroundSize: '200% 100%',
          animation: 'shimmer 3s ease-in-out infinite'
        }} />
        
        <div className="container mx-auto px-2 sm:px-4 py-2 sm:py-3 relative z-10">
          <div className="flex gap-2 justify-center overflow-x-auto no-scrollbar">
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
                    className={`group relative flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 sm:px-5 sm:py-2.5 font-semibold whitespace-nowrap transition-all duration-300 transform hover:scale-105 active:scale-95 rounded-lg sm:rounded-xl ${
                      productCategory === category.id
                        ? 'bg-black text-white shadow-2xl hover:shadow-3xl dark:bg-white dark:text-black animate-pulse-strong border-4 border-yellow-400 dark:border-yellow-300'
                        : 'bg-white text-gray-700 hover:bg-gray-100 hover:shadow-xl border-3 border-purple-300 hover:border-purple-500 dark:bg-gray-800 dark:text-gray-200 dark:border-purple-600 dark:hover:bg-gray-700 dark:hover:border-purple-400'
                    }`}
                  >
                    <IconComponent className={`size-3.5 sm:size-4.5 transition-transform duration-300 ${productCategory === category.id ? 'animate-bounce-subtle' : 'group-hover:rotate-12'}`} />
                    <span className="text-xs sm:text-sm">{category.displayName}</span>
                    
                    {/* Hover glow effect */}
                    {productCategory !== category.id && (
                      <div className="absolute inset-0 rounded-lg sm:rounded-xl bg-gradient-to-r from-blue-500/0 via-purple-500/0 to-pink-500/0 group-hover:from-blue-500/10 group-hover:via-purple-500/10 group-hover:to-pink-500/10 transition-all duration-300 pointer-events-none" />
                    )}
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
                    <Skeleton className="h-8 sm:h-10 w-[30%] sm:w-32 rounded-lg flex-shrink-0" />
                    <div className="flex-1 flex gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <Skeleton key={i} className="h-8 sm:h-10 w-20 sm:w-28 rounded-lg flex-shrink-0" />
                      ))}
                    </div>
                  </>
                ) : (
                  // Loaded gadget and finish types
                  <>
                    {/* Left side - Selected Gadget (30% width on mobile) */}
                    <button
                      onClick={onDeviceSelectorClick}
                      className="w-[30%] sm:w-auto px-2 py-1.5 sm:px-3 sm:py-2 rounded-lg bg-black dark:bg-white text-white dark:text-black font-semibold text-[10px] sm:text-xs truncate flex-shrink-0 hover:shadow-md transition-all duration-200 border border-black dark:border-white"
                    >
                      {gadgetTypes?.find(gt => gt.name === gadgetFilter)?.displayName || gadgetFilter}
                    </button>

                    {/* Right side - Finish Selector (70% width on mobile) */}
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
