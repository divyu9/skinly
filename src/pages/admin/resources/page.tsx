import { useEffect, useRef, useState } from "react";
import { addDoc, collection, deleteDoc, doc, getDocs, orderBy, query } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db } from "@/lib/firebase-db";
import { functions } from "@/lib/firebase";
import { AdminLayout } from "@/components/admin-layout.tsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { toast } from "sonner";
import { DownloadIcon, FileTextIcon, Loader2Icon, Trash2Icon, UploadIcon, PrinterIcon } from "lucide-react";

/**
 * Resources: files the team downloads and prints — the QR-code scan guide
 * and the SSD installation guide that go into parcels (owner, 11 Nov 2026).
 *
 * The two guides ship with the site (public/resources/), so they are there
 * from the first deploy. Anything added later is uploaded here to R2
 * (resources/ folder) and listed from Firestore `adminResources`.
 */

type Resource = { id?: string; title: string; fileName: string; url: string; size?: number; r2Key?: string; createdAt?: number; builtIn?: boolean };

const BUILT_IN: Resource[] = [
  { title: "QR code scan guide", fileName: "qr-code-scan-guide.pdf", url: "/resources/qr-code-scan-guide.pdf", size: 725421, builtIn: true },
  { title: "SSD installation guide", fileName: "ssd-installation-guide.pdf", url: "/resources/ssd-installation-guide.pdf", size: 831694, builtIn: true },
];

const ACCEPT = "application/pdf,image/png,image/jpeg,image/webp";
const MAX_MB = 25;

const fmtSize = (b?: number) => (!b ? "" : b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`);
const safeName = (n: string) => n.replace(/[^a-zA-Z0-9_\-.() ]+/g, "-").replace(/\s+/g, "-").replace(/-+/g, "-");

export default function AdminResourcesPage() {
  const [items, setItems] = useState<Resource[] | null>(null);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const load = async () => {
    try {
      const snap = await getDocs(query(collection(db, "adminResources"), orderBy("createdAt", "desc")));
      setItems(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Resource) })));
    } catch (e: any) {
      console.error("[resources] list failed", e);
      setItems([]);
    }
  };
  useEffect(() => { void load(); }, []);

  const upload = async () => {
    if (!file) return;
    if (file.size > MAX_MB * 1048576) { toast.error(`Files up to ${MAX_MB} MB`); return; }
    setBusy(true);
    try {
      const key = `resources/${Date.now()}-${safeName(file.name)}`;
      const res: any = (await httpsCallable(functions, "generateUploadUrl")({ fileName: key, contentType: file.type })).data;
      const put = await fetch(res.uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      if (!put.ok) throw new Error(`Upload failed (${put.status})`);
      await addDoc(collection(db, "adminResources"), {
        title: title.trim() || file.name.replace(/\.[^.]+$/, ""),
        fileName: file.name, url: res.publicUrl, size: file.size, r2Key: key, contentType: file.type, createdAt: Date.now(),
      });
      toast.success("Uploaded");
      setTitle(""); setFile(null); if (input.current) input.current.value = "";
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (r: Resource) => {
    if (!r.id || !window.confirm(`Delete "${r.title}"? This cannot be undone.`)) return;
    try {
      if (r.r2Key) await httpsCallable(functions, "deleteR2Object")({ key: r.r2Key }).catch(() => null);
      await deleteDoc(doc(db, "adminResources", r.id));
      toast.success("Deleted");
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Could not delete");
    }
  };

  const all = [...BUILT_IN, ...(items || [])];

  return (
    <AdminLayout>
      <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-6">
        <div>
          <h1 className="text-2xl font-bold">Resources</h1>
          <p className="text-sm text-muted-foreground">Printable guides and files for packing. Download, print, put in the parcel.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Files</CardTitle>
            <CardDescription>{all.length} file{all.length === 1 ? "" : "s"}</CardDescription>
          </CardHeader>
          <CardContent className="divide-y">
            {all.map((r) => (
              <div key={r.id || r.url} className="flex flex-wrap items-center gap-3 py-3">
                <FileTextIcon className="size-8 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{r.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {r.fileName}{r.size ? ` · ${fmtSize(r.size)}` : ""}{r.createdAt ? ` · added ${new Date(r.createdAt).toLocaleDateString("en-IN")}` : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button asChild variant="outline" size="sm">
                    <a href={r.url} target="_blank" rel="noopener noreferrer"><PrinterIcon className="mr-1 size-4" />Open</a>
                  </Button>
                  <Button asChild size="sm">
                    <a href={r.url} download={r.fileName}><DownloadIcon className="mr-1 size-4" />Download</a>
                  </Button>
                  {!r.builtIn && (
                    <Button variant="ghost" size="sm" onClick={() => remove(r)} aria-label={`Delete ${r.title}`}>
                      <Trash2Icon className="size-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
            {items === null && <p className="py-3 text-sm text-muted-foreground"><Loader2Icon className="mr-1 inline size-4 animate-spin" />Loading uploaded files…</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Add a file</CardTitle>
            <CardDescription>PDF or image, up to {MAX_MB} MB.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input placeholder="Title (e.g. MacBook skin application guide)" value={title} onChange={(e) => setTitle(e.target.value)} />
            <Input ref={input} type="file" accept={ACCEPT} onChange={(e) => setFile(e.target.files?.[0] || null)} />
            <Button onClick={upload} disabled={!file || busy}>
              {busy ? <Loader2Icon className="mr-1 size-4 animate-spin" /> : <UploadIcon className="mr-1 size-4" />}Upload
            </Button>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
