import { memo } from "react";

interface PageHeaderProps {
  searchQuery: string;
  collectionName?: string;
  deviceFilter: string | null;
  finishFilter: string | null;
  resultsCount: number;
}

export const PageHeader = memo(function PageHeader({
  searchQuery,
  collectionName,
  deviceFilter,
  finishFilter,
  resultsCount,
}: PageHeaderProps) {
  // Determine title
  const title = searchQuery 
    ? 'Search Results'
    : collectionName 
      ? collectionName
      : deviceFilter 
        ? `${deviceFilter.charAt(0).toUpperCase() + deviceFilter.slice(1)} Skins`
        : finishFilter 
          ? `${finishFilter.charAt(0).toUpperCase() + finishFilter.slice(1)} Finish`
          : 'Shop';
  
  // Determine subtitle
  const subtitle = searchQuery 
    ? `${resultsCount} ${resultsCount === 1 ? "result" : "results"} for "${searchQuery}"`
    : 'More than 500 Designs To Choose From Across Gadgets';
  
  return (
    <div className="text-center mb-2 sm:mb-4 space-y-1 sm:space-y-2">
      <h1 className="text-xl sm:text-4xl lg:text-5xl font-bold text-balance">
        {title}
      </h1>
      <p className="text-xs sm:text-xl text-muted-foreground max-w-2xl mx-auto text-balance">
        {subtitle}
      </p>
    </div>
  );
});
