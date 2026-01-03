/**
 * FAHMID NURSERY & PRIMARY SCHOOL
 * Admin Portal JavaScript - FIXED
 * 
 * Handles:
 * - Dashboard statistics
 * - Teacher management (CRUD) with Auth
 * - Pupil management (CRUD) with Auth
 * - Class management (CRUD)
 * - Announcements (CRUD)
 * 
 * @version 2.2.0 - AUTHENTICATION FIX
 * @date 2026-01-03
 */

'use strict';

// ============================================
// INITIALIZATION
// ============================================

// Create secondary Firebase app for user creation (prevents admin logout)
let secondaryApp;
let secondaryAuth;

try {
    secondaryApp = firebase.initializeApp(firebaseConfig, 'Secondary');
    secondaryAuth = secondaryApp.auth();
} catch (error) {
    console.warn('Secondary app already exists or error:', error);
    secondaryApp = firebase.app('Secondary');
    secondaryAuth = secondaryApp.auth();
}

// Enforce admin access
checkRole('admin').catch(() => {
    // Error handling done in checkRole function
});

// Setup logout button
document.getElementById('admin-logout')?.addEventListener('click', (e) => {
    e.preventDefault();
    logout();
});

// ============================================
// NAVIGATION
// ============================================

function showSection(sectionId) {
    document.querySelectorAll('.admin-card').forEach(card => {
        card.style.display = 'none';
    });
    
    const section = document.getElementById(sectionId);
    if (section) {
        section.style.display = 'block';
    }
    
    document.querySelectorAll('.admin-sidebar a').forEach(a => {
        a.classList.remove('active');
    });
    const activeLink = document.querySelector(`.admin-sidebar a[onclick="showSection('${sectionId}')"]`);
    if (activeLink) {
        activeLink.classList.add('active');
    }
    
    switch(sectionId) {
        case 'dashboard':
            loadDashboardStats();
            break;
        case 'teachers':
            loadTeachers();
            break;
        case 'pupils':
            loadPupils();
            break;
        case 'classes':
            loadClasses();
            break;
        case 'announcements':
            loadAdminAnnouncements();
            break;
    }
    
    const sidebar = document.getElementById('admin-sidebar');
    const hamburger = document.getElementById('hamburger');
    if (sidebar && sidebar.classList.contains('active')) {
        sidebar.classList.remove('active');
        if (hamburger) {
            hamburger.classList.remove('active');
        }
    }
}

// ============================================
// DASHBOARD STATISTICS
// ============================================

async function loadDashboardStats() {
    try {
        const [teachersSnap, pupilsSnap, classesSnap, announcementsSnap] = await Promise.all([
            db.collection('teachers').get(),
            db.collection('pupils').get(),
            db.collection('classes').get(),
            db.collection('announcements').get()
        ]);

        document.getElementById('teacher-count').textContent = teachersSnap.size;
        document.getElementById('pupil-count').textContent = pupilsSnap.size;
        document.getElementById('class-count').textContent = classesSnap.size;
        document.getElementById('announce-count').textContent = announcementsSnap.size;
    } catch (error) {
        console.error('Error loading dashboard stats:', error);
        handleError(error, 'Failed to load dashboard statistics');
    }
}

// ============================================
// TEACHERS CRUD - FIXED AUTHENTICATION
// ============================================

function showTeacherForm() {
    const form = document.getElementById('teacher-form');
    if (form) {
        form.style.display = 'block';
        document.getElementById('teacher-name')?.focus();
    }
}

function cancelTeacherForm() {
    document.getElementById('teacher-form').style.display = 'none';
    document.getElementById('add-teacher-form').reset();
}

