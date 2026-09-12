import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@/lib/firebase-hooks";
import { api } from "@/lib/firebase-api";
import { MobileHeader } from "@/components/mobile-header.tsx";
import { SiteHeader } from "@/components/site-header.tsx";
import { SiteFooter } from "@/components/site-footer.tsx";
import { MobileNav } from "@/components/mobile-nav.tsx";
import { MobileBottomNav } from "@/components/mobile-bottom-nav.tsx";
import { MagnetoDisc } from "./_components/magneto-disc.tsx";
import { PhoneBody } from "./_components/phone-body.tsx";
import { useScrollScene, useReveal } from "./_components/use-scroll-scene.ts";
import "./magneto.css";
import {
  MagnetIcon,
  ZapIcon,
  GaugeIcon,
  ThermometerSnowflakeIcon,
  SmartphoneIcon,
  HardDriveIcon,
  ArrowRightIcon,
} from "lucide-react";

/** The live product, so price and stock here can never drift from the shop. */
const SLUG = "magneto-x-type-c-ssd-enclosure-with-m-2-nvme-support";

export default function MagnetoXPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const product = useQuery(api.products.getProductBySlug, { slug: SLUG }) as
    | { _id: string; title?: string; variants?: Array<{ price?: number; title?: string }> }
    | null
    | undefined;

  const fromPrice = useMemo(() => {
    const prices = (product?.variants ?? [])
      .map((v) => Number(v.price))
      .filter((n) => Number.isFinite(n) && n > 0);
    return prices.length ? Math.min(...prices) : null;
  }, [product]);

  const buyHref = `/products/${SLUG}`;

  return (
    <div className="mx-page min-h-screen bg-[#07090c] text-white">
      <div className="md:hidden">
        <MobileHeader onMenuClick={() => setMenuOpen(true)} />
      </div>
      <div className="hidden md:block">
        <SiteHeader />
      </div>
      <MobileNav open={menuOpen} onOpenChange={setMenuOpen} />

      <Hero fromPrice={fromPrice} buyHref={buyHref} />
      <SnapScene />
      <OpenScene />
      <SpeedScene />
      <SpecSlab />
      <FeatureGrid />
      <InTheBox />
      <CloseCta fromPrice={fromPrice} buyHref={buyHref} />

      <div className="bg-background text-foreground">
        <SiteFooter />
      </div>
      <MobileBottomNav />
      <StickyBuy fromPrice={fromPrice} buyHref={buyHref} />
    </div>
  );
}

/* ------------------------------------------------------------------ hero */

