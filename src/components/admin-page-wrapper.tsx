import { SidebarProvider } from "./admin-sidebar-context.tsx";
import type { ReactNode } from "react";

export function AdminPageWrapper({ children }: { children: ReactNode }) {
  return <SidebarProvider>{children}</SidebarProvider>;
}
