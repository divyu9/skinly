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
import { EditIcon, ExternalLinkIcon, TrashIcon } from "lucide-react";
import { Link } from "react-router-dom";

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
  items: OrderItem[];
  // Edit items dialog
  showEditItemsDialog: boolean;
  itemsForm: ItemFormEntry[];
  onOpenEditItems: () => void;
  onCloseEditItems: () => void;
  onItemsFormChange: (items: ItemFormEntry[]) => void;
  onSaveItems: () => void;
}

export function OrderItemsTable({
  items,
  showEditItemsDialog,
  itemsForm,
  onOpenEditItems,
  onCloseEditItems,
  onItemsFormChange,
  onSaveItems,
}: OrderItemsTableProps) {
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
          <div className="space-y-4">
            {items.map((item, idx) => (
              <div
                key={idx}
                className="flex gap-4 pb-4 border-b last:border-b-0 last:pb-0"
              >
                {item.productImage && (
                  <div className="size-20 bg-muted rounded-lg overflow-hidden shrink-0">
                    <img
                      src={item.productImage}
                      alt={item.productTitle}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
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
                        <Link
                          to={`/backend-skinly/products/edit/${item.productId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="cursor-pointer w-full"
                        >
                          Open in Backend
                        </Link>
                      </DropdownMenuItem>
                      {item.slug && (
                        <DropdownMenuItem asChild>
                          <a
                            href={`/product/${item.slug}`}
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
                    <p>Variant: {item.variant}</p>
                    {item.phoneModel && <p>Model: {item.phoneModel}</p>}
                    {item.phoneBrand && <p>Brand: {item.phoneBrand}</p>}
                    {item.coverage && (
                      <p>
                        Coverage:{" "}
                        {item.coverage === "full_body_wrap" ? "Full Body Wrap" : "Only Back"}
                      </p>
                    )}
                    <p className="font-medium text-foreground">
                      SKU: {item.sku || item.variant}
                    </p>
                  </div>
                  <p className="font-medium">
                    ₹{item.price.toFixed(0)} × {item.quantity} = ₹
                    {(item.quantity * item.price).toFixed(0)}
                  </p>
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
                    Subtotal: ₹{(item.price * item.quantity).toFixed(0)}
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
