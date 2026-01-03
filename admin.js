/**
 * FAHMID NURSERY & PRIMARY SCHOOL
 * Admin Portal JavaScript - ORDERBY FIX
 * 
 * @version 3.1.0 - REMOVED ORDERBY DEPENDENCY
 * @date 2026-01-03
 */

'use strict';

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

checkRole('admin').catch(() => {});

document.getElementById('admin-logout')?.addEventListener('click', (e) => {
    e.preventDefault();
    logout();
});

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
        case 'subjects':
            loadSubjects();
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

    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="btn-loading">Creating teacher...</span>';

    try {
        const userCredential = await secondaryAuth.createUserWithEmailAndPassword(email, tempPassword);
        const uid = userCredential.user.uid;

        await db.collection('users').doc(uid).set({
            email,
            role: 'teacher',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        await db.collection('teachers').doc(uid).set({
            name,
            email,
            subject: subject || '',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        await secondaryAuth.signOut();
        await auth.sendPasswordResetEmail(email);

        window.showToast?.(`Teacher "${name}" added! Password reset email sent.`, 'success', 5000);

        cancelTeacherForm();
        loadTeachers();
        loadDashboardStats();

    } catch (error) {
        console.error('Error adding teacher:', error);
        
        if (error.code === 'auth/email-already-in-use') {
            window.showToast?.('This email is already registered.', 'danger');
        } else {
            window.showToast?.(`Error: ${error.message}`, 'danger');
        }
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Save Teacher';
    }
});

async function loadTeachers() {
    const tbody = document.querySelector('#teachers-table tbody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Loading...</td></tr>';

    try {
        // Removed .orderBy() - sort in JavaScript
        const snapshot = await db.collection('teachers').get();

        tbody.innerHTML = '';

        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--color-gray-600);">No teachers yet</td></tr>';
            return;
        }

        // Sort by name in JavaScript
        const teachers = [];
        snapshot.forEach(doc => {
            teachers.push({ id: doc.id, data: doc.data() });
        });
        teachers.sort((a, b) => a.data.name.localeCompare(b.data.name));

        teachers.forEach(teacher => {
            const data = teacher.data;
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td data-label="Name">${data.name}</td>
                <td data-label="Email">${data.email}</td>
                <td data-label="Subject">${data.subject || '-'}</td>
                <td data-label="Actions">
                    <button class="btn-small btn-danger" onclick="deleteUser('teachers', '${teacher.id}')">Delete</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error('Error loading teachers:', error);
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--color-danger);">Error loading data</td></tr>';
    }
}

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
    const admissionNo = document.getElementById('pupil-admission').value.trim();
    const gender = document.getElementById('pupil-gender').value;
    const pupilClass = document.getElementById('pupil-class').value.trim();
    const parentEmail = document.getElementById('pupil-parent').value.trim();
    const email = document.getElementById('pupil-email').value.trim();
    const tempPassword = document.getElementById('pupil-password').value;

    if (!name || !gender || !pupilClass || !email || !tempPassword) {
        window.showToast?.('All required fields must be filled', 'warning');
        return;
    }

    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="btn-loading">Creating pupil...</span>';

    try {
        const userCredential = await secondaryAuth.createUserWithEmailAndPassword(email, tempPassword);
        const uid = userCredential.user.uid;

        await db.collection('users').doc(uid).set({
            email,
            role: 'pupil',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        await db.collection('pupils').doc(uid).set({
            name,
            admissionNo: admissionNo || '',
            gender,
            email,
            class: pupilClass,
            parentEmail: parentEmail || '',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        await secondaryAuth.signOut();
        await auth.sendPasswordResetEmail(email);

        window.showToast?.(`Pupil "${name}" added! Password reset email sent.`, 'success', 5000);

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
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Save Pupil';
    }
});

async function loadPupils() {
    const tbody = document.querySelector('#pupils-table tbody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Loading...</td></tr>';

    try {
        // Removed .orderBy() - sort in JavaScript
        const snapshot = await db.collection('pupils').get();

        tbody.innerHTML = '';

        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--color-gray-600);">No pupils yet</td></tr>';
            return;
        }

        // Sort by name in JavaScript
        const pupils = [];
        snapshot.forEach(doc => {
            pupils.push({ id: doc.id, data: doc.data() });
        });
        pupils.sort((a, b) => a.data.name.localeCompare(b.data.name));

        pupils.forEach(pupil => {
            const data = pupil.data;
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td data-label="Name">${data.name}</td>
                <td data-label="Class">${data.class || '-'}</td>
                <td data-label="Parent Email">${data.parentEmail || '-'}</td>
                <td data-label="Email">${data.email}</td>
                <td data-label="Actions">
                    <button class="btn-small btn-danger" onclick="deleteUser('pupils', '${pupil.id}')">Delete</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error('Error loading pupils:', error);
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--color-danger);">Error loading data</td></tr>';
    }
}

async function deleteUser(collection, uid) {
    if (!confirm('Are you sure you want to delete this user? This cannot be undone.')) return;

    try {
        await db.collection(collection).doc(uid).delete();
        await db.collection('users').doc(uid).delete();

        window.showToast?.('User profile deleted successfully.', 'success');
        
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
        // Removed .orderBy() - sort in JavaScript
        const snapshot = await db.collection('classes').get();
        
        tbody.innerHTML = '';
        
        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:var(--color-gray-600);">No classes yet</td></tr>';
            return;
        }

        // Sort by name in JavaScript
        const classes = [];
        for (let doc of snapshot.docs) {
            const classData = doc.data();
            
            const pupilsSnap = await db.collection('pupils')
                .where('class', '==', classData.name)
                .get();

            classes.push({
                id: doc.id,
                name: classData.name,
                pupilCount: pupilsSnap.size
            });
        }
        
        classes.sort((a, b) => a.name.localeCompare(b.name));

        classes.forEach(classItem => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td data-label="Class Name">${classItem.name}</td>
                <td data-label="Pupil Count">${classItem.pupilCount}</td>
                <td data-label="Actions">
                    <button class="btn-small btn-danger" onclick="deleteDoc('classes', '${classItem.id}')">Delete</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error('Error loading classes:', error);
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:var(--color-danger);">Error loading classes</td></tr>';
    }
}

function showSubjectForm() {
    const form = document.getElementById('subject-form');
    if (form) {
        form.style.display = 'block';
        document.getElementById('subject-name')?.focus();
    }
}

async function addSubject() {
    const subjectName = document.getElementById('subject-name')?.value.trim();

    if (!subjectName) {
        window.showToast?.('Subject name is required', 'warning');
        return;
    }

    try {
        const existingSnap = await db.collection('subjects').where('name', '==', subjectName).get();
        
        if (!existingSnap.empty) {
            window.showToast?.('This subject already exists', 'warning');
            return;
        }

        await db.collection('subjects').add({
            name: subjectName,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        window.showToast?.('Subject created successfully', 'success');
        
        document.getElementById('subject-form').style.display = 'none';
        document.getElementById('subject-name').value = '';
        
        loadSubjects();
    } catch (error) {
        console.error('Error adding subject:', error);
        handleError(error, 'Failed to create subject');
    }
}

async function loadSubjects() {
    const tbody = document.querySelector('#subjects-table tbody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="2" style="text-align:center;">Loading...</td></tr>';

    try {
        // Removed .orderBy() - sort in JavaScript
        const snapshot = await db.collection('subjects').get();
        
        tbody.innerHTML = '';
        
        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="2" style="text-align:center; color:var(--color-gray-600);">No subjects yet</td></tr>';
            return;
        }

        // Sort by name in JavaScript
        const subjects = [];
        snapshot.forEach(doc => {
            subjects.push({ id: doc.id, data: doc.data() });
        });
        subjects.sort((a, b) => a.data.name.localeCompare(b.data.name));

        subjects.forEach(subject => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td data-label="Subject Name">${subject.data.name}</td>
                <td data-label="Actions">
                    <button class="btn-small btn-danger" onclick="deleteDoc('subjects', '${subject.id}')">Delete</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error('Error loading subjects:', error);
        tbody.innerHTML = '<tr><td colspan="2" style="text-align:center; color:var(--color-danger);">Error loading subjects</td></tr>';
    }
}

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
        // Get all announcements and sort in JavaScript
        const snapshot = await db.collection('announcements').get();

        list.innerHTML = '';

        if (snapshot.empty) {
            list.innerHTML = '<p style="text-align:center; color:var(--color-gray-600);">No announcements yet.</p>';
            return;
        }

        const announcements = [];
        snapshot.forEach(doc => {
            announcements.push({ id: doc.id, data: doc.data() });
        });

        // Sort by createdAt in JavaScript
        announcements.sort((a, b) => {
            const aTime = a.data.createdAt?.toMillis() || 0;
            const bTime = b.data.createdAt?.toMillis() || 0;
            return bTime - aTime;
        });

        announcements.forEach(announcement => {
            const data = announcement.data;
            const div = document.createElement('div');
            div.className = 'admin-card';
            div.style.marginBottom = '20px';
            div.innerHTML = `
                <h3 style="margin-top: 0;">${data.title}</h3>
                <p>${data.content}</p>
                <small style="color: var(--color-gray-600);">Posted: ${data.createdAt ? new Date(data.createdAt.toDate()).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Just now'}</small>
                <div style="margin-top: var(--space-md);">
                    <button class="btn-small btn-danger" onclick="deleteDoc('announcements', '${announcement.id}')">Delete</button>
                </div>
            `;
            list.appendChild(div);
        });
    } catch (error) {
        console.error('Error loading announcements:', error);
        list.innerHTML = '<p style="text-align:center; color:var(--color-danger);">Error loading announcements</p>';
    }
}

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
            case 'subjects':
                loadSubjects();
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

document.addEventListener('DOMContentLoaded', () => {
    loadDashboardStats();
    console.log('✓ Admin portal initialized');
});