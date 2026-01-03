/**
 * FAHMID NURSERY & PRIMARY SCHOOL
 * Firebase Initialization & Authentication
 * Phases 4-7 Complete
 * 
 * Handles:
 * - Firebase configuration
 * - Authentication flow
 * - User role management
 * - Error handling
 * 
 * @version 2.0.0
 * @date 2026-01-03
 */

'use strict';

// ============================================
// FIREBASE CONFIGURATION
// ============================================

/**
 * Firebase configuration object
 * Replace with your own Firebase config from console
 */
const firebaseConfig = {
    apiKey: "AIzaSyD0A1zJ9bGCwk_UioAbgsNWrV2M9C51aDo",
    authDomain: "fahmid-school.firebaseapp.com",
    projectId: "fahmid-school",
    storageBucket: "fahmid-school.firebasestorage.app",
    messagingSenderId: "48604608508",
    appId: "1:48604608508:web:5b387a2de260b9851a6479",
    measurementId: "G-HEC84JXFY2"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// ============================================
// PHASE 6: CENTRALIZED ERROR HANDLING
// ============================================

/**
 * Firebase error messages mapped to user-friendly text
 */
const ERROR_MESSAGES = {
    'auth/email-already-in-use': 'This email is already registered. Please login instead.',
    'auth/invalid-email': 'Please enter a valid email address.',
    'auth/operation-not-allowed': 'This operation is not allowed. Please contact support.',
    'auth/weak-password': 'Password should be at least 6 characters long.',
    'auth/user-disabled': 'This account has been disabled. Please contact support.',
    'auth/user-not-found': 'No account found with this email address.',
    'auth/wrong-password': 'Incorrect password. Please try again.',
    'auth/too-many-requests': 'Too many failed attempts. Please try again later.',
    'auth/network-request-failed': 'Network error. Please check your connection.',
    'permission-denied': 'You don\'t have permission to perform this action.',
    'not-found': 'The requested data was not found.',
    'already-exists': 'This item already exists.',
    'unknown': 'An unexpected error occurred. Please try again.'
};

/**
 * Handle Firebase errors with user-friendly messages
 * @param {Error} error - Firebase error object
 * @param {string} fallbackMessage - Fallback message if error code not found
 */
function handleError(error, fallbackMessage = 'An error occurred') {
    console.error('Firebase error:', error);
    
    const errorCode = error.code || 'unknown';
    const userMessage = ERROR_MESSAGES[errorCode] || fallbackMessage;
    
    if (window.showToast) {
        window.showToast(userMessage, 'danger', 5000);
    } else {
        alert(userMessage);
    }
}

// ============================================
// USER ROLE MANAGEMENT
// ============================================

/**
 * Create user document with role in Firestore
 * @param {Object} user - Firebase user object
 * @param {string} role - User role: 'admin', 'teacher', or 'pupil'
 * @returns {Promise<void>}
 */
async function createUserRoleDocument(user, role = 'pupil') {
    try {
        await db.collection('users').doc(user.uid).set({
            email: user.email,
            role: role,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        console.log(`✓ User role document created: ${role}`);
    } catch (error) {
        console.error('Error creating user role document:', error);
        handleError(error, 'Failed to create user profile');
    }
}

/**
 * Get user role from Firestore
 * @param {string} uid - User ID
 * @returns {Promise<string|null>} User role or null
 */
async function getUserRole(uid) {
    try {
        const doc = await db.collection('users').doc(uid).get();
        if (doc.exists) {
            return doc.data().role || 'pupil';
        }
        return null;
    } catch (error) {
        console.error('Error getting user role:', error);
        return null;
    }
}

/**
 * Check if user has required role
 * @param {string} requiredRole - Required role to access resource
 * @returns {Promise<Object>} Promise resolving to user object
 * @throws {Error} If user doesn't have required role
 */
function checkRole(requiredRole) {
    return new Promise((resolve, reject) => {
        auth.onAuthStateChanged(async (user) => {
            if (!user) {
                if (window.showToast) {
                    window.showToast('Please log in to continue', 'warning');
                }
                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 1500);
                reject(new Error('No user logged in'));
                return;
            }

            try {
                const role = await getUserRole(user.uid);
                
                if (role === requiredRole) {
                    console.log(`✓ Access granted: ${requiredRole}`);
                    resolve(user);
                } else {
                    console.warn(`✕ Access denied: Required ${requiredRole}, has ${role}`);
                    if (window.showToast) {
                        window.showToast('Access denied. You don\'t have permission to view this page.', 'danger');
                    } else {
                        alert('Access denied. Admins only.');
                    }
                    setTimeout(() => {
                        window.location.href = 'index.html';
                    }, 2000);
                    reject(new Error('Insufficient permissions'));
                }
            } catch (error) {
                console.error('Error checking role:', error);
                handleError(error, 'Failed to verify permissions');
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 2000);
                reject(error);
            }
        });
    });
}

// ============================================
// AUTHENTICATION FUNCTIONS
// ============================================

/**
 * Login user with email and password
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Promise<void>}
 */
async function login(email, password) {
    try {
        const credential = await auth.signInWithEmailAndPassword(email, password);
        console.log('✓ Login successful:', credential.user.email);
        
        if (window.showToast) {
            window.showToast('Login successful! Redirecting...', 'success');
        }
        
        // Small delay for better UX
        setTimeout(() => {
            window.location.href = 'portal.html';
        }, 800);
    } catch (error) {
        handleError(error, 'Login failed');
        throw error; // Re-throw for form handlers
    }
}

/**
 * Register new user with email and password
 * @param {string} email - User email
 * @param {string} password - User password
 * @param {string} role - User role: 'teacher' or 'pupil'
 * @returns {Promise<void>}
 */
async function register(email, password, role = 'pupil') {
    try {
        const credential = await auth.createUserWithEmailAndPassword(email, password);
        console.log('✓ Registration successful:', credential.user.email);
        
        // Create user role document
        await createUserRoleDocument(credential.user, role);
        
        if (window.showToast) {
            window.showToast('Registration successful! Please log in.', 'success');
        } else {
            alert('Registration successful! Please log in.');
        }
        
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 1500);
    } catch (error) {
        handleError(error, 'Registration failed');
        throw error; // Re-throw for form handlers
    }
}

