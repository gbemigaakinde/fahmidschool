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

window.ERROR_MESSAGES = {
  'auth/email-already-in-use': 'This email is already registered.',
  'auth/invalid-email': 'Please enter a valid email address.',
  'auth/weak-password': 'Password should be at least 6 characters long.',
  'auth/user-not-found': 'No account found with this email address.',
  'auth/wrong-password': 'Incorrect password. Please try again.',
  'auth/invalid-login-credentials': 'Invalid email or password. Please try again.',
  'auth/invalid-credential': 'Invalid email or password. Please try again.',
  'auth/user-disabled': 'This account has been disabled. Please contact support.',
  'auth/operation-not-allowed': 'This sign-in method is not enabled.',
  'auth/too-many-requests': 'Too many failed attempts. Please try again later.',
  'auth/network-request-failed': 'Network error. Please check your internet connection.',
  'auth/popup-closed-by-user': 'Sign-in cancelled.',
  'auth/cancelled-popup-request': 'Sign-in cancelled.',
  'auth/missing-password': 'Please enter your password.',
  'auth/internal-error': 'An internal error occurred. Please try again.',
  'permission-denied': 'Permission denied. Check your access rights.',
  'not-found': 'Resource not found.',
  'unavailable': 'Service temporarily unavailable. Please try again.',
  'deadline-exceeded': 'Request timeout. Please check your connection.',
  'unauthenticated': 'You must be logged in to perform this action.',
  'auth/unauthenticated': 'You must be logged in to perform this action.',
  'unknown': 'An unexpected error occurred.'
};

/**
 * Then update handleError to use window.ERROR_MESSAGES
 */
window.handleError = function(error, fallbackMessage = 'An error occurred') {
  console.error('Error details:', error);
  const errorCode = error.code || 'unknown';
  
  // Use window.ERROR_MESSAGES to ensure it's accessible
  const userMessage = window.ERROR_MESSAGES[errorCode] || 
                      `${fallbackMessage}: ${error.message || error.code}`;
  
  // Handle authentication errors specially
  if (errorCode === 'unauthenticated' || errorCode === 'auth/unauthenticated') {
    if (window.showToast) {
      window.showToast(userMessage, 'danger', 3000);
    } else {
      alert(userMessage);
    }
    setTimeout(() => {
      window.location.href = 'login.html';
    }, 2000);
    return userMessage;
  }
  
  if (window.showToast) {
    window.showToast(userMessage, 'danger', 5000);
  } else {
    alert(userMessage);
  }
  
  return userMessage;
};

// ============================================
// SHARED HELPER FUNCTIONS
// ============================================

/**
 * REPLACE the existing handleError function in firebase-init.js
 * Enhanced version with better error handling
 */

window.handleError = function(error, fallbackMessage = 'An error occurred') {
  console.error('Error details:', error);
  
  // Get error code
  const errorCode = error.code || 'unknown';
  
  // ENHANCED: Better error message logic
  let userMessage = fallbackMessage;
  
  // Check if we have a predefined message
  if (ERROR_MESSAGES[errorCode]) {
    userMessage = ERROR_MESSAGES[errorCode];
  } else if (error.message) {
    // Use the error message if available
    userMessage = `${fallbackMessage}: ${error.message}`;
  }
  
  // ENHANCED: Handle authentication errors specially
  if (errorCode === 'unauthenticated' || errorCode === 'auth/unauthenticated') {
    userMessage = '🔒 You must be logged in to perform this action.';
    if (window.showToast) {
      window.showToast(userMessage, 'danger', 3000);
    } else {
      alert(userMessage);
    }
    // Redirect to login after 2 seconds
    setTimeout(() => {
      window.location.href = 'login.html';
    }, 2000);
    return userMessage;
  }
  
  // ENHANCED: Show toast or alert
  if (window.showToast) {
    window.showToast(userMessage, 'danger', 6000);
  } else {
    alert(userMessage);
  }
  
  return userMessage;
};

console.log('✓ handleError enhanced with better Firebase error handling');

/**
 * REPLACE the existing getCurrentSettings function in firebase-init.js
 * This version returns ALL settings fields your code expects
 */

window.getCurrentSettings = async function() {
  try {
    const settingsDoc = await window.db.collection('settings').doc('current').get();
    
    if (settingsDoc.exists) {
      const data = settingsDoc.data();
      
      // FIXED: Extract session info properly
      let sessionName = '2025/2026';
      let sessionData = null;

      if (data.currentSession && typeof data.currentSession === 'object') {
        sessionName =
          data.currentSession.name ||
          `${data.currentSession.startYear}/${data.currentSession.endYear}`;
        sessionData = data.currentSession;
      } else if (data.session) {
        sessionName = data.session;
      }

      // FIXED: Return ALL fields that code expects
      return {
        term: data.term || 'First Term',
        session: sessionName,
        currentSession: sessionData,  // Full session object
        resumptionDate: data.resumptionDate || null,
        promotionPeriodActive: data.promotionPeriodActive || false
      };
    }
    
    // FIXED: Return complete default structure
    return {
      term: 'First Term',
      session: '2025/2026',
      currentSession: null,
      resumptionDate: null,
      promotionPeriodActive: false
    };
  } catch (error) {
    console.error('Error getting settings:', error);
    
    // FIXED: Return complete default structure on error
    return {
      term: 'First Term',
      session: '2025/2026',
      currentSession: null,
      resumptionDate: null,
      promotionPeriodActive: false
    };
  }
};

console.log('✓ getCurrentSettings updated with full fields');

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