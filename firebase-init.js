/**
 * FAHMID NURSERY & PRIMARY SCHOOL
 * Firebase Initialization & Shared Authentication
 * CORRECTED - All duplicates removed
 * 
 * @version 3.1.0 - FIXED
 * @date 2026-01-10
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
window.firebase = firebase;

// ENABLE OFFLINE PERSISTENCE
try {
  // Use the new persistentCacheIndexManager() API
  window.db.enablePersistence({ 
    synchronizeTabs: true 
  })
    .then(() => {
      console.log('✓ Offline persistence enabled');
    })
    .catch((err) => {
      if (err.code === 'failed-precondition') {
        console.warn('⚠️ Persistence failed: Multiple tabs open');
      } else if (err.code === 'unimplemented') {
        console.warn('⚠️ Persistence not supported by browser');
      } else {
        console.error('❌ Persistence error:', err);
      }
    });
} catch (error) {
  console.error('❌ Failed to enable persistence:', error);
}

// ============================================
// SESSION TIMEOUT CONFIGURATION
// ============================================

/**
 * Configure automatic session timeout for security
 * Default: 8 hours of inactivity
 */
const SESSION_TIMEOUT_MS = 8 * 60 * 60 * 1000; // 8 hours
let sessionTimeoutId = null;
let lastActivityTime = Date.now();

/**
 * Reset session timeout on user activity
 */
function resetSessionTimeout() {
  lastActivityTime = Date.now();
  
  if (sessionTimeoutId) {
    clearTimeout(sessionTimeoutId);
  }
  
  sessionTimeoutId = setTimeout(() => {
    const currentUser = window.auth.currentUser;
    
    if (currentUser) {
      console.log('Session timeout reached, logging out...');
      
      window.auth.signOut()
        .then(() => {
          window.showToast?.(
            'Your session has expired due to inactivity. Please log in again.',
            'info',
            5000
          );
          
          setTimeout(() => {
            window.location.href = 'login.html';
          }, 2000);
        })
        .catch(error => {
          console.error('Error during session timeout logout:', error);
        });
    }
  }, SESSION_TIMEOUT_MS);
}

/**
 * Track user activity to reset timeout
 */
const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];

activityEvents.forEach(event => {
  document.addEventListener(event, () => {
    // Only reset if logged in
    if (window.auth.currentUser) {
      resetSessionTimeout();
    }
  }, { passive: true });
});

/**
 * Start timeout tracking when user logs in
 */
window.auth.onAuthStateChanged(user => {
  if (user) {
    resetSessionTimeout();
    console.log('✓ Session timeout tracking started');
  } else {
    if (sessionTimeoutId) {
      clearTimeout(sessionTimeoutId);
      sessionTimeoutId = null;
    }
  }
});

console.log(`✓ Session timeout configured: ${SESSION_TIMEOUT_MS / 1000 / 60} minutes`);

// ============================================
// ERROR MESSAGES - DEFINED ONCE
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

// ============================================
// ERROR HANDLER - DEFINED ONCE
// ============================================

