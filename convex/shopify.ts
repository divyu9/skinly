"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";

const SHOP = process.env.SHOPIFY_SHOP_DOMAIN;
const TOKEN = process.env.SHOPIFY_ADMIN_API_TOKEN;
const VERSION = process.env.SHOPIFY_API_VERSION ?? "2024-10";

function validateEnvVars() {
  if (!SHOP) {
    throw new Error("SHOPIFY_SHOP_DOMAIN is not set in environment variables. Please add it in the Secrets tab.");
  }
  if (!TOKEN) {
    throw new Error("SHOPIFY_ADMIN_API_TOKEN is not set in environment variables. Please add it in the Secrets tab.");
  }
  if (!SHOP.includes('.myshopify.com')) {
    throw new Error(`SHOPIFY_SHOP_DOMAIN format is incorrect. Should be 'your-store.myshopify.com', got: ${SHOP}`);
  }
}

async function shopify(path: string, init?: RequestInit) {
  if (!SHOP || !TOKEN) {
    throw new Error("Shopify credentials not configured");
  }
  
  const url = `https://${SHOP}/admin/api/${VERSION}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      "X-Shopify-Access-Token": TOKEN,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  
  if (res.status === 429) {
    const retry = Number(res.headers.get("Retry-After") ?? "2");
    await new Promise((r) => setTimeout(r, retry * 1000));
    return shopify(path, init);
  }
  
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Shopify ${res.status}: ${text}`);
  }
  
  const link = res.headers.get("Link");
  return { json: await res.json(), link };
}

function nextCursor(linkHeader?: string | null) {
  if (!linkHeader) return null;
  const m = linkHeader.split(",").find((s) => s.includes('rel="next"'));
  if (!m) return null;
  const url = m.split(";")[0].trim().slice(1, -1);
  return new URL(url).searchParams.get("page_info");
}

export const verifyConnection = action({
  args: {},
  handler: async () => {
    try {
      validateEnvVars();
      const { json } = await shopify(`/shop.json`);
      return { 
        shop: json.shop.name, 
        domain: json.shop.myshopify_domain,
        email: json.shop.email 
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Shopify Connection Error: ${error.message}`);
      }
      throw error;
    }
  },
});

export const listProducts = action({
  args: { 
    limit: v.optional(v.number()), 
    pageInfo: v.optional(v.string()) 
  },
  handler: async (_, { limit = 50, pageInfo }) => {
    const qp = new URLSearchParams({ limit: String(limit) });
    if (pageInfo) qp.set("page_info", pageInfo);
    
    const { json, link } = await shopify(`/products.json?${qp.toString()}`);
    
    interface ShopifyImage {
      id: number;
      src: string;
      alt: string | null;
    }
    
    interface ShopifyVariant {
      id: number;
      title: string;
      price: string;
      sku: string;
      inventory_quantity: number;
      available: boolean;
    }
    
    interface ShopifyProduct {
      id: number;
      title: string;
      handle: string;
      body_html: string;
      vendor: string;
      product_type: string;
      tags: string;
      status: string;
      images: ShopifyImage[];
      variants: ShopifyVariant[];
    }
    
    return { 
      products: (json.products as ShopifyProduct[]).map((p) => ({
        id: p.id,
        title: p.title,
        handle: p.handle,
        description: p.body_html,
        vendor: p.vendor,
        product_type: p.product_type,
        tags: p.tags,
        status: p.status,
        images: p.images.map((img) => ({
          id: img.id,
          src: img.src,
          alt: img.alt,
        })),
        variants: p.variants.map((v) => ({
          id: v.id,
          title: v.title,
          price: v.price,
          sku: v.sku,
          inventory_quantity: v.inventory_quantity,
          available: v.available,
        })),
      })), 
      nextPageInfo: nextCursor(link) 
    };
  },
});

interface ShopifyImage {
  id: number;
  src: string;
  alt: string | null;
}

interface ShopifyVariant {
  id: number;
  title: string;
  price: string;
  sku: string;
  inventory_quantity: number;
  available: boolean;
}

interface ShopifyProduct {
  id: number;
  title: string;
  handle: string;
  body_html: string;
  vendor: string;
  product_type: string;
  tags: string;
  status: string;
  images: ShopifyImage[];
  variants: ShopifyVariant[];
}

interface ProductResult {
  id: number;
  title: string;
  handle: string;
  description: string;
  vendor: string;
  product_type: string;
  tags: string;
  status: string;
  images: Array<{ id: number; src: string; alt: string | null }>;
  variants: Array<{
    id: number;
    title: string;
    price: string;
    sku: string;
    inventory_quantity: number;
    available: boolean;
  }>;
}

export const getAllProducts = action({
  args: {},
  handler: async () => {
    try {
      validateEnvVars();
      
      // Fetch only published products, limit to 250 for speed
      const { json } = await shopify(`/products.json?limit=250&status=active`);
      
      const products = (json.products as ShopifyProduct[]).map((p) => ({
        id: p.id,
        title: p.title,
        handle: p.handle,
        description: p.body_html,
        vendor: p.vendor,
        product_type: p.product_type,
        tags: p.tags,
        status: p.status,
        images: p.images.map((img) => ({
          id: img.id,
          src: img.src,
          alt: img.alt,
        })),
        variants: p.variants.map((v) => ({
          id: v.id,
          title: v.title,
          price: v.price,
          sku: v.sku,
          inventory_quantity: v.inventory_quantity,
          available: v.available,
        })),
      }));
      
      return products;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to fetch products: ${error.message}`);
      }
      throw error;
    }
  },
});
