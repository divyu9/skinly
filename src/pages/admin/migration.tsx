import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function MigrationPage() {
  const runMigration = useMutation(api.runMigration.runOrderStatusMigration);
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<{ success: boolean; totalOrders: number; updatedOrders: number; message: string } | null>(null);

  const handleRunMigration = async () => {
    try {
      setIsRunning(true);
      setResult(null);
      const res = await runMigration();
      setResult(res);
      toast.success("Migration completed successfully!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Migration failed");
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Database Migrations</h1>
        <p className="text-muted-foreground">Run database migrations to update schema and data</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Order Status Migration</CardTitle>
          <CardDescription>
            Migrate orders from old 6-status system (pending, confirmed, processing, shipped, delivered, cancelled) 
            to new 5-status system (processing, shipped, delivered, cancelled, rto)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">This migration will:</p>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              <li>Convert "pending" → "processing"</li>
              <li>Convert "confirmed" → "processing"</li>
              <li>Keep existing processing, shipped, delivered, cancelled statuses unchanged</li>
            </ul>
          </div>

          {result && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg space-y-2">
              <div className="flex items-center gap-2 text-green-700">
                <CheckCircle2 className="w-5 h-5" />
                <p className="font-medium">Migration Complete</p>
              </div>
              <div className="text-sm text-green-600 space-y-1">
                <p>Total orders: {result.totalOrders}</p>
                <p>Updated orders: {result.updatedOrders}</p>
                <p>{result.message}</p>
              </div>
            </div>
          )}

          <Button 
            onClick={handleRunMigration} 
            disabled={isRunning}
            size="lg"
          >
            {isRunning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Run Migration
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
