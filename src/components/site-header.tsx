import { Link, useNavigate } from "react-router-dom";
import { SignInButton, useUser } from "@clerk/clerk-react";
import { UserIcon } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { MobileNav } from "./mobile-nav";
import { HeaderSearch } from "./header-search";

interface SiteHeaderProps {
  onGadgetSelectorClick?: () => void;
  onPhoneSelectorClick?: () => void;
  onRequestModelClick?: () => void;
}

export function SiteHeader({
  onGadgetSelectorClick,
  onPhoneSelectorClick,
  onRequestModelClick,
}: SiteHeaderProps) {
  const navigate = useNavigate();
  const latestModels = useQuery(api.supportedModels.getLatest, { count: 20 });

  const { user, isLoaded } = useUser();
  const isSignedIn = !!user;

  return (
    <>
      {/* TOP NAV */}
      <nav className="fixed top-0 w-full bg-background/80 backdrop-blur-lg border-b border-border z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-4">
          {/* LOGO - LCP Element */}
          <Link to="/" className="flex items-center gap-2 flex-shrink-0">
            <img
              src="https://cdn.hercules.app/file_z5FY3JOmZTlB5GRUueA4GKas"
              alt="Skinly"
              width="174"
              height="70"
              fetchPriority="high"
              loading="eager"
              decoding="sync"
              className="h-12 md:h-16"
            />
          </Link>

          {/* SEARCH (DESKTOP) */}
          <div className="hidden md:flex flex-1 max-w-lg">
            <HeaderSearch
              onRequestModelClick={onRequestModelClick ?? (() => {})}
            />
          </div>

          {/* AUTH BUTTON */}
          <div className="flex items-center gap-2">
            {isLoaded && !isSignedIn && (
              <SignInButton mode="modal">
                <button
                  type="button"
                  aria-label="Sign In"
                  className="px-3 py-1 rounded border border-primary text-primary bg-background hover:bg-primary/10 font-semibold"
                >
                  <UserIcon className="size-6" />
                </button>
              </SignInButton>
            )}

            {isLoaded && isSignedIn && (
              <button
                type="button"
                aria-label="Account"
                onClick={() => navigate("/account")}
                className="px-3 py-1 rounded border border-primary text-primary bg-background hover:bg-primary/10 font-semibold"
              >
                <UserIcon className="size-6" />
              </button>
            )}
          </div>

          {/* MOBILE NAV */}
          <MobileNav
            onGadgetSelectorClick={onGadgetSelectorClick}
            onPhoneSelectorClick={onPhoneSelectorClick}
          />
        </div>
      </nav>

      {/* LATEST MODELS STRIP */}
      <div className="w-full bg-primary/5 border-y border-primary/10 mt-24 overflow-hidden">
        {latestModels === undefined && (
          <div className="py-4 flex items-center justify-center gap-2">
            <div className="size-4 rounded-full bg-primary/40 animate-pulse" />
            <span className="text-sm text-muted-foreground">
              Loading latest models...
            </span>
          </div>
        )}

        {latestModels && latestModels.length === 0 && (
          <div className="py-4 text-center text-sm text-muted-foreground">
            No models available
          </div>
        )}

        {latestModels && latestModels.length > 0 && (
          <div className="hidden md:flex items-center gap-4 py-3">
            <div className="flex items-center gap-2 text-sm font-bold px-4 py-1.5 bg-primary text-primary-foreground rounded-r-full">
              ✨ Now supporting:
            </div>

            <div className="flex-1 overflow-hidden">
              <div className="animate-marquee flex gap-3 whitespace-nowrap">
                {latestModels.map((model, idx) => (
                  <span
                    key={idx}
                    className="text-sm text-foreground/80 font-medium"
                  >
                    {model.brandName} {model.modelName}
                    <span className="text-primary/40 mx-2">•</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
