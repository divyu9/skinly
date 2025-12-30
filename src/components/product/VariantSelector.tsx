interface Variant {
  _id: string;
  title: string;
  price: number;
}

interface VariantSelectorProps {
  variants: Variant[];
  selectedVariant: number;
  onVariantChange: (index: number) => void;
}

export function VariantSelector({
  variants,
  selectedVariant,
  onVariantChange,
}: VariantSelectorProps) {
  if (variants.length <= 1) return null;
  
  return (
    <div className="space-y-2">
      <label className="text-sm font-semibold">Select Finish</label>
      <div className="grid grid-cols-2 gap-2">
        {variants.map((variant, idx) => (
          <button
            key={variant._id}
            onClick={() => onVariantChange(idx)}
            className={`p-3 rounded-lg border-2 transition-all text-left ${
              selectedVariant === idx
                ? "border-primary bg-primary/10"
                : "border-border hover:border-primary/50"
            }`}
          >
            <div className="font-medium text-sm">{variant.title}</div>
            <div className="font-bold text-primary text-sm">
              ₹{variant.price.toFixed(0)}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
