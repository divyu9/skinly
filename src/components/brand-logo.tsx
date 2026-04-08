import { Link } from "react-router-dom";
import { useQuery } from "@/lib/firebase-hooks";
import { api } from "@/lib/firebase-api";
import { cn } from "@/lib/utils";

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
  fallbackUrl = "/logo.webp",
  disableLink = false
}: BrandLogoProps) {
  const homepageSettings = useQuery(api.homepage.getHomepageSettings);
  
  let logoUrl = fallbackUrl;
  if (homepageSettings) {
    if (type === "footer" && homepageSettings.footerLogoImageUrl) {
      logoUrl = homepageSettings.footerLogoImageUrl;
    } else if (homepageSettings.logoImageUrl) {
      logoUrl = homepageSettings.logoImageUrl;
    }
  }
  
  const logoLink = homepageSettings?.logoRedirectLink || "/";

  const imgContent = (
    <img
      src={logoUrl}
      alt="Brand Logo"
      fetchpriority="high"
      loading="eager"
      decoding="sync"
      className={cn("h-10 md:h-12 w-auto max-w-[200px] object-contain", imgClassName)}
    />
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