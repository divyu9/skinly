"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { api } from "./_generated/api.js";
import type { Id } from "./_generated/dataModel.d.ts";

// RapidShyp API configuration
function getRapidShypConfig() {
  const apiKey = process.env.RAPIDSHYP_API_KEY;
  // Use the correct RapidShyp wrapper endpoint
  const apiUrl = process.env.RAPIDSHYP_API_URL || "https://api.rapidshyp.com/rapidshyp/apis/v1/wrapper";

  if (!apiKey) {
    throw new ConvexError({
      message:
        "RapidShyp API credentials not configured. Please add RAPIDSHYP_API_KEY in Secrets tab.",
      code: "BAD_REQUEST",
    });
  }

  return { apiKey, apiUrl };
}

// Create shipment with RapidShyp
export const createShipment = action({
  args: {
    orderId: v.id("orders"),
  },
  handler: async (ctx, args): Promise<{ success: boolean; awbNumber?: string; shipmentId?: string; message: string }> => {
    try {
      // Get order details
      const order = await ctx.runQuery(api.admin.orders.getOrderDetails, {
        orderId: args.orderId,
      });

      if (!order) {
        throw new ConvexError({
          message: "Order not found",
          code: "NOT_FOUND",
        });
      }

      console.log("Creating shipment for order:", order.orderNumber);

      // Validate required fields
      if (!order.shippingAddress?.phone) {
        throw new ConvexError({
          message: "Order missing phone number in shipping address",
          code: "BAD_REQUEST",
        });
      }

      if (!order.items || order.items.length === 0) {
        throw new ConvexError({
          message: "Order has no items",
          code: "BAD_REQUEST",
        });
      }

      // Check if shipment already created
      if (order.awbNumber) {
        throw new ConvexError({
          message: "Shipment already created for this order",
          code: "BAD_REQUEST",
        });
      }

      const config = getRapidShypConfig();
      console.log("RapidShyp API URL:", config.apiUrl);

      // Fetch product details for all items to get shipping dimensions
      const itemsWithProducts = await Promise.all(
        order.items.map(async (item) => {
          // productId is stored as a string in order items, cast to Id<"products">
          const product = await ctx.runQuery(api.products.getProduct, {
            productId: item.productId as Id<"products">,
          });
          return { ...item, product };
        })
      );

      // Filter out digital products
      const physicalItems = itemsWithProducts.filter(
        (item) => item.product?.productType !== "digital"
      );

      if (physicalItems.length === 0) {
        throw new ConvexError({
          message: "Order contains only digital products, no shipment required",
          code: "BAD_REQUEST",
        });
      }

      // Calculate total weight (sum of each item's weight × quantity)
      let totalWeight = 0;
      let totalLength = 0;
      let totalBreadth = 0;
      let totalHeight = 0;
      let physicalProductCount = 0;

      for (const item of physicalItems) {
        const itemWeight = item.product?.weight ?? 100; // Default 100g if not set
        const itemLength = item.product?.length ?? 10; // Default 10cm if not set
        const itemBreadth = item.product?.breadth ?? 10; // Default 10cm if not set
        const itemHeight = item.product?.height ?? 2; // Default 2cm if not set
        
        totalWeight += itemWeight * item.quantity;
        totalLength += itemLength;
        totalBreadth += itemBreadth;
        totalHeight += itemHeight;
        physicalProductCount++;
      }

      // Calculate average dimensions
      const avgLength = Math.ceil(totalLength / physicalProductCount);
      const avgBreadth = Math.ceil(totalBreadth / physicalProductCount);
      const avgHeight = Math.ceil(totalHeight / physicalProductCount);
      const weightInKg = (totalWeight / 1000).toFixed(2); // Convert grams to kg

      console.log("Calculated shipping dimensions:", {
        totalWeight: `${totalWeight}g`,
        weightInKg: `${weightInKg}kg`,
        avgLength: `${avgLength}cm`,
        avgBreadth: `${avgBreadth}cm`,
        avgHeight: `${avgHeight}cm`,
        physicalProductCount,
      });

      // Determine payment method (COD vs Prepaid)
      const paymentMethod = order.paymentMethod === "phonepe" ? "Prepaid" : "COD";

      // Calculate totals
      const subTotal = order.subtotal;
      const totalDiscount = 0; // No discounts for now
      const orderAmount = order.total;

      // Prepare shipment payload according to RapidShyp API documentation
      const shipmentPayload: Record<string, unknown> = {
        // Order details
        orderNumber: order.orderNumber,
        orderDate: new Date(order._creationTime).toISOString().split('T')[0], // Format: YYYY-MM-DD

        // Customer information
        customerName: order.shippingAddress.fullName,
        customerPhone: order.shippingAddress.phone,
        customerEmail: order.user?.email || "",

        // Shipping address (same as billing)
        shippingAddress: {
          name: order.shippingAddress.fullName,
          address: order.shippingAddress.addressLine1,
          address2: order.shippingAddress.addressLine2 || "",
          city: order.shippingAddress.city,
          state: order.shippingAddress.state,
          pincode: order.shippingAddress.pincode,
          phone: order.shippingAddress.phone,
          country: "India"
        },

        // Billing address (same as shipping)
        billingAddress: {
          name: order.shippingAddress.fullName,
          address: order.shippingAddress.addressLine1,
          address2: order.shippingAddress.addressLine2 || "",
          city: order.shippingAddress.city,
          state: order.shippingAddress.state,
          pincode: order.shippingAddress.pincode,
          phone: order.shippingAddress.phone,
          country: "India"
        },

        // Order items
        orderItems: order.items.map((item) => ({
          name: item.productTitle,
          sku: item.variant,
          units: item.quantity,
          sellingPrice: item.price.toFixed(2),
          hsn: "39269099", // HSN code for vinyl skins/stickers
          tax: "18" // GST rate 18%
        })),

        // Payment details
        paymentMethod: paymentMethod,
        totalDiscount: totalDiscount.toFixed(2),
        subTotal: subTotal.toFixed(2),
        orderAmount: orderAmount.toFixed(2),

        // Package details (weight in kg, dimensions in cm)
        weight: weightInKg,
        length: avgLength,
        breadth: avgBreadth,
        height: avgHeight,
        packageQty: 1, // Always 1 package

        // Pickup location
        pickupLocation: "SKINLY"
      };

      // Log payload for debugging (remove sensitive data in production)
      console.log("RapidShyp Payload:", JSON.stringify(shipmentPayload, null, 2));

      // Make API request to RapidShyp using the configured URL
      const response = await fetch(config.apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "rapidshyp-token": config.apiKey,
        },
        body: JSON.stringify(shipmentPayload),
      });

      console.log("RapidShyp Response Status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("RapidShyp API Error Response:", errorText);
        
        // Try to parse error as JSON for better error messages
        let errorMessage = `RapidShyp API error (${response.status})`;
        try {
          const errorJson = JSON.parse(errorText);
          if (errorJson.message) {
            errorMessage = errorJson.message;
          } else if (errorJson.error) {
            errorMessage = errorJson.error;
          }
        } catch {
          // If not JSON, use the raw text
          errorMessage = errorText || errorMessage;
        }

        throw new ConvexError({
          message: errorMessage,
          code: "EXTERNAL_SERVICE_ERROR",
        });
      }

      const result = await response.json() as { 
        success?: boolean;
        data?: {
          awb_number?: string;
          awb_code?: string;
          shipment_id?: string;
          tracking_url?: string;
          label_url?: string;
        };
        awb_number?: string;
        awb_code?: string;
        shipment_id?: string;
        tracking_url?: string;
        message?: string;
      };
      
      console.log("RapidShyp Success Response:", JSON.stringify(result, null, 2));

      // Extract AWB number and shipment details from response
      // Handle both nested (data.awb_number) and flat (awb_number) response formats
      const awbNumber = result.data?.awb_number || result.data?.awb_code || result.awb_number || result.awb_code;
      const shipmentId = result.data?.shipment_id || result.shipment_id;
      const trackingUrl = result.data?.tracking_url || result.tracking_url;

      if (!awbNumber) {
        console.error("No AWB number in response:", result);
        throw new ConvexError({
          message: "RapidShyp did not return an AWB number. Please check the API response.",
          code: "EXTERNAL_SERVICE_ERROR",
        });
      }

      // Update order with shipping information
      await ctx.runMutation(api.admin.orders.updateShippingInfo, {
        orderId: args.orderId,
        awbNumber,
        trackingUrl: trackingUrl || `https://rapidshyp.com/track/${awbNumber}`,
        shippingStatus: "Shipment Created",
      });

      return {
        success: true,
        awbNumber,
        shipmentId,
        message: "Shipment created successfully",
      };
    } catch (error) {
      console.error("RapidShyp createShipment error:", error);
      
      if (error instanceof ConvexError) {
        throw error;
      }
      
      // Log full error for debugging
      if (error instanceof Error) {
        console.error("Error details:", {
          name: error.name,
          message: error.message,
          stack: error.stack,
        });
      }
      
      throw new ConvexError({
        message:
          error instanceof Error
            ? error.message
            : "Failed to create shipment with RapidShyp",
        code: "EXTERNAL_SERVICE_ERROR",
      });
    }
  },
});

