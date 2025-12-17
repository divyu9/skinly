import type { Doc } from "@/convex/_generated/dataModel.d.ts";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion.tsx";
import { Link } from "react-router-dom";
import { ShoppingCart, CheckCircle, Truck, Shield } from "lucide-react";
import { SiteHeader } from "@/components/site-header.tsx";
import { SiteFooter } from "@/components/site-footer.tsx";
import { GadgetSelector } from "@/components/gadget-selector.tsx";
import { PhoneBrandSelector } from "@/components/phone-brand-selector.tsx";
import { DeviceSelectorDialog } from "@/pages/_components/device-selector-dialog.tsx";
import { useState, useRef } from "react";

type DeviceType = "laptop" | "camera" | "lens" | "tablet" | "macmini" | "console" | "drone" | "charger";

interface ProductPageLayoutProps {
  page: Doc<"seoPages">;
}

export default function ProductPageLayout({ page }: ProductPageLayoutProps) {
  const products = useQuery(api.products.getAllProducts, {});
  const template = useQuery(api.seoTemplates.getTemplateByType, { pageType: "product" });
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogDeviceType, setDialogDeviceType] = useState<DeviceType | undefined>(undefined);
  const phoneBrandSelectorRef = useRef<HTMLDivElement>(null);
  
  const openDialogForDevice = (deviceType: DeviceType) => {
    setDialogDeviceType(deviceType);
    setDialogOpen(true);
  };
  
  const scrollToPhoneBrandSelector = () => {
    phoneBrandSelectorRef.current?.scrollIntoView({ 
      behavior: 'smooth',
      block: 'start'
    });
  };

  // Try to find a specific product match
  const featuredProduct = products?.find((p: Doc<"products">) => 
    page.h1Heading.toLowerCase().includes(p.title.toLowerCase()) ||
    p.title.toLowerCase().includes(page.h1Heading.toLowerCase())
  );

  // Get related/similar products
  const relatedProducts = products?.filter((p: Doc<"products">) => 
    p._id !== featuredProduct?._id
  ).slice(0, 4) || [];

  // Section renderers
  const renderHero = () => (
    <section className="bg-gradient-to-br from-primary/5 via-background to-accent/5 border-b">
      <div className="container mx-auto px-4 py-12 md:py-20">
        <div className="grid lg:grid-cols-2 gap-12 items-center max-w-6xl mx-auto">
          <div className="order-2 lg:order-1">
            <h1 className="text-4xl md:text-5xl font-bold mb-6 text-balance">
              {page.h1Heading}
            </h1>
            <p className="text-xl text-muted-foreground mb-8">
              {page.metaDescription}
            </p>
            
            {featuredProduct && (
              <div className="mb-8">
                <p className="text-3xl font-bold text-primary mb-4">
                  ₹{featuredProduct.variants?.[0]?.price?.toFixed(2) || "N/A"}
                </p>
                <div className="flex flex-wrap gap-3">
                  <Button size="lg" asChild>
                    <Link to={`/products/detail?id=${featuredProduct._id}`}>
                      <ShoppingCart className="mr-2 h-5 w-5" />
                      View Product
                    </Link>
                  </Button>
                  <Button size="lg" variant="outline" asChild>
                    <Link to="/products">Browse More</Link>
                  </Button>
                </div>
              </div>
            )}

            {!featuredProduct && (
              <Button size="lg" asChild>
                <Link to="/products">Shop Now</Link>
              </Button>
            )}
          </div>
          
          <div className="order-1 lg:order-2">
            {featuredProduct?.images?.[0]?.url ? (
              <img
                src={featuredProduct.images[0].url}
                alt={featuredProduct.images[0].alt || featuredProduct.title}
                className="w-full max-w-lg mx-auto rounded-2xl shadow-2xl"
              />
            ) : (
              <div className="aspect-square bg-muted rounded-2xl flex items-center justify-center max-w-lg mx-auto">
                <ShoppingCart className="h-24 w-24 text-muted-foreground" />
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );

  const renderFeatures = () => (
    <section className="container mx-auto px-4 py-12 md:py-16">
      <h2 className="text-3xl font-bold mb-8 text-center">Why Choose This Product?</h2>
      <div className="grid md:grid-cols-4 gap-6 max-w-5xl mx-auto">
        <div className="text-center">
          <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
            <CheckCircle className="h-7 w-7 text-primary" />
          </div>
          <h3 className="font-semibold mb-1">Premium Quality</h3>
          <p className="text-sm text-muted-foreground">High-grade materials</p>
        </div>
        <div className="text-center">
          <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
            <Shield className="h-7 w-7 text-primary" />
          </div>
          <h3 className="font-semibold mb-1">Full Protection</h3>
          <p className="text-sm text-muted-foreground">Scratch resistant</p>
        </div>
        <div className="text-center">
          <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
            <Truck className="h-7 w-7 text-primary" />
          </div>
          <h3 className="font-semibold mb-1">Fast Shipping</h3>
          <p className="text-sm text-muted-foreground">Quick delivery</p>
        </div>
        <div className="text-center">
          <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
            <CheckCircle className="h-7 w-7 text-primary" />
          </div>
          <h3 className="font-semibold mb-1">Easy Returns</h3>
          <p className="text-sm text-muted-foreground">Hassle-free policy</p>
        </div>
      </div>
    </section>
  );

  const renderContent = () => (
    <section className="bg-muted/30 border-y">
      <div className="container mx-auto px-4 py-12 md:py-16">
        <div className="max-w-4xl mx-auto">
          <div
            className="prose prose-lg dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: page.contentHTML }}
          />
        </div>
      </div>
    </section>
  );

  const renderProducts = () => relatedProducts.length > 0 && (
    <section className="container mx-auto px-4 py-12 md:py-16">
      <h2 className="text-3xl font-bold mb-8 text-center">You May Also Like</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
        {relatedProducts.map((product) => (
          <Link
            key={product._id}
            to={`/products/detail?id=${product._id}`}
            className="group"
          >
            <Card className="overflow-hidden h-full hover:shadow-lg transition-shadow">
              <div className="aspect-square overflow-hidden bg-muted">
                <img
                  src={product.images?.[0]?.url || "/placeholder.svg"}
                  alt={product.images?.[0]?.alt || product.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <CardContent className="p-4">
                <h3 className="font-semibold line-clamp-2 mb-2">{product.title}</h3>
                <p className="text-lg font-bold text-primary">₹{product.variants?.[0]?.price?.toFixed(2) || "N/A"}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );

  const renderFaqs = () => page.faqs && page.faqs.length > 0 && (
    <section className="bg-muted/30 border-y">
      <div className="container mx-auto px-4 py-12 md:py-16">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold mb-8 text-center">Frequently Asked Questions</h2>
          <Accordion type="single" collapsible className="w-full">
            {page.faqs.map((faq, index) => (
              <AccordionItem key={index} value={`item-${index}`}>
                <AccordionTrigger className="text-left">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );

  // Section mapper
  const sectionComponents: Record<string, () => React.ReactNode> = {
    "hero": renderHero,
    "gadget-selector": () => <GadgetSelector onDeviceSelect={openDialogForDevice} onPhoneSelect={scrollToPhoneBrandSelector} />,
    "phone-brand-selector": () => <div ref={phoneBrandSelectorRef}><PhoneBrandSelector /></div>,
    "features": renderFeatures,
    "products": renderProducts,
    "comparison": renderContent,
    "faqs": renderFaqs,
  };

  // Get enabled sections in order
  const sections = template?.layoutConfig.sections
    .filter(s => s.enabled)
    .sort((a, b) => a.order - b.order) || [];

  return (
    <>
      <SiteHeader />
      <div className="min-h-screen bg-background">
        {sections.map((section) => {
          const Component = sectionComponents[section.id];
          return Component ? <div key={section.id}>{Component()}</div> : null;
        })}
      </div>
      <SiteFooter />
      <DeviceSelectorDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initialDeviceType={dialogDeviceType}
      />
    </>
  );
}
