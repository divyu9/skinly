import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { TrendingUpIcon } from "lucide-react";

export function MostTrendyTab() {
  const sections = useQuery(api.homepage.getAllHomepageSections);
  const section = sections?.find((s) => s.sectionType === "most_trendy");

  if (sections === undefined) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!section) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <TrendingUpIcon className="w-12 h-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground text-center">
            Most Trendy section not found in database.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Most Trendy Configuration</h3>
        <p className="text-sm text-muted-foreground">
          Configure the Most Trendy section in the Settings tab (config field).
        </p>
      </div>
      
      <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
        <CardContent className="py-4">
          <p className="text-sm text-blue-900 dark:text-blue-100 mb-2">
            <strong>Note:</strong> The Most Trendy section automatically fetches products based on tags configured in the section's config.
          </p>
          <p className="text-xs text-blue-800 dark:text-blue-200">
            Section ID: {section._id}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
