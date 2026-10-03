import { useState } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { MapPinIcon, MessageCircleIcon, ScissorsIcon, SparklesIcon } from "lucide-react";
import { AnnouncementBar } from "@/components/announcement-bar.tsx";
import { MobileHeader } from "@/components/mobile-header.tsx";
import { MobileNav } from "@/components/mobile-nav.tsx";
import { SiteFooter } from "@/components/site-footer.tsx";

/**
 * /about — who is behind the shop, how a skin is made, what it does and
 * doesn't, and how to reach us. The facts AI answers and Google's quality
 * guidelines look for; prerendered with an AboutPage schema
 * (scripts/prerender.mjs, route "/about"). Keep the two in step.
 */
const STEPS = [
  "You choose a design and your exact device model.",
  "The design is printed on vinyl and cut on a plotter from that model's own template, with openings for the cameras, ports and buttons.",
  "It is packed with an install kit — wipes, dust absorber, squeegee, microfiber cloth — and dispatched in 2–3 business days.",
];

export default function AboutPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const h2 = "mt-10 text-2xl font-extrabold md:text-3xl";
  return (
    <div className="halftone min-h-screen">
      <Helmet>
        <title>About GoSkinly — Vinyl Skins Cut to Fit Your Exact Device | GoSkinly</title>
        <meta name="description" content="GoSkinly by Mad House Media, Agra: printed vinyl skins precision-cut to the exact model of phone, laptop, console or camera, made to order and shipped across India." />
        <link rel="canonical" href="https://goskinly.com/about" />
      </Helmet>
      <AnnouncementBar />
      <MobileHeader onMenuClick={() => setMenuOpen(true)} />
      <MobileNav open={menuOpen} onOpenChange={setMenuOpen} />

      <main className="container mx-auto max-w-3xl px-4 pb-16 pt-28">
        <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-ink bg-sunny px-3 py-1 text-xs font-extrabold text-ink">
          <SparklesIcon className="size-3.5" /> About us
        </span>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight md:text-5xl">About GoSkinly</h1>
        <p className="mt-4 text-lg leading-relaxed text-foreground/85">
          GoSkinly makes printed vinyl skins for phones, laptops, tablets, consoles, cameras, lenses, drones and chargers.
          It is run by <b>Mad House Media</b> from Agra, Uttar Pradesh, and ships across India.
        </p>

        <h2 className={h2}><ScissorsIcon className="mr-2 inline size-6 text-brand-deep" />How a skin is made</h2>
        <ol className="mt-4 space-y-3">
          {STEPS.map((s, i) => (
            <li key={i} className="flex gap-3 rounded-2xl border-2 border-ink/15 bg-card p-4">
              <span className="grid size-7 shrink-0 place-items-center rounded-full border-2 border-ink bg-brand text-sm font-extrabold text-brand-foreground">{i + 1}</span>
              <span className="leading-relaxed">{s}</span>
            </li>
          ))}
        </ol>

        <h2 className={h2}>What a skin does — and doesn't</h2>
        <p className="mt-3 leading-relaxed text-foreground/85">
          A skin changes how your device looks and protects the surface from scratches and scuffs. It is a thin wrap, so it does
          not protect against drops. It peels off cleanly without residue.
        </p>

        <h2 className={h2}>Finishes</h2>
        <p className="mt-3 leading-relaxed text-foreground/85">
          Matte, 3D textured, embossed and transparent (Tranzy). Full body wraps for phones cover the back and the sides.
        </p>

        <h2 className={h2}>Buying from us</h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-foreground/85">
          <li>Free shipping above ₹499 within India.</li>
          <li>Returns within 48 hours of delivery for a wrong, missing or damaged item.</li>
          <li>Every review on the site comes from a delivered order.</li>
        </ul>

        <h2 className={h2}>Contact</h2>
        <div className="mt-3 space-y-2 rounded-2xl border-2 border-ink bg-card p-4">
          <p className="flex items-center gap-2"><MessageCircleIcon className="size-4" /> WhatsApp <a href="https://goskinly.com/support" className="font-bold underline">+91 97610 11121</a></p>
          <p className="flex items-center gap-2"><MapPinIcon className="size-4" /> Agra, Uttar Pradesh 282003, India</p>
          <p>Email: <a href="mailto:prgoskinly@gmail.com" className="font-bold underline">prgoskinly@gmail.com</a></p>
        </div>

        <p className="mt-8 flex flex-wrap gap-x-4 gap-y-2 font-bold">
          <Link to="/how-to-apply" className="underline">How to apply a skin</Link>
          <Link to="/real-photos" className="underline">Real photos</Link>
          <Link to="/reviews" className="underline">Customer reviews</Link>
          <Link to="/products" className="underline">Shop</Link>
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
