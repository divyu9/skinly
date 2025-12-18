import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Authenticated } from "convex/react";
import { Download, RefreshCw, CheckCircle2, ExternalLink } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function SitemapGenerator() {
  const urls = useQuery(api.sitemap.getSitemapUrls, {});
  const [copied, setCopied] = useState(false);

  const generateSitemapXml = () => {
    if (!urls) return "";

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
    return xml;
  };

  const downloadSitemap = () => {
    const xml = generateSitemapXml();
    const blob = new Blob([xml], { type: "application/xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sitemap.xml";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Updated sitemap downloaded! Upload it to the Files & Media tab as 'sitemap.xml'");
  };

  const copySitemap = () => {
    const xml = generateSitemapXml();
    navigator.clipboard.writeText(xml);
    setCopied(true);
    toast.success("Sitemap XML copied to clipboard!");
    setTimeout(() => setCopied(false), 3000);
  };

  if (!urls) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex items-center gap-2">
          <RefreshCw className="h-5 w-5 animate-spin" />
          <span>Generating sitemap...</span>
        </div>
      </div>
    );
  }

  return (
    <Authenticated>
      <div className="container mx-auto p-6 max-w-4xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Sitemap Generator</h1>
          <p className="text-muted-foreground">
            Generate and download your updated sitemap.xml with all current pages and products
          </p>
        </div>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Sitemap Statistics</CardTitle>
              <CardDescription>
                Your sitemap includes {urls.length} URLs across products, collections, SEO pages, and static pages
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="space-y-1">
                  <div className="text-2xl font-bold">{urls.length}</div>
                  <div className="text-xs text-muted-foreground">Total URLs</div>
                </div>
                <div className="space-y-1">
                  <div className="text-2xl font-bold">
                    {urls.filter((u) => u.url.includes("/products/detail")).length}
                  </div>
                  <div className="text-xs text-muted-foreground">Products</div>
                </div>
                <div className="space-y-1">
                  <div className="text-2xl font-bold">
                    {urls.filter((u) => u.url.includes("collection=")).length}
                  </div>
                  <div className="text-xs text-muted-foreground">Collections</div>
                </div>
                <div className="space-y-1">
                  <div className="text-2xl font-bold">
                    {urls.filter((u) => {
                      const url = u.url;
                      return !url.includes("/products/") && 
                             !url.includes("collection=") && 
                             !url.includes("/policies/") && 
                             !url.includes("/devices") && 
                             url !== "https://goskinly.com/";
                    }).length}
                  </div>
                  <div className="text-xs text-muted-foreground">SEO Pages</div>
                </div>
                <div className="space-y-1">
                  <div className="text-2xl font-bold">
                    {urls.filter((u) => {
                      const url = u.url;
                      return url.includes("/policies/") || 
                             url.includes("/devices") || 
                             url === "https://goskinly.com/" ||
                             url === "https://goskinly.com/products";
                    }).length}
                  </div>
                  <div className="text-xs text-muted-foreground">Static Pages</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Generate & Download Sitemap</CardTitle>
              <CardDescription>
                Create an updated sitemap.xml with all current pages and upload it to Files & Media
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Button onClick={downloadSitemap} className="flex-1">
                  <Download className="h-4 w-4 mr-2" />
                  Generate & Download Updated Sitemap
                </Button>
                <Button onClick={copySitemap} variant="outline">
                  {copied ? <CheckCircle2 className="h-4 w-4 mr-2" /> : null}
                  {copied ? "Copied!" : "Copy XML"}
                </Button>
              </div>

              <div className="space-y-3 text-sm">
                <div className="font-medium">Instructions:</div>
                <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
                  <li>Click "Generate & Download Updated Sitemap" button above</li>
                  <li>
                    Go to the{" "}
                    <Button
                      variant="link"
                      className="h-auto p-0 text-muted-foreground underline"
                      onClick={() => window.open("/backend-skinly/mockups", "_blank")}
                    >
                      Files & Media tab
                      <ExternalLink className="h-3 w-3 ml-1" />
                    </Button>
                  </li>
                  <li>Upload the sitemap.xml file (delete old one if exists)</li>
                  <li>Your sitemap will be live at: https://goskinly.com/sitemap.xml</li>
                </ol>
              </div>

              <div className="p-4 bg-muted rounded-lg space-y-2">
                <div className="text-sm font-medium">📝 When to regenerate:</div>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• After adding new products</li>
                  <li>• After adding new collections</li>
                  <li>• After creating/publishing new SEO pages</li>
                  <li>• Monthly (recommended for best SEO)</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Google Search Console</CardTitle>
              <CardDescription>
                Submit your sitemap to Google for better SEO
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3 text-sm">
                <div className="font-medium">Setup Steps:</div>
                <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
                  <li>
                    Go to{" "}
                    <a
                      href="https://search.google.com/search-console"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      Google Search Console
                      <ExternalLink className="inline h-3 w-3 ml-1" />
                    </a>
                  </li>
                  <li>Add property: https://goskinly.com</li>
                  <li>Verify ownership (via Google Analytics if already set up)</li>
                  <li>
                    Go to Sitemaps section and submit: <code className="bg-muted px-1 py-0.5 rounded">sitemap.xml</code>
                  </li>
                </ol>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Preview URLs</CardTitle>
              <CardDescription>Sample URLs included in your sitemap</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {urls.slice(0, 10).map((entry, i) => (
                  <div key={i} className="text-sm flex items-center justify-between p-2 bg-muted rounded">
                    <span className="truncate flex-1">{entry.url}</span>
                    <span className="text-xs text-muted-foreground ml-2">
                      P: {entry.priority}
                    </span>
                  </div>
                ))}
                {urls.length > 10 && (
                  <div className="text-sm text-muted-foreground text-center pt-2">
                    ... and {urls.length - 10} more URLs
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Authenticated>
  );
}
