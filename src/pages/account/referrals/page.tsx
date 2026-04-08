import { useQuery } from "@/lib/firebase-hooks";
import { api } from "@/lib/firebase-api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UsersIcon, CopyIcon, CheckCircleIcon, TrophyIcon, ShareIcon, GiftIcon, CoinsIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AnnouncementBar } from "@/components/announcement-bar";
import { Link } from "react-router-dom";
import { MobileNav } from "@/components/mobile-nav";
import { Authenticated, Unauthenticated, AuthLoading } from "@/lib/firebase-hooks";
import { SignInButton } from "@/components/ui/signin";
import { Skeleton } from "@/components/ui/skeleton";

function ReferralsPageInner() {
  const stats = useQuery(api.referrals.getReferralStats);
  const [copied, setCopied] = useState(false);

  const referralLink = stats?.referralCode 
    ? `${window.location.origin}/?ref=${stats.referralCode}` 
    : "Loading...";

  const handleCopy = () => {
    if (stats?.referralCode) {
      navigator.clipboard.writeText(referralLink);
      setCopied(true);
      toast.success("Referral link copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShare = async () => {
    if (navigator.share && stats?.referralCode) {
      try {
        await navigator.share({
          title: 'Join Skinly & Get Rewarded!',
          text: 'Use my referral link to sign up and get rewards on your first order!',
          url: referralLink,
        });
      } catch (err) {
        // Ignore abort errors
      }
    } else {
      handleCopy();
    }
  };

  if (stats === undefined) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl space-y-6">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (stats === null) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <p>Unable to load referral data.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl space-y-6">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-2xl p-8 text-white shadow-xl">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-center md:text-left">
            <h1 className="text-3xl font-bold">Refer Friends & Earn</h1>
            <p className="text-indigo-100 max-w-md">
              Share your unique link. When your friends place their first order, you both get rewarded!
            </p>
            <div className="flex items-center justify-center md:justify-start gap-2 pt-2">
              <span className="bg-white/20 px-3 py-1 rounded-full text-sm font-medium backdrop-blur-sm flex items-center gap-1">
                <GiftIcon className="size-4" /> You get ₹100
              </span>
              <span className="bg-white/20 px-3 py-1 rounded-full text-sm font-medium backdrop-blur-sm flex items-center gap-1">
                <UsersIcon className="size-4" /> They get a coupon
              </span>
            </div>
          </div>
          <div className="bg-white/10 p-6 rounded-xl backdrop-blur-sm border border-white/20 min-w-[280px]">
            <p className="text-sm text-indigo-100 mb-2">Total Earnings</p>
            <p className="text-4xl font-bold">₹{stats.totalEarned}</p>
            <p className="text-xs text-indigo-200 mt-1">
              From {stats.successfulReferrals} successful referrals
            </p>
          </div>
        </div>
      </div>

      {/* Share Link Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShareIcon className="size-5" />
            Your Referral Link
          </CardTitle>
          <CardDescription>
            Copy and share this link with your friends
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input 
              readOnly 
              value={referralLink} 
              className="font-mono text-sm bg-muted"
            />
            <Button onClick={handleCopy} className="shrink-0 w-24">
              {copied ? (
                <>
                  <CheckCircleIcon className="size-4 mr-2" />
                  Copied
                </>
              ) : (
                <>
                  <CopyIcon className="size-4 mr-2" />
                  Copy
                </>
              )}
            </Button>
          </div>
          <Button variant="outline" className="w-full" onClick={handleShare}>
            <ShareIcon className="size-4 mr-2" />
            Share via WhatsApp / Social
          </Button>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Clicks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalReferrals}</div>
            <p className="text-xs text-muted-foreground mt-1">Friends who signed up</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Successful</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.successfulReferrals}</div>
            <p className="text-xs text-muted-foreground mt-1">Placed first order</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Conversion Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {stats.totalReferrals > 0 
                ? ((stats.successfulReferrals / stats.totalReferrals) * 100).toFixed(1) 
                : "0"}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">Signups to Orders</p>
          </CardContent>
        </Card>
      </div>

      {/* History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrophyIcon className="size-5" />
            Reward History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stats.rewardHistory.length > 0 ? (
            <div className="space-y-4">
              {stats.rewardHistory.map((reward: any) => (
                <div key={reward._id} className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-full bg-green-100 flex items-center justify-center">
                      <CoinsIcon className="size-5 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium">Referral Bonus</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(reward.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-green-600">+₹{reward.amount}</p>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                      Processed
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No rewards earned yet. Start sharing!
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

import { BrandLogo } from "@/components/brand-logo.tsx";

export default function ReferralsPage() {
  return (
    <div className="min-h-screen bg-background">
      <AnnouncementBar />
      <nav className="fixed top-[28px] w-full bg-background/80 backdrop-blur-lg border-b border-border z-40">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <BrandLogo type="header" imgClassName="h-12 md:h-16" />
          <MobileNav />
        </div>
      </nav>

      <div className="pt-24 pb-12">
        <AuthLoading>
          <div className="container mx-auto px-4 py-8 max-w-4xl space-y-6">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </AuthLoading>
        <Unauthenticated>
          <div className="container mx-auto px-4 py-8 max-w-2xl text-center">
            <div className="size-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <UsersIcon className="size-8 text-muted-foreground" />
            </div>
            <h1 className="text-3xl font-bold mb-4">Sign In Required</h1>
            <p className="text-muted-foreground mb-6">
              Please sign in to view your referral dashboard.
            </p>
            <SignInButton />
          </div>
        </Unauthenticated>
        <Authenticated>
          <ReferralsPageInner />
        </Authenticated>
      </div>
    </div>
  );
}
