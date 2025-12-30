import { memo } from "react";
import { Button } from "@/components/ui/button.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import type { SortOption, StockFilter } from "@/hooks/useProductFilters";

interface FilterBarProps {
  sortBy: SortOption;
  stockFilter: StockFilter;
  onSortChange: (sortBy: SortOption, stockFilter: StockFilter) => void;
  onClearAll: () => void;
  hasActiveFilters: boolean;
}

export const FilterBar = memo(function FilterBar({
  sortBy,
  stockFilter,
  onSortChange,
  onClearAll,
  hasActiveFilters,
}: FilterBarProps) {
  const handleValueChange = (value: string) => {
    const [sort, stock] = value.split('|') as [SortOption, StockFilter];
    onSortChange(sort, stock);
  };
  
  return (
    <div className="mb-2 sm:mb-4">
      <div className="flex flex-wrap items-center gap-2">
        {/* Spacer */}
        <div className="flex-1" />

        {/* Sort Dropdown */}
        <Select 
          value={`${sortBy}|${stockFilter}`}
          onValueChange={handleValueChange}
        >
          <SelectTrigger className="w-[130px] h-9 text-xs">
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            <div className="p-2">
              <p className="text-xs font-semibold text-muted-foreground mb-2">SORT BY</p>
              <SelectItem value="default|all">Default</SelectItem>
              <SelectItem value="price-low-high|all">Price: Low to High</SelectItem>
              <SelectItem value="price-high-low|all">Price: High to Low</SelectItem>
              <SelectItem value="latest|all">Latest</SelectItem>
              <div className="border-t my-2" />
              <p className="text-xs font-semibold text-muted-foreground mb-2">STOCK</p>
              <SelectItem value="default|in-stock">In Stock Only</SelectItem>
              <SelectItem value="default|out-of-stock">Out of Stock Only</SelectItem>
            </div>
          </SelectContent>
        </Select>

        {/* Clear All */}
        {hasActiveFilters && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onClearAll}
            className="h-9 text-xs"
          >
            Clear All
          </Button>
        )}
      </div>
    </div>
  );
});
