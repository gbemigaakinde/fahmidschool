/**
 * FAHMID NURSERY & PRIMARY SCHOOL
 * Admin Portal JavaScript - FIXED
 * 
 * @version 6.1.0 - CLASS HANDLING FIXED
 * @date 2026-01-06
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
    
    const teacherCount = teachersSnap.size;
    const pupilCount = pupilsSnap.size;
    const classCount = classesSnap.size;
    const announceCount = announcementsSnap.size;
    
    // Update dashboard stats
    document.getElementById('teacher-count').textContent = teacherCount;
    document.getElementById('pupil-count').textContent = pupilCount;
    document.getElementById('class-count').textContent = classCount;
    document.getElementById('announce-count').textContent = announceCount;
    
    // Update header stats
    const headerTeacherCount = document.getElementById('header-teacher-count');
    const headerPupilCount = document.getElementById('header-pupil-count');
    const headerClassCount = document.getElementById('header-class-count');
    
    if (headerTeacherCount) headerTeacherCount.textContent = teacherCount;
    if (headerPupilCount) headerPupilCount.textContent = pupilCount;
    if (headerClassCount) headerClassCount.textContent = classCount;
    
  } catch (error) {
    console.error('Error loading dashboard stats:', error);
    window.showToast?.('Failed to load dashboard statistics. Please refresh.', 'danger');
    
    // Set all to 0 on error
    document.getElementById('teacher-count').textContent = '0';
    document.getElementById('pupil-count').textContent = '0';
    document.getElementById('class-count').textContent = '0';
    document.getElementById('announce-count').textContent = '0';
    
    // Also update header
    const headerTeacherCount = document.getElementById('header-teacher-count');
    const headerPupilCount = document.getElementById('header-pupil-count');
    const headerClassCount = document.getElementById('header-class-count');
    
    if (headerTeacherCount) headerTeacherCount.textContent = '0';
    if (headerPupilCount) headerPupilCount.textContent = '0';
    if (headerClassCount) headerClassCount.textContent = '0';
  }
  // Check session status when dashboard loads
  await checkSessionStatus();
}
}

async function populateClassDropdown(selectedClass = '') {
  const classSelect = document.getElementById('pupil-class');
  if (!classSelect) return;

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
      opt.textContent = data.name;
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
  
  // Check if email already exists
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

/**
 * FIXED: Safely extract class ID from pupil data
 * Handles both old format (string) and new format (object)
 */
function getClassIdFromPupilData(classData) {
  if (!classData) return null;
  
  // New format: {id: "xyz", name: "Primary 3"}
  if (typeof classData === 'object' && classData.id) {
    return classData.id;
  }
  
  // Old format: just "Primary 3" as string
  // We can't get an ID from this, so return null
  return null;
}

/**
 * FIXED: Fetch class details by class ID
 */
async function getClassDetails(classId) {
  try {
    if (!classId) return null;
    
    const doc = await db.collection('classes').doc(classId).get();
    
    if (!doc.exists) return null;

    const data = doc.data();
    let teacherName = '';
    let teacherId = data.teacherId || '';

    if (teacherId) {
      const teacherDoc = await db.collection('teachers').doc(teacherId).get();
      if (teacherDoc.exists) {
        teacherName = teacherDoc.data().name || '';
      }
    }

    return {
      classId: doc.id,
      className: data.name,
      subjects: data.subjects || [],
      teacherId,
      teacherName
    };
  } catch (error) {
    console.error('Error fetching class details:', error);
    return null;
  }
}

