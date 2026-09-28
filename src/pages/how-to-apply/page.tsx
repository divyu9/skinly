import { useState } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import {
  AlertTriangleIcon, AlignVerticalJustifyEndIcon, CameraIcon, CheckCircle2Icon, FlameIcon, HandIcon, MessageCircleIcon,
  MoveHorizontalIcon, PackageOpenIcon, PlayIcon, SparklesIcon, SprayCanIcon, WindIcon, XCircleIcon,
} from "lucide-react";
import { AnnouncementBar } from "@/components/announcement-bar.tsx";
import { MobileHeader } from "@/components/mobile-header.tsx";
import { MobileNav } from "@/components/mobile-nav.tsx";
import { SiteFooter } from "@/components/site-footer.tsx";

/**
 * /how-to-apply: the install guide — the YouTube walkthrough (loaded only
 * when tapped, so the page stays light) and the same steps written out as
 * cards. Linked from the footer and from the delivered email. The build
 * prerenders it with HowTo and VideoObject data (scripts/prerender.mjs).
 */

export const HOW_TO_VIDEO_ID = "kP2ywckzWXA";

/** What is in the install kit that comes with every skin. */
const KIT = [
  { icon: SprayCanIcon, name: "Wet & dry wipes", use: "to clean the device" },
  { icon: SparklesIcon, name: "Dust absorber", use: "to lift tiny dust specks" },
  { icon: HandIcon, name: "Squeegee", use: "to press the skin flat" },
  { icon: WindIcon, name: "Microfiber cloth", use: "for the final wipe" },
];

// The steps as the video shows them (youtube.com/watch?v=kP2ywckzWXA).
const STEPS = [
  {
    icon: SprayCanIcon,
    title: "Clean with the wet and dry wipes",
    text: "Take off the case and any old skin. Wipe the back of the phone with the wet wipe first, then the dry wipe, until it is clean and completely dry.",
  },
  {
    icon: SparklesIcon,
    title: "Lift the dust with the dust absorber",
    text: "Dab the dust absorber over the whole back to pick up the tiny dust specks you can't see. These are the most common cause of bubbles, so don't skip this.",
  },
  {
    icon: AlignVerticalJustifyEndIcon,
    title: "Start at the bottom: ports and speakers",
    text: "Peel the skin and begin from the bottom edge. Take your time to line up the bottom ports and speaker cut-outs 100% — get this right and the whole skin falls into place.",
  },
  {
    icon: HandIcon,
    title: "Press it flat with the squeegee",
    text: "Work upwards from the bottom with the squeegee from the kit, pressing the skin onto the back of the phone so it sits flat and aligned.",
  },
  {
    icon: CameraIcon,
    title: "Fine-tune around the camera",
    text: "When you reach the top, make small adjustments around the camera cut-out until it sits exactly over the lenses, then press it down.",
  },
  {
    icon: MoveHorizontalIcon,
    title: "Fold and press the sides",
    text: "Press the sides down along the edges of the phone, smoothing each one with your thumb or the squeegee.",
  },
  {
    icon: FlameIcon,
    title: "Full body wrap: set the 4 corners with a little heat",
    text: "The corner flaps on a full body wrap can stand up on curved edges. Hold a lighter (a matchstick or a hair dryer works too) 1–2 cm from each corner flap for about 2 seconds — just enough warmth for it to stick instantly — then press it down.",
    warn: "Keep the flame moving and never let it touch the skin; 2 seconds is enough — more can damage the vinyl. Adults only, away from children.",
  },
  {
    icon: CheckCircle2Icon,
    title: "Final wipe with the microfiber cloth",
    text: "Give the whole skin a firm press and a wipe with the microfiber cloth. The hold gets stronger over the next few hours.",
  },
];

const DONTS = [
  "Don't apply on a wet or dusty device",
  "Don't touch the sticky side more than you need to",
  "Don't pull or stretch the vinyl to make it fit",
  "Don't start from the camera — start from the bottom ports",
];

