const { app, BrowserWindow, globalShortcut } = require('electron');
const path = require('path');

function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 900,
        minHeight: 600,
        title: "LibPass Admin",
        
        // --- MODERN UI INFUSION ---
        titleBarStyle: 'hidden',
        titleBarOverlay: {
            color: '#0f172a',       // Dark background matching modern dashboard themes
            symbolColor: '#f8fafc', // Crisp white minimize/maximize/close icons
            height: 35
        },
        backgroundMaterial: 'mica', // Adds Windows 11 Fluent dark backdrop blur
        
        show: false, // Prevents white flash on launch; shown via ready-to-show
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    // Remove default OS menu bar
    mainWindow.setMenu(null);
    
    // Admin app initiates from authentication gateway
    mainWindow.loadFile(path.join(__dirname, 'login.html'));

    // Reveal window smoothly when contents are loaded
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    // Handle standard developer and kiosk navigation shortcuts cleanly
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

    // Unregister shortcuts when app loses focus to avoid overriding global OS hotkeys
    mainWindow.on('blur', () => {
        globalShortcut.unregisterAll();
    });

    // --- ADMIN EXPORT OPTIMIZATION ---
    // Automatically routes frontend CSV download blobs to the user's local Downloads directory
    mainWindow.webContents.session.on('will-download', (event, item, webContents) => {
        const totalBytes = item.getTotalBytes();
        
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