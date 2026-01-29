const { app, BrowserWindow, desktopCapturer, ipcMain } = require('electron');
const path = require('path');

let mainWindow;
let loginWindow;
let pendingDeepLink = null; // Store deep link if app wasn't ready

// Register custom protocol 'nitro://'
if (process.defaultApp) {
    if (process.argv.length >= 2) {
        app.setAsDefaultProtocolClient('nitro', process.execPath, [path.resolve(process.argv[1])]);
    }
} else {
    app.setAsDefaultProtocolClient('nitro');
}

// Force Single Instance Application
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', (event, commandLine, workingDirectory) => {
        // Someone tried to run a second instance, we should focus our window.
        const windowToFocus = mainWindow || loginWindow;
        if (windowToFocus) {
            if (windowToFocus.isMinimized()) windowToFocus.restore();
            windowToFocus.focus();
            
            // Handle the protocol url (Windows)
            const url = commandLine.pop();
            if (url && url.startsWith('nitro://')) {
                handleDeepLink(url);
            }
        }
    });

    app.whenReady().then(createLoginWindow);
}

function createLoginWindow() {
    loginWindow = new BrowserWindow({
        width: 400,
        height: 600,
        backgroundColor: '#121212',
        resizable: false,
        frame: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    loginWindow.loadFile('login.html');
    
    loginWindow.on('closed', () => {
        loginWindow = null;
    });
}

function createMainWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 720,
        backgroundColor: '#121212',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            backgroundThrottling: false 
        }
    });

    mainWindow.loadFile('index.html');
    
    // If we have a pending deep link (e.g. from login), send it to the main window
    mainWindow.webContents.once('did-finish-load', () => {
        if (pendingDeepLink) {
            mainWindow.webContents.send('deep-link', pendingDeepLink);
            pendingDeepLink = null;
        }
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

function handleDeepLink(url) {
    // If we are on the login screen, close it and open main window
    if (loginWindow) {
        pendingDeepLink = url; // Store it to pass to main window
        loginWindow.close();
        createMainWindow();
    } else if (mainWindow) {
        // If main window is already open, just send the link
        mainWindow.webContents.send('deep-link', url);
    }
}

// IPC Handlers for Login Flow
ipcMain.on('login-skip', () => {
    if (loginWindow) {
        loginWindow.close();
        createMainWindow();
    }
});

ipcMain.on('login-success', (event, url) => {
    handleDeepLink(url);
});

// Handle request from UI to get screen sources
ipcMain.handle('get-sources', async () => {
    const sources = await desktopCapturer.getSources({ types: ['window', 'screen'] });
    return sources.map(source => ({
        id: source.id,
        name: source.name,
        thumbnail: source.thumbnail.toDataURL()
    }));
});

// Handle macOS deep linking
app.on('open-url', (event, url) => {
    event.preventDefault();
    handleDeepLink(url);
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});