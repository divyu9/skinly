import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { ADMIN_STATUS_LABELS, STATUS_DOT } from "@/lib/order-label.ts";
import {
  PackageIcon, TruckIcon, ZapIcon, WalletIcon, ScissorsIcon,
  MailIcon, AlertTriangleIcon, CalendarClockIcon,
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
  kind: "placed" | "status" | "scan" | "notice" | "stock" | "money" | "ndr" | "edd";
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
};

const when = (ts: number) =>
  new Date(ts).toLocaleString("en-IN", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });

export function OrderTimeline({ order }: { order: TimelineOrder }) {
  const entries: Entry[] = [];

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
