Add-Type -AssemblyName System.Drawing

$root = Resolve-Path "."
$pcDir = Join-Path $root "pc"
$sourceIcon = Join-Path $pcDir "icon.png"

Write-Host "Source PC Icon: $sourceIcon"

if (-not (Test-Path $sourceIcon)) {
    Write-Error "Source icon not found at $sourceIcon"
    exit 1
}

# Functions to crop and resize using GDI+
function Resize-Square {
    param(
        [string]$SrcPath,
        [string]$DstPath,
        [int]$Size
    )
    $img = [System.Drawing.Image]::FromFile($SrcPath)
    $bmp = New-Object System.Drawing.Bitmap($Size, $Size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    
    # Square Center Crop calculation
    $srcSize = $img.Width
    $srcX = 0
    $srcY = 0
    if ($img.Width -gt $img.Height) {
        $srcSize = $img.Height
        $srcX = [Math]::Floor(($img.Width - $img.Height) / 2)
    } elseif ($img.Height -gt $img.Width) {
        $srcSize = $img.Width
        $srcY = [Math]::Floor(($img.Height - $img.Width) / 2)
    }
    
    $g.DrawImage($img, (New-Object System.Drawing.Rectangle(0, 0, $Size, $Size)), $srcX, $srcY, $srcSize, $srcSize, [System.Drawing.GraphicsUnit]::Pixel)
    
    # Ensure directory exists
    $parent = Split-Path -Parent $DstPath
    if (-not (Test-Path $parent)) {
        New-Item -ItemType Directory -Force -Path $parent | Out-Null
    }
    
    $bmp.Save($DstPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
    $img.Dispose()
}

# 1. Generate pc/build/icon.png (256x256)
$buildIconPath = Join-Path $pcDir "build/icon.png"
Remove-Item $buildIconPath -ErrorAction SilentlyContinue
Resize-Square $sourceIcon $buildIconPath 256
Write-Host "Created pc/build/icon.png (256x256)"

# 2. Generate pc/src/assets/icon.png (64x64)
$appIconPath = Join-Path $pcDir "src/assets/icon.png"
Remove-Item $appIconPath -ErrorAction SilentlyContinue
Resize-Square $sourceIcon $appIconPath 64
Write-Host "Created pc/src/assets/icon.png (64x64)"

# 3. Generate web/assets/icon.png (64x64) to keep web core in sync
$webIconPath = Join-Path $root "web/assets/icon.png"
Remove-Item $webIconPath -ErrorAction SilentlyContinue
Resize-Square $sourceIcon $webIconPath 64
Write-Host "Created web/assets/icon.png (64x64)"

# 4. Clean up original untracked source files in pc/
Write-Host "Cleaning up original PC source images..."
Remove-Item (Join-Path $pcDir "icon.png") -ErrorAction SilentlyContinue
Remove-Item (Join-Path $pcDir "icon (1).png") -ErrorAction SilentlyContinue

Write-Host "PC Assets updated and cleaned successfully!"
