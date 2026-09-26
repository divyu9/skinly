import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EditIcon, ExternalLinkIcon, ImageOffIcon, TrashIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { RealPhotoButton } from "./RealPhotoButton.tsx";

export interface OrderItem {
  productId: string;
  productTitle: string;
  productImage?: string;
  variant: string;
  price: number;
  quantity: number;
  phoneModel?: string;
  phoneBrand?: string;
  coverage?: "only_back" | "full_body_wrap";
  sku?: string;
  slug?: string;
}

export interface ItemFormEntry {
  productId: string;
  productTitle: string;
  productImage?: string;
  variant: string;
  price: number;
  quantity: number;
  phoneModel?: string;
  phoneBrand?: string;
  coverage?: "only_back" | "full_body_wrap";
}

interface OrderItemsTableProps {
  /**
   * Optional, because it genuinely is.
   *
   * Five orders in the catalogue have no `items` field at all — abandoned
   * pre-payment writes that never got their lines. Typed as required, they
   * crashed the whole detail page on `items.length` before anything rendered,
   * so the one screen that could explain what is wrong with the order was the
   * screen you could not open.
   */
  items?: OrderItem[] | null;
  /** Files each line's real photos (RealPhotoButton). */
  orderNumber?: string;
  // Edit items dialog
  showEditItemsDialog: boolean;
  itemsForm: ItemFormEntry[];
  onOpenEditItems: () => void;
  onCloseEditItems: () => void;
  onItemsFormChange: (items: ItemFormEntry[]) => void;
  onSaveItems: () => void;
}

