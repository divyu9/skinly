import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Link } from "react-router-dom";
import { ChevronRightIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton.tsx";

export function CategoryExplorer() {
  const categories = useQuery(api.homepage.getActiveCategoryDisplaySettings);

  // Loading state
  if (categories === undefined) {
    return (
      <section className="container mx-auto px-4 py-12">
        <div className="space-y-6">
          <div className="text-center space-y-2">
            <Skeleton className="h-10 w-64 mx-auto" />
            <Skeleton className="h-6 w-96 mx-auto" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[4/3] rounded-2xl" />
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
      "skin": "https://images.unsplash.com/photo-1556656793-08538906a9f8?w=600&h=400&fit=crop",
      "case-cover": "https://images.unsplash.com/photo-1601784551446-20c9e07cdbdb?w=600&h=400&fit=crop",
      "camera-ring": "https://images.unsplash.com/photo-1502920917128-1aa500764cbd?w=600&h=400&fit=crop",
      "magneto-x": "https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?w=600&h=400&fit=crop",
      "glass": "https://images.unsplash.com/photo-1591337676887-a217a6970a8a?w=600&h=400&fit=crop",
      "accessory": "https://images.unsplash.com/photo-1525547719571-a2d4ac8945e2?w=600&h=400&fit=crop",
    };
    
    return placeholders[categoryName] || placeholders["skin"];
  };

  const getCategoryLink = (categoryName: string) => {
    // Special handling for skins - opens gadget selector
    if (categoryName === "skin") {
      return "/products?productCategory=skin";
    }
    
    // For other categories, link directly to products page with filter
    return `/products?productCategory=${categoryName}`;
  };

  return (
    <section className="container mx-auto px-4 py-12">
      <div className="space-y-8">
        {/* Title */}
        <div className="text-center space-y-2">
          <h2 className="text-3xl md:text-4xl font-bold">
            Explore by Category
          </h2>
          <p className="text-muted-foreground">
            Browse our full range of products
          </p>
        </div>

        {/* Category Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
          {categories.map((category) => (
            <Link
              key={category._id}
              to={getCategoryLink(category.categoryName)}
              className="group relative aspect-[4/3] rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-[1.02]"
            >
              {/* Background Image */}
              <img
                src={getCategoryImage(category.categoryName, category.imageUrl)}
                alt={category.displayName}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
              />
              
              {/* Gradient Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
              
              {/* Content */}
              <div className="absolute inset-0 flex flex-col items-center justify-end p-6 text-center">
                <h3 className="text-xl md:text-2xl font-bold text-white mb-2">
                  {category.displayName}
                </h3>
                <div className="flex items-center gap-2 text-white/90 text-sm font-medium">
                  <span>Shop Now</span>
                  <ChevronRightIcon className="size-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
