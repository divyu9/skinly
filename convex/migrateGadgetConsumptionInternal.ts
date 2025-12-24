import { internalMutation } from "./_generated/server";

/**
 * Internal mutation: Link gadgetConsumption to gadgetTypes and seed missing data
 */
export const linkAndSeedConsumption = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Get all gadget types
    const gadgetTypes = await ctx.db.query("gadgetTypes").collect();
    
    // Get all existing gadget consumption entries
    const existingConsumption = await ctx.db.query("gadgetConsumption").collect();
    
    // Create a map of existing consumption by category name (lowercase)
    const consumptionByName = new Map(
      existingConsumption.map(c => [c.categoryName.toLowerCase(), c])
    );
    
    let linked = 0;
    let created = 0;
    let skipped = 0;
    
    // Default consumption values based on typical device dimensions (in cm)
    const defaultConsumption: Record<string, { lengthCm: number; widthCm: number; notes: string }> = {
      "phone": { lengthCm: 15, widthCm: 8, notes: "Standard phone dimensions" },
      "laptop": { lengthCm: 42, widthCm: 29.5, notes: "Standard laptop dimensions" },
      "tablet": { lengthCm: 25, widthCm: 20, notes: "Standard tablet dimensions" },
      "camera": { lengthCm: 40, widthCm: 29.5, notes: "Standard camera body dimensions" },
      "lens": { lengthCm: 20, widthCm: 10, notes: "Standard lens dimensions" },
      "drone": { lengthCm: 35, widthCm: 29.5, notes: "Standard drone dimensions" },
      "charger": { lengthCm: 10, widthCm: 8, notes: "Standard charger dimensions" },
      "console": { lengthCm: 40, widthCm: 29.5, notes: "Standard console dimensions" },
      "mac-mini": { lengthCm: 20, widthCm: 20, notes: "Mac Mini dimensions" },
      "cover": { lengthCm: 15, widthCm: 8, notes: "Standard cover dimensions" },
      "accessory": { lengthCm: 10, widthCm: 8, notes: "Standard accessory dimensions" },
    };
    
    // Process each gadget type
    for (const gadgetType of gadgetTypes) {
      const nameLower = gadgetType.name.toLowerCase();
      
      // Check if consumption entry exists for this gadget type
      const existing = consumptionByName.get(nameLower);
      
      if (existing) {
        // Link existing consumption to gadget type (if not already linked)
        if (!existing.gadgetTypeId) {
          await ctx.db.patch(existing._id, {
            gadgetTypeId: gadgetType._id,
          });
          linked++;
        } else {
          skipped++;
        }
      } else {
        // Create new consumption entry with defaults
        const defaults = defaultConsumption[nameLower];
        
        if (defaults) {
          await ctx.db.insert("gadgetConsumption", {
            categoryName: gadgetType.displayName,
            gadgetTypeId: gadgetType._id,
            lengthCm: defaults.lengthCm,
            widthCm: defaults.widthCm,
            notes: defaults.notes,
          });
          created++;
        } else {
          // Fallback for unknown gadget types
          await ctx.db.insert("gadgetConsumption", {
            categoryName: gadgetType.displayName,
            gadgetTypeId: gadgetType._id,
            lengthCm: 15,
            widthCm: 8,
            notes: "Default dimensions - please update",
          });
          created++;
        }
      }
    }
    
    return {
      success: true,
      linked,
      created,
      skipped,
      message: `Linked ${linked} existing entries, created ${created} new entries, skipped ${skipped} already linked entries`,
    };
  },
});
