/**
 * FAHMID NURSERY & PRIMARY SCHOOL
 * Admin Portal JavaScript 
 * Initialization & Core Functions
 * 
 * @version 6.0.0 - DUPLICATE CODE REMOVED
 * @date 2026-01-05
 */
'use strict';

/* ======================================== 
   USE SHARED FIREBASE INSTANCES 
======================================== */
const db = window.db;
const auth = window.auth;

// Secondary app for creating users
let secondaryApp;
let secondaryAuth;

try {
  secondaryApp = firebase.initializeApp(firebaseConfig, 'Secondary');
  secondaryAuth = secondaryApp.auth();
} catch (error) {
  console.warn('Secondary app already exists:', error);
  secondaryApp = firebase.app('Secondary');
  secondaryAuth = secondaryApp.auth();
}

// Simple role check without loading dashboard yet
window.checkRole('admin').catch(() => {});

document.getElementById('admin-logout')?.addEventListener('click', (e) => {
  e.preventDefault();
  window.logout();
});

/* ======================================== 
   PAGINATION FUNCTION 
======================================== */
function paginateTable(data, tbodyId, itemsPerPage = 20, renderRowCallback) {
  const tbody = document.getElementById(tbodyId);
  
  if (!tbody || tbody.tagName !== 'TBODY') {
    console.error(`Invalid tbody element with id: ${tbodyId}`);
    return;
  }
  
  let currentPage = 1;
  const totalPages = Math.ceil(data.length / itemsPerPage);
  
  function renderPage(page) {
    tbody.innerHTML = '';
    const start = (page - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const pageData = data.slice(start, end);
    
    if (pageData.length === 0) {
      tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; padding: var(--space-xl); color: var(--color-gray-600);">No data available</td></tr>';
      return;
    }
    
    pageData.forEach(item => renderRowCallback(item, tbody));
    updatePaginationControls(page, totalPages);
  }
  
  function updatePaginationControls(page, total) {
    const table = tbody.parentElement;
    const container = table.parentElement;
    let paginationContainer = container.querySelector('.pagination');
    
    if (!paginationContainer) {
      paginationContainer = document.createElement('div');
      paginationContainer.className = 'pagination';
      container.appendChild(paginationContainer);
    }
    
    paginationContainer.innerHTML = `
      <button onclick="window.changePage_${tbodyId}(${page - 1})" ${page === 1 ? 'disabled' : ''}>Previous</button>
      <span class="page-info">Page ${page} of ${total}</span>
      <button onclick="window.changePage_${tbodyId}(${page + 1})" ${page === total ? 'disabled' : ''}>Next</button>
    `;
  }
  
  window[`changePage_${tbodyId}`] = function(newPage) {
    if (newPage < 1 || newPage > totalPages) return;
    currentPage = newPage;
    renderPage(currentPage);
  };
  
  renderPage(1);
}

/* ======================================== 
   SECTION NAVIGATION 
======================================== */
function showSection(sectionId) {
  // Hide all sections
  document.querySelectorAll('.admin-card').forEach(card => {
    card.style.display = 'none';
  });
  
  // Show requested section
  const section = document.getElementById(sectionId);
  if (section) {
    section.style.display = 'block';
  }
  
  // Update active nav link
  document.querySelectorAll('.admin-sidebar a').forEach(a => {
    a.classList.remove('active');
  });
  
  const activeLink = document.querySelector(`.admin-sidebar a[onclick*="${sectionId}"]`);
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

/* ======================================== 
   DASHBOARD STATS 
======================================== */
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
    window.handleError(error, 'Failed to add teacher');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = 'Save Teacher';
  }
});

async function loadTeachers() {
  const tbody = document.getElementById('teachers-table');
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
    
    paginateTable(teachers, 'teachers-table', 20, (teacher, tbody) => {
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
    window.handleError(error, 'Failed to add pupil');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = 'Save Pupil';
  }
});

