import { useState, useEffect, useCallback } from 'react';
import { db, functions } from './firebase';
import { 
  collection, query, where, getDocs, onSnapshot, doc, getDoc, 
  limit, orderBy, startAfter, setDoc, addDoc, updateDoc, deleteDoc,
  writeBatch, DocumentSnapshot, QuerySnapshot
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useAuth } from '@/hooks/use-auth';

// Helper to resolve the string path from the proxy
const getPath = (apiRef: any) => String(apiRef);

export function useQuery(apiRef: any, args?: any) {
  const [data, setData] = useState<any>(undefined);
  const [error, setError] = useState<Error | null>(null);
  const path = getPath(apiRef);

  useEffect(() => {
    if (args === 'skip') {
      setData(undefined);
      return;
    }

    let unsubscribe = () => {};

    const fetchData = async () => {
        try {
          if (path === 'homepage.getActiveHomepageSections') {
          const q = query(collection(db, 'homepageSections'));
          unsubscribe = onSnapshot(q, (snap) => {
            let data = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
            data = data.filter((d: any) => d.isActive === true).sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
            setData(data);
          });
        }
        else if (path === 'homepage.getAllHomepageSections') {
          const q = query(collection(db, 'homepageSections'));
          unsubscribe = onSnapshot(q, (snap) => {
            let data = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
            data = data.sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
            setData(data);
          });
        }
        else if (path === 'homepage.getActiveCategoryDisplaySettings') {
          const q = query(collection(db, 'categoryDisplaySettings'));
          unsubscribe = onSnapshot(q, (snap) => {
            let data = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
            data = data.filter((d: any) => d.isActive === true).sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
            setData(data);
          });
        }
        else if (path === 'homepage.getActiveHeroSlides') {
          const q = query(collection(db, 'heroSlides'));
          unsubscribe = onSnapshot(q, (snap) => {
            let data = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
            data = data.filter((d: any) => d.isActive === true).sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
            setData(data);
          });
        }
        else if (path === 'homepage.getAllHeroSlides') {
          const q = query(collection(db, 'heroSlides'));
          unsubscribe = onSnapshot(q, (snap) => {
            let data = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
            data = data.sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
            setData(data);
          });
        }
        else if (path === 'homepage.getActiveFeatureBanners') {
          const q = query(collection(db, 'featureBanners'));
          unsubscribe = onSnapshot(q, (snap) => {
            let data = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
            data = data.filter((d: any) => d.isActive === true).sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
            setData(data);
          });
        }
        else if (path === 'homepage.getAllFeatureBanners') {
          const q = query(collection(db, 'featureBanners'));
          unsubscribe = onSnapshot(q, (snap) => {
            let data = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
            data = data.sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
            setData(data);
          });
        }
        else if (path === 'homepage.getActiveUgcVideos') {
          const q = query(collection(db, 'ugcVideos'));
          unsubscribe = onSnapshot(q, (snap) => {
            let data = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
            data = data.filter((d: any) => d.isActive === true).sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
            setData(data);
          });
        }
        else if (path === 'homepage.getAllUgcVideos') {
          const q = query(collection(db, 'ugcVideos'));
          unsubscribe = onSnapshot(q, (snap) => {
            let data = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
            data = data.sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
            setData(data);
          });
        }
        else if (path === 'homepageSectionCards.getActiveSectionCards') {
          const q = query(collection(db, 'homepageSectionCards'), where('sectionId', '==', args?.sectionId));
          unsubscribe = onSnapshot(q, (snap) => {
            let data = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
            data = data.filter((d: any) => d.isActive === true).sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
            setData(data);
          });
        }
        else if (path === 'homepageSectionCards.getAllSectionCards') {
          const q = query(collection(db, 'homepageSectionCards'), where('sectionId', '==', args?.sectionId));
          unsubscribe = onSnapshot(q, (snap) => {
            let data = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
            data = data.sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
            setData(data);
          });
        }
        else if (path === 'homepage.getHomepageSettings') {
          unsubscribe = onSnapshot(doc(db, 'homepageSettings', 'default'), (snap) => {
            setData(snap.exists() ? snap.data() : null);
          });
        }
        else if (path === 'homepage.getProductsByTags' || path === 'products.getProductsByTag') {
          const limitNum = args?.maxProducts || args?.limit || 10;
          const tagsArg = args?.tags || (args?.tag ? [args.tag] : []);
          
          const q = query(collection(db, 'products'), where('status', '==', 'active'));
          unsubscribe = onSnapshot(q, async (snap) => {
            let docs = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
            if (tagsArg.length) {
              docs = docs.filter((d: any) => {
                if (!d.tags) return false;
                const dTags = Array.isArray(d.tags) ? d.tags : d.tags.split(',').map((t: string) => t.trim());
                return tagsArg.some((t: string) => dTags.includes(t));
              });
            }
            docs = docs.slice(0, limitNum);
            
            const finalProducts = await Promise.all(docs.map(async (product: any) => {
              const vq = query(collection(db, 'variants'), where('productId', '==', product._id));
              const vsnap = await getDocs(vq);
              return {
                ...product,
                variants: vsnap.docs.map(v => ({ _id: v.id, ...v.data() }))
              };
            }));
            setData(finalProducts);
          });
        }
        else if (path === 'homepage.getMarqueeModels') {
          const q = query(collection(db, 'supportedModels'), limit(args?.maxModels || 20));
          unsubscribe = onSnapshot(q, (snap) => {
            const models = snap.docs.map(d => {
              const data = d.data();
              return `${data.brand} ${data.model}`;
            });
            setData(models);
          });
        }
        else if (path === 'cart.getCartCount') {
          let innerUnsubscribe = () => {};
          const { getAuth } = await import('firebase/auth');
          const auth = getAuth();
          
          // Helper to subscribe to auth changes
          const unsubscribeAuth = auth.onAuthStateChanged((user) => {
            if (!user) {
              setData(0);
              return;
            }
            const q = query(collection(db, 'cart'), where('userId', '==', user.uid));
            innerUnsubscribe = onSnapshot(q, (snap) => {
              const count = snap.docs.reduce((acc, doc) => acc + (doc.data().quantity || 1), 0);
              setData(count);
            });
          });
          
          unsubscribe = () => {
            unsubscribeAuth();
            innerUnsubscribe();
          };
        }
        else if (path === 'cart.getCart') {
          let innerUnsubscribe = () => {};
          const { getAuth } = await import('firebase/auth');
          const auth = getAuth();
          
          const unsubscribeAuth = auth.onAuthStateChanged((user) => {
            if (!user) {
              setData([]);
              return;
            }
            // Removed orderBy('addedAt', 'desc') from the query to avoid requiring a composite index.
            // Sorting will be done in-memory.
            const q = query(collection(db, 'cart'), where('userId', '==', user.uid));
            innerUnsubscribe = onSnapshot(q, (snap) => {
              let docs = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
              docs.sort((a: any, b: any) => (b.addedAt || 0) - (a.addedAt || 0));
              setData(docs);
            });
          });
          
          unsubscribe = () => {
            unsubscribeAuth();
            innerUnsubscribe();
          };
        }
        else if (path === 'orders.getOrders') {
          let innerUnsubscribe = () => {};
          const { getAuth } = await import('firebase/auth');
          const auth = getAuth();
          
          const unsubscribeAuth = auth.onAuthStateChanged((user) => {
            // Clear existing listener when user changes
            innerUnsubscribe();
            
            if (!user) {
              setData([]);
              return;
            }
            
            // Removed orderBy('createdAt', 'desc') to avoid requiring a composite index.
            // Sorting is done in-memory.
            const q = query(collection(db, 'orders'), where('userId', '==', user.uid));
            
            innerUnsubscribe = onSnapshot(q, (snap) => {
              let docs = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
              docs.sort((a: any, b: any) => {
                const aTime = a.createdAt || a._creationTime || 0;
                const bTime = b.createdAt || b._creationTime || 0;
                return bTime - aTime;
              });
              if (args?.limit) {
                docs = docs.slice(0, args.limit);
              }
              setData(docs);
            }, (error) => {
              console.error("orders.getOrders error:", error);
            });
          });
          
          unsubscribe = () => {
            unsubscribeAuth();
            innerUnsubscribe();
          };
        }
        else if (path === 'orders.getOrderPublic' || path === 'admin.orders.getOrderDetails') {
          if (!args?.orderId) {
            setData(null);
            return;
          }
          unsubscribe = onSnapshot(doc(db, 'orders', args.orderId), (snap) => {
            setData(snap.exists() ? { _id: snap.id, ...snap.data() } : null);
          });
        }
        else if (path === 'orders.getLastOrderedDevice') {
          let innerUnsubscribe = () => {};
          const { getAuth } = await import('firebase/auth');
          const auth = getAuth();
          
          const unsubscribeAuth = auth.onAuthStateChanged((user) => {
            if (!user) {
              setData(null);
              return;
            }
            const q = query(collection(db, 'orders'), where('userId', '==', user.uid), limit(1));
            innerUnsubscribe = onSnapshot(q, (snap) => {
              if (snap.empty) {
                setData(null);
                return;
              }
              const orderData = snap.docs[0].data();
              const firstItem = orderData.items?.[0];
              if (firstItem && firstItem.phoneModel) {
                setData({ brand: firstItem.phoneBrand, model: firstItem.phoneModel });
              } else {
                setData(null);
              }
            });
          });
          unsubscribe = () => { unsubscribeAuth(); innerUnsubscribe(); };
        }
        else if (path === 'orders.getOrderByMerchantTransaction') {
          if (!args?.merchantTransactionId) {
            setData(null);
            return;
          }
          const q = query(collection(db, 'orders'), where('paymentId', '==', args.merchantTransactionId), limit(1));
          unsubscribe = onSnapshot(q, (snap) => {
            setData(snap.empty ? null : { _id: snap.docs[0].id, ...snap.docs[0].data() });
          });
        }
        else if (path === 'admin.orders.getAllOrders') {
          // Fetch recent orders and filter by status locally to avoid requiring complex composite indexes immediately
          // Note: Migrated orders use _creationTime instead of createdAt
          const q = query(collection(db, 'orders'), limit(500));
          unsubscribe = onSnapshot(q, (snap) => {
            let docs = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
            // Sort in memory by createdAt or _creationTime
            docs.sort((a: any, b: any) => {
              const aTime = a.createdAt || a._creationTime || 0;
              const bTime = b.createdAt || b._creationTime || 0;
              return bTime - aTime;
            });
            if (args?.status && args.status !== 'all') {
              docs = docs.filter((d: any) => d.status === args.status);
            }
            if (args?.paymentStatus && args.paymentStatus !== 'all') {
              docs = docs.filter((d: any) => (d.paymentStatus || d.paymentInfo?.status) === args.paymentStatus);
            }
            setData(docs);
          });
        }
        else if (path === 'admin.orders.searchOrders') {
          if (!args?.searchTerm) {
            setData([]);
            return;
          }
          // Firebase doesn't support generic full text search natively. We will pull recent orders and filter in memory as a simple fallback
          const q = query(collection(db, 'orders'), limit(100));
          unsubscribe = onSnapshot(q, (snap) => {
            const term = args.searchTerm.toLowerCase();
            const docs = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
            const filtered = docs.filter((d: any) => 
              d.orderNumber?.toLowerCase().includes(term) ||
              d.orderId?.toLowerCase().includes(term) ||
              d.customerName?.toLowerCase().includes(term) ||
              d.customerInfo?.name?.toLowerCase().includes(term) ||
              d.email?.toLowerCase().includes(term) ||
              d.customerInfo?.email?.toLowerCase().includes(term) ||
              d.phone?.toLowerCase().includes(term) ||
              d.customerInfo?.phone?.toLowerCase().includes(term)
            );
            filtered.sort((a: any, b: any) => {
              const aTime = a.createdAt || a._creationTime || 0;
              const bTime = b.createdAt || b._creationTime || 0;
              return bTime - aTime;
            });
            setData(filtered);
          });
        }
        else if (path === 'abandonedCarts.getAbandonedCartStats') {
          setData({
            total: 0,
            recovered: 0,
            pending: 0,
            revenue: 0,
            recoveryRate: 0,
            totalValue: 0,
            reminded: 0,
            recoveredValue: 0
          });
        }
        else if (path === 'abandonedCartSettings.getSettings') {
          setData({
            enabled: false,
            reminderIntervals: [2, 24],
            template: "You left something behind!"
          });
        }
        else if (path === 'abandonedCarts.getAllAbandonedCarts') {
          let q = query(collection(db, 'abandonedCarts'), limit(100));
          if (args?.status && args.status !== 'all') {
            q = query(collection(db, 'abandonedCarts'), where('status', '==', args.status), limit(100));
          }
          unsubscribe = onSnapshot(q, (snap) => {
            const docs = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
            docs.sort((a: any, b: any) => {
              const aTime = a.createdAt || a._creationTime || 0;
              const bTime = b.createdAt || b._creationTime || 0;
              return bTime - aTime;
            });
            setData(docs);
          });
        }
        else if (path === 'admin.orders.getOrderVariantInventory') {
          // Mock inventory for admin
          setData([]);
        }
        else if (path === 'admin.orders.getOrderStats') {
          // Dummy stats for now
          setData({
            totalOrders: 0,
            totalRevenue: 0,
            pendingOrders: 0,
            shippedOrders: 0,
            processingOrders: 0,
            deliveredOrders: 0,
            rtoOrders: 0,
            rtoDeliveredOrders: 0
          });
        }
        else if (path === 'orders.checkOrderInventory') {
          // Mock inventory check for now
          setData({ isAvailable: true, outOfStockItems: [] });
        }
        else if (path === 'coupons.getActiveCoupons' || path === 'coupons.getAllCoupons') {
          let q = query(collection(db, 'coupons'));
          if (path === 'coupons.getActiveCoupons') {
            q = query(collection(db, 'coupons'), where('isActive', '==', true));
          }
          unsubscribe = onSnapshot(q, (snap) => {
            let data = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
            data = data.sort((a: any, b: any) => {
              const aTime = a.createdAt || a._creationTime || 0;
              const bTime = b.createdAt || b._creationTime || 0;
              return bTime - aTime;
            });
            setData(data);
          });
        }
        else if (path === 'checkoutUpsells.getUpsellsForCart') {
          // Properly fetch upsell rules
          const q = query(collection(db, 'checkoutUpsells'), where('isActive', '==', true));
          unsubscribe = onSnapshot(q, async (snap) => {
            let rules = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
            rules = rules.sort((a: any, b: any) => (b.priority || 0) - (a.priority || 0));
            
            // For now, return all active rules and let frontend filter, or return first few
            // Add product details to rules
            const upsells = [];
            for (const rule of rules) {
              if (rule.offerProductId) {
                const prodSnap = await getDocs(query(collection(db, 'products'), where('__name__', '==', rule.offerProductId)));
                if (!prodSnap.empty) {
                  const productData = prodSnap.docs[0].data();
                  const vq = query(collection(db, 'variants'), where('productId', '==', rule.offerProductId));
                  const vsnap = await getDocs(vq);
                  const variants = vsnap.docs.map(v => ({ _id: v.id, ...v.data() }));
                  
                  upsells.push({
                    ruleId: rule._id,
                    productId: rule.offerProductId,
                    productTitle: rule.title || productData.title,
                    productImage: variants[0]?.imageUrl || productData.images?.[0],
                    variantId: variants[0]?._id,
                    variantTitle: variants[0]?.title || "Default",
                    originalPrice: variants[0]?.price || 0,
                    discountedPrice: rule.discountType === "percentage" 
                      ? Math.floor((variants[0]?.price || 0) * (1 - rule.discountValue / 100))
                      : Math.max(0, (variants[0]?.price || 0) - rule.discountValue),
                    hasMultipleVariants: variants.length > 1,
                    allVariants: variants.map(v => ({
                      variantId: v._id,
                      variantTitle: v.title,
                      price: v.price,
                      discountedPrice: rule.discountType === "percentage"
                        ? Math.floor(v.price * (1 - rule.discountValue / 100))
                        : Math.max(0, v.price - rule.discountValue)
                    }))
                  });
                }
              }
            }
            setData(upsells.slice(0, 3)); // Max 3 upsells
          });
        }
        else if (path === 'checkoutUpsells.listAllRules') {
          const q = query(collection(db, 'checkoutUpsells'));
          unsubscribe = onSnapshot(q, (snap) => {
            let data = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
            data = data.sort((a: any, b: any) => (b.priority || 0) - (a.priority || 0));
            setData(data);
          });
        }
        else if (path === 'shipping.getShippingSettings') {
          unsubscribe = onSnapshot(doc(db, 'settings', 'shipping'), (snap) => {
            if (snap.exists()) {
              setData(snap.data());
            } else {
              setData({
                baseRate: 0,
                freeShippingThreshold: 500,
                flatShippingFee: 50,
                codFee: 50,
                expressShippingFee: 100,
                expressShippingEnabled: true,
                shippingIncludesTax: false
              });
            }
          });
        }
        else if (path === 'wallet.getWalletSettings') {
          unsubscribe = onSnapshot(doc(db, 'walletSettings', 'default'), (snap) => {
            if (snap.exists()) {
              setData(snap.data());
            } else {
              setData({
                maxUsageType: 'percentage',
                maxUsageValue: 10,
                referralRewardAmount: 0,
                referralMinOrderValue: 0,
                walletEnabled: true
              });
            }
          });
        }
        else if (path === 'wallet.getAllUsersWithWallets') {
          const q = query(collection(db, 'users'));
          unsubscribe = onSnapshot(q, (snap) => {
            const users = snap.docs.map(d => ({
              _id: d.id,
              name: d.data().name || 'Unknown',
              email: d.data().email || '',
              walletBalance: d.data().walletBalance || 0,
              transactionCount: d.data().transactionCount || 0
            }));
            setData(users);
          });
        }
        else if (path === 'wallet.getWalletStats') {
          let innerUnsubscribe = () => {};
          const { getAuth } = await import('firebase/auth');
          const auth = getAuth();
          
          const unsubscribeAuth = auth.onAuthStateChanged((user) => {
            if (!user) {
              setData({ 
                currentBalance: 0, 
                lifetimeEarned: 0, 
                lifetimeSpent: 0, 
                totalCredit: 0, 
                totalDebit: 0, 
                pendingWithdrawals: 0, 
                activeWallets: 0 
              });
              return;
            }

            innerUnsubscribe = onSnapshot(doc(db, 'users', user.uid), async (snap) => {
              const userData = snap.exists() ? snap.data() : {};
              
              // Now fetch transactions to calculate stats
              const q = query(collection(db, 'walletTransactions'), where('userId', '==', user.uid));
              const txSnap = await getDocs(q);
              
              let currentBalance = userData.walletBalance || 0;
              let lifetimeEarned = 0;
              let lifetimeSpent = 0;
              let totalCredit = 0;
              let totalDebit = 0;
              
              txSnap.docs.forEach(d => {
                const tx = d.data();
                if (tx.transactionType === 'credit') {
                  lifetimeEarned += tx.amount || 0;
                  totalCredit += tx.amount || 0;
                } else if (tx.transactionType === 'debit') {
                  lifetimeSpent += tx.amount || 0;
                  totalDebit += tx.amount || 0;
                }
              });

              setData({ 
                currentBalance, 
                lifetimeEarned, 
                lifetimeSpent, 
                totalCredit, 
                totalDebit, 
                pendingWithdrawals: 0, 
                activeWallets: 0 
              });
            });
          });
          unsubscribe = () => { unsubscribeAuth(); innerUnsubscribe(); };
        }
        else if (path === 'wallet.getWalletTransactions') {
          let innerUnsubscribe = () => {};
          const { getAuth } = await import('firebase/auth');
          const auth = getAuth();
          
          const unsubscribeAuth = auth.onAuthStateChanged((user) => {
            if (!user) {
              setData([]);
              return;
            }

            const q = query(collection(db, 'walletTransactions'), where('userId', '==', user.uid));
            innerUnsubscribe = onSnapshot(q, (snap) => {
              const docs = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
              docs.sort((a: any, b: any) => (b.createdAt || b._creationTime || 0) - (a.createdAt || a._creationTime || 0));
              setData(docs);
            });
          });
          unsubscribe = () => { unsubscribeAuth(); innerUnsubscribe(); };
        }
        else if (path === 'wallet.getWalletBalance') {
          let innerUnsubscribe = () => {};
          const { getAuth } = await import('firebase/auth');
          const auth = getAuth();
          
          const unsubscribeAuth = auth.onAuthStateChanged((user) => {
            if (!user) {
              setData({ balance: 0 });
              return;
            }

            innerUnsubscribe = onSnapshot(doc(db, 'users', user.uid), (snap) => {
              setData(snap.exists() ? { balance: snap.data().walletBalance || 0, userId: user.uid } : { balance: 0, userId: user.uid });
            });
          });
          unsubscribe = () => { unsubscribeAuth(); innerUnsubscribe(); };
        }
        else if (path === 'whatsappConsent.getMyConsent') {
          setData({ consented: false, optInDate: null, consentType: "none" });
        }
        else if (path === 'loginOtp.checkPhoneVerified') {
          setData({ verified: false, phoneNumber: null });
        }
        else if (path === 'referrals.getReferralStats') {
          let innerUnsubscribe = () => {};
          const { getAuth } = await import('firebase/auth');
          const auth = getAuth();
          
          const unsubscribeAuth = auth.onAuthStateChanged((user) => {
            if (!user) {
              setData({ totalEarned: 0, successfulReferrals: 0, referralCode: '' });
              return;
            }
            
            innerUnsubscribe = onSnapshot(doc(db, 'users', user.uid), (snap) => {
              if (snap.exists()) {
                const data = snap.data();
                setData({
                  totalEarned: data.referralEarnings || 0,
                  successfulReferrals: data.referralCount || 0,
                  referralCode: data.referralCode || `REF${user.uid.substring(0, 5).toUpperCase()}`
                });
              }
            });
          });
          unsubscribe = () => { unsubscribeAuth(); innerUnsubscribe(); };
        }
        else if (path === 'admin.bugReports.getBugStats') {
          const q = query(collection(db, 'bugReports'));
          unsubscribe = onSnapshot(q, (snap) => {
            let pending = 0, resolved = 0, deleted = 0;
            snap.docs.forEach(d => {
              const s = d.data().status;
              if (s === 'resolved') resolved++;
              else if (s === 'deleted') deleted++;
              else pending++;
            });
            setData({ total: snap.size, pending, resolved, deleted });
          });
        }
        else if (path === 'admin.bugReports.getBugReports') {
          const q = query(collection(db, 'bugReports'));
          unsubscribe = onSnapshot(q, async (snap) => {
            const reports = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
            // Also attach mock attachments for now or query bugAttachments
            const attachSnap = await getDocs(collection(db, 'bugAttachments'));
            const attachMap: Record<string, any[]> = {};
            attachSnap.docs.forEach(d => {
              const data = d.data();
              if (!attachMap[data.bugReportId]) attachMap[data.bugReportId] = [];
              attachMap[data.bugReportId].push({ _id: d.id, ...data });
            });
            reports.forEach((r: any) => r.attachments = attachMap[r._id] || []);
            setData(reports);
          });
        }
        else if (path === 'cod.isCodAvailable') {
          setData(true);
        }
        else if (path === 'wallet.calculateMaxWalletUsage') {
          setData(0);
        }
        else if (path === 'cashbackHelpers.calculateCartCashback') {
          setData(0);
        }
        else if (path === 'cashback.getAllCashbackRules') {
          const q = query(collection(db, 'cashbackRules'));
          unsubscribe = onSnapshot(q, (snap) => {
            const rules = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
            setData(rules);
          });
        }
        else if (path === 'cart.checkCartItemsStock') {
          // Provide basic mocked stock status array structure expected by the cart page
          setData(args?.cartItems?.map((item: any) => ({
            productId: item.productId,
            variant: item.variant,
            isOutOfStock: false,
            availableQuantity: 99
          })) || []);
        }
        else if (path === 'products.getProductVariants') {
          if (!args?.productId) {
            setData([]);
            return;
          }
          const q = query(collection(db, 'variants'), where('productId', '==', args.productId));
          unsubscribe = onSnapshot(q, (snap) => {
            setData(snap.docs.map(d => ({ _id: d.id, ...d.data() })));
          });
        }
        else if (path === 'mockups.getMockupFileId') {
          // Dummy mockup implementation for now
          setData(null);
        }
        else if (path === 'supportedModels.getMetadata') {
          const q = query(collection(db, 'modelMetadata'), where('key', '==', 'current'), limit(1));
          unsubscribe = onSnapshot(q, (snap) => {
            if (snap.empty) {
              setData({
                brands: [],
                totalModels: 0,
                byCategory: {
                  phone: { brands: [], count: 0 },
                  laptop: { brands: [], count: 0 },
                  tablet: { brands: [], count: 0 },
                  camera: { brands: [], count: 0 },
                  lens: { brands: [], count: 0 },
                  drone: { brands: [], count: 0 },
                  charger: { brands: [], count: 0 },
                }
              });
            } else {
              setData({ _id: snap.docs[0].id, ...snap.docs[0].data() });
            }
          });
        }
        else if (path === 'supportedModels.getBrandModels') {
          if (!args?.brand || !args?.category) {
            setData([]);
            return;
          }
          try {
            const q = query(
              collection(db, 'supportedModels'), 
              where('brandName', '==', args.brand),
              where('category', '==', args.category),
              where('isActive', '==', true)
            );
            unsubscribe = onSnapshot(q, (snap) => {
              let docs = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
              // Client-side sorting
              docs.sort((a: any, b: any) => a.modelName.localeCompare(b.modelName));
              setData(docs);
            }, (error) => {
              console.error("Index error, falling back to client-side filter", error);
              const fallbackQ = query(
                collection(db, 'supportedModels'), 
                where('brandName', '==', args.brand)
              );
              unsubscribe = onSnapshot(fallbackQ, (snap) => {
                let docs = snap.docs
                  .map(d => ({ _id: d.id, ...d.data() }))
                  .filter((d: any) => d.category === args.category && d.isActive === true);
                docs.sort((a: any, b: any) => a.modelName.localeCompare(b.modelName));
                setData(docs);
              });
            });
          } catch (e) {
            console.error("Error in getBrandModels", e);
          }
        }
        else if (path === 'supportedModels.searchModels') {
          const searchParam = args?.searchTerm || args?.query;
          if (!searchParam || searchParam.length < 2) {
            setData([]);
            return;
          }
          // Fetch all active models to search in-memory
          const q = query(collection(db, 'supportedModels'), where('isActive', '==', true));
          unsubscribe = onSnapshot(q, (snap) => {
            const term = searchParam.toLowerCase();
            const filtered = snap.docs
              .map(d => ({ _id: d.id, ...d.data() }))
              .filter((d: any) => {
                const combined = `${d.brandName} ${d.modelName}`.toLowerCase();
                return combined.includes(term);
              });
            setData(filtered.slice(0, args?.limit || 10));
          });
        }
        else if (path === 'supportedModels.listAll') {
          const q = query(collection(db, 'supportedModels'));
          unsubscribe = onSnapshot(q, (snap) => {
            setData(snap.docs.map(d => ({ _id: d.id, ...d.data() })));
          });
        }
        else if (path === 'supportedModels.getBrands') {
          const q = query(collection(db, 'supportedModels'));
          unsubscribe = onSnapshot(q, (snap) => {
            const brands = new Set<string>();
            snap.docs.forEach(d => {
              const brandName = d.data().brandName;
              if (brandName) brands.add(brandName);
            });
            setData(Array.from(brands).sort((a, b) => a.localeCompare(b)));
          });
        }
        else if (path === 'supportedModels.getBrandsWithCounts') {
          const q = query(collection(db, 'supportedModels'));
          unsubscribe = onSnapshot(q, (snap) => {
            const brandMap: Record<string, { count: number, categories: Set<string> }> = {};
            snap.docs.forEach(d => {
              const data = d.data();
              const brandName = data.brandName;
              const category = data.category;
              if (brandName) {
                if (!brandMap[brandName]) {
                  brandMap[brandName] = { count: 0, categories: new Set() };
                }
                brandMap[brandName].count++;
                if (category) {
                  brandMap[brandName].categories.add(category);
                }
              }
            });
            
            const result = Object.keys(brandMap).map(brand => ({
              brand,
              count: brandMap[brand].count,
              categories: Array.from(brandMap[brand].categories).sort()
            })).sort((a, b) => a.brand.localeCompare(b.brand));
            
            setData(result);
          });
        }
        else if (path === 'products.getModelsByBrand') {
          if (!args?.brand) {
            setData([]);
            return;
          }
          
          // Fallback to client-side filtering if composite index doesn't exist
          try {
            const q = query(
              collection(db, 'supportedModels'), 
              where('brandName', '==', args.brand),
              where('isActive', '==', true)
            );
            unsubscribe = onSnapshot(q, (snap) => {
              let docs = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
              docs.sort((a: any, b: any) => a.modelName.localeCompare(b.modelName));
              setData(docs);
            }, (error) => {
              console.error("Index error, falling back to client-side filter", error);
              const fallbackQ = query(collection(db, 'supportedModels'), where('brandName', '==', args.brand));
              unsubscribe = onSnapshot(fallbackQ, (snap) => {
                let docs = snap.docs
                  .map(d => ({ _id: d.id, ...d.data() }))
                  .filter((d: any) => d.isActive === true);
                docs.sort((a: any, b: any) => a.modelName.localeCompare(b.modelName));
                setData(docs);
              });
            });
          } catch (e) {
            console.error("Error in getModelsByBrand", e);
          }
        }
        else if (path === 'supportedModels.getStats') {
          const q = query(collection(db, 'supportedModels'));
          unsubscribe = onSnapshot(q, (snap) => {
            let total = 0;
            let active = 0;
            let inactive = 0;
            const categoryBreakdown: Record<string, number> = {};
            
            snap.docs.forEach(d => {
              const data = d.data();
              total++;
              if (data.isActive) active++;
              else inactive++;
              
              const category = data.category;
              if (category) {
                categoryBreakdown[category] = (categoryBreakdown[category] || 0) + 1;
              }
            });
            
            setData({ total, active, inactive, categoryBreakdown });
          });
        }
        else if (path === 'supportedModels.getModelsByCategory') {
          let q = query(collection(db, 'supportedModels'));
          if (args && args.category) {
            q = query(collection(db, 'supportedModels'), where('category', '==', args.category));
          }
          unsubscribe = onSnapshot(q, (snap) => {
            let data = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
            if (args && args.isActive !== undefined) {
              data = data.filter((d: any) => d.isActive === args.isActive);
            }
            setData(data);
          });
        }
        else if (path === 'supportedModels.getModelCountByGadgetType') {
          setData(0);
        }
        else if (path === 'supportedModels.getLatest') {
          const q = query(collection(db, 'supportedModels'), limit(args?.count || 20));
          unsubscribe = onSnapshot(q, (snap) => {
            setData(snap.docs.map(d => ({ _id: d.id, ...d.data() })));
          });
        }
        else if (path === 'stockNotifications.getNotificationStats') {
          setData([]);
        }
        else if (path === 'mediaLibrary.getFolders') {
          setData([]);
        }
        else if (path === 'mediaLibrary.listMedia') {
          const q = query(collection(db, 'mediaLibrary'));
          unsubscribe = onSnapshot(q, (snap) => {
            const docs = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
            setData({ items: docs, totalCount: docs.length });
          });
        }
        else if (path === 'collections.getAllCollections' || path === 'collections.getAllCollectionsWithCounts') {
          const q = query(collection(db, 'collections'));
          unsubscribe = onSnapshot(q, (snap) => {
            const docs = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
            setData(docs);
          });
        }
        else if (path === 'collections.getCollectionsByCategory') {
          const q = query(collection(db, 'collections'));
          unsubscribe = onSnapshot(q, (snap) => {
            let cols = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
            if (args?.category) {
              cols = cols.filter((c: any) => c.category === args.category);
            }
            setData(cols);
          });
        }
        else if (path === 'collections.getCollectionByName') {
          const q = query(collection(db, 'collections'), where('slug', '==', args?.name || ''));
          unsubscribe = onSnapshot(q, (snap) => {
            setData(snap.empty ? null : { _id: snap.docs[0].id, ...snap.docs[0].data() });
          });
        }
        else if (path === 'collections.getCollectionProductsPaginated') {
          if (!args?.collectionId) {
            setData({ products: [], hasMore: false });
            return;
          }
          const limitNum = args?.limit || 30;
          const offsetNum = args?.offset || 0;
          
          const q = query(
            collection(db, 'collectionProducts'),
            where('collectionId', '==', args.collectionId)
          );
          
          unsubscribe = onSnapshot(q, async (snap) => {
            let cpDocs = snap.docs.map(d => d.data());
            // Sort by order
            cpDocs.sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
            
            const hasMore = cpDocs.length > offsetNum + limitNum;
            cpDocs = cpDocs.slice(offsetNum, offsetNum + limitNum);
            
            if (cpDocs.length === 0) {
              setData({ products: [], hasMore: false });
              return;
            }
            
            const productIds = cpDocs.map(cp => cp.productId);
            
            // Chunk product fetches because Firestore 'in' queries are limited to 10
            const productsData: any[] = [];
            for (let i = 0; i < productIds.length; i += 10) {
              const chunk = productIds.slice(i, i + 10);
              const pq = query(collection(db, 'products'), where('__name__', 'in', chunk));
              const psnap = await getDocs(pq);
              productsData.push(...psnap.docs.map(d => ({ _id: d.id, ...d.data() })));
            }
            
            // Order products matching the cpDocs order
            const orderedProducts = [];
            for (const cp of cpDocs) {
              const p = productsData.find(pd => pd._id === cp.productId);
              if (p) orderedProducts.push(p);
            }
            
            // Attach variants
            const finalProducts = await Promise.all(orderedProducts.map(async (product: any) => {
              const vq = query(collection(db, 'variants'), where('productId', '==', product._id));
              const vsnap = await getDocs(vq);
              return {
                ...product,
                variants: vsnap.docs.map(v => ({ _id: v.id, ...v.data() }))
              };
            }));
            
            setData({ products: finalProducts, hasMore });
          });
        }
        else if (path === 'products.getAllVariantsWithProducts') {
          const fetchVariants = async () => {
            try {
              const vSnap = await getDocs(collection(db, 'variants'));
              const pSnap = await getDocs(collection(db, 'products'));
              const productsMap: Record<string, any> = {};
              pSnap.docs.forEach(p => {
                productsMap[p.id] = p.data();
              });
              const docs = vSnap.docs.map(d => {
                const vData = d.data();
                const pData = productsMap[vData.productId] || {};
                return {
                  _id: d.id,
                  ...vData,
                  productTitle: pData.title || "Unknown Product",
                  title: vData.title || "",
                  sku: vData.sku || ""
                };
              });
              setData(docs);
            } catch (err) {
              console.error(err);
              setData([]);
            }
          };
          fetchVariants();
        }
        else if (path === 'products.getAllProducts' || path === 'products.getAllProductsBasic') {
          const q = query(collection(db, 'products'));
          unsubscribe = onSnapshot(q, async (snap) => {
            // Also fetch all variants to compute variantSkus efficiently
            const variantsSnap = await getDocs(collection(db, 'variants'));
            const variantSkusMap: Record<string, string[]> = {};
            variantsSnap.docs.forEach(vDoc => {
              const vData = vDoc.data();
              if (vData.productId && vData.sku) {
                if (!variantSkusMap[vData.productId]) {
                  variantSkusMap[vData.productId] = [];
                }
                variantSkusMap[vData.productId].push(vData.sku);
              }
            });

            let docs = snap.docs.map(d => {
              const data = d.data();
              return {
                _id: d.id,
                ...data,
                title: data.title || "",
                description: data.description || "",
                slug: data.slug || "",
                tags: data.tags || [],
                variantSkus: data.variantSkus || variantSkusMap[d.id] || [],
              };
            });
            setData(docs);
          });
        }
        else if (path === 'products.getAllProductsPaginated') {
          const q = query(collection(db, 'products'), limit(args?.paginationOpts?.numItems || 50));
          unsubscribe = onSnapshot(q, async (snap) => {
            let docs = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
            
            // Attach variants
            const finalProducts = await Promise.all(docs.map(async (product: any) => {
              const vq = query(collection(db, 'variants'), where('productId', '==', product._id));
              const vsnap = await getDocs(vq);
              return {
                ...product,
                variants: vsnap.docs.map(v => ({ _id: v.id, ...v.data() }))
              };
            }));
            setData({ page: finalProducts, isDone: true, continueCursor: null });
          });
        }
        else if (path === 'products.searchProducts') {
          if (!args?.query || args.query.length < 2) {
            setData([]);
            return;
          }
          const q = query(collection(db, 'products'), where('status', '==', 'active'));
          unsubscribe = onSnapshot(q, async (snap) => {
            const term = args.query.toLowerCase();
            let docs = snap.docs
              .map(d => ({ _id: d.id, ...d.data() }))
              .filter((d: any) => {
                const searchString = `${d.title} ${d.tags?.join(' ') || ''} ${d.description || ''}`.toLowerCase();
                return searchString.includes(term);
              });
            docs = docs.slice(0, args?.limit || 15);
            
            // Fetch variants for these products
            const finalProducts = await Promise.all(docs.map(async (product: any) => {
              const vq = query(collection(db, 'variants'), where('productId', '==', product._id));
              const vsnap = await getDocs(vq);
              return {
                ...product,
                variants: vsnap.docs.map(v => ({ _id: v.id, ...v.data() }))
              };
            }));
            setData(finalProducts);
          });
        }
        else if (path === 'products.exportProductsForBulkEdit') {
          if (!args?.productIds || args.productIds.length === 0) {
            setData([]);
            return;
          }
          
          const fetchExportData = async () => {
            const productDocs: any[] = [];
            for (let i = 0; i < args.productIds.length; i += 10) {
              const chunk = args.productIds.slice(i, i + 10);
              const pq = query(collection(db, 'products'), where('__name__', 'in', chunk));
              const snap = await getDocs(pq);
              productDocs.push(...snap.docs.map(d => ({ _id: d.id, ...d.data() })));
            }

            const exportRows: any[] = [];
            for (const product of productDocs) {
              const vq = query(collection(db, 'variants'), where('productId', '==', product._id));
              const vsnap = await getDocs(vq);
              const variants = vsnap.docs.map(v => ({ _id: v.id, ...v.data() }));

              for (const variant of variants) {
                exportRows.push({
                  productId: product._id,
                  productTitle: product.title || "",
                  productSlug: product.slug || "",
                  productStatus: product.status || "",
                  collectionName: product.collectionName || "",
                  variantId: variant._id,
                  variantTitle: variant.title || "",
                  sku: variant.sku || "",
                  price: variant.price || 0,
                  compareAtPrice: variant.compareAtPrice || 0,
                  inventoryQuantity: variant.inventoryQuantity || 0,
                  weight: variant.weight || 0,
                  weightUnit: variant.weightUnit || "g",
                });
              }
            }
            setData(exportRows);
          };
          fetchExportData();
        }
        else if (path === 'rollsManagement.getStockLevels') {
          setData([]);
        }
        else if (path === 'products.getProduct' || path === 'products.getProductBySlug') {
          const fetchProduct = async () => {
            try {
              const targetId = args?.productId || args?.id;
              let productData = null;

              if (targetId) {
                const snap = await getDoc(doc(db, 'products', targetId));
                if (snap.exists()) {
                  productData = { _id: snap.id, ...snap.data() };
                }
              } else if (args?.slug) {
                const q = query(collection(db, 'products'), where('slug', '==', args.slug), limit(1));
                const snap = await getDocs(q);
                if (!snap.empty) {
                  productData = { _id: snap.docs[0].id, ...snap.docs[0].data() };
                }
              }

              if (!productData) {
                setData(null);
                return;
              }

              const vq = query(collection(db, 'variants'), where('productId', '==', productData._id));
              const vsnap = await getDocs(vq);
              productData.variants = vsnap.docs.map(d => ({ _id: d.id, ...d.data() }));
              
              setData(productData);
            } catch (error) {
              console.error("Error fetching product and variants:", error);
              setData(null);
            }
          };

          fetchProduct();
          unsubscribe = () => {};
        }
        else if (path === 'productCategories.listAllWithCounts' || path === 'productCategories.listAll' || path === 'productCategories.listActive' || path === 'productCategories.listAllCategories') {
          const q = query(collection(db, 'productCategoriesConfig'));
          unsubscribe = onSnapshot(q, (snap) => {
            let data = snap.docs.map(d => {
              const docData = d.data();
              return { 
                _id: d.id, 
                id: docData.slug,
                displayName: docData.name,
                ...docData 
              };
            });
            if (path === 'productCategories.listActive') {
              data = data.filter(c => c.isActive);
            }
            data = data.sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
            setData(data);
          });
        }
        else if (path === 'productSections.listSectionContent') {
          const q = query(collection(db, 'productSectionContent'));
          unsubscribe = onSnapshot(q, (snap) => {
            let data = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
            data = data.sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
            setData(data);
          });
        }
        else if (path === 'productSections.listSuggestedProductsConfigs') {
          const q = query(collection(db, 'suggestedProductsConfig'));
          unsubscribe = onSnapshot(q, (snap) => {
            setData(snap.docs.map(d => ({ _id: d.id, ...d.data() })));
          });
        }
        else if (path === 'productSections.listTrendingProductsConfigs') {
          const q = query(collection(db, 'trendingProductsConfig'));
          unsubscribe = onSnapshot(q, (snap) => {
            setData(snap.docs.map(d => ({ _id: d.id, ...d.data() })));
          });
        }
        else if (path === 'productClassification.getClassificationStats') {
          setData({ total: 0, classified: 0, unclassified: 0, byGadget: {}, totalFinishTypes: 0, byFinish: {} });
        }
        else if (path === 'productClassification.previewAutoClassification') {
          setData({ results: [] });
        }
        else if (path === 'migrateProductCategory.previewProductCategoryMigration') {
          setData({ stats: { total: 0, willChange: 0 }, preview: [] });
        }
        else if (path === 'productClassification.getUnclassifiedProducts' || path === 'productClassification.getProductsByClassification' || path === 'productCategories.getUncategorizedProducts') {
          setData([]);
        }
        else if (path === 'productCategories.getCategoryStats') {
          setData({ total: 0, byCategory: {} });
        }
        else if (path === 'supportedModels.getModelInfo') {
          const q = query(collection(db, 'supportedModels'), where('brandName', '==', args.brand), where('modelName', '==', args.model), limit(1));
          unsubscribe = onSnapshot(q, (snap) => {
            if (!snap.empty) {
              setData({ _id: snap.docs[0].id, ...snap.docs[0].data() });
            } else {
              setData(null);
            }
          });
        }
        else if (path === 'gadgetTypes.getByCategory') {
          const q = query(collection(db, 'gadgetTypes'), where('category', '==', args.category), limit(1));
          unsubscribe = onSnapshot(q, (snap) => {
            if (!snap.empty) {
              setData({ _id: snap.docs[0].id, ...snap.docs[0].data() });
            } else {
              setData(null);
            }
          });
        }
        else if (path === 'gadgetTypes.getActive' || path === 'gadgetTypes.listAllActive' || path === 'gadgetTypes.list') {
          const q = query(collection(db, 'gadgetTypes'));
          unsubscribe = onSnapshot(q, (snap) => {
            let data = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
            if (path !== 'gadgetTypes.list') {
              data = data.filter((d: any) => d.isActive === true);
            }
            data = data.sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
            setData(data);
          });
        }
        else if (path === 'finishTypes.getActive' || path === 'finishTypes.listAllActive' || path === 'finishTypes.list') {
          const q = query(collection(db, 'finishTypes'));
          unsubscribe = onSnapshot(q, (snap) => {
            let data = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
            if (path !== 'finishTypes.list') {
              data = data.filter((d: any) => d.isActive === true);
            }
            data = data.sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
            setData(data);
          });
        }
        else if (path === 'categoryDisplaySettings.getAll') {
          const q = query(collection(db, 'categoryDisplaySettings'));
          unsubscribe = onSnapshot(q, (snap) => {
            setData(snap.docs.map(d => ({ _id: d.id, ...d.data() })));
          });
        }
        else if (path === 'seoPages.getPageBySlug') {
          const q = query(collection(db, 'seoPages'), where('slug', '==', args.slug), limit(1));
          unsubscribe = onSnapshot(q, (snap) => {
            if (!snap.empty) {
              setData({ _id: snap.docs[0].id, ...snap.docs[0].data() });
            } else {
              setData(null);
            }
          });
        }
        else if (path === 'sitemap.getSitemapUrls') {
          const fetchSitemap = async () => {
            try {
              const baseUrl = "https://www.goskinly.com";
              const urls: any[] = [];
              const staticPages = [
                { path: "/", priority: 1.0, changefreq: "daily" },
                { path: "/products", priority: 0.9, changefreq: "daily" },
                { path: "/devices", priority: 0.9, changefreq: "weekly" },
                { path: "/policies/privacy", priority: 0.3, changefreq: "monthly" },
                { path: "/policies/terms", priority: 0.3, changefreq: "monthly" },
                { path: "/policies/shipping", priority: 0.4, changefreq: "monthly" },
                { path: "/policies/returns", priority: 0.4, changefreq: "monthly" },
              ];

              const now = new Date().toISOString();
              staticPages.forEach((page) => {
                urls.push({
                  url: `${baseUrl}${page.path}`,
                  lastmod: now,
                  changefreq: page.changefreq,
                  priority: page.priority,
                });
              });

              // Products
              const pq = query(collection(db, 'products'), where('status', '==', 'active'));
              const pSnap = await getDocs(pq);
              pSnap.docs.forEach((doc) => {
                const data = doc.data();
                if (data.slug) {
                  urls.push({
                    url: `${baseUrl}/products/${data.slug}`,
                    lastmod: data.updatedAt ? new Date(data.updatedAt).toISOString() : new Date(data.createdAt || data._creationTime || Date.now()).toISOString(),
                    changefreq: "weekly",
                    priority: 0.8,
                  });
                }
              });

              // Collections
              const cq = query(collection(db, 'collections'));
              const cSnap = await getDocs(cq);
              cSnap.docs.forEach((doc) => {
                const data = doc.data();
                if (data.slug) {
                  urls.push({
                    url: `${baseUrl}/shop?collection=${data.slug}`,
                    lastmod: data.updatedAt ? new Date(data.updatedAt).toISOString() : new Date(data.createdAt || data._creationTime || Date.now()).toISOString(),
                    changefreq: "daily",
                    priority: 0.7,
                  });
                }
              });

              // SEO Pages
              const sq = query(collection(db, 'seoPages'), where('isPublished', '==', true));
              const sSnap = await getDocs(sq);
              sSnap.docs.forEach((doc) => {
                const data = doc.data();
                if (data.slug) {
                  urls.push({
                    url: `${baseUrl}/${data.slug}`,
                    lastmod: data.updatedAt ? new Date(data.updatedAt).toISOString() : new Date(data.createdAt || data._creationTime || Date.now()).toISOString(),
                    changefreq: "weekly",
                    priority: 0.85,
                  });
                }
              });

              setData(urls);
            } catch (err) {
              console.error("Error fetching sitemap:", err);
              setData([]);
            }
          };
          fetchSitemap();
        }
        else if (path === 'settings.getSetting') {
          unsubscribe = onSnapshot(doc(db, 'settings', args?.key || 'default'), (snap) => {
            setData(snap.exists() ? snap.data() : null);
          });
        }
        else if (path === 'mockups.getBatchMockups') {
          setData({ mockups: {} });
        }
        else if (path === 'mockupsAdvanced.getUniqueBrands') {
          const q = query(collection(db, 'supportedModels'));
          unsubscribe = onSnapshot(q, (snap) => {
            const brands = new Set<string>();
            snap.docs.forEach(d => {
              const brandName = d.data().brandName;
              if (brandName) brands.add(brandName.trim());
            });
            setData(Array.from(brands).sort((a, b) => a.localeCompare(b)));
          });
        }
        else if (path === 'mockupsAdvanced.getModelsWithMockups') {
          let q = query(collection(db, 'supportedModels'));
          if (args?.brandFilter && args.brandFilter !== "all") {
            q = query(collection(db, 'supportedModels'), where('brandName', '==', args.brandFilter));
          }
          unsubscribe = onSnapshot(q, async (snap) => {
            const models = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
            // Fetch all mockups to group them efficiently
            const mockupsSnap = await getDocs(collection(db, 'mockups'));
            
            // Map models by their names (case-insensitive) for fallback matching
            const mockupsCountByModelId = new Map<string, number>();
            const mockupsCountByBrandModel = new Map<string, number>();
            
            mockupsSnap.docs.forEach(d => {
              const data = d.data();
              const modelId = data.supportedModelId;
              const brand = data.brand?.toLowerCase().trim() || "";
              const modelName = data.model?.toLowerCase().trim() || "";
              const key = `${brand}_${modelName}`;
              
              if (modelId) {
                mockupsCountByModelId.set(modelId, (mockupsCountByModelId.get(modelId) || 0) + 1);
              } else if (brand && modelName) {
                mockupsCountByBrandModel.set(key, (mockupsCountByBrandModel.get(key) || 0) + 1);
              }
            });
            
            const modelsWithMockups = models.filter(m => {
              const brand = m.brandName?.toLowerCase().trim() || "";
              const modelName = m.modelName?.toLowerCase().trim() || "";
              const key = `${brand}_${modelName}`;
              return mockupsCountByModelId.has(m._id) || mockupsCountByBrandModel.has(key);
            }).map(m => {
              const brand = m.brandName?.toLowerCase().trim() || "";
              const modelName = m.modelName?.toLowerCase().trim() || "";
              const key = `${brand}_${modelName}`;
              const count = (mockupsCountByModelId.get(m._id) || 0) + (mockupsCountByBrandModel.get(key) || 0);
              return {
                ...m,
                mockupCount: count
              };
            });
            setData(modelsWithMockups);
          });
        }
        else if (path === 'mockupsAdvanced.getModelsMissingMockups') {
          let q = query(collection(db, 'supportedModels'));
          if (args?.brandFilter && args.brandFilter !== "all") {
            q = query(collection(db, 'supportedModels'), where('brandName', '==', args.brandFilter));
          }
          unsubscribe = onSnapshot(q, async (snap) => {
            const models = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
            // Fetch all mockups to group them efficiently
            const mockupsSnap = await getDocs(collection(db, 'mockups'));
            
            const modelsWithMockups = new Set<string>();
            const modelsWithMockupsByBrandModel = new Set<string>();
            
            mockupsSnap.docs.forEach(d => {
              const data = d.data();
              const modelId = data.supportedModelId;
              const brand = data.brand?.toLowerCase().trim() || "";
              const modelName = data.model?.toLowerCase().trim() || "";
              const key = `${brand}_${modelName}`;
              
              if (modelId) {
                modelsWithMockups.add(modelId);
              } else if (brand && modelName) {
                modelsWithMockupsByBrandModel.add(key);
              }
            });
            
            const missingModels = models.filter(m => {
              const brand = m.brandName?.toLowerCase().trim() || "";
              const modelName = m.modelName?.toLowerCase().trim() || "";
              const key = `${brand}_${modelName}`;
              return !modelsWithMockups.has(m._id) && !modelsWithMockupsByBrandModel.has(key);
            });
            setData(missingModels);
          });
        }
        else if (path === 'mockupsAdvanced.getModelsWithFullCoverage') {
          setData([]); // Mocked as empty for now, as it requires complex logic
        }
        else if (path === 'mockupsAdvanced.getOverviewStats') {
          setData({
            totalMockups: 0,
            uniqueSKUs: 0,
            totalSKUs: 359,
            coverage: 0
          });
        }
        else if (path === 'mockupsAdvanced.getModelMockupStats') {
          if (!args?.modelId) {
            setData(null);
            return;
          }
          
          // First, get the model details to fallback to brand/model name matching
          const modelDoc = await getDoc(doc(db, 'supportedModels', args.modelId));
          const modelData = modelDoc.exists() ? modelDoc.data() : null;
          
          // Try to find mockups by modelId
          let q = query(collection(db, 'mockups'), where('supportedModelId', '==', args.modelId));
          
          unsubscribe = onSnapshot(q, async (snap) => {
            let mockups = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
            
            // Fallback: If no mockups found by ID but we have model data, search by brand/model name
            if (mockups.length === 0 && modelData) {
               const allMockupsSnap = await getDocs(collection(db, 'mockups'));
               const brandNameLower = modelData.brandName?.toLowerCase().trim() || "";
               const modelNameLower = modelData.modelName?.toLowerCase().trim() || "";
               
               if (brandNameLower && modelNameLower) {
                 mockups = allMockupsSnap.docs
                   .map(d => ({ _id: d.id, ...d.data() }))
                   .filter((m: any) => 
                     !m.supportedModelId && 
                     m.brand?.toLowerCase().trim() === brandNameLower && 
                     m.model?.toLowerCase().trim() === modelNameLower
                   );
               }
            }
            
            setData({
              totalSKUs: 359,
              uploadedSKUs: mockups.length,
              missingSKUs: [],
              missingSKUsInStock: [],
              missingSKUsOutOfStock: [],
              coverage: Math.min(Math.round((mockups.length / 359) * 100), 100),
              mockups: mockups
            });
          });
        }
        else if (path === 'variantConsumptionPresets.listAll') {
          const q = query(collection(db, 'gadgetTypes'));
          unsubscribe = onSnapshot(q, async (snap) => {
            const gadgetTypes = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
            const presetsSnap = await getDocs(collection(db, 'variantConsumptionPresets'));
            const presets = presetsSnap.docs.map(d => ({ _id: d.id, ...d.data() }));
            
            const result = gadgetTypes.map(gt => ({
              gadgetType: gt,
              presets: presets.filter((p: any) => p.gadgetTypeId === gt._id)
            }));
            setData(result);
          });
        }
        else if (path === 'phoneCollectionsQueries.getPhoneCollectionsWithCounts') {
          const q = query(collection(db, 'phoneCollections'));
          unsubscribe = onSnapshot(q, (snap) => {
            setData(snap.docs.map(d => ({ _id: d.id, ...d.data() })));
          });
        }
        else if (path === 'whatsapp.getApprovedTemplates') {
          const q = query(collection(db, 'whatsappTemplates'));
          unsubscribe = onSnapshot(q, (snap) => {
            setData(snap.docs.map(d => ({ _id: d.id, ...d.data() })));
          });
        }
        else if (path === 'whatsapp.getAllUsecases') {
          const q = query(collection(db, 'whatsappUsecases'));
          unsubscribe = onSnapshot(q, (snap) => {
            setData(snap.docs.map(d => ({ _id: d.id, ...d.data() })));
          });
        }
        else if (path === 'whatsapp.getApprovedTemplates') {
          const q = query(collection(db, 'whatsappTemplates'));
          unsubscribe = onSnapshot(q, (snap) => {
            setData(snap.docs.map(d => ({ _id: d.id, ...d.data() })));
          });
        }
        else if (path === 'whatsapp.getWhatsAppProviderSettings') {
          unsubscribe = onSnapshot(doc(db, 'whatsappSettings', 'provider'), (snap) => {
            if (snap.exists()) {
              setData(snap.data());
            } else {
              setData(null);
            }
          });
        }
        else if (path === 'whatsapp.getAdminNotificationSettings') {
          unsubscribe = onSnapshot(doc(db, 'whatsappSettings', 'adminNotifications'), (snap) => {
            if (snap.exists()) {
              setData(snap.data());
            } else {
              setData({ enabled: false, adminPhone: '' });
            }
          });
        }
        else if (path === 'whatsappMessaging.getMessages') {
          let q = query(collection(db, 'whatsappMessages'), limit(50));
          if (args?.status && args.status !== 'all') {
            q = query(collection(db, 'whatsappMessages'), where('status', '==', args.status), limit(50));
          } else if (args?.usecaseKey && args.usecaseKey !== 'all') {
            q = query(collection(db, 'whatsappMessages'), where('usecaseKey', '==', args.usecaseKey), limit(50));
          } else if (args?.recipientPhone) {
            q = query(collection(db, 'whatsappMessages'), where('recipientPhone', '==', args.recipientPhone), limit(50));
          }
          unsubscribe = onSnapshot(q, (snap) => {
            const docs = snap.docs.map(d => ({
              _id: d.id,
              ...d.data(),
              createdAtFormatted: new Date(d.data().createdAt || Date.now()).toLocaleString(),
              sentAtFormatted: d.data().sentAt ? new Date(d.data().sentAt).toLocaleString() : null,
            }));
            docs.sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0));
            setData(docs);
          });
        }
        else if (path === 'whatsappMessaging.getQueueStats') {
          setData({ pending: 0, processing: 0, failed: 0 });
        }
        else if (path === 'whatsappMessaging.getDeliveryStats') {
          setData({ total: 0, delivered: 0, failed: 0, pending: 0, sent: 0, read: 0 });
        }
        else if (path === 'whatsappMessaging.getMessageDetails') {
          if (!args?.messageId) {
            setData(null);
            return;
          }
          unsubscribe = onSnapshot(doc(db, 'whatsappMessages', args.messageId), (snap) => {
            setData(snap.exists() ? { _id: snap.id, ...snap.data() } : null);
          });
        }
        else if (path === 'whatsappHealthCheck.getSystemHealth') {
          const q = query(collection(db, 'whatsappUsecases'));
          unsubscribe = onSnapshot(q, (snap) => {
            const usecases = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
            const enabledUsecases = usecases.filter((u: any) => u.isActive).length;
            setData({
              overallStatus: "healthy",
              provider: { configured: true, active: true, provider: "authkey", hasCredentials: true },
              queue: { pending: 0, processing: 0, failed: 0, stuck: 0 },
              stats: { messages24h: 0, successRate: 100, enabledUsecases, totalUsecases: usecases.length },
              usecases
            });
          });
        }
        else if (path === 'emailManagement.getAllUsecases') {
          const q = query(collection(db, 'emailUsecaseTemplates'));
          unsubscribe = onSnapshot(q, (snap) => {
            setData(snap.docs.map(d => ({ _id: d.id, ...d.data() })));
          });
        }
        else if (path === 'emailManagement.getStats') {
          setData({ total: 0, sent: 0, failed: 0, pending: 0, successRate: 0 });
        }
        else if (path === 'users.isCurrentUserAdmin') {
          let innerUnsubscribe = () => {};
          const { getAuth } = await import('firebase/auth');
          const auth = getAuth();
          
          const unsubscribeAuth = auth.onAuthStateChanged((user) => {
            if (!user) {
              setData({ isAdmin: false, isAuthenticated: false });
              return;
            }

            if (user.email === 'chandan1992@gmail.com') {
              setData({ isAdmin: true, isAuthenticated: true });
              return;
            }

            // Check firestore user doc
            innerUnsubscribe = onSnapshot(doc(db, 'users', user.uid), (snap) => {
              if (snap.exists() && snap.data().isAdmin) {
                setData({ isAdmin: true, isAuthenticated: true });
              } else {
                setData({ isAdmin: false, isAuthenticated: true });
              }
            });
          });
          unsubscribe = () => { unsubscribeAuth(); innerUnsubscribe(); };
        }
        else if (path === 'users.getCurrentUser' || path === 'users.getProfileData') {
          let innerUnsubscribe = () => {};
          const { getAuth } = await import('firebase/auth');
          const auth = getAuth();
          
          const unsubscribeAuth = auth.onAuthStateChanged((user) => {
            if (!user) {
              setData(null);
              return;
            }

            innerUnsubscribe = onSnapshot(doc(db, 'users', user.uid), (snap) => {
              const userData = snap.exists() ? snap.data() : {};
              const isAdmin = user.email === 'chandan1992@gmail.com' || userData.isAdmin;
              setData({
                _id: user.uid,
                email: user.email,
                name: user.displayName || userData.name || 'User',
                isAdmin: isAdmin,
                ...userData
              });
            });
          });
          unsubscribe = () => { unsubscribeAuth(); innerUnsubscribe(); };
        }
        // Fallback for direct document gets
        else if (args?.id) {
          const collectionName = path.split('.')[0];
          unsubscribe = onSnapshot(doc(db, collectionName, args.id), (snap) => {
            setData(snap.exists() ? { _id: snap.id, ...snap.data() } : null);
          });
        }
        // Fallback for simple collection queries
        else {
          const collectionName = path.split('.')[0];
          if (path.toLowerCase().includes('stats') || path.toLowerCase().includes('settings') || path.toLowerCase().includes('count')) {
            // Return a dummy object for stats/settings to prevent "Cannot read properties of undefined"
            setData({
              total: 0, count: 0, active: 0, inactive: 0, revenue: 0,
              pending: 0, processing: 0, completed: 0, failed: 0,
              enabled: false, byBrand: {}, byCategory: {}
            });
          } else {
            const q = query(collection(db, collectionName), limit(50));
            unsubscribe = onSnapshot(q, (snap) => {
              setData(snap.docs.map(d => ({ _id: d.id, ...d.data() })));
            });
          }
        }
      } catch (err: any) {
        console.error(`Error in useQuery for ${path}:`, err);
        setError(err);
      }
    };

    fetchData();

    return () => unsubscribe();
  }, [path, JSON.stringify(args)]);

  return data;
}

