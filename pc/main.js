const { app, BrowserWindow, ipcMain, globalShortcut, screen } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

// Disable SSL certificate verification to allow connecting to private IPTV portals with self-signed/expired/invalid certificates
app.commandLine.appendSwitch('ignore-certificate-errors');

let psProcess = null;
let currentVlcProcess = null;

// ---------------------------------------------------------------------------
// Native player (mpv / VLC) embedding
// ---------------------------------------------------------------------------
let mainWindow = null;          // the app BrowserWindow
let nativeProc = null;          // current native player child process
let nativeEngine = null;        // 'mpv' | 'vlc'
let nativeRect = null;          // last video rectangle in CSS px {x,y,width,height}
let nativeEmbedded = false;     // becomes true once the player window is reparented
let nativeReassertTimer = null; // keeps the video sized & on top of the web view

// Fine-tuning offsets (CSS px) applied to the embedded video position.
const NATIVE_OFFSET_X = 0;
const NATIVE_OFFSET_Y = 0;

// Bundled binaries live in pc/resources/ during dev, and in the app's
// resources/ folder once packaged (via electron-builder extraResources).
function resourcesDir() {
    return app.isPackaged ? process.resourcesPath : path.join(__dirname, 'resources');
}
function getMpvPath() {
    const bundled = path.join(resourcesDir(), 'mpv', 'mpv.exe');
    if (fs.existsSync(bundled)) {
        return bundled;
    }
    const paths = [
        'C:\\Program Files\\MPV Player\\mpv.exe',
        'C:\\tools\\mpv\\mpv.exe',
        'C:\\mpv\\mpv.exe',
        'C:\\Program Files\\mpv\\mpv.exe',
        'C:\\Program Files (x86)\\mpv\\mpv.exe',
        path.join(app.getPath('home'), 'scoop', 'shims', 'mpv.exe'),
        path.join(app.getPath('home'), 'AppData', 'Local', 'Programs', 'mpv', 'mpv.exe')
    ];
    for (const p of paths) {
        if (fs.existsSync(p)) {
            return p;
        }
    }
    return 'mpv';
}
function getBundledVlcPath() {
    return path.join(resourcesDir(), 'vlc', 'vlc.exe');
}
function mpvIpcPipe() {
    return '\\\\.\\pipe\\shieldmpv';
}

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
    console.log("[Main] VLC not found in system paths, falling back to 'vlc'");
    return 'vlc'; // Fallback to path
}

function spawnVlc(vlcPath, args) {
    console.log("[Main] Spawning VLC:", vlcPath, args.join(' '));
    const child = spawn(vlcPath, args);
    
    child.on('error', (err) => {
        console.error("[Main] VLC process spawn error:", err);
    });
    
    if (child.stdout) {
        child.stdout.on('data', (data) => {
            console.log(`[VLC Stdout] ${data.toString().trim()}`);
        });
    }
    
    if (child.stderr) {
        child.stderr.on('data', (data) => {
            console.error(`[VLC Stderr] ${data.toString().trim()}`);
        });
    }
    
    return child;
}

// ---------------------------------------------------------------------------
// Native player manager
// ---------------------------------------------------------------------------

function buildMpvArgs(url) {
    const isLive = url.includes('/live/');
    const args = [
        url,
        '--no-config',
        '--force-window=yes',
        '--idle=no',
        '--osc=yes',                              // native on-screen controller (play/pause/seek bar)
        '--input-default-bindings=yes',           // keyboard shortcuts (space, arrows, f...)
        '--input-vo-keyboard=yes',
        '--hwdec=auto-safe',
        '--keep-open=no',
        '--network-timeout=20',
        '--user-agent=ShieldIPTV',
        '--title=Shield IPTV - Lecteur Externe'
    ];
    if (isLive) {
        args.push(
            '--profile=low-latency',
            '--cache=no',
            '--demuxer-lavf-o=reconnect=1,reconnected_stream=1'
        );
    } else {
        args.push('--cache=yes');
    }
    return args;
}

function spawnMpv(url) {
    const mpvPath = getMpvPath();
    if (mpvPath !== 'mpv' && !fs.existsSync(mpvPath)) {
        console.error('[Native] mpv.exe not found at', mpvPath);
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('native-error', 'mpv-missing');
        }
        return null;
    }
    console.log('[Native] Spawning mpv:', url);
    const useShell = (mpvPath === 'mpv');
    const child = spawn(mpvPath, buildMpvArgs(url), { windowsHide: false, shell: useShell });
    child.on('error', (err) => console.error('[Native] mpv spawn error:', err));
    if (child.stderr) child.stderr.on('data', d => console.error(`[mpv] ${d.toString().trim()}`));
    return child;
}