window.handleError = function(error, fallbackMessage = 'An error occurred') {
  console.error('Error details:', error);
  
  const errorCode = error.code || 'unknown';
  
  let userMessage = fallbackMessage;
  
  // Check if we have a predefined message
  if (window.ERROR_MESSAGES[errorCode]) {
    userMessage = window.ERROR_MESSAGES[errorCode];
  } else if (error.message) {
    userMessage = `${fallbackMessage}: ${error.message}`;
  }
  
  // Handle authentication errors specially
  if (errorCode === 'unauthenticated' || errorCode === 'auth/unauthenticated') {
    userMessage = '🔒 You must be logged in to perform this action.';
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
  
  // Show toast or alert
  if (window.showToast) {
    window.showToast(userMessage, 'danger', 6000);
  } else {
    alert(userMessage);
  }
  
  return userMessage;
};

// ============================================
// GET CURRENT SETTINGS - DEFINED ONCE
// ============================================

window.getCurrentSettings = async function() {
  // Define complete default structure
  const defaultSettings = {
    term: 'First Term',
    session: '2025/2026',
    currentSession: {
      name: '2025/2026',
      startYear: 2025,
      endYear: 2026,
      startDate: null,
      endDate: null
    },
    resumptionDate: null,
    promotionPeriodActive: false
  };
  
  try {
    const settingsDoc = await window.db.collection('settings').doc('current').get();
    
    if (!settingsDoc.exists) {
      console.warn('⚠️ Settings document not found, using defaults');
      return defaultSettings;
    }
    
    const data = settingsDoc.data();
    
    // Extract session information safely
    let sessionName = defaultSettings.session;
    let sessionData = defaultSettings.currentSession;
    
    if (data.currentSession && typeof data.currentSession === 'object') {
      sessionName = data.currentSession.name || 
                    `${data.currentSession.startYear}/${data.currentSession.endYear}` ||
                    defaultSettings.session;
      sessionData = {
        name: sessionName,
        startYear: data.currentSession.startYear || defaultSettings.currentSession.startYear,
        endYear: data.currentSession.endYear || defaultSettings.currentSession.endYear,
        startDate: data.currentSession.startDate || null,
        endDate: data.currentSession.endDate || null
      };
    } else if (data.session) {
      sessionName = data.session;
      // Try to parse year from session name like "2025/2026"
      const yearMatch = data.session.match(/(\d{4})\/(\d{4})/);
      if (yearMatch) {
        sessionData = {
          name: data.session,
          startYear: parseInt(yearMatch[1]),
          endYear: parseInt(yearMatch[2]),
          startDate: null,
          endDate: null
        };
      }
    }
    
    // Return complete object with all fields
    return {
      term: data.term || defaultSettings.term,
      session: sessionName,
      currentSession: sessionData,
      resumptionDate: data.resumptionDate || null,
      promotionPeriodActive: Boolean(data.promotionPeriodActive)
    };
    
  } catch (error) {
    console.error('❌ Error getting settings:', error);
    
    // Always return valid default object on error
    return defaultSettings;
  }
};

// ============================================
// SHARED HELPER FUNCTIONS
// ============================================

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
 * Login with admission number
 * SECURITY: No admission number validation in client
 * Returns same error message regardless of existence
 */
window.loginWithAdmissionNumber = async function(admissionNo, password) {
  try {
    // Normalize input
    admissionNo = String(admissionNo || '').trim();
    if (!admissionNo) {
      throw { code: 'auth/invalid-login-credentials' };
    }

    // Rate limiting check (client-side)
    const lastAttempt = sessionStorage.getItem('lastAdmissionAttempt');
    const now = Date.now();
    if (lastAttempt && (now - parseInt(lastAttempt, 10)) < 2000) {
      throw new Error('Too many attempts. Please wait.');
    }
    sessionStorage.setItem('lastAdmissionAttempt', now.toString());

    // Query pupils (limit to 1 for efficiency)
    const pupilsRef = window.db.collection('pupils');
    const querySnapshot = await pupilsRef
      .where('admissionNo', '==', admissionNo)
      .limit(1)
      .get();

    if (querySnapshot.empty) {
      // Generic error to avoid enumeration
      throw { code: 'auth/invalid-login-credentials' };
    }

    const pupilDoc = querySnapshot.docs[0];
    const pupilData = pupilDoc.data();
    const email = pupilData?.email;

    if (!email) {
      // Generic error
      throw { code: 'auth/invalid-login-credentials' };
    }

    // Authenticate with email and password
    await window.auth.signInWithEmailAndPassword(email, password);

    window.showToast?.('Login successful!', 'success');
    setTimeout(() => window.location.href = 'portal.html', 800);
  } catch (error) {
    // Normalize error for security (prevent enumeration)
    window.handleError({ code: 'auth/invalid-login-credentials' }, 'Login failed');
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

console.log('✓ Firebase initialized (shared v3.1.0 - FIXED)');

/**
 * Network retry helper with exponential backoff
 * @param {Function} operation - Async function to retry
 * @param {number} [maxRetries=3]
 * @param {string} [operationName='Operation']
 * @returns {Promise<any>}
 */
window.retryWithBackoff = async function(operation, maxRetries = 3, operationName = 'Operation') {
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            // Show retry feedback on retry attempts
            if (attempt > 1) {
                window.showToast?.(
                    `Retrying ${operationName}... (Attempt ${attempt}/${maxRetries})`,
                    'info',
                    2000
                );
            }

            const result = await operation();

            // Success feedback
            if (attempt > 1) {
                window.showToast?.(
                    `✓ ${operationName} succeeded after ${attempt} attempt(s)`,
                    'success',
                    3000
                );
            }

            return result;

        } catch (error) {
            lastError = error;

            // Determine if error is worth retrying
            const isRetryable =
                error?.code === 'unavailable' ||
                error?.code === 'deadline-exceeded' ||
                error?.code === 'cancelled' ||
                /network|timeout|unavailable/i.test(error?.message || '');

            if (!isRetryable) {
                console.error(`Non-retryable error during ${operationName}:`, error);
                throw error;
            }

            console.warn(`${operationName} failed (attempt ${attempt}/${maxRetries}):`, error.code || error.message);

            // Final failure
            if (attempt === maxRetries) {
                window.showToast?.(
                    `${operationName} failed after ${maxRetries} attempts. Please check your connection.`,
                    'danger',
                    6000
                );
                throw lastError;
            }

            // Exponential backoff: 1s → 2s → 4s → 8s (max 8s)
            const backoffTime = Math.min(1000 * Math.pow(2, attempt - 1), 8000);
            console.log(`Waiting ${backoffTime}ms before next attempt...`);

            await new Promise(resolve => setTimeout(resolve, backoffTime));
        }
    }

    // Should never reach here, but safety fallback
    throw lastError;
};

// ──────────────────────────────────────────────────────────────────────────────
// Convenience wrappers for common Firestore operations
// ──────────────────────────────────────────────────────────────────────────────

window.firestoreGet = async function(ref, operationName = 'Fetch document') {
    return window.retryWithBackoff(() => ref.get(), 3, operationName);
};

window.firestoreSet = async function(ref, data, options = null, operationName = 'Save document') {
    return window.retryWithBackoff(
        () => options ? ref.set(data, options) : ref.set(data),
        3,
        operationName
    );
};

window.firestoreUpdate = async function(ref, data, operationName = 'Update document') {
    return window.retryWithBackoff(() => ref.update(data), 3, operationName);
};

window.firestoreDelete = async function(ref, operationName = 'Delete document') {
    return window.retryWithBackoff(() => ref.delete(), 2, operationName); // fewer retries for delete
};

console.log('✓ Network retry helpers loaded');

/* =====================================================
   SESSION ENCODING UTILITIES
===================================================== */

/**
 * Encode session for use in Firestore document IDs
 * Converts "2025/2026" to "2025-2026"
 */
window.encodeSession = function(session) {
  if (!session) return '';
  return session.replace(/\//g, '-');
};

/**
 * Decode session for display
 * Converts "2025-2026" to "2025/2026"
 */
window.decodeSession = function(encodedSession) {
  if (!encodedSession) return '';
  return encodedSession.replace(/-/g, '/');
};

/**
 * Generate payment document ID with encoded session
 */
window.generatePaymentDocId = function(pupilId, session, term) {
  const encodedSession = window.encodeSession(session);
  return `${pupilId}_${encodedSession}_${term}`;
};

/**
 * Generate fee structure document ID with encoded session
 */
window.generateFeeStructureDocId = function(classId, session, term) {
  const encodedSession = window.encodeSession(session);
  return `${classId}_${encodedSession}_${term}`;
};

console.log('✓ Session encoding utilities loaded');