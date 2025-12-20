import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Link } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton.tsx";

export function CategoryExplorer() {
  const categories = useQuery(api.homepage.getActiveCategoryDisplaySettings);

  // Loading state
  if (categories === undefined) {
    return (
      <section className="py-8">
        <div className="space-y-4">
          <div className="px-4 space-y-2">
            <Skeleton className="h-8 w-48" />
          </div>
          <div className="flex gap-3 px-4 overflow-x-hidden">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="flex-shrink-0 w-[42vw] h-[52vw] rounded-xl" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  // Don't render if no categories
  if (categories.length === 0) {
    return null;
  }

  const getCategoryImage = (categoryName: string, imageUrl?: string) => {
    // Return admin-provided image if available
    if (imageUrl) return imageUrl;
    
    // Otherwise return placeholder based on category
    const placeholders: Record<string, string> = {
      "skin": "https://images.unsplash.com/photo-1556656793-08538906a9f8?w=500&h=700&fit=crop",
      "case-cover": "https://images.unsplash.com/photo-1601784551446-20c9e07cdbdb?w=500&h=700&fit=crop",
      "camera-ring": "https://images.unsplash.com/photo-1502920917128-1aa500764cbd?w=500&h=700&fit=crop",
      "magneto-x": "https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?w=500&h=700&fit=crop",
      "glass": "https://images.unsplash.com/photo-1591337676887-a217a6970a8a?w=500&h=700&fit=crop",
      "accessory": "https://images.unsplash.com/photo-1525547719571-a2d4ac8945e2?w=500&h=700&fit=crop",
    };
    
    return placeholders[categoryName] || placeholders["skin"];
  };

  const getCategoryLink = (categoryName: string, customLinkUrl?: string) => {
    // Use custom URL if provided
    if (customLinkUrl) return customLinkUrl;
    
    // Special handling for skins - opens gadget selector
    if (categoryName === "skin") {
      return "/products?productCategory=skin";
    }
    
    // For other categories, link directly to products page with filter
    return `/products?productCategory=${categoryName}`;
  };

  return (
    <section className="py-8 bg-background">
      <div className="space-y-4">
        {/* Title */}
        <div className="px-4">
          <h2 className="text-2xl font-bold">
            Explore by Category
          </h2>
        </div>

        {/* Horizontal Scrolling Cards */}
        <div 
          className="flex gap-3 px-4 overflow-x-auto snap-x snap-mandatory scrollbar-hide"
          style={{
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {categories.map((category) => (
            <Link
              key={category._id}
              to={getCategoryLink(category.categoryName, category.linkUrl)}
              className="group relative flex-shrink-0 w-[42vw] h-[52vw] rounded-xl overflow-hidden shadow-md snap-start"
            >
              {/* Background Image */}
              <img
                src={getCategoryImage(category.categoryName, category.imageUrl)}
                alt={category.displayName}
                className="absolute inset-0 w-full h-full object-cover object-center transition-transform duration-300 group-active:scale-95"
              />
              
              {/* Gradient Overlay - only show if button text exists */}
              {category.buttonText && (
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
              )}
              
              {/* Content - only show if button text exists */}
              {category.buttonText && (
                <div className="absolute inset-0 flex flex-col items-center justify-end p-6 text-center">
                  <div className="bg-white/95 backdrop-blur-sm rounded-full px-6 py-2.5">
                    <h3 className="text-base font-bold text-foreground">
                      {category.buttonText}
                    </h3>
                  </div>
                </div>
              )}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
