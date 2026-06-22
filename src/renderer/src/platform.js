import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'
import { Device } from '@capacitor/device'
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem'
import { Haptics, ImpactStyle } from '@capacitor/haptics'
import { Preferences } from '@capacitor/preferences'
import { Share } from '@capacitor/share'

export const isNativeMobile = Capacitor.isNativePlatform()

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
    await Preferences.set({ key, value: JSON.stringify(data) })
    return
  }

  localStorage.setItem(key, JSON.stringify(data))
}

async function readAllData() {
  if (window.electronAPI?.exportData) {
    return window.electronAPI.exportData()
  }

  if (isNativeMobile) {
    const { keys } = await Preferences.keys()
    const entries = await Promise.all(
      keys.map(async (key) => {
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
    await Preferences.clear()
    await Promise.all(
      Object.entries(payload.data).map(([key, value]) =>
        Preferences.set({ key, value: JSON.stringify(value) })
      )
    )
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
