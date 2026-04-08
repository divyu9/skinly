import { ThemeProvider } from "next-themes";
import { convex } from "@/lib/convex";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@/components/providers/query-client";
import { UpdateCurrentUserProvider } from "@/components/providers/update-current-user";
import { ConvexProvider } from "@/lib/firebase-hooks";

export function DefaultProviders({ children }: { children: React.ReactNode }) {
  return (
    <ConvexProvider client={convex}>
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
    </ConvexProvider>
  );
}
