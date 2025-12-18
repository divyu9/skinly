import type { Doc } from "@/convex/_generated/dataModel.d.ts";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion.tsx";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { SiteHeader } from "@/components/site-header.tsx";
import { SiteFooter } from "@/components/site-footer.tsx";
import { GadgetSelector } from "@/components/gadget-selector.tsx";
import { PhoneBrandSelector } from "@/components/phone-brand-selector.tsx";
import { DeviceSelectorDialog } from "@/pages/_components/device-selector-dialog.tsx";
import { useState, useRef } from "react";

type DeviceType = "laptop" | "camera" | "lens" | "tablet" | "macmini" | "console" | "drone" | "charger";

interface KeywordPageLayoutProps {
  page: Doc<"seoPages">;
}

export default function KeywordPageLayout({ page }: KeywordPageLayoutProps) {
  // Fetch featured products if any
  const products = useQuery(api.products.getAllProducts, {});
  
  // Fetch template for this page type to determine section order and visibility
  const template = useQuery(api.seoTemplates.getTemplateByType, { pageType: "keyword" });
  
  // Device selector dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogDeviceType, setDialogDeviceType] = useState<DeviceType | undefined>(undefined);
  
  // Refs for scrolling
  const phoneBrandSelectorRef = useRef<HTMLDivElement>(null);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  
  // Function to open dialog with specific device type
  const openDialogForDevice = (deviceType: DeviceType) => {
    setDialogDeviceType(deviceType);
    setDialogOpen(true);
  };
  
  // Function to scroll to phone brand selector
  const scrollToPhoneBrandSelector = () => {
    phoneBrandSelectorRef.current?.scrollIntoView({ 
      behavior: 'smooth',
      block: 'start'
    });
  };
  
  // Get enabled sections sorted by order - prioritize page overrides, fallback to global template
  const enabledSections = (page.layoutOverrides?.sections || template?.layoutConfig.sections || [])
    .filter(section => section.enabled)
    .sort((a, b) => a.order - b.order);
  
  // Helper to check if a section is enabled
  const isSectionEnabled = (sectionId: string) => {
    return enabledSections.some(s => s.id === sectionId);
  };
  
  // Render section by ID
  const renderSection = (sectionId: string) => {
    switch (sectionId) {
      case "hero":
        return (
          <section key={sectionId} className="relative border-b overflow-hidden">
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
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-background" />
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
                  {page.metaDescription.length > 160 && (
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
                    <Link to="/products">
                      Shop Now <ArrowRight className="ml-2 h-5 w-5" />
                    </Link>
                  </Button>
                  <Button size="lg" variant="outline" asChild>
                    <Link to="/devices">Find Your Device</Link>
                  </Button>
                </div>
              </div>
            </div>
          </section>
        );
      
      case "gadget-selector":
        return (
          <GadgetSelector 
            key={sectionId}
            onDeviceSelect={openDialogForDevice}
            onPhoneSelect={scrollToPhoneBrandSelector}
          />
        );
      
      case "phone-brand-selector":
        return (
          <div key={sectionId} ref={phoneBrandSelectorRef}>
            <PhoneBrandSelector />
          </div>
        );
      
      case "content":
        return (
          <section key={sectionId} className="container mx-auto px-4 py-12 md:py-16">
            <div className="max-w-4xl mx-auto">
              <div
                className="prose prose-lg dark:prose-invert max-w-none mb-12"
                dangerouslySetInnerHTML={{ __html: page.contentHTML }}
              />
            </div>
          </section>
        );
      
      case "products":
        if (!products || products.length === 0) return null;
        return (
          <section key={sectionId} className="bg-muted/30 border-y">
            <div className="container mx-auto px-4 py-12 md:py-16">
              <h2 className="text-3xl font-bold mb-8 text-center">Featured Products</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
                {products.slice(0, 8).map((product) => (
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
      
      case "faqs":
        if (!page.faqs || page.faqs.length === 0) return null;
        return (
          <section key={sectionId} className="container mx-auto px-4 py-12 md:py-16">
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
      
      case "cta":
        return (
          <section key={sectionId} className="bg-gradient-to-br from-primary/10 via-background to-background py-16 px-4">
            <div className="container mx-auto text-center max-w-3xl">
              <h2 className="text-3xl font-bold mb-4">Ready to Transform Your Device?</h2>
              <p className="text-xl text-muted-foreground mb-8">
                Browse our collection and find the perfect skin for your device
              </p>
              <div className="flex flex-wrap gap-4 justify-center">
                <Button size="lg" asChild>
                  <Link to="/products">Shop Now</Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link to="/devices">Browse Devices</Link>
                </Button>
              </div>
            </div>
          </section>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <SiteHeader 
        onGadgetSelectorClick={() => setDialogOpen(true)}
        onPhoneSelectorClick={scrollToPhoneBrandSelector}
      />
      
      {/* Device Selector Dialog */}
      <DeviceSelectorDialog 
        open={dialogOpen} 
        onOpenChange={setDialogOpen}
        initialDeviceType={dialogDeviceType}
      />
      
      {/* Render sections dynamically based on template configuration */}
      {enabledSections.map(section => renderSection(section.id))}
      
      {/* Footer */}
      <SiteFooter />
    </div>
  );
}
