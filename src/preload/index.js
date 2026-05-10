import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  loadData: (key) => ipcRenderer.sendSync('load-data', key),
  saveData: (key, data) => ipcRenderer.send('save-data', key, data),
  getVersion: () => ipcRenderer.sendSync('get-version'),
  
  onUpdateAvailable: (callback) => ipcRenderer.on('update_available', () => callback()),
  applyUpdate: () => ipcRenderer.send('apply_update'),
  checkForUpdates: () => ipcRenderer.send('check_for_updates')
})