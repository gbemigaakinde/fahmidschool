// db.js
// Firestore database instance and convenience wrappers (ES Module)

import _app from './firebase-config.js';
import { retryWithBackoff } from './shared/retry.js';

export const db = firebase.firestore();

db.enablePersistence({ synchronizeTabs: true })
  .catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn('⚠️ Persistence failed: Multiple tabs open');
    } else if (err.code === 'unimplemented') {
      console.warn('⚠️ Persistence not supported by browser');
    } else {
      console.error('❌ Persistence error:', err);
    }
  });

export async function firestoreGet(ref, operationName = 'Fetch document') {
  return retryWithBackoff(() => ref.get(), 3, operationName);
}

export async function firestoreSet(ref, data, options = null, operationName = 'Save document') {
  return retryWithBackoff(
    () => options ? ref.set(data, options) : ref.set(data),
    3,
    operationName
  );
}

export async function firestoreUpdate(ref, data, operationName = 'Update document') {
  return retryWithBackoff(() => ref.update(data), 3, operationName);
}

export async function firestoreDelete(ref, operationName = 'Delete document') {
  return retryWithBackoff(() => ref.delete(), 2, operationName);
}
