import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import { FileTextIcon, SendIcon, TruckIcon, XCircleIcon } from "lucide-react";

export interface ShippingFormData {
  awbNumber: string;
  trackingUrl: string;
  shippingStatus: string;
}

export interface ManualTrackingFormData {
  trackingNumber: string;
  courierCompany: string;
}

interface ShippingTrackingPanelProps {
  // Current shipping data
  awbNumber?: string;
  trackingUrl?: string;
  shippingStatus?: string;
  courierName?: string;
  labelUrl?: string;
  manualTrackingNumber?: string;
  manualCourierCompany?: string;
  orderStatus: string;
  // RapidShyp actions
  creatingShipment: boolean;
  cancellingShipment: boolean;
  onCreateShipment: () => void;
  // Edit shipping dialog
  editingShipping: boolean;
  shippingForm: ShippingFormData;
  onOpenEditShipping: () => void;
  onCloseEditShipping: (open: boolean) => void;
  onShippingFormChange: (form: ShippingFormData) => void;
  onSaveShipping: () => void;
  // Cancel shipment dialog
  showCancelDialog: boolean;
  onOpenCancelDialog: (open: boolean) => void;
  onConfirmCancelShipment: () => void;
  // Manual tracking dialog
  showManualTrackingDialog: boolean;
  manualTrackingForm: ManualTrackingFormData;
  isSavingManualTracking: boolean;
  onOpenManualTracking: () => void;
  onCloseManualTracking: (open: boolean) => void;
  onManualTrackingFormChange: (form: ManualTrackingFormData) => void;
  onSaveManualTracking: () => void;
}

