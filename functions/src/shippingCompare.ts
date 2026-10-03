import { onCall, HttpsError } from "firebase-functions/v1/https";
import * as functionsV1 from "firebase-functions/v1";
import * as admin from "firebase-admin";
import { requireAdmin } from "./auth";
import { buildOrderPayload, orderMoney } from "./rapidshyp";
import { delhiverySettings } from "./delhiveryApi";
import { serviceability, estimate } from "./delhivery";

/**
 * One order, both ways to ship it, priced (Admin › Orders › Compare & ship).
 *
 * Delhivery Direct: whether it delivers there (and takes COD) and its own
 * estimate. RapidShyp: every courier its serviceability API offers for the
 * lane, with freight and expected delivery — read-only, nothing is booked.
 * A shipment sent through RapidShyp still goes to the courier its panel's
 * priority rule picks (the wrapper API takes no courier), so the cheapest
 * quote here is what it books only when that rule is "cheapest first".
 */
export interface CourierQuote { code: string; name: string; parent: string; freight: number; mode: string; edd: string | null }

export async function rapidshypCouriers(pickupPin: string, pin: string, cod: boolean, value: number, grams: number): Promise<CourierQuote[] | { error: string }> {
  const key = process.env.RAPIDSHYP_API_KEY || "";
  if (!key) return { error: "RapidShyp API key not configured" };
  if (!pickupPin) return { error: "Set the warehouse pincode in Admin › Shipping" };
  const base = (process.env.RAPIDSHYP_API_URL || "https://api.rapidshyp.com/rapidshyp/apis/v1/wrapper").replace(/\/wrapper\/?$/, "");
  // RapidShyp's own spelling of the path: "serviceabilty".
  const res = await fetch(`${base}/serviceabilty_check`, {
    method: "POST",
    headers: { "rapidshyp-token": key, "Content-Type": "application/json" },
    body: JSON.stringify({ Pickup_pincode: pickupPin, Delivery_pincode: pin, cod, total_order_value: Math.round(value), weight: Math.max(0.05, grams / 1000) }),
  });
  const j: any = await res.json().catch(() => null);
  if (!res.ok || !j?.status) return { error: String(j?.remark || `RapidShyp answered ${res.status}`) };
  return (Array.isArray(j.serviceable_courier_list) ? j.serviceable_courier_list : [])
    .map((c: any) => ({
      code: String(c.courier_code || ""), name: String(c.courier_name || ""), parent: String(c.parent_courier_name || ""),
      freight: Math.round(Number(c.total_freight) * 100) / 100, mode: String(c.freight_mode || ""), edd: c.edd ? String(c.edd) : null,
    }))
    .filter((c: CourierQuote) => c.freight > 0)
    .sort((a: CourierQuote, b: CourierQuote) => a.freight - b.freight);
}

export const compareShipping = onCall(async (data: any, context: any) => {
  await requireAdmin(context);
  const orderId = String(data?.orderId || "");
  if (!orderId) throw new HttpsError("invalid-argument", "Missing orderId");
  const db = admin.firestore();
  const { order, payload } = await buildOrderPayload(orderId);
  const cfg = await delhiverySettings(db);
  const pin = String(order.shippingAddress?.pincode || "").replace(/\D/g, "");
  const isCod = payload.paymentMethod === "COD";
  const grams = Number((payload.packageDetails as any)?.packageWeight) || 100;
  const value = orderMoney(order, Array.isArray(order.items) ? order.items : []).total;
  const codValue = Number(payload.codValue) || 0;

  const [svc, dlvCharge, rs] = await Promise.all([
    serviceability(pin).catch((e) => ({ serviceable: false, cod: false, prepaid: false, note: String(e?.message || e) })),
    estimate(cfg.originPin, pin, grams, isCod, codValue, cfg.mode).catch(() => null),
    rapidshypCouriers(cfg.originPin, pin, isCod, value, grams).catch((e) => ({ error: String(e?.message || e) })),
  ]);
  return {
    pin, grams, codNeeded: isCod, value,
    delhivery: { ...svc, charge: dlvCharge, mode: cfg.mode, ready: !!cfg.pickup },
    rapidshyp: Array.isArray(rs) ? { couriers: rs.slice(0, 6) } : { couriers: [], error: rs.error },
    missing: [!cfg.pickup && "Delhivery pickup name", !cfg.originPin && "warehouse pincode", !cfg.gstin && "GSTIN"].filter(Boolean),
  };
});

/**
 * What a parcel cost to send, recorded once it has an AWB — however it got
 * one (the RapidShyp button, Compare & ship, Delhivery, the webhook). Nothing
 * stored a courier charge, so the dashboard couldn't say what shipping costs
 * or what's left after it. The figure is the courier's quote for that lane
 * and weight at booking: RapidShyp's rate for the courier that took it (the
 * cheapest when its name doesn't match), Delhivery's own estimate. A quote,
 * not the invoice — close, and labelled as such.
 */
export async function recordShippingCost(db: admin.firestore.Firestore, orderId: string): Promise<number | null> {
  const ref = db.collection("orders").doc(orderId);
  const { order, payload } = await buildOrderPayload(orderId);
  if (order.shippingCost != null) return Number(order.shippingCost);
  const cfg = await delhiverySettings(db);
  const pin = String(order.shippingAddress?.pincode || "").replace(/\D/g, "");
  const cod = payload.paymentMethod === "COD";
  const grams = Number((payload.packageDetails as any)?.packageWeight) || 100;
  const value = orderMoney(order, Array.isArray(order.items) ? order.items : []).total;
  let cost: number | null = null, courier = "", source = "";
  if (order.shippingProvider === "delhivery") {
    cost = await estimate(cfg.originPin, pin, grams, cod, Number(payload.codValue) || 0, cfg.mode).catch(() => null);
    courier = "Delhivery"; source = "delhivery-estimate";
  } else {
    const list = await rapidshypCouriers(cfg.originPin, pin, cod, value, grams).catch(() => null);
    if (Array.isArray(list) && list.length) {
      const want = String(order.courierName || "").toLowerCase().replace(/[^a-z0-9]/g, "");
      const norm = (x: string) => x.toLowerCase().replace(/[^a-z0-9]/g, "");
      const hit = want ? list.find((c) => norm(c.name).includes(want) || want.includes(norm(c.name)) || (c.parent && want.includes(norm(c.parent)))) : undefined;
      const pick = hit || list[0];
      cost = pick.freight; courier = pick.name; source = hit ? "rapidshyp-quote" : "rapidshyp-cheapest-quote";
    }
  }
  if (cost == null) return null;
  await ref.update({ shippingCost: cost, shippingCostCourier: courier, shippingCostSource: source, shippingCostAt: Date.now() });
  return cost;
}

export const onOrderAwbCost = functionsV1.firestore.document("orders/{orderId}").onWrite(async (change, context) => {
  const after = change.after.exists ? (change.after.data() as any) : null;
  const before = change.before.exists ? (change.before.data() as any) : null;
  if (!after?.awbNumber || before?.awbNumber || after.shippingCost != null || after.addOnTo) return null;
  try {
    await recordShippingCost(admin.firestore(), context.params.orderId);
  } catch (e: any) {
    console.error("onOrderAwbCost failed", { order: context.params.orderId, error: e?.message || e });
  }
  return null;
});
