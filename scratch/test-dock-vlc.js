const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

function getVlcPath() {
    const paths = [
        'C:\\Program Files\\VideoLAN\\VLC\\vlc.exe',
        'C:\\Program Files (x86)\\VideoLAN\\VLC\\vlc.exe'
    ];
    for (const p of paths) {
        if (fs.existsSync(p)) return p;
    }
    return 'vlc';
}

const vlcPath = getVlcPath();
const testUrl = "http://line.liondnscloud.ru/movie/bilal000/mpbK2326/1388103.mkv";

// We can spawn VLC with --no-video-title-show and --no-video-deco
console.log("Spawning VLC...");
const vlcProcess = spawn(vlcPath, [
    testUrl,
    '-I', 'dummy', // dummy interface (no gui)
    '--no-video-title-show',
    '--no-video-deco',
]);

console.log("Spawned VLC with PID:", vlcProcess.pid);

// Let's check window handles
const psScript = `
$code = @'
using System;
using System.Runtime.InteropServices;
public class Win32 {
    [DllImport("user32.dll")]
    public static extern IntPtr SetParent(IntPtr hWndChild, IntPtr hWndNewParent);
    [DllImport("user32.dll")]
    public static extern int SetWindowLong(IntPtr hWnd, int nIndex, int dwNewLong);
    [DllImport("user32.dll")]
    public static extern bool MoveWindow(IntPtr hWnd, int X, int Y, int nWidth, int nHeight, bool bRepaint);
    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
}
'@
Add-Type -TypeDefinition $code

# Wait and find VLC window
$vlcHwnd = [IntPtr]::Zero
for ($i = 0; $i -lt 50; $i++) {
    $proc = Get-Process -Id ${vlcProcess.pid} -ErrorAction SilentlyContinue
    if ($proc) {
        $vlcHwnd = $proc.MainWindowHandle
        if ($vlcHwnd -ne [IntPtr]::Zero) {
            break;
        }
    }
    Start-Sleep -Milliseconds 100
}

Write-Host "VLC HWND: $vlcHwnd"
`;

const ps = spawn('powershell', ['-Command', psScript]);
ps.stdout.on('data', (data) => console.log('PS STDOUT:', data.toString()));
ps.stderr.on('data', (data) => console.error('PS STDERR:', data.toString()));

setTimeout(() => {
    console.log("Killing VLC...");
    vlcProcess.kill();
    process.exit(0);
}, 6000);
