import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { useAuth } from "@/hooks/use-auth.ts";
import { Button } from "@/components/ui/button.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet.tsx";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Separator } from "@/components/ui/separator.tsx";
import { toast } from "sonner";
import {
  MenuIcon,
  PackageIcon,
  ShoppingBagIcon,
  UserIcon,
  ListIcon,
  LayoutGridIcon,
  PencilIcon,
  MailIcon,
  PhoneIcon,
  WalletIcon,
  TrophyIcon,
  LogOutIcon,
  CheckIcon,
  XIcon,
  LogInIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from "lucide-react";

interface MobileNavProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onGadgetSelectorClick?: () => void;
  onPhoneSelectorClick?: () => void;
}

export function MobileNav({ open: controlledOpen, onOpenChange, onGadgetSelectorClick, onPhoneSelectorClick }: MobileNavProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [accountPanelOpen, setAccountPanelOpen] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState("");
  const [shopExpanded, setShopExpanded] = useState(true); // Default to expanded
  
  // Use controlled state if provided, otherwise use internal state
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = onOpenChange || setInternalOpen;
  
  const navigate = useNavigate();
  const { user, signoutRedirect } = useAuth();
  const profileData = useQuery(api.users.getProfileData, user ? {} : "skip");
  const updateProfile = useMutation(api.users.updateProfile);
  const categories = useQuery(api.productCategories.listAllWithCounts, {});

  const handleEditName = () => {
    setNewName(profileData?.name || "");
    setEditingName(true);
  };

  const handleSaveName = async () => {
    if (!newName.trim()) {
      toast.error("Name cannot be empty");
      return;
    }
    
    try {
      await updateProfile({ name: newName.trim() });
      toast.success("Name updated successfully");
      setEditingName(false);
    } catch (error) {
      toast.error("Failed to update name");
    }
  };

  const handleCancelEdit = () => {
    setEditingName(false);
    setNewName("");
  };

  const handleLogout = async () => {
    setAccountPanelOpen(false);
    await signoutRedirect();
  };

  const handleCategoryClick = (href: string) => {
    setOpen(false);
    // Use navigate instead of window.location.href to avoid full page reload
    navigate(href);
  };

  const menuItems = [
    {
      label: "Home",
      icon: LayoutGridIcon,
      href: "/",
    },
    {
      label: "Shop",
      icon: PackageIcon,
      isCollapsible: true,
      subItems: (categories || []).map(cat => ({
        label: cat.displayName,
        href: `/products?productType=${cat.id}`,
      })),
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
      label: "Gadget Selector",
      icon: LayoutGridIcon,
      onClick: () => {
        setOpen(false);
        onGadgetSelectorClick?.();
      },
    },
    {
      label: "My Account",
      icon: UserIcon,
      href: "/account",
    },
  ];

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="left" className="w-[300px] p-0">
        <SheetHeader className="p-6 pb-4">
          <SheetTitle className="text-left">Menu</SheetTitle>
        </SheetHeader>
        
        <div className="flex flex-col h-[calc(100vh-80px)]">
          {/* Menu Items */}
          <nav className="flex-1 px-4 space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              
              // Collapsible item (Shop with categories)
              if (item.isCollapsible && item.subItems) {
                return (
                  <Collapsible key={item.label} open={shopExpanded} onOpenChange={setShopExpanded}>
                    <CollapsibleTrigger asChild>
                      <button className="w-full flex items-center justify-between gap-3 px-3 py-3 rounded-lg hover:bg-muted transition-colors text-left">
                        <div className="flex items-center gap-3">
                          <Icon className="size-5 text-muted-foreground" />
                          <span className="font-medium">{item.label}</span>
                        </div>
                        {shopExpanded ? (
                          <ChevronUpIcon className="size-4 text-muted-foreground" />
                        ) : (
                          <ChevronDownIcon className="size-4 text-muted-foreground" />
                        )}
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pl-11 pr-3 space-y-1 mt-1">
                      {/* Link to all products */}
                      <button
                        onClick={() => handleCategoryClick("/products")}
                        className="w-full text-left block px-3 py-2 rounded-lg hover:bg-muted transition-colors text-sm"
                      >
                        All Products
                      </button>
                      {/* Category links */}
                      {item.subItems.map((subItem) => (
                        <button
                          key={subItem.href}
                          onClick={() => handleCategoryClick(subItem.href)}
                          className="w-full text-left block px-3 py-2 rounded-lg hover:bg-muted transition-colors text-sm"
                        >
                          {subItem.label}
                        </button>
                      ))}
                    </CollapsibleContent>
                  </Collapsible>
                );
              }
              
              // Click action item
              if (item.onClick) {
                return (
                  <button
                    key={item.label}
                    onClick={item.onClick}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-muted transition-colors text-left"
                  >
                    <Icon className="size-5 text-muted-foreground" />
                    <span className="font-medium">{item.label}</span>
                  </button>
                );
              }
              
              // Regular link item
              return (
                <Link
                  key={item.label}
                  to={item.href!}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-muted transition-colors"
                >
                  <Icon className="size-5 text-muted-foreground" />
                  <span className="font-medium">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <Separator />

          {/* Account Section */}
          <div className="p-4">
            {user ? (
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="size-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-semibold">
                        {profileData?.name?.[0]?.toUpperCase() || "U"}
                      </div>
                      <div className="flex-1">
                        {editingName ? (
                          <div className="space-y-2">
                            <Input
                              value={newName}
                              onChange={(e) => setNewName(e.target.value)}
                              placeholder="Enter your name"
                              className="h-8"
                            />
                            <div className="flex gap-2">
                              <Button size="sm" onClick={handleSaveName} className="h-7 px-2">
                                <CheckIcon className="size-3" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={handleCancelEdit} className="h-7 px-2">
                                <XIcon className="size-3" />
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <p className="font-semibold text-sm">{profileData?.name || "User"}</p>
                            <p className="text-xs text-muted-foreground">{profileData?.email}</p>
                          </>
                        )}
                      </div>
                    </div>
                    {!editingName && (
                      <Button size="sm" variant="ghost" onClick={handleEditName} className="h-7 w-7 p-0">
                        <PencilIcon className="size-3" />
                      </Button>
                    )}
                  </div>
                  
                  {/* Wallet Balance */}
                  {profileData && (
                    <div className="mb-3 p-3 bg-muted rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <WalletIcon className="size-4 text-muted-foreground" />
                          <span className="text-sm font-medium">Wallet Balance</span>
                        </div>
                        <span className="font-bold">₹{profileData.walletBalance?.toFixed(2) || "0.00"}</span>
                      </div>
                    </div>
                  )}
                  
                  <Button onClick={handleLogout} variant="outline" size="sm" className="w-full">
                    <LogOutIcon className="size-4 mr-2" />
                    Sign Out
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <SignInButton className="w-full">
                <LogInIcon className="size-4 mr-2" />
                Sign In
              </SignInButton>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
