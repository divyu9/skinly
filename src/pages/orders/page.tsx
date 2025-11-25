import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Link } from "react-router-dom";
import { PackageIcon, ChevronRightIcon } from "lucide-react";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { SignInButton } from "@/components/ui/signin.tsx";

function OrdersPageInner() {
  const orders = useQuery(api.orders.getOrders);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
      case "confirmed":
        return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      case "processing":
        return "bg-purple-500/10 text-purple-500 border-purple-500/20";
      case "shipped":
        return "bg-indigo-500/10 text-indigo-500 border-indigo-500/20";
      case "delivered":
        return "bg-green-500/10 text-green-500 border-green-500/20";
      case "cancelled":
        return "bg-red-500/10 text-red-500 border-red-500/20";
      default:
        return "";
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-IN", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/">
                <img
                  src="https://cdn.hercules.app/file_Qd06a0OWqeC2LadTl4tLLvmv"
                  alt="Skinly"
                  className="h-12"
                />
              </Link>
              <h1 className="text-2xl font-bold">My Orders</h1>
            </div>
            <Link to="/">
              <Button variant="outline" size="sm">
                Continue Shopping
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {orders === undefined ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-48 w-full" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <PackageIcon />
              </EmptyMedia>
              <EmptyTitle>No orders yet</EmptyTitle>
              <EmptyDescription>
                You haven't placed any orders. Start shopping to see your orders here!
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Link to="/products">
                <Button>Browse Products</Button>
              </Link>
            </EmptyContent>
          </Empty>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <Card key={order._id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{order.orderNumber}</CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        Placed on {formatDate(order._creationTime)}
                      </p>
                    </div>
                    <Badge className={getStatusColor(order.status)}>
                      {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Order Items */}
                    <div className="space-y-2">
                      {order.items.slice(0, 2).map((item, idx) => (
                        <div key={idx} className="flex gap-3">
                          {item.productImage && (
                            <div className="size-16 bg-muted rounded-lg overflow-hidden shrink-0">
                              <img
                                src={item.productImage}
                                alt={item.productTitle}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium line-clamp-2">
                              {item.productTitle}
                            </p>
                            {item.phoneModel && (
                              <p className="text-xs text-muted-foreground">
                                {item.phoneModel}
                              </p>
                            )}
                            <p className="text-sm text-muted-foreground">
                              Qty: {item.quantity}
                            </p>
                          </div>
                          <div className="text-sm font-semibold text-primary">
                            ₹{(item.price * item.quantity).toFixed(0)}
                          </div>
                        </div>
                      ))}
                      {order.items.length > 2 && (
                        <p className="text-sm text-muted-foreground">
                          +{order.items.length - 2} more item(s)
                        </p>
                      )}
                    </div>

                    {/* Order Total and View Button */}
                    <div className="flex items-center justify-between pt-4 border-t">
                      <div>
                        <p className="text-sm text-muted-foreground">Order Total</p>
                        <p className="text-xl font-bold text-primary">
                          ₹{order.total.toFixed(0)}
                        </p>
                      </div>
                      <Link to={`/orders/${order._id}`}>
                        <Button variant="outline">
                          View Details
                          <ChevronRightIcon className="size-4 ml-2" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function OrdersPage() {
  return (
    <>
      <Unauthenticated>
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <PackageIcon />
              </EmptyMedia>
              <EmptyTitle>Please sign in to view orders</EmptyTitle>
              <EmptyDescription>
                You need to be logged in to see your order history
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <SignInButton />
            </EmptyContent>
          </Empty>
        </div>
      </Unauthenticated>
      <AuthLoading>
        <div className="min-h-screen bg-background flex items-center justify-center">
          <Skeleton className="h-96 w-full max-w-4xl" />
        </div>
      </AuthLoading>
      <Authenticated>
        <OrdersPageInner />
      </Authenticated>
    </>
  );
}
