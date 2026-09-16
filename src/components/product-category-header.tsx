import { Package2, Shield, Video, Zap, Glasses, ShoppingBag, Box } from "lucide-react";
import { useQuery } from "@/lib/firebase-hooks";
import { api } from "@/lib/firebase-api";
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
  /*
   * The same artwork the homepage's "Explore by Category" cards use, so the
   * admin sets a category's image once and both places follow. A photograph of
   * the thing beats a line icon of it, and it keeps the two surfaces from
   * drifting apart every time someone updates one of them.
   */
  const categoryImages = useQuery(api.homepage.getActiveCategoryDisplaySettings);
  const imageFor = (id: string): string | undefined =>
    (categoryImages as Array<{ categoryName?: string; imageUrl?: string }> | undefined)
      ?.find((c) => c.categoryName === id)?.imageUrl || undefined;
  const gadgetTypes = useQuery(api.gadgetTypes.listAllActive, {});
  // Counts behind each chip, so we never offer a filter with nothing behind it.
  const facets = useQuery(api.products.getFilterFacets, { productCategory });
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
      {/* Categories, as stories.
          These were wrapped pills — six of them at up to 32px tall plus gaps
          ran to three rows on a phone and pushed the products themselves off
          the screen. A circle with its name underneath says the same thing in
          one row at any width: six columns of a grid, so they fit at 320px and
          at 1440px without scrolling or wrapping. The active one takes a ring
          with a gap inside it, which is the one visual convention everybody
          already reads as "this is the selected one".

          The bar also carried a purple-to-pink gradient and a shimmer
          animation from before the packaging palette existed, on a page where
          nothing else is purple. */}
      <div className="border-t-2 border-ink/10 bg-blush/20">
        <div className="container mx-auto px-2 py-2.5 sm:px-4">
          <div className="grid grid-cols-6 gap-1 sm:gap-2">
            {productCategories === undefined
              ? Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex flex-col items-center gap-1.5">
                    <Skeleton className="aspect-square w-full max-w-[56px] rounded-full" />
                    <Skeleton className="h-2.5 w-10" />
                  </div>
                ))
              : productCategories.map((category) => {
                  const config =
                    categoryConfig[category.id as keyof typeof categoryConfig] || { icon: Box };
                  const IconComponent = config.icon;
                  const active = productCategory === category.id;
                  // Falls back to the icon when no image is set, so a category
                  // added without artwork still renders as something.
                  const img = imageFor(category.id);

                  return (
                    <button
                      key={category.id}
                      onClick={() => onUpdateFilters({ productType: category.id })}
                      aria-pressed={active}
                      className="group flex min-w-0 flex-col items-center gap-1.5"
                    >
                      <span
                        className={`grid aspect-square w-full max-w-[56px] place-items-center overflow-hidden rounded-full transition-colors ${
                          active
                            ? 'ring-2 ring-brand ring-offset-2 ring-offset-background'
                            : 'ring-1 ring-ink/15 group-hover:ring-ink/40'
                        } ${img ? 'bg-muted' : active ? 'bg-brand text-brand-foreground' : 'bg-card text-ink/70'}`}
                      >
                        {img ? (
                          /* A plain centre crop, which is what a circular
                             thumbnail wants. The artwork is portrait and gets
                             cropped hard, so it should carry the product and
                             not a caption — the name is already printed under
                             the circle. */
                          <img
                            src={img}
                            alt=""
                            loading="lazy"
                            decoding="async"
                            className="size-full object-cover"
                          />
                        ) : (
                          <IconComponent className="size-5 sm:size-[22px]" strokeWidth={2} />
                        )}
                      </span>
                      {/* Two lines rather than an ellipsis. A 60px column
                          truncates "Screen Protectors" to "Screen Pr…", which
                          is worse than the extra 11px a second line costs. */}
                      <span
                        className={`line-clamp-2 w-full text-center text-[10px] leading-[1.15] sm:text-[11px] ${
                          active ? 'font-bold text-ink' : 'font-medium text-muted-foreground'
                        }`}
                      >
                        {category.displayName}
                      </span>
                    </button>
                  );
                })}
          </div>
        </div>
      </div>

      {/* Second tier: gadget, then finish. Smaller than the stories above them
          because they refine a choice already made, and because this strip is
          fixed over the products — every row it takes is a row of shop nobody
          sees. */}
      {productCategory && (
        <div className="border-t-2 border-ink/10 bg-card">
          <div className="container mx-auto px-2 py-2 sm:px-4">
            {/* Show full gadget selector when no gadget is selected */}
            {productCategory === 'skin' && !gadgetFilter && (
              <div className="flex flex-wrap gap-1">
                {gadgetTypes === undefined ? (
                  // Loading skeleton for gadget selector
                  <>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-6 w-16 flex-shrink-0 rounded-full" />
                    ))}
                  </>
                ) : (
                  // Loaded gadget types
                  <>
                    <button
                      onClick={() => onUpdateFilters({ gadget: null })}
                      className="rounded-full bg-brand px-2 py-0.5 text-[10px] font-bold whitespace-nowrap text-brand-foreground transition-colors sm:px-2.5 sm:py-1 sm:text-xs"
                    >
                      All Gadgets
                    </button>
                    {gadgetTypes
                      .filter((gt) => gt.name !== 'accessory' && gt.name !== 'cover')
                      .filter((gt) => !facets || (facets.byGadget?.[gt._id] ?? 0) > 0)
                      .map((gadgetType) => (
                        <button
                          key={gadgetType._id}
                          onClick={() => onUpdateFilters({ gadget: gadgetType.name })}
                          className="rounded-full border border-ink/15 bg-background px-2 py-0.5 text-[10px] font-medium whitespace-nowrap text-ink/80 transition-colors hover:border-ink/40 sm:px-2.5 sm:py-1 sm:text-xs"
                        >
                          {gadgetType.displayName}
                          {facets?.byGadget?.[gadgetType._id] ? (
                            <span className="ml-1 text-muted-foreground">{facets.byGadget[gadgetType._id]}</span>
                          ) : null}
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
                    <div className="flex-1 flex flex-wrap gap-1.5 sm:gap-2">
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
                      onClick={() => onUpdateFilters({ gadget: null, finish: null })}
                      title="Change device category"
                      className="w-[30%] sm:w-auto px-2 py-1.5 sm:px-3 sm:py-2 rounded-lg bg-brand text-brand-foreground font-semibold text-[10px] sm:text-xs truncate flex-shrink-0 hover:shadow-md transition-all duration-200 border-2 border-ink"
                    >
                      {gadgetTypes?.find(gt => gt.name === gadgetFilter)?.displayName || gadgetFilter}
                      <span className="ml-1 opacity-70">✕</span>
                    </button>

                    {/* Right side - Finish Selector (70% width on mobile) */}
                    <div className="flex-1 flex flex-wrap gap-1.5 sm:gap-2">
                      <button
                        onClick={() => onUpdateFilters({ finish: null })}
                        className={`px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-lg font-semibold text-[10px] sm:text-xs whitespace-nowrap transition-all duration-200 ${
                          !finishFilter
                            ? 'bg-brand text-brand-foreground shadow-md hover:shadow-lg'
                            : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-medium border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-750 hover:shadow-sm'
                        }`}
                      >
                        All
                      </button>
                      {finishTypes
                        .filter((ft) => {
                          const g = gadgetTypes?.find(gt => gt.name === gadgetFilter)?._id;
                          if (!facets || !g) return true;
                          return (facets.finishByGadget?.[g]?.[ft._id] ?? 0) > 0;
                        })
                        .map((finishType) => (
                        <button
                          key={finishType._id}
                          onClick={() => onUpdateFilters({ finish: finishType.name })}
                          className={`px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-lg font-semibold text-[10px] sm:text-xs whitespace-nowrap transition-all duration-200 ${
                            finishFilter === finishType.name
                              ? 'bg-brand text-brand-foreground shadow-md hover:shadow-lg'
                              : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-medium border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-750 hover:shadow-sm'
                          }`}
                        >
                          {finishType.displayName}
                          {(() => {
                            const g = gadgetTypes?.find(gt => gt.name === gadgetFilter)?._id;
                            const n = g ? facets?.finishByGadget?.[g]?.[finishType._id] : undefined;
                            return n ? <span className="ml-1 opacity-60">{n}</span> : null;
                          })()}
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
