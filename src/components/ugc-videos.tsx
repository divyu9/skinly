import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Button } from "@/components/ui/button.tsx";
import { PlayCircleIcon, ShoppingBagIcon } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils.ts";

export function UgcVideos() {
  const videos = useQuery(api.homepage.getActiveUgcVideos);
  const [playingVideo, setPlayingVideo] = useState<string | null>(null);
  const navigate = useNavigate();

  // Loading state
  if (videos === undefined) {
    return (
      <section className="py-8 bg-background">
        <div className="container mx-auto px-4">
          <Skeleton className="h-8 w-48 mb-4" />
          <div className="flex gap-3 overflow-x-auto pb-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[400px] w-[280px] flex-shrink-0 rounded-2xl" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  // Don't render if no videos
  if (!videos || videos.length === 0) {
    return null;
  }

  const handleVideoClick = (videoId: string) => {
    setPlayingVideo(videoId === playingVideo ? null : videoId);
  };

  const handleCtaClick = (productId: string | undefined) => {
    if (productId) {
      navigate(`/products/${productId}`);
    }
  };

  return (
    <section className="py-12 bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <div className="mb-6">
          <h2 className="text-3xl font-bold text-foreground mb-2">
            Real Customers, Real Results
          </h2>
          <p className="text-muted-foreground">
            See how our customers are styling their devices
          </p>
        </div>

        {/* Videos Grid - Horizontal Scroll */}
        <div className="relative">
          <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide">
            {videos.map((video) => (
              <div
                key={video._id}
                className="relative flex-shrink-0 w-[280px] h-[480px] rounded-3xl overflow-hidden shadow-lg bg-card snap-start group"
              >
                {/* Video or Thumbnail */}
                <div className="relative w-full h-full">
                  {playingVideo === video._id && video.videoUrl ? (
                    <video
                      src={video.videoUrl}
                      className="w-full h-full object-cover"
                      controls
                      autoPlay
                      playsInline
                      loop
                    />
                  ) : (
                    <>
                      {/* Thumbnail Image */}
                      <div
                        className="absolute inset-0 bg-cover bg-center cursor-pointer"
                        style={{
                          backgroundImage: video.thumbnailUrl
                            ? `url(${video.thumbnailUrl})`
                            : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                        }}
                        onClick={() => handleVideoClick(video._id)}
                      >
                        {/* Dark overlay */}
                        <div className="absolute inset-0 bg-black/30 group-hover:bg-black/20 transition-colors" />
                      </div>

                      {/* Play Button Overlay */}
                      <button
                        onClick={() => handleVideoClick(video._id)}
                        className="absolute inset-0 flex items-center justify-center z-10"
                      >
                        <div className="bg-white/90 rounded-full p-4 shadow-2xl group-hover:scale-110 transition-transform">
                          <PlayCircleIcon className="w-12 h-12 text-primary" />
                        </div>
                      </button>
                    </>
                  )}

                  {/* Bottom Gradient Overlay for CTA */}
                  {video.productId && (
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-6 pt-16">
                      <Button
                        onClick={() => handleCtaClick(video.productId)}
                        className={cn(
                          "w-full bg-white text-black hover:bg-white/90",
                          "font-semibold shadow-xl"
                        )}
                      >
                        <ShoppingBagIcon className="w-4 h-4 mr-2" />
                        {video.ctaText || "Shop Now"}
                      </Button>
                    </div>
                  )}
                </div>

                {/* Instagram Badge (if from Instagram) */}
                {video.sourceType === "instagram" && (
                  <div className="absolute top-4 right-4 bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 rounded-full px-3 py-1 text-xs text-white font-medium shadow-lg">
                    Instagram
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Scroll Indicator */}
          {videos.length > 1 && (
            <div className="flex justify-center gap-1.5 mt-4">
              {videos.map((_, idx) => (
                <div
                  key={idx}
                  className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30"
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Custom CSS for hiding scrollbar */}
      <style>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </section>
  );
}
