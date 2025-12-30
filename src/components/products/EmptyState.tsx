import { memo } from "react";
import { Link } from "react-router-dom";
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
    <div className="min-h-screen">
      <nav className="fixed top-0 w-full bg-background/80 backdrop-blur-lg border-b border-border z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img 
              src="https://cdn.hercules.app/file_Qd06a0OWqeC2LadTl4tLLvmv" 
              alt="Skinly" 
              className="h-10 sm:h-12"
            />
          </Link>
        </div>
      </nav>

      <div className="pt-32 sm:pt-40 pb-6 sm:pb-20 px-2 sm:px-4">
        <div className="container mx-auto max-w-2xl">
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <PackageIcon />
              </EmptyMedia>
              <EmptyTitle>No Products Found</EmptyTitle>
              <EmptyDescription>
                {hasFilters
                  ? "No products match your filters. Try adjusting your filters."
                  : "Your store doesn't have any products yet."}
              </EmptyDescription>
            </EmptyHeader>
            {hasFilters && (
              <EmptyContent>
                <Button onClick={onClearFilters}>Clear All Filters</Button>
              </EmptyContent>
            )}
          </Empty>
        </div>
      </div>
    </div>
  );
});
