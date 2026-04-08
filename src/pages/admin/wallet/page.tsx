import { useState } from "react";
import { useQuery, useMutation } from "@/lib/firebase-hooks";
import { api } from "@/lib/firebase-api";
import type { Id } from "@/lib/firebase-api";
import { AdminLayout } from "@/components/admin-layout.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { toast } from "sonner";
import {
  Wallet,
  Plus,
  Minus,
  TrendingUp,
  TrendingDown,
  Users,
  IndianRupee,
  Settings,
  Eye,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";

export default function AdminWallet() {
  const users = useQuery(api.wallet.getAllUsersWithWallets, {});
  const settings = useQuery(api.wallet.getWalletSettings, {});
  
  const [selectedUserId, setSelectedUserId] = useState<Id<"users"> | null>(null);
  const [creditDialogOpen, setCreditDialogOpen] = useState(false);
  const [debitDialogOpen, setDebitDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);

  // Calculate summary stats
  const totalWalletBalance = users?.reduce((sum, u) => sum + u.walletBalance, 0) || 0;
  const usersWithBalance = users?.filter((u) => u.walletBalance > 0).length || 0;
  const totalUsers = users?.length || 0;

  if (!users || !settings) {
    return (
      <AdminLayout>
        <div className="space-y-6">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Wallet Management</h1>
            <p className="text-muted-foreground">Manage user wallets and settings</p>
          </div>
          <Button
            variant="outline"
            onClick={() => setSettingsDialogOpen(true)}
          >
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Wallet Balance</CardTitle>
              <IndianRupee className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₹{totalWalletBalance.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">Across all users</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Users with Balance</CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{usersWithBalance}</div>
              <p className="text-xs text-muted-foreground">Out of {totalUsers} total users</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Wallet Status</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {settings.walletEnabled ? "Enabled" : "Disabled"}
              </div>
              <p className="text-xs text-muted-foreground">
                {settings.maxUsageType === "unlimited"
                  ? "Unlimited usage"
                  : settings.maxUsageType === "percentage"
                  ? `${settings.maxUsageValue}% max usage`
                  : `₹${settings.maxUsageValue} max usage`}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Users Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Users</CardTitle>
            <CardDescription>View and manage user wallet balances</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-right">Wallet Balance</TableHead>
                  <TableHead className="text-right">Transactions</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No users found
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user) => (
                    <TableRow key={user._id}>
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell className="text-muted-foreground">{user.email}</TableCell>
                      <TableCell className="text-right">
                        <span className={user.walletBalance > 0 ? "text-green-600 font-medium" : ""}>
                          ₹{user.walletBalance.toFixed(2)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="secondary">{user.transactionCount}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedUserId(user._id);
                              setDetailsDialogOpen(true);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedUserId(user._id);
                              setCreditDialogOpen(true);
                            }}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedUserId(user._id);
                              setDebitDialogOpen(true);
                            }}
                            disabled={user.walletBalance <= 0}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Credit Dialog */}
        {selectedUserId && (
          <CreditDialog
            open={creditDialogOpen}
            onOpenChange={setCreditDialogOpen}
            userId={selectedUserId}
            userName={users.find((u) => u._id === selectedUserId)?.name || "Unknown"}
          />
        )}

        {/* Debit Dialog */}
        {selectedUserId && (
          <DebitDialog
            open={debitDialogOpen}
            onOpenChange={setDebitDialogOpen}
            userId={selectedUserId}
            userName={users.find((u) => u._id === selectedUserId)?.name || "Unknown"}
            currentBalance={users.find((u) => u._id === selectedUserId)?.walletBalance || 0}
          />
        )}

        {/* Details Dialog */}
        {selectedUserId && (
          <DetailsDialog
            open={detailsDialogOpen}
            onOpenChange={setDetailsDialogOpen}
            userId={selectedUserId}
          />
        )}

        {/* Settings Dialog */}
        <SettingsDialog
          open={settingsDialogOpen}
          onOpenChange={setSettingsDialogOpen}
          currentSettings={settings}
        />
      </div>
    </AdminLayout>
  );
}

