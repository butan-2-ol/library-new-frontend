const { app, BrowserWindow } = require('electron');
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

    // Hide the top File/Edit/View menu bar
    mainWindow.setMenu(null);

    mainWindow.loadFile('login.html');

    // Enable Refresh (F5 / Ctrl+R) and DevTools (F12 / Ctrl+Shift+I)
    mainWindow.webContents.on('before-input-event', (event, input) => {
        const isControl = input.control || input.meta;

        // F12 or Ctrl+Shift+I -> Toggle DevTools
        if (input.key === 'F12' || (isControl && input.shift && input.key.toLowerCase() === 'i')) {
            mainWindow.webContents.toggleDevTools();
            event.preventDefault();
        }

        // F5 or Ctrl+R -> Refresh
        if (input.key === 'F5' || (isControl && input.key.toLowerCase() === 'r')) {
            mainWindow.webContents.reload();
            event.preventDefault();
        }
    });

    // --- ADMIN EXPORT OPTIMIZATION ---
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

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});