import { Link } from "react-router-dom";
import { MessageCircleIcon } from "lucide-react";
import { ExploreModels } from "@/components/explore-models.tsx";

/**
 * The homepage's last word before the videos and footer: for the visitor who
 * scrolled this far without opening a product (83% of visits, per the
 * dashboard funnel), a device search, the phones people order most, and a
 * way to ask for a model we don't have yet. It replaced a rotating banner
 * set that sat at the bottom of the page and was barely seen.
 */

// The most-ordered phones (dashboard: top phones, 30 days), spelled as the model list has them.
const POPULAR: Array<[string, string, string]> = [
  ["Apple", "iPhone 17", "iPhone 17"],
  ["Apple", "iPhone 16", "iPhone 16"],
  ["Samsung", "Galaxy S24 Ultra (5G)", "Galaxy S24 Ultra"],
  ["Samsung", "Galaxy S25 Ultra (5G)", "Galaxy S25 Ultra"],
];

export function ClosingSearch({ onRequestModelClick }: { onRequestModelClick: () => void }) {
  return (
    <ExploreModels
      onRequestModelClick={onRequestModelClick}
      title="Haven't found yours yet?"
      subtitle="Search your phone, laptop or gadget — every design is cut for it."
      footer={
        <div className="space-y-4 text-center">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground">Popular:</span>
            {POPULAR.map(([brand, model, label]) => (
              <Link key={model} to={`/products?${new URLSearchParams({ brand, model })}`}
                className="rounded-full border-2 border-ink/20 bg-card px-3 py-1 text-xs font-bold hover:border-ink">
                {label}
              </Link>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">
            Can't find your model?{" "}
            <button type="button" onClick={onRequestModelClick} className="font-bold text-brand-deep underline underline-offset-2">Request it</button>
            {" "}— we add 99% of requests.{" "}
            <a href="https://wa.me/919761011121?text=Hi%20Skinly%2C%20I%20can%27t%20find%20my%20device" target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1 font-bold text-brand-deep underline underline-offset-2">
              <MessageCircleIcon className="size-3.5" /> WhatsApp us
            </a>
          </p>
        </div>
      }
    />
  );
}
