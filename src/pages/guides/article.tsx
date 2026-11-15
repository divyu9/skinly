import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { ArrowRightIcon, BookOpenIcon, ChevronRightIcon, ClockIcon, MessageCircleIcon, SparklesIcon } from "lucide-react";
import { AnnouncementBar } from "@/components/announcement-bar.tsx";
import { MobileHeader } from "@/components/mobile-header.tsx";
import { MobileNav } from "@/components/mobile-nav.tsx";
import { SiteFooter } from "@/components/site-footer.tsx";
import { GuideBlockView, Inline } from "@/components/guides/guide-blocks.tsx";
import { GUIDE_CLUSTERS, GUIDE_SITE, guideJsonLd, imageOf, readingMinutes, type Guide } from "@/lib/guides.mjs";
import { loadAllGuides, staticGuide } from "@/lib/guides-feed.ts";
import NotFound from "@/pages/NotFound.tsx";

/**
 * /guides/:slug — one article. The hand-written guides are in the bundle and
 * draw at once (the prerendered HTML says the same thing underneath); the
 * generated ones come from /data/guides-auto.json.
 */
export default function GuideArticlePage() {
  const { slug = "" } = useParams();
  const [menuOpen, setMenuOpen] = useState(false);
  const [all, setAll] = useState<Guide[] | null>(null);
  const local = staticGuide(slug);

  useEffect(() => {
    let live = true;
    void loadAllGuides().then((g) => { if (live) setAll(g); });
    return () => { live = false; };
  }, []);

  const guide = local || all?.find((g) => g.slug === slug) || null;
  const bySlug = useMemo(() => new Map((all || []).map((g) => [g.slug, g])), [all]);

  if (!guide) {
    if (all) return <NotFound />;
    return <div className="min-h-screen" />;
  }

  const url = `${GUIDE_SITE}/guides/${guide.slug}`;
  const cluster = GUIDE_CLUSTERS.find((c) => c.id === guide.cluster);
  const cover = guide.cover ? imageOf(guide, guide.cover) : null;
  const related = (guide.related || []).map((s) => bySlug.get(s) || staticGuide(s)).filter(Boolean) as Guide[];

  return (
    <div className="halftone min-h-screen">
      <Helmet>
        <title>{guide.metaTitle}</title>
        <meta name="description" content={guide.description} />
        <link rel="canonical" href={url} />
        <meta property="og:type" content="article" />
        <meta property="og:title" content={guide.metaTitle} />
        <meta property="og:description" content={guide.description} />
        <meta property="og:url" content={url} />
        {cover && <meta property="og:image" content={`${GUIDE_SITE}${cover.src}`} />}
        {guideJsonLd(guide).map((ld, i) => <script key={i} type="application/ld+json">{JSON.stringify(ld)}</script>)}
      </Helmet>
      <AnnouncementBar />
      <MobileHeader onMenuClick={() => setMenuOpen(true)} />
      <MobileNav open={menuOpen} onOpenChange={setMenuOpen} />

      <main className="container mx-auto max-w-3xl px-4 pb-16 pt-28">
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
          <Link to="/" className="hover:text-ink">Home</Link>
          <ChevronRightIcon className="size-3.5" />
          <Link to="/guides" className="hover:text-ink">Guides</Link>
          {cluster && (<><ChevronRightIcon className="size-3.5" /><span>{cluster.name}</span></>)}
        </nav>

        <header className="mt-5">
          <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-ink bg-sunny px-3 py-1 text-xs font-extrabold text-ink">
            <BookOpenIcon className="size-3.5" /> {cluster?.name || "Guide"}
          </span>
          <h1 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight md:text-[2.6rem]">{guide.title}</h1>
          <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1"><ClockIcon className="size-3.5" /> {readingMinutes(guide)} min read</span>
            <span>Updated {new Date(`${guide.updated}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
            <span>By the GoSkinly team, Agra</span>
          </p>
        </header>

        {cover && (
          <img src={cover.src} alt={cover.alt} fetchPriority="high" className="mt-6 aspect-video w-full rounded-2xl border-2 border-ink object-cover shadow-[4px_4px_0_0_var(--ink)]" />
        )}

        {/* The reply an answer engine quotes: first, plain, complete. */}
        <section aria-label="Short answer" className="mt-7 rounded-2xl border-2 border-ink bg-card p-5 shadow-[4px_4px_0_0_var(--ink)]">
          <p className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide text-brand-deep"><SparklesIcon className="size-4" /> Short answer</p>
          <p className="mt-2 text-[16px] leading-relaxed md:text-[17px]"><Inline text={guide.answer} /></p>
        </section>

        {guide.sections.length > 3 && (
          <nav aria-label="In this guide" className="mt-6 rounded-2xl border-2 border-ink/15 bg-card/70 p-4">
            <p className="text-sm font-extrabold">In this guide</p>
            <ol className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
              {guide.sections.map((s, i) => (
                <li key={s.id}><a href={`#${s.id}`} className="text-muted-foreground hover:text-ink">{i + 1}. <Inline text={s.h2} /></a></li>
              ))}
              {!!guide.faqs?.length && <li><a href="#faq" className="text-muted-foreground hover:text-ink">{guide.sections.length + 1}. Questions people ask</a></li>}
            </ol>
          </nav>
        )}

        <article className="prose prose-neutral mt-8 max-w-none prose-headings:font-extrabold prose-headings:tracking-tight prose-h2:mt-12 prose-h2:text-2xl md:prose-h2:text-[1.7rem] prose-p:leading-relaxed prose-li:my-1 prose-a:no-underline">
          {guide.sections.map((s) => (
            <section key={s.id}>
              <h2 id={s.id} className="scroll-mt-28"><Inline text={s.h2} /></h2>
              {s.blocks.map((b, i) => <GuideBlockView key={i} guide={guide} block={b} />)}
            </section>
          ))}
        </article>

        {!!guide.faqs?.length && (
          <section className="mt-12">
            <h2 id="faq" className="scroll-mt-28 text-2xl font-extrabold md:text-[1.7rem]">Questions people ask</h2>
            <div className="mt-1.5 h-1 w-12 rounded-full bg-brand" />
            <div className="mt-5 space-y-3">
              {guide.faqs.map((f) => (
                <details key={f.q} className="group rounded-2xl border-2 border-ink/15 bg-card p-4 open:border-ink">
                  <summary className="cursor-pointer list-none text-[15px] font-bold marker:hidden">{f.q}</summary>
                  <p className="mt-2 text-[15px] leading-relaxed text-foreground/80"><Inline text={f.a} /></p>
                </details>
              ))}
            </div>
          </section>
        )}

        {!!guide.shop?.length && (
          <section className="mt-12 rounded-2xl border-2 border-ink bg-sunny p-5 shadow-[4px_4px_0_0_var(--ink)]">
            <p className="text-lg font-extrabold text-ink">Ready to pick one?</p>
            <div className="mt-3 flex flex-wrap gap-2.5">
              {guide.shop.map((s, i) => (
                <Link key={s.href} to={s.href}
                  className={`sticker sticker-press inline-flex items-center gap-1.5 rounded-xl border-2 border-ink px-4 py-2 text-sm font-bold ${i === 0 ? "bg-brand text-brand-foreground" : "bg-card text-ink"}`}>
                  {s.label} <ArrowRightIcon className="size-4" />
                </Link>
              ))}
            </div>
          </section>
        )}

        {related.length > 0 && (
          <section className="mt-12">
            <h2 className="text-xl font-extrabold">Related guides</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {related.map((r) => (
                <Link key={r.slug} to={`/guides/${r.slug}`} className="sticker-press group rounded-2xl border-2 border-ink/15 bg-card p-4 transition-colors hover:border-ink">
                  <p className="font-extrabold leading-snug group-hover:underline">{r.title}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{r.description}</p>
                </Link>
              ))}
            </div>
          </section>
        )}

        <div className="mt-12 flex flex-col items-center gap-3 rounded-2xl border-2 border-ink/15 bg-card p-6 text-center">
          <p className="font-extrabold">Still not sure which one fits?</p>
          <p className="text-sm text-muted-foreground">Send us your device model on WhatsApp and we'll tell you what fits and what we'd pick.</p>
          <a href="https://wa.me/919761011121?text=Hi%20Skinly%2C%20I%20have%20a%20question%20about%20skins" target="_blank" rel="noreferrer"
            className="sticker sticker-press inline-flex items-center gap-2 rounded-xl border-2 border-ink bg-brand px-5 py-2.5 text-sm font-bold text-brand-foreground">
            <MessageCircleIcon className="size-4" /> WhatsApp us
          </a>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
