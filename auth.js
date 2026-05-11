// auth.js
// Firebase Auth instance, session timeout, and auth helper functions (ES Module)

import _app from './firebase-config.js';
import { showToast } from './ui/toast.js';
import { handleError } from './shared/errors.js';

export const auth = firebase.auth();

// ============================================
// SESSION TIMEOUT
// ============================================

const SESSION_TIMEOUT_MS = 8 * 60 * 60 * 1000; // 8 hours
let sessionTimeoutId = null;

export function resetSessionTimeout() {
  if (sessionTimeoutId) {
    clearTimeout(sessionTimeoutId);
  }

  sessionTimeoutId = setTimeout(async () => {
    if (!auth.currentUser) return;

    console.log('Session timeout reached, logging out...');
    try {
      await auth.signOut();
      showToast(
        'Your session has expired due to inactivity. Please log in again.',
        'info',
        5000
      );
      setTimeout(() => { window.location.href = 'login.html'; }, 2000);
    } catch (error) {
      console.error('Error during session timeout logout:', error);
    }
  }, SESSION_TIMEOUT_MS);
}

const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
activityEvents.forEach(event => {
  document.addEventListener(event, () => {
    if (auth.currentUser) resetSessionTimeout();
  }, { passive: true });
});

auth.onAuthStateChanged(user => {
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

// ============================================
// ROLE & USER HELPERS
// ============================================

export async function getUserRole(uid) {
  try {
    const doc = await firebase.firestore().collection('users').doc(uid).get();
    return doc.exists ? (doc.data().role || 'pupil') : null;
  } catch (error) {
    console.error('Error getting user role:', error);
    return null;
  }
}

/**
 * Verify the currently signed-in user has the required role.
 * Resolves with { uid, email, role } on success.
 * On failure, signs out and redirects to login.html.
 */
export function checkRole(requiredRole) {
  return new Promise((resolve, reject) => {
    auth.onAuthStateChanged(async (user) => {
      if (!user) {
        showToast('Please log in to continue', 'warning');
        setTimeout(() => { window.location.href = 'login.html'; }, 1500);
        reject(new Error('Not authenticated'));
        return;
      }

      try {
        const userDoc = await firebase.firestore()
          .collection('users')
          .doc(user.uid)
          .get();

        if (!userDoc.exists) {
          showToast('User profile not found', 'danger');
          await auth.signOut();
          setTimeout(() => { window.location.href = 'login.html'; }, 1500);
          reject(new Error('User profile not found'));
          return;
        }

        const userData = userDoc.data();

        if (userData.role !== requiredRole) {
          showToast('Access denied. Insufficient permissions.', 'danger');
          await auth.signOut();
          setTimeout(() => { window.location.href = 'login.html'; }, 2000);
          reject(new Error('Insufficient permissions'));
          return;
        }

        resolve({ uid: user.uid, email: user.email, role: userData.role });
      } catch (error) {
        console.error('Error checking role:', error);
        handleError(error, 'Error verifying permissions');
        reject(error);
      }
    });
  });
}

// ============================================
// PORTAL REDIRECT
// ============================================

/**
 * Used by portal.html — checks auth state, fetches user role with up to
 * 3 retries, then redirects to the appropriate dashboard.
 * Calls the provided UI callbacks so portal.html can update its step
 * indicators and status text without this module depending on the DOM.
 *
 * @param {object} callbacks
 * @param {function} callbacks.setStatus    - (message: string) => void
 * @param {function} callbacks.markDone     - (stepEl: Element) => void
 * @param {function} callbacks.markActive   - (stepEl: Element) => void
 * @param {object}   callbacks.steps        - { auth, role, redirect } DOM elements
 * @param {function} callbacks.onError      - () => void  (e.g. add error class to card)
 */
export function initPortalRedirect({ setStatus, markDone, markActive, steps, onError }) {
  let authCheckComplete = false;
  let redirectTimeout   = null;

  auth.onAuthStateChanged(async (user) => {
    if (redirectTimeout) {
      clearTimeout(redirectTimeout);
      redirectTimeout = null;
    }

    if (user) {
      try {
        markDone(steps.auth);
        markActive(steps.role);
        setStatus('Checking your access level…');

        // Fetch user doc with up to 3 attempts and exponential backoff
        let attempts = 0;
        let userDoc  = null;

        while (attempts < 3 && !userDoc) {
          try {
            const doc = await firebase.firestore()
              .collection('users')
              .doc(user.uid)
              .get();
            if (doc.exists) { userDoc = doc; break; }
          } catch (error) {
            attempts++;
            console.warn(`Attempt ${attempts}/3 failed:`, error.code);
            if (attempts < 3) {
              await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
            }
          }
        }

        if (userDoc && userDoc.exists) {
          const role = userDoc.data().role;

          markDone(steps.role);
          markActive(steps.redirect);
          setStatus(`Welcome! Opening your ${role} portal…`);

          authCheckComplete = true;

          redirectTimeout = setTimeout(() => {
            if      (role === 'admin')   window.location.replace('admin.html');
            else if (role === 'teacher') window.location.replace('teacher.html');
            else if (role === 'pupil')   window.location.replace('pupil.html');
            else throw new Error('Unknown role: ' + role);
          }, 900);

        } else {
          throw new Error('User profile not found after 3 attempts');
        }

      } catch (error) {
        console.error('Portal redirect error:', error);
        onError?.();
        setStatus('Error loading your profile. Redirecting to login…');
        authCheckComplete = true;

        showToast('Unable to load your profile. Please log in again.', 'danger', 5000);

        await auth.signOut();

        redirectTimeout = setTimeout(() => {
          window.location.replace('login.html');
        }, 3000);
      }

    } else {
      if (authCheckComplete) {
        setStatus('Session expired. Please log in again.');
        showToast('Session expired. Please log in again.', 'warning');

        redirectTimeout = setTimeout(() => {
          window.location.replace('login.html');
        }, 1500);

      } else {
        setStatus('Initialising…');
        console.log('⏳ Waiting for Firebase auth to initialise…');

        redirectTimeout = setTimeout(() => {
          console.warn('⚠️ Auth initialisation timeout');
          setStatus('Please log in to continue.');
          window.location.replace('login.html');
        }, 10000);
      }
    }
  });

  // Safety net — mark auth check done after 2 s regardless
  setTimeout(() => { authCheckComplete = true; }, 2000);
}

// ============================================
// LOGIN / LOGOUT
// ============================================

/**
 * Resolve an admission number to the pupil's registered email address.
 * Returns null if no matching pupil is found.
 */
async function getEmailByAdmissionNumber(admissionNo) {
  const snapshot = await firebase.firestore()
    .collection('pupils')
    .where('admissionNo', '==', admissionNo)
    .limit(1)
    .get();

  if (snapshot.empty) return null;
  return snapshot.docs[0].data().email || null;
}

/**
 * Sign in with either an email address or an admission number.
 * If identifier contains no '@' it is treated as an admission number
 * and resolved to an email via Firestore before calling signInWithEmailAndPassword.
 */
export async function login(identifier, password) {
  let email = identifier.trim();
  const isAdmissionNo = !email.includes('@');

  if (isAdmissionNo) {
    const found = await getEmailByAdmissionNumber(email);
    if (!found) {
      showToast('No account found with this admission number.', 'danger');
      throw new Error('Invalid admission number');
    }
    email = found;
  }

  try {
    await auth.signInWithEmailAndPassword(email, password);
    showToast('Login successful! Redirecting…', 'success');
    setTimeout(() => { window.location.href = 'portal.html'; }, 1000);
  } catch (error) {
    handleError(error, 'Login failed');
    throw error;
  }
}

export async function logout() {
  try {
    await auth.signOut();
    showToast('Logged out successfully', 'success');
    setTimeout(() => { window.location.href = 'login.html'; }, 800);
  } catch (error) {
    handleError(error, 'Logout failed');
  }
}

// ============================================
// FORGOT PASSWORD
// ============================================

/**
 * Send a password reset email, but only after confirming the address
 * exists in the pupils collection — matching the login.html behaviour.
 * Throws on failure so the caller can update the UI accordingly.
 */
export async function sendPasswordReset(email) {
  const snapshot = await firebase.firestore()
    .collection('pupils')
    .where('email', '==', email)
    .limit(1)
    .get();

  if (snapshot.empty) {
    throw Object.assign(new Error('No account found with this email address.'), {
      code: 'auth/user-not-found'
    });
  }

  await auth.sendPasswordResetEmail(email);
}
