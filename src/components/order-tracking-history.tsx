/**
 * The parcel's journey on the customer's order page, from "Order placed" to
 * "Delivered": the courier's own scans (trackScans, written by the RapidShyp
 * webhook and the Delhivery sync), each with its date, time and place.
 * Internal events — stock drawn down, admin status edits — are not shown.
 */

type Scan = { at: number; scan: string; location?: string; code?: string };

/* The courier's words for a scan, read into a customer's. Anything unknown is
   split out of its CamelCase ("ReachedAtHub" → "Reached at hub"). */
const FRIENDLY: Array<[RegExp, string]> = [
  [/^(scb|readyforreceive|manifested|shipment ?booked|booked)$/i, "Shipment booked"],
  [/^(pue|pickupfailed|pickup ?failed|not picked)$/i, "Pickup attempt missed — rescheduled"],
  [/^(puc|pickupdone|pickup ?(done|completed)|picked ?up)$/i, "Picked up by courier"],
  [/^(int|intransit|in ?transit)$/i, "In transit"],
  [/^(rad|reachedatdestination|reached at destination)$/i, "Reached your nearest hub"],
  [/^(ofd|outfordelivery|out for delivery|dispatched)$/i, "Out for delivery"],
  [/^(del|delivered)$/i, "Delivered"],
  [/^(und|ndr|undelivered|delivery ?failed)$/i, "Delivery attempt failed"],
  [/^rto/i, "Returning to seller"],
];

function friendly(scan: Scan): string {
  const raw = String(scan.scan || "").trim();
  const key = raw.replace(/[\s_-]+/g, " ").trim();
  for (const [re, text] of FRIENDLY) if (re.test(key) || re.test(key.replace(/\s/g, "")) || (scan.code && re.test(scan.code))) return text;
  const split = raw.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ").toLowerCase();
  return split.charAt(0).toUpperCase() + split.slice(1);
}

const when = (t: number) =>
  new Date(t).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true });

export function OrderTrackingHistory({ placedAt, scans, expectedDeliveryAt, delivered }: {
  placedAt?: number; scans?: Scan[]; expectedDeliveryAt?: number; delivered?: boolean;
}) {
  const events = [
    ...(placedAt ? [{ at: placedAt, text: "Order placed", location: "" }] : []),
    ...(Array.isArray(scans) ? scans : [])
      .filter((s) => s && s.at && s.scan)
      .sort((a, b) => a.at - b.at)
      .map((s) => ({ at: s.at, text: friendly(s), location: String(s.location || "").replace(/_/g, " ") })),
  ]
    // A courier repeats a scan (two "In transit" at one hub); one line each.
    .filter((e, i, all) => i === 0 || !(e.text === all[i - 1].text && e.location === all[i - 1].location));

  if (events.length <= 1) return null;
  const last = events.length - 1;

  return (
    <div>
      <p className="mb-3 text-xs font-medium uppercase text-muted-foreground">Shipment history</p>
      <ol className="relative space-y-4 border-l-2 border-muted pl-5">
        {events.map((e, i) => (
          <li key={`${e.at}-${i}`} className="relative">
            <span className={`absolute -left-[27px] top-1 size-3 rounded-full ring-4 ring-background ${i === last ? "bg-brand" : "bg-muted-foreground/40"}`} />
            <p className={`text-sm ${i === last ? "font-bold" : "font-medium"}`}>{e.text}</p>
            <p className="text-xs text-muted-foreground">
              {when(e.at)}{e.location ? ` · ${e.location}` : ""}
            </p>
          </li>
        ))}
      </ol>
      {!delivered && expectedDeliveryAt ? (
        <p className="mt-3 text-sm">
          Expected delivery: <b>{new Date(expectedDeliveryAt).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}</b>
        </p>
      ) : null}
    </div>
  );
}
