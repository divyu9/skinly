# Cloudflare Worker for Dynamic OG Meta Tags

This Cloudflare Worker intercepts requests to product pages and returns proper Open Graph meta tags for social media crawlers (WhatsApp, Facebook, Twitter, LinkedIn, etc.).

## Problem

When sharing product links on WhatsApp/social media, the preview shows the default brand logo and tagline instead of the actual product image and name. This happens because social media crawlers don't execute JavaScript - they only see the static HTML.

## Solution

This worker sits in front of your Hostinger-hosted site and:
1. Detects social media crawler bots via User-Agent
2. For bots: Fetches product data from Convex and returns HTML with proper OG tags
3. For regular users: Passes the request through to Hostinger as normal

## Setup Instructions

### Step 1: Deploy the Worker

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Navigate to **Workers & Pages** in the sidebar
3. Click **Create Application** > **Create Worker**
4. Name it something like `skinly-og-worker`
5. Click **Deploy**
6. Click **Edit Code** and paste the contents of `worker.js`
7. Click **Save and Deploy**

### Step 2: Add Environment Variables

1. In your worker settings, go to **Settings** > **Variables**
2. Add the following environment variable:
   - **Variable name**: `CONVEX_URL`
   - **Value**: `https://disciplined-toad-759.convex.cloud`
3. Click **Save**

### Step 3: Add Route Trigger

1. In your worker settings, go to **Triggers** > **Routes**
2. Click **Add route**
3. Add the route: `goskinly.com/products/*`
4. Select your zone (goskinly.com)
5. Click **Save**

### Step 4: Verify Cloudflare Proxy

Make sure your domain is proxied through Cloudflare (orange cloud icon in DNS settings). This is required for the worker to intercept requests.

## Testing

You can test if the worker is functioning by:

1. Using Facebook's Sharing Debugger: https://developers.facebook.com/tools/debug/
2. Using Twitter's Card Validator: https://cards-dev.twitter.com/validator
3. Sending a product link to yourself on WhatsApp

## How It Works

```
User/Bot Request
      |
      v
Cloudflare Worker
      |
      +-- Is it a social media bot?
      |         |
      |        YES --> Fetch product data from Convex
      |         |      Return HTML with OG meta tags
      |         |
      |        NO --> Pass through to Hostinger
      |
      v
    Response
```

## Supported Crawlers

- Facebook (facebookexternalhit, Facebot)
- WhatsApp
- Twitter (Twitterbot)
- LinkedIn (LinkedInBot)
- Pinterest
- Slack (Slackbot)
- Telegram (TelegramBot)
- Discord (Discordbot)

## Cache

- Successful OG responses are cached for 1 hour
- Error responses are cached for 5 minutes

## Convex Endpoint

The worker calls the Convex HTTP endpoint at `/api/og/product?slug=...` which returns:

```json
{
  "title": "Product Title | Skinly",
  "description": "Product description...",
  "image": "https://...",
  "url": "https://goskinly.com/products/slug",
  "price": 499,
  "productTitle": "Product Title",
  "found": true
}
```
