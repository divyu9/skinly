import { useState, useEffect } from "react";
import UAParser from "ua-parser-js";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

export interface DetectedDevice {
  brand: string;
  model: string;
  isConfirmed: boolean; // True if user manually confirmed or selected
}

export function useDeviceDetection() {
  const [device, setDevice] = useState<DetectedDevice | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  // Load saved preference from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("skinly_device_preference");
    if (saved) {
      try {
        setDevice(JSON.parse(saved));
      } catch (e) {
        // Invalid JSON, ignore
      }
    } else {
      // If no saved preference, try to detect
      detectDevice();
    }
  }, []);

  const detectDevice = () => {
    const parser = new UAParser();
    const result = parser.getResult();
    
    // Check for high-confidence matches
    // Note: Most modern browsers hide precise model info for privacy
    // But mobile devices often still leak it in UA string or we can infer
    
    const vendor = result.device.vendor;
    const model = result.device.model;
    const os = result.os.name;

    if (vendor && model) {
      // Basic mapping (can be enhanced with DB map later)
      // For now, let's use what we get if it looks valid
      
      let detectedBrand = vendor;
      let detectedModel = model;

      // Normalize Apple
      if (vendor === "Apple" && (model === "iPhone" || !model)) {
        // iPhone usually doesn't give model version in standard UA anymore
        // We might just know it's an iPhone
        detectedBrand = "Apple";
        detectedModel = "iPhone"; // Generic
      }

      if (detectedBrand && detectedModel) {
        // Don't set state immediately, just show prompt
        // We only set "device" state when confirmed
        setShowPrompt(true);
      }
    } else if (os === "iOS") {
        // Fallback for iOS
        setShowPrompt(true);
    }
  };

  const confirmDevice = (brand: string, model: string) => {
    const newDevice = { brand, model, isConfirmed: true };
    setDevice(newDevice);
    localStorage.setItem("skinly_device_preference", JSON.stringify(newDevice));
    setShowPrompt(false);
  };

  const clearDevice = () => {
    setDevice(null);
    localStorage.removeItem("skinly_device_preference");
  };

  return {
    device,
    showPrompt,
    confirmDevice,
    clearDevice,
    dismissPrompt: () => setShowPrompt(false),
  };
}
