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
import { PlusIcon, EditIcon, TrashIcon, PackageIcon, RulerIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";

const ROLL_WIDTH_CM = 29.5;

export function RollsManagement() {
  const gadgets = useQuery(api.rollsManagement.getGadgetConsumption);
  const rolls = useQuery(api.rollsManagement.getRollInventory);

  const [showGadgetDialog, setShowGadgetDialog] = useState(false);
  const [showRollDialog, setShowRollDialog] = useState(false);
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

  if (!gadgets || !rolls) {
    return <div className="text-center py-8">Loading...</div>;
  }

  return (
    <div className="space-y-8">
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
