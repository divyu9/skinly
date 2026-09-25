import { useMyReferrals, friendOffer } from "@/hooks/useMyReferrals";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UsersIcon, CopyIcon, CheckCircleIcon, TrophyIcon, ShareIcon, GiftIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AnnouncementBar } from "@/components/announcement-bar";
import { Link } from "react-router-dom";
import { MobileNav } from "@/components/mobile-nav";
import { Authenticated, Unauthenticated, AuthLoading } from "@/lib/firebase-hooks";
import { SignInButton } from "@/components/ui/signin";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * A customer's referral link, what it gives a friend and them, and who it
 * has brought. Everything comes from functions/src/referrals.ts — the
 * amounts are the admin's, and a reward shows as paid only once it is in
 * the wallet.
 */
function ReferralsPageInner() {
  const data = useMyReferrals();
  const [copied, setCopied] = useState(false);

  if (data === undefined) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl space-y-6">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (!data || !data.enabled) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-8 text-center">
        <GiftIcon className="mx-auto mb-4 size-12 text-muted-foreground" />
        <h1 className="mb-2 text-2xl font-bold">Referrals are paused</h1>
        <p className="text-muted-foreground">There's no referral offer running right now. Check back soon.</p>
      </div>
    );
  }

  const link = data.code ? `${window.location.origin}/?ref=${data.code}` : "";
  const offer = friendOffer(data.settings);
  const reward = data.settings.referrerReward;

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success("Link copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy — select the link and copy it");
    }
  };
  const share = async () => {
    const text = `Get ${offer} at GoSkinly with my link:`;
    if (navigator.share) {
      try { await navigator.share({ title: "GoSkinly", text, url: link }); return; } catch { /* dismissed */ }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${link}`)}`, "_blank", "noopener");
  };

  return (
    <div className="container mx-auto max-w-3xl space-y-6 px-4 py-8">
      <div className="rounded-2xl border-2 border-ink/15 bg-blush/40 p-6 sm:p-8">
        <h1 className="text-2xl font-extrabold sm:text-3xl">Give a friend {offer ? offer.split(" their")[0] : "a treat"}, get ₹{reward}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Share your link. Your friend gets {offer || "a discount"}, and ₹{reward} lands in your GoSkinly wallet when their order is delivered.
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <Input readOnly value={link} className="bg-background font-mono text-sm" onFocus={(e) => e.currentTarget.select()} />
          <div className="flex gap-2">
            <Button onClick={() => void copy()} variant="outline" className="shrink-0">
              {copied ? <CheckCircleIcon className="mr-1.5 size-4" /> : <CopyIcon className="mr-1.5 size-4" />}
              {copied ? "Copied" : "Copy"}
            </Button>
            <Button onClick={() => void share()} className="shrink-0 bg-brand font-bold text-brand-foreground hover:bg-brand/90">
              <ShareIcon className="mr-1.5 size-4" /> Share
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          ["Friends", data.referrals.filter((r) => r.status !== "cancelled").length],
          ["Earned", `₹${data.earned}`],
          ["On the way", `₹${data.pending}`],
        ].map(([label, value]) => (
          <Card key={String(label)}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-xl font-bold">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg"><TrophyIcon className="size-5" /> Your referrals</CardTitle>
          <CardDescription>A reward is paid when your friend's first order is delivered.</CardDescription>
        </CardHeader>
        <CardContent>
          {data.referrals.length ? (
            <ul className="divide-y">
              {data.referrals.map((r, i) => (
                <li key={i} className="flex items-center justify-between py-3 text-sm">
                  <div>
                    <p className="font-medium">{r.name}</p>
                    <p className="text-xs text-muted-foreground">{new Date(r.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    r.status === "paid" ? "bg-green-100 text-green-800" : r.status === "pending" ? "bg-amber-100 text-amber-800" : "bg-muted text-muted-foreground"}`}>
                    {r.status === "paid" ? `+₹${r.reward} paid` : r.status === "pending" ? `₹${r.reward} on delivery` : "Cancelled"}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">No referrals yet — share your link to get started.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

import { BrandLogo } from "@/components/brand-logo.tsx";

export default function ReferralsPage() {
  return (
    <div className="halftone min-h-screen">
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
