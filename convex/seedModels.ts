import { mutation, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

// This is a one-time seed mutation to populate the supportedModels table
// with all pre-existing device data from the codebase

export const seedAllModelsInternal = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Check if already seeded
    const existingModels = await ctx.db.query("supportedModels").take(1);
    if (existingModels.length > 0) {
      return { success: false, message: "Models already seeded. Use force seed to re-populate." };
    }

    const models = [];

    // Phone Models - ALL BRANDS
    const phoneModels: Record<string, string[]> = {
      "Apple": [
        "iPhone 17 Pro Max", "iPhone 17 Pro", "iPhone 17 Air", "iPhone 17", "iPhone 16E",
        "iPhone 16 Pro Max", "iPhone 16 Pro", "iPhone 16 Plus", "iPhone 16",
        "iPhone 15 Pro Max", "iPhone 15 Pro", "iPhone 15 Plus", "iPhone 15",
        "iPhone 14 Pro Max", "iPhone 14 Pro", "iPhone 14 Plus", "iPhone 14",
        "iPhone 13 Pro Max", "iPhone 13 Pro", "iPhone 13 Mini", "iPhone 13",
        "iPhone 12 Pro Max", "iPhone 12 Pro", "iPhone 12 Mini", "iPhone 12",
        "iPhone 11 Pro Max", "iPhone 11 Pro", "iPhone 11",
        "iPhone XS Max", "iPhone XS", "iPhone XR", "iPhone X",
        "iPhone 8 Plus", "iPhone 8", "iPhone 7 Plus", "iPhone 7",
        "iPhone 6S Plus", "iPhone 6S", "iPhone 6 Plus", "iPhone 6",
        "iPhone SE", "iPhone 5E", "iPhone 5S", "iPhone 5"
      ],
      "Samsung": [
        "Samsung Galaxy S25 Edge", "Samsung Galaxy S25 Plus", "Samsung Galaxy S25 Ultra (5G)", "Samsung Galaxy S25 (5G)",
        "Samsung Galaxy S24 Ultra (5G)", "Samsung Galaxy S24 Plus", "Samsung Galaxy S24 (5G)", "Samsung Galaxy S24 FE (5G)",
        "Samsung Galaxy S23 FE (5G)", "Samsung Galaxy S23 (5G)", "Samsung Galaxy S22 Ultra", "Samsung Galaxy S22 Plus", "Samsung Galaxy S22",
        "Samsung Galaxy S21 Ultra 5G", "Samsung Galaxy S21 Plus 5G", "Samsung Galaxy S21 FE 5G", "Samsung Galaxy S21 5G",
        "Samsung Galaxy S20 Ultra", "Samsung Galaxy S20 Plus", "Samsung Galaxy S20 FE", "Samsung Galaxy S20",
        "Samsung Galaxy S10E", "Samsung Galaxy S10 Plus", "Samsung Galaxy S10 Lite", "Samsung Galaxy S10",
        "Samsung Galaxy S9 Plus", "Samsung Galaxy S9",
        "Samsung Galaxy Z Fold 5", "Samsung Galaxy Z Fold 4", "Samsung Galaxy Z Fold 3", "Samsung Galaxy Z Fold 2", "Samsung Galaxy Fold",
        "Samsung Galaxy Z Flip 5", "Samsung Galaxy Z Flip 4", "Samsung Galaxy Z Flip 3 (5G)",
        "Samsung Galaxy A80", "Samsung Galaxy A73", "Samsung Galaxy A72", "Samsung Galaxy A71", "Samsung Galaxy A70s", "Samsung Galaxy A70",
        "Samsung Galaxy A55 (5G)", "Samsung Galaxy A54 (5G)", "Samsung Galaxy A53 (5G)", "Samsung Galaxy A52s (5G)", "Samsung Galaxy A51",
        "Samsung Galaxy A50S", "Samsung Galaxy A50", "Samsung Galaxy A42", "Samsung Galaxy A41", "Samsung Galaxy A35 (5G)",
        "Samsung Galaxy A34 (5G)", "Samsung Galaxy A33(5G)", "Samsung Galaxy A31", "Samsung Galaxy A30s", "Samsung Galaxy A30",
        "Samsung Galaxy A25 (5G)", "Samsung Galaxy A23 (5G)", "Samsung Galaxy A22 (5G)", "Samsung Galaxy A22",
        "Samsung Galaxy A21S", "Samsung Galaxy A21", "Samsung Galaxy A20S", "Samsung Galaxy A20E", "Samsung Galaxy A20",
        "Samsung Galaxy A16", "Samsung Galaxy A15 (5G)", "Samsung Galaxy A14 (5G)", "Samsung Galaxy A13 (5G)", "Samsung Galaxy A13 4G",
        "Samsung Galaxy A12", "Samsung Galaxy A10S", "Samsung Galaxy A10",
        "Samsung Galaxy A9 Pro", "Samsung Galaxy A9 2018", "Samsung Galaxy A9 2016", "Samsung Galaxy A9",
        "Samsung Galaxy A8 Star", "Samsung Galaxy A8 Plus", "Samsung Galaxy A Plus 2018",
        "Samsung Galaxy A04S", "Samsung Galaxy A04E", "Samsung Galaxy A03", "Samsung Galaxy Alpha",
        "Samsung Galaxy M62", "Samsung Galaxy M56", "Samsung Galaxy M53 (5G)", "Samsung Galaxy M52 (5G)", "Samsung Galaxy M51",
        "Samsung Galaxy M42", "Samsung Galaxy M40", "Samsung Galaxy M35 (5G)", "Samsung Galaxy M34 (5G)", "Samsung Galaxy M33 (5G)",
        "Samsung Galaxy M32 (5G)", "Samsung Galaxy M32", "Samsung Galaxy M31s", "Samsung Galaxy M31", "Samsung Galaxy M30S", "Samsung Galaxy M30",
        "Samsung Galaxy M21 2021", "Samsung Galaxy M21", "Samsung Galaxy M20",
        "Samsung Galaxy M14 (5G)", "Samsung Galaxy M13 (5G)", "Samsung Galaxy M12", "Samsung Galaxy M11", "Samsung Galaxy M10", "Samsung Galaxy M02",
        "Samsung Galaxy Note 20 Ultra", "Samsung Galaxy Note 20", "Samsung Galaxy Note 10 Plus", "Samsung Galaxy Note 10 Lite", "Samsung Galaxy Note 10", "Samsung Galaxy Note 9 Pro",
        "Samsung Galaxy F62", "Samsung Galaxy F54 (5G)", "Samsung Galaxy F42 (5G)", "Samsung Galaxy F41",
        "Samsung Galaxy F23", "Samsung Galaxy F22", "Samsung Galaxy F15 (5G)", "Samsung Galaxy F14 (5G)", "Samsung Galaxy F13", "Samsung Galaxy F12",
        "Samsung Galaxy J8 2018", "Samsung Galaxy J7 Pro", "Samsung Galaxy J7 Prime", "Samsung Galaxy J7 Next",
        "Samsung Galaxy C9 Pro", "Samsung Galaxy C7 Pro", "Samsung Galaxy E7", "Samsung Galaxy E5",
        "Samsung Galaxy On Next", "Samsung Galaxy On 8"
      ],
      "Nothing": ["Nothing Phone 3A Pro", "Nothing Phone 3A", "Nothing Phone 2A", "Nothing Phone 2", "Nothing Phone 1 5G"],
      "CMF": ["CMF Phone 2 Pro", "CMF Phone 1"],
      "Oppo": [
        "Oppo Find 8X Pro (5G)", "Oppo Find 8X (5G)", "Oppo Find X2", "Oppo Find X", "Oppo Find N",
        "Oppo Reno 14 Pro 5G", "Oppo Reno 14 5G", "Oppo Reno 14F 5G", "Oppo Reno 13 Pro (5G)", "Oppo Reno 13 (5G)",
        "Oppo Reno 12 Pro (5G)", "Oppo Reno 12F", "Oppo Reno 12 (5G)", "Oppo Reno 11 Pro (5G)", "Oppo Reno 10X Zoom",
        "Oppo Reno 10 Pro Plus (5G)", "Oppo Reno 10 Pro (5G)", "Oppo Reno 10 (5G)",
        "Oppo Reno 8 Pro (5G)", "Oppo Reno 8T (5G)", "Oppo Reno 8 (5G)",
        "Oppo Reno 7 Pro (5G)", "Oppo Reno 7 (5G)", "Oppo Reno 6 Pro (5G)", "Oppo Reno 6",
        "Oppo Reno 5Z", "Oppo Reno 5 Pro", "Oppo Reno 5", "Oppo Reno 4 Pro", "Oppo Reno 4",
        "Oppo Reno 3 Pro", "Oppo Reno 2Z", "Oppo Reno 2", "Oppo Reno",
        "Oppo F31 Pro Plus 5G", "Oppo F31 Pro 5G", "Oppo F31 5G", "Oppo F29 Pro (5G)", "Oppo F29 (5G)",
        "Oppo F27 Pro Plus (5G)", "Oppo F27 (5G)", "Oppo F25 Pro (5G)", "Oppo F23 (5G)",
        "Oppo F21s Pro (5G)", "Oppo F21 Pro (5G)", "Oppo F21s Pro", "Oppo F21 Pro (4G)",
        "Oppo F19S", "Oppo F19 Pro Plus", "Oppo F19 Pro", "Oppo F19",
        "Oppo F17 Pro", "Oppo F17", "Oppo F15", "Oppo F11 Pro", "Oppo F11",
        "Oppo F9 Pro Plus", "Oppo F9 Pro", "Oppo F9", "Oppo F7", "Oppo F5",
        "Oppo F3 Plus", "Oppo F3", "Oppo F1 Plus", "Oppo F1S", "Oppo F1",
        "Oppo K13 Turbo 5G", "Oppo K13x 5G", "Oppo K13 5G", "Oppo K12X (5G)", "Oppo K10 (5G)",
        "Oppo K9 Pro 5G", "Oppo K9S", "Oppo K9 5G", "Oppo K3", "Oppo K1",
        "Oppo A96", "Oppo A95 (5G)", "Oppo A83", "Oppo A79 (5G)", "Oppo A78 (5G)", "Oppo A78 (4G)",
        "Oppo A77S", "Oppo A77 (4G)", "Oppo A76", "Oppo A74 (5G)", "Oppo A71",
        "Oppo A58 (4G)", "Oppo A57", "Oppo A55 4G", "Oppo A54 (5G)", "Oppo A53s (5G)", "Oppo A53",
        "Oppo A52", "Oppo A51", "Oppo A37", "Oppo A33", "Oppo A31", "Oppo A1K",
        "Oppo R17 Pro", "Oppo R15 Pro", "Oppo R15", "Oppo R9", "Oppo R7",
        "Oppo Neo 7", "Oppo Neo 5"
      ],
      "Realme": [
        "Realme GT 7T 5G", "Realme GT7 Pro 5G", "Realme GT7 5G", "Realme GT Neo 7 Pro",
        "Realme GT 6T (5G)", "Realme GT6 (5G)", "Realme GT Neo 3T", "Realme GT Neo 3 (5G)",
        "Realme GT Neo 2 (5G)", "Realme GT 2 Pro", "Realme GT 2", "Realme GT Edition (5G)", "Realme GT (5G)",
        "Realme P4 Pro 5G", "Realme P4 5G", "Realme P3X", "Realme P3 Ultra (5G)", "Realme P3 Pro",
        "Realme P3 (5G)", "Realme P2 Pro 5G", "Realme P1 Speed 5G", "Realme P1 Pro", "Realme P1 (5G)",
        "Realme X7 Pro (5G)", "Realme X7 Max (5G)", "Realme X7 5G", "Realme X50 PRO", "Realme X50",
        "Realme X3 Super Zoom", "Realme X3", "Realme X2 Pro", "Realme X2", "Realme XT", "Realme X",
        "Realme 15 Pro 5G", "Realme 15 5G", "Realme 14T 5G", "Realme 14 Pro Lite",
        "Realme 14 Pro Plus (5G)", "Realme 14 Pro (5G)", "Realme 14X (5G)",
        "Realme 13 Pro Plus 5G", "Realme 13 Plus 5G", "Realme 13 Pro 5G", "Realme 13 5G", "Realme 13",
        "Realme 12 5G", "Realme 12 Pro Plus (5G)", "Realme 12 PRO (5G)", "Realme 12X (5G)",
        "Realme 11Z", "Realme 11 Pro Plus", "Realme 11 PRO", "Realme 11X (5G)", "Realme 11 (5G)",
        "Realme 10 Pro Plus (5G)", "Realme 10 Pro (5G)", "Realme 10",
        "Realme 9 Pro Plus (5G)", "Realme 9 Pro (5G)", "Realme 9 5G SE", "Realme 9i", "Realme 9",
        "Realme 8S (5G)", "Realme 8i", "Realme 8 Pro", "Realme 8", "Realme 8 (4G)",
        "Realme 7 Pro", "Realme 7i", "Realme 7",
        "Realme U1", "Realme 50A Prime", "Realme 50A"
      ],
      "Vivo": [
        "Vivo X200 Pro (5G)", "Vivo X200 FE", "Vivo X200 (5G)", "Vivo X100 Pro", "Vivo X100 (5G)",
        "Vivo X90 Pro", "Vivo X90", "Vivo X80 Pro (5G)", "Vivo X80 (5G)",
        "Vivo X70 Pro Plus (5G)", "Vivo X70 Pro (5G)", "Vivo X60 Pro Plus", "Vivo X60 Pro", "Vivo X60",
        "Vivo X50 Pro", "Vivo X50", "Vivo X21", "Vivo X20 Plus", "Vivo X20", "Vivo X7",
        "Vivo X5 Pro", "Vivo X5 Max", "Vivo X3 S",
        "Vivo V60 5G", "Vivo V50 5G", "Vivo V40 Lite", "Vivo V40 5G", "Vivo V40E (5G)",
        "Vivo V30E", "Vivo V30 5G", "Vivo V30 Pro (5G)", "Vivo V30 Pro", "Vivo V30",
        "Vivo V29e (5G)", "Vivo V29 Pro (5G)", "Vivo V29 (5G)", "Vivo V29 Pro", "Vivo V29",
        "Vivo V27E", "Vivo V27 Pro (5G)", "Vivo V27 (5G)", "Vivo V25 (5G)", "Vivo V25 Pro",
        "Vivo V23e (5G)", "Vivo V23 Pro (5G)", "Vivo V23 (5G)",
        "Vivo V21e (5G)", "Vivo V21e (4G)", "Vivo V21 5G", "Vivo V21",
        "Vivo V20 SE", "Vivo V20 Pro", "Vivo V20", "Vivo V19", "Vivo V17 Pro", "Vivo V17",
        "Vivo V15 Pro", "Vivo V15", "Vivo V11 Pro", "Vivo V11",
        "Vivo V9 Youth", "Vivo V9 Pro", "Vivo V9", "Vivo V7 Plus",
        "Vivo V5 S", "Vivo V5 Plus", "Vivo V5", "Vivo V3 Max", "Vivo V3", "Vivo V1 Max",
        "Vivo Y400 Pro 5G", "Vivo Y400 5G", "Vivo Y300 Plus (5G)", "Vivo Y300 (5G)",
        "Vivo Y200 Pro", "Vivo Y200e (5G)", "Vivo Y200 (5G)", "Vivo Y100A", "Vivo Y100 (5G)",
        "Vivo Y95", "Vivo Y93", "Vivo Y91i", "Vivo Y91", "Vivo Y90",
        "Vivo Y83 Pro", "Vivo Y83", "Vivo Y81i", "Vivo Y81", "Vivo Y79",
        "Vivo Y75 (5G)", "Vivo Y75", "Vivo Y73", "Vivo Y72 (5G)", "Vivo Y71", "Vivo Y69", "Vivo Y66",
        "Vivo Y58 5G", "Vivo Y56 (5G)", "Vivo Y55S", "Vivo Y55L", "Vivo Y55",
        "Vivo Y53S", "Vivo Y53", "Vivo Y51A", "Vivo Y51", "Vivo 50", "Vivo Y50",
        "Vivo Y39 5G", "Vivo Y36", "Vivo Y35 2022", "Vivo Y33T", "Vivo Y33 S",
        "Vivo Y31 Pro 5G", "Vivo Y31", "Vivo Y30",
        "Vivo Y28S (5G)", "Vivo Y28 5G", "Vivo Y28", "Vivo Y27 4G", "Vivo Y27",
        "Vivo Y22 2022", "Vivo Y21L", "Vivo Y21T", "Vivo Y21E 5G", "Vivo Y21E",
        "Vivo Y21 G", "Vivo Y21 2021", "Vivo Y21",
        "Vivo Y20T", "Vivo Y20i", "Vivo Y20G 2021", "Vivo Y20A", "Vivo Y20",
        "Vivo Y19E", "Vivo Y19 5G", "Vivo Y19", "Vivo Y18", "Vivo Y17S", "Vivo Y17", "Vivo Y16",
        "Vivo Y15S", "Vivo Y15C", "Vivo Y15 2019", "Vivo Y15",
        "Vivo Y12s", "Vivo Y12", "Vivo Y11", "Vivo Y02T", "Vivo Y02", "Vivo Y3S",
        "Vivo T45 5G", "Vivo T4X 5G", "Vivo T4R 5G", "Vivo T4 Ultra", "Vivo T4 Lite",
        "Vivo T4 pro", "Vivo T4 5G", "Vivo T3 Ultra (5G)", "Vivo T3 Pro (5G)",
        "Vivo T3 X (5G)", "Vivo T3 (5G)", "Vivo T2 X (5G)", "Vivo T2 Pro (5G)", "Vivo T2 (5G)",
        "Vivo T1X", "Vivo T1 Pro (5G)", "Vivo T1 (5G)", "Vivo T1",
        "Vivo Z1 X", "Vivo Z1 Pro", "Vivo Z10",
        "Vivo S1 Pro", "Vivo S1", "Vivo U20", "Vivo U10", "Vivo U3",
        "Vivo Nex S", "Vivo Nex A", "Vivo Nex", "Vivo A33S"
      ],
      "iQOO": [
        "IQOO 13 5G", "IQOO 12 5G", "IQOO 11 5G", "IQOO 9T", "IQOO 9 Pro 5G",
        "IQOO 9 SE 5G", "IQOO 9 5G", "IQOO 7 Legend", "IQOO 7", "IQOO 3",
        "IQOO Neo 10R", "IQOO Neo 9 Pro", "IQOO Neo 7 PRO", "IQOO Neo 7 PR",
        "IQOO Neo 7 5G", "IQOO Neo 6 5G", "IQOO Neo 3",
        "IQOO Z9X", "IQOO Z9S", "IQOO Z9", "IQOO Z7 S 5G", "IQOO Z7 Pro", "IQOO Z7",
        "IQOO Z6 Lite 5G", "IQOO Z6 PRO 5G", "IQOO Z6 44W", "IQOO Z6 5G",
        "IQOO Z5", "IQOO Z3 5G", "IQOO Z3", "IQOO Z1X"
      ],
      "Xiaomi": [
        "Mi 14 Civi", "Mi 14", "Mi 12S Ultra 5G", "Mi 12 Lite",
        "Mi 11X Pro", "Mi 11 X", "Mi 11 Ultra", "Mi 11 T Pro", "Mi 11i 5G", "Mi 11 Lite",
        "Mi 10T 5G", "Mi 10 T Lite", "Mi 10i", "Mi 10 5G",
        "Redmi Note 14 Pro Plus 5G", "Redmi Note 14 Pro 5G", "Redmi Note 14 5G",
        "Redmi Note 13 Pro Plus 5G", "Redmi Note 13 Pro 5G", "Redmi Note 13 5G",
        "Redmi Note 12 Pro Plus 5G", "Redmi Note 12 Pro 5G", "Redmi Note 12 5G",
        "Redmi Note 11 Pro Plus 5G", "Redmi Note 11 Pro", "Redmi Note 11T 5G",
        "Redmi Note 11SE", "Redmi Note 11",
        "Redmi Note 10T 5G", "Redmi Note 10 Pro Max", "Redmi Note 10 Pro",
        "Redmi Note 10S", "Redmi Note 10",
        "Redmi Note 9T 5G", "Redmi Note 9 Pro Max", "Redmi Note 9 Pro", "Redmi Note 9",
        "Redmi Note 8 Pro", "Redmi Note 8", "Redmi Note 6 Pro",
        "Redmi 13C 5G", "Redmi 13C", "Redmi 12 PRO", "Redmi 12 5G", "Redmi 12 4G",
        "Redmi 11i Hyper Charge", "Redmi 11 Prime 5G", "Redmi 11 Lite NE 5G",
        "Redmi 10 Power", "Redmi 10 Prime", "Redmi 10",
        "Redmi 9i", "Redmi 9 Power", "Redmi 9 Prime",
        "Redmi K50i 5G", "Redmi K20 Pro",
        "Redmi Y3", "Redmi Y2", "Redmi Y1 Lite", "Redmi Y1",
        "Xiaomi Black Shark 2"
      ],
      "Lava": [
        "LAVA Agni 3 (5G)", "LAVA Agni 2 (5G)",
        "LAVA Blaze Curve (5G)", "LAVA Blaze Pro", "LAVA Blaze (5G)"
      ],
      "Infinix": [
        "Infinix GT 20 PRO (5G)", "Infinix GT 10 PRO",
        "Infinix Zero 30 (5G)", "Infinix Zero 30 4G", "Infinix Zero 8i",
        "Infinix Zero 5G", "Infinix Zero (5G)",
        "Infinix Note 40X (5G)", "Infinix Note 40 PRO PLUS", "Infinix Note 40 PRO (5G)",
        "Infinix Note 40 PRO 4G", "Infinix Note 40", "Infinix Note 30 (5G)",
        "Infinix Note 12 Pro (5G)", "Infinix Note 12 G96", "Infinix Note 11S", "Infinix Note 11",
        "Infinix Note 10 PRO", "Infinix Note 10", "Infinix Note 8", "Infinix Note 7",
        "Infinix Note 5", "Infinix Note 4 Pro",
        "Infinix Hot 30i", "Infinix Hot 30", "Infinix Hot 12 Play",
        "Infinix Hot 11S", "Infinix Hot 11", "Infinix Hot 10S", "Infinix Hot 10",
        "Infinix Hot 9 PRO", "Infinix Hot 9", "Infinix Hot 7", "Infinix Hot 6",
        "Infinix Hot 4 PRO", "Infinix Hot 4",
        "Infinix 10 Play", "Infinix Smart 5A"
      ],
      "Asus": [
        "Asus ROG Phone 9 FE", "Asus ROG Phone 8 Pro", "Asus ROG Phone 8",
        "Asus ROG Phone 7 (5G)", "Asus ROG Phone 6 PRO (5G)", "Asus ROG Phone 6 (5G)",
        "Asus ROG Phone 5", "Asus ROG Phone 4", "Asus ROG Phone 3", "Asus ROG Phone 2",
        "Asus Zenfone 12 Ultra", "Asus Zenfone 11 Ultra", "Asus ZENFONE MAX PRO (M1)"
      ],
      "HMD": [
        "HMD Nokia C300", "HMD Nokia G60", "HMD Nokia G42 5G",
        "HMD Nokia G21", "HMD Nokia G20", "HMD Nokia X30",
        "HMD Nokia C32", "HMD Nokia C31", "HMD Nokia C30",
        "HMD Nokia C22", "HMD Nokia C21 Plus", "HMD Nokia C12 Pro", "HMD Nokia 9"
      ]
    };

    for (const [brand, modelsList] of Object.entries(phoneModels)) {
      for (const model of modelsList) {
        models.push({ brandName: brand, modelName: model, category: "phone" as const, isActive: true });
      }
    }

    // Camera Models
    const cameraModels: Record<string, string[]> = {
      "Sony": ["Sony A7r3", "Sony A1", "Sony A7 I", "Sony A7 II", "Sony A7", "Sony A7C", "Sony A7R IV", "Sony Alpha A7 Mark IV", "Sony FX30", "Sony ZV E10"],
      "Nikon": ["Nikon D200", "Nikon D300", "Nikon D500", "Nikon D600", "Nikon D700", "Nikon D750", "Nikon D780", "Nikon D800", "Nikon D810", "Nikon D850"],
      "Canon": ["Canon EOS 5D Mark IV", "Canon EOS R3", "Canon EOS R6 Mark II", "Canon EOS R7", "Canon EOS R50", "Canon EOS R100"]
    };

    for (const [brand, modelsList] of Object.entries(cameraModels)) {
      for (const model of modelsList) {
        models.push({ brandName: brand, modelName: model, category: "camera" as const, isActive: true });
      }
    }

    // Tablet Models
    const tabletModels: Record<string, string[]> = {
      "Apple": ["iPad Pro 13 (M4)", "iPad Pro 11 (M4)", "iPad Air (M2)", "iPad (10th Gen)", "iPad mini (6th Gen)"],
      "Samsung": ["Galaxy Tab S9 Plus", "Galaxy Tab S9 FE Plus", "Galaxy Tab S8", "Galaxy Tab A8"],
      "Lenovo": ["Lenovo Tab P11 Pro", "Lenovo Tab M10", "Lenovo Tab M8"],
      "Xiaomi": ["XIAOMI PAD 6", "Xiaomi Pad 7", "Redmi Pad", "Redmi Pad SE"]
    };

    for (const [brand, modelsList] of Object.entries(tabletModels)) {
      for (const model of modelsList) {
        models.push({ brandName: brand, modelName: model, category: "tablet" as const, isActive: true });
      }
    }

    // Console Models
    const consoleModels: Record<string, string[]> = {
      "PlayStation": ["PS5 - Disk", "PS5 - Digital", "PS5 Slim - Disk", "PS5 Slim - Digital", "PS5 Controller"],
      "Xbox": ["Xbox S", "Xbox X", "Xbox Controller"]
    };

    for (const [brand, modelsList] of Object.entries(consoleModels)) {
      for (const model of modelsList) {
        models.push({ brandName: brand, modelName: model, category: "console" as const, isActive: true });
      }
    }

    // Charger Models
    const chargerModels: Record<string, string[]> = {
      "Apple": ["Apple Macbook 140W Charger", "Apple USB-C Power Adapter 140W", "MagSafe Charger", "iPhone Charger"],
      "OnePlus": ["OnePlus SuperVOOC 100W", "OnePlus SuperVOOC 150W", "OnePlus Warp Charger 65W"],
      "Samsung": ["Samsung Super Fast Charge 3.0 25W Type C", "Samsung Travel Adapter 15W"]
    };

    for (const [brand, modelsList] of Object.entries(chargerModels)) {
      for (const model of modelsList) {
        models.push({ brandName: brand, modelName: model, category: "charger" as const, isActive: true });
      }
    }

    // Drone Models
    const droneModels: Record<string, string[]> = {
      "DJI": ["DJI Mini 4 Pro", "DJI Mavic Pro", "DJI Mavic Air 3", "DJI Mavic Mini 3 Pro", "DJI Phantom 4 Pro"],
      "Xiaomi": ["Xiaomi Fimi X8 SE 2020"]
    };

    for (const [brand, modelsList] of Object.entries(droneModels)) {
      for (const model of modelsList) {
        models.push({ brandName: brand, modelName: model, category: "drone" as const, isActive: true });
      }
    }

    // Mac Mini Models
    const macMiniModels: Record<string, string[]> = {
      "Apple": ["Mac Mini Intel (2018)", "Mac Mini M1 / M1 Pro (2020)", "Mac Mini M2 (2023)", "Mac Mini M2 Pro (2023)", "Mac Mini M4 / M4 Pro (2024)"]
    };

    for (const [brand, modelsList] of Object.entries(macMiniModels)) {
      for (const model of modelsList) {
        models.push({ brandName: brand, modelName: model, category: "mac-mini" as const, isActive: true });
      }
    }

    // Lens Models (abbreviated)
    const lensModels: Record<string, string[]> = {
      "Sony": ["FE 20mm F1.8 Lens", "FE 24-70mm GM Lens", "FE 24-105mm F4 Lens"],
      "Nikon": ["AF-S DX 18-105mm 3.5-5.6 ED Lens", "Nikkor Z 24-70mm F4 S Lens"],
      "Canon": ["RF 24-70mm F2.8L IS USM Lens", "RF 50mm F1.2L USM Lens"]
    };

    for (const [brand, modelsList] of Object.entries(lensModels)) {
      for (const model of modelsList) {
        models.push({ brandName: brand, modelName: model, category: "lens" as const, isActive: true });
      }
    }

    // Bulk insert
    let inserted = 0;
    for (const model of models) {
      await ctx.db.insert("supportedModels", model);
      inserted++;
    }

    return { success: true, message: `Seeded ${inserted} models successfully!` };
  },
});

// Public mutation to trigger the seed
export const seedAllModels = mutation({
  args: {},
  handler: async (ctx): Promise<{ success: boolean; message: string }> => {
    return await ctx.runMutation(internal.seedModels.seedAllModelsInternal, {});
  },
});

// Force seed - deletes all existing and re-seeds
export const forceSeedAllModels = mutation({
  args: { confirmDelete: v.boolean() },
  handler: async (ctx, args): Promise<{ success: boolean; message: string }> => {
    if (!args.confirmDelete) {
      return { success: false, message: "Please confirm deletion by passing confirmDelete: true" };
    }

    // Delete all existing models
    const existing = await ctx.db.query("supportedModels").collect();
    for (const model of existing) {
      await ctx.db.delete(model._id);
    }

    // Run the seed
    return await ctx.runMutation(internal.seedModels.seedAllModelsInternal, {});
  },
});
