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
import type * as cashbackHelpers from "../cashbackHelpers.js";
import type * as checkoutUpsells from "../checkoutUpsells.js";
import type * as cod from "../cod.js";
import type * as codDisplayRules from "../codDisplayRules.js";
import type * as codOtp from "../codOtp.js";
import type * as collections from "../collections.js";
import type * as coupons from "../coupons.js";
import type * as emailManagement from "../emailManagement.js";
import type * as emailMessaging from "../emailMessaging.js";
import type * as emailOrderTriggers from "../emailOrderTriggers.js";
import type * as emailSeed from "../emailSeed.js";
import type * as emailTemplates from "../emailTemplates.js";
import type * as emailWorker from "../emailWorker.js";
import type * as emailWorkerInternal from "../emailWorkerInternal.js";
import type * as ensureGadgetCategory from "../ensureGadgetCategory.js";
import type * as exports from "../exports.js";
import type * as finishTypes from "../finishTypes.js";
import type * as fixCoupon from "../fixCoupon.js";
import type * as fixOrderReceivedMapping from "../fixOrderReceivedMapping.js";
import type * as googleDriveImport from "../googleDriveImport.js";
import type * as googleDriveImportPublic from "../googleDriveImportPublic.js";
import type * as gst from "../gst.js";
import type * as http from "../http.js";
import type * as loginOtp from "../loginOtp.js";
import type * as migrateFinishTypeField from "../migrateFinishTypeField.js";
import type * as migrateGst from "../migrateGst.js";
import type * as migrateOpenAIKey from "../migrateOpenAIKey.js";
import type * as migrateOrderStatuses from "../migrateOrderStatuses.js";
import type * as migrateProductFields from "../migrateProductFields.js";
import type * as migrateShippingFields from "../migrateShippingFields.js";
import type * as migration from "../migration.js";
import type * as migrationInternal from "../migrationInternal.js";
import type * as mockups from "../mockups.js";
import type * as mockupsUpload from "../mockupsUpload.js";
import type * as modelCache from "../modelCache.js";
import type * as modelRequests from "../modelRequests.js";
import type * as orderNumberHelpers from "../orderNumberHelpers.js";
import type * as orders from "../orders.js";
import type * as phoneCollections from "../phoneCollections.js";
import type * as phoneCollectionsHelpers from "../phoneCollectionsHelpers.js";
import type * as phoneCollectionsQueries from "../phoneCollectionsQueries.js";
import type * as phonepe from "../phonepe.js";
import type * as productClassification from "../productClassification.js";
import type * as products from "../products.js";
import type * as rapidshyp from "../rapidshyp.js";
import type * as rapidshypWebhook from "../rapidshypWebhook.js";
import type * as reviews from "../reviews.js";
import type * as rollsManagement from "../rollsManagement.js";
import type * as runMigration from "../runMigration.js";
import type * as seedModels from "../seedModels.js";
import type * as seoContentGenerator from "../seoContentGenerator.js";
import type * as seoPages from "../seoPages.js";
import type * as seoProductGenerator from "../seoProductGenerator.js";
import type * as seoTemplates from "../seoTemplates.js";
import type * as settings from "../settings.js";
import type * as shipping from "../shipping.js";
import type * as shopify from "../shopify.js";
import type * as sitemap from "../sitemap.js";
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
  cashbackHelpers: typeof cashbackHelpers;
  checkoutUpsells: typeof checkoutUpsells;
  cod: typeof cod;
  codDisplayRules: typeof codDisplayRules;
  codOtp: typeof codOtp;
  collections: typeof collections;
  coupons: typeof coupons;
  emailManagement: typeof emailManagement;
  emailMessaging: typeof emailMessaging;
  emailOrderTriggers: typeof emailOrderTriggers;
  emailSeed: typeof emailSeed;
  emailTemplates: typeof emailTemplates;
  emailWorker: typeof emailWorker;
  emailWorkerInternal: typeof emailWorkerInternal;
  ensureGadgetCategory: typeof ensureGadgetCategory;
  exports: typeof exports;
  finishTypes: typeof finishTypes;
  fixCoupon: typeof fixCoupon;
  fixOrderReceivedMapping: typeof fixOrderReceivedMapping;
  googleDriveImport: typeof googleDriveImport;
  googleDriveImportPublic: typeof googleDriveImportPublic;
  gst: typeof gst;
  http: typeof http;
  loginOtp: typeof loginOtp;
  migrateFinishTypeField: typeof migrateFinishTypeField;
  migrateGst: typeof migrateGst;
  migrateOpenAIKey: typeof migrateOpenAIKey;
  migrateOrderStatuses: typeof migrateOrderStatuses;
  migrateProductFields: typeof migrateProductFields;
  migrateShippingFields: typeof migrateShippingFields;
  migration: typeof migration;
  migrationInternal: typeof migrationInternal;
  mockups: typeof mockups;
  mockupsUpload: typeof mockupsUpload;
  modelCache: typeof modelCache;
  modelRequests: typeof modelRequests;
  orderNumberHelpers: typeof orderNumberHelpers;
  orders: typeof orders;
  phoneCollections: typeof phoneCollections;
  phoneCollectionsHelpers: typeof phoneCollectionsHelpers;
  phoneCollectionsQueries: typeof phoneCollectionsQueries;
  phonepe: typeof phonepe;
  productClassification: typeof productClassification;
  products: typeof products;
  rapidshyp: typeof rapidshyp;
  rapidshypWebhook: typeof rapidshypWebhook;
  reviews: typeof reviews;
  rollsManagement: typeof rollsManagement;
  runMigration: typeof runMigration;
  seedModels: typeof seedModels;
  seoContentGenerator: typeof seoContentGenerator;
  seoPages: typeof seoPages;
  seoProductGenerator: typeof seoProductGenerator;
  seoTemplates: typeof seoTemplates;
  settings: typeof settings;
  shipping: typeof shipping;
  shopify: typeof shopify;
  sitemap: typeof sitemap;
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
