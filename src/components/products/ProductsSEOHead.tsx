import { memo } from "react";
import { Helmet } from "react-helmet-async";

interface ProductsSEOHeadProps {
  title?: string;
  description?: string;
}

export const ProductsSEOHead = memo(function ProductsSEOHead({
  title = "Shop Premium Phone Skins & Gadget Accessories | Skinly",
  description = "Browse 500+ unique phone skins and gadget accessories. Premium quality, perfect fit, bubble-free application.",
}: ProductsSEOHeadProps) {
  const imageUrl = "/logo.webp";
  const siteUrl = "https://goskinly.com/products";
  
  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      
      {/* Open Graph Tags */}
      <meta property="og:type" content="website" />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={siteUrl} />
      <meta property="og:image" content={imageUrl} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:site_name" content="Skinly" />
      
      {/* Twitter Card Tags */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={imageUrl} />
      <meta name="twitter:site" content="@goskinly" />
    </Helmet>
  );
});
