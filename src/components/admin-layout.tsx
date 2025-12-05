import { AdminSidebar } from "./admin-sidebar.tsx";
import type { ReactNode } from "react";

interface AdminLayoutProps {
  children: ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <div className="flex min-h-screen">
      <AdminSidebar />
      <main className="flex-1 ml-64 transition-all duration-300">
        <div className="container mx-auto p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
