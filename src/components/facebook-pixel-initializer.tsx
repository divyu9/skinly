import { useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";

declare global {
  interface Window {
    initFacebookPixel?: (pixelId: string) => void;
    __fbPixelId?: string | null;
    __fbPixelLoaded?: boolean;
  }
}

export function FacebookPixelInitializer() {
  const pixelSetting = useQuery(api.settings.getSetting, { 
    key: "META_PIXEL_ID" 
  });

  useEffect(() => {
    // If we have a pixel ID and the init function is available
    if (pixelSetting?.value && typeof pixelSetting.value === "string") {
      const pixelId = pixelSetting.value.trim();
      
      if (pixelId && window.initFacebookPixel) {
        window.initFacebookPixel(pixelId);
        
        // Also inject noscript fallback
        const noscriptContainer = document.getElementById("fb-pixel-noscript");
        if (noscriptContainer && !noscriptContainer.hasChildNodes()) {
          const img = document.createElement("img");
          img.height = 1;
          img.width = 1;
          img.style.display = "none";
          img.src = `https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1`;
          noscriptContainer.appendChild(img);
        }
      }
    }
  }, [pixelSetting]);

  return null;
}