const FAQ = [
  {
    q: "I see a small bubble — what do I do?",
    a: "Push it towards the nearest edge with the squeegee or your thumb. If there is a speck of dust under it, lift that area gently, dab it with the dust absorber and press it down again.",
  },
  {
    q: "It went on slightly crooked.",
    a: "Peel it back slowly before pressing hard, line up the bottom ports and speakers again, and work upwards with the squeegee.",
  },
  {
    q: "The corners won't stay down.",
    a: "That is normal on curved edges of a full body wrap — a couple of seconds of heat on each corner flap (step 7) sets them firmly.",
  },
  {
    q: "How do I remove it later?",
    a: "Peel slowly from a corner at a low angle. The skin comes off clean without leaving residue on your device.",
  },
];

function VideoEmbed() {
  const [play, setPlay] = useState(false);
  return (
    <div className="relative aspect-video overflow-hidden rounded-2xl border-2 border-ink bg-ink shadow-[4px_4px_0_0_var(--ink)]">
      {play ? (
        <iframe
          className="absolute inset-0 h-full w-full"
          src={`https://www.youtube-nocookie.com/embed/${HOW_TO_VIDEO_ID}?autoplay=1&rel=0`}
          title="How to apply Skinly skins"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      ) : (
        <button type="button" onClick={() => setPlay(true)} className="group absolute inset-0 h-full w-full" aria-label="Play the how-to-apply video">
          <img src={`https://i.ytimg.com/vi/${HOW_TO_VIDEO_ID}/maxresdefault.jpg`} alt="How to apply Skinly skins — video" className="h-full w-full object-cover opacity-90 transition-opacity group-hover:opacity-100" />
          <span className="absolute left-1/2 top-1/2 grid size-20 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-ink bg-brand text-brand-foreground shadow-[3px_3px_0_0_var(--ink)] transition-transform group-hover:scale-105">
            <PlayIcon className="ml-1 size-9 fill-current" />
          </span>
          <span className="absolute bottom-3 left-3 rounded-full bg-background/90 px-3 py-1 text-xs font-bold">▶ Watch the video guide</span>
        </button>
      )}
    </div>
  );
}

