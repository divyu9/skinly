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
  handler: async (ctx, args): Promise<{ success: boolean; awbNumber?: string; shipmentId?: string; trackingUrl?: string; labelUrl?: string; courierName?: string; message: string }> => {
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
        order.items.map(async (item: any) => {
          // productId is stored as a string in order items, cast to Id<"products">
          const product = await ctx.runQuery(api.products.getProduct, {
            productId: item.productId as Id<"products">,
          });
          return { ...item, product };
        })
      );

      // Filter out digital products
      const physicalItems = itemsWithProducts.filter(
        (item: any) => item.product?.productType !== "digital"
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

      // Determine payment method and COD amount
      let paymentMethod = "Prepaid";
      let codValue = 0;
      
      if (order.paymentMethod === "cod") {
        paymentMethod = "COD";
        // For partial COD, send the balance amount
        // For full COD, send the full order total
        codValue = order.codAmount ?? order.total;
      }

      // Calculate totals
      const subTotal = order.subtotal;
      const totalDiscount = 0; // No discounts for now
      const orderAmount = order.total;

      // Validate pricing fields
      console.log("=== Pricing Validation ===");
      console.log("order.total:", order.total, "Type:", typeof order.total);
      console.log("order.subtotal:", order.subtotal, "Type:", typeof order.subtotal);
      console.log("order.shippingFee:", order.shippingFee, "Type:", typeof order.shippingFee);
      
      if (!order.total || typeof order.total !== 'number' || order.total <= 0) {
        throw new ConvexError({
          message: "Order total is missing or invalid",
          code: "BAD_REQUEST",
        });
      }

      // Validate item prices
      for (const item of order.items) {
        console.log(`Item: ${item.productTitle}, price:`, item.price, "Type:", typeof item.price);
        if (!item.price || typeof item.price !== 'number' || item.price <= 0) {
          throw new ConvexError({
            message: `Item price is missing or invalid for ${item.productTitle}`,
            code: "BAD_REQUEST",
          });
        }
      }

      // Split full name into firstName and lastName for RapidShyp
      const nameParts = order.shippingAddress.fullName.trim().split(/\s+/);
      const firstName = nameParts[0] || "";
      const lastName = nameParts.slice(1).join(" ") || "";

      // Convert weight from kg to grams for package weight
      const packageWeightInGrams = Math.round(parseFloat(weightInKg) * 1000);

      // Prepare shipment payload according to RapidShyp API documentation
      const shipmentPayload: Record<string, unknown> = {
        // Order details
        orderId: order.orderNumber,
        orderDate: new Date(order._creationTime).toISOString().split('T')[0], // Format: YYYY-MM-DD
        
        // Pickup and store details (required by API)
        pickupAddressName: "SKINLY", // Use your created pickup location name
        storeName: "DEFAULT", // Store name on RapidShyp
        billingIsShipping: true, // Billing and shipping addresses are the same

        // Shipping address - exact field names from API docs
        shippingAddress: {
          firstName: firstName,
          lastName: lastName,
          addressLine1: order.shippingAddress.addressLine1,
          addressLine2: order.shippingAddress.addressLine2 || "",
          city: order.shippingAddress.city,
          state: order.shippingAddress.state,
          pinCode: order.shippingAddress.pincode,
          phone: order.shippingAddress.phone.replace(/^\+/, ""), // Remove leading + symbol
          email: order.user?.email || ""
        },

        // Billing address (same as shipping) - exact field names from API docs
        billingAddress: {
          firstName: firstName,
          lastName: lastName,
          addressLine1: order.shippingAddress.addressLine1,
          addressLine2: order.shippingAddress.addressLine2 || "",
          city: order.shippingAddress.city,
          state: order.shippingAddress.state,
          pinCode: order.shippingAddress.pincode,
          phone: order.shippingAddress.phone.replace(/^\+/, ""), // Remove leading + symbol
          email: order.user?.email || ""
        },

        // Order items - exact field names from API docs
        orderItems: order.items.map((item: any) => {
          // Calculate GST amount from tax-inclusive price (18% GST)
          // Formula: GST amount = price × (0.18 / 1.18)
          const taxAmount = parseFloat((item.price * (0.18 / 1.18)).toFixed(2));
          console.log(`Item: ${item.productTitle}, unitPrice:`, item.price, 'Tax amount:', taxAmount);
          return {
            itemName: item.productTitle,
            sku: item.sku || item.variant, // Use SKU field for new orders, fallback to variant
            units: item.quantity,
            unitPrice: item.price, // Tax-inclusive price (as number)
            tax: taxAmount, // GST amount in rupees (as number)
            hsn: "39269099" // HSN code for vinyl skins/stickers
          };
        }),

        // Payment details - exact field names from API docs (as numbers)
        paymentMethod: paymentMethod,
        shippingCharges: order.shippingFee,
        totalDiscount: totalDiscount,
        // Note: RapidShyp wants EITHER totalOrderValue OR unitPrice per item, not both
        // We're using unitPrice at item level, so we omit totalOrderValue
        
        // COD amount (only for COD orders)
        ...(paymentMethod === "COD" && { codValue }),

        // Package details - nested object as per API docs (dimensions in cm, weight in grams)
        packageDetails: {
          packageLength: avgLength,
          packageBreadth: avgBreadth,
          packageHeight: avgHeight,
          packageWeight: packageWeightInGrams
        }
      };

      // Log payload for debugging
      console.log("=== RapidShyp API Request ===");
      console.log("URL:", config.apiUrl);
      console.log("Payload:", JSON.stringify(shipmentPayload, null, 2));
      
      // Specifically verify pricing fields are present and their types
      console.log("=== Pricing Fields Check ===");
      console.log("shippingCharges:", shipmentPayload.shippingCharges, "Type:", typeof shipmentPayload.shippingCharges);
      console.log("totalDiscount:", shipmentPayload.totalDiscount, "Type:", typeof shipmentPayload.totalDiscount);
      console.log("Using item-level unitPrice (totalOrderValue omitted per RapidShyp requirements)");
      
      const items = shipmentPayload.orderItems as Array<{itemName: string; unitPrice?: number; tax?: number}>;
      console.log("Number of items:", items.length);
      items.forEach((item, idx) => {
        console.log(`Item ${idx}: ${item.itemName}`);
        console.log(`  unitPrice:`, item.unitPrice, "Type:", typeof item.unitPrice);
        console.log(`  tax:`, item.tax, "Type:", typeof item.tax);
      });

      // Make API request to RapidShyp using the configured URL
      const response = await fetch(config.apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "rapidshyp-token": config.apiKey,
        },
        body: JSON.stringify(shipmentPayload),
      });

      console.log("=== RapidShyp API Response ===");
      console.log("Status:", response.status, response.statusText);
      console.log("Content-Type:", response.headers.get("content-type"));

      if (!response.ok) {
        const errorText = await response.text();
        console.error("=== RapidShyp API Error ===");
        console.error("Status:", response.status);
        console.error("Raw Response:", errorText);
        
        // Try to parse error as JSON for detailed error information
        let errorMessage = `RapidShyp API error (${response.status})`;
        let errorDetails: Record<string, unknown> = {};
        
        try {
          const errorJson = JSON.parse(errorText);
          console.error("Parsed Error JSON:", JSON.stringify(errorJson, null, 2));
          
          errorDetails = errorJson;
          
          // Extract error message from various possible fields
          if (errorJson.message) {
            errorMessage = errorJson.message;
          } else if (errorJson.error) {
            errorMessage = typeof errorJson.error === 'string' 
              ? errorJson.error 
              : JSON.stringify(errorJson.error);
          } else if (errorJson.errors) {
            // Handle validation errors array
            errorMessage = Array.isArray(errorJson.errors)
              ? errorJson.errors.map((e: { field?: string; message?: string }) => 
                  e.field ? `${e.field}: ${e.message}` : e.message || JSON.stringify(e)
                ).join(", ")
              : JSON.stringify(errorJson.errors);
          } else if (errorJson.details) {
            errorMessage = typeof errorJson.details === 'string'
              ? errorJson.details
              : JSON.stringify(errorJson.details);
          } else {
            // Show the entire error object if no standard field found
            errorMessage = JSON.stringify(errorJson);
          }
        } catch (parseError) {
          console.error("Could not parse error as JSON:", parseError);
          // If not JSON, use the raw text
          errorMessage = errorText || errorMessage;
        }

        console.error("Final Error Message:", errorMessage);
        console.error("Error Details:", JSON.stringify(errorDetails, null, 2));

        throw new ConvexError({
          message: errorMessage,
          code: "EXTERNAL_SERVICE_ERROR",
        });
      }

      const result = await response.json() as { 
        status?: string;
        remarks?: string;
        orderId?: string;
        orderCreated?: boolean;
        shipment?: Array<{
          shipmentId?: string;
          tracking_link?: string;
          awb?: string;
          courierName?: string;
          labelURL?: string;
          awbGenerated?: boolean;
          labelGenerated?: boolean;
          pickupScheduled?: boolean;
        }>;
        message?: string;
      };
      
      console.log("=== RapidShyp API Success ===");
      console.log("Full Response:", JSON.stringify(result, null, 2));

      // Extract AWB number and shipment details from RapidShyp response
      // RapidShyp returns an array of shipments, we take the first one
      const shipment = result.shipment?.[0];
      
      if (!shipment) {
        console.error("No shipment data in response:", result);
        throw new ConvexError({
          message: "RapidShyp did not return shipment data. Please check the API response.",
          code: "EXTERNAL_SERVICE_ERROR",
        });
      }

      const awbNumber = shipment.awb;
      const shipmentId = shipment.shipmentId;
      const trackingUrl = shipment.tracking_link;
      const labelUrl = shipment.labelURL;
      const courierName = shipment.courierName;

      if (!awbNumber) {
        console.error("No AWB number in shipment:", shipment);
        throw new ConvexError({
          message: "RapidShyp did not return an AWB number. Please check the API response.",
          code: "EXTERNAL_SERVICE_ERROR",
        });
      }

      console.log("Extracted shipment details:");
      console.log("  AWB:", awbNumber);
      console.log("  Shipment ID:", shipmentId);
      console.log("  Tracking URL:", trackingUrl);
      console.log("  Courier:", courierName);
      console.log("  Label URL:", labelUrl);

      // Update order with shipping information
      await ctx.runMutation(api.admin.orders.updateShippingInfo, {
        orderId: args.orderId,
        awbNumber,
        trackingUrl: trackingUrl || `https://app.rapidshyp.com/t/${awbNumber}`,
        shippingStatus: "Shipment Created",
        courierName,
        labelUrl,
      });

      return {
        success: true,
        awbNumber,
        shipmentId,
        trackingUrl,
        labelUrl,
        courierName,
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
    orderId: v.id("orders"),
  },
  handler: async (ctx, args): Promise<{ success: boolean; message: string; orderNumber?: string }> => {
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

      if (!order.awbNumber) {
        throw new ConvexError({
          message: "Order has no shipment to cancel",
          code: "BAD_REQUEST",
        });
      }

      const config = getRapidShypConfig();

      // Make API request to cancel shipment
      const response = await fetch(
        `${config.apiUrl}/v1/external/orders/cancel/${order.awbNumber}`,
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

      // Clear all shipping data and reset status to Processing
      await ctx.runMutation(api.admin.orders.updateShippingInfo, {
        orderId: args.orderId,
        awbNumber: "",
        trackingUrl: "",
        courierName: "",
        labelUrl: "",
        shippingStatus: "",
      });

      // Change order status back to Processing
      await ctx.runMutation(api.admin.orders.updateOrderStatus, {
        orderId: args.orderId,
        status: "processing",
      });

      return {
        success: true,
        message: "Shipment cancelled successfully",
        orderNumber: order.orderNumber,
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

// Bulk cancel shipments for multiple orders
export const bulkCancelShipments = action({
  args: {
    orderIds: v.array(v.id("orders")),
  },
  handler: async (ctx, args) => {
    const successful: Array<{ orderNumber: string; orderId: string }> = [];
    const failed: Array<{ orderNumber: string; orderId: string; error: string }> = [];

    // Process each order
    for (const orderId of args.orderIds) {
      try {
        const result = await ctx.runAction(api.rapidshyp.cancelShipment, {
          orderId,
        });

        if (result.success) {
          successful.push({
            orderNumber: result.orderNumber || orderId,
            orderId,
          });
        }
      } catch (error) {
        // Get order details for error reporting
        try {
          const order = await ctx.runQuery(api.admin.orders.getOrderDetails, {
            orderId,
          });
          failed.push({
            orderNumber: order?.orderNumber || orderId,
            orderId,
            error:
              error instanceof Error
                ? error.message
                : "Failed to cancel shipment",
          });
        } catch {
          failed.push({
            orderNumber: orderId,
            orderId,
            error:
              error instanceof Error
                ? error.message
                : "Failed to cancel shipment",
          });
        }
      }
    }

    return {
      successful,
      failed,
    };
  },
});

// Bulk create shipments for multiple orders
export const bulkCreateShipments = action({
  args: {
    orderIds: v.array(v.id("orders")),
  },
  handler: async (ctx, args) => {
    const results: {
      successful: Array<{ orderId: Id<"orders">; orderNumber: string; awbNumber: string }>;
      failed: Array<{ orderId: Id<"orders">; orderNumber: string; error: string }>;
    } = {
      successful: [],
      failed: [],
    };

    // Process each order sequentially
    for (const orderId of args.orderIds) {
      try {
        // Get order details first to check if it's valid for shipping
        const order = await ctx.runQuery(api.admin.orders.getOrderDetails, {
          orderId,
        });

        // Validate order is in processing status and doesn't have AWB
        if (order.status !== "processing") {
          results.failed.push({
            orderId,
            orderNumber: order.orderNumber || order.failedOrderNumber || "Pending",
            error: `Order status is ${order.status}, must be processing`,
          });
          continue;
        }

        if (order.awbNumber) {
          results.failed.push({
            orderId,
            orderNumber: order.orderNumber || order.failedOrderNumber || "Pending",
            error: "Shipment already created",
          });
          continue;
        }

        // Create shipment
        const result = await ctx.runAction(api.rapidshyp.createShipment, {
          orderId,
        });

        if (result.success && result.awbNumber) {
          results.successful.push({
            orderId,
            orderNumber: order.orderNumber || order.failedOrderNumber || "Pending",
            awbNumber: result.awbNumber,
          });
        } else {
          results.failed.push({
            orderId,
            orderNumber: order.orderNumber || order.failedOrderNumber || "Pending",
            error: result.message || "Unknown error",
          });
        }
      } catch (error) {
        // Get order number for error reporting
        let orderNumber = "Unknown";
        try {
          const order = await ctx.runQuery(api.admin.orders.getOrderDetails, {
            orderId,
          });
          orderNumber = order.orderNumber || order.failedOrderNumber || "Pending";
        } catch {
          // Ignore error getting order number
        }

        results.failed.push({
          orderId,
          orderNumber,
          error: error instanceof Error ? error.message : "Failed to create shipment",
        });
      }
    }

    return results;
  },
});

// Bulk fetch label PDFs for multiple orders (fetches actual PDF bytes to bypass CORS)
export const bulkFetchLabels = action({
  args: {
    orderIds: v.array(v.id("orders")),
  },
  handler: async (ctx, args) => {
    const labels: Array<{
      orderId: Id<"orders">;
      orderNumber: string;
      pdfBase64: string;
    }> = [];
    const errors: Array<{
      orderId: Id<"orders">;
      orderNumber: string;
      error: string;
    }> = [];

    // Process each order
    for (const orderId of args.orderIds) {
      try {
        const order = await ctx.runQuery(api.admin.orders.getOrderDetails, {
          orderId,
        });

        // Validate order has label URL
        if (!order.labelUrl) {
          errors.push({
            orderId,
            orderNumber: order.orderNumber || order.failedOrderNumber || "Pending",
            error: "No label URL found",
          });
          continue;
        }

        console.log(`Fetching label for ${order.orderNumber || order.failedOrderNumber || "Pending"} from ${order.labelUrl}`);

        // Fetch the PDF from RapidShyp (backend has no CORS restrictions)
        const response = await fetch(order.labelUrl, {
          method: 'GET',
          redirect: 'follow',
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        // Get PDF bytes
        const pdfBuffer = await response.arrayBuffer();
        
        if (pdfBuffer.byteLength === 0) {
          throw new Error('Empty PDF file');
        }

        console.log(`Fetched ${pdfBuffer.byteLength} bytes for ${order.orderNumber || order.failedOrderNumber || "Pending"}`);

        // Convert to base64 for transport to frontend
        const pdfBase64 = Buffer.from(pdfBuffer).toString('base64');

        labels.push({
          orderId,
          orderNumber: order.orderNumber || order.failedOrderNumber || "Pending",
          pdfBase64,
        });
      } catch (error) {
        // Get order number for error reporting
        let orderNumber = "Unknown";
        try {
          const order = await ctx.runQuery(api.admin.orders.getOrderDetails, {
            orderId,
          });
          orderNumber = order.orderNumber || order.failedOrderNumber || "Pending";
        } catch {
          // Ignore error getting order number
        }

        const errorMsg = error instanceof Error ? error.message : "Failed to fetch label";
        console.error(`Failed to fetch label for ${orderNumber}:`, errorMsg);

        errors.push({
          orderId,
          orderNumber,
          error: errorMsg,
        });
      }
    }

    return { labels, errors };
  },
});
