import { CheckIcon } from "lucide-react";

/**
 * Where the order is, at a glance: Placed → Packed → Shipped → Out for
 * delivery → Delivered. The tracking card below has the courier's detail;
 * this is the one-line answer. Not shown for orders that left the path
 * (cancelled, returned, awaiting payment).
 */
const STEPS = ["Placed", "Packed", "Shipped", "Out for delivery", "Delivered"];
const AT: Record<string, number> = {
  pending: 0, processing: 0, ready_to_ship: 1, shipped: 2, out_for_delivery: 3, undelivered: 3, delivered: 4,
};

export function OrderProgress({ status }: { status?: string }) {
  const at = AT[String(status || "")];
  if (at === undefined) return null;
  const failed = status === "undelivered";
  return (
    <div className="rounded-2xl border-2 border-ink/10 bg-card p-4">
      <ol className="flex items-start">
        {STEPS.map((label, i) => {
          const done = i < at || (i === at && status === "delivered");
          const current = i === at && status !== "delivered";
          return (
            <li key={label} className="relative flex flex-1 flex-col items-center text-center">
              {i > 0 && (
                <span className={`absolute right-1/2 top-3 h-0.5 w-full -translate-y-1/2 ${i <= at ? "bg-brand" : "bg-muted"}`} />
              )}
              <span className={`relative z-10 grid size-6 place-items-center rounded-full border-2 text-[10px] font-bold ${
                done ? "border-brand bg-brand text-brand-foreground"
                  : current ? (failed ? "border-destructive bg-destructive text-white" : "border-brand bg-background text-brand")
                  : "border-muted bg-background text-muted-foreground"}`}>
                {done ? <CheckIcon className="size-3.5" strokeWidth={3} /> : i + 1}
              </span>
              <span className={`mt-1.5 text-[10px] leading-tight sm:text-xs ${current ? "font-bold text-foreground" : done ? "text-foreground" : "text-muted-foreground"}`}>
                {current && failed ? "Delivery attempt failed" : label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
