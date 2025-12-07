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
      const data = JSON.parse(body);

      // Extract merchant transaction ID and payment status
      const merchantTransactionId = data.response?.transactionId;
      const state = data.response?.state;

      if (!merchantTransactionId || !state) {
        return new Response(
          JSON.stringify({ success: false, message: "Invalid webhook data" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Map PhonePe state to our payment status
      const paymentStatus =
        state === "COMPLETED" || state === "SUCCESS"
          ? "success"
          : state === "FAILED"
            ? "failed"
            : "pending";

      // Update order payment status
      await ctx.runMutation(api.orders.updatePaymentStatus, {
        merchantTransactionId,
        paymentStatus,
      });

      return new Response(
        JSON.stringify({ success: true, message: "Webhook processed" }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    } catch (error) {
      console.error("PhonePe webhook error:", error);
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
      const body = await request.text();
      const data = JSON.parse(body);

      console.log("=== RapidShyp Webhook Received ===");
      console.log("Raw payload:", body);

      // Extract tracking information
      // RapidShyp sends various field names depending on the webhook type
      const awbNumber = 
        data.awb_number || 
        data.awb || 
        data.tracking_number || 
        data.trackingNumber ||
        data.waybill;

      const status = 
        data.status || 
        data.shipment_status || 
        data.current_status ||
        data.shipmentStatus;

      const trackingUpdate = 
        data.tracking_update || 
        data.scan_details || 
        data.statusDescription ||
        data.scan_detail;

      console.log("Parsed fields:", { awbNumber, status, trackingUpdate });

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
        status,
        trackingUpdate,
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

Sitemap: https://skinly.onhercules.app/sitemap.xml`;

    return new Response(robotsTxt, {
      status: 200,
      headers: {
        "Content-Type": "text/plain",
        "Cache-Control": "public, max-age=86400", // Cache for 24 hours
      },
    });
  }),
});

export default http;
