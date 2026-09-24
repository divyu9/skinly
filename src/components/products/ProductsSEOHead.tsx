import { memo } from "react";
import { PRODUCTS_META } from "@/lib/category-paths.mjs";
import { Helmet } from "react-helmet-async";

interface ProductsSEOHeadProps {
  title?: string;
  description?: string;
  /** Site-relative canonical path for this listing state. */
  canonicalPath?: string;
}

export const ProductsSEOHead = memo(function ProductsSEOHead({
  title = PRODUCTS_META.title,
  description = PRODUCTS_META.description,
  canonicalPath = "/products",
}: ProductsSEOHeadProps) {
  const imageUrl = "https://goskinly.com/og-default.jpg";
  const canonicalUrl = `https://goskinly.com${canonicalPath}`;

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonicalUrl} />

      {/* Open Graph Tags */}
      <meta property="og:type" content="website" />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:image" content={imageUrl} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:site_name" content="GoSkinly" />

      {/* Twitter Card Tags */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={imageUrl} />
      <meta name="twitter:site" content="@goskinly" />
    </Helmet>
  );
});
