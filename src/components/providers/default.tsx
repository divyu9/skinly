import { useAuth } from "@clerk/clerk-react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ThemeProvider } from "next-themes";
import { convex } from "@/lib/convex";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@/components/providers/query-client";
import { UpdateCurrentUserProvider } from "@/components/providers/update-current-user";

export function DefaultProviders({ children }: { children: React.ReactNode }) {
  return (
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
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
    </ConvexProviderWithClerk>
  );
}
