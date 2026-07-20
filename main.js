const { app, BrowserWindow, globalShortcut } = require('electron');
const path = require('path');

function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        frame: true, // Standard window title bar with minimize/maximize/close buttons
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    mainWindow.loadFile('login.html');

    // Handle developer and shortcut keys cleanly on window focus
    mainWindow.on('focus', () => {
        globalShortcut.register('Ctrl+Shift+I', () => {
            mainWindow.webContents.toggleDevTools();
        });
        globalShortcut.register('F12', () => {
            mainWindow.webContents.toggleDevTools();
        });
        globalShortcut.register('F5', () => {
            mainWindow.webContents.reload();
        });
        globalShortcut.register('Ctrl+R', () => {
            mainWindow.webContents.reload();
        });
        globalShortcut.register('F11', () => {
            mainWindow.setFullScreen(!mainWindow.isFullScreen());
        });
    });

    // Unregister shortcuts when app loses focus
    mainWindow.on('blur', () => {
        globalShortcut.unregisterAll();
    });

    // --- ADMIN EXPORT OPTIMIZATION ---
    // Automatically routes frontend CSV download blobs to the user's local Downloads directory
    mainWindow.webContents.session.on('will-download', (event, item) => {
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

// App Lifecycle Events
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