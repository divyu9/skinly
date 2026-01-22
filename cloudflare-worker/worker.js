/**
 * Cloudflare Worker for Dynamic OG Meta Tags
 *
 * This worker intercepts requests to product pages and returns proper OG meta tags
 * for social media crawlers (WhatsApp, Facebook, Twitter, etc.)
 *
 * SETUP INSTRUCTIONS:
 * 1. Go to Cloudflare Dashboard > Workers & Pages
 * 2. Create a new Worker
 * 3. Paste this code
 * 4. Add environment variable: CONVEX_URL = "https://disciplined-toad-759.convex.cloud"
 * 5. Add a route: goskinly.com/products/* -> this worker
 * 6. Make sure your domain is proxied through Cloudflare (orange cloud)
 */

// Social media crawler user agents
const CRAWLER_USER_AGENTS = [
  'facebookexternalhit',
  'Facebot',
  'WhatsApp',
  'Twitterbot',
  'LinkedInBot',
  'Pinterest',
  'Slackbot',
  'TelegramBot',
  'Discordbot',
];

// Check if request is from a social media crawler
function isSocialMediaCrawler(userAgent) {
  if (!userAgent) return false;
  const ua = userAgent.toLowerCase();
  return CRAWLER_USER_AGENTS.some(crawler => ua.includes(crawler.toLowerCase()));
}

// Escape HTML entities
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Generate HTML with OG meta tags for crawlers
function generateOGHtml(ogData) {
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
  ` : ''}

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

// Default OG data when product not found or error occurs
function getDefaultOGData(slug) {
  return {
    title: 'Skinly - Quirky wear for your gadgets',
    description: 'Premium phone skins and wraps. Shop now!',
    image: 'https://cdn.hercules.app/file_Qd06a0OWqeC2LadTl4tLLvmv',
    url: `https://goskinly.com/products/${slug}`,
    price: 0,
    productTitle: 'Skinly'
  };
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const userAgent = request.headers.get('user-agent');

    // Only handle product pages
    if (!url.pathname.startsWith('/products/')) {
      // Pass through to origin
      return fetch(request);
    }

    // Extract product slug
    const pathParts = url.pathname.split('/');
    const slug = pathParts[2];

    // Skip if no valid slug or not a crawler
    if (!slug || !isSocialMediaCrawler(userAgent)) {
      // Pass through to origin for normal users
      return fetch(request);
    }

    // For social media crawlers, fetch OG data and return custom HTML
    try {
      const convexUrl = env.CONVEX_URL || 'https://disciplined-toad-759.convex.cloud';
      const ogEndpoint = `${convexUrl}/api/og/product?slug=${encodeURIComponent(slug)}`;

      const response = await fetch(ogEndpoint, {
        headers: { 'Content-Type': 'application/json' },
      });

      let ogData;
      if (response.ok) {
        ogData = await response.json();
      } else {
        console.error('Convex OG endpoint error:', response.status);
        ogData = getDefaultOGData(slug);
      }

      const html = generateOGHtml(ogData);

      return new Response(html, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=3600', // Cache 1 hour
        },
      });
    } catch (error) {
      console.error('Worker error:', error);

      // Return default OG tags on error
      const html = generateOGHtml(getDefaultOGData(slug));
      return new Response(html, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=300', // Cache 5 mins on error
        },
      });
    }
  },
};
