// firebase-init.js - Firebase Configuration and Authentication Logic

// REPLACE WITH YOUR OWN FIREBASE CONFIG FROM CONSOLE
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

// Auth state observer - runs on every page load
auth.onAuthStateChanged(user => {
    const userStatus = document.getElementById('user-status');
    
    if (!userStatus) return; // Safety check if element not found

    if (user) {
        // User is signed in
        db.collection('users').doc(user.uid).get().then(doc => {
            let role = 'pupil'; // default
            if (doc.exists) {
                role = doc.data().role || 'pupil';
            } else {
                // Create default role if missing
                createUserRoleDocument(user, 'pupil');
            }

            userStatus.innerHTML = `
                <div style="margin-bottom: 15px;">
                    <strong>Welcome back!</strong><br>
                    <small>${user.email}</small><br>
                    <small style="opacity: 0.9;">Role: ${role.charAt(0).toUpperCase() + role.slice(1)}</small>
                </div>
                <button id="logout-btn" class="btn" style="width: 100%; padding: 12px; border-radius: 30px;">
                    Logout
                </button>
            `;

            // Attach logout event (after HTML is inserted)
            const logoutBtn = document.getElementById('logout-btn');
            if (logoutBtn) {
                logoutBtn.addEventListener('click', () => {
                    auth.signOut().then(() => {
                        window.location.href = 'index.html';
                    });
                });
            }
        }).catch(err => {
            console.error("Error fetching user role:", err);
            userStatus.innerHTML = `<a href="login.html" class="btn">Login Issue – Retry</a>`;
        });

    } else {
        // User is signed out
        userStatus.innerHTML = `
            <a href="login.html" class="btn" style="width: 100%; padding: 15px; border-radius: 30px; font-size: 1.1rem; display: block; text-align: center;">
                Login / Register
            </a>
        `;
    }

    // Optional: Redirect logic for portal pages
    if (window.location.pathname.includes('portal.html') || 
        window.location.pathname.includes('admin.html') || 
        window.location.pathname.includes('teacher.html') || 
        window.location.pathname.includes('pupil.html')) {
        if (!user) {
            window.location.href = 'login.html';
        }
    }
});

// Helper: Create user document with role
function createUserRoleDocument(user, role = 'pupil') {
    db.collection('users').doc(user.uid).set({
        email: user.email,
        role: role,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }).catch(error => console.error("Error adding user role: ", error));
}

// Login function
function login(email, password) {
    auth.signInWithEmailAndPassword(email, password)
        .then(cred => {
            window.location.href = 'portal.html'; // Redirect to role-based portal
        })
        .catch(err => alert('Login failed: ' + err.message));
}

// Register function
function register(email, password, role = 'pupil') {
    auth.createUserWithEmailAndPassword(email, password)
        .then(cred => {
            // Create user document with role
            createUserRoleDocument(cred.user, role);
            alert('Registration successful! Please log in.');
            window.location.href = 'login.html';
        })
        .catch(err => alert('Registration failed: ' + err.message));
}

// Logout
function logout() {
    auth.signOut().then(() => {
        window.location.href = 'index.html';
    });
}

// Password reset
function resetPassword(email) {
    auth.sendPasswordResetEmail(email)
        .then(() => alert('Password reset email sent!'))
        .catch(err => alert('Error: ' + err.message));
}
// Role check utility
function checkRole(requiredRole) {
    return new Promise((resolve, reject) => {
        auth.onAuthStateChanged(user => {
            if (!user) {
                window.location.href = 'login.html';
                reject('No user');
                return;
            }
            db.collection('users').doc(user.uid).get().then(doc => {
                if (doc.exists && doc.data().role === requiredRole) {
                    resolve(user);
                } else {
                    alert('Access denied. Admins only.');
                    window.location.href = 'index.html';
                    reject('Insufficient permissions');
                }
            });
        });
    });
}

// Load announcements to public news page (used later)
function loadAnnouncements() {
    const container = document.getElementById('announcements-container');
    if (!container) return;
    container.innerHTML = '<h2>Loading announcements...</h2>';
    
    db.collection('announcements')
        .orderBy('createdAt', 'desc')
        .get()
        .then(snapshot => {
            container.innerHTML = '';
            if (snapshot.empty) {
                container.innerHTML = '<p>No announcements yet.</p>';
                return;
            }
            snapshot.forEach(doc => {
                const data = doc.data();
                const article = document.createElement('article');
                article.innerHTML = `
                    <h2>${data.title}</h2>
                    <p>${data.content}</p>
                    <small>Posted: ${new Date(data.createdAt.toDate()).toLocaleDateString()}</small>
                `;
                container.appendChild(article);
            });
        });
}