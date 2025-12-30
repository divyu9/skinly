import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";

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
              {brands.map((brand) => (
                <Button
                  key={brand}
                  variant="outline"
                  className="h-auto py-4"
                  onClick={() => onBrandSelect(brand)}
                >
                  {brand}
                </Button>
              ))}
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
                  <p className="text-sm text-muted-foreground">
                    Can't find your model?
                  </p>
                  <Button variant="outline" onClick={onRequestModel}>
                    Request Your Model →
                  </Button>
                </div>
              )}
            </div>
            
            <div className="pt-4 border-t">
              <Button
                variant="ghost"
                onClick={onBackToBrands}
                className="w-full"
              >
                ← Back to Brands
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
