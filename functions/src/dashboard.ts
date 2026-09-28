import * as functionsV1 from "firebase-functions/v1";
import * as admin from "firebase-admin";
import { normalizeOrderStatus } from "./orderStatus";
import { isConfirmedOrder } from "./materials";
import { SETTINGS, threshold } from "./dailyDigest";

/**
 * The admin home: how the shop is doing, what is waiting on us, and what is
 * about to run out — in one call, so the page opens on numbers rather than on
 * a spinner per card.
 *
 * Sales are confirmed orders (paid, or COD placed) that were not cancelled
 * and are not test orders, counted on the day they were placed, in IST. That
 * is the "how much did we sell" figure; money actually collected is the
 * orders page's Revenue tile.
 *
 * Orders are read in two slices that stay small as the shop grows: everything
 * placed in the last 62 days (for the trend and the month-on-month compare),
 * and everything still in an open state (for the task list), whatever its age.
 */

const DAY = 86_400_000;
const IST = 5.5 * 3600 * 1000;
/** Midnight IST of the day `ms` falls on, as a UTC timestamp. */
const dayStart = (ms: number) => Math.floor((ms + IST) / DAY) * DAY - IST;
const dayKey = (ms: number) => new Date(ms + IST).toISOString().slice(0, 10);
/** R-44-IPH → R-44, the code sheets are filed under (as src/lib/real-photos.ts). */
const designCodeOf = (sku: unknown) => String(sku || "").trim().toUpperCase().replace(/^([A-Z]+-\d+)-[A-Z0-9]+$/, "$1");
const money = (o: any) => Number(o?.total ?? o?.amountPayable) || 0;
const OPEN_RAW = ["pending", "processing", "ready_to_ship", "shipped", "out_for_delivery", "undelivered"];

const isSale = (o: any) => isConfirmedOrder(o) && o.status !== "cancelled" && !o.testOrder;
const statusOf = (o: any) => normalizeOrderStatus(o.status, o.paymentStatus, o);
/** When the order last changed state: what "stuck for N days" is measured from. */
const since = (o: any) => Number(o.statusChangedAt || o.confirmedAt || o.createdAt) || 0;

type Period = { orders: number; sales: number };
const tally = (list: any[]): Period => ({ orders: list.length, sales: list.reduce((s, o) => s + money(o), 0) });

