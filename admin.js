/**
 * FAHMID NURSERY & PRIMARY SCHOOL
 * Admin Portal JavaScript - FULLY UPDATED WITH TEACHER ASSIGNMENT + FIXES
 * 
 * @version 4.1.0 - ADDED ERROR TOASTS & BETTER FEEDBACK
 * @date 2026-01-05
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
    
    // Load data for the new section
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
        case 'assign-teachers':
            loadTeacherAssignments();
            break;
        case 'announcements':
            loadAdminAnnouncements();
            break;
        case 'settings':
            loadCurrentSettings();
            break;
    }
    
    // Close mobile sidebar after navigation
    const sidebar = document.getElementById('admin-sidebar');
    const hamburger = document.getElementById('hamburger');
    if (sidebar && sidebar.classList.contains('active')) {
        sidebar.classList.remove('active');
        if (hamburger) {
            hamburger.classList.remove('active');
            hamburger.setAttribute('aria-expanded', 'false');
        }
        document.body.style.overflow = '';
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
        window.showToast?.('Failed to load dashboard statistics. Please refresh.', 'danger');
        // Set to 0 as fallback
        document.getElementById('teacher-count').textContent = '0';
        document.getElementById('pupil-count').textContent = '0';
        document.getElementById('class-count').textContent = '0';
        document.getElementById('announce-count').textContent = '0';
    }
}

/* ========================================
   TEACHERS MANAGEMENT
   ======================================== */

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

        window.showToast?.(`Teacher "${name}" added! Password reset email sent.`, 'success', 6000);

        cancelTeacherForm();
        loadTeachers();
        loadDashboardStats();

    } catch (error) {
        console.error('Error adding teacher:', error);
        handleError(error, 'Failed to add teacher');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Save Teacher';
    }
});

async function loadTeachers() {
    const tbody = document.querySelector('#teachers-table tbody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="4" class="table-loading">Loading teachers...</td></tr>';

    try {
        const snapshot = await db.collection('teachers').get();

        tbody.innerHTML = '';

        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--color-gray-600);">No teachers registered yet. Add one above.</td></tr>';
            return;
        }

        const teachers = [];
        snapshot.forEach(doc => {
            teachers.push({ id: doc.id, ...doc.data() });
        });

        teachers.sort((a, b) => a.name.localeCompare(b.name));

        teachers.forEach(teacher => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td data-label="Name">${teacher.name}</td>
                <td data-label="Email">${teacher.email}</td>
                <td data-label="Subject">${teacher.subject || '-'}</td>
                <td data-label="Actions">
                    <button class="btn-small btn-danger" onclick="deleteUser('teachers', '${teacher.id}')">Delete</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error('Error loading teachers:', error);
        window.showToast?.('Failed to load teachers list. Check connection and try again.', 'danger');
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--color-danger);">Error loading teachers - please refresh</td></tr>';
    }
}

/* ========================================
   PUPILS MANAGEMENT
   ======================================== */

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

        window.showToast?.(`Pupil "${name}" added! Password reset email sent.`, 'success', 6000);

        cancelPupilForm();
        loadPupils();
        loadDashboardStats();

    } catch (error) {
        console.error('Error adding pupil:', error);
        handleError(error, 'Failed to add pupil');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Save Pupil';
    }
});

async function loadPupils() {
    const tbody = document.querySelector('#pupils-table tbody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="5" class="table-loading">Loading pupils...</td></tr>';

    try {
        const snapshot = await db.collection('pupils').get();

        tbody.innerHTML = '';

        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--color-gray-600);">No pupils registered yet. Add one above.</td></tr>';
            return;
        }

        const pupils = [];
        snapshot.forEach(doc => {
            pupils.push({ id: doc.id, ...doc.data() });
        });

        pupils.sort((a, b) => a.name.localeCompare(b.name));

        pupils.forEach(pupil => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td data-label="Name">${pupil.name}</td>
                <td data-label="Class">${pupil.class || '-'}</td>
                <td data-label="Parent Email">${pupil.parentEmail || '-'}</td>
                <td data-label="Email">${pupil.email}</td>
                <td data-label="Actions">
                    <button class="btn-small btn-danger" onclick="deleteUser('pupils', '${pupil.id}')">Delete</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error('Error loading pupils:', error);
        window.showToast?.('Failed to load pupils list. Check connection and try again.', 'danger');
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--color-danger);">Error loading pupils - please refresh</td></tr>';
    }
}

