/**
 * How much sheet a variant uses, as the stock maths reads it
 * (variant.materialMultiplier — functions/src/materials.ts).
 *
 * A custom figure wins, then the chosen preset's, then what the variant
 * already had. That last step matters: launches write the multiplier with no
 * preset (a laptop's "Top + Keyboard Area" is 2), and falling back to 1
 * instead quietly halved its sheet use whenever the product was saved.
 */
export function resolveMaterialMultiplier(
  variant: { customMultiplier?: string; consumptionPresetId?: string },
  presets: Array<{ _id: string; multiplier?: number }> | undefined,
  current?: number,
): number {
  const custom = parseFloat(variant.customMultiplier || "");
  if (custom > 0) return custom;
  const preset = variant.consumptionPresetId ? presets?.find((p) => p._id === variant.consumptionPresetId) : undefined;
  if (Number(preset?.multiplier) > 0) return Number(preset!.multiplier);
  return Number(current) > 0 ? Number(current) : 1;
}
