/**
 * FAHMID NURSERY & PRIMARY SCHOOL
 * Teacher Portal JavaScript - FIXED
 * 
 * @version 8.0.0 - DUPLICATE CODE REMOVED
 * @date 2026-01-05
 */
'use strict';

// Use shared Firebase instances from firebase-auth.js
const db = window.db;
const auth = window.auth;

let currentUser = null;
let assignedClasses = [];
let allPupils = [];
let allSubjects = [];

/* ======================================== 
   INITIALIZATION 
======================================== */

window.checkRole('teacher')
  .then(async user => {
    currentUser = user;
    const info = document.getElementById('teacher-info');
    if (info) info.innerHTML = `Logged in as:<br><strong>${user.email}</strong>`;
    
    await loadAssignedClasses();
    await loadSubjects();
    initTeacherPortal();
  })
  .catch(() => {});

document.getElementById('teacher-logout')?.addEventListener('click', e => {
  e.preventDefault();
  window.logout();
});

/* ======================================== 
   CORE DATA LOADING 
======================================== */

async function loadAssignedClasses() {
  try {
    const snap = await db.collection('classes')
      .where('teacherId', '==', currentUser.uid)
      .get();
    
    assignedClasses = snap.docs.map(doc => ({
      id: doc.id,
      name: doc.data().name,
      subjects: doc.data().subjects || []  // NEW: Include subjects
    }));
    
    assignedClasses.sort((a, b) => a.name.localeCompare(b.name));
    
    if (assignedClasses.length === 0) {
      window.showToast?.('No classes assigned yet. Contact admin.', 'warning', 8000);
      allPupils = [];
      allSubjects = [];  // Clear subjects if no classes
      return;
    }
    
    // NEW: Collect all unique subjects from assigned classes
    const subjectSet = new Set();
    assignedClasses.forEach(cls => {
      if (cls.subjects && Array.isArray(cls.subjects)) {
        cls.subjects.forEach(subject => subjectSet.add(subject));
      }
    });
    allSubjects = Array.from(subjectSet).sort();
    
    // Load pupils in batches (Firestore 'in' limit = 10)
    const classIds = assignedClasses.map(c => c.id);
    allPupils = [];

    for (let i = 0; i < classIds.length; i += 10) {
      const batch = classIds.slice(i, i + 10);
      const pupilsSnap = await db.collection('pupils')
        .where('class.id', 'in', batch)
        .get();
      
      const batchPupils = pupilsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      allPupils = allPupils.concat(batchPupils);
    }
    
    allPupils.sort((a, b) => a.name.localeCompare(b.name));
    
    console.log(`✓ Loaded ${assignedClasses.length} class(es), ${allPupils.length} pupil(s), ${allSubjects.length} subject(s)`);
    
  } catch (err) {
    console.error('Error loading assigned classes:', err);
    window.handleError(err, 'Failed to load your classes');
    assignedClasses = [];
    allPupils = [];
    allSubjects = [];
  }
}

async function loadSubjects() {
  try {
    const snap = await db.collection('subjects').get();
    allSubjects = snap.docs.map(d => d.data().name); // no hardcoded fallback
    allSubjects.sort();
  } catch (err) {
    console.error('Error loading subjects:', err);
    allSubjects = []; // empty array, teacher will see “no subjects”
  }
}

/* ======================================== 
   PAGINATION 
======================================== */

