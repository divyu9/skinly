import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';


/**
 * The order a product's variants are offered in.
 *
 * Firestore returns them in document-id order, which is random: a laptop
 * listing could open on "Top + Keyboard Area" with "Only Top" to its right.
 * The keyboard view spends two sheets, so a design with one sheet left opened
 * on a variant it cannot make and read as sold out. Smallest material first,
 * then cheapest, then oldest — which puts "Only Top" first on every laptop and
 * leaves same-priced lists (phone models) in the order they were added.
 */
export function sortVariants<T extends { materialMultiplier?: any; price?: any; _creationTime?: any }>(list: T[]): T[] {
  return [...list].sort((a, b) =>
    (Number(a.materialMultiplier) || 1) - (Number(b.materialMultiplier) || 1) ||
    (Number(a.price) || 0) - (Number(b.price) || 0) ||
    (Number(a._creationTime) || 0) - (Number(b._creationTime) || 0)
  );
}

// Helper to resolve the string path from the proxy
export const getPath = (apiRef: any) => String(apiRef);


/*
 * First answers the build already knew, handed over in the homepage's HTML.
 *
 * The hero waited for a 1.2 MB bundle, then for Firestore to say which
 * sections exist, then for Firestore to say which slides — and showed
 * skeletons all that while, although the build had read exactly those rows a
 * few minutes earlier to write the page. A query listed here starts from what
 * the build saw and is replaced by the live answer the moment it arrives, so
 * the first render can draw the real hero. Argument-free queries only: there
 * is nothing to match against otherwise.
 */
let homeSeed: Record<string, unknown> | null | undefined;
const SEEDABLE = new Set(['homepage.getActiveHeroSlides', 'homepage.getActiveHomepageSections', 'homepage.getHomepageSettings']);
/*
 * A product page's own listing, written into the page by the build
 * (scripts/prerender.mjs, `__seed` with a `product`). Without it the page
 * waited on Firestore, and when that request failed — as it does for
 * Googlebot's renderer — it said "Product not found" over a real product:
 * Search Console filed those pages as Soft 404. Only for the slug it was
 * written for; the live query still runs and replaces it.
 */
let productSeed: { slug: string; product: any } | null | undefined;
function seededProduct(slug: unknown): any {
  if (productSeed === undefined) {
    try {
      const el = typeof document !== 'undefined' ? document.getElementById('__seed') : null;
      const seed = el?.textContent ? JSON.parse(el.textContent) : null;
      productSeed = seed?.product && seed?.slug ? { slug: seed.slug, product: seed.product } : null;
    } catch {
      productSeed = null;
    }
  }
  if (!productSeed || productSeed.slug !== slug) return undefined;
  const { variants = [], ...rest } = productSeed.product;
  return { ...rest, variants: sortVariants(variants) };
}

/*
 * Product pages opened from inside the site, filled in before they open.
 *
 * A product link that is touched, pressed or pointed at starts reading that
 * product (and its variants) at once; the tap or click lands 100–300 ms
 * later, and by then the page usually has its data, so it draws complete
 * instead of as a skeleton waiting on Firestore. The live query still runs
 * and replaces it, as with the build's seed. Reads are spent only on links a
 * shopper is about to open, never on every card in view.
 */
const warmProducts = new Map<string, any>();
const warming = new Set<string>();
export function warmProduct(slug: string) {
  if (!slug || warmProducts.has(slug) || warming.has(slug)) return;
  warming.add(slug);
  loadStore()
    .then((s) => s.fetchProductBySlug(slug))
    .then((p) => { if (p) warmProducts.set(slug, p); })
    .catch(() => {})
    .finally(() => warming.delete(slug));
}

function seededValue(path: string, args: any): any {
  if (path === 'products.getProductBySlug' && args && args !== 'skip') return seededProduct(args.slug) ?? warmProducts.get(args.slug);
  if (!SEEDABLE.has(path) || (args && args !== 'skip' && Object.keys(args).length)) return undefined;
  if (homeSeed === undefined) {
    try {
      const el = typeof document !== 'undefined' ? document.getElementById('__homeSeed') : null;
      homeSeed = el?.textContent ? JSON.parse(el.textContent) : null;
    } catch {
      homeSeed = null;
    }
  }
  return homeSeed?.[path];
}

/**
 * The site's own copy of a picture the build saved next to the page, or the
 * URL unchanged. The homepage's first hero slide is copied so its largest
 * paint needs no second connection; the slider asks here so it shows that
 * same file instead of fetching the original as well.
 */
export function localCopyOf(url: string | undefined): string | undefined {
  if (!url) return url;
  seededValue('homepage.getActiveHeroSlides', undefined);
  return (homeSeed?.heroLocal as Record<string, string> | undefined)?.[url] || url;
}

