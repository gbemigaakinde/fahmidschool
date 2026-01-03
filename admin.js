/**
 * FAHMID NURSERY & PRIMARY SCHOOL
 * Admin Portal JavaScript
 * Phases 4-7 Complete
 * 
 * Handles:
 * - Dashboard statistics
 * - Teacher management (CRUD)
 * - Pupil management (CRUD)
 * - Class management (CRUD)
 * - Announcements (CRUD)
 * 
 * @version 2.0.0
 * @date 2026-01-03
 */

'use strict';

// ============================================
// INITIALIZATION
// ============================================

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

/**
 * Show specific admin section
 * @param {string} sectionId - Section ID to display
 */
function showSection(sectionId) {
    // Hide all sections
    document.querySelectorAll('.admin-card').forEach(card => {
        card.style.display = 'none';
    });
    
    // Show selected section
    const section = document.getElementById(sectionId);
    if (section) {
        section.style.display = 'block';
    }
    
    // Update active nav link
    document.querySelectorAll('.admin-sidebar a').forEach(a => {
        a.classList.remove('active');
    });
    const activeLink = document.querySelector(`.admin-sidebar a[onclick="showSection('${sectionId}')"]`);
    if (activeLink) {
        activeLink.classList.add('active');
    }
    
    // Load section-specific data
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
    
    // Close mobile sidebar if open
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

/**
 * Load dashboard statistics
 * @async
 */
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
/**
 * Show teacher form
 */
// ============================================
// TEACHERS CRUD - NOW WITH AUTH + TEMP PASSWORD
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

// Attach submit handler when DOM is ready
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

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        window.showToast?.('Please enter a valid email address', 'warning');
        return;
    }

    try {
        // 1. Create Firebase Auth user
        const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, tempPassword);
        const uid = userCredential.user.uid;

        // 2. Save teacher profile to Firestore under 'users' collection
        await db.collection('users').doc(uid).set({
            name,
            email,
            subject: subject || '',
            role: 'teacher',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // 3. Send password reset email (so they must change it on first login)
        await firebase.auth().sendPasswordResetEmail(email);

        window.showToast?.(`Teacher "${name}" added successfully! Password reset email sent.`, 'success');

        // Reset and hide form
        cancelTeacherForm();

        // Reload data
        loadTeachers();
        loadDashboardStats();

    } catch (error) {
        console.error('Error adding teacher:', error);
        if (error.code === 'auth/email-already-in-use') {
            window.showToast?.('This email is already registered.', 'danger');
        } else {
            window.showToast?.(`Error: ${error.message}`, 'danger');
        }
    }
});

/**
 * Load teachers from 'users' collection where role === 'teacher'
 */
