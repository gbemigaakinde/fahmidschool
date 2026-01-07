/**
 * FAHMID NURSERY & PRIMARY SCHOOL
 * Firebase Initialization & Shared Authentication
 * SHARED CODE ONLY - No portal-specific logic
 * 
 * @version 3.0.0 - FIXED
 * @date 2026-01-05
 */
'use strict';

// ============================================
// FIREBASE CONFIGURATION & INITIALIZATION
// ============================================

const firebaseConfig = {
  apiKey: "AIzaSyD0A1zJ9bGCwk_UioAbgsNWrV2M9C51aDo",
  authDomain: "fahmid-school.firebaseapp.com",
  projectId: "fahmid-school",
  storageBucket: "fahmid-school.firebasestorage.app",
  messagingSenderId: "48604608508",
  appId: "1:48604608508:web:5b387a2de260b9851a6479",
  measurementId: "G-HEC84JXFY2"
};

// Initialize Firebase (only once)
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// Export to window for global access
window.db = firebase.firestore();
window.auth = firebase.auth();

// ============================================
// ERROR MESSAGES
// ============================================

const ERROR_MESSAGES = {
  'auth/email-already-in-use': 'This email is already registered.',
  'auth/invalid-email': 'Please enter a valid email address.',
  'auth/weak-password': 'Password should be at least 6 characters long.',
  'auth/user-not-found': 'No account found with this email address.',
  'auth/wrong-password': 'Incorrect password. Please try again.',
  'auth/too-many-requests': 'Too many failed attempts. Please try again later.',
  'permission-denied': 'Permission denied. Check your access rights.',
  'not-found': 'Resource not found.',
  'unknown': 'An unexpected error occurred.'
};

// ============================================
// SHARED HELPER FUNCTIONS
// ============================================

/**
 * Handle errors with user-friendly messages
 */
window.handleError = function(error, fallbackMessage = 'An error occurred') {
  console.error('Error details:', error);
  const errorCode = error.code || 'unknown';
  const userMessage = ERROR_MESSAGES[errorCode] || `${fallbackMessage}: ${error.message || error.code}`;
  
  if (window.showToast) {
    window.showToast(userMessage, 'danger', 5000);
  } else {
    alert(userMessage);
  }
};

/**
 * Get current school settings
 */
window.getCurrentSettings = async function() {
  try {
    const settingsDoc = await window.db.collection('settings').doc('current').get();
    if (settingsDoc.exists) {
      const data = settingsDoc.data();
      return {
        term: data.term || 'First Term',
        session: data.session || '2025/2026'
      };
    }
    return { term: 'First Term', session: '2025/2026' };
  } catch (error) {
    console.error('Error getting settings:', error);
    return { term: 'First Term', session: '2025/2026' };
  }
};

/**
 * Get user role from Firestore
 */
window.getUserRole = async function(uid) {
  try {
    const doc = await window.db.collection('users').doc(uid).get();
    return doc.exists ? (doc.data().role || 'pupil') : null;
  } catch (error) {
    console.error('Error getting user role:', error);
    return null;
  }
};

/**
 * Check if user has required role
 */
window.checkRole = function(requiredRole) {
  return new Promise((resolve, reject) => {
    window.auth.onAuthStateChanged(async (user) => {
      if (!user) {
        window.showToast?.('Please log in to continue', 'warning');
        setTimeout(() => window.location.href = 'login.html', 1500);
        reject(new Error('Not authenticated'));
        return;
      }

      try {
        const userDoc = await window.db.collection('users').doc(user.uid).get();
        
        if (!userDoc.exists) {
          window.showToast?.('User profile not found', 'danger');
          await window.auth.signOut();
          setTimeout(() => window.location.href = 'login.html', 1500);
          reject(new Error('User profile not found'));
          return;
        }

        const userData = userDoc.data();
        
        if (userData.role !== requiredRole) {
          window.showToast?.('Access denied. Insufficient permissions.', 'danger');
          await window.auth.signOut();
          setTimeout(() => window.location.href = 'login.html', 2000);
          reject(new Error('Insufficient permissions'));
          return;
        }

        resolve({
          uid: user.uid,
          email: user.email,
          role: userData.role
        });
      } catch (error) {
        console.error('Error checking role:', error);
        window.handleError(error, 'Error verifying permissions');
        reject(error);
      }
    });
  });
};

/**
 * Login user
 */
window.login = async function(email, password) {
  try {
    await window.auth.signInWithEmailAndPassword(email, password);
    window.showToast?.('Login successful!', 'success');
    setTimeout(() => window.location.href = 'portal.html', 800);
  } catch (error) {
    window.handleError(error, 'Login failed');
    throw error;
  }
};

/**
 * Logout user
 */
window.logout = async function() {
  try {
    await window.auth.signOut();
    window.showToast?.('Logged out successfully', 'success');
    setTimeout(() => window.location.href = 'login.html', 800);
  } catch (error) {
    window.handleError(error, 'Logout failed');
  }
};

/**
 * Get all teachers (for admin)
 */
window.getAllTeachers = async function() {
  try {
    const snapshot = await window.db.collection('teachers').get();
    const teachers = [];
    snapshot.forEach(doc => {
      teachers.push({ uid: doc.id, ...doc.data() });
    });
    return teachers.sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error('Error fetching teachers:', error);
    return [];
  }
};

console.log('✓ Firebase initialized (shared v3.0.0)');