import { useState } from "react";
import { toast } from "sonner";
import {
  collection,
  deleteField,
  doc,
  getDocs,
  query,
  where,
  writeBatch,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { isDeadImageUrl } from "@/lib/image-fallback.ts";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { RefreshCwIcon, SearchIcon, Trash2Icon } from "lucide-react";

/**
 * Removes every link to the deleted Cloudinary account in one go.
 *
 * The photos are being remade in the AI studio, so the dead URLs only get in
 * the way: products carry them as their "photos", mockup rows point at files
 * that 401, and a few homepage cards and category tiles still reference them.
 *
 * - products: dead entries are dropped from `images`; live ones are kept.
 * - mockups: rows with an r2Key lose only the dead `cloudinaryUrl`; rows with
 *   nothing else to show are deleted (the storefront already ignores them).
 * - mediaLibrary: entries whose file is on Cloudinary are deleted.
 * - homepage cards, category config, product sections: the dead field is
 *   removed, so components fall back to their no-image state.
 *
 * Before anything is written the tool downloads a JSON backup of every
 * document it is about to change, so a mistake can be put back.
 */

type Change =
  | { kind: "images"; path: string; before: DocumentData; images: unknown[] }
  | { kind: "delete"; path: string; before: DocumentData }
  | { kind: "fields"; path: string; before: DocumentData; fields: string[] };

interface Plan {
  changes: Change[];
  summary: { label: string; docs: number; urls: number; action: string }[];
}

const SMALL_COLLECTIONS: { name: string; label: string }[] = [
  { name: "homepageSectionCards", label: "Homepage cards" },
  { name: "productCategoriesConfig", label: "Category config" },
  { name: "productSectionContent", label: "Product sections" },
  { name: "heroSlides", label: "Hero slides" },
  { name: "featureBanners", label: "Feature banners" },
  { name: "collections", label: "Collections" },
  { name: "gadgetTypes", label: "Gadget types" },
];

const CLOUDINARY_PREFIXES = ["https://res.cloudinary.com/", "http://res.cloudinary.com/"];
const BATCH_SIZE = 400;

/** Mockup rows whose cloudinaryUrl is on Cloudinary, without reading all 115k rows. */
async function deadMockups() {
  const out: QueryDocumentSnapshot[] = [];
  for (const prefix of CLOUDINARY_PREFIXES) {
    const snap = await getDocs(
      query(
        collection(db, "mockups"),
        where("cloudinaryUrl", ">=", prefix),
        where("cloudinaryUrl", "<", prefix.slice(0, -1) + "0")
      )
    );
    out.push(...snap.docs);
  }
  return out;
}

async function buildPlan(): Promise<Plan> {
  const changes: Change[] = [];
  const summary: Plan["summary"] = [];

  // Products
  const products = await getDocs(collection(db, "products"));
  let productDocs = 0;
  let productUrls = 0;
  for (const d of products.docs) {
    const data = d.data();
    const images = Array.isArray(data.images) ? data.images : [];
    const kept = images.filter((i: any) => !isDeadImageUrl(i?.url));
    if (kept.length === images.length) continue;
    productDocs++;
    productUrls += images.length - kept.length;
    changes.push({ kind: "images", path: d.ref.path, before: data, images: kept });
  }
  summary.push({ label: "Products", docs: productDocs, urls: productUrls, action: "dead photos removed" });

  // Mockups
  const mockups = await deadMockups();
  let mockupDeletes = 0;
  for (const d of mockups) {
    const data = d.data();
    if (data.r2Key) {
      changes.push({ kind: "fields", path: d.ref.path, before: data, fields: ["cloudinaryUrl"] });
    } else {
      mockupDeletes++;
      changes.push({ kind: "delete", path: d.ref.path, before: data });
    }
  }
  summary.push({
    label: "Mockups",
    docs: mockups.length,
    urls: mockups.length,
    action: `${mockupDeletes.toLocaleString()} rows deleted, ${(mockups.length - mockupDeletes).toLocaleString()} link cleared`,
  });

  // Media library
  const media = await getDocs(collection(db, "mediaLibrary"));
  const deadMedia = media.docs.filter((d) => isDeadImageUrl(d.data().cloudinaryUrl) || isDeadImageUrl(d.data().url));
  for (const d of deadMedia) changes.push({ kind: "delete", path: d.ref.path, before: d.data() });
  summary.push({ label: "Media library", docs: deadMedia.length, urls: deadMedia.length, action: "entries deleted" });

  // Small config collections: drop any top-level field holding a dead URL.
  for (const { name, label } of SMALL_COLLECTIONS) {
    const snap = await getDocs(collection(db, name));
    let docs = 0;
    let urls = 0;
    for (const d of snap.docs) {
      const data = d.data();
      const fields = Object.keys(data).filter((k) => typeof data[k] === "string" && isDeadImageUrl(data[k]));
      if (!fields.length) continue;
      docs++;
      urls += fields.length;
      changes.push({ kind: "fields", path: d.ref.path, before: data, fields });
    }
    if (docs) summary.push({ label, docs, urls, action: "image field cleared" });
  }

  return { changes, summary };
}

function downloadBackup(plan: Plan) {
  const body = JSON.stringify(
    { createdAt: new Date().toISOString(), documents: plan.changes.map((c) => ({ path: c.path, kind: c.kind, before: c.before })) },
    null,
    1
  );
  const url = URL.createObjectURL(new Blob([body], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `cloudinary-cleanup-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function CloudinaryCleanup({ onDone }: { onDone?: () => void }) {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [finished, setFinished] = useState(false);

  const scan = async () => {
    setScanning(true);
    setFinished(false);
    try {
      setPlan(await buildPlan());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Scan failed");
    } finally {
      setScanning(false);
    }
  };

  const run = async () => {
    if (!plan || !plan.changes.length) return;
    const total = plan.changes.length;
    if (!window.confirm(`Remove Cloudinary links from ${total.toLocaleString()} documents? A backup file downloads first.`)) return;
    downloadBackup(plan);
    setProgress({ done: 0, total });
    try {
      for (let i = 0; i < total; i += BATCH_SIZE) {
        const batch = writeBatch(db);
        for (const c of plan.changes.slice(i, i + BATCH_SIZE)) {
          const ref = doc(db, c.path);
          if (c.kind === "delete") batch.delete(ref);
          else if (c.kind === "images") batch.update(ref, { images: c.images });
          else batch.update(ref, Object.fromEntries(c.fields.map((f) => [f, deleteField()])));
        }
        await batch.commit();
        setProgress({ done: Math.min(i + BATCH_SIZE, total), total });
      }
      toast.success("Cloudinary links removed");
      setFinished(true);
      setPlan(null);
      onDone?.();
    } catch (err) {
      toast.error(err instanceof Error ? `Stopped: ${err.message}` : "Stopped");
    } finally {
      setProgress(null);
    }
  };

  const busy = scanning || !!progress;

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-medium">Remove all Cloudinary links</p>
            <p className="text-sm text-muted-foreground">
              Clears every link to the deleted Cloudinary account so the photos can be remade. Downloads a backup first.
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={busy} onClick={scan}>
              {scanning ? <RefreshCwIcon className="mr-1.5 size-3.5 animate-spin" /> : <SearchIcon className="mr-1.5 size-3.5" />}
              {scanning ? "Scanning" : "Scan"}
            </Button>
            <Button size="sm" variant="destructive" disabled={busy || !plan?.changes.length} onClick={run}>
              <Trash2Icon className="mr-1.5 size-3.5" />
              {progress ? `Removing ${progress.done.toLocaleString()} / ${progress.total.toLocaleString()}` : "Back up and remove"}
            </Button>
          </div>
        </div>

        {plan && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="py-1 pr-4 font-medium">Where</th>
                  <th className="py-1 pr-4 text-right font-medium">Documents</th>
                  <th className="py-1 pr-4 text-right font-medium">Links</th>
                  <th className="py-1 font-medium">What happens</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {plan.summary.map((s) => (
                  <tr key={s.label} className="border-t">
                    <td className="py-1.5 pr-4">{s.label}</td>
                    <td className="py-1.5 pr-4 text-right">{s.docs.toLocaleString()}</td>
                    <td className="py-1.5 pr-4 text-right">{s.urls.toLocaleString()}</td>
                    <td className="py-1.5 text-muted-foreground">{s.action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!plan.changes.length && <p className="mt-2 text-sm text-emerald-600">No Cloudinary links left.</p>}
          </div>
        )}
        {finished && <p className="text-sm text-emerald-600">Done. Products without a photo are listed below.</p>}
      </CardContent>
    </Card>
  );
}
