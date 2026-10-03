import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { addDoc, collection, doc, getDoc, getDocs, query, setDoc, where } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { toast } from "sonner";
import { CheckCircle2Icon, ImageIcon, LoaderIcon, MessageSquareIcon, SendIcon, TypeIcon } from "lucide-react";
import { db } from "@/lib/firebase-db";
import { AdminLayout } from "@/components/admin-layout.tsx";
import { Authenticated } from "@/lib/firebase-hooks";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import { WHATSAPP_MESSAGES, type WhatsAppMessageSpec } from "@/lib/whatsapp-registry.ts";
import { AdminNotifications } from "./_components/admin-notifications.tsx";

/**
 * Admin › WhatsApp: one row per message the site sends.
 *
 * Paste the Authkey template ID, say whether it was made with a photo header,
 * switch it on, press Test. The variable order comes from the code
 * (lib/whatsapp-registry.ts), so it can't be typed wrong — a hand-entered
 * order is how the old templates came to send the amount where the name goes.
 */

type Row = { id: string; photo: boolean; enabled: boolean; docId?: string; savedId: string; savedPhoto: boolean };

export default function WhatsAppAdminPage() {
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, { ok: boolean; text: string }>>({});
  // Who sends (whatsappSettings/provider). The API keys stay in functions/.env.
  const [provider, setProvider] = useState<"authkey" | "fast2sms">("authkey");
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [savedProvider, setSavedProvider] = useState({ provider: "authkey", phoneNumberId: "" });
  const [f2s, setF2s] = useState<any>(null);
  const [f2sLoading, setF2sLoading] = useState(false);
  const [f2sLog, setF2sLog] = useState<any[] | null>(null);

  useEffect(() => {
    (async () => {
      const [uc, tpl] = await Promise.all([getDocs(collection(db, "whatsappUsecases")), getDocs(collection(db, "whatsappTemplates"))]);
      const ps = (await getDoc(doc(db, "whatsappSettings", "provider"))).data() as any;
      const prov = ps?.provider === "fast2sms" ? "fast2sms" : "authkey";
      setProvider(prov); setPhoneNumberId(String(ps?.phoneNumberId || ""));
      setSavedProvider({ provider: prov, phoneNumberId: String(ps?.phoneNumberId || "") });
      const photoOf = new Map(tpl.docs
        .filter((d) => (d.data().provider || "authkey") === prov)
        .map((d) => [String(d.data().providerTemplateId || ""), d.data().headerType === "image"]));
      const next: Record<string, Row> = {};
      for (const spec of WHATSAPP_MESSAGES) {
        const d = uc.docs.find((x) => x.data().usecaseKey === spec.key);
        const id = String(d?.data().providerTemplateId || "");
        const photo = id ? (photoOf.get(id) ?? spec.photo) : spec.photo;
        next[spec.key] = { id, photo, enabled: d?.data().enabled === true, docId: d?.id, savedId: id, savedPhoto: photo };
      }
      setRows(next);
      setLoaded(true);
    })().catch((e) => toast.error(e?.message || "Could not load"));
  }, []);

  const patch = (key: string, p: Partial<Row>) => setRows((r) => ({ ...r, [key]: { ...r[key], ...p } }));

  const save = async (spec: WhatsAppMessageSpec, enabled: boolean) => {
    const row = rows[spec.key];
    const id = row.id.trim();
    if (enabled && !/^\d+$/.test(id)) { toast.error("Add the template ID (a number) first"); return; }
    setBusy(`save:${spec.key}`);
    try {
      if (id) {
        const all = await getDocs(query(collection(db, "whatsappTemplates"), where("providerTemplateId", "==", id)));
        const mine = all.docs.filter((d) => (d.data().provider || "authkey") === savedProvider.provider);
        const t = { empty: !mine.length, docs: mine };
        const data = { providerTemplateId: id, provider: savedProvider.provider, name: spec.key, variables: spec.vars, headerType: row.photo ? "image" : "none", status: "approved", updatedAt: Date.now() };
        if (t.empty) await addDoc(collection(db, "whatsappTemplates"), { ...data, templateName: spec.key, createdAt: Date.now() });
        else await setDoc(t.docs[0].ref, data, { merge: true });
      }
      const uc = { usecaseKey: spec.key, displayName: spec.label, providerTemplateId: id, enabled, variableMapping: Object.fromEntries(spec.vars.map((v) => [v, v])), updatedAt: Date.now() };
      let docId = row.docId;
      if (docId) await setDoc(doc(db, "whatsappUsecases", docId), uc, { merge: true });
      else docId = (await addDoc(collection(db, "whatsappUsecases"), { ...uc, createdAt: Date.now() })).id;
      patch(spec.key, { enabled, docId, savedId: id, savedPhoto: row.photo });
      toast.success(`${spec.label}: ${enabled ? "on" : "saved, off"}`);
    } catch (e: any) {
      toast.error(e?.message || "Could not save");
    } finally { setBusy(null); }
  };

  const test = async (spec: WhatsAppMessageSpec) => {
    const row = rows[spec.key];
    if (row.id !== row.savedId || row.photo !== row.savedPhoto) await save(spec, row.enabled);
    setBusy(`test:${spec.key}`);
    try {
      const r: any = (await httpsCallable(getFunctions(), "testWhatsAppTemplate")({ usecaseKey: spec.key, variables: spec.sample })).data;
      const ok = r?.status === "sent";
      setResults((x) => ({ ...x, [spec.key]: { ok, text: ok ? `Sent to …${String(r.phone).slice(-4)} — check the phone and Authkey's report` : r?.response || "Not sent" } }));
    } catch (e: any) {
      setResults((x) => ({ ...x, [spec.key]: { ok: false, text: e?.message || "Test failed" } }));
    } finally { setBusy(null); }
  };

  const groups = useMemo(() => [...new Set(WHATSAPP_MESSAGES.map((m) => m.group))], []);
  const onCount = Object.values(rows).filter((r) => r.enabled).length;

  return (
    <AdminLayout>
      <Authenticated>
        <div className="mx-auto max-w-5xl space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="flex items-center gap-2 text-3xl font-extrabold"><MessageSquareIcon className="size-7" /> WhatsApp messages</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Paste each template's ID from Authkey (Templates list, first column), tick <b>Photo</b> if it shows "Media" there, switch it on, press Test.
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="rounded-full border-2 border-ink bg-[#ffd166] px-3 py-1 font-bold">{onCount} of {WHATSAPP_MESSAGES.length} on</span>
              <Link to="/backend-skinly/whatsapp/messages" className="font-semibold underline">Message log</Link>
            </div>
          </div>

          <div className="rounded-2xl border-2 border-ink bg-card p-4 shadow-[3px_3px_0_0_var(--ink)]">
            <h2 className="text-base font-extrabold">Sending through</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              The template IDs below belong to this provider — switching means pasting that provider's IDs.
              Fast2SMS: Phone Number ID is on its WhatsApp dashboard; the API key goes in functions/.env as FAST2SMS_API_KEY.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <select value={provider} onChange={(e) => setProvider(e.target.value as any)} className="h-9 rounded-md border bg-background px-3 text-sm">
                <option value="fast2sms">Fast2SMS</option>
                <option value="authkey">Authkey</option>
              </select>
              {provider === "fast2sms" && (
                <Input value={phoneNumberId} onChange={(e) => setPhoneNumberId(e.target.value.replace(/\D/g, ""))} placeholder="WABA Phone Number ID" className="w-64" inputMode="numeric" />
              )}
              {(provider !== savedProvider.provider || phoneNumberId !== savedProvider.phoneNumberId) && (
                <Button size="sm" onClick={async () => {
                  if (provider === "fast2sms" && !phoneNumberId) { toast.error("Add the Phone Number ID"); return; }
                  await setDoc(doc(db, "whatsappSettings", "provider"), { provider, phoneNumberId, updatedAt: Date.now() }, { merge: true });
                  setSavedProvider({ provider, phoneNumberId });
                  toast.success(`Sending through ${provider === "fast2sms" ? "Fast2SMS" : "Authkey"}`);
                  window.location.reload();
                }}>Save</Button>
              )}
              {provider === "fast2sms" && (
                <Button size="sm" variant="outline" disabled={f2sLoading} onClick={async () => {
                  setF2sLoading(true);
                  try {
                    const r: any = (await httpsCallable(getFunctions(), "fast2smsAccount")({})).data;
                    setF2s(r);
                  } catch (e: any) { toast.error(e?.message || "Could not reach Fast2SMS"); }
                  finally { setF2sLoading(false); }
                }}>{f2sLoading ? "Checking…" : "Check Fast2SMS"}</Button>
              )}
              {provider === "fast2sms" && (
                <Button size="sm" variant="outline" disabled={f2sLoading} onClick={async () => {
                  setF2sLoading(true);
                  try {
                    const r: any = (await httpsCallable(getFunctions(), "fast2smsLogs")({})).data;
                    setF2sLog(r.rows || []);
                  } catch (e: any) { toast.error(e?.message || "Could not reach Fast2SMS"); }
                  finally { setF2sLoading(false); }
                }}>Delivery log</Button>
              )}
            </div>
            {f2sLog && (
              <div className="mt-3 overflow-x-auto text-xs">
                <p className="mb-1 text-muted-foreground">Fast2SMS reports, last 3 days, newest first. "accepted"/"sent" is not "delivered"; a failed one shows Meta's reason.</p>
                <table className="w-full">
                  <thead className="text-left text-muted-foreground"><tr><th className="p-1">Time</th><th className="p-1">To</th><th className="p-1">Status</th><th className="p-1">Error</th></tr></thead>
                  <tbody>
                    {f2sLog.map((r, i) => (
                      <tr key={i} className="border-t align-top">
                        <td className="whitespace-nowrap p-1">{r.at ? new Date(r.at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "—"}</td>
                        <td className="p-1">{r.to}</td>
                        <td className={`p-1 font-semibold ${r.status === "failed" ? "text-destructive" : ""}`}>{r.status}</td>
                        <td className="break-all p-1 text-destructive">{r.error}</td>
                      </tr>
                    ))}
                    {!f2sLog.length && <tr><td colSpan={4} className="p-2 text-muted-foreground">No reports in the last 3 days.</td></tr>}
                  </tbody>
                </table>
              </div>
            )}
            {f2s && (
              <div className="mt-3 space-y-3 text-sm">
                {f2s.numbers.map((n: any) => (
                  <div key={n.phoneNumberId} className="rounded-lg bg-muted/50 p-2">
                    <b>{n.number}</b> · {n.verifiedName || "—"} · name <b>{n.nameStatus || "—"}</b> · {n.connection} · quality {n.quality} · {n.limit}
                    <div className="text-xs text-muted-foreground">
                      Phone Number ID: <code>{n.phoneNumberId}</code>{" "}
                      {n.phoneNumberId !== phoneNumberId && <button type="button" className="underline" onClick={() => setPhoneNumberId(n.phoneNumberId)}>use this</button>}
                    </div>
                  </div>
                ))}
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="text-left text-muted-foreground"><tr><th className="p-1">Message ID</th><th className="p-1">Template</th><th className="p-1">Status</th><th className="p-1">Category</th><th className="p-1">Vars</th><th className="p-1">Photo</th><th className="p-1">Button</th></tr></thead>
                    <tbody>
                      {f2s.templates.map((t: any) => (
                        <tr key={t.messageId} className="border-t">
                          <td className="p-1 font-mono font-bold">{t.messageId}</td><td className="p-1">{t.name}</td><td className="p-1">{t.status}</td>
                          <td className="p-1">{t.category}</td><td className="p-1">{t.varCount}</td><td className="p-1">{t.hasImage ? "yes" : ""}</td><td className="p-1">{t.dynamicButton ? "dynamic" : ""}</td>
                        </tr>
                      ))}
                      {!f2s.templates.length && <tr><td colSpan={7} className="p-2 text-muted-foreground">No templates yet.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          <AdminNotifications />

          {!loaded ? (
            <div className="flex items-center gap-2 text-muted-foreground"><LoaderIcon className="size-4 animate-spin" /> Loading…</div>
          ) : groups.map((g) => (
            <section key={g} className="space-y-3">
              <h2 className="text-sm font-extrabold uppercase tracking-wide text-muted-foreground">{g}</h2>
              {WHATSAPP_MESSAGES.filter((m) => m.group === g).map((spec) => {
                const row = rows[spec.key];
                const res = results[spec.key];
                const dirty = row.id !== row.savedId || row.photo !== row.savedPhoto;
                return (
                  <div key={spec.key} className="rounded-2xl border-2 border-ink bg-card p-4 shadow-[3px_3px_0_0_var(--ink)]">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-extrabold">{spec.label}</h3>
                          {row.enabled && row.savedId && <span className="inline-flex items-center gap-1 rounded-full bg-[#28a58b] px-2 py-0.5 text-xs font-bold text-ink"><CheckCircle2Icon className="size-3" /> Live</span>}
                        </div>
                        <p className="mt-0.5 text-sm text-muted-foreground">{spec.when}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Variables: {spec.vars.map((v, i) => <code key={v} className="mr-1 rounded bg-muted px-1">{`{{${i + 1}}}`} {v}</code>)}
                        </p>
                      </div>
                      <label className="flex items-center gap-2 text-sm font-semibold">
                        <Switch checked={row.enabled} disabled={!!busy} onCheckedChange={(v) => void save(spec, v)} />
                        {row.enabled ? "On" : "Off"}
                      </label>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Input value={row.id} onChange={(e) => patch(spec.key, { id: e.target.value.replace(/\D/g, "") })} placeholder="Template ID, e.g. 50314" inputMode="numeric" className="w-44" />
                      <button
                        type="button"
                        onClick={() => patch(spec.key, { photo: !row.photo })}
                        className={`inline-flex h-9 items-center gap-1.5 rounded-md border-2 px-3 text-sm font-semibold ${row.photo ? "border-ink bg-[#f7b9cd]" : "border-muted bg-background text-muted-foreground"}`}
                        title="Was the template created with an image header? Authkey's list shows 'Media' for those."
                      >
                        {row.photo ? <ImageIcon className="size-4" /> : <TypeIcon className="size-4" />}{row.photo ? "Photo header" : "Text only"}
                      </button>
                      {dirty && <Button size="sm" onClick={() => void save(spec, row.enabled)} disabled={!!busy}>{busy === `save:${spec.key}` && <LoaderIcon className="mr-1 size-4 animate-spin" />}Save</Button>}
                      <Button size="sm" variant="outline" onClick={() => void test(spec)} disabled={!!busy || !row.id}>
                        {busy === `test:${spec.key}` ? <LoaderIcon className="mr-1 size-4 animate-spin" /> : <SendIcon className="mr-1 size-4" />}Test to admin number
                      </Button>
                    </div>
                    {res && <p className={`mt-2 break-all text-xs font-semibold ${res.ok ? "text-[#1b7462]" : "text-destructive"}`}>{res.text}</p>}
                  </div>
                );
              })}
            </section>
          ))}
        </div>
      </Authenticated>
    </AdminLayout>
  );
}