export default function HowToApplyPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="halftone min-h-screen">
      <Helmet>
        <title>How to Apply Your Skinly Skin — Step-by-Step Guide & Video | GoSkinly</title>
        <meta name="description" content="Apply your Skinly skin bubble-free with the install kit: clean with the wipes, lift dust, start from the bottom ports, press with the squeegee, set the corners. Watch the video guide." />
        <link rel="canonical" href="https://goskinly.com/how-to-apply" />
      </Helmet>
      <AnnouncementBar />
      <MobileHeader onMenuClick={() => setMenuOpen(true)} />
      <MobileNav open={menuOpen} onOpenChange={setMenuOpen} />

      <main className="container mx-auto max-w-4xl px-4 pb-16 pt-28">
        {/* Intro */}
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-ink bg-sunny px-3 py-1 text-xs font-extrabold text-ink">
            <SparklesIcon className="size-3.5" /> Install guide
          </span>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight md:text-5xl">How to apply your Skinly skin</h1>
          <p className="mx-auto mt-3 max-w-2xl text-muted-foreground md:text-lg">
            A few minutes, no bubbles. Watch the video or follow the steps below — the install kit in your box has everything you need.
          </p>
        </div>

        {/* Video */}
        <div className="mt-8"><VideoEmbed /></div>

        {/* The kit */}
        <h2 className="mt-12 flex items-center gap-2 text-2xl font-extrabold md:text-3xl"><PackageOpenIcon className="size-6 text-brand-deep" /> In your install kit</h2>
        <div className="mt-1.5 h-1 w-12 rounded-full bg-brand" />
        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          {KIT.map((k) => (
            <div key={k.name} className="rounded-2xl border-2 border-ink bg-card p-4 text-center">
              <span className="mx-auto grid size-11 place-items-center rounded-full border-2 border-ink bg-sunny"><k.icon className="size-5 text-ink" /></span>
              <p className="mt-2 text-sm font-extrabold">{k.name}</p>
              <p className="text-xs text-muted-foreground">{k.use}</p>
            </div>
          ))}
        </div>

        {/* Steps */}
        <h2 className="mt-12 text-2xl font-extrabold md:text-3xl">Step by step</h2>
        <div className="mt-1.5 h-1 w-12 rounded-full bg-brand" />
        <ol className="mt-6 space-y-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex gap-4 rounded-2xl border-2 border-ink bg-card p-4 shadow-[3px_3px_0_0_var(--ink)] md:p-5">
              <div className="flex shrink-0 flex-col items-center gap-2">
                <span className="grid size-10 place-items-center rounded-full border-2 border-ink bg-brand text-lg font-extrabold text-brand-foreground">{i + 1}</span>
                {i < STEPS.length - 1 && <span className="w-0.5 flex-1 rounded-full bg-ink/15" />}
              </div>
              <div className="min-w-0 pb-1">
                <h3 className="flex items-center gap-2 text-lg font-extrabold">
                  <s.icon className="size-5 shrink-0 text-brand-deep" /> {s.title}
                </h3>
                <p className="mt-1.5 text-[15px] leading-relaxed text-foreground/80">{s.text}</p>
                {"warn" in s && s.warn && (
                  <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-heart/10 px-3 py-2 text-[13px] font-semibold text-heart">
                    <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" /> {s.warn}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ol>

        {/* Do / don't */}
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border-2 border-ink bg-card p-5">
            <h2 className="flex items-center gap-2 text-lg font-extrabold"><CheckCircle2Icon className="size-5 text-emerald-600" /> For the best finish</h2>
            <ul className="mt-3 space-y-2 text-[15px] text-foreground/80">
              <li>• Apply in good light, on a flat table</li>
              <li>• Keep your hands clean and dry</li>
              <li>• Take your time lining up the bottom ports and speakers</li>
              <li>• Put the case back on after a few hours</li>
            </ul>
          </div>
          <div className="rounded-2xl border-2 border-ink bg-card p-5">
            <h2 className="flex items-center gap-2 text-lg font-extrabold"><XCircleIcon className="size-5 text-heart" /> Avoid</h2>
            <ul className="mt-3 space-y-2 text-[15px] text-foreground/80">
              {DONTS.map((d) => <li key={d}>• {d.replace(/^Don't /, "")}</li>)}
            </ul>
          </div>
        </div>

        {/* FAQ */}
        <h2 className="mt-12 flex items-center gap-2 text-2xl font-extrabold md:text-3xl"><AlertTriangleIcon className="size-6 text-amber-600" /> If something goes wrong</h2>
        <div className="mt-5 space-y-3">
          {FAQ.map((f) => (
            <details key={f.q} className="group rounded-2xl border-2 border-ink/15 bg-card p-4 open:border-ink">
              <summary className="cursor-pointer list-none text-[15px] font-bold marker:hidden">{f.q}</summary>
              <p className="mt-2 text-[15px] leading-relaxed text-foreground/80">{f.a}</p>
            </details>
          ))}
        </div>

        {/* Help */}
        <div className="mt-12 flex flex-col items-center gap-4 rounded-2xl border-2 border-ink bg-sunny p-6 text-center shadow-[4px_4px_0_0_var(--ink)]">
          <p className="text-lg font-extrabold text-ink">Still stuck? We'll walk you through it.</p>
          <div className="flex flex-wrap justify-center gap-3">
            <a href="https://wa.me/919761011121?text=Hi%20Skinly%2C%20I%20need%20help%20applying%20my%20skin" target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border-2 border-ink bg-brand px-5 py-2.5 text-sm font-bold text-brand-foreground">
              <MessageCircleIcon className="size-4" /> WhatsApp us
            </a>
            <Link to="/products" className="inline-flex items-center gap-2 rounded-xl border-2 border-ink bg-card px-5 py-2.5 text-sm font-bold text-ink">
              Shop skins
            </Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
