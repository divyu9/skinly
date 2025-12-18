import { useParams } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Helmet } from "react-helmet-async";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import KeywordPageLayout from "./_components/keyword-layout.tsx";
import DevicePageLayout from "./_components/device-layout.tsx";
import BrandPageLayout from "./_components/brand-layout.tsx";
import SkinTypePageLayout from "./_components/skin-type-layout.tsx";
import ProductPageLayout from "./_components/product-layout.tsx";
import NotFound from "../NotFound.tsx";

export default function SEOPage() {
  const params = useParams<{ slug?: string }>();
  // Extract slug from either :slug param or root-level param
  const slug = params.slug || "";
  
  // Check if this slug belongs to a product first (for SEO-friendly product URLs)
  const product = useQuery(api.products.getProductBySlug, { slug });
  const page = useQuery(api.seoPages.getPageBySlug, { slug });

  // Loading state
  if (page === undefined || product === undefined) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-12">
          <Skeleton className="h-12 w-3/4 mb-6" />
          <Skeleton className="h-6 w-full mb-4" />
          <Skeleton className="h-6 w-full mb-4" />
          <Skeleton className="h-6 w-2/3 mb-8" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-64 w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // If this slug belongs to a product, redirect to product detail page
  if (product) {
    window.location.href = `/products/detail?slug=${slug}`;
    return null;
  }

  // Not found or unpublished SEO page
  if (!page || !page.isPublished) {
    return <NotFound />;
  }

  // Determine current URL - all SEO pages are at root level
  const getCurrentUrl = () => {
    const baseUrl = "https://goskinly.com"; // Production domain
    return `${baseUrl}/${page.slug}`;
  };

  const currentUrl = getCurrentUrl();

  return (
    <>
      {/* SEO Meta Tags */}
      <Helmet>
        <title>{page.metaTitle}</title>
        <meta name="description" content={page.metaDescription} />
        <link rel="canonical" href={page.canonicalUrl || currentUrl} />
        <meta name="keywords" content={page.keywords.join(", ")} />
        
        {/* Open Graph */}
        <meta property="og:title" content={page.metaTitle} />
        <meta property="og:description" content={page.metaDescription} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={currentUrl} />
        <meta property="og:site_name" content="GoSkinly" />
        
        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={page.metaTitle} />
        <meta name="twitter:description" content={page.metaDescription} />
        
        {/* Organization Structured Data */}
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Organization",
            "name": "GoSkinly",
            "url": "https://goskinly.com",
            "logo": "https://goskinly.com/logo.png",
            "description": "Premium phone skins and protection accessories",
            "sameAs": []
          })}
        </script>

        {/* WebPage Structured Data */}
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebPage",
            "name": page.metaTitle,
            "description": page.metaDescription,
            "url": currentUrl,
            "datePublished": new Date(page.createdAt).toISOString(),
            "dateModified": new Date(page.updatedAt || page.createdAt).toISOString(),
            "publisher": {
              "@type": "Organization",
              "name": "GoSkinly"
            },
            "breadcrumb": {
              "@type": "BreadcrumbList",
              "itemListElement": [
                {
                  "@type": "ListItem",
                  "position": 1,
                  "name": "Home",
                  "item": "https://goskinly.com"
                },
                {
                  "@type": "ListItem",
                  "position": 2,
                  "name": page.h1Heading,
                  "item": currentUrl
                }
              ]
            }
          })}
        </script>
        
        {/* FAQPage Structured Data */}
        {page.faqs && page.faqs.length > 0 && (
          <script type="application/ld+json">
            {JSON.stringify({
              "@context": "https://schema.org",
              "@type": "FAQPage",
              "mainEntity": page.faqs.map((faq) => ({
                "@type": "Question",
                "name": faq.question,
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": faq.answer
                }
              }))
            })}
          </script>
        )}

        {/* Product Collection Structured Data (for product-related pages) */}
        {(page.pageType === "brand" || page.pageType === "device" || page.pageType === "product" || page.pageType === "skin-type") && (
          <script type="application/ld+json">
            {JSON.stringify({
              "@context": "https://schema.org",
              "@type": "CollectionPage",
              "name": page.h1Heading,
              "description": page.metaDescription,
              "url": currentUrl
            })}
          </script>
        )}
      </Helmet>

      {/* Render appropriate layout based on page type */}
      {page.pageType === "keyword" && <KeywordPageLayout page={page} />}
      {page.pageType === "device" && <DevicePageLayout page={page} />}
      {page.pageType === "brand" && <BrandPageLayout page={page} />}
      {page.pageType === "skin-type" && <SkinTypePageLayout page={page} />}
      {page.pageType === "product" && <ProductPageLayout page={page} />}
    </>
  );
}
