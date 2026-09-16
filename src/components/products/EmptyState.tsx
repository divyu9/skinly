import { memo } from "react";
import { Button } from "@/components/ui/button.tsx";
import { 
  Empty, 
  EmptyHeader, 
  EmptyMedia, 
  EmptyTitle, 
  EmptyDescription, 
  EmptyContent 
} from "@/components/ui/empty.tsx";
import { PackageIcon } from "lucide-react";

interface EmptyStateProps {
  hasFilters: boolean;
  onClearFilters: () => void;
}

export const EmptyState = memo(function EmptyState({
  hasFilters,
  onClearFilters,
}: EmptyStateProps) {
  return (
    <div className="mx-auto max-w-2xl py-10 sm:py-16">
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <PackageIcon />
          </EmptyMedia>
          <EmptyTitle>No Products Found</EmptyTitle>
          <EmptyDescription>
            {hasFilters
              ? "Nothing matches this combination. Pick another category above, or clear the filters."
              : "There is nothing here yet. Pick another category above."}
          </EmptyDescription>
        </EmptyHeader>
        {hasFilters && (
          <EmptyContent>
            <Button onClick={onClearFilters}>Clear All Filters</Button>
          </EmptyContent>
        )}
      </Empty>
    </div>
  );
});
