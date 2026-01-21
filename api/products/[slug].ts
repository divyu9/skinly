import type { VercelRequest, VercelResponse } from "@vercel/node";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

// Social media crawler user agents
const CRAWLER_USER_AGENTS = [
  "facebookexternalhit",
  "Facebot",
  "WhatsApp",
  "Twitterbot",
  "LinkedInBot",
  "Pinterest",
  "Slackbot",
  "TelegramBot",
  "Discordbot",
];

// Check if the request is from a social media crawler
function isSocialMediaCrawler(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false;
  return CRAWLER_USER_AGENTS.some((crawler) =>
    userAgent.toLowerCase().includes(crawler.toLowerCase())
  );
}

// Helper to escape HTML entities
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Generate minimal HTML with OG meta tags for crawlers
function generateOGHtml(ogData: {
  title: string;
  description: string;
  image: string;
  url: string;
  price?: number;
  productTitle?: string;
}): string {
  const { title, description, image, url, price, productTitle } = ogData;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">

  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">

  <!-- Open Graph / Facebook / WhatsApp -->
  <meta property="og:type" content="product">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${escapeHtml(url)}">
  <meta property="og:image" content="${escapeHtml(image)}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:site_name" content="Skinly">

  ${price ? `
  <!-- Product-specific -->
  <meta property="product:price:amount" content="${price}">
  <meta property="product:price:currency" content="INR">
  <meta property="product:availability" content="in stock">
  ` : ""}

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${escapeHtml(image)}">
  <meta name="twitter:site" content="@goskinly">

  <!-- WhatsApp specific -->
  <meta property="og:image:alt" content="${escapeHtml(productTitle || title)}">

  <!-- Canonical URL -->
  <link rel="canonical" href="${escapeHtml(url)}">
</head>
<body>
  <h1>${escapeHtml(productTitle || title)}</h1>
  <p>${escapeHtml(description)}</p>
  <img src="${escapeHtml(image)}" alt="${escapeHtml(productTitle || title)}" />
  <p><a href="${escapeHtml(url)}">View Product on Skinly</a></p>
</body>
</html>`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { slug } = req.query;
  const userAgent = req.headers["user-agent"];

  // Validate slug
  if (!slug || typeof slug !== "string") {
    return res.status(400).json({ error: "Missing slug parameter" });
  }

  // For non-crawlers, serve the SPA index.html
  if (!isSocialMediaCrawler(userAgent)) {
    try {
      // Read and serve index.html for normal users (SPA fallback)
      const indexPath = join(process.cwd(), "dist", "index.html");
      if (existsSync(indexPath)) {
        const html = readFileSync(indexPath, "utf-8");
        return res
          .setHeader("Content-Type", "text/html; charset=utf-8")
          .status(200)
          .send(html);
      }
    } catch {
      // If index.html can't be read, redirect to the SPA route
    }

    // Fallback: redirect to the actual page
    return res.redirect(302, `/products/${slug}`);
  }

  // For crawlers, fetch OG data and return HTML with meta tags
  try {
    const convexUrl = process.env.CONVEX_URL || "https://disciplined-toad-759.convex.cloud";
    const ogEndpoint = `${convexUrl}/api/og/product?slug=${encodeURIComponent(slug)}`;

    const response = await fetch(ogEndpoint, {
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      throw new Error(`Convex error: ${response.status}`);
    }

    const ogData = await response.json();
    const html = generateOGHtml(ogData);

    return res
      .setHeader("Content-Type", "text/html; charset=utf-8")
      .setHeader("Cache-Control", "public, max-age=3600")
      .status(200)
      .send(html);
  } catch (error) {
    console.error("OG handler error:", error);

    // Return default OG tags on error
    const defaultHtml = generateOGHtml({
      title: "Skinly - Quirky wear for your gadgets",
      description: "Premium phone skins and wraps. Shop now!",
      image: "https://cdn.hercules.app/file_Qd06a0OWqeC2LadTl4tLLvmv",
      url: `https://goskinly.com/products/${slug}`,
    });

    return res
      .setHeader("Content-Type", "text/html; charset=utf-8")
      .setHeader("Cache-Control", "public, max-age=300")
      .status(200)
      .send(defaultHtml);
  }
}