function paginateTable(data, tbodyId, itemsPerPage = 20, renderRowCallback) {
  const tbody = document.querySelector(`#${tbodyId} tbody`);
  if (!tbody) return;
  
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
    let paginationContainer = document.getElementById(`pagination-${tbodyId}`);
    
    if (!paginationContainer) {
      paginationContainer = document.createElement('div');
      paginationContainer.className = 'pagination';
      paginationContainer.id = `pagination-${tbodyId}`;
      tbody.parentElement.parentElement.appendChild(paginationContainer);
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

const sectionLoaders = {
  dashboard: loadTeacherDashboard,
  'my-classes': loadMyClassesSection,
  'enter-results': loadResultsSection,
  attendance: loadAttendanceSection,
  'traits-skills': loadTraitsSection,
  remarks: loadRemarksSection
};

function showSection(sectionId) {
  document.querySelectorAll('.admin-card').forEach(card => card.style.display = 'none');
  
  const section = document.getElementById(sectionId);
  if (section) section.style.display = 'block';
  
  document.querySelectorAll('.admin-sidebar a[data-section]').forEach(link => {
    link.classList.toggle('active', link.dataset.section === sectionId);
  });
  
  if (typeof sectionLoaders[sectionId] === 'function') {
    sectionLoaders[sectionId]();
  }
  
  // Close mobile sidebar
  const sidebar = document.getElementById('teacher-sidebar');
  const hamburger = document.getElementById('hamburger');
  if (sidebar?.classList.contains('active')) {
    sidebar.classList.remove('active');
    hamburger?.classList.remove('active');
    hamburger?.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }
}

/* ======================================== 
   INITIALIZATION 
======================================== */

function initTeacherPortal() {
  setupAllEventListeners();
  
  window.getCurrentSettings().then(settings => {
    // Set default term in all selects
    ['result-term', 'attendance-term', 'traits-term', 'remarks-term'].forEach(id => {
      const select = document.getElementById(id);
      if (select) select.value = settings.term;
    });
    
    showSection('dashboard');
    console.log('✓ Teacher portal ready (v8.0.0) - Current term:', settings.term);
    
    // Setup sidebar navigation
    document.querySelectorAll('.admin-sidebar a[data-section]').forEach(link => {
      link.addEventListener('click', e => {
        e.preventDefault();
        const section = link.dataset.section;
        if (section) showSection(section);
      });
    });
  }).catch(error => {
    console.error('Failed to load settings:', error);
    showSection('dashboard');
  });
}

function setupAllEventListeners() {
  // Save buttons
  document.getElementById('save-results-btn')?.addEventListener('click', saveAllResults);
  document.getElementById('save-attendance-btn')?.addEventListener('click', saveAllAttendance);
  document.getElementById('save-traits-btn')?.addEventListener('click', saveTraitsAndSkills);
  document.getElementById('save-remarks-btn')?.addEventListener('click', saveRemarks);
  
  // Results
  document.getElementById('result-term')?.addEventListener('change', loadResultsTable);
  document.getElementById('result-subject')?.addEventListener('change', loadResultsTable);
  
  // Traits
  document.getElementById('traits-pupil')?.addEventListener('change', loadTraitsData);
  document.getElementById('traits-term')?.addEventListener('change', () => {
    if (document.getElementById('traits-pupil')?.value) loadTraitsData();
  });
  
  // Remarks
  document.getElementById('remarks-pupil')?.addEventListener('change', loadRemarksData);
  document.getElementById('remarks-term')?.addEventListener('change', () => {
    if (document.getElementById('remarks-pupil')?.value) loadRemarksData();
  });
  
  // Attendance
  document.getElementById('attendance-term')?.addEventListener('change', loadAttendanceSection);
  
  console.log('✓ All event listeners connected');
}

/* ======================================== 
   DASHBOARD 
======================================== */

async function loadTeacherDashboard() {
  const classCountEl = document.getElementById('my-class-count');
  const pupilCountEl = document.getElementById('my-pupil-count');
  
  const classCount = assignedClasses.length;
  const pupilCount = allPupils.length;
  
  // Update dashboard stats
  if (classCountEl) classCountEl.textContent = classCount;
  if (pupilCountEl) pupilCountEl.textContent = pupilCount;
  
  // Update header stats
  const headerClassCount = document.getElementById('header-class-count');
  const headerPupilCount = document.getElementById('header-pupil-count');
  
  if (headerClassCount) headerClassCount.textContent = classCount;
  if (headerPupilCount) headerPupilCount.textContent = pupilCount;
}

/* ======================================== 
   MY CLASSES 
======================================== */

function loadMyClassesSection() {
  const table = document.getElementById('pupils-in-class-table');
  if (!table) return;
  
  const tbody = table.querySelector('tbody');
  
  if (assignedClasses.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:var(--color-gray-600);">No classes assigned</td></tr>';
    return;
  }
  
  if (allPupils.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:var(--color-gray-600);">No pupils in your classes</td></tr>';
    return;
  }
  
  paginateTable(allPupils, 'pupils-in-class-table', 20, (pupil, tbodyEl) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td data-label="Name">${pupil.name}</td>
      <td data-label="Gender">${pupil.gender || '-'}</td>
      <td data-label="Admission No">${pupil.admissionNo || '-'}</td>
    `;
    tbodyEl.appendChild(tr);
  });
}

/* ======================================== 
   RESULTS 
======================================== */

async function loadResultsSection() {
  const container = document.getElementById('results-entry-table-container');
  const saveBtn = document.getElementById('save-results-btn');
  
  if (!container || !saveBtn) return;
  
  if (assignedClasses.length === 0 || allPupils.length === 0) {
    container.innerHTML = '<p style="text-align:center; color:var(--color-gray-600);">No pupils in your classes</p>';
    saveBtn.hidden = true;
    return;
  }
  
  const subjectSelect = document.getElementById('result-subject');
  if (subjectSelect) {
    subjectSelect.innerHTML = '<option value="">-- Select Subject --</option>';
    allSubjects.forEach(sub => {
      const opt = document.createElement('option');
      opt.value = sub;
      opt.textContent = sub;
      subjectSelect.appendChild(opt);
    });
  }
  
  await loadResultsTable();
}

async function loadResultsTable() {
  const container = document.getElementById('results-entry-table-container');
  const saveBtn = document.getElementById('save-results-btn');
  const term = document.getElementById('result-term')?.value;
  const subject = document.getElementById('result-subject')?.value;
  
  if (!container || !term || !subject) {
    container.innerHTML = '';
    if (saveBtn) saveBtn.hidden = true;
    return;
  }
  
  try {
    const resultsMap = {};
    const resultsSnapshot = await db.collection('results')
      .where('term', '==', term)
      .where('subject', '==', subject)
      .get();
    
    resultsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.pupilId) {
        resultsMap[data.pupilId] = {
          ca: data.caScore || 0,
          exam: data.examScore || 0
        };
      }
    });
    
    container.innerHTML = `
      <div class="table-container">
        <table class="responsive-table" id="results-table">
          <thead>
            <tr>
              <th>Pupil Name</th>
              <th>CA Score (40)</th>
              <th>Exam Score (60)</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
    `;
    
    paginateTable(allPupils, 'results-table', 20, (pupil, tbody) => {
      const existing = resultsMap[pupil.id] || { ca: 0, exam: 0 };
      const total = existing.ca + existing.exam;
      
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${pupil.name}</td>
        <td>
          <input type="number" min="0" max="40" value="${existing.ca || ''}" 
                 data-pupil="${pupil.id}" data-field="ca" style="width:90px;">
        </td>
        <td>
          <input type="number" min="0" max="60" value="${existing.exam || ''}" 
                 data-pupil="${pupil.id}" data-field="exam" style="width:90px;">
        </td>
        <td>${total > 0 ? total : '-'}</td>
      `;
      tbody.appendChild(tr);
    });
    
    if (saveBtn) saveBtn.hidden = false;
    
    // Update totals on input change
    container.querySelectorAll('input').forEach(input => {
      input.addEventListener('input', () => {
        const row = input.closest('tr');
        const ca = parseFloat(row.querySelector('[data-field="ca"]')?.value) || 0;
        const exam = parseFloat(row.querySelector('[data-field="exam"]')?.value) || 0;
        row.querySelector('td:last-child').textContent = ca + exam > 0 ? ca + exam : '-';
      });
    });
  } catch (err) {
    window.handleError(err, 'Failed to load results');
    container.innerHTML = '<p style="text-align:center; color:var(--color-danger);">Error loading results</p>';
    if (saveBtn) saveBtn.hidden = true;
  }
}