/** Queries only the admin screens use; their handlers live in firebase-hooks-lazy. */
const ADMIN_QUERY_PATHS = new Set<string>(["abandonedCartSettings.getSettings","abandonedCarts.getAbandonedCartStats","abandonedCarts.getAllAbandonedCarts","admin.bugReports.getBugReports","admin.bugReports.getBugStats","admin.customers.getAll","admin.orders.getAllOrders","admin.orders.getOrderDetails","admin.orders.getOrderStats","admin.orders.getOrderVariantInventory","admin.orders.searchOrders","aiMockups.getApprovedCounts","aiMockups.getCutouts","aiMockups.getJobs","aiMockups.getLinkTargets","aiMockups.getPrompts","aiMockups.getSettings","aiMockups.getTemplates","backup.getRecent","cashback.getAllCashbackRules","categoryDisplaySettings.getAll","checkoutUpsells.listAllRules","cod.getCodSettings","collections.getCollectionProducts","collections.previewCollectionProducts","coupons.getCouponUsageStats","coupons.getEligibleProducts","emailManagement.getAllUsecases","emailManagement.getStats","exports.getExportStats","exports.getOrdersForExport","googleDriveImportPublic.getActiveImportJobs","googleDriveImportPublic.getAllImportJobs","homepage.getAllCategoryDisplaySettings","homepage.getAllFeatureBanners","homepage.getAllHeroSlides","homepage.getAllHomepageSections","homepage.getAllUgcVideos","homepageSectionCards.getAllSectionCards","mediaLibrary.getFolders","mediaLibrary.listMedia","migrateCloudinaryToR2.getMigrationStatus","migrateGst.getOrdersWithoutGst","modelRequests.getAllModelRequests","productCategories.listAllCategories","productSections.listSectionContent","productSections.listSuggestedProductsConfigs","productSections.listTrendingProductsConfigs","products.exportProductsForBulkEdit","products.getAllVariants","products.getAllVariantsWithProducts","products.getProductVariants","reviews.getAllReviews","reviews.getProductReviews","reviews.getReviewStats","rollsManagement.getGadgetConsumption","rollsManagement.getLowStockAlerts","rollsManagement.getProductsByRNumber","rollsManagement.getRollInventory","rollsManagement.getStockLevels","seoPages.getPage","seoPages.getPageById","seoPages.listPages","seoTemplates.getTemplates","stockNotifications.getNotificationStats","stockNotifications.getWhatsAppHealth","supportedModels.getBrands","supportedModels.getBrandsWithCounts","supportedModels.getStats","users.isCurrentUserAdmin","variantConsumptionPresets.listAll","variantConsumptionPresets.listByGadgetType","wallet.getAllUsersWithWallets","wallet.getUserWalletDetails","wallet.getWalletSettings","whatsapp.getAdminNotificationSettings","whatsapp.getAllTemplates","whatsapp.getAllUsecases","whatsapp.getApprovedTemplates","whatsapp.getUsecaseWithTemplate","whatsapp.getWhatsAppProviderSettings","whatsappDebugLogs.getDebugLog","whatsappDebugLogs.getDebugStats","whatsappDebugLogs.getErrorTypes","whatsappDebugLogs.getUsecasesWithLogs","whatsappHealthCheck.getSystemHealth","whatsappMessaging.getDeliveryStats","whatsappMessaging.getMessageDetails","whatsappMessaging.getMessages","whatsappMessaging.getQueueStats"]);

let lazyOnce: Promise<typeof import('./firebase-hooks-lazy')> | null = null;
/** The admin queries, every mutation and every action: one chunk, fetched on first use. */
export function loadLazy() {
  return (lazyOnce ||= import('./firebase-hooks-lazy').catch((e) => { lazyOnce = null; throw e; }));
}

let storeOnce: Promise<typeof import('./firebase-hooks-store')> | null = null;
/** The storefront's Firestore reads, and the Firestore SDK with them: fetched when the first query runs. */
export function loadStore() {
  return (storeOnce ||= import('./firebase-hooks-store').catch((e) => { storeOnce = null; throw e; }));
}

export function useQuery(apiRef: any, args?: any) {
  const [data, setData] = useState<any>(() => seededValue(getPath(apiRef), args));
  const [error, setError] = useState<Error | null>(null);
  const path = getPath(apiRef);

  useEffect(() => {
    if (args === 'skip') {
      setData(undefined);
      return;
    }

    let unsubscribe = () => {};
    let active = true;

    const fetchData = async () => {
        try {
          const c = { path, args, setData, unsubscribe: () => {}, isActive: () => active };
          unsubscribe = () => c.unsubscribe();
          if (ADMIN_QUERY_PATHS.has(path)) {
            const lazy = await loadLazy();
            if (!active) return;
            await lazy.adminQuery[path](c);
          } else {
            const store = await loadStore();
            if (!active) return;
            await store.runQuery(c);
          }
      } catch (err: any) {
        console.error(`Error in useQuery for ${path}:`, err);
        setError(err);
      }
    };

    fetchData();

    return () => { active = false; unsubscribe(); };
  }, [path, JSON.stringify(args)]);

  return data;
}

