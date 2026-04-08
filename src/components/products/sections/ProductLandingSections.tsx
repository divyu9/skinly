import { useQuery } from "@/lib/firebase-hooks";
import { api } from "@/lib/firebase-api";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { cn } from "@/lib/utils.ts";
import { ArrowRight } from "lucide-react";
import type { Id } from "@/lib/firebase-api";
import { sanitizeHtml } from "@/lib/sanitize-html";

interface ProductLandingSectionsProps {
  productId: Id<"products">;
}

type SectionType = "hero" | "feature-left" | "feature-right" | "full-width" | "specs";

interface SectionContent {
  _id: Id<"productSectionContent">;
  sectionType: SectionType;
  title: string;
  descriptionHtml: string;
  imageUrl?: string;
  ctaText?: string;
  ctaLink?: string;
  order: number;
}

export function ProductLandingSections({ productId }: ProductLandingSectionsProps) {
  const sections = useQuery(api.productSections.getProductSectionContent, { productId });

  // Don't render anything if no sections
  if (sections === undefined) {
    return <LandingSectionsSkeleton />;
  }

  if (sections.length === 0) {
    return null;
  }

  return (
    <div className="space-y-0">
      {sections.map((section) => (
        <LandingSection key={section._id} section={section as SectionContent} />
      ))}
    </div>
  );
}

function LandingSection({ section }: { section: SectionContent }) {
  switch (section.sectionType) {
    case "hero":
      return <HeroSection section={section} />;
    case "feature-left":
      return <FeatureSection section={section} imagePosition="left" />;
    case "feature-right":
      return <FeatureSection section={section} imagePosition="right" />;
    case "full-width":
      return <FullWidthSection section={section} />;
    case "specs":
      return <SpecsSection section={section} />;
    default:
      return null;
  }
}

// Hero Section - Large image with centered text overlay
function HeroSection({ section }: { section: SectionContent }) {
  return (
    <section className="relative py-16 md:py-24 overflow-hidden bg-gradient-to-b from-muted/50 to-background">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight">
            {section.title}
          </h2>
          <div
            className="text-lg md:text-xl text-muted-foreground prose prose-lg max-w-none"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(section.descriptionHtml) }}
          />
          {section.imageUrl && (
            <div className="mt-8 md:mt-12">
              <img
                src={section.imageUrl}
                alt={section.title}
                className="w-full max-w-3xl mx-auto rounded-2xl shadow-2xl"
                loading="lazy"
              />
            </div>
          )}
          {section.ctaText && section.ctaLink && (
            <div className="pt-4">
              <Button asChild size="lg" className="rounded-full px-8">
                <Link to={section.ctaLink}>
                  {section.ctaText}
                  <ArrowRight className="ml-2 size-4" />
                </Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

// Feature Section - Image on one side, text on the other (Apple-style)
function FeatureSection({
  section,
  imagePosition,
}: {
  section: SectionContent;
  imagePosition: "left" | "right";
}) {
  return (
    <section className="py-12 md:py-20">
      <div className="container mx-auto px-4">
        <div
          className={cn(
            "grid md:grid-cols-2 gap-8 md:gap-16 items-center",
            imagePosition === "right" && "md:[&>*:first-child]:order-2"
          )}
        >
          {/* Image */}
          {section.imageUrl && (
            <div className="relative">
              <img
                src={section.imageUrl}
                alt={section.title}
                className="w-full rounded-2xl shadow-xl"
                loading="lazy"
              />
            </div>
          )}

          {/* Content */}
          <div className="space-y-6">
            <h2 className="text-2xl md:text-4xl font-bold tracking-tight">
              {section.title}
            </h2>
            <div
              className="text-base md:text-lg text-muted-foreground prose prose-base md:prose-lg max-w-none"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(section.descriptionHtml) }}
            />
            {section.ctaText && section.ctaLink && (
              <Button asChild variant="outline" size="lg" className="rounded-full">
                <Link to={section.ctaLink}>
                  {section.ctaText}
                  <ArrowRight className="ml-2 size-4" />
                </Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

// Full-Width Section - Full-width image with overlay text
function FullWidthSection({ section }: { section: SectionContent }) {
  return (
    <section className="relative py-20 md:py-32 overflow-hidden">
      {/* Background Image */}
      {section.imageUrl && (
        <div className="absolute inset-0">
          <img
            src={section.imageUrl}
            alt={section.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-black/60" />
        </div>
      )}

      {/* Content */}
      <div className="relative container mx-auto px-4 text-center text-white">
        <div className="max-w-3xl mx-auto space-y-6">
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight">
            {section.title}
          </h2>
          <div
            className="text-lg md:text-xl opacity-90 prose prose-lg prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(section.descriptionHtml) }}
          />
          {section.ctaText && section.ctaLink && (
            <div className="pt-4">
              <Button
                asChild
                size="lg"
                variant="secondary"
                className="rounded-full px-8"
              >
                <Link to={section.ctaLink}>
                  {section.ctaText}
                  <ArrowRight className="ml-2 size-4" />
                </Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

// Specs Section - Grid layout for specifications
function SpecsSection({ section }: { section: SectionContent }) {
  return (
    <section className="py-12 md:py-20 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl md:text-4xl font-bold tracking-tight text-center mb-8 md:mb-12">
            {section.title}
          </h2>
          <div
            className="prose prose-base md:prose-lg max-w-none [&_ul]:grid [&_ul]:md:grid-cols-2 [&_ul]:gap-4 [&_li]:bg-background [&_li]:p-4 [&_li]:rounded-xl [&_li]:shadow-sm [&_li]:border"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(section.descriptionHtml) }}
          />
          {section.ctaText && section.ctaLink && (
            <div className="text-center pt-8">
              <Button asChild variant="outline" size="lg" className="rounded-full">
                <Link to={section.ctaLink}>
                  {section.ctaText}
                  <ArrowRight className="ml-2 size-4" />
                </Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function LandingSectionsSkeleton() {
  return (
    <div className="space-y-12 py-12">
      {/* Hero skeleton */}
      <div className="container mx-auto px-4 text-center space-y-6">
        <Skeleton className="h-12 w-3/4 mx-auto" />
        <Skeleton className="h-6 w-2/3 mx-auto" />
        <Skeleton className="h-6 w-1/2 mx-auto" />
        <Skeleton className="aspect-video max-w-3xl mx-auto rounded-2xl" />
      </div>

      {/* Feature skeleton */}
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-2 gap-8 items-center">
          <Skeleton className="aspect-square rounded-2xl" />
          <div className="space-y-4">
            <Skeleton className="h-10 w-3/4" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-2/3" />
          </div>
        </div>
      </div>
    </div>
  );
}
