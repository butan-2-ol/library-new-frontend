const { app, BrowserWindow, protocol, globalShortcut, net } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url'); // Native utility to prevent Windows path corruption

// 1. Register the custom scheme with strict security privileges
protocol.registerSchemesAsPrivileged([
    { 
        scheme: 'app-resources', 
        privileges: { 
            secure: true, 
            standard: true, 
            supportFetchAPI: true,
            corsEnabled: true,
            bypassCSP: true 
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

    // Handle kiosk hotkeys safely when window is focused
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
    // 2. Bulletproof Local File Protocol Handler using pathToFileURL
    protocol.handle('app-resources', (request) => {
        try {
            // Strip out custom scheme prefix and any trailing cache query strings (?v=1.0)
            const cleanUrlPath = request.url.replace('app-resources://', '').split('?')[0];
            const decodedPath = decodeURIComponent(cleanUrlPath);
            
            // Map the resource directory depending on whether running in dev or packaged production
            const basePath = app.isPackaged ? process.resourcesPath : __dirname;
            const finalFilePath = path.resolve(path.join(basePath, decodedPath));

            // Convert raw file path (e.g., C:\...) directly to a flawless file:/// URL string
            const safeFileUrl = pathToFileURL(finalFilePath).href;
            
            return net.fetch(safeFileUrl);
        } catch (error) {
            console.error('Custom Protocol Resolution Error:', error);
            return new Response('File not found', { status: 404 });
        }
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