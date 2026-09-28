import { useState } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import {
  AlertTriangleIcon, CameraIcon, CheckCircle2Icon, HandIcon, MessageCircleIcon, PlayIcon, SparklesIcon,
  SprayCanIcon, TimerIcon, WindIcon, XCircleIcon,
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

const STEPS = [
  {
    icon: SprayCanIcon,
    title: "Clean and dry the device",
    text: "Take off the case and any old skin. Wipe away dust, oil and fingerprints, and let it dry completely — the adhesive needs a clean, dry surface.",
  },
  {
    icon: CameraIcon,
    title: "Line up the camera first",
    text: "Peel the backing from one side only. Place the camera cut-out over the camera — it is the anchor that keeps everything else aligned.",
  },
  {
    icon: HandIcon,
    title: "Press from the centre out",
    text: "Smooth the skin outwards from the middle with your thumb. The air-release adhesive lets trapped air escape to the edges. Off by a little? Lift gently and re-place — don't stretch it.",
  },
  {
    icon: WindIcon,
    title: "Wrap the edges and sides",
    text: "For full-body wraps, fold the sides around the edges and press them down. A few seconds of warm air from a hair dryer on low makes the vinyl softer on curved corners.",
  },
  {
    icon: TimerIcon,
    title: "Final press, then let it settle",
    text: "Press firmly over the whole skin once more, especially the edges and around the cut-outs. The hold gets stronger over the next few hours.",
  },
];

const DONTS = [
  "Don't apply on a wet or freshly sprayed device",
  "Don't touch the sticky side more than you need to",
  "Don't pull or stretch the vinyl to make it fit",
  "Don't rush the camera and port cut-outs — line them up first",
];

const FAQ = [
  {
    q: "I see a small bubble — what do I do?",
    a: "Push it towards the nearest edge with your thumb; the channels in the adhesive let the air out. For a stubborn one, lift that area gently and press it down again from the centre outwards.",
  },
  {
    q: "It went on slightly crooked.",
    a: "Peel it back slowly from the nearest corner before pressing hard, re-align the camera cut-out and smooth it down again.",
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
          <span className="absolute bottom-3 left-3 rounded-full bg-background/90 px-3 py-1 text-xs font-bold">▶ Watch the 5-minute guide</span>
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
        <meta name="description" content="Apply your Skinly skin bubble-free in five steps: clean, line up the camera, press from the centre out, wrap the edges, final press. Watch the video guide." />
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
            Five steps, about five minutes, no bubbles. Watch the video or follow the steps below — the install kit in your box is all you need.
          </p>
        </div>

        {/* Video */}
        <div className="mt-8"><VideoEmbed /></div>

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
              <li>• Take your time with the camera and port cut-outs</li>
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
