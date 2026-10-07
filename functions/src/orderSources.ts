import * as functionsV1 from "firebase-functions/v1";
import * as admin from "firebase-admin";
import { runReport } from "./funnel";

/**
 * Where each paid order came from, as GA4 saw it.
 *
 * The site sends GA4 a purchase with transaction_id = the order NUMBER
 * (trackPurchaseOnce passes order.orderNumber), so GA's session source for
 * that purchase can be
 * written back onto the order as attribution.ga4. This covers orders placed
 * before the checkout recorded its own source (src/lib/attribution.ts), and
 * buyers whose browser kept nothing. Only orders whose purchase reached GA4
 * (paid online or confirmed COD, with analytics allowed) get one.
 */

const LABELS: [RegExp, string][] = [
  [/instagram|^ig$/i, "Instagram"],
  [/facebook|^fb$|^m\.facebook|^l\.facebook/i, "Facebook"],
  [/youtube|^yt$/i, "YouTube"],
  [/chatgpt|openai|perplexity|gemini|copilot|claude/i, "AI chat"],
  [/whatsapp|^wa$/i, "WhatsApp"],
  [/^google$|google\./i, "Google"],
  [/bing/i, "Bing"],
  [/mail|msg91/i, "Email"],
];

export function channelOf(source: string, medium: string, group: string): string {
  const s = (source || "").toLowerCase(), m = (medium || "").toLowerCase();
  if (s === "(direct)" || (!s && !m)) return "Direct";
  const named = LABELS.find(([re]) => re.test(s))?.[1];
  const paid = /cpc|ppc|paid|ads?$/i.test(m) || /paid/i.test(group || "");
  if (named) return paid && named !== "Email" && named !== "WhatsApp" ? `${named} Ads` : named;
  return s || group || "Unknown";
}

export async function syncOrderSources(days: number) {
  const data = await runReport({
    dateRanges: [{ startDate: `${days}daysAgo`, endDate: "today" }],
    dimensions: [{ name: "transactionId" }, { name: "sessionSource" }, { name: "sessionMedium" }, { name: "sessionCampaignName" }, { name: "sessionDefaultChannelGroup" }],
    metrics: [{ name: "transactions" }],
    dimensionFilter: { filter: { fieldName: "transactionId", stringFilter: { matchType: "FULL_REGEXP", value: ".+" } } },
    limit: 10000,
  });
  const db = admin.firestore();
  let written = 0, missing = 0;
  const seen = new Set<string>();
  for (const row of data?.rows || []) {
    const [id, source, medium, campaign, group] = row.dimensionValues.map((d: any) => String(d.value || ""));
    if (!id || id === "(not set)" || seen.has(id) || id.includes("/")) continue;
    seen.add(id);
    // transaction_id is the order number; older builds may have sent the doc id.
    const asNumber = Number(id);
    let snap: admin.firestore.DocumentSnapshot | undefined = (await db.collection("orders").where("orderNumber", "==", id).limit(1).get()).docs[0];
    if (!snap && Number.isFinite(asNumber)) snap = (await db.collection("orders").where("orderNumber", "==", asNumber).limit(1).get()).docs[0];
    if (!snap && id.length >= 15) { const d = await db.collection("orders").doc(id).get(); if (d.exists) snap = d; }
    if (!snap) { missing++; continue; }
    const ref = snap.ref;
    const ga4: Record<string, string> = { channel: channelOf(source, medium, group), source, medium, group };
    if (campaign && campaign !== "(not set)" && campaign !== "(direct)") ga4.campaign = campaign;
    const prev = (snap.data() as any)?.attribution?.ga4;
    if (prev && prev.source === ga4.source && prev.medium === ga4.medium && prev.campaign === ga4.campaign) continue;
    await ref.set({ attribution: { ga4 } }, { merge: true });
    written++;
  }
  return { rows: (data?.rows || []).length, written, missing };
}

/** 03:15 IST daily: yesterday's purchases. */
export const dailyOrderSources = functionsV1
  .runWith({ memory: "256MB", timeoutSeconds: 120 })
  .pubsub.schedule("45 21 * * *")
  .timeZone("UTC")
  .onRun(async () => {
    try { console.log("dailyOrderSources", await syncOrderSources(3)); } catch (e: any) { console.error("dailyOrderSources", e?.response?.data || e?.message || e); }
    return null;
  });

/** Admin backfill: every order GA4 still has (days up to 540). */
export const backfillOrderSources = functionsV1
  .runWith({ memory: "512MB", timeoutSeconds: 540 })
  .https.onCall(async (data: any, context: any) => {
    const { requireAdmin } = await import("./auth");
    await requireAdmin(context);
    try {
      return await syncOrderSources(Math.min(540, Math.max(1, Number(data?.days) || 540)));
    } catch (e: any) {
      throw new functionsV1.https.HttpsError("failed-precondition", e?.response?.data?.error?.message || e?.message || "GA4 did not answer");
    }
  });
