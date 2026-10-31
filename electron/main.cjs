const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');
let win;
function createWindow() {
  win = new BrowserWindow({width: 1440, height: 940, minWidth: 960, minHeight: 720, backgroundColor: '#0b0d1c', autoHideMenuBar: true, title: 'Rustimin', webPreferences: {preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true}});
  win.loadFile(path.join(__dirname, '../dist/index.html'));
  win.webContents.setWindowOpenHandler(() => ({action: 'deny'}));
  win.webContents.on('will-navigate', event => event.preventDefault());
  win.webContents.session.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
}
ipcMain.handle('window:fullscreen', event => {const window = BrowserWindow.fromWebContents(event.sender); if(window) window.setFullScreen(!window.isFullScreen());});
app.whenReady().then(createWindow);
app.on('window-all-closed', () => {if(process.platform !== 'darwin') app.quit();});
app.on('activate', () => {if(BrowserWindow.getAllWindows().length === 0) createWindow();});
