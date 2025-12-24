import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Input } from "@/components/ui/input.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { SearchIcon, ZapIcon, ChevronRightIcon } from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce.ts";
import { Link } from "react-router-dom";

interface ExploreModelsProps {
  onRequestModelClick: () => void;
}

export function ExploreModels({ onRequestModelClick }: ExploreModelsProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery] = useDebounce(searchQuery, 300);
  const [showResults, setShowResults] = useState(false);

  // Server-side device search
  const deviceSearchResults = useQuery(
    api.supportedModels.searchModels,
    debouncedQuery.trim().length >= 2 
      ? { query: debouncedQuery, limit: 20 }
      : "skip"
  );

  // Group results by category
  const groupedResults = (() => {
    if (!deviceSearchResults) return {};
    
    const grouped: Record<string, typeof deviceSearchResults> = {};
    deviceSearchResults.forEach(model => {
      const category = model.category;
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(model);
    });
    
    return grouped;
  })();

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "phone": return "📱";
      case "camera": return "📷";
      case "lens": return "🔍";
      case "tablet": return "📱";
      case "mac-mini": return "💻";
      case "console": return "🎮";
      case "drone": return "🚁";
      case "charger": return "🔌";
      default: return "📱";
    }
  };

  const getCategoryName = (category: string) => {
    switch (category) {
      case "phone": return "Phones";
      case "camera": return "Cameras";
      case "lens": return "Lenses";
      case "tablet": return "Tablets";
      case "mac-mini": return "Mac Mini";
      case "console": return "Gaming Consoles";
      case "drone": return "Drones";
      case "charger": return "Chargers";
      default: return "Other";
    }
  };

  return (
    <section className="container mx-auto px-4 py-12">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Title */}
        <div className="text-center space-y-2">
          <h2 className="text-3xl md:text-4xl font-bold">
            Find Your Device
          </h2>
          <p className="text-muted-foreground">
            Search for your device model to see available products
          </p>
        </div>

        {/* Search Input */}
        <div className="relative">
          <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search your device or model"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowResults(e.target.value.trim().length > 0);
            }}
            onFocus={() => {
              if (searchQuery.trim().length > 0) {
                setShowResults(true);
              }
            }}
            onBlur={() => {
              // Delay to allow clicks on results
              setTimeout(() => setShowResults(false), 200);
            }}
            className="h-14 pl-12 pr-4 text-base rounded-full border-2 focus-visible:ring-2"
          />
        </div>

        {/* Search Results */}
        {showResults && searchQuery.trim().length > 0 && (
          <Card className="border-2 shadow-xl max-h-[60vh] overflow-y-auto">
            <CardContent className="p-4">
              {debouncedQuery.trim().length >= 2 && deviceSearchResults === undefined ? (
                // Loading
                <div className="text-center py-8">
                  <div className="size-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">Searching...</p>
                </div>
              ) : Object.keys(groupedResults).length === 0 ? (
                // No results
                <div className="text-center py-8">
                  <p className="text-foreground mb-2">No devices found</p>
                  <p className="text-sm text-muted-foreground mb-4">
                    Try different search terms
                  </p>
                </div>
              ) : (
                // Results by category
                <div className="space-y-4">
                  {Object.entries(groupedResults).map(([category, models]) => (
                    <div key={category}>
                      <h3 className="text-xs font-semibold text-muted-foreground mb-2 px-2">
                        {getCategoryIcon(category)} {getCategoryName(category).toUpperCase()} ({models.length})
                      </h3>
                      <div className="space-y-1">
                        {models.map((model, idx) => (
                          <Link
                            key={idx}
                            to={`/products?brand=${encodeURIComponent(model.brandName)}&model=${encodeURIComponent(model.modelName)}&fromGadgetSelector=true`}
                            className="flex items-center justify-between p-3 hover:bg-muted rounded-lg transition-colors group"
                            onClick={() => {
                              setShowResults(false);
                              setSearchQuery("");
                            }}
                          >
                            <span className="font-medium">
                              {model.brandName} {model.modelName}
                            </span>
                            <ChevronRightIcon className="size-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-1 transition-all" />
                          </Link>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Request Model Button */}
        <div className="flex flex-col items-center gap-3 pt-4">
          <p className="text-sm text-muted-foreground">
            Can't find your device?
          </p>
          <Button
            size="lg"
            onClick={onRequestModelClick}
            className="rounded-full px-8 shadow-lg hover:shadow-xl transition-all hover:scale-105"
          >
            <ZapIcon className="size-4 mr-2" />
            Request Your Model
          </Button>
        </div>
      </div>
    </section>
  );
}
