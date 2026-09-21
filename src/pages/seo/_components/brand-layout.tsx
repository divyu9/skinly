import type { Doc } from "@/lib/firebase-api";
import { useQuery } from "@/lib/firebase-hooks";
import { api } from "@/lib/firebase-api";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion.tsx";
import { Link } from "react-router-dom";
import { Sparkles, Package, Truck } from "lucide-react";
import { SiteHeader } from "@/components/site-header.tsx";
import { SiteFooter } from "@/components/site-footer.tsx";
import { GadgetSelector, type DeviceType } from "@/components/gadget-selector.tsx";
import { PhoneBrandSelector } from "@/components/phone-brand-selector.tsx";
import { DeviceSelectorDialog } from "@/pages/_components/device-selector-dialog.tsx";
import { useState, useRef } from "react";
import { sanitizeHtml } from "@/lib/sanitize-html";
import type { SeoPageData } from "../use-seo-page-data";
import { SeoBrandGadgetsSection, SeoModelsSection, SeoProductsSection } from "./seo-sections.tsx";


interface BrandPageLayoutProps {
  page: Doc<"seoPages">;
  data?: SeoPageData;
}

export default function BrandPageLayout({ page, data }: BrandPageLayoutProps) {
  const template = useQuery(api.seoTemplates.getTemplateByType, { pageType: "brand" });
  
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

  // Extract brand name from heading
  const brandName = (page.h1Heading || page.title || "").replace(/Skins for |Phone Skins for |Skins/gi, "").trim();


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
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            {data?.description || page.metaDescription}
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Button size="lg" asChild>
              <Link to={data?.listing || "/products"}>Browse Collection</Link>
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
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(page.contentHTML) }}
        />
      </div>
    </section>
  );

  const renderProducts = () => (
    <>
      <SeoProductsSection data={data} heading={`Shop ${brandName} skins`} />
      {data && ["brand", "family", "unlisted", "model"].includes(data.target.kind) && <SeoModelsSection data={data} />}
    </>
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
    "gadget-selector": () => <GadgetSelector onDeviceSelect={openDialogForDevice} />,
    // On a page about one brand, the hub of that brand's own gadgets is what
    // belongs here; the grid of every other brand sends the reader away.
    "phone-brand-selector": () =>
      data?.target?.brand
        ? <SeoBrandGadgetsSection data={data} />
        : <div ref={phoneBrandSelectorRef}><PhoneBrandSelector /></div>,
    "intro": renderIntro,
    "products": renderProducts,
    "faqs": renderFaqs,
  };

  // Get enabled sections in order - prioritize page overrides, fallback to global template
  type Section = { id: string; enabled: boolean; order: number };
  const configured: Section[] = (page.layoutOverrides?.sections || template?.layoutConfig.sections || [])
    .filter((s: Section) => s.enabled)
    .sort((a: Section, b: Section) => a.order - b.order);
  // The products are the point of the page: always on, and straight after the
  // hero rather than below the generated copy, where the templates had them.
  const rest = configured.filter((s) => s.id !== "products");
  const heroFirst = rest[0]?.id === "hero";
  const productsSection: Section = { id: "products", enabled: true, order: 0 };
  const sections: Section[] = heroFirst
    ? [rest[0], productsSection, ...rest.slice(1)]
    : [productsSection, ...rest];

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
