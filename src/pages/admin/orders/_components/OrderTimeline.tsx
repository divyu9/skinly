import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase-db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { WHATSAPP_MESSAGES } from "@/lib/whatsapp-registry.ts";
import { ADMIN_STATUS_LABELS, STATUS_DOT } from "@/lib/order-label.ts";
import {
  PackageIcon, TruckIcon, ZapIcon, WalletIcon, ScissorsIcon,
  MailIcon, AlertTriangleIcon, CalendarClockIcon, MessageCircleIcon,
} from "lucide-react";

/**
 * What happened to this order, in one column.
 *
 * Every piece of this was already being recorded and none of it was being
 * shown. The status history knows who moved an order and why; the courier's
 * scans know where the parcel has been; the notification flags know whether
 * the customer was told. Spread across three places nobody looked, the answer
 * to "why is this order sitting here" was a guess. Here they are one story,
 * newest first, because the question is almost always about the last thing.
 */

export interface TimelineOrder {
  _id?: string;
  createdAt?: number;
  _creationTime?: number;
  statusHistory?: Array<{ at: number; from: string; to: string; source?: string; reason?: string; actor?: string; override?: boolean }>;
  trackScans?: Array<{ at: number; scan: string; location?: string; code?: string }>;
  statusNotified?: string[];
  orderNotifiedAt?: number;
  ndr?: { code?: string; reason?: string; at?: number };
  expectedDeliveryAt?: number;
  deliveredAt?: number;
  materialConsumed?: Array<{ code: string; unit: string; requested: number }>;
  materialReservedAt?: number;
  materialReleasedAt?: number;
  walletCreditPaid?: number;
  walletCreditPaidAt?: number;
  creditOnDelivery?: number;
  creditOwedNoAccount?: number;
}

type Entry = {
  at: number;
  kind: "placed" | "status" | "scan" | "notice" | "stock" | "money" | "ndr" | "edd" | "whatsapp" | "email";
  title: string;
  detail?: string;
  dot?: string;
};

/** Who asked for a status change, in words rather than a source code. */
const SOURCE_WORDS: Record<string, string> = {
  admin: "by you",
  webhook: "from the courier",
  shipment: "when the shipment was made",
  "manual-tracking": "when tracking was added",
  payment: "when the payment landed",
  backfill: "by the status tidy-up",
};

const ICONS: Record<Entry["kind"], any> = {
  placed: PackageIcon,
  status: ZapIcon,
  scan: TruckIcon,
  notice: MailIcon,
  stock: ScissorsIcon,
  money: WalletIcon,
  ndr: AlertTriangleIcon,
  edd: CalendarClockIcon,
  whatsapp: MessageCircleIcon,
  email: MailIcon,
};

const TONES: Record<Entry["kind"], string> = {
  placed: "bg-muted text-foreground",
  status: "bg-brand/15 text-brand",
  scan: "bg-indigo-500/15 text-indigo-600",
  notice: "bg-sky-500/15 text-sky-600",
  stock: "bg-purple-500/15 text-purple-600",
  money: "bg-green-500/15 text-green-600",
  ndr: "bg-amber-500/15 text-amber-600",
  edd: "bg-teal-500/15 text-teal-600",
  whatsapp: "bg-green-500/15 text-green-600",
  email: "bg-sky-500/15 text-sky-600",
};

const when = (ts: number) =>
  new Date(ts).toLocaleString("en-IN", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });

/*
 * Every WhatsApp and email this order set off (whatsappMessages and
 * emailMessages carry relatedOrderId), with how far each got: WhatsApp's
 * delivered / read come from the Fast2SMS sync, email's delivered / opened /
 * bounced from MSG91's webhook (functions/src/emailEvents.ts).
 */
const WA_LABEL: Record<string, string> = Object.fromEntries(WHATSAPP_MESSAGES.map((m) => [m.key, m.label]));
const EMAIL_LABEL: Record<string, string> = {
  order_confirmed: "Order confirmed", order_received: "Order confirmed", order_dispatched: "Order shipped",
  order_delivered: "Delivered", order_cancelled: "Order cancelled", payment_failed: "Payment failed",
  admin_new_order: "New order (to you)", wallet_credited: "Wallet credited", review_request: "Review request",
};
const humanKey = (k: string) => k.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
const at = (ts: unknown) => (Number(ts) ? when(Number(ts)) : "");

