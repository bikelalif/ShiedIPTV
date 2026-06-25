Add-Type -AssemblyName System.Drawing

$root = Resolve-Path "."
$pcDir = Join-Path $root "pc"
$sourceIcon = Join-Path $pcDir "icon.png"

# Fall back to pc/build/icon.png if the source doesn't exist at pc/icon.png
if (-not (Test-Path $sourceIcon)) {
    $sourceIcon = Join-Path $pcDir "build/icon.png"
}

Write-Host "Source PC Icon: $sourceIcon"

if (-not (Test-Path $sourceIcon)) {
    Write-Error "Source icon not found. Place a large icon.png in pc/ or pc/build/"
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

# ============================================================
# 5. Generate all Windows Store AppX icons (electron-builder appx)
#    Source: pc/icon.png or pc/build/icon.png
#    Destination: pc/build/appx-icons/
#
#    Required sizes for AppX (electron-builder reads from the "appx.icons" folder):
#      Square44x44Logo     -> 44, 55 (100%), 88 (200%)
#      Square150x150Logo   -> 150, 300 (200%)
#      Wide310x150Logo     -> 310x150 (rectangular - filled with centered icon)
#      Square310x310Logo   -> 310
#      StoreLogo           -> 50
# ============================================================

function Resize-AppX {
    param(
        [string]$SrcPath,
        [string]$DstPath,
        [int]$Width,
        [int]$Height = 0
    )
    if ($Height -eq 0) { $Height = $Width }

    $img = [System.Drawing.Image]::FromFile($SrcPath)
    $bmp = New-Object System.Drawing.Bitmap($Width, $Height)
    $g = [System.Drawing.Graphics]::FromImage($bmp)

    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)

    # For rectangular tiles (Wide), center the icon
    $srcMinDim = [Math]::Min($img.Width, $img.Height)
    $dstMinDim = [Math]::Min($Width, $Height)
    $scale = $dstMinDim / $srcMinDim
    $drawW = [int]($img.Width * $scale)
    $drawH = [int]($img.Height * $scale)
    $drawX = [int](($Width - $drawW) / 2)
    $drawY = [int](($Height - $drawH) / 2)

    $g.DrawImage($img, (New-Object System.Drawing.Rectangle($drawX, $drawY, $drawW, $drawH)))

    $parent = Split-Path -Parent $DstPath
    if (-not (Test-Path $parent)) {
        New-Item -ItemType Directory -Force -Path $parent | Out-Null
    }

    $bmp.Save($DstPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
    $img.Dispose()
}

# Source icon (prefer pc/build/icon.png which is the 256px version)
$appxSrc = Join-Path $pcDir "build/icon.png"
if (-not (Test-Path $appxSrc)) {
    $appxSrc = $sourceIcon
}
$appxDir = Join-Path $pcDir "build/appx-icons"

Write-Host ""
Write-Host "=== Generating Windows Store AppX icons ==="

# Square44x44Logo (used in taskbar, Start menu small tiles)
Resize-AppX $appxSrc (Join-Path $appxDir "Square44x44Logo.png") 44
Resize-AppX $appxSrc (Join-Path $appxDir "Square44x44Logo.targetsize-44.png") 44
Resize-AppX $appxSrc (Join-Path $appxDir "Square44x44Logo.scale-200.png") 88
Write-Host "Created Square44x44Logo variants (44px, 88px)"

# Square150x150Logo (medium Start menu tile)
Resize-AppX $appxSrc (Join-Path $appxDir "Square150x150Logo.png") 150
Resize-AppX $appxSrc (Join-Path $appxDir "Square150x150Logo.scale-200.png") 300
Write-Host "Created Square150x150Logo variants (150px, 300px)"

# Wide310x150Logo (wide Start menu tile)
Resize-AppX $appxSrc (Join-Path $appxDir "Wide310x150Logo.png") 310 150
Resize-AppX $appxSrc (Join-Path $appxDir "Wide310x150Logo.scale-200.png") 620 300
Write-Host "Created Wide310x150Logo variants (310x150, 620x300)"

# Square310x310Logo (large Start menu tile)
Resize-AppX $appxSrc (Join-Path $appxDir "Square310x310Logo.png") 310
Write-Host "Created Square310x310Logo (310px)"

# StoreLogo (shown in the Microsoft Store listing)
Resize-AppX $appxSrc (Join-Path $appxDir "StoreLogo.png") 50
Resize-AppX $appxSrc (Join-Path $appxDir "StoreLogo.scale-200.png") 100
Write-Host "Created StoreLogo variants (50px, 100px)"

Write-Host ""
Write-Host "AppX icons generated in: $appxDir"
Write-Host "Add 'appx.icons: build/appx-icons' to pc/package.json to use them."

