import { SidebarProvider } from "./admin-sidebar-context.tsx";
import { AdminAuthGuard } from "./admin-auth-guard.tsx";
import { AdminErrorBoundary } from "./admin-error-boundary.tsx";
import type { ReactNode } from "react";

export function AdminPageWrapper({ children }: { children: ReactNode }) {
  return (
    <AdminAuthGuard>
      <SidebarProvider>
        {/* `admin-shell` puts `--primary` back to the neutral near-black the
            storefront now overrides with the brand green. */}
        <div className="admin-shell">
          <AdminErrorBoundary>{children}</AdminErrorBoundary>
        </div>
      </SidebarProvider>
    </AdminAuthGuard>
  );
}