function useOrderMessages(orderId?: string) {
  const [wa, setWa] = useState<any[]>([]);
  const [mail, setMail] = useState<any[]>([]);
  useEffect(() => {
    if (!orderId) return;
    const u1 = onSnapshot(query(collection(db, "whatsappMessages"), where("relatedOrderId", "==", orderId)),
      (s) => setWa(s.docs.map((d) => d.data())), () => setWa([]));
    const u2 = onSnapshot(query(collection(db, "emailMessages"), where("relatedOrderId", "==", orderId)),
      (s) => setMail(s.docs.map((d) => d.data())), () => setMail([]));
    return () => { u1(); u2(); };
  }, [orderId]);
  return { wa, mail };
}

function whatsappEntry(m: any): Entry | null {
  const created = Number(m.createdAt) || Number(m.sentAt);
  if (!created || m.test) return null;
  const s = String(m.status || "pending");
  const steps: string[] = [];
  let dot = "bg-amber-500";
  if (s === "skipped") { steps.push(`Not sent — ${m.failureReason || "switched off"}`); dot = "bg-muted-foreground"; }
  else if (s === "failed" || m.failedAt) { steps.push(`Failed${m.failedAt ? ` ${at(m.failedAt)}` : ""} — ${m.failureReason || "no reason given"}`); dot = "bg-red-500"; }
  else if (s === "pending" || s === "queued" || s === "processing") steps.push("Waiting to send");
  else {
    if (m.sentAt) steps.push(`Sent ${at(m.sentAt)}`);
    if (m.deliveredAt) steps.push(`Delivered ${at(m.deliveredAt)}`);
    if (m.readAt) steps.push(`Read ${at(m.readAt)}`);
    dot = m.readAt ? "bg-blue-500" : m.deliveredAt ? "bg-green-500" : "bg-sky-400";
    if (!m.deliveredAt && !m.readAt) steps.push("delivery not confirmed yet");
  }
  return {
    at: created, kind: "whatsapp", dot,
    title: `WhatsApp · ${WA_LABEL[m.usecaseKey] || humanKey(String(m.usecaseKey || "message"))}`,
    detail: [m.recipientPhone ? `to ${m.recipientPhone}` : "", ...steps].filter(Boolean).join(" · "),
  };
}

function emailEntry(m: any): Entry | null {
  const created = Number(m.createdAt);
  if (!created) return null;
  const steps: string[] = [];
  let dot = "bg-sky-400";
  if (m.status === "failed") { steps.push(`Failed — ${String(m.errorMessage || "MSG91 refused").slice(0, 140)}`); dot = "bg-red-500"; }
  else if (m.deliveryStatus === "bounced") { steps.push(`Bounced${m.bouncedAt ? ` ${at(m.bouncedAt)}` : ""}${m.bounceReason ? ` — ${m.bounceReason}` : ""}`); dot = "bg-red-500"; }
  else {
    steps.push("Sent");
    if (m.deliveredAt) { steps.push(`Delivered ${at(m.deliveredAt)}`); dot = "bg-green-500"; }
    if (m.openedAt) { steps.push(`Opened ${at(m.openedAt)}`); dot = "bg-blue-500"; }
    if (m.clickedAt) steps.push(`Clicked ${at(m.clickedAt)}`);
    if (m.deliveryStatus === "complained") { steps.push("Marked as spam"); dot = "bg-red-500"; }
  }
  return {
    at: created, kind: "email", dot,
    title: `Email · ${EMAIL_LABEL[m.usecaseKey] || m.templateName || humanKey(String(m.usecaseKey || "email"))}`,
    detail: [m.recipientEmail ? `to ${m.recipientEmail}` : "", ...steps].filter(Boolean).join(" · "),
  };
}

