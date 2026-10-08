import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, getFirestore, setLogLevel } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Suppress verbose WebChannelConnection logs
try {
  setLogLevel('silent');
} catch (_) {}

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

const dbId = (firebaseConfig as any).firestoreDatabaseId && (firebaseConfig as any).firestoreDatabaseId !== '(default)'
    ? (firebaseConfig as any).firestoreDatabaseId
    : undefined;

let firestoreInstance;
try {
  if (dbId) {
    firestoreInstance = initializeFirestore(app, {
      experimentalForceLongPolling: true,
    }, dbId);
  } else {
    firestoreInstance = initializeFirestore(app, {
      experimentalForceLongPolling: true,
    });
  }
} catch (_e) {
  try {
    firestoreInstance = dbId ? getFirestore(app, dbId) : getFirestore(app);
  } catch (_e2) {
    firestoreInstance = getFirestore(app);
  }
}

export const db = firestoreInstance;
export const auth = getAuth(app);
