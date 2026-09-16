import { useQuery, useMutation } from "@/lib/firebase-hooks";
import { api } from "@/lib/firebase-api";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { BellIcon, SendIcon, UsersIcon, CheckCircleIcon, TrashIcon, AlertTriangleIcon, ExternalLinkIcon, Loader2Icon } from "lucide-react";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Authenticated, Unauthenticated, AuthLoading } from "@/lib/firebase-hooks";
import { SignInButton } from "@/components/ui/signin.tsx";
import { AdminLayout } from "@/components/admin-layout.tsx";
import { toast } from "sonner";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog.tsx";

type Request = {
  _id: string;
  phoneNumber: string;
  createdAt: number;
  userId: string;
  userEmail: string;
  requestsFromThisNumber: number;
};

type VariantStat = {
  variantId: string;
  variantTitle: string;
  sku: string;
  inventoryQuantity?: number;
  count: number;
  requests: Request[];
};

type ProductStat = {
  productId: string;
  productTitle: string;
  productSlug: string;
  totalCount: number;
  variants: VariantStat[];
};

const formatWhen = (ms: number) =>
  ms
    ? new Date(ms).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })
    : "—";

function AdminStockNotificationsPageInner() {
  const stats = useQuery(api.stockNotifications.getNotificationStats, {}) as ProductStat[] | undefined;
  const sendNotifications = useMutation(api.stockNotificationsActions.sendRestockNotifications);
  const deleteRequest = useMutation(api.stockNotifications.deleteRequest);
  const [sendingFor, setSendingFor] = useState<string | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<{ variantId: string; variantTitle: string; count: number } | null>(null);
  const [healthKey, setHealthKey] = useState(0);

  const confirmSendNotifications = async () => {
    if (!selectedVariant) return;
    const target = selectedVariant;
    setSendingFor(target.variantId);
    setSelectedVariant(null);

    try {
      const result: any = await sendNotifications({ variantId: target.variantId });
      if (!result?.queued) {
        toast.info("Nobody was waiting for this variant");
      } else if (result.workerError) {
        toast.warning(`${result.queued} message(s) queued, but sending right now failed (${result.workerError}). The worker retries every 5 minutes.`);
      } else if (result.sent >= result.queued) {
        toast.success(`WhatsApp sent to ${result.sent} customer(s)`);
      } else {
        toast.warning(`${result.queued} queued, ${result.sent} sent now. See "Last messages" below for why the rest did not go.`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send notifications");
    } finally {
      setSendingFor(null);
      setHealthKey((k) => k + 1);
    }
  };

  const removeRequest = async (r: Request) => {
    if (!confirm(`Delete the request from ${r.phoneNumber}?`)) return;
    try {
      await deleteRequest({ id: r._id });
      toast.success("Request deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete");
    }
  };

  if (stats === undefined) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  const totalWaiting = stats.reduce((sum, product) => sum + product.totalCount, 0);
  const phones = new Set(stats.flatMap((p) => p.variants.flatMap((v) => v.requests.map((r) => r.phoneNumber))));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Back-in-Stock Notifications</h1>
        <p className="text-muted-foreground">
          Who is waiting for what. A design with enough requests is worth sourcing again.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Requests waiting" value={totalWaiting} />
        <StatCard label="Different numbers" value={phones.size} />
        <StatCard label="Products" value={stats.length} />
        <StatCard label="Variants" value={stats.reduce((sum, product) => sum + product.variants.length, 0)} />
      </div>

      <WhatsAppHealth key={healthKey} />

      {stats.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <BellIcon />
            </EmptyMedia>
            <EmptyTitle>No waiting notifications</EmptyTitle>
            <EmptyDescription>Customers will appear here when they sign up for stock notifications</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="space-y-4">
          {stats.map((product) => (
            <Card key={product.productId || product.productTitle}>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle className="flex items-center gap-2">
                      <span className="truncate">{product.productTitle}</span>
                      {product.productSlug && (
                        <a
                          href={`/products/${product.productSlug}`}
                          target="_blank"
                          rel="noreferrer"
                          className="shrink-0 text-muted-foreground hover:text-foreground"
                          title="Open on the store"
                        >
                          <ExternalLinkIcon className="size-4" />
                        </a>
                      )}
                    </CardTitle>
                    <CardDescription>{product.totalCount} customer(s) waiting</CardDescription>
                  </div>
                  <Badge variant="outline">
                    <UsersIcon className="mr-1 size-3" />
                    {product.totalCount}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {product.variants.map((variant) => (
                  <div key={variant.variantId} className="rounded-lg border">
                    <div className="flex flex-wrap items-center justify-between gap-3 p-4">
                      <div className="min-w-0">
                        <div className="font-medium">{variant.variantTitle}</div>
                        <div className="text-sm text-muted-foreground">
                          SKU: <span className="font-mono">{variant.sku || "—"}</span>
                          {variant.inventoryQuantity !== undefined && <> · stock {variant.inventoryQuantity}</>}
                        </div>
                        <div className="mt-1 text-sm font-semibold text-primary">{variant.count} customer(s) waiting</div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() =>
                          setSelectedVariant({ variantId: variant.variantId, variantTitle: variant.variantTitle, count: variant.count })
                        }
                        disabled={sendingFor === variant.variantId}
                      >
                        {sendingFor === variant.variantId ? (
                          <Loader2Icon className="mr-2 size-4 animate-spin" />
                        ) : (
                          <SendIcon className="mr-2 size-4" />
                        )}
                        {sendingFor === variant.variantId ? "Sending…" : "Send alerts"}
                      </Button>
                    </div>
                    <div className="overflow-x-auto border-t">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                          <tr>
                            <th className="px-4 py-2 font-medium">WhatsApp number</th>
                            <th className="px-4 py-2 font-medium">Asked on</th>
                            <th className="px-4 py-2 font-medium">Account</th>
                            <th className="px-4 py-2 font-medium">Signals</th>
                            <th className="px-2 py-2" />
                          </tr>
                        </thead>
                        <tbody>
                          {variant.requests.map((r) => (
                            <tr key={r._id} className="border-t">
                              <td className="px-4 py-2 font-mono tabular-nums">
                                <a
                                  href={`https://wa.me/91${r.phoneNumber}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="hover:underline"
                                >
                                  +91 {r.phoneNumber}
                                </a>
                              </td>
                              <td className="px-4 py-2 tabular-nums text-muted-foreground">{formatWhen(r.createdAt)}</td>
                              <td className="px-4 py-2 text-muted-foreground">
                                {r.userEmail || (r.userId ? "signed in" : "guest")}
                              </td>
                              <td className="px-4 py-2">
                                <div className="flex flex-wrap gap-1">
                                  {r.requestsFromThisNumber > 3 && (
                                    <Badge className="bg-amber-500/15 text-[11px] text-amber-700 dark:text-amber-300">
                                      {r.requestsFromThisNumber} requests from this number
                                    </Badge>
                                  )}
                                  {/^(\d)\1{9}$|^9876543210$|^1234567890$/.test(r.phoneNumber) && (
                                    <Badge variant="destructive" className="text-[11px]">looks fake</Badge>
                                  )}
                                </div>
                              </td>
                              <td className="px-2 py-2 text-right">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2 text-rose-600"
                                  title="Delete this request"
                                  onClick={() => void removeRequest(r)}
                                >
                                  <TrashIcon className="size-3.5" />
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!selectedVariant} onOpenChange={(o) => !o && setSelectedVariant(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send WhatsApp notifications?</DialogTitle>
            <DialogDescription>
              This sends a WhatsApp message to {selectedVariant?.count} customer(s) waiting for{" "}
              <strong>{selectedVariant?.variantTitle}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/10 p-4">
            <CheckCircleIcon className="mt-0.5 size-5 shrink-0 text-primary" />
            <div className="text-sm">
              <div className="mb-1 font-semibold">Before sending:</div>
              <ul className="list-inside list-disc space-y-1 text-muted-foreground">
                <li>Make sure the design is actually back in stock</li>
                <li>Update the sheets or inventory first, so the link opens on an available variant</li>
                <li>Each person gets one message; this cannot be undone</li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedVariant(null)}>
              Cancel
            </Button>
            <Button onClick={() => void confirmSendNotifications()}>
              <SendIcon className="mr-2 size-4" />
              Send notifications
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold tabular-nums">{value}</div>
      </CardContent>
    </Card>
  );
}

/** The template variables a back-in-stock message fills (see sendRestockNotifications). */
const FILLED_VARIABLES = [
  "product_name", "variant_name", "model_name", "product_url", "product_price",
  "shop_url", "company_name", "customer_name", "stock_notification",
];

/**
 * Whether a back-in-stock message can actually leave, and what the last ones
 * did. Every link in the chain — usecase, template, its variables, the
 * provider's answer — is shown, so a silent failure has somewhere to surface.
 */
function WhatsAppHealth() {
  const health = useQuery(api.stockNotifications.getWhatsAppHealth, {}) as any;

  if (health === undefined) return <Skeleton className="h-28 w-full" />;
  if (health?.error) {
    return (
      <Card>
        <CardContent className="p-4 text-sm text-rose-600">{health.error}</CardContent>
      </Card>
    );
  }

  const vars: string[] = health.template?.variables || [];
  const checks = [
    {
      ok: !!health.usecase,
      label: "“back_in_stock” usecase exists",
      fix: "Add it under WhatsApp → Usecases.",
    },
    {
      ok: !!health.usecase?.enabled,
      label: "Usecase is switched on",
      fix: "Enable it under WhatsApp → Usecases.",
    },
    {
      ok: !!health.usecase?.providerTemplateId,
      label: "Linked to an authkey template (wid)",
      fix: "Set the provider template id on the usecase.",
    },
    {
      ok: !!health.template,
      label: `Template found${health.template?.name ? ` — ${health.template.name}` : ""}`,
      fix: "Sync templates under WhatsApp → Templates so the variable order is known.",
    },
    {
      ok: vars.length > 0 && vars.every((v) => FILLED_VARIABLES.includes(v)),
      label: `Template variables: ${vars.length ? vars.join(", ") : "none recorded"}`,
      fix: `This message can fill ${FILLED_VARIABLES.join(", ")}. Any other variable goes out empty.`,
    },
  ];
  const recent: any[] = health.recent || [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">WhatsApp delivery</CardTitle>
        <CardDescription>
          {health.notifiedTotal} request(s) already notified. Messages go through authkey; the worker also runs every 5 minutes.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-2">
        <ul className="space-y-1.5 text-sm">
          {checks.map((c) => (
            <li key={c.label} className="flex items-start gap-2">
              {c.ok ? (
                <CheckCircleIcon className="mt-0.5 size-4 shrink-0 text-emerald-600" />
              ) : (
                <AlertTriangleIcon className="mt-0.5 size-4 shrink-0 text-amber-600" />
              )}
              <span>
                {c.label}
                {!c.ok && <span className="block text-xs text-muted-foreground">{c.fix}</span>}
              </span>
            </li>
          ))}
        </ul>
        <div>
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Last messages</p>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">No back-in-stock message has been sent yet.</p>
          ) : (
            <div className="max-h-48 overflow-auto rounded-md border">
              <table className="w-full text-xs">
                <tbody>
                  {recent.map((m) => (
                    <tr key={m._id} className="border-b last:border-0">
                      <td className="px-2 py-1.5 font-mono tabular-nums">{m.phone}</td>
                      <td className="px-2 py-1.5 tabular-nums text-muted-foreground">{formatWhen(m.sentAt || m.createdAt)}</td>
                      <td className="px-2 py-1.5">
                        <Badge
                          className={`text-[10px] ${
                            m.status === "sent"
                              ? "bg-emerald-600"
                              : m.status === "failed"
                                ? "bg-rose-600"
                                : "bg-amber-500"
                          }`}
                        >
                          {m.status}
                        </Badge>
                      </td>
                      <td className="px-2 py-1.5 text-muted-foreground">{m.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminStockNotificationsPage() {
  return (
    <AdminLayout>
      <Unauthenticated>
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <BellIcon />
            </EmptyMedia>
            <EmptyTitle>Please sign in to access admin</EmptyTitle>
            <EmptyDescription>You need to be logged in to manage stock notifications</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <SignInButton />
          </EmptyContent>
        </Empty>
      </Unauthenticated>
      <AuthLoading>
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      </AuthLoading>
      <Authenticated>
        <AdminStockNotificationsPageInner />
      </Authenticated>
    </AdminLayout>
  );
}
