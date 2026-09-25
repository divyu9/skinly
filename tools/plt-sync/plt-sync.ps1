# GoSkinly - plotter model sync
#
# Runs on the Windows PC that drives the cutting plotter, once a day (Task
# Scheduler). The cutting software keeps its model library in its "Models"
# folder: one .mcz archive per brand per product type (Models\Mobile Skins\
# Samsung.mcz), each holding one .mdl cut file per model part ("Galaxy S24
# Ultra (5G)-B1.mdl", "... Sides.mdl"). This reads the NAMES and dates inside
# those archives - the cut files themselves are encrypted and never opened -
# and posts the list to the website's server, one line per cut file. It
# changes nothing on this PC.
#
# The server turns the names into models (-A, -B, -B1, Sides... are one model)
# and shows new ones in the admin under "New models found" for approval. See
# functions/src/pltSync.ts.
#
# Works on the PowerShell that ships with Windows 10/11 (5.1). Nothing to
# install.
#
# Setup:
#   1. Set $Root below to the cutting software's Models folder.
#   2. Set $Key to the key you were given (keep it private).
#   3. Run once by hand to check:  powershell -ExecutionPolicy Bypass -File "C:\GoSkinly\plt-sync.ps1"
#   4. Schedule it daily (Command Prompt, as the same Windows user):
#      schtasks /Create /SC DAILY /ST 20:00 /TN "GoSkinly PLT sync" /F /TR "powershell.exe -NoProfile -ExecutionPolicy Bypass -File \"C:\GoSkinly\plt-sync.ps1\""
#
# Each run appends one line to plt-sync.log next to this script.

$Root       = "C:\PATH\TO\SOFTWARE\Models"  # <-- the cutting software's Models folder
$Key        = "PASTE-THE-KEY-HERE"            # <-- from GoSkinly
$Endpoint   = "https://us-central1-skinly-3003b.cloudfunctions.net/pltInventoryUpload"

$ErrorActionPreference = "Stop"
$log = Join-Path $PSScriptRoot "plt-sync.log"

try {
    if (-not (Test-Path -LiteralPath $Root)) { throw "Folder not found: $Root" }
    $rootFull = (Resolve-Path -LiteralPath $Root).Path.TrimEnd('\')

    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $sb = New-Object System.Text.StringBuilder
    $count = 0
    $skipped = @()
    # One line per cut file: "Mobile Skins/Samsung.mcz::Galaxy S24 Ultra (5G)-B1.mdl <TAB> bytes <TAB> unix time"
    Get-ChildItem -LiteralPath $rootFull -Recurse -File -ErrorAction SilentlyContinue | ForEach-Object {
        $rel = $_.FullName.Substring($rootFull.Length).TrimStart('\') -replace '\\', '/'
        $ext = $_.Extension.ToLower()
        if ($ext -eq ".mdl" -or $ext -eq ".plt") {
            $modified = ([DateTimeOffset]$_.LastWriteTimeUtc).ToUnixTimeSeconds()
            [void]$sb.Append($rel).Append("`t").Append($_.Length).Append("`t").Append($modified).Append("`n")
            $count++
        }
        else {
            # Brand archives: .mcz, and a few with no extension (Models\9H\CAMERA).
            $zip = $null
            try {
                $zip = [System.IO.Compression.ZipFile]::OpenRead($_.FullName)
                foreach ($e in $zip.Entries) {
                    if (-not $e.Name) { continue }
                    [void]$sb.Append($rel).Append("::").Append($e.FullName).Append("`t").Append($e.Length).Append("`t").Append($e.LastWriteTime.ToUnixTimeSeconds()).Append("`n")
                    $count++
                }
            }
            catch { if ($ext -eq ".mcz") { $skipped += $rel } }
            finally { if ($zip) { $zip.Dispose() } }
        }
    }
    if ($skipped.Count) { Add-Content -LiteralPath $log -Value ("{0}  could not read: {1}" -f (Get-Date -Format s), ($skipped -join ", ")) }

    # Gzipped: tens of thousands of names shrink to a few hundred KB.
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($sb.ToString())
    $ms = New-Object System.IO.MemoryStream
    $gz = New-Object System.IO.Compression.GZipStream($ms, [System.IO.Compression.CompressionMode]::Compress)
    $gz.Write($bytes, 0, $bytes.Length)
    $gz.Close()
    $body = $ms.ToArray()

    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $headers = @{
        "x-plt-key"     = $Key
        "x-plt-machine" = $env:COMPUTERNAME
        "x-plt-root"    = [uri]::EscapeDataString($rootFull)
    }
    $result = Invoke-RestMethod -Uri $Endpoint -Method Post -Body $body -ContentType "application/octet-stream" -Headers $headers

    $line = "{0}  sent {1} files, server saw {2}" -f (Get-Date -Format s), $count, $result.files
    Add-Content -LiteralPath $log -Value $line
    Write-Host "Done: sent $count model files."
}
catch {
    $line = "{0}  FAILED: {1}" -f (Get-Date -Format s), $_.Exception.Message
    Add-Content -LiteralPath $log -Value $line
    Write-Host "FAILED: $($_.Exception.Message)"
    exit 1
}
