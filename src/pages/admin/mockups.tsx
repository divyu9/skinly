import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { toast } from "sonner";
import { UploadIcon, TrashIcon, FileTextIcon, CopyIcon, ImageIcon, DownloadIcon, AlertCircleIcon, CheckCircleIcon } from "lucide-react";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { useConvex } from "convex/react";
import { SignInButton } from "@/components/ui/signin.tsx";

interface FailedFile {
  filename: string;
  reason: string;
}

interface BrokenMockup {
  id: string;
  brand: string;
  model: string;
  sku: string;
  fileId: string;
}

export default function MockupsPage() {
  const [csvData, setCsvData] = useState("");
  const [importing, setImporting] = useState(false);
  const [fileListData, setFileListData] = useState("");
  const [generatedCsv, setGeneratedCsv] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [failedFiles, setFailedFiles] = useState<FailedFile[]>([]);
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{
    total: number;
    broken: number;
    brokenMockups: BrokenMockup[];
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const convex = useConvex();
  const mockups = useQuery(api.mockups.getAllMockups);
  const bulkImport = useMutation(api.mockups.bulkImportMockups);
  const clearAll = useMutation(api.mockups.clearAllMockups);
  const storeMockupFile = useMutation(api.mockupsUpload.storeMockupFile);
  
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
  
  const handleBulkUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    setUploading(true);
    setUploadProgress({ current: 0, total: files.length });
    setFailedFiles([]); // Reset failed files
    
    let imported = 0;
    let updated = 0;
    let skipped = 0;
    let failed = 0;
    const failedList: FailedFile[] = [];
    
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setUploadProgress({ current: i + 1, total: files.length });
        
        try {
          // Validate filename format - allow Brand_Model_SKU.jpg or Model_SKU.jpg (for iPhone/iPad auto-detection)
          const filename = file.name;
          const hasValidFormat = /^[A-Za-z0-9]+_[A-Za-z0-9\s]+(_[A-Za-z0-9-]+)?\.(jpg|jpeg|png|webp)$/i.test(filename);
          const hasMinimumParts = filename.split('_').length >= 2;
          
          if (!hasValidFormat || !hasMinimumParts) {
            console.warn(`Skipping invalid filename: ${filename}`);
            failedList.push({
              filename,
              reason: "Invalid filename format. Expected: Brand_Model_SKU.jpg or iPhone_Model_SKU.jpg"
            });
            failed++;
            continue;
          }
          
          // Upload to storage
          const uploadUrl = await convex.mutation(api.mockups.generateUploadUrl, {});
          
          const uploadResult = await fetch(uploadUrl, {
            method: "POST",
            headers: { "Content-Type": file.type },
            body: file,
          });
          
          if (!uploadResult.ok) {
            throw new Error(`Upload failed with status ${uploadResult.status}`);
          }
          
          const { storageId } = await uploadResult.json();
          
          // Store mockup with filename
          const result = await storeMockupFile({
            fileId: storageId,
            filename,
          });
          
          if (result.action === "created") imported++;
          else if (result.action === "updated") updated++;
          else skipped++;
          
        } catch (error) {
          console.error(`Failed to upload ${file.name}:`, error);
          failedList.push({
            filename: file.name,
            reason: error instanceof Error ? error.message : "Upload or processing error"
          });
          failed++;
        }
      }
      
      setFailedFiles(failedList);
      
      toast.success(
        `Upload complete! ${imported} new, ${updated} updated, ${skipped} skipped, ${failed} failed`
      );
    } catch (error) {
      toast.error("Bulk upload failed");
    } finally {
      setUploading(false);
      setUploadProgress({ current: 0, total: 0 });
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
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
        
        // Parse filename: Brand_Model_SKU.jpg or iPhone_Model_SKU.jpg
        // Examples:
        // - Apple_iPhone15Pro_M-174.jpg
        // - iPhone16_M-174.jpg (auto-detects Apple)
        // - Samsung_GalaxyS24_M-174.jpg
        // - Oppo_15Pro_M-174.jpg
        const parts = filename.split('_');
        
        if (parts.length < 2) {
          skipped++;
          continue;
        }
        
        let brand = parts[0];
        let sku = parts[parts.length - 1];
        let model = parts.slice(1, -1).join(' '); // Everything between brand and SKU
        
        // Auto-detect Apple for iPhone/iPad files
        const filenameLower = filename.toLowerCase();
        if (filenameLower.includes('iphone') || filenameLower.includes('ipad')) {
          if (brand.toLowerCase() === 'iphone' || brand.toLowerCase() === 'ipad') {
            // Filename is like "iPhone16_M-75", reconstruct as Apple_iPhone16_M-75
            brand = 'Apple';
            model = parts.slice(0, -1).join(' ');
          } else {
            // Brand is something else but contains iPhone/iPad
            brand = 'Apple';
          }
        }
        
        if (!brand || !model || !sku) {
          skipped++;
          continue;
        }
        
        csvLines.push(`${brand},${model},${sku},${fileId}`);
        parsed++;
      }
      
      if (parsed === 0) {
        toast.error("No valid files parsed. Check your file naming convention: Brand_Model_SKU.jpg or iPhone_Model_SKU.jpg");
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
  
  const handleDownloadFailedReport = () => {
    if (failedFiles.length === 0) {
      toast.error("No failed files to download");
      return;
    }
    
    // Generate CSV report
    const csvLines = ['Filename,Reason'];
    failedFiles.forEach(file => {
      // Escape commas in filename and reason
      const escapedFilename = file.filename.includes(',') ? `"${file.filename}"` : file.filename;
      const escapedReason = file.reason.includes(',') ? `"${file.reason}"` : file.reason;
      csvLines.push(`${escapedFilename},${escapedReason}`);
    });
    
    const csvContent = csvLines.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `mockup-failed-files-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    
    toast.success(`Downloaded report with ${failedFiles.length} failed files`);
  };
  
  const handleVerifyMockups = async () => {
    setVerifying(true);
    try {
      const result = await convex.query(api.mockups.verifyMockupFiles, {});
      setVerificationResult(result);
      
      if (result.broken === 0) {
        toast.success(`✓ All ${result.total} mockups verified successfully!`);
      } else {
        toast.error(`Found ${result.broken} broken mockup links out of ${result.total} total`);
      }
    } catch (error) {
      console.error('Verification error:', error);
      toast.error("Failed to verify mockups");
    } finally {
      setVerifying(false);
    }
  };
  
  const handleDownloadBrokenReport = () => {
    if (!verificationResult || verificationResult.broken === 0) {
      toast.error("No broken mockups to download");
      return;
    }
    
    // Generate CSV report
    const csvLines = ['Brand,Model,SKU,FileID'];
    verificationResult.brokenMockups.forEach(mockup => {
      csvLines.push(`${mockup.brand},${mockup.model},${mockup.sku},${mockup.fileId}`);
    });
    
    const csvContent = csvLines.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `mockup-broken-links-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    
    toast.success(`Downloaded report with ${verificationResult.broken} broken mockups`);
  };
  
  return (
    <>
      <Unauthenticated>
        <div className="container mx-auto py-16 px-4 text-center">
          <h1 className="text-3xl font-bold mb-4">Mockup Management</h1>
          <p className="text-muted-foreground mb-6">
            Please sign in to access the mockup management system
          </p>
          <SignInButton />
        </div>
      </Unauthenticated>
      
      <AuthLoading>
        <div className="container mx-auto py-8 px-4">
          <Skeleton className="h-12 w-64 mb-4" />
          <Skeleton className="h-64 w-full" />
        </div>
      </AuthLoading>
      
      <Authenticated>
        <div className="container mx-auto py-8 px-4">
          <div className="mb-6">
            <h1 className="text-3xl font-bold">Mockup Management</h1>
            <p className="text-muted-foreground mt-2">
              Upload mockup images with automatic parsing and import
            </p>
          </div>
        
        {/* Recommended Method: Direct Upload */}
        <Card className="mb-6 border-green-200 bg-green-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-700">
              <ImageIcon className="h-5 w-5" />
              ⭐ Recommended: Bulk Upload Mockups
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-white border border-green-200 rounded p-4 text-sm space-y-3">
              <p className="font-semibold text-green-800">
                ✨ Upload 100k+ files directly - No manual work required!
              </p>
              <ol className="space-y-1.5 list-decimal list-inside ml-2">
                <li>Name your files: <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">Brand_Model_SKU.jpg</code></li>
                <li>Select all mockup files (1000s at once)</li>
                <li>Upload below - Automatic parsing & import!</li>
              </ol>
              <div className="bg-amber-50 border border-amber-200 rounded p-3 text-xs">
                <p className="font-semibold mb-1">Examples:</p>
                <ul className="space-y-0.5 ml-4 list-disc">
                  <li><code>Apple_iPhone15Pro_M-174.jpg</code></li>
                  <li><code>iPhone16_M-174.jpg</code> <span className="text-amber-700">(Auto-detects Apple)</span></li>
                  <li><code>Samsung_GalaxyS24_M-174.jpg</code></li>
                  <li><code>Oppo_15Pro_M-174.jpg</code></li>
                </ul>
                <p className="mt-2 text-amber-800 font-medium">
                  💡 Tip: Files with "iPhone" or "iPad" automatically assign to Apple brand
                </p>
              </div>
            </div>
            
            <div className="border-2 border-dashed border-green-300 rounded-lg p-8 text-center bg-white">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => handleBulkUpload(e.target.files)}
                disabled={uploading}
              />
              
              {uploading ? (
                <div className="space-y-3">
                  <div className="text-lg font-medium">
                    Uploading {uploadProgress.current} / {uploadProgress.total}
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div 
                      className="bg-green-600 h-2.5 rounded-full transition-all duration-300"
                      style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                    />
                  </div>
                  <p className="text-sm text-muted-foreground">Please wait...</p>
                </div>
              ) : (
                <>
                  <ImageIcon className="h-12 w-12 mx-auto text-green-600 mb-3" />
                  <Button
                    size="lg"
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <UploadIcon className="h-5 w-5 mr-2" />
                    Select Mockup Files
                  </Button>
                  <p className="text-sm text-muted-foreground mt-3">
                    Supports JPG, PNG, WEBP • Can upload 1000s at once
                  </p>
                </>
              )}
            </div>
          </CardContent>
        </Card>
        
        {/* Failed Files Report */}
        {failedFiles.length > 0 && (
          <Card className="mb-6 border-red-200 bg-red-50/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-700">
                <AlertCircleIcon className="h-5 w-5" />
                Failed Files Report ({failedFiles.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-white border border-red-200 rounded p-4 text-sm">
                <p className="font-semibold text-red-800 mb-3">
                  The following files failed to upload or had naming issues:
                </p>
                <div className="max-h-48 overflow-y-auto border border-red-100 rounded">
                  <table className="w-full text-xs">
                    <thead className="bg-red-100 sticky top-0">
                      <tr>
                        <th className="text-left p-2 font-semibold">Filename</th>
                        <th className="text-left p-2 font-semibold">Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {failedFiles.map((file, idx) => (
                        <tr key={idx} className="border-t border-red-100">
                          <td className="p-2 font-mono">{file.filename}</td>
                          <td className="p-2 text-muted-foreground">{file.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button
                  onClick={handleDownloadFailedReport}
                  variant="destructive"
                  className="flex-1"
                >
                  <DownloadIcon className="h-4 w-4 mr-2" />
                  Download Failed Files Report (CSV)
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setFailedFiles([])}
                >
                  Clear
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
        
        <div className="mb-4 text-center text-sm text-muted-foreground">
          — OR use alternative methods below —
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
                  <li>Name files: <code className="bg-white px-1">Brand_Model_SKU.jpg</code> or <code className="bg-white px-1">iPhone_Model_SKU.jpg</code></li>
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
        
        {/* Verification Card */}
        {mockups && mockups.length > 0 && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircleIcon className="h-5 w-5" />
                Verify Mockup Files
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded p-4 text-sm">
                <p className="font-semibold text-blue-800 mb-2">
                  🔍 Check for broken mockup links
                </p>
                <p className="text-blue-700">
                  This will verify that all mockup file IDs in your database actually exist in storage.
                  Broken links occur when files are deleted or when file IDs are incorrect.
                </p>
              </div>
              
              <Button
                onClick={handleVerifyMockups}
                disabled={verifying}
                className="w-full"
                size="lg"
              >
                {verifying ? "Verifying..." : "Verify All Mockups"}
              </Button>
              
              {verificationResult && (
                <div className={`border rounded p-4 ${
                  verificationResult.broken === 0 
                    ? 'bg-green-50 border-green-200' 
                    : 'bg-red-50 border-red-200'
                }`}>
                  <div className="flex items-center gap-2 mb-3">
                    {verificationResult.broken === 0 ? (
                      <>
                        <CheckCircleIcon className="h-5 w-5 text-green-600" />
                        <h3 className="font-semibold text-green-800">
                          ✓ All mockups verified!
                        </h3>
                      </>
                    ) : (
                      <>
                        <AlertCircleIcon className="h-5 w-5 text-red-600" />
                        <h3 className="font-semibold text-red-800">
                          Found {verificationResult.broken} broken link{verificationResult.broken !== 1 ? 's' : ''}
                        </h3>
                      </>
                    )}
                  </div>
                  
                  <div className="text-sm mb-3">
                    <p>Total mockups: <strong>{verificationResult.total}</strong></p>
                    <p className={verificationResult.broken === 0 ? 'text-green-700' : 'text-red-700'}>
                      Broken links: <strong>{verificationResult.broken}</strong>
                    </p>
                  </div>
                  
                  {verificationResult.broken > 0 && (
                    <>
                      <div className="max-h-48 overflow-y-auto border border-red-100 rounded mb-3 bg-white">
                        <table className="w-full text-xs">
                          <thead className="bg-red-100 sticky top-0">
                            <tr>
                              <th className="text-left p-2 font-semibold">Brand</th>
                              <th className="text-left p-2 font-semibold">Model</th>
                              <th className="text-left p-2 font-semibold">SKU</th>
                              <th className="text-left p-2 font-semibold">File ID</th>
                            </tr>
                          </thead>
                          <tbody>
                            {verificationResult.brokenMockups.map((mockup) => (
                              <tr key={mockup.id} className="border-t border-red-100">
                                <td className="p-2">{mockup.brand}</td>
                                <td className="p-2">{mockup.model}</td>
                                <td className="p-2">{mockup.sku}</td>
                                <td className="p-2 font-mono text-xs">{mockup.fileId}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      
                      <div className="flex gap-2">
                        <Button
                          onClick={handleDownloadBrokenReport}
                          variant="destructive"
                          className="flex-1"
                          size="sm"
                        >
                          <DownloadIcon className="h-4 w-4 mr-2" />
                          Download Report (CSV)
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => setVerificationResult(null)}
                          size="sm"
                        >
                          Clear
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}
        
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
    </>
  );
}
