Add-Type -AssemblyName System.Drawing

$scriptPath = $MyInvocation.MyCommand.Path
if ($scriptPath) {
    $scriptDir = Split-Path -Parent $scriptPath
    $root = Split-Path -Parent $scriptDir
} else {
    $root = Get-Location
}
$androidRoot = Join-Path $root "android-tv"
$resDir = Join-Path $androidRoot "app/src/main/res"

# Sources
$sourceIcon = Join-Path $androidRoot "ic_launcher.png"
$sourceBanner = Join-Path $androidRoot "banner.png"

Write-Host "Source Icon: $sourceIcon"
Write-Host "Source Banner: $sourceBanner"

# 1. Delete adaptive icons XMLs (forces fallback to PNGs on newer APIs)
$anyDpiDir = Join-Path $resDir "mipmap-anydpi-v26"
if (Test-Path $anyDpiDir) {
    Remove-Item (Join-Path $anyDpiDir "ic_launcher.xml") -ErrorAction SilentlyContinue
    Remove-Item (Join-Path $anyDpiDir "ic_launcher_round.xml") -ErrorAction SilentlyContinue
    Write-Host "Deleted adaptive XML launcher files."
}

# 2. Densities map for Mipmaps
$densities = @{
    "mipmap-mdpi"    = 48
    "mipmap-hdpi"    = 72
    "mipmap-xhdpi"   = 96
    "mipmap-xxhdpi"  = 144
    "mipmap-xxxhdpi" = 192
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
    
    $bmp.Save($DstPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
    $img.Dispose()
}

function Create-Circular {
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
    
    # Clip circle
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $path.AddEllipse(0, 0, $Size, $Size)
    $g.SetClip($path)
    
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
    
    $bmp.Save($DstPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $path.Dispose()
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
    
    $bmp.Save($DstPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
    $img.Dispose()
}

# 3. Process Mipmaps
$densities.GetEnumerator() | ForEach-Object {
    $folder = $_.Key
    $size = $_.Value
    $targetFolder = Join-Path $resDir $folder
    
    # Clear old webp files
    Remove-Item (Join-Path $targetFolder "ic_launcher.webp") -ErrorAction SilentlyContinue
    Remove-Item (Join-Path $targetFolder "ic_launcher_round.webp") -ErrorAction SilentlyContinue
    Remove-Item (Join-Path $targetFolder "ic_launcher.png") -ErrorAction SilentlyContinue
    Remove-Item (Join-Path $targetFolder "ic_launcher_round.png") -ErrorAction SilentlyContinue
    
    # Resize new PNGs
    if (Test-Path $sourceIcon) {
        Resize-Square $sourceIcon (Join-Path $targetFolder "ic_launcher.png") $size
        Create-Circular $sourceIcon (Join-Path $targetFolder "ic_launcher_round.png") $size
        Write-Host "Created icons (square & round) in $folder ($size x $size px)"
    }
}

# 4. Process Banner
$drawableFolder = Join-Path $resDir "drawable"
Remove-Item (Join-Path $drawableFolder "banner.png") -ErrorAction SilentlyContinue
if (Test-Path $sourceBanner) {
    Resize-Banner $sourceBanner (Join-Path $drawableFolder "banner.png") 320 180
    Write-Host "Created TV Leanback banner in drawable/banner.png (320 x 180 px)"
}

# 5. Clean up old untracked source photos in android-tv directory as requested
Write-Host "Cleaning up old source assets..."
Remove-Item (Join-Path $androidRoot "ic_launcher (1).png") -ErrorAction SilentlyContinue
Remove-Item (Join-Path $androidRoot "ic_launcher (2).png") -ErrorAction SilentlyContinue
Remove-Item (Join-Path $androidRoot "ic_launcher.png") -ErrorAction SilentlyContinue
Remove-Item (Join-Path $androidRoot "banner.png") -ErrorAction SilentlyContinue
Remove-Item (Join-Path $androidRoot "play_store_icon.png") -ErrorAction SilentlyContinue

Write-Host "All icons resized, synced, and cleaned successfully!"
