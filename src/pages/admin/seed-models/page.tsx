import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { AdminLayout } from "@/components/admin-layout.tsx";
import { AlertCircleIcon, CheckCircleIcon, DatabaseIcon } from "lucide-react";
import { toast } from "sonner";

export default function SeedModelsPage() {
  const [isSeeding, setIsSeeding] = useState(false);
  const [isForceSeeding, setIsForceSeeding] = useState(false);
  
  const seedModels = useMutation(api.seedModels.seedAllModels);
  const forceSeedModels = useMutation(api.seedModels.forceSeedAllModels);
  const stats = useQuery(api.supportedModels.getStats);

  const handleSeed = async () => {
    try {
      setIsSeeding(true);
      const result = await seedModels({});
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error("Failed to seed models");
      console.error(error);
    } finally {
      setIsSeeding(false);
    }
  };

  const handleForceSeed = async () => {
    try {
      setIsForceSeeding(true);
      const result = await forceSeedModels({ confirmDelete: true });
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error("Failed to force seed models");
      console.error(error);
    } finally {
      setIsForceSeeding(false);
    }
  };

  return (
    <AdminLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Seed Device Models</h1>
        <p className="text-muted-foreground">
          Populate the database with pre-existing device models from the codebase
        </p>
      </div>

      <div className="grid gap-6 max-w-4xl">
          {/* Stats Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DatabaseIcon className="size-5" />
                Current Database Stats
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stats ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <div className="text-2xl font-bold">{stats.total}</div>
                    <div className="text-sm text-muted-foreground">Total Models</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-600">{stats.active}</div>
                    <div className="text-sm text-muted-foreground">Active</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-muted-foreground">{stats.inactive}</div>
                    <div className="text-sm text-muted-foreground">Inactive</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold">{Object.keys(stats.categoryBreakdown).length}</div>
                    <div className="text-sm text-muted-foreground">Categories</div>
                  </div>
                </div>
              ) : (
                <div>Loading stats...</div>
              )}
            </CardContent>
          </Card>

          {/* Seed Action Card */}
          <Card>
            <CardHeader>
              <CardTitle>Seed Models (One-Time)</CardTitle>
              <CardDescription>
                Import all pre-configured device models into the database. This will only work if the database is empty.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-900">
                <CheckCircleIcon className="size-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                <div className="space-y-1">
                  <div className="font-medium text-blue-900 dark:text-blue-100">Safe Operation</div>
                  <div className="text-sm text-blue-700 dark:text-blue-300">
                    This will only add models if the database is empty. Existing models will not be affected.
                  </div>
                </div>
              </div>
              <Button 
                onClick={handleSeed} 
                disabled={isSeeding || (stats && stats.total > 0)}
                className="w-full"
              >
                {isSeeding ? "Seeding..." : "Seed Models"}
              </Button>
              {stats && stats.total > 0 && (
                <p className="text-sm text-muted-foreground text-center">
                  Database already contains models. Use force seed to re-populate.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Force Seed Action Card */}
          <Card className="border-destructive/50">
            <CardHeader>
              <CardTitle className="text-destructive">Force Seed (Destructive)</CardTitle>
              <CardDescription>
                Delete all existing models and re-import from scratch. This action cannot be undone.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3 p-4 bg-destructive/10 rounded-lg border border-destructive/30">
                <AlertCircleIcon className="size-5 text-destructive mt-0.5 flex-shrink-0" />
                <div className="space-y-1">
                  <div className="font-medium text-destructive">Warning: Destructive Operation</div>
                  <div className="text-sm text-destructive/80">
                    This will delete ALL existing models including any manually added ones. Use with caution.
                  </div>
                </div>
              </div>
              <Button 
                onClick={handleForceSeed} 
                disabled={isForceSeeding}
                variant="destructive"
                className="w-full"
              >
                {isForceSeeding ? "Force Seeding..." : "Force Seed Models"}
              </Button>
            </CardContent>
          </Card>
        </div>
    </AdminLayout>
  );
}
