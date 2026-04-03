import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import {
  AlertCircleIcon,
  CheckIcon,
  PackageOpenIcon,
  PackageXIcon,
  RefreshCwIcon,
  RotateCcwIcon,
} from "lucide-react";

export interface InventoryItem {
  sku: string;
  productTitle: string;
  variantTitle: string;
  quantity: number;
  currentInventory: number;
}

export interface RtoAction {
  actionType: "restocked" | "resent" | "resolved";
  actionAt: number;
  actionBy: string;
  notes?: string;
  newOrderNumber?: string;
}

export interface RestockingHistoryEntry {
  restockedAt: number;
  restockedBy: string;
  items: Array<{ sku: string; quantity: number }>;
}

export interface RtoActionFormData {
  actionType: "restocked" | "resent" | "resolved";
  notes: string;
  newOrderNumber: string;
}

interface RtoActionsPanelProps {
  orderStatus: string;
  // Inventory restock
  inventoryData: InventoryItem[] | undefined;
  restockingHistory?: RestockingHistoryEntry[];
  showRestockDialog: boolean;
  selectedItems: Set<string>;
  isRestocking: boolean;
  onOpenRestock: () => void;
  onCloseRestock: () => void;
  onSelectAll: (checked: boolean) => void;
  onSelectItem: (sku: string, checked: boolean) => void;
  onConfirmRestock: () => void;
  // RTO actions
  rtoActions?: RtoAction[];
  showRtoActionDialog: boolean;
  rtoActionForm: RtoActionFormData;
  isRecordingRtoAction: boolean;
  onOpenRtoAction: () => void;
  onCloseRtoAction: () => void;
  onRtoActionFormChange: (form: RtoActionFormData) => void;
  onConfirmRtoAction: () => void;
}

