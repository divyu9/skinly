/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as abandonedCarts from "../abandonedCarts.js";
import type * as abandonedCartsActions from "../abandonedCartsActions.js";
import type * as admin_bugReports from "../admin/bugReports.js";
import type * as admin_manualTracking from "../admin/manualTracking.js";
import type * as admin_orders from "../admin/orders.js";
import type * as admin_setAdmin from "../admin/setAdmin.js";
import type * as bugReports from "../bugReports.js";
import type * as cart from "../cart.js";
import type * as cashback from "../cashback.js";
import type * as cod from "../cod.js";
import type * as codDisplayRules from "../codDisplayRules.js";
import type * as codOtp from "../codOtp.js";
import type * as collections from "../collections.js";
import type * as coupons from "../coupons.js";
import type * as emailActions from "../emailActions.js";
import type * as emailActionsInternal from "../emailActionsInternal.js";
import type * as emailTemplateActions from "../emailTemplateActions.js";
import type * as emailTemplateManagement from "../emailTemplateManagement.js";
import type * as emailTemplates from "../emailTemplates.js";
import type * as ensureGadgetCategory from "../ensureGadgetCategory.js";
import type * as exports from "../exports.js";
import type * as fixCoupon from "../fixCoupon.js";
import type * as googleDriveImport from "../googleDriveImport.js";
import type * as googleDriveImportPublic from "../googleDriveImportPublic.js";
import type * as gst from "../gst.js";
import type * as http from "../http.js";
import type * as loginOtp from "../loginOtp.js";
import type * as migrateGst from "../migrateGst.js";
import type * as migrateOrderStatuses from "../migrateOrderStatuses.js";
import type * as migrateProductFields from "../migrateProductFields.js";
import type * as migrateShippingFields from "../migrateShippingFields.js";
import type * as migration from "../migration.js";
import type * as migrationInternal from "../migrationInternal.js";
import type * as mockups from "../mockups.js";
import type * as mockupsUpload from "../mockupsUpload.js";
import type * as modelCache from "../modelCache.js";
import type * as modelRequests from "../modelRequests.js";
import type * as orders from "../orders.js";
import type * as phoneCollections from "../phoneCollections.js";
import type * as phoneCollectionsHelpers from "../phoneCollectionsHelpers.js";
import type * as phoneCollectionsQueries from "../phoneCollectionsQueries.js";
import type * as phonepe from "../phonepe.js";
import type * as products from "../products.js";
import type * as rapidshyp from "../rapidshyp.js";
import type * as reviews from "../reviews.js";
import type * as rollsManagement from "../rollsManagement.js";
import type * as runMigration from "../runMigration.js";
import type * as seedModels from "../seedModels.js";
import type * as settings from "../settings.js";
import type * as shopify from "../shopify.js";
import type * as stockNotifications from "../stockNotifications.js";
import type * as stockNotificationsActions from "../stockNotificationsActions.js";
import type * as supportedModels from "../supportedModels.js";
import type * as updateCollectionRules from "../updateCollectionRules.js";
import type * as uploadJobs from "../uploadJobs.js";
import type * as users from "../users.js";
import type * as wallet from "../wallet.js";
import type * as whatsapp from "../whatsapp.js";
import type * as whatsappActions from "../whatsappActions.js";
import type * as whatsappAutoFix from "../whatsappAutoFix.js";
import type * as whatsappConsent from "../whatsappConsent.js";
import type * as whatsappDebugLogs from "../whatsappDebugLogs.js";
import type * as whatsappHealthCheck from "../whatsappHealthCheck.js";
import type * as whatsappMessaging from "../whatsappMessaging.js";
import type * as whatsappSeed from "../whatsappSeed.js";
import type * as whatsappWorker from "../whatsappWorker.js";
import type * as whatsappWorkerInternal from "../whatsappWorkerInternal.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  abandonedCarts: typeof abandonedCarts;
  abandonedCartsActions: typeof abandonedCartsActions;
  "admin/bugReports": typeof admin_bugReports;
  "admin/manualTracking": typeof admin_manualTracking;
  "admin/orders": typeof admin_orders;
  "admin/setAdmin": typeof admin_setAdmin;
  bugReports: typeof bugReports;
  cart: typeof cart;
  cashback: typeof cashback;
  cod: typeof cod;
  codDisplayRules: typeof codDisplayRules;
  codOtp: typeof codOtp;
  collections: typeof collections;
  coupons: typeof coupons;
  emailActions: typeof emailActions;
  emailActionsInternal: typeof emailActionsInternal;
  emailTemplateActions: typeof emailTemplateActions;
  emailTemplateManagement: typeof emailTemplateManagement;
  emailTemplates: typeof emailTemplates;
  ensureGadgetCategory: typeof ensureGadgetCategory;
  exports: typeof exports;
  fixCoupon: typeof fixCoupon;
  googleDriveImport: typeof googleDriveImport;
  googleDriveImportPublic: typeof googleDriveImportPublic;
  gst: typeof gst;
  http: typeof http;
  loginOtp: typeof loginOtp;
  migrateGst: typeof migrateGst;
  migrateOrderStatuses: typeof migrateOrderStatuses;
  migrateProductFields: typeof migrateProductFields;
  migrateShippingFields: typeof migrateShippingFields;
  migration: typeof migration;
  migrationInternal: typeof migrationInternal;
  mockups: typeof mockups;
  mockupsUpload: typeof mockupsUpload;
  modelCache: typeof modelCache;
  modelRequests: typeof modelRequests;
  orders: typeof orders;
  phoneCollections: typeof phoneCollections;
  phoneCollectionsHelpers: typeof phoneCollectionsHelpers;
  phoneCollectionsQueries: typeof phoneCollectionsQueries;
  phonepe: typeof phonepe;
  products: typeof products;
  rapidshyp: typeof rapidshyp;
  reviews: typeof reviews;
  rollsManagement: typeof rollsManagement;
  runMigration: typeof runMigration;
  seedModels: typeof seedModels;
  settings: typeof settings;
  shopify: typeof shopify;
  stockNotifications: typeof stockNotifications;
  stockNotificationsActions: typeof stockNotificationsActions;
  supportedModels: typeof supportedModels;
  updateCollectionRules: typeof updateCollectionRules;
  uploadJobs: typeof uploadJobs;
  users: typeof users;
  wallet: typeof wallet;
  whatsapp: typeof whatsapp;
  whatsappActions: typeof whatsappActions;
  whatsappAutoFix: typeof whatsappAutoFix;
  whatsappConsent: typeof whatsappConsent;
  whatsappDebugLogs: typeof whatsappDebugLogs;
  whatsappHealthCheck: typeof whatsappHealthCheck;
  whatsappMessaging: typeof whatsappMessaging;
  whatsappSeed: typeof whatsappSeed;
  whatsappWorker: typeof whatsappWorker;
  whatsappWorkerInternal: typeof whatsappWorkerInternal;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
