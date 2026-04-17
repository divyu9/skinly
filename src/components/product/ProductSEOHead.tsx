import { Helmet } from "react-helmet-async";
import { generateBreadcrumbStructuredData } from "@/lib/seo-structured-data";

interface SeoMeta {
  title: string;
  description: string;
  url: string;
  image: string;
  price: number;
  isActive: boolean;
}

interface Variant {
  _id: string;
  sku?: string;
  price: number;
  compareAtPrice?: number;
  inventoryQuantity: number;
}

interface Review {
  _id: string;
  rating: number;
  verified: boolean;
}

interface ProductData {
  _id: string;
  title: string;
  slug?: string;
  metaDescription?: string;
  images?: Array<{ url: string }>;
}

interface ProductSEOHeadProps {
  seoMeta: SeoMeta | null;
  productData?: ProductData | null;
  productImage: string;
  productUrl: string;
  productPrice: number;
  variants?: Variant[];
  reviews?: Review[];
}

const BASE_URL = "https://www.goskinly.com";

export function ProductSEOHead({
  seoMeta,
  productData,
  productImage,
  productUrl,
  productPrice,
  variants,
  reviews,
}: ProductSEOHeadProps) {
  if (!seoMeta) return null;

  const slug = productData?.slug;
  const canonicalUrl = slug ? `${BASE_URL}/products/${slug}` : productUrl;

  // Cheapest in-stock variant price; fall back to cheapest overall
  const activeVariants = variants?.filter(v => v.inventoryQuantity > 0) ?? [];
  const cheapestPrice =
    activeVariants.length > 0
      ? Math.min(...activeVariants.map(v => v.price))
      : variants && variants.length > 0
        ? Math.min(...variants.map(v => v.price))
        : productPrice;

  const isInStock = activeVariants.length > 0;
  const defaultVariantSku = variants?.[0]?.sku;

  // AggregateRating from verified reviews only
  const verifiedReviews = reviews?.filter(r => r.verified) ?? [];
  const hasRatings = verifiedReviews.length > 0;
  const avgRating = hasRatings
    ? (verifiedReviews.reduce((sum, r) => sum + r.rating, 0) / verifiedReviews.length).toFixed(1)
    : null;

  const productSchema = productData
    ? {
        "@context": "https://schema.org",
        "@type": "Product",
        name: productData.title,
        description: productData.metaDescription || seoMeta.description,
        image: productImage,
        sku: defaultVariantSku,
        brand: { "@type": "Brand", name: "GoSkinly" },
        offers: {
          "@type": "Offer",
          price: cheapestPrice,
          priceCurrency: "INR",
          availability: isInStock
            ? "https://schema.org/InStock"
            : "https://schema.org/OutOfStock",
          url: canonicalUrl,
          seller: { "@type": "Organization", name: "GoSkinly" },
        },
        ...(hasRatings && {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: avgRating,
            reviewCount: verifiedReviews.length,
            bestRating: "5",
            worstRating: "1",
          },
        }),
      }
    : null;

  const breadcrumbSchema = slug
    ? generateBreadcrumbStructuredData([
        { name: "Home", url: BASE_URL },
        { name: "Products", url: `${BASE_URL}/products` },
        { name: productData?.title ?? "Product", url: canonicalUrl },
      ])
    : null;

  return (
    <Helmet>
      <title>{seoMeta.title}</title>

      {seoMeta.description && (
        <meta name="description" content={seoMeta.description} />
      )}

      <link rel="canonical" href={canonicalUrl} />

      {/* Open Graph */}
      <meta property="og:type" content="product" />
      <meta property="og:title" content={seoMeta.title} />
      <meta property="og:description" content={seoMeta.description} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:image" content={seoMeta.image} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:site_name" content="GoSkinly" />

      {/* Product OG */}
      <meta property="product:price:amount" content={cheapestPrice.toString()} />
      <meta property="product:price:currency" content="INR" />
      {isInStock && <meta property="product:availability" content="in stock" />}

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={seoMeta.title} />
      <meta name="twitter:description" content={seoMeta.description} />
      <meta name="twitter:image" content={seoMeta.image} />
      <meta name="twitter:site" content="@goskinly" />

      {/* Product JSON-LD */}
      {productSchema && (
        <script type="application/ld+json">
          {JSON.stringify(productSchema)}
        </script>
      )}

      {/* BreadcrumbList JSON-LD */}
      {breadcrumbSchema && (
        <script type="application/ld+json">
          {JSON.stringify(breadcrumbSchema)}
        </script>
      )}
    </Helmet>
  );
}
