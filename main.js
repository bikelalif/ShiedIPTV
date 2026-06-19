const { app, BrowserWindow, ipcMain, globalShortcut, screen } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

// Disable SSL certificate verification to allow connecting to private IPTV portals with self-signed/expired/invalid certificates
app.commandLine.appendSwitch('ignore-certificate-errors');

let psProcess = null;
let currentVlcProcess = null;

function initPowerShell() {
    console.log("[Main] Initializing PowerShell background helper...");
    try {
        psProcess = spawn('powershell', ['-NoExit', '-Command', '-']);
        
        const bootstrap = `
$code = @'
using System;
using System.Runtime.InteropServices;
using System.Diagnostics;
using System.Threading;

public class Win32 {
    [DllImport("user32.dll")]
    public static extern IntPtr SetParent(IntPtr hWndChild, IntPtr hWndNewParent);
    [DllImport("user32.dll")]
    public static extern int SetWindowLong(IntPtr hWnd, int nIndex, int dwNewLong);
    [DllImport("user32.dll")]
    public static extern bool MoveWindow(IntPtr hWnd, int X, int Y, int nWidth, int nHeight, bool bRepaint);
    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    [DllImport("user32.dll")]
    public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);
}

public class MouseHook {
    private const int WH_MOUSE_LL = 14;
    private const int WM_LBUTTONDOWN = 0x0201;

    public delegate IntPtr HookProc(int nCode, IntPtr wParam, IntPtr lParam);
    private static HookProc _proc = HookCallback;
    private static IntPtr _hookID = IntPtr.Zero;
    private static IntPtr _targetHwnd = IntPtr.Zero;
    private static int _targetPid = 0;
    private static double _scaleFactor = 1.0;
    private static Thread _hookThread;

    public static void Start(IntPtr targetHwnd, int targetPid, double scaleFactor) {
        Stop();
        _targetHwnd = targetHwnd;
        _targetPid = targetPid;
        _scaleFactor = scaleFactor;
        _hookThread = new Thread(() => {
            _hookID = SetHook(_proc);
            RunMessageLoop();
        });
        _hookThread.IsBackground = true;
        _hookThread.Start();
    }

    public static void Stop() {
        if (_hookID != IntPtr.Zero) {
            UnhookWindowsHookEx(_hookID);
            _hookID = IntPtr.Zero;
        }
    }

    private static IntPtr SetHook(HookProc proc) {
        using (Process curProcess = Process.GetCurrentProcess())
        using (ProcessModule curModule = curProcess.MainModule) {
            return SetWindowsHookEx(WH_MOUSE_LL, proc, GetModuleHandle(curModule.ModuleName), 0);
        }
    }

    private static IntPtr HookCallback(int nCode, IntPtr wParam, IntPtr lParam) {
        if (nCode >= 0 && wParam == (IntPtr)WM_LBUTTONDOWN) {
            POINT p = CursorPosition();
            IntPtr clickedHwnd = WindowFromPoint(p);
            if (clickedHwnd == _targetHwnd || IsChildOf(_targetHwnd, clickedHwnd)) {
                RECT r;
                GetWindowRect(_targetHwnd, out r);
                double controlThreshold = r.bottom - (90.0 * _scaleFactor);
                
                // If the click is above the control bar, trigger process exit
                if (p.y < controlThreshold) {
                    try {
                        Process proc = Process.GetProcessById(_targetPid);
                        proc.Kill();
                    } catch {}
                }
            }
        }
        return CallNextHookEx(_hookID, nCode, wParam, lParam);
    }

    private static bool IsChildOf(IntPtr parent, IntPtr child) {
        IntPtr current = child;
        while (current != IntPtr.Zero) {
            if (current == parent) return true;
            current = GetParent(current);
        }
        return false;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct POINT {
        public int x;
        public int y;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct RECT {
        public int left;
        public int top;
        public int right;
        public int bottom;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct MSG {
        public IntPtr hwnd;
        public uint message;
        public IntPtr wParam;
        public IntPtr lParam;
        public uint time;
        public POINT pt;
        public uint lPrivate;
    }

    private static POINT CursorPosition() {
        POINT p;
        GetCursorPos(out p);
        return p;
    }

    [DllImport("user32.dll")]
    public static extern bool GetCursorPos(out POINT lpPoint);

    [DllImport("user32.dll")]
    public static extern IntPtr WindowFromPoint(POINT Point);

    [DllImport("user32.dll")]
    public static extern IntPtr GetParent(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

    [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    private static extern IntPtr SetWindowsHookEx(int idHook, HookProc lpfn, IntPtr hMod, uint dwThreadId);

    [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool UnhookWindowsHookEx(IntPtr hhk);

    [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    private static extern IntPtr CallNextHookEx(IntPtr hhk, int nCode, IntPtr wParam, IntPtr lParam);

    [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    private static extern IntPtr GetModuleHandle(string lpModuleName);

    [DllImport("user32.dll")]
    private static extern sbyte GetMessage(out MSG lpMsg, IntPtr hWnd, uint wMsgFilterMin, uint wMsgFilterMax);

    [DllImport("user32.dll")]
    private static extern bool TranslateMessage(ref MSG lpMsg);

    [DllImport("user32.dll")]
    private static extern IntPtr DispatchMessage(ref MSG lpMsg);

    private static void RunMessageLoop() {
        MSG msg;
        while (GetMessage(out msg, IntPtr.Zero, 0, 0) != 0) {
            TranslateMessage(ref msg);
            DispatchMessage(ref msg);
        }
    }
}
'@
Add-Type -TypeDefinition $code -ErrorAction SilentlyContinue
`;
        psProcess.stdin.write(bootstrap + "\n");
        
        psProcess.on('error', (err) => {
            console.error("[Main] PowerShell helper error:", err);
        });
    } catch (e) {
        console.error("[Main] Failed to start PowerShell process:", e);
    }
}

