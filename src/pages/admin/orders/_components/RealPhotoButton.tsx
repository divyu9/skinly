import { useEffect, useRef, useState } from "react";
import { addDoc, collection, deleteDoc, doc, getDoc, onSnapshot, query, where } from "firebase/firestore";
import { CameraIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { db } from "@/lib/firebase";
import { useAction } from "@/lib/firebase-hooks";
import { api } from "@/lib/firebase-api";
import { Button } from "@/components/ui/button.tsx";
import { cutFor, designCodeOf, type RealPhoto } from "@/lib/real-photos";

/**
 * "Real photo" beside one order line: taken at the packing table, on the
 * phone's camera, and filed with the design and the phone it was cut for
 * straight from the line — nothing to type (src/lib/real-photos.ts).
 */
export function RealPhotoButton({ item, orderNumber, slug }: {
  item: { productId: string; productTitle: string; sku?: string; phoneBrand?: string; phoneModel?: string };
  orderNumber?: string;
  slug?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [photos, setPhotos] = useState<RealPhoto[]>([]);
  const upload = useAction(api.mediaLibrary.uploadAndAddToLibrary);

  useEffect(() => {
    if (!orderNumber) return;
    return onSnapshot(
      query(collection(db, "realPhotos"), where("orderNumber", "==", orderNumber)),
      (s) => setPhotos(s.docs.map((d) => ({ _id: d.id, ...d.data() } as RealPhoto)).filter((p) => p.productId === item.productId)),
      () => setPhotos([]),
    );
  }, [orderNumber, item.productId]);

  const take = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    try {
      const product = (await getDoc(doc(db, "products", item.productId))).data() as any;
      if (!product && !slug) throw new Error("This product no longer exists, so the photo would lead nowhere");
      for (const file of Array.from(files)) {
        const base64 = await new Promise<string>((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(String(r.result).split(",")[1] || "");
          r.onerror = () => reject(new Error(`Could not read ${file.name}`));
          r.readAsDataURL(file);
        });
        const up: any = await upload({
          fileBase64: base64, filename: `${designCodeOf(item.sku)}-${item.phoneModel || "photo"}.jpg`,
          folder: "real-photos", contentType: file.type || "image/jpeg", mediaType: "image",
        });
        const url = up?.url || up?.publicUrl;
        if (!url) throw new Error(up?.error || "Upload failed");
        await addDoc(collection(db, "realPhotos"), {
          imageUrl: url,
          designCode: designCodeOf(item.sku),
          gadget: String(product?.gadgetCategory || ""),
          productId: item.productId,
          productSlug: product?.slug || slug || "",
          productTitle: product?.title || item.productTitle,
          brand: item.phoneBrand || "",
          model: item.phoneModel || "",
          ...(orderNumber ? { orderNumber } : {}),
          createdAt: Date.now(),
          featured: false,
          hidden: false,
        });
      }
      toast.success(files.length > 1 ? `${files.length} photos added` : "Photo added — it's on the homepage and the product page");
    } catch (e: any) {
      toast.error(e?.message || "Could not add the photo");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  const remove = async (p: RealPhoto) => {
    if (!confirm("Remove this photo from the shop?")) return;
    try { await deleteDoc(doc(db, "realPhotos", p._id)); } catch (e: any) { toast.error(e?.message || "Could not remove"); }
  };

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <input ref={input} type="file" accept="image/*" capture="environment" multiple className="hidden"
        onChange={(e) => void take(e.target.files)} />
      <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => input.current?.click()}
        title={`${cutFor({ brand: item.phoneBrand || "", model: item.phoneModel || "" })} — shown on the shop`}>
        <CameraIcon className="mr-1.5 size-4" /> {busy ? "Uploading…" : photos.length ? "Add another photo" : "Real photo"}
      </Button>
      {photos.map((p) => (
        <div key={p._id} className="relative">
          <img src={p.imageUrl} alt="" className="size-10 rounded-md border object-cover" />
          <button type="button" onClick={() => void remove(p)} aria-label="Remove photo"
            className="absolute -right-1.5 -top-1.5 grid size-4 place-items-center rounded-full bg-destructive text-white">
            <XIcon className="size-3" />
          </button>
        </div>
      ))}
    </div>
  );
}
