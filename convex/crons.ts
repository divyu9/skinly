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

/**
 * Cloudinary → R2 Migration - Automated Jobs
 *
 * Phase 1 (Critical): Site logos, product images, collections
 * Phase 2 (Background): Mockups (~9K images), media library
 *
 * Runs every 5 minutes during migration period
 * Comment out or remove after migration is complete
 */

// MIGRATION COMPLETE - disabled 2026-04-02
// crons.interval(
//   "migrate-cloudinary-to-r2-phase1",
//   { minutes: 5 },
//   internal.migrateCloudinaryToR2Batch.autoMigrateCron,
//   { phase: "phase1" }
// );

// PHASE 2: Mockups migration (uncomment after Phase 1 is complete)
// crons.interval(
//   "migrate-cloudinary-to-r2-phase2",
//   { minutes: 5 },
//   internal.migrateCloudinaryToR2Batch.autoMigrateCron,
//   { phase: "phase2" }
// );

export default crons;
