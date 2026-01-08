/**
 * FAHMID NURSERY & PRIMARY SCHOOL
 * Admin Portal JavaScript - DEBUGGED & FIXED
 * 
 * @version 6.3.0 - ALL CRITICAL BUGS FIXED
 * @date 2026-01-08
 * 
 * FIXES:
 * - Function hoisting issues resolved
 * - All helper functions declared at top
 * - Proper initialization order
 * - Defensive null checks added
 * - Error boundaries improved
 */
'use strict';

/* ======================================== 
   FIREBASE INSTANCES 
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

/* ======================================== 
   HELPER FUNCTIONS - DECLARED FIRST!
======================================== */

/**
 * FIXED: Moved to top to avoid hoisting issues
 */
function getClassIdFromPupilData(classData) {
  if (!classData) return null;
  if (typeof classData === 'object' && classData.id) {
    return classData.id;
  }
  return null;
}

/**
 * FIXED: Populate class dropdown with defensive checks
 */
async function populateClassDropdown(selectedClass = '') {
  const classSelect = document.getElementById('pupil-class');
  if (!classSelect) {
    console.warn('Class dropdown element not found');
    return;
  }

  try {
    const snapshot = await db.collection('classes').orderBy('name').get();
    classSelect.innerHTML = '<option value="">-- Select Class --</option>';

    if (snapshot.empty) {
      classSelect.innerHTML = '<option value="">No classes available - Create one first</option>';
      classSelect.disabled = true;
      window.showToast?.('Please create a class first', 'warning');
      return;
    }

    classSelect.disabled = false;
    snapshot.forEach(doc => {
      const data = doc.data();
      const opt = document.createElement('option');
      opt.value = doc.id;
      opt.textContent = data.name || 'Unnamed Class';
      if (selectedClass && doc.id === selectedClass) {
        opt.selected = true;
      }
      classSelect.appendChild(opt);
    });
  } catch (error) {
    console.error('Error populating class dropdown:', error);
    classSelect.innerHTML = '<option value="">Error loading classes</option>';
    classSelect.disabled = true;
    window.showToast?.('Failed to load classes. Please refresh the page.', 'danger');
  }
}

/**
 * FIXED: Get class details with proper error handling
 */
async function getClassDetails(classId) {
  try {
    if (!classId) {
      console.warn('getClassDetails called with no classId');
      return null;
    }
    
    const doc = await db.collection('classes').doc(classId).get();
    
    if (!doc.exists) {
      console.warn(`Class ${classId} not found`);
      return null;
    }

    const data = doc.data();
    let teacherName = '';
    let teacherId = data.teacherId || '';

    if (teacherId) {
      try {
        const teacherDoc = await db.collection('teachers').doc(teacherId).get();
        if (teacherDoc.exists) {
          teacherName = teacherDoc.data().name || '';
        }
      } catch (teacherError) {
        console.error('Error fetching teacher:', teacherError);
      }
    }

    return {
      classId: doc.id,
      className: data.name || 'Unnamed Class',
      subjects: Array.isArray(data.subjects) ? data.subjects : [],
      teacherId,
      teacherName
    };
  } catch (error) {
    console.error('Error in getClassDetails:', error);
    return null;
  }
}

/**
 * FIXED: Pagination with defensive checks
 */
function paginateTable(data, tbodyId, itemsPerPage = 20, renderRowCallback) {
  const tbody = document.getElementById(tbodyId);
  
  if (!tbody || tbody.tagName !== 'TBODY') {
    console.error(`Invalid tbody element with id: ${tbodyId}`);
    return;
  }
  
  if (!Array.isArray(data)) {
    console.error('paginateTable: data must be an array');
    tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; color: var(--color-danger);">Invalid data format</td></tr>';
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
    
    pageData.forEach(item => {
      try {
        renderRowCallback(item, tbody);
      } catch (error) {
        console.error('Error rendering row:', error);
      }
    });
    updatePaginationControls(page, totalPages);
  }
  
  function updatePaginationControls(page, total) {
    const table = tbody.parentElement;
    if (!table) return;
    
    const container = table.parentElement;
    if (!container) return;
    
    let paginationContainer = container.querySelector('.pagination');
    
    if (!paginationContainer) {
      paginationContainer = document.createElement('div');
      paginationContainer.className = 'pagination';
      container.appendChild(paginationContainer);
    }
    
    paginationContainer.innerHTML = `
      <button onclick="window.changePage_${tbodyId}(${page - 1})" ${page === 1 ? 'disabled' : ''}>Previous</button>
      <span class="page-info">Page ${page} of ${total || 1}</span>
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

/**
 * FIXED: Moved session history loader to top
 */
async function loadSessionHistory() {
  const tbody = document.getElementById('session-history-table');
  if (!tbody) {
    console.warn('Session history table not found');
    return;
  }
  
  tbody.innerHTML = '<tr><td colspan="4" class="table-loading">Loading history...</td></tr>';
  
  try {
    const snapshot = await db.collection('sessions')
      .orderBy('startYear', 'desc')
      .limit(10)
      .get();
    
    tbody.innerHTML = '';
    
    if (snapshot.empty) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--color-gray-600);">No archived sessions yet</td></tr>';
      return;
    }
    
    snapshot.forEach(doc => {
      const data = doc.data();
      
      const startDate = data.startDate 
        ? data.startDate.toDate().toLocaleDateString('en-GB')
        : '-';
      
      const endDate = data.endDate 
        ? data.endDate.toDate().toLocaleDateString('en-GB')
        : '-';
      
      const status = data.status === 'archived' 
        ? '<span class="status-badge" style="background:#9e9e9e;">Archived</span>'
        : '<span class="status-badge" style="background:#4CAF50;">Active</span>';
      
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td data-label="Session">${data.name || 'Unnamed Session'}</td>
        <td data-label="Start Date">${startDate}</td>
        <td data-label="End Date">${endDate}</td>
        <td data-label="Status">${status}</td>
      `;
      tbody.appendChild(tr);
    });
    
  } catch (error) {
    console.error('Error loading session history:', error);
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--color-danger);">Error loading history</td></tr>';
    window.showToast?.('Failed to load session history', 'danger');
  }
}

/**
 * FIXED: Moved alumni loader to top
 */
async function loadAlumni() {
  const tbody = document.getElementById('alumni-table');
  if (!tbody) {
    console.warn('Alumni table not found - section may not be visible');
    return;
  }
  
  tbody.innerHTML = '<tr><td colspan="5" class="table-loading">Loading alumni...</td></tr>';
  
  try {
    const snapshot = await db.collection('alumni')
      .orderBy('graduationDate', 'desc')
      .get();
    
    tbody.innerHTML = '';
    
    if (snapshot.empty) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--color-gray-600);">No alumni yet. Pupils will appear here after graduating from terminal class.</td></tr>';
      return;
    }
    
    const alumni = [];
    snapshot.forEach(doc => {
      alumni.push({ id: doc.id, ...doc.data() });
    });
    
    paginateTable(alumni, 'alumni-table', 20, (alum, tbody) => {
      const graduationDate = alum.graduationDate 
        ? alum.graduationDate.toDate().toLocaleDateString('en-GB')
        : '-';
      
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td data-label="Name">${alum.name || 'Unknown'}</td>
        <td data-label="Final Class">${alum.finalClass || '-'}</td>
        <td data-label="Graduation Session">${alum.graduationSession || '-'}</td>
        <td data-label="Graduation Date">${graduationDate}</td>
        <td data-label="Actions">
          <button class="btn-small btn-danger" onclick="deleteAlumni('${alum.id}')">Delete</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
    
  } catch (error) {
    console.error('Error loading alumni:', error);
    window.showToast?.('Failed to load alumni list', 'danger');
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--color-danger);">Error loading alumni</td></tr>';
  }
}

async function deleteAlumni(alumniId) {
  if (!alumniId) {
    window.showToast?.('Invalid alumni ID', 'warning');
    return;
  }
  
  if (!confirm('Delete this alumni record? This cannot be undone.')) return;
  
  try {
    await db.collection('alumni').doc(alumniId).delete();
    window.showToast?.('Alumni record deleted', 'success');
    loadAlumni();
  } catch (error) {
    console.error('Error deleting alumni:', error);
    window.handleError(error, 'Failed to delete alumni');
  }
}

// Make globally available
window.deleteAlumni = deleteAlumni;

