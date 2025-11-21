import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { 
  ShieldCheckIcon, 
  SparklesIcon, 
  PackageIcon, 
  TruckIcon,
  LaptopIcon,
  SmartphoneIcon,
  MonitorIcon,
  PlaneIcon,
  CameraIcon,
  CircleDotIcon,
  BatteryChargingIcon,
  TabletSmartphoneIcon,
  GamepadIcon,
  SearchIcon
} from "lucide-react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Input } from "@/components/ui/input.tsx";
import { CartButton } from "@/components/cart.tsx";
import { Link } from "react-router-dom";

interface ShopifyProduct {
  id: number;
  title: string;
  handle: string;
  images: Array<{ id: number; src: string; alt: string | null }>;
  variants: Array<{
    id: number;
    title: string;
    price: string;
  }>;
}

// Mac Mini models data
const macMiniModels: Record<string, string[]> = {
  "Apple": [
    "Mac Mini Intel (2018)",
    "Mac Mini M1 / M1 Pro (2020)",
    "Mac Mini M2 (2023)",
    "Mac Mini M2 Pro (2023)",
    "Mac Mini M4 / M4 Pro (2024)"
  ]
};

// Camera Lens models data
const lensModels: Record<string, string[]> = {
  "Sony": [
    "FE 20mm F1.8 Lens",
    "FE 24-70mm GM Lens",
    "FE 24-105mm F4 Lens",
    "FE 28-70mm F3.5-5.6 Lens",
    "24-70mm F4 Lens",
    "10-18mm F4 Lens",
    "12-24mm F4 G Lens",
    "16-35mm F2.8 GM Lens",
    "16-35mm F2.8 ZA Lens",
    "16-35mm F4 CZ Lens",
    "16-50mm Kit Lens",
    "16-70mm F4 Lens",
    "18-55mm F3.5-5.6 Lens",
    "18-105mm F4 Lens",
    "18-135mm F3.5-5.6 OSS Lens",
    "18-200mm F3.5-6.3 OSS Lens",
    "24-70mm F2.8 GM Lens",
    "24-240mm F3.5-6.3 Lens",
    "24mm F1.4 GM Lens",
    "24mm F2 Lens",
    "24mm GM Lens",
    "25mm F2 Batis Lens",
    "35mm F1.8 Lens",
    "35mm F2.8 Lens",
    "40mm F2 Batis Lens",
    "50mm F2.8 Macro Lens",
    "55mm F1.8 Z Lens",
    "55mm F1.8 ZA Lens",
    "70-200 GM SX Lens"
  ],
  "Nikon": [
    "AF-S DX 18-105mm 3.5-5.6 ED Lens",
    "AF-S DX Nikkor 18-105mm F3.5-5.6G ED VR Lens",
    "AF-S DX Nikkor 18-200mm f3.5-5.6G ED VR II Lens",
    "AF-S DX Nikkor 35 mm f1.8G Lens",
    "AF-S DX Nikkor 35mm f1.8G Lens",
    "AF-S DX Zoom-Nikkor 17-55mm f2.8G IF-ED Lens",
    "AF-S Nikkor 14-24mm f2.8 8G ED Lens",
    "AF-S Nikkor 16-35mm f4G ED VR Lens",
    "AF-S Nikkor 20mm f1.8G ED Lens",
    "AF-S Nikkor 50mm f1.4G Lens",
    "AF-S Nikkor 50mm f1.8G Lens",
    "AF-S Nikkor 58mm f1.4G Lens",
    "AF-S Nikkor 70-200mm f4G ED VR Lens",
    "AF-S Nikkor 85mm f1.8G Lens",
    "AF-S Nikkor 105mm f1 4E ED Lens",
    "AF-S Nikkor 105mm f2.8 VR Micro Lens",
    "AF-S Nikkor 200-500mm f5.6E ED VR Lens",
    "AF-S Nikkor 300 mm f4D Lens",
    "AF-S Zoom-Nikkor 17-35mm f2.8 IF-ED Lens",
    "Nikkor 35mm f2D Lens",
    "Nikkor 58mm f1.4G Lens",
    "Nikkor 85mm f1.8D Lens",
    "Nikkor AF-S DX 18-140 mm f3.5-5.6G ED VR Lens",
    "Nikkor Z 14-24mm f2.8 S Lens",
    "Nikkor Z 14-30mm f4 S Lens",
    "Nikkor Z 20mm f1.8 S Lens",
    "Nikkor Z 24-70mm F4 S Lens",
    "Nikkor Z 50mm f1.2 S Lens",
    "Nikkor Z 70-200mm f2.8 VR Lens",
    "Nikkor Z 85mm f1.8 S Lens",
    "DX 16-50 mm 3.5-6.3 Lens"
  ],
  "Canon": [
    "EF_M 18-150mm f3.5-6.3 IS STM Lens",
    "EF-M 22mm f2 STM Lens",
    "EF-M 55-200mm f4.5-6.3 IS STM Lens",
    "EF-S 10-18MM f4.5-5.6 IS STM Zoom Lens",
    "EF-S 10-22mm F3.5-4.5 UMS SIR Lens",
    "EF-S 10-22MM F3.5-4.5 USM Wide Angle Zoom Lens",
    "EF-S 17-55 F2.8 EFS Lens",
    "EF-S 17-85mm f4-5.6 IS USM Lens",
    "EF-S 18-55 F3.5-5.6 IS II Lens",
    "EF-S 18-55 STM Lens",
    "EF-S 18-55mm f4-5.6 IS STM Lens",
    "EF-S 18-135 Nano USM Lens",
    "EF-S 18-135mm f3.5-5.6 IS Lens",
    "EF-S 18-200mm f3.5-5.6 IS Lens",
    "EF-S 55-250mm f4.0-5.6 IS II Telephoto Zoom Lens",
    "FF_S 55-250mm £4-5.6 IS STM Lens",
    "FE 70-200 f2.8 Lens",
    "RF 15-35mm F2.8L IS USM Lens",
    "RF 18-150mm F3.5-6.3 IS STM (2022)",
    "RF 16mm F2.8 STM",
    "RF 24-70mm F2.8L IS USM Lens",
    "RF 24-105mm F4-7.1 IS STM Lens",
    "RE 24-105mm F4L IS USM Lens",
    "RF 24-240mm f4-6.3 IS UMS Lens",
    "RF 28-70mm F2L USM Lens",
    "RF 35mm F1.8 Macro IS STM lens",
    "RF 50mm F1.2L USM Lens",
    "RF 50 mm F1.8 STM Lens",
    "RF 70-200 F2.8 Lens",
    "RF 85mm f1.2L USM Lens",
    "RE 85mm f2 Macro IS STM Lens"
  ],
  "Sigma": [
    "12-24mm F4 for Canon Lens Complate",
    "14-24mm F2.8 Lens",
    "15-30mm Lens",
    "16mm F1.4 Lens",
    "17-35mm F2.8 - 4 Lens",
    "17-35mm F2.8-54 Lens",
    "17-50mm F2.8 EX DC OS HSM Lens",
    "18-35mm F1.8 DC for Canon - Nikon Lens Complate",
    "18-200mm F3.5-6.3 DC for Canon - Nikon lens",
    "20mm F1.4 Art Lens",
    "20mm F1.4 Lens",
    "20mm F1.8 EX DG Lens",
    "24-35mm F2 Art Lens",
    "24-70mm F2.8 Art for Sony Lens",
    "24-70mm F2.8 EX DG Macro Lens",
    "24-105mm F4 for Canon - Nikon Lens",
    "24mm Art Lens",
    "24mm F1.4 Art for Canon - Nikon Lens",
    "24mm F1.4 Art for Sony Lens",
    "28-300mm F3.5-6.3 Lens",
    "30mm 1.4 DC DN Sony Lens",
    "30mm F1.4 Art for Canon - Nikon Lens",
    "30mm F1.4 DC HSM Lens",
    "30mm F1.4 for Sony Lens",
    "30mm F1.4 Lens",
    "30mm F2.8 for Sony Lens",
    "150-500mm Lens",
    "150-600mm F5-6.3 DG Sport Lens"
  ],
  "Tamron": [
    "17-28mm F2.8 Sony Lens",
    "17-35mm F2.8 Lens",
    "17-35mm F2.8-4 Di OSD for Nikon Lens",
    "17-50mm F2.8 VC",
    "17-50mm F2.8 VC for Canon Nikon Lens",
    "17-70mm F2.8 Sony Lens",
    "18-200mm F4.5 Lens",
    "19-35mm F3.5-4.5 Lens",
    "24 - 70mm G1 Lens",
    "24-70mm F2.8 G1 Lens",
    "24-70mm F2.8 G2 Lens",
    "24mm F2.8 Lens",
    "28-75mm for Canon & Nikon Lens",
    "28-75mm for Sony Lens",
    "28-200mm F2.8-5.6 for Sony Lens",
    "28-300mm VC for Nikon Lens",
    "70 -300mm F2.8 Lens",
    "70-180mm F2.8 for Sony Lens",
    "70-200mm 2.8 DI VC USD G2 Lens",
    "70-200mm 2.8 Macro Lens",
    "70-200mm F2.8 DI VC USD G1 Lens",
    "770-300mm for Sony Lens",
    "85mm F1.8 DI USD for Canon Nikon Lens",
    "85mm F1.8 Di VC Lens",
    "SP 24-70mm F2.8 G2 Lens",
    "SP 35mm F1.4 DI USD Nikon Lens",
    "SP 35mm F1.8 DI VC USD Lens",
    "SP 45mm F1.8 DI VC USD for Canon Lens"
  ],
  "Samyang": ["Samyang Lenses"],
  "Vitrox": ["Vitrox Lenses"],
  "Tokina": ["Tokina Lenses"],
  "Zeiss": ["Zeiss Lenses"],
  "Olympus": ["Olympus Lenses"],
  "Fujifilm": ["Fujifilm Lenses"]
};

