$Url = "https://mirrors.ircam.fr/pub/videolan/vlc/3.0.21/win64/vlc-3.0.21-win64.zip"
$ZipFile = Join-Path $PSScriptRoot "vlc-win64.zip"
$BinDir = Join-Path $PSScriptRoot "bin"
$DestVlcDir = Join-Path $BinDir "vlc"

Write-Host "Starting portable VLC download from: $Url..."
if (-not (Test-Path $BinDir)) {
    New-Item -ItemType Directory -Path $BinDir | Out-Null
}

if (-not (Test-Path $ZipFile)) {
    # Download zip file
    Invoke-WebRequest -Uri $Url -OutFile $ZipFile -UseBasicParsing
    Write-Host "Download completed successfully."
} else {
    Write-Host "Zip archive already exists, skipping download."
}

if (Test-Path $DestVlcDir) {
    Write-Host "Cleaning existing VLC target directory..."
    Remove-Item -Recurse -Force $DestVlcDir
}

Write-Host "Extracting ZIP to $BinDir..."
Expand-Archive -Path $ZipFile -DestinationPath $BinDir -Force

# The ZIP contains a root folder named vlc-3.0.21
$SourceVlcDir = Join-Path $BinDir "vlc-3.0.21"
if (Test-Path $SourceVlcDir) {
    Write-Host "Renaming $SourceVlcDir to $DestVlcDir..."
    Rename-Item -Path $SourceVlcDir -NewName "vlc"
} else {
    Write-Warning "Could not find extracted folder vlc-3.0.21. Please verify structure."
}

# Clean up ZIP
if (Test-Path $ZipFile) {
    Write-Host "Cleaning up ZIP archive..."
    Remove-Item -Force $ZipFile
}

Write-Host "VLC portable setup completed successfully."
