"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { api } from "./_generated/api.js";

// RapidShyp API configuration
function getRapidShypConfig() {
  const apiKey = process.env.RAPIDSHYP_API_KEY;
  const apiUrl = process.env.RAPIDSHYP_API_URL || "https://api.rapidshyp.com";

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
      const order: {
        orderNumber: string;
        _creationTime: number;
        items: Array<{ productTitle: string; variant: string; quantity: number; price: number }>;
        shippingAddress: {
          fullName: string;
          addressLine1: string;
          addressLine2?: string;
          city: string;
          pincode: string;
          state: string;
          phone: string;
        };
        user?: { email?: string } | null;
        paymentMethod: string;
        shippingFee: number;
        subtotal: number;
        awbNumber?: string;
      } = await ctx.runQuery(api.admin.orders.getOrderDetails, {
        orderId: args.orderId,
      }) as typeof order;

      if (!order) {
        throw new ConvexError({
          message: "Order not found",
          code: "NOT_FOUND",
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

      // Calculate package weight (estimate: 50g per item)
      const totalWeight = order.items.reduce(
        (sum: number, item: { quantity: number }) => sum + item.quantity * 0.05,
        0
      );

      // Prepare shipment payload
      // Note: This structure is based on common shipping aggregator patterns
      // You'll need to adjust this based on actual RapidShyp API documentation
      const shipmentPayload: Record<string, unknown> = {
        order_id: order.orderNumber,
        order_date: new Date(order._creationTime).toISOString(),
        pickup_location: "default", // You may need to configure this
        channel_id: "", // Your RapidShyp channel ID
        billing_customer_name: order.shippingAddress.fullName,
        billing_last_name: "",
        billing_address: order.shippingAddress.addressLine1,
        billing_address_2: order.shippingAddress.addressLine2 || "",
        billing_city: order.shippingAddress.city,
        billing_pincode: order.shippingAddress.pincode,
        billing_state: order.shippingAddress.state,
        billing_country: "India",
        billing_email: order.user?.email || "",
        billing_phone: order.shippingAddress.phone,
        shipping_is_billing: true,
        shipping_customer_name: "",
        shipping_last_name: "",
        shipping_address: "",
        shipping_address_2: "",
        shipping_city: "",
        shipping_pincode: "",
        shipping_country: "",
        shipping_state: "",
        shipping_email: "",
        shipping_phone: "",
        order_items: order.items.map((item: { productTitle: string; variant: string; quantity: number; price: number }) => ({
          name: item.productTitle,
          sku: item.variant,
          units: item.quantity,
          selling_price: item.price.toString(),
          discount: "0",
          tax: "0",
          hsn: "", // Add if you have HSN codes
        })),
        payment_method: order.paymentMethod === "phonepe" ? "Prepaid" : "COD",
        shipping_charges: order.shippingFee.toString(),
        giftwrap_charges: "0",
        transaction_charges: "0",
        total_discount: "0",
        sub_total: order.subtotal.toString(),
        length: "10", // Default dimensions in cm
        breadth: "10",
        height: "5",
        weight: totalWeight.toFixed(2),
      };

      // Make API request to RapidShyp
      const response: Response = await fetch(`${config.apiUrl}/v1/external/orders/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify(shipmentPayload),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new ConvexError({
          message: `RapidShyp API error: ${errorData}`,
          code: "EXTERNAL_SERVICE_ERROR",
        });
      }

      const result: Record<string, string> = await response.json() as Record<string, string>;

      // Extract AWB number and other details from response
      // Note: Adjust these field names based on actual RapidShyp response structure
      const awbNumber: string = result.awb_number || result.awb_code || result.tracking_number;
      const shipmentId: string = result.shipment_id || result.id;

      if (!awbNumber) {
        throw new ConvexError({
          message: "Failed to generate AWB number from RapidShyp",
          code: "EXTERNAL_SERVICE_ERROR",
        });
      }

      // Update order with shipping information
      await ctx.runMutation(api.admin.orders.updateShippingInfo, {
        orderId: args.orderId,
        awbNumber,
        trackingUrl: `https://rapidshyp.com/track/${awbNumber}`, // Adjust based on actual tracking URL format
        shippingStatus: "Shipment Created",
      });

      return {
        success: true,
        awbNumber,
        shipmentId,
        message: "Shipment created successfully",
      };
    } catch (error) {
      if (error instanceof ConvexError) {
        throw error;
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
