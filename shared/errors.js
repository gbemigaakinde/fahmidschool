// shared/errors.js
// Error messages and error handler utility (ES Module)

import { showToast } from '../ui/toast.js';

export const ERROR_MESSAGES = {
  'auth/email-already-in-use':    'This email is already registered.',
  'auth/invalid-email':           'Please enter a valid email address.',
  'auth/weak-password':           'Password should be at least 6 characters long.',
  'auth/user-not-found':          'No account found with this email address.',
  'auth/wrong-password':          'Incorrect password. Please try again.',
  'auth/invalid-login-credentials': 'Invalid email or password. Please try again.',
  'auth/invalid-credential':      'Invalid email or password. Please try again.',
  'auth/user-disabled':           'This account has been disabled. Please contact support.',
  'auth/operation-not-allowed':   'This sign-in method is not enabled.',
  'auth/too-many-requests':       'Too many failed attempts. Please try again later.',
  'auth/network-request-failed':  'Network error. Please check your internet connection.',
  'auth/popup-closed-by-user':    'Sign-in cancelled.',
  'auth/cancelled-popup-request': 'Sign-in cancelled.',
  'auth/missing-password':        'Please enter your password.',
  'auth/internal-error':          'An internal error occurred. Please try again.',
  'permission-denied':            'Permission denied. Check your access rights.',
  'not-found':                    'Resource not found.',
  'unavailable':                  'Service temporarily unavailable. Please try again.',
  'deadline-exceeded':            'Request timeout. Please check your connection.',
  'unauthenticated':              'You must be logged in to perform this action.',
  'auth/unauthenticated':         'You must be logged in to perform this action.',
  'unknown':                      'An unexpected error occurred.'
};

/**
 * Centralised error handler.
 * Maps Firebase/Firestore error codes to user-friendly messages,
 * displays a toast, and redirects to login on unauthenticated errors.
 *
 * @param {Error}  error           - The caught error object
 * @param {string} fallbackMessage - Shown when no mapped message exists
 * @returns {string} The message that was displayed
 */
export function handleError(error, fallbackMessage = 'An error occurred') {
  console.error('Error details:', error);

  const errorCode = error.code || 'unknown';
  let userMessage = fallbackMessage;

  if (ERROR_MESSAGES[errorCode]) {
    userMessage = ERROR_MESSAGES[errorCode];
  } else if (error.message) {
    userMessage = `${fallbackMessage}: ${error.message}`;
  }

  // Unauthenticated — show toast then redirect to login
  if (errorCode === 'unauthenticated' || errorCode === 'auth/unauthenticated') {
    userMessage = '🔒 You must be logged in to perform this action.';
    showToast(userMessage, 'danger', 3000);
    setTimeout(() => { window.location.href = 'login.html'; }, 2000);
    return userMessage;
  }

  showToast(userMessage, 'danger', 6000);
  return userMessage;
}
