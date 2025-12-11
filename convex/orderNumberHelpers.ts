import { mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";

// Get or initialize order counter
export const getOrderCounter = internalMutation({
  args: {},
  handler: async (ctx) => {
    const counter = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "order_counter"))
      .first();

    if (!counter) {
      // Initialize at 4001
      await ctx.db.insert("settings", {
        key: "order_counter",
        value: 4001,
      });
      return 4001;
    }

    return counter.value as number;
  },
});

// Get or initialize failed order counter
export const getFailedOrderCounter = internalMutation({
  args: {},
  handler: async (ctx) => {
    const currentYear = new Date().getFullYear();
    const yearSuffix = currentYear.toString().slice(-2); // Get last 2 digits
    const counterKey = `failed_order_counter_${yearSuffix}`;

    const counter = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", counterKey))
      .first();

    if (!counter) {
      // Initialize at 1
      await ctx.db.insert("settings", {
        key: counterKey,
        value: 1,
      });
      return { counter: 1, yearSuffix };
    }

    return { counter: counter.value as number, yearSuffix };
  },
});

// Generate next sequential order number
export const generateOrderNumber = internalMutation({
  args: {},
  handler: async (ctx) => {
    const counter = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "order_counter"))
      .first();

    let nextValue: number;
    if (counter) {
      // Read current value and immediately increment it
      const currentValue = counter.value as number;
      nextValue = currentValue + 1;
      await ctx.db.patch(counter._id, {
        value: nextValue,
      });
    } else {
      // Initialize with 4001 as the first order number
      nextValue = 4001;
      await ctx.db.insert("settings", {
        key: "order_counter",
        value: nextValue + 1, // Set counter to 4002 for next order
      });
    }

    const orderNumber = `#${nextValue}`;
    return orderNumber;
  },
});

// Generate failed order number
export const generateFailedOrderNumber = internalMutation({
  args: {},
  handler: async (ctx) => {
    const currentYear = new Date().getFullYear();
    const yearSuffix = currentYear.toString().slice(-2);
    const counterKey = `failed_order_counter_${yearSuffix}`;

    const counter = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", counterKey))
      .first();

    let nextValue: number;
    if (counter) {
      // Read current value and immediately increment it
      const currentValue = counter.value as number;
      nextValue = currentValue + 1;
      await ctx.db.patch(counter._id, {
        value: nextValue,
      });
    } else {
      // Initialize with 1 as the first failed order number
      nextValue = 1;
      await ctx.db.insert("settings", {
        key: counterKey,
        value: nextValue + 1, // Set counter to 2 for next failed order
      });
    }

    const failedOrderNumber = `F${yearSuffix}-${String(nextValue).padStart(3, "0")}`;
    return failedOrderNumber;
  },
});

// Generate model request number
export const generateModelRequestNumber = internalMutation({
  args: {},
  handler: async (ctx) => {
    const counterKey = "model_request_counter";

    const counter = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", counterKey))
      .first();

    let nextValue: number;
    if (counter) {
      // Read current value and immediately increment it
      const currentValue = counter.value as number;
      nextValue = currentValue + 1;
      await ctx.db.patch(counter._id, {
        value: nextValue,
      });
    } else {
      // Initialize with 1 as the first model request number
      nextValue = 1;
      await ctx.db.insert("settings", {
        key: counterKey,
        value: nextValue + 1, // Set counter to 2 for next request
      });
    }

    const requestNumber = `MR-${String(nextValue).padStart(2, "0")}`;
    return requestNumber;
  },
});
