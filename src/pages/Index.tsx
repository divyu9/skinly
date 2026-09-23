import { useState, useEffect, useRef, lazy, Suspense } from "react";
import { Helmet } from "react-helmet-async";
import { AnnouncementBar } from "@/components/announcement-bar.tsx";
import { MobileHeader } from "@/components/mobile-header.tsx";
import { HeroSlider } from "@/components/hero-slider.tsx";
import { CategoryExplorer } from "@/components/category-explorer.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { DeviceSelectorDialog } from "@/pages/_components/device-selector-dialog.tsx";

// Lazy load below-the-fold and modal components for better FCP/LCP
const MobileNav = lazy(() => import("@/components/mobile-nav.tsx").then(m => ({ default: m.MobileNav })));
const ModelsMarquee = lazy(() => import("@/components/models-marquee.tsx").then(m => ({ default: m.ModelsMarquee })));
const ExploreModels = lazy(() => import("@/components/explore-models.tsx").then(m => ({ default: m.ExploreModels })));
const TopPicks = lazy(() => import("@/components/top-picks.tsx").then(m => ({ default: m.TopPicks })));
const MostTrendy = lazy(() => import("@/components/most-trendy.tsx").then(m => ({ default: m.MostTrendy })));
const ExploreByBrand = lazy(() => import("@/components/explore-by-brand.tsx").then(m => ({ default: m.ExploreByBrand })));
const ExploreByGadget = lazy(() => import("@/components/explore-by-gadget.tsx").then(m => ({ default: m.ExploreByGadget })));
const SiteFooter = lazy(() => import("@/components/site-footer.tsx").then(m => ({ default: m.SiteFooter })));
import { RequestModelDialog } from "@/components/request-model-dialog.tsx";
const BugReportModal = lazy(() => import("@/components/bug-report-modal.tsx").then(m => ({ default: m.BugReportModal })));
const WhySkinly = lazy(() => import("@/components/why-skinly").then(m => ({ default: m.WhySkinly })));
const FeatureBanner = lazy(() => import("@/components/feature-banner").then(m => ({ default: m.FeatureBanner })));
const UgcVideos = lazy(() => import("@/components/ugc-videos").then(m => ({ default: m.UgcVideos })));

// Loading fallback for lazy components
/**
 * Holds a lazy section's place at its real height, through every state.
 *
 * The reserve lives on a wrapper outside Suspense, not on the fallback, and
 * that distinction is the whole fix. Reserving only the fallback held the
 * height until the chunk arrived, then the component mounted, rendered its own
 * much shorter loading state while its data was still in flight, and the page
 * collapsed anyway — measured, `main` went 5456px, down to 3046px, back to
 * 4919px. A wrapper is mounted for all three and holds the floor.
 *
 * Heights were measured off the loaded page at 400px and 873px wide. They are
 * written as literal class strings at each call site because Tailwind's scanner
 * reads source text; assembled from a template it emits nothing at all.
 */
