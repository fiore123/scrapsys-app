import { Capacitor, CapacitorHttp } from '@capacitor/core'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'scrapsys'
}

const AUTH_SESSION_KEY = '__scrapsys_firebase_auth_session'
const WORKSPACE_DOCUMENT_URL = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/scrapsysSync/shared_workspace`

const isNativeMobile = Capacitor.isNativePlatform()

class FirebaseRestError extends Error {
  constructor(message, status, data) {
    super(message)
    this.name = 'FirebaseRestError'
    this.status = status
    this.data = data
  }
}

function assertFirebaseConfig() {
  if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
    throw new Error('Firebase nao configurado. Confira o arquivo .env.local.')
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
    const data =
      typeof response.data === 'string'
        ? (() => {
            try {
              return JSON.parse(response.data)
            } catch {
              return { message: response.data }
            }
          })()
        : response.data
    if (response.status < 200 || response.status >= 300) {
      const message = data?.error?.message || data?.message || `HTTP ${response.status}`
      throw new FirebaseRestError(message, response.status, data)
    }
    return data
  }

  const response = await fetch(url, options)
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new FirebaseRestError(data?.error?.message || `HTTP ${response.status}`, response.status, data)
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

async function refreshFirebaseSession(saved) {
  assertFirebaseConfig()
  const refreshed = await requestJson(
    `https://securetoken.googleapis.com/v1/token?key=${firebaseConfig.apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        refresh_token: saved.refreshToken
      })
    }
  )
  const session = {
    uid: refreshed.user_id,
    email: saved.email || '',
    idToken: refreshed.id_token,
    refreshToken: refreshed.refresh_token,
    expiresAt: Date.now() + Number(refreshed.expires_in || 3600) * 1000,
    provider: 'password'
  }
  await saveFirebaseSession(session)
  return session
}

export async function signInFirebaseOwner(email, password) {
  assertFirebaseConfig()
  const safeEmail = String(email || '').trim().toLowerCase()
  if (!safeEmail || !password) throw new Error('Informe e-mail e senha do dono da sincronizacao.')

  const data = await requestJson(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${firebaseConfig.apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: safeEmail,
        password,
        returnSecureToken: true
      })
    }
  )

  const session = {
    uid: data.localId,
    email: data.email || safeEmail,
    idToken: data.idToken,
    refreshToken: data.refreshToken,
    expiresAt: Date.now() + Number(data.expiresIn || 3600) * 1000,
    provider: 'password'
  }
  await saveFirebaseSession(session)
  return session
}

export async function ensureFirebaseOwnerSession() {
  const saved = await readFirebaseSession()
  if (!saved?.idToken || !saved?.refreshToken) {
    throw new Error('Configure a sincronizacao segura com e-mail e senha do Firebase.')
  }

  if (saved.expiresAt && saved.expiresAt > Date.now() + 60000) {
    return saved
  }

  try {
    return await refreshFirebaseSession(saved)
  } catch (error) {
    await clearFirebaseSession()
    throw new Error('Sessao segura expirada. Conecte novamente a sincronizacao.')
  }
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
  const session = await ensureFirebaseOwnerSession()
  try {
    const document = await requestJson(WORKSPACE_DOCUMENT_URL, {
      headers: { Authorization: `Bearer ${session.idToken}` }
    })
    return Object.fromEntries(
      Object.entries(document.fields || {}).map(([key, value]) => [key, fromFirestoreValue(value)])
    )
  } catch (error) {
    if (error?.status === 404 || String(error?.message || '').includes('NOT_FOUND')) return null
    if (String(error?.message || '').includes('Database') && String(error?.message || '').includes('not found')) {
      throw new Error('Firestore ainda nao foi criado no projeto Firebase.')
    }
    throw error
  }
}

export async function saveWorkspaceDocument(data) {
  const session = await ensureFirebaseOwnerSession()
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