function formatDate(timestamp: number) {
  return new Date(timestamp).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const ACTION_LABELS = {
  restocked: { label: "Inventory Restocked", color: "text-green-600", Icon: RotateCcwIcon },
  resent: { label: "Package Resent", color: "text-indigo-600", Icon: RefreshCwIcon },
  resolved: { label: "Marked as Resolved", color: "text-purple-600", Icon: CheckIcon },
};

export function RtoActionsPanel({
  orderStatus,
  inventoryData,
  restockingHistory,
  showRestockDialog,
  selectedItems,
  isRestocking,
  onOpenRestock,
  onCloseRestock,
  onSelectAll,
  onSelectItem,
  onConfirmRestock,
  rtoActions,
  showRtoActionDialog,
  rtoActionForm,
  isRecordingRtoAction,
  onOpenRtoAction,
  onCloseRtoAction,
  onRtoActionFormChange,
  onConfirmRtoAction,
}: RtoActionsPanelProps) {
  const isCancelledOrRto = orderStatus === "cancelled" || orderStatus === "rto";
  const isRto = orderStatus === "rto";
  const totalItems = inventoryData?.length ?? 0;

  return (
    <>
      {/* Inventory Restocking — cancelled / rto only */}
      {isCancelledOrRto && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PackageXIcon className="size-5" />
              Inventory Restocking
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {restockingHistory && restockingHistory.length > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <CheckIcon className="size-4 text-green-600" />
                  <span className="text-sm font-medium text-green-900">Inventory has been restocked</span>
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase">Restocking History</p>
                  {restockingHistory.map((entry, idx) => (
                    <div key={idx} className="p-3 bg-muted/50 rounded-lg text-sm">
                      <p className="font-medium">{formatDate(entry.restockedAt)}</p>
                      <p className="text-muted-foreground text-xs">By: {entry.restockedBy}</p>
                      <div className="mt-2 space-y-1">
                        {entry.items.map((item, itemIdx) => (
                          <p key={itemIdx} className="text-xs">• {item.sku} × {item.quantity}</p>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <Button variant="outline" className="w-full" onClick={onOpenRestock}>
                  <RotateCcwIcon className="size-4 mr-2" />
                  Restock Again
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <PackageXIcon className="size-4 text-amber-600" />
                  <span className="text-sm text-amber-900">Inventory has not been restocked yet</span>
                </div>
                <Button className="w-full" onClick={onOpenRestock}>
                  <RotateCcwIcon className="size-4 mr-2" />
                  Restock Inventory
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* RTO Management — rto only */}
      {isRto && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircleIcon className="size-5" />
              RTO Management
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {rtoActions && rtoActions.length > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <PackageOpenIcon className="size-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-900">
                    {rtoActions.length} RTO {rtoActions.length === 1 ? "action" : "actions"} recorded
                  </span>
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase">Action History</p>
                  {rtoActions.map((action, idx) => {
                    const info = ACTION_LABELS[action.actionType];
                    const ActionIcon = info.Icon;
                    return (
                      <div key={idx} className="p-3 bg-muted/50 rounded-lg text-sm space-y-2">
                        <div className="flex items-center gap-2">
                          <ActionIcon className={`size-4 ${info.color}`} />
                          <span className="font-medium">{info.label}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{formatDate(action.actionAt)}</p>
                        <p className="text-xs text-muted-foreground">By: {action.actionBy}</p>
                        {action.notes && (
                          <p className="text-xs">
                            <span className="text-muted-foreground">Notes: </span>
                            <span>{action.notes}</span>
                          </p>
                        )}
                        {action.newOrderNumber && (
                          <p className="text-xs">
                            <span className="text-muted-foreground">New Order: </span>
                            <span className="font-mono font-medium">{action.newOrderNumber}</span>
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
                <Button variant="outline" className="w-full" onClick={onOpenRtoAction}>
                  <AlertCircleIcon className="size-4 mr-2" />
                  Record Another Action
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                  <AlertCircleIcon className="size-4 text-orange-600" />
                  <span className="text-sm text-orange-900">No RTO actions recorded yet</span>
                </div>
                <Button className="w-full" onClick={onOpenRtoAction}>
                  <AlertCircleIcon className="size-4 mr-2" />
                  Record RTO Action
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Restock Inventory Dialog */}
      <Dialog open={showRestockDialog} onOpenChange={onCloseRestock}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Restock Inventory</DialogTitle>
            <DialogDescription>
              Select which items to restock from this {orderStatus} order
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {inventoryData === undefined ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : inventoryData && inventoryData.length > 0 ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b">
                  <Checkbox
                    checked={selectedItems.size === totalItems && selectedItems.size > 0}
                    onCheckedChange={onSelectAll}
                  />
                  <span className="text-sm font-medium">Select All Items</span>
                </div>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {inventoryData.map((item) => (
                    <div
                      key={item.sku}
                      className="flex items-start gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <Checkbox
                        checked={selectedItems.has(item.sku)}
                        onCheckedChange={(checked) => onSelectItem(item.sku, checked as boolean)}
                      />
                      <div className="flex-1 space-y-1">
                        <p className="font-medium text-sm">{item.productTitle}</p>
                        <p className="text-xs text-muted-foreground">
                          SKU: {item.sku} • Variant: {item.variantTitle}
                        </p>
                        <div className="flex items-center gap-4 text-xs">
                          <span className="text-muted-foreground">
                            Order Qty: <span className="font-medium text-foreground">{item.quantity}</span>
                          </span>
                          <span className="text-muted-foreground">
                            Current Inventory: <span className="font-medium text-foreground">{item.currentInventory}</span>
                          </span>
                          <span className="text-green-600">
                            → After Restock: <span className="font-semibold">{item.currentInventory + item.quantity}</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">No inventory data available</div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onCloseRestock}>Cancel</Button>
            <Button onClick={onConfirmRestock} disabled={selectedItems.size === 0 || isRestocking}>
              {isRestocking ? (
                <>
                  <Spinner className="size-4 mr-2" />
                  Restocking...
                </>
              ) : (
                <>
                  <RotateCcwIcon className="size-4 mr-2" />
                  Restock {selectedItems.size} Item{selectedItems.size !== 1 ? "s" : ""}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* RTO Action Dialog */}
      <Dialog open={showRtoActionDialog} onOpenChange={onCloseRtoAction}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record RTO Action</DialogTitle>
            <DialogDescription>
              Record what action was taken for this RTO (Return to Origin) order
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="rto-action-type">Action Type *</Label>
              <Select
                value={rtoActionForm.actionType}
                onValueChange={(v) =>
                  onRtoActionFormChange({ ...rtoActionForm, actionType: v as RtoActionFormData["actionType"] })
                }
              >
                <SelectTrigger id="rto-action-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="restocked">Inventory Restocked</SelectItem>
                  <SelectItem value="resent">Package Resent</SelectItem>
                  <SelectItem value="resolved">Marked as Resolved</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                {rtoActionForm.actionType === "restocked" && "Record that inventory was restocked"}
                {rtoActionForm.actionType === "resent" && "Record that the package was resent to the customer"}
                {rtoActionForm.actionType === "resolved" && "Mark this RTO as resolved without further action"}
              </p>
            </div>

            {rtoActionForm.actionType === "resent" && (
              <div>
                <Label htmlFor="new-order-number">New Order Number *</Label>
                <Input
                  id="new-order-number"
                  placeholder="e.g., ORD-1234567890-C"
                  value={rtoActionForm.newOrderNumber}
                  onChange={(e) => onRtoActionFormChange({ ...rtoActionForm, newOrderNumber: e.target.value })}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Enter the new order number (typically with -C suffix)
                </p>
              </div>
            )}

            <div>
              <Label htmlFor="rto-notes">Notes (Optional)</Label>
              <Textarea
                id="rto-notes"
                placeholder="Add any additional notes about this action..."
                value={rtoActionForm.notes}
                onChange={(e) => onRtoActionFormChange({ ...rtoActionForm, notes: e.target.value })}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onCloseRtoAction} disabled={isRecordingRtoAction}>
              Cancel
            </Button>
            <Button
              onClick={onConfirmRtoAction}
              disabled={
                isRecordingRtoAction ||
                (rtoActionForm.actionType === "resent" && !rtoActionForm.newOrderNumber.trim())
              }
            >
              {isRecordingRtoAction ? (
                <>
                  <Spinner className="size-4 mr-2" />
                  Recording...
                </>
              ) : (
                <>
                  <AlertCircleIcon className="size-4 mr-2" />
                  Record Action
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
