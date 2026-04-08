import { useQuery, useMutation } from "@/lib/firebase-hooks";
import { api } from "@/lib/firebase-api";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { PackageXIcon } from "lucide-react";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Authenticated, Unauthenticated, AuthLoading } from "@/lib/firebase-hooks";
import { SignInButton } from "@/components/ui/signin.tsx";
import { toast } from "sonner";
import { AdminLayout } from "@/components/admin-layout.tsx";
import { Label } from "@/components/ui/label.tsx";

function AdminOOSPageInner() {
  const autoSortOOS = useQuery(api.settings.getSetting, { key: "autoSortOutOfStock" });
  const updateSetting = useMutation(api.settings.updateSetting);

  const handleToggle = async (enabled: boolean) => {
    try {
      await updateSetting({
        key: "autoSortOutOfStock",
        value: enabled,
      });
      toast.success(
        enabled
          ? "Out-of-stock sorting enabled"
          : "Out-of-stock sorting disabled"
      );
    } catch (error) {
      toast.error("Failed to update setting");
    }
  };

  if (autoSortOOS === undefined) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const isEnabled = autoSortOOS?.value === true;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Out-of-Stock Settings</h1>
        <p className="text-muted-foreground">
          Configure how out-of-stock products are displayed on the store
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Auto-Sort Out-of-Stock Products</CardTitle>
          <CardDescription>
            When enabled, in-stock products will be shown first, and out-of-stock products
            will be pushed to the end of the product listing pages
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div className="flex-1">
              <Label className="text-base font-semibold">
                {isEnabled ? "Enabled" : "Disabled"}
              </Label>
              <p className="text-sm text-muted-foreground mt-1">
                {isEnabled
                  ? "Out-of-stock products are pushed to the end of product listings"
                  : "Products are displayed in their default order"}
              </p>
            </div>
            <Button
              variant={isEnabled ? "outline" : "default"}
              onClick={() => handleToggle(!isEnabled)}
            >
              {isEnabled ? "Disable" : "Enable"}
            </Button>
          </div>

          <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
              What happens when enabled:
            </h4>
            <ul className="space-y-1 text-sm text-blue-800 dark:text-blue-200">
              <li>• In-stock products appear first</li>
              <li>• Out-of-stock products appear at the end</li>
              <li>• "OUT OF STOCK - REQUEST RESTOCK" badge is shown</li>
              <li>• "Request Restock" button is available for customers</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminOOSPage() {
  return (
    <AdminLayout>
      <Unauthenticated>
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <PackageXIcon />
              </EmptyMedia>
              <EmptyTitle>Please sign in to access admin</EmptyTitle>
              <EmptyDescription>
                You need to be logged in to manage settings
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <SignInButton />
            </EmptyContent>
          </Empty>
        </Unauthenticated>
        <AuthLoading>
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
          </div>
        </AuthLoading>
      <Authenticated>
        <AdminOOSPageInner />
      </Authenticated>
    </AdminLayout>
  );
}
