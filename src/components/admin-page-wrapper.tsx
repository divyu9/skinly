import { SidebarProvider } from "./admin-sidebar-context.tsx";
import { AdminAuthGuard } from "./admin-auth-guard.tsx";
import type { ReactNode } from "react";

export function AdminPageWrapper({ children }: { children: ReactNode }) {
  return (
    <AdminAuthGuard>
      <SidebarProvider>{children}</SidebarProvider>
    </AdminAuthGuard>
  );
}
