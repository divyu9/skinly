import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CameraIcon } from "lucide-react";
import { responsiveImg } from "@/lib/image-cdn";
import { ScrollNavButtons } from "@/components/ui/scroll-nav-buttons.tsx";
import { cutFor, useLatestRealPhotos, type RealPhoto } from "@/lib/real-photos";
import { readActiveDevice, type ActiveDevice } from "@/lib/active-device";
import { brandInScope } from "@/lib/device-fit";
import { loadCatalogue, loadModelCatalogue, type CatalogueProduct } from "@/lib/catalogue";

/**
 * Homepage › Real cuts: photos of skins cut for real orders, taken at the
 * packing table. Hidden until there is a photo to show.
 *
 * "Cut for Galaxy M56" is the proof that we cut per phone, but on its own it
 * reads as "this design is for the M56". So every card also says it is for
 * yours, and leads there: to the shopper's own phone when the site knows it
 * (on the design's listing for that brand, which need not be the photo's),
 * otherwise to the listing with no phone chosen so the page asks for one —
 * never to the phone in the photo.
 */
export function RealCuts() {
  const photos = useLatestRealPhotos(20);
  const [catalogue, setCatalogue] = useState<CatalogueProduct[] | null>(null);
  const [modelCounts, setModelCounts] = useState<Record<string, number>>({});
  const [device, setDevice] = useState<ActiveDevice | null>(null);

  useEffect(() => {
    const d = readActiveDevice();
    // A guess from the user agent is not "your phone"; only a device they picked is.
    setDevice(d && d.isConfirmed !== false ? d : null);
    loadCatalogue().then((c) => setCatalogue(c?.products ?? null));
    loadModelCatalogue().then((c) => {
      const n: Record<string, number> = {};
      c?.models.forEach((m) => { if (m.category) n[m.category] = (n[m.category] || 0) + 1; });
      setModelCounts(n);
    });
  }, []);

  if (!photos?.length) return null;

  /** The listing of this design that fits the shopper's device, if there is one. */
  const listingForDevice = (p: RealPhoto) => {
    if (!device || !catalogue || !p.designCode) return null;
    // A saved device without a category is, in practice, a phone.
    if ((device.category || "phone") !== (p.gadget || "phone")) return null;
    const fits = catalogue.filter((c) =>
      c.design === p.designCode && c.productCategory === "skin" &&
      (c.gadgetCategory || "phone") === (p.gadget || "phone") && brandInScope(c, device.brand));
    return fits.find((c) => c._id === p.productId) || fits[0] || null;
  };

  const target = (p: RealPhoto) => {
    const listing = listingForDevice(p);
    if (listing && device) {
      const q = new URLSearchParams({ brand: device.brand, model: device.model });
      return { to: `/products/${listing.slug}?${q}`, cta: `Get it for your ${device.model}` };
    }
    const gadget = p.gadget || "phone";
    const n = modelCounts[gadget] || 0;
    return {
      to: `/products/${p.productSlug}`,
      // "1,500+ phones": rounded down, so the claim is always true.
      cta: n >= 100 ? `Available for ${(Math.floor(n / 100) * 100).toLocaleString("en-IN")}+ ${gadget}s` : "Cut for your exact model",
    };
  };

  return (
    <section className="container mx-auto px-4 py-12">
      <div className="space-y-6">
        <div className="flex items-center justify-center gap-6">
          <div className="flex-1 text-center">
            <h2 className="text-3xl font-bold md:text-4xl">Fresh off the cutter</h2>
            <p className="mt-2 text-sm text-muted-foreground md:text-base">
              Every design is cut to order for your exact phone — here's how they turn out. Tap one to get it for yours.
            </p>
          </div>
          {photos.length > 3 && <ScrollNavButtons containerId="real-cuts-scroll" />}
        </div>

        <div id="real-cuts-scroll" className="no-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4">
          {photos.map((p) => {
            const t = target(p);
            return (
              <Link key={p._id} to={t.to} className="group w-[220px] flex-shrink-0 snap-start md:w-[260px]">
                <div className="overflow-hidden rounded-2xl border-2 border-ink/15 bg-card transition-shadow group-hover:shadow-xl">
                  <div className="relative aspect-[4/5] overflow-hidden bg-muted">
                    <img
                      {...responsiveImg(p.imageUrl, [240, 360, 480, 640], "(min-width: 768px) 260px, 220px")}
                      alt={`${p.productTitle}, ${cutFor(p).toLowerCase()}`}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-background/90 px-2 py-0.5 text-[11px] font-semibold shadow-sm">
                      <CameraIcon className="size-3" /> Real photo
                    </span>
                  </div>
                  <div className="space-y-0.5 p-3">
                    <p className="text-sm font-bold text-brand-deep">{cutFor(p)}</p>
                    <p className="line-clamp-1 text-xs text-muted-foreground">{p.productTitle}</p>
                    <p className="pt-1.5 text-xs font-bold text-foreground">
                      {t.cta} <span className="inline-block transition-transform group-hover:translate-x-0.5">→</span>
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
