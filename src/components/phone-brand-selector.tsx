import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog.tsx";
import { SearchIcon } from "lucide-react";
import { useQuery } from "@/lib/firebase-hooks";
import { api } from "@/lib/firebase-api";
import { useState, useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Link, useNavigate } from "react-router-dom";

// Brand logo mapping removed as per migration
const brandLogos: Record<string, string> = {};

// Fallback phone brands for instant cold start display
const FALLBACK_PHONE_BRANDS = [
  "Apple", "Samsung", "OnePlus", "Nothing", "CMF", "Oppo", "Realme", 
  "Vivo", "iQOO", "Xiaomi", "Google", "Motorola", "Poco", "Honor",
  "Asus", "Infinix", "Lava", "Tecno", "HMD"
];

export function PhoneBrandSelector() {
  const navigate = useNavigate();
  const [selectedPhoneBrand, setSelectedPhoneBrand] = useState<string | null>(null);
  const [phoneModelSearch, setPhoneModelSearch] = useState("");

  // Fetch metadata from cache
  const metadata = useQuery(api.supportedModels.getMetadata);
  
  // Get brands from cache with fallback
  const phoneBrands = metadata?.byCategory.phone.brands || FALLBACK_PHONE_BRANDS;

  // Lazy load phone models when user selects a brand
  const brandModels = useQuery(
    api.supportedModels.getBrandModels,
    selectedPhoneBrand ? { brand: selectedPhoneBrand, category: "phone" } : "skip"
  );

  // Get filtered phone models for selected brand
  const filteredPhoneModels = useMemo(() => {
    if (!brandModels) return [];
    const models = brandModels.map(m => m.modelName);
    if (!phoneModelSearch) return models;
    const query = phoneModelSearch.toLowerCase();
    return models.filter(model => model.toLowerCase().includes(query));
  }, [brandModels, phoneModelSearch]);

  // Handle phone brand selection
  const handlePhoneBrandSelect = (brand: string) => {
    setSelectedPhoneBrand(brand);
    setPhoneModelSearch("");
  };

  // Handle phone model selection
  const handlePhoneModelSelect = (model: string) => {
    if (!selectedPhoneBrand) return;
    navigate(`/products?brand=${encodeURIComponent(selectedPhoneBrand)}&model=${encodeURIComponent(model)}&fromGadgetSelector=true`);
  };

  return (
    <section className="py-16 px-4">
      <div className="container mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-black mb-4">Pick Your Device Brand</h2>
          <p className="text-xl text-muted-foreground">Select your brand and we'll show you the perfect skin</p>
        </div>

        {/* Brand Grid */}
        {metadata === undefined ? (
          // Loading state
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6 max-w-5xl mx-auto">
            {Array.from({ length: 12 }).map((_, i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        ) : phoneBrands.length === 0 ? (
          // Empty state
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">No phone brands available</p>
            <Button variant="outline" asChild>
              <Link to="/devices">View All Devices</Link>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6 max-w-5xl mx-auto">
            {phoneBrands.map(brand => (
              <button
                key={brand}
                onClick={() => handlePhoneBrandSelect(brand)}
                className="p-6 rounded-xl border-2 border-border hover:border-primary hover:shadow-lg transition-all bg-white flex flex-col items-center gap-3"
              >
                {brandLogos[brand] ? (
                  <div className="size-16 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                    <img 
                      src={brandLogos[brand]} 
                      alt={brand}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center text-2xl font-bold">
                    {brand[0]}
                  </div>
                )}
                <span className="font-semibold text-center">{brand}</span>
              </button>
            ))}
          </div>
        )}

        {/* Phone Model Selection Dialog */}
        {selectedPhoneBrand && (
          <Dialog open={!!selectedPhoneBrand} onOpenChange={(open) => !open && setSelectedPhoneBrand(null)}>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-3xl">Select Your {selectedPhoneBrand} Model</DialogTitle>
                <p className="text-muted-foreground">Choose your phone model to see compatible skins</p>
              </DialogHeader>

              {/* Search Input */}
              <div className="relative my-4">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search models..."
                  value={phoneModelSearch}
                  onChange={(e) => setPhoneModelSearch(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Model List */}
              <div className="space-y-2">
                {brandModels === undefined ? (
                  // Loading state
                  <div className="flex flex-col items-center justify-center py-12 gap-3">
                    <div className="size-8 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
                    <p className="text-sm text-muted-foreground">Loading your models...</p>
                  </div>
                ) : filteredPhoneModels.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No models found</p>
                ) : (
                  filteredPhoneModels.map((model, idx) => (
                    <button
                      key={idx}
                      onClick={() => handlePhoneModelSelect(model)}
                      className="w-full flex items-center justify-between p-4 rounded-lg border-2 border-border hover:border-primary hover:bg-muted/50 transition-all text-left"
                    >
                      <span className="font-medium">{model}</span>
                      <span className="text-primary">Select →</span>
                    </button>
                  ))
                )}
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </section>
  );
}
