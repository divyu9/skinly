import type { Plugin } from "vite";

/**
 * Emits a `<link rel="preload">` for whichever hero image will be the LCP.
 *
 * The homepage's largest paint was measured at 5.25s, and almost none of that
 * was the image: its request did not start until 3.1s, because the URL is not
 * known until the bundle has loaded, React has mounted and Firestore has
 * answered. No amount of `fetchpriority` on the `<img>` helps, since the tag
 * does not exist yet.
 *
 * So the first slide's URL is read at build time — heroSlides is world-readable,
 * so this needs no credentials — and written into the HTML as a preload. The
 * browser can then start the image while it is still parsing head, in parallel
 * with the bundle rather than three round trips behind it.
 *
 * Two links with `media`, because the slider picks a different source per
 * breakpoint and preloading both would download an image nobody sees.
 *
 * If the fetch fails the build carries on without the hint. A slow build is
 * worth avoiding; a failed one over a performance nicety is not.
 */
export function heroPreload(projectId: string): Plugin {
  let links = "";

  return {
    name: "skinly-hero-preload",
    apply: "build",

    async buildStart() {
      if (!projectId) return;
      const url =
        `https://firestore.googleapis.com/v1/projects/${projectId}` +
        `/databases/(default)/documents/heroSlides?pageSize=50`;
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
        if (!res.ok) throw new Error(`heroSlides ${res.status}`);
        const body: any = await res.json();

        const val = (f: any) => (f ? Object.values(f)[0] : undefined);
        const slides = (body.documents ?? [])
          .map((d: any) => d.fields ?? {})
          .filter((f: any) => val(f.isActive) === true)
          .sort((a: any, b: any) => Number(val(a.order) ?? 0) - Number(val(b.order) ?? 0));

        const first = slides[0];
        if (!first) return;

        const desktop = val(first.imageUrl) as string | undefined;
        const mobile = (val(first.mobileImageUrl) as string | undefined) || desktop;
        const esc = (u: string) => u.replace(/&/g, "&amp;").replace(/"/g, "&quot;");

        const out: string[] = [];
        if (mobile) {
          out.push(
            `<link rel="preload" as="image" href="${esc(mobile)}" ` +
              `fetchpriority="high" media="(max-width: 767px)" />`,
          );
        }
        if (desktop) {
          out.push(
            `<link rel="preload" as="image" href="${esc(desktop)}" ` +
              `fetchpriority="high" media="(min-width: 768px)" />`,
          );
        }
        links = out.join("\n    ");
        if (links) this.info?.(`hero preload: ${out.length} link(s) injected`);
      } catch (err: any) {
        this.warn?.(
          `hero preload skipped (${err?.message ?? err}) — the build is fine, ` +
            `the homepage just loses the head start`,
        );
      }
    },

    transformIndexHtml(html) {
      if (!links) return html;
      return html.replace("</head>", `  ${links}\n  </head>`);
    },
  };
}