// Get shipment tracking details
export const getShipmentTracking = action({
  args: {
    awbNumber: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      const config = getRapidShypConfig();

      // Make API request to get tracking details
      const response = await fetch(
        `${config.apiUrl}/v1/external/orders/track/${args.awbNumber}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${config.apiKey}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.text();
        throw new ConvexError({
          message: `RapidShyp tracking API error: ${errorData}`,
          code: "EXTERNAL_SERVICE_ERROR",
        });
      }

      const result = await response.json();

      return {
        success: true,
        tracking: result,
      };
    } catch (error) {
      if (error instanceof ConvexError) {
        throw error;
      }
      throw new ConvexError({
        message:
          error instanceof Error
            ? error.message
            : "Failed to fetch tracking information",
        code: "EXTERNAL_SERVICE_ERROR",
      });
    }
  },
});

// Cancel shipment
export const cancelShipment = action({
  args: {
    awbNumber: v.string(),
    orderId: v.id("orders"),
  },
  handler: async (ctx, args) => {
    try {
      const config = getRapidShypConfig();

      // Make API request to cancel shipment
      const response = await fetch(
        `${config.apiUrl}/v1/external/orders/cancel/${args.awbNumber}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${config.apiKey}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.text();
        throw new ConvexError({
          message: `RapidShyp cancel API error: ${errorData}`,
          code: "EXTERNAL_SERVICE_ERROR",
        });
      }

      // Update order status
      await ctx.runMutation(api.admin.orders.updateShippingInfo, {
        orderId: args.orderId,
        shippingStatus: "Shipment Cancelled",
      });

      return {
        success: true,
        message: "Shipment cancelled successfully",
      };
    } catch (error) {
      if (error instanceof ConvexError) {
        throw error;
      }
      throw new ConvexError({
        message:
          error instanceof Error ? error.message : "Failed to cancel shipment",
        code: "EXTERNAL_SERVICE_ERROR",
      });
    }
  },
});

// Generate shipping label
export const generateShippingLabel = action({
  args: {
    awbNumber: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      const config = getRapidShypConfig();

      // Make API request to get shipping label
      const response = await fetch(
        `${config.apiUrl}/v1/external/orders/label/${args.awbNumber}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${config.apiKey}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.text();
        throw new ConvexError({
          message: `RapidShyp label API error: ${errorData}`,
          code: "EXTERNAL_SERVICE_ERROR",
        });
      }

      const result = await response.json();

      // Return label URL or base64 PDF
      return {
        success: true,
        labelUrl: result.label_url || result.label_pdf,
      };
    } catch (error) {
      if (error instanceof ConvexError) {
        throw error;
      }
      throw new ConvexError({
        message:
          error instanceof Error
            ? error.message
            : "Failed to generate shipping label",
        code: "EXTERNAL_SERVICE_ERROR",
      });
    }
  },
});
