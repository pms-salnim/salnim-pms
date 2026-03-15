
import { initializeApp, getApps, type App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

let app: App;

// Initialize the Admin SDK once, if it hasn't been already.
if (getApps().length === 0) {
  app = initializeApp();
} else {
  app = getApps()[0]!;
}

export const db = getFirestore(app);
export { app };
