import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  loadData: (key) => ipcRenderer.invoke('load-data', key),

  saveData: (key, data) => ipcRenderer.invoke('save-data', key, data),

  exportData: () => ipcRenderer.invoke('export-data'),

  importData: (data) => ipcRenderer.invoke('import-data', data),

  getVersion: () => ipcRenderer.invoke('get-version'),

  onUpdateAvailable: (callback) => {
    const listener = () => callback()
    ipcRenderer.on('update_available', listener)

    return () => {
      ipcRenderer.removeListener('update_available', listener)
    }
  },

  applyUpdate: () => ipcRenderer.send('apply_update'),

  checkForUpdates: () => ipcRenderer.invoke('check_for_updates')
})