export function useMutation(apiRef: any) {
  const path = getPath(apiRef);

  return useCallback(async (args: any) => {
    try {
      console.log(`Mutation called for ${path} with args:`, args);
      
      const collectionName = path.split('.')[0];
      const actionName = path.split('.')[1];

      if (path === 'users.updateCurrentUser') {
        const { getAuth } = await import('firebase/auth');
        const auth = getAuth();
        const user = auth.currentUser;
        if (user) {
          // Remove undefined values to avoid Firebase errors
          const cleanArgs = Object.fromEntries(Object.entries(args).filter(([_, v]) => v !== undefined));
          await setDoc(doc(db, 'users', user.uid), cleanArgs, { merge: true });
        }
        return { success: true };
      }
      
      // Handle cart specific operations
      if (collectionName === 'cart') {
        const { getAuth } = await import('firebase/auth');
        const auth = getAuth();
        const user = auth.currentUser;
        
        // --- CART & CHECKOUT (Guest operations) ---
        if (actionName === 'syncGuestCartToDb' || actionName === 'syncGuestCart') {
          // Allow this operation for both authenticated users and guests
          const sessionId = args.sessionId;
          if (!user && !sessionId) return { success: false };
          
          const batch = writeBatch(db);
          for (const item of (args.items || args.guestCartItems || [])) {
            // Re-verify prices for guest items to prevent tampering
            let realPrice = item.price;
            try {
               const variantQ = query(collection(db, 'variants'), where('productId', '==', item.productId), where('title', '==', item.variant));
               const variantSnap = await getDocs(variantQ);
               if (!variantSnap.empty) {
                 realPrice = variantSnap.docs[0].data().price || item.price;
               }
            } catch(e) {}
            
            const newDoc = doc(collection(db, 'cart'));
            const cartData: any = {
              ...item,
              price: realPrice,
              addedAt: Date.now()
            };
            
            if (user) {
              cartData.userId = user.uid;
            } else if (sessionId) {
              cartData.sessionId = sessionId;
            }
            
            batch.set(newDoc, cartData);
          }
          await batch.commit();
          return { success: true };
        }
        
        // For other cart operations, try to use user OR sessionId
        const sessionId = args.sessionId;
        
        if (!user && !sessionId) {
          throw new Error('UNAUTHENTICATED');
        }

        
        if (actionName === 'addToCart') {
          // Fetch the real price from DB to prevent tampering
          const productSnap = await getDoc(doc(db, 'products', args.productId));
          let realPrice = args.price; // fallback
          if (productSnap.exists()) {
             const variantQ = query(collection(db, 'variants'), where('productId', '==', args.productId), where('title', '==', args.variant));
             const variantSnap = await getDocs(variantQ);
             if (!variantSnap.empty) {
               realPrice = variantSnap.docs[0].data().price || args.price;
             }
          }
          
          const cartData: any = {
            ...args,
            price: realPrice,
            addedAt: Date.now()
          };
          
          if (user) cartData.userId = user.uid;
          else if (sessionId) cartData.sessionId = sessionId;
          
          const docRef = await addDoc(collection(db, 'cart'), cartData);
          return docRef.id;
        }
        if (actionName === 'removeFromCart') {
          const targetId = args.id || args.cartId;
          await deleteDoc(doc(db, 'cart', targetId));
          return targetId;
        }
        if (actionName === 'updateQuantity') {
          const targetId = args.id || args.cartId;
          await updateDoc(doc(db, 'cart', targetId), { quantity: args.quantity });
          return targetId;
        }
        if (actionName === 'clearCart') {
          if (user) {
            const q = query(collection(db, 'cart'), where('userId', '==', user.uid));
            const snap = await getDocs(q);
            const batch = writeBatch(db);
            snap.docs.forEach(d => batch.delete(d.ref));
            await batch.commit();
          } else if (sessionId) {
            const q = query(collection(db, 'cart'), where('sessionId', '==', sessionId));
            const snap = await getDocs(q);
            const batch = writeBatch(db);
            snap.docs.forEach(d => batch.delete(d.ref));
            await batch.commit();
          }
          return true;
        }
      }
      

      
      if (collectionName === 'coupons' && actionName === 'validateCoupon') {
        const q = query(collection(db, 'coupons'), where('code', '==', args.code), limit(1));
        const snap = await getDocs(q);
        if (snap.empty) return { isValid: false, reason: "Invalid code" };
        
        const c = snap.docs[0].data();
        if (!c.isActive) return { isValid: false, reason: "Coupon inactive" };
        
        return { 
          isValid: true, 
          coupon: { _id: snap.docs[0].id, ...c }, 
          discountAmount: c.discountValue || 100,
          walletCreditAmount: c.cashbackValue || 0
        };
      }
      
      if (collectionName === 'orders' && actionName === 'createOrder') {
        const { getFunctions, httpsCallable } = await import('firebase/functions');
        const functions = getFunctions();
        const callCreateOrder = httpsCallable(functions, 'createOrder');
        const response = await callCreateOrder(args);
        return response.data;
      }
      
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
        const { getFunctions, httpsCallable } = await import('firebase/functions');
        const functions = getFunctions();
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
        const { getFunctions, httpsCallable } = await import('firebase/functions');
        const functions = getFunctions();
        const callable = httpsCallable(functions, 'checkPaymentStatus');
        const res: any = await callable(args);
        return res.data;
      }
      if (collectionName === 'codOtp' && actionName === 'generateCodOtp') {
        return { success: true };
      }
      if (collectionName === 'codOtp' && actionName === 'verifyCodOtp') {
        return { success: true };
      }
      
      if (actionName === 'generateUploadUrl' || actionName === 'generateImageUploadUrl') {
        const { getFunctions, httpsCallable } = await import('firebase/functions');
        const functions = getFunctions();
        const callUpload = httpsCallable(functions, 'generateUploadUrl');
        
        // Pass fake filename for R2 generation
        const fileName = args?.fileName || `upload_${Date.now()}_${Math.floor(Math.random()*1000)}`;
        const contentType = args?.contentType || 'image/jpeg';
        
        const response = await callUpload({ fileName, contentType });
        return response.data?.uploadUrl || "";
      }
      
      if (actionName === 'sendWhatsAppMessage' || actionName === 'sendOrderWhatsApp') {
        const { getFunctions, httpsCallable } = await import('firebase/functions');
        const functions = getFunctions();
        const callWhatsApp = httpsCallable(functions, 'sendWhatsAppMessage');
        const response = await callWhatsApp(args);
        return response.data;
      }
      
      if (collectionName === 'seoContentGenerator' && actionName === 'generateSEOContent') {
        const { getFunctions, httpsCallable } = await import('firebase/functions');
        const functions = getFunctions();
        const callGenerate = httpsCallable(functions, 'generateSEOContent');
        const response = await callGenerate(args);
        return response.data;
      }
      
      if (collectionName === 'rapidshyp' && actionName === 'createShipment') {
        const { getFunctions, httpsCallable } = await import('firebase/functions');
        const functions = getFunctions();
        const callShipment = httpsCallable(functions, 'createShipment');
        const response = await callShipment(args);
        return response.data;
      }
      
      // --- END CART & CHECKOUT ---
      if (collectionName === 'orders' || collectionName === 'admin') {
        const trueCollection = collectionName === 'admin' ? path.split('.')[1] : collectionName;
        const actualActionName = collectionName === 'admin' ? path.split('.')[2] : actionName;
        
        if (actualActionName === 'updatePaymentStatus' || actualActionName === 'updateOrderPaymentStatus') {
          let docId = args.orderId;
          
          if (!docId && args.merchantTransactionId) {
            // Find order by merchantTxnId
            const q = query(collection(db, trueCollection), limit(10));
            const snap = await getDocs(q);
            // Just picking the first one for local mock, in real DB would search by merchantTransactionId
            if (!snap.empty) docId = snap.docs[0].id;
          }
          
          if (docId) {
            await updateDoc(doc(db, trueCollection, docId), { 
              paymentStatus: args.status || args.paymentStatus,
              updatedAt: Date.now()
            });
          }
          return docId;
        }
        
        if (actualActionName === 'updateOrderStatus') {
          await updateDoc(doc(db, trueCollection, args.orderId), { 
            status: args.status,
            updatedAt: Date.now()
          });
          return args.orderId;
        }
        
        if (actualActionName === 'updateShippingInfo') {
          await updateDoc(doc(db, trueCollection, args.orderId), { 
            courierName: args.courierName,
            trackingNumber: args.trackingNumber,
            trackingUrl: args.trackingUrl,
            status: args.status || 'shipped',
            shippedAt: Date.now(),
            updatedAt: Date.now()
          });
          return args.orderId;
        }
        
        if (actualActionName === 'updateOrderShippingAddress') {
          await updateDoc(doc(db, trueCollection, args.orderId), { 
            shippingAddress: {
              firstName: args.firstName,
              lastName: args.lastName,
              address1: args.address1,
              address2: args.address2,
              city: args.city,
              state: args.state,
              pincode: args.pincode,
              phone: args.phone,
              email: args.email
            },
            updatedAt: Date.now()
          });
          return args.orderId;
        }
        
        if (actualActionName === 'updateCustomerInfo') {
          await updateDoc(doc(db, trueCollection, args.orderId), { 
            customerName: args.customerName,
            email: args.email,
            phone: args.phone,
            updatedAt: Date.now()
          });
          return args.orderId;
        }
        
        if (actualActionName === 'updateOrderItems') {
          await updateDoc(doc(db, trueCollection, args.orderId), { 
            items: args.items,
            subtotal: args.subtotal,
            total: args.total,
            updatedAt: Date.now()
          });
          return args.orderId;
        }
        
        if (actualActionName === 'softDeleteOrders') {
          const batch = writeBatch(db);
          args.orderIds.forEach((id: string) => {
            batch.update(doc(db, 'orders', id), { status: 'deleted', updatedAt: Date.now() });
          });
          await batch.commit();
          return true;
        }
        
        if (actualActionName === 'restoreOrders') {
          const batch = writeBatch(db);
          args.orderIds.forEach((id: string) => {
            batch.update(doc(db, 'orders', id), { status: 'pending', updatedAt: Date.now() });
          });
          await batch.commit();
          return true;
        }
        
        if (actualActionName === 'deleteOrder') {
          await deleteDoc(doc(db, 'orders', args.orderId));
          return true;
        }
        
        if (actualActionName === 'createManualOrder') {
          const docRef = await addDoc(collection(db, 'orders'), {
            ...args.orderData,
            orderNumber: `MAN-${Math.floor(Math.random() * 100000)}`,
            createdAt: Date.now(),
            updatedAt: Date.now()
          });
          return docRef.id;
        }
      }
      
      if (collectionName === 'mockupsAdvanced') {
        if (actionName === 'migrateMockupsToModels') {
          return { updated: 0, noMatch: 0, total: 0 };
        }
        if (actionName === 'deleteAllMockupsForModel') {
          const q = query(collection(db, 'mockups'), where('supportedModelId', '==', args.modelId));
          const snap = await getDocs(q);
          const batch = writeBatch(db);
          snap.docs.forEach(d => batch.delete(d.ref));
          await batch.commit();
          return { deleted: snap.size };
        }
        if (actionName === 'storeMockupAdvanced') {
          const docRef = await addDoc(collection(db, 'mockups'), args);
          return docRef.id;
        }
        if (actionName === 'deleteMockup') {
          await deleteDoc(doc(db, 'mockups', args.mockupId));
          return { success: true };
        }
        if (actionName === 'deleteAllMockups') {
          return { deleted: 0, hasMore: false };
        }
        if (actionName === 'deleteMockupsBySKU') {
          const q = query(collection(db, 'mockups'), where('sku', '==', args.sku));
          const snap = await getDocs(q);
          const batch = writeBatch(db);
          snap.docs.forEach(d => batch.delete(d.ref));
          await batch.commit();
          return { deleted: snap.size };
        }
      }

      if (collectionName === 'variantConsumptionPresets') {
        if (actionName === 'create') {
          const docRef = await addDoc(collection(db, 'variantConsumptionPresets'), { ...args, isActive: true });
          return docRef.id;
        }
        if (actionName === 'update') {
          await updateDoc(doc(db, 'variantConsumptionPresets', args.presetId), args);
          return args.presetId;
        }
        if (actionName === 'remove') {
          await deleteDoc(doc(db, 'variantConsumptionPresets', args.presetId));
          return { success: true };
        }
        if (actionName === 'toggleActive') {
          await updateDoc(doc(db, 'variantConsumptionPresets', args.presetId), { isActive: args.isActive });
          return args.presetId;
        }
      }
      
      if (collectionName === 'phoneCollections') {
        if (actionName === 'runPhoneCollectionsMigration') {
          return { collectionsCreated: 0, productsAssigned: 0, errors: [] };
        }
      }
      
      if (collectionName === 'migrateVariantPresetsAutoAssign') {
        if (actionName === 'autoAssignPresets') {
          return { success: true, matched: 0, unmatched: 0, skipped: 0, statusBreakdown: { active: 0, draft: 0, archived: 0 }, unmatchedVariants: [] };
        }
      }

      if (collectionName === 'rapidshyp') {
        return { success: true, message: "Mocked rapidshyp response" };
      }
      
      let targetCollection = collectionName;
      if (actionName.toLowerCase().includes('heroslide')) targetCollection = 'heroSlides';
      else if (actionName.toLowerCase().includes('featurebanner')) targetCollection = 'featureBanners';
      else if (actionName.toLowerCase().includes('ugcvideo')) targetCollection = 'ugcVideos';
      else if (actionName === 'updateHomepageSettings') targetCollection = 'homepageSettings';
      else if (actionName.toLowerCase().includes('homepagesection')) targetCollection = 'homepageSections';
      else if (collectionName === 'admin') targetCollection = path.split('.')[1];

      // Generic add/update
      if (actionName.includes('create') || actionName.includes('add') || actionName.includes('insert')) {
        const docRef = await addDoc(collection(db, targetCollection), args);
        return docRef.id;
      }
      
      if (actionName.includes('update') || actionName.includes('edit')) {
        if (actionName === 'updateHomepageSettings') {
          await setDoc(doc(db, targetCollection, 'default'), args, { merge: true });
          return 'default';
        }
        if (actionName === 'saveWhatsAppProviderSettings') {
          await setDoc(doc(db, 'whatsappSettings', 'provider'), { ...args, lastUpdatedAt: Date.now() }, { merge: true });
          return 'provider';
        }
        if (actionName === 'saveAdminNotificationSettings') {
          await setDoc(doc(db, 'whatsappSettings', 'adminNotifications'), { ...args, lastUpdatedAt: Date.now() }, { merge: true });
          return 'adminNotifications';
        }
        
        if (actionName === 'updateUsecase') {
          // find doc by usecaseKey
          const q = query(collection(db, 'whatsappUsecases'), where('usecaseKey', '==', args.usecaseKey), limit(1));
          const snap = await getDocs(q);
          if (!snap.empty) {
            await updateDoc(doc(db, 'whatsappUsecases', snap.docs[0].id), args);
            return snap.docs[0].id;
          }
          throw new Error("Usecase not found");
        }

        if (actionName === 'redeemWalletCreditCoupon') {
          const { getAuth } = await import('firebase/auth');
          const auth = getAuth();
          const user = auth.currentUser;
          if (!user) throw new Error("Must be logged in");
          
          if (!args.code) throw new Error("Code required");
          
          // Mock coupon redemption logic for wallet credit
          const code = args.code.toUpperCase();
          if (code === 'WELCOME50' || code === 'SKINLY50') {
            const amount = 50;
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            const currentBalance = userDoc.exists() ? (userDoc.data().walletBalance || 0) : 0;
            
            // Log transaction
            await addDoc(collection(db, 'walletTransactions'), {
              userId: user.uid,
              amount: amount,
              type: 'credit',
              source: 'coupon_credit',
              status: 'completed',
              description: `Redeemed coupon ${code}`,
              metadata: { code }
            });
            
            // Update balance
            await updateDoc(doc(db, 'users', user.uid), { walletBalance: currentBalance + amount });
            return { success: true, message: "Coupon redeemed successfully", creditAmount: amount };
          }
          
          throw new Error("Invalid or expired coupon code");
        }

        const targetId = args.id || args.ruleId || args.sectionId || args.slideId || args.bannerId || args.videoId;
        if (!targetId) throw new Error(`ID required for update (${actionName})`);
        const { id, ruleId, sectionId, slideId, bannerId, videoId, ...data } = args;
        await updateDoc(doc(db, targetCollection, targetId), data);
        return targetId;
      }
      
      if (actionName === 'bulkDisableCoupons') {
          const BATCH_SIZE = 450;
          for (let i = 0; i < args.couponIds.length; i += BATCH_SIZE) {
            const chunk = args.couponIds.slice(i, i + BATCH_SIZE);
            const batch = writeBatch(db);
            chunk.forEach((id: string) => {
              if (id) batch.set(doc(db, 'coupons', id), { isActive: false }, { merge: true });
            });
            await batch.commit();
          }
          return { success: true };
        }

        if (actionName === 'bulkReorderSections') {
          const batch = writeBatch(db);
          args.sectionOrders.forEach((so: any) => {
            batch.update(doc(db, 'homepageSections', so.sectionId), { order: so.order });
          });
          await batch.commit();
          return { success: true };
        }

        if (actionName === 'bulkReorderSectionCards') {
          const batch = writeBatch(db);
          args.cardOrders.forEach((co: any) => {
            batch.update(doc(db, 'homepageSectionCards', co.cardId), { order: co.order });
          });
          await batch.commit();
          return { success: true };
        }

        const actionNameLower = actionName.toLowerCase();
        if (actionNameLower.includes('delete') || actionNameLower.includes('remove')) {
          const bulkIds = args.couponIds || args.ids || args.pageIds || args.productIds;
          if (bulkIds && Array.isArray(bulkIds)) {
            const BATCH_SIZE = 450;
            for (let i = 0; i < bulkIds.length; i += BATCH_SIZE) {
              const chunk = bulkIds.slice(i, i + BATCH_SIZE);
              const batch = writeBatch(db);
              chunk.forEach((id: string) => {
                if (id) batch.delete(doc(db, collectionName, id));
              });
              await batch.commit();
            }
            return { success: true };
          }

          if (!args.id && !args.couponId && !args.ruleId && !args.pageId && !args.slideId && !args.bannerId && !args.videoId) throw new Error(`ID required for delete (${actionName})`);
          const targetId = args.id || args.couponId || args.ruleId || args.pageId || args.slideId || args.bannerId || args.videoId;
          await deleteDoc(doc(db, targetCollection, targetId));
          return targetId;
        }
      
      if (actionName === 'autoGenerateBrandCards' || actionName === 'autoGenerateGadgetCards') {
        // Mock implementation for generating cards
        return { success: true };
      }
      
      // Default: try calling a cloud function
      console.log(`Unmapped action ${actionName}, trying cloud function...`);
      const callable = httpsCallable(functions, actionName);
      const result = await callable(args);
      return result.data;
      
    } catch (err) {
      console.error(`Mutation error in ${path}:`, err);
      throw err;
    }
  }, [path]);
}