async function loadTeachers() {
    const tbody = document.querySelector('#teachers-table tbody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Loading...</td></tr>';

    try {
        const snapshot = await db.collection('users')
            .where('role', '==', 'teacher')
            .orderBy('name')
            .get();

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
                    <button class="btn-small btn-danger" onclick="deleteUser('${doc.id}')">Delete</button>
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
// PUPILS CRUD - FIXED & IMPROVED
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

// Attach submit handler for pupil form
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
        window.showToast?.('Please enter a valid email address', 'warning');
        return;
    }

    try {
        // 1. Create Auth user
        const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, tempPassword);
        const uid = userCredential.user.uid;

        // 2. Save pupil data
        await db.collection('users').doc(uid).set({
            name,
            email,
            class: pupilClass,
            parentEmail: parentEmail || '',
            role: 'pupil',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // 3. Send password reset email
        await firebase.auth().sendPasswordResetEmail(email);

        window.showToast?.(`Pupil "${name}" added! Login credentials sent to ${email}`, 'success');

        cancelPupilForm();
        loadPupils();
        loadDashboardStats();

    } catch (error) {
        console.error('Error adding pupil:', error);
        if (error.code === 'auth/email-already-in-use') {
            window.showToast?.('This email is already in use.', 'danger');
        } else {
            window.showToast?.(`Error: ${error.message}`, 'danger');
        }
    }
});

/**
 * Load pupils from 'users' collection where role === 'pupil'
 */
async function loadPupils() {
    const tbody = document.querySelector('#pupils-table tbody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Loading...</td></tr>';

    try {
        const snapshot = await db.collection('users')
            .where('role', '==', 'pupil')
            .orderBy('name')
            .get();

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
                    <button class="btn-small btn-danger" onclick="deleteUser('${doc.id}')">Delete</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error('Error loading pupils:', error);
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--color-danger);">Error loading data</td></tr>';
    }
}

// Optional: Generic delete function for users
async function deleteUser(uid) {
    if (!confirm('Are you sure you want to delete this user? This cannot be undone.')) return;

    try {
        // Delete Auth user (requires Firebase Admin SDK on server - or reauthenticate)
        // For client-side, you can only delete if current user, so we just delete Firestore doc
        await db.collection('users').doc(uid).delete();

        // Note: To fully delete Auth user, use Cloud Function triggered on Firestore delete
        window.showToast?.('User profile deleted', 'success');
        loadTeachers();
        loadPupils();
        loadDashboardStats();
    } catch (error) {
        console.error('Error deleting user:', error);
        window.showToast?.('Error deleting user profile', 'danger');
    }
}
// ============================================
// CLASSES CRUD
// ============================================

/**
 * Show class form
 */
function showClassForm() {
    const form = document.getElementById('class-form');
    if (form) {
        form.style.display = 'block';
        document.getElementById('class-name')?.focus();
    }
}

/**
 * Add new class to Firestore
 * @async
 */
async function addClass() {
    const className = document.getElementById('class-name')?.value.trim();

    if (!className) {
        window.showToast?.('Class name is required', 'warning');
        return;
    }

    try {
        // Check if class already exists
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
        
        // Reset form
        document.getElementById('class-form').style.display = 'none';
        document.getElementById('class-name').value = '';
        
        // Reload data
        loadClasses();
        loadDashboardStats();
    } catch (error) {
        console.error('Error adding class:', error);
        handleError(error, 'Failed to create class');
    }
}

/**
 * Load classes list from Firestore
 * @async
 */
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
            
            // Count pupils in this class
            const pupilsSnap = await db.collection('pupils')
                .where('class', '==', classData.name).get();

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

/**
 * Show announcement form
 */
function showAnnounceForm() {
    const form = document.getElementById('announce-form');
    if (form) {
        form.style.display = 'block';
        document.getElementById('announce-title')?.focus();
    }
}

/**
 * Add new announcement to Firestore
 * @async
 */
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
        
        // Reset form
        document.getElementById('announce-form').style.display = 'none';
        document.getElementById('announce-title').value = '';
        document.getElementById('announce-content').value = '';
        
        // Reload data
        loadAdminAnnouncements();
        loadDashboardStats();
    } catch (error) {
        console.error('Error adding announcement:', error);
        handleError(error, 'Failed to publish announcement');
    }
}

/**
 * Load announcements list for admin
 * @async
 */
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
// GENERIC DELETE FUNCTION
// ============================================

/**
 * Delete document from Firestore collection
 * @async
 * @param {string} collectionName - Firestore collection name
 * @param {string} docId - Document ID to delete
 */
async function deleteDoc(collectionName, docId) {
    if (!confirm('Are you sure you want to delete this item? This action cannot be undone.')) {
        return;
    }

    try {
        await db.collection(collectionName).doc(docId).delete();
        
        window.showToast?.('Item deleted successfully', 'success');
        
        // Reload appropriate section
        loadDashboardStats();
        
        switch(collectionName) {
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
    } catch (error) {
        console.error('Error deleting document:', error);
        handleError(error, 'Failed to delete item');
    }
}

// ============================================
// PAGE LOAD
// ============================================

// Load dashboard stats on page load
document.addEventListener('DOMContentLoaded', () => {
    loadDashboardStats();
    console.log('✓ Admin portal initialized');
});
