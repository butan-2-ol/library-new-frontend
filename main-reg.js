const { app, BrowserWindow, protocol, globalShortcut } = require('electron');
const path = require('path');

protocol.registerSchemesAsPrivileged([
    { 
        scheme: 'app-resources', 
        privileges: { 
            secure: true, 
            standard: true, 
            supportFetchAPI: true 
        } 
    }
]);

function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: false, 
            contextIsolation: true
        }
    });

    mainWindow.setMenu(null);
    mainWindow.loadFile(path.join(__dirname, 'scan.html'));

    mainWindow.on('focus', () => {
        // DevTools
        globalShortcut.register('Ctrl+Shift+I', () => {
            mainWindow.webContents.toggleDevTools();
        });
        globalShortcut.register('F12', () => {
            mainWindow.webContents.toggleDevTools();
        });

        // Refresh
        globalShortcut.register('F5', () => {
            mainWindow.webContents.reload();
        });
        globalShortcut.register('Ctrl+R', () => {
            mainWindow.webContents.reload();
        });

        // Fullscreen
        globalShortcut.register('F11', () => {
            mainWindow.setFullScreen(!mainWindow.isFullScreen());
        });
    });

    mainWindow.on('blur', () => {
        globalShortcut.unregisterAll();
    });
}

app.whenReady().then(() => {
    protocol.registerFileProtocol('app-resources', (request, callback) => {
        const url = request.url.replace('app-resources://', '');
        const basePath = app.isPackaged ? process.resourcesPath : __dirname;
        const decodedPath = decodeURIComponent(url);
        callback({ path: path.join(basePath, decodedPath) });
    });

    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('will-quit', () => {
    globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});