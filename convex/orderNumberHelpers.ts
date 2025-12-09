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

    let currentValue = 4001;
    if (counter) {
      currentValue = counter.value as number;
    } else {
      // Initialize
      await ctx.db.insert("settings", {
        key: "order_counter",
        value: 4001,
      });
    }

    const orderNumber = `#${currentValue}`;
    
    // Increment counter
    if (counter) {
      await ctx.db.patch(counter._id, {
        value: currentValue + 1,
      });
    }

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

    let currentValue = 1;
    if (counter) {
      currentValue = counter.value as number;
    } else {
      // Initialize
      await ctx.db.insert("settings", {
        key: counterKey,
        value: 1,
      });
    }

    const failedOrderNumber = `F${yearSuffix}-${String(currentValue).padStart(3, "0")}`;
    
    // Increment counter
    if (counter) {
      await ctx.db.patch(counter._id, {
        value: currentValue + 1,
      });
    }

    return failedOrderNumber;
  },
});
