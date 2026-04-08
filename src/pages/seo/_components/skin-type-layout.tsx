import type { Doc } from "@/lib/firebase-api";
import { useQuery } from "@/lib/firebase-hooks";
import { api } from "@/lib/firebase-api";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion.tsx";
import { Link } from "react-router-dom";
import { Palette, Star, Shield } from "lucide-react";
import { SiteHeader } from "@/components/site-header.tsx";
import { SiteFooter } from "@/components/site-footer.tsx";
import { GadgetSelector } from "@/components/gadget-selector.tsx";
import { PhoneBrandSelector } from "@/components/phone-brand-selector.tsx";
import { DeviceSelectorDialog } from "@/pages/_components/device-selector-dialog.tsx";
import { useState, useRef } from "react";

type DeviceType = "laptop" | "camera" | "lens" | "tablet" | "macmini" | "console" | "drone" | "charger";

interface SkinTypePageLayoutProps {
  page: Doc<"seoPages">;
}

export default function SkinTypePageLayout({ page }: SkinTypePageLayoutProps) {
  const products = useQuery(api.products.getAllProducts, {});
  const template = useQuery(api.seoTemplates.getTemplateByType, { pageType: "skin-type" });
  
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

  // Extract skin type from heading (e.g., "Matte", "Glossy", "Carbon Fiber")
  const skinType = (page.h1Heading || page.title || "").replace(/Skins|Phone Skins/gi, "").trim();

  // Filter products by variant/finish (show all for now since variant filtering is complex)
  const skinTypeProducts = products?.filter((p: Doc<"products">) => 
    (p.title || "").toLowerCase().includes(skinType.toLowerCase())
  ) || [];

  const displayProducts = skinTypeProducts.length > 0 ? skinTypeProducts : products?.slice(0, 12) || [];

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
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-secondary/10" />
      )}
      
      {/* Hero Content */}
      <div className="relative container mx-auto px-4 py-16 md:py-24">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 text-balance">
            {page.h1Heading}
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            {page.metaDescription}
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Button size="lg" asChild>
              <Link to="/products">Shop {skinType} Skins</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/devices">Browse by Device</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );

  const renderBenefits = () => (
    <section className="container mx-auto px-4 py-12 md:py-16">
      <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
        <div className="text-center">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Palette className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-xl font-semibold mb-2">Unique Style</h3>
          <p className="text-muted-foreground">
            Stand out with distinctive {skinType.toLowerCase()} finish
          </p>
        </div>
        <div className="text-center">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-xl font-semibold mb-2">Full Protection</h3>
          <p className="text-muted-foreground">
            Guards against scratches, dust, and daily wear
          </p>
        </div>
        <div className="text-center">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Star className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-xl font-semibold mb-2">Premium Quality</h3>
          <p className="text-muted-foreground">
            High-grade materials that maintain their look over time
          </p>
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

  const renderProducts = () => displayProducts.length > 0 && (
    <section className="container mx-auto px-4 py-12 md:py-16">
      <h2 className="text-3xl font-bold mb-8 text-center">
        Explore {skinType} Collection
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
    </section>
  );

  const renderFaqs = () => page.faqs && page.faqs.length > 0 && (
    <section className="bg-muted/30 border-y">
      <div className="container mx-auto px-4 py-12 md:py-16">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold mb-8 text-center">Common Questions</h2>
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
    "benefits": renderBenefits,
    "products": renderProducts,
    "guide": renderContent,
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
