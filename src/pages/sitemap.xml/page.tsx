import { useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";

export default function SitemapXml() {
  const urls = useQuery(api.sitemap.getSitemapUrls, {});

  useEffect(() => {
    if (!urls) return;

    // Generate XML
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

    urls.forEach((entry) => {
      xml += "  <url>\n";
      xml += `    <loc>${entry.url}</loc>\n`;
      xml += `    <lastmod>${entry.lastmod}</lastmod>\n`;
      xml += `    <changefreq>${entry.changefreq}</changefreq>\n`;
      xml += `    <priority>${entry.priority}</priority>\n`;
      xml += "  </url>\n";
    });

    xml += "</urlset>";

    // Replace the entire document with XML
    document.open();
    document.write(xml);
    document.close();
  }, [urls]);

  if (!urls) {
    return <div>Loading sitemap...</div>;
  }

  return null;
}
