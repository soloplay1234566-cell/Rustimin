const {contextBridge, ipcRenderer} = require('electron');
contextBridge.exposeInMainWorld('desktop', {fullscreen: () => ipcRenderer.invoke('window:fullscreen')});
