import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";

export default function MockPaymentPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const orderId = params.get("orderId");
  const amount = params.get("amount");

  useEffect(() => {
    // Automatically succeed after 3 seconds
    const timer = setTimeout(() => {
      // Set the success token in URL params before returning to checkout
      navigate(`/checkout`);
    }, 3000);

    return () => clearTimeout(timer);
  }, [navigate, orderId]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <Card className="w-full max-w-md border-2 border-primary/20">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mb-4">
            <span className="text-2xl font-bold text-primary">₹</span>
          </div>
          <CardTitle className="text-2xl">Mock PhonePe Gateway</CardTitle>
          <p className="text-muted-foreground mt-2">
            This is a mock payment page for local development.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-muted p-4 rounded-lg space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Order ID</span>
              <span className="font-mono font-medium">{orderId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Amount</span>
              <span className="font-bold text-lg">₹{amount}</span>
            </div>
          </div>
          
          <div className="text-center space-y-4">
            <div className="inline-flex items-center gap-2 text-sm text-primary">
              <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              Processing payment automatically...
            </div>
            <Button 
              className="w-full" 
              onClick={() => navigate('/checkout')}
            >
              Simulate Success Now
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