export function OrderItemsTable({
  items: itemsProp,
  orderNumber,
  showEditItemsDialog,
  itemsForm,
  onOpenEditItems,
  onCloseEditItems,
  onItemsFormChange,
  onSaveItems,
}: OrderItemsTableProps) {
  const items = Array.isArray(itemsProp) ? itemsProp : [];
  const missing = !Array.isArray(itemsProp);

  /*
   * What each line's product is today.
   *
   * An order keeps the title and a picture from the moment it was placed,
   * which is right — but the picture was the device mockup the cart showed,
   * and mockups are regenerated: #4030's two MacBook lines point at files
   * that now answer 404, so the admin showed an order with no pictures. The
   * slug was never kept either, so there was no way to open the product on
   * the shop. Both are read from the product as it stands, and a product that
   * has since been deleted says so rather than leading to a 404.
   */
  const [live, setLive] = useState<Record<string, { slug?: string; image?: string; gone?: boolean }>>({});
  const idsKey = items.map((i) => i.productId).join("|");
  useEffect(() => {
    let alive = true;
    const ids = [...new Set(items.map((i) => i.productId).filter(Boolean))];
    void Promise.all(ids.map(async (id) => {
      try {
        const snap = await getDoc(doc(db, "products", id));
        if (!snap.exists()) return [id, { gone: true }] as const;
        const p: any = snap.data();
        const first = (p.images || []).map((x: any) => (typeof x === "string" ? x : x?.url)).find(Boolean);
        return [id, { slug: p.slug, image: first }] as const;
      } catch {
        return [id, {}] as const;
      }
    })).then((rows) => { if (alive) setLive(Object.fromEntries(rows)); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);
  const [broken, setBroken] = useState<Record<number, boolean>>({});

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Order Items ({items.length})</CardTitle>
            <Button variant="outline" size="sm" onClick={onOpenEditItems}>
              <EditIcon className="size-3 mr-1" />
              Edit Items
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {missing && (
            <p className="mb-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
              This order has no items recorded. It was most likely abandoned before
              payment, so its lines were never written.
            </p>
          )}
          <div className="space-y-4">
            {items.map((item, idx) => (
              <div
                key={idx}
                className="flex gap-4 pb-4 border-b last:border-b-0 last:pb-0"
              >
                {(() => {
                  // The picture the order kept, then the product's own picture
                  // if that one has since gone, then an honest empty box.
                  const fallback = live[item.productId]?.image;
                  const src = !broken[idx] ? item.productImage || fallback : fallback;
                  return (
                    <div className="size-20 bg-muted rounded-lg overflow-hidden shrink-0 flex items-center justify-center">
                      {src && !(broken[idx] && src === item.productImage) ? (
                        <img
                          src={src}
                          alt={item.productTitle}
                          className="w-full h-full object-cover"
                          onError={() => setBroken((b) => ({ ...b, [idx]: true }))}
                        />
                      ) : (
                        <ImageOffIcon className="size-6 text-muted-foreground" />
                      )}
                    </div>
                  );
                })()}
                <div className="flex-1 space-y-1">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <p className="font-medium cursor-pointer hover:underline decoration-dashed underline-offset-4 flex items-center gap-1 w-fit">
                        {item.productTitle}
                        <ExternalLinkIcon className="size-3 opacity-50" />
                      </p>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuItem asChild>
                        {/* The route is /backend-skinly/products/:id — the
                            "/edit/" this used to carry matched nothing, so
                            every one of these opened a 404. */}
                        <Link
                          to={`/backend-skinly/products/${item.productId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="cursor-pointer w-full"
                        >
                          Open in Backend
                        </Link>
                      </DropdownMenuItem>
                      {(item.slug || live[item.productId]?.slug) && (
                        <DropdownMenuItem asChild>
                          <a
                            href={`/products/${item.slug || live[item.productId]?.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="cursor-pointer w-full"
                          >
                            Open in Frontend
                          </a>
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <div className="text-sm text-muted-foreground space-y-0.5">
                    {live[item.productId]?.gone && (
                      <Badge variant="outline" className="text-amber-700 border-amber-300 dark:text-amber-400">
                        Product deleted since this order
                      </Badge>
                    )}
                    <p>Variant: {item.variant}</p>
                    {item.sku && <p>SKU: <span className="font-mono">{item.sku}</span></p>}
                    {item.phoneModel && <p>Model: {item.phoneModel}</p>}
                    {item.phoneBrand && <p>Brand: {item.phoneBrand}</p>}
                    {item.coverage && (
                      <p>
                        Coverage:{" "}
                        {item.coverage === "full_body_wrap" ? "Full Body Wrap" : "Only Back"}
                      </p>
                    )}
                    <p className="font-medium text-foreground">
                      SKU: {item.sku || "—"}
                    </p>
                  </div>
                  <p className="font-medium">
                    ₹{(Number(item.price) || 0).toFixed(0)} × {Number(item.quantity) || 0} = ₹
                    {((Number(item.quantity) || 0) * (Number(item.price) || 0)).toFixed(0)}
                  </p>
                  {/* A photo of this line's skin, for the shop (one per product in the order). */}
                  {!live[item.productId]?.gone && (
                    <RealPhotoButton item={item} orderNumber={orderNumber} slug={live[item.productId]?.slug} />
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Edit Order Items Dialog */}
      <Dialog open={showEditItemsDialog} onOpenChange={onCloseEditItems}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Order Items</DialogTitle>
            <DialogDescription>
              Modify quantities, prices, or remove items. Subtotal and total will be recalculated.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {itemsForm.map((item, idx) => (
              <div key={idx} className="flex gap-4 p-4 border rounded-lg">
                <div className="flex-1 space-y-2">
                  <p className="font-medium text-sm">{item.productTitle}</p>
                  <p className="text-xs text-muted-foreground">Variant: {item.variant}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label htmlFor={`price-${idx}`} className="text-xs">Price (₹)</Label>
                      <Input
                        id={`price-${idx}`}
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.price}
                        onChange={(e) => {
                          const newItems = [...itemsForm];
                          newItems[idx] = { ...newItems[idx], price: parseFloat(e.target.value) || 0 };
                          onItemsFormChange(newItems);
                        }}
                      />
                    </div>
                    <div>
                      <Label htmlFor={`quantity-${idx}`} className="text-xs">Quantity</Label>
                      <Input
                        id={`quantity-${idx}`}
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => {
                          const newItems = [...itemsForm];
                          newItems[idx] = { ...newItems[idx], quantity: parseInt(e.target.value) || 1 };
                          onItemsFormChange(newItems);
                        }}
                      />
                    </div>
                  </div>
                  <p className="text-sm font-medium">
                    Subtotal: ₹{((Number(item.price) || 0) * (Number(item.quantity) || 0)).toFixed(0)}
                  </p>
                </div>
                <Button
                  variant="destructive"
                  size="icon"
                  onClick={() => onItemsFormChange(itemsForm.filter((_, i) => i !== idx))}
                >
                  <TrashIcon className="size-4" />
                </Button>
              </div>
            ))}
            {itemsForm.length === 0 && (
              <p className="text-center text-muted-foreground py-8">
                No items. Add at least one item to save.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onCloseEditItems}>Cancel</Button>
            <Button onClick={onSaveItems} disabled={itemsForm.length === 0}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
