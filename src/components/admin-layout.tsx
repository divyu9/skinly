import { AdminSidebar } from "./admin-sidebar.tsx";
import { useSidebar } from "./admin-sidebar-context.tsx";
import { cn } from "@/lib/utils.ts";
import type { ReactNode } from "react";

interface AdminLayoutProps {
  children: ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const { collapsed } = useSidebar();

  return (
    <div className="flex min-h-screen">
      <AdminSidebar />
      <main className={cn(
        "flex-1 transition-all duration-300",
        collapsed ? "ml-16" : "ml-64"
      )}>
        <div className="container mx-auto p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
