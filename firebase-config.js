// firebase-config.js
// Firebase configuration and initialization (ES Module)
// Uses Firebase v9+ modular SDK.

import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/12.8.0/firebase-app.js';

export const firebaseConfig = {
  apiKey: "AIzaSyD0A1zJ9bGCwk_UioAbgsNWrV2M9C51aDo",
  authDomain: "fahmid-school.firebaseapp.com",
  projectId: "fahmid-school",
  storageBucket: "fahmid-school.firebasestorage.app",
  messagingSenderId: "48604608508",
  appId: "1:48604608508:web:5b387a2de260b9851a6479",
  measurementId: "G-HEC84JXFY2"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export default app;
