import { Link, useLocation } from "react-router-dom";
import { Button } from "./ui/button.tsx";
import { cn } from "@/lib/utils.ts";
import {
  Package,
  Layers,
  Smartphone,
  FileCode,
  ShoppingCart,
  Ticket,
  Star,
  ShoppingBag,
  Bell,
  CreditCard,
  Wallet,
  Mail,
  MessageCircle,
  Database,
  Settings,
  Image,
  ChevronLeft,
  ChevronRight,
  Home,
  Bug,
  Coins,
} from "lucide-react";
import { useSidebar } from "./admin-sidebar-context.tsx";

export function AdminSidebar() {
  const location = useLocation();
  const { collapsed, setCollapsed } = useSidebar();

  const isActive = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(path + "/");
  };

  const navItems = [
    { path: "/admin/products", label: "Products", icon: Package },
    { path: "/admin/collections", label: "Collections", icon: Layers },
    { path: "/admin/phone-collections", label: "Phone Collections", icon: Smartphone },
    { path: "/admin/product-fields-migration", label: "Fields Migration", icon: FileCode },
    { path: "/admin/orders", label: "Orders", icon: ShoppingCart },
    { path: "/admin/coupons", label: "Coupons", icon: Ticket },
    { path: "/admin/reviews", label: "Reviews", icon: Star },
    { path: "/admin/abandoned-carts", label: "Abandoned Carts", icon: ShoppingBag },
    { path: "/admin/stock-notifications", label: "Stock Alerts", icon: Bell },
    { path: "/admin/cod", label: "COD Settings", icon: CreditCard },
    { path: "/admin/wallet", label: "Wallet", icon: Wallet },
    { path: "/admin/cashback", label: "Cashback", icon: Coins },
    { path: "/admin/emails", label: "Email Templates", icon: Mail },
    { path: "/admin/bugs", label: "Bug Reports", icon: Bug },
    { path: "/admin/whatsapp", label: "WhatsApp", icon: MessageCircle },
    { path: "/admin/whatsapp/messages", label: "WA Messages", icon: MessageCircle },
    { path: "/admin/whatsapp/health", label: "WA Health", icon: MessageCircle },
    { path: "/admin/whatsapp/debug-logs", label: "WA Debug Logs", icon: MessageCircle },
    { path: "/admin/models", label: "Models", icon: Database },
    { path: "/admin/seed-models", label: "Seed DB", icon: Settings },
    { path: "/admin/oos", label: "OOS Settings", icon: Settings },
    { path: "/admin/mockups", label: "Mockups", icon: Image },
  ];

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 h-screen bg-card border-r flex flex-col transition-all duration-300 z-40",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo & Toggle */}
      <div className="p-4 border-b flex items-center justify-between">
        {!collapsed && (
          <Link to="/" className="flex items-center">
            <img
              src="https://cdn.hercules.app/file_Qd06a0OWqeC2LadTl4tLLvmv"
              alt="Skinly"
              className="h-8"
            />
          </Link>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCollapsed(!collapsed)}
          className={cn("shrink-0", collapsed && "mx-auto")}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-2">
        <div className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground hover:bg-accent hover:text-accent-foreground",
                  collapsed && "justify-center"
                )}
                title={collapsed ? item.label : undefined}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* View Store Button */}
      <div className="p-4 border-t">
        <Link to="/">
          <Button
            variant="outline"
            size="sm"
            className={cn("w-full", collapsed && "px-2")}
          >
            <Home className="h-4 w-4" />
            {!collapsed && <span className="ml-2">View Store</span>}
          </Button>
        </Link>
      </div>
    </aside>
  );
}
