# ShieldIPTV - mpv embedding test in a native WinForms window.
# A real Win32 window (not a web engine), so mpv --wid embeds perfectly with
# its native controls, fills the window, resizes with it, and stays clickable.

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$mpv = "C:\Users\Bilal\Documents\ShieldIPTV\pc\resources\mpv\mpv.exe"
$url = "http://103.176.90.109/movie/bilal000/mpbK2326/1313180.mkv"

# input.conf so ESC / q quit mpv -> returns to the Play button.
$conf = Join-Path $env:TEMP "shield_mpv_input.conf"
Set-Content -Path $conf -Value "ESC quit`r`nq quit" -Encoding ASCII

$script:proc = $null

$form = New-Object System.Windows.Forms.Form
$form.Text = "ShieldIPTV - Test mpv (WinForms natif)"
$form.Size = New-Object System.Drawing.Size(1000, 620)
$form.StartPosition = "CenterScreen"
$form.BackColor = [System.Drawing.Color]::Black

# Panel that hosts the video: mpv renders INTO this panel's HWND.
$panel = New-Object System.Windows.Forms.Panel
$panel.Dock = "Fill"
$panel.BackColor = [System.Drawing.Color]::Black
$form.Controls.Add($panel)

# Big centered Play button.
$btn = New-Object System.Windows.Forms.Button
$btn.Text = [string][char]0x25B6
$btn.Font = New-Object System.Drawing.Font("Segoe UI", 40)
$btn.Size = New-Object System.Drawing.Size(150, 150)
$btn.ForeColor = [System.Drawing.Color]::White
$btn.BackColor = [System.Drawing.Color]::FromArgb(108, 140, 255)
$btn.FlatStyle = "Flat"
$btn.FlatAppearance.BorderSize = 0
$panel.Controls.Add($btn)

function Center-Button {
    $btn.Left = [int](($panel.ClientSize.Width  - $btn.Width)  / 2)
    $btn.Top  = [int](($panel.ClientSize.Height - $btn.Height) / 2)
}
Center-Button
$panel.Add_Resize({ Center-Button })

$btn.Add_Click({
    $btn.Visible = $false
    $wid = $panel.Handle.ToInt64()
    $args = @(
        "`"$url`"",
        "--wid=$wid",
        "--no-config",
        "--osc=yes",
        "--script-opts=osc-visibility=always",
        "--keep-open=yes",
        "--hwdec=auto-safe",
        "--cursor-autohide=no",
        "--input-conf=`"$conf`""
    )
    $script:proc = Start-Process -FilePath $mpv -ArgumentList $args -PassThru
})

# When mpv exits (ESC / q / end), bring the Play button back.
$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 600
$timer.Add_Tick({
    if ($script:proc -and $script:proc.HasExited) {
        $script:proc = $null
        $btn.Visible = $true
    }
})
$timer.Start()

$form.Add_FormClosed({
    if ($script:proc -and -not $script:proc.HasExited) { try { $script:proc.Kill() } catch {} }
})

[System.Windows.Forms.Application]::EnableVisualStyles()
[System.Windows.Forms.Application]::Run($form)
