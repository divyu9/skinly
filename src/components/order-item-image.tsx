import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { PackageIcon } from "lucide-react";

/**
 * An order line's picture, as the customer saw it when ordering.
 *
 * The line keeps the picture it was ordered from — often the mockup for the
 * chosen phone. For the iPhones whose mockups were lost with the old image
 * host that file no longer exists, and the order page showed a broken image.
 * When it fails, this shows the listing's own main picture instead (what the
 * product card showed), and only then an empty box.
 */
export function OrderItemImage({ src, productId, alt, className }: { src?: string; productId?: string; alt: string; className?: string }) {
  const [url, setUrl] = useState<string | undefined>(src);
  const [triedProduct, setTriedProduct] = useState(false);
  useEffect(() => { setUrl(src); setTriedProduct(false); }, [src]);

  const fallBack = async () => {
    if (triedProduct || !productId) { setUrl(undefined); return; }
    setTriedProduct(true);
    try {
      const p: any = (await getDoc(doc(db, "products", productId))).data();
      const first = (p?.images || []).map((i: any) => (typeof i === "string" ? i : i?.url)).find(Boolean);
      setUrl(first && first !== url ? first : undefined);
    } catch { setUrl(undefined); }
  };

  if (!url) return <div className={`grid place-items-center text-muted-foreground ${className || ""}`}><PackageIcon className="size-6" /></div>;
  return <img src={url} alt={alt} onError={() => void fallBack()} className={className} />;
}
