import * as admin from "firebase-admin";
import * as crypto from "crypto";
import { onRequest, onCall } from "firebase-functions/v1/https";
import { requireAdmin } from "./auth";

/**
 * What happened to a sent email after MSG91 accepted it — delivered, opened,
 * bounced — from MSG91's Email › Webhook › Delivery Report, written back onto
 * the emailMessages row so Admin › Order › History can say so.
 *
 * MSG91 does not publish the payload, so parsing is tolerant: every string
 * in the body is looked at, and every payload is kept in emailEvents for
 * checking the shape. A row is found by MSG91's id (providerId, saved at
 * send) or else by the recipient's latest mail in the three days before.
 * The URL carries the same secret as the WhatsApp inbound webhook.
 */

/** MSG91's id for a send, from its response body. */
export function msg91Ref(text: string): string {
  try {
    const j = JSON.parse(text);
    return String(j?.data?.unique_id || j?.data?.request_id || j?.unique_id || j?.request_id || j?.data?.id || "").slice(0, 120);
  } catch { return ""; }
}

const EVENT_WORDS: [RegExp, string][] = [
  [/bounce|reject|drop|fail|invalid/i, "bounced"],
  [/complain|spam/i, "complained"],
  [/unsub/i, "unsubscribed"],
  [/click/i, "clicked"],
  [/open/i, "opened"],
  [/deliver/i, "delivered"],
];
// How far along a mail is; a later event never moves it back.
const RANK: Record<string, number> = { sent: 0, delivered: 1, opened: 2, clicked: 3, unsubscribed: 3, complained: 4, bounced: 5 };

type Ev = { event: string; id: string; email: string; at: number; reason: string };

/** Each object in the body that looks like one event. */
function eventsIn(body: any): Ev[] {
  const out: Ev[] = [];
  const visit = (o: any) => {
    if (Array.isArray(o)) { o.forEach(visit); return; }
    if (!o || typeof o !== "object") return;
    const entries = Object.entries(o);
    const get = (re: RegExp) => entries.find(([k, v]) => re.test(k) && (typeof v === "string" || typeof v === "number"))?.[1];
    const word = String(get(/^(event|event_?name|event_?type|status|type|mail_?status)$/i) || "");
    const event = EVENT_WORDS.find(([re]) => re.test(word))?.[1];
    const email = String(get(/^(email|to|recipient|recipient_?email|to_?email|address)$/i) || "").toLowerCase();
    const id = String(get(/^(unique_?id|request_?id|message_?id|mail_?id|id)$/i) || "");
    if (event && (email.includes("@") || id)) {
      const t = get(/time|date|_at$/i);
      const n = typeof t === "number" ? (t < 1e12 ? t * 1000 : t) : Date.parse(String(t || ""));
      out.push({ event, id, email, at: Number.isFinite(n) && n > 0 ? n : Date.now(), reason: String(get(/reason|description|error|message/i) || "").slice(0, 300) });
    }
    for (const [, v] of entries) if (v && typeof v === "object") visit(v);
  };
  visit(body);
  return out;
}

async function apply(db: admin.firestore.Firestore, ev: Ev): Promise<boolean> {
  let row: admin.firestore.QueryDocumentSnapshot | undefined;
  if (ev.id) row = (await db.collection("emailMessages").where("providerId", "==", ev.id).limit(1).get()).docs[0];
  if (!row && ev.email) {
    const since = ev.at - 3 * 24 * 3600 * 1000;
    const recent = await db.collection("emailMessages").where("recipientEmail", "==", ev.email).where("createdAt", ">=", since).get();
    row = recent.docs.filter((d) => Number(d.data().createdAt) <= ev.at + 60_000)
      .sort((a, b) => Number(b.data().createdAt) - Number(a.data().createdAt))[0];
  }
  if (!row) return false;
  const cur = String(row.data().deliveryStatus || "sent");
  const patch: Record<string, any> = { [`${ev.event}At`]: ev.at };
  if ((RANK[ev.event] ?? 0) >= (RANK[cur] ?? 0)) patch.deliveryStatus = ev.event;
  if (ev.event === "bounced" && ev.reason) patch.bounceReason = ev.reason;
  if (ev.event === "opened" || ev.event === "clicked") patch.deliveredAt = row.data().deliveredAt || ev.at;
  await row.ref.update(patch);
  return true;
}

export const msg91EmailEvents = onRequest(async (req, res) => {
  const token = process.env.WHATSAPP_INBOUND_TOKEN || "";
  const given = String(req.query.token || req.get("x-webhook-token") || "");
  if (!token || given.length !== token.length || !crypto.timingSafeEqual(Buffer.from(given), Buffer.from(token))) {
    res.status(401).send("unauthorized");
    return;
  }
  const body = typeof req.body === "object" && req.body ? req.body : { raw: String(req.body || "") };
  const db = admin.firestore();
  const events = eventsIn(body);
  let matched = 0;
  for (const ev of events.slice(0, 200)) {
    try { if (await apply(db, ev)) matched++; } catch (e) { console.error("[msg91EmailEvents]", e); }
  }
  await db.collection("emailEvents").add({
    receivedAt: Date.now(), events: events.length, matched, body: JSON.stringify(body).slice(0, 5000),
  }).catch(() => undefined);
  res.status(200).send("ok");
});

/** Admin › Emails: the URL to paste into MSG91 › Email › Webhook › Delivery Report. */
export const msg91EmailEventsUrl = onCall(async (_data: any, context: any) => {
  await requireAdmin(context);
  const token = process.env.WHATSAPP_INBOUND_TOKEN || "";
  return { url: token ? `https://us-central1-skinly-3003b.cloudfunctions.net/msg91EmailEvents?token=${token}` : "" };
});
