// firebase-config.js
// Firebase configuration and initialization (ES Module)
// Assumes Firebase compat SDK is loaded via CDN script tags before this module runs.

export const firebaseConfig = {
  apiKey: "AIzaSyD0A1zJ9bGCwk_UioAbgsNWrV2M9C51aDo",
  authDomain: "fahmid-school.firebaseapp.com",
  projectId: "fahmid-school",
  storageBucket: "fahmid-school.firebasestorage.app",
  messagingSenderId: "48604608508",
  appId: "1:48604608508:web:5b387a2de260b9851a6479",
  measurementId: "G-HEC84JXFY2"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

export default firebase.app();
