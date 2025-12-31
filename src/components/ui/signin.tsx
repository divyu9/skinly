import { forwardRef, useCallback } from "react";
import type { VariantProps } from "class-variance-authority";
import { Loader2, LogIn, LogOut } from "lucide-react";
import { useAuth } from "@clerk/clerk-react";
import { SignInButton as ClerkSignInButton } from "@clerk/clerk-react";
import { Button, buttonVariants } from "@/components/ui/button";

export interface SignInButtonProps
  extends Omit<React.ComponentProps<"button">, "onClick">,
    VariantProps<typeof buttonVariants> {
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  showIcon?: boolean;
  signInText?: string;
  signOutText?: string;
  loadingText?: string;
  asChild?: boolean;
}

export const SignInButton = forwardRef<HTMLButtonElement, SignInButtonProps>(
  (
    {
      onClick,
      disabled,
      showIcon = true,
      signInText = "Sign In",
      signOutText = "Sign Out",
      loadingText,
      className,
      variant,
      size,
      asChild = false,
      ...props
    },
    ref,
  ) => {
    const { isLoaded, isSignedIn, signOut } = useAuth();

    const handleSignOut = useCallback(
      async (event: React.MouseEvent<HTMLButtonElement>) => {
        onClick?.(event);
        await signOut();
      },
      [signOut, onClick],
    );

    if (!isLoaded) {
      return (
        <Button disabled variant={variant} size={size} className={className}>
          <Loader2 className="size-4 animate-spin" />
          {loadingText || "Loading..."}
        </Button>
      );
    }

    // ✅ SIGNED IN → SIGN OUT BUTTON
    if (isSignedIn) {
      return (
        <Button
          ref={ref}
          onClick={handleSignOut}
          disabled={disabled}
          variant={variant}
          size={size}
          className={className}
          asChild={asChild}
          aria-label="Sign out of your account"
          {...props}
        >
          {showIcon && <LogOut className="size-4" />}
          {signOutText}
        </Button>
      );
    }

    // ❌ NOT SIGNED IN → CLERK SIGN IN MODAL
    return (
      <ClerkSignInButton mode="modal">
        <Button
          ref={ref}
          disabled={disabled}
          variant={variant}
          size={size}
          className={className}
          asChild={asChild}
          aria-label="Sign in to your account"
          {...props}
        >
          {showIcon && <LogIn className="size-4" />}
          {signInText}
        </Button>
      </ClerkSignInButton>
    );
  },
);

SignInButton.displayName = "SignInButton";
