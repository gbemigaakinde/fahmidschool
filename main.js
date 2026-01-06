const loginForm = document.getElementById('login-form');

loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value.trim();

    if (!email || !password) {
        showToast('Please enter both email and password.', 'warning', 4000);
        return;
    }

    try {
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        showToast('Login successful! Redirecting...', 'success', 3000);
        // redirect user to dashboard after 1s
        setTimeout(() => window.location.href = '/dashboard.html', 1000);
    } catch (error) {
        console.error('Firebase login error:', error);

        // Map Firebase error codes to friendly messages
        const messages = {
            'auth/wrong-password': 'Incorrect password. Try again.',
            'auth/user-not-found': 'No account found with this email.',
            'auth/invalid-email': 'Invalid email address.',
            'auth/user-disabled': 'This account has been disabled.'
        };

        showToast(messages[error.code] || 'Login failed. Please try again.', 'danger', 5000);
    }
});