export function ShippingTrackingPanel({
  awbNumber,
  trackingUrl,
  shippingStatus,
  courierName,
  labelUrl,
  manualTrackingNumber,
  manualCourierCompany,
  orderStatus,
  creatingShipment,
  cancellingShipment,
  onCreateShipment,
  editingShipping,
  shippingForm,
  onOpenEditShipping,
  onCloseEditShipping,
  onShippingFormChange,
  onSaveShipping,
  showCancelDialog,
  onOpenCancelDialog,
  onConfirmCancelShipment,
  showManualTrackingDialog,
  manualTrackingForm,
  isSavingManualTracking,
  onOpenManualTracking,
  onCloseManualTracking,
  onManualTrackingFormChange,
  onSaveManualTracking,
}: ShippingTrackingPanelProps) {
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Shipping Management</CardTitle>
        </CardHeader>
        <CardContent>
          {/* RapidShyp tracking details */}
          {(awbNumber || trackingUrl) && (
            <div className="mb-4 p-3 bg-muted/50 rounded-lg">
              <p className="font-medium text-xs text-muted-foreground uppercase mb-1">
                Current Shipping Details
              </p>
              {awbNumber && (
                <p className="text-sm">
                  <span className="font-medium">AWB:</span> {awbNumber}
                </p>
              )}
              {courierName && (
                <p className="text-sm">
                  <span className="font-medium">Courier:</span> {courierName}
                </p>
              )}
              {trackingUrl && (
                <a
                  href={trackingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline"
                >
                  Track Shipment →
                </a>
              )}
              {shippingStatus && (
                <p className="text-sm text-muted-foreground">Status: {shippingStatus}</p>
              )}
            </div>
          )}

          {/* Manual tracking details */}
          {(manualTrackingNumber || manualCourierCompany) && (
            <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="font-medium text-xs text-blue-700 dark:text-blue-300 uppercase mb-1 flex items-center gap-2">
                <TruckIcon className="size-3" />
                Manual Tracking (Non-RapidShyp)
              </p>
              {manualTrackingNumber && (
                <p className="text-sm">
                  <span className="font-medium">Tracking Number:</span> {manualTrackingNumber}
                </p>
              )}
              {manualCourierCompany && (
                <p className="text-sm">
                  <span className="font-medium">Courier:</span> {manualCourierCompany}
                </p>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {!awbNumber ? (
              <Button onClick={onCreateShipment} disabled={creatingShipment} className="flex-1">
                {creatingShipment ? (
                  <>
                    <Spinner className="size-4 mr-2" />
                    Creating...
                  </>
                ) : (
                  <>
                    <SendIcon className="size-4 mr-2" />
                    Create Shipment
                  </>
                )}
              </Button>
            ) : (
              <>
                {labelUrl && (
                  <a href={labelUrl} target="_blank" rel="noopener noreferrer" className="flex-1">
                    <Button variant="outline" className="w-full">
                      <FileTextIcon className="size-4 mr-2" />
                      Download Label
                    </Button>
                  </a>
                )}

                {/* Edit Shipping Dialog */}
                <Dialog open={editingShipping} onOpenChange={onCloseEditShipping}>
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={onOpenEditShipping}
                  >
                    <TruckIcon className="size-4 mr-2" />
                    Edit Shipping
                  </Button>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Update Shipping Information</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="awb">AWB / Tracking Number</Label>
                        <Input
                          id="awb"
                          placeholder="Enter AWB number"
                          value={shippingForm.awbNumber}
                          onChange={(e) => onShippingFormChange({ ...shippingForm, awbNumber: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="tracking">Tracking URL</Label>
                        <Input
                          id="tracking"
                          placeholder="https://..."
                          value={shippingForm.trackingUrl}
                          onChange={(e) => onShippingFormChange({ ...shippingForm, trackingUrl: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="status">Shipping Status</Label>
                        <Input
                          id="status"
                          placeholder="e.g., In Transit, Out for Delivery"
                          value={shippingForm.shippingStatus}
                          onChange={(e) => onShippingFormChange({ ...shippingForm, shippingStatus: e.target.value })}
                        />
                      </div>
                      <Button onClick={onSaveShipping} className="w-full">
                        Save Shipping Info
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>

                {/* Cancel Shipment Dialog */}
                <Dialog open={showCancelDialog} onOpenChange={onOpenCancelDialog}>
                  <Button
                    variant="destructive"
                    className="flex-1"
                    disabled={cancellingShipment}
                    onClick={() => onOpenCancelDialog(true)}
                  >
                    <XCircleIcon className="size-4 mr-2" />
                    Cancel Shipment
                  </Button>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Cancel Shipment</DialogTitle>
                      <DialogDescription>
                        Are you sure you want to cancel this shipment?
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                        <p className="text-sm text-amber-900">
                          <strong>Warning:</strong> This will cancel the shipment with RapidShyp and reset the order status to Processing. All shipping information (AWB, tracking URL, label) will be removed.
                        </p>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => onOpenCancelDialog(false)}
                        disabled={cancellingShipment}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={onConfirmCancelShipment}
                        disabled={cancellingShipment}
                      >
                        {cancellingShipment ? (
                          <>
                            <Spinner className="size-4 mr-2" />
                            Cancelling...
                          </>
                        ) : (
                          "Confirm Cancel"
                        )}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </>
            )}

            {/* Manual Tracking Dialog */}
            <Dialog open={showManualTrackingDialog} onOpenChange={onCloseManualTracking}>
              <Button
                variant={manualTrackingNumber ? "outline" : "default"}
                className="flex-1"
                onClick={onOpenManualTracking}
              >
                <TruckIcon className="size-4 mr-2" />
                {manualTrackingNumber ? "Edit Manual Tracking" : "Add Manual Tracking"}
              </Button>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {manualTrackingNumber ? "Edit" : "Add"} Manual Tracking
                  </DialogTitle>
                  <DialogDescription>
                    Add tracking details for orders shipped through non-RapidShyp couriers.
                    {orderStatus === "processing" && " Order status will be updated to shipped."}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="manual-tracking">Tracking Number *</Label>
                    <Input
                      id="manual-tracking"
                      placeholder="Enter tracking number"
                      value={manualTrackingForm.trackingNumber}
                      onChange={(e) => onManualTrackingFormChange({ ...manualTrackingForm, trackingNumber: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="manual-courier">Courier Company *</Label>
                    <Input
                      id="manual-courier"
                      placeholder="e.g., Blue Dart, DTDC, India Post"
                      value={manualTrackingForm.courierCompany}
                      onChange={(e) => onManualTrackingFormChange({ ...manualTrackingForm, courierCompany: e.target.value })}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => onCloseManualTracking(false)}
                    disabled={isSavingManualTracking}
                  >
                    Cancel
                  </Button>
                  <Button onClick={onSaveManualTracking} disabled={isSavingManualTracking}>
                    {isSavingManualTracking ? (
                      <>
                        <Spinner className="size-4 mr-2" />
                        Saving...
                      </>
                    ) : (
                      "Save Manual Tracking"
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
