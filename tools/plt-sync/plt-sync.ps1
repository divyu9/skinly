# GoSkinly - plotter model sync (Mobicare + TIA Creation)
#
# Runs on the Windows PC that drives the cutting plotter, once a day (Task
# Scheduler), and sends the website the model names in both cutting programs.
#
# Mobicare keeps its model library in its "Models"
# folder: one .mcz archive per brand per product type (Models\Mobile Skins\
# Samsung.mcz), each holding one .mdl cut file per model part ("Galaxy S24
# Ultra (5G)-B1.mdl", "... Sides.mdl"). This reads the NAMES and dates inside
# those archives - the cut files themselves are encrypted and never opened -
# and posts the list to the website's server, one line per cut file. It
# changes nothing on this PC.
#
# TIA Creation keeps a plain list of its models in GadgetPlotData\model.txt
# (and brand.txt), and one .tc file per model part in Templates. This sends
# those two lists and the Templates file names with their dates.
#
# The server turns the names into models (-A, -B, -B1, Sides... are one model)
# and shows new ones in the admin under "New models found" for approval. See
# functions/src/pltSync.ts.
#
# Works on the PowerShell that ships with Windows 10/11 (5.1). Nothing to
# install.
#
# Setup:
#   1. Set $MobicareModels to Mobicare's Models folder and $TiaRoot to the
#      TIA CREATION folder. Leave one empty ("") to skip that program.
#   2. Set $Key to the key you were given (keep it private).
#   3. Run once by hand to check:  powershell -ExecutionPolicy Bypass -File "C:\GoSkinly\plt-sync.ps1"
#   4. Schedule it daily (Command Prompt, as the same Windows user):
#      schtasks /Create /SC DAILY /ST 20:00 /TN "GoSkinly PLT sync" /F /TR "powershell.exe -NoProfile -ExecutionPolicy Bypass -File \"C:\GoSkinly\plt-sync.ps1\""
#
# Each run appends one line to plt-sync.log next to this script.

$MobicareModels = "C:\PATH\TO\Mobicare\Models"      # <-- Mobicare's Models folder ("" to skip)
$TiaRoot        = "C:\PATH\TO\TIA CREATION"          # <-- the TIA CREATION folder ("" to skip)
$Key            = "PASTE-THE-KEY-HERE"                # <-- from GoSkinly
$Endpoint       = "https://us-central1-skinly-3003b.cloudfunctions.net/pltInventoryUpload"

$ErrorActionPreference = "Stop"
$log = Join-Path $PSScriptRoot "plt-sync.log"
function Log($text) { Add-Content -LiteralPath $log -Value ("{0}  {1}" -f (Get-Date -Format s), $text) }
function Unix($dt) { ([DateTimeOffset]$dt).ToUnixTimeSeconds() }

function Send($vendor, $root, $sb, $count) {
    # Gzipped: tens of thousands of names shrink to a few hundred KB.
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($sb.ToString())
    $ms = New-Object System.IO.MemoryStream
    $gz = New-Object System.IO.Compression.GZipStream($ms, [System.IO.Compression.CompressionMode]::Compress)
    $gz.Write($bytes, 0, $bytes.Length)
    $gz.Close()
    $headers = @{
        "x-plt-key"     = $Key
        "x-plt-vendor"  = $vendor
        "x-plt-machine" = $env:COMPUTERNAME
        "x-plt-root"    = [uri]::EscapeDataString($root)
    }
    $r = Invoke-RestMethod -Uri $Endpoint -Method Post -Body $ms.ToArray() -ContentType "application/octet-stream" -Headers $headers -TimeoutSec 600
    $added = if ($r.result) { $r.result.added } else { "?" }
    Log ("{0}: sent {1} lines, {2} new models for approval" -f $vendor, $count, $added)
    Write-Host ("{0}: sent {1} lines, {2} new models for approval" -f $vendor, $count, $added)
}

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
Add-Type -AssemblyName System.IO.Compression.FileSystem
$failed = $false

# ── Mobicare ─────────────────────────────────────────────────────────────────
if ($MobicareModels) {
    try {
        if (-not (Test-Path -LiteralPath $MobicareModels)) { throw "Folder not found: $MobicareModels" }
        $rootFull = (Resolve-Path -LiteralPath $MobicareModels).Path.TrimEnd('\')
        $sb = New-Object System.Text.StringBuilder
        $count = 0
        $skipped = @()
        # One line per cut file: "Mobile Skins/Samsung.mcz::Galaxy S24 Ultra (5G)-B1.mdl <TAB> bytes <TAB> unix time"
        Get-ChildItem -LiteralPath $rootFull -Recurse -File -ErrorAction SilentlyContinue | ForEach-Object {
            $rel = $_.FullName.Substring($rootFull.Length).TrimStart('\') -replace '\\', '/'
            $ext = $_.Extension.ToLower()
            if ($ext -eq ".mdl" -or $ext -eq ".plt") {
                [void]$sb.Append($rel).Append("`t").Append($_.Length).Append("`t").Append((Unix $_.LastWriteTimeUtc)).Append("`n")
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
        if ($skipped.Count) { Log ("mobicare: could not read {0}" -f ($skipped -join ", ")) }
        Send "mobicare" $rootFull $sb $count
    }
    catch { Log "mobicare FAILED: $($_.Exception.Message)"; Write-Host "mobicare FAILED: $($_.Exception.Message)"; $failed = $true }
}

# ── TIA Creation ─────────────────────────────────────────────────────────────
if ($TiaRoot) {
    try {
        if (-not (Test-Path -LiteralPath $TiaRoot)) { throw "Folder not found: $TiaRoot" }
        $rootFull = (Resolve-Path -LiteralPath $TiaRoot).Path.TrimEnd('\')
        $data = Join-Path $rootFull "GadgetPlotData"
        $sb = New-Object System.Text.StringBuilder
        $count = 0
        # "B <TAB> id <TAB> category <TAB> BRAND" from brand.txt, "M <TAB> id <TAB> category <TAB> brandId <TAB> NAME <TAB> flag" from model.txt
        foreach ($pair in @(@("brand.txt", "B", 3), @("model.txt", "M", 5))) {
            $file = Join-Path $data $pair[0]
            if (-not (Test-Path -LiteralPath $file)) { throw "Missing $file" }
            foreach ($line in [System.IO.File]::ReadAllLines($file, [System.Text.Encoding]::UTF8)) {
                $f = $line.Split('~')
                if ($f.Count -lt 3) { continue }
                $cols = @($pair[1]) + ($f + @("", "", "", "", ""))[0..($pair[2] - 1)]
                [void]$sb.Append(($cols -join "`t")).Append("`n")
                $count++
            }
        }
        # "T <TAB> 46979_XIAOMI REDMI NOTE 15 5G - B1.tc <TAB> unix time" for every part file
        Get-ChildItem -LiteralPath (Join-Path $rootFull "Templates") -Filter *.tc -File -ErrorAction SilentlyContinue | ForEach-Object {
            [void]$sb.Append("T`t").Append($_.Name).Append("`t").Append((Unix $_.LastWriteTimeUtc)).Append("`n")
            $count++
        }
        Send "tia" $rootFull $sb $count
    }
    catch { Log "tia FAILED: $($_.Exception.Message)"; Write-Host "tia FAILED: $($_.Exception.Message)"; $failed = $true }
}

if ($failed) { exit 1 }
