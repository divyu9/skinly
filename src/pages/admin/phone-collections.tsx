import { useState } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card.tsx";
import { AdminHeader } from "@/components/admin-header.tsx";
import { toast } from "sonner";
import { Sparkles, CheckCircle2, AlertCircle, Loader2, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge.tsx";

export default function PhoneCollections() {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<{
    collectionsCreated: number;
    productsAssigned: number;
    errors: string[];
  } | null>(null);

  const runMigration = useAction(api.phoneCollections.runPhoneCollectionsMigration);
  const collections = useQuery(api.phoneCollections.getPhoneCollectionsWithCounts);

  const handleRunMigration = async () => {
    setIsRunning(true);
    setResults(null);
    try {
      const result = await runMigration({});
      setResults(result);
      toast.success("Phone collections migration completed!");
    } catch (error) {
      toast.error("Migration failed: " + (error as Error).message);
      console.error(error);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader />
      <div className="container mx-auto p-8 max-w-6xl">
        <div className="space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold mb-2">Phone Collections</h1>
            <p className="text-muted-foreground">
              Manage phone skin collections with smart keyword-based product assignment
            </p>
          </div>

          {/* Migration Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="size-5 text-primary" />
                Run Collections Migration
              </CardTitle>
              <CardDescription>
                Create or update 15 phone skin collections and automatically assign products based on keywords
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted p-4 rounded-lg space-y-3">
                <p className="font-semibold text-sm">Collections to be created/updated:</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    "Anime", "Marvel", "DC", "Black Specials", "Abstract",
                    "Cars & Bikes", "Nature", "God & Religious", "Gaming",
                    "Quotes & Typography", "Minimal", "Space & Cosmic",
                    "Animals", "Music", "Sports"
                  ].map((name) => (
                    <Badge key={name} variant="secondary">{name}</Badge>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Products will be assigned to collections based on keyword matching in their titles.
                  Products can belong to multiple collections.
                </p>
              </div>

              <Button
                onClick={handleRunMigration}
                disabled={isRunning}
                size="lg"
                className="w-full"
              >
                {isRunning ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Running Migration...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 size-4" />
                    Run Migration Now
                  </>
                )}
              </Button>

              {results && (
                <div className="space-y-3 mt-4 pt-4 border-t">
                  <div className="flex items-start gap-3 text-sm">
                    <CheckCircle2 className="size-5 text-green-500 mt-0.5" />
                    <div>
                      <p className="font-semibold">Migration Results:</p>
                      <ul className="space-y-1 text-muted-foreground mt-1">
                        <li>• {results.collectionsCreated} collections created</li>
                        <li>• {results.productsAssigned} products assigned</li>
                      </ul>
                    </div>
                  </div>
                  {results.errors.length > 0 && (
                    <div className="flex items-start gap-3 text-sm">
                      <AlertCircle className="size-5 text-amber-500 mt-0.5" />
                      <div>
                        <p className="font-semibold">Errors:</p>
                        <ul className="space-y-1 text-muted-foreground mt-1">
                          {results.errors.map((error, i) => (
                            <li key={i} className="text-xs">• {error}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Current Collections */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="size-5" />
                Current Phone Collections
              </CardTitle>
              <CardDescription>
                {collections?.length || 0} phone collections found
              </CardDescription>
            </CardHeader>
            <CardContent>
              {collections === undefined ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="size-6 animate-spin text-muted-foreground" />
                </div>
              ) : collections.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No phone collections found. Run the migration to create them.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {collections.map((collection) => {
                    const keywords = collection.keywords || [];
                    return (
                      <Card key={collection._id}>
                        <CardContent className="pt-6">
                          <div className="space-y-2">
                            <h3 className="font-semibold">{collection.name}</h3>
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Products:</span>
                              <Badge variant="secondary">{collection.productCount}</Badge>
                            </div>
                            {keywords.length > 0 && (
                              <div className="pt-2">
                                <p className="text-xs text-muted-foreground mb-1">Keywords:</p>
                                <div className="flex flex-wrap gap-1">
                                  {keywords.slice(0, 5).map((keyword, idx) => (
                                    <Badge key={`${keyword}-${idx}`} variant="outline" className="text-xs">
                                      {keyword}
                                    </Badge>
                                  ))}
                                  {keywords.length > 5 && (
                                    <Badge variant="outline" className="text-xs">
                                      +{keywords.length - 5} more
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
