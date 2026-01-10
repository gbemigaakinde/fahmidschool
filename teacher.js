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

/**
 * FIXED: Teacher Portal Initialization with Guaranteed Data Load
 * Replace the initialization block at the top of teacher.js (lines 15-32)
 */

window.checkRole('teacher')
  .then(async user => {
    currentUser = user;
    const info = document.getElementById('teacher-info');
    if (info) info.innerHTML = `Logged in as:<br><strong>${user.email}</strong>`;
    
    // CRITICAL FIX: Sequential loading with error handling
    try {
      console.log('Starting teacher data load...');
      
      // Step 1: Load classes and pupils
      isLoadingData = true;
      await loadAssignedClasses();
      console.log('✓ Classes loaded:', assignedClasses.length);
      
      // Step 2: Load subjects (depends on classes)
      await loadSubjects();
      console.log('✓ Subjects loaded:', allSubjects.length);
      
      // Step 3: Mark data as loaded
      dataLoaded = true;
      isLoadingData = false;
      console.log('✓ All teacher data loaded successfully');
      
      // Step 4: Now safe to initialize portal
      initTeacherPortal();
      
    } catch (error) {
      console.error('❌ Failed to load teacher data:', error);
      isLoadingData = false;
      dataLoaded = false;
      
      // Show error to user
      window.showToast?.(
        'Failed to load your teaching data. Please refresh the page.',
        'danger',
        10000
      );
      
      // Still try to show dashboard with empty data
      showSection('dashboard');
    }
  })
  .catch(err => {
    console.error('Authentication check failed:', err);
    // Will redirect to login
  });
  
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
  
  // CRITICAL FIX: Clean up existing pagination function to prevent memory leak
  const paginationFuncName = `changePage_${tbodyId}`;
  if (window[paginationFuncName]) {
    delete window[paginationFuncName];
    console.log(`Cleaned up old pagination function: ${paginationFuncName}`);
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
      <button onclick="window.${paginationFuncName}(${page - 1})" ${page === 1 ? 'disabled' : ''}>Previous</button>
      <span class="page-info">Page ${page} of ${total}</span>
      <button onclick="window.${paginationFuncName}(${page + 1})" ${page === total ? 'disabled' : ''}>Next</button>
    `;
  }
  
  window[paginationFuncName] = function(newPage) {
    if (newPage < 1 || newPage > totalPages) return;
    currentPage = newPage;
    renderPage(currentPage);
  };
  
  renderPage(1);
  console.log(`✓ Pagination initialized for ${tbodyId} (${data.length} items, ${totalPages} pages)`);
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
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:var(--color-gray-600);">No classes assigned to you yet. Contact admin.</td></tr>';
    return;
  }
  
  if (pupils.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:var(--color-gray-600);">No pupils in your assigned classes yet.</td></tr>';
    return;
  }
  
  // Use pagination correctly with table ID (not tbody ID)
  paginateTable(pupils, 'pupils-in-class-table', 20, (pupil, tbodyEl) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td data-label="Pupil Name">${pupil.name || 'Unknown'}</td>
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
        <td data-label="Pupil Name">${pupil.name}</td>
        <td data-label="CA Score (40)">
          <input type="number" min="0" max="40" step="0.5" value="${existing.ca || ''}" 
                 data-pupil="${pupil.id}" data-field="ca" 
                 style="width:100%; max-width:100px;"
                 placeholder="0-40">
        </td>
        <td data-label="Exam Score (60)">
          <input type="number" min="0" max="60" step="0.5" value="${existing.exam || ''}" 
                 data-pupil="${pupil.id}" data-field="exam" 
                 style="width:100%; max-width:100px;"
                 placeholder="0-60">
        </td>
        <td data-label="Total">${total > 0 ? total : '-'}</td>
      `;
      tbody.appendChild(tr);
    });
    
    if (saveBtn) saveBtn.hidden = false;
    
    // FIXED: Add validation and auto-update totals
    container.querySelectorAll('input[type="number"]').forEach(input => {
      // Validate on input
      input.addEventListener('input', (e) => {
        const field = e.target.dataset.field;
        const max = field === 'ca' ? 40 : 60;
        let value = parseFloat(e.target.value);
        
        // FIXED: Enforce max limits
        if (value > max) {
          e.target.value = max;
          value = max;
          window.showToast?.(
            `Maximum score for ${field === 'ca' ? 'CA' : 'Exam'} is ${max}`,
            'warning',
            3000
          );
        }
        
        // FIXED: Prevent negative values
        if (value < 0) {
          e.target.value = 0;
          value = 0;
        }
        
        // Update total
        const row = e.target.closest('tr');
        const caInput = row.querySelector('[data-field="ca"]');
        const examInput = row.querySelector('[data-field="exam"]');
        const ca = parseFloat(caInput?.value) || 0;
        const exam = parseFloat(examInput?.value) || 0;
        const totalCell = row.querySelector('td:last-child');
        
        if (totalCell) {
          const total = ca + exam;
          totalCell.textContent = total > 0 ? total.toFixed(1) : '-';
          
          // FIXED: Visual feedback for score range
          totalCell.style.fontWeight = 'bold';
          if (total >= 75) {
            totalCell.style.color = '#4CAF50'; // Green for excellent
          } else if (total >= 50) {
            totalCell.style.color = '#2196F3'; // Blue for good
          } else if (total >= 40) {
            totalCell.style.color = '#ff9800'; // Orange for pass
          } else if (total > 0) {
            totalCell.style.color = '#f44336'; // Red for fail
          } else {
            totalCell.style.color = 'inherit';
            totalCell.style.fontWeight = 'normal';
          }
        }
      });
      
      // FIXED: Validate on blur (when user leaves field)
      input.addEventListener('blur', (e) => {
        const field = e.target.dataset.field;
        const max = field === 'ca' ? 40 : 60;
        let value = parseFloat(e.target.value);
        
        if (value > max) {
          e.target.value = max;
          e.target.style.borderColor = '#f44336';
          setTimeout(() => {
            e.target.style.borderColor = '';
          }, 2000);
        }
      });
    });
    
  } catch (err) {
    console.error('Error loading results table:', err);
    window.handleError?.(err, 'Failed to load results');
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
  
  // ADD THIS VALIDATION:
  let hasInvalidScores = false;
  
  inputs.forEach(input => {
    const field = input.dataset.field;
    const value = parseFloat(input.value) || 0;
    const max = field === 'ca' ? 40 : 60;
    
    if (value > max) {
      hasInvalidScores = true;
      input.style.borderColor = '#f44336';
      input.value = max;
      
      window.showToast?.(
        `${field === 'ca' ? 'CA' : 'Exam'} score cannot exceed ${max}`,
        'danger',
        4000
      );
    }
    
    if (value < 0) {
      hasInvalidScores = true;
      input.style.borderColor = '#f44336';
      input.value = 0;
    }
  });
  
  if (hasInvalidScores) {
    window.showToast?.('Invalid scores corrected. Please review and save again.', 'warning', 5000);
    return;
  }
  
  // FIXED: Manage button state properly without nested spans
  const saveBtn = document.getElementById('save-results-btn');
  const originalText = saveBtn?.textContent;
  
  // FIXED: Disable button and show loading
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = '⏳ Saving...';
  }
  
  try {
    // CRITICAL: Get current session information
    const settings = await window.getCurrentSettings();
    const currentSession = settings.session || 'Unknown';
    const sessionStartYear = settings.currentSession?.startYear;
    const sessionEndYear = settings.currentSession?.endYear;
    
    const batch = db.batch();
    let hasChanges = false;
    
    inputs.forEach(input => {
      const pupilId = input.dataset.pupil;
      const field = input.dataset.field;
      const value = parseFloat(input.value) || 0;
      
      if (value > 0) hasChanges = true;
      
      const docId = `${pupilId}_${term}_${subject}`;
      const ref = db.collection('results').doc(docId);
      
      // Create composite session-term field for efficient querying
      const sessionTerm = `${currentSession}_${term}`;
      
      if (field === 'ca') {
        batch.set(ref, {
          pupilId, 
          term, 
          subject,
          caScore: value,
          // Add session context
          session: currentSession,
          sessionStartYear: sessionStartYear,
          sessionEndYear: sessionEndYear,
          sessionTerm: sessionTerm,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      } else {
        batch.set(ref, {
          pupilId, 
          term, 
          subject,
          examScore: value,
          // Add session context
          session: currentSession,
          sessionStartYear: sessionStartYear,
          sessionEndYear: sessionEndYear,
          sessionTerm: sessionTerm,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      }
    });
    
    if (!hasChanges) {
      window.showToast?.('No scores entered', 'warning');
      return;
    }
    
    await batch.commit();
    window.showToast?.('✓ All results saved successfully', 'success');
    
  } catch (err) {
    console.error('Error saving results:', err);
    window.handleError?.(err, 'Failed to save results');
  } finally {
    // FIXED: Always restore button state
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = originalText || '💾 Save All Results';
    }
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
              <th>Times School Opened</th>
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
        <td data-label="Pupil Name">${pupil.name}</td>
        <td data-label="Times School Opened">
          <input type="number" min="0" value="${existing.timesOpened || ''}" 
                 data-pupil="${pupil.id}" data-field="timesOpened" 
                 style="width:100%; max-width:100px;"
                 placeholder="0">
        </td>
        <td data-label="Times Present">
          <input type="number" min="0" value="${existing.timesPresent || ''}" 
                 data-pupil="${pupil.id}" data-field="timesPresent" 
                 style="width:100%; max-width:100px;"
                 placeholder="0">
        </td>
        <td data-label="Times Absent">
          <input type="number" min="0" value="${existing.timesAbsent || ''}" 
                 data-pupil="${pupil.id}" data-field="timesAbsent" 
                 style="width:100%; max-width:100px;"
                 placeholder="0">
        </td>
      `;
      tbody.appendChild(tr);
    });
    
    saveBtn.hidden = false;
  } catch (err) {
    console.error('Error loading attendance:', err);
    window.handleError?.(err, 'Failed to load attendance');
    container.innerHTML = '<p style="text-align:center; color:var(--color-danger);">Error loading attendance</p>';
    saveBtn.hidden = true;
  }
}

/* ======================================== 
   FIXED: Save Attendance with Session Context
======================================== */
async function saveAllAttendance() {
  const inputs = document.querySelectorAll('#attendance-form-container input[type="number"]');
  const term = document.getElementById('attendance-term')?.value;
  
  if (!inputs.length || !term) {
    window.showToast?.('No data to save', 'warning');
    return;
  }
  
  // FIXED: Get current session
  const settings = await window.getCurrentSettings();
  const currentSession = settings.session || 'Unknown';
  const sessionStartYear = settings.currentSession?.startYear;
  const sessionEndYear = settings.currentSession?.endYear;
  const sessionTerm = `${currentSession}_${term}`;
  
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
      // FIXED: Add session context
      session: currentSession,
      sessionStartYear: sessionStartYear,
      sessionEndYear: sessionEndYear,
      sessionTerm: sessionTerm,
      ...data,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  }
  
  try {
    await batch.commit();
    window.showToast?.('✓ Attendance saved successfully', 'success');
  } catch (err) {
    console.error('Error saving attendance:', err);
    window.handleError?.(err, 'Failed to save attendance');
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

/* ======================================== 
   FIXED: Save Traits & Skills with Session Context
======================================== */
async function saveTraitsAndSkills() {
  const pupilId = document.getElementById('traits-pupil')?.value;
  const term = document.getElementById('traits-term')?.value;
  
  if (!pupilId || !term) {
    window.showToast?.('Select pupil and term', 'warning');
    return;
  }
  
  // FIXED: Get current session
  const settings = await window.getCurrentSettings();
  const currentSession = settings.session || 'Unknown';
  const sessionStartYear = settings.currentSession?.startYear;
  const sessionEndYear = settings.currentSession?.endYear;
  const sessionTerm = `${currentSession}_${term}`;
  
  const traitFields = ['punctuality','neatness','politeness','honesty','obedience','cooperation','attentiveness','leadership','selfcontrol','creativity'];
  const skillFields = ['handwriting','drawing','sports','craft','verbal','coordination'];
  
  const traitsData = { 
    pupilId, 
    term, 
    teacherId: currentUser.uid,
    // FIXED: Add session context
    session: currentSession,
    sessionStartYear: sessionStartYear,
    sessionEndYear: sessionEndYear,
    sessionTerm: sessionTerm
  };
  
  traitFields.forEach(f => {
    traitsData[f] = document.getElementById(`trait-${f}`).value.trim();
  });
  traitsData.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
  
  const skillsData = { 
    pupilId, 
    term, 
    teacherId: currentUser.uid,
    // FIXED: Add session context
    session: currentSession,
    sessionStartYear: sessionStartYear,
    sessionEndYear: sessionEndYear,
    sessionTerm: sessionTerm
  };
  
  skillFields.forEach(f => {
    skillsData[f] = document.getElementById(`skill-${f}`).value.trim();
  });
  skillsData.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
  
  try {
    await db.collection('behavioral_traits').doc(`${pupilId}_${term}`).set(traitsData, { merge: true });
    await db.collection('psychomotor_skills').doc(`${pupilId}_${term}`).set(skillsData, { merge: true });
    window.showToast?.('✓ Traits & skills saved successfully', 'success');
  } catch (err) {
    console.error('Error saving traits & skills:', err);
    window.handleError?.(err, 'Failed to save traits & skills');
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
  
  // FIXED: Get current session
  const settings = await window.getCurrentSettings();
  const currentSession = settings.session || 'Unknown';
  const sessionStartYear = settings.currentSession?.startYear;
  const sessionEndYear = settings.currentSession?.endYear;
  const sessionTerm = `${currentSession}_${term}`;
  
  const data = {
    pupilId,
    term,
    teacherId: currentUser.uid,
    teacherRemark,
    headRemark,
    // FIXED: Add session context
    session: currentSession,
    sessionStartYear: sessionStartYear,
    sessionEndYear: sessionEndYear,
    sessionTerm: sessionTerm,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };
  
  try {
    await db.collection('remarks').doc(`${pupilId}_${term}`).set(data, { merge: true });
    window.showToast?.('✓ Remarks saved successfully', 'success');
  } catch (err) {
    console.error('Error saving remarks:', err);
    window.handleError?.(err, 'Failed to save remarks');
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
      // FIXED: Parse as float to support decimal scores
      const ca = parseFloat(data.caScore) || 0;
      const exam = parseFloat(data.examScore) || 0;
      const score = ca + exam;
      
      totalScore += score;
      subjectCount++;
    });
    
    // FIXED: Calculate average with proper rounding
    const average = subjectCount > 0 ? Math.round((totalScore / subjectCount) * 10) / 10 : 0;
    const grade = getGradeFromScore(average);
    
    return { average, grade };
    
  } catch (error) {
    console.error('Error calculating average for pupil:', pupilId, error);
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

// Export all functions used by HTML
window.loadResultsTable = loadResultsTable;
window.saveAllResults = saveAllResults;
window.saveAllAttendance = saveAllAttendance;
window.loadTraitsData = loadTraitsData;
window.saveTraitsAndSkills = saveTraitsAndSkills;
window.loadRemarksData = loadRemarksData;
window.saveRemarks = saveRemarks;
window.loadAttendanceSection = loadAttendanceSection;

console.log('✓ Teacher portal v8.1.0 loaded - RACE CONDITIONS FIXED');

console.log('✓ Teacher portal v8.1.0 loaded - RACE CONDITIONS FIXED');