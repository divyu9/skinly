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
  ChevronDown,
  ChevronUp,
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
import { useState, useEffect } from "react";

interface NavItem {
  path: string;
  label: string;
  icon: typeof Package;
}

interface NavCategory {
  id: string;
  label: string;
  icon: typeof Package;
  items: NavItem[];
}

export function AdminSidebar() {
  const location = useLocation();
  const { collapsed, setCollapsed } = useSidebar();

  // Load expanded state from localStorage
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(() => {
    const stored = localStorage.getItem("admin-sidebar-expanded");
    if (stored) {
      try {
        return new Set(JSON.parse(stored));
      } catch {
        return new Set(["products", "orders", "marketing", "seo", "communications", "settings"]);
      }
    }
    return new Set(["products", "orders", "marketing", "seo", "communications", "settings"]);
  });

  // Save expanded state to localStorage
  useEffect(() => {
    localStorage.setItem("admin-sidebar-expanded", JSON.stringify([...expandedCategories]));
  }, [expandedCategories]);

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  const isActive = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(path + "/");
  };

  const categories: NavCategory[] = [
    {
      id: "products",
      label: "Products & Inventory",
      icon: Package,
      items: [
        { path: "/backend-skinly/products", label: "Products", icon: Package },
        { path: "/backend-skinly/product-classification", label: "Classification", icon: Layers },
        { path: "/backend-skinly/collections", label: "Collections", icon: Layers },
        { path: "/backend-skinly/phone-collections", label: "Phone Collections", icon: Smartphone },
        { path: "/backend-skinly/product-fields-migration", label: "Fields Migration", icon: FileCode },
        { path: "/backend-skinly/models", label: "Models", icon: Database },
        { path: "/backend-skinly/mockups", label: "Mockups", icon: Image },
      ],
    },
    {
      id: "orders",
      label: "Orders & Sales",
      icon: ShoppingCart,
      items: [
        { path: "/backend-skinly/orders", label: "Orders", icon: ShoppingCart },
        { path: "/backend-skinly/abandoned-carts", label: "Abandoned Carts", icon: ShoppingBag },
        { path: "/backend-skinly/stock-notifications", label: "Stock Alerts", icon: Bell },
      ],
    },
    {
      id: "marketing",
      label: "Marketing & Promotions",
      icon: TrendingUp,
      items: [
        { path: "/backend-skinly/coupons", label: "Coupons", icon: Ticket },
        { path: "/backend-skinly/reviews", label: "Reviews", icon: Star },
        { path: "/backend-skinly/upsells", label: "Upsells", icon: TrendingUp },
        { path: "/backend-skinly/cashback", label: "Cashback", icon: Coins },
        { path: "/backend-skinly/wallet", label: "Wallet", icon: Wallet },
      ],
    },
    {
      id: "seo",
      label: "SEO & Content",
      icon: FileText,
      items: [
        { path: "/backend-skinly/seo-templates", label: "SEO Templates", icon: Layout },
        { path: "/backend-skinly/seo-pages", label: "SEO Pages", icon: FileText },
        { path: "/backend-skinly/seo-generator", label: "SEO Generator", icon: Sparkles },
        { path: "/backend-skinly/sitemap", label: "Sitemap", icon: Map },
      ],
    },
    {
      id: "communications",
      label: "Communications",
      icon: MessageCircle,
      items: [
        { path: "/backend-skinly/whatsapp", label: "WhatsApp", icon: MessageCircle },
        { path: "/backend-skinly/whatsapp/messages", label: "WA Messages", icon: MessageCircle },
        { path: "/backend-skinly/whatsapp/health", label: "WA Health", icon: MessageCircle },
        { path: "/backend-skinly/whatsapp/debug-logs", label: "WA Debug Logs", icon: MessageCircle },
        { path: "/backend-skinly/emails", label: "Email Templates", icon: Mail },
      ],
    },
    {
      id: "settings",
      label: "Settings & Configuration",
      icon: Settings,
      items: [
        { path: "/backend-skinly/cod", label: "COD Settings", icon: CreditCard },
        { path: "/backend-skinly/shipping", label: "Shipping Settings", icon: Truck },
        { path: "/backend-skinly/settings", label: "Settings", icon: Settings },
        { path: "/backend-skinly/seed-models", label: "Seed DB", icon: Settings },
        { path: "/backend-skinly/oos", label: "OOS Settings", icon: Settings },
        { path: "/backend-skinly/bugs", label: "Bug Reports", icon: Bug },
      ],
    },
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
        {collapsed ? (
          // Show flat list of icons when collapsed
          <div className="space-y-1">
            {categories.flatMap((category) =>
              category.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={cn(
                      "flex items-center justify-center px-3 py-2 rounded-md text-sm font-medium transition-colors",
                      active
                        ? "bg-primary text-primary-foreground"
                        : "text-foreground hover:bg-accent hover:text-accent-foreground"
                    )}
                    title={item.label}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                  </Link>
                );
              })
            )}
          </div>
        ) : (
          // Show grouped categories when expanded
          <div className="space-y-2">
            {categories.map((category) => {
              const CategoryIcon = category.icon;
              const isExpanded = expandedCategories.has(category.id);
              const hasActiveItem = category.items.some((item) => isActive(item.path));

              return (
                <div key={category.id}>
                  {/* Category Header */}
                  <button
                    onClick={() => toggleCategory(category.id)}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm font-semibold transition-colors",
                      hasActiveItem
                        ? "text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent"
                    )}
                  >
                    <CategoryIcon className="h-4 w-4 shrink-0" />
                    <span className="flex-1 text-left">{category.label}</span>
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 shrink-0" />
                    ) : (
                      <ChevronDown className="h-4 w-4 shrink-0" />
                    )}
                  </button>

                  {/* Category Items */}
                  {isExpanded && (
                    <div className="ml-2 mt-1 space-y-1">
                      {category.items.map((item) => {
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
                                : "text-foreground hover:bg-accent hover:text-accent-foreground"
                            )}
                          >
                            <Icon className="h-4 w-4 shrink-0" />
                            <span>{item.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
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
