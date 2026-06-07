const { app, BrowserWindow } = require('electron');
const path = require('path');

// Disable SSL certificate verification to allow connecting to private IPTV portals with self-signed/expired/invalid certificates
app.commandLine.appendSwitch('ignore-certificate-errors');

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
            webSecurity: false // Disables CORS checks so local app can query IPTV HTTP streams directly
        }
    });

    // Load local web files from the copy in pc/src/
    win.loadFile(path.join(__dirname, 'src/index.html'));
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
