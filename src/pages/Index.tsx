import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { AnnouncementBar } from "@/components/announcement-bar.tsx";
import { MobileHeader } from "@/components/mobile-header.tsx";
import { MobileNav } from "@/components/mobile-nav.tsx";
import { ModelsMarquee } from "@/components/models-marquee.tsx";
import { HeroSlider } from "@/components/hero-slider.tsx";
import { ExploreModels } from "@/components/explore-models.tsx";
import { CategoryExplorer } from "@/components/category-explorer.tsx";
import { TopPicks } from "@/components/top-picks.tsx";
import { WhySkinly } from "@/components/why-skinly.tsx";
import { FeatureBanner } from "@/components/feature-banner.tsx";
import { UgcVideos } from "@/components/ugc-videos.tsx";
import { SiteFooter } from "@/components/site-footer.tsx";
import { BugReportModal } from "@/components/bug-report-modal.tsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { toast } from "sonner";

export default function Index() {
  const [isRequestModelOpen, setIsRequestModelOpen] = useState(false);
  const [isBugReportOpen, setIsBugReportOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Request model form state
  const [requestBrand, setRequestBrand] = useState("");
  const [requestModel, setRequestModel] = useState("");
  const [requestCategory, setRequestCategory] = useState<string>("");
  const [requestPhone, setRequestPhone] = useState("");
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);

  const createModelRequest = useMutation(api.modelRequests.createModelRequest);

  const handleRequestModelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!requestBrand || !requestModel || !requestCategory || !requestPhone) {
      toast.error("Please fill in all fields");
      return;
    }

    setIsSubmittingRequest(true);
    try {
      await createModelRequest({
        brandName: requestBrand,
        modelName: requestModel,
        category: requestCategory,
        whatsappPhone: requestPhone,
      });
      
      toast.success("Request submitted! We'll notify you when it's available.");
      setIsRequestModelOpen(false);
      setRequestBrand("");
      setRequestModel("");
      setRequestCategory("");
      setRequestPhone("");
    } catch (error) {
      toast.error("Failed to submit request. Please try again.");
      console.error(error);
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  const handleMenuClick = () => {
    setIsMobileMenuOpen(true);
  };

  return (
    <>
      <Helmet>
        <title>Skinly - Premium Device Skins & Accessories</title>
        <meta name="description" content="Shop premium skins and accessories for your devices. High-quality materials, precise fit, and stunning designs." />
      </Helmet>

      {/* Announcement Bar */}
      <AnnouncementBar />

      {/* Mobile Header */}
      <MobileHeader 
        onMenuClick={handleMenuClick}
        onRequestModelClick={() => setIsRequestModelOpen(true)}
      />

      {/* Models Marquee - below header */}
      <div className="mt-16">
        <ModelsMarquee />
      </div>

      {/* Main Content */}
      <main className="min-h-screen">
        {/* Hero Slider */}
        <HeroSlider />

        {/* Category Explorer */}
        <CategoryExplorer />

        {/* Explore Models */}
        <ExploreModels onRequestModelClick={() => setIsRequestModelOpen(true)} />

        {/* Top Picks */}
        <TopPicks />

        {/* Feature Banner */}
        <FeatureBanner
          backgroundImage="https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=1920&h=800&fit=crop"
          heading="Premium Protection"
          subheading="Protect your device in style with our premium skins"
          ctaText="Shop Now"
          ctaLink="/products"
        />

        {/* Why Skinly */}
        <WhySkinly />

        {/* UGC Videos */}
        <UgcVideos />
      </main>

      {/* Footer */}
      <SiteFooter />

      {/* Mobile Navigation Sheet */}
      <MobileNav 
        open={isMobileMenuOpen}
        onOpenChange={setIsMobileMenuOpen}
      />

      {/* Request Model Dialog */}
      <Dialog open={isRequestModelOpen} onOpenChange={setIsRequestModelOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Request Your Model</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleRequestModelSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="request-brand">Brand Name *</Label>
              <Input
                id="request-brand"
                placeholder="e.g., Apple, Samsung, OnePlus"
                value={requestBrand}
                onChange={(e) => setRequestBrand(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="request-model">Model Name *</Label>
              <Input
                id="request-model"
                placeholder="e.g., iPhone 15 Pro Max, Galaxy S24 Ultra"
                value={requestModel}
                onChange={(e) => setRequestModel(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="request-category">Device Category *</Label>
              <Select value={requestCategory} onValueChange={setRequestCategory} required>
                <SelectTrigger id="request-category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="phone">Phone</SelectItem>
                  <SelectItem value="tablet">Tablet</SelectItem>
                  <SelectItem value="laptop">Laptop</SelectItem>
                  <SelectItem value="camera">Camera</SelectItem>
                  <SelectItem value="lens">Lens</SelectItem>
                  <SelectItem value="drone">Drone</SelectItem>
                  <SelectItem value="console">Gaming Console</SelectItem>
                  <SelectItem value="charger">Charger</SelectItem>
                  <SelectItem value="mac-mini">Mac Mini</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="request-phone">WhatsApp Number *</Label>
              <Input
                id="request-phone"
                type="tel"
                placeholder="e.g., 9876543210"
                value={requestPhone}
                onChange={(e) => setRequestPhone(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                We'll notify you on WhatsApp when your model is available
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsRequestModelOpen(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmittingRequest}
                className="flex-1"
              >
                {isSubmittingRequest ? "Submitting..." : "Submit Request"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Bug Report Modal */}
      <BugReportModal
        open={isBugReportOpen}
        onOpenChange={setIsBugReportOpen}
      />
    </>
  );
}
