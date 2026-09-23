import { useParams, Navigate } from "react-router-dom";
import { useState } from "react";
import { useQuery } from "@/lib/firebase-hooks";
import { api } from "@/lib/firebase-api";
import { Helmet } from "react-helmet-async";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import KeywordPageLayout from "./_components/keyword-layout.tsx";
import DevicePageLayout from "./_components/device-layout.tsx";
import BrandPageLayout from "./_components/brand-layout.tsx";
import SkinTypePageLayout from "./_components/skin-type-layout.tsx";
import ProductPageLayout from "./_components/product-layout.tsx";
import NotFound from "../NotFound.tsx";
import { useSeoPageData } from "./use-seo-page-data";

/*
 * The page as the build wrote it, if the build wrote this one.
 *
 * Read once, on the first render, from the JSON the prerender placed in the
 * HTML — so the heading and hero paint as soon as the bundle runs rather than
 * after two Firestore round trips. Only trusted for the slug it was written
 * for: a client-side navigation to another landing page finds a seed for the
 * page it started on, and ignores it.
 */
function readSeed(slug: string): { page: any } | null {
  if (typeof document === "undefined") return null;
  try {
    const el = document.getElementById("__seed");
    if (!el?.textContent) return null;
    const seed = JSON.parse(el.textContent);
    return seed?.slug === slug && seed?.page ? { page: seed.page } : null;
  } catch {
    return null;
  }
}

export default function SEOPage() {
  const params = useParams<{ slug?: string }>();
  // Extract slug from either :slug param or root-level param
  const slug = params.slug || "";
  const [seed] = useState(() => readSeed(slug));
  const seeded = seed && seed.page.slug === slug ? seed : null;

  // Check if this slug belongs to a product first (for SEO-friendly product URLs)
  const productLive = useQuery(api.products.getProductBySlug, { slug });
  const pageLive = useQuery(api.seoPages.getPageBySlug, { slug });
  // The live answers win as soon as they arrive; until then, a page the build
  // wrote is known to be a landing page and not a product.
  const page = pageLive !== undefined ? pageLive : seeded?.page;
  const product = productLive !== undefined ? productLive : seeded ? null : undefined;
  const data = useSeoPageData(page && page.isPublished ? page : null);

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
    return <Navigate to={`/products/${slug}`} replace />;
  }

  // Not found or unpublished SEO page
  if (!page || !page.isPublished) {
    return <NotFound />;
  }

  // Determine current URL - all SEO pages are at root level
  const getCurrentUrl = () => {
    const baseUrl = "https://goskinly.com";
    return `${baseUrl}/${page.slug}`;
  };

  const currentUrl = getCurrentUrl();
  // Built from what the page offers once its data has loaded; the stored copy
  // until then (and for pages whose device we do not carry).
  const title = data?.title || page.metaTitle;
  const description = data?.description || page.metaDescription;

  return (
    <>
      {/* SEO Meta Tags */}
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={description} />
        {/* Same URL the prerendered HTML declares. */}
        <link rel="canonical" href={currentUrl} />
        {data?.total === 0 && <meta name="robots" content="noindex, follow" />}

        {/* Open Graph */}
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={currentUrl} />
        <meta property="og:site_name" content="GoSkinly" />
        {/* No fragments inside Helmet: it does not read their children. */}
        <meta property="og:image" content={page.heroImageUrl || "https://goskinly.com/og-default.jpg"} />

        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
        <meta name="twitter:image" content={page.heroImageUrl || "https://goskinly.com/og-default.jpg"} />

        {/* CollectionPage Structured Data */}
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            "name": page.h1Heading,
            "description": description,
            "url": currentUrl,
            "provider": {
              "@type": "Organization",
              "name": "GoSkinly",
              "url": "https://goskinly.com"
            }
          })}
        </script>

        {/* BreadcrumbList Structured Data */}
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
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
      </Helmet>

      {/* Render appropriate layout based on page type */}
      {page.pageType === "keyword" && <KeywordPageLayout page={page} data={data} />}
      {page.pageType === "device" && <DevicePageLayout page={page} data={data} />}
      {page.pageType === "brand" && <BrandPageLayout page={page} data={data} />}
      {page.pageType === "skin-type" && <SkinTypePageLayout page={page} data={data} />}
      {page.pageType === "product" && <ProductPageLayout page={page} />}
    </>
  );
}
