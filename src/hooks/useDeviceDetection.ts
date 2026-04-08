import { useState, useEffect } from "react";
import { UAParser } from "ua-parser-js";
import { useQuery } from "@/lib/firebase-hooks";
import { api } from "@/lib/firebase-api";

export interface DetectedDevice {
  brand: string;
  model: string;
  isConfirmed: boolean; // True if user manually confirmed or selected
}

export function useDeviceDetection() {
  const [device, setDevice] = useState<DetectedDevice | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [candidate, setCandidate] = useState<{ brand: string; model: string } | null>(null);

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
    const vendor = result.device.vendor;
    const model = result.device.model;
    const os = result.os.name;

    if (vendor && model) {
      let detectedBrand = vendor;
      let detectedModel = model;

      // Normalize Apple
      if (vendor === "Apple" && (model === "iPhone" || !model)) {
        detectedBrand = "Apple";
        detectedModel = "iPhone"; // Generic
      } else if (vendor === "Apple" && model === "Macintosh") {
        detectedBrand = "Apple";
        detectedModel = "MacBook"; // Generic for Mac
      }

      if (detectedBrand && detectedModel) {
        setCandidate({ brand: detectedBrand, model: detectedModel });
        setShowPrompt(true);
      }
    } else if (os === "iOS") {
        // Fallback for iOS
        setCandidate({ brand: "Apple", model: "iPhone" });
        setShowPrompt(true);
    } else if (os === "Mac OS") {
        // Fallback for Mac
        setCandidate({ brand: "Apple", model: "MacBook" });
        setShowPrompt(true);
    }
  };

  const confirmDevice = (brand: string, model: string) => {
    const newDevice = { brand, model, isConfirmed: true };
    setDevice(newDevice);
    localStorage.setItem("skinly_device_preference", JSON.stringify(newDevice));
    setShowPrompt(false);
    setCandidate(null);
  };

  const clearDevice = () => {
    setDevice(null);
    localStorage.removeItem("skinly_device_preference");
  };

  return {
    device,
    showPrompt,
    candidate,
    confirmDevice,
    clearDevice,
    dismissPrompt: () => {
        setShowPrompt(false);
        setCandidate(null);
    },
  };
}