/* ========================================
   CLASSES MANAGEMENT
   ======================================== */

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

    tbody.innerHTML = '<tr><td colspan="3" class="table-loading">Loading classes...</td></tr>';

    try {
        const classesSnap = await db.collection('classes').get();
        const pupilsSnap = await db.collection('pupils').get();

        const pupilCountMap = {};
        pupilsSnap.forEach(pupilDoc => {
            const className = pupilDoc.data().class;
            if (className) {
                pupilCountMap[className] = (pupilCountMap[className] || 0) + 1;
            }
        });

        tbody.innerHTML = '';

        if (classesSnap.empty) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:var(--color-gray-600);">No classes created yet. Add one above.</td></tr>';
            return;
        }

        const classes = [];
        classesSnap.forEach(doc => {
            const data = doc.data();
            classes.push({
                id: doc.id,
                name: data.name,
                pupilCount: pupilCountMap[data.name] || 0
            });
        });

        classes.sort((a, b) => a.name.localeCompare(b.name));

        classes.forEach(cls => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td data-label="Class Name">${cls.name}</td>
                <td data-label="Pupil Count">${cls.pupilCount}</td>
                <td data-label="Actions">
                    <button class="btn-small btn-danger" onclick="deleteDoc('classes', '${cls.id}')">Delete</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error('Error loading classes:', error);
        window.showToast?.('Failed to load classes list. Check connection and try again.', 'danger');
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:var(--color-danger);">Error loading classes - please refresh</td></tr>';
    }
}

/* ========================================
   SUBJECTS MANAGEMENT
   ======================================== */

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

    tbody.innerHTML = '<tr><td colspan="2" class="table-loading">Loading subjects...</td></tr>';

    try {
        const snapshot = await db.collection('subjects').get();
        
        tbody.innerHTML = '';
        
        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="2" style="text-align:center; color:var(--color-gray-600);">No subjects created yet. Add one above.</td></tr>';
            return;
        }

        const subjects = [];
        snapshot.forEach(doc => {
            subjects.push({ id: doc.id, name: doc.data().name });
        });

        subjects.sort((a, b) => a.name.localeCompare(b.name));

        subjects.forEach(subject => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td data-label="Subject Name">${subject.name}</td>
                <td data-label="Actions">
                    <button class="btn-small btn-danger" onclick="deleteDoc('subjects', '${subject.id}')">Delete</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error('Error loading subjects:', error);
        window.showToast?.('Failed to load subjects list. Check connection and try again.', 'danger');
        tbody.innerHTML = '<tr><td colspan="2" style="text-align:center; color:var(--color-danger);">Error loading subjects - please refresh</td></tr>';
    }
}

/* ========================================
   NEW: TEACHER TO CLASS ASSIGNMENT
   ======================================== */

