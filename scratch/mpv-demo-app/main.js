const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

let nativeProc = null;
let mainWindow = null;

const MPV_PATH = path.join(__dirname, '../../pc/resources/mpv/mpv.exe');

function spawnMpv(url) {
    if (!fs.existsSync(MPV_PATH)) {
        console.error('[Main] mpv.exe not found at', MPV_PATH);
        return null;
    }
    console.log('[Main] Spawning mpv:', url);
    const args = [
        url,
        '--no-config',
        '--force-window=yes',
        '--idle=no',
        '--osc=yes',
        '--input-default-bindings=yes',
        '--input-vo-keyboard=yes',
        '--hwdec=auto-safe',
        '--keep-open=no',
        '--title=Shield IPTV - Lecteur Externe'
    ];
    return spawn(MPV_PATH, args, { windowsHide: false });
}

function stopNativePlayer() {
    if (nativeProc) {
        try { nativeProc.kill(); } catch (e) {}
        nativeProc = null;
    }
}

ipcMain.handle('play', async (event, url) => {
    console.log("[Main] Play native request:", url);
    stopNativePlayer();
    
    nativeProc = spawnMpv(url);
    if (!nativeProc) return false;
    
    const pid = nativeProc.pid;
    nativeProc.on('close', () => {
        if (nativeProc && nativeProc.pid === pid) {
            nativeProc = null;
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('native-exited');
            }
        }
    });
    
    return true;
});

ipcMain.handle('stop', async () => {
    console.log("[Main] Stop native request");
    stopNativePlayer();
    return true;
});

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1024,
        height: 768,
        minWidth: 800,
        minHeight: 600,
        autoHideMenuBar: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });
    
    mainWindow.loadFile(path.join(__dirname, 'index.html'));
    
    mainWindow.on('closed', () => {
        stopNativePlayer();
        mainWindow = null;
    });
}

app.whenReady().then(() => {
    createWindow();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
