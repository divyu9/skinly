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
  Truck,
  ChevronLeft,
  ChevronRight,
  Home,
  Bug,
  Coins,
  TrendingUp,
  FileText,
  Layout,
  Map,
  Sparkles,
} from "lucide-react";
import { useSidebar } from "./admin-sidebar-context.tsx";

export function AdminSidebar() {
  const location = useLocation();
  const { collapsed, setCollapsed } = useSidebar();

  const isActive = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(path + "/");
  };

  const navItems = [
    { path: "/backend-skinly/products", label: "Products", icon: Package },
    { path: "/backend-skinly/product-classification", label: "Classification", icon: Layers },
    { path: "/backend-skinly/collections", label: "Collections", icon: Layers },
    { path: "/backend-skinly/phone-collections", label: "Phone Collections", icon: Smartphone },
    { path: "/backend-skinly/product-fields-migration", label: "Fields Migration", icon: FileCode },
    { path: "/backend-skinly/orders", label: "Orders", icon: ShoppingCart },
    { path: "/backend-skinly/coupons", label: "Coupons", icon: Ticket },
    { path: "/backend-skinly/reviews", label: "Reviews", icon: Star },
    { path: "/backend-skinly/abandoned-carts", label: "Abandoned Carts", icon: ShoppingBag },
    { path: "/backend-skinly/stock-notifications", label: "Stock Alerts", icon: Bell },
    { path: "/backend-skinly/cod", label: "COD Settings", icon: CreditCard },
    { path: "/backend-skinly/shipping", label: "Shipping Settings", icon: Truck },
    { path: "/backend-skinly/wallet", label: "Wallet", icon: Wallet },
    { path: "/backend-skinly/cashback", label: "Cashback", icon: Coins },
    { path: "/backend-skinly/upsells", label: "Upsells", icon: TrendingUp },
    { path: "/backend-skinly/seo-templates", label: "SEO Templates", icon: Layout },
    { path: "/backend-skinly/seo-pages", label: "SEO Pages", icon: FileText },
    { path: "/backend-skinly/sitemap", label: "Sitemap", icon: Map },
    { path: "/backend-skinly/seo-generator", label: "SEO Generator", icon: Sparkles },
    { path: "/backend-skinly/settings", label: "Settings", icon: Settings },
    { path: "/backend-skinly/emails", label: "Email Templates", icon: Mail },
    { path: "/backend-skinly/bugs", label: "Bug Reports", icon: Bug },
    { path: "/backend-skinly/whatsapp", label: "WhatsApp", icon: MessageCircle },
    { path: "/backend-skinly/whatsapp/messages", label: "WA Messages", icon: MessageCircle },
    { path: "/backend-skinly/whatsapp/health", label: "WA Health", icon: MessageCircle },
    { path: "/backend-skinly/whatsapp/debug-logs", label: "WA Debug Logs", icon: MessageCircle },
    { path: "/backend-skinly/models", label: "Models", icon: Database },
    { path: "/backend-skinly/seed-models", label: "Seed DB", icon: Settings },
    { path: "/backend-skinly/oos", label: "OOS Settings", icon: Settings },
    { path: "/backend-skinly/mockups", label: "Mockups", icon: Image },
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
