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


/*
 * Chip labels, shortened.
 *
 * "3D (Embossed)" and "Protectors/Membranes" are right in a product title and
 * wrong on a filter chip — between them they pushed the finish row onto a
 * third and fourth line on a phone, over a strip that is fixed above the
 * products. The full names still live in the data and on the product page.
 */
/*
 * The order finishes are offered in, most-stocked first rather than whatever
 * the collection happens to return. Matte and 3D carry almost the whole
 * catalogue — 146 and 183 phone skins against 12, 3 and 1 for the rest — so
 * they lead. Anything not named here falls in behind, in its existing order.
 */
const FINISH_ORDER = ["matte", "embossed", "transparent", "premium-leather", "protectors"];
const finishRank = (name: string) => {
  const i = FINISH_ORDER.indexOf(name);
  return i === -1 ? FINISH_ORDER.length : i;
};

const SHORT_FINISH: Record<string, string> = {
  "3D (Embossed)": "3D",
  "Protectors/Membranes": "Protectors",
  "Premium Leather": "Leather",
};
const shortFinish = (name: string) => SHORT_FINISH[name] ?? name;

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
              /* One row, not two. The chosen gadget is a chip like any other
                 rather than a 30%-wide block that forced the finishes onto
                 their own line — and it reads as the step you came through,
                 which the old layout did not say either. */
              <div className="flex flex-wrap items-center gap-1">
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
                      className="flex shrink-0 items-center gap-1 rounded-full border-2 border-ink bg-brand px-2 py-0.5 text-[10px] font-bold whitespace-nowrap text-brand-foreground transition-colors sm:px-2.5 sm:py-1 sm:text-xs"
                    >
                      {gadgetTypes?.find(gt => gt.name === gadgetFilter)?.displayName || gadgetFilter}
                      <span className="opacity-70">✕</span>
                    </button>

                    <span aria-hidden="true" className="mx-0.5 h-4 w-px shrink-0 bg-ink/15" />

                    {/* Siblings of the gadget chip, not a nested flex box. As
                        their own div they were a single wide flex item, so the
                        whole group dropped to its own line and the gadget chip
                        sat alone above it — three rows where two will do. */}
                    <>
                      <button
                        onClick={() => onUpdateFilters({ finish: null })}
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium whitespace-nowrap transition-colors sm:px-2.5 sm:py-1 sm:text-xs ${
                          !finishFilter
                            ? 'bg-brand font-bold text-brand-foreground'
                            : 'border border-ink/15 bg-background text-ink/80 hover:border-ink/40'
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
                        .slice()
                        .sort((a: { name: string }, b: { name: string }) => finishRank(a.name) - finishRank(b.name))
                        .map((finishType) => (
                        <button
                          key={finishType._id}
                          onClick={() => onUpdateFilters({ finish: finishType.name })}
                          className={`rounded-full px-2 py-0.5 text-[10px] font-medium whitespace-nowrap transition-colors sm:px-2.5 sm:py-1 sm:text-xs ${
                            finishFilter === finishType.name
                              ? 'bg-brand font-bold text-brand-foreground'
                              : 'border border-ink/15 bg-background text-ink/80 hover:border-ink/40'
                          }`}
                        >
                          {shortFinish(finishType.displayName)}
                          {(() => {
                            const g = gadgetTypes?.find(gt => gt.name === gadgetFilter)?._id;
                            const n = g ? facets?.finishByGadget?.[g]?.[finishType._id] : undefined;
                            return n ? <span className="ml-1 opacity-60">{n}</span> : null;
                          })()}
                        </button>
                      ))}
                    </>
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
