import { MenuIcon } from "lucide-react";
import { AdminSidebar } from "./admin-sidebar.tsx";
import { useSidebar } from "./admin-sidebar-context.tsx";
import { BrandLogo } from "./brand-logo.tsx";
import { cn } from "@/lib/utils.ts";
import type { ReactNode } from "react";

interface AdminLayoutProps {
  children: ReactNode;
}

/**
 * Sidebar beside the page from md up; below that the page gets the whole
 * width and the sidebar becomes a drawer behind a menu button. It used to be
 * fixed at 256px on every screen, which left a phone about 120px of page.
 */
export function AdminLayout({ children }: AdminLayoutProps) {
  const { collapsed, mobileOpen, setMobileOpen } = useSidebar();

  return (
    <div className="flex min-h-screen">
      <AdminSidebar />
      {mobileOpen && (
        <button
          aria-label="Close menu"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px] md:hidden"
        />
      )}
      <main className={cn(
        "min-w-0 flex-1 transition-all duration-300",
        collapsed ? "md:ml-16" : "md:ml-64"
      )}>
        <div className="sticky top-0 z-30 flex items-center gap-3 border-b bg-card/95 px-4 py-2.5 backdrop-blur md:hidden">
          <button
            aria-label="Open menu"
            onClick={() => setMobileOpen(true)}
            className="grid size-9 place-items-center rounded-lg border-2 border-ink/15"
          >
            <MenuIcon className="size-5" />
          </button>
          <BrandLogo type="header" imgClassName="h-7" />
        </div>
        <div className="container mx-auto p-4 md:p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
