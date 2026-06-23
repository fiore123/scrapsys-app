import { initializeApp } from 'firebase/app'
import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from 'firebase/auth'
import { doc, getDoc, getFirestore, serverTimestamp, setDoc } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: 'AIzaSyAOJ6UdMRcyjn8Tk-3aiS4QMm-Amzf6Tuo',
  authDomain: 'scrapsys.firebaseapp.com',
  projectId: 'scrapsys',
  storageBucket: 'scrapsys.firebasestorage.app',
  messagingSenderId: '363039150344',
  appId: '1:363039150344:web:ce2872728f7e8409809cbd',
  measurementId: 'G-NDWF8FG6ZZ'
}

const app = initializeApp(firebaseConfig)

export const firebaseAuth = getAuth(app)
export const firebaseDb = getFirestore(app)

export async function getCurrentFirebaseUser() {
  if (firebaseAuth.currentUser) return firebaseAuth.currentUser

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      unsubscribe()
      resolve(null)
    }, 2000)

    const unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
      clearTimeout(timeout)
      unsubscribe()
      resolve(user)
    })
  })
}

export async function signInOrCreateFirebaseUser(email, password) {
  try {
    return await signInWithEmailAndPassword(firebaseAuth, email, password)
  } catch (error) {
    if (!['auth/user-not-found', 'auth/invalid-credential'].includes(error?.code)) {
      throw error
    }

    return createUserWithEmailAndPassword(firebaseAuth, email, password)
  }
}

export function getCloudSyncDocRef(uid) {
  return doc(firebaseDb, 'scrapsysSync', uid)
}

export async function signOutFirebaseUser() {
  await signOut(firebaseAuth)
}

export { getDoc, serverTimestamp, setDoc }