/**
 * Logout current user
 * @returns {Promise<void>}
 */
async function logout() {
    try {
        await auth.signOut();
        console.log('✓ Logout successful');
        
        if (window.showToast) {
            window.showToast('Logged out successfully', 'success');
        }
        
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 800);
    } catch (error) {
        handleError(error, 'Logout failed');
    }
}

/**
 * Send password reset email
 * @param {string} email - User email
 * @returns {Promise<void>}
 */
async function resetPassword(email) {
    if (!email) {
        if (window.showToast) {
            window.showToast('Please enter your email address', 'warning');
        }
        return;
    }

    try {
        await auth.sendPasswordResetEmail(email);
        console.log('✓ Password reset email sent to:', email);
        
        if (window.showToast) {
            window.showToast('Password reset email sent! Check your inbox.', 'success', 5000);
        } else {
            alert('Password reset email sent! Check your inbox.');
        }
    } catch (error) {
        handleError(error, 'Failed to send reset email');
    }
}

// ============================================
// AUTH STATE OBSERVER (OPTIONAL ON PUBLIC PAGES)
// ============================================

/**
 * Set up auth state observer for public pages
 * Only runs if user-status element exists
 */
if (document.getElementById('user-status')) {
    auth.onAuthStateChanged(async (user) => {
        const userStatus = document.getElementById('user-status');
        
        if (!userStatus) return;

        if (user) {
            try {
                const role = await getUserRole(user.uid);
                
                userStatus.innerHTML = `
                    <div style="margin-bottom: 15px;">
                        <strong>Welcome back!</strong><br>
                        <small>${user.email}</small><br>
                        <small style="opacity: 0.9;">Role: ${role ? role.charAt(0).toUpperCase() + role.slice(1) : 'User'}</small>
                    </div>
                    <button id="logout-btn" class="btn" style="width: 100%; padding: 12px; border-radius: 30px;">
                        Logout
                    </button>
                `;

                // Attach logout event
                const logoutBtn = document.getElementById('logout-btn');
                if (logoutBtn) {
                    logoutBtn.addEventListener('click', logout);
                }
            } catch (error) {
                console.error('Error fetching user role:', error);
                userStatus.innerHTML = `<a href="login.html" class="btn">Login Issue – Retry</a>`;
            }
        } else {
            // User is signed out - handled by sidebar-login-prompt in HTML
            console.log('User is signed out');
        }
    });
}

// ============================================
// PORTAL PAGE REDIRECTS
// ============================================

/**
 * Check if we're on a portal page and redirect if not authenticated
 */
const portalPages = ['admin.html', 'teacher.html', 'pupil.html', 'portal.html', 'print-results.html'];
const currentPage = window.location.pathname.split('/').pop();

if (portalPages.includes(currentPage)) {
    auth.onAuthStateChanged((user) => {
        if (!user && currentPage !== 'portal.html') {
            if (window.showToast) {
                window.showToast('Please log in to access this page', 'warning');
            }
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 1500);
        }
    });
}

// ============================================
// LOAD ANNOUNCEMENTS (PUBLIC FUNCTION)
// ============================================

/**
 * Load announcements from Firestore (used on news.html)
 * This function is called directly from news.html
 * @returns {Promise<void>}
 */
async function loadAnnouncements() {
    const container = document.getElementById('announcements-container');
    if (!container) return;

    try {
        const snapshot = await db.collection('announcements')
            .orderBy('createdAt', 'desc')
            .get();

        container.innerHTML = '';

        if (snapshot.empty) {
            container.innerHTML = '<p style="text-align:center; color:var(--color-gray-600);">No announcements yet. Check back soon!</p>';
            return;
        }

        snapshot.forEach(doc => {
            const data = doc.data();
            const article = document.createElement('article');
            article.className = 'announcement-card';
            article.style.cssText = 'background: var(--color-white); padding: var(--space-xl); border-radius: var(--radius-lg); box-shadow: var(--shadow-md); margin-bottom: var(--space-xl);';
            
            const title = document.createElement('h2');
            title.textContent = data.title;
            title.style.marginTop = '0';
            
            const content = document.createElement('p');
            content.textContent = data.content;
            
            const date = document.createElement('small');
            date.style.cssText = 'color: var(--color-gray-600); display: block; margin-top: var(--space-sm);';
            date.textContent = `Posted: ${data.createdAt ? new Date(data.createdAt.toDate()).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Just now'}`;
            
            article.appendChild(title);
            article.appendChild(content);
            article.appendChild(date);
            container.appendChild(article);
        });
    } catch (error) {
        console.error('Error loading announcements:', error);
        container.innerHTML = '<p style="text-align:center; color:var(--color-danger);">Unable to load announcements. Please try again later.</p>';
    }
}

// ============================================
// INITIALIZATION LOG
// ============================================

console.log('✓ Firebase initialized successfully');
console.log('Environment:', {
    projectId: firebaseConfig.projectId,
    authDomain: firebaseConfig.authDomain
});