function getVlcPath() {
    let packagedPath = '';
    if (app.isPackaged) {
        // In production, extraResources are placed in resources/vlc/
        packagedPath = path.join(process.resourcesPath, 'vlc', 'vlc.exe');
    } else {
        // In development, they are in pc/bin/vlc/
        packagedPath = path.join(__dirname, 'bin', 'vlc', 'vlc.exe');
    }
    
    if (fs.existsSync(packagedPath)) {
        console.log("[Main] Using packaged VLC:", packagedPath);
        return packagedPath;
    }
    
    // Fallbacks
    const paths = [
        'C:\\Program Files\\VideoLAN\\VLC\\vlc.exe',
        'C:\\Program Files (x86)\\VideoLAN\\VLC\\vlc.exe'
    ];
    for (const p of paths) {
        if (fs.existsSync(p)) {
            console.log("[Main] Using system VLC:", p);
            return p;
        }
    }
    console.log("[Main] VLC not found in packaged path or system paths, falling back to 'vlc'");
    return 'vlc'; // Fallback to path
}

function createWindow() {
    const win = new BrowserWindow({
        width: 1280,
        height: 720,
        minWidth: 1024,
        minHeight: 576,
        autoHideMenuBar: true,
        icon: path.join(__dirname, 'src/assets/icon.png'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: false, // Disables CORS checks so local app can query IPTV HTTP streams directly
            preload: path.join(__dirname, 'preload.js')
        }
    });

    // Load local web files from the copy in pc/src/
    win.loadFile(path.join(__dirname, 'src/index.html'));

    win.on('closed', () => {
        if (currentVlcProcess) {
            try { currentVlcProcess.kill(); } catch (e) {}
        }
        if (psProcess) {
            try { psProcess.kill(); } catch (e) {}
        }
    });
}

