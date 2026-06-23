import { Capacitor, CapacitorHttp } from '@capacitor/core'
import { App } from '@capacitor/app'
import { Device } from '@capacitor/device'
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem'
import { Haptics, ImpactStyle } from '@capacitor/haptics'
import { Preferences } from '@capacitor/preferences'
import { Share } from '@capacitor/share'
import {
  getCloudSyncDocRef,
  getCurrentFirebaseUser,
  getDoc,
  serverTimestamp,
  setDoc,
  signInOrCreateFirebaseUser,
  signOutFirebaseUser
} from './firebase'

export const isNativeMobile = Capacitor.isNativePlatform()

const SYNC_SETTINGS_KEY = '__scrapsys_sync_settings'
const SYNC_META_KEY = '__scrapsys_sync_meta'
const CLOUD_SYNC_SETTINGS_KEY = '__scrapsys_cloud_sync_settings'
const CLOUD_SYNC_META_KEY = '__scrapsys_cloud_sync_meta'
const CLOUD_DEVICE_KEY = '__scrapsys_cloud_device'

async function readPreferenceJson(key, fallback) {
  const { value } = await Preferences.get({ key })
  if (!value) return fallback
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

function readBrowserJson(key, fallback) {
  const value = localStorage.getItem(key)
  if (!value) return fallback
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

async function readPrivateJson(key, fallback) {
  if (isNativeMobile) return readPreferenceJson(key, fallback)
  return readBrowserJson(key, fallback)
}

async function writePrivateJson(key, data) {
  const value = JSON.stringify(data)
  if (isNativeMobile) {
    await Preferences.set({ key, value })
    return
  }
  localStorage.setItem(key, value)
}

async function getCloudDeviceId() {
  const existing = await readPrivateJson(CLOUD_DEVICE_KEY, null)
  if (existing) return existing

  const value =
    globalThis.crypto?.randomUUID?.() ||
    `scrapsys-${Date.now()}-${Math.random().toString(36).slice(2)}`
  await writePrivateJson(CLOUD_DEVICE_KEY, value)
  return value
}

async function markCloudKeyChanged(key) {
  if (key.startsWith('__scrapsys_')) return
  const meta = await readPrivateJson(CLOUD_SYNC_META_KEY, {})
  meta[key] = Date.now()
  await writePrivateJson(CLOUD_SYNC_META_KEY, meta)
}

export async function noteLocalDataChanged(key) {
  await markCloudKeyChanged(key)
}

export async function loadLocalData(key) {
  if (isNativeMobile) {
    const { value } = await Preferences.get({ key })
    return value ? JSON.parse(value) : null
  }

  const value = localStorage.getItem(key)
  return value ? JSON.parse(value) : null
}

export async function saveLocalData(key, data) {
  if (isNativeMobile) {
    const serialized = JSON.stringify(data)
    const { value: previousValue } = await Preferences.get({ key })
    if (previousValue === serialized) return

    await Preferences.set({ key, value: serialized })
    if (!key.startsWith('__scrapsys_')) {
      const meta = await readPreferenceJson(SYNC_META_KEY, {})
      meta[key] = Date.now()
      await Preferences.set({ key: SYNC_META_KEY, value: JSON.stringify(meta) })
      await markCloudKeyChanged(key)
    }
    return
  }

  localStorage.setItem(key, JSON.stringify(data))
  await markCloudKeyChanged(key)
}

export async function getAutomaticSyncSettings() {
  if (!isNativeMobile) return null
  return readPreferenceJson(SYNC_SETTINGS_KEY, {
    enabled: false,
    serverUrl: '',
    pairingCode: ''
  })
}

export async function saveAutomaticSyncSettings(settings) {
  if (!isNativeMobile) return
  const normalized = {
    enabled: Boolean(settings.enabled),
    serverUrl: String(settings.serverUrl || '')
      .trim()
      .replace(/\/$/, ''),
    pairingCode: String(settings.pairingCode || '').trim()
  }
  await Preferences.set({ key: SYNC_SETTINGS_KEY, value: JSON.stringify(normalized) })
}

export async function getCloudSyncSettings() {
  return readPrivateJson(CLOUD_SYNC_SETTINGS_KEY, {
    enabled: false,
    email: ''
  })
}

export async function saveCloudSyncSettings(settings) {
  const normalized = {
    enabled: Boolean(settings.enabled),
    email: String(settings.email || '').trim().toLowerCase()
  }
  await writePrivateJson(CLOUD_SYNC_SETTINGS_KEY, normalized)
  return normalized
}

export async function getCloudSyncUser() {
  const user = await getCurrentFirebaseUser()
  return user
    ? {
        uid: user.uid,
        email: user.email
      }
    : null
}

export async function connectCloudSync(email, password) {
  const normalizedEmail = String(email || '').trim().toLowerCase()
  if (!normalizedEmail || !password) throw new Error('Informe e-mail e senha do Firebase.')

  const credential = await signInOrCreateFirebaseUser(normalizedEmail, password)
  await saveCloudSyncSettings({ enabled: true, email: normalizedEmail })
  return {
    uid: credential.user.uid,
    email: credential.user.email
  }
}

export async function disconnectCloudSync() {
  await saveCloudSyncSettings({ enabled: false, email: '' })
  await signOutFirebaseUser()
}

export async function runAutomaticSync(settingsOverride) {
  if (!isNativeMobile) return { ok: false, changed: false }

  const settings = settingsOverride || (await getAutomaticSyncSettings())
  if (!settings?.enabled || !settings.serverUrl || !settings.pairingCode) {
    return { ok: false, changed: false, message: 'Sincronizacao automatica nao configurada.' }
  }

  const { keys } = await Preferences.keys()
  const businessKeys = keys.filter((key) => !key.startsWith('__scrapsys_'))
  const entries = await Promise.all(
    businessKeys.map(async (key) => {
      const { value } = await Preferences.get({ key })
      return [key, value ? JSON.parse(value) : null]
    })
  )
  const localData = Object.fromEntries(entries)
  const localMeta = await readPreferenceJson(SYNC_META_KEY, {})
  const response = await CapacitorHttp.post({
    url: `${settings.serverUrl}/sync`,
    headers: {
      'Content-Type': 'application/json',
      'X-ScrapSys-Code': settings.pairingCode
    },
    data: { data: localData, meta: localMeta },
    connectTimeout: 6000,
    readTimeout: 6000
  })
  const result = response.data
  if (response.status < 200 || response.status >= 300 || !result?.ok) {
    throw new Error(result?.message || 'PC indisponivel.')
  }

  const remoteData = result.data || {}
  const changed = Object.entries(remoteData).some(
    ([key, value]) => JSON.stringify(localData[key]) !== JSON.stringify(value)
  )

  await Promise.all(
    Object.entries(remoteData).map(([key, value]) =>
      Preferences.set({ key, value: JSON.stringify(value) })
    )
  )
  await Preferences.set({ key: SYNC_META_KEY, value: JSON.stringify(result.meta || {}) })
  return { ok: true, changed }
}

async function readAllData() {
  if (window.electronAPI?.exportData) {
    return window.electronAPI.exportData()
  }

  if (isNativeMobile) {
    const { keys } = await Preferences.keys()
    const businessKeys = keys.filter((key) => !key.startsWith('__scrapsys_'))
    const entries = await Promise.all(
      businessKeys.map(async (key) => {
        const { value } = await Preferences.get({ key })
        return [key, value ? JSON.parse(value) : null]
      })
    )
    return Object.fromEntries(entries)
  }

  return Object.fromEntries(
    Object.keys(localStorage).map((key) => {
      const value = localStorage.getItem(key)
      return [key, value ? JSON.parse(value) : null]
    })
  )
}

async function writeAllData(data, meta) {
  const safeData = data && typeof data === 'object' && !Array.isArray(data) ? data : {}
  const entries = Object.entries(safeData).filter(([key]) => !key.startsWith('__scrapsys_'))

  if (window.electronAPI?.importData) {
    await window.electronAPI.importData(Object.fromEntries(entries))
  } else if (isNativeMobile) {
    await Promise.all(
      entries.map(([key, value]) => Preferences.set({ key, value: JSON.stringify(value) }))
    )
  } else {
    entries.forEach(([key, value]) => {
      localStorage.setItem(key, JSON.stringify(value))
    })
  }

  await writePrivateJson(CLOUD_SYNC_META_KEY, meta || {})
}

export async function runCloudSync() {
  const settings = await getCloudSyncSettings()
  if (!settings.enabled) return { ok: false, changed: false, message: 'Nuvem desativada.' }

  const user = await getCurrentFirebaseUser()
  if (!user) return { ok: false, changed: false, message: 'Conta Firebase desconectada.' }

  const deviceId = await getCloudDeviceId()
  const [localData, localMeta, snapshot] = await Promise.all([
    readAllData(),
    readPrivateJson(CLOUD_SYNC_META_KEY, {}),
    getDoc(getCloudSyncDocRef(user.uid))
  ])
  const remote = snapshot.exists() ? snapshot.data() : {}
  const remoteData = remote.data && typeof remote.data === 'object' ? remote.data : {}
  const remoteMeta = remote.meta && typeof remote.meta === 'object' ? remote.meta : {}
  const allKeys = new Set([...Object.keys(localData), ...Object.keys(remoteData)])
  const mergedData = {}
  const mergedMeta = {}
  let localChanged = false
  let cloudChanged = !snapshot.exists()

  allKeys.forEach((key) => {
    if (key.startsWith('__scrapsys_')) return

    const localTimestamp = Number(localMeta[key] || 0)
    const remoteTimestamp = Number(remoteMeta[key] || 0)

    if (remoteTimestamp > localTimestamp) {
      mergedData[key] = remoteData[key]
      mergedMeta[key] = remoteTimestamp
      localChanged =
        localChanged || JSON.stringify(localData[key]) !== JSON.stringify(remoteData[key])
      return
    }

    mergedData[key] = localData[key]
    mergedMeta[key] = Math.max(localTimestamp, remoteTimestamp, Date.now())
    cloudChanged =
      cloudChanged ||
      remoteTimestamp < mergedMeta[key] ||
      JSON.stringify(remoteData[key]) !== JSON.stringify(localData[key])
  })

  if (localChanged) {
    await writeAllData(mergedData, mergedMeta)
  } else {
    await writePrivateJson(CLOUD_SYNC_META_KEY, mergedMeta)
  }

  if (cloudChanged) {
    await setDoc(getCloudSyncDocRef(user.uid), {
      data: JSON.parse(JSON.stringify(mergedData)),
      meta: mergedMeta,
      updatedAt: serverTimestamp(),
      updatedBy: deviceId,
      schemaVersion: 1
    })
  }

  return { ok: true, changed: localChanged }
}

export async function exportBackup() {
  const payload = {
    format: 'scrapsys-backup',
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
    data: await readAllData()
  }
  const content = JSON.stringify(payload, null, 2)
  const date = payload.createdAt.slice(0, 10)
  const fileName = `ScrapSys-backup-${date}.json`

  if (isNativeMobile) {
    const result = await Filesystem.writeFile({
      path: fileName,
      data: content,
      directory: Directory.Cache,
      encoding: Encoding.UTF8
    })
    await Share.share({
      title: 'Backup ScrapSys',
      text: 'Backup completo do ScrapSys. Guarde este arquivo em local seguro.',
      files: [result.uri],
      dialogTitle: 'Salvar ou enviar backup'
    })
    return fileName
  }

  const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(url)
  return fileName
}

export function validateBackup(payload) {
  return Boolean(
    payload &&
    payload.format === 'scrapsys-backup' &&
    payload.schemaVersion === 1 &&
    payload.data &&
    typeof payload.data === 'object' &&
    !Array.isArray(payload.data)
  )
}

export async function importBackup(payload) {
  if (!validateBackup(payload)) throw new Error('Arquivo de backup invalido.')

  if (window.electronAPI?.importData) {
    const success = await window.electronAPI.importData(payload.data)
    if (!success) throw new Error('Falha ao gravar backup no computador.')
    return
  }

  if (isNativeMobile) {
    const syncSettings = await Preferences.get({ key: SYNC_SETTINGS_KEY })
    await Preferences.clear()
    await Promise.all(
      Object.entries(payload.data)
        .filter(([key]) => !key.startsWith('__scrapsys_'))
        .map(([key, value]) => Preferences.set({ key, value: JSON.stringify(value) }))
    )
    const timestamp = Date.now()
    const meta = Object.fromEntries(
      Object.keys(payload.data)
        .filter((key) => !key.startsWith('__scrapsys_'))
        .map((key) => [key, timestamp])
    )
    await Preferences.set({ key: SYNC_META_KEY, value: JSON.stringify(meta) })
    if (syncSettings.value) {
      await Preferences.set({ key: SYNC_SETTINGS_KEY, value: syncSettings.value })
    }
    return
  }

  localStorage.clear()
  Object.entries(payload.data).forEach(([key, value]) => {
    localStorage.setItem(key, JSON.stringify(value))
  })
}

export async function getNativeAppVersion(fallback) {
  if (!isNativeMobile) return fallback
  const [appInfo, deviceInfo] = await Promise.all([App.getInfo(), Device.getInfo()])
  return deviceInfo.osVersion
    ? `${appInfo.version} (Android ${deviceInfo.osVersion})`
    : appInfo.version
}

export function tapFeedback() {
  if (isNativeMobile) {
    Haptics.impact({ style: ImpactStyle.Light }).catch(() => {})
  }
}
