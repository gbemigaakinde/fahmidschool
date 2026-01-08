/**
 * FAHMID NURSERY & PRIMARY SCHOOL
 * Teacher Portal JavaScript - DEBUGGED & FIXED
 * 
 * @version 8.1.0 - RACE CONDITIONS FIXED
 * @date 2026-01-08
 * 
 * FIXES:
 * - Race condition in data loading resolved
 * - Initialization order corrected
 * - Defensive checks added for all data access
 * - Proper loading state management
 */
'use strict';

const db = window.db;
const auth = window.auth;

let currentUser = null;
let assignedClasses = [];
let allPupils = [];
let allSubjects = [];

// FIXED: Add initialization state flags
let dataLoaded = false;
let isLoadingData = false;

/* ======================================== 
   INITIALIZATION WITH PROPER ORDER
======================================== */

window.checkRole('teacher')
  .then(async user => {
    currentUser = user;
    const info = document.getElementById('teacher-info');
    if (info) info.innerHTML = `Logged in as:<br><strong>${user.email}</strong>`;
    
    // FIXED: Load data first, then initialize
    try {
      isLoadingData = true;
      await loadAssignedClasses();
      await loadSubjects();
      dataLoaded = true;
      isLoadingData = false;
      
      // Now safe to initialize portal
      initTeacherPortal();
    } catch (error) {
      console.error('Error during initialization:', error);
      isLoadingData = false;
      window.showToast?.('Failed to load teacher data. Please refresh.', 'danger');
    }
  })
  .catch(() => {});

document.getElementById('teacher-logout')?.addEventListener('click', e => {
  e.preventDefault();
  window.logout();
});

/* ======================================== 
   DATA LOADING WITH STATE MANAGEMENT
======================================== */

async function loadAssignedClasses() {
  if (!currentUser) {
    console.warn('loadAssignedClasses called before user is set');
    return;
  }
  
  try {
    const snap = await db.collection('classes')
      .where('teacherId', '==', currentUser.uid)
      .get();
    
    assignedClasses = snap.docs.map(doc => ({
      id: doc.id,
      name: doc.data().name || 'Unnamed Class',
      subjects: Array.isArray(doc.data().subjects) ? doc.data().subjects : []
    }));
    
    assignedClasses.sort((a, b) => a.name.localeCompare(b.name));
    
    if (assignedClasses.length === 0) {
      window.showToast?.('No classes assigned yet. Contact admin.', 'warning', 8000);
      allPupils = [];
      allSubjects = [];
      return;
    }
    
    // Collect all unique subjects from assigned classes
    const subjectSet = new Set();
    assignedClasses.forEach(cls => {
      if (cls.subjects && Array.isArray(cls.subjects)) {
        cls.subjects.forEach(subject => subjectSet.add(subject));
      }
    });
    allSubjects = Array.from(subjectSet).sort();
    
    // Load pupils in batches
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
    
    allPupils.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    
    console.log(`✓ Loaded ${assignedClasses.length} class(es), ${allPupils.length} pupil(s), ${allSubjects.length} subject(s)`);
    
  } catch (err) {
    console.error('Error loading assigned classes:', err);
    window.handleError?.(err, 'Failed to load your classes');
    assignedClasses = [];
    allPupils = [];
    allSubjects = [];
    throw err; // Re-throw to stop initialization
  }
}

async function loadSubjects() {
  // Subjects are loaded from assigned classes in loadAssignedClasses()
  console.log('✓ Subjects loaded from assigned classes:', allSubjects.length);
}

/* ======================================== 
   DEFENSIVE DATA ACCESS HELPERS
======================================== */

function ensureDataLoaded(functionName) {
  if (isLoadingData) {
    console.log(`${functionName} called while data is loading - please wait`);
    window.showToast?.('Loading data, please wait...', 'info', 2000);
    return false;
  }
  
  if (!dataLoaded) {
    console.warn(`${functionName} called before data is loaded`);
    window.showToast?.('Data not loaded yet. Please refresh the page.', 'warning');
    return false;
  }
  
  return true;
}

function getValidPupils() {
  if (!ensureDataLoaded('getValidPupils')) return [];
  return Array.isArray(allPupils) ? allPupils : [];
}

function getValidClasses() {
  if (!ensureDataLoaded('getValidClasses')) return [];
  return Array.isArray(assignedClasses) ? assignedClasses : [];
}

function getValidSubjects() {
  if (!ensureDataLoaded('getValidSubjects')) return [];
  return Array.isArray(allSubjects) ? allSubjects : [];
}

