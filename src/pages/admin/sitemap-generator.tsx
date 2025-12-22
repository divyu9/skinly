import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Authenticated } from "convex/react";
import { Download, RefreshCw, CheckCircle2, ExternalLink } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AdminLayout } from "@/components/admin-layout.tsx";

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
    toast.success("Sitemap downloaded! Now tell the AI to update public/sitemap.xml");
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
      <AdminLayout>
        <div className="container mx-auto p-6 max-w-4xl">
          <div className="mb-6">
            <h1 className="text-3xl font-bold mb-2">Static Sitemap Manager</h1>
            <p className="text-muted-foreground">
              Generate and download your static sitemap.xml with all current pages, products, and SEO content
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
                      {urls.filter((u) => u.url.includes("/products/") && !u.url.endsWith("/products")).length}
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
                <CardTitle>Static Sitemap Configuration</CardTitle>
                <CardDescription>
                  Your sitemap is a static file served from public/sitemap.xml
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4 space-y-3">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                    <div className="space-y-2">
                      <div className="font-medium text-blue-900 dark:text-blue-100">Static Sitemap Active</div>
                      <div className="text-sm text-blue-800 dark:text-blue-200">
                        Your sitemap is served as a static file from <code className="bg-blue-100 dark:bg-blue-900 px-1 py-0.5 rounded">public/sitemap.xml</code>
                      </div>
                      <div className="text-sm text-blue-800 dark:text-blue-200">
                        <strong>Published Site URL:</strong>{" "}
                        <a 
                          href="https://goskinly.com/sitemap.xml" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="underline font-medium"
                        >
                          https://goskinly.com/sitemap.xml
                          <ExternalLink className="inline h-3 w-3 ml-1" />
                        </a>
                      </div>
                      <div className="text-sm text-blue-800 dark:text-blue-200 mt-2">
                        <strong>Note:</strong> To update the sitemap after adding new products or pages, download the latest version below and update the file through your codebase or via chat with AI.
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button onClick={downloadSitemap} className="flex-1">
                    <Download className="h-4 w-4 mr-2" />
                    Download Updated Sitemap
                  </Button>
                  <Button onClick={copySitemap} variant="outline">
                    {copied ? <CheckCircle2 className="h-4 w-4 mr-2" /> : null}
                    {copied ? "Copied!" : "Copy XML"}
                  </Button>
                </div>

                <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                  <div className="text-sm text-amber-900 dark:text-amber-100">
                    <strong>To Update Your Sitemap:</strong>
                    <ol className="list-decimal list-inside mt-2 space-y-1 text-amber-800 dark:text-amber-200">
                      <li>Click "Download Updated Sitemap" above</li>
                      <li>Tell the AI: "Update public/sitemap.xml with the downloaded file"</li>
                      <li>Publish your app to make the changes live</li>
                    </ol>
                  </div>
                </div>

                <div className="space-y-3 text-sm">
                  <div className="font-medium">How Static Sitemaps Work:</div>
                  <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                    <li>Sitemap is a static XML file in your public/ directory</li>
                    <li>Faster loading - served directly without database queries</li>
                    <li>Better for SEO - search engines can cache it efficiently</li>
                    <li>Manual updates needed when you add/change products or pages</li>
                    <li>Use the download button above to get the latest version with all current URLs</li>
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
                    <li>Google will automatically crawl and index your sitemap</li>
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
      </AdminLayout>
    </Authenticated>
  );
}
