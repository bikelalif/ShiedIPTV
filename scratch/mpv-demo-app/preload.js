const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    play: (url) => ipcRenderer.invoke('play', url),
    stop: () => ipcRenderer.invoke('stop'),
    onExited: (callback) => ipcRenderer.on('native-exited', () => callback())
});
