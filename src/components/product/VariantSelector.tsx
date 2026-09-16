interface Variant {
  _id: string;
  title: string;
  price: number;
}

interface VariantSelectorProps {
  variants: Variant[];
  selectedVariant: number;
  onVariantChange: (index: number) => void;
  /** What the options are — a finish, a phone model, a bundle. */
  label?: string;
}

/**
 * A variant with no price is not for sale — it is a row someone imported and
 * never priced. New Hexa Ring had twenty of them, which put "₹0 - ₹249" on the
 * page and offered "iPhone 15 Pro / Green · ₹0" as a choice. They are left
 * out here; indices still refer to the full list.
 */
export const isPriced = (v: { price?: number }) => Number(v?.price) > 0;

export function VariantSelector({
  variants,
  selectedVariant,
  onVariantChange,
  label = "Select Option",
}: VariantSelectorProps) {
  const options = variants
    .map((variant, idx) => ({ variant, idx }))
    .filter(({ variant }) => isPriced(variant));
  if (options.length <= 1) return null;

  return (
    <div className="space-y-2">
      <label className="text-sm font-semibold">{label}</label>
      <div className="grid grid-cols-2 gap-2">
        {options.map(({ variant, idx }) => (
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
