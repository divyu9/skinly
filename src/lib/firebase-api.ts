/**
 * The Convex-shaped `api` object, backed by Firestore.
 *
 * Every access builds a dotted path — `api.cart.getCart` is the string
 * "cart.getCart" — which the hooks in firebase-hooks.tsx dispatch on.
 *
 * The proxy wraps a function, so without the cast below TypeScript infers the
 * whole thing as `() => void` and every single call site is an error:
 * "Property 'cart' does not exist on type '() => void'". That was 1,100 of the
 * project's 1,259 type errors, which is enough noise to make the typecheck
 * unreadable — and an unread typecheck is how an undefined component reached
 * production.
 */

/** Any depth of property access is a valid path, and every leaf is a ref. */
export interface ApiRef {
  readonly [segment: string]: ApiRef;
}

const createProxy = (path: string[] = []): ApiRef =>
  new Proxy((() => {}) as unknown as ApiRef, {
    get(target, prop) {
      if (prop === Symbol.toPrimitive) return () => path.join(".");
      if (prop === "toString" || prop === "valueOf") return () => path.join(".");
      if (typeof prop === "string") return createProxy([...path, prop]);
      return Reflect.get(target, prop);
    },
    apply() {
      return path.join(".");
    },
  });

export const api: ApiRef = createProxy();
export type Id<T extends string> = string;
