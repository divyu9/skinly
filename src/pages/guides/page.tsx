import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { BookOpenIcon, ClockIcon } from "lucide-react";
import { AnnouncementBar } from "@/components/announcement-bar.tsx";
import { MobileHeader } from "@/components/mobile-header.tsx";
import { MobileNav } from "@/components/mobile-nav.tsx";
import { SiteFooter } from "@/components/site-footer.tsx";
import { GUIDE_CLUSTERS, GUIDES_META, imageOf, readingMinutes, type Guide } from "@/lib/guides.mjs";
import { GUIDES, loadAllGuides } from "@/lib/guides-feed.ts";

/** /guides — every article, grouped the way people think about the question. */
export default function GuidesHubPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [all, setAll] = useState<Guide[]>(GUIDES);
  useEffect(() => {
    let live = true;
    void loadAllGuides().then((g) => { if (live) setAll(g); });
    return () => { live = false; };
  }, []);

  return (
    <div className="halftone min-h-screen">
      <Helmet>
        <title>{GUIDES_META.title}</title>
        <meta name="description" content={GUIDES_META.description} />
        <link rel="canonical" href="https://goskinly.com/guides" />
      </Helmet>
      <AnnouncementBar />
      <MobileHeader onMenuClick={() => setMenuOpen(true)} />
      <MobileNav open={menuOpen} onOpenChange={setMenuOpen} />

      <main className="container mx-auto max-w-5xl px-4 pb-16 pt-28">
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-ink bg-sunny px-3 py-1 text-xs font-extrabold text-ink">
            <BookOpenIcon className="size-3.5" /> Skin guides
          </span>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight md:text-5xl">Everything about device skins</h1>
          <p className="mx-auto mt-3 max-w-2xl text-muted-foreground md:text-lg">
            Straight answers from the people who print and cut them — which finish to pick, what fits, and how to look after it.
          </p>
        </div>

        {GUIDE_CLUSTERS.map((c) => {
          const items = all.filter((g) => g.cluster === c.id);
          if (!items.length) return null;
          return (
            <section key={c.id} className="mt-12">
              <h2 className="text-2xl font-extrabold md:text-3xl">{c.name}</h2>
              <div className="mt-1.5 h-1 w-12 rounded-full bg-brand" />
              <p className="mt-2 text-muted-foreground">{c.blurb}</p>
              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((g) => {
                  const cover = g.cover ? imageOf(g, g.cover) : null;
                  return (
                    <Link key={g.slug} to={`/guides/${g.slug}`}
                      className="sticker sticker-press group flex flex-col overflow-hidden rounded-2xl border-2 border-ink bg-card">
                      {cover && <img src={cover.src} alt={cover.alt} loading="lazy" className="aspect-video w-full border-b-2 border-ink object-cover" />}
                      <div className="flex flex-1 flex-col p-4">
                        <p className="font-extrabold leading-snug group-hover:underline">{g.title}</p>
                        <p className="mt-1.5 line-clamp-3 flex-1 text-sm text-muted-foreground">{g.description}</p>
                        <p className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground"><ClockIcon className="size-3.5" /> {readingMinutes(g)} min read</p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        })}
      </main>
      <SiteFooter />
    </div>
  );
}
