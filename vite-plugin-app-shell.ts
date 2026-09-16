import fs from "node:fs/promises";
import path from "node:path";
import type { Plugin } from "vite";

/**
 * Writes dist/app.html and dist/404.html as part of `vite build` itself.
 *
 * public/.htaccess sends every path it cannot serve as a file to /app.html.
 * scripts/prerender.mjs writes that shell too, but it runs as a second step,
 * and if the host ever builds with plain `vite build` the step never happens —
 * every non-file URL would then rewrite to a file that does not exist and loop
 * into a 500. Writing the shells here means they exist whatever runs after.
 */
export function appShell(): Plugin {
  let outDir = "dist";
  return {
    name: "skinly-app-shell",
    apply: "build",
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    async closeBundle() {
      const index = await fs.readFile(path.join(outDir, "index.html"), "utf8");
      const shell = index
        .replace(/\s*<link rel="preload" as="image" data-hero[^>]*>/g, "")
        .replace("<!--seo-body-->", "");
      await fs.writeFile(path.join(outDir, "app.html"), shell.replace("<!--seo-head-->", ""));
      await fs.writeFile(
        path.join(outDir, "404.html"),
        shell.replace("<!--seo-head-->", '<meta name="robots" content="noindex" />'),
      );
    },
  };
}
