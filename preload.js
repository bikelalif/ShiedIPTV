const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    openVlcExternal: (url) => ipcRenderer.invoke('open-vlc-external', url),
    dockVlc: (url, rect) => ipcRenderer.invoke('dock-vlc', url, rect),
    resizeVlc: (rect) => ipcRenderer.invoke('resize-vlc', rect),
    undockVlc: () => ipcRenderer.invoke('undock-vlc'),
    onVlcExited: (callback) => ipcRenderer.on('vlc-exited', () => callback()),
    isElectron: true
});