document.getElementById('add-pupil-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const uid = document.getElementById('pupil-id').value;
  const name = document.getElementById('pupil-name').value.trim();
  const dob = document.getElementById('pupil-dob').value;
  const gender = document.getElementById('pupil-gender').value;
  const pupilClassId = document.getElementById('pupil-class').value; // This is the class ID
  const parentName = document.getElementById('pupil-parent-name').value.trim();
  const parentEmail = document.getElementById('pupil-parent-email').value.trim();
  const contact = document.getElementById('pupil-contact').value.trim();
  const address = document.getElementById('pupil-address').value.trim();
  const email = document.getElementById('pupil-email').value.trim();
  const tempPassword = document.getElementById('pupil-password').value;

  if (!name || !gender || !pupilClassId || !email || (!uid && !tempPassword)) {
    window.showToast?.('Please fill all required fields', 'warning');
    return;
  }
  
  // Check if email already exists (only when creating new pupil)
  if (!uid) {
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
  }

  const submitBtn = e.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.innerHTML = `<span class="btn-loading">${uid ? 'Updating pupil...' : 'Creating pupil...'}</span>`;

  try {
    // FIXED: Get class details using the class ID
    const classDetails = await getClassDetails(pupilClassId);

    if (!classDetails) {
      window.showToast?.('Selected class not found', 'danger');
      submitBtn.disabled = false;
      submitBtn.innerHTML = uid ? 'Update Pupil' : 'Save Pupil';
      return;
    }

    // FIXED: Always store class in the NEW format (object with id and name)
    const pupilPayload = {
      name,
      dob: dob || '',
      gender,
      email,
      parentName: parentName || '',
      parentEmail: parentEmail || '',
      contact: contact || '',
      address: address || '',
      class: {
        id: classDetails.classId,
        name: classDetails.className
      },
      subjects: classDetails.subjects,
      assignedTeacher: {
        id: classDetails.teacherId,
        name: classDetails.teacherName
      },
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    if (uid) {
      // ===== UPDATE EXISTING PUPIL =====
      await db.collection('pupils').doc(uid).update(pupilPayload);
      window.showToast?.(`Pupil "${name}" updated successfully!`, 'success');
    } else {
      // ===== ADD NEW PUPIL =====
      const userCredential = await secondaryAuth.createUserWithEmailAndPassword(email, tempPassword);
      const newUid = userCredential.user.uid;

      await db.collection('users').doc(newUid).set({
        email,
        role: 'pupil',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      await db.collection('pupils').doc(newUid).set({
        ...pupilPayload,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      await secondaryAuth.signOut();
      await auth.sendPasswordResetEmail(email);

      window.showToast?.(`Pupil "${name}" added! Password reset email sent.`, 'success', 6000);
    }

    cancelPupilForm();
    loadPupils();
    loadDashboardStats();

  } catch (error) {
    console.error('Error saving pupil:', error);
    window.handleError(error, `Failed to ${uid ? 'update' : 'add'} pupil`);
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = uid ? 'Update Pupil' : 'Save Pupil';
  }
});

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
   SUBJECTS MANAGEMENT - FIXED
======================================== */

// Move these functions to GLOBAL scope (outside setupSubjectsEventListeners)
window.deleteSubject = async function(subjectId, subjectName) {
  if (!confirm(`Are you sure you want to delete "${subjectName}"? This will remove it from all classes.`)) return;

  try {
    // Delete from subjects collection
    await db.collection('subjects').doc(subjectId).delete();

    // Remove subject from all classes
    await syncSubjectToClasses(subjectName, 'delete');

    window.showToast?.(`Subject "${subjectName}" deleted and removed from all classes`, 'success');
    loadSubjects();
  } catch (err) {
    console.error('Error deleting subject:', err);
    window.handleError(err, 'Failed to delete subject');
  }
};

window.editSubject = async function(subjectId, oldName) {
  const newName = prompt('Enter new name for subject:', oldName);
  if (!newName || newName.trim() === '' || newName === oldName) return;

  try {
    // Update subject in subjects collection
    await db.collection('subjects').doc(subjectId).update({
      name: newName,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    // Sync name change in classes
    await syncSubjectToClasses(null, { action: 'edit', oldName, newName });

    window.showToast?.(`Subject renamed to "${newName}" and synced with classes`, 'success');
    loadSubjects();
  } catch (err) {
    console.error('Error editing subject:', err);
    window.handleError(err, 'Failed to edit subject');
  }
};

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
    
    paginateTable(subjects, 'subjects-table', 20, (subject, tbodyEl) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td data-label="Subject Name">${subject.name}</td>
        <td data-label="Actions">
          <button class="btn-small btn-secondary" onclick="editSubject('${subject.id}', '${subject.name}')">Edit</button>
          <button class="btn-small btn-danger" onclick="deleteSubject('${subject.id}', '${subject.name}')">Delete</button>
        </td>
      `;
      tbodyEl.appendChild(tr);
    });

  } catch (error) {
    console.error('Error loading subjects:', error);
    window.showToast?.('Failed to load subjects list. Check connection and try again.', 'danger');
    tbody.innerHTML = '<tr><td colspan="2" style="text-align:center; color:var(--color-danger);">Error loading subjects - please refresh</td></tr>';
  }
}

// This function is no longer needed since we removed the input fields
function setupSubjectsEventListeners() {
  // Empty - can be removed or kept for future use
}

  // Delete Subject
 async function deleteSubject(subjectId, subjectName) {
  if (!confirm(`Are you sure you want to delete "${subjectName}"? This will remove it from all classes.`)) return;

  try {
    // Delete from subjects collection
    await db.collection('subjects').doc(subjectId).delete();

    // Remove subject from all classes
    await syncSubjectToClasses(subjectName, 'delete');

    window.showToast?.(`Subject "${subjectName}" deleted and removed from all classes`, 'success');
    loadSubjects();
  } catch (err) {
    console.error('Error deleting subject:', err);
    window.handleError(err, 'Failed to delete subject');
  }
}

async function editSubject(subjectId, oldName) {
  const newName = prompt('Enter new name for subject:', oldName);
  if (!newName || newName.trim() === '' || newName === oldName) return;

  try {
    // Update subject in subjects collection
    await db.collection('subjects').doc(subjectId).update({
      name: newName,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    // Sync name change in classes
    await syncSubjectToClasses(null, { action: 'edit', oldName, newName });

    window.showToast?.(`Subject renamed to "${newName}" and synced with classes`, 'success');
    loadSubjects();
  } catch (err) {
    console.error('Error editing subject:', err);
    window.handleError(err, 'Failed to edit subject');
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
    const teacherDoc = await db.collection('teachers').doc(teacherUid).get();
    const teacherName = teacherDoc.exists ? teacherDoc.data().name : '';
    
    const classDoc = await db.collection('classes').doc(classId).get();
    const className = classDoc.exists ? classDoc.data().name : '';
    
    if (!className) {
      window.showToast?.('Class not found', 'danger');
      return;
    }
    
    // Get pupils first
    const pupilsSnap = await db.collection('pupils')
      .where('class.id', '==', classId)
      .get();
    
    // Use Firestore transaction for atomic update
    await db.runTransaction(async (transaction) => {
      const classRef = db.collection('classes').doc(classId);
      
      transaction.update(classRef, {
        teacherId: teacherUid,
        teacherName: teacherName,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      
      // Update all pupils in the same transaction
      pupilsSnap.forEach(pupilDoc => {
        const pupilRef = db.collection('pupils').doc(pupilDoc.id);
        transaction.update(pupilRef, {
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
    // Get class name first
    const classDoc = await db.collection('classes').doc(classId).get();
    const className = classDoc.exists ? classDoc.data().name : '';
    
    // Update the class document
    await db.collection('classes').doc(classId).update({
      teacherId: firebase.firestore.FieldValue.delete(),
      teacherName: firebase.firestore.FieldValue.delete(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    // Clear teacher from all pupils in this class
    const pupilsSnap = await db.collection('pupils')
      .where('class.id', '==', classId)
      .get();
    
    if (!pupilsSnap.empty) {
      const batch = db.batch();
      let updateCount = 0;
      
      pupilsSnap.forEach(pupilDoc => {
        const pupilRef = db.collection('pupils').doc(pupilDoc.id);
        batch.update(pupilRef, {
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
  const termEl = document.getElementById('display-current-term');
  const sessionNameEl = document.getElementById('display-session-name');
  const sessionStartEl = document.getElementById('display-session-start');
  const sessionEndEl = document.getElementById('display-session-end');
  const resumptionEl = document.getElementById('display-next-resumption');
  const statusBadge = document.getElementById('session-status-badge');
  const sessionAlert = document.getElementById('session-end-alert');
  
  const termSelect = document.getElementById('current-term');
  const startYearInput = document.getElementById('session-start-year');
  const endYearInput = document.getElementById('session-end-year');
  const startDateInput = document.getElementById('session-start-date');
  const endDateInput = document.getElementById('session-end-date');
  const resumptionInput = document.getElementById('resumption-date');
  
  try {
    const settingsDoc = await db.collection('settings').doc('current').get();
    
    if (settingsDoc.exists) {
      const data = settingsDoc.data();
      
      // Handle both old format (string) and new format (object)
      let sessionName = '';
      let startYear = 2025;
      let endYear = 2026;
      let startDate = '';
      let endDate = '';
      
      if (data.currentSession && typeof data.currentSession === 'object') {
        // New format
        sessionName = data.currentSession.name || `${data.currentSession.startYear}/${data.currentSession.endYear}`;
        startYear = data.currentSession.startYear || 2025;
        endYear = data.currentSession.endYear || 2026;
        
        if (data.currentSession.startDate) {
          const startDateObj = data.currentSession.startDate.toDate ? data.currentSession.startDate.toDate() : new Date(data.currentSession.startDate);
          startDate = startDateObj.toISOString().split('T')[0];
          if (sessionStartEl) sessionStartEl.textContent = startDateObj.toLocaleDateString('en-GB');
        }
        
        if (data.currentSession.endDate) {
          const endDateObj = data.currentSession.endDate.toDate ? data.currentSession.endDate.toDate() : new Date(data.currentSession.endDate);
          endDate = endDateObj.toISOString().split('T')[0];
          if (sessionEndEl) sessionEndEl.textContent = endDateObj.toLocaleDateString('en-GB');
          
          // Check if session is ending soon (within 30 days)
          const today = new Date();
          const daysUntilEnd = Math.ceil((endDateObj - today) / (1000 * 60 * 60 * 24));
          
          if (daysUntilEnd < 0) {
            // Session has ended
            if (statusBadge) {
              statusBadge.textContent = 'Ended';
              statusBadge.classList.add('ended');
            }
            if (sessionAlert) {
              sessionAlert.style.display = 'block';
              sessionAlert.innerHTML = '<strong>🚨 Session Has Ended!</strong><p>Please start a new academic session below.</p>';
            }
          } else if (daysUntilEnd <= 30) {
            // Session ending soon
            if (statusBadge) {
              statusBadge.textContent = `Ending in ${daysUntilEnd} days`;
              statusBadge.classList.add('ending-soon');
            }
            if (sessionAlert) {
              sessionAlert.style.display = 'block';
            }
          } else {
            // Session active
            if (statusBadge) {
              statusBadge.textContent = 'Active';
              statusBadge.classList.remove('ending-soon', 'ended');
            }
            if (sessionAlert) {
              sessionAlert.style.display = 'none';
            }
          }
        }
      } else if (data.session) {
        // Old format - just a string like "2025/2026"
        sessionName = data.session;
        const years = data.session.split('/');
        if (years.length === 2) {
          startYear = parseInt(years[0]);
          endYear = parseInt(years[1]);
        }
        if (sessionStartEl) sessionStartEl.textContent = 'Not set (old format)';
        if (sessionEndEl) sessionEndEl.textContent = 'Not set (old format)';
      }
      
      // Display current values
      if (sessionNameEl) sessionNameEl.textContent = sessionName || 'Not set';
      if (termEl) termEl.textContent = data.term || 'Not set';
      
      // Resumption date
      let resumptionDate = '';
      if (data.resumptionDate) {
        if (data.resumptionDate.toDate) {
          const resDate = data.resumptionDate.toDate();
          resumptionDate = resDate.toISOString().split('T')[0];
          if (resumptionEl) resumptionEl.textContent = resDate.toLocaleDateString('en-GB');
        } else if (typeof data.resumptionDate === 'string') {
          resumptionDate = data.resumptionDate;
          if (resumptionEl) resumptionEl.textContent = new Date(data.resumptionDate).toLocaleDateString('en-GB');
        }
      } else {
        if (resumptionEl) resumptionEl.textContent = 'Not set';
      }
      
      // Populate form fields
      if (termSelect) termSelect.value = data.term || 'First Term';
      if (startYearInput) startYearInput.value = startYear;
      if (endYearInput) endYearInput.value = endYear;
      if (startDateInput) startDateInput.value = startDate;
      if (endDateInput) endDateInput.value = endDate;
      if (resumptionInput) resumptionInput.value = resumptionDate;
      
    } else {
      // No settings exist - create default
      if (sessionNameEl) sessionNameEl.textContent = 'Not set';
      if (termEl) termEl.textContent = 'Not set';
      if (sessionStartEl) sessionStartEl.textContent = 'Not set';
      if (sessionEndEl) sessionEndEl.textContent = 'Not set';
      if (resumptionEl) resumptionEl.textContent = 'Not set';
      
      if (termSelect) termSelect.value = 'First Term';
      if (startYearInput) startYearInput.value = new Date().getFullYear();
      if (endYearInput) endYearInput.value = new Date().getFullYear() + 1;
    }
    
    // Load session history
    await loadSessionHistory();
    
  } catch (error) {
    console.error('Error loading settings:', error);
    window.showToast?.('Failed to load current settings', 'danger');
  }
}

document.getElementById('settings-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const term = document.getElementById('current-term')?.value;
  const startYear = parseInt(document.getElementById('session-start-year')?.value);
  const endYear = parseInt(document.getElementById('session-end-year')?.value);
  const startDate = document.getElementById('session-start-date')?.value;
  const endDate = document.getElementById('session-end-date')?.value;
  const resumptionDate = document.getElementById('resumption-date')?.value;
  
  if (!term || !startYear || !endYear || !startDate || !endDate || !resumptionDate) {
    window.showToast?.('All fields are required', 'warning');
    return;
  }
  
  if (endYear <= startYear) {
    window.showToast?.('End year must be after start year', 'warning');
    return;
  }
  
  if (new Date(endDate) <= new Date(startDate)) {
    window.showToast?.('End date must be after start date', 'warning');
    return;
  }
  
  const submitBtn = e.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span class="btn-loading">Saving...</span>';
  
  try {
    const sessionData = {
      term,
      currentSession: {
        name: `${startYear}/${endYear}`,
        startYear,
        endYear,
        startDate: firebase.firestore.Timestamp.fromDate(new Date(startDate)),
        endDate: firebase.firestore.Timestamp.fromDate(new Date(endDate))
      },
      resumptionDate,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    await db.collection('settings').doc('current').set(sessionData, { merge: true });
    
    window.showToast?.('✓ School settings saved successfully!', 'success');
    loadCurrentSettings();
  } catch (error) {
    console.error('Error saving settings:', error);
    window.handleError(error, 'Failed to save settings');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '💾 Save Settings';
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
  checkboxContainer.innerHTML = '<p style="text-align:center; color:var(--color-gray-600);">Loading subjects...</p>';
  
  modal.style.display = 'block';
  
  try {
    // Get all available subjects
    const subjectsSnap = await db.collection('subjects').orderBy('name').get();
    
    if (subjectsSnap.empty) {
      checkboxContainer.innerHTML = '<p style="text-align:center; color:var(--color-gray-600);">No subjects available. Create subjects first in the Subjects section.</p>';
      return;
    }
    
    // Get current class subjects
    const classDoc = await db.collection('classes').doc(classId).get();
    const currentSubjects = classDoc.exists ? (classDoc.data().subjects || []) : [];
    
    // Render checkboxes
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
      label.htmlFor = `subject-${doc.id}`;
      label.textContent = subjectName;
      
      itemDiv.appendChild(checkbox);
      itemDiv.appendChild(label);
      checkboxContainer.appendChild(itemDiv);
    });
    
  } catch (error) {
    console.error('Error loading subjects for assignment:', error);
    checkboxContainer.innerHTML = '<p style="text-align:center; color:var(--color-danger);">Error loading subjects. Please try again.</p>';
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
  
  // Get selected subjects
  const checkboxes = document.querySelectorAll('#subject-checkboxes input[type="checkbox"]:checked');
  const selectedSubjects = Array.from(checkboxes).map(cb => cb.value);
  
  if (selectedSubjects.length === 0) {
    if (!confirm('No subjects selected. This will remove all subjects from this class. Continue?')) {
      return;
    }
  }
  
  try {
    // Step 1: Update the class document
    await db.collection('classes').doc(currentAssignmentClassId).update({
      subjects: selectedSubjects,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    // Step 2: Get class details for teacher info
    const classDoc = await db.collection('classes').doc(currentAssignmentClassId).get();
    const classData = classDoc.data();
    
    // Step 3: Get all pupils in this class
    const pupilsSnap = await db.collection('pupils')
      .where('class.id', '==', currentAssignmentClassId)
      .get();
    
    // Step 4: Update all pupils with the new subjects
    if (!pupilsSnap.empty) {
      const batch = db.batch();
      let updateCount = 0;
      
      pupilsSnap.forEach(pupilDoc => {
        const pupilRef = db.collection('pupils').doc(pupilDoc.id);
        batch.update(pupilRef, {
          subjects: selectedSubjects,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        updateCount++;
        
        // Firestore batch limit is 500 operations
        if (updateCount >= 500) {
          console.warn('Batch limit reached. Some pupils may not be updated.');
        }
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
    
    // Step 5: Update assigned teacher's view (if teacher exists)
    if (classData.teacherId) {
      // Teacher will see the changes automatically when they reload or through real-time listeners
      console.log(`Class teacher (${classData.teacherId}) will see updated subjects on next load`);
    }
    
    // Close modal and refresh
    closeSubjectAssignmentModal();
    loadClasses();
    
  } catch (error) {
    console.error('Error saving subjects:', error);
    window.handleError(error, 'Failed to save subjects');
  }
}

// Close modal when clicking outside
window.addEventListener('click', (event) => {
  const modal = document.getElementById('subject-assignment-modal');
  if (event.target === modal) {
    closeSubjectAssignmentModal();
  }
});

/* ======================================== 
   SESSION MANAGEMENT & TRANSITIONS
======================================== */

async function loadSessionHistory() {
  const tbody = document.getElementById('session-history-table');
  if (!tbody) return;
  
  tbody.innerHTML = '<tr><td colspan="4" class="table-loading">Loading history...</td></tr>';
  
  try {
    const sessionsSnap = await db.collection('sessions')
      .orderBy('startDate', 'desc')
      .limit(10)
      .get();
    
    tbody.innerHTML = '';
    
    if (sessionsSnap.empty) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--color-gray-600);">No session history yet</td></tr>';
      return;
    }
    
    sessionsSnap.forEach(doc => {
      const data = doc.data();
      const startDate = data.startDate?.toDate ? data.startDate.toDate().toLocaleDateString('en-GB') : 'N/A';
      const endDate = data.endDate?.toDate ? data.endDate.toDate().toLocaleDateString('en-GB') : 'N/A';
      const status = data.status === 'archived' ? '<span style="color:var(--color-gray-600);">Archived</span>' : '<span style="color:var(--color-success);font-weight:600;">Active</span>';
      
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td data-label="Session">${data.name || 'N/A'}</td>
        <td data-label="Start Date">${startDate}</td>
        <td data-label="End Date">${endDate}</td>
        <td data-label="Status">${status}</td>
      `;
      tbody.appendChild(tr);
    });
    
  } catch (error) {
    console.error('Error loading session history:', error);
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--color-danger);">Error loading history</td></tr>';
  }
}

function confirmStartNewSession() {
  const confirmation = confirm(
    '🎓 START NEW ACADEMIC SESSION\n\n' +
    'This will:\n' +
    '✓ Archive the current session\n' +
    '✓ Create a new session (next academic year)\n' +
    '✓ Reset term to "First Term"\n' +
    '✓ Enable class promotion period\n\n' +
    '⚠️ This action should only be done at the end of the academic year.\n\n' +
    'Are you sure you want to continue?'
  );
  
  if (confirmation) {
    startNewAcademicSession();
  }
}

async function startNewAcademicSession() {
  const startBtn = document.getElementById('start-new-session-btn');
  if (startBtn) {
    startBtn.disabled = true;
    startBtn.innerHTML = '<span class="btn-loading">Starting new session...</span>';
  }
  
  try {
    // Step 1: Get current session
    const settingsDoc = await db.collection('settings').doc('current').get();
    
    if (!settingsDoc.exists) {
      window.showToast?.('No current session found. Please set up session first.', 'warning');
      return;
    }
    
    const currentData = settingsDoc.data();
    const currentSession = currentData.currentSession;
    
    if (!currentSession || typeof currentSession !== 'object') {
      window.showToast?.('Current session format is invalid. Please update settings first.', 'warning');
      return;
    }
    
    // Step 2: Archive current session
    await db.collection('sessions').doc(currentSession.name.replace('/', '-')).set({
      name: currentSession.name,
      startYear: currentSession.startYear,
      endYear: currentSession.endYear,
      startDate: currentSession.startDate,
      endDate: currentSession.endDate,
      status: 'archived',
      archivedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    // Step 3: Calculate new session dates
    const newStartYear = currentSession.endYear;
    const newEndYear = currentSession.endYear + 1;
    const newSessionName = `${newStartYear}/${newEndYear}`;
    
    // Set new session to start in September of the new year
    const newStartDate = new Date(newStartYear, 8, 1); // September 1st
    const newEndDate = new Date(newEndYear, 6, 31); // July 31st
    
    // Step 4: Update current session
    await db.collection('settings').doc('current').set({
      term: 'First Term',
      currentSession: {
        name: newSessionName,
        startYear: newStartYear,
        endYear: newEndYear,
        startDate: firebase.firestore.Timestamp.fromDate(newStartDate),
        endDate: firebase.firestore.Timestamp.fromDate(newEndDate)
      },
      resumptionDate: newStartDate.toISOString().split('T')[0],
      promotionPeriodActive: true, // Enable promotion period
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    
    // Step 5: Create new session record
    await db.collection('sessions').doc(newSessionName.replace('/', '-')).set({
      name: newSessionName,
      startYear: newStartYear,
      endYear: newEndYear,
      startDate: firebase.firestore.Timestamp.fromDate(newStartDate),
      endDate: firebase.firestore.Timestamp.fromDate(newEndDate),
      status: 'active',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    window.showToast?.(
      `✓ New session "${newSessionName}" started successfully!\nPromotion period is now active for teachers.`,
      'success',
      8000
    );
    
    // Reload settings
    await loadCurrentSettings();
    
  } catch (error) {
    console.error('Error starting new session:', error);
    window.handleError(error, 'Failed to start new session');
  } finally {
    if (startBtn) {
      startBtn.disabled = false;
      startBtn.innerHTML = '🚀 Start New Session';
    }
  }
}

// Check session status on dashboard load
async function checkSessionStatus() {
  try {
    const settingsDoc = await db.collection('settings').doc('current').get();
    
    if (!settingsDoc.exists) return;
    
    const data = settingsDoc.data();
    const currentSession = data.currentSession;
    
    if (!currentSession || typeof currentSession !== 'object' || !currentSession.endDate) {
      return;
    }
    
    const endDate = currentSession.endDate.toDate();
    const today = new Date();
    const daysUntilEnd = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));
    
    // Show notification if session has ended
    if (daysUntilEnd < 0) {
      window.showToast?.(
        '🚨 Academic session has ended! Please start a new session in School Settings.',
        'warning',
        10000
      );
    } else if (daysUntilEnd <= 30 && daysUntilEnd > 0) {
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
  
  console.log('✓ Admin portal initialized (v6.1.0 - CLASS HANDLING FIXED)');
});
