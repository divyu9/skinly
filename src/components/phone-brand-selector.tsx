import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog.tsx";
import { SearchIcon } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { useState, useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Link, useNavigate } from "react-router-dom";

// Brand logo mapping
const brandLogos: Record<string, string> = {
  "Acer": "https://cdn.hercules.app/file_VPsF9hKlLl5MN9q0RE6GFnB1",
  "Apple": "https://cdn.hercules.app/file_qcbK94JAlKCQO3s4ECR3BDw8",
  "Asus": "https://cdn.hercules.app/file_4m1ytbCQzLWgFlSMk1J1ZCru",
  "CMF": "https://cdn.hercules.app/file_4c1OKYG0fSACOsMluL75owT2",
  "Canon": "https://cdn.hercules.app/file_off0gfWoUMcir0QQZCzi7GIU",
  "DJI": "https://cdn.hercules.app/file_EGoBVi2MqXFIfQ9azAk17mLW",
  "Dell": "https://cdn.hercules.app/file_2tP7hAQL78de6m08Vul1woh2",
  "Google": "https://cdn.hercules.app/file_9C2bkc6R18Zlw3kzIlyEc37z",
  "HP": "https://cdn.hercules.app/file_tmMxAwkMVSRtMfVY57qWMZUV",
  "HMD": "https://cdn.hercules.app/file_6SgBKQgyl2Yu5etoIDWd7brZ",
  "Honor": "https://cdn.hercules.app/file_we74pfzTJnEtTUdJhYuW5ThV",
  "Infinix": "https://cdn.hercules.app/file_vAGQJl0uxGOQGpi2bezQ1Awc",
  "Lava": "https://cdn.hercules.app/file_7hHzwp413xD518fxJ5x0baw6",
  "Lenovo": "https://cdn.hercules.app/file_LFviHa1inqcy1Wep9Y5iFpO9",
  "Motorola": "https://cdn.hercules.app/file_mrd4R2pm62O76PqkzhyqHbeh",
  "Nikon": "https://cdn.hercules.app/file_ylLjoFqbjC30tGQqjNW6HyTr",
  "Nothing": "https://cdn.hercules.app/file_n1uEhYdL5ZtXcIo6CRLXRG9L",
  "One Plus": "https://cdn.hercules.app/file_CFmZ3JACXeL3XhcE9uOqiEGB",
  "Oppo": "https://cdn.hercules.app/file_MJ0Tzj4OvYrNYt0PiECFcoL3",
  "PlayStation": "https://cdn.hercules.app/file_G2wSLrMTBTW2Kcy9GtGCv5KW",
  "Poco": "https://cdn.hercules.app/file_DMUZvqLtfG3xqHV8GA1rnCJD",
  "Realme": "https://cdn.hercules.app/file_NrBIl0OOhvh0eLyAhLKluYU9",
  "Samsung": "https://cdn.hercules.app/file_wtgTFk2vMW6YlMu15GbUnFvJ",
  "Sony": "https://cdn.hercules.app/file_8mYsjEHmr72IQRnEON8FEfD2",
  "Tecno": "https://cdn.hercules.app/file_d4D7g77UjY356BBldBKW7HNo",
  "Vivo": "https://cdn.hercules.app/file_o3IQVV2jjv2h9nbO09Wf08D6",
  "Xbox": "https://cdn.hercules.app/file_RMC3F2D6573iOGnDKKenuTH7",
  "Xiaomi": "https://cdn.hercules.app/file_8B5z2x34UxKbxnje3MH1w59O",
  "iQOO": "https://cdn.hercules.app/file_m1bBgRqmZsG4VorENlmoX7w0",
};

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
    navigate(`/products/confirm?brand=${encodeURIComponent(selectedPhoneBrand)}&model=${encodeURIComponent(model)}`);
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