// Camera models data
const cameraModels: Record<string, string[]> = {
  "Sony": [
    "Sony A7r3",
    "Sony A1",
    "Sony A7 I",
    "Sony A7 II",
    "Sony A7",
    "Sony A7C",
    "Sony A7R IV",
    "Sony Alpha A7 Mark IV",
    "Sony FX30",
    "Sony ZV E10"
  ],
  "Nikon": [
    "Nikon D200",
    "Nikon D300",
    "Nikon D500",
    "Nikon D600",
    "Nikon D600-D610",
    "Nikon D700",
    "Nikon D750",
    "Nikon D780",
    "Nikon D800",
    "Nikon D800E-D800",
    "Nikon D810",
    "Nikon D850",
    "Nikon D3100",
    "Nikon D3300",
    "Nikon D5200",
    "Nikon D7000",
    "Nikon D7100-D7200",
    "Nikon D7500",
    "Nikon DE",
    "Nikon F3",
    "Nikon Z5",
    "Nikon Z5 FTZ Adapter",
    "Nikon Z6",
    "Nikon Z6 11",
    "Nikon Z6-Z7",
    "Nikon Z9",
    "Nikon Z30",
    "Nikon Z50",
    "Nikon Z50 9H"
  ],
  "Canon": [
    "Canon EOS 1D Mark IV",
    "Canon EOS-1Ds Mark III",
    "Canon EOS 5D",
    "Canon EOS 5D Mark II",
    "Canon EOS 5D Mark III",
    "Canon EOS 5D Mark IV",
    "Canon EOS 5DS R",
    "Canon EOS 6D",
    "Canon EOS 6D Mark II",
    "Canon EOS 7D",
    "Canon EOS 7D Mark II",
    "Canon EOS 40D",
    "Canon EOS 50D",
    "Canon EOS 60D",
    "Canon EOS 70D",
    "Canon EOS 77D",
    "Canon EOS 80D",
    "Canon EOS 90D",
    "Canon EOS 200D I",
    "Canon EOS 300X",
    "Canon EOS 300X SX",
    "Canon EOS 500D",
    "Canon EOS 550D",
    "Canon EOS R3",
    "Canon EOS R6 Mark II",
    "Canon EOS R7",
    "Canon EOS R With Mount Adapter",
    "Canon EOS R50",
    "Canon EOS R100",
    "Canon PowerShot G7 X Mark II"
  ]
};

// Tablet models data
const tabletModels: Record<string, string[]> = {
  "Apple": [
    "iPad Pro 13 (M4)",
    "iPad Pro 11 (M4)",
    "iPad Pro 12.9 (2022)",
    "iPad Pro 11 (2022)",
    "iPad Pro 12.9 (2021)",
    "iPad Pro 11 (2021)",
    "iPad Pro 12.9 (2020)",
    "iPad Pro 11 (2020)",
    "iPad Pro 12.9 (2018)",
    "iPad Pro 11 (2018)",
    "iPad Pro 10.5",
    "iPad Pro 9.7",
    "iPad Air (M2)",
    "iPad Air (5th Gen)",
    "iPad Air (4th Gen)",
    "iPad Air (3rd Gen)",
    "iPad Air 2",
    "iPad Air",
    "iPad (10th Gen)",
    "iPad (9th Gen)",
    "iPad (8th Gen)",
    "iPad (7th Gen)",
    "iPad (6th Gen)",
    "iPad mini (6th Gen)",
    "iPad mini (5th Gen)",
    "iPad mini 4"
  ],
  "Samsung": [
    "Galaxy Tab A10.1 2016",
    "Galaxy Tab S7",
    "Galaxy Tab S7 FE",
    "Galaxy Tab S7 Ultra",
    "Galaxy Tab A8",
    "Galaxy Tab S6 Lite",
    "Galaxy Tab A7 T505",
    "Galaxy Tab A7 Lite",
    "Galaxy Tab S5e 10.5",
    "Galaxy Tab S4 10.5 2019",
    "Galaxy Tab S9 Plus",
    "Galaxy Tab S9 FE Plus",
    "Galaxy Tab S9 FE (Only Back)"
  ],
  "Lenovo": [
    "Lenovo Tab 3 7 Essential",
    "Lenovo Tab TB-750X Tab 7",
    "Lenovo Tab M8 Tab",
    "Lenovo Tab Yoga Tab",
    "Lenovo Tab M7",
    "Lenovo Tab M8",
    "Lenovo Tab M10",
    "Lenovo Tab P11 Pro",
    "Lenovo Tab P11",
    "Lenovo Tab Yoga Tab 3",
    "Lenovo Tab A7 A3300",
    "Lenovo Tab K10",
    "Lenovo Tab M10 Gen 3",
    "Lenovo Tab M7 7306F"
  ],
  "Xiaomi": [
    "XIAOMI PAD 6",
    "Xiaomi Pad 7",
    "Redmi Pad",
    "Redmi Pad SE"
  ]
};

// Console models data
const consoleModels: Record<string, string[]> = {
  "PlayStation": [
    "PS5 - Disk",
    "PS5 - Digital",
    "PS5 Slim - Disk",
    "PS5 Slim - Digital",
    "PS5 Controller"
  ],
  "Xbox": [
    "Xbox S",
    "Xbox X",
    "Xbox Controller"
  ]
};

// Charger models data
const chargerModels: Record<string, string[]> = {
  "Apple": [
    "Apple Macbook 140W Charger",
    "Apple USB-C Power Adapter 140W",
    "Apple USB-C Power Adapter 96W",
    "Apple USB-C Power Adapter 87W",
    "Apple USB-C Power Adapter 61W",
    "Apple USB-C Power Adapter 30W",
    "Apple USB-C Power Adapter 20W",
    "Apple USB-C (30W) Power Adapter",
    "Charger iPhone 11 Series",
    "Charger 20W USB-C 2021",
    "Charger 3 Pin",
    "MagSafe Charger",
    "iPhone Charger"
  ],
  "OnePlus": [
    "OnePlus 9 Pro Charger",
    "OnePlus Charger",
    "OnePlus SuperVOOC 100W",
    "OnePlus SuperVOOC 150W",
    "OnePlus Warp 30W 6A",
    "OnePlus Warp Charger 65W"
  ],
  "Realme": [
    "Realme Power Adapter 18W",
    "Realme Super Vooc 50W"
  ],
  "Vivo": [
    "Vivo Flash Charger 44W",
    "Vivo Flash Charger 80W/",
    "Vivo Flash Charger 2.0 33W",
    "Vivo Travel Adapter V0510A"
  ],
  "Xiaomi": [
    "Xiaomi Sonic Charge 2.0",
    "Xiaomi Sonic Charger 67"
  ],
  "iQOO": [
    "iQOO Flash Charger 80W"
  ],
  "Samsung": [
    "Samsung Super Fast Charge 3.0 25W Type C",
    "Samsung Travel Adapter 15W"
  ]
};

// Drone models data
const droneModels: Record<string, string[]> = {
  "DJI": [
    "DJI Mini 4 Pro",
    "DJI Mavic Pro",
    "DJI Mavic Air 2S",
    "DJI Mavic Air 2",
    "DJI Mavic Air 3",
    "DJI Mavic Mini",
    "DJI Mavic Mini 2",
    "DJI Mavic Mini 3",
    "DJI Mavic Mini 3 Pro",
    "DJI Phantom 3",
    "DJI Phantom 3 Pro",
    "DJI Phantom 4",
    "DJI Phantom 4 Pro",
    "DJI Spark",
    "DJI FPV",
    "DJI Mic",
    "DJI Osmo Mobile SE",
    "DJI Remote Controller N1",
    "DJI RC Pro Controller (2024)",
    "DJI RC Pro Controller (2023)",
    "DJI RC Controller (2022)",
    "DJI RC Controller (2022) Standard",
    "DJI Ronin RS3",
    "DJI Ronin RS3 Mini"
  ],
  "Xiaomi": [
    "Xiaomi Fimi X8 SE 2020"
  ]
};

