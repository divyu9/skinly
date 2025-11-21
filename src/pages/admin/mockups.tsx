import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { useState } from "react";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { toast } from "sonner";
import { UploadIcon, TrashIcon, FileTextIcon, CopyIcon } from "lucide-react";
import { Authenticated } from "convex/react";
import { Skeleton } from "@/components/ui/skeleton.tsx";

export default function MockupsPage() {
  const [csvData, setCsvData] = useState("");
  const [importing, setImporting] = useState(false);
  const [fileListData, setFileListData] = useState("");
  const [generatedCsv, setGeneratedCsv] = useState("");
  
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
  
  const handleParseFileList = () => {
    if (!fileListData.trim()) {
      toast.error("Please paste file list data");
      return;
    }
    
    try {
      const lines = fileListData.trim().split('\n');
      const csvLines = ['brand,model,sku,fileId'];
      let parsed = 0;
      let skipped = 0;
      
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        
        // Extract file ID (pattern: file_xxxxx or https://cdn.hercules.app/file_xxxxx)
        let fileId = '';
        if (trimmed.startsWith('file_')) {
          fileId = trimmed.split(/[\s,\t]/)[0];
        } else if (trimmed.includes('file_')) {
          const match = trimmed.match(/file_[a-zA-Z0-9]+/);
          if (match) fileId = match[0];
        }
        
        if (!fileId) {
          skipped++;
          continue;
        }
        
        // Extract filename (look for pattern before .jpg, .png, .jpeg)
        let filename = '';
        const filenameMatch = trimmed.match(/([a-zA-Z0-9_-]+)\.(jpg|jpeg|png|webp)/i);
        if (filenameMatch) {
          filename = filenameMatch[1];
        } else {
          // Try to find filename in the line
          const parts = trimmed.split(/[\s,\t]/);
          for (const part of parts) {
            if (part.includes('_') && !part.startsWith('file_')) {
              filename = part.replace(/\.(jpg|jpeg|png|webp)$/i, '');
              break;
            }
          }
        }
        
        if (!filename) {
          skipped++;
          continue;
        }
        
        // Parse filename: Brand_Model_SKU.jpg
        // Examples:
        // - Apple_iPhone15Pro_M-174.jpg
        // - Samsung_GalaxyS24_M-174.jpg
        // - Oppo_15Pro_M-174.jpg
        const parts = filename.split('_');
        
        if (parts.length < 3) {
          skipped++;
          continue;
        }
        
        const brand = parts[0];
        const sku = parts[parts.length - 1];
        const model = parts.slice(1, -1).join(' '); // Everything between brand and SKU
        
        csvLines.push(`${brand},${model},${sku},${fileId}`);
        parsed++;
      }
      
      if (parsed === 0) {
        toast.error("No valid files parsed. Check your file naming convention: Brand_Model_SKU.jpg");
        return;
      }
      
      const csv = csvLines.join('\n');
      setGeneratedCsv(csv);
      toast.success(`Parsed ${parsed} files! ${skipped} skipped. Review and copy to import.`);
    } catch (error) {
      console.error('Parse error:', error);
      toast.error("Failed to parse file list");
    }
  };
  
  return (
    <Authenticated>
      <div className="container mx-auto py-8 px-4">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Mockup Management</h1>
          <p className="text-muted-foreground mt-2">
            Automatically generate CSV from uploaded file list
          </p>
        </div>
        
        {/* Step 1: Filename Parser */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileTextIcon className="h-5 w-5" />
              Step 1: Extract File List (Auto-Generate CSV)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded p-4 text-sm space-y-3">
              <div>
                <h4 className="font-semibold mb-2">📋 Quick Method (Recommended):</h4>
                <ol className="space-y-1 list-decimal list-inside ml-2">
                  <li>Name files: <code className="bg-white px-1">Brand_Model_SKU.jpg</code></li>
                  <li>Upload to Files & Media tab</li>
                  <li>Open browser console (F12 or Right-click → Inspect)</li>
                  <li>Paste this script and press Enter:</li>
                </ol>
                <div className="relative">
                  <div className="bg-gray-900 text-green-400 p-3 rounded text-xs font-mono overflow-x-auto">
                    {`// Extract all file info from Files & Media page
const files = [];
document.querySelectorAll('[data-file-id], img[src*="file_"]').forEach(el => {
  const fileId = el.dataset?.fileId || el.src?.match(/file_[a-zA-Z0-9]+/)?.[0];
  const filename = el.alt || el.title || el.textContent || '';
  if (fileId && filename) files.push(\`\${fileId} \${filename}\`);
});
console.log(files.join('\\n'));
copy(files.join('\\n'));
alert('Copied ' + files.length + ' files to clipboard!');`}
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="absolute top-2 right-2"
                    onClick={() => {
                      const script = `// Extract all file info from Files & Media page
const files = [];
document.querySelectorAll('[data-file-id], img[src*="file_"]').forEach(el => {
  const fileId = el.dataset?.fileId || el.src?.match(/file_[a-zA-Z0-9]+/)?.[0];
  const filename = el.alt || el.title || el.textContent || '';
  if (fileId && filename) files.push(\`\${fileId} \${filename}\`);
});
console.log(files.join('\\n'));
copy(files.join('\\n'));
alert('Copied ' + files.length + ' files to clipboard!');`;
                      navigator.clipboard.writeText(script);
                      toast.success("Script copied! Paste in browser console.");
                    }}
                  >
                    <CopyIcon className="h-3 w-3 mr-1" />
                    Copy
                  </Button>
                </div>
                <p className="mt-2 text-xs text-amber-700">
                  ⚡ Script automatically extracts and copies file list
                </p>
              </div>
              
              <div className="border-t pt-3">
                <h4 className="font-semibold mb-2">📝 Manual Method:</h4>
                <p className="text-xs">
                  Manually copy file URLs/IDs from Files & Media in any format
                </p>
              </div>
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">
                Paste File List (any format):
              </label>
              <Textarea
                placeholder="Paste file URLs, file IDs, or filenames here...
Examples:
https://cdn.hercules.app/file_abc123
file_abc123 Apple_iPhone15Pro_M-174.jpg
Samsung_GalaxyS24_M-174.jpg"
                value={fileListData}
                onChange={(e) => setFileListData(e.target.value)}
                className="h-40 font-mono text-xs"
              />
            </div>
            
            <Button onClick={handleParseFileList} className="w-full">
              Generate CSV from File List
            </Button>
            
            {generatedCsv && (
              <div>
                <label className="text-sm font-medium mb-2 block text-green-600">
                  ✓ Generated CSV (copy this to Step 2):
                </label>
                <Textarea
                  value={generatedCsv}
                  readOnly
                  className="h-40 font-mono text-xs bg-green-50"
                />
                <Button
                  variant="outline"
                  onClick={() => {
                    setCsvData(generatedCsv);
                    toast.success("CSV copied to import section below!");
                  }}
                  className="w-full mt-2"
                >
                  Copy to Step 2 Import
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
        
        <div className="grid gap-6 md:grid-cols-2">
          {/* Import Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UploadIcon className="h-5 w-5" />
                Step 2: Import CSV to Database
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