async function saveAllResults() {
  const inputs = document.querySelectorAll('#results-entry-table-container input[type="number"]');
  const term = document.getElementById('result-term')?.value;
  const subject = document.getElementById('result-subject')?.value;
  
  if (!term || !subject) {
    window.showToast?.('Select term and subject', 'warning');
    return;
  }
  
  const batch = db.batch();
  let hasChanges = false;
  
  inputs.forEach(input => {
    const pupilId = input.dataset.pupil;
    const field = input.dataset.field;
    const value = parseFloat(input.value) || 0;
    
    if (value > 0) hasChanges = true;
    
    const docId = `${pupilId}_${term}_${subject}`;
    const ref = db.collection('results').doc(docId);
    
    if (field === 'ca') {
      batch.set(ref, {
        pupilId, term, subject,
        caScore: value,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    } else {
      batch.set(ref, {
        pupilId, term, subject,
        examScore: value,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    }
  });
  
  if (!hasChanges) {
    window.showToast?.('No scores entered', 'warning');
    return;
  }
  
  try {
    await batch.commit();
    window.showToast?.('✓ All results saved successfully', 'success');
  } catch (err) {
    window.handleError(err, 'Failed to save results');
  }
}

/* ======================================== 
   ATTENDANCE 
======================================== */

async function loadAttendanceSection() {
  const container = document.getElementById('attendance-form-container');
  const saveBtn = document.getElementById('save-attendance-btn');
  const term = document.getElementById('attendance-term')?.value || 'First Term';
  
  if (!container || !saveBtn) return;
  
  if (assignedClasses.length === 0 || allPupils.length === 0) {
    container.innerHTML = '<p style="text-align:center; color:var(--color-gray-600);">No pupils in assigned classes</p>';
    saveBtn.hidden = true;
    return;
  }
  
  try {
    const attendanceMap = {};
    
    for (const pupil of allPupils) {
      const docId = `${pupil.id}_${term}`;
      const attendDoc = await db.collection('attendance').doc(docId).get();
      
      if (attendDoc.exists) {
        const data = attendDoc.data();
        attendanceMap[pupil.id] = {
          timesOpened: data.timesOpened || 0,
          timesPresent: data.timesPresent || 0,
          timesAbsent: data.timesAbsent || 0
        };
      }
    }
    
    container.innerHTML = `
      <div class="table-container">
        <table class="responsive-table" id="attendance-table">
          <thead>
            <tr>
              <th>Pupil Name</th>
              <th>Times Opened</th>
              <th>Times Present</th>
              <th>Times Absent</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
    `;
    
    paginateTable(allPupils, 'attendance-table', 25, (pupil, tbody) => {
      const existing = attendanceMap[pupil.id] || { timesOpened: 0, timesPresent: 0, timesAbsent: 0 };
      
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${pupil.name}</td>
        <td>
          <input type="number" min="0" value="${existing.timesOpened || ''}" 
                 data-pupil="${pupil.id}" data-field="timesOpened" style="width:80px;">
        </td>
        <td>
          <input type="number" min="0" value="${existing.timesPresent || ''}" 
                 data-pupil="${pupil.id}" data-field="timesPresent" style="width:80px;">
        </td>
        <td>
          <input type="number" min="0" value="${existing.timesAbsent || ''}" 
                 data-pupil="${pupil.id}" data-field="timesAbsent" style="width:80px;">
        </td>
      `;
      tbody.appendChild(tr);
    });
    
    saveBtn.hidden = false;
  } catch (err) {
    window.handleError(err, 'Failed to load attendance');
    container.innerHTML = '<p style="text-align:center; color:var(--color-danger);">Error loading attendance</p>';
    saveBtn.hidden = true;
  }
}

async function saveAllAttendance() {
  const inputs = document.querySelectorAll('#attendance-form-container input[type="number"]');
  const term = document.getElementById('attendance-term')?.value;
  
  if (!inputs.length || !term) {
    window.showToast?.('No data to save', 'warning');
    return;
  }
  
  const batch = db.batch();
  const pupilData = {};
  
  inputs.forEach(input => {
    const pupilId = input.dataset.pupil;
    const field = input.dataset.field;
    const value = parseInt(input.value) || 0;
    
    if (!pupilData[pupilId]) pupilData[pupilId] = {};
    pupilData[pupilId][field] = value;
  });
  
  for (const [pupilId, data] of Object.entries(pupilData)) {
    const ref = db.collection('attendance').doc(`${pupilId}_${term}`);
    batch.set(ref, {
      pupilId,
      term,
      teacherId: currentUser.uid,
      ...data,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  }
  
  try {
    await batch.commit();
    window.showToast?.('✓ Attendance saved successfully', 'success');
  } catch (err) {
    window.handleError(err, 'Failed to save attendance');
  }
}

/* ======================================== 
   TRAITS & SKILLS 
======================================== */

function loadTraitsSection() {
  const pupilSelect = document.getElementById('traits-pupil');
  const container = document.getElementById('traits-form-container');
  
  if (!pupilSelect || !container) return;
  
  pupilSelect.innerHTML = '<option value="">-- Select Pupil --</option>';
  
  if (allPupils.length === 0) {
    container.hidden = true;
    return;
  }
  
  allPupils.forEach(pupil => {
    const opt = document.createElement('option');
    opt.value = pupil.id;
    opt.textContent = pupil.name;
    pupilSelect.appendChild(opt);
  });
  
  container.hidden = true;
}

async function loadTraitsData() {
  const pupilId = document.getElementById('traits-pupil')?.value;
  const term = document.getElementById('traits-term')?.value;
  const container = document.getElementById('traits-form-container');
  
  if (!container || !pupilId || !term) {
    container.hidden = true;
    return;
  }
  
  container.hidden = false;
  
  const traitFields = ['punctuality','neatness','politeness','honesty','obedience','cooperation','attentiveness','leadership','selfcontrol','creativity'];
  const skillFields = ['handwriting','drawing','sports','craft','verbal','coordination'];
  
  try {
    const traitsSnap = await db.collection('behavioral_traits').doc(`${pupilId}_${term}`).get();
    const traitsData = traitsSnap.exists ? traitsSnap.data() : {};
    
    traitFields.forEach(f => {
      const el = document.getElementById(`trait-${f}`);
      if (el) el.value = traitsData[f] || '';
    });
    
    const skillsSnap = await db.collection('psychomotor_skills').doc(`${pupilId}_${term}`).get();
    const skillsData = skillsSnap.exists ? skillsSnap.data() : {};
    
    skillFields.forEach(f => {
      const el = document.getElementById(`skill-${f}`);
      if (el) el.value = skillsData[f] || '';
    });
  } catch (err) {
    window.handleError(err, 'Failed to load traits/skills');
  }
}

async function saveTraitsAndSkills() {
  const pupilId = document.getElementById('traits-pupil')?.value;
  const term = document.getElementById('traits-term')?.value;
  
  if (!pupilId || !term) {
    window.showToast?.('Select pupil and term', 'warning');
    return;
  }
  
  const traitFields = ['punctuality','neatness','politeness','honesty','obedience','cooperation','attentiveness','leadership','selfcontrol','creativity'];
  const skillFields = ['handwriting','drawing','sports','craft','verbal','coordination'];
  
  const traitsData = { pupilId, term, teacherId: currentUser.uid };
  traitFields.forEach(f => {
    traitsData[f] = document.getElementById(`trait-${f}`).value.trim();
  });
  traitsData.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
  
  const skillsData = { pupilId, term, teacherId: currentUser.uid };
  skillFields.forEach(f => {
    skillsData[f] = document.getElementById(`skill-${f}`).value.trim();
  });
  skillsData.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
  
  try {
    await db.collection('behavioral_traits').doc(`${pupilId}_${term}`).set(traitsData, { merge: true });
    await db.collection('psychomotor_skills').doc(`${pupilId}_${term}`).set(skillsData, { merge: true });
    window.showToast?.('✓ Traits & skills saved', 'success');
  } catch (err) {
    window.handleError(err, 'Failed to save traits & skills');
  }
}

/* ======================================== 
   REMARKS 
======================================== */

function loadRemarksSection() {
  const pupilSelect = document.getElementById('remarks-pupil');
  const container = document.getElementById('remarks-form-container');
  
  if (!pupilSelect || !container) return;
  
  pupilSelect.innerHTML = '<option value="">-- Select Pupil --</option>';
  
  if (allPupils.length === 0) {
    container.hidden = true;
    return;
  }
  
  allPupils.forEach(pupil => {
    const opt = document.createElement('option');
    opt.value = pupil.id;
    opt.textContent = pupil.name;
    pupilSelect.appendChild(opt);
  });
  
  container.hidden = true;
}

async function loadRemarksData() {
  const pupilId = document.getElementById('remarks-pupil')?.value;
  const term = document.getElementById('remarks-term')?.value;
  const container = document.getElementById('remarks-form-container');
  
  if (!container || !pupilId || !term) {
    container.hidden = true;
    return;
  }
  
  try {
    const docSnap = await db.collection('remarks').doc(`${pupilId}_${term}`).get();
    const data = docSnap.exists ? docSnap.data() : {};
    
    document.getElementById('teacher-remark').value = data.teacherRemark || '';
    document.getElementById('head-remark').value = data.headRemark || '';
    
    container.hidden = false;
  } catch (err) {
    window.handleError(err, 'Failed to load remarks');
    container.hidden = true;
  }
}

async function saveRemarks() {
  const pupilId = document.getElementById('remarks-pupil')?.value;
  const term = document.getElementById('remarks-term')?.value;
  const teacherRemark = document.getElementById('teacher-remark')?.value.trim();
  const headRemark = document.getElementById('head-remark')?.value.trim();
  
  if (!pupilId || !term) {
    window.showToast?.('Select pupil and term', 'warning');
    return;
  }
  
  if (!teacherRemark && !headRemark) {
    window.showToast?.('Enter at least one remark', 'warning');
    return;
  }
  
  const data = {
    pupilId,
    term,
    teacherId: currentUser.uid,
    teacherRemark,
    headRemark,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };
  
  try {
    await db.collection('remarks').doc(`${pupilId}_${term}`).set(data, { merge: true });
    window.showToast?.('✓ Remarks saved', 'success');
  } catch (err) {
    window.handleError(err, 'Failed to save remarks');
  }
}

console.log('✓ Teacher portal v8.0.0 loaded - DUPLICATE CODE REMOVED');