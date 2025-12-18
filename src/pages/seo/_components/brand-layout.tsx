import type { Doc } from "@/convex/_generated/dataModel.d.ts";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion.tsx";
import { Link } from "react-router-dom";
import { Sparkles, Package, Truck } from "lucide-react";
import { SiteHeader } from "@/components/site-header.tsx";
import { SiteFooter } from "@/components/site-footer.tsx";
import { GadgetSelector } from "@/components/gadget-selector.tsx";
import { PhoneBrandSelector } from "@/components/phone-brand-selector.tsx";
import { DeviceSelectorDialog } from "@/pages/_components/device-selector-dialog.tsx";
import { useState, useRef } from "react";

type DeviceType = "laptop" | "camera" | "lens" | "tablet" | "macmini" | "console" | "drone" | "charger";

interface BrandPageLayoutProps {
  page: Doc<"seoPages">;
}

export default function BrandPageLayout({ page }: BrandPageLayoutProps) {
  const products = useQuery(api.products.getAllProducts, {});
  const template = useQuery(api.seoTemplates.getTemplateByType, { pageType: "brand" });
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogDeviceType, setDialogDeviceType] = useState<DeviceType | undefined>(undefined);
  const phoneBrandSelectorRef = useRef<HTMLDivElement>(null);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  
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

  // Extract brand name from heading
  const brandName = page.h1Heading.replace(/Skins for |Phone Skins for |Skins/gi, "").trim();

  // Filter products by brand (based on title/tags since phone models not in query result)
  const brandProducts = products?.filter((p: Doc<"products">) => 
    p.title.toLowerCase().includes(brandName.toLowerCase()) ||
    p.tags?.some((tag: string) => tag.toLowerCase().includes(brandName.toLowerCase()))
  ) || [];

  const displayProducts = brandProducts.length > 0 ? brandProducts : products?.slice(0, 12) || [];

  // Section renderers
  const renderHero = () => (
    <section className="relative border-b overflow-hidden">
      {/* Hero Background - Image or Gradient */}
      {page.heroImageUrl ? (
        <>
          <div 
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: `url(${page.heroImageUrl})` }}
          />
          <div className="absolute inset-0 bg-gradient-to-br from-background/90 via-background/80 to-background/90" />
        </>
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-accent/20 via-background to-primary/5" />
      )}
      
      {/* Hero Content */}
      <div className="relative container mx-auto px-4 py-16 md:py-24">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 text-balance">
            {page.h1Heading}
          </h1>
          <div className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            <p>
              {isDescriptionExpanded 
                ? page.metaDescription 
                : page.metaDescription.length > 160 
                  ? `${page.metaDescription.substring(0, 160)}...` 
                  : page.metaDescription}
            </p>
            {page.metaDescription.length >= 150 && (
              <button
                onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                className="text-primary hover:underline mt-2 text-base font-medium"
              >
                {isDescriptionExpanded ? 'Show less' : 'Read more'}
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-4 justify-center">
            <Button size="lg" asChild>
              <Link to="/products">Browse Collection</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/devices">Find Your Device</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );

  const renderIntro = () => (
    <section className="container mx-auto px-4 py-12 md:py-16">
      <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto mb-12">
        <div className="text-center">
          <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Sparkles className="h-8 w-8 text-accent" />
          </div>
          <h3 className="text-xl font-semibold mb-2">Premium Materials</h3>
          <p className="text-muted-foreground">
            3M vinyl and high-grade materials for lasting protection
          </p>
        </div>
        <div className="text-center">
          <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Package className="h-8 w-8 text-accent" />
          </div>
          <h3 className="text-xl font-semibold mb-2">Perfect Fit</h3>
          <p className="text-muted-foreground">
            Precision-cut for all {brandName} models with exact cutouts
          </p>
        </div>
        <div className="text-center">
          <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Truck className="h-8 w-8 text-accent" />
          </div>
          <h3 className="text-xl font-semibold mb-2">Fast Shipping</h3>
          <p className="text-muted-foreground">
            Quick delivery across India with order tracking
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto">
        <div
          className="prose prose-lg dark:prose-invert max-w-none"
          dangerouslySetInnerHTML={{ __html: page.contentHTML }}
        />
      </div>
    </section>
  );

  const renderProducts = () => displayProducts.length > 0 && (
    <section className="bg-muted/30 border-y">
      <div className="container mx-auto px-4 py-12 md:py-16">
        <h2 className="text-3xl font-bold mb-8 text-center">
          Shop {brandName} Skins
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
          {displayProducts.map((product) => (
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
        <div className="text-center mt-8">
          <Button size="lg" variant="outline" asChild>
            <Link to="/products">View All Products</Link>
          </Button>
        </div>
      </div>
    </section>
  );

  const renderFaqs = () => page.faqs && page.faqs.length > 0 && (
    <section className="container mx-auto px-4 py-12 md:py-16">
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
    </section>
  );

  // Section mapper
  const sectionComponents: Record<string, () => React.ReactNode> = {
    "hero": renderHero,
    "gadget-selector": () => <GadgetSelector onDeviceSelect={openDialogForDevice} onPhoneSelect={scrollToPhoneBrandSelector} />,
    "phone-brand-selector": () => <div ref={phoneBrandSelectorRef}><PhoneBrandSelector /></div>,
    "intro": renderIntro,
    "products": renderProducts,
    "faqs": renderFaqs,
  };

  // Get enabled sections in order - prioritize page overrides, fallback to global template
  const sections = (page.layoutOverrides?.sections || template?.layoutConfig.sections || [])
    .filter(s => s.enabled)
    .sort((a, b) => a.order - b.order);

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
