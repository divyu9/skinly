import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button.tsx";

interface FeatureBannerProps {
  backgroundImage: string;
  heading: string;
  subheading?: string;
  ctaText?: string;
  ctaLink?: string;
}

export function FeatureBanner({
  backgroundImage,
  heading,
  subheading,
  ctaText,
  ctaLink
}: FeatureBannerProps) {
  return (
    <section className="container mx-auto px-4 py-12">
      <div className="relative w-full aspect-[16/7] md:aspect-[21/7] rounded-3xl overflow-hidden group">
        {/* Background Image */}
        <img
          src={backgroundImage}
          alt={heading}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-transparent" />
        
        {/* Content */}
        <div className="absolute inset-0 flex flex-col items-start justify-center p-8 md:p-16 max-w-2xl">
          <h2 className="text-3xl md:text-5xl lg:text-6xl font-bold text-white mb-4">
            {heading}
          </h2>
          
          {subheading && (
            <p className="text-lg md:text-xl text-white/90 mb-6">
              {subheading}
            </p>
          )}
          
          {ctaText && ctaLink && (
            <Button
              asChild
              size="lg"
              className="rounded-full px-8 text-base shadow-2xl hover:scale-105 transition-transform"
            >
              <Link to={ctaLink}>
                {ctaText}
              </Link>
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