/* ======================================== 
   PAGINATION WITH DEFENSIVE CHECKS
======================================== */

function paginateTable(data, tbodyId, itemsPerPage = 20, renderRowCallback) {
  const tbody = document.querySelector(`#${tbodyId} tbody`);
  if (!tbody) {
    console.error(`Tbody not found: #${tbodyId} tbody`);
    return;
  }
  
  if (!Array.isArray(data)) {
    console.error('paginateTable: data must be an array');
    tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; color: var(--color-danger);">Invalid data format</td></tr>';
    return;
  }
  
  let currentPage = 1;
  const totalPages = Math.ceil(data.length / itemsPerPage) || 1;
  
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
    let paginationContainer = document.getElementById(`pagination-${tbodyId}`);
    
    if (!paginationContainer) {
      const table = tbody.parentElement;
      if (!table || !table.parentElement) return;
      
      paginationContainer = document.createElement('div');
      paginationContainer.className = 'pagination';
      paginationContainer.id = `pagination-${tbodyId}`;
      table.parentElement.appendChild(paginationContainer);
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
   SECTION NAVIGATION WITH SAFETY CHECKS
======================================== */

const sectionLoaders = {
  dashboard: loadTeacherDashboard,
  'my-classes': loadMyClassesSection,
  'enter-results': loadResultsSection,
  attendance: loadAttendanceSection,
  'traits-skills': loadTraitsSection,
  remarks: loadRemarksSection,
  promotions: loadPromotionSection
};

function showSection(sectionId) {
  if (!sectionId) {
    console.error('showSection called with no sectionId');
    return;
  }
  
  // FIXED: Check if data is loaded before showing sections
  if (!dataLoaded && sectionId !== 'dashboard') {
    window.showToast?.('Please wait for data to finish loading...', 'info', 3000);
    return;
  }
  
  document.querySelectorAll('.admin-card').forEach(card => card.style.display = 'none');
  
  const section = document.getElementById(sectionId);
  if (section) {
    section.style.display = 'block';
  } else {
    console.warn(`Section ${sectionId} not found`);
  }
  
  document.querySelectorAll('.admin-sidebar a[data-section]').forEach(link => {
    link.classList.toggle('active', link.dataset.section === sectionId);
  });
  
  // FIXED: Safe loader execution
  if (typeof sectionLoaders[sectionId] === 'function') {
    try {
      sectionLoaders[sectionId]();
    } catch (error) {
      console.error(`Error loading section ${sectionId}:`, error);
      window.showToast?.(`Failed to load ${sectionId}`, 'danger');
    }
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
   PORTAL INITIALIZATION
======================================== */

function initTeacherPortal() {
  if (!dataLoaded) {
    console.error('initTeacherPortal called before data loaded');
    return;
  }
  
  setupAllEventListeners();
  
  window.getCurrentSettings().then(settings => {
    // Set default term in all selects
    ['result-term', 'attendance-term', 'traits-term', 'remarks-term'].forEach(id => {
      const select = document.getElementById(id);
      if (select) select.value = settings.term;
    });
    
    showSection('dashboard');
    console.log('✓ Teacher portal ready (v8.1.0) - Current term:', settings.term);
    
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
  // FIXED: Add existence checks for all elements
  const saveResultsBtn = document.getElementById('save-results-btn');
  const saveAttendanceBtn = document.getElementById('save-attendance-btn');
  const saveTraitsBtn = document.getElementById('save-traits-btn');
  const saveRemarksBtn = document.getElementById('save-remarks-btn');
  
  if (saveResultsBtn) saveResultsBtn.addEventListener('click', saveAllResults);
  if (saveAttendanceBtn) saveAttendanceBtn.addEventListener('click', saveAllAttendance);
  if (saveTraitsBtn) saveTraitsBtn.addEventListener('click', saveTraitsAndSkills);
  if (saveRemarksBtn) saveRemarksBtn.addEventListener('click', saveRemarks);
  
  // Results
  const resultTerm = document.getElementById('result-term');
  const resultSubject = document.getElementById('result-subject');
  if (resultTerm) resultTerm.addEventListener('change', loadResultsTable);
  if (resultSubject) resultSubject.addEventListener('change', loadResultsTable);
  
  // Traits
  const traitsPupil = document.getElementById('traits-pupil');
  const traitsTerm = document.getElementById('traits-term');
  if (traitsPupil) traitsPupil.addEventListener('change', loadTraitsData);
  if (traitsTerm) traitsTerm.addEventListener('change', () => {
    if (traitsPupil?.value) loadTraitsData();
  });
  
  // Remarks
  const remarksPupil = document.getElementById('remarks-pupil');
  const remarksTerm = document.getElementById('remarks-term');
  if (remarksPupil) remarksPupil.addEventListener('change', loadRemarksData);
  if (remarksTerm) remarksTerm.addEventListener('change', () => {
    if (remarksPupil?.value) loadRemarksData();
  });
  
  // Attendance
  const attendanceTerm = document.getElementById('attendance-term');
  if (attendanceTerm) attendanceTerm.addEventListener('change', loadAttendanceSection);
  
  console.log('✓ All event listeners connected with safety checks');
}

/* ======================================== 
   DASHBOARD WITH VALIDATION
======================================== */

async function loadTeacherDashboard() {
  const classCountEl = document.getElementById('my-class-count');
  const pupilCountEl = document.getElementById('my-pupil-count');
  const headerClassCount = document.getElementById('header-class-count');
  const headerPupilCount = document.getElementById('header-pupil-count');
  
  const classes = getValidClasses();
  const pupils = getValidPupils();
  
  if (classCountEl) classCountEl.textContent = classes.length;
  if (pupilCountEl) pupilCountEl.textContent = pupils.length;
  if (headerClassCount) headerClassCount.textContent = classes.length;
  if (headerPupilCount) headerPupilCount.textContent = pupils.length;
}

/* ======================================== 
   MY CLASSES WITH VALIDATION
======================================== */

function loadMyClassesSection() {
  const table = document.getElementById('pupils-in-class-table');
  if (!table) {
    console.warn('pupils-in-class-table not found');
    return;
  }
  
  const tbody = table.querySelector('tbody');
  if (!tbody) {
    console.warn('tbody not found in pupils-in-class-table');
    return;
  }
  
  const classes = getValidClasses();
  const pupils = getValidPupils();
  
  if (classes.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:var(--color-gray-600);">No classes assigned</td></tr>';
    return;
  }
  
  if (pupils.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:var(--color-gray-600);">No pupils in your classes</td></tr>';
    return;
  }
  
  paginateTable(pupils, 'pupils-in-class-table', 20, (pupil, tbodyEl) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td data-label="Name">${pupil.name || 'Unknown'}</td>
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

/* ======================================== 
   CLASS PROMOTION
======================================== */

let promotionData = {
  currentClassName: null,
  nextClassName: null,
  isTerminalClass: false,
  promotionPeriodActive: false
};

async function loadPromotionSection() {
  try {
    // Check if promotion period is active
    const settings = await window.getCurrentSettings();
    promotionData.promotionPeriodActive = settings.promotionPeriodActive || false;
    
    const statusBanner = document.getElementById('promotion-status-banner');
    const disabledBanner = document.getElementById('promotion-disabled-banner');
    const controls = document.getElementById('promotion-controls');
    const tableContainer = document.getElementById('promotion-table-container');
    
    if (promotionData.promotionPeriodActive) {
      if (statusBanner) statusBanner.style.display = 'flex';
      if (disabledBanner) disabledBanner.style.display = 'none';
    } else {
      if (statusBanner) statusBanner.style.display = 'none';
      if (disabledBanner) disabledBanner.style.display = 'flex';
      if (controls) controls.style.display = 'none';
      if (tableContainer) tableContainer.style.display = 'none';
      return;
    }
    
    // Check if teacher has assigned classes
    if (assignedClasses.length === 0) {
      document.getElementById('no-class-message').style.display = 'block';
      if (controls) controls.style.display = 'none';
      if (tableContainer) tableContainer.style.display = 'none';
      return;
    } else {
      document.getElementById('no-class-message').style.display = 'none';
    }
    
    // Get first assigned class (teacher should only have one for promotion)
    const currentClass = assignedClasses[0];
    promotionData.currentClassName = currentClass.name;
    
    // Display current class
    document.getElementById('promotion-current-class').textContent = currentClass.name;
    
    // Get next class in hierarchy
    const nextClass = await window.classHierarchy.getNextClass(currentClass.name);
    promotionData.nextClassName = nextClass;
    
    // Check if terminal class
    promotionData.isTerminalClass = await window.classHierarchy.isTerminalClass(currentClass.name);
    
    if (promotionData.isTerminalClass) {
      document.getElementById('promotion-next-class').textContent = 'Graduation (Alumni)';
      document.getElementById('terminal-class-message').style.display = 'block';
    } else if (nextClass) {
      document.getElementById('promotion-next-class').textContent = nextClass;
      document.getElementById('terminal-class-message').style.display = 'none';
    } else {
      document.getElementById('promotion-next-class').textContent = 'Not defined';
      window.showToast?.('Next class not found in hierarchy. Contact admin.', 'warning', 6000);
      if (controls) controls.style.display = 'none';
      if (tableContainer) tableContainer.style.display = 'none';
      return;
    }
    
    // Load pupils with performance data
    await loadPromotionPupils();
    
    // Show controls and table
    if (controls) controls.style.display = 'flex';
    if (tableContainer) tableContainer.style.display = 'block';
    
  } catch (error) {
    console.error('Error loading promotion section:', error);
    window.showToast?.('Failed to load promotion section', 'danger');
  }
}

async function loadPromotionPupils() {
  const tbody = document.getElementById('promotion-pupils-table');
  if (!tbody || allPupils.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--color-gray-600);">No pupils in your class</td></tr>';
    return;
  }
  
  tbody.innerHTML = '<tr><td colspan="5" class="table-loading">Loading pupils and calculating averages...</td></tr>';
  
  try {
    // Get current term
    const settings = await window.getCurrentSettings();
    const currentTerm = settings.term;
    
    // Calculate average for each pupil
    const pupilsWithScores = await Promise.all(
      allPupils.map(async pupil => {
        const average = await calculatePupilAverage(pupil.id, currentTerm);
        return {
          ...pupil,
          average: average.average,
          grade: average.grade
        };
      })
    );
    
    // Sort by average (highest first)
    pupilsWithScores.sort((a, b) => b.average - a.average);
    
    tbody.innerHTML = '';
    
    pupilsWithScores.forEach(pupil => {
      const tr = document.createElement('tr');
      const avgDisplay = pupil.average > 0 ? `${pupil.average.toFixed(1)}%` : 'No results';
      const gradeClass = pupil.grade ? `grade-${pupil.grade}` : '';
      
      tr.innerHTML = `
        <td style="text-align:center;">
          <input type="checkbox" 
                 class="pupil-promote-checkbox" 
                 data-pupil-id="${pupil.id}" 
                 data-pupil-name="${pupil.name}"
                 ${pupil.average >= 40 ? 'checked' : ''}>
        </td>
        <td data-label="Name"><strong>${pupil.name}</strong></td>
        <td data-label="Average" style="text-align:center;">${avgDisplay}</td>
        <td data-label="Grade" style="text-align:center;" class="${gradeClass}">${pupil.grade || '-'}</td>
        <td data-label="Status" style="text-align:center;">
          <span class="status-badge ${pupil.average >= 40 ? 'status-promote' : 'status-hold'}">
            ${pupil.average >= 40 ? 'Promote' : 'Review'}
          </span>
        </td>
      `;
      tbody.appendChild(tr);
    });
    
    // Update select all checkbox state
    updateSelectAllCheckbox();
    
  } catch (error) {
    console.error('Error loading promotion pupils:', error);
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--color-danger);">Error loading pupils</td></tr>';
  }
}

async function calculatePupilAverage(pupilId, term) {
  try {
    const resultsSnap = await db.collection('results')
      .where('pupilId', '==', pupilId)
      .where('term', '==', term)
      .get();
    
    if (resultsSnap.empty) {
      return { average: 0, grade: null };
    }
    
    let totalScore = 0;
    let subjectCount = 0;
    
    resultsSnap.forEach(doc => {
      const data = doc.data();
      const score = (data.caScore || 0) + (data.examScore || 0);
      totalScore += score;
      subjectCount++;
    });
    
    const average = subjectCount > 0 ? totalScore / subjectCount : 0;
    const grade = getGradeFromScore(average);
    
    return { average, grade };
  } catch (error) {
    console.error('Error calculating average:', error);
    return { average: 0, grade: null };
  }
}

function getGradeFromScore(score) {
  if (score >= 75) return 'A1';
  if (score >= 70) return 'B2';
  if (score >= 65) return 'B3';
  if (score >= 60) return 'C4';
  if (score >= 55) return 'C5';
  if (score >= 50) return 'C6';
  if (score >= 45) return 'D7';
  if (score >= 40) return 'D8';
  return 'F9';
}

function selectAllForPromotion() {
  document.querySelectorAll('.pupil-promote-checkbox').forEach(checkbox => {
    checkbox.checked = true;
  });
  updateSelectAllCheckbox();
}

function deselectAllForPromotion() {
  document.querySelectorAll('.pupil-promote-checkbox').forEach(checkbox => {
    checkbox.checked = false;
  });
  updateSelectAllCheckbox();
}

function toggleAllPupilsPromotion(masterCheckbox) {
  const isChecked = masterCheckbox.checked;
  document.querySelectorAll('.pupil-promote-checkbox').forEach(checkbox => {
    checkbox.checked = isChecked;
  });
}

function updateSelectAllCheckbox() {
  const allCheckboxes = document.querySelectorAll('.pupil-promote-checkbox');
  const checkedBoxes = document.querySelectorAll('.pupil-promote-checkbox:checked');
  const selectAllCheckbox = document.getElementById('select-all-pupils-promo');
  
  if (selectAllCheckbox && allCheckboxes.length > 0) {
    selectAllCheckbox.checked = allCheckboxes.length === checkedBoxes.length;
    selectAllCheckbox.indeterminate = checkedBoxes.length > 0 && checkedBoxes.length < allCheckboxes.length;
  }
}

// Listen to individual checkbox changes
document.addEventListener('change', (e) => {
  if (e.target.classList.contains('pupil-promote-checkbox')) {
    updateSelectAllCheckbox();
  }
});

async function submitPromotionRequest() {
  if (!promotionData.currentClassName || !promotionData.nextClassName) {
    window.showToast?.('Promotion data not loaded. Please refresh the page.', 'danger');
    return;
  }
  
  // Get selected pupils
  const checkboxes = document.querySelectorAll('.pupil-promote-checkbox:checked');
  const promotedPupils = Array.from(checkboxes).map(cb => ({
    id: cb.dataset.pupilId,
    name: cb.dataset.pupilName
  }));
  
  // Get unselected pupils (held back)
  const allCheckboxes = document.querySelectorAll('.pupil-promote-checkbox');
  const heldBackPupils = Array.from(allCheckboxes)
    .filter(cb => !cb.checked)
    .map(cb => ({
      id: cb.dataset.pupilId,
      name: cb.dataset.pupilName
    }));
  
  if (promotedPupils.length === 0) {
    if (!confirm('No pupils selected for promotion. This means all pupils will be held back. Continue?')) {
      return;
    }
  }
  
  const confirmation = confirm(
    `Submit Promotion Request?\n\n` +
    `✓ Promote: ${promotedPupils.length} pupil(s) to ${promotionData.isTerminalClass ? 'Alumni' : promotionData.nextClassName}\n` +
    `✗ Hold back: ${heldBackPupils.length} pupil(s) in ${promotionData.currentClassName}\n\n` +
    `This request will be sent to the admin for approval.`
  );
  
  if (!confirmation) return;
  
  const submitBtn = document.getElementById('submit-promotion-btn');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="btn-loading">Submitting...</span>';
  }
  
  try {
    // Get current session
    const settings = await window.getCurrentSettings();
    const currentSession = settings.session;
    
    // Find next class ID
    let toClassId = null;
    if (!promotionData.isTerminalClass) {
      const classesSnap = await db.collection('classes')
        .where('name', '==', promotionData.nextClassName)
        .limit(1)
        .get();
      
      if (!classesSnap.empty) {
        toClassId = classesSnap.docs[0].id;
      } else {
        window.showToast?.('Next class not found in database. Contact admin.', 'danger');
        return;
      }
    }
    
    // Create promotion request
    await db.collection('promotions').add({
      fromSession: currentSession,
      fromClass: {
        id: assignedClasses[0].id,
        name: promotionData.currentClassName
      },
      toClass: promotionData.isTerminalClass 
        ? { id: 'alumni', name: 'Alumni' }
        : { id: toClassId, name: promotionData.nextClassName },
      isTerminalClass: promotionData.isTerminalClass,
      promotedPupils: promotedPupils.map(p => p.id),
      promotedPupilsDetails: promotedPupils,
      heldBackPupils: heldBackPupils.map(p => p.id),
      heldBackPupilsDetails: heldBackPupils,
      initiatedBy: currentUser.uid,
      status: 'pending',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    window.showToast?.(
      '✓ Promotion request submitted successfully!\nAdmin will review and approve your recommendations.',
      'success',
      8000
    );
    
    // Reload section
    await loadPromotionSection();
    
  } catch (error) {
    console.error('Error submitting promotion request:', error);
    window.handleError(error, 'Failed to submit promotion request');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '📋 Submit Promotion List';
    }
  }
}

// Make functions globally available
window.selectAllForPromotion = selectAllForPromotion;
window.deselectAllForPromotion = deselectAllForPromotion;
window.toggleAllPupilsPromotion = toggleAllPupilsPromotion;
window.submitPromotionRequest = submitPromotionRequest;

console.log('✓ Teacher portal v8.1.0 loaded - RACE CONDITIONS FIXED');