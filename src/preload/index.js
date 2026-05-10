import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {}

contextBridge.exposeInMainWorld('electronAPI', {
  loadData: (key) => ipcRenderer.sendSync('load-data', key),
  saveData: (key, data) => ipcRenderer.send('save-data', key, data),
  getVersion: () => ipcRenderer.sendSync('get-version'),
  
  // NOSSAS FUNÇÕES DE ATUALIZAÇÃO:
  onUpdateAvailable: (callback) => ipcRenderer.on('update_available', () => callback()),
  applyUpdate: () => ipcRenderer.send('apply_update'),
  checkForUpdates: () => ipcRenderer.send('check_for_updates') // <-- NOVA PONTE AQUI
})

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  window.electron = electronAPI
  window.api = api
}