// Phone models data - extracted from Shopify variants
const phoneModels: Record<string, string[]> = {
  "Apple": [
    "iPhone 17 Pro Max",
    "iPhone 17 Pro",
    "iPhone 17 Air",
    "iPhone 17",
    "iPhone 16E",
    "iPhone 16 Pro Max",
    "iPhone 16 pro max",
    "iPhone 16 pro",
    "iPhone 16 Plus",
    "iPhone 16",
    "iPhone 15 Pro Max",
    "iPhone 15 Pro",
    "iPhone 15 Plus",
    "iPhone 15",
    "iPhone 14 Pro Max",
    "iPhone 14 Pro",
    "iPhone 14 Plus",
    "iPhone 14",
    "iPhone 13 Pro Max",
    "iPhone 13 Pro",
    "iPhone 13 Mini",
    "iPhone 13",
    "iPhone 12 Pro Max",
    "iPhone 12 Pro",
    "iPhone 12 Mini",
    "iPhone 12",
    "iPhone 11 Pro Max",
    "iPhone 11 Pro",
    "iPhone 11",
    "iPhone XS Max",
    "iPhone XS",
    "iPhone XR",
    "iPhone X",
    "iPhone 8 Plus",
    "iPhone 8",
    "iPhone 7 Plus",
    "iPhone 7",
    "iPhone 6S Plus",
    "iPhone 6S",
    "iPhone 6 Plus",
    "iPhone 6",
    "iPhone SE",
    "iPhone 5E",
    "iPhone 5S",
    "iPhone 5"
  ],
  "Samsung": [
    // S series
    "Samsung Galaxy S25 Edge",
    "Samsung Galaxy S25 Plus",
    "Samsung Galaxy S25 Ultra (5G)",
    "Samsung Galaxy S25 (5G)",
    "Samsung Galaxy S24 Ultra (5G)",
    "Samsung Galaxy S24 Plus",
    "Samsung Galaxy S24 (5G)",
    "Samsung Galaxy S24 FE (5G)",
    "Samsung Galaxy S23 FE (5G)",
    "Samsung Galaxy S23 (5G)",
    "Samsung Galaxy S22 Ultra",
    "Samsung Galaxy S22 Plus",
    "Samsung Galaxy S22",
    "Samsung Galaxy S21 Ultra 5G",
    "Samsung Galaxy S21 Plus 5G",
    "Samsung Galaxy S21 FE 5G",
    "Samsung Galaxy S21 5G",
    "Samsung Galaxy S20 Ultra",
    "Samsung Galaxy S20 Plus",
    "Samsung Galaxy S20 FE",
    "Samsung Galaxy S20",
    "Samsung Galaxy S10E",
    "Samsung Galaxy S10 Plus",
    "Samsung Galaxy S10 Lite",
    "Samsung Galaxy S10",
    "Samsung Galaxy S9 Plus",
    "Samsung Galaxy S9",
    // Z series
    "Samsung Galaxy Z Fold 5",
    "Samsung Galaxy Z Fold 4",
    "Samsung Galaxy Z Fold 3",
    "Samsung Galaxy Z Fold 2",
    "Samsung Galaxy Fold",
    "Samsung Galaxy Z Flip 5",
    "Samsung Galaxy Z Flip 4",
    "Samsung Galaxy Z Flip 3 (5G)",
    // A series
    "Samsung Galaxy A80",
    "Samsung Galaxy A73",
    "Samsung Galaxy A72",
    "Samsung Galaxy A71",
    "Samsung Galaxy A70s",
    "Samsung Galaxy A70",
    "Samsung Galaxy A55 (5G)",
    "Samsung Galaxy A54 (5G)",
    "Samsung Galaxy A53 (5G)",
    "Samsung Galaxy A52s (5G)",
    "Samsung Galaxy A51",
    "Samsung Galaxy A50S",
    "Samsung Galaxy A50",
    "Samsung Galaxy A42",
    "Samsung Galaxy A41",
    "Samsung Galaxy A35 (5G)",
    "Samsung Galaxy A34 (5G)",
    "Samsung Galaxy A33(5G)",
    "Samsung Galaxy A31",
    "Samsung Galaxy A30s",
    "Samsung Galaxy A30",
    "Samsung Galaxy A25 (5G)",
    "Samsung Galaxy A23 (5G)",
    "Samsung Galaxy A22 (5G)",
    "Samsung Galaxy A22",
    "Samsung Galaxy A21S",
    "Samsung Galaxy A21",
    "Samsung Galaxy A20S",
    "Samsung Galaxy A20E",
    "Samsung Galaxy A20",
    "Samsung Galaxy A16",
    "Samsung Galaxy A15 (5G)",
    "Samsung Galaxy A14 (5G)",
    "Samsung Galaxy A13 (5G)",
    "Samsung Galaxy A13 4G",
    "Samsung Galaxy A12",
    "Samsung Galaxy A10S",
    "Samsung Galaxy A10",
    "Samsung Galaxy A9 Pro",
    "Samsung Galaxy A9 2018",
    "Samsung Galaxy A9 2016",
    "Samsung Galaxy A9",
    "Samsung Galaxy A8 Star",
    "Samsung Galaxy A8 Plus",
    "Samsung Galaxy A Plus 2018",
    "Samsung Galaxy A04S",
    "Samsung Galaxy A04E",
    "Samsung Galaxy A03",
    // Alpha
    "Samsung Galaxy Alpha",
    // M series
    "Samsung Galaxy M62",
    "Samsung Galaxy M56",
    "Samsung Galaxy M53 (5G)",
    "Samsung Galaxy M52 (5G)",
    "Samsung Galaxy M51",
    "Samsung Galaxy M42",
    "Samsung Galaxy M40",
    "Samsung Galaxy M35 (5G)",
    "Samsung Galaxy M34 (5G)",
    "Samsung Galaxy M33 (5G)",
    "Samsung Galaxy M32 (5G)",
    "Samsung Galaxy M32",
    "Samsung Galaxy M31s",
    "Samsung Galaxy M31",
    "Samsung Galaxy M30S",
    "Samsung Galaxy M30",
    "Samsung Galaxy M21 2021",
    "Samsung Galaxy M21",
    "Samsung Galaxy M20",
    "Samsung Galaxy M14 (5G)",
    "Samsung Galaxy M13 (5G)",
    "Samsung Galaxy M12",
    "Samsung Galaxy M11",
    "Samsung Galaxy M10",
    "Samsung Galaxy M02",
    // Note series
    "Samsung Galaxy Note 20 Ultra",
    "Samsung Galaxy Note 20",
    "Samsung Galaxy Note 10 Plus",
    "Samsung Galaxy Note 10 Lite",
    "Samsung Galaxy Note 10",
    "Samsung Galaxy Note 9 Pro",
    // F series
    "Samsung Galaxy F62",
    "Samsung Galaxy F54 (5G)",
    "Samsung Galaxy F42 (5G)",
    "Samsung Galaxy F41",
    "Samsung Galaxy F23",
    "Samsung Galaxy F22",
    "Samsung Galaxy F15 (5G)",
    "Samsung Galaxy F14 (5G)",
    "Samsung Galaxy F13",
    "Samsung Galaxy F12",
    // J series
    "Samsung Galaxy J8 2018",
    "Samsung Galaxy J7 Pro",
    "Samsung Galaxy J7 Prime",
    "Samsung Galaxy J7 Next",
    // C series
    "Samsung Galaxy C9 Pro",
    "Samsung Galaxy C7 Pro",
    // E series
    "Samsung Galaxy E7",
    "Samsung Galaxy E5",
    // On series
    "Samsung Galaxy On Next",
    "Samsung Galaxy On 8"
  ],
  "Nothing": [
    "Nothing Phone 3A Pro",
    "Nothing Phone 3A", 
    "Nothing Phone 2A",
    "Nothing Phone 2",
    "Nothing Phone 1 5G"
  ],
  "Oppo": [
    // Find series
    "Oppo Find 8X Pro (5G)",
    "Oppo Find 8X (5G)",
    "Oppo Find X2",
    "Oppo Find X",
    "Oppo Find N",
    // Reno series
    "Oppo Reno 14 Pro 5G",
    "Oppo Reno 14 5G",
    "Oppo Reno 14F 5G",
    "Oppo Reno 13 Pro (5G)",
    "Oppo Reno 13 (5G)",
    "Oppo Reno 12 Pro (5G)",
    "Oppo Reno 12F",
    "Oppo Reno 12 (5G)",
    "Oppo Reno 11 Pro (5G)",
    "Oppo Reno 10X Zoom",
    "Oppo Reno 10 Pro Plus (5G)",
    "Oppo Reno 10 Pro (5G)",
    "Oppo Reno 10 (5G)",
    "Oppo Reno 8 Pro (5G)",
    "Oppo Reno 8T (5G)",
    "Oppo Reno 8 (5G)",
    "Oppo Reno 7 Pro (5G)",
    "Oppo Reno 7 (5G)",
    "Oppo Reno 6 Pro (5G)",
    "Oppo Reno 6",
    "Oppo Reno 5Z",
    "Oppo Reno 5 Pro",
    "Oppo Reno 5",
    "Oppo Reno 4 Pro",
    "Oppo Reno 4",
    "Oppo Reno 3 Pro",
    "Oppo Reno 2Z",
    "Oppo Reno 2",
    "Oppo Reno",
    // F series
    "Oppo F31 Pro Plus 5G",
    "Oppo F31 Pro 5G",
    "Oppo F31 5G",
    "Oppo F29 Pro (5G)",
    "Oppo F29 (5G)",
    "Oppo F27 Pro Plus (5G)",
    "Oppo F27 (5G)",
    "Oppo F25 Pro (5G)",
    "Oppo F23 (5G)",
    "Oppo F21s Pro (5G)",
    "Oppo F21 Pro (5G)",
    "Oppo F21s Pro",
    "Oppo F21 Pro (4G)",
    "Oppo F19S",
    "Oppo F19 Pro Plus",
    "Oppo F19 Pro",
    "Oppo F19",
    "Oppo F17 Pro",
    "Oppo F17",
    "Oppo F15",
    "Oppo F11 Pro",
    "Oppo F11",
    "Oppo F9 Pro Plus",
    "Oppo F9 Pro",
    "Oppo F9",
    "Oppo F7",
    "Oppo F5",
    "Oppo F3 Plus",
    "Oppo F3",
    "Oppo F1 Plus",
    "Oppo F1S",
    "Oppo F1",
    // K series
    "Oppo K13 Turbo 5G",
    "Oppo K13x 5G",
    "Oppo K13 5G",
    "Oppo K12X (5G)",
    "Oppo K10 (5G)",
    "Oppo K9 Pro 5G",
    "Oppo K9S",
    "Oppo K9 5G",
    "Oppo K3",
    "Oppo K1",
    // A series
    "Oppo A96",
    "Oppo A95 (5G)",
    "Oppo A83",
    "Oppo A79 (5G)",
    "Oppo A78 (5G)",
    "Oppo A78 (4G)",
    "Oppo A77S",
    "Oppo A77 (4G)",
    "Oppo A76",
    "Oppo A74 (5G)",
    "Oppo A71",
    "Oppo A58 (4G)",
    "Oppo A57",
    "Oppo A55 4G",
    "Oppo A54 (5G)",
    "Oppo A53s (5G)",
    "Oppo A53",
    "Oppo A52",
    "Oppo A51",
    "Oppo A37",
    "Oppo A33",
    "Oppo A31",
    "Oppo A1K",
    // R series
    "Oppo R17 Pro",
    "Oppo R15 Pro",
    "Oppo R15",
    "Oppo R9",
    "Oppo R7",
    // Neo series
    "Oppo Neo 7",
    "Oppo Neo 5"
  ],
  "Realme": [
    // GT series
    "Realme GT 7T 5G",
    "Realme GT7 Pro 5G",
    "Realme GT7 5G",
    "Realme GT Neo 7 Pro",
    "Realme GT 6T (5G)",
    "Realme GT6 (5G)",
    "Realme GT Neo 3T",
    "Realme GT Neo 3 (5G)",
    "Realme GT Neo 2 (5G)",
    "Realme GT 2 Pro",
    "Realme GT 2",
    "Realme GT Edition (5G)",
    "Realme GT (5G)",
    // P series
    "Realme P4 Pro 5G",
    "Realme P4 5G",
    "Realme P3X",
    "Realme P3 Ultra (5G)",
    "Realme P3 Pro",
    "Realme P3 (5G)",
    "Realme P2 Pro 5G",
    "Realme P1 Speed 5G",
    "Realme P1 Pro",
    "Realme P1 (5G)",
    // X series
    "Realme X7 Pro (5G)",
    "Realme X7 Max (5G)",
    "Realme X7 5G",
    "Realme X50 PRO",
    "Realme X50",
    "Realme X3 Super Zoom",
    "Realme X3",
    "Realme X2 Pro",
    "Realme X2",
    "Realme XT",
    "Realme X",
    // Number series
    "Realme 15 Pro 5G",
    "Realme 15 5G",
    "Realme 14T 5G",
    "Realme 14 Pro Lite",
    "Realme 14 Pro Plus (5G)",
    "Realme 14 Pro (5G)",
    "Realme 14X (5G)",
    "Realme 13 Pro Plus 5G",
    "Realme 13 Plus 5G",
    "Realme 13 Pro 5G",
    "Realme 13 5G",
    "Realme 13",
    "Realme 12 5G",
    "Realme 12 Pro Plus (5G)",
    "Realme 12 PRO (5G)",
    "Realme 12X (5G)",
    "Realme 11Z",
    "Realme 11 Pro Plus",
    "Realme 11 PRO",
    "Realme 11X (5G)",
    "Realme 11 (5G)",
    "Realme 10 Pro Plus (5G)",
    "Realme 10 Pro (5G)",
    "Realme 10",
    "Realme 9 Pro Plus (5G)",
    "Realme 9 Pro (5G)",
    "Realme 9 5G SE",
    "Realme 9i",
    "Realme 9",
    "Realme 8S (5G)",
    "Realme 8i",
    "Realme 8 Pro",
    "Realme 8",
    "Realme 8 (4G)",
    "Realme 7 Pro",
    "Realme 7i",
    "Realme 7",
    // Other models
    "Realme U1",
    "Realme 50A Prime",
    "Realme 50A"
  ],
  "CMF": [
    "CMF Phone 2 Pro",
    "CMF Phone 1"
  ],
  "Vivo": [
    // X series
    "Vivo X200 Pro (5G)",
    "Vivo X200 FE",
    "Vivo X200 (5G)",
    "Vivo X100 Pro",
    "Vivo X100 (5G)",
    "Vivo X90 Pro",
    "Vivo X90",
    "Vivo X80 Pro (5G)",
    "Vivo X80 (5G)",
    "Vivo X70 Pro Plus (5G)",
    "Vivo X70 Pro (5G)",
    "Vivo X60 Pro Plus",
    "Vivo X60 Pro",
    "Vivo X60",
    "Vivo X50 Pro",
    "Vivo X50",
    "Vivo X21",
    "Vivo X20 Plus",
    "Vivo X20",
    "Vivo X7",
    "Vivo X5 Pro",
    "Vivo X5 Max",
    "Vivo X3 S",
    // V series
    "Vivo V60 5G",
    "Vivo V50 5G",
    "Vivo V40 Lite",
    "Vivo V40 5G",
    "Vivo V40E (5G)",
    "Vivo V30E",
    "Vivo V30 5G",
    "Vivo V30 Pro (5G)",
    "Vivo V30 Pro",
    "Vivo V30",
    "Vivo V29e (5G)",
    "Vivo V29 Pro (5G)",
    "Vivo V29 (5G)",
    "Vivo V29 Pro",
    "Vivo V29",
    "Vivo V27E",
    "Vivo V27 Pro (5G)",
    "Vivo V27 (5G)",
    "Vivo V25 (5G)",
    "Vivo V25 Pro",
    "Vivo V23e (5G)",
    "Vivo V23 Pro (5G)",
    "Vivo V23 (5G)",
    "Vivo V21e (5G)",
    "Vivo V21e (4G)",
    "Vivo V21 5G",
    "Vivo V21",
    "Vivo V20 SE",
    "Vivo V20 Pro",
    "Vivo V20",
    "Vivo V19",
    "Vivo V17 Pro",
    "Vivo V17",
    "Vivo V15 Pro",
    "Vivo V15",
    "Vivo V11 Pro",
    "Vivo V11",
    "Vivo V9 Youth",
    "Vivo V9 Pro",
    "Vivo V9",
    "Vivo V7 Plus",
    "Vivo V5 S",
    "Vivo V5 Plus",
    "Vivo V5",
    "Vivo V3 Max",
    "Vivo V3",
    "Vivo V1 Max",
    // Y400 series
    "Vivo Y400 Pro 5G",
    "Vivo Y400 5G",
    // Y300 series
    "Vivo Y300 Plus (5G)",
    "Vivo Y300 (5G)",
    // Y200 series
    "Vivo Y200 Pro",
    "Vivo Y200e (5G)",
    "Vivo Y200 (5G)",
    // Y100 series
    "Vivo Y100A",
    "Vivo Y100 (5G)",
    // Y series
    "Vivo Y95",
    "Vivo Y93",
    "Vivo Y91i",
    "Vivo Y91",
    "Vivo Y90",
    "Vivo Y83 Pro",
    "Vivo Y83",
    "Vivo Y81i",
    "Vivo Y81",
    "Vivo Y79",
    "Vivo Y75 (5G)",
    "Vivo Y75",
    "Vivo Y73",
    "Vivo Y72 (5G)",
    "Vivo Y71",
    "Vivo Y69",
    "Vivo Y66",
    "Vivo Y58 5G",
    "Vivo Y56 (5G)",
    "Vivo Y55S",
    "Vivo Y55L",
    "Vivo Y55",
    "Vivo Y53S",
    "Vivo Y53",
    "Vivo Y51A",
    "Vivo Y51",
    "Vivo 50",
    "Vivo Y50",
    "Vivo Y39 5G",
    "Vivo Y36",
    "Vivo Y35 2022",
    "Vivo Y33T",
    "Vivo Y33 S",
    "Vivo Y31 Pro 5G",
    "Vivo Y31",
    "Vivo Y30",
    "Vivo Y28S (5G)",
    "Vivo Y28 5G",
    "Vivo Y28",
    "Vivo Y27 4G",
    "Vivo Y27",
    "Vivo Y22 2022",
    "Vivo Y21L",
    "Vivo Y21T",
    "Vivo Y21E 5G",
    "Vivo Y21E",
    "Vivo Y21 G",
    "Vivo Y21 2021",
    "Vivo Y21",
    "Vivo Y20T",
    "Vivo Y20i",
    "Vivo Y20G 2021",
    "Vivo Y20A",
    "Vivo Y20",
    "Vivo Y19E",
    "Vivo Y19 5G",
    "Vivo Y19",
    "Vivo Y18",
    "Vivo Y17S",
    "Vivo Y17",
    "Vivo Y16",
    "Vivo Y15S",
    "Vivo Y15C",
    "Vivo Y15 2019",
    "Vivo Y15",
    "Vivo Y12s",
    "Vivo Y12",
    "Vivo Y11",
    "Vivo Y02T",
    "Vivo Y02",
    "Vivo Y3S",
    // T series
    "Vivo T45 5G",
    "Vivo T4X 5G",
    "Vivo T4R 5G",
    "Vivo T4 Ultra",
    "Vivo T4 Lite",
    "Vivo T4 pro",
    "Vivo T4 5G",
    "Vivo T3 Ultra (5G)",
    "Vivo T3 Pro (5G)",
    "Vivo T3 X (5G)",
    "Vivo T3 (5G)",
    "Vivo T2 X (5G)",
    "Vivo T2 Pro (5G)",
    "Vivo T2 (5G)",
    "Vivo T1X",
    "Vivo T1 Pro (5G)",
    "Vivo T1 (5G)",
    "Vivo T1",
    // Z series
    "Vivo Z1 X",
    "Vivo Z1 Pro",
    "Vivo Z10",
    // S series
    "Vivo S1 Pro",
    "Vivo S1",
    // U series
    "Vivo U20",
    "Vivo U10",
    "Vivo U3",
    // Nex series
    "Vivo Nex S",
    "Vivo Nex A",
    "Vivo Nex",
    // A series
    "Vivo A33S"
  ],
  "iQOO": [
    // Number series
    "IQOO 13 5G",
    "IQOO 12 5G",
    "IQOO 11 5G",
    "IQOO 9T",
    "IQOO 9 Pro 5G",
    "IQOO 9 SE 5G",
    "IQOO 9 5G",
    "IQOO 7 Legend",
    "IQOO 7",
    "IQOO 3",
    // Neo series
    "IQOO Neo 10R",
    "IQOO Neo 9 Pro",
    "IQOO Neo 7 PRO",
    "IQOO Neo 7 PR",
    "IQOO Neo 7 5G",
    "IQOO Neo 6 5G",
    "IQOO Neo 3",
    // Z series
    "IQOO Z9X",
    "IQOO Z9S",
    "IQOO Z9",
    "IQOO Z7 S 5G",
    "IQOO Z7 Pro",
    "IQOO Z7",
    "IQOO Z6 Lite 5G",
    "IQOO Z6 PRO 5G",
    "IQOO Z6 44W",
    "IQOO Z6 5G",
    "IQOO Z5",
    "IQOO Z3 5G",
    "IQOO Z3",
    "IQOO Z1X"
  ],
  "Xiaomi": [
    // Mi series
    "Mi 14 Civi",
    "Mi 14",
    "Mi 12S Ultra 5G",
    "Mi 12 Lite",
    "Mi 11X Pro",
    "Mi 11 X",
    "Mi 11 Ultra",
    "Mi 11 T Pro",
    "Mi 11i 5G",
    "Mi 11 Lite",
    "Mi 10T 5G",
    "Mi 10 T Lite",
    "Mi 10i",
    "Mi 10 5G",
    // Redmi Note series
    "Redmi Note 14 Pro Plus 5G",
    "Redmi Note 14 Pro 5G",
    "Redmi Note 14 5G",
    "Redmi Note 13 Pro Plus 5G",
    "Redmi Note 13 Pro 5G",
    "Redmi Note 13 5G",
    "Redmi Note 12 Pro Plus 5G",
    "Redmi Note 12 Pro 5G",
    "Redmi Note 12 5G",
    "Redmi Note 11 Pro Plus 5G",
    "Redmi Note 11 Pro",
    "Redmi Note 11T 5G",
    "Redmi Note 11SE",
    "Redmi Note 11",
    "Redmi Note 10T 5G",
    "Redmi Note 10 Pro Max",
    "Redmi Note 10 Pro",
    "Redmi Note 10S",
    "Redmi Note 10",
    "Redmi Note 9T 5G",
    "Redmi Note 9 Pro Max",
    "Redmi Note 9 Pro",
    "Redmi Note 9",
    "Redmi Note 8 Pro",
    "Redmi Note 8",
    "Redmi Note 6 Pro",
    // Redmi number series
    "Redmi 13C 5G",
    "Redmi 13C",
    "Redmi 12 PRO",
    "Redmi 12 5G",
    "Redmi 12 4G",
    "Redmi 11i Hyper Charge",
    "Redmi 11 Prime 5G",
    "Redmi 11 Lite NE 5G",
    "Redmi 10 Power",
    "Redmi 10 Prime",
    "Redmi 10",
    "Redmi 9i",
    "Redmi 9 Power",
    "Redmi 9 Prime",
    // Redmi K series
    "Redmi K50i 5G",
    "Redmi K20 Pro",
    // Redmi Y series
    "Redmi Y3",
    "Redmi Y2",
    "Redmi Y1 Lite",
    "Redmi Y1",
    // Other Xiaomi
    "Xiaomi Black Shark 2"
  ],
  "Lava": [
    "LAVA Agni 3 (5G)",
    "LAVA Agni 2 (5G)",
    "LAVA Blaze Curve (5G)",
    "LAVA Blaze Pro",
    "LAVA Blaze (5G)"
  ],
  "Infinix": [
    // GT series
    "Infinix GT 20 PRO (5G)",
    "Infinix GT 10 PRO",
    // Zero series
    "Infinix Zero 30 (5G)",
    "Infinix Zero 30 4G",
    "Infinix Zero 8i",
    "Infinix Zero 5G",
    "Infinix Zero (5G)",
    // Note series
    "Infinix Note 40X (5G)",
    "Infinix Note 40 PRO PLUS",
    "Infinix Note 40 PRO (5G)",
    "Infinix Note 40 PRO 4G",
    "Infinix Note 40",
    "Infinix Note 30 (5G)",
    "Infinix Note 12 Pro (5G)",
    "Infinix Note 12 G96",
    "Infinix Note 11S",
    "Infinix Note 11",
    "Infinix Note 10 PRO",
    "Infinix Note 10",
    "Infinix Note 8",
    "Infinix Note 7",
    "Infinix Note 5",
    "Infinix Note 4 Pro",
    // Hot series
    "Infinix Hot 30i",
    "Infinix Hot 30",
    "Infinix Hot 12 Play",
    "Infinix Hot 11S",
    "Infinix Hot 11",
    "Infinix Hot 10S",
    "Infinix Hot 10",
    "Infinix Hot 9 PRO",
    "Infinix Hot 9",
    "Infinix Hot 7",
    "Infinix Hot 6",
    "Infinix Hot 4 PRO",
    "Infinix Hot 4",
    // Other models
    "Infinix 10 Play",
    "Infinix Smart 5A"
  ],
  "Asus": [
    // ROG Phone series
    "Asus ROG Phone 9 FE",
    "Asus ROG Phone 8 Pro",
    "Asus ROG Phone 8",
    "Asus ROG Phone 7 (5G)",
    "Asus ROG Phone 6 PRO (5G)",
    "Asus ROG Phone 6 (5G)",
    "Asus ROG Phone 5",
    "Asus ROG Phone 4",
    "Asus ROG Phone 3",
    "Asus ROG Phone 2",
    // Zenfone series
    "Asus Zenfone 12 Ultra",
    "Asus Zenfone 11 Ultra",
    "Asus ZENFONE MAX PRO (M1)"
  ],
  "HMD": [
    "HMD Nokia C300",
    "HMD Nokia G60",
    "HMD Nokia G42 5G",
    "HMD Nokia G21",
    "HMD Nokia G20",
    "HMD Nokia X30",
    "HMD Nokia C32",
    "HMD Nokia C31",
    "HMD Nokia C30",
    "HMD Nokia C22",
    "HMD Nokia C21 Plus",
    "HMD Nokia C12 Pro",
    "HMD Nokia 9"
  ]
};

