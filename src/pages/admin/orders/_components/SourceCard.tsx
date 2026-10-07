import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { CompassIcon } from "lucide-react";

/**
 * Where the buyer came from. order.attribution holds what the browser saw
 * (first and latest visit, src/lib/attribution.ts) and, once GA4 has the
 * purchase, GA's own session source (functions/src/orderSources.ts).
 */
type Touch = { channel?: string; source?: string; medium?: string; campaign?: string; content?: string; referrer?: string; landing?: string; click?: string; app?: string; at?: number; group?: string };

const COLORS: [RegExp, string][] = [
  [/instagram/i, "bg-pink-100 text-pink-800"],
  [/facebook/i, "bg-blue-100 text-blue-800"],
  [/youtube/i, "bg-red-100 text-red-800"],
  [/google|bing/i, "bg-emerald-100 text-emerald-800"],
  [/whatsapp/i, "bg-green-100 text-green-800"],
  [/ai chat/i, "bg-violet-100 text-violet-800"],
  [/email/i, "bg-amber-100 text-amber-800"],
];
const chip = (c: string) => COLORS.find(([re]) => re.test(c))?.[1] || "bg-muted text-foreground";

function Row({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="flex gap-2 text-xs">
      <span className="w-20 shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 break-all">{value}</span>
    </div>
  );
}

function TouchBlock({ title, t }: { title: string; t: Touch }) {
  const when = t.at ? new Date(t.at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "";
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">{title}</span>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${chip(t.channel || "")}`}>{t.channel}</span>
        {when && <span className="text-xs text-muted-foreground">{when}</span>}
      </div>
      <Row label="Campaign" value={t.campaign} />
      <Row label="Source" value={[t.source, t.medium].filter(Boolean).join(" / ") || undefined} />
      <Row label="Ad / post" value={t.content} />
      <Row label="Ad click" value={t.click} />
      <Row label="In-app" value={t.app} />
      <Row label="Landed on" value={t.landing} />
      <Row label="Referrer" value={t.referrer} />
    </div>
  );
}

type CapiRun = { ok?: boolean; error?: string; eventId?: string; sentAt?: number; testCode?: string; events?: string[] };

/** What the Conversions API sent for this order (functions/src/metaCapi.ts). */
function MetaRows({ tracking, metaCapi }: { tracking?: any; metaCapi?: { purchase?: CapiRun; checkout?: CapiRun } }) {
  if (!tracking && !metaCapi) return null;
  const run = (r?: CapiRun) => !r ? "not sent" : r.ok ? `sent${r.testCode ? " (test events)" : ""}` : r.sentAt ? `failed — ${r.error || "?"}` : "pending";
  return (
    <div className="space-y-1.5 border-t pt-3">
      <span className="text-xs font-medium text-muted-foreground">Meta (server events)</span>
      <Row label="Purchase" value={`${run(metaCapi?.purchase)}${metaCapi?.purchase?.eventId ? ` · ${metaCapi.purchase.eventId}` : ""}`} />
      <Row label="Checkout" value={metaCapi?.checkout ? `${run(metaCapi.checkout)} · ${(metaCapi.checkout.events || []).join(", ")}` : "not sent"} />
      <Row label="Match keys" value={[tracking?.fbp && "fbp", tracking?.fbc && "fbc", tracking?.clientIp && "ip", tracking?.userAgent && "browser"].filter(Boolean).join(", ") || "none"} />
    </div>
  );
}

export function SourceCard({ attribution, tracking, metaCapi }: { attribution?: { first?: Touch; last?: Touch; ga4?: Touch }; tracking?: any; metaCapi?: any }) {
  const { first, last, ga4 } = attribution || {};
  const main = last || first || ga4;
  const sameFirst = first && last && first.channel === last.channel && first.campaign === last.campaign && first.landing === last.landing;
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base"><CompassIcon className="size-4" /> Source</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!main ? (
          <p className="text-sm text-muted-foreground">Not recorded — placed before source tracking (5 Oct 2026), or GA4 never got this purchase.</p>
        ) : (
          <>
            {last && <TouchBlock title={sameFirst ? "Came from" : "Last visit"} t={last} />}
            {first && !sameFirst && <TouchBlock title="First visit" t={first} />}
            {!last && !first && ga4 && <TouchBlock title="Came from" t={ga4} />}
            {ga4 && (last || first) && (
              <p className="text-xs text-muted-foreground">
                GA4: <span className={`rounded-full px-2 py-0.5 font-medium ${chip(ga4.channel || "")}`}>{ga4.channel}</span>{" "}
                {[ga4.source, ga4.medium].filter(Boolean).join(" / ")}{ga4.campaign ? ` · ${ga4.campaign}` : ""}
              </p>
            )}
          </>
        )}
        <MetaRows tracking={tracking} metaCapi={metaCapi} />
      </CardContent>
    </Card>
  );
}
