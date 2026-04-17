const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

admin.initializeApp();
const db = admin.firestore();

const escapeXml = (unsafe) => {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
};

async function generate() {
  const baseUrl = "https://www.goskinly.com";
  const urls = [];
  
  const staticPages = [
    { path: "/", priority: 1.0, changefreq: "daily" },
    { path: "/products", priority: 0.9, changefreq: "daily" },
    { path: "/devices", priority: 0.9, changefreq: "weekly" },
    { path: "/policies/privacy", priority: 0.3, changefreq: "monthly" },
    { path: "/policies/terms", priority: 0.3, changefreq: "monthly" },
    { path: "/policies/shipping", priority: 0.4, changefreq: "monthly" },
    { path: "/policies/returns", priority: 0.4, changefreq: "monthly" },
  ];

  const now = new Date().toISOString();
  staticPages.forEach((page) => {
    urls.push({
      url: `${baseUrl}${page.path}`,
      lastmod: now,
      changefreq: page.changefreq,
      priority: page.priority,
    });
  });

  // Products
  const pSnap = await db.collection('products').where('status', '==', 'active').get();
  pSnap.docs.forEach((doc) => {
    const data = doc.data();
    if (data.slug) {
      urls.push({
        url: `${baseUrl}/products/${data.slug}`,
        lastmod: data.updatedAt ? new Date(data.updatedAt).toISOString() : new Date(data.createdAt || data._creationTime || Date.now()).toISOString(),
        changefreq: "weekly",
        priority: 0.8,
      });
    }
  });

  // Collections — link to /products filtered by collection query param
  // /shop was removed; the products page handles ?collection= filtering
  const cSnap = await db.collection('collections').get();
  cSnap.docs.forEach((doc) => {
    const data = doc.data();
    if (data.slug) {
      urls.push({
        url: `${baseUrl}/products?collection=${data.slug}`,
        lastmod: data.updatedAt ? new Date(data.updatedAt).toISOString() : new Date(data.createdAt || data._creationTime || Date.now()).toISOString(),
        changefreq: "daily",
        priority: 0.7,
      });
    }
  });

  // SEO Pages
  const sSnap = await db.collection('seoPages').where('isPublished', '==', true).get();
  sSnap.docs.forEach((doc) => {
    const data = doc.data();
    if (data.slug) {
      urls.push({
        url: `${baseUrl}/${data.slug}`,
        lastmod: data.updatedAt ? new Date(data.updatedAt).toISOString() : new Date(data.createdAt || data._creationTime || Date.now()).toISOString(),
        changefreq: "weekly",
        priority: 0.85,
      });
    }
  });

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

  urls.forEach((entry) => {
    xml += "  <url>\n";
    xml += `    <loc>${escapeXml(entry.url)}</loc>\n`;
    xml += `    <lastmod>${entry.lastmod}</lastmod>\n`;
    xml += `    <changefreq>${entry.changefreq}</changefreq>\n`;
    xml += `    <priority>${entry.priority}</priority>\n`;
    xml += "  </url>\n";
  });

  xml += "</urlset>";

  const outPath = path.join(__dirname, "..", "public", "sitemap.xml");
  fs.writeFileSync(outPath, xml);
  console.log("Wrote", urls.length, "URLs to", outPath);
}

generate().catch(console.error);
