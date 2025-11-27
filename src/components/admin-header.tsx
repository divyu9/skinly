import { Link, useLocation } from "react-router-dom";
import { Button } from "./ui/button.tsx";
import { cn } from "@/lib/utils.ts";

export function AdminHeader() {
  const location = useLocation();
  
  const isActive = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(path + "/");
  };
  
  const navLinks = [
    { path: "/admin/products", label: "Products" },
    { path: "/admin/collections", label: "Collections" },
    { path: "/admin/phone-collections", label: "Phone Collections" },
    { path: "/admin/product-fields-migration", label: "Fields Migration" },
    { path: "/admin/orders", label: "Orders" },
    { path: "/admin/coupons", label: "Coupons" },
    { path: "/admin/reviews", label: "Reviews" },
    { path: "/admin/abandoned-carts", label: "Abandoned Carts" },
    { path: "/admin/stock-notifications", label: "Stock Alerts" },
    { path: "/admin/models", label: "Models" },
    { path: "/admin/seed-models", label: "Seed DB" },
    { path: "/admin/oos", label: "OOS Settings" },
    { path: "/admin/mockups", label: "Mockups" },
  ];
  
  return (
    <header className="border-b bg-card sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img
              src="https://cdn.hercules.app/file_Qd06a0OWqeC2LadTl4tLLvmv"
              alt="Skinly"
              className="h-12"
            />
          </Link>
          <nav className="flex items-center gap-6">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={cn(
                  "text-sm font-medium transition-colors hover:text-primary",
                  isActive(link.path) ? "text-primary" : "text-foreground"
                )}
              >
                {link.label}
              </Link>
            ))}
            <Link to="/">
              <Button variant="outline" size="sm">
                View Store
              </Button>
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