app.whenReady().then(() => {
    initPowerShell();
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('open-vlc-external', async (event, url) => {
    console.log("[Main] open-vlc-external request:", url);
    const vlcPath = getVlcPath();
    spawn(vlcPath, [url]);
    return true;
});

function unregisterVlcShortcuts() {
    try {
        globalShortcut.unregister('Escape');
    } catch (e) {}
    try {
        globalShortcut.unregister('Backspace');
    } catch (e) {}
}

ipcMain.handle('dock-vlc', async (event, url, rect) => {
    console.log("[Main] dock-vlc request (running external):", url);
    
    // Kill existing VLC process if running
    if (currentVlcProcess) {
        try {
            unregisterVlcShortcuts();
            currentVlcProcess.kill();
        } catch (e) {}
    }
    
    const vlcPath = getVlcPath();
    const tempVlcConfig = path.join(app.getPath('userData'), 'temp_vlcrc');
    
    // Pre-create the temp VLC config to disable privacy prompt and updates check
    try {
        fs.writeFileSync(tempVlcConfig, '[qt]\nqt-privacy-ask=0\nqt-updates-notif=0\n');
    } catch (e) {
        console.error("[Main] Failed to write temp VLC config:", e);
    }

    currentVlcProcess = spawn(vlcPath, [
        url,
        '--config', tempVlcConfig,
        '--no-video-title-show',
        '--no-qt-privacy-ask',
        '--no-qt-updates-notif',
        '--play-and-exit'
    ]);
    
    const vlcPid = currentVlcProcess.pid;
    console.log("[Main] Spawned VLC with PID:", vlcPid);
    
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return false;
    
    // Register Escape and Backspace shortcuts to close VLC
    try {
        globalShortcut.register('Escape', () => {
            if (!win.isDestroyed() && win.isFocused() && currentVlcProcess) {
                console.log("[Main] Escape pressed, killing VLC...");
                try { currentVlcProcess.kill(); } catch (e) {}
            }
        });
        globalShortcut.register('Backspace', () => {
            if (!win.isDestroyed() && win.isFocused() && currentVlcProcess) {
                console.log("[Main] Backspace pressed, killing VLC...");
                try { currentVlcProcess.kill(); } catch (e) {}
            }
        });
    } catch (e) {
        console.error("[Main] Error registering global shortcuts:", e);
    }
    
    currentVlcProcess.on('close', () => {
        console.log("[Main] VLC process closed");
        unregisterVlcShortcuts();
        if (currentVlcProcess && currentVlcProcess.pid === vlcPid) {
            currentVlcProcess = null;
            if (!win.isDestroyed()) {
                win.webContents.send('vlc-exited');
            }
        }
    });
    
    return true;
});

ipcMain.handle('resize-vlc', async (event, rect) => {
    if (!currentVlcProcess) return false;
    const vlcPid = currentVlcProcess.pid;
    
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return false;
    const display = screen.getDisplayMatching(win.getBounds());
    const scaleFactor = display.scaleFactor || 1;
    
    const xOffset = 2;
    const yOffset = 30;
    const widthExtra = 4;
    const heightExtra = 30;
    
    const physicalX = Math.round((rect.x - xOffset) * scaleFactor);
    const physicalY = Math.round((rect.y - yOffset) * scaleFactor);
    const physicalWidth = Math.round((rect.width + widthExtra) * scaleFactor);
    const physicalHeight = Math.round((rect.height + heightExtra) * scaleFactor);
    
    const cmd = `
$proc = Get-Process -Id ${vlcPid} -ErrorAction SilentlyContinue
if ($proc) {
    $vlcHwnd = $proc.MainWindowHandle
    if ($vlcHwnd -ne [IntPtr]::Zero) {
        [Win32]::SetWindowPos($vlcHwnd, [IntPtr]::Zero, ${physicalX}, ${physicalY}, ${physicalWidth}, ${physicalHeight}, 0x0060)
    }
}
`;
    if (psProcess) {
        psProcess.stdin.write(cmd + "\n");
    }
    return true;
});

ipcMain.handle('undock-vlc', async (event) => {
    console.log("[Main] undock-vlc request");
    unregisterVlcShortcuts();
    if (psProcess) {
        psProcess.stdin.write("[MouseHook]::Stop()\n");
    }
    if (currentVlcProcess) {
        try {
            currentVlcProcess.kill();
        } catch (e) {
            console.error("[Main] Error killing VLC process:", e);
        }
        currentVlcProcess = null;
    }
    return true;
});
