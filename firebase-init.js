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
    if (user) {
        // User is signed in
        db.collection('users').doc(user.uid).get().then(doc => {
            if (doc.exists) {
                const role = doc.data().role;
                if (userStatus) {
                    userStatus.innerHTML = `
                        <span>Welcome, ${user.email} (${role})</span>
                        <button id="logout-btn" class="btn">Logout</button>
                    `;
                }

                // Redirect to portal if on public page and trying to access protected area
                if (window.location.pathname.includes('portal.html')) {
                    // Future phases will check role here
                }
            } else {
                // No role assigned yet (new user) - redirect to login or admin approval
                createUserRoleDocument(user, 'pupil'); // Default fallback - change as needed
            }
        });

        document.getElementById('logout-btn')?.addEventListener('click', logout);
    } else {
        // User is signed out
        if (userStatus) {
            userStatus.innerHTML = `<a href="login.html" class="btn">Login / Register</a>`;
        }
        // If trying to access portal without login
        if (window.location.pathname.includes('portal.html')) {
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