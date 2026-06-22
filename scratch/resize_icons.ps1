Add-Type -AssemblyName System.Drawing
$srcPath = "android-tv\playstore\icon_512x512.png"
$bmp = New-Object System.Drawing.Bitmap($srcPath)
$newBmp = New-Object System.Drawing.Bitmap(400, 400)
$graph = [System.Drawing.Graphics]::FromImage($newBmp)
$graph.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$graph.DrawImage($bmp, 0, 0, 400, 400)
$newBmp.Save("webOS\icon.png", [System.Drawing.Imaging.ImageFormat]::Png)
$newBmp.Save("webOS\largeIcon.png", [System.Drawing.Imaging.ImageFormat]::Png)
$graph.Dispose()
$newBmp.Dispose()
$bmp.Dispose()
Write-Host "webOS icons resized to 400x400 successfully!"
