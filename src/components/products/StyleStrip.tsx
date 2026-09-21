import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { loadCatalogue, type ThemePage } from "@/lib/catalogue";

/*
 * The styles, for people rather than for crawlers.
 *
 * The build writes a list of every theme and finish page into the skins
 * category page, which is how 42 of them stopped being reachable from
 * nowhere. But the app replaces that markup when it boots, so a reader who
 * followed the footer's "All styles" landed on a grid of products and no
 * styles at all. This is the same list, rendered.
 *
 * Narrowed to the gadget being browsed when there is one: somebody filtering
 * to laptops wants "Matte laptop skins", not "Matte phone skins".
 */
export function StyleStrip({ gadget }: { gadget?: string | null }) {
  const [themes, setThemes] = useState<ThemePage[]>([]);
  useEffect(() => {
    let live = true;
    void loadCatalogue().then((c) => { if (live && c?.themes?.length) setThemes(c.themes); });
    return () => { live = false; };
  }, []);

  const shown = gadget
    ? [...themes.filter((t) => t.gadget === gadget), ...themes.filter((t) => !t.gadget)]
    : themes.filter((t) => !t.gadget);
  if (shown.length < 3) return null;

  return (
    <section className="mb-6">
      <h2 className="mb-2 text-sm font-semibold">Browse by style</h2>
      <div className="flex flex-wrap gap-2">
        {shown.slice(0, 18).map((t) => (
          <Link
            key={t.slug}
            to={`/${t.slug}`}
            className="sticker sticker-press inline-flex items-center gap-1.5 rounded-full border-2 border-ink/15 bg-card px-3 py-1.5 text-sm font-medium transition-colors hover:border-ink"
          >
            {t.name}
            <span className="text-xs text-muted-foreground tabular-nums">{t.total}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
