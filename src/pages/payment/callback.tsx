import { useEffect, useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { useAction, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import { CheckCircle2Icon, XCircleIcon, AlertCircleIcon } from "lucide-react";
import { trackPurchase } from "@/lib/analytics.ts";

export default function PaymentCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const checkPaymentStatus = useAction(api.phonepe.checkPaymentStatus);
  const [status, setStatus] = useState<"loading" | "success" | "failed" | "error">("loading");
  const [merchantTransactionId, setMerchantTransactionId] = useState<string | null>(null);
  
  // Fetch order only when payment is successful and we have merchantTransactionId
  const order = useQuery(
    api.orders.getOrderByMerchantTransaction,
    status === "success" && merchantTransactionId ? { merchantTransactionId } : "skip"
  );
  
  // Track purchase when order is loaded
  const [hasTracked, setHasTracked] = useState(false);
  useEffect(() => {
    if (order && status === "success" && !hasTracked) {
      // Track the purchase
      trackPurchase(
        order._id,
        order.total,
        order.items.map(item => ({
          id: item.productId,
          name: `${item.productTitle} - ${item.variant}`,
          price: item.price,
          quantity: item.quantity
        }))
      );
      setHasTracked(true);
    }
  }, [order, status, hasTracked]);

  // Get merchant transaction ID from URL params
  useEffect(() => {
    const txnId = searchParams.get("merchantTransactionId") || 
                  searchParams.get("transactionId") ||
                  searchParams.get("id");
    
    if (txnId) {
      setMerchantTransactionId(txnId);
      verifyPayment(txnId);
    } else {
      setStatus("error");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const verifyPayment = async (txnId: string) => {
    try {
      // Check payment status with PhonePe
      const result = await checkPaymentStatus({
        merchantTransactionId: txnId,
      });

      if (result.success) {
        if (result.paymentStatus === "success") {
          setStatus("success");
          // Store the transaction ID to fetch order later
          setMerchantTransactionId(txnId);
        } else if (result.paymentStatus === "failed") {
          setStatus("failed");
        } else {
          // Still pending
          setTimeout(() => verifyPayment(txnId), 2000);
        }
      } else {
        setStatus("error");
      }
    } catch (error) {
      console.error("Payment verification error:", error);
      setStatus("error");
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center">Payment Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {status === "loading" && (
            <div className="text-center space-y-4">
              <Spinner className="size-12 mx-auto" />
              <div>
                <h3 className="font-semibold text-lg">Verifying Payment...</h3>
                <p className="text-sm text-muted-foreground mt-2">
                  Please wait while we confirm your payment
                </p>
              </div>
            </div>
          )}

          {status === "success" && (
            <div className="text-center space-y-4">
              <CheckCircle2Icon className="size-16 mx-auto text-green-500" />
              <div>
                <h3 className="font-semibold text-lg text-green-600">
                  Payment Successful!
                </h3>
                <p className="text-sm text-muted-foreground mt-2">
                  Your order has been confirmed and is being processed
                </p>
              </div>
              {order && (
                <Button 
                  onClick={() => navigate(`/orders/${order._id}`)}
                  className="w-full"
                >
                  View Order Details
                </Button>
              )}
              <Link to="/products" className="block">
                <Button variant="outline" className="w-full">
                  Continue Shopping
                </Button>
              </Link>
            </div>
          )}

          {status === "failed" && (
            <div className="text-center space-y-4">
              <XCircleIcon className="size-16 mx-auto text-red-500" />
              <div>
                <h3 className="font-semibold text-lg text-red-600">
                  Payment Failed
                </h3>
                <p className="text-sm text-muted-foreground mt-2">
                  Your payment could not be processed. Please try again.
                </p>
              </div>
              {merchantTransactionId && (
                <p className="text-xs text-muted-foreground">
                  Transaction ID: {merchantTransactionId}
                </p>
              )}
              <Button 
                onClick={() => navigate("/checkout")}
                className="w-full"
              >
                Retry Payment
              </Button>
              <Link to="/products" className="block">
                <Button variant="outline" className="w-full">
                  Continue Shopping
                </Button>
              </Link>
            </div>
          )}

          {status === "error" && (
            <div className="text-center space-y-4">
              <AlertCircleIcon className="size-16 mx-auto text-yellow-500" />
              <div>
                <h3 className="font-semibold text-lg text-yellow-600">
                  Unable to Verify Payment
                </h3>
                <p className="text-sm text-muted-foreground mt-2">
                  There was an error verifying your payment. Please contact support if money was deducted.
                </p>
              </div>
              <Link to="/orders" className="block">
                <Button className="w-full">
                  View My Orders
                </Button>
              </Link>
              <Link to="/" className="block">
                <Button variant="outline" className="w-full">
                  Go Home
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