async function loadPupils() {
  const tbody = document.getElementById('pupils-table');
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
    
    paginateTable(pupils, 'pupils-table', 20, (pupil, tbody) => {
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
    window.handleError(error, 'Failed to create class');
  }
}

async function loadClasses() {
  const tbody = document.getElementById('classes-table');
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
    
    paginateTable(classes, 'classes-table', 20, (classItem, tbody) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td data-label="Class Name">${classItem.name}</td>
        <td data-label="Pupil Count">${classItem.pupilCount}</td>
        <td data-label="Actions">
          <button class="btn-small btn-danger" onclick="deleteItem('classes', '${classItem.id}')">Delete</button>
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
    window.handleError(error, 'Failed to create subject');
  }
}

async function loadSubjects() {
  const tbody = document.getElementById('subjects-table');
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
    
    paginateTable(subjects, 'subjects-table', 20, (subject, tbody) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td data-label="Subject Name">${subject.name}</td>
        <td data-label="Actions">
          <button class="btn-small btn-danger" onclick="deleteItem('subjects', '${subject.id}')">Delete</button>
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
   TEACHER ASSIGNMENT 
======================================== */
async function loadTeacherAssignments() {
  const teacherSelect = document.getElementById('assign-teacher');
  const classSelect = document.getElementById('assign-class');
  const tbody = document.getElementById('assignments-table');
  
  if (!teacherSelect || !classSelect || !tbody) return;
  
  try {
    const teachers = await window.getAllTeachers();
    
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
    
    const classesSnap = await db.collection('classes').get();
    classSelect.innerHTML = '<option value="">-- Select Class --</option>';
    
    const classes = [];
    classesSnap.forEach(doc => {
      const data = doc.data();
      classes.push({
        id: doc.id,
        name: data.name,
        teacherId: data.teacherId || null
      });
    });
    
    classes.sort((a, b) => a.name.localeCompare(b.name));
    
    classes.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.name;
      classSelect.appendChild(opt);
    });
    
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
    loadTeacherAssignments();
  } catch (error) {
    console.error('Error assigning teacher:', error);
    window.handleError(error, 'Failed to assign teacher');
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
    window.handleError(error, 'Failed to remove assignment');
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
    window.handleError(error, 'Failed to publish announcement');
  }
}

async function loadAdminAnnouncements() {
  const list = document.getElementById('announcements-list');
  if (!list) return;
  
  list.innerHTML = '<div class="skeleton-container"><div class="skeleton"></div><div class="skeleton"></div></div>';
  
  try {
    const snapshot = await db.collection('announcements').orderBy('createdAt', 'desc').get();
    list.innerHTML = '';
    
    if (snapshot.empty) {
      list.innerHTML = '<p style="text-align:center; color:var(--color-gray-600);">No announcements yet. Add one above.</p>';
      return;
    }
    
    snapshot.forEach(doc => {
      const ann = { id: doc.id, ...doc.data() };
      const div = document.createElement('div');
      div.className = 'admin-card';
      div.style.marginBottom = 'var(--space-8)';
      
      const postedDate = ann.createdAt 
        ? new Date(ann.createdAt.toDate()).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })
        : 'Just now';
      
      div.innerHTML = `
        <h3 style="margin-top:0;">${ann.title}</h3>
        <p>${ann.content}</p>
        <small style="color:var(--color-gray-600);">
          Posted: ${postedDate}
        </small>
        <div style="margin-top:var(--space-4);">
          <button class="btn-small btn-danger" onclick="deleteItem('announcements', '${ann.id}')">
            Delete
          </button>
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
   SCHOOL SETTINGS 
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
      termEl.textContent = `Term: ${data.term || 'Not set'}`;
      sessionEl.textContent = `Session: ${data.session || 'Not set'}`;
      termSelect.value = data.term || 'First Term';
      sessionInput.value = data.session || '';
    } else {
      termEl.textContent = 'Term: Not set';
      sessionEl.textContent = 'Session: Not set';
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
    loadCurrentSettings();
  } catch (error) {
    console.error('Error saving settings:', error);
    window.handleError(error, 'Failed to save settings');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = 'Save Settings';
  }
});

/* ======================================== 
   DELETE FUNCTIONS 
======================================== */
async function deleteUser(collection, uid) {
  if (!confirm('Are you sure you want to delete this user? This cannot be undone.')) return;
  
  try {
    await db.collection(collection).doc(uid).delete();
    await db.collection('users').doc(uid).delete();
    
    window.showToast?.('User deleted successfully', 'success');
    
    if (collection === 'teachers') {
      loadTeachers();
      loadTeacherAssignments();
    }
    if (collection === 'pupils') loadPupils();
    
    loadDashboardStats();
  } catch (error) {
    console.error('Error deleting user:', error);
    window.handleError(error, 'Failed to delete user');
  }
}

async function deleteItem(collectionName, docId) {
  if (!confirm('Are you sure you want to delete this item? This action cannot be undone.')) return;
  
  try {
    await db.collection(collectionName).doc(docId).delete();
    
    window.showToast?.('Item deleted successfully', 'success');
    loadDashboardStats();
    
    switch(collectionName) {
      case 'classes':
        loadClasses();
        loadTeacherAssignments();
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
    window.handleError(error, 'Failed to delete item');
  }
}

/* ======================================== 
   INITIALIZATION 
======================================== */
document.addEventListener('DOMContentLoaded', () => {
  showSection('dashboard');
  console.log('✓ Admin portal initialized (v6.0.0 - PRODUCTION READY)');
});

console.log('✓ Admin portal v6.0.0 Part 2 loaded');