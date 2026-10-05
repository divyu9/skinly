import * as functionsV1 from "firebase-functions/v1";
import * as admin from "firebase-admin";
import { GoogleAuth } from "google-auth-library";

/**
 * The shopping funnel, from GA4, for the admin dashboard.
 *
 * Visitors → viewed a product → added to cart → began checkout → paid, as
 * users per step over the last 30 days, split by device, plus the landing
 * pages that bring buyers. Read with the GA4 Data API as the functions'
 * own service account (skinly-3003b@appspot.gserviceaccount.com), which has
 * Viewer on the GoSkinly property; written to analytics/funnel30 once a day
 * so the dashboard never waits on Google.
 *
 * Step counts are users who fired each event in the window — not a strict
 * in-order funnel — which is what GA's own step counts mean for a shop this
 * size, and close enough to see where people drop.
 */

const PROPERTY = process.env.GA4_PROPERTY_ID || "411635102";
const STEPS: Array<[string, string]> = [
  ["session_start", "Visited"],
  ["view_item", "Viewed a product"],
  ["add_to_cart", "Added to cart"],
  ["begin_checkout", "Began checkout"],
  ["purchase", "Paid"],
];

export async function runReport(body: any) {
  const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/analytics.readonly"] });
  const client = await auth.getClient();
  const res = await client.request<any>({
    url: `https://analyticsdata.googleapis.com/v1beta/properties/${PROPERTY}:runReport`,
    method: "POST",
    data: body,
  });
  return res.data;
}

export async function buildFunnel() {
  const dateRanges = [{ startDate: "30daysAgo", endDate: "yesterday" }];
  const eventFilter = {
    filter: { fieldName: "eventName", inListFilter: { values: STEPS.map(([e]) => e) } },
  };
  const [byEvent, landing] = await Promise.all([
    runReport({
      dateRanges,
      dimensions: [{ name: "eventName" }, { name: "deviceCategory" }],
      metrics: [{ name: "totalUsers" }],
      dimensionFilter: eventFilter,
      limit: 100,
    }),
    runReport({
      dateRanges,
      dimensions: [{ name: "landingPage" }],
      metrics: [{ name: "sessions" }, { name: "ecommercePurchases" }],
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
      limit: 12,
    }),
  ]);

  const count = new Map<string, number>();
  const byDevice = new Map<string, Map<string, number>>();
  for (const row of byEvent.rows || []) {
    const ev = row.dimensionValues[0].value;
    const dev = row.dimensionValues[1].value || "other";
    const n = Number(row.metricValues[0].value) || 0;
    count.set(ev, (count.get(ev) || 0) + n);
    const d = byDevice.get(dev) || new Map<string, number>();
    d.set(ev, (d.get(ev) || 0) + n);
    byDevice.set(dev, d);
  }
  const steps = STEPS.map(([event, label]) => ({ event, label, users: count.get(event) || 0 }));
  const devices = [...byDevice.entries()].map(([device, m]) => ({
    device,
    steps: STEPS.map(([event]) => m.get(event) || 0),
  })).sort((a, b) => b.steps[0] - a.steps[0]);
  const pages = (landing.rows || []).filter((r: any) => !String(r.dimensionValues[0].value || "").startsWith("/backend-skinly")).map((r: any) => ({
    page: r.dimensionValues[0].value || "(not set)",
    sessions: Number(r.metricValues[0].value) || 0,
    purchases: Number(r.metricValues[1].value) || 0,
  }));
  return { steps, devices, pages, updatedAt: Date.now() };
}

async function refresh() {
  const funnel = await buildFunnel();
  await admin.firestore().collection("analytics").doc("funnel30").set(funnel);
  return funnel;
}

/** 03:00 IST, after GA has finished yesterday. */
export const dailyFunnel = functionsV1
  .runWith({ memory: "256MB", timeoutSeconds: 60 })
  .pubsub.schedule("30 21 * * *")
  .timeZone("UTC")
  .onRun(async () => {
    try { await refresh(); } catch (e: any) { console.error("dailyFunnel", e?.response?.data || e?.message || e); }
    return null;
  });

/** "Refresh" on the dashboard. */
export const refreshFunnel = functionsV1
  .runWith({ memory: "256MB", timeoutSeconds: 60 })
  .https.onCall(async (_data: any, context: any) => {
    const { requireAdmin } = await import("./auth");
    await requireAdmin(context);
    try {
      return await refresh();
    } catch (e: any) {
      const msg = e?.response?.data?.error?.message || e?.message || "GA4 did not answer";
      throw new functionsV1.https.HttpsError("failed-precondition", msg);
    }
  });
