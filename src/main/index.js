import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { autoUpdater } from 'electron-updater'

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true, 
    fullscreen: true,     
    webPreferences: {
      devTools: false,     
      nodeIntegration: false,
      contextIsolation: true,
      preload: join(__dirname, '../preload/index.js')
    }
  })

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.control && input.shift && input.key.toLowerCase() === 'i') {
      event.preventDefault();
    }
    if (input.control && input.key.toLowerCase() === 'r') {
      event.preventDefault();
    }
  });

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron')

  // === 1. INICIAR COM O WINDOWS AUTOMATICAMENTE ===
  app.setLoginItemSettings({
    openAtLogin: true,
    path: app.getPath('exe') 
  });

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.on('ping', () => console.log('pong'))

  // Evitar erros no console do React tentando salvar dados
  ipcMain.on('save-data', (event, key, data) => {});
  ipcMain.on('load-data', (event, key) => { event.returnValue = null; });

  createWindow()

  // === 2. SISTEMA DE ATUALIZAÇÃO (GITHUB) ===
  // Só verifica atualizações automáticas ao abrir se estiver em produção
  if (!is.dev) {
    autoUpdater.checkForUpdatesAndNotify();
  }

  // Quando o pacote for baixado do GitHub em segundo plano
  autoUpdater.on('update-downloaded', () => {
    const windows = BrowserWindow.getAllWindows();
    if (windows.length > 0) {
      windows[0].webContents.send('update_available'); // Avisa o React
    }
  });

  // Quando o usuário clicar em "Atualizar" no pop-up do React
  ipcMain.on('apply_update', () => {
    autoUpdater.quitAndInstall(); // Fecha e instala
  });

  // Quando o usuário clicar em "Procurar Atualizações" manualmente nas configurações
  ipcMain.on('check_for_updates', () => {
    if (!is.dev) {
      autoUpdater.checkForUpdatesAndNotify();
    }
  });

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})