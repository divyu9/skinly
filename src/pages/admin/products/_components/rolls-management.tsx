import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog.tsx";
import { PlusIcon, EditIcon, TrashIcon, PackageIcon, RulerIcon, LinkIcon, AlertCircleIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";

const ROLL_WIDTH_CM = 29.5;

export function RollsManagement() {
  const gadgets = useQuery(api.rollsManagement.getGadgetConsumption);
  const rolls = useQuery(api.rollsManagement.getRollInventory);
  const productsByRNumber = useQuery(api.rollsManagement.getProductsByRNumber);
  const lowStockAlerts = useQuery(api.rollsManagement.getLowStockAlerts);

  const [showGadgetDialog, setShowGadgetDialog] = useState(false);
  const [showRollDialog, setShowRollDialog] = useState(false);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [assigningVariant, setAssigningVariant] = useState<{
    variantId: Id<"variants">;
    currentSku: string;
    currentRNumber?: string;
  } | null>(null);
  const [newRNumber, setNewRNumber] = useState("");
  
  const [editingGadget, setEditingGadget] = useState<{
    _id: Id<"gadgetConsumption">;
    categoryName: string;
    lengthCm: number;
    widthCm: number;
    notes?: string;
  } | null>(null);
  const [editingRoll, setEditingRoll] = useState<{
    _id: Id<"rollInventory">;
    rNumber: string;
    designName: string;
    isContinuous: boolean;
    metersAvailable: number;
    notes?: string;
  } | null>(null);

  const addGadget = useMutation(api.rollsManagement.addGadgetConsumption);
  const updateGadget = useMutation(api.rollsManagement.updateGadgetConsumption);
  const deleteGadget = useMutation(api.rollsManagement.deleteGadgetConsumption);

  const addRoll = useMutation(api.rollsManagement.addRollInventory);
  const updateRoll = useMutation(api.rollsManagement.updateRollInventory);
  const deleteRoll = useMutation(api.rollsManagement.deleteRollInventory);
  
  const assignRNumber = useMutation(api.rollsManagement.assignRNumber);
  const removeRNumberAssignment = useMutation(api.rollsManagement.removeRNumberAssignment);

  const calculateMaterialUsed = (lengthCm: number, widthCm: number) => {
    return (lengthCm / 100).toFixed(3);
  };

  const calculateUnitsAvailable = (
    gadgetLengthCm: number,
    gadgetWidthCm: number,
    metersAvailable: number,
    isContinuous: boolean
  ) => {
    const rollLengthCm = metersAvailable * 100;
    const totalAreaCm2 = ROLL_WIDTH_CM * rollLengthCm;
    const gadgetAreaCm2 = gadgetLengthCm * gadgetWidthCm;

    if (isContinuous) {
      return Math.floor(totalAreaCm2 / gadgetAreaCm2);
    } else {
      const units1Width = Math.floor(ROLL_WIDTH_CM / gadgetWidthCm);
      const units1Length = Math.floor(rollLengthCm / gadgetLengthCm);
      const totalUnits1 = units1Width * units1Length;

      let totalUnits2 = 0;
      if (gadgetLengthCm <= ROLL_WIDTH_CM) {
        const units2Width = Math.floor(ROLL_WIDTH_CM / gadgetLengthCm);
        const units2Length = Math.floor(rollLengthCm / gadgetWidthCm);
        totalUnits2 = units2Width * units2Length;
      }

      return Math.max(totalUnits1, totalUnits2);
    }
  };

  const handleAddOrEditGadget = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const categoryName = formData.get("categoryName") as string;
    const lengthCm = parseFloat(formData.get("lengthCm") as string);
    const widthCm = parseFloat(formData.get("widthCm") as string);
    const notes = formData.get("notes") as string;

    if (!categoryName || isNaN(lengthCm) || isNaN(widthCm)) {
      toast.error("Please fill all required fields");
      return;
    }

    try {
      if (editingGadget) {
        await updateGadget({
          id: editingGadget._id,
          categoryName,
          lengthCm,
          widthCm,
          notes: notes || undefined,
        });
        toast.success("Gadget updated successfully");
      } else {
        await addGadget({
          categoryName,
          lengthCm,
          widthCm,
          notes: notes || undefined,
        });
        toast.success("Gadget added successfully");
      }
      setShowGadgetDialog(false);
      setEditingGadget(null);
    } catch (error) {
      toast.error("Failed to save gadget");
    }
  };

  const handleAddOrEditRoll = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const rNumber = formData.get("rNumber") as string;
    const designName = formData.get("designName") as string;
    const isContinuous = formData.get("isContinuous") === "on";
    const metersAvailable = parseFloat(formData.get("metersAvailable") as string);
    const notes = formData.get("notes") as string;

    if (!rNumber || !designName || isNaN(metersAvailable)) {
      toast.error("Please fill all required fields");
      return;
    }

    try {
      if (editingRoll) {
        await updateRoll({
          id: editingRoll._id,
          rNumber,
          designName,
          isContinuous,
          metersAvailable,
          notes: notes || undefined,
        });
        toast.success("Roll updated successfully");
      } else {
        await addRoll({
          rNumber,
          designName,
          isContinuous,
          metersAvailable,
          notes: notes || undefined,
        });
        toast.success("Roll added successfully");
      }
      setShowRollDialog(false);
      setEditingRoll(null);
    } catch (error) {
      toast.error("Failed to save roll");
    }
  };

  const handleDeleteGadget = async (id: Id<"gadgetConsumption">) => {
    if (confirm("Are you sure you want to delete this gadget category?")) {
      try {
        await deleteGadget({ id });
        toast.success("Gadget deleted successfully");
      } catch (error) {
        toast.error("Failed to delete gadget");
      }
    }
  };

  const handleDeleteRoll = async (id: Id<"rollInventory">) => {
    if (confirm("Are you sure you want to delete this roll?")) {
      try {
        await deleteRoll({ id });
        toast.success("Roll deleted successfully");
      } catch (error) {
        toast.error("Failed to delete roll");
      }
    }
  };

  const handleAssignRNumber = async () => {
    if (!assigningVariant || !newRNumber.trim()) {
      toast.error("Please enter an R-number");
      return;
    }

    try {
      await assignRNumber({
        variantId: assigningVariant.variantId,
        rNumber: newRNumber.trim().toUpperCase(),
      });
      toast.success("R-number assigned successfully");
      setShowAssignDialog(false);
      setAssigningVariant(null);
      setNewRNumber("");
    } catch (error) {
      toast.error("Failed to assign R-number");
    }
  };

  const handleRemoveAssignment = async (variantId: Id<"variants">) => {
    try {
      await removeRNumberAssignment({ variantId });
      toast.success("R-number assignment removed");
    } catch (error) {
      toast.error("Failed to remove assignment");
    }
  };

  if (!gadgets || !rolls || !productsByRNumber || !lowStockAlerts) {
    return <div className="text-center py-8">Loading...</div>;
  }

  return (
    <div className="space-y-8">
      {/* Low Stock Alerts */}
      {lowStockAlerts.length > 0 && (
        <Card className="border-orange-200 bg-orange-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-900">
              <AlertCircleIcon className="size-5" />
              Low Stock Alerts ({lowStockAlerts.length})
            </CardTitle>
            <p className="text-sm text-orange-800 mt-1">
              Materials running low or out of stock
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {lowStockAlerts.map((alert) => (
                <div
                  key={alert.rNumber}
                  className="flex items-center justify-between p-3 bg-white rounded-lg border border-orange-200"
                >
                  <div>
                    <p className="font-medium text-orange-900">
                      {alert.rNumber} - {alert.designName}
                    </p>
                    <p className="text-sm text-orange-700">
                      {alert.metersAvailable.toFixed(2)}m available • ~{alert.estimatedUnits} units
                    </p>
                  </div>
                  <Badge variant="outline" className="border-orange-600 text-orange-700">
                    {alert.estimatedUnits === 0 ? "Out of Stock" : "Low Stock"}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Gadget Consumption Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <RulerIcon className="size-5" />
                Gadget Material Consumption
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Define length and width for each gadget type. Roll width is fixed at {ROLL_WIDTH_CM}cm.
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => {
                setEditingGadget(null);
                setShowGadgetDialog(true);
              }}
            >
              <PlusIcon className="size-4 mr-2" />
              Add Gadget
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Gadget Type</TableHead>
                  <TableHead>Length (cm)</TableHead>
                  <TableHead>Width (cm)</TableHead>
                  <TableHead>Material per Unit</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {gadgets.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No gadget categories defined yet
                    </TableCell>
                  </TableRow>
                ) : (
                  gadgets.map((gadget) => (
                    <TableRow key={gadget._id}>
                      <TableCell className="font-medium">{gadget.categoryName}</TableCell>
                      <TableCell>{gadget.lengthCm} cm</TableCell>
                      <TableCell>{gadget.widthCm} cm</TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {calculateMaterialUsed(gadget.lengthCm, gadget.widthCm)} meters
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {gadget.notes || "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditingGadget(gadget);
                              setShowGadgetDialog(true);
                            }}
                          >
                            <EditIcon className="size-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteGadget(gadget._id)}
                          >
                            <TrashIcon className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Roll Inventory Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <PackageIcon className="size-5" />
                Vinyl Rolls Inventory
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Manage your vinyl roll stock by R-number. Low stock = less than 5 meters.
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => {
                setEditingRoll(null);
                setShowRollDialog(true);
              }}
            >
              <PlusIcon className="size-4 mr-2" />
              Add Roll
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>R-Number</TableHead>
                  <TableHead>Design/Color</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Available</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rolls.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No rolls in inventory yet
                    </TableCell>
                  </TableRow>
                ) : (
                  rolls.map((roll) => (
                    <TableRow key={roll._id}>
                      <TableCell className="font-mono font-semibold">{roll.rNumber}</TableCell>
                      <TableCell>{roll.designName}</TableCell>
                      <TableCell>
                        <Badge variant={roll.isContinuous ? "default" : "secondary"}>
                          {roll.isContinuous ? "Continuous" : "Oriented"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            roll.metersAvailable < 5
                              ? "destructive"
                              : roll.metersAvailable < 10
                                ? "secondary"
                                : "default"
                          }
                        >
                          {roll.metersAvailable}m
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {roll.notes || "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditingRoll(roll);
                              setShowRollDialog(true);
                            }}
                          >
                            <EditIcon className="size-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteRoll(roll._id)}
                          >
                            <TrashIcon className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Material Calculator Section */}
      {gadgets.length > 0 && rolls.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PackageIcon className="size-5" />
              Material Calculator
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              See how many units of each gadget can be made from available vinyl rolls
            </p>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Gadget Type</TableHead>
                    {rolls.map((roll) => (
                      <TableHead key={roll._id} className="text-center min-w-[150px]">
                        <div className="space-y-1">
                          <div className="font-mono font-semibold">{roll.rNumber}</div>
                          <div className="text-xs text-muted-foreground font-normal">
                            {roll.designName}
                          </div>
                          <Badge
                            variant={roll.isContinuous ? "default" : "secondary"}
                            className="text-xs"
                          >
                            {roll.isContinuous ? "Continuous" : "Oriented"}
                          </Badge>
                        </div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {gadgets.map((gadget) => (
                    <TableRow key={gadget._id}>
                      <TableCell className="font-medium">
                        <div>
                          <div>{gadget.categoryName}</div>
                          <div className="text-xs text-muted-foreground">
                            {gadget.lengthCm}cm × {gadget.widthCm}cm
                          </div>
                        </div>
                      </TableCell>
                      {rolls.map((roll) => {
                        const units = calculateUnitsAvailable(
                          gadget.lengthCm,
                          gadget.widthCm,
                          roll.metersAvailable,
                          roll.isContinuous
                        );
                        
                        const bgColor = units === 0
                          ? "bg-red-50 dark:bg-red-950"
                          : units <= 5
                            ? "bg-yellow-50 dark:bg-yellow-950"
                            : "bg-green-50 dark:bg-green-950";
                        
                        const textColor = units === 0
                          ? "text-red-700 dark:text-red-300"
                          : units <= 5
                            ? "text-yellow-700 dark:text-yellow-300"
                            : "text-green-700 dark:text-green-300";

                        return (
                          <TableCell
                            key={roll._id}
                            className={`text-center ${bgColor}`}
                          >
                            <div className="space-y-1">
                              <div className={`text-2xl font-bold ${textColor}`}>
                                {units}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {units === 1 ? "unit" : "units"}
                              </div>
                            </div>
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            
            {/* Legend */}
            <div className="flex items-center gap-6 mt-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="size-4 rounded bg-green-100 dark:bg-green-900 border" />
                <span className="text-muted-foreground">&gt; 5 units available</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="size-4 rounded bg-yellow-100 dark:bg-yellow-900 border" />
                <span className="text-muted-foreground">1-5 units (low stock)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="size-4 rounded bg-red-100 dark:bg-red-900 border" />
                <span className="text-muted-foreground">Out of stock</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* SKU Mapping Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LinkIcon className="size-5" />
            SKU to R-Number Mapping
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Products are automatically grouped by R-number extracted from SKUs. You can manually override any assignment.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* R-Number Groups */}
          {Object.keys(productsByRNumber.groups).length > 0 ? (
            <div className="space-y-4">
              {Object.entries(productsByRNumber.groups)
                .sort((a, b) => a[0].localeCompare(b[0]))
                .map(([rNumber, items]) => (
                  <Card key={rNumber} className="border-2">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-mono font-bold text-lg">{rNumber}</h4>
                          <p className="text-sm text-muted-foreground">
                            {items.length} {items.length === 1 ? "variant" : "variants"}
                          </p>
                        </div>
                        {rolls?.find((r) => r.rNumber === rNumber) ? (
                          <Badge variant="default">Roll exists</Badge>
                        ) : (
                          <Badge variant="secondary">No roll yet</Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {items.map((item) => (
                          <div
                            key={item.variantId}
                            className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate">{item.productTitle}</div>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className="font-mono text-xs">
                                  {item.sku}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {item.variantTitle}
                                </span>
                                {item.isManual && (
                                  <Badge variant="secondary" className="text-xs">
                                    Manual
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setAssigningVariant({
                                    variantId: item.variantId as Id<"variants">,
                                    currentSku: item.sku,
                                    currentRNumber: rNumber,
                                  });
                                  setNewRNumber(rNumber);
                                  setShowAssignDialog(true);
                                }}
                              >
                                <EditIcon className="size-4" />
                              </Button>
                              {item.isManual && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() =>
                                    handleRemoveAssignment(item.variantId as Id<"variants">)
                                  }
                                >
                                  <XIcon className="size-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No products with R-numbers yet
            </div>
          )}

          {/* Unmapped SKUs */}
          {productsByRNumber.unmapped.length > 0 && (
            <Card className="border-2 border-orange-200 dark:border-orange-900">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <AlertCircleIcon className="size-5 text-orange-600" />
                  <div>
                    <h4 className="font-semibold">Unmapped SKUs</h4>
                    <p className="text-sm text-muted-foreground">
                      {productsByRNumber.unmapped.length} variants without R-numbers
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {productsByRNumber.unmapped.map((item) => (
                    <div
                      key={item.variantId}
                      className="flex items-center justify-between p-3 rounded-lg bg-orange-50 dark:bg-orange-950/20"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{item.productTitle}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="font-mono text-xs">
                            {item.sku}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {item.variantTitle}
                          </span>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => {
                          setAssigningVariant({
                            variantId: item.variantId as Id<"variants">,
                            currentSku: item.sku,
                          });
                          setNewRNumber("");
                          setShowAssignDialog(true);
                        }}
                      >
                        <PlusIcon className="size-4 mr-2" />
                        Assign
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      {/* Assign R-Number Dialog */}
      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign R-Number</DialogTitle>
            <DialogDescription>
              {assigningVariant?.currentSku && (
                <span className="font-mono">{assigningVariant.currentSku}</span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="rNumber">R-Number *</Label>
              <Input
                id="rNumber"
                value={newRNumber}
                onChange={(e) => setNewRNumber(e.target.value)}
                placeholder="e.g., R-1, R-59"
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Enter the R-number this SKU should be mapped to
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowAssignDialog(false);
                setAssigningVariant(null);
                setNewRNumber("");
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleAssignRNumber}>Assign</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Gadget Dialog */}
      <Dialog open={showGadgetDialog} onOpenChange={setShowGadgetDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingGadget ? "Edit" : "Add"} Gadget Category</DialogTitle>
            <DialogDescription>
              Define the dimensions for this gadget type. Length is the dimension along the roll.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddOrEditGadget}>
            <div className="space-y-4">
              <div>
                <Label htmlFor="categoryName">Gadget Type *</Label>
                <Input
                  id="categoryName"
                  name="categoryName"
                  defaultValue={editingGadget?.categoryName}
                  placeholder="e.g., Phone, Laptop Top, Mac Mini"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="lengthCm">Length (cm) *</Label>
                  <Input
                    id="lengthCm"
                    name="lengthCm"
                    type="number"
                    step="0.1"
                    defaultValue={editingGadget?.lengthCm}
                    placeholder="e.g., 15"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="widthCm">Width (cm) *</Label>
                  <Input
                    id="widthCm"
                    name="widthCm"
                    type="number"
                    step="0.1"
                    defaultValue={editingGadget?.widthCm}
                    placeholder="e.g., 8"
                    required
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  name="notes"
                  defaultValue={editingGadget?.notes}
                  placeholder="Optional notes"
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter className="mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowGadgetDialog(false);
                  setEditingGadget(null);
                }}
              >
                Cancel
              </Button>
              <Button type="submit">{editingGadget ? "Update" : "Add"} Gadget</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Roll Dialog */}
      <Dialog open={showRollDialog} onOpenChange={setShowRollDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingRoll ? "Edit" : "Add"} Vinyl Roll</DialogTitle>
            <DialogDescription>
              Add or update vinyl roll inventory. Continuous designs can be cut in any direction.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddOrEditRoll}>
            <div className="space-y-4">
              <div>
                <Label htmlFor="rNumber">R-Number *</Label>
                <Input
                  id="rNumber"
                  name="rNumber"
                  defaultValue={editingRoll?.rNumber}
                  placeholder="e.g., R-1, R-59"
                  required
                />
              </div>
              <div>
                <Label htmlFor="designName">Design/Color Name *</Label>
                <Input
                  id="designName"
                  name="designName"
                  defaultValue={editingRoll?.designName}
                  placeholder="e.g., Carbon Fiber Black"
                  required
                />
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="isContinuous"
                  name="isContinuous"
                  defaultChecked={editingRoll?.isContinuous ?? true}
                />
                <Label htmlFor="isContinuous" className="font-normal cursor-pointer">
                  Continuous Design (can be cut in any direction for optimal use)
                </Label>
              </div>
              <div>
                <Label htmlFor="metersAvailable">Available Stock (meters) *</Label>
                <Input
                  id="metersAvailable"
                  name="metersAvailable"
                  type="number"
                  step="0.01"
                  defaultValue={editingRoll?.metersAvailable}
                  placeholder="e.g., 50"
                  required
                />
              </div>
              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  name="notes"
                  defaultValue={editingRoll?.notes}
                  placeholder="Optional notes"
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter className="mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowRollDialog(false);
                  setEditingRoll(null);
                }}
              >
                Cancel
              </Button>
              <Button type="submit">{editingRoll ? "Update" : "Add"} Roll</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
