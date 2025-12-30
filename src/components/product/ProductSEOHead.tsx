import { Helmet } from "react-helmet-async";

interface SeoMeta {
  title: string;
  description: string;
  url: string;
  image: string;
  price: number;
  isActive: boolean;
}

interface ProductData {
  _id: string;
  title: string;
  metaDescription?: string;
}

interface ProductSEOHeadProps {
  seoMeta: SeoMeta | null;
  productData?: ProductData | null;
  productImage: string;
  productUrl: string;
  productPrice: number;
}

export function ProductSEOHead({
  seoMeta,
  productData,
  productImage,
  productUrl,
  productPrice,
}: ProductSEOHeadProps) {
  if (!seoMeta) return null;
  
  return (
    <Helmet>
      <title>{seoMeta.title}</title>
      
      {seoMeta.description && (
        <meta name="description" content={seoMeta.description} />
      )}
      
      {/* Canonical URL */}
      <link rel="canonical" href={seoMeta.url} />
      
      {/* Open Graph Tags */}
      <meta property="og:type" content="product" />
      <meta property="og:title" content={seoMeta.title} />
      <meta property="og:description" content={seoMeta.description} />
      <meta property="og:url" content={seoMeta.url} />
      <meta property="og:image" content={seoMeta.image} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:site_name" content="Skinly" />
      
      {/* Product-specific OG tags */}
      <meta property="product:price:amount" content={seoMeta.price.toString()} />
      <meta property="product:price:currency" content="INR" />
      {seoMeta.isActive && (
        <meta property="product:availability" content="in stock" />
      )}
      
      {/* Twitter Card Tags */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={seoMeta.title} />
      <meta name="twitter:description" content={seoMeta.description} />
      <meta name="twitter:image" content={seoMeta.image} />
      <meta name="twitter:site" content="@goskinly" />
      
      {/* Structured Data */}
      {productData && (
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org/",
            "@type": "Product",
            name: productData.title,
            image: [productImage],
            description: productData.metaDescription || `Shop ${productData.title} at Skinly.`,
            sku: productData._id,
            brand: {
              "@type": "Brand",
              name: "Skinly",
            },
            offers: {
              "@type": "Offer",
              url: productUrl,
              priceCurrency: "INR",
              price: productPrice,
              availability: seoMeta.isActive
                ? "https://schema.org/InStock"
                : "https://schema.org/OutOfStock",
            },
          })}
        </script>
      )}
    </Helmet>
  );
}
