import { Capacitor, CapacitorHttp } from '@capacitor/core'

const firebaseConfig = {
  apiKey: 'AIzaSyAOJ6UdMRcyjn8Tk-3aiS4QMm-Amzf6Tuo',
  projectId: 'scrapsys'
}

const AUTH_SESSION_KEY = '__scrapsys_firebase_auth_session'
const WORKSPACE_DOCUMENT_URL = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/scrapsysSync/shared_workspace`

const isNativeMobile = Capacitor.isNativePlatform()

function readBrowserJson(key, fallback) {
  const value = localStorage.getItem(key)
  if (!value) return fallback
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

async function requestJson(url, options = {}) {
  if (isNativeMobile) {
    const response = await CapacitorHttp.request({
      method: options.method || 'GET',
      url,
      headers: options.headers || {},
      data: options.body ? JSON.parse(options.body) : undefined,
      connectTimeout: 10000,
      readTimeout: 10000
    })
    if (response.status < 200 || response.status >= 300) {
      const message = response.data?.error?.message || response.data?.message || `HTTP ${response.status}`
      throw new Error(message)
    }
    return response.data
  }

  const response = await fetch(url, options)
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data?.error?.message || `HTTP ${response.status}`)
  }
  return data
}

function toFirestoreValue(value) {
  if (value === null || value === undefined) return { nullValue: null }
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(toFirestoreValue) } }
  }
  if (typeof value === 'boolean') return { booleanValue: value }
  if (typeof value === 'number') {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value }
  }
  if (typeof value === 'object') {
    return {
      mapValue: {
        fields: Object.fromEntries(
          Object.entries(value).map(([key, nestedValue]) => [key, toFirestoreValue(nestedValue)])
        )
      }
    }
  }
  return { stringValue: String(value) }
}

function fromFirestoreValue(value) {
  if (!value || 'nullValue' in value) return null
  if ('booleanValue' in value) return value.booleanValue
  if ('integerValue' in value) return Number(value.integerValue)
  if ('doubleValue' in value) return Number(value.doubleValue)
  if ('stringValue' in value) return value.stringValue
  if ('timestampValue' in value) return value.timestampValue
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(fromFirestoreValue)
  if ('mapValue' in value) {
    return Object.fromEntries(
      Object.entries(value.mapValue.fields || {}).map(([key, nestedValue]) => [
        key,
        fromFirestoreValue(nestedValue)
      ])
    )
  }
  return null
}

export async function readFirebaseSession() {
  if (isNativeMobile) {
    const { Preferences } = await import('@capacitor/preferences')
    const { value } = await Preferences.get({ key: AUTH_SESSION_KEY })
    if (!value) return null
    try {
      return JSON.parse(value)
    } catch {
      return null
    }
  }

  return readBrowserJson(AUTH_SESSION_KEY, null)
}

async function saveFirebaseSession(session) {
  const value = JSON.stringify(session)
  if (isNativeMobile) {
    const { Preferences } = await import('@capacitor/preferences')
    await Preferences.set({ key: AUTH_SESSION_KEY, value })
    return
  }
  localStorage.setItem(AUTH_SESSION_KEY, value)
}

export async function ensureAnonymousFirebaseUser() {
  const saved = await readFirebaseSession()
  if (saved?.idToken && saved.expiresAt && saved.expiresAt > Date.now() + 60000) {
    return saved
  }

  const data = await requestJson(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${firebaseConfig.apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ returnSecureToken: true })
    }
  )
  const session = {
    uid: data.localId,
    idToken: data.idToken,
    refreshToken: data.refreshToken,
    expiresAt: Date.now() + Number(data.expiresIn || 3600) * 1000,
    anonymous: true
  }
  await saveFirebaseSession(session)
  return session
}

export async function clearFirebaseSession() {
  if (isNativeMobile) {
    const { Preferences } = await import('@capacitor/preferences')
    await Preferences.remove({ key: AUTH_SESSION_KEY })
    return
  }
  localStorage.removeItem(AUTH_SESSION_KEY)
}

export async function getWorkspaceDocument() {
  const session = await ensureAnonymousFirebaseUser()
  try {
    const document = await requestJson(WORKSPACE_DOCUMENT_URL, {
      headers: { Authorization: `Bearer ${session.idToken}` }
    })
    return Object.fromEntries(
      Object.entries(document.fields || {}).map(([key, value]) => [key, fromFirestoreValue(value)])
    )
  } catch (error) {
    if (String(error?.message || '').includes('NOT_FOUND')) return null
    throw error
  }
}

export async function saveWorkspaceDocument(data) {
  const session = await ensureAnonymousFirebaseUser()
  await requestJson(WORKSPACE_DOCUMENT_URL, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${session.idToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      fields: Object.fromEntries(
        Object.entries(data).map(([key, value]) => [key, toFirestoreValue(value)])
      )
    })
  })
}
