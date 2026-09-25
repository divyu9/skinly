# GoSkinly - PLT folder sync
#
# Runs on the Windows PC that drives the cutting plotter, once a day (Task
# Scheduler). Lists every cut file under $Root and posts the list to the
# website's server: path, size and modified time, one line per file. It sends
# names only, never the files, and changes nothing on this PC.
#
# The server turns the names into models ("Samsung\S24 Ultra - Back B1.plt"
# and "...Side A.plt" are one model) and shows new ones in the admin under
# "New models found" for approval. See functions/src/pltSync.ts.
#
# Works on the PowerShell that ships with Windows 10/11 (5.1). Nothing to
# install.
#
# Setup:
#   1. Set $Root below to the cutting software's PLT folder.
#   2. Set $Key to the key you were given (keep it private).
#   3. Run once by hand to check:  powershell -ExecutionPolicy Bypass -File "C:\GoSkinly\plt-sync.ps1"
#   4. Schedule it daily (Command Prompt, as the same Windows user):
#      schtasks /Create /SC DAILY /ST 20:00 /TN "GoSkinly PLT sync" /F /TR "powershell.exe -NoProfile -ExecutionPolicy Bypass -File \"C:\GoSkinly\plt-sync.ps1\""
#
# Each run appends one line to plt-sync.log next to this script.

$Root       = "C:\PATH\TO\PLT\FOLDER"     # <-- the cutting software's folder
$Key        = "PASTE-THE-KEY-HERE"        # <-- from GoSkinly
$Extensions = @(".plt")                   # file types to send
$Endpoint   = "https://us-central1-skinly-3003b.cloudfunctions.net/pltInventoryUpload"

$ErrorActionPreference = "Stop"
$log = Join-Path $PSScriptRoot "plt-sync.log"

try {
    if (-not (Test-Path -LiteralPath $Root)) { throw "Folder not found: $Root" }
    $rootFull = (Resolve-Path -LiteralPath $Root).Path.TrimEnd('\')

    $sb = New-Object System.Text.StringBuilder
    $count = 0
    Get-ChildItem -LiteralPath $rootFull -Recurse -File -ErrorAction SilentlyContinue |
        Where-Object { $Extensions -contains $_.Extension.ToLower() } |
        ForEach-Object {
            $rel = $_.FullName.Substring($rootFull.Length).TrimStart('\') -replace '\\', '/'
            $modified = ([DateTimeOffset]$_.LastWriteTimeUtc).ToUnixTimeSeconds()
            [void]$sb.Append($rel).Append("`t").Append($_.Length).Append("`t").Append($modified).Append("`n")
            $count++
        }

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
    Write-Host "Done: sent $count files."
}
catch {
    $line = "{0}  FAILED: {1}" -f (Get-Date -Format s), $_.Exception.Message
    Add-Content -LiteralPath $log -Value $line
    Write-Host "FAILED: $($_.Exception.Message)"
    exit 1
}
