import { useState } from "react";
import { Link } from "react-router-dom";
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
  
  // Use controlled state if provided, otherwise use internal state
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = onOpenChange || setInternalOpen;
  
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

  return null;
}
