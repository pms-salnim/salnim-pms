
// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { initializeFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";
import { getFunctions, type Functions } from "firebase/functions"; 

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCbLvNTGnyt5LJvnZJ71Tilqax7BrnUlp0",
  authDomain: "protrack-hub.firebaseapp.com",
  projectId: "protrack-hub",
  storageBucket: "protrack-hub.firebasestorage.app",
  messagingSenderId: "1094514589920",
  appId: "1:1094514589920:web:916773591941e542995085"
};

// Initialize Firebase
let app: FirebaseApp;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

const auth: Auth = getAuth(app);
const db: Firestore = initializeFirestore(app, {
    experimentalForceLongPolling: true,
});
const storage: FirebaseStorage = getStorage(app);
const functions: Functions = getFunctions(app);
const functionsEurope: Functions = getFunctions(app, 'europe-west1');

export { app, auth, db, storage, functions, functionsEurope };
