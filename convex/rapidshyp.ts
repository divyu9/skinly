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
        items: Array<{ 
          productId: string;
          productTitle: string; 
          variant: string; 
          quantity: number; 
          price: number;
        }>;
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
      type OrderItem = typeof order.items[0];
      type IdProducts = { __tableName: "products"; } & string;
      const itemsWithProducts = await Promise.all(
        order.items.map(async (item: OrderItem) => {
          // productId is stored as a string in order items, cast to Id<"products">
          const product = await ctx.runQuery(api.products.getProduct, {
            productId: item.productId as IdProducts,
          }) as { 
            length?: number; 
            breadth?: number; 
            height?: number; 
            weight?: number; 
            productType?: "physical" | "digital" 
          };
          return { ...item, product };
        })
      );

      // Filter out digital products
      const physicalItems = itemsWithProducts.filter(
        (item: { product: { productType?: "physical" | "digital" } }) => 
          item.product.productType !== "digital"
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
        const itemWeight = item.product.weight ?? 100; // Default 100g if not set
        const itemLength = item.product.length ?? 10; // Default 10cm if not set
        const itemBreadth = item.product.breadth ?? 10; // Default 10cm if not set
        const itemHeight = item.product.height ?? 2; // Default 2cm if not set
        
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
        length: avgLength.toString(),
        breadth: avgBreadth.toString(),
        height: avgHeight.toString(),
        weight: weightInKg,
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
        const errorData = await response.text();
        console.error("RapidShyp API Error Response:", errorData);
        throw new ConvexError({
          message: `RapidShyp API error (${response.status}): ${errorData}`,
          code: "EXTERNAL_SERVICE_ERROR",
        });
      }

      const result: Record<string, string> = await response.json() as Record<string, string>;
      console.log("RapidShyp Success Response:", JSON.stringify(result, null, 2));

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
