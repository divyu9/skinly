import { useMutation } from "@/lib/firebase-hooks";
import { api } from "@/lib/firebase-api";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { toast } from "sonner";
import { CheckCircle2Icon } from "lucide-react";

export default function FixCollections() {
  const fixCollection = useMutation(api.updateCollectionRules.fixCoversAndCasesCollection);
  
  const handleFix = async () => {
    try {
      await fixCollection({});
      toast.success("Collection rules fixed successfully!");
    } catch (error) {
      toast.error("Failed to fix collection: " + (error as Error).message);
    }
  };
  
  return (
    <div className="min-h-screen p-8">
      <div className="container mx-auto max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2Icon className="size-6 text-primary" />
              Fix Collection Rules
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              The "Covers And Cases" collection rule needs to be updated to match the actual product names.
            </p>
            <div className="bg-muted p-4 rounded-lg space-y-2">
              <p className="font-semibold">What will be fixed:</p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Change rule from "Cover And Case" to "Magsafe Cover" OR "Cover & Case"</li>
                <li>Set match logic to "any" (OR logic)</li>
              </ul>
            </div>
            <Button onClick={handleFix} size="lg" className="w-full">
              Fix Collection Rules Now
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
