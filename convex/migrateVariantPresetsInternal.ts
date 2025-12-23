import { internalMutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel.d.ts";

/**
 * Internal mutation to seed variant consumption presets for gadget types.
 * Creates common presets like "Lid Only", "Lid + Keyboard" for laptops, etc.
 */
export const seedVariantPresets = internalMutation({
  args: {},
  handler: async (ctx): Promise<{ success: boolean; created: number; message: string }> => {
    // Get all gadget types
    const gadgetTypes = await ctx.db.query("gadgetTypes").collect();
    
    // Map gadget type names to IDs
    const typeMap = new Map<string, Id<"gadgetTypes">>();
    for (const gt of gadgetTypes) {
      typeMap.set(gt.name.toLowerCase(), gt._id);
    }

    let created = 0;
    const now = Date.now();

    // Define preset templates for each gadget type
    const presetTemplates: Array<{
      gadgetTypeName: string;
      presets: Array<{
        name: string;
        multiplier: number;
        description: string;
      }>;
    }> = [
      {
        gadgetTypeName: "phone",
        presets: [
          { name: "Back Only", multiplier: 0.5, description: "Covers only the back of the phone" },
          { name: "Full Wrap", multiplier: 1.0, description: "Full body wrap including sides" },
        ],
      },
      {
        gadgetTypeName: "laptop",
        presets: [
          { name: "Lid Only", multiplier: 0.5, description: "Covers only the laptop lid" },
          { name: "Lid + Keyboard", multiplier: 1.0, description: "Covers lid and keyboard deck" },
          { name: "Full Body", multiplier: 1.5, description: "Complete coverage including bottom" },
        ],
      },
      {
        gadgetTypeName: "tablet",
        presets: [
          { name: "Back Only", multiplier: 0.5, description: "Covers only the back of the tablet" },
          { name: "Full Wrap", multiplier: 1.0, description: "Full body wrap" },
        ],
      },
      {
        gadgetTypeName: "drone",
        presets: [
          { name: "Body Only", multiplier: 1.0, description: "Drone body only" },
          { name: "Body + Controller", multiplier: 1.5, description: "Drone body and controller" },
        ],
      },
      {
        gadgetTypeName: "camera",
        presets: [
          { name: "Body Only", multiplier: 1.0, description: "Camera body only" },
        ],
      },
      {
        gadgetTypeName: "lens",
        presets: [
          { name: "Standard", multiplier: 1.0, description: "Standard lens coverage" },
        ],
      },
      {
        gadgetTypeName: "charger",
        presets: [
          { name: "Standard", multiplier: 1.0, description: "Standard charger coverage" },
        ],
      },
      {
        gadgetTypeName: "console",
        presets: [
          { name: "Console Only", multiplier: 1.0, description: "Console unit only" },
          { name: "Console + Controllers", multiplier: 1.5, description: "Console and controllers" },
        ],
      },
      {
        gadgetTypeName: "mac mini",
        presets: [
          { name: "Top + Sides", multiplier: 1.0, description: "Top and side coverage" },
        ],
      },
    ];

    // Create presets for each gadget type
    for (const template of presetTemplates) {
      const gadgetTypeId = typeMap.get(template.gadgetTypeName);
      
      if (!gadgetTypeId) {
        console.log(`Skipping ${template.gadgetTypeName}: gadget type not found`);
        continue;
      }

      // Check if presets already exist for this gadget type
      const existingPresets = await ctx.db
        .query("variantConsumptionPresets")
        .withIndex("by_gadget_type", (q) => q.eq("gadgetTypeId", gadgetTypeId))
        .collect();

      // Skip if presets already exist
      if (existingPresets.length > 0) {
        console.log(`Skipping ${template.gadgetTypeName}: presets already exist`);
        continue;
      }

      // Create presets
      for (const preset of template.presets) {
        await ctx.db.insert("variantConsumptionPresets", {
          gadgetTypeId,
          name: preset.name,
          multiplier: preset.multiplier,
          description: preset.description,
          isActive: true,
          createdAt: now,
        });
        created++;
        console.log(`Created preset: ${template.gadgetTypeName} - ${preset.name}`);
      }
    }

    return {
      success: true,
      created,
      message: `Successfully created ${created} variant consumption presets`,
    };
  },
});
