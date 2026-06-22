import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import fs from 'fs'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { autoUpdater } from 'electron-updater'

app.setName('ScrapSys')

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

    fs.mkdirSync(app.getPath('userData'), { recursive: true })
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf8')

    return true
  } catch (error) {
    console.error('Erro ao salvar no banco de dados:', error)
    return false
  }
}

function replaceDatabase(data) {
  try {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return false

    fs.mkdirSync(app.getPath('userData'), { recursive: true })
    const temporaryPath = `${dbPath}.tmp`
    fs.writeFileSync(temporaryPath, JSON.stringify(data, null, 2), 'utf8')
    fs.renameSync(temporaryPath, dbPath)
    return true
  } catch (error) {
    console.error('Erro ao importar banco de dados:', error)
    return false
  }
}

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
      event.preventDefault()
    }

    if (input.control && input.key.toLowerCase() === 'r') {
      event.preventDefault()
    }
  })

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
  electronApp.setAppUserModelId('com.scrapsys.app')

  app.setLoginItemSettings({
    openAtLogin: true,
    path: app.getPath('exe')
  })

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.on('ping', () => console.log('pong'))

  ipcMain.handle('save-data', async (_, key, data) => {
    return saveToDatabase(key, data)
  })

  ipcMain.handle('load-data', async (_, key) => {
    const db = loadDatabase()
    return db[key] ?? null
  })

  ipcMain.handle('export-data', async () => loadDatabase())

  ipcMain.handle('import-data', async (_, data) => replaceDatabase(data))

  ipcMain.handle('get-version', async () => {
    return app.getVersion()
  })

  ipcMain.on('apply_update', () => {
    autoUpdater.quitAndInstall()
  })

  ipcMain.handle('check_for_updates', async () => {
    if (is.dev) {
      return {
        ok: false,
        message: 'Atualizações automáticas não rodam em modo desenvolvimento.'
      }
    }

    try {
      const result = await autoUpdater.checkForUpdatesAndNotify()
      return {
        ok: true,
        result
      }
    } catch (error) {
      console.error('Erro ao procurar atualizações:', error)

      return {
        ok: false,
        message: error?.message || String(error)
      }
    }
  })

  autoUpdater.autoDownload = true

  autoUpdater.on('checking-for-update', () => {
    console.log('Verificando atualizações...')
  })

  autoUpdater.on('update-available', (info) => {
    console.log('Atualização disponível:', info)
  })

  autoUpdater.on('update-not-available', (info) => {
    console.log('Nenhuma atualização encontrada:', info)
  })

  autoUpdater.on('error', (error) => {
    console.error('Erro no autoUpdater:', error)
  })

  autoUpdater.on('download-progress', (progress) => {
    console.log(`Download atualização: ${Math.round(progress.percent)}%`)
  })

  autoUpdater.on('update-downloaded', () => {
    console.log('Atualização baixada.')

    const windows = BrowserWindow.getAllWindows()

    if (windows.length > 0) {
      windows[0].webContents.send('update_available')
    }
  })

  createWindow()

  if (!is.dev) {
    autoUpdater.checkForUpdatesAndNotify().catch((error) => {
      console.error('Erro ao verificar atualizações automaticamente:', error)
    })
  }

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
