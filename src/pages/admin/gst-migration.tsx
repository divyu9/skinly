import { useQuery, useMutation } from "@/lib/firebase-hooks";
import { api } from "@/lib/firebase-api";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card.tsx";
import { CheckCircleIcon, AlertCircleIcon } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton.tsx";

export default function GstMigrationPage() {
  const [isMigrating, setIsMigrating] = useState(false);
  const [migratedCount, setMigratedCount] = useState(0);
  
  const ordersWithoutGst = useQuery(api.migrateGst.getOrdersWithoutGst);
  const backfillGst = useMutation(api.migrateGst.backfillOrderGst);

  const handleMigrate = async () => {
    if (!ordersWithoutGst || ordersWithoutGst.length === 0) {
      toast.info("No orders to migrate");
      return;
    }

    setIsMigrating(true);
    setMigratedCount(0);
    const totalOrders = ordersWithoutGst.length;

    try {
      for (let i = 0; i < totalOrders; i++) {
        const result = await backfillGst({});
        
        if (result.done) {
          break;
        }
        
        setMigratedCount(i + 1);
        
        // Add a small delay to avoid overwhelming the database
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      toast.success(`Successfully migrated ${totalOrders} orders with GST data`);
    } catch (error) {
      toast.error("Migration failed. Please try again.");
    } finally {
      setIsMigrating(false);
    }
  };

  if (ordersWithoutGst === undefined) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const needsMigration = ordersWithoutGst.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">GST Migration</h1>
        <p className="text-muted-foreground">
          Backfill GST calculations for existing orders
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {needsMigration ? (
              <>
                <AlertCircleIcon className="size-5 text-yellow-600" />
                Migration Required
              </>
            ) : (
              <>
                <CheckCircleIcon className="size-5 text-green-600" />
                All Orders Up to Date
              </>
            )}
          </CardTitle>
          <CardDescription>
            {needsMigration
              ? `${ordersWithoutGst.length} order(s) need GST data`
              : "All orders have GST information"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {needsMigration && (
            <>
              <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  <strong>Note:</strong> This migration will calculate and add GST breakdown
                  (CGST/SGST/IGST) to all existing orders based on their shipping state.
                  The process is safe and can be run multiple times.
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="font-medium">Orders without GST data:</h3>
                <div className="max-h-48 overflow-y-auto space-y-1 text-sm">
                  {ordersWithoutGst.map((order: { _id: string; orderNumber: string | undefined; total: number; state: string }) => (
                    <div
                      key={order._id}
                      className="flex justify-between p-2 bg-muted/50 rounded"
                    >
                      <span>{order.orderNumber || order._id}</span>
                      <span className="text-muted-foreground">
                        ₹{order.total.toFixed(0)} ({order.state})
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {isMigrating && (
                <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                  <p className="text-sm">
                    Migrating... {migratedCount} of {ordersWithoutGst.length} orders
                  </p>
                  <div className="mt-2 w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full transition-all duration-300"
                      style={{
                        width: `${(migratedCount / ordersWithoutGst.length) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              <Button
                onClick={handleMigrate}
                disabled={isMigrating}
                className="w-full"
                size="lg"
              >
                {isMigrating
                  ? `Migrating... ${migratedCount}/${ordersWithoutGst.length}`
                  : `Migrate ${ordersWithoutGst.length} Order(s)`}
              </Button>
            </>
          )}

          {!needsMigration && (
            <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
              <p className="text-sm text-green-800 dark:text-green-200">
                ✓ All orders have been successfully migrated with GST data
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>What does this migration do?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            This migration adds Indian GST (Goods and Services Tax) breakdown to all existing
            orders. For each order, it calculates:
          </p>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li>
              <strong>Taxable Amount</strong> - Price before tax (calculated from tax-inclusive total)
            </li>
            <li>
              <strong>CGST & SGST</strong> (9% each) - For orders shipped to Uttar Pradesh
            </li>
            <li>
              <strong>IGST</strong> (18%) - For orders shipped to other states
            </li>
            <li>
              <strong>Total GST</strong> - Total tax amount included in the price
            </li>
          </ul>
          <p className="text-muted-foreground mt-4">
            All prices on your website already include 18% GST. This migration simply breaks down
            the existing prices to show the GST components for compliance and transparency.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
