import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { SignInButton } from "@/components/ui/signin.tsx";
import { AdminLayout } from "@/components/admin-layout.tsx";
import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table.tsx";
import { 
  PlusIcon, 
  EditIcon, 
  TrashIcon, 
  SearchIcon, 
  CoinsIcon,
  FilterIcon,
  XIcon
} from "lucide-react";
import { Switch } from "@/components/ui/switch.tsx";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty.tsx";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog.tsx";

type TargetType = "variant" | "product" | "collection";
type CashbackType = "fixed" | "percentage";

function AdminCashbackPageInner() {
  const rules = useQuery(api.cashback.getAllCashbackRules, {});
  const createRule = useMutation(api.cashback.createCashbackRule);
  const updateRule = useMutation(api.cashback.updateCashbackRule);
  const deleteRule = useMutation(api.cashback.deleteCashbackRule);
  const toggleRule = useMutation(api.cashback.toggleCashbackRule);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<Id<"cashbackRules"> | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTargetType, setFilterTargetType] = useState<TargetType | "all">("all");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [ruleToDelete, setRuleToDelete] = useState<Id<"cashbackRules"> | null>(null);

  const [formData, setFormData] = useState({
    targetType: "product" as TargetType,
    targetId: "",
    cashbackType: "percentage" as CashbackType,
    cashbackValue: 0,
    isActive: true,
  });

  // Filter and search rules
  const filteredRules = useMemo(() => {
    if (!rules) return [];
    
    let filtered = rules;

    // Filter by target type
    if (filterTargetType !== "all") {
      filtered = filtered.filter((rule) => rule.targetType === filterTargetType);
    }

    // Search by target ID
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((rule) =>
        rule.targetId.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [rules, filterTargetType, searchQuery]);

  const openCreateDialog = () => {
    setEditingRuleId(null);
    setFormData({
      targetType: "product",
      targetId: "",
      cashbackType: "percentage",
      cashbackValue: 0,
      isActive: true,
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (rule: {
    _id: Id<"cashbackRules">;
    targetType: TargetType;
    targetId: string;
    cashbackType: CashbackType;
    cashbackValue: number;
    isActive: boolean;
  }) => {
    setEditingRuleId(rule._id);
    setFormData({
      targetType: rule.targetType,
      targetId: rule.targetId,
      cashbackType: rule.cashbackType,
      cashbackValue: rule.cashbackValue,
      isActive: rule.isActive,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    try {
      if (!formData.targetId.trim()) {
        toast.error("Please enter a target ID");
        return;
      }

      if (formData.cashbackValue <= 0) {
        toast.error("Cashback value must be greater than 0");
        return;
      }

      if (formData.cashbackType === "percentage" && formData.cashbackValue > 100) {
        toast.error("Percentage cashback cannot exceed 100%");
        return;
      }

      if (editingRuleId) {
        await updateRule({
          ruleId: editingRuleId,
          cashbackType: formData.cashbackType,
          cashbackValue: formData.cashbackValue,
          isActive: formData.isActive,
        });
        toast.success("Cashback rule updated successfully");
      } else {
        await createRule({
          targetType: formData.targetType,
          targetId: formData.targetId,
          cashbackType: formData.cashbackType,
          cashbackValue: formData.cashbackValue,
          isActive: formData.isActive,
        });
        toast.success("Cashback rule created successfully");
      }

      setIsDialogOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save cashback rule");
    }
  };

  const handleToggleActive = async (ruleId: Id<"cashbackRules">, currentStatus: boolean) => {
    try {
      await toggleRule({ ruleId, isActive: !currentStatus });
      toast.success(`Cashback rule ${!currentStatus ? "activated" : "deactivated"}`);
    } catch (error) {
      toast.error("Failed to toggle rule status");
    }
  };

  const confirmDelete = (ruleId: Id<"cashbackRules">) => {
    setRuleToDelete(ruleId);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!ruleToDelete) return;
    
    try {
      await deleteRule({ ruleId: ruleToDelete });
      toast.success("Cashback rule deleted successfully");
      setDeleteDialogOpen(false);
      setRuleToDelete(null);
    } catch (error) {
      toast.error("Failed to delete cashback rule");
    }
  };

  const formatCashbackValue = (type: CashbackType, value: number) => {
    if (type === "percentage") {
      return `${value}%`;
    }
    return `₹${value}`;
  };

  const formatTargetType = (type: TargetType) => {
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  if (rules === undefined) {
    return (
      <AdminLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Cashback Management</h1>
            <p className="text-muted-foreground mt-1">
              Manage cashback rules for products, variants, and collections
            </p>
          </div>
          <Button onClick={openCreateDialog}>
            <PlusIcon className="h-4 w-4 mr-2" />
            Create Rule
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="flex-1 relative">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by target ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex items-center gap-2">
                <FilterIcon className="h-4 w-4 text-muted-foreground" />
                <Select
                  value={filterTargetType}
                  onValueChange={(value) => setFilterTargetType(value as TargetType | "all")}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="variant">Variant</SelectItem>
                    <SelectItem value="product">Product</SelectItem>
                    <SelectItem value="collection">Collection</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {(searchQuery || filterTargetType !== "all") && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchQuery("");
                    setFilterTargetType("all");
                  }}
                >
                  <XIcon className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {filteredRules.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <CoinsIcon />
                  </EmptyMedia>
                  <EmptyTitle>No cashback rules found</EmptyTitle>
                  <EmptyDescription>
                    {searchQuery || filterTargetType !== "all"
                      ? "Try adjusting your filters"
                      : "Create your first cashback rule to get started"}
                  </EmptyDescription>
                </EmptyHeader>
                {!searchQuery && filterTargetType === "all" && (
                  <EmptyContent>
                    <Button size="sm" onClick={openCreateDialog}>
                      <PlusIcon className="h-4 w-4 mr-2" />
                      Create Rule
                    </Button>
                  </EmptyContent>
                )}
              </Empty>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Target Type</TableHead>
                      <TableHead>Target ID</TableHead>
                      <TableHead>Cashback</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRules.map((rule) => (
                      <TableRow key={rule._id}>
                        <TableCell>
                          <Badge variant="outline">{formatTargetType(rule.targetType)}</Badge>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{rule.targetId}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary">
                              {formatCashbackValue(rule.cashbackType, rule.cashbackValue)}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              ({rule.cashbackType})
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={rule.isActive}
                              onCheckedChange={() => handleToggleActive(rule._id, rule.isActive)}
                            />
                            <span className="text-sm">
                              {rule.isActive ? "Active" : "Inactive"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(rule.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditDialog(rule)}
                            >
                              <EditIcon className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => confirmDelete(rule._id)}
                            >
                              <TrashIcon className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editingRuleId ? "Edit Cashback Rule" : "Create Cashback Rule"}
            </DialogTitle>
            <DialogDescription>
              {editingRuleId
                ? "Update the cashback rule details"
                : "Configure a new cashback rule for products, variants, or collections"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {!editingRuleId && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="targetType">Target Type</Label>
                  <Select
                    value={formData.targetType}
                    onValueChange={(value: TargetType) =>
                      setFormData({ ...formData, targetType: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="variant">Variant</SelectItem>
                      <SelectItem value="product">Product</SelectItem>
                      <SelectItem value="collection">Collection</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="targetId">Target ID</Label>
                  <Input
                    id="targetId"
                    placeholder="Enter product ID, variant ID, or collection slug"
                    value={formData.targetId}
                    onChange={(e) =>
                      setFormData({ ...formData, targetId: e.target.value })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    For collections, use the collection slug (e.g., "tempered-glasses")
                  </p>
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label htmlFor="cashbackType">Cashback Type</Label>
              <Select
                value={formData.cashbackType}
                onValueChange={(value: CashbackType) =>
                  setFormData({ ...formData, cashbackType: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">Fixed Amount (₹)</SelectItem>
                  <SelectItem value="percentage">Percentage (%)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cashbackValue">Cashback Value</Label>
              <Input
                id="cashbackValue"
                type="number"
                min="0"
                max={formData.cashbackType === "percentage" ? 100 : undefined}
                step={formData.cashbackType === "percentage" ? 0.1 : 1}
                placeholder={
                  formData.cashbackType === "percentage"
                    ? "Enter percentage (0-100)"
                    : "Enter amount in ₹"
                }
                value={formData.cashbackValue || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    cashbackValue: parseFloat(e.target.value) || 0,
                  })
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="isActive">Active</Label>
              <Switch
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, isActive: checked })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit}>
              {editingRuleId ? "Update Rule" : "Create Rule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Cashback Rule</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this cashback rule? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}

export default function AdminCashbackPage() {
  return (
    <>
      <Unauthenticated>
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center space-y-4">
            <h1 className="text-2xl font-bold">Authentication Required</h1>
            <p className="text-muted-foreground">Please sign in to access the admin panel</p>
            <SignInButton />
          </div>
        </div>
      </Unauthenticated>
      <AuthLoading>
        <AdminLayout>
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-64 w-full mt-6" />
        </AdminLayout>
      </AuthLoading>
      <Authenticated>
        <AdminCashbackPageInner />
      </Authenticated>
    </>
  );
}
