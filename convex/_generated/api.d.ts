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
import type * as admin_orders from "../admin/orders.js";
import type * as cart from "../cart.js";
import type * as collections from "../collections.js";
import type * as coupons from "../coupons.js";
import type * as exports from "../exports.js";
import type * as fixCoupon from "../fixCoupon.js";
import type * as gst from "../gst.js";
import type * as http from "../http.js";
import type * as migrateGst from "../migrateGst.js";
import type * as migration from "../migration.js";
import type * as migrationInternal from "../migrationInternal.js";
import type * as mockups from "../mockups.js";
import type * as mockupsUpload from "../mockupsUpload.js";
import type * as orders from "../orders.js";
import type * as phonepe from "../phonepe.js";
import type * as products from "../products.js";
import type * as rapidshyp from "../rapidshyp.js";
import type * as reviews from "../reviews.js";
import type * as settings from "../settings.js";
import type * as shopify from "../shopify.js";
import type * as stockNotifications from "../stockNotifications.js";
import type * as stockNotificationsActions from "../stockNotificationsActions.js";
import type * as supportedModels from "../supportedModels.js";
import type * as updateCollectionRules from "../updateCollectionRules.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  abandonedCarts: typeof abandonedCarts;
  abandonedCartsActions: typeof abandonedCartsActions;
  "admin/orders": typeof admin_orders;
  cart: typeof cart;
  collections: typeof collections;
  coupons: typeof coupons;
  exports: typeof exports;
  fixCoupon: typeof fixCoupon;
  gst: typeof gst;
  http: typeof http;
  migrateGst: typeof migrateGst;
  migration: typeof migration;
  migrationInternal: typeof migrationInternal;
  mockups: typeof mockups;
  mockupsUpload: typeof mockupsUpload;
  orders: typeof orders;
  phonepe: typeof phonepe;
  products: typeof products;
  rapidshyp: typeof rapidshyp;
  reviews: typeof reviews;
  settings: typeof settings;
  shopify: typeof shopify;
  stockNotifications: typeof stockNotifications;
  stockNotificationsActions: typeof stockNotificationsActions;
  supportedModels: typeof supportedModels;
  updateCollectionRules: typeof updateCollectionRules;
  users: typeof users;
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
