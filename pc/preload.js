const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    openVlcExternal: (url) => ipcRenderer.invoke('open-vlc-external', url),
    dockVlc: (url, rect) => ipcRenderer.invoke('dock-vlc', url, rect),
    resizeVlc: (rect) => ipcRenderer.invoke('resize-vlc', rect),
    undockVlc: () => ipcRenderer.invoke('undock-vlc'),
    onVlcExited: (callback) => ipcRenderer.on('vlc-exited', () => callback()),

    // Embedded native player (mpv / VLC)
    playNative: (engine, url, rect) => ipcRenderer.invoke('play-native', engine, url, rect),
    updateNativeRect: (rect) => ipcRenderer.invoke('update-native-rect', rect),
    stopNative: () => ipcRenderer.invoke('stop-native'),
    nativeCommand: (cmd) => ipcRenderer.invoke('native-command', cmd),
    onNativeExited: (callback) => ipcRenderer.on('native-exited', () => callback()),
    onNativeError: (callback) => ipcRenderer.on('native-error', (e, code) => callback(code)),

    // Window Focus Control
    focusWindow: () => ipcRenderer.invoke('focus-window'),

    isElectron: true
});