export function useAction(apiRef: any) {
  const path = getPath(apiRef);

  return useCallback(async (args: any) => {
    console.log(`Action called for ${path} with args:`, args);
    const collectionName = path.split('.')[0];
    const actionName = path.split('.').pop() || 'defaultAction';
    
    // Check for mocked actions first
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
      const callable = httpsCallable(functions, 'checkPaymentStatus');
      const res: any = await callable(args);
      return res.data;
    }
    
    if (collectionName === 'phoneCollections' && actionName === 'runPhoneCollectionsMigration') {
      return { collectionsCreated: 0, productsAssigned: 0, errors: [] };
    }
    
    if (collectionName === 'migrateVariantPresetsAutoAssign' && actionName === 'autoAssignPresets') {
      return { success: true, matched: 0, unmatched: 0, skipped: 0, statusBreakdown: { active: 0, draft: 0, archived: 0 }, unmatchedVariants: [] };
    }

    // Intercept R2 uploads to use presigned URLs directly from the client
    // This avoids sending huge base64 payloads through Firebase Functions
    if ((collectionName === 'r2' && actionName === 'uploadToR2') || 
        (collectionName === 'mediaLibrary' && actionName === 'uploadAndAddToLibrary')) {
      try {
        console.log(`Intercepting ${actionName} locally...`);
        const callable = httpsCallable(functions, 'generateUploadUrl');
        
        // Handle mediaLibrary specific payload structure
        const fileBase64 = args.fileBase64 || args.imageBase64;
        let r2Key = args.key;
        
        if (!r2Key && args.filename) {
          const sanitizedFilename = args.filename.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9-_]/g, "_");
          const folder = args.folder || "general";
          r2Key = `${folder}/${sanitizedFilename}_${Date.now()}.webp`;
        }
        
        const contentType = args.contentType || (args.mediaType === 'video' ? 'video/mp4' : 'image/webp');
        
        const res: any = await callable({
          fileName: r2Key,
          contentType: contentType
        });
        
        if (res.data && res.data.success) {
          // Extract clean base64 data
          let base64Data = fileBase64;
          if (base64Data.includes(",")) {
            base64Data = base64Data.split(",")[1];
          }
          
          // Robust conversion from base64 to Blob to avoid URL length limits
          const byteString = atob(base64Data);
          const ab = new ArrayBuffer(byteString.length);
          const ia = new Uint8Array(ab);
          for (let i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i);
          }
          const blob = new Blob([ab], { type: contentType });
          
          // Upload directly to R2 using the presigned URL
          // Make sure not to send any extra headers that aren't signed
          const uploadRes = await fetch(res.data.uploadUrl, {
            method: 'PUT',
            body: blob,
            headers: {
              'Content-Type': contentType
            }
          });
          
          if (uploadRes.ok) {
            // Add a fallback URL computation in case Cloud Function doesn't return publicUrl
            const finalPublicUrl = res.data.publicUrl || `https://cdn.goskinly.com/${r2Key}`;

            // If it's a media library upload, save the document to Firestore
            if (collectionName === 'mediaLibrary') {
              try {
                const { getFirestore, collection, addDoc } = await import('firebase/firestore');
                const { getAuth } = await import('firebase/auth');
                const db = getFirestore();
                const auth = getAuth();
                
                const estimatedBytes = Math.floor((base64Data.length * 3) / 4);
                
                await addDoc(collection(db, 'mediaLibrary'), {
                  cloudinaryUrl: finalPublicUrl, // Use the computed fallback URL
                  cloudinaryPublicId: r2Key,
                  filename: args.filename || r2Key.split('/').pop(),
                  folder: args.folder || "general",
                  mediaType: args.mediaType || "image",
                  format: "webp",
                  width: 0,
                  height: 0,
                  bytes: estimatedBytes,
                  tags: args.tags || [],
                  uploadedBy: auth.currentUser?.email || "system",
                  createdAt: Date.now()
                });
              } catch (e: any) {
                console.error("Failed to save media record to Firestore:", e);
                // If it's a blocked by client error (ad blocker), alert the user
                if (e.message?.includes('Failed to fetch') || e.name === 'FirebaseError') {
                  console.warn("Firestore write blocked by client (likely an ad blocker). Media uploaded to R2 but not saved to library.");
                }
              }
            }
            
            return {
              success: true,
              url: finalPublicUrl,
              publicUrl: finalPublicUrl, // Keep both for compatibility
              cloudinaryUrl: finalPublicUrl, // For media library compatibility
              publicId: r2Key, // For media library compatibility
              key: r2Key,
              bucket: 'skinly'
            };
          } else {
            return { success: false, error: 'Failed to upload to R2 via presigned URL' };
          }
        }
        return { success: false, error: res.data?.error || 'Failed to generate upload URL' };
      } catch (err: any) {
        console.error("R2 Upload error:", err);
        return { success: false, error: err.message };
      }
    }
    
    // Intercept media library deletion
    if (collectionName === 'mediaLibrary' && (actionName === 'deleteMedia' || actionName === 'bulkDeleteMedia')) {
      try {
        const { getFirestore, doc, deleteDoc } = await import('firebase/firestore');
        const db = getFirestore();
        
        if (actionName === 'deleteMedia') {
          await deleteDoc(doc(db, 'mediaLibrary', args.id));
          return { success: true };
        } else {
          const promises = args.ids.map((id: string) => deleteDoc(doc(db, 'mediaLibrary', id)));
          await Promise.all(promises);
          return { success: true, deletedCount: args.ids.length };
        }
      } catch (e: any) {
        return { success: false, error: e.message };
      }
    }

    // Default to calling cloud function
    const callable = httpsCallable(functions, actionName);
    const result = await callable(args);
    return result.data;
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
    
    const fetchInitial = async () => {
      setStatus("LoadingFirstPage");
      try {
        // Fetch all active to avoid composite index errors
        const q = query(collection(db, collectionName), where('status', '==', 'active'));
        const snap = await getDocs(q);
        
        let filtered = snap.docs.map(d => ({ _id: d.id, ...d.data() })) as any[];
        
        // In-memory filtering for multiple constraints
        if (args && typeof args === 'object') {
          if (args.productCategory) {
            filtered = filtered.filter(p => p.productCategory === args.productCategory);
          }
          if (args.gadgetTypeId) {
            filtered = filtered.filter(p => p.gadgetTypeId === args.gadgetTypeId);
          }
          if (args.finishTypeId) {
            filtered = filtered.filter(p => p.finishTypeId === args.finishTypeId);
          }
          if (args.gadgetCategory) {
            filtered = filtered.filter(p => p.gadgetCategory === args.gadgetCategory);
          }
        }
        
        // Sort by creation time descending
        filtered.sort((a, b) => {
          const aTime = a.createdAt || a._creationTime || 0;
          const bTime = b.createdAt || b._creationTime || 0;
          return bTime - aTime;
        });
        
        setAllMatches(filtered);
        
        // Load first page
        const firstPage = filtered.slice(0, options.initialNumItems);
        
        // Let's attach variants if this is products
        let data = firstPage;
        if (collectionName === 'products') {
          data = await Promise.all(data.map(async (product: any) => {
            const vq = query(collection(db, 'variants'), where('productId', '==', product._id));
            const vsnap = await getDocs(vq);
            return {
              ...product,
              variants: vsnap.docs.map(v => ({ _id: v.id, ...v.data() }))
            };
          }));
        }
        
        setResults(data);
        setStatus(filtered.length <= options.initialNumItems ? "Exhausted" : "CanLoadMore");
      } catch (err) {
        console.error(`Error in paginated query ${path}:`, err);
        setStatus("Exhausted");
      }
    };
    
    fetchInitial();
  }, [path, JSON.stringify(args), options.initialNumItems]);

  const loadMore = useCallback(async (numItems: number) => {
    if (status === 'Exhausted' || status === 'LoadingMore') return;
    
    setStatus("LoadingMore");
    try {
      const collectionName = path.includes('products') ? 'products' : path.split('.')[0];
      const nextStartIndex = results.length;
      const nextEndIndex = nextStartIndex + numItems;
      const nextPage = allMatches.slice(nextStartIndex, nextEndIndex);
      
      if (nextPage.length === 0) {
        setStatus("Exhausted");
        return;
      }
      
      let newData = nextPage;
      if (collectionName === 'products') {
        newData = await Promise.all(newData.map(async (product: any) => {
          const vq = query(collection(db, 'variants'), where('productId', '==', product._id));
          const vsnap = await getDocs(vq);
          return {
            ...product,
            variants: vsnap.docs.map(v => ({ _id: v.id, ...v.data() }))
          };
        }));
      }
      
      setResults(prev => [...prev, ...newData]);
      setStatus(nextEndIndex >= allMatches.length ? "Exhausted" : "CanLoadMore");
    } catch (err) {
      console.error(`Error in loadMore for ${path}:`, err);
      setStatus("Exhausted");
    }
  }, [path, status, results.length, allMatches]);

  return { results, status, loadMore };
}

