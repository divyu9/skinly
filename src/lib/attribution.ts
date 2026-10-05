/**
 * Where a buyer came from — Instagram, YouTube, Google, an ad, our own
 * WhatsApp message — saved in this browser when they land and sent with the
 * order (placeOrder stores it as order.attribution; Admin › Order shows it).
 *
 * Two touches: the first visit (kept 30 days) and the latest visit that came
 * from somewhere. A plain reload, a page reached from our own site, or the
 * return from PhonePe is not a new visit and changes nothing.
 *
 * Instagram and Facebook often send no referrer from their in-app browser, so
 * the app's user-agent and Meta's fbclid fill in.
 */

export interface Touch {
  channel: string;        // "Instagram", "Google Ads", "Direct"…
  source?: string;        // utm_source or the referring host
  medium?: string;
  campaign?: string;
  content?: string;
  referrer?: string;
  landing?: string;       // path + query of the first page
  click?: string;         // which ad click id was present: gclid, fbclid…
  app?: string;           // in-app browser: Instagram, Facebook
  at: number;
}

const KEY = "skinly_attribution";
const FIRST_TTL = 30 * 24 * 60 * 60 * 1000;
// Hosts that are part of the purchase, not where the buyer came from.
const OWN = /(^|\.)(goskinly\.com|localhost|phonepe\.com|paytm\.com|razorpay\.com)$/i;

const REFERRERS: [RegExp, string][] = [
  [/(^|\.)instagram\.com$/i, "Instagram"],
  [/(^|\.)(facebook\.com|fb\.com|fb\.me)$/i, "Facebook"],
  [/(^|\.)(youtube\.com|youtu\.be)$/i, "YouTube"],
  [/(^|\.)google\.[a-z.]+$/i, "Google"],
  [/(^|\.)bing\.com$/i, "Bing"],
  [/(^|\.)(chatgpt\.com|openai\.com|perplexity\.ai|claude\.ai|gemini\.google\.com|copilot\.microsoft\.com)$/i, "AI chat"],
  [/(^|\.)(whatsapp\.com|wa\.me)$/i, "WhatsApp"],
  [/(^|\.)(t\.co|x\.com|twitter\.com)$/i, "X"],
  [/(^|\.)(pinterest\.[a-z.]+|pin\.it)$/i, "Pinterest"],
  [/(^|\.)reddit\.com$/i, "Reddit"],
];

const SOURCES: [RegExp, string][] = [
  [/^(ig|insta|instagram)/i, "Instagram"],
  [/^(fb|facebook|meta)/i, "Facebook"],
  [/^(yt|youtube)/i, "YouTube"],
  [/^google/i, "Google"],
  [/^(wa|whatsapp)/i, "WhatsApp"],
  [/^(email|mail|newsletter)/i, "Email"],
];

const clip = (s: string | null | undefined, n = 200) => (s ? String(s).slice(0, n) : undefined);

function inAppBrowser(): string | undefined {
  const ua = navigator.userAgent || "";
  if (/Instagram/i.test(ua)) return "Instagram";
  if (/FBAN|FBAV|FB_IAB/i.test(ua)) return "Facebook";
  return undefined;
}

/** This page load as a touch, or null when it isn't a new visit. */
function readTouch(): Touch | null {
  const q = new URLSearchParams(location.search);
  let refHost = "";
  try { refHost = document.referrer ? new URL(document.referrer).hostname : ""; } catch { /* bad referrer */ }
  if (refHost && OWN.test(refHost)) return null;

  const utm = (k: string) => clip(q.get(`utm_${k}`), 120);
  const source = utm("source"), medium = utm("medium");
  const click = ["gclid", "gbraid", "wbraid", "fbclid", "ttclid", "msclkid"].find((k) => q.get(k));
  const app = inAppBrowser();
  const paid = /cpc|ppc|paid|ads?$/i.test(medium || "");

  let channel = "";
  if (click === "gclid" || click === "gbraid" || click === "wbraid") channel = "Google Ads";
  else if (source) {
    const named = SOURCES.find(([re]) => re.test(source))?.[1];
    channel = named ? (paid && named !== "Email" && named !== "WhatsApp" ? `${named} Ads` : named) : source;
  } else if (refHost) {
    channel = REFERRERS.find(([re]) => re.test(refHost))?.[1] || refHost.replace(/^(www|m|l|lm)\./, "");
  } else if (app) channel = app;
  else if (click === "fbclid") channel = "Facebook / Instagram";

  if (!channel) {
    // No referrer, no tags: typed in, a bookmark, or an app that hides itself.
    return { channel: "Direct", landing: clip(location.pathname + location.search), at: Date.now() };
  }
  return {
    channel, source: source || clip(refHost) || undefined, medium, campaign: utm("campaign"), content: utm("content"),
    referrer: clip(document.referrer), landing: clip(location.pathname + location.search), click, app, at: Date.now(),
  };
}

function read(): { first?: Touch; last?: Touch } {
  try { return JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch { return {}; }
}

/** Once per page load, from main.tsx. */
export function captureAttribution() {
  try {
    const touch = readTouch();
    if (!touch) return;
    const saved = read();
    const firstValid = saved.first && Date.now() - saved.first.at < FIRST_TTL;
    const next = {
      first: firstValid ? saved.first : touch,
      // A direct return keeps the source that brought them (an Instagram
      // visitor who comes back by typing the address is still that visitor).
      last: touch.channel === "Direct" && saved.last ? saved.last : touch,
    };
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch { /* storage blocked: the order just has no source */ }
}

/** Sent with placeOrder. */
export function getAttribution(): { first?: Touch; last?: Touch } | undefined {
  const a = read();
  return a.first || a.last ? a : undefined;
}
