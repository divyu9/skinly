import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

/**
 * Abandoned Cart System - Automated Jobs
 *
 * 1. Scan for new abandoned carts every 30 minutes
 * 2. Process abandoned carts that need reminders every 30 minutes
 */

// Scan for new abandoned carts every 30 minutes
crons.interval(
  "scan-abandoned-carts",
  { minutes: 30 },
  internal.abandonedCartsInternal.scheduledScanAbandonedCarts
);

// Process abandoned carts that need reminders every 30 minutes
crons.interval(
  "process-abandoned-cart-reminders",
  { minutes: 30 },
  internal.abandonedCartsInternal.scheduledProcessReminders
);

export default crons;
