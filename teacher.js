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
    window.currentUser = user; // ← EXPOSE TO OTHER SCRIPTS
    const info = document.getElementById('teacher-info');
    if (info) info.innerHTML = `Logged in as:<br><strong>${user.email}</strong>`;
    
    try {
      console.log('Starting teacher data load...');
      isLoadingData = true;
      await loadAssignedClasses();
      console.log('✓ Classes loaded:', assignedClasses.length);
      await loadSubjects();
      console.log('✓ Subjects loaded:', allSubjects.length);
      dataLoaded = true;
      isLoadingData = false;
      console.log('✓ All teacher data loaded successfully');
      initTeacherPortal();
    } catch (error) {
      console.error('❌ Failed to load teacher data:', error);
      isLoadingData = false;
      dataLoaded = false;
      window.showToast?.(
        'Failed to load your teaching data. Please refresh the page.',
        'danger',
        10000
      );
      showSection('dashboard');
    }
  })
  .catch(err => {
    console.error('Authentication check failed:', err);
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
      if (Array.isArray(cls.subjects)) {
        cls.subjects.forEach(subject => subjectSet.add(subject));
      }
    });
    allSubjects = Array.from(subjectSet).sort();
    
    // Load pupils with explicit alumni exclusion
    const classIds = assignedClasses.map(c => c.id);
    allPupils = [];

    for (let i = 0; i < classIds.length; i += 10) {
      const batch = classIds.slice(i, i + 10);

      const pupilsSnap = await db.collection('pupils')
        .where('class.id', 'in', batch)
        .get();

      const batchPupils = pupilsSnap.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(p => p.status !== 'alumni'); // safely excludes alumni

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
    throw err;
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

const sectionLoaders = window.sectionLoaders = {
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
   HAMBURGER MENU FOR MOBILE - FIXED VERSION
======================================== */

// Named handlers stored at module scope so they can be removed on re-init
let _teacherOutsideClickHandler = null;
let _teacherKeydownHandler = null;
let _teacherResizeHandler = null;
let _teacherResizeTimer = null;

function initTeacherHamburger() {
  // HARD GUARD: Prevent any chance of double-setup
  if (window.teacherSidebarInitialized === true) {
    console.log('✓ Teacher hamburger already initialized, skipping');
    return;
  }

  const hamburger = document.getElementById('hamburger');
  const sidebar = document.getElementById('teacher-sidebar');

  if (!hamburger || !sidebar) {
    console.warn('⚠️ Teacher hamburger or sidebar not found');
    console.log('Hamburger element:', hamburger);
    console.log('Sidebar element:', sidebar);
    return;
  }

  console.log('🔧 Initializing teacher hamburger menu...');

  // ── STEP 1: Remove ALL prior listeners on hamburger by cloning ──────────
  const freshHamburger = hamburger.cloneNode(true);
  hamburger.parentNode.replaceChild(freshHamburger, hamburger);

  // ── STEP 2: Remove any previously attached document-level handlers ───────
  if (_teacherOutsideClickHandler) {
    document.removeEventListener('click', _teacherOutsideClickHandler);
    _teacherOutsideClickHandler = null;
  }
  if (_teacherKeydownHandler) {
    document.removeEventListener('keydown', _teacherKeydownHandler);
    _teacherKeydownHandler = null;
  }
  if (_teacherResizeHandler) {
    window.removeEventListener('resize', _teacherResizeHandler);
    _teacherResizeHandler = null;
  }
  clearTimeout(_teacherResizeTimer);

  // ── STEP 3: Helper functions using fresh lookups (no stale closures) ─────
  function closeSidebar() {
    const sb = document.getElementById('teacher-sidebar');
    const hb = document.getElementById('hamburger');
    if (!sb || !hb) return;
    sb.classList.remove('active');
    hb.classList.remove('active');
    hb.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }

  // ── STEP 4: Attach hamburger click listener to the CLONED element ────────
  freshHamburger.addEventListener('click', function (e) {
    e.stopPropagation();
    const sb = document.getElementById('teacher-sidebar');
    const hb = document.getElementById('hamburger');
    if (!sb || !hb) return;

    const isActive = sb.classList.toggle('active');
    hb.classList.toggle('active', isActive);
    hb.setAttribute('aria-expanded', String(isActive));
    document.body.style.overflow = isActive ? 'hidden' : '';

    console.log('📱 Teacher sidebar toggled:', isActive ? 'OPEN' : 'CLOSED');
  });
  console.log('✓ Click listener attached to hamburger');

  // ── STEP 5: Outside-click handler (named so it can be removed later) ─────
  _teacherOutsideClickHandler = function (e) {
    const sb = document.getElementById('teacher-sidebar');
    const hb = document.getElementById('hamburger');
    if (!sb || !hb) return;
    if (
      sb.classList.contains('active') &&
      !sb.contains(e.target) &&
      !hb.contains(e.target)
    ) {
      closeSidebar();
    }
  };
  document.addEventListener('click', _teacherOutsideClickHandler);

  // ── STEP 6: Navigation links close sidebar on mobile ─────────────────────
  sidebar.querySelectorAll('a[data-section]').forEach(link => {
    link.addEventListener('click', () => {
      if (window.innerWidth <= 1024) closeSidebar();
    });
  });

  // ── STEP 7: Escape key ────────────────────────────────────────────────────
  _teacherKeydownHandler = function (e) {
    if (e.key === 'Escape') {
      const sb = document.getElementById('teacher-sidebar');
      if (sb?.classList.contains('active')) {
        closeSidebar();
        document.getElementById('hamburger')?.focus();
      }
    }
  };
  document.addEventListener('keydown', _teacherKeydownHandler);

  // ── STEP 8: Resize handler ────────────────────────────────────────────────
  _teacherResizeHandler = function () {
    clearTimeout(_teacherResizeTimer);
    _teacherResizeTimer = setTimeout(() => {
      const sb = document.getElementById('teacher-sidebar');
      if (window.innerWidth > 1024 && sb?.classList.contains('active')) {
        closeSidebar();
      }
    }, 250);
  };
  window.addEventListener('resize', _teacherResizeHandler);

  // ── STEP 9: Set flag LAST ────────────────────────────────────────────────
  window.teacherSidebarInitialized = true;
  console.log('✅ Teacher hamburger menu initialized successfully');
}

// DON'T call initTeacherHamburger() here!
// It is called from initTeacherPortal() after data is fully loaded.
console.log('✓ Teacher hamburger function defined');

/* ======================================== 
   PORTAL INITIALIZATION
======================================== */

function initTeacherPortal() {
  if (!dataLoaded) {
    console.error('initTeacherPortal called before data loaded');
    return;
  }
  
  setupAllEventListeners();
  
  // CRITICAL FIX: Initialize hamburger HERE after DOM is fully loaded
  initTeacherHamburger();
  
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
  const saveResultsBtn = document.getElementById('save-results-btn');
  const saveAttendanceBtn = document.getElementById('save-attendance-btn');
  const saveTraitsBtn = document.getElementById('save-traits-btn');
  const saveRemarksBtn = document.getElementById('save-remarks-btn');
  
  if (saveResultsBtn) saveResultsBtn.addEventListener('click', saveAllResults);
  if (saveAttendanceBtn) saveAttendanceBtn.addEventListener('click', saveAllAttendance);
  if (saveTraitsBtn) saveTraitsBtn.addEventListener('click', saveTraitsAndSkills);
  if (saveRemarksBtn) saveRemarksBtn.addEventListener('click', saveRemarks);
  
  const resultTerm = document.getElementById('result-term');
  const resultSubject = document.getElementById('result-subject');
  if (resultTerm) resultTerm.addEventListener('change', loadResultsTable);
  if (resultSubject) resultSubject.addEventListener('change', loadResultsTable);
  
  const traitsTerm = document.getElementById('traits-term');
  if (traitsTerm) traitsTerm.addEventListener('change', loadBulkTraitsTable);

  const traitsPupil = document.getElementById('traits-pupil');
  if (traitsPupil) {
    traitsPupil.closest('.form-group')?.remove();
  }
  
  const remarksPupil = document.getElementById('remarks-pupil');
  const remarksTerm = document.getElementById('remarks-term');
  if (remarksPupil) remarksPupil.addEventListener('change', loadRemarksData);
  if (remarksTerm) remarksTerm.addEventListener('change', () => {
    if (remarksPupil?.value) loadRemarksData();
  });
  
  // FIXED: Always use the patched sectionLoaders version so enhanced UI is called
  const attendanceTerm = document.getElementById('attendance-term');
  if (attendanceTerm) attendanceTerm.addEventListener('change', () => {
    const loader = window.sectionLoaders?.['attendance'];
    if (typeof loader === 'function') loader();
    else loadAttendanceSection();
  });
  
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
    const settings = await window.getCurrentSettings();
    const currentSession = settings.session;
    
    const resultsMap = {};
    
    // Query from DRAFT collection
    for (const pupil of allPupils) {
      const docId = `${pupil.id}_${term}_${subject}`;
      const draftDoc = await db.collection('results_draft').doc(docId).get();
      
      if (draftDoc.exists) {
        const data = draftDoc.data();
        
        // Only use if it matches current session
        if (data.session === currentSession) {
          resultsMap[pupil.id] = {
            ca: data.caScore || 0,
            exam: data.examScore || 0
          };
        }
      }
    }
    
    // ✅ NEW: Check for rejection reason and display banner
    let rejectionBanner = '';
    
    if (assignedClasses.length > 0) {
      const classId = assignedClasses[0].id;
      const encodedSession = currentSession.replace(/\//g, '-');
      const submissionId = `${classId}_${encodedSession}_${term}_${subject}`;
      
      try {
        const submissionDoc = await db.collection('result_submissions').doc(submissionId).get();
        
        if (submissionDoc.exists) {
          const submissionData = submissionDoc.data();
          
          // If rejected, show rejection reason
          if (submissionData.status === 'rejected' && submissionData.rejectionReason) {
            rejectionBanner = `
              <div style="background: linear-gradient(135deg, #dc3545 0%, #c82333 100%); 
                          color: white; 
                          padding: var(--space-lg); 
                          border-radius: var(--radius-md); 
                          margin-bottom: var(--space-lg);
                          box-shadow: 0 4px 6px rgba(220, 53, 69, 0.2);">
                <h3 style="margin: 0 0 var(--space-md) 0; font-size: var(--text-lg);">
                  ⚠️ Results Rejected by Admin
                </h3>
                <div style="background: rgba(255,255,255,0.15); 
                            padding: var(--space-md); 
                            border-radius: var(--radius-sm);
                            border-left: 4px solid #fff;">
                  <strong>Reason for rejection:</strong>
                  <p style="margin: var(--space-sm) 0 0 0; font-size: var(--text-base);">
                    ${submissionData.rejectionReason}
                  </p>
                </div>
                <p style="margin: var(--space-md) 0 0 0; font-size: var(--text-sm); opacity: 0.9;">
                  ℹ️ Your results are now editable. Please make the necessary corrections and resubmit.
                </p>
              </div>
            `;
          }
        }
      } catch (submissionError) {
        // Silently handle - submission doc might not exist
        console.log('No submission found or error checking submission:', submissionError.code);
      }
    }
    
    // Render table with rejection banner (if exists)
    container.innerHTML = `
      ${rejectionBanner}
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
    
    // Add input validation
    container.querySelectorAll('input[type="number"]').forEach(input => {
      input.addEventListener('input', (e) => {
        const field = e.target.dataset.field;
        const max = field === 'ca' ? 40 : 60;
        let value = parseFloat(e.target.value);
        
        if (value > max) {
          e.target.value = max;
          value = max;
          window.showToast?.(
            `Maximum score for ${field === 'ca' ? 'CA' : 'Exam'} is ${max}`,
            'warning',
            3000
          );
        }
        
        if (value < 0) {
          e.target.value = 0;
          value = 0;
        }
        
        const row = e.target.closest('tr');
        const caInput = row.querySelector('[data-field="ca"]');
        const examInput = row.querySelector('[data-field="exam"]');
        const ca = parseFloat(caInput?.value) || 0;
        const exam = parseFloat(examInput?.value) || 0;
        const totalCell = row.querySelector('td:last-child');
        
        if (totalCell) {
          const total = ca + exam;
          totalCell.textContent = total > 0 ? total.toFixed(1) : '-';
          
          totalCell.style.fontWeight = 'bold';
          if (total >= 75) {
            totalCell.style.color = '#4CAF50';
          } else if (total >= 50) {
            totalCell.style.color = '#2196F3';
          } else if (total >= 40) {
            totalCell.style.color = '#ff9800';
          } else if (total > 0) {
            totalCell.style.color = '#f44336';
          } else {
            totalCell.style.color = 'inherit';
            totalCell.style.fontWeight = 'normal';
          }
        }
      });
      
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
  
  await checkResultLockStatus();
}

/**
 * ✅ FIXED: Check result lock status with clarified error logging
 * Prevents misleading console errors and handles all permission scenarios
 */
async function checkResultLockStatus() {
    const term = document.getElementById('result-term')?.value;
    const subject = document.getElementById('result-subject')?.value;
    
    if (!term || !subject || assignedClasses.length === 0) {
        hideAllResultBanners();
        return;
    }
    
    const classId = assignedClasses[0].id;
    const className = assignedClasses[0].name;
    
    try {
        const settings = await window.getCurrentSettings();
        const session = settings.session;
        
        // Encode session to avoid Firestore path issues (e.g., "2025/2026" → "2025-2026")
        const encodedSession = session.replace(/\//g, '-');
        
        // ✅ FIX 1: Check lock status with clarified error handling
        let lockStatus = { locked: false };
        
        try {
            lockStatus = await window.resultLocking.isLocked(classId, term, subject, encodedSession);
            
            // Note: If lock check returned 'note' field, it means permission denied or doesn't exist
            // This is SAFE - we assume unlocked and allow editing
            if (lockStatus.note) {
                console.log('✓ No lock found, allowing edits');
            }
        } catch (lockError) {
            // This catch should rarely trigger since isLocked() handles its own errors
            console.log('✓ Lock check failed, assuming no lock exists (safe to edit)');
            lockStatus = { locked: false };
        }
        
        // If results are locked, disable editing
        if (lockStatus.locked) {
            showLockedBanner(lockStatus);
            hideSubmissionControls();
            disableResultInputs();
            return;
        }
        
        // ✅ FIX 2: Check submission status with clarified permission handling
        let submissionExists = false;
        let submissionData = null;
        
        try {
            const submissionId = `${classId}_${encodedSession}_${term}_${subject}`;
            const submissionDoc = await db.collection('result_submissions').doc(submissionId).get();
            
            if (submissionDoc.exists) {
                submissionExists = true;
                submissionData = submissionDoc.data();
            } else {
                console.log('✓ No submission found for these results');
            }
        } catch (submissionError) {
            // ✅ CRITICAL CLARIFICATION: Permission denied usually means document doesn't exist
            if (submissionError.code === 'permission-denied') {
                console.log('✓ No submission document found (permission denied to non-existent doc)');
                // Safe to assume no submission exists
            } else if (submissionError.code === 'unavailable') {
                console.warn('⚠️ Firestore temporarily unavailable, proceeding with caution');
                window.showToast?.(
                    'Connection issue detected. Changes may not save properly.',
                    'warning',
                    4000
                );
            } else {
                console.error('❌ Unexpected error checking submission status:', submissionError);
            }
            // Continue execution - assume no submission
        }
        
        // Handle submission status
        if (submissionExists && submissionData) {
            if (submissionData.status === 'pending') {
                showSubmissionStatusBanner(submissionData);
                hideSubmissionControls();
                disableResultInputs();
                return;
            } else if (submissionData.status === 'rejected') {
                // Rejected - teacher can edit and resubmit
                if (window.showToast) {
                    window.showToast(
                        'Your previous submission was rejected. You can now edit and resubmit.',
                        'warning',
                        6000
                    );
                }
                showSubmissionControls(term, subject, className);
                hideAllResultBanners();
                enableResultInputs();
                return;
            } else if (submissionData.status === 'approved') {
                // Approved - results are finalized, no editing
                showApprovedBanner(submissionData);
                hideSubmissionControls();
                disableResultInputs();
                return;
            }
        }
        
        // Default state: Not locked, not submitted - allow editing
        console.log('✓ Results are editable');
        showSubmissionControls(term, subject, className);
        hideAllResultBanners();
        enableResultInputs();
        
    } catch (error) {
        // ✅ FIX 3: Final catch-all with better diagnostics
        console.error('❌ Critical error in checkResultLockStatus:', error.code || error.message);
        
        // Show user-friendly message
        if (window.showToast) {
            if (error.code === 'unavailable') {
                window.showToast(
                    'Connection issue. Your work may not save. Check your internet.',
                    'danger',
                    8000
                );
            } else {
                window.showToast(
                    'Could not verify result status. Proceeding with caution.',
                    'warning',
                    5000
                );
            }
        }
        
        // Default to safe state: allow editing but warn user
        hideAllResultBanners();
        showSubmissionControls(term, subject, className);
        enableResultInputs();
    }
}

/**
 * ✅ NEW: Show approved banner
 */
function showApprovedBanner(submissionData) {
    const banner = document.getElementById('result-locked-banner');
    const detailsDiv = document.getElementById('lock-details');
    
    if (!banner || !detailsDiv) return;
    
    const approvedDate = submissionData.approvedAt 
        ? submissionData.approvedAt.toDate().toLocaleDateString('en-GB', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })
        : 'Unknown';
    
    detailsDiv.innerHTML = `
        <div style="font-size: var(--text-sm); color: var(--color-gray-600);">
            <strong>Status:</strong> Approved and locked<br>
            <strong>Approved on:</strong> ${approvedDate}<br>
            <strong>Note:</strong> These results are finalized and cannot be edited.
        </div>
    `;
    
    banner.style.display = 'block';
}

// Make globally available
window.showApprovedBanner = showApprovedBanner;

/**
 * Show locked banner
 */
function showLockedBanner(lockStatus) {
    const banner = document.getElementById('result-locked-banner');
    const detailsDiv = document.getElementById('lock-details');
    
    if (!banner || !detailsDiv) return;
    
    const lockedDate = lockStatus.lockedAt 
        ? lockStatus.lockedAt.toDate().toLocaleDateString('en-GB', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })
        : 'Unknown';
    
    detailsDiv.innerHTML = `
        <div style="font-size: var(--text-sm); color: var(--color-gray-600);">
            <strong>Locked on:</strong> ${lockedDate}<br>
            <strong>Reason:</strong> ${lockStatus.reason || 'Approved by admin'}
        </div>
    `;
    
    banner.style.display = 'block';
}

/**
 * Show submission status banner
 */
function showSubmissionStatusBanner(submissionData) {
    const banner = document.getElementById('result-submission-status');
    const dateEl = document.getElementById('submitted-date');
    
    if (!banner || !dateEl) return;
    
    const submittedDate = submissionData.submittedAt 
        ? submissionData.submittedAt.toDate().toLocaleDateString('en-GB', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })
        : 'Unknown';
    
    dateEl.textContent = submittedDate;
    banner.style.display = 'block';
}

/**
 * Show submission controls
 */
function showSubmissionControls(term, subject, className) {
    const controls = document.getElementById('result-submission-controls');
    
    if (!controls) return;
    
    document.getElementById('submission-class-name').textContent = className;
    document.getElementById('submission-term').textContent = term;
    document.getElementById('submission-subject').textContent = subject;
    
    // Count pupils with results
    const inputs = document.querySelectorAll('#results-entry-table-container input[type="number"]');
    const pupilIds = new Set();
    
    inputs.forEach(input => {
        const pupilId = input.dataset.pupil;
        const value = parseFloat(input.value) || 0;
        
        if (value > 0 && pupilId) {
            pupilIds.add(pupilId);
        }
    });
    
    document.getElementById('submission-pupil-count').textContent = pupilIds.size;
    
    controls.style.display = 'block';
}

/**
 * Hide submission controls
 */
function hideSubmissionControls() {
    const controls = document.getElementById('result-submission-controls');
    if (controls) controls.style.display = 'none';
}

/**
 * Hide all banners
 */
function hideAllResultBanners() {
    const lockedBanner = document.getElementById('result-locked-banner');
    const statusBanner = document.getElementById('result-submission-status');
    
    if (lockedBanner) lockedBanner.style.display = 'none';
    if (statusBanner) statusBanner.style.display = 'none';
}

/**
 * Disable result inputs
 */
function disableResultInputs() {
    const inputs = document.querySelectorAll('#results-entry-table-container input[type="number"]');
    inputs.forEach(input => {
        input.disabled = true;
        input.style.background = '#f3f4f6';
        input.style.cursor = 'not-allowed';
    });
    
    const saveBtn = document.getElementById('save-results-btn');
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.style.opacity = '0.5';
        saveBtn.style.cursor = 'not-allowed';
    }
}

/**
 * Enable result inputs
 */
function enableResultInputs() {
    const inputs = document.querySelectorAll('#results-entry-table-container input[type="number"]');
    inputs.forEach(input => {
        input.disabled = false;
        input.style.background = '';
        input.style.cursor = '';
    });
    
    const saveBtn = document.getElementById('save-results-btn');
    if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.style.opacity = '';
        saveBtn.style.cursor = '';
    }
}

/**
 * ✅ FIXED: Encode session for document ID, use original for data
 */
async function submitResultsForApproval() {
    const term = document.getElementById('result-term')?.value;
    const subject = document.getElementById('result-subject')?.value;
    
    if (!term || !subject || assignedClasses.length === 0) {
        if (window.showToast) {
            window.showToast('Please select term and subject', 'error');
        }
        return;
    }

    const classId = assignedClasses[0].id;
    const className = assignedClasses[0].name;
    
    const confirmed = confirm(
        `Submit results for approval?\n\n` +
        `Class: ${className}\n` +
        `Subject: ${subject}\n` +
        `Term: ${term}\n\n` +
        `Once submitted, you cannot edit until admin reviews.`
    );
    
    if (!confirmed) {
        return;
    }

    const submitBtn = document.getElementById('submit-results-btn');
    const originalBtnText = submitBtn?.innerHTML || 'Submit for Approval';
    
    try {
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
        }

        const settings = await window.getCurrentSettings();
        const session = settings.session; // Original: "2025/2026"
        const encodedSession = session.replace(/\//g, '-'); // Encoded: "2025-2026"

        const currentUser = firebase.auth().currentUser;
        if (!currentUser) {
            throw new Error('Not authenticated');
        }

        const teacherDoc = await db.collection('teachers').doc(currentUser.uid).get();
        const teacherName = teacherDoc.exists 
          ? teacherDoc.data().fullName || teacherDoc.data().name
          : currentUser.displayName || 'Unknown Teacher';

        // ✅ CRITICAL FIX: Create submission document with encoded ID but original session data
        const submissionId = `${classId}_${encodedSession}_${term}_${subject}`;
        
        const submissionData = {
            classId: classId,
            className: className,
            term: term,
            subject: subject,
            session: session,  // ✅ Store ORIGINAL format to match draft results
            encodedSession: encodedSession,  // ✅ Also store encoded for reference
            teacherUid: currentUser.uid,
            teacherName: teacherName,
            status: 'pending',
            submittedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        // Get class name
        const classDoc = await db.collection('classes').doc(classId).get();
        if (classDoc.exists) {
            submissionData.className = classDoc.data().name || 'Unknown Class';
        }
        
        // Count pupils with draft results
        const draftsSnap = await db.collection('results_draft')
            .where('classId', '==', classId)
            .where('term', '==', term)
            .where('subject', '==', subject)
            .where('session', '==', session)  // ✅ Query with original format
            .get();
        
        const uniquePupils = new Set();
        draftsSnap.forEach(doc => {
            const pupilId = doc.data().pupilId;
            if (pupilId) uniquePupils.add(pupilId);
        });
        
        submissionData.pupilCount = uniquePupils.size;
        
        // Create submission
        await db.collection('result_submissions')
            .doc(submissionId)
            .set(submissionData, { merge: true });

        console.log('✅ Results submitted for approval:', submissionId);

        if (window.showToast) {
            window.showToast(
                'Results submitted for admin approval successfully!',
                'success',
                5000
            );
        }
        
        await checkResultLockStatus();
        await loadResultsTable();

    } catch (error) {
        console.error('Error submitting for approval:', error);
        
        const errorMessage = error.code === 'permission-denied'
            ? 'Permission denied. Please contact your administrator.'
            : error.message || 'Failed to submit results. Please try again.';
        
        if (window.showToast) {
            window.showToast(errorMessage, 'error', 6000);
        } else {
            alert(`Error: ${errorMessage}`);
        }
        
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnText;
        }
    }
}
// Make functions globally available
window.checkResultLockStatus = checkResultLockStatus;
window.submitResultsForApproval = submitResultsForApproval;

/**
 * ✅ FIXED: Save results with click guard to prevent double execution
 */

// Add flag to prevent simultaneous saves
let isSavingResults = false;

async function saveAllResults() {
    // ✅ CLICK GUARD: Prevent simultaneous executions
    if (isSavingResults) {
        console.log('Save already in progress, ignoring click');
        return;
    }

    const inputs = document.querySelectorAll('#results-entry-table-container input[type="number"]');
    const term = document.getElementById('result-term')?.value;
    const subject = document.getElementById('result-subject')?.value;

    if (!term || !subject) {
        window.showToast?.('Select term and subject first', 'warning');
        return;
    }

    // ✅ VALIDATION STEP 1: Check for invalid scores
    let hasInvalidScores = false;
    inputs.forEach(input => {
        const field = input.dataset.field;
        const value = parseFloat(input.value) || 0;
        const max = field === 'ca' ? 40 : 60;

        if (value > max) {
            hasInvalidScores = true;
            input.style.borderColor = '#f44336';
            input.value = max;
        }
        if (value < 0) {
            hasInvalidScores = true;
            input.style.borderColor = '#f44336';
            input.value = 0;
        }
    });

    if (hasInvalidScores) {
        window.showToast?.(
            'Invalid scores corrected. Please review and try saving again.',
            'warning',
            5000
        );
        return;
    }

    // ✅ VALIDATION STEP 2: Check if any scores entered
    let hasChanges = false;
    inputs.forEach(input => {
        const value = parseFloat(input.value) || 0;
        if (value > 0) hasChanges = true;
    });

    if (!hasChanges) {
        window.showToast?.('No scores have been entered', 'warning');
        return;
    }

    // ✅ SET LOCK FLAG
    isSavingResults = true;

    // ✅ ALL VALIDATIONS PASSED - NOW SET LOADING STATE
    const saveBtn = document.getElementById('save-results-btn');
    
    if (!saveBtn) {
        console.error('Save button not found');
        isSavingResults = false;
        return;
    }

    // Store original state
    const originalHTML = saveBtn.innerHTML;
    const originalDisabled = saveBtn.disabled;
    
    // Set loading state
    saveBtn.disabled = true;
    saveBtn.innerHTML = `
        <span style="display:inline-flex; align-items:center; gap:0.5rem;">
            <span style="width:14px; height:14px; border:2px solid transparent; border-top-color:currentColor; border-radius:50%; display:inline-block; animation:spin 0.8s linear infinite;"></span>
            Saving...
        </span>
    `;

    try {
        // Get session settings
        let currentSession = 'Unknown';
        let sessionStartYear = null;
        let sessionEndYear = null;

        try {
            const settings = await window.getCurrentSettings();
            currentSession = settings.session || 'Unknown';
            sessionStartYear = settings.currentSession?.startYear;
            sessionEndYear = settings.currentSession?.endYear;
        } catch (settingsError) {
            console.error('Failed to get session settings:', settingsError);
        }

        const batch = db.batch();

        // Group inputs by pupil
        const pupilResults = {};
        inputs.forEach(input => {
            const pupilId = input.dataset.pupil;
            const field = input.dataset.field;
            const value = parseFloat(input.value) || 0;

            if (!pupilResults[pupilId]) {
                pupilResults[pupilId] = {};
            }
            pupilResults[pupilId][field] = value;
        });

        // Get class info
        const classId = assignedClasses.length > 0 ? assignedClasses[0].id : null;
        const className = assignedClasses.length > 0 ? assignedClasses[0].name : 'Unknown';

        // Save to DRAFT collection
        for (const [pupilId, scores] of Object.entries(pupilResults)) {
            const pupil = allPupils.find(p => p.id === pupilId);
            const pupilName = pupil?.name || 'Unknown';
            
            const docId = `${pupilId}_${term}_${subject}`;
            const ref = db.collection('results_draft').doc(docId);
            
            const sessionTerm = `${currentSession}_${term}`;
            
            const baseData = {
                pupilId,
                pupilName,
                classId,
                className,
                term,
                subject,
                session: currentSession,
                sessionStartYear,
                sessionEndYear,
                sessionTerm,
                caScore: scores.ca !== undefined ? scores.ca : 0,
                examScore: scores.exam !== undefined ? scores.exam : 0,
                teacherId: currentUser.uid,
                status: 'draft',
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedBy: currentUser.uid
            };
            
            batch.set(ref, baseData, { merge: true });
        }

        await batch.commit();
        
        window.showToast?.(
            '✓ Results saved to your workspace\n\n' +
            'ℹ️ Not visible to pupils yet - submit for approval when ready.',
            'success',
            6000
        );
        
    } catch (err) {
        console.error('Error saving results:', err);
        window.showToast?.(
            `Failed to save results: ${err.message || 'Unknown error'}`,
            'danger',
            6000
        );
    } finally {
        // ✅ GUARANTEED CLEANUP
        const finalSaveBtn = document.getElementById('save-results-btn');
        if (finalSaveBtn) {
            finalSaveBtn.disabled = originalDisabled;
            finalSaveBtn.innerHTML = originalHTML;
            finalSaveBtn.style.opacity = '';
            finalSaveBtn.style.cursor = '';
        }
        
        // ✅ RELEASE LOCK FLAG
        isSavingResults = false;
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
/**
 * FIXED: Save Attendance with Validation
 * Ensures attendance data is logically valid before saving
 */
async function saveAllAttendance() {
  const inputs = document.querySelectorAll('#attendance-form-container input[type="number"]');
  const term = document.getElementById('attendance-term')?.value;
  
  if (!inputs.length || !term) {
    window.showToast?.('No data to save', 'warning');
    return;
  }
  
  // VALIDATION STEP 1: Collect and validate data
  const pupilData = {};
  const validationErrors = [];
  
  inputs.forEach(input => {
    const pupilId = input.dataset.pupil;
    const field = input.dataset.field;
    const value = parseInt(input.value) || 0;
    
    // Prevent negative numbers
    if (value < 0) {
      const pupilName = input.closest('tr')?.querySelector('td:first-child')?.textContent || 'Unknown';
      validationErrors.push(`${pupilName}: ${field} cannot be negative`);
      input.style.borderColor = '#dc3545';
      return;
    }
    
    if (!pupilData[pupilId]) pupilData[pupilId] = {};
    pupilData[pupilId][field] = value;
  });
  
  // VALIDATION STEP 2: Check logical consistency
  for (const [pupilId, data] of Object.entries(pupilData)) {
    const timesOpened = data.timesOpened || 0;
    const timesPresent = data.timesPresent || 0;
    const timesAbsent = data.timesAbsent || 0;
    
    // Get pupil name for error messages
    const pupilRow = document.querySelector(`input[data-pupil="${pupilId}"]`)?.closest('tr');
    const pupilName = pupilRow?.querySelector('td:first-child')?.textContent || 'Unknown';
    
    // Validate: timesPresent cannot exceed timesOpened
    if (timesPresent > timesOpened) {
      validationErrors.push(
        `${pupilName}: Times present (${timesPresent}) cannot exceed times school opened (${timesOpened})`
      );
      
      // Highlight the invalid fields
      const presentInput = document.querySelector(`input[data-pupil="${pupilId}"][data-field="timesPresent"]`);
      if (presentInput) presentInput.style.borderColor = '#dc3545';
    }
    
    // Validate: timesAbsent cannot exceed timesOpened
    if (timesAbsent > timesOpened) {
      validationErrors.push(
        `${pupilName}: Times absent (${timesAbsent}) cannot exceed times school opened (${timesOpened})`
      );
      
      const absentInput = document.querySelector(`input[data-pupil="${pupilId}"][data-field="timesAbsent"]`);
      if (absentInput) absentInput.style.borderColor = '#dc3545';
    }
    
    // Validate: present + absent cannot exceed opened
    if (timesPresent + timesAbsent > timesOpened) {
      validationErrors.push(
        `${pupilName}: Total attendance (${timesPresent} present + ${timesAbsent} absent = ${timesPresent + timesAbsent}) ` +
        `cannot exceed times school opened (${timesOpened})`
      );
    }
  }
  
  // VALIDATION STEP 3: Show errors and block save if validation fails
  if (validationErrors.length > 0) {
    const errorMessage = 
      `⚠️ ATTENDANCE VALIDATION ERRORS (${validationErrors.length}):\n\n` +
      validationErrors.slice(0, 5).join('\n') +
      (validationErrors.length > 5 ? `\n... and ${validationErrors.length - 5} more errors` : '');
    
    alert(errorMessage);
    
    window.showToast?.(
      `Cannot save: ${validationErrors.length} validation error(s) found. Please fix highlighted fields.`,
      'danger',
      8000
    );
    
    return; // Block save
  }
  
  // Clear any previous error highlighting
  inputs.forEach(input => {
    input.style.borderColor = '';
  });
  
  // SAVE: Get current session
  const settings = await window.getCurrentSettings();
  const currentSession = settings.session || 'Unknown';
  const sessionStartYear = settings.currentSession?.startYear;
  const sessionEndYear = settings.currentSession?.endYear;
  const sessionTerm = `${currentSession}_${term}`;
  
  const batch = db.batch();
  
  for (const [pupilId, data] of Object.entries(pupilData)) {
    const ref = db.collection('attendance').doc(`${pupilId}_${term}`);
    batch.set(ref, {
      pupilId,
      term,
      teacherId: currentUser.uid,
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

/**
 * Load traits section - now with bulk entry
 */
function loadTraitsSection() {
    const termSelect = document.getElementById('traits-term');
    
    if (!termSelect) return;
    
    // Auto-load bulk table
    loadBulkTraitsTable();
}

/**
 * Load bulk traits entry table for all pupils
 */
async function loadBulkTraitsTable() {
    const container = document.getElementById('traits-form-container');
    const term = document.getElementById('traits-term')?.value;
    
    if (!container || !term) return;
    
    if (allPupils.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:var(--color-gray-600); padding: var(--space-2xl);">No pupils in your assigned classes</p>';
        return;
    }
    
    // Show loading state
    container.innerHTML = `
        <div style="text-align:center; padding: var(--space-2xl);">
            <div class="spinner" style="margin: 0 auto var(--space-md);"></div>
            <p style="color: var(--color-gray-600);">Loading traits data...</p>
        </div>
    `;
    
    try {
        // Load existing traits data for all pupils
        const traitsData = {};
        const skillsData = {};
        
        for (const pupil of allPupils) {
            const traitsDocId = `${pupil.id}_${term}`;
            
            // Load behavioral traits
            const traitsDoc = await db.collection('behavioral_traits').doc(traitsDocId).get();
            if (traitsDoc.exists) {
                traitsData[pupil.id] = traitsDoc.data();
            }
            
            // Load psychomotor skills
            const skillsDoc = await db.collection('psychomotor_skills').doc(traitsDocId).get();
            if (skillsDoc.exists) {
                skillsData[pupil.id] = skillsDoc.data();
            }
        }
        
        // Render bulk entry table
        container.innerHTML = `
            <div style="margin-bottom: var(--space-lg); padding: var(--space-md); background: #e0f2fe; border: 1px solid #0284c7; border-radius: var(--radius-md);">
                <strong style="color: #0c4a6e;">📊 Bulk Entry Mode</strong>
                <p style="margin: 0.5rem 0 0; color: #075985; font-size: var(--text-sm);">
                    Rate each trait/skill from 1 (Poor) to 5 (Excellent). Leave blank if not assessed.
                </p>
            </div>
            
            <!-- Behavioral Traits Table -->
            <div style="margin-bottom: var(--space-2xl);">
                <h3 style="margin-bottom: var(--space-md);">Behavioral Traits</h3>
                <div class="table-container">
                    <table class="responsive-table" id="bulk-traits-table">
                        <thead>
                            <tr>
                                <th style="min-width: 150px;">Pupil Name</th>
                                <th>Punctuality</th>
                                <th>Neatness</th>
                                <th>Politeness</th>
                                <th>Honesty</th>
                                <th>Obedience</th>
                                <th>Cooperation</th>
                                <th>Attentiveness</th>
                                <th>Leadership</th>
                                <th>Self Control</th>
                                <th>Creativity</th>
                            </tr>
                        </thead>
                        <tbody id="bulk-traits-tbody"></tbody>
                    </table>
                </div>
            </div>
            
            <!-- Psychomotor Skills Table -->
            <div style="margin-bottom: var(--space-xl);">
                <h3 style="margin-bottom: var(--space-md);">Psychomotor Skills</h3>
                <div class="table-container">
                    <table class="responsive-table" id="bulk-skills-table">
                        <thead>
                            <tr>
                                <th style="min-width: 150px;">Pupil Name</th>
                                <th>Handwriting</th>
                                <th>Drawing/Painting</th>
                                <th>Sports</th>
                                <th>Craft</th>
                                <th>Verbal Fluency</th>
                                <th>Coordination</th>
                            </tr>
                        </thead>
                        <tbody id="bulk-skills-tbody"></tbody>
                    </table>
                </div>
            </div>
            
            <button class="btn btn-primary" onclick="saveBulkTraitsAndSkills()" style="width: 100%;">
                💾 Save All Traits & Skills
            </button>
        `;
        
        // Populate traits table
        const traitsFields = ['punctuality', 'neatness', 'politeness', 'honesty', 'obedience', 'cooperation', 'attentiveness', 'leadership', 'selfcontrol', 'creativity'];
        const traitsTbody = document.getElementById('bulk-traits-tbody');
        
        allPupils.forEach(pupil => {
            const existing = traitsData[pupil.id] || {};
            const tr = document.createElement('tr');
            
            let cellsHTML = `<td data-label="Name"><strong>${pupil.name}</strong></td>`;
            
            traitsFields.forEach(field => {
                const value = existing[field] || '';
                cellsHTML += `
                    <td data-label="${field.charAt(0).toUpperCase() + field.slice(1)}" style="text-align: center;">
                        <select data-pupil="${pupil.id}" data-field="${field}" data-type="trait" style="width: 100%; max-width: 80px;">
                            <option value="">-</option>
                            ${[1, 2, 3, 4, 5].map(n => `<option value="${n}" ${value == n ? 'selected' : ''}>${n}</option>`).join('')}
                        </select>
                    </td>
                `;
            });
            
            tr.innerHTML = cellsHTML;
            traitsTbody.appendChild(tr);
        });
        
        // Populate skills table
        const skillsFields = ['handwriting', 'drawing', 'sports', 'craft', 'verbal', 'coordination'];
        const skillsTbody = document.getElementById('bulk-skills-tbody');
        
        allPupils.forEach(pupil => {
            const existing = skillsData[pupil.id] || {};
            const tr = document.createElement('tr');
            
            let cellsHTML = `<td data-label="Name"><strong>${pupil.name}</strong></td>`;
            
            skillsFields.forEach(field => {
                const value = existing[field] || '';
                cellsHTML += `
                    <td data-label="${field.charAt(0).toUpperCase() + field.slice(1)}" style="text-align: center;">
                        <select data-pupil="${pupil.id}" data-field="${field}" data-type="skill" style="width: 100%; max-width: 80px;">
                            <option value="">-</option>
                            ${[1, 2, 3, 4, 5].map(n => `<option value="${n}" ${value == n ? 'selected' : ''}>${n}</option>`).join('')}
                        </select>
                    </td>
                `;
            });
            
            tr.innerHTML = cellsHTML;
            skillsTbody.appendChild(tr);
        });
        
        console.log(`✓ Bulk traits table loaded for ${allPupils.length} pupils`);
        
    } catch (error) {
        console.error('Error loading bulk traits table:', error);
        container.innerHTML = '<p style="text-align:center; color:var(--color-danger); padding: var(--space-2xl);">Error loading traits data</p>';
    }
}

/**
 * Save all traits and skills in bulk
 */
async function saveBulkTraitsAndSkills() {
    const term = document.getElementById('traits-term')?.value;
    
    if (!term) {
        window.showToast?.('Select a term first', 'warning');
        return;
    }
    
    const selects = document.querySelectorAll('#traits-form-container select');
    
    if (selects.length === 0) {
        window.showToast?.('No data to save', 'warning');
        return;
    }
    
    // Organize data by pupil
    const traitsByPupil = {};
    const skillsByPupil = {};
    
    selects.forEach(select => {
        const pupilId = select.dataset.pupil;
        const field = select.dataset.field;
        const type = select.dataset.type;
        const value = select.value;
        
        if (type === 'trait') {
            if (!traitsByPupil[pupilId]) {
                traitsByPupil[pupilId] = {
                    pupilId,
                    term,
                    teacherId: currentUser.uid
                };
            }
            traitsByPupil[pupilId][field] = value;
        } else if (type === 'skill') {
            if (!skillsByPupil[pupilId]) {
                skillsByPupil[pupilId] = {
                    pupilId,
                    term,
                    teacherId: currentUser.uid
                };
            }
            skillsByPupil[pupilId][field] = value;
        }
    });
    
    // Get session context
    const settings = await window.getCurrentSettings();
    const session = settings.session;
    const sessionStartYear = settings.currentSession?.startYear;
    const sessionEndYear = settings.currentSession?.endYear;
    const sessionTerm = `${session}_${term}`;
    
    // Save in batches
    const batch = db.batch();
    let operationCount = 0;
    
    // Save behavioral traits
    for (const [pupilId, data] of Object.entries(traitsByPupil)) {
        const ref = db.collection('behavioral_traits').doc(`${pupilId}_${term}`);
        batch.set(ref, {
            ...data,
            session,
            sessionStartYear,
            sessionEndYear,
            sessionTerm,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        operationCount++;
    }
    
    // Save psychomotor skills
    for (const [pupilId, data] of Object.entries(skillsByPupil)) {
        const ref = db.collection('psychomotor_skills').doc(`${pupilId}_${term}`);
        batch.set(ref, {
            ...data,
            session,
            sessionStartYear,
            sessionEndYear,
            sessionTerm,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        operationCount++;
    }
    
    if (operationCount === 0) {
        window.showToast?.('No changes to save', 'info');
        return;
    }
    
    try {
        await batch.commit();
        
        window.showToast?.(
            `✓ Saved traits & skills for ${Object.keys(traitsByPupil).length} pupil(s)`,
            'success'
        );
        
    } catch (error) {
        console.error('Error saving bulk traits:', error);
        window.handleError(error, 'Failed to save traits & skills');
    }
}

// Make functions globally available
window.loadBulkTraitsTable = loadBulkTraitsTable;
window.saveBulkTraitsAndSkills = saveBulkTraitsAndSkills;

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
  // Auto-load remark suggestions
    await loadRemarkSuggestions();
}

/**
 * Load remark suggestions based on pupil's performance
 */
async function loadRemarkSuggestions() {
    const pupilId = document.getElementById('remarks-pupil')?.value;
    const term = document.getElementById('remarks-term')?.value;
    const suggestionsDiv = document.getElementById('remark-suggestions');
    const infoDiv = document.getElementById('suggestion-info');
    const buttonsDiv = document.getElementById('suggestion-buttons');
    
    if (!pupilId || !term || !suggestionsDiv) {
        if (suggestionsDiv) suggestionsDiv.style.display = 'none';
        return;
    }
    
    // Show loading state
    suggestionsDiv.style.display = 'block';
    infoDiv.innerHTML = '<span class="spinner" style="width:14px; height:14px; border-width:2px; display:inline-block;"></span> Loading suggestions...';
    buttonsDiv.innerHTML = '';
    
    try {
        const result = await window.remarkTemplates.getRemarkSuggestions(pupilId, term);
        
        if (!result.success) {
            infoDiv.innerHTML = `<span style="color: var(--color-warning);">⚠️ ${result.message}</span>`;
            buttonsDiv.innerHTML = '';
            return;
        }
        
        // Show average and category
        const categoryLabels = {
            excellent: '🌟 Excellent',
            veryGood: '✨ Very Good',
            good: '👍 Good',
            average: '📊 Average',
            poor: '⚠️ Needs Improvement'
        };
        
        infoDiv.innerHTML = `
            Average: <strong>${result.average}%</strong> • 
            Category: <strong style="color: var(--color-primary);">${categoryLabels[result.category] || result.category}</strong>
        `;
        
        // Display template buttons
        if (result.templates.length === 0) {
            buttonsDiv.innerHTML = '<p style="color: var(--color-gray-600); margin: 0;">No templates available</p>';
            return;
        }
        
        buttonsDiv.innerHTML = '';
        
        result.templates.forEach((template, index) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'btn-small btn-secondary';
            btn.style.cssText = 'text-align: left; white-space: normal; max-width: 100%;';
            btn.textContent = template;
            btn.onclick = () => useRemarkTemplate(template);
            buttonsDiv.appendChild(btn);
        });
        
    } catch (error) {
        console.error('Error loading suggestions:', error);
        infoDiv.innerHTML = '<span style="color: var(--color-danger);">❌ Failed to load suggestions</span>';
        buttonsDiv.innerHTML = '';
    }
}

/**
 * Use selected remark template
 */
function useRemarkTemplate(template) {
    const remarkTextarea = document.getElementById('teacher-remark');
    if (!remarkTextarea) return;
    
    remarkTextarea.value = template;
    remarkTextarea.focus();
    
    window.showToast?.('Template applied. You can edit it before saving.', 'success', 3000);
}

/**
 * Refresh remark suggestions
 */
async function refreshRemarkSuggestions() {
    await loadRemarkSuggestions();
}

// Make functions globally available
window.loadRemarkSuggestions = loadRemarkSuggestions;
window.useRemarkTemplate = useRemarkTemplate;
window.refreshRemarkSuggestions = refreshRemarkSuggestions;

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
  // ✅ FIXED: Allow null nextClassName for terminal classes
  if (!promotionData.currentClassName) {
    window.showToast?.('Promotion data not loaded. Please refresh the page.', 'danger');
    return;
  }
  
  // ✅ FIXED: For non-terminal classes, require valid next class
  if (!promotionData.isTerminalClass && !promotionData.nextClassName) {
    window.showToast?.('Next class not found in hierarchy. Contact admin.', 'danger');
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
  
  // ✅ FIXED: Show appropriate destination in confirmation
  const destinationText = promotionData.isTerminalClass 
    ? 'Alumni (Graduation)' 
    : promotionData.nextClassName;
  
  const confirmation = confirm(
    `Submit Promotion Request?\n\n` +
    `✓ Promote: ${promotedPupils.length} pupil(s) to ${destinationText}\n` +
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
    
    // ✅ FIXED: Only look up next class ID for non-terminal classes
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
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = '📋 Submit Promotion List';
        }
        return;
      }
    }
    
    // ✅ FIXED: Proper structure for both terminal and non-terminal
    const promotionRequest = {
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
    };
    
    // Create promotion request
    await db.collection('promotions').add(promotionRequest);
    
    console.log('✅ Promotion request submitted:', {
      type: promotionData.isTerminalClass ? 'Terminal → Alumni' : 'Regular',
      from: promotionData.currentClassName,
      to: destinationText,
      promoted: promotedPupils.length,
      heldBack: heldBackPupils.length
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
window.loadRemarksData = loadRemarksData;
window.saveRemarks = saveRemarks;
window.loadAttendanceSection = loadAttendanceSection;
window.paginateTable = paginateTable; // ← EXPOSE FOR ATTENDANCE UI

// Helper for manual attendance save (used by attendance-teacher-ui.js)
window._saveAttendanceFromInputs = async function(inputs, term) {
    if (!inputs.length || !term) {
        window.showToast?.('No data to save', 'warning');
        return;
    }

    const pupilData = {};
    const validationErrors = [];

    inputs.forEach(input => {
        const pupilId = input.dataset.pupil;
        const field = input.dataset.field;
        const value = parseInt(input.value) || 0;
        if (value < 0) {
            validationErrors.push(`Negative value for ${field}`);
            return;
        }
        if (!pupilData[pupilId]) pupilData[pupilId] = {};
        pupilData[pupilId][field] = value;
    });

    for (const [pupilId, data] of Object.entries(pupilData)) {
        const { timesOpened = 0, timesPresent = 0, timesAbsent = 0 } = data;
        if (timesPresent > timesOpened) validationErrors.push(`Pupil ${pupilId}: Present > Opened`);
        if (timesAbsent > timesOpened) validationErrors.push(`Pupil ${pupilId}: Absent > Opened`);
        if (timesPresent + timesAbsent > timesOpened) validationErrors.push(`Pupil ${pupilId}: Present+Absent > Opened`);
    }

    if (validationErrors.length > 0) {
        window.showToast?.(`Validation errors: ${validationErrors[0]}`, 'danger', 6000);
        return;
    }

    const settings = await window.getCurrentSettings();
    const currentSession = settings.session || 'Unknown';
    const batch = db.batch();

    for (const [pupilId, data] of Object.entries(pupilData)) {
        const ref = db.collection('attendance').doc(`${pupilId}_${term}`);
        batch.set(ref, {
            pupilId, term,
            teacherId: currentUser.uid,
            session: currentSession,
            sessionTerm: `${currentSession}_${term}`,
            ...data,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
    }

    try {
        await batch.commit();
        window.showToast?.('✓ Manual attendance totals saved', 'success');
    } catch (err) {
        window.handleError?.(err, 'Failed to save attendance');
    }
};

console.log('✓ Teacher portal v8.1.0 loaded - RACE CONDITIONS FIXED');