/* ======================================== 
   SECTION NAVIGATION - FIXED ORDER
======================================== */
function showSection(sectionId) {
  if (!sectionId) {
    console.error('showSection called with no sectionId');
    return;
  }
  
  // Hide all sections
  document.querySelectorAll('.admin-card').forEach(card => {
    card.style.display = 'none';
  });
  
  // Show requested section
  const section = document.getElementById(sectionId);
  if (section) {
    section.style.display = 'block';
  } else {
    console.warn(`Section ${sectionId} not found in DOM`);
  }
  
  // Update active nav link
  document.querySelectorAll('.admin-sidebar a').forEach(a => {
    a.classList.remove('active');
  });
  
  const activeLink = document.querySelector(`.admin-sidebar a[onclick*="${sectionId}"]`);
  if (activeLink) {
    activeLink.classList.add('active');
  }
  
  // FIXED: All functions are now defined, safe to call
  try {
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
      case 'promotion-requests':
        loadPromotionRequests();
        break;
      case 'announcements':
        loadAdminAnnouncements();
        break;
      case 'alumni':
        loadAlumni();
        break;
      case 'settings':
        loadCurrentSettings();
        loadClassHierarchyUI();
        loadSessionHistory(); // ✅ Now safe to call
        break;
      default:
        console.warn(`Unknown section: ${sectionId}`);
    }
  } catch (error) {
    console.error(`Error loading section ${sectionId}:`, error);
    window.showToast?.(`Failed to load ${sectionId} section`, 'danger');
  }
  
  // Close mobile sidebar
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
    // Set defaults on error
    ['teacher-count', 'pupil-count', 'class-count', 'announce-count'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = '0';
    });
  }
  
  // Check session status when dashboard loads
  await checkSessionStatus();
}

// Simple role check
window.checkRole('admin').catch(() => {});