export async function buildDashboard(db: admin.firestore.Firestore) {
  const now = Date.now();
  const today = dayStart(now);
  const from62 = today - 61 * DAY;

  const [recentSnap, openSnap, rollSnap, cutoutSnap, alertSnap, reqSnap, reviewSnap, bugSnap, cartSnap, oosCount] = await Promise.all([
    db.collection("orders").where("createdAt", ">=", from62).get(),
    db.collection("orders").where("status", "in", OPEN_RAW).get(),
    db.collection("rollInventory").get(),
    db.collection("cutoutInventory").get(),
    db.collection("stockNotifications").get(),
    db.collection("modelRequests").where("status", "==", "pending").get(),
    db.collection("reviews").where("status", "==", "pending").count().get(),
    db.collection("bugReports").get(),
    db.collection("abandonedCarts").where("createdAt", ">=", now - 2 * DAY).get(),
    db.collection("variants").where("inventoryQuantity", "<=", 0).count().get(),
  ]);
  // 1–3 star reviews nobody has answered yet (Admin › Reviews › Follow up).
  const lowSnap = await db.collection("reviews").where("rating", "<=", 3).get();
  const followUps = lowSnap.docs.filter((d) => !(d.data() as any).followedUpAt).length;

  const recent = recentSnap.docs.map((d) => ({ _id: d.id, ...(d.data() as any) })).filter((o) => !o.isDeleted);
  const sales = recent.filter(isSale);

  // ── Headline numbers ────────────────────────────────────────────────────
  const inRange = (a: number, b: number) => sales.filter((o) => o.createdAt >= a && o.createdAt < b);
  const monthStartOf = (ms: number) => {
    const d = new Date(ms + IST);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) - IST;
  };
  const monthStart = monthStartOf(now);
  const lastMonthStart = monthStartOf(monthStart - DAY);
  // Last month up to the same moment, so the 28th is compared with the 28th.
  const lastMonthSameTime = Math.min(lastMonthStart + (now - monthStart), monthStart);

  const todayP = tally(inRange(today, now + 1));
  // Yesterday up to the same hour: comparing a morning with a whole day always looks like a slump.
  const yesterdaySoFar = tally(inRange(today - DAY, now - DAY));
  const yesterday = tally(inRange(today - DAY, today));
  const month = tally(inRange(monthStart, now + 1));
  const lastMonth = tally(inRange(lastMonthStart, lastMonthSameTime));
  const last30 = inRange(today - 29 * DAY, now + 1);
  const prev30 = inRange(today - 59 * DAY, today - 29 * DAY);
  const codShare = last30.length ? last30.filter((o) => String(o.paymentMethod).toLowerCase() === "cod").length / last30.length : 0;

  // Repeat buyers in the last 30 days: anyone with an earlier confirmed order.
  const buyerKey = (o: any) => String(o.email || o.phone || o.userId || "").toLowerCase();
  const firstSeen = new Map<string, number>();
  for (const o of sales) {
    const k = buyerKey(o);
    if (k) firstSeen.set(k, Math.min(firstSeen.get(k) ?? Infinity, o.createdAt));
  }
  const repeat = last30.filter((o) => (firstSeen.get(buyerKey(o)) ?? Infinity) < o.createdAt).length;

  // ── 30-day trend ────────────────────────────────────────────────────────
  const daily: Array<{ day: string; orders: number; sales: number }> = [];
  for (let i = 29; i >= 0; i--) {
    const a = today - i * DAY;
    const p = tally(inRange(a, a + DAY));
    daily.push({ day: dayKey(a), ...p });
  }
  // Orders by hour of day over 30 days, IST: when the shop is busiest.
  const hours = Array.from({ length: 24 }, () => 0);
  for (const o of last30) hours[new Date(o.createdAt + IST).getUTCHours()] += 1;

  // ── What sold ───────────────────────────────────────────────────────────
  const top = new Map<string, { productId: string; title: string; image: string; slug: string; qty: number; sales: number }>();
  const byModel = new Map<string, number>();
  const sold30 = new Map<string, number>();
  for (const o of inRange(today - 6 * DAY, now + 1)) {
    for (const it of o.items || []) {
      const qty = Number(it.quantity) || 1;
      const id = String(it.productId || it.productTitle || "");
      const row = top.get(id) || { productId: String(it.productId || ""), title: String(it.productTitle || "Item"), image: String(it.productImage || ""), slug: String(it.productSlug || ""), qty: 0, sales: 0 };
      row.qty += qty;
      row.sales += (Number(it.price) || 0) * qty;
      top.set(id, row);
    }
  }
  for (const o of last30) {
    for (const it of o.items || []) {
      const qty = Number(it.quantity) || 1;
      const code = designCodeOf(it.sku || String(it.productImage || "").match(/_?([A-Za-z]+-\d+)(?:-[A-Za-z0-9]+)?\.(?:jpe?g|png|webp)$/)?.[1]);
      if (code) sold30.set(code, (sold30.get(code) || 0) + qty);
      const m = [it.phoneBrand, it.phoneModel].filter(Boolean).join(" ").trim();
      if (m) byModel.set(m, (byModel.get(m) || 0) + qty);
    }
  }

  // ── Tasks ───────────────────────────────────────────────────────────────
  const open = openSnap.docs.map((d) => ({ _id: d.id, ...(d.data() as any) })).filter((o) => !o.isDeleted);
  const by = (st: string) => open.filter((o) => statusOf(o) === st);
  const toPack = by("processing").filter((o) => !o.awbNumber);
  const readyToShip = by("ready_to_ship");
  const pickupLate = readyToShip.filter((o) => now - since(o) > 2 * DAY);
  const moving = [...by("shipped"), ...by("out_for_delivery")];
  const slow = moving.filter((o) => now - since(o) > 6 * DAY);
  const undelivered = by("undelivered");
  const oldestToPack = toPack.reduce((m, o) => Math.min(m, Number(o.confirmedAt || o.createdAt) || now), now);
  const rto30 = recent.filter((o) => o.status === "rto" && Number(o.statusChangedAt || o.createdAt) >= today - 29 * DAY).length;

  // Unpaid checkouts from the last day: money one nudge away.
  const unpaid = recent.filter((o) => o.createdAt >= now - DAY && statusOf(o) === "pending_payment" && !o.testOrder);
  const carts = cartSnap.docs.map((d) => d.data() as any).filter((c) => c.status === "abandoned" || c.status === "reminded");

  const alertsWaiting = alertSnap.docs.map((d) => d.data() as any).filter((a) => !a.status || a.status === "waiting" || a.status === "pending");
  const demand = new Map<string, { title: string; sku: string; slug: string; count: number; latest: number }>();
  for (const a of alertsWaiting) {
    const k = String(a.productId || a.sku || a.productTitle || "");
    const row = demand.get(k) || { title: String(a.productTitle || "Product"), sku: String(a.sku || ""), slug: String(a.productSlug || ""), count: 0, latest: 0 };
    row.count += 1;
    row.latest = Math.max(row.latest, Number(a.createdAt || a.subscribedAt || a._creationTime) || 0);
    demand.set(k, row);
  }

  const requests = reqSnap.docs.map((d) => d.data() as any);
  const wanted = new Map<string, { model: string; category: string; count: number }>();
  for (const r of requests) {
    const brand = String(r.brandName || "").trim();
    const name = String(r.modelName || "").replace(/\s+/g, " ").trim();
    // "Samsung" + "Samsung galaxy A35" is one brand, not two.
    const model = (brand && !name.toLowerCase().startsWith(brand.toLowerCase()) ? `${brand} ${name}` : name || brand).trim();
    const k = model.toLowerCase();
    if (!k) continue;
    const row = wanted.get(k) || { model, category: String(r.category || "phone"), count: 0 };
    row.count += 1;
    wanted.set(k, row);
  }
  const bugsOpen = bugSnap.docs.filter((d) => {
    const s = String((d.data() as any).status || "open").toLowerCase();
    return s !== "resolved" && s !== "closed" && s !== "fixed";
  }).length;

  // ── Stock ───────────────────────────────────────────────────────────────
  const rollFloor = await threshold(db, SETTINGS.rollMetres, 5);
  /*
   * Nearly every sheet in the godown sits under the digest's fixed floor, so
   * "low stock" by that rule is the whole catalogue. What needs a decision is
   * narrower: designs that are actually selling, and how many days the
   * pieces left will last at the last 30 days' pace. Sold-out bestsellers
   * come first — each is a listing turning shoppers away today.
   */
  const shelf = new Map<string, { name: string; left: number; unit: string }>();
  for (const d of rollSnap.docs) {
    const r = d.data() as any;
    shelf.set(designCodeOf(r.rNumber || d.id), { name: String(r.designName || "").trim(), left: Number(r.metersAvailable) || 0, unit: "m" });
  }
  for (const d of cutoutSnap.docs) {
    const c = d.data() as any;
    if (c.isActive === false) continue;
    shelf.set(designCodeOf(c.cutoutNumber || d.id), { name: String(c.designName || "").trim(), left: Number(c.sheetsAvailable) || 0, unit: "sheets" });
  }
  const lowStock: Array<{ code: string; name: string; left: number; unit: string; sold30: number; daysLeft: number | null }> = [];
  for (const [code, sold] of sold30) {
    const s = shelf.get(code);
    if (!s) continue;
    // Rolls are metres, orders are pieces: no honest days figure, only the metres.
    const daysLeft = s.unit === "sheets" ? Math.floor(s.left / (sold / 30)) : null;
    if (s.left <= 0 || (daysLeft !== null ? daysLeft <= 14 : s.left <= rollFloor)) {
      lowStock.push({ code, name: s.name, left: s.left, unit: s.unit, sold30: sold, daysLeft });
    }
  }
  lowStock.sort((a, b) => (a.left > 0 ? 1 : 0) - (b.left > 0 ? 1 : 0) || b.sold30 - a.sold30);
  const soldOutEverywhere = [...shelf.values()].filter((x) => x.left <= 0).length;

  const recentOrders = [...sales].sort((a, b) => b.createdAt - a.createdAt).slice(0, 7).map((o) => ({
    _id: o._id, orderNumber: String(o.orderNumber || ""), customer: String(o.customerName || o.shippingAddress?.fullName || o.shippingAddress?.name || ""),
    city: String(o.shippingAddress?.city || ""), total: money(o), cod: String(o.paymentMethod).toLowerCase() === "cod",
    status: statusOf(o), createdAt: o.createdAt, items: (o.items || []).reduce((s: number, it: any) => s + (Number(it.quantity) || 1), 0),
    image: String(o.items?.[0]?.productImage || ""),
  }));

  return {
    generatedAt: now,
    kpis: {
      today: todayP, yesterdaySoFar, yesterday, month, lastMonth,
      last30: tally(last30), prev30: tally(prev30),
      aov30: last30.length ? tally(last30).sales / last30.length : 0,
      aovPrev30: prev30.length ? tally(prev30).sales / prev30.length : 0,
      codShare, repeat30: repeat,
    },
    daily, hours,
    topProducts: [...top.values()].sort((a, b) => b.qty - a.qty || b.sales - a.sales).slice(0, 6),
    topModels: [...byModel.entries()].map(([model, qty]) => ({ model, qty })).sort((a, b) => b.qty - a.qty).slice(0, 6),
    tasks: {
      toPack: toPack.length, oldestToPackHours: toPack.length ? Math.round((now - oldestToPack) / 3600000) : 0,
      readyToShip: readyToShip.length, pickupLate: pickupLate.length,
      inTransit: moving.length, slow: slow.length,
      undelivered: undelivered.length, rto30,
      unpaid: unpaid.length, unpaidValue: unpaid.reduce((s, o) => s + money(o), 0),
      carts: carts.length, cartsValue: carts.reduce((s, c) => s + (Number(c.cartTotal) || 0), 0),
      reviews: reviewSnap.data().count,
      followUps,
      modelRequests: requests.length,
      stockAlerts: alertsWaiting.length,
      bugs: bugsOpen,
    },
    stock: {
      low: lowStock.slice(0, 10), lowCount: lowStock.length, soldOut: soldOutEverywhere, designs: shelf.size,
      outOfStockListings: oosCount.data().count,
      demand: [...demand.values()].sort((a, b) => b.count - a.count || b.latest - a.latest).slice(0, 6),
    },
    wantedModels: [...wanted.values()].sort((a, b) => b.count - a.count).slice(0, 6),
    recentOrders,
  };
}

export const adminDashboard = functionsV1
  .runWith({ memory: "512MB", timeoutSeconds: 60 })
  .https.onCall(async (_data: any, context: any) => {
    const { requireAdmin } = await import("./auth");
    await requireAdmin(context);
    return buildDashboard(admin.firestore());
  });
