import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { brandKey, loadCatalogue, type BrandLogo } from "@/lib/catalogue";

/** The same logos the admin sets on the homepage's Explore by Brand section. */
let brandLogosPromise: Promise<Record<string, BrandLogo>> | null = null;
const loadBrandLogos = () =>
  (brandLogosPromise ||= loadCatalogue().then((c) => c?.brandLogos || {}).catch(() => ({} as Record<string, BrandLogo>)));

interface ModelSelectorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedBrand: string;
  searchQuery: string;
  modelsByBrand: Record<string, string[]>;
  filteredModels: string[];
  onBrandSelect: (brand: string) => void;
  onSearchChange: (query: string) => void;
  onModelSelect: (model: string, brand: string) => void;
  onBackToBrands: () => void;
  onRequestModel: () => void;
}

const chevronLeft = (
  <svg viewBox="0 0 16 16" fill="none" className="size-4" aria-hidden="true">
    <path d="M10 3.5 5.5 8l4.5 4.5" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export function ModelSelectorDialog({
  open,
  onOpenChange,
  selectedBrand,
  searchQuery,
  modelsByBrand,
  filteredModels,
  onBrandSelect,
  onSearchChange,
  onModelSelect,
  onBackToBrands,
  onRequestModel,
}: ModelSelectorDialogProps) {
  const brands = Object.keys(modelsByBrand).sort();
  // A single brand opens straight on its models — there is no brand screen
  // to return to, so the button had nothing to do but bounce straight back.
  const hasBrandsToGoBackTo = brands.length > 1;

  const [brandLogos, setBrandLogos] = useState<Record<string, BrandLogo>>({});
  const [brokenLogo, setBrokenLogo] = useState<Set<string>>(new Set());
  useEffect(() => {
    let live = true;
    void loadBrandLogos().then((logos) => { if (live) setBrandLogos(logos); });
    return () => { live = false; };
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        {!selectedBrand ? (
          // Brand Selection View
          <>
            <DialogHeader>
              <DialogTitle>Select Device Brand</DialogTitle>
              <DialogDescription>
                Choose your device brand to see available models
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 overflow-y-auto pr-2">
              {brands.map((brand) => {
                const key = brandKey(brand);
                const logo = brandLogos[key];
                const showLogo = !!logo?.image && !brokenLogo.has(key);
                return (
                  <Button
                    key={brand}
                    variant="outline"
                    className="h-auto flex-col gap-2 py-4"
                    onClick={() => onBrandSelect(brand)}
                  >
                    {showLogo ? (
                      <span className="flex size-10 items-center justify-center overflow-hidden rounded-full bg-muted">
                        <img
                          src={logo!.image}
                          alt=""
                          loading="lazy"
                          onError={() => setBrokenLogo((prev) => new Set(prev).add(key))}
                          className="size-7 object-contain"
                        />
                      </span>
                    ) : (
                      <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-sm font-bold">
                        {brand[0]?.toUpperCase()}
                      </span>
                    )}
                    {brand}
                  </Button>
                );
              })}
            </div>
          </>
        ) : (
          // Model Selection View
          <>
            <DialogHeader>
              <DialogTitle>Select {selectedBrand} Model</DialogTitle>
              <DialogDescription>
                {filteredModels.length} models available
              </DialogDescription>
            </DialogHeader>
            
            <Input
              placeholder={`Search ${selectedBrand} models...`}
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="mb-2"
            />
            
            <div className="flex-1 overflow-y-auto pr-2 space-y-2">
              {filteredModels.length > 0 ? (
                filteredModels.map((model) => (
                  <Button
                    key={model}
                    variant="outline"
                    className="w-full justify-start text-left h-auto py-3"
                    onClick={() => onModelSelect(model, selectedBrand)}
                  >
                    {model}
                  </Button>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
                  <p className="text-muted-foreground">
                    No models found matching "{searchQuery}"
                  </p>
                </div>
              )}
            </div>

            {/* Always offered, not only once a search comes up empty — most
                shoppers whose model is missing scan the list rather than
                type a name they already know isn't there. */}
            <div className="flex items-center justify-between gap-2 pt-3 border-t text-sm">
              <span className="text-muted-foreground">Can't find your model?</span>
              <Button variant="link" className="h-auto p-0" onClick={onRequestModel}>
                Request it →
              </Button>
            </div>

            {hasBrandsToGoBackTo && (
              <div className="pt-2">
                <Button
                  variant="ghost"
                  onClick={onBackToBrands}
                  className="w-full"
                >
                  {chevronLeft}
                  Back to Brands
                </Button>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
