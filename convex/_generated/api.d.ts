/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as cart from "../cart.js";
import type * as collections from "../collections.js";
import type * as coupons from "../coupons.js";
import type * as fixCoupon from "../fixCoupon.js";
import type * as migration from "../migration.js";
import type * as migrationInternal from "../migrationInternal.js";
import type * as mockups from "../mockups.js";
import type * as orders from "../orders.js";
import type * as products from "../products.js";
import type * as reviews from "../reviews.js";
import type * as shopify from "../shopify.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  cart: typeof cart;
  collections: typeof collections;
  coupons: typeof coupons;
  fixCoupon: typeof fixCoupon;
  migration: typeof migration;
  migrationInternal: typeof migrationInternal;
  mockups: typeof mockups;
  orders: typeof orders;
  products: typeof products;
  reviews: typeof reviews;
  shopify: typeof shopify;
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
