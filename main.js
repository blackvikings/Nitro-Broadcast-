const { app, BrowserWindow, desktopCapturer, ipcMain } = require('electron');
const path = require('path');

function createWindow() {
    const win = new BrowserWindow({
        width: 1280,
        height: 720,
        backgroundColor: '#121212',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            backgroundThrottling: false // Important for keeping 60fps when minimized/background
        }
    });

    win.loadFile('index.html');
    // win.webContents.openDevTools(); // Optional for debugging
}

// Handle request from UI to get screen sources
ipcMain.handle('get-sources', async () => {
    const sources = await desktopCapturer.getSources({ types: ['window', 'screen'] });
    return sources.map(source => ({
        id: source.id,
        name: source.name,
        thumbnail: source.thumbnail.toDataURL()
    }));
});

// Placeholder for FFmpeg streaming integration
// In a real app, you would receive the MediaRecorder blob chunks here via IPC
// and pipe them to an FFmpeg child process.

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});