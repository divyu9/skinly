import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2Icon, CopyIcon, SmartphoneIcon } from "lucide-react";

/**
 * Pay a clearance order straight to the shop owner's UPI (functions:
 * clearance.ts). Shown on the order page while a direct-UPI order waits for
 * money: a QR for the exact amount, a button that opens a UPI app on a
 * phone, the UPI ID to copy, and a box for the UTR once paid. The admin
 * checks the bank and confirms; until then the pieces stay held for a day.
 */
export function UpiPayBox({ orderId, upiPay, utr, submittedAt }: {
  orderId: string;
  upiPay: { vpa: string; payeeName?: string; amount: number; note?: string };
  utr?: string;
  submittedAt?: number;
}) {
  const amount = Math.round(Number(upiPay.amount) || 0);
  // The UPI ID stays as written (some apps reject "%40" for "@"); the rest is
  // percent-encoded with %20 for spaces, which every UPI app reads.
  const enc = (v: string) => encodeURIComponent(v);
  const link = "upi://pay?" + [
    `pa=${upiPay.vpa}`,
    upiPay.payeeName ? `pn=${enc(upiPay.payeeName)}` : "",
    `am=${amount}`,
    "cu=INR",
    upiPay.note ? `tn=${enc(`GoSkinly ${upiPay.note}`)}` : "",
  ].filter(Boolean).join("&");
  // The same payment for each app by name: iPhones have no app chooser for
  // upi:// links, so each app gets its own button there.
  const query = link.slice("upi://pay?".length);
  const apps = [
    { name: "GPay", href: `tez://upi/pay?${query}` },
    { name: "PhonePe", href: `phonepe://pay?${query}` },
    { name: "Paytm", href: `paytmmp://pay?${query}` },
  ];
  const isIos = typeof navigator !== "undefined" && /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const [qr, setQr] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(!!utr);

  useEffect(() => {
    let live = true;
    import("qrcode").then((m) => m.toDataURL(link, { width: 260, margin: 1 })).then((d) => { if (live) setQr(d); }).catch(() => {});
    return () => { live = false; };
  }, [link]);

  const submit = async () => {
    setBusy(true);
    try {
      const [{ functions }, { httpsCallable }] = await Promise.all([import("@/lib/firebase"), import("firebase/functions")]);
      await httpsCallable(functions, "submitUpiPayment")({ orderId, utr: code });
      setSent(true);
      toast.success("Thanks! We'll confirm your payment shortly.");
    } catch (e: any) {
      toast.error(e?.message || "Could not send the reference");
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <div className="rounded-2xl border-2 border-green-600/30 bg-green-50 p-4 text-sm dark:bg-green-950/30">
        <p className="flex items-center gap-2 font-bold text-green-800 dark:text-green-300"><CheckCircle2Icon className="size-5" /> Payment reference received</p>
        <p className="mt-1 text-green-900/80 dark:text-green-200/80">
          UTR {utr || code}{submittedAt ? ` · ${new Date(submittedAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}` : ""}. We'll check it and confirm your order — you'll get a WhatsApp message.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-2xl border-2 border-ink bg-card p-4 text-sm">
      <div>
        <p className="text-base font-extrabold">Pay ₹{amount} by UPI to complete your order</p>
        <p className="text-muted-foreground">Clearance items are paid directly by UPI. Your item is held for you for 24 hours.</p>
      </div>
      <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
        <div className="grid size-[200px] shrink-0 place-items-center rounded-xl border bg-white p-2">
          {qr ? <img src={qr} alt={`UPI QR for ₹${amount}`} className="size-full" /> : <span className="text-xs text-muted-foreground">Loading QR…</span>}
        </div>
        <div className="w-full space-y-2">
          {isIos ? (
            <div className="grid grid-cols-3 gap-2 sm:hidden">
              {apps.map((a) => (
                <a key={a.name} href={a.href} className="sticker-sm sticker-press rounded-xl bg-brand px-2 py-2.5 text-center text-xs font-bold text-brand-foreground">Pay in {a.name}</a>
              ))}
            </div>
          ) : (
            <a href={link} className="sticker-sm sticker-press flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3 font-bold text-brand-foreground sm:hidden">
              <SmartphoneIcon className="size-4" /> Pay ₹{amount} in a UPI app
            </a>
          )}
          <p className="text-xs text-muted-foreground">If the app button doesn't work, scan the QR with any UPI app (PhonePe, GPay, Paytm, BHIM) — or save a screenshot and open it in your UPI app — or pay to this UPI ID:</p>
          <button type="button" onClick={() => { void navigator.clipboard?.writeText(upiPay.vpa); toast.success("UPI ID copied"); }}
            className="flex w-full items-center justify-between rounded-lg border-2 border-ink/15 px-3 py-2 font-mono text-sm">
            {upiPay.vpa} <CopyIcon className="size-4" />
          </button>
          {upiPay.payeeName && <p className="text-xs text-muted-foreground">Name shown: {upiPay.payeeName}</p>}
        </div>
      </div>
      <div className="space-y-1.5 border-t pt-3">
        <label htmlFor="upi-utr" className="text-xs font-semibold">After paying, enter the UTR / UPI reference number from your app</label>
        <div className="flex gap-2">
          <input id="upi-utr" value={code} onChange={(e) => setCode(e.target.value.replace(/[^A-Za-z0-9]/g, "").slice(0, 40))}
            placeholder="e.g. 428919123456" inputMode="text"
            className="min-w-0 flex-1 rounded-lg border-2 border-ink/15 bg-background px-3 py-2 font-mono outline-none focus:border-brand" />
          <button type="button" onClick={submit} disabled={busy || code.length < 6}
            className="shrink-0 rounded-lg border-2 border-ink bg-brand px-4 py-2 font-bold text-brand-foreground disabled:opacity-50">
            {busy ? "…" : "Submit"}
          </button>
        </div>
      </div>
    </div>
  );
}
