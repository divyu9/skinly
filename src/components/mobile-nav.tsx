import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { useAuth } from "@/hooks/use-auth.ts";
import { Button } from "@/components/ui/button.tsx";
import { CartButton } from "@/components/cart.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Separator } from "@/components/ui/separator.tsx";
import { toast } from "sonner";
import {
  MenuIcon,
  SmartphoneIcon,
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
} from "lucide-react";

interface MobileNavProps {
  onGadgetSelectorClick?: () => void;
  onPhoneSelectorClick?: () => void;
}

export function MobileNav({ onGadgetSelectorClick, onPhoneSelectorClick }: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const [accountPanelOpen, setAccountPanelOpen] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState("");
  
  const { user, signoutRedirect } = useAuth();
  const profileData = useQuery(api.users.getProfileData, user ? {} : "skip");
  const updateProfile = useMutation(api.users.updateProfile);

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

  const menuItems = [
    {
      label: "Home",
      icon: LayoutGridIcon,
      href: "/",
    },
    {
      label: "Shop",
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
      label: "My Account",
      icon: UserIcon,
      href: "/account",
    },
  ];

  return (
    <>
      {/* Desktop Navigation */}
      <div className="hidden md:flex items-center gap-6">
        <Link to="/" className="text-sm font-medium hover:text-primary transition-colors">
          Home
        </Link>
        <Link to="/products" className="text-sm font-medium hover:text-primary transition-colors">
          Shop
        </Link>
        <Link to="/devices" className="text-sm font-medium hover:text-primary transition-colors">
          Devices
        </Link>
        
        {/* My Account Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="text-sm font-medium hover:text-primary">
              <UserIcon className="size-4 mr-2" />
              My Account
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {user ? (
              <>
                <DropdownMenuItem onClick={() => setAccountPanelOpen(true)}>
                  <UserIcon className="size-4 mr-2" />
                  View Profile
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/orders" className="cursor-pointer">
                    <ShoppingBagIcon className="size-4 mr-2" />
                    My Orders
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOutIcon className="size-4 mr-2" />
                  Logout
                </DropdownMenuItem>
              </>
            ) : (
              <DropdownMenuItem asChild>
                <SignInButton className="w-full cursor-pointer">
                  <LogInIcon className="size-4 mr-2" />
                  Sign In
                </SignInButton>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        
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
            <div className="flex items-center gap-3">
              <img 
                src="https://cdn.hercules.app/file_Qd06a0OWqeC2LadTl4tLLvmv" 
                alt="Skinly" 
                className="h-10"
              />
            </div>
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

      {/* My Account Panel (Right Side) */}
      <Sheet open={accountPanelOpen} onOpenChange={setAccountPanelOpen}>
        <SheetContent side="right" className="w-[90vw] sm:w-[400px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>My Account</SheetTitle>
          </SheetHeader>
          
          {user ? (
            <div className="mt-6 space-y-4">
              {/* Name Section */}
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground mb-1">Name</p>
                      {editingName ? (
                        <div className="flex items-center gap-2">
                          <Input
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            placeholder="Enter your name"
                            className="h-9"
                          />
                          <Button size="icon" variant="ghost" onClick={handleSaveName} className="size-8">
                            <CheckIcon className="size-4 text-green-600" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={handleCancelEdit} className="size-8">
                            <XIcon className="size-4 text-red-600" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <p className="text-lg font-semibold">
                            Hi, {profileData?.name || "Guest"}
                          </p>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={handleEditName}
                            className="size-7"
                          >
                            <PencilIcon className="size-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Contact Information */}
              <Card>
                <CardContent className="pt-6 space-y-4">
                  <div>
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <MailIcon className="size-4" />
                      <p className="text-xs">Email</p>
                    </div>
                    <p className="text-sm font-medium pl-6">
                      {profileData?.email || "Not provided"}
                    </p>
                  </div>
                  
                  <Separator />
                  
                  <div>
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <PhoneIcon className="size-4" />
                      <p className="text-xs">Phone</p>
                    </div>
                    <p className="text-sm font-medium pl-6">
                      {profileData?.phone || "Not provided"}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* My Orders Button */}
              <Button asChild className="w-full" variant="outline" size="lg">
                <Link to="/orders" onClick={() => setAccountPanelOpen(false)}>
                  <ShoppingBagIcon className="size-4 mr-2" />
                  My Orders
                </Link>
              </Button>

              {/* Wallet Information */}
              <Card>
                <CardContent className="pt-6 space-y-4">
                  <div>
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <WalletIcon className="size-4" />
                      <p className="text-xs">Wallet Balance</p>
                    </div>
                    <p className="text-2xl font-bold text-primary pl-6">
                      ₹{profileData?.walletBalance?.toFixed(2) || "0.00"}
                    </p>
                  </div>
                  
                  <Separator />
                  
                  <div>
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <TrophyIcon className="size-4" />
                      <p className="text-xs">Cashback Earned</p>
                    </div>
                    <p className="text-2xl font-bold text-green-600 pl-6">
                      ₹{profileData?.totalCashbackEarned?.toFixed(2) || "0.00"}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Logout Button */}
              <Button
                variant="destructive"
                className="w-full"
                size="lg"
                onClick={handleLogout}
              >
                <LogOutIcon className="size-4 mr-2" />
                Logout
              </Button>
            </div>
          ) : (
            <div className="mt-6 space-y-6">
              {/* Welcome Message */}
              <Card>
                <CardContent className="pt-6 text-center space-y-4">
                  <div className="size-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                    <UserIcon className="size-10 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold mb-2">Welcome to Skinly!</h3>
                    <p className="text-sm text-muted-foreground">
                      Sign in to access your account, view orders, and manage your wallet.
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Sign In Button */}
              <SignInButton className="w-full" size="lg">
                <LogInIcon className="size-4 mr-2" />
                Sign In
              </SignInButton>

              {/* Benefits List */}
              <Card>
                <CardContent className="pt-6">
                  <h4 className="font-semibold mb-3 text-sm">Benefits of signing in:</h4>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <CheckIcon className="size-4 text-primary mt-0.5 shrink-0" />
                      <span>Track your orders in real-time</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckIcon className="size-4 text-primary mt-0.5 shrink-0" />
                      <span>Manage your wallet and cashback</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckIcon className="size-4 text-primary mt-0.5 shrink-0" />
                      <span>Save your favorite designs</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckIcon className="size-4 text-primary mt-0.5 shrink-0" />
                      <span>Faster checkout experience</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