// Credit Dialog Component
function CreditDialog({
  open,
  onOpenChange,
  userId,
  userName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: Id<"users">;
  userName: string;
}) {
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const creditWallet = useMutation(api.wallet.adminCreditWallet);

  const handleCredit = async () => {
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    if (!description.trim()) {
      toast.error("Please enter a description");
      return;
    }

    try {
      await creditWallet({
        userId,
        amount: parsedAmount,
        description: description.trim(),
      });
      toast.success(`₹${parsedAmount} credited to ${userName}'s wallet`);
      setAmount("");
      setDescription("");
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to credit wallet");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowDownRight className="h-5 w-5 text-green-600" />
            Credit Wallet
          </DialogTitle>
          <DialogDescription>Add money to {userName}'s wallet</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="credit-amount">Amount (₹)</Label>
            <Input
              id="credit-amount"
              type="number"
              placeholder="100"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min="1"
              step="0.01"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="credit-description">Description</Label>
            <Input
              id="credit-description"
              placeholder="Reason for credit..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleCredit} className="flex-1">
              Credit ₹{amount || "0"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Debit Dialog Component
function DebitDialog({
  open,
  onOpenChange,
  userId,
  userName,
  currentBalance,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: Id<"users">;
  userName: string;
  currentBalance: number;
}) {
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const debitWallet = useMutation(api.wallet.adminDebitWallet);

  const handleDebit = async () => {
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    if (parsedAmount > currentBalance) {
      toast.error(`Amount exceeds current balance of ₹${currentBalance}`);
      return;
    }

    if (!description.trim()) {
      toast.error("Please enter a description");
      return;
    }

    try {
      await debitWallet({
        userId,
        amount: parsedAmount,
        description: description.trim(),
      });
      toast.success(`₹${parsedAmount} debited from ${userName}'s wallet`);
      setAmount("");
      setDescription("");
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to debit wallet");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowUpRight className="h-5 w-5 text-red-600" />
            Debit Wallet
          </DialogTitle>
          <DialogDescription>
            Remove money from {userName}'s wallet (Balance: ₹{currentBalance})
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="debit-amount">Amount (₹)</Label>
            <Input
              id="debit-amount"
              type="number"
              placeholder="100"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min="1"
              max={currentBalance}
              step="0.01"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="debit-description">Description</Label>
            <Input
              id="debit-description"
              placeholder="Reason for debit..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleDebit} variant="destructive" className="flex-1">
              Debit ₹{amount || "0"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Details Dialog Component
function DetailsDialog({
  open,
  onOpenChange,
  userId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: Id<"users">;
}) {
  const details = useQuery(api.wallet.getUserWalletDetails, { userId });

  if (!details) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <Skeleton className="h-96 w-full" />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Wallet Details</DialogTitle>
          <DialogDescription>{details.user.name} - {details.user.email}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Stats */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Current Balance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">₹{details.user.walletBalance.toFixed(2)}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Lifetime Earned</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  ₹{details.stats.lifetimeEarned.toFixed(2)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Lifetime Spent</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  ₹{details.stats.lifetimeSpent.toFixed(2)}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Transactions */}
          <div>
            <h3 className="font-semibold mb-3">Recent Transactions</h3>
            <div className="space-y-2">
              {details.recentTransactions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No transactions yet
                </p>
              ) : (
                details.recentTransactions.map((txn) => (
                  <div
                    key={txn._id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      {txn.transactionType === "credit" ? (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
                          <ArrowDownRight className="h-5 w-5 text-green-600 dark:text-green-400" />
                        </div>
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-900">
                          <ArrowUpRight className="h-5 w-5 text-red-600 dark:text-red-400" />
                        </div>
                      )}
                      <div>
                        <p className="font-medium">{txn.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(txn.createdAt).toLocaleString("en-IN")}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p
                        className={`font-bold ${
                          txn.transactionType === "credit" ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {txn.transactionType === "credit" ? "+" : "-"}₹{txn.amount.toFixed(2)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Balance: ₹{txn.balanceAfter.toFixed(2)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Settings Dialog Component
function SettingsDialog({
  open,
  onOpenChange,
  currentSettings,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentSettings: {
    maxUsageType: "percentage" | "fixed" | "unlimited";
    maxUsageValue: number;
    referralRewardAmount: number;
    referralMinOrderValue: number;
    walletEnabled: boolean;
  };
}) {
  const [maxUsageType, setMaxUsageType] = useState(currentSettings.maxUsageType);
  const [maxUsageValue, setMaxUsageValue] = useState(currentSettings.maxUsageValue.toString());
  const [referralRewardAmount, setReferralRewardAmount] = useState(
    currentSettings.referralRewardAmount.toString()
  );
  const [referralMinOrderValue, setReferralMinOrderValue] = useState(
    currentSettings.referralMinOrderValue.toString()
  );
  const [walletEnabled, setWalletEnabled] = useState(currentSettings.walletEnabled);

  const saveSettings = useMutation(api.wallet.saveWalletSettings);

  const handleSave = async () => {
    try {
      await saveSettings({
        maxUsageType,
        maxUsageValue: parseFloat(maxUsageValue) || 0,
        referralRewardAmount: parseFloat(referralRewardAmount) || 0,
        referralMinOrderValue: parseFloat(referralMinOrderValue) || 0,
        walletEnabled,
      });
      toast.success("Wallet settings saved");
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save settings");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Wallet Settings</DialogTitle>
          <DialogDescription>Configure wallet behavior and limits</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Wallet Enabled */}
          <div className="space-y-2">
            <Label>Wallet Status</Label>
            <Select
              value={walletEnabled ? "enabled" : "disabled"}
              onValueChange={(value) => setWalletEnabled(value === "enabled")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="enabled">Enabled</SelectItem>
                <SelectItem value="disabled">Disabled</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              When disabled, customers cannot use wallet balance at checkout
            </p>
          </div>

          {/* Max Usage Type */}
          <div className="space-y-2">
            <Label>Maximum Wallet Usage per Order</Label>
            <Select value={maxUsageType} onValueChange={(value: "percentage" | "fixed" | "unlimited") => setMaxUsageType(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unlimited">Unlimited (full balance)</SelectItem>
                <SelectItem value="percentage">Percentage of order total</SelectItem>
                <SelectItem value="fixed">Fixed amount</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Max Usage Value */}
          {maxUsageType !== "unlimited" && (
            <div className="space-y-2">
              <Label htmlFor="max-usage-value">
                {maxUsageType === "percentage" ? "Percentage (%)" : "Amount (₹)"}
              </Label>
              <Input
                id="max-usage-value"
                type="number"
                value={maxUsageValue}
                onChange={(e) => setMaxUsageValue(e.target.value)}
                placeholder={maxUsageType === "percentage" ? "50" : "500"}
              />
              <p className="text-xs text-muted-foreground">
                {maxUsageType === "percentage"
                  ? "Maximum percentage of order total that can be paid using wallet"
                  : "Maximum amount that can be paid using wallet per order"}
              </p>
            </div>
          )}

          {/* Referral Settings */}
          <div className="space-y-4 pt-4 border-t">
            <h3 className="font-semibold">Referral Program (Future)</h3>

            <div className="space-y-2">
              <Label htmlFor="referral-reward">Referral Reward Amount (₹)</Label>
              <Input
                id="referral-reward"
                type="number"
                value={referralRewardAmount}
                onChange={(e) => setReferralRewardAmount(e.target.value)}
                placeholder="100"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="referral-min">Minimum Order Value for Referral (₹)</Label>
              <Input
                id="referral-min"
                type="number"
                value={referralMinOrderValue}
                onChange={(e) => setReferralMinOrderValue(e.target.value)}
                placeholder="500"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleSave} className="flex-1">
              Save Settings
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
