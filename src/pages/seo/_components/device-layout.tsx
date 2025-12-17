import type { Doc } from "@/convex/_generated/dataModel.d.ts";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion.tsx";
import { Link } from "react-router-dom";
import { Smartphone, Shield, Sparkles } from "lucide-react";

interface DevicePageLayoutProps {
  page: Doc<"seoPages">;
}

export default function DevicePageLayout({ page }: DevicePageLayoutProps) {
  const products = useQuery(api.products.getAllProducts, {});

  // Filter products by device model (based on title since phone models not in query result)
  const deviceProducts = products?.filter((p: Doc<"products">) => 
    page.h1Heading.toLowerCase().includes(p.title.toLowerCase()) ||
    p.title.toLowerCase().includes(page.h1Heading.toLowerCase())
  ) || [];

  const displayProducts = deviceProducts.length > 0 ? deviceProducts : products?.slice(0, 12) || [];

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section with Device Focus */}
      <section className="relative bg-gradient-to-br from-primary/10 via-background to-accent/5 border-b overflow-hidden">
        <div className="container mx-auto px-4 py-16 md:py-24">
          <div className="grid lg:grid-cols-2 gap-12 items-center max-w-6xl mx-auto">
            <div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 text-balance">
                {page.h1Heading}
              </h1>
              <p className="text-xl text-muted-foreground mb-8">
                {page.metaDescription}
              </p>
              <div className="flex flex-wrap gap-4">
                <Button size="lg" asChild>
                  <Link to="/products">Shop Skins</Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link to="/devices">Explore Devices</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Key Features */}
      <section className="container mx-auto px-4 py-12 md:py-16">
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          <div className="text-center">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Shield className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Perfect Fit</h3>
            <p className="text-muted-foreground">
              Precision-cut skins designed specifically for your device model
            </p>
          </div>
          <div className="text-center">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Premium Quality</h3>
            <p className="text-muted-foreground">
              High-quality materials that protect and enhance your device
            </p>
          </div>
          <div className="text-center">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Smartphone className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Easy Application</h3>
            <p className="text-muted-foreground">
              Bubble-free installation with easy-to-follow instructions
            </p>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="container mx-auto px-4 py-12 md:py-16 bg-muted/30">
        <div className="max-w-4xl mx-auto">
          <div
            className="prose prose-lg dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: page.contentHTML }}
          />
        </div>
      </section>

      {/* Products for This Device */}
      {displayProducts.length > 0 && (
        <section className="container mx-auto px-4 py-12 md:py-16">
          <h2 className="text-3xl font-bold mb-8 text-center">
            Skins for {page.h1Heading.replace(/Skins for |Phone Skins for /i, "")}
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
      )}

      {/* FAQs */}
      {page.faqs && page.faqs.length > 0 && (
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
      )}
    </div>
  );
}
