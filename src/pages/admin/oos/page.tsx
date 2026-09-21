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

/** One switch, so the two orderings read and behave the same way. */
function SortToggle({
  title, description, enabled, whenOn, whenOff, onToggle, bullets,
}: {
  title: string;
  description: string;
  enabled: boolean;
  whenOn: string;
  whenOff: string;
  onToggle: (next: boolean) => void;
  bullets: string[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
          <div className="flex-1">
            <Label className="text-base font-semibold">{enabled ? "Enabled" : "Disabled"}</Label>
            <p className="text-sm text-muted-foreground mt-1">{enabled ? whenOn : whenOff}</p>
          </div>
          <Button variant={enabled ? "outline" : "default"} onClick={() => onToggle(!enabled)}>
            {enabled ? "Disable" : "Enable"}
          </Button>
        </div>

        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
            What happens when enabled:
          </h4>
          <ul className="space-y-1 text-sm text-blue-800 dark:text-blue-200">
            {bullets.map((b) => <li key={b}>• {b}</li>)}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

function AdminOOSPageInner() {
  const autoSortOOS = useQuery(api.settings.getSetting, { key: "autoSortOutOfStock" });
  const autoSortNoImage = useQuery(api.settings.getSetting, { key: "autoSortNoImage" });
  const updateSetting = useMutation(api.settings.updateSetting);

  const toggle = async (key: string, enabled: boolean, label: string) => {
    try {
      await updateSetting({ key, value: enabled });
      toast.success(`${label} ${enabled ? "enabled" : "disabled"}`);
    } catch (error) {
      toast.error("Failed to update setting");
    }
  };

  if (autoSortOOS === undefined || autoSortNoImage === undefined) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const oosOn = autoSortOOS?.value === true;
  const noImageOn = autoSortNoImage?.value === true;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Listing order</h1>
        <p className="text-muted-foreground">
          What gets pushed to the end of the shop, and what stays where it is
        </p>
      </div>

      <SortToggle
        title="Push out-of-stock products down"
        description="In-stock products are shown first; anything with no stock left goes to the end of every listing."
        enabled={oosOn}
        whenOn="Out-of-stock products are pushed to the end of product listings"
        whenOff="Products are displayed in their default order"
        onToggle={(next) => void toggle("autoSortOutOfStock", next, "Out-of-stock sorting")}
        bullets={[
          "In-stock products appear first",
          "Out-of-stock products appear at the end",
          '"OUT OF STOCK - REQUEST RESTOCK" badge is shown',
          '"Request Restock" button is available for customers',
        ]}
      />

      {/*
        * The same idea, for the other reason a card sells nothing.
        *
        * A design nobody can see is a grey box with a price on it, and it took
        * the same top-row space as a design that sells. This sends those to
        * the end rather than hiding them: they stay in stock, stay in search,
        * stay on their own page — they just stop being the first thing anyone
        * scrolls past. Products → Filters → Images → "No images" lists exactly
        * the ones this moves.
        */}
      <SortToggle
        title="Push products without images down"
        description="Products with no picture anyone can see go to the end of every listing, below the ones that show their design."
        enabled={noImageOn}
        whenOn="Products without a usable image are pushed to the end of product listings"
        whenOff="Products are displayed in their default order, images or not"
        onToggle={(next) => void toggle("autoSortNoImage", next, "No-image sorting")}
        bullets={[
          "Products showing a design appear first",
          "Products with no image, or only images that fail to load, appear at the end",
          "Nothing is hidden — they stay in stock, in search, and on their own pages",
          'The same products are listed under Products → Filters → Images → "No images"',
        ]}
      />
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