function LazySection({ reserve, children }: { reserve: string; children: React.ReactNode }) {
  /*
   * Mounted when it is about to be seen, not before.
   *
   * "Lazy" here only ever meant the code was split: every section still
   * mounted on the first render, so each one fetched its chunk, its Firestore
   * data and its pictures while the hero was loading. Lighthouse counted 2.3 MB
   * on the wire before the hero finished on a throttled phone — the customer
   * videos' thumbnails from the old host, the trendy cards, the full product
   * catalogue for the brand badges — which is why the hero took 7.5 seconds
   * to arrive. A section now waits until it is within a screen or so of view.
   * The reserved height is held throughout, so nothing below it moves.
   */
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  // Until the page has loaded, only a section actually on screen mounts; the
  // screen-ahead margin applies after that. With the margin from the start,
  // sections under the fold fetched their pictures while the hero, the
  // page's largest paint, was still arriving.
  const loaded = usePageLoaded();
  useEffect(() => {
    const el = ref.current;
    if (!el || near) return;
    if (!("IntersectionObserver" in window)) { setNear(true); return; }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { setNear(true); io.disconnect(); }
    }, { rootMargin: loaded ? "600px 0px" : "0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [near, loaded]);
  return (
    <div ref={ref} className={reserve}>
      {near ? <Suspense fallback={<SectionSkeleton />}>{children}</Suspense> : <SectionSkeleton />}
    </div>
  );
}

function SectionSkeleton() {
  return (
    <div className="container mx-auto space-y-4 px-4 py-12">
      <Skeleton className="mx-auto h-10 w-64" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}
import { Button } from "@/components/ui/button.tsx";
import { usePageLoaded } from "@/hooks/use-page-loaded";
import { useQuery } from "@/lib/firebase-hooks";
import { api } from "@/lib/firebase-api";
import { toast } from "sonner";
import { announcementLikelyShown, rememberAnnouncementShown } from "@/lib/announcement-dismissed.ts";


const HOME_ORGANIZATION_LD = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "GoSkinly",
  url: "https://goskinly.com",
  logo: "https://goskinly.com/logo.webp",
  description: "Vinyl skins cut to fit 1000+ phones, laptops, consoles, cameras and more.",
};

const HOME_WEBSITE_LD = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "GoSkinly",
  url: "https://goskinly.com",
  potentialAction: {
    "@type": "SearchAction",
    target: { "@type": "EntryPoint", urlTemplate: "https://goskinly.com/products?search={search_term_string}" },
    "query-input": "required name=search_term_string",
  },
};

export default function Index() {
  const [isRequestModelOpen, setIsRequestModelOpen] = useState(false);
  const [isBugReportOpen, setIsBugReportOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDeviceSelectorOpen, setIsDeviceSelectorOpen] = useState(false);

  // Request model form state
  const [requestBrand, setRequestBrand] = useState("");
  const [requestCategory, setRequestCategory] = useState<string>("");

  
  // Get homepage sections to render dynamically
  const homepageSections = useQuery(api.homepage.getActiveHomepageSections);
  
  // Get homepage settings to determine header height
  const homepageSettings = useQuery(api.homepage.getHomepageSettings);
  /*
   * The offset the fixed header and announcement bar need underneath them.
   *
   * `?? false` meant every cold load began at 64 and moved to 92 once the
   * settings query answered — 28px, applied to a margin above everything on
   * the page, so the whole document jumped. That was the last 0.043 of the
   * homepage's layout shift after the UGC skeleton was fixed.
   *
   * Assume what was true on the last visit instead, which the header already
   * does for the same reason. A first-ever visitor assumes the bar is on: it
   * usually is, and guessing wrong costs one 28px shift rather than one on
   * every load forever.
   */
  const announcementOn = homepageSettings !== undefined
    ? !!homepageSettings.announcementEnabled
    : announcementLikelyShown();
  useEffect(() => {
    if (homepageSettings !== undefined) {
      rememberAnnouncementShown(!!homepageSettings.announcementEnabled);
    }
  }, [homepageSettings]);

  const headerOffset = announcementOn ? 92 : 64; // 28px announcement + 64px header
  
  // Sort sections by order for dynamic rendering
  const sortedActiveSections = homepageSections?.sort((a, b) => a.order - b.order) || [];
  
  // Helper to render section by type
  const renderSection = (section: typeof sortedActiveSections[0]) => {
    const key = section._id;

    switch (section.sectionType) {
      case "hero_slides":
        // Hero slider is critical for LCP - keep it eager.
        //
        // The page's h1 rides with it. The homepage had no h1 at all — the
        // highest-authority page on the site stated no heading, so screen
        // readers got no landmark and search engines fell back to the title
        // tag for a page we would otherwise control. Kept small and set above
        // the slider rather than hidden, because a heading worth having is one
        // a visitor can read too.
        return (
          <div key={key}>
            <h1 className="container mx-auto px-4 pt-4 text-center text-[15px] font-bold tracking-tight text-muted-foreground sm:text-base">
              Quirky skins &amp; accessories for every gadget you own
            </h1>
            <HeroSlider />
          </div>
        );

      case "models_marquee":
        return null; // Already rendered above header

      case "explore_models":
        return (
          <LazySection key={key} reserve="min-h-[208px] md:min-h-[252px]">
            <ExploreModels onRequestModelClick={() => setIsRequestModelOpen(true)} />
          </LazySection>
        );

      case "category_explorer":
        // Category explorer is above the fold - keep it eager
        return <CategoryExplorer key={key} onRequestModel={handleRequestModel} />;

      case "top_picks":
        return (
          <LazySection key={key} reserve="min-h-[784px] md:min-h-[772px]">
            <TopPicks />
          </LazySection>
        );

      case "most_trendy":
        return (
          <LazySection key={key} reserve="min-h-[608px] md:min-h-[612px]">
            <MostTrendy
              sectionId={section._id}
              config={section.config as never}
            />
          </LazySection>
        );

      case "explore_by_brand":
        return (
          <LazySection key={key} reserve="min-h-[283px] md:min-h-[287px]">
            <ExploreByBrand
              sectionId={section._id}
              config={section.config as never}
            />
          </LazySection>
        );

      case "explore_by_gadget":
        return (
          <LazySection key={key} reserve="min-h-[508px] md:min-h-[512px]">
            <ExploreByGadget
              sectionId={section._id}
              config={section.config as never}
            />
          </LazySection>
        );

      case "why_skinly":
        return (
          <LazySection key={key} reserve="min-h-[387px] md:min-h-[413px]">
            <WhySkinly />
          </LazySection>
        );

      case "feature_banner":
        return (
          <LazySection key={key} reserve="min-h-[320px] md:min-h-[520px]">
            <FeatureBanner />
          </LazySection>
        );

      case "ugc_videos":
        return (
          <LazySection key={key} reserve="min-h-[742px] md:min-h-[706px]">
            <UgcVideos />
          </LazySection>
        );

      default:
        return null;
    }
  };


  const handleMenuClick = () => {
    setIsMobileMenuOpen(true);
  };

  const handleRequestModel = (category: string, brand: string) => {
    setRequestCategory(category);
    setRequestBrand(brand);
    setIsRequestModelOpen(true);
  };

  return (
    <>
      <Helmet>
        <title>GoSkinly - Premium Device Skins & Accessories | Starting ₹149</title>
        <meta name="description" content="Shop premium vinyl skins for phones, laptops, tablets & more. 1000+ models supported, each skin cut for your exact device. Free shipping above ₹499. Starting ₹149." />
        <link rel="canonical" href="https://goskinly.com/" />
        <meta property="og:type" content="website" />
        <meta property="og:title" content="GoSkinly - Premium Device Skins & Accessories | Starting ₹149" />
        <meta property="og:description" content="Shop premium vinyl skins for phones, laptops, tablets & more. 1000+ models supported, each skin cut for your exact device. Free shipping above ₹499. Starting ₹149." />
        <meta property="og:url" content="https://goskinly.com/" />
        <meta property="og:site_name" content="GoSkinly" />
        {/* Same objects scripts/prerender.mjs writes into the homepage HTML.
            Helmet replaces the prerendered tags when it mounts, so anything
            not repeated here disappears from the page Google renders. */}
        <script type="application/ld+json">{JSON.stringify(HOME_ORGANIZATION_LD)}</script>
        <script type="application/ld+json">{JSON.stringify(HOME_WEBSITE_LD)}</script>
      </Helmet>

      {/* Announcement Bar */}
      <AnnouncementBar />

      {/* Mobile Header */}
      <MobileHeader 
        onMenuClick={handleMenuClick}
        onRequestModelClick={() => setIsRequestModelOpen(true)}
      />

      {/* Models Marquee - below header */}
      {/* Padding, not margin. A top margin on this wrapper collapses straight
          out through `body`, so `body` itself is what moves — which is why the
          shift was recorded against BODY and why it counted the whole document
          as displaced. Padding creates the same gap without collapsing. */}
      <div style={{ paddingTop: `${headerOffset}px` }}>
        <Suspense fallback={<div className="h-[72px]" />}>
          <ModelsMarquee />
        </Suspense>
      </div>

      {/* Main Content */}
      <main className="halftone min-h-screen">
        {/* Dynamically render sections based on layout manager order */}
        {sortedActiveSections.map((section) => renderSection(section))}
      </main>

      {/* Footer */}
      <Suspense fallback={<div className="h-32" />}>
        <SiteFooter />
      </Suspense>

      {/* Mobile Navigation Sheet */}
      <Suspense fallback={null}>
        <MobileNav
          open={isMobileMenuOpen}
          onOpenChange={setIsMobileMenuOpen}
          onGadgetSelectorClick={() => setIsDeviceSelectorOpen(true)}
          onPhoneSelectorClick={() => setIsDeviceSelectorOpen(true)}
        />
      </Suspense>

      {/* Device Selector Dialog */}
      <DeviceSelectorDialog 
        open={isDeviceSelectorOpen}
        onOpenChange={setIsDeviceSelectorOpen}
      />

      {/* Request Model Dialog */}
      <RequestModelDialog
        open={isRequestModelOpen}
        onOpenChange={setIsRequestModelOpen}
        initialCategory={requestCategory}
        initialBrand={requestBrand}
      />

      {/* Bug Report Modal */}
      <Suspense fallback={null}>
        <BugReportModal
          open={isBugReportOpen}
          onOpenChange={setIsBugReportOpen}
        />
      </Suspense>
    </>
  );
}
