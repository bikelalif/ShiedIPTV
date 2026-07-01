# scripts/build-webos.ps1
# Automate compiling both UHD (1920x1080) and FHD (1280x720) packages for LG Seller Office

$ErrorActionPreference = "Stop"

$workspaceRoot = "c:\Users\Bilal\Documents\ShieldIPTV"
$appinfoPath = "$workspaceRoot\webOS\appinfo.json"

Write-Output "=== Starting webOS Multi-Resolution Build ==="

# Helper function to modify resolution in appinfo.json
function Set-Resolution($resolution) {
    Write-Output "Configuring appinfo.json resolution to $resolution..."
    $content = Get-Content -Path $appinfoPath -Raw | ConvertFrom-Json
    $content.resolution = $resolution
    $content | ConvertTo-Json -Depth 10 | Set-Content -Path $appinfoPath
}

# 1. Build UHD (1920x1080)
Set-Resolution "1920x1080"
Write-Output "Packaging UHD version..."
& ares-package "$workspaceRoot\webOS" -o "$workspaceRoot"

$uhdFile = Get-ChildItem -Path "$workspaceRoot" -Filter "com.shieldiptv.app_*_all.ipk" | Select-Object -First 1
if ($uhdFile) {
    $uhdDest = "$workspaceRoot\com.shieldiptv.app_1.0.0_uhd.ipk"
    Move-Item -Path $uhdFile.FullName -Destination $uhdDest -Force
    Write-Output "UHD package created: com.shieldiptv.app_1.0.0_uhd.ipk"
} else {
    throw "Failed to find generated UHD IPK file."
}

# 2. Build FHD (1280x720)
Set-Resolution "1280x720"
Write-Output "Packaging FHD version..."
& ares-package "$workspaceRoot\webOS" -o "$workspaceRoot"

$fhdFile = Get-ChildItem -Path "$workspaceRoot" -Filter "com.shieldiptv.app_*_all.ipk" | Select-Object -First 1
if ($fhdFile) {
    $fhdDest = "$workspaceRoot\com.shieldiptv.app_1.0.0_fhd.ipk"
    Move-Item -Path $fhdFile.FullName -Destination $fhdDest -Force
    Write-Output "FHD package created: com.shieldiptv.app_1.0.0_fhd.ipk"
} else {
    throw "Failed to find generated FHD IPK file."
}

# 3. Restore appinfo.json to default (1920x1080)
Set-Resolution "1920x1080"

# 4. Zip both IPK packages into com.shieldiptv.app_1.0.0_all.zip
Write-Output "Zipping packages..."
$zipPath = "$workspaceRoot\com.shieldiptv.app_1.0.0_all.zip"
if (Test-Path $zipPath) {
    Remove-Item $zipPath -Force
}

# Use Compress-Archive to bundle both .ipk files
Compress-Archive -Path "$workspaceRoot\com.shieldiptv.app_1.0.0_uhd.ipk", "$workspaceRoot\com.shieldiptv.app_1.0.0_fhd.ipk" -DestinationPath $zipPath -Force

Write-Output "Zip archive updated: com.shieldiptv.app_1.0.0_all.zip"
Write-Output "=== Build Complete Successfully ==="
