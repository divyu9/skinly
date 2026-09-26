import { useEffect, useState } from "react";
import { collection, deleteDoc, doc, onSnapshot, orderBy, query, updateDoc } from "firebase/firestore";
import { EyeIcon, EyeOffIcon, StarIcon, Trash2Icon, ExternalLinkIcon } from "lucide-react";
import { toast } from "sonner";
import { db } from "@/lib/firebase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { cutFor, photoLink, type RealPhoto } from "@/lib/real-photos";

/**
 * Admin › Homepage › Real photos: every packing photo taken from an order
 * (the camera button beside each order line). All show on the shop by
 * default, newest first; star one to lead the homepage row, hide one to keep
 * it off the shop, or delete it.
 */
export function RealPhotosTab() {
  const [photos, setPhotos] = useState<RealPhoto[] | null>(null);

  useEffect(() => onSnapshot(
    query(collection(db, "realPhotos"), orderBy("createdAt", "desc")),
    (s) => setPhotos(s.docs.map((d) => ({ _id: d.id, ...d.data() } as RealPhoto))),
    (e) => { toast.error(e.message); setPhotos([]); },
  ), []);

  const patch = async (p: RealPhoto, data: Partial<RealPhoto>) => {
    try { await updateDoc(doc(db, "realPhotos", p._id), data); } catch (e: any) { toast.error(e?.message || "Could not save"); }
  };
  const remove = async (p: RealPhoto) => {
    if (!confirm("Delete this photo? It leaves the homepage and the product page.")) return;
    try { await deleteDoc(doc(db, "realPhotos", p._id)); } catch (e: any) { toast.error(e?.message || "Could not delete"); }
  };

  const shown = photos?.filter((p) => !p.hidden).length ?? 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Real photos</CardTitle>
        <CardDescription>
          Photos taken while packing — add them from an order with the <b>Real photo</b> button beside each item.
          Each shows in the homepage "Fresh off the cutter" row and in the gallery of every listing of that design.
          Starred ones lead the homepage row. {photos && <span>{shown} on the shop, {photos.length - shown} hidden.</span>}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {photos === null ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : photos.length === 0 ? (
          <p className="text-sm text-muted-foreground">No photos yet. Open an order and tap <b>Real photo</b> beside an item.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {photos.map((p) => (
              <div key={p._id} className={`overflow-hidden rounded-xl border ${p.hidden ? "opacity-50" : ""}`}>
                <div className="relative aspect-[4/5] bg-muted">
                  <img src={p.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                  {p.featured && (
                    <span className="absolute left-1.5 top-1.5 rounded-full bg-sunny px-2 py-0.5 text-[10px] font-bold">Starred</span>
                  )}
                  {p.hidden && (
                    <span className="absolute right-1.5 top-1.5 rounded-full bg-background/90 px-2 py-0.5 text-[10px] font-bold">Hidden</span>
                  )}
                </div>
                <div className="space-y-1 p-2">
                  <p className="text-xs font-bold">{cutFor(p)}</p>
                  <p className="line-clamp-1 text-[11px] text-muted-foreground">{p.productTitle}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {p.orderNumber ? `#${p.orderNumber} · ` : ""}{new Date(p.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                  </p>
                  <div className="flex gap-1 pt-1">
                    <Button size="icon" variant={p.featured ? "default" : "outline"} className="size-7" title={p.featured ? "Unstar" : "Star — lead the homepage row"}
                      onClick={() => void patch(p, { featured: !p.featured })}>
                      <StarIcon className="size-3.5" />
                    </Button>
                    <Button size="icon" variant="outline" className="size-7" title={p.hidden ? "Show on the shop" : "Hide from the shop"}
                      onClick={() => void patch(p, { hidden: !p.hidden })}>
                      {p.hidden ? <EyeIcon className="size-3.5" /> : <EyeOffIcon className="size-3.5" />}
                    </Button>
                    <Button size="icon" variant="outline" className="size-7" title="Open the listing" asChild>
                      <a href={photoLink(p)} target="_blank" rel="noreferrer"><ExternalLinkIcon className="size-3.5" /></a>
                    </Button>
                    <Button size="icon" variant="outline" className="ml-auto size-7 text-destructive" title="Delete"
                      onClick={() => void remove(p)}>
                      <Trash2Icon className="size-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