export default function Index() {
  const getAllProducts = useAction(api.shopify.getAllProducts);
  const [products, setProducts] = useState<ShopifyProduct[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [selectedBrand, setSelectedBrand] = useState<string>("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [showBrandSelectorDialog, setShowBrandSelectorDialog] = useState(false);
  const [showDroneBrandSelectorDialog, setShowDroneBrandSelectorDialog] = useState(false);
  const [showChargerBrandSelectorDialog, setShowChargerBrandSelectorDialog] = useState(false);
  const [showConsoleBrandSelectorDialog, setShowConsoleBrandSelectorDialog] = useState(false);
  const [showTabletBrandSelectorDialog, setShowTabletBrandSelectorDialog] = useState(false);
  const [showMacMiniBrandSelectorDialog, setShowMacMiniBrandSelectorDialog] = useState(false);
  const [showCameraBrandSelectorDialog, setShowCameraBrandSelectorDialog] = useState(false);
  const [showLensBrandSelectorDialog, setShowLensBrandSelectorDialog] = useState(false);
  const [deviceType, setDeviceType] = useState<"phone" | "drone" | "charger" | "console" | "tablet" | "macmini" | "camera" | "lens">("phone");
  const [searchQuery, setSearchQuery] = useState("");
  const [homeSearchQuery, setHomeSearchQuery] = useState("");
  const [showSearchResults, setShowSearchResults] = useState(false);

  useEffect(() => {
    async function fetchProducts() {
      try {
        const data = await getAllProducts({});
        setProducts(data);
      } catch (err) {
        console.error("Failed to load products:", err);
      } finally {
        setIsLoadingProducts(false);
      }
    }
    fetchProducts();
  }, [getAllProducts]);

  const matteProducts = products.filter(p => p.title.toLowerCase().includes('matte')).slice(0, 4);
  const embossedProducts = products.filter(p => 
    p.title.toLowerCase().includes('3d textured') || 
    p.title.toLowerCase().includes('3d embossed')
  ).slice(0, 4);
  const transparentProducts = products.filter(p => p.title.toLowerCase().includes('tranzy')).slice(0, 4);

  const features = [
    {
      icon: ShieldCheckIcon,
      title: "Tough as Nails",
      description: "Your phone's new BFF. We protect against drops, bumps, and life's little accidents"
    },
    {
      icon: SparklesIcon,
      title: "Weirdly Wonderful",
      description: "From cosmic cats to dancing tacos, our designs are as unique as your personality"
    },
    {
      icon: PackageIcon,
      title: "Fits Like a Glove",
      description: "Snug fit for every button, port, and camera. No awkward gaps here"
    },
    {
      icon: TruckIcon,
      title: "Lightning Fast",
      description: "Free shipping, always. Your new phone vibe arrives in 2-3 days"
    }
  ];

  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <nav className="fixed top-0 w-full bg-background/80 backdrop-blur-lg border-b border-border z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img 
              src="https://cdn.hercules.app/file_Qd06a0OWqeC2LadTl4tLLvmv" 
              alt="Skinly" 
              className="h-10"
            />
          </div>
          <div className="flex items-center gap-6">
            <a href="#products" className="text-sm font-medium hover:text-primary transition-colors">
              Categories
            </a>
            <a href="/products" className="text-sm font-medium hover:text-primary transition-colors">
              All Products
            </a>
            <Link to="/orders" className="text-sm font-medium hover:text-primary transition-colors">
              My Orders
            </Link>
            <CartButton />
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="container mx-auto">
          {/* Universal Search Bar */}
          <div className="max-w-3xl mx-auto mb-16">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold mb-2">Find Your Device or Design</h2>
              <p className="text-muted-foreground">Search phone models, devices, or design patterns</p>
            </div>
            <div className="relative">
              <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 size-6 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search for phone model, Mac Mini, black skins, etc..."
                value={homeSearchQuery}
                onChange={(e) => {
                  setHomeSearchQuery(e.target.value);
                  setShowSearchResults(e.target.value.trim().length > 0);
                }}
                className="pl-14 h-16 text-lg border-2 focus:border-primary"
              />
            </div>
            
            {/* Search Results Dropdown */}
            {showSearchResults && homeSearchQuery.trim().length > 0 && (
              <Card className="mt-2 max-h-96 overflow-y-auto border-2">
                <CardContent className="p-4">
                  {/* Phone Models Section */}
                  {Object.entries(phoneModels).some(([, models]) => {
                    const searchTerms = homeSearchQuery.toLowerCase().split(/\s+/).filter(term => term.length > 0);
                    return models.some(model => {
                      const modelLower = model.toLowerCase();
                      return searchTerms.every(term => modelLower.includes(term));
                    });
                  }) && (
                    <>
                      <div className="text-xs font-bold text-primary mb-3 uppercase tracking-wide">
                        Phone Models
                      </div>
                      {Object.entries(phoneModels).map(([brand, models]) => {
                        const searchTerms = homeSearchQuery.toLowerCase().split(/\s+/).filter(term => term.length > 0);
                        const filteredModels = models.filter(model => {
                          const modelLower = model.toLowerCase();
                          return searchTerms.every(term => modelLower.includes(term));
                        });
                        
                        if (filteredModels.length === 0) return null;
                        
                        return (
                          <div key={brand} className="mb-4 last:mb-0">
                            <div className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-2">
                              <span>{brand}</span>
                              <span className="text-xs bg-muted px-2 py-0.5 rounded-full">
                                {filteredModels.length}
                              </span>
                            </div>
                            <div className="space-y-1">
                              {filteredModels.slice(0, 5).map((model, idx) => (
                                <button
                                  key={idx}
                                  onClick={() => {
                                    setHomeSearchQuery("");
                                    setShowSearchResults(false);
                                    window.location.href = `/products?brand=${brand.toLowerCase()}&model=${encodeURIComponent(model)}&showFinish=true`;
                                  }}
                                  className="w-full text-left p-3 rounded-lg hover:bg-primary/10 hover:text-primary transition-all group"
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="font-medium">{model}</span>
                                    <span className="text-xs text-muted-foreground group-hover:text-primary">
                                      Select Model →
                                    </span>
                                  </div>
                                </button>
                              ))}
                              {filteredModels.length > 5 && (
                                <div className="text-xs text-muted-foreground pl-3 pt-1">
                                  +{filteredModels.length - 5} more models
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </>
                  )}

                  {/* Products Section */}
                  {(() => {
                    const searchTerms = homeSearchQuery.toLowerCase().split(/\s+/).filter(term => term.length > 0);
                    const matchingProducts = products.filter(product => {
                      const titleLower = product.title.toLowerCase();
                      return searchTerms.every(term => titleLower.includes(term));
                    });

                    if (matchingProducts.length > 0) {
                      return (
                        <>
                          {Object.entries(phoneModels).some(([, models]) => {
                            return models.some(model => {
                              const modelLower = model.toLowerCase();
                              return searchTerms.every(term => modelLower.includes(term));
                            });
                          }) && <div className="my-4 border-t border-border" />}
                          
                          <div className="text-xs font-bold text-secondary mb-3 uppercase tracking-wide flex items-center gap-2">
                            Design Patterns & Products
                            <span className="text-xs bg-secondary/10 text-secondary px-2 py-0.5 rounded-full font-normal">
                              {matchingProducts.length}
                            </span>
                          </div>
                          <div className="space-y-1">
                            {matchingProducts.slice(0, 8).map((product) => (
                              <Link
                                key={product.id}
                                to={`/products/detail?id=${product.handle}`}
                                onClick={() => {
                                  setHomeSearchQuery("");
                                  setShowSearchResults(false);
                                }}
                                className="flex items-center gap-3 p-3 rounded-lg hover:bg-secondary/10 hover:text-secondary transition-all group"
                              >
                                <div className="size-12 bg-muted rounded overflow-hidden flex-shrink-0">
                                  {product.images[0] ? (
                                    <img 
                                      src={product.images[0].src} 
                                      alt={product.title}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                      <PackageIcon className="size-5 text-muted-foreground" />
                                    </div>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium truncate group-hover:text-secondary">
                                    {product.title}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    ₹{product.variants[0]?.price || "N/A"}
                                  </div>
                                </div>
                                <span className="text-xs text-muted-foreground group-hover:text-secondary flex-shrink-0">
                                  View Product →
                                </span>
                              </Link>
                            ))}
                            {matchingProducts.length > 8 && (
                              <Link
                                to={`/products?search=${encodeURIComponent(homeSearchQuery)}`}
                                onClick={() => {
                                  setHomeSearchQuery("");
                                  setShowSearchResults(false);
                                }}
                                className="block text-center p-3 text-sm text-secondary hover:bg-secondary/10 rounded-lg transition-all"
                              >
                                View all {matchingProducts.length} products →
                              </Link>
                            )}
                          </div>
                        </>
                      );
                    }
                    return null;
                  })()}
                  
                  {/* No Results */}
                  {Object.entries(phoneModels).every(([, models]) => {
                    const searchTerms = homeSearchQuery.toLowerCase().split(/\s+/).filter(term => term.length > 0);
                    return models.filter(model => {
                      const modelLower = model.toLowerCase();
                      return searchTerms.every(term => modelLower.includes(term));
                    }).length === 0;
                  }) && (() => {
                    const searchTerms = homeSearchQuery.toLowerCase().split(/\s+/).filter(term => term.length > 0);
                    const matchingProducts = products.filter(product => {
                      const titleLower = product.title.toLowerCase();
                      return searchTerms.every(term => titleLower.includes(term));
                    });
                    return matchingProducts.length === 0;
                  })() && (
                    <div className="text-center py-8">
                      <div className="text-muted-foreground mb-2">
                        No results found for &quot;{homeSearchQuery}&quot;
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Try searching for a phone model, device type, or design pattern
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <div className="inline-block">
                <div className="bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-semibold">
                  ✨ New Quirky Drops
                </div>
              </div>
              <h1 className="text-5xl lg:text-7xl font-bold text-balance leading-tight">
                Boring Phones?
                <span className="bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
                  {" "}Not On Our Watch!
                </span>
              </h1>
              <p className="text-xl text-muted-foreground text-balance max-w-xl">
                Wildly creative phone skins that'll make your friends jealous. 
                Why blend in when you were born to stand out?
              </p>
              <div className="flex flex-wrap gap-4">
                <Button size="lg" className="text-base" asChild>
                  <a href="/products">Browse Collection</a>
                </Button>
                <Button size="lg" variant="secondary" className="text-base">
                  Custom Design
                </Button>
              </div>
              <div className="flex items-center gap-8 pt-4">
                <div>
                  <div className="text-3xl font-bold">10K+</div>
                  <div className="text-sm text-muted-foreground">Happy Customers</div>
                </div>
                <div className="h-12 w-px bg-border" />
                <div>
                  <div className="text-3xl font-bold">500+</div>
                  <div className="text-sm text-muted-foreground">Unique Designs</div>
                </div>
                <div className="h-12 w-px bg-border" />
                <div>
                  <div className="text-3xl font-bold">4.9★</div>
                  <div className="text-sm text-muted-foreground">Average Rating</div>
                </div>
              </div>
            </div>
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-secondary/20 to-accent/20 rounded-3xl blur-3xl" />
              <img 
                src="https://images.unsplash.com/photo-1576110771045-a7711d8aab8e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3NzIwMTN8MHwxfHNlYXJjaHw0fHxjb2xvcmZ1bCUyMHBob25lJTIwY2FzZXMlMjBza2lucyUyMG1vZGVybnxlbnwwfHx8fDE3NjM3MjEyNTF8MA&ixlib=rb-4.1.0&q=80&w=1080"
                alt="Colorful phone cases"
                className="relative rounded-3xl shadow-2xl w-full object-cover aspect-square"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Brand Selector Section */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-4xl lg:text-5xl font-bold text-balance">
              Pick Your Device Brand
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto text-balance">
              Select your brand and we'll show you the perfect skin
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 max-w-5xl mx-auto">
            {[
              { name: "Apple", logo: "🍎" },
              { name: "Samsung", logo: "📱" },
              { name: "Nothing", logo: "⚫" },
              { name: "Oppo", logo: "🔷" },
              { name: "Realme", logo: "🟡" },
              { name: "CMF", logo: "🔸" },
              { name: "Vivo", logo: "🔵" },
              { name: "iQOO", logo: "⚡" },
              { name: "Xiaomi", logo: "🦊" },
              { name: "Lava", logo: "🌋" },
              { name: "Infinix", logo: "♾️" },
              { name: "Asus", logo: "🎮" },
              { name: "HMD", logo: "📞" }
            ].map((brand, index) => (
              <button
                key={index}
                onClick={() => {
                  setSelectedBrand(brand.name);
                  setSearchQuery("");
                  setIsDialogOpen(true);
                }}
                className="group flex flex-col items-center gap-4 p-6 bg-card rounded-2xl border-2 border-border hover:border-primary transition-all hover:shadow-lg hover:-translate-y-1"
              >
                <div className="size-16 bg-gradient-to-br from-primary/10 to-secondary/10 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform text-3xl">
                  {brand.logo}
                </div>
                <span className="text-sm font-semibold text-center">{brand.name}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Device Selector Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-4xl lg:text-5xl font-bold text-balance">
              What Needs a Makeover?
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto text-balance">
              We've got skins for all your tech
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-9 gap-4">
            {[
              { icon: LaptopIcon, label: "Laptop", filter: "laptop" },
              { icon: SmartphoneIcon, label: "Phones", filter: "phone", showBrandSelector: true, type: "phone" as const },
              { icon: MonitorIcon, label: "Mac Mini", filter: "mac mini", showBrandSelector: true, type: "macmini" as const },
              { icon: PlaneIcon, label: "Drones", filter: "drone", showBrandSelector: true, type: "drone" as const },
              { icon: CameraIcon, label: "Camera", filter: "camera", showBrandSelector: true, type: "camera" as const },
              { icon: CircleDotIcon, label: "Lenses", filter: "lens", showBrandSelector: true, type: "lens" as const },
              { icon: BatteryChargingIcon, label: "Chargers", filter: "charger", showBrandSelector: true, type: "charger" as const },
              { icon: TabletSmartphoneIcon, label: "iPad/Tablet", filter: "ipad", showBrandSelector: true, type: "tablet" as const },
              { icon: GamepadIcon, label: "Gaming Console", filter: "console", showBrandSelector: true, type: "console" as const }
            ].map((device, index) => {
              // Special handling for Phones, Drones, Chargers, Tablets, Consoles, Mac Mini, and Camera - open brand selector instead of filtering
              if (device.showBrandSelector) {
                return (
                  <button
                    key={index}
                    onClick={() => {
                      if (device.type === "phone") {
                        setDeviceType("phone");
                        setShowBrandSelectorDialog(true);
                      } else if (device.type === "drone") {
                        setDeviceType("drone");
                        setShowDroneBrandSelectorDialog(true);
                      } else if (device.type === "charger") {
                        setDeviceType("charger");
                        setShowChargerBrandSelectorDialog(true);
                      } else if (device.type === "console") {
                        setDeviceType("console");
                        setShowConsoleBrandSelectorDialog(true);
                      } else if (device.type === "tablet") {
                        setDeviceType("tablet");
                        setShowTabletBrandSelectorDialog(true);
                      } else if (device.type === "macmini") {
                        setDeviceType("macmini");
                        setShowMacMiniBrandSelectorDialog(true);
                      } else if (device.type === "camera") {
                        setDeviceType("camera");
                        setShowCameraBrandSelectorDialog(true);
                      } else if (device.type === "lens") {
                        setDeviceType("lens");
                        setShowLensBrandSelectorDialog(true);
                      }
                    }}
                    className="group flex flex-col items-center gap-4 p-6 bg-card rounded-2xl border-2 border-border hover:border-primary transition-all hover:shadow-lg hover:-translate-y-1"
                  >
                    <div className="size-16 bg-gradient-to-br from-primary/10 to-secondary/10 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                      <device.icon className="size-8 text-primary" />
                    </div>
                    <span className="text-sm font-semibold text-center">{device.label}</span>
                  </button>
                );
              }
              
              // Regular devices - navigate to filtered products page
              return (
                <a
                  key={index}
                  href={`/products?device=${device.filter}`}
                  className="group flex flex-col items-center gap-4 p-6 bg-card rounded-2xl border-2 border-border hover:border-primary transition-all hover:shadow-lg hover:-translate-y-1"
                >
                  <div className="size-16 bg-gradient-to-br from-primary/10 to-secondary/10 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    <device.icon className="size-8 text-primary" />
                  </div>
                  <span className="text-sm font-semibold text-center">{device.label}</span>
                </a>
              );
            })}
          </div>
        </div>
      </section>

      {/* Categories Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-4xl lg:text-5xl font-bold text-balance">
              Pick Your Finish
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto text-balance">
              Three unique finishes, endless personality
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="group relative overflow-hidden border-2 hover:border-primary transition-all hover:shadow-xl">
              <div className="absolute top-0 right-0 bg-primary text-primary-foreground px-3 py-1 text-xs font-semibold rounded-bl-lg">
                CLASSIC
              </div>
              <CardContent className="pt-8 space-y-6">
                <div className="space-y-3">
                  <h3 className="text-2xl font-bold">Matte Finish</h3>
                  <p className="text-muted-foreground mb-4">
                    Smooth, velvety texture with zero glare. Perfect for grip and that premium feel.
                  </p>
                </div>
                {isLoadingProducts ? (
                  <div className="grid grid-cols-2 gap-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <Skeleton key={i} className="aspect-square w-full rounded-lg" />
                    ))}
                  </div>
                ) : matteProducts.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2">
                    {matteProducts.map((product) => (
                      <div key={product.id} className="aspect-square overflow-hidden rounded-lg bg-muted">
                        {product.images[0] ? (
                          <img 
                            src={product.images[0].src} 
                            alt={product.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <PackageIcon className="size-8 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="aspect-square bg-gradient-to-br from-muted to-muted/50 rounded-2xl flex items-center justify-center">
                    <div className="text-6xl">🎨</div>
                  </div>
                )}
                <Button className="w-full" variant="outline" asChild>
                  <a href="/products?finish=matte">Shop Matte</a>
                </Button>
              </CardContent>
            </Card>

            <Card className="group relative overflow-hidden border-2 hover:border-secondary transition-all hover:shadow-xl">
              <div className="absolute top-0 right-0 bg-secondary text-secondary-foreground px-3 py-1 text-xs font-semibold rounded-bl-lg">
                PREMIUM
              </div>
              <CardContent className="pt-8 space-y-6">
                <div className="space-y-3">
                  <h3 className="text-2xl font-bold">3D Embossed Finish</h3>
                  <p className="text-muted-foreground mb-4">
                    Raised textures you can feel. Touch meets art in the most satisfying way.
                  </p>
                </div>
                {isLoadingProducts ? (
                  <div className="grid grid-cols-2 gap-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <Skeleton key={i} className="aspect-square w-full rounded-lg" />
                    ))}
                  </div>
                ) : embossedProducts.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2">
                    {embossedProducts.map((product) => (
                      <div key={product.id} className="aspect-square overflow-hidden rounded-lg bg-muted">
                        {product.images[0] ? (
                          <img 
                            src={product.images[0].src} 
                            alt={product.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <PackageIcon className="size-8 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="aspect-square bg-gradient-to-br from-secondary/20 to-secondary/5 rounded-2xl flex items-center justify-center">
                    <div className="text-6xl">✨</div>
                  </div>
                )}
                <Button className="w-full" variant="outline" asChild>
                  <a href="/products?finish=embossed">Shop 3D Embossed</a>
                </Button>
              </CardContent>
            </Card>

            <Card className="group relative overflow-hidden border-2 hover:border-accent transition-all hover:shadow-xl">
              <div className="absolute top-0 right-0 bg-accent text-accent-foreground px-3 py-1 text-xs font-semibold rounded-bl-lg">
                SLEEK
              </div>
              <CardContent className="pt-8 space-y-6">
                <div className="space-y-3">
                  <h3 className="text-2xl font-bold">Transparent Finish</h3>
                  <p className="text-muted-foreground mb-4">
                    Show off your phone's original color with our crystal-clear protective layer.
                  </p>
                </div>
                {isLoadingProducts ? (
                  <div className="grid grid-cols-2 gap-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <Skeleton key={i} className="aspect-square w-full rounded-lg" />
                    ))}
                  </div>
                ) : transparentProducts.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2">
                    {transparentProducts.map((product) => (
                      <div key={product.id} className="aspect-square overflow-hidden rounded-lg bg-muted">
                        {product.images[0] ? (
                          <img 
                            src={product.images[0].src} 
                            alt={product.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <PackageIcon className="size-8 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="aspect-square bg-gradient-to-br from-accent/20 to-accent/5 rounded-2xl flex items-center justify-center">
                    <div className="text-6xl">💎</div>
                  </div>
                )}
                <Button className="w-full" variant="outline" asChild>
                  <a href="/products?finish=transparent">Shop Transparent</a>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-4xl lg:text-5xl font-bold text-balance">
              Why We're Different
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto text-balance">
              Because your phone deserves more than another boring case
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <Card key={index} className="border-2 hover:border-primary transition-all hover:shadow-lg">
                <CardContent className="pt-6 space-y-4">
                  <div className="size-12 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-xl flex items-center justify-center">
                    <feature.icon className="size-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold">{feature.title}</h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Gallery Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-4xl lg:text-5xl font-bold text-balance">
              Fan Favorites
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto text-balance">
              The designs everyone's obsessed with right now
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[
              "https://images.unsplash.com/photo-1582000129759-dc56c7b45cde?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3NzIwMTN8MHwxfHNlYXJjaHw5fHxjb2xvcmZ1bCUyMHBob25lJTIwY2FzZXMlMjBza2lucyUyMG1vZGVybnxlbnwwfHx8fDE3NjM3MjEyNTF8MA&ixlib=rb-4.1.0&q=80&w=1080",
              "https://images.unsplash.com/photo-1636703781874-ffa0c5de09aa?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3NzIwMTN8MHwxfHNlYXJjaHw3fHxjb2xvcmZ1bCUyMHBob25lJTIwY2FzZXMlMjBza2lucyUyMG1vZGVybnxlbnwwfHx8fDE3NjM3MjEyNTF8MA&ixlib=rb-4.1.0&q=80&w=1080",
              "https://images.unsplash.com/photo-1636703782057-cdda1439bc2c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3NzIwMTN8MHwxfHNlYXJjaHwzfHxjb2xvcmZ1bCUyMHBob25lJTIwY2FzZXMlMjBza2lucyUyMG1vZGVybnxlbnwwfHx8fDE3NjM3MjEyNTF8MA&ixlib=rb-4.1.0&q=80&w=1080",
              "https://images.unsplash.com/photo-1743670827800-61375c99e7a7?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3NzIwMTN8MHwxfHNlYXJjaHw2fHxjb2xvcmZ1bCUyMHBob25lJTIwY2FzZXMlMjBza2lucyUyMG1vZGVybnxlbnwwfHx8fDE3NjM3MjEyNTF8MA&ixlib=rb-4.1.0&q=80&w=1080",
              "https://images.unsplash.com/photo-1580013989584-8c3aa8b17263?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3NzIwMTN8MHwxfHNlYXJjaHwyfHxjb2xvcmZ1bCUyMHBob25lJTIwY2FzZXMlMjBza2lucyUyMG1vZGVybnxlbnwwfHx8fDE3NjM3MjEyNTF8MA&ixlib=rb-4.1.0&q=80&w=1080",
              "https://images.unsplash.com/photo-1636267863852-a4897886ee2f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3NzIwMTN8MHwxfHNlYXJjaHwxMHx8Y29sb3JmdWwlMjBwaG9uZSUyMGNhc2VzJTIwc2tpbnMlMjBtb2Rlcm58ZW58MHx8fHwxNjYzNzIxMjUxfDA&ixlib=rb-4.1.0&q=80&w=1080",
              "https://images.unsplash.com/photo-1731039918160-a26b2b9ff126?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3NzIwMTN8MHwxfHNlYXJjaHw4fHxzbWFydHBob25lJTIwcHJvdGVjdGlvbiUyMHRyZW5keSUyMGRlc2lnbnxlbnwwfHx8fDE3NjM3MjEyNTF8MA&ixlib=rb-4.1.0&q=80&w=1080",
              "https://images.unsplash.com/photo-1744646355003-2f61f09b9f18?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3NzIwMTN8MHwxfHNlYXJjaHw3fHxzbWFydHBob25lJTIwcHJvdGVjdGlvbiUyMHRyZW5keSUyMGRlc2lnbnxlbnwwfHx8fDE3NjM3MjEyNTF8MA&ixlib=rb-4.1.0&q=80&w=1080"
            ].map((image, index) => (
              <div key={index} className="group relative aspect-square overflow-hidden rounded-xl">
                <img 
                  src={image} 
                  alt={`Phone skin design ${index + 1}`}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto">
          <Card className="relative overflow-hidden border-2">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-secondary/10 to-accent/10" />
            <CardContent className="relative py-16 text-center space-y-6">
              <h2 className="text-4xl lg:text-5xl font-bold text-balance">
                Your Phone Called. It Wants Personality.
              </h2>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto text-balance">
                Join 10,000+ happy humans who ditched boring for bold
              </p>
              <div className="flex flex-wrap gap-4 justify-center pt-4">
                <Button size="lg" className="text-base">
                  Shop Now
                </Button>
                <Button size="lg" variant="outline" className="text-base">
                  Learn More
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12 px-4">
        <div className="container mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <img 
                  src="https://cdn.hercules.app/file_Qd06a0OWqeC2LadTl4tLLvmv" 
                  alt="Skinly" 
                  className="h-10"
                />
              </div>
              <p className="text-sm text-muted-foreground">
                Quirky wear for your gadgets
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Shop</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">All Products</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">New Arrivals</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Best Sellers</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Support</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">Contact Us</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Shipping Info</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Returns</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Company</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">About Us</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Terms of Service</a></li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-border text-center text-sm text-muted-foreground">
            © {new Date().getFullYear()} Skinly. All rights reserved.
          </div>
        </div>
      </footer>

      {/* Brand Selector Dialog */}
      <Dialog open={showBrandSelectorDialog} onOpenChange={setShowBrandSelectorDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="text-2xl">Select Your Phone Brand</DialogTitle>
            <DialogDescription>
              Choose your phone brand to continue
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 py-4 max-h-[60vh] overflow-y-auto">
            {[
              { name: "Apple", logo: "🍎" },
              { name: "Samsung", logo: "📱" },
              { name: "Nothing", logo: "⚫" },
              { name: "Oppo", logo: "🔷" },
              { name: "Realme", logo: "🟡" },
              { name: "CMF", logo: "🔸" },
              { name: "Vivo", logo: "🔵" },
              { name: "iQOO", logo: "⚡" },
              { name: "Xiaomi", logo: "🦊" },
              { name: "Lava", logo: "🌋" },
              { name: "Infinix", logo: "♾️" },
              { name: "Asus", logo: "🎮" },
              { name: "HMD", logo: "📞" }
            ].map((brand, index) => (
              <button
                key={index}
                onClick={() => {
                  setSelectedBrand(brand.name);
                  setSearchQuery("");
                  setDeviceType("phone");
                  setShowBrandSelectorDialog(false);
                  setIsDialogOpen(true);
                }}
                className="group flex flex-col items-center gap-3 p-6 bg-card rounded-xl border-2 border-border hover:border-primary transition-all hover:shadow-lg"
              >
                <div className="size-16 bg-gradient-to-br from-primary/10 to-secondary/10 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform text-3xl">
                  {brand.logo}
                </div>
                <span className="text-sm font-semibold text-center">{brand.name}</span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Drone Brand Selector Dialog */}
      <Dialog open={showDroneBrandSelectorDialog} onOpenChange={setShowDroneBrandSelectorDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="text-2xl">Select Your Drone Brand</DialogTitle>
            <DialogDescription>
              Choose your drone brand to continue
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4 max-h-[60vh] overflow-y-auto">
            {[
              { name: "DJI", logo: "🛸" },
              { name: "Xiaomi", logo: "🦊" }
            ].map((brand, index) => (
              <button
                key={index}
                onClick={() => {
                  setSelectedBrand(brand.name);
                  setSearchQuery("");
                  setDeviceType("drone");
                  setShowDroneBrandSelectorDialog(false);
                  setIsDialogOpen(true);
                }}
                className="group flex flex-col items-center gap-4 p-6 bg-card rounded-2xl border-2 border-border hover:border-primary transition-all hover:shadow-lg hover:-translate-y-1"
              >
                <div className="size-16 bg-gradient-to-br from-primary/10 to-secondary/10 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform text-3xl">
                  {brand.logo}
                </div>
                <span className="text-sm font-semibold text-center">{brand.name}</span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Charger Brand Selector Dialog */}
      <Dialog open={showChargerBrandSelectorDialog} onOpenChange={setShowChargerBrandSelectorDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="text-2xl">Select Your Charger Brand</DialogTitle>
            <DialogDescription>
              Choose your charger brand to continue
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 py-4 max-h-[60vh] overflow-y-auto">
            {[
              { name: "Apple", logo: "🍎" },
              { name: "OnePlus", logo: "➕" },
              { name: "Realme", logo: "🟡" },
              { name: "Vivo", logo: "🔵" },
              { name: "Xiaomi", logo: "🦊" },
              { name: "iQOO", logo: "⚡" },
              { name: "Samsung", logo: "📱" }
            ].map((brand, index) => (
              <button
                key={index}
                onClick={() => {
                  setSelectedBrand(brand.name);
                  setSearchQuery("");
                  setDeviceType("charger");
                  setShowChargerBrandSelectorDialog(false);
                  setIsDialogOpen(true);
                }}
                className="group flex flex-col items-center gap-4 p-6 bg-card rounded-2xl border-2 border-border hover:border-primary transition-all hover:shadow-lg hover:-translate-y-1"
              >
                <div className="size-16 bg-gradient-to-br from-primary/10 to-secondary/10 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform text-3xl">
                  {brand.logo}
                </div>
                <span className="text-sm font-semibold text-center">{brand.name}</span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Tablet Brand Selector Dialog */}
      <Dialog open={showTabletBrandSelectorDialog} onOpenChange={setShowTabletBrandSelectorDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="text-2xl">Select Your Tablet Brand</DialogTitle>
            <DialogDescription>
              Choose your tablet brand to continue
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-4 max-h-[60vh] overflow-y-auto">
            {[
              { name: "Apple", logo: "🍎" },
              { name: "Samsung", logo: "📱" },
              { name: "Lenovo", logo: "💻" },
              { name: "Xiaomi", logo: "🦊" }
            ].map((brand, index) => (
              <button
                key={index}
                onClick={() => {
                  setSelectedBrand(brand.name);
                  setSearchQuery("");
                  setDeviceType("tablet");
                  setShowTabletBrandSelectorDialog(false);
                  setIsDialogOpen(true);
                }}
                className="group flex flex-col items-center gap-4 p-6 bg-card rounded-2xl border-2 border-border hover:border-primary transition-all hover:shadow-lg hover:-translate-y-1"
              >
                <div className="size-16 bg-gradient-to-br from-primary/10 to-secondary/10 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform text-3xl">
                  {brand.logo}
                </div>
                <span className="text-sm font-semibold text-center">{brand.name}</span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Console Brand Selector Dialog */}
      <Dialog open={showConsoleBrandSelectorDialog} onOpenChange={setShowConsoleBrandSelectorDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="text-2xl">Select Your Gaming Console Brand</DialogTitle>
            <DialogDescription>
              Choose your gaming console brand to continue
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4 max-h-[60vh] overflow-y-auto">
            {[
              { name: "PlayStation", logo: "🎮" },
              { name: "Xbox", logo: "🎯" }
            ].map((brand, index) => (
              <button
                key={index}
                onClick={() => {
                  setSelectedBrand(brand.name);
                  setSearchQuery("");
                  setDeviceType("console");
                  setShowConsoleBrandSelectorDialog(false);
                  setIsDialogOpen(true);
                }}
                className="group flex flex-col items-center gap-4 p-6 bg-card rounded-2xl border-2 border-border hover:border-primary transition-all hover:shadow-lg hover:-translate-y-1"
              >
                <div className="size-16 bg-gradient-to-br from-primary/10 to-secondary/10 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform text-3xl">
                  {brand.logo}
                </div>
                <span className="text-sm font-semibold text-center">{brand.name}</span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Mac Mini Brand Selector Dialog */}
      <Dialog open={showMacMiniBrandSelectorDialog} onOpenChange={setShowMacMiniBrandSelectorDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="text-2xl">Select Your Mac Mini Brand</DialogTitle>
            <DialogDescription>
              Choose your Mac Mini brand to continue
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4 py-4 max-h-[60vh] overflow-y-auto">
            {[
              { name: "Apple", logo: "🍎" }
            ].map((brand, index) => (
              <button
                key={index}
                onClick={() => {
                  setSelectedBrand(brand.name);
                  setSearchQuery("");
                  setDeviceType("macmini");
                  setShowMacMiniBrandSelectorDialog(false);
                  setIsDialogOpen(true);
                }}
                className="group flex flex-col items-center gap-4 p-6 bg-card rounded-2xl border-2 border-border hover:border-primary transition-all hover:shadow-lg hover:-translate-y-1"
              >
                <div className="size-16 bg-gradient-to-br from-primary/10 to-secondary/10 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform text-3xl">
                  {brand.logo}
                </div>
                <span className="text-sm font-semibold text-center">{brand.name}</span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Camera Brand Selector Dialog */}
      <Dialog open={showCameraBrandSelectorDialog} onOpenChange={setShowCameraBrandSelectorDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="text-2xl">Select Your Camera Brand</DialogTitle>
            <DialogDescription>
              Choose your camera brand to continue
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 py-4 max-h-[60vh] overflow-y-auto">
            {[
              { name: "Sony", logo: "📷" },
              { name: "Nikon", logo: "📸" },
              { name: "Canon", logo: "📹" }
            ].map((brand, index) => (
              <button
                key={index}
                onClick={() => {
                  setSelectedBrand(brand.name);
                  setSearchQuery("");
                  setDeviceType("camera");
                  setShowCameraBrandSelectorDialog(false);
                  setIsDialogOpen(true);
                }}
                className="group flex flex-col items-center gap-4 p-6 bg-card rounded-2xl border-2 border-border hover:border-primary transition-all hover:shadow-lg hover:-translate-y-1"
              >
                <div className="size-16 bg-gradient-to-br from-primary/10 to-secondary/10 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform text-3xl">
                  {brand.logo}
                </div>
                <span className="text-sm font-semibold text-center">{brand.name}</span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Lens Brand Selector Dialog */}
      <Dialog open={showLensBrandSelectorDialog} onOpenChange={setShowLensBrandSelectorDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="text-2xl">Select Your Lens Brand</DialogTitle>
            <DialogDescription>
              Choose your camera lens brand to continue
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 py-4 max-h-[60vh] overflow-y-auto">
            {[
              { name: "Sony", logo: "🔴" },
              { name: "Nikon", logo: "🟡" },
              { name: "Canon", logo: "🔵" },
              { name: "Sigma", logo: "⚫" },
              { name: "Tamron", logo: "🟢" },
              { name: "Samyang", logo: "🟣" },
              { name: "Vitrox", logo: "🟠" },
              { name: "Tokina", logo: "🟤" },
              { name: "Zeiss", logo: "⚪" },
              { name: "Olympus", logo: "🔷" },
              { name: "Fujifilm", logo: "🟥" }
            ].map((brand, index) => (
              <button
                key={index}
                onClick={() => {
                  setSelectedBrand(brand.name);
                  setSearchQuery("");
                  setDeviceType("lens");
                  setShowLensBrandSelectorDialog(false);
                  setIsDialogOpen(true);
                }}
                className="group flex flex-col items-center gap-4 p-6 bg-card rounded-2xl border-2 border-border hover:border-primary transition-all hover:shadow-lg hover:-translate-y-1"
              >
                <div className="size-16 bg-gradient-to-br from-primary/10 to-secondary/10 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform text-3xl">
                  {brand.logo}
                </div>
                <span className="text-sm font-semibold text-center">{brand.name}</span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Model Selector Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-2xl">
              Select Your {selectedBrand} {
                deviceType === "phone" ? "Model" : 
                deviceType === "drone" ? "Drone" : 
                deviceType === "charger" ? "Charger" : 
                deviceType === "console" ? "Console" : 
                deviceType === "tablet" ? "Tablet" :
                deviceType === "macmini" ? "Mac Mini" :
                deviceType === "lens" ? "Lens" :
                "Camera"
              }
            </DialogTitle>
            <DialogDescription>
              Choose your {
                deviceType === "phone" ? "phone model" : 
                deviceType === "drone" ? "drone model" : 
                deviceType === "charger" ? "charger model" : 
                deviceType === "console" ? "console model" : 
                deviceType === "tablet" ? "tablet model" :
                deviceType === "macmini" ? "Mac Mini model" :
                deviceType === "lens" ? "lens model" :
                "camera model"
              } to see compatible skins
            </DialogDescription>
          </DialogHeader>
          
          {/* Search Bar */}
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search models..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Model List */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-2">
            {selectedBrand && (
              deviceType === "phone" ? phoneModels[selectedBrand] : 
              deviceType === "drone" ? droneModels[selectedBrand] : 
              deviceType === "charger" ? chargerModels[selectedBrand] :
              deviceType === "console" ? consoleModels[selectedBrand] :
              deviceType === "tablet" ? tabletModels[selectedBrand] :
              deviceType === "macmini" ? macMiniModels[selectedBrand] :
              deviceType === "lens" ? lensModels[selectedBrand] :
              cameraModels[selectedBrand]
            )
              ?.filter(model => 
                searchQuery.trim() === "" || 
                model.toLowerCase().includes(searchQuery.toLowerCase())
              )
              .map((model, index) => (
                <button
                  key={index}
                  onClick={() => {
                    setIsDialogOpen(false);
                    window.location.href = `/products?brand=${selectedBrand.toLowerCase()}&model=${encodeURIComponent(model)}&showFinish=true`;
                  }}
                  className="w-full text-left p-4 rounded-lg border-2 border-border hover:border-primary hover:bg-primary/5 transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium group-hover:text-primary transition-colors">
                      {model}
                    </span>
                    <span className="text-sm text-muted-foreground group-hover:text-primary transition-colors">
                      Select →
                    </span>
                  </div>
                </button>
              ))}
            
            {selectedBrand && (
              deviceType === "phone" ? phoneModels[selectedBrand] : 
              deviceType === "drone" ? droneModels[selectedBrand] : 
              deviceType === "charger" ? chargerModels[selectedBrand] :
              deviceType === "console" ? consoleModels[selectedBrand] :
              deviceType === "tablet" ? tabletModels[selectedBrand] :
              deviceType === "macmini" ? macMiniModels[selectedBrand] :
              deviceType === "lens" ? lensModels[selectedBrand] :
              cameraModels[selectedBrand]
            )
              ?.filter(model => 
                searchQuery.trim() === "" || 
                model.toLowerCase().includes(searchQuery.toLowerCase())
              ).length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No models found matching &quot;{searchQuery}&quot;
                </div>
              )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
