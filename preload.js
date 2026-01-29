const { contextBridge, ipcRenderer, shell } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    getSources: () => ipcRenderer.invoke('get-sources'),
    openExternal: (url) => shell.openExternal(url),
    onDeepLink: (callback) => ipcRenderer.on('deep-link', (event, url) => callback(url)),
    
    // Login Flow
    skipLogin: () => ipcRenderer.send('login-skip'),
    loginSuccess: (url) => ipcRenderer.send('login-success', url)
});