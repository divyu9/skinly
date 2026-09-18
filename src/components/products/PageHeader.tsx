import { memo } from "react";

interface PageHeaderProps {
  searchQuery: string;
  collectionName?: string;
  deviceFilter: string | null;
  finishFilter: string | null;
  /** The gadget being browsed, so the heading can name it: "Phone Skins". */
  gadgetFilter?: string | null;
  /** The brand being browsed: "Apple Phone Skins". "Other" is not a brand. */
  brandFilter?: string | null;
  productCategory?: string | null;
  resultsCount: number;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const PageHeader = memo(function PageHeader({
  searchQuery,
  collectionName,
  deviceFilter,
  finishFilter,
  gadgetFilter,
  brandFilter,
  productCategory,
  resultsCount,
}: PageHeaderProps) {
  /*
   * The heading names what is actually on screen.
   *
   * It used to read "Shop" over "More than 500 Designs To Choose From Across
   * Gadgets" on every view — a title the category strip already gives ("Skins"
   * highlighted) above a claim that stops being true the moment anything is
   * filtered, together taking the top of the first screen on a phone, where
   * a product could be. Naming the filter instead orients the visitor, tells
   * Google what the page is, and lets the subtitle go where it adds nothing.
   */
  const isSkins = !productCategory || productCategory === "skin";
  const gadgetLabel = isSkins && gadgetFilter ? cap(gadgetFilter.replace(/-/g, " ")) : "";
  // "Other" is the catch-all chip's token, not a brand anyone calls their phone.
  const brandLabel = isSkins && brandFilter && brandFilter.toLowerCase() !== "other" ? cap(brandFilter) : "";

  const title = searchQuery
    ? "Search Results"
    : collectionName
      ? collectionName
      : brandLabel || gadgetLabel
        ? `${[brandLabel, gadgetLabel].filter(Boolean).join(" ")} Skins`
        : deviceFilter
          ? `${cap(deviceFilter)} Skins`
          : finishFilter
            ? `${cap(finishFilter)} Finish`
            : "Shop";

  const subtitle = searchQuery
    ? `${resultsCount} ${resultsCount === 1 ? "result" : "results"} for "${searchQuery}"`
    : collectionName || brandLabel || gadgetLabel || deviceFilter || finishFilter
      // Deep in the funnel the line is filler, and the space is a product row.
      ? ""
      : "More than 500 Designs To Choose From Across Gadgets";

  return (
    <div className="mb-2 space-y-0.5 text-center sm:mb-3 sm:space-y-1.5">
      <h1 className="text-balance text-lg font-bold sm:text-3xl lg:text-4xl">
        {title}
      </h1>
      {subtitle && (
        <p className="mx-auto max-w-2xl text-balance text-xs text-muted-foreground sm:text-lg">
          {subtitle}
        </p>
      )}
    </div>
  );
});