export function useMutation(apiRef: any) {
  const path = getPath(apiRef);

  return useCallback(async (args?: any) => {
    return (await loadLazy()).runMutation(path, args);
  }, [path]);
}

export function useAction(apiRef: any) {
  const path = getPath(apiRef);

  return useCallback(async (args?: any) => {
    return (await loadLazy()).runAction(path, args);
  }, [path]);
}

export function Authenticated({ children }: { children: React.ReactNode }) {
  const { isSignedIn, isLoaded } = useAuth();
  if (isLoaded && isSignedIn) return <>{children}</>;
  return null;
}

export function Unauthenticated({ children }: { children: React.ReactNode }) {
  const { isSignedIn, isLoaded } = useAuth();
  if (isLoaded && !isSignedIn) return <>{children}</>;
  return null;
}

export function AuthLoading({ children }: { children: React.ReactNode }) {
  const { isLoaded } = useAuth();
  if (!isLoaded) return <>{children}</>;
  return null;
}

export function ConvexProvider({ children }: { children: React.ReactNode, client?: any }) {
  return <>{children}</>;
}

export function usePaginatedQuery(apiRef: any, args: any, options: { initialNumItems: number }) {
  const [allMatches, setAllMatches] = useState<any[]>([]);
  const [results, setResults] = useState<any[]>([]);
  const [status, setStatus] = useState<"LoadingFirstPage" | "CanLoadMore" | "LoadingMore" | "Exhausted">("LoadingFirstPage");
  const path = getPath(apiRef);

  useEffect(() => {
    if (args === 'skip') return;
    
    const collectionName = path.includes('products') ? 'products' : path.split('.')[0];
    
    /*
     * Args change while a fetch is in flight — on a fresh load of
     * ?gadget=gimbals the first run goes out before the gadget list has
     * resolved, so without `gadgetTypeId`, and a second follows with it. The
     * unfiltered one fetches more variants and lands last, overwriting the
     * right answer with every product. Only the latest run may write.
     */
    let cancelled = false;

    const fetchInitial = async () => {
      setStatus("LoadingFirstPage");
      const store = await loadStore();
      if (cancelled) return;
      await store.paginatedInitial({ path, args, options, isCancelled: () => cancelled, setAllMatches, setResults, setStatus });
    };
    
    fetchInitial();
    return () => {
      cancelled = true;
    };
  }, [path, JSON.stringify(args), options.initialNumItems]);

  const loadMore = useCallback(async (numItems: number) => {
    if (status === 'Exhausted' || status === 'LoadingMore') return;
    setStatus("LoadingMore");
    await (await loadStore()).paginatedMore({ path, numItems, results, allMatches, setStatus, setResults });
  }, [path, status, results.length, allMatches]);

  return { results, status, loadMore };
}

export function useConvex() {
  return {
    query: async (apiRef: any, args?: any) => {
      return (await loadStore()).convexQuery(apiRef, args);
    },
    mutation: async (apiRef: any, args?: any) => {
      const path = getPath(apiRef);
      console.log(`Manual mutation called for ${path} with args:`, args);
      return null;
    },
    action: async (apiRef: any, args?: any) => {
      const path = getPath(apiRef);
      console.log(`Manual action called for ${path} with args:`, args);
      
      const collectionName = path.split('.')[0];
      const actionName = path.split('.')[1];
      
      if (collectionName === 'phonepe' && actionName === 'initiatePayment') {
        const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
        if (isLocal) {
          console.log("Mocking PhonePe payment initiation for:", args);
          return {
            success: true,
            merchantTransactionId: `MTXN-${Date.now()}`,
            paymentUrl: `http://localhost:5175/mock-payment?orderId=${args.orderId}&amount=${args.amount}`
          };
        }
        const { httpsCallable } = await import('firebase/functions');
        const { functions } = await import('./firebase');
        const callable = httpsCallable(functions, 'initiatePayment');
        const res: any = await callable(args);
        return res.data;
      }
      
      if (collectionName === 'phonepe' && actionName === 'checkPaymentStatus') {
        const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
        if (isLocal) {
          return {
            success: true,
            paymentStatus: 'success',
            transactionId: args.merchantTransactionId
          };
        }
        const { httpsCallable } = await import('firebase/functions');
        const { functions } = await import('./firebase');
        const callable = httpsCallable(functions, 'checkPaymentStatus');
        const res: any = await callable(args);
        return res.data;
      }
      
      return null;
    }
  };
}
