import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Link } from "react-router-dom";
import { 
  WalletIcon, 
  ArrowLeftIcon, 
  ArrowUpRightIcon, 
  ArrowDownLeftIcon,
  FilterIcon,
  CalendarIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  CoinsIcon,
  ShoppingBagIcon,
  RefreshCcwIcon,
  TicketIcon,
  GiftIcon,
} from "lucide-react";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { SignInButton } from "@/components/ui/signin.tsx";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover.tsx";
import { Calendar } from "@/components/ui/calendar.tsx";

type TransactionFilter = "all" | "credit" | "debit";
type DateFilter = "7" | "30" | "90" | "custom" | "all";

function WalletPageInner() {
  const [transactionFilter, setTransactionFilter] = useState<TransactionFilter>("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>();
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>();

  const walletStats = useQuery(api.wallet.getWalletStats);
  const allTransactions = useQuery(api.wallet.getWalletTransactions, { limit: 100 });

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-IN", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getSourceIcon = (source: string) => {
    switch (source) {
      case "order_payment":
        return <ShoppingBagIcon className="size-4" />;
      case "refund":
        return <RefreshCcwIcon className="size-4" />;
      case "coupon_credit":
        return <TicketIcon className="size-4" />;
      case "cashback":
        return <CoinsIcon className="size-4" />;
      case "referral_reward":
        return <GiftIcon className="size-4" />;
      case "admin_credit":
        return <CoinsIcon className="size-4" />;
      default:
        return <WalletIcon className="size-4" />;
    }
  };

  const getSourceLabel = (source: string) => {
    switch (source) {
      case "order_payment":
        return "Order Payment";
      case "refund":
        return "Refund";
      case "coupon_credit":
        return "Coupon Credit";
      case "cashback":
        return "Cashback";
      case "referral_reward":
        return "Referral Reward";
      case "admin_credit":
        return "Admin Credit";
      default:
        return source;
    }
  };

  // Filter transactions
  const filteredTransactions = useMemo(() => {
    if (!allTransactions) return [];
    
    let filtered = [...allTransactions];
    
    // Apply transaction type filter
    if (transactionFilter !== "all") {
      filtered = filtered.filter(txn => txn.transactionType === transactionFilter);
    }
    
    // Apply date filter
    if (dateFilter !== "all") {
      const now = Date.now();
      let startDate: number;
      
      if (dateFilter === "custom") {
        if (customStartDate) {
          startDate = customStartDate.getTime();
          filtered = filtered.filter(txn => txn.createdAt >= startDate);
        }
        if (customEndDate) {
          const endDate = new Date(customEndDate);
          endDate.setHours(23, 59, 59, 999);
          filtered = filtered.filter(txn => txn.createdAt <= endDate.getTime());
        }
      } else {
        const days = parseInt(dateFilter);
        startDate = now - (days * 24 * 60 * 60 * 1000);
        filtered = filtered.filter(txn => txn.createdAt >= startDate);
      }
    }
    
    return filtered;
  }, [allTransactions, transactionFilter, dateFilter, customStartDate, customEndDate]);

  // Count transactions by type
  const transactionCounts = useMemo(() => {
    if (!allTransactions) return { all: 0, credit: 0, debit: 0 };
    return {
      all: allTransactions.length,
      credit: allTransactions.filter(t => t.transactionType === "credit").length,
      debit: allTransactions.filter(t => t.transactionType === "debit").length,
    };
  }, [allTransactions]);

  if (walletStats === undefined || allTransactions === undefined) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/account">
                <Button variant="ghost" size="sm">
                  <ArrowLeftIcon className="size-4 mr-2" />
                  Back
                </Button>
              </Link>
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <WalletIcon className="size-5 text-primary" />
                </div>
                <div>
                  <h1 className="text-xl font-bold">Wallet Transaction History</h1>
                  <p className="text-sm text-muted-foreground">
                    View all your wallet transactions
                  </p>
                </div>
              </div>
            </div>
            <Link to="/">
              <img
                src="https://cdn.hercules.app/file_Qd06a0OWqeC2LadTl4tLLvmv"
                alt="Skinly"
                className="h-10"
              />
            </Link>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Wallet Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="size-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                  <CoinsIcon className="size-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Current Balance</p>
                  <p className="text-2xl font-bold text-blue-600">
                    ₹{walletStats.currentBalance.toFixed(0)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="size-12 rounded-full bg-green-500/10 flex items-center justify-center">
                  <TrendingUpIcon className="size-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Earned</p>
                  <p className="text-2xl font-bold text-green-600">
                    ₹{walletStats.lifetimeEarned.toFixed(0)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="size-12 rounded-full bg-orange-500/10 flex items-center justify-center">
                  <TrendingDownIcon className="size-6 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Spent</p>
                  <p className="text-2xl font-bold text-orange-600">
                    ₹{walletStats.lifetimeSpent.toFixed(0)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center gap-2">
              <FilterIcon className="size-4" />
              <CardTitle className="text-base">Filter Transactions</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Transaction Type Tabs */}
            <Tabs value={transactionFilter} onValueChange={(value) => setTransactionFilter(value as TransactionFilter)}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="all" className="flex flex-col gap-1 py-2">
                  <span className="text-sm font-medium">All</span>
                  <Badge variant="secondary" className="text-xs">{transactionCounts.all}</Badge>
                </TabsTrigger>
                <TabsTrigger value="credit" className="flex flex-col gap-1 py-2">
                  <span className="text-sm font-medium">Credits</span>
                  <Badge variant="secondary" className="text-xs bg-green-500/10 text-green-600">{transactionCounts.credit}</Badge>
                </TabsTrigger>
                <TabsTrigger value="debit" className="flex flex-col gap-1 py-2">
                  <span className="text-sm font-medium">Debits</span>
                  <Badge variant="secondary" className="text-xs bg-red-500/10 text-red-600">{transactionCounts.debit}</Badge>
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Date Filter */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <CalendarIcon className="size-4 text-muted-foreground" />
                <span className="text-sm font-medium">Date Range:</span>
              </div>
              <Select value={dateFilter} onValueChange={(value) => setDateFilter(value as DateFilter)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="7">Last 7 Days</SelectItem>
                  <SelectItem value="30">Last 30 Days</SelectItem>
                  <SelectItem value="90">Last 90 Days</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
              
              {dateFilter === "custom" && (
                <div className="flex items-center gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm">
                        {customStartDate ? formatDate(customStartDate.getTime()) : "Start Date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={customStartDate}
                        onSelect={setCustomStartDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <span className="text-sm text-muted-foreground">to</span>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm">
                        {customEndDate ? formatDate(customEndDate.getTime()) : "End Date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={customEndDate}
                        onSelect={setCustomEndDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              )}
              
              {(dateFilter !== "all" || transactionFilter !== "all") && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => {
                    setDateFilter("all");
                    setTransactionFilter("all");
                    setCustomStartDate(undefined);
                    setCustomEndDate(undefined);
                  }}
                >
                  Clear Filters
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Transactions List */}
        {filteredTransactions.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <WalletIcon />
              </EmptyMedia>
              <EmptyTitle>
                {allTransactions && allTransactions.length > 0 
                  ? "No transactions match filters" 
                  : "No transactions yet"}
              </EmptyTitle>
              <EmptyDescription>
                {allTransactions && allTransactions.length > 0
                  ? "Try adjusting your filters to see more transactions."
                  : "Your wallet transactions will appear here once you start using your wallet."}
              </EmptyDescription>
            </EmptyHeader>
            {allTransactions && allTransactions.length > 0 && (
              <EmptyContent>
                <Button onClick={() => {
                  setDateFilter("all");
                  setTransactionFilter("all");
                  setCustomStartDate(undefined);
                  setCustomEndDate(undefined);
                }}>
                  Clear Filters
                </Button>
              </EmptyContent>
            )}
          </Empty>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>All Transactions</CardTitle>
              <CardDescription>
                Showing {filteredTransactions.length} of {allTransactions.length} total transactions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {filteredTransactions.map((txn) => (
                  <div 
                    key={txn._id} 
                    className="flex items-start justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start gap-4 flex-1">
                      {/* Icon */}
                      <div className={`size-10 rounded-full flex items-center justify-center shrink-0 ${
                        txn.transactionType === "credit"
                          ? "bg-green-500/10"
                          : "bg-red-500/10"
                      }`}>
                        {txn.transactionType === "credit" ? (
                          <ArrowDownLeftIcon className="size-5 text-green-600" />
                        ) : (
                          <ArrowUpRightIcon className="size-5 text-red-600" />
                        )}
                      </div>

                      {/* Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <p className="font-medium text-sm">{txn.description}</p>
                          <p className={`text-lg font-bold shrink-0 ${
                            txn.transactionType === "credit" ? "text-green-600" : "text-red-600"
                          }`}>
                            {txn.transactionType === "credit" ? "+" : "-"}₹{txn.amount.toFixed(0)}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mb-2">
                          <div className="flex items-center gap-1">
                            {getSourceIcon(txn.source)}
                            <span>{getSourceLabel(txn.source)}</span>
                          </div>
                          <span>•</span>
                          <span>{formatDate(txn.createdAt)} at {formatTime(txn.createdAt)}</span>
                        </div>

                        <div className="flex items-center gap-3 text-xs">
                          <Badge variant="outline" className="font-normal">
                            Balance: ₹{txn.balanceAfter.toFixed(0)}
                          </Badge>
                          {txn.relatedOrderId && (
                            <Link to={`/orders/${txn.relatedOrderId}`}>
                              <Badge variant="outline" className="font-normal hover:bg-muted cursor-pointer">
                                View Order
                              </Badge>
                            </Link>
                          )}
                          {txn.adminEmail && (
                            <Badge variant="secondary" className="font-normal">
                              By Admin
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

export default function WalletPage() {
  return (
    <>
      <Unauthenticated>
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <WalletIcon />
              </EmptyMedia>
              <EmptyTitle>Please sign in to view wallet</EmptyTitle>
              <EmptyDescription>
                You need to be logged in to see your wallet transactions
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <SignInButton />
            </EmptyContent>
          </Empty>
        </div>
      </Unauthenticated>
      <AuthLoading>
        <div className="min-h-screen bg-background flex items-center justify-center">
          <Skeleton className="h-96 w-full max-w-4xl" />
        </div>
      </AuthLoading>
      <Authenticated>
        <WalletPageInner />
      </Authenticated>
    </>
  );
}