export function OrderTimeline({ order }: { order: TimelineOrder }) {
  const entries: Entry[] = [];
  const { wa, mail } = useOrderMessages(order._id);
  for (const m of wa) { const e = whatsappEntry(m); if (e) entries.push(e); }
  for (const m of mail) { const e = emailEntry(m); if (e) entries.push(e); }

  const placedAt = Number(order.createdAt) || Number(order._creationTime) || 0;
  if (placedAt) entries.push({ at: placedAt, kind: "placed", title: "Order placed" });

  for (const h of order.statusHistory || []) {
    if (!h?.at || !h?.to) continue;
    const words = SOURCE_WORDS[String(h.source || "")] || (h.source ? `by ${h.source}` : "");
    entries.push({
      at: h.at,
      kind: "status",
      title: `${ADMIN_STATUS_LABELS[h.to] || h.to}${h.override ? " (override)" : ""}`,
      detail: [words, h.reason].filter(Boolean).join(" · "),
      dot: STATUS_DOT[h.to],
    });
  }

  for (const sc of order.trackScans || []) {
    if (!sc?.at || !sc?.scan) continue;
    entries.push({ at: sc.at, kind: "scan", title: sc.scan, detail: sc.location || "" });
  }

  if (order.ndr?.reason && order.ndr?.at) {
    entries.push({ at: order.ndr.at, kind: "ndr", title: "Delivery failed", detail: order.ndr.reason });
  }

  if (order.orderNotifiedAt) {
    entries.push({ at: order.orderNotifiedAt, kind: "notice", title: "Order confirmation sent" });
  }

  if (order.materialReservedAt) {
    const took = (order.materialConsumed || [])
      .map((m) => `${m.requested} ${m.unit} of ${m.code}`)
      .join(", ");
    entries.push({ at: order.materialReservedAt, kind: "stock", title: "Material taken from stock", detail: took });
  }
  if (order.materialReleasedAt) {
    entries.push({ at: order.materialReleasedAt, kind: "stock", title: "Material put back on the shelf" });
  }

  if (order.walletCreditPaidAt && order.walletCreditPaid) {
    entries.push({
      at: order.walletCreditPaidAt,
      kind: "money",
      title: `₹${order.walletCreditPaid} credited to their wallet`,
    });
  }

  entries.sort((a, b) => b.at - a.at);

  /*
   * What is still owed, said at the top rather than buried in the story: a
   * promise made at checkout that has not been kept yet is the one thing on
   * this card somebody might have to act on.
   */
  const owed = Number(order.creditOnDelivery) || 0;
  const owedUnpaid = owed > 0 && !order.walletCreditPaidAt;
  const owedNoAccount = Number(order.creditOwedNoAccount) || 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>History</CardTitle>
          {order.expectedDeliveryAt ? (
            <span className="rounded-full bg-teal-500/10 px-2.5 py-1 text-xs font-medium text-teal-700 dark:text-teal-300">
              Courier expects delivery by {new Date(order.expectedDeliveryAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
            </span>
          ) : null}
        </div>
      </CardHeader>
      <CardContent>
        {owedNoAccount > 0 && (
          <p className="mb-4 rounded-lg border-2 border-amber-500/30 bg-amber-500/10 p-2.5 text-sm text-amber-800 dark:text-amber-200">
            ₹{owedNoAccount} of credit was earned but this is a guest order with no wallet to pay it into.
          </p>
        )}
        {owedUnpaid && (
          <p className="mb-4 rounded-lg bg-brand/10 p-2.5 text-sm">
            ₹{owed} goes into their wallet when this is delivered.
          </p>
        )}

        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing recorded yet. Moves made from here on — by you, by the courier — appear in this column.
          </p>
        ) : (
          <ol className="space-y-0">
            {entries.map((e, i) => {
              const Icon = ICONS[e.kind];
              return (
                <li key={`${e.at}-${i}`} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span className={`grid size-7 shrink-0 place-items-center rounded-lg ${TONES[e.kind]}`}>
                      <Icon className="size-3.5" />
                    </span>
                    {i < entries.length - 1 && <span className="w-px flex-1 bg-border" style={{ minHeight: "0.75rem" }} />}
                  </div>
                  <div className="min-w-0 flex-1 pb-4">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <p className="text-sm font-medium">
                        {e.dot && <span className={`mr-1.5 inline-block size-1.5 rounded-full align-middle ${e.dot}`} />}
                        {e.title}
                      </p>
                      <span className="text-xs tabular-nums text-muted-foreground">{when(e.at)}</span>
                    </div>
                    {e.detail && <p className="text-xs text-muted-foreground">{e.detail}</p>}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