document.getElementById('admin-logout')?.addEventListener('click', (e) => {
  e.preventDefault();
  window.logout();
});

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
  
  try {
    const existingUsers = await db.collection('users')
      .where('email', '==', email)
      .get();
    
    if (!existingUsers.empty) {
      window.showToast?.('This email is already registered', 'warning');
      return;
    }
  } catch (error) {
    console.error('Error checking email:', error);
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

/* ===== PUPIL FORM HANDLER ADDED HERE ===== */

document.getElementById('add-pupil-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const pupilId = document.getElementById('pupil-id').value;
  const name = document.getElementById('pupil-name').value.trim();
  const classId = document.getElementById('pupil-class').value;
  const email = document.getElementById('pupil-email').value.trim();
  const password = document.getElementById('pupil-password').value;
  const parentEmail = document.getElementById('pupil-parent-email').value.trim();
  
  if (!name || !classId) {
    window.showToast?.('Name and class are required', 'warning');
    return;
  }
  
  if (!pupilId && (!email || !password)) {
    window.showToast?.('Email and password required for new pupils', 'warning');
    return;
  }
  
  const submitBtn = e.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span class="btn-loading">Saving pupil...</span>';
  
  try {
    const classDoc = await db.collection('classes').doc(classId).get();
    
    if (!classDoc.exists) {
      window.showToast?.('Selected class not found', 'danger');
      return;
    }
    
    const classData = classDoc.data();
    
    let teacherId = classData.teacherId || '';
    let teacherName = classData.teacherName || '';
    
    if (teacherId && !teacherName) {
      const teacherDoc = await db.collection('teachers').doc(teacherId).get();
      if (teacherDoc.exists) {
        teacherName = teacherDoc.data().name || '';
      }
    }
    
    const pupilData = {
      name,
      dob: document.getElementById('pupil-dob').value || '',
      gender: document.getElementById('pupil-gender').value || '',
      parentName: document.getElementById('pupil-parent-name').value.trim() || '',
      parentEmail: parentEmail || '',
      contact: document.getElementById('pupil-contact').value.trim() || '',
      address: document.getElementById('pupil-address').value.trim() || '',
      class: {
        id: classId,
        name: classData.name || 'Unknown Class'
      },
      subjects: Array.isArray(classData.subjects) ? classData.subjects : [],
      assignedTeacher: {
        id: teacherId,
        name: teacherName
      },
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    if (pupilId) {
      await db.collection('pupils').doc(pupilId).update(pupilData);
      
      if (email) {
        const userDoc = await db.collection('users').doc(pupilId).get();
        if (userDoc.exists && userDoc.data().email !== email) {
          await db.collection('users').doc(pupilId).update({
            email,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          });
        }
      }
      
      window.showToast?.(`✓ Pupil "${name}" updated successfully`, 'success');
    } else {
      const existingUsers = await db.collection('users')
        .where('email', '==', email)
        .get();
      
      if (!existingUsers.empty) {
        window.showToast?.('This email is already registered', 'warning');
        return;
      }
      
      const userCredential = await secondaryAuth.createUserWithEmailAndPassword(email, password);
      const uid = userCredential.user.uid;
      
      await db.collection('users').doc(uid).set({
        email,
        role: 'pupil',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      
      pupilData.email = email;
      pupilData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      
      await db.collection('pupils').doc(uid).set(pupilData);
      
      await secondaryAuth.sendPasswordResetEmail(email);
      await secondaryAuth.signOut();
      
      window.showToast?.(
        `✓ Pupil "${name}" added successfully!\nPassword reset email sent to ${email}`,
        'success',
        6000
      );
    }
    
    cancelPupilForm();
    await loadPupils();
    await loadDashboardStats();
    
  } catch (error) {
    console.error('Error saving pupil:', error);
    window.handleError(error, 'Failed to save pupil');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = pupilId ? 'Update Pupil' : 'Save Pupil';
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
   PUPILS MANAGEMENT - FIXED
======================================== */

async function showPupilForm() {
  const form = document.getElementById('pupil-form');
  if (!form) return;

  // Populate class dropdown first
  await populateClassDropdown();

  form.style.display = 'block';
  document.getElementById('pupil-name')?.focus();
}

function cancelPupilForm() {
  document.getElementById('pupil-form').style.display = 'none';
  document.getElementById('add-pupil-form').reset();
  document.getElementById('pupil-id').value = '';
  
  // Reset form title and button text
  document.getElementById('pupil-form-title').textContent = 'Add / Edit Pupil';
  document.getElementById('save-pupil-btn').textContent = 'Save Pupil';
}

async function loadPupils() {
  const tbody = document.getElementById('pupils-table');
  if (!tbody) return;

  // Populate class dropdown first
  await populateClassDropdown();

  tbody.innerHTML = '<tr><td colspan="6" class="table-loading">Loading pupils...</td></tr>';

  try {
    const snapshot = await db.collection('pupils').get();
    tbody.innerHTML = '';

    if (snapshot.empty) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--color-gray-600);">No pupils registered yet. Add one above.</td></tr>';
      return;
    }

    const pupils = [];
    snapshot.forEach(doc => {
      pupils.push({ id: doc.id, ...doc.data() });
    });

    pupils.sort((a, b) => a.name.localeCompare(b.name));

    paginateTable(pupils, 'pupils-table', 20, (pupil, tbody) => {
      // FIXED: Safely extract class name from both old and new formats
      let className = '-';
      if (pupil.class) {
        if (typeof pupil.class === 'object' && pupil.class.name) {
          className = pupil.class.name;
        } else if (typeof pupil.class === 'string') {
          className = pupil.class;
        }
      }
      
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td data-label="Name">${pupil.name}</td>
        <td data-label="Class">${className}</td>
        <td data-label="Gender">${pupil.gender || '-'}</td>
        <td data-label="Parent Name">${pupil.parentName || '-'}</td>
        <td data-label="Parent Email">${pupil.parentEmail || '-'}</td>
        <td data-label="Actions">
          <button class="btn-small btn-primary" onclick="editPupil('${pupil.id}')">Edit</button>
          <button class="btn-small btn-danger" onclick="deleteUser('pupils', '${pupil.id}')">Delete</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (error) {
    console.error('Error loading pupils:', error);
    window.showToast?.('Failed to load pupils list. Check connection and try again.', 'danger');
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--color-danger);">Error loading pupils - please refresh</td></tr>';
  }
}

async function editPupil(uid) {
  try {
    const doc = await db.collection('pupils').doc(uid).get();
    if (!doc.exists) throw new Error('Pupil not found');

    const data = doc.data();
    
    // FIXED: Safely extract class ID
    const classId = getClassIdFromPupilData(data.class);

    // Populate class dropdown and select the pupil's current class
    await populateClassDropdown(classId);

    // Fill form fields
    document.getElementById('pupil-id').value = uid;
    document.getElementById('pupil-name').value = data.name || '';
    document.getElementById('pupil-dob').value = data.dob || '';
    document.getElementById('pupil-gender').value = data.gender || '';
    document.getElementById('pupil-parent-name').value = data.parentName || '';
    document.getElementById('pupil-parent-email').value = data.parentEmail || '';
    document.getElementById('pupil-contact').value = data.contact || '';
    document.getElementById('pupil-address').value = data.address || '';
    document.getElementById('pupil-email').value = data.email || '';
    document.getElementById('pupil-password').value = ''; // always blank for security
    
    // FIXED: If the pupil has old-format class data (just a string), 
    // we need to find the matching class by name
    if (!classId && data.class && typeof data.class === 'string') {
      const className = data.class;
      
      // Try to find the class by name
      const classesSnapshot = await db.collection('classes')
        .where('name', '==', className)
        .limit(1)
        .get();
      
      if (!classesSnapshot.empty) {
        const matchedClassId = classesSnapshot.docs[0].id;
        document.getElementById('pupil-class').value = matchedClassId;
        
        window.showToast?.(
          'Note: This pupil has old class data. Saving will upgrade it to the new format.', 
          'info', 
          5000
        );
      } else {
        window.showToast?.(
          `Warning: Could not find class "${className}". Please select the correct class.`, 
          'warning', 
          6000
        );
      }
    }

    // Update form title and button
    document.getElementById('pupil-form-title').textContent = `Edit Pupil: ${data.name}`;
    document.getElementById('save-pupil-btn').textContent = 'Update Pupil';

    // Show the form and focus first field
    showPupilForm();
    document.getElementById('pupil-name')?.focus();
  } catch (error) {
    console.error('Error loading pupil for edit:', error);
    window.showToast?.('Failed to load pupil details for editing', 'danger');
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
  
  tbody.innerHTML = '<tr><td colspan="4" class="table-loading">Loading classes...</td></tr>';
  
  try {
    const classesSnap = await db.collection('classes').get();
    const pupilsSnap = await db.collection('pupils').get();
    
    const pupilCountMap = {};
    pupilsSnap.forEach(pupilDoc => {
      const classData = pupilDoc.data().class;
      
      let className = null;
      if (classData) {
        if (typeof classData === 'object' && classData.name) {
          className = classData.name;
        } else if (typeof classData === 'string') {
          className = classData;
        }
      }
      
      if (className) {
        pupilCountMap[className] = (pupilCountMap[className] || 0) + 1;
      }
    });
    
    tbody.innerHTML = '';
    
    if (classesSnap.empty) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--color-gray-600);">No classes created yet. Add one above.</td></tr>';
      return;
    }
    
    const classes = [];
    classesSnap.forEach(doc => {
      const data = doc.data();
      classes.push({
        id: doc.id,
        name: data.name,
        subjects: data.subjects || [],
        pupilCount: pupilCountMap[data.name] || 0
      });
    });
    
    classes.sort((a, b) => a.name.localeCompare(b.name));
    
    paginateTable(classes, 'classes-table', 20, (classItem, tbody) => {
      const subjectList = classItem.subjects.length > 0 
        ? classItem.subjects.slice(0, 3).join(', ') + (classItem.subjects.length > 3 ? '...' : '')
        : 'No subjects assigned';
      
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td data-label="Class Name">${classItem.name}</td>
        <td data-label="Pupil Count">${classItem.pupilCount}</td>
        <td data-label="Subjects">${subjectList}</td>
        <td data-label="Actions">
          <button class="btn-small btn-primary" onclick="openSubjectAssignmentModal('${classItem.id}', '${classItem.name}')">
            Assign Subjects
          </button>
          <button class="btn-small btn-danger" onclick="deleteItem('classes', '${classItem.id}')">Delete</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (error) {
    console.error('Error loading classes:', error);
    window.showToast?.('Failed to load classes list. Check connection and try again.', 'danger');
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--color-danger);">Error loading classes - please refresh</td></tr>';
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

  tbody.innerHTML =
    '<tr><td colspan="2" class="table-loading">Loading subjects...</td></tr>';

  try {
    const snapshot = await db.collection('subjects').get();
    tbody.innerHTML = '';

    if (snapshot.empty) {
      tbody.innerHTML =
        '<tr><td colspan="2" style="text-align:center; color:var(--color-gray-600);">No subjects created yet. Add one above.</td></tr>';
      return;
    }

    const subjects = [];

    snapshot.forEach(doc => {
      subjects.push({
        id: doc.id,
        name: doc.data().name
      });
    });

    subjects.sort((a, b) => a.name.localeCompare(b.name));

    paginateTable(subjects, 'subjects-table', 20, (subject, tbodyEl) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td data-label="Subject Name">${subject.name}</td>
        <td data-label="Actions">
          <button class="btn-small btn-danger" onclick="deleteItem('subjects', '${subject.id}')">Delete</button>
        </td>
      `;
      tbodyEl.appendChild(tr);
    });

  } catch (error) {
    console.error('Error loading subjects:', error);
    window.showToast?.(
      'Failed to load subjects list. Check connection and try again.',
      'danger'
    );
    tbody.innerHTML =
      '<tr><td colspan="2" style="text-align:center; color:var(--color-danger);">Error loading subjects please refresh</td></tr>';
  }
}

/* ========================================
SUBJECT ASSIGNMENT TO CLASSES
======================================== */

let currentAssignmentClassId = null;
let currentAssignmentClassName = null;

async function openSubjectAssignmentModal(classId, className) {
  currentAssignmentClassId = classId;
  currentAssignmentClassName = className;

  const modal = document.getElementById('subject-assignment-modal');
  const classNameEl = document.getElementById('assignment-class-name');
  const checkboxContainer = document.getElementById('subject-checkboxes');

  if (!modal || !classNameEl || !checkboxContainer) {
    console.error('Modal elements not found');
    return;
  }

  classNameEl.textContent = `Class: ${className}`;
  checkboxContainer.innerHTML =
    '<p style="text-align:center; color:var(--color-gray-600);">Loading subjects...</p>';

  modal.style.display = 'block';

  try {
    const subjectsSnap = await db.collection('subjects').orderBy('name').get();

    if (subjectsSnap.empty) {
      checkboxContainer.innerHTML =
        '<p style="text-align:center; color:var(--color-gray-600);">No subjects available. Create subjects first in the Subjects section.</p>';
      return;
    }

    const classDoc = await db.collection('classes').doc(classId).get();
    const currentSubjects = classDoc.exists ? (classDoc.data().subjects || []) : [];

    checkboxContainer.innerHTML = '';

    subjectsSnap.forEach(doc => {
      const subjectName = doc.data().name;
      const isChecked = currentSubjects.includes(subjectName);

      const itemDiv = document.createElement('div');
      itemDiv.className = 'subject-checkbox-item';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = `subject-${doc.id}`;
      checkbox.value = subjectName;
      checkbox.checked = isChecked;

      const label = document.createElement('label');
      label.htmlFor = checkbox.id;
      label.textContent = subjectName;

      itemDiv.appendChild(checkbox);
      itemDiv.appendChild(label);
      checkboxContainer.appendChild(itemDiv);
    });

  } catch (error) {
    console.error('Error loading subjects for assignment:', error);
    checkboxContainer.innerHTML =
      '<p style="text-align:center; color:var(--color-danger);">Error loading subjects. Please try again.</p>';
    window.showToast?.('Failed to load subjects', 'danger');
  }
}

function closeSubjectAssignmentModal() {
  const modal = document.getElementById('subject-assignment-modal');
  if (modal) modal.style.display = 'none';

  currentAssignmentClassId = null;
  currentAssignmentClassName = null;
}

async function saveClassSubjects() {
  if (!currentAssignmentClassId) {
    window.showToast?.('No class selected', 'warning');
    return;
  }

  const checkboxes = document.querySelectorAll(
    '#subject-checkboxes input[type="checkbox"]:checked'
  );
  const selectedSubjects = Array.from(checkboxes).map(cb => cb.value);

  if (selectedSubjects.length === 0) {
    if (!confirm('No subjects selected. This will remove all subjects from this class. Continue?')) {
      return;
    }
  }

  try {
    await db.collection('classes').doc(currentAssignmentClassId).update({
      subjects: selectedSubjects,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    const classDoc = await db.collection('classes').doc(currentAssignmentClassId).get();
    const classData = classDoc.data();

    const pupilsSnap = await db
      .collection('pupils')
      .where('class.id', '==', currentAssignmentClassId)
      .get();

    if (!pupilsSnap.empty) {
      const batch = db.batch();
      let updateCount = 0;

      pupilsSnap.forEach(pupilDoc => {
        batch.update(db.collection('pupils').doc(pupilDoc.id), {
          subjects: selectedSubjects,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        updateCount++;
      });

      await batch.commit();

      window.showToast?.(
        `✓ Subjects updated for class "${currentAssignmentClassName}" and ${updateCount} pupil(s)`,
        'success',
        5000
      );
    } else {
      window.showToast?.(
        `✓ Subjects updated for class "${currentAssignmentClassName}" (no pupils in class yet)`,
        'success'
      );
    }

    closeSubjectAssignmentModal();
    loadClasses();

  } catch (error) {
    console.error('Error saving subjects:', error);
    window.handleError(error, 'Failed to save subjects');
  }
}

/* ===============================
   Global function declarations
   =============================== */

window.openSubjectAssignmentModal = openSubjectAssignmentModal;
window.closeSubjectAssignmentModal = closeSubjectAssignmentModal;
window.saveClassSubjects = saveClassSubjects;
window.showSubjectForm = showSubjectForm;
window.addSubject = addSubject;

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
    window.showToast?.(
      'Failed to load assignment data. Check connection and try again.',
      'danger'
    );
    tbody.innerHTML =
      '<tr><td colspan="3" style="text-align:center; color:var(--color-danger);">Error loading assignments please refresh</td></tr>';
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
    const teacherDoc = await db.collection('teachers').doc(teacherUid).get();
    const teacherName = teacherDoc.exists ? teacherDoc.data().name : '';

    const pupilsSnap = await db
      .collection('pupils')
      .where('class.id', '==', classId)
      .get();

    await db.runTransaction(async transaction => {
      transaction.update(db.collection('classes').doc(classId), {
        teacherId: teacherUid,
        teacherName: teacherName,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      pupilsSnap.forEach(pupilDoc => {
        transaction.update(db.collection('pupils').doc(pupilDoc.id), {
          'assignedTeacher.id': teacherUid,
          'assignedTeacher.name': teacherName,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      });
    });

    window.showToast?.(
      `Teacher assigned successfully! ${pupilsSnap.size} pupil(s) updated.`,
      'success',
      5000
    );

    loadTeacherAssignments();

  } catch (error) {
    console.error('Error assigning teacher:', error);
    window.handleError(error, 'Failed to assign teacher');
  }
}

async function unassignTeacher(classId) {
  if (!confirm('Remove teacher assignment from this class?')) return;

  try {
    const classDoc = await db.collection('classes').doc(classId).get();
    const className = classDoc.exists ? classDoc.data().name : '';

    await db.collection('classes').doc(classId).update({
      teacherId: firebase.firestore.FieldValue.delete(),
      teacherName: firebase.firestore.FieldValue.delete(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    const pupilsSnap = await db
      .collection('pupils')
      .where('class.id', '==', classId)
      .get();

    if (!pupilsSnap.empty) {
      const batch = db.batch();
      let updateCount = 0;

      pupilsSnap.forEach(pupilDoc => {
        batch.update(db.collection('pupils').doc(pupilDoc.id), {
          'assignedTeacher.id': '',
          'assignedTeacher.name': '-',
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        updateCount++;
      });

      await batch.commit();

      window.showToast?.(
        `Teacher unassigned successfully! ${updateCount} pupil(s) updated.`,
        'success',
        5000
      );
    } else {
      window.showToast?.('Teacher unassigned successfully', 'success');
    }

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
  if (!form) return;

  form.style.display = 'block';
  document.getElementById('announce-title')?.focus();
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

  list.innerHTML =
    '<div class="skeleton-container"><div class="skeleton"></div><div class="skeleton"></div></div>';

  try {
    const snapshot = await db
      .collection('announcements')
      .orderBy('createdAt', 'desc')
      .get();

    list.innerHTML = '';

    if (snapshot.empty) {
      list.innerHTML =
        '<p style="text-align:center; color:var(--color-gray-600);">No announcements yet. Add one above.</p>';
      return;
    }

    snapshot.forEach(doc => {
      const ann = { id: doc.id, ...doc.data() };

      const postedDate = ann.createdAt
        ? ann.createdAt.toDate().toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })
        : 'Just now';

      const div = document.createElement('div');
      div.className = 'admin-card';
      div.style.marginBottom = 'var(--space-8)';

      div.innerHTML = `
        <h3 style="margin-top:0;">${ann.title}</h3>
        <p>${ann.content}</p>
        <small style="color:var(--color-gray-600);">Posted: ${postedDate}</small>
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
    window.showToast?.(
      'Failed to load announcements. Check connection and try again.',
      'danger'
    );
    list.innerHTML =
      '<p style="text-align:center; color:var(--color-danger);">Error loading announcements please refresh</p>';
  }
}

/* ========================================
CHECK SESSION STATUS
======================================== */

async function checkSessionStatus() {
  try {
    const settingsDoc = await db.collection('settings').doc('current').get();
    if (!settingsDoc.exists) return;

    const data = settingsDoc.data();
    const currentSession = data.currentSession;

    if (
      !currentSession ||
      typeof currentSession !== 'object' ||
      !currentSession.endDate
    ) {
      return;
    }

    const endDate = currentSession.endDate.toDate();
    const today = new Date();
    const daysUntilEnd = Math.ceil(
      (endDate - today) / (1000 * 60 * 60 * 24)
    );

    if (daysUntilEnd < 0) {
      window.showToast?.(
        '🚨 Academic session has ended! Please start a new session in School Settings.',
        'warning',
        10000
      );
    } else if (daysUntilEnd <= 30) {
      window.showToast?.(
        `⚠️ Academic session ending in ${daysUntilEnd} days. Prepare for new session and promotions.`,
        'info',
        8000
      );
    }

  } catch (error) {
    console.error('Error checking session status:', error);
  }
}

/* ======================================== 
   LOAD CURRENT SETTINGS INTO FORM
======================================== */
async function loadCurrentSettings() {
  try {
    const settingsDoc = await db.collection('settings').doc('current').get();
    
    if (!settingsDoc.exists) {
      window.showToast?.('No settings found. Please configure.', 'warning');
      return;
    }
    
    const data = settingsDoc.data();
    
    // Display current session info in status card
    if (data.currentSession && typeof data.currentSession === 'object') {
      const session = data.currentSession;
      
      document.getElementById('display-session-name').textContent = 
        session.name || `${session.startYear}/${session.endYear}`;
      
      document.getElementById('display-current-term').textContent = 
        data.term || 'First Term';
      
      if (session.startDate) {
        const startDate = session.startDate.toDate();
        document.getElementById('display-session-start').textContent = 
          startDate.toLocaleDateString('en-GB');
      }
      
      if (session.endDate) {
        const endDate = session.endDate.toDate();
        document.getElementById('display-session-end').textContent = 
          endDate.toLocaleDateString('en-GB');
      }
      
      // Check if session is ending soon
      if (session.endDate) {
        const endDate = session.endDate.toDate();
        const today = new Date();
        const daysUntilEnd = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));
        
        const statusBadge = document.getElementById('session-status-badge');
        const alertDiv = document.getElementById('session-end-alert');
        
        if (daysUntilEnd < 0) {
          statusBadge.textContent = 'Ended';
          statusBadge.className = 'status-badge ended';
          if (alertDiv) alertDiv.style.display = 'block';
        } else if (daysUntilEnd <= 30) {
          statusBadge.textContent = 'Ending Soon';
          statusBadge.className = 'status-badge ending-soon';
          if (alertDiv) alertDiv.style.display = 'block';
        } else {
          statusBadge.textContent = 'Active';
          statusBadge.className = 'status-badge';
          if (alertDiv) alertDiv.style.display = 'none';
        }
      }
      
      // Populate edit form
      document.getElementById('session-start-year').value = session.startYear || '';
      document.getElementById('session-end-year').value = session.endYear || '';
      
      if (session.startDate) {
        const startDate = session.startDate.toDate();
        document.getElementById('session-start-date').value = 
          startDate.toISOString().split('T')[0];
      }
      
      if (session.endDate) {
        const endDate = session.endDate.toDate();
        document.getElementById('session-end-date').value = 
          endDate.toISOString().split('T')[0];
      }
    } else if (data.session) {
      // Old format fallback
      document.getElementById('display-session-name').textContent = data.session;
      document.getElementById('display-current-term').textContent = data.term || 'First Term';
    }
    
    // Current term
    document.getElementById('current-term').value = data.term || 'First Term';
    
    // Resumption date
    if (data.resumptionDate) {
      document.getElementById('display-next-resumption').textContent = 
        data.resumptionDate.toDate().toLocaleDateString('en-GB');
      
      document.getElementById('resumption-date').value = 
        data.resumptionDate.toDate().toISOString().split('T')[0];
    }
    
  } catch (error) {
    console.error('Error loading settings:', error);
    window.showToast?.('Failed to load settings', 'danger');
  }
}

/* ======================================== 
   START NEW ACADEMIC SESSION
======================================== */
async function confirmStartNewSession() {
  const confirmation = confirm(
    '⚠️ START NEW ACADEMIC SESSION?\n\n' +
    'This will:\n' +
    '• Archive the current session\n' +
    '• Create a new session (next year)\n' +
    '• Reset current term to "First Term"\n' +
    '• Open promotion period for teachers\n\n' +
    'IMPORTANT: Make sure all promotions are completed first!\n\n' +
    'Continue?'
  );
  
  if (!confirmation) return;
  
  // Double confirmation for safety
  const doubleCheck = prompt(
    'Type "START NEW SESSION" (without quotes) to confirm:'
  );
  
  if (doubleCheck !== 'START NEW SESSION') {
    window.showToast?.('Action cancelled', 'info');
    return;
  }
  
  await startNewSession();
}

async function startNewSession() {
  const btn = document.getElementById('start-new-session-btn');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="btn-loading">Starting new session...</span>';
  }
  
  try {
    // Get current session
    const settingsDoc = await db.collection('settings').doc('current').get();
    
    if (!settingsDoc.exists) {
      window.showToast?.('No current session found', 'danger');
      return;
    }
    
    const currentData = settingsDoc.data();
    const currentSession = currentData.currentSession;
    
    if (!currentSession || !currentSession.endYear) {
      window.showToast?.('Invalid session data. Please configure settings first.', 'danger');
      return;
    }
    
    // Archive current session
    const archiveId = `${currentSession.startYear}-${currentSession.endYear}`;
    await db.collection('sessions').doc(archiveId).set({
      ...currentSession,
      status: 'archived',
      archivedAt: firebase.firestore.FieldValue.serverTimestamp(),
      archivedBy: auth.currentUser.uid
    });
    
    // Create new session
    const newStartYear = currentSession.endYear;
    const newEndYear = currentSession.endYear + 1;
    
    // Calculate new dates (September 1 to July 31)
    const newStartDate = new Date(newStartYear, 8, 1); // September 1
    const newEndDate = new Date(newEndYear, 6, 31); // July 31
    const newResumptionDate = new Date(newStartYear, 8, 1); // September 1
    
    await db.collection('settings').doc('current').update({
      currentSession: {
        name: `${newStartYear}/${newEndYear}`,
        startYear: newStartYear,
        endYear: newEndYear,
        startDate: firebase.firestore.Timestamp.fromDate(newStartDate),
        endDate: firebase.firestore.Timestamp.fromDate(newEndDate)
      },
      session: `${newStartYear}/${newEndYear}`,
      term: 'First Term',
      resumptionDate: firebase.firestore.Timestamp.fromDate(newResumptionDate),
      promotionPeriodActive: true, // Open promotion period
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    window.showToast?.(
      `✓ New session ${newStartYear}/${newEndYear} started successfully!\n` +
      `Promotion period is now ACTIVE for teachers.`,
      'success',
      8000
    );
    
    // Reload settings display
    await loadCurrentSettings();
    await loadSessionHistory();
    
  } catch (error) {
    console.error('Error starting new session:', error);
    window.handleError(error, 'Failed to start new session');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '🚀 Start New Session';
    }
  }
}

// Make function globally available
window.confirmStartNewSession = confirmStartNewSession;

/* ========================================
CLASS HIERARCHY MANAGEMENT
======================================== */

let currentHierarchy = null;

async function loadClassHierarchyUI() {
  try {
    currentHierarchy = await window.classHierarchy.getClassHierarchy();
    renderHierarchyUI(currentHierarchy);
  } catch (error) {
    console.error('Error loading class hierarchy UI:', error);
    window.showToast?.('Failed to load class hierarchy', 'danger');
  }
}

function renderHierarchyUI(hierarchy) {
  const nurseryContainer = document.getElementById('nursery-hierarchy');
  const primaryContainer = document.getElementById('primary-hierarchy');
  if (!nurseryContainer || !primaryContainer) return;

  nurseryContainer.innerHTML = '';

  if (hierarchy.nursery && Array.isArray(hierarchy.nursery)) {
    hierarchy.nursery.forEach((className, index) => {
      const itemDiv = document.createElement('div');
      itemDiv.className = 'hierarchy-item';
      itemDiv.innerHTML = `
        <span class="hierarchy-number">${index + 1}</span>
        <input
          type="text"
          class="hierarchy-input"
          value="${className}"
          data-level="nursery"
          data-index="${index}"
        >
        <button
          class="btn-icon btn-danger"
          onclick="removeHierarchyItem('nursery', ${index})"
          title="Remove"
        >✕</button>
      `;
      nurseryContainer.appendChild(itemDiv);
    });
  }

  primaryContainer.innerHTML = '';

  if (hierarchy.primary && Array.isArray(hierarchy.primary)) {
    const startNumber = (hierarchy.nursery?.length || 0) + 1;

    hierarchy.primary.forEach((className, index) => {
      const itemDiv = document.createElement('div');
      itemDiv.className = 'hierarchy-item';
      itemDiv.innerHTML = `
        <span class="hierarchy-number">${startNumber + index}</span>
        <input
          type="text"
          class="hierarchy-input"
          value="${className}"
          data-level="primary"
          data-index="${index}"
        >
        <button
          class="btn-icon btn-danger"
          onclick="removeHierarchyItem('primary', ${index})"
          title="Remove"
        >✕</button>
      `;
      primaryContainer.appendChild(itemDiv);
    });
  }
}

function addHierarchyItem(level) {
  if (!currentHierarchy) return;

  const newClassName =
    level === 'nursery'
      ? `Nursery ${currentHierarchy.nursery.length + 1}`
      : `Primary ${currentHierarchy.primary.length + 1}`;

  currentHierarchy[level].push(newClassName);
  renderHierarchyUI(currentHierarchy);
}

function removeHierarchyItem(level, index) {
  if (!currentHierarchy) return;

  if (currentHierarchy[level].length <= 1) {
    window.showToast?.('Cannot remove the last class in this section', 'warning');
    return;
  }

  const className = currentHierarchy[level][index];

  const confirmation = confirm(
    `Remove "${className}" from hierarchy?\n\n` +
    'This will not delete the class, but it will be excluded from automatic promotions.'
  );

  if (confirmation) {
    currentHierarchy[level].splice(index, 1);
    renderHierarchyUI(currentHierarchy);
  }
}

async function saveHierarchySettings() {
  if (!currentHierarchy) {
    window.showToast?.('No hierarchy data to save', 'warning');
    return;
  }

  const nurseryInputs = document.querySelectorAll(
    '.hierarchy-input[data-level="nursery"]'
  );
  const primaryInputs = document.querySelectorAll(
    '.hierarchy-input[data-level="primary"]'
  );

  const updatedHierarchy = {
    nursery: Array.from(nurseryInputs)
      .map(input => input.value.trim())
      .filter(Boolean),
    primary: Array.from(primaryInputs)
      .map(input => input.value.trim())
      .filter(Boolean)
  };

  if (
    updatedHierarchy.nursery.length === 0 &&
    updatedHierarchy.primary.length === 0
  ) {
    window.showToast?.('At least one class must be defined', 'warning');
    return;
  }

  const allClasses = [
    ...updatedHierarchy.nursery,
    ...updatedHierarchy.primary
  ];

  const duplicates = allClasses.filter(
    (item, index) => allClasses.indexOf(item) !== index
  );

  if (duplicates.length > 0) {
    window.showToast?.(
      `Duplicate class names found: ${duplicates.join(', ')}`,
      'warning'
    );
    return;
  }

  try {
    const result = await window.classHierarchy.saveClassHierarchy(updatedHierarchy);

    if (result.success) {
      currentHierarchy = updatedHierarchy;
      window.showToast?.('✓ Class progression order saved successfully!', 'success');
    } else {
      window.showToast?.('Failed to save class hierarchy', 'danger');
    }
  } catch (error) {
    console.error('Error saving hierarchy:', error);
    window.handleError(error, 'Failed to save class hierarchy');
  }
}

async function resetHierarchyToDefault() {
  const confirmation = confirm(
    'Reset to default class hierarchy?\n\n' +
    'This will restore:\n' +
    '• Nursery 1, Nursery 2\n' +
    '• Primary 1 through Primary 6\n\n' +
    'Continue?'
  );

  if (!confirmation) return;

  try {
    const defaultHierarchy =
      window.classHierarchy.DEFAULT_CLASS_HIERARCHY;

    const result =
      await window.classHierarchy.saveClassHierarchy(defaultHierarchy);

    if (result.success) {
      currentHierarchy = defaultHierarchy;
      renderHierarchyUI(currentHierarchy);
      window.showToast?.('✓ Hierarchy reset to default', 'success');
    } else {
      window.showToast?.('Failed to reset hierarchy', 'danger');
    }
  } catch (error) {
    console.error('Error resetting hierarchy:', error);
    window.handleError(error, 'Failed to reset hierarchy');
  }
}

window.addHierarchyItem = addHierarchyItem;
window.removeHierarchyItem = removeHierarchyItem;
window.saveHierarchySettings = saveHierarchySettings;
window.resetHierarchyToDefault = resetHierarchyToDefault;

/* ========================================
DELETE FUNCTIONS
======================================== */

async function deleteUser(collection, uid) {
  if (
    !confirm(
      'Are you sure you want to delete this user? This cannot be undone.'
    )
  ) return;

  try {
    await db.collection(collection).doc(uid).delete();
    await db.collection('users').doc(uid).delete();

    window.showToast?.('User deleted successfully', 'success');

    if (collection === 'teachers') {
      loadTeachers();
      loadTeacherAssignments();
    }

    if (collection === 'pupils') {
      loadPupils();
    }

    loadDashboardStats();
  } catch (error) {
    console.error('Error deleting user:', error);
    window.handleError(error, 'Failed to delete user');
  }
}

async function deleteItem(collectionName, docId) {
  if (
    !confirm(
      'Are you sure you want to delete this item? This action cannot be undone.'
    )
  ) return;

  try {
    await db.collection(collectionName).doc(docId).delete();
    window.showToast?.('Item deleted successfully', 'success');

    loadDashboardStats();

    switch (collectionName) {
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
   PROMOTION REQUESTS MANAGEMENT
======================================== */

let currentPromotionId = null;
let currentPromotionData = null;

async function loadPromotionRequests() {
  try {
    // Load promotion period status
    await loadPromotionPeriodStatus();
    
    // Load promotion requests
    const tbody = document.getElementById('promotion-requests-table');
    const noRequestsMsg = document.getElementById('no-requests-message');
    const bulkActions = document.getElementById('bulk-actions');
    
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="7" class="table-loading">Loading promotion requests...</td></tr>';
    
    const snapshot = await db.collection('promotions')
      .orderBy('createdAt', 'desc')
      .get();
    
    tbody.innerHTML = '';
    
    if (snapshot.empty) {
      if (noRequestsMsg) noRequestsMsg.style.display = 'block';
      if (bulkActions) bulkActions.style.display = 'none';
      return;
    }
    
    if (noRequestsMsg) noRequestsMsg.style.display = 'none';
    
    // Check if there are any pending requests
    const hasPending = snapshot.docs.some(doc => doc.data().status === 'pending');
    if (bulkActions) bulkActions.style.display = hasPending ? 'flex' : 'none';
    
    // Get all teacher names
    const teacherIds = new Set();
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.initiatedBy) teacherIds.add(data.initiatedBy);
    });
    
    const teacherNames = {};
    for (const teacherId of teacherIds) {
      const teacherDoc = await db.collection('teachers').doc(teacherId).get();
      if (teacherDoc.exists) {
        teacherNames[teacherId] = teacherDoc.data().name;
      }
    }
    
    snapshot.forEach(doc => {
      const data = doc.data();
      const teacherName = teacherNames[data.initiatedBy] || 'Unknown';
      
      let statusBadge = '';
      if (data.status === 'pending') {
        statusBadge = '<span class="status-pending">Pending</span>';
      } else if (data.status === 'approved') {
        statusBadge = '<span class="status-approved">Approved</span>';
      } else if (data.status === 'rejected') {
        statusBadge = '<span class="status-rejected">Rejected</span>';
      } else if (data.status === 'completed') {
        statusBadge = '<span class="status-completed">Completed</span>';
      }
      
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td data-label="Teacher">${teacherName}</td>
        <td data-label="From Class">${data.fromClass?.name || '-'}</td>
        <td data-label="To Class">${data.toClass?.name || '-'}</td>
        <td data-label="Promote" style="text-align:center;">${data.promotedPupils?.length || 0}</td>
        <td data-label="Hold" style="text-align:center;">${data.heldBackPupils?.length || 0}</td>
        <td data-label="Status">${statusBadge}</td>
        <td data-label="Actions">
          <button class="btn-small btn-primary" onclick="viewPromotionDetails('${doc.id}')">
            View Details
          </button>
          ${data.status === 'pending' ? `
            <button class="btn-small btn-success" onclick="quickApprovePromotion('${doc.id}')">
              ✓ Approve
            </button>
            <button class="btn-small btn-danger" onclick="quickRejectPromotion('${doc.id}')">
              ✗ Reject
            </button>
          ` : ''}
        </td>
      `;
      tbody.appendChild(tr);
    });
    
  } catch (error) {
    console.error('Error loading promotion requests:', error);
    window.showToast?.('Failed to load promotion requests', 'danger');
    document.getElementById('promotion-requests-table').innerHTML = 
      '<tr><td colspan="7" style="text-align:center; color:var(--color-danger);">Error loading requests</td></tr>';
  }
}

async function loadPromotionPeriodStatus() {
  const statusEl = document.getElementById('promotion-period-status');
  const toggleBtn = document.getElementById('toggle-promotion-period-btn');
  
  if (!statusEl || !toggleBtn) return;
  
  try {
    const settingsDoc = await db.collection('settings').doc('current').get();
    const isActive = settingsDoc.exists && settingsDoc.data().promotionPeriodActive === true;
    
    if (isActive) {
      statusEl.textContent = '✓ Promotion period is currently ACTIVE. Teachers can submit promotion requests.';
      statusEl.className = 'status-active';
      toggleBtn.textContent = '🔒 Close Promotion Period';
      toggleBtn.className = 'btn btn-danger';
    } else {
      statusEl.textContent = '✗ Promotion period is currently CLOSED. Teachers cannot submit requests.';
      statusEl.className = 'status-inactive';
      toggleBtn.textContent = '🔓 Open Promotion Period';
      toggleBtn.className = 'btn btn-success';
    }
  } catch (error) {
    console.error('Error loading promotion period status:', error);
    statusEl.textContent = 'Error loading status';
  }
}

async function togglePromotionPeriod() {
  try {
    const settingsDoc = await db.collection('settings').doc('current').get();
    const currentStatus = settingsDoc.exists && settingsDoc.data().promotionPeriodActive === true;
    const newStatus = !currentStatus;
    
    const action = newStatus ? 'open' : 'close';
    const confirmation = confirm(
      `${action.toUpperCase()} Promotion Period?\n\n` +
      (newStatus 
        ? 'Teachers will be able to submit promotion requests.'
        : 'Teachers will no longer be able to submit promotion requests.\nExisting pending requests will remain.')
    );
    
    if (!confirmation) return;
    
    await db.collection('settings').doc('current').set({
      promotionPeriodActive: newStatus,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    
    window.showToast?.(
      `✓ Promotion period ${newStatus ? 'opened' : 'closed'} successfully`,
      'success'
    );
    
    await loadPromotionPeriodStatus();
    
  } catch (error) {
    console.error('Error toggling promotion period:', error);
    window.handleError(error, 'Failed to toggle promotion period');
  }
}

async function viewPromotionDetails(promotionId) {
  try {
    const doc = await db.collection('promotions').doc(promotionId).get();
    
    if (!doc.exists) {
      window.showToast?.('Promotion request not found', 'danger');
      return;
    }
    
    currentPromotionId = promotionId;
    currentPromotionData = doc.data();
    
    // Get teacher name
    let teacherName = 'Unknown';
    if (currentPromotionData.initiatedBy) {
      const teacherDoc = await db.collection('teachers').doc(currentPromotionData.initiatedBy).get();
      if (teacherDoc.exists) {
        teacherName = teacherDoc.data().name;
      }
    }
    
    const modal = document.getElementById('promotion-details-modal');
    const content = document.getElementById('promotion-details-content');
    const approveBtn = document.getElementById('approve-promotion-btn');
    const rejectBtn = document.getElementById('reject-promotion-btn');
    
    if (!modal || !content) return;
    
    // Build details HTML
    let html = `
      <div class="promotion-details-section">
        <h3>Request Information</h3>
        <p><strong>Submitted by:</strong> ${teacherName}</p>
        <p><strong>From Class:</strong> ${currentPromotionData.fromClass?.name || '-'}</p>
        <p><strong>To Class:</strong> ${currentPromotionData.toClass?.name || '-'}</p>
        <p><strong>Session:</strong> ${currentPromotionData.fromSession || '-'}</p>
        <p><strong>Status:</strong> ${currentPromotionData.status.toUpperCase()}</p>
        ${currentPromotionData.isTerminalClass ? '<p><strong>⚠️ Terminal Class:</strong> Pupils will be moved to Alumni</p>' : ''}
      </div>
      
      <div class="promotion-details-section">
        <h3>Pupils to Promote (${currentPromotionData.promotedPupils?.length || 0})</h3>
        <div class="pupil-list">
    `;
    
    if (currentPromotionData.promotedPupilsDetails && currentPromotionData.promotedPupilsDetails.length > 0) {
      currentPromotionData.promotedPupilsDetails.forEach(pupil => {
        html += `
          <div class="pupil-list-item">
            <input type="checkbox" 
                   class="override-promote-checkbox" 
                   data-pupil-id="${pupil.id}" 
                   checked 
                   onchange="handlePromotionOverride()">
            <span>${pupil.name}</span>
          </div>
        `;
      });
    } else {
      html += '<p style="color:var(--color-gray-600);">No pupils selected for promotion</p>';
    }
    
    html += `
        </div>
      </div>
      
      <div class="promotion-details-section">
        <h3>Pupils to Hold Back (${currentPromotionData.heldBackPupils?.length || 0})</h3>
        <div class="pupil-list">
    `;
    
    if (currentPromotionData.heldBackPupilsDetails && currentPromotionData.heldBackPupilsDetails.length > 0) {
      currentPromotionData.heldBackPupilsDetails.forEach(pupil => {
        html += `
          <div class="pupil-list-item">
            <input type="checkbox" 
                   class="override-hold-checkbox" 
                   data-pupil-id="${pupil.id}" 
                   onchange="handlePromotionOverride()">
            <span>${pupil.name}</span>
          </div>
        `;
      });
    } else {
      html += '<p style="color:var(--color-gray-600);">No pupils held back</p>';
    }
    
    html += `
        </div>
      </div>
      
      <div class="override-section">
        <h3>⚙️ Manual Overrides</h3>
        <p style="margin-bottom:var(--space-md);">You can override the teacher's recommendations by checking/unchecking pupils above, or manually move individual pupils to different classes below.</p>
        <div class="override-controls">
          <div class="form-group">
            <label>Move Pupil:</label>
            <select id="override-pupil-select" style="width:100%;">
              <option value="">-- Select Pupil --</option>
            </select>
          </div>
          <div class="form-group">
            <label>To Class:</label>
            <select id="override-class-select" style="width:100%;">
              <option value="">-- Select Class --</option>
            </select>
          </div>
          <button class="btn btn-secondary" onclick="addManualOverride()" style="align-self: flex-end;">
            Add Override
          </button>
        </div>
        <div id="manual-overrides-list" style="margin-top:var(--space-md);"></div>
      </div>
    `;
    
    content.innerHTML = html;
    
    // Populate override dropdowns
    await populateOverrideDropdowns();
    
    // Show/hide buttons based on status
    if (currentPromotionData.status === 'pending') {
      approveBtn.style.display = 'inline-block';
      rejectBtn.style.display = 'inline-block';
    } else {
      approveBtn.style.display = 'none';
      rejectBtn.style.display = 'none';
    }
    
    modal.style.display = 'block';
    
  } catch (error) {
    console.error('Error loading promotion details:', error);
    window.showToast?.('Failed to load promotion details', 'danger');
  }
}

function closePromotionDetailsModal() {
  const modal = document.getElementById('promotion-details-modal');
  if (modal) modal.style.display = 'none';
  currentPromotionId = null;
  currentPromotionData = null;
}

async function populateOverrideDropdowns() {
  try {
    // Populate pupil dropdown
    const pupilSelect = document.getElementById('override-pupil-select');
    if (pupilSelect && currentPromotionData) {
      const allPupils = [
        ...(currentPromotionData.promotedPupilsDetails || []),
        ...(currentPromotionData.heldBackPupilsDetails || [])
      ];
      
      allPupils.forEach(pupil => {
        const opt = document.createElement('option');
        opt.value = pupil.id;
        opt.textContent = pupil.name;
        pupilSelect.appendChild(opt);
      });
    }
    
    // Populate class dropdown
    const classSelect = document.getElementById('override-class-select');
    if (classSelect) {
      const classesSnap = await db.collection('classes').orderBy('name').get();
      classesSnap.forEach(doc => {
        const opt = document.createElement('option');
        opt.value = doc.id;
        opt.textContent = doc.data().name;
        classSelect.appendChild(opt);
      });
      
      // Add Alumni option
      const alumniOpt = document.createElement('option');
      alumniOpt.value = 'alumni';
      alumniOpt.textContent = 'Alumni (Graduate)';
      classSelect.appendChild(alumniOpt);
    }
  } catch (error) {
    console.error('Error populating override dropdowns:', error);
  }
}

let manualOverrides = [];

function handlePromotionOverride() {
  // This function is called when checkboxes change
  // We'll collect the overrides when approving
  console.log('Promotion overrides changed');
}

function addManualOverride() {
  const pupilSelect = document.getElementById('override-pupil-select');
  const classSelect = document.getElementById('override-class-select');
  
  if (!pupilSelect || !classSelect) return;
  
  const pupilId = pupilSelect.value;
  const classId = classSelect.value;
  
  if (!pupilId || !classId) {
    window.showToast?.('Please select both pupil and class', 'warning');
    return;
  }
  
  const pupilName = pupilSelect.options[pupilSelect.selectedIndex].text;
  const className = classSelect.options[classSelect.selectedIndex].text;
  
  // Check if already exists
  const exists = manualOverrides.find(o => o.pupilId === pupilId);
  if (exists) {
    window.showToast?.('Override for this pupil already exists', 'warning');
    return;
  }
  
  manualOverrides.push({ pupilId, classId, pupilName, className });
  
  renderManualOverrides();
  
  // Reset selects
  pupilSelect.value = '';
  classSelect.value = '';
}

function renderManualOverrides() {
  const container = document.getElementById('manual-overrides-list');
  if (!container) return;
  
  if (manualOverrides.length === 0) {
    container.innerHTML = '';
    return;
  }
  
  container.innerHTML = '<p style="margin-bottom:var(--space-sm);"><strong>Manual Overrides:</strong></p>';
  
  manualOverrides.forEach((override, index) => {
    const div = document.createElement('div');
    div.style.cssText = 'padding:var(--space-sm); background:white; border-radius:var(--radius-sm); margin-bottom:var(--space-xs); display:flex; justify-content:space-between; align-items:center;';
    div.innerHTML = `
      <span>${override.pupilName} → ${override.className}</span>
      <button class="btn-small btn-danger" onclick="removeManualOverride(${index})">Remove</button>
    `;
    container.appendChild(div);
  });
}

function removeManualOverride(index) {
  manualOverrides.splice(index, 1);
  renderManualOverrides();
}

async function approvePromotion() {
  if (!currentPromotionId || !currentPromotionData) {
    window.showToast?.('No promotion selected', 'danger');
    return;
  }

  const confirmation = confirm(
    'Approve and Execute Promotion?\n\n' +
      'This will:\n' +
      '✓ Move pupils to their new classes\n' +
      '✓ Update all pupil records\n' +
      '✓ Move terminal class pupils to alumni (if applicable)\n\n' +
      'This action cannot be undone. Continue?'
  );

  if (!confirmation) return;

  const approveBtn = document.getElementById('approve-promotion-btn');
  if (approveBtn) {
    approveBtn.disabled = true;
    approveBtn.innerHTML = '<span class="btn-loading">Processing...</span>';
  }

  try {
    // Collect overrides from checkboxes
    const finalPromotedPupils = [];
    const finalHeldBackPupils = [];

    document.querySelectorAll('.override-promote-checkbox').forEach(checkbox => {
      if (checkbox.checked) {
        finalPromotedPupils.push(checkbox.dataset.pupilId);
      } else {
        finalHeldBackPupils.push(checkbox.dataset.pupilId);
      }
    });

    document.querySelectorAll('.override-hold-checkbox').forEach(checkbox => {
      if (checkbox.checked) {
        finalPromotedPupils.push(checkbox.dataset.pupilId);
      }
    });

    // Execute promotion
    await executePromotion(
      currentPromotionId,
      finalPromotedPupils,
      finalHeldBackPupils,
      manualOverrides
    );

    window.showToast?.(
      '✓ Promotion approved and executed successfully!',
      'success',
      6000
    );

    closePromotionDetailsModal();
    manualOverrides = [];
    await loadPromotionRequests();
  } catch (error) {
    console.error('Error approving promotion:', error);
    window.handleError(error, 'Failed to approve promotion');
  } finally {
    if (approveBtn) {
      approveBtn.disabled = false;
      approveBtn.innerHTML = '✓ Approve & Execute';
    }
  }
}

async function executePromotion(promotionId, promotedPupils, heldBackPupils, manualOverrides) {
  const promotionDoc = await db.collection('promotions').doc(promotionId).get();
  
  if (!promotionDoc.exists) {
    throw new Error('Promotion request not found');
  }
  
  const data = promotionDoc.data();
  
  if (!data.toClass || !data.toClass.id) {
    throw new Error('Invalid promotion data: missing target class');
  }
  
  const batch = db.batch();

  // Handle promoted pupils
  for (const pupilId of promotedPupils) {
    const pupilRef = db.collection('pupils').doc(pupilId);

    if (data.isTerminalClass) {
      // Move to alumni
      const pupilDoc = await pupilRef.get();
      if (pupilDoc.exists) {
        const pupilData = pupilDoc.data();

        // Create alumni record
        await db.collection('alumni').doc(pupilId).set({
          ...pupilData,
          graduationSession: data.fromSession,
          graduationDate: firebase.firestore.FieldValue.serverTimestamp(),
          finalClass: data.fromClass.name
        });

        // Delete from pupils collection
        batch.delete(pupilRef);
      }
    } else {
      // Regular promotion
      batch.update(pupilRef, {
        class: {
          id: data.toClass.id,
          name: data.toClass.name
        },
        promotionHistory: firebase.firestore.FieldValue.arrayUnion({
          session: data.fromSession,
          fromClass: data.fromClass.name,
          toClass: data.toClass.name,
          promoted: true,
          date: firebase.firestore.FieldValue.serverTimestamp()
        })
      });
    }
  }

  // Handle held back pupils
  for (const pupilId of heldBackPupils) {
    const pupilRef = db.collection('pupils').doc(pupilId);
    batch.update(pupilRef, {
      promotionHistory: firebase.firestore.FieldValue.arrayUnion({
        session: data.fromSession,
        fromClass: data.fromClass.name,
        toClass: data.fromClass.name,
        promoted: false,
        reason: 'Held back by admin/teacher decision',
        date: firebase.firestore.FieldValue.serverTimestamp()
      })
    });
  }

  // Handle manual overrides
  for (const override of manualOverrides) {
    const pupilRef = db.collection('pupils').doc(override.pupilId);

    if (override.classId === 'alumni') {
      // Move to alumni
      const pupilDoc = await pupilRef.get();
      if (pupilDoc.exists) {
        const pupilData = pupilDoc.data();

        await db.collection('alumni').doc(override.pupilId).set({
          ...pupilData,
          graduationSession: data.fromSession,
          graduationDate: firebase.firestore.FieldValue.serverTimestamp(),
          finalClass: data.fromClass.name
        });

        batch.delete(pupilRef);
      }
    } else {
      // Move to specific class
      const classDoc = await db.collection('classes').doc(override.classId).get();
      if (classDoc.exists) {
        batch.update(pupilRef, {
          class: {
            id: override.classId,
            name: classDoc.data().name
          },
          promotionHistory: firebase.firestore.FieldValue.arrayUnion({
            session: data.fromSession,
            fromClass: data.fromClass.name,
            toClass: classDoc.data().name,
            promoted: true,
            manualOverride: true,
            date: firebase.firestore.FieldValue.serverTimestamp()
          })
        });
      }
    }
  }

  // Mark promotion as completed
  batch.update(promotionDoc.ref, {
    status: 'completed',
    approvedBy: auth.currentUser.uid,
    approvedAt: firebase.firestore.FieldValue.serverTimestamp(),
    executedAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  await batch.commit();
}

async function rejectPromotion() {
  if (!currentPromotionId) {
    window.showToast?.('No promotion selected', 'danger');
    return;
  }

  const reason = prompt('Reason for rejection (optional):');

  try {
    await db.collection('promotions').doc(currentPromotionId).update({
      status: 'rejected',
      rejectedBy: auth.currentUser.uid,
      rejectedAt: firebase.firestore.FieldValue.serverTimestamp(),
      rejectionReason: reason || 'No reason provided'
    });

    window.showToast?.('✓ Promotion request rejected', 'success');

    closePromotionDetailsModal();
    await loadPromotionRequests();
  } catch (error) {
    console.error('Error rejecting promotion:', error);
    window.handleError(error, 'Failed to reject promotion');
  }
}

async function quickApprovePromotion(promotionId) {
  const confirmation = confirm('Approve this promotion request without modifications?');
  if (!confirmation) return;

  try {
    const doc = await db.collection('promotions').doc(promotionId).get();
    const data = doc.data();

    await executePromotion(
      promotionId,
      data.promotedPupils || [],
      data.heldBackPupils || [],
      []
    );

    window.showToast?.('✓ Promotion approved and executed', 'success');
    await loadPromotionRequests();
  } catch (error) {
    console.error('Error quick approving:', error);
    window.handleError(error, 'Failed to approve promotion');
  }
}

async function quickRejectPromotion(promotionId) {
  const confirmation = confirm('Reject this promotion request?');
  if (!confirmation) return;

  try {
    await db.collection('promotions').doc(promotionId).update({
      status: 'rejected',
      rejectedBy: auth.currentUser.uid,
      rejectedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    window.showToast?.('✓ Promotion request rejected', 'success');
    await loadPromotionRequests();
  } catch (error) {
    console.error('Error quick rejecting:', error);
    window.handleError(error, 'Failed to reject promotion');
  }
}

async function approveAllPendingPromotions() {
  const confirmation = confirm(
    'Approve ALL pending promotion requests?\n\n' +
      'This will execute all promotions without modifications.\n' +
      'Continue?'
  );
  if (!confirmation) return;

  try {
    const snapshot = await db
      .collection('promotions')
      .where('status', '==', 'pending')
      .get();

    if (snapshot.empty) {
      window.showToast?.('No pending requests to approve', 'info');
      return;
    }

    for (const doc of snapshot.docs) {
      const data = doc.data();
      await executePromotion(
        doc.id,
        data.promotedPupils || [],
        data.heldBackPupils || [],
        []
      );
    }

    window.showToast?.(
      `✓ Approved and executed ${snapshot.size} promotion request(s)`,
      'success',
      6000
    );

    await loadPromotionRequests();
  } catch (error) {
    console.error('Error approving all promotions:', error);
    window.handleError(error, 'Failed to approve all promotions');
  }
}

async function rejectAllPendingPromotions() {
  const confirmation = confirm(
    'Reject ALL pending promotion requests?\n\n' +
      'This action cannot be undone.\n' +
      'Continue?'
  );
  if (!confirmation) return;

  try {
    const snapshot = await db
      .collection('promotions')
      .where('status', '==', 'pending')
      .get();

    if (snapshot.empty) {
      window.showToast?.('No pending requests to reject', 'info');
      return;
    }

    const batch = db.batch();

    snapshot.forEach(doc => {
      batch.update(doc.ref, {
        status: 'rejected',
        rejectedBy: auth.currentUser.uid,
        rejectedAt: firebase.firestore.FieldValue.serverTimestamp(),
        rejectionReason: 'Bulk rejection by admin'
      });
    });

    await batch.commit();

    window.showToast?.(
      `✓ Rejected ${snapshot.size} promotion request(s)`,
      'success'
    );

    await loadPromotionRequests();
  } catch (error) {
    console.error('Error rejecting all promotions:', error);
    window.handleError(error, 'Failed to reject all promotions');
  }
}

// Make functions globally available
window.togglePromotionPeriod = togglePromotionPeriod;
window.viewPromotionDetails = viewPromotionDetails;
window.closePromotionDetailsModal = closePromotionDetailsModal;
window.handlePromotionOverride = handlePromotionOverride;
window.addManualOverride = addManualOverride;
window.removeManualOverride = removeManualOverride;
window.approvePromotion = approvePromotion;
window.rejectPromotion = rejectPromotion;
window.quickApprovePromotion = quickApprovePromotion;
window.quickRejectPromotion = quickRejectPromotion;
window.approveAllPendingPromotions = approveAllPendingPromotions;
window.rejectAllPendingPromotions = rejectAllPendingPromotions;

/* ========================================
INITIALIZATION
======================================== */

document.addEventListener('DOMContentLoaded', async () => {
  showSection('dashboard');
  
  // Set maximum date for date of birth (today's date)
  const dobInput = document.getElementById('pupil-dob');
  if (dobInput) {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const maxDate = `${year}-${month}-${day}`;
    dobInput.setAttribute('max', maxDate);
  }
  
  // Initialize class hierarchy if it doesn't exist
  await window.classHierarchy.initializeClassHierarchy();
  
  console.log('✓ Admin portal initialized (v6.1.0 - CLASS HANDLING FIXED)');
});

/* ======================================== 
   CLASS HIERARCHY MANAGEMENT
======================================== */

// Settings form submit handler
document.getElementById('settings-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const startYear = parseInt(document.getElementById('session-start-year').value);
  const endYear = parseInt(document.getElementById('session-end-year').value);
  const startDate = document.getElementById('session-start-date').value;
  const endDate = document.getElementById('session-end-date').value;
  const currentTerm = document.getElementById('current-term').value;
  const resumptionDate = document.getElementById('resumption-date').value;
  
  if (!startYear || !endYear || !startDate || !endDate || !currentTerm || !resumptionDate) {
    window.showToast?.('Please fill all required fields', 'warning');
    return;
  }
  
  if (endYear <= startYear) {
    window.showToast?.('End year must be after start year', 'warning');
    return;
  }
  
  const submitBtn = e.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span class="btn-loading">Saving...</span>';
  
  try {
    await db.collection('settings').doc('current').set({
      currentSession: {
        name: `${startYear}/${endYear}`,
        startYear: startYear,
        endYear: endYear,
        startDate: firebase.firestore.Timestamp.fromDate(new Date(startDate)),
        endDate: firebase.firestore.Timestamp.fromDate(new Date(endDate))
      },
      term: currentTerm,
      session: `${startYear}/${endYear}`, // For backward compatibility
      resumptionDate: firebase.firestore.Timestamp.fromDate(new Date(resumptionDate)),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    
    window.showToast?.('✓ Settings saved successfully!', 'success');
    await loadCurrentSettings(); // Refresh display
    
  } catch (error) {
    console.error('Error saving settings:', error);
    window.handleError(error, 'Failed to save settings');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '💾 Save Settings';
  }
});

  console.log('✓ Admin portal initialized (v6.3.0 - ALL BUGS FIXED)');