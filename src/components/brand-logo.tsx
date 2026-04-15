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
  fallbackUrl = "",
  disableLink = false
}: BrandLogoProps) {
  const homepageSettings = useQuery(api.homepage.getHomepageSettings);
  
  const logoLink = homepageSettings?.logoRedirectLink || "/";

  if (homepageSettings === undefined) {
    const placeholder = (
      <div className={cn("h-10 md:h-12 flex items-center", imgClassName)}>
        <span className="font-bold text-lg leading-none">Skinly</span>
      </div>
    );

    if (disableLink) {
      return <div className={cn("flex items-center gap-2 flex-shrink-0", className)}>{placeholder}</div>;
    }

    return (
      <Link to={logoLink} className={cn("flex items-center gap-2 flex-shrink-0", className)}>
        {placeholder}
      </Link>
    );
  }

  let logoUrl = fallbackUrl;
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
      alt="Brand Logo"
      fetchpriority="high"
      loading="eager"
      decoding="sync"
      className={cn("h-10 md:h-12 w-auto max-w-[200px] object-contain", imgClassName)}
    />
  ) : (
    <div className={cn("h-10 md:h-12 flex items-center", imgClassName)}>
      <span className="font-bold text-lg leading-none">Skinly</span>
    </div>
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