document.getElementById('add-teacher-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('teacher-name').value.trim();
    const email = document.getElementById('teacher-email').value.trim();
    const subject = document.getElementById('teacher-subject').value.trim();
    const tempPassword = document.getElementById('teacher-password').value;

    if (!name || !email || !tempPassword) {
        window.showToast?.('All required fields must be filled', 'warning');
        return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        window.showToast?.('Please enter a valid email address', 'warning');
        return;
    }

    if (tempPassword.length < 6) {
        window.showToast?.('Password must be at least 6 characters', 'warning');
        return;
    }

    // Show loading
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="btn-loading">Creating teacher...</span>';

    try {
        // Use SECONDARY auth instance to create user (keeps admin logged in)
        const userCredential = await secondaryAuth.createUserWithEmailAndPassword(email, tempPassword);
        const uid = userCredential.user.uid;

        console.log('✓ Teacher auth created with UID:', uid);

        // Save role to 'users' collection
        await db.collection('users').doc(uid).set({
            email,
            role: 'teacher',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Save teacher profile to 'teachers' collection with same UID
        await db.collection('teachers').doc(uid).set({
            name,
            email,
            subject: subject || '',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Sign out the new user from secondary auth
        await secondaryAuth.signOut();

        // Send password reset email using PRIMARY auth
        await auth.sendPasswordResetEmail(email);

        window.showToast?.(`Teacher "${name}" added! Password reset email sent to ${email}.`, 'success', 5000);

        cancelTeacherForm();
        loadTeachers();
        loadDashboardStats();

    } catch (error) {
        console.error('Error adding teacher:', error);
        
        if (error.code === 'auth/email-already-in-use') {
            window.showToast?.('This email is already registered.', 'danger');
        } else if (error.code === 'auth/weak-password') {
            window.showToast?.('Password is too weak. Must be at least 6 characters.', 'danger');
        } else {
            window.showToast?.(`Error: ${error.message}`, 'danger');
        }
    } finally {
        // Reset button
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Save Teacher';
    }
});

async function loadTeachers() {
    const tbody = document.querySelector('#teachers-table tbody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Loading...</td></tr>';

    try {
        const snapshot = await db.collection('teachers').orderBy('name').get();

        tbody.innerHTML = '';

        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--color-gray-600);">No teachers yet</td></tr>';
            return;
        }

        snapshot.forEach(doc => {
            const data = doc.data();
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td data-label="Name">${data.name}</td>
                <td data-label="Email">${data.email}</td>
                <td data-label="Subject">${data.subject || '-'}</td>
                <td data-label="Actions">
                    <button class="btn-small btn-danger" onclick="deleteUser('teachers', '${doc.id}')">Delete</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error('Error loading teachers:', error);
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--color-danger);">Error loading data</td></tr>';
    }
}

// ============================================
// PUPILS CRUD - FIXED AUTHENTICATION
// ============================================

function showPupilForm() {
    const form = document.getElementById('pupil-form');
    if (form) {
        form.style.display = 'block';
        document.getElementById('pupil-name')?.focus();
    }
}

function cancelPupilForm() {
    document.getElementById('pupil-form').style.display = 'none';
    document.getElementById('add-pupil-form').reset();
}

document.getElementById('add-pupil-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('pupil-name').value.trim();
    const pupilClass = document.getElementById('pupil-class').value.trim();
    const parentEmail = document.getElementById('pupil-parent').value.trim();
    const email = document.getElementById('pupil-email').value.trim();
    const tempPassword = document.getElementById('pupil-password').value;

    if (!name || !pupilClass || !email || !tempPassword) {
        window.showToast?.('All required fields must be filled', 'warning');
        return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        window.showToast?.('Please enter a valid email address for pupil login', 'warning');
        return;
    }

    if (parentEmail && !emailRegex.test(parentEmail)) {
        window.showToast?.('Please enter a valid parent email address', 'warning');
        return;
    }

    if (tempPassword.length < 6) {
        window.showToast?.('Password must be at least 6 characters', 'warning');
        return;
    }

    // Show loading
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="btn-loading">Creating pupil...</span>';

    try {
        // Use SECONDARY auth instance
        const userCredential = await secondaryAuth.createUserWithEmailAndPassword(email, tempPassword);
        const uid = userCredential.user.uid;

        console.log('✓ Pupil auth created with UID:', uid);

        // Save role to 'users' collection
        await db.collection('users').doc(uid).set({
            email,
            role: 'pupil',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Save pupil profile to 'pupils' collection with same UID (IMPORTANT!)
        await db.collection('pupils').doc(uid).set({
            name,
            email,
            class: pupilClass,
            parentEmail: parentEmail || '',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Sign out from secondary auth
        await secondaryAuth.signOut();

        // Send password reset email
        await auth.sendPasswordResetEmail(email);

        window.showToast?.(`Pupil "${name}" added! Password reset email sent to ${email}.`, 'success', 5000);

        cancelPupilForm();
        loadPupils();
        loadDashboardStats();

    } catch (error) {
        console.error('Error adding pupil:', error);
        
        if (error.code === 'auth/email-already-in-use') {
            window.showToast?.('This email is already in use.', 'danger');
        } else if (error.code === 'auth/weak-password') {
            window.showToast?.('Password is too weak.', 'danger');
        } else {
            window.showToast?.(`Error: ${error.message}`, 'danger');
        }
    } finally {
        // Reset button
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Save Pupil';
    }
});

async function loadPupils() {
    const tbody = document.querySelector('#pupils-table tbody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Loading...</td></tr>';

    try {
        const snapshot = await db.collection('pupils').orderBy('name').get();

        tbody.innerHTML = '';

        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--color-gray-600);">No pupils yet</td></tr>';
            return;
        }

        snapshot.forEach(doc => {
            const data = doc.data();
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td data-label="Name">${data.name}</td>
                <td data-label="Class">${data.class || '-'}</td>
                <td data-label="Parent Email">${data.parentEmail || '-'}</td>
                <td data-label="Email">${data.email}</td>
                <td data-label="Actions">
                    <button class="btn-small btn-danger" onclick="deleteUser('pupils', '${doc.id}')">Delete</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error('Error loading pupils:', error);
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--color-danger);">Error loading data</td></tr>';
    }
}

// ============================================
// DELETE USER (TEACHERS/PUPILS)
// ============================================

async function deleteUser(collection, uid) {
    if (!confirm('Are you sure you want to delete this user? This cannot be undone.')) return;

    try {
        // Delete profile from collection
        await db.collection(collection).doc(uid).delete();

        // Delete role from 'users'
        await db.collection('users').doc(uid).delete();

        // Note: Firebase Auth user deletion requires Admin SDK or Cloud Function
        // For now, we just delete Firestore data
        window.showToast?.('User profile deleted. Note: Auth account still exists but cannot access portal.', 'success', 5000);
        
        if (collection === 'teachers') {
            loadTeachers();
        } else if (collection === 'pupils') {
            loadPupils();
        }
        loadDashboardStats();
    } catch (error) {
        console.error('Error deleting user:', error);
        window.showToast?.('Error deleting user', 'danger');
    }
}

// ============================================
// CLASSES CRUD
// ============================================

function showClassForm() {
    const form = document.getElementById('class-form');
    if (form) {
        form.style.display = 'block';
        document.getElementById('class-name')?.focus();
    }
}

async function addClass() {
    const className = document.getElementById('class-name')?.value.trim();

    if (!className) {
        window.showToast?.('Class name is required', 'warning');
        return;
    }

    try {
        const existingSnap = await db.collection('classes').where('name', '==', className).get();
        
        if (!existingSnap.empty) {
            window.showToast?.('This class already exists', 'warning');
            return;
        }

        await db.collection('classes').add({
            name: className,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        window.showToast?.('Class created successfully', 'success');
        
        document.getElementById('class-form').style.display = 'none';
        document.getElementById('class-name').value = '';
        
        loadClasses();
        loadDashboardStats();
    } catch (error) {
        console.error('Error adding class:', error);
        handleError(error, 'Failed to create class');
    }
}

async function loadClasses() {
    const tbody = document.querySelector('#classes-table tbody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">Loading...</td></tr>';

    try {
        const snapshot = await db.collection('classes').orderBy('name').get();
        
        tbody.innerHTML = '';
        
        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:var(--color-gray-600);">No classes yet</td></tr>';
            return;
        }

        for (let doc of snapshot.docs) {
            const classData = doc.data();
            
            const pupilsSnap = await db.collection('pupils')
                .where('class', '==', classData.name)
                .get();

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td data-label="Class Name">${classData.name}</td>
                <td data-label="Pupil Count">${pupilsSnap.size}</td>
                <td data-label="Actions">
                    <button class="btn-small btn-danger" onclick="deleteDoc('classes', '${doc.id}')">Delete</button>
                </td>
            `;
            tbody.appendChild(tr);
        }
    } catch (error) {
        console.error('Error loading classes:', error);
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:var(--color-danger);">Error loading classes</td></tr>';
    }
}

// ============================================
// ANNOUNCEMENTS CRUD
// ============================================

function showAnnounceForm() {
    const form = document.getElementById('announce-form');
    if (form) {
        form.style.display = 'block';
        document.getElementById('announce-title')?.focus();
    }
}

async function addAnnouncement() {
    const title = document.getElementById('announce-title')?.value.trim();
    const content = document.getElementById('announce-content')?.value.trim();

    if (!title || !content) {
        window.showToast?.('Title and content are required', 'warning');
        return;
    }

    try {
        await db.collection('announcements').add({
            title,
            content,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        window.showToast?.('Announcement published successfully', 'success');
        
        document.getElementById('announce-form').style.display = 'none';
        document.getElementById('announce-title').value = '';
        document.getElementById('announce-content').value = '';
        
        loadAdminAnnouncements();
        loadDashboardStats();
    } catch (error) {
        console.error('Error adding announcement:', error);
        handleError(error, 'Failed to publish announcement');
    }
}

async function loadAdminAnnouncements() {
    const list = document.getElementById('announcements-list');
    if (!list) return;

    list.innerHTML = '<div class="skeleton-container"><div class="skeleton" style="height: 30px; margin-bottom: var(--space-md);"></div></div>';

    try {
        const snapshot = await db.collection('announcements')
            .orderBy('createdAt', 'desc')
            .get();

        list.innerHTML = '';

        if (snapshot.empty) {
            list.innerHTML = '<p style="text-align:center; color:var(--color-gray-600);">No announcements yet.</p>';
            return;
        }

        snapshot.forEach(doc => {
            const data = doc.data();
            const div = document.createElement('div');
            div.className = 'admin-card';
            div.style.marginBottom = '20px';
            div.innerHTML = `
                <h3 style="margin-top: 0;">${data.title}</h3>
                <p>${data.content}</p>
                <small style="color: var(--color-gray-600);">Posted: ${data.createdAt ? new Date(data.createdAt.toDate()).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Just now'}</small>
                <div style="margin-top: var(--space-md);">
                    <button class="btn-small btn-danger" onclick="deleteDoc('announcements', '${doc.id}')">Delete</button>
                </div>
            `;
            list.appendChild(div);
        });
    } catch (error) {
        console.error('Error loading announcements:', error);
        list.innerHTML = '<p style="text-align:center; color:var(--color-danger);">Error loading announcements</p>';
    }
}

// ============================================
// GENERIC DELETE
// ============================================

async function deleteDoc(collectionName, docId) {
    if (!confirm('Are you sure you want to delete this item? This action cannot be undone.')) {
        return;
    }

    try {
        await db.collection(collectionName).doc(docId).delete();
        
        window.showToast?.('Item deleted successfully', 'success');
        
        loadDashboardStats();
        
        switch(collectionName) {
            case 'classes':
                loadClasses();
                break;
            case 'announcements':
                loadAdminAnnouncements();
                break;
        }
    } catch (error) {
        console.error('Error deleting document:', error);
        handleError(error, 'Failed to delete item');
    }
}

// ============================================
// PAGE LOAD
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    loadDashboardStats();
    console.log('✓ Admin portal initialized with secondary auth');
});