import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import fs from 'fs' // <-- NOVO: Módulo nativo do Windows para gravar ficheiros
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { autoUpdater } from 'electron-updater'

// Força o nome do processo do Windows a ser ScrapSys
app.setName('ScrapSys')

// === SISTEMA DE BANCO DE DADOS OFFLINE SEGURO ===
// Cria um ficheiro invisível na pasta do Windows (AppData) que não é apagado nas atualizações
const dbPath = join(app.getPath('userData'), 'scrapsys_database.json')

function loadDatabase() {
  try {
    if (fs.existsSync(dbPath)) {
      const rawData = fs.readFileSync(dbPath, 'utf8')
      return JSON.parse(rawData)
    }
  } catch (error) {
    console.error('Erro ao ler banco de dados:', error)
  }
  return {}
}

function saveToDatabase(key, data) {
  try {
    const db = loadDatabase()
    db[key] = data
    // Grava no disco rígido do PC imediatamente
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2))
  } catch (error) {
    console.error('Erro ao salvar no banco de dados:', error)
  }
}
// ================================================

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    title: 'ScrapSys',
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

  // === COMUNICAÇÃO DE DADOS (AGORA GRAVANDO DE VERDADE) ===
  ipcMain.on('save-data', (event, key, data) => {
    saveToDatabase(key, data)
  });

  ipcMain.on('load-data', (event, key) => {
    const db = loadDatabase()
    event.returnValue = db[key] || null
  });

  ipcMain.on('get-version', (event) => { 
    event.returnValue = app.getVersion(); 
  });

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