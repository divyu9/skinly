import { useQuery, useMutation } from "@/lib/firebase-hooks";
import { api } from "@/lib/firebase-api";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Authenticated, Unauthenticated, AuthLoading } from "@/lib/firebase-hooks";
import { SignInButton } from "@/components/ui/signin.tsx";
import { useAuth } from "@/hooks/use-auth.ts";
import { CartButton } from "@/components/cart.tsx";
import { MobileNav } from "@/components/mobile-nav.tsx";
import { AnnouncementBar } from "@/components/announcement-bar.tsx";
import type { Doc } from "@/lib/firebase-api";
import { useState } from "react";
import { toast } from "sonner";
import {
  UserIcon,
  MailIcon,
  ShoppingBagIcon,
  LogOutIcon,
  PackageIcon,
  SmartphoneIcon,
  ShieldCheckIcon,
  BellIcon,
  CheckCircle2Icon,
  WalletIcon,
  TicketIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  CoinsIcon,
  ArrowUpRightIcon,
  ArrowDownLeftIcon,
  HistoryIcon,
} from "lucide-react";
import {
  RadioGroup,
  RadioGroupItem,
} from "@/components/ui/radio-group.tsx";
import { BrandLogo } from "@/components/brand-logo.tsx";

function AccountPageInner() {
  const { signOut } = useAuth();
  const currentUser = useQuery(api.users.getCurrentUser);
  const recentOrders = useQuery(api.orders.getOrders, { limit: 5 }) as Doc<"orders">[] | undefined;
  const phoneVerificationStatus = useQuery(api.loginOtp.checkPhoneVerified);
  const whatsappConsent = useQuery(api.whatsappConsent.getMyConsent);
  const walletBalance = useQuery(api.wallet.getWalletBalance);
  const walletStats = useQuery(api.wallet.getWalletStats);
  const recentTransactions = useQuery(api.wallet.getWalletTransactions, { limit: 5 });
  const generateLoginOtp = useMutation(api.loginOtp.generateLoginOtp);
  const verifyLoginOtp = useMutation(api.loginOtp.verifyLoginOtp);
  const updateConsent = useMutation(api.whatsappConsent.updateMyConsent);
  const redeemCoupon = useMutation(api.coupons.redeemWalletCreditCoupon);

  const [phoneNumber, setPhoneNumber] = useState("");
  const [otpInput, setOtpInput] = useState("");
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [isUpdatingConsent, setIsUpdatingConsent] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [isRedeeming, setIsRedeeming] = useState(false);

  const handleSendOtp = async () => {
    if (!phoneNumber.trim()) {
      toast.error("Please enter your phone number");
      return;
    }

    setIsSendingOtp(true);
    try {
      await generateLoginOtp({ phoneNumber });
      setOtpSent(true);
      toast.success("OTP sent to your WhatsApp");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send OTP");
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpInput.trim()) {
      toast.error("Please enter the OTP");
      return;
    }

    setIsVerifyingOtp(true);
    try {
      await verifyLoginOtp({
        phoneNumber,
        otp: otpInput,
      });
      toast.success("Phone number verified successfully!");
      setOtpSent(false);
      setOtpInput("");
      setPhoneNumber("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Invalid OTP");
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const handleConsentChange = async (value: string) => {
    setIsUpdatingConsent(true);
    try {
      await updateConsent({
        consentType: value as "all" | "transactional_only" | "none",
      });
      toast.success("WhatsApp notification preferences updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update preferences");
    } finally {
      setIsUpdatingConsent(false);
    }
  };

  const handleRedeemCoupon = async () => {
    if (!couponCode.trim()) {
      toast.error("Please enter a coupon code");
      return;
    }

    setIsRedeeming(true);
    try {
      const result = await redeemCoupon({ code: couponCode });
      toast.success(`₹${result.creditAmount.toFixed(2)} added to your wallet!`);
      setCouponCode("");
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("Failed to redeem coupon");
      }
    } finally {
      setIsRedeeming(false);
    }
  };

  if (currentUser === undefined || recentOrders === undefined || phoneVerificationStatus === undefined || whatsappConsent === undefined || walletBalance === undefined || walletStats === undefined || recentTransactions === undefined) {
    // If any of these are strictly undefined (loading), show skeleton
    // If any are null (which shouldn't happen for authenticated users), it might be an error state, but let's handle that gracefully
    
    // Check if we have at least user data to show something
    if (!currentUser && !recentOrders) {
      return (
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="space-y-6">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      );
    }
  }

  // Fallback default values for potentially missing data to prevent crashes
  const safeWalletBalance = walletBalance || { balance: 0 };
  const safeWalletStats = walletStats || { lifetimeEarned: 0, lifetimeSpent: 0 };
  const safeRecentTransactions = recentTransactions || [];
  const safePhoneVerification = phoneVerificationStatus || { verified: false, phoneNumber: "" };
  const safeWhatsAppConsent = whatsappConsent || { consentType: "none", phoneNumber: "" };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Profile Card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserIcon className="size-5" />
            My Account
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-4">
            <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center">
              <UserIcon className="size-8 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-semibold">{currentUser?.name || "User"}</h3>
              {currentUser?.email && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                  <MailIcon className="size-4" />
                  {currentUser.email}
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-2">
                Member since {new Date(currentUser?._creationTime || Date.now()).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
              </p>
            </div>
          </div>

          <div className="pt-4 border-t">
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => signOut()}
            >
              <LogOutIcon className="size-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Referral Program */}
      <Card className="mb-6 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/20 dark:to-purple-950/20 border-indigo-200 dark:border-indigo-800">
        <CardContent className="p-6 flex items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <UserIcon className="size-5 text-indigo-600" />
              Refer & Earn ₹100
            </h3>
            <p className="text-sm text-muted-foreground">
              Invite friends to Skinly and earn rewards when they shop.
            </p>
          </div>
          <Button asChild className="bg-indigo-600 hover:bg-indigo-700 text-white shrink-0">
            <Link to="/account/referrals">Invite Now</Link>
          </Button>
        </CardContent>
      </Card>

      {/* Wallet Balance & Stats */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <WalletIcon className="size-5" />
            Skinly Wallet
          </CardTitle>
          <CardDescription>
            Manage your wallet balance, earn cashback, and redeem coupons
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Current Balance - Prominent Display */}
          <div className="relative overflow-hidden p-6 rounded-xl bg-gradient-to-br from-blue-500 via-blue-600 to-purple-600 text-white">
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-2">
                <CoinsIcon className="size-5" />
                <p className="text-sm font-medium opacity-90">Available Balance</p>
              </div>
              <p className="text-4xl font-bold tracking-tight">
                ₹{(safeWalletBalance.balance || 0).toFixed(0)}
              </p>
              <p className="text-xs opacity-75 mt-2">
                Use your wallet balance to pay for orders and earn cashback on purchases
              </p>
            </div>
            <div className="absolute right-0 top-0 size-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="absolute left-0 bottom-0 size-24 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUpIcon className="size-4 text-green-600" />
                <p className="text-xs text-muted-foreground">Lifetime Earned</p>
              </div>
              <p className="text-2xl font-bold text-green-600">
                ₹{(safeWalletStats.lifetimeEarned || 0).toFixed(0)}
              </p>
            </div>
            <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <TrendingDownIcon className="size-4 text-orange-600" />
                <p className="text-xs text-muted-foreground">Lifetime Spent</p>
              </div>
              <p className="text-2xl font-bold text-orange-600">
                ₹{(safeWalletStats.lifetimeSpent || 0).toFixed(0)}
              </p>
            </div>
          </div>

          {/* Recent Transactions */}
          {safeRecentTransactions && safeRecentTransactions.length > 0 && (
            <div className="space-y-3 pt-4 border-t">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <HistoryIcon className="size-4" />
                  <p className="text-sm font-medium">Recent Activity</p>
                </div>
                <Link to="/account/wallet">
                  <Button variant="ghost" size="sm">
                    View All
                  </Button>
                </Link>
              </div>
              <div className="space-y-2">
                {safeRecentTransactions.slice(0, 3).map((txn) => (
                  <div key={txn._id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`size-8 rounded-full flex items-center justify-center ${
                        txn.transactionType === "credit"
                          ? "bg-green-500/10"
                          : "bg-red-500/10"
                      }`}>
                        {txn.transactionType === "credit" ? (
                          <ArrowDownLeftIcon className="size-4 text-green-600" />
                        ) : (
                          <ArrowUpRightIcon className="size-4 text-red-600" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium line-clamp-1">{txn.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(txn.createdAt || txn._creationTime || Date.now()).toLocaleDateString('en-IN', { 
                            day: 'numeric', 
                            month: 'short'
                          })}
                        </p>
                      </div>
                    </div>
                    <p className={`text-sm font-semibold ${
                      txn.transactionType === "credit" ? "text-green-600" : "text-red-600"
                    }`}>
                      {txn.transactionType === "credit" ? "+" : "-"}₹{txn.amount.toFixed(0)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Coupon Redemption */}
          <div className="space-y-3 pt-4 border-t">
            <div className="flex items-center gap-2 text-sm font-medium">
              <TicketIcon className="size-4" />
              Redeem Coupon for Wallet Credit
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Enter coupon code"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleRedeemCoupon();
                  }
                }}
              />
              <Button
                onClick={handleRedeemCoupon}
                disabled={!couponCode || isRedeeming}
              >
                {isRedeeming ? "Redeeming..." : "Redeem"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Enter a wallet credit coupon code to add funds to your wallet
            </p>
          </div>

          {/* View Full History */}
          <div className="pt-4 border-t">
            <Link to="/account/wallet">
              <Button variant="outline" className="w-full">
                <HistoryIcon className="size-4 mr-2" />
                View Complete Transaction History
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Phone Verification */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SmartphoneIcon className="size-5" />
            Phone Verification
          </CardTitle>
          <CardDescription>
            Verify your phone number to receive order updates via WhatsApp
          </CardDescription>
        </CardHeader>
        <CardContent>
          {safePhoneVerification.verified ? (
            <div className="flex items-center gap-2 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
              <ShieldCheckIcon className="size-5 text-green-600" />
              <div>
                <p className="font-medium text-green-900 dark:text-green-100">
                  Phone Number Verified
                </p>
                <p className="text-sm text-green-700 dark:text-green-300">
                  {safePhoneVerification.phoneNumber}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Verify your phone number to enable WhatsApp notifications for your orders
              </p>
              
              {!otpSent ? (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="phone-verify">Phone Number</Label>
                    <Input
                      id="phone-verify"
                      type="tel"
                      placeholder="+91 98765 43210"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                    />
                  </div>
                  <Button
                    onClick={handleSendOtp}
                    disabled={!phoneNumber || isSendingOtp}
                    className="w-full"
                  >
                    {isSendingOtp ? "Sending OTP..." : "Send OTP to WhatsApp"}
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-start gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                    <ShieldCheckIcon className="size-4 text-green-600 mt-0.5 shrink-0" />
                    <p className="text-sm text-green-900 dark:text-green-100">
                      OTP sent to {phoneNumber}. Check your WhatsApp.
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="otp-verify">Enter OTP</Label>
                    <div className="flex gap-2">
                      <Input
                        id="otp-verify"
                        type="text"
                        maxLength={6}
                        placeholder="Enter 6-digit OTP"
                        value={otpInput}
                        onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ""))}
                      />
                      <Button
                        onClick={handleVerifyOtp}
                        disabled={otpInput.length !== 6 || isVerifyingOtp}
                      >
                        {isVerifyingOtp ? "Verifying..." : "Verify"}
                      </Button>
                    </div>
                  </div>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSendOtp}
                    disabled={isSendingOtp}
                    className="w-full"
                  >
                    {isSendingOtp ? "Resending..." : "Resend OTP"}
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* WhatsApp Notification Preferences */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BellIcon className="size-5" />
            WhatsApp Notifications
          </CardTitle>
          <CardDescription>
            Manage your WhatsApp notification preferences
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!safePhoneVerification.verified ? (
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">
                Please verify your phone number first to manage WhatsApp notification preferences.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-lg mb-4">
                <CheckCircle2Icon className="size-5 text-green-600 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-900 dark:text-green-100">
                    Connected: {safeWhatsAppConsent.phoneNumber || safePhoneVerification.phoneNumber}
                  </p>
                  <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                    You will receive notifications on this WhatsApp number
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <Label className="text-base font-semibold">Choose what notifications you want to receive:</Label>
                
                <RadioGroup
                  value={safeWhatsAppConsent.consentType}
                  onValueChange={handleConsentChange}
                  disabled={isUpdatingConsent}
                  className="space-y-3"
                >
                  <div className="flex items-start space-x-3 space-y-0 p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                    <RadioGroupItem value="all" id="consent-all" />
                    <div className="flex-1 space-y-1 leading-none">
                      <Label htmlFor="consent-all" className="font-medium cursor-pointer">
                        All Notifications
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Receive all order updates, promotional messages, and account notifications
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3 space-y-0 p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                    <RadioGroupItem value="transactional_only" id="consent-transactional" />
                    <div className="flex-1 space-y-1 leading-none">
                      <Label htmlFor="consent-transactional" className="font-medium cursor-pointer">
                        Transactional Only (Recommended)
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Only receive important order updates, OTPs, and account security notifications
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3 space-y-0 p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                    <RadioGroupItem value="none" id="consent-none" />
                    <div className="flex-1 space-y-1 leading-none">
                      <Label htmlFor="consent-none" className="font-medium cursor-pointer">
                        No Notifications
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Opt out of all WhatsApp notifications (not recommended - you may miss important order updates)
                      </p>
                    </div>
                  </div>
                </RadioGroup>
              </div>

              <div className="pt-4 border-t">
                <p className="text-xs text-muted-foreground">
                  You can change your preferences at any time. Transactional messages like order confirmations, 
                  shipping updates, and OTPs are important for your account security and order tracking.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Orders */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <ShoppingBagIcon className="size-5" />
              Recent Orders
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/orders">View All</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {recentOrders && recentOrders.length > 0 ? (
            <div className="space-y-3">
              {recentOrders.map((order) => (
                <Link
                  key={order._id}
                  to={`/orders/${order._id}`}
                  className="block p-4 border rounded-lg hover:border-primary transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-sm">Order #{order._id.slice(-8)}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          order.status === 'delivered' ? 'bg-green-100 text-green-700' :
                          order.status === 'shipped' ? 'bg-blue-100 text-blue-700' :
                          order.status === 'processing' ? 'bg-blue-100 text-blue-700' :
                          order.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {order.status}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {new Date(order._creationTime || order.createdAt || Date.now()).toLocaleDateString('en-IN', { 
                          day: 'numeric', 
                          month: 'short', 
                          year: 'numeric' 
                        })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">₹{order.total.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">{order.items.length} item{order.items.length > 1 ? 's' : ''}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <PackageIcon className="size-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground mb-4">No orders yet</p>
              <Button asChild>
                <Link to="/products">Start Shopping</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function AccountPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Announcement Bar */}
      <AnnouncementBar />
      
      {/* Navigation */}
      <nav className="fixed top-[28px] w-full bg-background/80 backdrop-blur-lg border-b border-border z-40">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <BrandLogo type="header" imgClassName="h-12 md:h-16" />
          <MobileNav />
        </div>
      </nav>

      <div className="pt-24 pb-12">
        <AuthLoading>
          <div className="container mx-auto px-4 py-8 max-w-4xl">
            <div className="space-y-6">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          </div>
        </AuthLoading>

        <Unauthenticated>
          <div className="container mx-auto px-4 py-8 max-w-2xl text-center">
            <UserIcon className="size-16 text-muted-foreground mx-auto mb-4" />
            <h1 className="text-3xl font-bold mb-4">Sign In Required</h1>
            <p className="text-muted-foreground mb-6">
              Please sign in to view your account details and orders
            </p>
            <SignInButton />
          </div>
        </Unauthenticated>

        <Authenticated>
          <AccountPageInner />
        </Authenticated>
      </div>
    </div>
  );
}