async function loadTeacherAssignments() {
    const teacherSelect = document.getElementById('assign-teacher');
    const classSelect = document.getElementById('assign-class');
    const tbody = document.getElementById('assignments-table')?.querySelector('tbody');

    if (!teacherSelect || !classSelect || !tbody) return;

    try {
        // Use global getAllTeachers from firebase-init.js
        const teachers = await getAllTeachers();
        teacherSelect.innerHTML = '<option value="">-- Select Teacher --</option>';
        teachers.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t.uid;
            opt.textContent = `${t.name} (${t.email})`;
            teacherSelect.appendChild(opt);
        });

        if (teachers.length === 0) {
            window.showToast?.('No teachers registered yet. Add some in the Teachers section.', 'warning', 6000);
        }

        // Load classes
        const classesSnap = await db.collection('classes').get();
        classSelect.innerHTML = '<option value="">-- Select Class --</option>';
        const classes = [];
        classesSnap.forEach(doc => {
            const data = doc.data();
            classes.push({ id: doc.id, name: data.name, teacherId: data.teacherId || null });
        });
        classes.sort((a, b) => a.name.localeCompare(b.name));
        classes.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.textContent = c.name;
            classSelect.appendChild(opt);
        });

        // Load current assignments table
        tbody.innerHTML = '';
        if (classes.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:var(--color-gray-600);">No classes created yet. Add some in the Classes section.</td></tr>';
            return;
        }

        classes.forEach(cls => {
            const assignedTeacher = teachers.find(t => t.uid === cls.teacherId);
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td data-label="Class">${cls.name}</td>
                <td data-label="Assigned Teacher">${assignedTeacher ? assignedTeacher.name : '<em>None assigned</em>'}</td>
                <td data-label="Actions">
                    ${cls.teacherId ? `<button class="btn-small btn-danger" onclick="unassignTeacher('${cls.id}')">Remove Assignment</button>` : ''}
                </td>
            `;
            tbody.appendChild(tr);
        });

    } catch (error) {
        console.error('Error loading assignments:', error);
        window.showToast?.('Failed to load assignment data. Check connection and try again.', 'danger');
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:var(--color-danger);">Error loading assignments - please refresh</td></tr>';
    }
}

async function assignTeacherToClass() {
    const teacherUid = document.getElementById('assign-teacher')?.value;
    const classId = document.getElementById('assign-class')?.value;

    if (!teacherUid || !classId) {
        window.showToast?.('Please select both a teacher and a class', 'warning');
        return;
    }

    try {
        await db.collection('classes').doc(classId).update({
            teacherId: teacherUid,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        window.showToast?.('Teacher assigned successfully!', 'success');
        loadTeacherAssignments(); // Refresh table
    } catch (error) {
        console.error('Error assigning teacher:', error);
        handleError(error, 'Failed to assign teacher');
    }
}

async function unassignTeacher(classId) {
    if (!confirm('Remove teacher assignment from this class?')) return;

    try {
        await db.collection('classes').doc(classId).update({
            teacherId: firebase.firestore.FieldValue.delete(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        window.showToast?.('Teacher unassigned successfully', 'success');
        loadTeacherAssignments();
    } catch (error) {
        console.error('Error unassigning teacher:', error);
        handleError(error, 'Failed to remove assignment');
    }
}

/* ========================================
   ANNOUNCEMENTS
   ======================================== */

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

    list.innerHTML = '<div class="skeleton-container"><div class="skeleton"></div><div class="skeleton"></div></div>';

    try {
        const snapshot = await db.collection('announcements').get();

        list.innerHTML = '';

        if (snapshot.empty) {
            list.innerHTML = '<p style="text-align:center; color:var(--color-gray-600);">No announcements yet. Add one above.</p>';
            return;
        }

        const announcements = [];
        snapshot.forEach(doc => {
            announcements.push({ id: doc.id, ...doc.data() });
        });

        announcements.sort((a, b) => {
            const aTime = a.createdAt?.toMillis() || 0;
            const bTime = b.createdAt?.toMillis() || 0;
            return bTime - aTime;
        });

        announcements.forEach(ann => {
            const div = document.createElement('div');
            div.className = 'admin-card';
            div.style.marginBottom = 'var(--space-8)';
            div.innerHTML = `
                <h3 style="margin-top:0;">${ann.title}</h3>
                <p>${ann.content}</p>
                <small style="color:var(--color-gray-600);">Posted: ${ann.createdAt ? new Date(ann.createdAt.toDate()).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Just now'}</small>
                <div style="margin-top:var(--space-4);">
                    <button class="btn-small btn-danger" onclick="deleteDoc('announcements', '${ann.id}')">Delete</button>
                </div>
            `;
            list.appendChild(div);
        });
    } catch (error) {
        console.error('Error loading announcements:', error);
        window.showToast?.('Failed to load announcements. Check connection and try again.', 'danger');
        list.innerHTML = '<p style="text-align:center; color:var(--color-danger);">Error loading announcements - please refresh</p>';
    }
}

/* ========================================
   NEW: SCHOOL SETTINGS SECTION
   ======================================== */

async function loadCurrentSettings() {
    const termEl = document.getElementById('display-term');
    const sessionEl = document.getElementById('display-session');
    const termSelect = document.getElementById('current-term');
    const sessionInput = document.getElementById('current-session');

    if (!termEl || !sessionEl || !termSelect || !sessionInput) return;

    try {
        const settingsDoc = await db.collection('settings').doc('current').get();

        if (settingsDoc.exists) {
            const data = settingsDoc.data();
            termEl.textContent = data.term || 'Not set';
            sessionEl.textContent = data.session || 'Not set';

            termSelect.value = data.term || 'First Term';
            sessionInput.value = data.session || '';
        } else {
            termEl.textContent = 'Not set';
            sessionEl.textContent = 'Not set';
            termSelect.value = 'First Term';
            sessionInput.value = '';
        }
    } catch (error) {
        console.error('Error loading settings:', error);
        window.showToast?.('Failed to load current settings', 'danger');
        termEl.textContent = 'Error loading';
        sessionEl.textContent = 'Error loading';
    }
}

document.getElementById('settings-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const term = document.getElementById('current-term')?.value;
    const session = document.getElementById('current-session')?.value.trim();

    if (!term || !session) {
        window.showToast?.('Both term and session are required', 'warning');
        return;
    }

    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="btn-loading">Saving...</span>';

    try {
        await db.collection('settings').doc('current').set({
            term,
            session,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        window.showToast?.('School settings saved successfully!', 'success');
        loadCurrentSettings(); // Refresh display
    } catch (error) {
        console.error('Error saving settings:', error);
        handleError(error, 'Failed to save settings');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Save Settings';
    }
});

/* ========================================
   DELETE HELPERS
   ======================================== */

async function deleteUser(collection, uid) {
    if (!confirm('Are you sure you want to delete this user? This cannot be undone.')) return;

    try {
        await db.collection(collection).doc(uid).delete();
        await db.collection('users').doc(uid).delete();

        window.showToast?.('User deleted successfully', 'success');
        
        if (collection === 'teachers') {
            loadTeachers();
            loadTeacherAssignments(); // Refresh assignments if teacher deleted
        }
        if (collection === 'pupils') loadPupils();
        
        loadDashboardStats();
    } catch (error) {
        console.error('Error deleting user:', error);
        handleError(error, 'Failed to delete user');
    }
}

async function deleteDoc(collectionName, docId) {
    if (!confirm('Are you sure you want to delete this item? This action cannot be undone.')) return;

    try {
        await db.collection(collectionName).doc(docId).delete();
        
        window.showToast?.('Item deleted successfully', 'success');
        
        loadDashboardStats();
        
        switch(collectionName) {
            case 'classes':
                loadClasses();
                loadTeacherAssignments(); // Refresh assignments if class deleted
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

/* ========================================
   INITIAL LOAD
   ======================================== */

document.addEventListener('DOMContentLoaded', () => {
    showSection('dashboard'); // Default to dashboard
    console.log('✓ Admin portal initialized (v4.1.0)');
});