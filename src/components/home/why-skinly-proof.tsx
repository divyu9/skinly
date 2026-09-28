import { Link } from "react-router-dom";
import { ArrowRightIcon, CameraIcon, PackageOpenIcon, ScissorsIcon, StarIcon } from "lucide-react";
import { useHomeData } from "@/components/home/home-rows.tsx";

/**
 * Homepage › Why Skinly, with proof: four claims, each with a number that is
 * counted at build time (scripts/prerender.mjs → home.json stats) and a page
 * that shows it. It replaced four generic lines — "Premium Quality", "Fast
 * Shipping" — that every shop says and nobody clicked.
 */

const floor = (n: number, step: number) => (n >= step ? `${(Math.floor(n / step) * step).toLocaleString("en-IN")}+` : String(n));

export function WhySkinlyProof() {
  const home = useHomeData();
  const s = home?.rows.stats;
  const tiles = [
    {
      icon: ScissorsIcon, tone: "bg-brand", to: "/devices",
      big: s ? floor(s.models, 100) : "4,000+", label: "models we cut for",
      title: "Cut for your exact model", cta: "Find your device",
    },
    {
      icon: CameraIcon, tone: "bg-sunny", to: "/real-photos",
      big: s && s.realPhotos ? floor(s.realPhotos, 10) : "Real", label: s && s.realPhotos ? "skins photographed before shipping" : "photos from our packing table",
      title: "Real photos, not renders", cta: "See real photos",
    },
    {
      icon: StarIcon, tone: "bg-blush", to: "/reviews",
      big: s && s.reviews ? `${s.rating.toFixed(1)}★` : "Verified", label: s && s.reviews ? `from ${s.reviews} verified ${s.reviews === 1 ? "buyer" : "buyers"}` : "only buyers of a delivered order can review",
      title: "Loved by buyers", cta: "Read reviews",
    },
    {
      icon: PackageOpenIcon, tone: "bg-brand/40", to: "/how-to-apply",
      big: "Kit", label: "wipes, dust absorber & squeegee in every box",
      title: "Easy to apply", cta: "Watch the guide",
    },
  ];
  return (
    <section className="container mx-auto space-y-6 px-4 py-10 md:py-14">
      <div className="text-center">
        <h2 className="text-2xl font-extrabold tracking-tight md:text-4xl">Why people pick Skinly</h2>
        <div className="mx-auto mt-1.5 h-1 w-12 rounded-full bg-brand" />
        <p className="mt-2 text-sm text-muted-foreground md:text-base">
          {s ? `${floor(s.designs, 50)} designs, each printed and cut to order — here's the proof.` : "Every design printed and cut to order — here's the proof."}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        {tiles.map((t) => (
          <Link key={t.title} to={t.to}
            className="group flex flex-col rounded-2xl border-2 border-ink bg-card p-4 shadow-[3px_3px_0_0_var(--ink)] transition-transform hover:-translate-y-0.5 md:p-5">
            <span className={`grid size-10 place-items-center rounded-xl border-2 border-ink ${t.tone}`}><t.icon className="size-5 text-ink" /></span>
            <p className="mt-3 text-2xl font-extrabold leading-none tracking-tight md:text-3xl">{t.big}</p>
            <p className="mt-1 text-[11px] font-semibold text-muted-foreground md:text-xs">{t.label}</p>
            <p className="mt-3 text-sm font-extrabold leading-tight md:text-base">{t.title}</p>
            <span className="mt-auto flex items-center gap-1 pt-3 text-xs font-bold text-brand-deep">
              {t.cta} <ArrowRightIcon className="size-3.5 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
