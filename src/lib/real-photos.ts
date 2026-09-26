import { useEffect, useState } from "react";
import { collection, getDocs, limit, orderBy, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";

/**
 * Photos of real skins, taken while packing orders.
 *
 * Each is taken from an order line in the admin (a button beside every item),
 * so it knows by itself which design it is and which phone it was cut for —
 * no caption is typed. The shop shows them on the homepage ("Real cuts") and
 * in the gallery of every listing of the same design for the same gadget.
 *
 * realPhotos/{id}: public read, admin write. Nothing about the customer is
 * kept — the order number only, which opens nothing without their contact.
 */
export type RealPhoto = {
  _id: string;
  imageUrl: string;
  /** The design, as mockups are filed: R-44, never R-44-IPH. */
  designCode: string;
  /** The product's gadget ("phone", "laptop"…), so a phone photo stays off laptop listings. */
  gadget: string;
  productId: string;
  productSlug: string;
  productTitle: string;
  brand: string;
  model: string;
  orderNumber?: string;
  createdAt: number;
  featured?: boolean;
  hidden?: boolean;
};

/** R-44-IPH → R-44: listing SKUs carry the brand after the design. */
export const designCodeOf = (sku: unknown) =>
  String(sku || "").trim().toUpperCase().replace(/^([A-Z]+-\d+)-[A-Z0-9]+$/, "$1");

/** "Cut for iPhone 13 Pro", or "Cut for Samsung" when only the brand is known. */
export const cutFor = (p: Pick<RealPhoto, "brand" | "model">) =>
  p.model ? `Cut for ${p.model}` : p.brand ? `Cut for ${p.brand}` : "Real photo";

/** Where a photo leads: its listing, with the phone it was cut for already chosen. */
export const photoLink = (p: RealPhoto) => {
  const q = new URLSearchParams();
  if (p.brand) q.set("brand", p.brand);
  if (p.model) q.set("model", p.model);
  const s = q.toString();
  return `/products/${p.productSlug}${s ? `?${s}` : ""}`;
};

/** The newest visible photos, featured first. */
export function useLatestRealPhotos(max = 20): RealPhoto[] | undefined {
  const [photos, setPhotos] = useState<RealPhoto[] | undefined>(undefined);
  useEffect(() => {
    let live = true;
    getDocs(query(collection(db, "realPhotos"), orderBy("createdAt", "desc"), limit(max * 3)))
      .then((s) => {
        const rows = s.docs.map((d) => ({ _id: d.id, ...d.data() } as RealPhoto)).filter((p) => !p.hidden && p.imageUrl);
        rows.sort((a, b) => Number(!!b.featured) - Number(!!a.featured) || b.createdAt - a.createdAt);
        if (live) setPhotos(rows.slice(0, max));
      })
      .catch(() => { if (live) setPhotos([]); });
    return () => { live = false; };
  }, [max]);
  return photos;
}

/** Visible photos of one design on one gadget. */
export function useDesignRealPhotos(designCode: string | null | undefined, gadget: string | null | undefined): RealPhoto[] {
  const [photos, setPhotos] = useState<RealPhoto[]>([]);
  useEffect(() => {
    if (!designCode) { setPhotos([]); return; }
    let live = true;
    getDocs(query(collection(db, "realPhotos"), where("designCode", "==", designCode), limit(30)))
      .then((s) => {
        const rows = s.docs.map((d) => ({ _id: d.id, ...d.data() } as RealPhoto))
          .filter((p) => !p.hidden && p.imageUrl && (!gadget || !p.gadget || p.gadget === gadget))
          .sort((a, b) => Number(!!b.featured) - Number(!!a.featured) || b.createdAt - a.createdAt);
        if (live) setPhotos(rows);
      })
      .catch(() => { if (live) setPhotos([]); });
    return () => { live = false; };
  }, [designCode, gadget]);
  return photos;
}

/*
 * How many visible photos each design has, per gadget ("R-44|phone" → 3), for
 * the chip on product cards. One read shared by every card on the page, and
 * by every page after it until a reload.
 */
let countsLoad: Promise<Map<string, number>> | null = null;
function loadCounts() {
  countsLoad ??= getDocs(query(collection(db, "realPhotos"), limit(1000)))
    .then((s) => {
      const m = new Map<string, number>();
      s.docs.forEach((d) => {
        const p = d.data() as RealPhoto;
        if (p.hidden || !p.imageUrl || !p.designCode) return;
        const k = `${p.designCode}|${p.gadget || ""}`;
        m.set(k, (m.get(k) || 0) + 1);
      });
      return m;
    })
    .catch(() => new Map<string, number>());
  return countsLoad;
}

export function useRealPhotoCount(sku: unknown, gadget: string | null | undefined): number {
  const [n, setN] = useState(0);
  const code = designCodeOf(sku);
  useEffect(() => {
    if (!code) return;
    let live = true;
    loadCounts().then((m) => {
      if (!live) return;
      // A photo filed without a gadget counts everywhere, as on the product page.
      setN((m.get(`${code}|${gadget || ""}`) || 0) + (gadget ? m.get(`${code}|`) || 0 : 0));
    });
    return () => { live = false; };
  }, [code, gadget]);
  return n;
}