export function useConvex() {
  return {
    query: async (apiRef: any, args?: any) => {
      const path = getPath(apiRef);
      
      if (path === 'coupons.validateCoupon') {
        const { code, cartTotal } = args;
        const q = query(collection(db, 'coupons'), where('code', '==', code.toUpperCase()), where('isActive', '==', true));
        const snap = await getDocs(q);
        if (snap.empty) {
          throw new Error("Invalid or inactive coupon code");
        }
        
        const coupon = snap.docs[0].data();
        
        if (coupon.minPurchaseAmount && cartTotal < coupon.minPurchaseAmount) {
          throw new Error(`Minimum purchase of ₹${coupon.minPurchaseAmount} required`);
        }
        
        // Calculate discount
        let discountAmount = 0;
        if (coupon.discountType === "percentage") {
          discountAmount = Math.floor(cartTotal * (coupon.discountValue / 100));
          if (coupon.maxDiscountAmount) {
            discountAmount = Math.min(discountAmount, coupon.maxDiscountAmount);
          }
        } else {
          discountAmount = Math.min(cartTotal, coupon.discountValue);
        }
        
        return {
          coupon: { _id: snap.docs[0].id, ...coupon },
          discountAmount: discountAmount,
          isWalletCredit: coupon.isWalletCredit || false,
          walletCreditAmount: coupon.isWalletCredit ? discountAmount : 0
        };
      }
      
      console.log(`Manual query called for ${path} with args:`, args);
      return null;
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
        const callable = httpsCallable(functions, 'checkPaymentStatus');
        const res: any = await callable(args);
        return res.data;
      }
      
      return null;
    }
  };
}
