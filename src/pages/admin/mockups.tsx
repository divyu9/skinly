import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { useState } from "react";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { toast } from "sonner";
import { UploadIcon, TrashIcon, FileTextIcon } from "lucide-react";
import { Authenticated } from "convex/react";
import { Skeleton } from "@/components/ui/skeleton.tsx";

export default function MockupsPage() {
  const [csvData, setCsvData] = useState("");
  const [importing, setImporting] = useState(false);
  
  const mockups = useQuery(api.mockups.getAllMockups);
  const bulkImport = useMutation(api.mockups.bulkImportMockups);
  const clearAll = useMutation(api.mockups.clearAllMockups);
  
  const handleBulkImport = async () => {
    if (!csvData.trim()) {
      toast.error("Please paste CSV data");
      return;
    }
    
    setImporting(true);
    try {
      // Parse CSV
      const lines = csvData.trim().split('\n');
      const mockupData = [];
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        // Skip header row if present
        if (i === 0 && line.toLowerCase().startsWith('brand')) {
          continue;
        }
        
        const parts = line.split(',').map(p => p.trim());
        
        if (parts.length < 4) {
          toast.error(`Invalid format on line ${i + 1}. Expected: brand,model,sku,fileId`);
          setImporting(false);
          return;
        }
        
        mockupData.push({
          brand: parts[0],
          model: parts[1],
          sku: parts[2],
          fileId: parts[3],
        });
      }
      
      if (mockupData.length === 0) {
        toast.error("No valid mockup data found");
        setImporting(false);
        return;
      }
      
      // Import to database
      const result = await bulkImport({ mockups: mockupData });
      
      toast.success(
        `Import complete! ${result.imported} new, ${result.updated} updated, ${result.skipped} skipped`
      );
      setCsvData("");
    } catch (error) {
      console.error('Import error:', error);
      toast.error("Failed to import mockups");
    } finally {
      setImporting(false);
    }
  };
  
  const handleClearAll = async () => {
    if (!confirm('Are you sure you want to delete all mockup mappings? This cannot be undone.')) {
      return;
    }
    
    try {
      const result = await clearAll();
      toast.success(`Deleted ${result.deleted} mockups`);
    } catch (error) {
      toast.error("Failed to clear mockups");
    }
  };
  
  return (
    <Authenticated>
      <div className="container mx-auto py-8 px-4">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Mockup Management</h1>
          <p className="text-muted-foreground mt-2">
            Bulk import mockup image mappings from CSV
          </p>
        </div>
        
        <div className="grid gap-6 md:grid-cols-2">
          {/* Import Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UploadIcon className="h-5 w-5" />
                Bulk Import CSV
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">
                  CSV Format (one per line):
                </label>
                <div className="bg-muted p-3 rounded text-xs font-mono mb-3">
                  brand,model,sku,fileId<br/>
                  Apple,iPhone 15 Pro,M-174,file_abc123<br/>
                  Samsung,Galaxy S24,M-174,file_xyz789
                </div>
                
                <Textarea
                  placeholder="Paste CSV data here..."
                  value={csvData}
                  onChange={(e) => setCsvData(e.target.value)}
                  className="h-64 font-mono text-xs"
                />
              </div>
              
              <div className="flex gap-2">
                <Button
                  onClick={handleBulkImport}
                  disabled={importing || !csvData.trim()}
                  className="flex-1"
                >
                  {importing ? "Importing..." : "Import Mockups"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setCsvData("")}
                  disabled={!csvData.trim()}
                >
                  Clear
                </Button>
              </div>
            </CardContent>
          </Card>
          
          {/* Stats Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileTextIcon className="h-5 w-5" />
                Database Stats
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {mockups === undefined ? (
                <Skeleton className="h-20 w-full" />
              ) : (
                <>
                  <div className="bg-muted p-4 rounded">
                    <div className="text-3xl font-bold">{mockups.length.toLocaleString()}</div>
                    <div className="text-sm text-muted-foreground">Total mockups in database</div>
                  </div>
                  
                  <div className="space-y-2">
                    <h3 className="font-medium text-sm">How to add mockups:</h3>
                    <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                      <li>Upload images to Files & Media tab</li>
                      <li>Copy file IDs (starts with "file_")</li>
                      <li>Create CSV: brand,model,sku,fileId</li>
                      <li>Paste CSV and click Import</li>
                    </ol>
                  </div>
                  
                  {mockups.length > 0 && (
                    <Button
                      variant="destructive"
                      onClick={handleClearAll}
                      className="w-full"
                    >
                      <TrashIcon className="h-4 w-4 mr-2" />
                      Clear All Mockups
                    </Button>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
        
        {/* Preview Recent Mockups */}
        {mockups && mockups.length > 0 && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Recent Mockups (Last 10)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b">
                    <tr className="text-left">
                      <th className="p-2">Brand</th>
                      <th className="p-2">Model</th>
                      <th className="p-2">SKU</th>
                      <th className="p-2">File ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mockups.slice(-10).reverse().map((mockup) => (
                      <tr key={mockup._id} className="border-b">
                        <td className="p-2">{mockup.brand}</td>
                        <td className="p-2">{mockup.model}</td>
                        <td className="p-2">{mockup.sku}</td>
                        <td className="p-2 font-mono text-xs">{mockup.fileId}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Authenticated>
  );
}
