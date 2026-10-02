import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { addDoc, collection, doc, getDocs, query, setDoc, where } from "firebase/firestore";
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

  useEffect(() => {
    (async () => {
      const [uc, tpl] = await Promise.all([getDocs(collection(db, "whatsappUsecases")), getDocs(collection(db, "whatsappTemplates"))]);
      const photoOf = new Map(tpl.docs.map((d) => [String(d.data().providerTemplateId || ""), d.data().headerType === "image"]));
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
        const t = await getDocs(query(collection(db, "whatsappTemplates"), where("providerTemplateId", "==", id)));
        const data = { providerTemplateId: id, name: spec.key, variables: spec.vars, headerType: row.photo ? "image" : "none", status: "approved", updatedAt: Date.now() };
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
