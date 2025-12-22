import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";

export default function SitemapXML() {
  const urls = useQuery(api.sitemap.getSitemapUrls, {});

  // Show loading state
  if (!urls) {
    return (
      <pre style={{ padding: "20px", fontFamily: "monospace", whiteSpace: "pre-wrap" }}>
        Generating sitemap...
      </pre>
    );
  }

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

  return (
    <pre style={{ 
      margin: 0, 
      padding: 0, 
      fontFamily: "monospace", 
      whiteSpace: "pre-wrap",
      wordWrap: "break-word"
    }}>
      {xml}
    </pre>
  );
}
