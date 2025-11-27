import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { SignInButton } from "@/components/ui/signin.tsx";
import { useAuth } from "@/hooks/use-auth.ts";
import { CartButton } from "@/components/cart.tsx";
import { MobileNav } from "@/components/mobile-nav.tsx";
import type { Doc } from "@/convex/_generated/dataModel.d.ts";
import {
  UserIcon,
  MailIcon,
  ShoppingBagIcon,
  LogOutIcon,
  PackageIcon,
} from "lucide-react";

function AccountPageInner() {
  const { signoutRedirect } = useAuth();
  const currentUser = useQuery(api.users.getCurrentUser);
  const recentOrders = useQuery(api.orders.getOrders, { limit: 5 }) as Doc<"orders">[] | undefined;

  if (currentUser === undefined || recentOrders === undefined) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="space-y-6">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Profile Card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserIcon className="size-5" />
            My Account
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-4">
            <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center">
              <UserIcon className="size-8 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-semibold">{currentUser?.name || "User"}</h3>
              {currentUser?.email && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                  <MailIcon className="size-4" />
                  {currentUser.email}
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-2">
                Member since {new Date(currentUser?._creationTime || Date.now()).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
              </p>
            </div>
          </div>

          <div className="pt-4 border-t">
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => signoutRedirect()}
            >
              <LogOutIcon className="size-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Recent Orders */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <ShoppingBagIcon className="size-5" />
              Recent Orders
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/orders">View All</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {recentOrders && recentOrders.length > 0 ? (
            <div className="space-y-3">
              {recentOrders.map((order) => (
                <Link
                  key={order._id}
                  to={`/orders/${order._id}`}
                  className="block p-4 border rounded-lg hover:border-primary transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-sm">Order #{order._id.slice(-8)}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          order.status === 'delivered' ? 'bg-green-100 text-green-700' :
                          order.status === 'shipped' ? 'bg-blue-100 text-blue-700' :
                          order.status === 'processing' ? 'bg-blue-100 text-blue-700' :
                          order.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {order.status}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {new Date(order._creationTime).toLocaleDateString('en-IN', { 
                          day: 'numeric', 
                          month: 'short', 
                          year: 'numeric' 
                        })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">₹{order.total.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">{order.items.length} item{order.items.length > 1 ? 's' : ''}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <PackageIcon className="size-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground mb-4">No orders yet</p>
              <Button asChild>
                <Link to="/products">Start Shopping</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function AccountPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 w-full bg-background/80 backdrop-blur-lg border-b border-border z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img 
              src="https://cdn.hercules.app/file_Qd06a0OWqeC2LadTl4tLLvmv" 
              alt="Skinly" 
              className="h-12 md:h-16"
            />
          </Link>
          <MobileNav />
        </div>
      </nav>

      <div className="pt-24 pb-12">
        <AuthLoading>
          <div className="container mx-auto px-4 py-8 max-w-4xl">
            <div className="space-y-6">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          </div>
        </AuthLoading>

        <Unauthenticated>
          <div className="container mx-auto px-4 py-8 max-w-2xl text-center">
            <UserIcon className="size-16 text-muted-foreground mx-auto mb-4" />
            <h1 className="text-3xl font-bold mb-4">Sign In Required</h1>
            <p className="text-muted-foreground mb-6">
              Please sign in to view your account details and orders
            </p>
            <SignInButton />
          </div>
        </Unauthenticated>

        <Authenticated>
          <AccountPageInner />
        </Authenticated>
      </div>
    </div>
  );
}