function Hero({ fromPrice, buyHref }: { fromPrice: number | null; buyHref: string }) {
  const ref = useScrollScene<HTMLElement>();

  return (
    <section ref={ref} className="mx-scene relative h-[170vh]">
      <div className="mx-pin overflow-hidden">
        <div className="mx-aurora" aria-hidden="true" />

        <div className="mx-hero-grid">
          <div className="mx-hero-copy">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.32em] text-brand">
              Magneto X · BS-M3N
            </p>
            <h1 className="mx-display text-balance text-4xl font-extrabold leading-[1.03] sm:text-5xl lg:text-6xl">
              Your phone just grew
              <br />
              <span className="text-brand">a hard drive.</span>
            </h1>
            <p className="mt-5 max-w-md text-pretty text-sm leading-relaxed text-white/60 sm:text-base">
              A 69mm aluminium disc that snaps to the back of your phone and
              turns it into 4TB of NVMe storage — at 10Gbps, while charging.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-3">
              <Link
                to={buyHref}
                className="mx-cta inline-flex h-12 items-center gap-2 rounded-full bg-brand px-7 text-sm font-bold text-brand-foreground"
              >
                {fromPrice ? `Buy — ₹${fromPrice.toLocaleString("en-IN")}` : "Buy now"}
                <ArrowRightIcon className="size-4" />
              </Link>
              <span className="text-xs text-white/40">Free shipping over ₹499</span>
            </div>
          </div>

          <div className="mx-hero-stage" aria-hidden="true">
            <img
              src="/magneto/hero.webp"
              alt=""
              width={1024}
              height={868}
              fetchPriority="high"
              decoding="async"
              className="mx-hero-shot"
            />
          </div>
        </div>

        <div className="mx-scroll-hint" aria-hidden="true">
          <span />
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------- snap scene */

function SnapScene() {
  const ref = useScrollScene<HTMLElement>();

  return (
    <section ref={ref} className="mx-scene relative h-[210vh]">
      <div className="mx-pin overflow-hidden">
        <div className="mx-snap-stage" aria-hidden="true">
          <div className="mx-snap-phone">
            <PhoneBody className="size-full drop-shadow-[0_30px_70px_rgba(0,0,0,0.7)]" />
            <span className="mx-field mx-field-1" />
            <span className="mx-field mx-field-2" />
            <span className="mx-field mx-field-3" />
          </div>
          <img
            src="/magneto/disc.webp"
            alt=""
            width={900}
            height={900}
            loading="lazy"
            decoding="async"
            className="mx-snap-disc"
          />
        </div>

        <div className="mx-scene-copy">
          <p className="mx-eyebrow">Built-in magnetic suction</p>
          <h2 className="mx-h2">
            It doesn't clip.
            <br />
            It <span className="text-brand">snaps</span>.
          </h2>
          <p className="mx-body">
            A ring of N52 magnets finds the centre on its own and holds through
            a case. No bracket, no adhesive, no sled hanging off your phone.
          </p>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------- open scene */

function OpenScene() {
  const ref = useScrollScene<HTMLElement>();

  return (
    <section ref={ref} className="mx-scene relative h-[230vh]">
      <div className="mx-pin overflow-hidden">
        <div className="mx-open-stage" aria-hidden="true">
          <div className="mx-open-board">
            <MagnetoDisc face="bottom" className="size-full" />
          </div>
          <img
            src="/magneto/disc.webp"
            alt=""
            width={900}
            height={900}
            loading="lazy"
            decoding="async"
            className="mx-open-lid"
          />
          <div className="mx-ssd" role="presentation">
            <span className="mx-ssd-label">2230</span>
          </div>
        </div>

        <div className="mx-scene-copy">
          <p className="mx-eyebrow">M.2 NVMe inside</p>
          <h2 className="mx-h2">
            Four screws.
            <br />
            <span className="text-brand">Four terabytes.</span>
          </h2>
          <p className="mx-body">
            Takes any M.2 NVMe stick in 2230 or 2242 — the same drives that go in
            a Steam Deck or an ultrabook. Buy the capacity you want, swap it when
            you outgrow it. The aluminium body is the heatsink.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {["2230", "2242", "Up to 4TB"].map((t) => (
              <span key={t} className="mx-chip">
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ speed scene */

function SpeedScene() {
  const ref = useScrollScene<HTMLElement>();

  return (
    <section ref={ref} className="mx-scene relative h-[180vh]">
      <div className="mx-pin overflow-hidden">
        <div className="mx-speed-stage" aria-hidden="true">
          <div className="mx-speed-track">
            {Array.from({ length: 18 }).map((_, i) => (
              <span key={i} style={{ ["--i" as string]: i }} />
            ))}
          </div>
          <img
            src="/magneto/disc.webp"
            alt=""
            width={900}
            height={900}
            loading="lazy"
            decoding="async"
            className="mx-speed-dial"
          />
        </div>

        <div className="mx-scene-copy">
          <p className="mx-eyebrow">USB 3.2 Gen 2 · Type-C</p>
          <h2 className="mx-h2">
            <span className="mx-gbps">10</span>
            <span className="text-brand">Gbps</span>
          </h2>
          <p className="mx-body">
            A 4K ProRes take moves off your phone in the time it takes to put
            your shoes on. Passthrough PD means it charges at up to 100W while
            it does — one cable, both jobs.
          </p>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------- spec slab */

const SPECS = [
  { value: "11.4", unit: "mm", label: "69.5 × 69 × 11.4mm, aluminium" },
  { value: "100", unit: "W", label: "PD passthrough charging" },
  { value: "10", unit: "Gbps", label: "USB 3.1, backward compatible" },
  { value: "4", unit: "TB", label: "M.2 NVMe, M key / B+M key" },
];

function SpecSlab() {
  const ref = useReveal<HTMLDivElement>();
  return (
    <section className="border-y border-white/10 bg-[#0b0e12] py-20">
      <div ref={ref} className="mx-reveal container mx-auto grid grid-cols-2 gap-8 px-6 lg:grid-cols-4">
        {SPECS.map((s) => (
          <div key={s.label}>
            <p className="mx-display text-4xl font-extrabold leading-none sm:text-5xl">
              {s.value}
              <span className="ml-1 text-xl font-bold text-brand sm:text-2xl">{s.unit}</span>
            </p>
            <p className="mt-2 text-[13px] leading-snug text-white/45">{s.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ feature grid */

const FEATURES = [
  {
    icon: MagnetIcon,
    title: "Works on any phone",
    body: "Snaps to MagSafe on its own, and the box includes an adhesive magnet ring for every phone that hasn't got it.",
  },
  {
    icon: SmartphoneIcon,
    title: "Android, Windows, Mac, Linux",
    body: "Plug and play over Type-C. No drivers, and it hot-swaps.",
  },
  {
    icon: GaugeIcon,
    title: "10Gbps transfer",
    body: "USB 3.1 Gen 2, backward compatible with USB 3.0.",
  },
  {
    icon: ZapIcon,
    title: "PD 100W charging",
    body: "Charges the phone while the drive is mounted. One cable, both jobs.",
  },
  {
    icon: ThermometerSnowflakeIcon,
    title: "Aluminium heatsink",
    body: "The alloy body is the cooling. No throttling mid-transfer.",
  },
  {
    icon: HardDriveIcon,
    title: "Bring your own SSD",
    body: "Ships empty. Any M.2 NVMe stick in 2230 or 2242, up to 4TB.",
  },
];

function FeatureGrid() {
  const ref = useReveal<HTMLDivElement>();
  return (
    <section className="bg-[#07090c] py-20">
      <div className="container mx-auto px-6">
        <h2 className="mx-display mb-10 max-w-xl text-3xl font-extrabold sm:text-4xl">
          Everything it does, in one disc.
        </h2>
        <div ref={ref} className="mx-reveal grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 transition-colors hover:border-brand/40"
            >
              <span className="mb-3 inline-flex size-10 items-center justify-center rounded-xl bg-brand/15 text-brand">
                <f.icon className="size-5" strokeWidth={2.1} />
              </span>
              <p className="text-[15px] font-bold">{f.title}</p>
              <p className="mt-1 text-[13px] leading-relaxed text-white/50">{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------- in the box */

const IN_THE_BOX = [
  "Magneto X enclosure",
  "Adhesive magnet ring",
  "Type-C braided cable",
  "USB-A adapter",
  "Screwdriver + screws",
  "Thermal pad",
];

function InTheBox() {
  const ref = useReveal<HTMLUListElement>();
  return (
    <section className="border-t border-white/10 bg-[#0b0e12] py-16">
      <div className="container mx-auto px-6">
        <h2 className="mx-display mb-2 text-2xl font-extrabold sm:text-3xl">In the box</h2>
        <p className="mb-8 text-sm text-white/45">
          Everything except the drive — so you pick the capacity.
        </p>
        <ul ref={ref} className="mx-reveal grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {IN_THE_BOX.map((item) => (
            <li
              key={item}
              className="rounded-xl border border-white/10 bg-white/[0.035] px-3 py-3 text-[13px] font-medium leading-snug text-white/70"
            >
              {item}
            </li>
          ))}
        </ul>
        <p className="mt-6 max-w-2xl text-[12px] leading-relaxed text-white/35">
          First use on Android: the phone's USB data mode is off by default —
          turn on USB file transfer once and it is remembered.
        </p>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------- close cta */

function CloseCta({ fromPrice, buyHref }: { fromPrice: number | null; buyHref: string }) {
  return (
    <section className="relative overflow-hidden border-t border-white/10 bg-[#0b0e12] py-24 text-center">
      <div className="mx-aurora mx-aurora-soft" aria-hidden="true" />
      <div className="container relative mx-auto px-6">
        <img
          src="/magneto/disc.webp"
          alt="Magneto X magnetic M.2 NVMe SSD enclosure"
          width={900}
          height={900}
          loading="lazy"
          decoding="async"
          className="mx-idle-spin mx-auto mb-8 w-40 sm:w-52"
        />
        <h2 className="mx-display text-balance text-3xl font-extrabold sm:text-5xl">
          Stop deleting things.
        </h2>
        <p className="mx-auto mt-4 max-w-md text-sm text-white/55">
          Magneto X, in machined aluminium. Ships empty so you choose the drive.
        </p>
        <Link
          to={buyHref}
          className="mx-cta mt-8 inline-flex h-13 items-center gap-2 rounded-full bg-brand px-8 py-3.5 text-sm font-bold text-brand-foreground"
        >
          {fromPrice ? `Buy — ₹${fromPrice.toLocaleString("en-IN")}` : "Buy now"}
          <ArrowRightIcon className="size-4" />
        </Link>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------- sticky buy */

function StickyBuy({ fromPrice, buyHref }: { fromPrice: number | null; buyHref: string }) {
  return (
    <div className="mx-sticky-buy fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-40 border-t border-white/10 bg-[#0b0e12]/95 backdrop-blur-xl md:bottom-0">
      <div className="container mx-auto flex items-center gap-3 px-4 py-2.5">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] text-white/45">Magneto X · M.2 NVMe enclosure</p>
          <p className="text-base font-extrabold text-white">
            {fromPrice ? `₹${fromPrice.toLocaleString("en-IN")}` : "—"}
          </p>
        </div>
        <Link
          to={buyHref}
          className="mx-cta inline-flex h-10 shrink-0 items-center gap-2 rounded-full bg-brand px-5 text-[13px] font-bold text-brand-foreground"
        >
          Buy now
          <ArrowRightIcon className="size-3.5" />
        </Link>
      </div>
    </div>
  );
}
