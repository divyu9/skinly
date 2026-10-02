import { useEffect, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { toast } from "sonner";
import { BellRingIcon, LoaderIcon, SendIcon } from "lucide-react";
import { db } from "@/lib/firebase-db";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Switch } from "@/components/ui/switch.tsx";

/**
 * Admin › Emails › Admin alerts: the "New order!" email to the shop's own
 * inbox (functions/src/adminOrderEmail.ts). Who gets it and whether it is on
 * live in settings/adminAlerts; the MSG91 template is the admin_new_order
 * usecase in the list below, which must be switched on too.
 */
export function AdminAlertsCard() {
  const [on, setOn] = useState(true);
  const [emails, setEmails] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState<"save" | "test" | null>(null);

  useEffect(() => {
    getDoc(doc(db, "settings", "adminAlerts")).then((s) => {
      const d = s.data() as any;
      if (d) { setOn(d.newOrderEmail !== false); setEmails((d.emails || []).join(", ")); }
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  const list = () => emails.split(/[,\s]+/).map((e) => e.trim().toLowerCase()).filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e));
  const save = async () => {
    setBusy("save");
    try {
      await setDoc(doc(db, "settings", "adminAlerts"), { newOrderEmail: on, emails: list(), updatedAt: Date.now() }, { merge: true });
      toast.success("Saved");
    } catch (e: any) { toast.error(e?.message || "Could not save"); }
    finally { setBusy(null); }
  };
  const test = async () => {
    setBusy("test");
    try {
      await setDoc(doc(db, "settings", "adminAlerts"), { newOrderEmail: on, emails: list(), updatedAt: Date.now() }, { merge: true });
      const r: any = (await httpsCallable(getFunctions(), "testAdminOrderEmail")({})).data;
      toast.success(`Test sent, using order ${r.orderNumber} — check your inbox`);
    } catch (e: any) { toast.error(e?.message || "Test failed"); }
    finally { setBusy(null); }
  };

  if (!loaded) return null;
  return (
    <div className="rounded-2xl border-2 border-ink bg-card p-5 shadow-[3px_3px_0_0_var(--ink)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-extrabold"><BellRingIcon className="size-5" /> Admin alerts: new order email</h2>
          <p className="mt-1 text-sm text-muted-foreground">An email to these addresses the moment an order is confirmed — order, amount, what was bought, and today's count.</p>
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold"><Switch checked={on} onCheckedChange={setOn} /> {on ? "On" : "Off"}</label>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Input value={emails} onChange={(e) => setEmails(e.target.value)} placeholder="you@example.com, partner@example.com" className="min-w-[260px] flex-1" />
        <Button onClick={() => void save()} disabled={!!busy}>{busy === "save" && <LoaderIcon className="mr-2 size-4 animate-spin" />}Save</Button>
        <Button variant="outline" onClick={() => void test()} disabled={!!busy || !list().length}>
          {busy === "test" ? <LoaderIcon className="mr-2 size-4 animate-spin" /> : <SendIcon className="mr-2 size-4" />}Send test
        </Button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Needs the <b>admin_new_order</b> template ID set and switched on in the Order Emails list below (the test works even while it is off).</p>
    </div>
  );
}
