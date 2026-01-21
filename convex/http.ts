import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api, internal } from "./_generated/api.js";
import { ConvexError } from "convex/values";

const http = httpRouter();

// PhonePe webhook handler
http.route({
  path: "/api/phonepe/webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.text();
      
      console.log("=== PhonePe Webhook Received ===");
      console.log("Raw body:", body);
      
      // PhonePe sends the webhook as URL-encoded form data or JSON
      // Try to parse as JSON first
      let webhookData;
      try {
        webhookData = JSON.parse(body);
      } catch {
        // If not JSON, might be form-encoded
        const params = new URLSearchParams(body);
        webhookData = Object.fromEntries(params.entries());
      }
      
      console.log("Parsed webhook data:", webhookData);

      // PhonePe webhook might send data in different formats:
      // Format 1: { response: { ... } }
      // Format 2: { merchantTransactionId: ..., transactionId: ..., state: ... }
      // Format 3: Direct fields at root level
      
      const merchantTransactionId = 
        webhookData.merchantTransactionId ||
        webhookData.response?.merchantTransactionId ||
        webhookData.response?.transactionId;
        
      const state = 
        webhookData.state ||
        webhookData.response?.state ||
        webhookData.status;
        
      const responseCode =
        webhookData.code ||
        webhookData.response?.code ||
        webhookData.response?.responseCode;

      console.log("Extracted fields:", { merchantTransactionId, state, responseCode });

      if (!merchantTransactionId) {
        console.error("Missing merchantTransactionId in webhook");
        return new Response(
          JSON.stringify({ success: false, message: "Missing merchant transaction ID" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Map PhonePe state/code to our payment status
      const paymentStatus =
        state === "COMPLETED" || 
        state === "SUCCESS" || 
        responseCode === "PAYMENT_SUCCESS"
          ? "success"
          : state === "FAILED" ||
            responseCode === "PAYMENT_ERROR" ||
            responseCode === "PAYMENT_DECLINED" ||
            responseCode === "PAYMENT_CANCELLED"
            ? "failed"
            : "pending";

      console.log("Mapped payment status:", paymentStatus);

      // Update order payment status
      if (paymentStatus === "success" || paymentStatus === "failed") {
        await ctx.runMutation(api.orders.updatePaymentStatus, {
          merchantTransactionId,
          paymentStatus,
        });
        console.log("Order payment status updated successfully");
      } else {
        console.log("Skipping update for pending status");
      }

      return new Response(
        JSON.stringify({ success: true, message: "Webhook processed" }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    } catch (error) {
      console.error("=== PhonePe Webhook Error ===");
      console.error("Error:", error);
      return new Response(
        JSON.stringify({
          success: false,
          message: error instanceof Error ? error.message : "Webhook error",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  }),
});

// RapidShyp webhook handler for tracking updates
http.route({
  path: "/api/rapidshyp/webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      // Verify Bearer token
      const authHeader = request.headers.get("Authorization");
      if (authHeader) {
        const token = authHeader.replace("Bearer ", "");
        // Get expected token from settings
        const webhookToken = await ctx.runQuery(api.settings.getSetting, {
          key: "rapidshyp_webhook_token",
        });
        
        if (webhookToken && webhookToken.value !== token) {
          console.error("Invalid webhook token");
          return new Response(
            JSON.stringify({ 
              success: false, 
              message: "Unauthorized - Invalid token" 
            }),
            {
              status: 401,
              headers: { "Content-Type": "application/json" },
            }
          );
        }
      }

      const body = await request.text();
      const data = JSON.parse(body);

      console.log("=== RapidShyp Webhook Received ===");
      console.log("Raw payload:", body);

      // Parse RapidShyp's nested payload structure
      // Format: { records: [{ seller_order_id, shipment_details: [{ awb, shipment_status, ... }] }] }
      const records = data.records || [];
      if (!records || records.length === 0) {
        console.error("No records found in webhook payload");
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: "No records found in webhook payload" 
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      const record = records[0];
      const shipmentDetails = record.shipment_details || [];
      if (!shipmentDetails || shipmentDetails.length === 0) {
        console.error("No shipment details found in webhook payload");
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: "No shipment details found in webhook payload" 
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      const shipment = shipmentDetails[0];
      const awbNumber = shipment.awb;
      const shipmentStatus = shipment.shipment_status;
      const statusCode = shipment.current_tracking_status_code;
      const statusDesc = shipment.current_tracking_status_desc;
      const orderNumber = record.seller_order_id; // Extract order number

      console.log("Parsed fields:", { 
        awbNumber, 
        orderNumber,
        shipmentStatus, 
        statusCode, 
        statusDesc 
      });

      // Validate required fields
      if (!awbNumber) {
        console.error("Missing AWB number in webhook");
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: "Missing AWB number in webhook data" 
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Process webhook update using internal mutation
      const result = await ctx.runMutation(internal.rapidshypWebhook.processWebhookUpdate, {
        awbNumber,
        orderNumber,
        shipmentStatus,
        statusCode,
        statusDesc,
        rawPayload: body,
      });

      console.log("Webhook processed successfully:", result);

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Webhook processed successfully",
          orderNumber: result.orderNumber,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    } catch (error) {
      console.error("=== RapidShyp Webhook Error ===");
      console.error("Error:", error);
      
      // Return 200 to RapidShyp to prevent retries for known errors
      const statusCode = 
        error instanceof ConvexError && error.data.code === "NOT_FOUND"
          ? 200 // Don't retry for order not found
          : 500; // Retry for other errors

      return new Response(
        JSON.stringify({
          success: false,
          message: error instanceof Error ? error.message : "Webhook processing error",
        }),
        {
          status: statusCode,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  }),
});

// WhatsApp webhook handler for delivery status updates
http.route({
  path: "/whatsapp/webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.text();
      const data = JSON.parse(body);
      const now = Date.now();

      console.log("WhatsApp webhook received:", data);

      // Log webhook to database for audit
      const webhookId = await ctx.runMutation(api.whatsappMessaging.logWebhook, {
        eventType: data.event || data.type || data.status || "unknown",
        phoneNumber: data.mobile || data.phone || data.destination,
        providerMessageId: data.msgid || data.message_id || data.id,
        status: data.status || data.delivery_status,
        rawPayload: body,
        processedAt: now,
      });

      // Extract relevant fields (adjust based on authkey.io webhook format)
      const providerMessageId = data.msgid || data.message_id || data.id;
      const phoneNumber = data.mobile || data.phone || data.destination;
      const status = data.status || data.delivery_status || data.event;
      const errorMessage = data.error || data.error_message || data.failure_reason;

      if (!providerMessageId && !phoneNumber) {
        return new Response(
          JSON.stringify({
            success: false,
            message: "Missing message ID and phone number",
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Update message status
      const result = await ctx.runMutation(api.whatsappMessaging.processWebhookUpdate, {
        providerMessageId,
        phoneNumber,
        status: status || "unknown",
        errorMessage,
        rawPayload: body,
      });

      return new Response(
        JSON.stringify({
          success: true,
          message: "Webhook processed",
          webhookId,
          result,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    } catch (error) {
      console.error("WhatsApp webhook error:", error);

      // Try to log failed webhook
      try {
        const body = await request.text();
        await ctx.runMutation(api.whatsappMessaging.logWebhook, {
          eventType: "error",
          rawPayload: body,
          processedAt: Date.now(),
          errorMessage: error instanceof Error ? error.message : "Unknown error",
        });
      } catch (logError) {
        console.error("Failed to log webhook error:", logError);
      }

      return new Response(
        JSON.stringify({
          success: false,
          message: error instanceof Error ? error.message : "Webhook error",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  }),
});

// Sitemap XML endpoint
http.route({
  path: "/sitemap.xml",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    try {
      // Get sitemap URLs from query
      const urls = await ctx.runQuery(api.sitemap.getSitemapUrls, {});

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

      return new Response(xml, {
        status: 200,
        headers: {
          "Content-Type": "application/xml",
          "Cache-Control": "public, max-age=3600", // Cache for 1 hour
        },
      });
    } catch (error) {
      console.error("Sitemap generation error:", error);
      return new Response("Error generating sitemap", {
        status: 500,
        headers: { "Content-Type": "text/plain" },
      });
    }
  }),
});

// Robots.txt endpoint
http.route({
  path: "/robots.txt",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const robotsTxt = `User-agent: *
Allow: /

Sitemap: https://www.goskinly.com/sitemap.xml`;

    return new Response(robotsTxt, {
      status: 200,
      headers: {
        "Content-Type": "text/plain",
        "Cache-Control": "public, max-age=86400", // Cache for 24 hours
      },
    });
  }),
});

// Open Graph meta tags endpoint for social media sharing
// This endpoint returns HTML with proper OG tags for product pages
// Used by the Vercel edge middleware to serve correct meta tags to crawlers
http.route({
  path: "/api/og/product",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    try {
      const url = new URL(request.url);
      const slug = url.searchParams.get("slug");

      if (!slug) {
        return new Response(
          JSON.stringify({ error: "Missing slug parameter" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Get product data
      const product = await ctx.runQuery(api.products.getProductBySlug, { slug });

      if (!product) {
        // Return default OG tags for non-existent products
        return new Response(
          JSON.stringify({
            title: "Product Not Found | Skinly",
            description: "The product you're looking for doesn't exist.",
            image: "https://cdn.hercules.app/file_Qd06a0OWqeC2LadTl4tLLvmv",
            url: `https://goskinly.com/products/${slug}`,
            price: 0,
            found: false,
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "public, max-age=300", // Cache 5 mins
            },
          }
        );
      }

      // Get the first product image (hero image)
      const productImage = product.images?.[0]?.url || "https://cdn.hercules.app/file_Qd06a0OWqeC2LadTl4tLLvmv";
      const productUrl = `https://goskinly.com/products/${product.slug}`;
      const price = product.variants?.[0]?.price || 0;

      // Use meta title/description if available, otherwise generate from product data
      const title = product.metaTitle || `${product.title} | Skinly`;
      const description = product.metaDescription ||
        `Shop ${product.title} at Skinly. Premium quality skins and wraps for your device. ₹${price}`;

      return new Response(
        JSON.stringify({
          title,
          description,
          image: productImage,
          url: productUrl,
          price,
          productTitle: product.title,
          found: true,
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "public, max-age=3600", // Cache 1 hour
          },
        }
      );
    } catch (error) {
      console.error("OG meta endpoint error:", error);
      return new Response(
        JSON.stringify({
          error: error instanceof Error ? error.message : "Unknown error",
          found: false,
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  }),
});

export default http;
