import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button.tsx";
import { CartButton } from "@/components/cart.tsx";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet.tsx";
import {
  MenuIcon,
  SmartphoneIcon,
  PackageIcon,
  ShoppingBagIcon,
  UserIcon,
  ListIcon,
  LayoutGridIcon,
} from "lucide-react";

interface MobileNavProps {
  onGadgetSelectorClick?: () => void;
  onPhoneSelectorClick?: () => void;
}

export function MobileNav({ onGadgetSelectorClick, onPhoneSelectorClick }: MobileNavProps) {
  const [open, setOpen] = useState(false);

  const menuItems = [
    {
      label: "Gadget Selector",
      icon: LayoutGridIcon,
      onClick: () => {
        setOpen(false);
        onGadgetSelectorClick?.();
      },
    },
    {
      label: "Phone Selector",
      icon: SmartphoneIcon,
      onClick: () => {
        setOpen(false);
        onPhoneSelectorClick?.();
      },
    },
    {
      label: "All Products",
      icon: PackageIcon,
      href: "/products",
    },
    {
      label: "Devices",
      icon: ListIcon,
      href: "/devices",
    },
    {
      label: "My Orders",
      icon: ShoppingBagIcon,
      href: "/orders",
    },
    {
      label: "My Account",
      icon: UserIcon,
      href: "/account",
    },
  ];

  return (
    <>
      {/* Desktop Navigation */}
      <div className="hidden md:flex items-center gap-6">
        <a href="#products" className="text-sm font-medium hover:text-primary transition-colors">
          Categories
        </a>
        <Link to="/products" className="text-sm font-medium hover:text-primary transition-colors">
          All Products
        </Link>
        <Link to="/devices" className="text-sm font-medium hover:text-primary transition-colors">
          Devices
        </Link>
        <Link to="/orders" className="text-sm font-medium hover:text-primary transition-colors">
          My Orders
        </Link>
        <CartButton />
      </div>

      {/* Mobile Navigation */}
      <div className="flex md:hidden items-center gap-3">
        <CartButton />
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setOpen(true)}
          className="md:hidden"
        >
          <MenuIcon className="size-6" />
        </Button>
      </div>

      {/* Mobile Slide-out Menu */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-[70vw] sm:w-[350px]">
          <SheetHeader>
            <SheetTitle className="text-left">Menu</SheetTitle>
          </SheetHeader>
          <div className="mt-8 flex flex-col gap-1">
            {menuItems.map((item) => (
              <Button
                key={item.label}
                variant="ghost"
                className="w-full justify-start gap-3 h-12 text-base"
                asChild={!!item.href}
                onClick={item.onClick}
              >
                {item.href ? (
                  <Link to={item.href} onClick={() => setOpen(false)}>
                    <item.icon className="size-5" />
                    {item.label}
                  </Link>
                ) : (
                  <>
                    <item.icon className="size-5" />
                    {item.label}
                  </>
                )}
              </Button>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
