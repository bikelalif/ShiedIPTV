Add-Type -AssemblyName System.Drawing

$scriptPath = $MyInvocation.MyCommand.Path
if ($scriptPath) {
    $scriptDir = Split-Path -Parent $scriptPath
    $root = Split-Path -Parent $scriptDir
} else {
    $root = Get-Location
}
$vidaaDir = Join-Path $root "vidaa"

# Sources
$sourceIcon = Join-Path $vidaaDir "icon.png"
$sourceBanner = Join-Path $vidaaDir "banner.png"

Write-Host "Source Vidaa Icon: $sourceIcon"
Write-Host "Source Vidaa Banner: $sourceBanner"

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

function Resize-Banner {
    param(
        [string]$SrcPath,
        [string]$DstPath,
        [int]$W,
        [int]$H
    )
    $img = [System.Drawing.Image]::FromFile($SrcPath)
    $bmp = New-Object System.Drawing.Bitmap($W, $H)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    
    # 16:9 crop calculation
    $srcW = $img.Width
    $srcH = $img.Width * (9 / 16)
    $srcX = 0
    $srcY = [Math]::Floor(($img.Height - $srcH) / 2)
    
    if ($srcH -gt $img.Height) {
        $srcH = $img.Height
        $srcW = $img.Height * (16 / 9)
        $srcX = [Math]::Floor(($img.Width - $srcW) / 2)
        $srcY = 0
    }
    
    $g.DrawImage($img, (New-Object System.Drawing.Rectangle(0, 0, $W, $H)), $srcX, $srcY, $srcW, $srcH, [System.Drawing.GraphicsUnit]::Pixel)
    
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

# 1. Generate web/assets/vidaa_icon.png (512x512)
$webIconPath = Join-Path $root "web/assets/vidaa_icon.png"
Remove-Item $webIconPath -ErrorAction SilentlyContinue
Resize-Square $sourceIcon $webIconPath 512
Write-Host "Created web/assets/vidaa_icon.png (512x512)"

# 2. Generate web/assets/vidaa_banner.png (1280x720)
if (Test-Path $sourceBanner) {
    $webBannerPath = Join-Path $root "web/assets/vidaa_banner.png"
    Remove-Item $webBannerPath -ErrorAction SilentlyContinue
    Resize-Banner $sourceBanner $webBannerPath 1280 720
    Write-Host "Created web/assets/vidaa_banner.png (1280x720)"
} else {
    Write-Warning "Source banner not found at $sourceBanner. Skipping banner generation."
}

# 3. Clean up original source images from vidaa root
Write-Host "Cleaning up Vidaa source images..."
Remove-Item (Join-Path $vidaaDir "icon.png") -ErrorAction SilentlyContinue
Remove-Item (Join-Path $vidaaDir "banner.png") -ErrorAction SilentlyContinue

Write-Host "Vidaa Assets processed and cleaned successfully!"
