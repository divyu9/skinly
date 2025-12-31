import { useConvexAuth } from "@/hooks/use-convex-auth";
import { ConvexProviderWithAuth } from "convex/react";
import { ThemeProvider } from "next-themes";
import { convex } from "@/lib/convex";
import { useAuth } from "@clerk/clerk-react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@/components/providers/query-client";
import { UpdateCurrentUserProvider } from "@/components/providers/update-current-user";

export function DefaultProviders({ children }: { children: React.ReactNode }) {
  return (
    <ConvexProviderWithAuth client={convex} useAuth={useConvexAuth}>
      <QueryClientProvider>
        <UpdateCurrentUserProvider>
          <TooltipProvider>
            <ThemeProvider
              attribute="class"
              defaultTheme="light"
              enableSystem
            >
              <Toaster />
              {children}
            </ThemeProvider>
          </TooltipProvider>
        </UpdateCurrentUserProvider>
      </QueryClientProvider>
    </ConvexProviderWithAuth>
  );
}
