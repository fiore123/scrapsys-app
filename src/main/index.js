import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import fs from 'fs'
import http from 'http'
import os from 'os'
import crypto from 'crypto'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { autoUpdater } from 'electron-updater'

app.setName('ScrapSys')

const dbPath = join(app.getPath('userData'), 'scrapsys_database.json')
const syncMetaPath = join(app.getPath('userData'), 'scrapsys_sync_meta.json')
const syncConfigPath = join(app.getPath('userData'), 'scrapsys_sync_config.json')
const syncPort = 38947

function loadJsonFile(filePath, fallback = {}) {
  try {
    if (fs.existsSync(filePath)) return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch (error) {
    console.error(`Erro ao ler ${filePath}:`, error)
  }
  return fallback
}

function saveJsonFile(filePath, data) {
  fs.mkdirSync(app.getPath('userData'), { recursive: true })
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8')
}

function loadSyncMeta() {
  return loadJsonFile(syncMetaPath)
}

function touchSyncKey(key) {
  const meta = loadSyncMeta()
  meta[key] = Date.now()
  saveJsonFile(syncMetaPath, meta)
}

function getSyncConfig() {
  const saved = loadJsonFile(syncConfigPath, null)
  if (saved?.pairingCode) return saved

  const config = { pairingCode: crypto.randomInt(100000, 999999).toString() }
  saveJsonFile(syncConfigPath, config)
  return config
}

function getLocalAddresses() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((item) => item && item.family === 'IPv4' && !item.internal)
    .map((item) => `http://${item.address}:${syncPort}`)
}

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
    touchSyncKey(key)

    return true
  } catch (error) {
    console.error('Erro ao salvar no banco de dados:', error)
    return false
  }
}

function startSyncServer() {
  const server = http.createServer((request, response) => {
    response.setHeader('Access-Control-Allow-Origin', '*')
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-ScrapSys-Code')
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    response.setHeader('Access-Control-Allow-Private-Network', 'true')
    response.setHeader('Content-Type', 'application/json; charset=utf-8')

    if (request.method === 'OPTIONS') {
      response.writeHead(204)
      response.end()
      return
    }

    if (request.headers['x-scrapsys-code'] !== getSyncConfig().pairingCode) {
      response.writeHead(401)
      response.end(JSON.stringify({ ok: false, message: 'Codigo de pareamento invalido.' }))
      return
    }

    if (request.method === 'GET' && request.url === '/health') {
      response.end(JSON.stringify({ ok: true, device: os.hostname() }))
      return
    }

    if (request.method !== 'POST' || request.url !== '/sync') {
      response.writeHead(404)
      response.end(JSON.stringify({ ok: false }))
      return
    }

    let body = ''
    request.on('data', (chunk) => {
      body += chunk
      if (body.length > 5 * 1024 * 1024) request.destroy()
    })
    request.on('end', () => {
      try {
        const incoming = JSON.parse(body || '{}')
        const incomingData = incoming.data && typeof incoming.data === 'object' ? incoming.data : {}
        const incomingMeta = incoming.meta && typeof incoming.meta === 'object' ? incoming.meta : {}
        const database = loadDatabase()
        const meta = loadSyncMeta()
        let changedByRemote = false

        Object.entries(incomingData).forEach(([key, value]) => {
          if (key.startsWith('__scrapsys_')) return
          const incomingTimestamp = Number(incomingMeta[key] || 0)
          const serverTimestamp = Number(meta[key] || 0)
          if (incomingTimestamp > serverTimestamp) {
            database[key] = value
            meta[key] = incomingTimestamp
            changedByRemote = true
          }
        })

        if (changedByRemote) {
          replaceDatabase(database, false)
          saveJsonFile(syncMetaPath, meta)
          BrowserWindow.getAllWindows().forEach((window) => {
            window.webContents.send('sync_data_changed')
          })
        }

        response.end(JSON.stringify({ ok: true, data: database, meta }))
      } catch (error) {
        console.error('Erro na sincronizacao local:', error)
        response.writeHead(400)
        response.end(JSON.stringify({ ok: false, message: 'Dados de sincronizacao invalidos.' }))
      }
    })
  })

  server.on('error', (error) => console.error('Servidor de sincronizacao:', error))
  server.listen(syncPort, '0.0.0.0')
}

function replaceDatabase(data, updateSyncMeta = true) {
  try {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return false

    fs.mkdirSync(app.getPath('userData'), { recursive: true })
    const temporaryPath = `${dbPath}.tmp`
    fs.writeFileSync(temporaryPath, JSON.stringify(data, null, 2), 'utf8')
    fs.renameSync(temporaryPath, dbPath)
    if (updateSyncMeta) {
      const timestamp = Date.now()
      saveJsonFile(
        syncMetaPath,
        Object.fromEntries(Object.keys(data).map((key) => [key, timestamp]))
      )
    }
    return true
  } catch (error) {
    console.error('Erro ao importar banco de dados:', error)
    return false
  }
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    icon,
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

  ipcMain.handle('get-sync-server-info', async () => ({
    pairingCode: getSyncConfig().pairingCode,
    addresses: getLocalAddresses(),
    port: syncPort
  }))

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
  startSyncServer()

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
