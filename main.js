const { app, BrowserWindow, globalShortcut } = require('electron');
const path = require('path');

function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    // Remove the default window menu bar for a clean dashboard presentation
    mainWindow.setMenu(null);
    
    // Admin app initiates from the authentication gateway
    mainWindow.loadFile(path.join(__dirname, 'login.html'));

    // Handle standard developer and kiosk navigation shortcuts cleanly
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

    // Unregister shortcuts when app loses focus to avoid overriding global OS hotkeys
    mainWindow.on('blur', () => {
        globalShortcut.unregisterAll();
    });

    // --- ADMIN EXPORT OPTIMIZATION ---
    // Automatically routes frontend CSV download blobs to the user's local Downloads directory
    mainWindow.webContents.session.on('will-download', (event, item, webContents) => {
        const totalBytes = item.getTotalBytes();
        
        // Let Electron determine the filename dynamically from the frontend blob configuration
        const fileName = item.getFilename();
        const savePath = path.join(app.getPath('downloads'), fileName);
        
        item.setSavePath(savePath);

        item.on('updated', (event, state) => {
            if (state === 'interrupted') {
                console.log('CSV Export download was interrupted.');
            }
        });

        item.on('done', (event, state) => {
            if (state === 'completed') {
                console.log(`CSV Dashboard report successfully saved to: ${savePath}`);
            } else {
                console.error(`CSV Export failed: ${state}`);
            }
        });
    });
}

app.whenReady().then(() => {
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