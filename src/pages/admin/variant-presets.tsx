import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { AdminPageWrapper } from "@/components/admin-page-wrapper.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton.tsx";

type PresetFormData = {
  presetId?: Id<"variantConsumptionPresets">;
  gadgetTypeId: Id<"gadgetTypes">;
  gadgetTypeName: string;
  name: string;
  multiplier: string;
  description: string;
};

export default function VariantPresetsManagementPage() {
  const presetsData = useQuery(api.variantConsumptionPresets.listAll);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState<PresetFormData | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const createPreset = useMutation(api.variantConsumptionPresets.create);
  const updatePreset = useMutation(api.variantConsumptionPresets.update);
  const removePreset = useMutation(api.variantConsumptionPresets.remove);
  const toggleActive = useMutation(api.variantConsumptionPresets.toggleActive);

  const handleCreateClick = (gadgetTypeId: Id<"gadgetTypes">, gadgetTypeName: string) => {
    setFormData({
      gadgetTypeId,
      gadgetTypeName,
      name: "",
      multiplier: "1.0",
      description: "",
    });
    setIsDialogOpen(true);
  };

  const handleEditClick = (
    presetId: Id<"variantConsumptionPresets">,
    gadgetTypeId: Id<"gadgetTypes">,
    gadgetTypeName: string,
    name: string,
    multiplier: number,
    description?: string
  ) => {
    setFormData({
      presetId,
      gadgetTypeId,
      gadgetTypeName,
      name,
      multiplier: multiplier.toString(),
      description: description || "",
    });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData) return;

    const multiplier = parseFloat(formData.multiplier);
    if (isNaN(multiplier) || multiplier <= 0) {
      toast.error("Multiplier must be a positive number");
      return;
    }

    if (!formData.name.trim()) {
      toast.error("Preset name is required");
      return;
    }

    setIsSubmitting(true);
    try {
      if (formData.presetId) {
        // Update existing preset
        await updatePreset({
          presetId: formData.presetId,
          name: formData.name.trim(),
          multiplier,
          description: formData.description.trim() || undefined,
        });
        toast.success("Preset updated successfully");
      } else {
        // Create new preset
        await createPreset({
          gadgetTypeId: formData.gadgetTypeId,
          name: formData.name.trim(),
          multiplier,
          description: formData.description.trim() || undefined,
        });
        toast.success("Preset created successfully");
      }
      setIsDialogOpen(false);
      setFormData(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save preset");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (presetId: Id<"variantConsumptionPresets">, presetName: string) => {
    if (!confirm(`Are you sure you want to delete "${presetName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await removePreset({ presetId });
      toast.success("Preset deleted successfully");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete preset");
    }
  };

  const handleToggleActive = async (
    presetId: Id<"variantConsumptionPresets">,
    currentStatus: boolean
  ) => {
    try {
      await toggleActive({ presetId, isActive: !currentStatus });
      toast.success(currentStatus ? "Preset deactivated" : "Preset activated");
    } catch (error) {
      toast.error("Failed to toggle preset status");
    }
  };

  if (presetsData === undefined) {
    return (
      <AdminPageWrapper>
        <div className="space-y-6">
          <Skeleton className="h-10 w-96" />
          <Skeleton className="h-64 w-full" />
        </div>
      </AdminPageWrapper>
    );
  }

  return (
    <AdminPageWrapper>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Variant Consumption Presets</h1>
            <p className="text-muted-foreground mt-2">
              Manage reusable material consumption multipliers for different gadget types
            </p>
          </div>
        </div>

        <div className="space-y-6">
          {presetsData.map(({ gadgetType, presets }) => (
            <Card key={gadgetType._id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{gadgetType.displayName}</CardTitle>
                    <CardDescription>
                      {presets.length} preset{presets.length !== 1 ? "s" : ""} configured
                    </CardDescription>
                  </div>
                  <Button
                    onClick={() => handleCreateClick(gadgetType._id, gadgetType.displayName)}
                    size="sm"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Preset
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {presets.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No presets configured for this gadget type.
                    <br />
                    Click "Add Preset" to create one.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Multiplier</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {presets.map((preset) => (
                        <TableRow key={preset._id}>
                          <TableCell className="font-medium">{preset.name}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">{preset.multiplier}x</Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {preset.description || "—"}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={preset.isActive}
                                onCheckedChange={() =>
                                  handleToggleActive(preset._id, preset.isActive)
                                }
                              />
                              <span className="text-sm">
                                {preset.isActive ? "Active" : "Inactive"}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  handleEditClick(
                                    preset._id,
                                    gadgetType._id,
                                    gadgetType.displayName,
                                    preset.name,
                                    preset.multiplier,
                                    preset.description
                                  )
                                }
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(preset._id, preset.name)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {formData?.presetId ? "Edit Preset" : "Create New Preset"}
            </DialogTitle>
            <DialogDescription>
              {formData?.gadgetTypeName && `For ${formData.gadgetTypeName} gadget type`}
            </DialogDescription>
          </DialogHeader>
          {formData && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Preset Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., Lid Only, Lid + Keyboard"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="multiplier">Material Multiplier</Label>
                <Input
                  id="multiplier"
                  type="number"
                  step="0.1"
                  min="0.1"
                  placeholder="1.0"
                  value={formData.multiplier}
                  onChange={(e) => setFormData({ ...formData, multiplier: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  How much material this variant uses (e.g., 0.5 = half, 1.0 = standard, 1.5 = 1.5x)
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description (Optional)</Label>
                <Textarea
                  id="description"
                  placeholder="e.g., Covers only the laptop lid"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Preset"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminPageWrapper>
  );
}