function spawnBundledVlc(url) {
    // Prefer the bundled portable VLC; fall back to a system install if present.
    let vlcPath = getBundledVlcPath();
    if (!fs.existsSync(vlcPath)) {
        const sys = getVlcPath();
        if (sys === 'vlc' || !fs.existsSync(sys)) {
            console.error('[Native] No bundled or system VLC found.');
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('native-error', 'vlc-missing');
            }
            return null;
        }
        vlcPath = sys;
    }

    // Pre-create a temp VLC config to skip the first-run privacy / update prompts,
    // which otherwise block playback (black screen) until dismissed.
    const tempVlcConfig = path.join(app.getPath('userData'), 'temp_vlcrc');
    try {
        fs.writeFileSync(tempVlcConfig, '[qt]\nqt-privacy-ask=0\nqt-updates-notif=0\n');
    } catch (e) {}

    return spawnVlc(vlcPath, [
        url,
        '--config', tempVlcConfig,
        '--no-video-title-show',
        '--no-qt-privacy-ask',
        '--no-qt-updates-notif',
        '--qt-minimal-view',
        '--no-osd'
    ]);
}

// Reparent the native player window into the app window so it behaves as a real child
// window, then keep it sized to the content area and on top of the web view.
function embedNativeWindow(pid) {
    if (!mainWindow || mainWindow.isDestroyed() || !psProcess) return;
    const parentHwnd = mainWindow.getNativeWindowHandle().readInt32LE(0);
    const cmd = `
$proc = Get-Process -Id ${pid} -ErrorAction SilentlyContinue
if ($proc) {
    $h = $proc.MainWindowHandle
    $tries = 0
    while ($h -eq [IntPtr]::Zero -and $tries -lt 80) {
        Start-Sleep -Milliseconds 50
        $proc.Refresh()
        $h = $proc.MainWindowHandle
        $tries++
    }
    if ($h -ne [IntPtr]::Zero) {
        [Win32]::SetParent($h, [IntPtr]${parentHwnd})
        # GWL_STYLE=-16 ; WS_CHILD=0x40000000 ; WS_VISIBLE=0x10000000
        [Win32]::SetWindowLong($h, -16, 0x40000000 -bor 0x10000000)
    }
}
`;
    psProcess.stdin.write(cmd + "\n");
    nativeEmbedded = true;
    positionNativeWindow();
}

// Size/position the embedded native window to fill the app's content area and keep it on top.
function positionNativeWindow() {
    if (!nativeProc || !nativeEmbedded || !mainWindow || mainWindow.isDestroyed() || !psProcess) return;
    const display = screen.getDisplayMatching(mainWindow.getBounds());
    const sf = display.scaleFactor || 1;
    const [cw, ch] = mainWindow.getContentSize();
    let topFrame = 0;
    if (!mainWindow.isMaximized() && !mainWindow.isFullScreen()) {
        const b = mainWindow.getBounds();
        const c = mainWindow.getContentBounds();
        topFrame = Math.max(0, c.y - b.y);
    }
    const x = Math.round(NATIVE_OFFSET_X * sf);
    const y = Math.round((NATIVE_OFFSET_Y - topFrame) * sf);
    const w = Math.round(cw * sf);
    const h = Math.round(ch * sf);
    const pid = nativeProc.pid;
    const cmd = `
$proc = Get-Process -Id ${pid} -ErrorAction SilentlyContinue
if ($proc) {
    $h = $proc.MainWindowHandle
    if ($h -ne [IntPtr]::Zero) {
        # HWND_TOP + SWP_NOACTIVATE (0x0010): keep the video above the web view.
        [Win32]::SetWindowPos($h, [IntPtr]::Zero, ${x}, ${y}, ${w}, ${h}, 0x0010)
    }
}
`;
    psProcess.stdin.write(cmd + "\n");
}

