import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@/lib/firebase-hooks";
import { api } from "@/lib/firebase-api";
import { cn } from "@/lib/utils";

const LOGO_CACHE_KEY = "goskinly_logo_url";
const FOOTER_LOGO_CACHE_KEY = "goskinly_footer_logo_url";

interface BrandLogoProps {
  className?: string;
  imgClassName?: string;
  type?: "header" | "footer" | "any";
  fallbackUrl?: string;
  disableLink?: boolean;
}

export function BrandLogo({
  className,
  imgClassName,
  type = "any",
  fallbackUrl = "",
  disableLink = false,
}: BrandLogoProps) {
  const homepageSettings = useQuery(api.homepage.getHomepageSettings);

  // Seed from localStorage so the logo renders immediately on page load
  const [cachedLogoUrl] = useState<string>(() => {
    try {
      return (
        (type === "footer"
          ? localStorage.getItem(FOOTER_LOGO_CACHE_KEY)
          : localStorage.getItem(LOGO_CACHE_KEY)) || ""
      );
    } catch {
      return "";
    }
  });

  // Persist fresh URL to cache whenever settings arrive
  useEffect(() => {
    if (!homepageSettings) return;
    try {
      if (homepageSettings.footerLogoImageUrl) {
        localStorage.setItem(FOOTER_LOGO_CACHE_KEY, homepageSettings.footerLogoImageUrl);
      }
      if (homepageSettings.logoImageUrl) {
        localStorage.setItem(LOGO_CACHE_KEY, homepageSettings.logoImageUrl);
      }
    } catch { /* storage not available */ }
  }, [homepageSettings]);

  const logoLink = homepageSettings?.logoRedirectLink || "/";

  // Resolve the URL to display:
  // - While loading: use cached value (avoids flash)
  // - After load: use fresh value from Firestore
  let logoUrl = fallbackUrl || cachedLogoUrl;
  if (homepageSettings) {
    if (type === "footer" && homepageSettings.footerLogoImageUrl) {
      logoUrl = homepageSettings.footerLogoImageUrl;
    } else if (homepageSettings.logoImageUrl) {
      logoUrl = homepageSettings.logoImageUrl;
    }
  }

  const imgContent = logoUrl ? (
    <img
      src={logoUrl}
      alt="GoSkinly"
      fetchpriority="high"
      loading="eager"
      decoding="sync"
      className={cn("h-10 md:h-12 w-auto max-w-[200px] object-contain", imgClassName)}
    />
  ) : (
    // Invisible size-holder while settings load — no text flash
    <div className={cn("h-10 md:h-12 w-24", imgClassName)} aria-hidden="true" />
  );

  if (disableLink) {
    return (
      <div className={cn("flex items-center gap-2 flex-shrink-0", className)}>
        {imgContent}
      </div>
    );
  }

  return (
    <Link to={logoLink} className={cn("flex items-center gap-2 flex-shrink-0", className)}>
      {imgContent}
    </Link>
  );
}
