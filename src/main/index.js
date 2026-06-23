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
const syncCodeBytes = 9
const maxSyncBodyBytes = 2 * 1024 * 1024
const maxSyncKeys = 250
const syncRateWindowMs = 60 * 1000
const syncRateLimit = 30
const syncAttempts = new Map()

function isPrivateAddress(address = '') {
  const normalized = address.replace(/^::ffff:/, '')
  return (
    normalized === '127.0.0.1' ||
    normalized === '::1' ||
    normalized.startsWith('10.') ||
    normalized.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(normalized)
  )
}

function generatePairingCode() {
  return crypto.randomBytes(syncCodeBytes).toString('base64url').toUpperCase()
}

function safeCompare(a = '', b = '') {
  const left = Buffer.from(String(a))
  const right = Buffer.from(String(b))
  return left.length === right.length && crypto.timingSafeEqual(left, right)
}

function checkSyncRate(address) {
  const now = Date.now()
  const entry = syncAttempts.get(address) || { count: 0, resetAt: now + syncRateWindowMs }
  if (entry.resetAt <= now) {
    entry.count = 0
    entry.resetAt = now + syncRateWindowMs
  }
  entry.count += 1
  syncAttempts.set(address, entry)
  return entry.count <= syncRateLimit
}

function isSafeBusinessKey(key) {
  return (
    typeof key === 'string' &&
    key.length > 0 &&
    key.length <= 96 &&
    !key.startsWith('__scrapsys_') &&
    /^[a-zA-Z0-9_-]+$/.test(key)
  )
}

function sanitizeDatabase(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return {}
  return Object.fromEntries(
    Object.entries(data)
      .filter(([key]) => isSafeBusinessKey(key))
      .slice(0, maxSyncKeys)
  )
}

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
  if (saved?.pairingCode && String(saved.pairingCode).length >= 12) return saved

  const config = { pairingCode: generatePairingCode(), createdAt: new Date().toISOString() }
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
    if (!isSafeBusinessKey(key)) return false
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
    const remoteAddress = request.socket.remoteAddress || ''
    const origin = request.headers.origin || ''
    const allowedOrigin =
      origin === 'capacitor://localhost' ||
      origin === 'http://localhost' ||
      /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)

    response.setHeader('Access-Control-Allow-Origin', allowedOrigin ? origin : 'null')
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-ScrapSys-Code')
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    response.setHeader('Access-Control-Allow-Private-Network', 'true')
    response.setHeader('Content-Type', 'application/json; charset=utf-8')

    if (!isPrivateAddress(remoteAddress) || !checkSyncRate(remoteAddress)) {
      response.writeHead(429)
      response.end(JSON.stringify({ ok: false, message: 'Muitas tentativas de sincronizacao.' }))
      return
    }

    if (request.method === 'OPTIONS') {
      response.writeHead(204)
      response.end()
      return
    }

    const requestCode = String(request.headers['x-scrapsys-code'] || '')
    if (!safeCompare(requestCode, getSyncConfig().pairingCode)) {
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

    if (!String(request.headers['content-type'] || '').includes('application/json')) {
      response.writeHead(415)
      response.end(JSON.stringify({ ok: false, message: 'Formato invalido.' }))
      return
    }

    let body = ''
    request.on('data', (chunk) => {
      body += chunk
      if (body.length > maxSyncBodyBytes) request.destroy()
    })
    request.on('end', () => {
      try {
        const incoming = JSON.parse(body || '{}')
        const incomingData = sanitizeDatabase(incoming.data)
        const incomingMeta = incoming.meta && typeof incoming.meta === 'object' ? incoming.meta : {}
        const database = sanitizeDatabase(loadDatabase())
        const meta = loadSyncMeta()
        let changedByRemote = false

        Object.entries(incomingData).forEach(([key, value]) => {
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
    const safeData = sanitizeDatabase(data)

    fs.mkdirSync(app.getPath('userData'), { recursive: true })
    const temporaryPath = `${dbPath}.tmp`
    fs.writeFileSync(temporaryPath, JSON.stringify(safeData, null, 2), 'utf8')
    fs.renameSync(temporaryPath, dbPath)
    if (updateSyncMeta) {
      const timestamp = Date.now()
      saveJsonFile(
        syncMetaPath,
        Object.fromEntries(Object.keys(safeData).map((key) => [key, timestamp]))
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
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
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
    try {
      const url = new URL(details.url)
      if (['https:', 'mailto:'].includes(url.protocol)) {
        shell.openExternal(details.url)
      }
    } catch {
      // Bloqueia URLs malformadas ou protocolos inesperados.
    }
    return { action: 'deny' }
  })

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!is.dev || url !== process.env['ELECTRON_RENDERER_URL']) {
      event.preventDefault()
    }
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
    window.webContents.session.setPermissionRequestHandler((_webContents, _permission, callback) => {
      callback(false)
    })
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