// Send a JSON command to mpv over its IPC named pipe (best-effort).
function sendMpvCommand(obj) {
    if (nativeEngine !== 'mpv' || !psProcess) return;
    const json = JSON.stringify(obj).replace(/"/g, '\\"');
    const cmd = `
try {
  $pipe = New-Object System.IO.Pipes.NamedPipeClientStream('.', 'shieldmpv', [System.IO.Pipes.PipeDirection]::Out)
  $pipe.Connect(300)
  $sw = New-Object System.IO.StreamWriter($pipe)
  $sw.WriteLine("${json}")
  $sw.Flush(); $sw.Dispose(); $pipe.Dispose()
} catch {}
`;
    psProcess.stdin.write(cmd + "\n");
}

function closeNativeFromShortcut() {
    // No isFocused() guard: when mpv (a child window) has keyboard focus the
    // BrowserWindow may report unfocused, which would swallow Escape. The shortcut
    // is only registered while a native player is active, so this is safe.
    if (nativeProc) {
        console.log('[Native] Escape/Back pressed — closing native player.');
        stopNativePlayer();
    }
}
function registerNativeShortcuts() {
    try { globalShortcut.register('Escape', closeNativeFromShortcut); } catch (e) {}
    try { globalShortcut.register('Backspace', closeNativeFromShortcut); } catch (e) {}
}
function unregisterNativeShortcuts() {
    try { globalShortcut.unregister('Escape'); } catch (e) {}
    try { globalShortcut.unregister('Backspace'); } catch (e) {}
}

function stopNativePlayer() {
    unregisterNativeShortcuts();
    if (nativeReassertTimer) { clearInterval(nativeReassertTimer); nativeReassertTimer = null; }
    nativeEmbedded = false;
    nativeRect = null;
    if (nativeProc) {
        try { nativeProc.kill(); } catch (e) {}
        nativeProc = null;
    }
    nativeEngine = null;
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

    mainWindow = win;

    // Forward renderer console logs and errors to main process terminal output
    win.webContents.on('console-message', (event, level, message, line, sourceId) => {
        console.log(`[Renderer Console] ${message} (Line ${line}: ${sourceId})`);
    });

    // Keep the embedded native video glued to its rectangle when the window
    // itself is resized or moved — handled with the OS-native events so there
    // is no fragile polling from the renderer.
    const repositionNative = () => {
        positionNativeWindow();
        setTimeout(positionNativeWindow, 120);
    };
    win.on('resize', repositionNative);
    win.on('move', repositionNative);
    win.on('maximize', repositionNative);
    win.on('unmaximize', repositionNative);
    win.on('restore', repositionNative);
    win.on('enter-full-screen', repositionNative);
    win.on('leave-full-screen', repositionNative);
    win.on('focus', repositionNative);

    win.on('closed', () => {
        stopNativePlayer();
        if (currentVlcProcess) {
            try { currentVlcProcess.kill(); } catch (e) {}
        }
        if (psProcess) {
            try { psProcess.kill(); } catch (e) {}
        }
        mainWindow = null;
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

ipcMain.handle('focus-window', async () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.show();
        mainWindow.focus();
    }
    return true;
});

ipcMain.handle('open-vlc-external', async (event, url) => {
    console.log("[Main] open-vlc-external request:", url);
    const vlcPath = getVlcPath();
    spawnVlc(vlcPath, [url]);
    return true;
});

// --- Embedded native player (mpv / VLC) ---
ipcMain.handle('play-native', async (event, engine, url, rect) => {
    console.log(`[Native] play-native (${engine}):`, url);
    stopNativePlayer();
    nativeEngine = engine;

    if (engine === 'mpv') {
        nativeProc = spawnMpv(url);
    } else if (engine === 'vlc') {
        nativeProc = spawnBundledVlc(url);
    } else {
        return false;
    }
    if (!nativeProc) return false;

    const pid = nativeProc.pid;
    nativeProc.on('close', () => {
        if (nativeProc && nativeProc.pid === pid) {
            nativeProc = null;
            nativeEngine = null;
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('native-exited');
            }
        }
    });

    registerNativeShortcuts();
    return true;
});

ipcMain.handle('update-native-rect', async (event, rect) => {
    nativeRect = rect;
    positionNativeWindow();
    return true;
});

ipcMain.handle('stop-native', async () => {
    stopNativePlayer();
    return true;
});

ipcMain.handle('native-command', async (event, cmd) => {
    sendMpvCommand(cmd);
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

    currentVlcProcess = spawnVlc(vlcPath, [
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
