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


/* Firestore v9 modular imports - only Firestore related imports added as requested */
import {
  collection,
  doc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  limit,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  runTransaction,
  serverTimestamp,
  Timestamp,
  arrayUnion,
  deleteField
} from 'firebase/firestore';

'use strict';

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

/* =====================================================
   CRITICAL: WAIT FOR AUTHENTICATION BEFORE ANYTHING ELSE
===================================================== */

console.log('🔐 Waiting for authentication...');

// Wait for BOTH authentication AND DOM to be ready
let authUser = null;
let domReady = false;

function tryInitialize() {
  if (authUser && domReady) {
    console.log('✅ Both auth and DOM ready - initializing');
    initializeAdminPortal();
  }
}

// Wait for authentication
window.checkRole('admin')
  .then(async user => {
    console.log('✓ Admin authenticated:', user.email);
    authUser = user;
    tryInitialize();
  })
  .catch(err => {
    console.error('❌ Authentication failed:', err);
  });

// Wait for DOM
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    console.log('✓ DOM ready');
    domReady = true;
    tryInitialize();
  });
} else {
  console.log('✓ DOM already ready');
  domReady = true;
  tryInitialize();
}

// Logout handler (safe - uses optional chaining)
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('admin-logout')?.addEventListener('click', (e) => {
    e.preventDefault();
    window.logout();
  });
});

// ============================================
// INITIALIZATION WITH DATA LOADING
// ============================================

/**
 * Initialize admin portal with proper loading sequence
 * Replace initializeAdminPortal function (around line 100)
 */
async function initializeAdminPortal() {
  console.log('🚀 Initializing admin portal...');
  
  // CRITICAL: Verify DOM is ready
  const sidebar = document.getElementById('admin-sidebar');
  const hamburger = document.getElementById('hamburger');
  const dashboard = document.getElementById('dashboard');
  
  if (!sidebar || !hamburger || !dashboard) {
    console.error('❌ Critical elements missing!', {
      sidebar: !!sidebar,
      hamburger: !!hamburger,
      dashboard: !!dashboard
    });
    
    // Retry after short delay
    setTimeout(() => {
      console.log('⏳ Retrying initialization...');
      initializeAdminPortal();
    }, 100);
    return;
  }
  
  console.log('✓ All critical elements found');
  
  // Step 1: Setup sidebar FIRST (this includes hamburger menu handling)
  setupSidebarNavigation();
  
  // Step 2: Mark data as loading
  isLoadingAdminData = true;
  
  // Step 3: Load initial data
  try {
    console.log('📊 Loading initial admin data...');
    
    // Load essential data first
    await loadDashboardStats();
    
    // Mark data as loaded
    adminDataLoaded = true;
    isLoadingAdminData = false;
    
    console.log('✓ Admin data loaded successfully');
    
  } catch (error) {
    console.error('❌ Failed to load admin data:', error);
    isLoadingAdminData = false;
    adminDataLoaded = false;
    
    window.showToast?.(
      'Some data failed to load. Some features may be unavailable.',
      'warning',
      6000
    );
  }
  
  // Step 4: Show dashboard
  showSection('dashboard');
  
  // Step 5: Initialize class hierarchy
  try {
    await window.classHierarchy.initializeClassHierarchy();
    console.log('✓ Class hierarchy initialized');
  } catch (error) {
    console.error('⚠️ Class hierarchy init failed:', error);
  }
  
  console.log('✅ Admin portal initialized successfully');
}

/* =====================================================
   SIDEBAR NAVIGATION - COMPLETE REWRITE
===================================================== */

/**
 * FIXED ADMIN SIDEBAR NAVIGATION
 * Following the same robust pattern as teacher portal
 * 
 * Replace the setupSidebarNavigation() function in admin.js (lines 168-265)
 */

// ============================================
// LOADING STATE FLAGS (Add at top of admin.js after line 20)
// ============================================
let adminDataLoaded = false;
let isLoadingAdminData = false;

// ============================================
// SIDEBAR NAVIGATION SETUP (Replaces lines 168-265)
// ============================================

function setupSidebarNavigation() {
  console.log('🔧 Setting up admin sidebar navigation...');
  
  // Prevent double initialization
  if (window.adminSidebarInitialized) {
    console.log('⚠️ Sidebar already initialized, skipping');
    return;
  }
  
  const hamburger = document.getElementById('hamburger');
  const sidebar = document.getElementById('admin-sidebar');
  
  // CRITICAL FIX: Better validation with retry
  if (!hamburger || !sidebar) {
    console.error('❌ Hamburger or sidebar not found!', {
      hamburger: !!hamburger,
      sidebar: !!sidebar
    });
    
    // Retry after a short delay (DOM might not be ready)
    console.log('⏳ Retrying hamburger setup in 200ms...');
    setTimeout(() => {
      window.adminSidebarInitialized = false; // Reset flag
      setupSidebarNavigation(); // Retry
    }, 200);
    return;
  }
  
  console.log('✓ Found hamburger and sidebar elements');
  
  // Remove any existing event listeners by cloning (prevents duplicates)
  const newHamburger = hamburger.cloneNode(true);
  hamburger.parentNode.replaceChild(newHamburger, hamburger);
  const freshHamburger = document.getElementById('hamburger');
  
  console.log('🎯 Setting up hamburger click handler...');
  
  // Main hamburger toggle
  freshHamburger.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log('🔘 Hamburger clicked!');
    
    const isActive = sidebar.classList.toggle('active');
    freshHamburger.classList.toggle('active', isActive);
    freshHamburger.setAttribute('aria-expanded', isActive);
    document.body.style.overflow = isActive ? 'hidden' : '';
    
    console.log(`Sidebar is now: ${isActive ? 'OPEN' : 'CLOSED'}`);
  });
  
  // Close sidebar when clicking outside
  document.addEventListener('click', (e) => {
    if (sidebar.classList.contains('active') && 
        !sidebar.contains(e.target) && 
        !freshHamburger.contains(e.target)) {
      sidebar.classList.remove('active');
      freshHamburger.classList.remove('active');
      freshHamburger.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
      console.log('📍 Sidebar closed (clicked outside)');
    }
  });
  
  // Close on escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sidebar.classList.contains('active')) {
      sidebar.classList.remove('active');
      freshHamburger.classList.remove('active');
      freshHamburger.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
      console.log('⌨️ Sidebar closed (Escape key)');
    }
  });
  
  // Setup sidebar navigation links
  sidebar.querySelectorAll('a[data-section]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const sectionId = link.dataset.section;
      
      if (!sectionId) return;
      
      console.log(`📍 Navigating to: ${sectionId}`);
      
      // Update active state
      document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
      link.classList.add('active');
      
      // Show section
      showSection(sectionId);
      
      // Close mobile sidebar
      if (window.innerWidth <= 1024) {
        sidebar.classList.remove('active');
        freshHamburger.classList.remove('active');
        freshHamburger.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
      }
    });
  });
  
  // ✅ NEW: Setup group toggle buttons
  console.log('🎯 Setting up group toggle buttons...');
  const groupToggles = sidebar.querySelectorAll('.sidebar-group-toggle-modern');
  
  console.log(`Found ${groupToggles.length} group toggle buttons`);
  
  groupToggles.forEach((toggle, index) => {
    // Remove any existing listeners by cloning
    const newToggle = toggle.cloneNode(true);
    toggle.parentNode.replaceChild(newToggle, toggle);
    
    // Get the fresh reference
    const freshToggle = sidebar.querySelectorAll('.sidebar-group-toggle-modern')[index];
    
    freshToggle.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      const groupName = freshToggle.dataset.group;
      console.log(`🔽 Group toggle clicked: ${groupName}`);
      
      const content = freshToggle.nextElementSibling;
      
      if (!content) {
        console.error('❌ No content element found for toggle');
        return;
      }
      
      const isExpanded = freshToggle.getAttribute('aria-expanded') === 'true';
      
      // Toggle state
      freshToggle.setAttribute('aria-expanded', !isExpanded);
      content.classList.toggle('active');
      
      // Rotate chevron icon
      const chevron = freshToggle.querySelector('.toggle-icon');
      if (chevron) {
        chevron.style.transform = isExpanded ? 'rotate(0deg)' : 'rotate(180deg)';
      }
      
      console.log(`Group ${groupName} is now: ${!isExpanded ? 'EXPANDED' : 'COLLAPSED'}`);
    });
    
    console.log(`✓ Group toggle #${index + 1} initialized`);
  });
  
  // Handle window resize
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (window.innerWidth > 1024 && sidebar.classList.contains('active')) {
        sidebar.classList.remove('active');
        freshHamburger.classList.remove('active');
        freshHamburger.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
      }
    }, 250);
  });
  
  window.adminSidebarInitialized = true;
  console.log('✅ Admin sidebar navigation initialized successfully');
}

// ============================================
// SHOW SECTION (Teacher-style validation)
// ============================================

/**
 * Show section with loading state validation (like teacher portal)
 * Replace showSection function in admin.js (around line 280)
 */
function showSection(sectionId) {
  if (!sectionId) {
    console.error('❌ showSection called with no sectionId');
    return;
  }

  console.log(`📄 Showing section: ${sectionId}`);

  // TEACHER-STYLE: Check if data is loaded (except dashboard)
  if (!adminDataLoaded && sectionId !== 'dashboard' && !isLoadingAdminData) {
    window.showToast?.('Loading data, please wait...', 'info', 3000);
    console.warn('⚠️ Data not loaded yet, showing dashboard instead');
    sectionId = 'dashboard'; // Fallback to dashboard
  }

  // ✅ FIXED: Hide only TOP-LEVEL sections, not nested .admin-card elements
  document
    .querySelectorAll('main > .content-wrapper > .admin-card')
    .forEach(card => {
      card.style.display = 'none';
    });

  // Show target section
  const section = document.getElementById(sectionId);
  if (!section) {
    console.error(`❌ Section not found: ${sectionId}`);
    return;
  }

  section.style.display = 'block';

  // Update active link
  document.querySelectorAll('.sidebar-link').forEach(link => {
    link.classList.remove('active');
  });

  const activeLink = document.querySelector(
    `.sidebar-link[data-section="${sectionId}"]`
  );

  if (activeLink) {
    activeLink.classList.add('active');

    // Expand parent group if nested
    const parentGroup = activeLink.closest(
      '.sidebar-group-content-modern'
    );

    if (parentGroup) {
      parentGroup.classList.add('active');
      const toggle = parentGroup.previousElementSibling;

      if (toggle?.classList.contains('sidebar-group-toggle-modern')) {
        toggle.setAttribute('aria-expanded', 'true');
        const icon = toggle.querySelector('.toggle-icon');
        if (icon) icon.style.transform = 'rotate(180deg)';
      }
    }
  }

  // Load section data
  loadSectionData(sectionId);

  // Close mobile sidebar
  const sidebar = document.getElementById('admin-sidebar');
  const hamburger = document.getElementById('hamburger');

  if (sidebar?.classList.contains('active')) {
    sidebar.classList.remove('active');
    hamburger?.classList.remove('active');
    hamburger?.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }
}


// ============================================
// LOAD SECTION DATA (Defensive loading)
// ============================================

/**
 * Load section data with validation
 * Replace loadSectionData function (around line 320)
 */
function loadSectionData(sectionId) {
  console.log(`📊 Loading data for: ${sectionId}`);
  
  // Show loading indicator for data-heavy sections
  const showLoadingForSection = (id) => {
    const section = document.getElementById(id);
    if (!section) return;
    
    const container = section.querySelector('.table-container tbody') || 
                      section.querySelector('.stats-grid') ||
                      section;
    
    if (container) {
      const loadingDiv = document.createElement('div');
      loadingDiv.className = 'section-loading';
      loadingDiv.style.cssText = 'text-align:center; padding:var(--space-2xl); color:var(--color-gray-600);';
      loadingDiv.innerHTML = `
        <div class="spinner" style="margin: 0 auto var(--space-md);"></div>
        <p>Loading ${id.replace(/-/g, ' ')}...</p>
      `;
      container.innerHTML = '';
      container.appendChild(loadingDiv);
    }
  };
  
  try {
    // Show loading state for sections that take time
    const loadingSections = ['teachers', 'pupils', 'classes', 'subjects'];
    if (loadingSections.includes(sectionId)) {
      showLoadingForSection(sectionId);
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
      case 'assign-teachers':
        loadTeacherAssignments();
        break;
      case 'promotion-requests':
        loadPromotionRequests();
        break;
      case 'result-approvals':
        loadResultApprovals();
        break;
      case 'announcements':
        loadAdminAnnouncements();
        break;
      case 'alumni':
        loadAlumni();
        break;
      case 'audit-log':
        loadAuditLog();
        break;
      case 'view-results':
        loadViewResultsSection();
        break;
      case 'settings':
        loadCurrentSettings();
        setTimeout(async () => {
          await loadClassHierarchyUI();
        }, 200);
        loadSessionHistory();
        break;
      case 'fee-management':
        loadFeeManagementSection();
        break;
      case 'record-payment':
        loadPaymentRecordingSection();
        break;
      case 'outstanding-fees':
        loadOutstandingFeesReport();
        break;
      case 'financial-reports':
        loadFinancialReports();
        break;
      default:
        console.log(`ℹ️ No data loader for: ${sectionId}`);
    }
  } catch (error) {
    console.error(`❌ Error loading ${sectionId}:`, error);
    window.showToast?.(`Failed to load ${sectionId}`, 'danger');
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
    
    const snapshot = await getDocs(query(collection(db, 'promotions'), orderBy('createdAt', 'desc')));
    
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
      const teacherDocSnap = await getDoc(doc(db, 'teachers', teacherId));
      if (teacherDocSnap.exists()) {
        teacherNames[teacherId] = teacherDocSnap.data().name;
      }
    }
    
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
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
          <button class="btn-small btn-primary" onclick="viewPromotionDetails('${docSnap.id}')">
            View Details
          </button>
          ${data.status === 'pending' ? `
            <button class="btn-small btn-success" onclick="quickApprovePromotion('${docSnap.id}')">
              ✓ Approve
            </button>
            <button class="btn-small btn-danger" onclick="quickRejectPromotion('${docSnap.id}')">
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

async function togglePromotionPeriod() {
  try {
    const settingsDocSnap = await getDoc(doc(db, 'settings', 'current'));
    const currentStatus = settingsDocSnap.exists() && settingsDocSnap.data().promotionPeriodActive === true;
    const newStatus = !currentStatus;
    
    const action = newStatus ? 'open' : 'close';
    const confirmation = confirm(
      `${action.toUpperCase()} Promotion Period?\n\n` +
      (newStatus 
        ? 'Teachers will be able to submit promotion requests.'
        : 'Teachers will no longer be able to submit promotion requests.\nExisting pending requests will remain.')
    );
    
    if (!confirmation) return;
    
    await setDoc(doc(db, 'settings', 'current'), {
      promotionPeriodActive: newStatus,
      updatedAt: serverTimestamp()
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
    const docSnap = await getDoc(doc(db, 'promotions', promotionId));
    
    if (!docSnap.exists()) {
      window.showToast?.('Promotion request not found', 'danger');
      return;
    }
    
    currentPromotionId = promotionId;
    currentPromotionData = docSnap.data();
    
    // Get teacher name
    let teacherName = 'Unknown';
    if (currentPromotionData.initiatedBy) {
      const teacherDocSnap = await getDoc(doc(db, 'teachers', currentPromotionData.initiatedBy));
      if (teacherDocSnap.exists()) {
        teacherName = teacherDocSnap.data().name;
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
      const classesSnap = await getDocs(query(collection(db, 'classes'), orderBy('name')));
      classesSnap.forEach(docSnap => {
        const opt = document.createElement('option');
        opt.value = docSnap.id;
        opt.textContent = docSnap.data().name;
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
  const promotionDocSnap = await getDoc(doc(db, 'promotions', promotionId));
  
  if (!promotionDocSnap.exists()) {
    throw new Error('Promotion request not found');
  }
  
  const data = promotionDocSnap.data();
  
  if (!data.toClass || !data.toClass.id) {
    throw new Error('Invalid promotion data: missing target class');
  }
  
  // CRITICAL FIX: Proper batch size limit
  const BATCH_SIZE = 400; // Safe limit under Firestore's 500
  let currentBatch = writeBatch(db);
  let operationCount = 0;
  let batchNumber = 1;
  let totalOperations = 0;

  // Helper function to commit current batch safely
  async function commitCurrentBatch() {
    if (operationCount > 0) {
      console.log(`📦 Committing batch ${batchNumber} with ${operationCount} operations...`);
      
      try {
        await currentBatch.commit();
        console.log(`✅ Batch ${batchNumber} committed successfully`);
        
        batchNumber++;
        currentBatch = writeBatch(db);
        operationCount = 0;
        
        // Small delay between batches to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`❌ Batch ${batchNumber} failed:`, error);
        throw new Error(`Promotion failed at batch ${batchNumber}. Error: ${error.message}`);
      }
    }
  }

  // Get class details if not terminal
  let toClassDetails = null;
  if (!data.isTerminalClass) {
    const toClassDocSnap = await getDoc(doc(db, 'classes', data.toClass.id));
    if (toClassDocSnap.exists()) {
      toClassDetails = toClassDocSnap.data();
    }
  }

  // Process promoted pupils
  console.log(`📝 Processing ${promotedPupils.length} promoted pupils...`);
  
  for (const pupilId of promotedPupils) {
    const pupilRef = doc(db, 'pupils', pupilId);
    const pupilDocSnap = await getDoc(pupilRef);
    
    if (!pupilDocSnap.exists()) {
      console.warn(`⚠️ Pupil ${pupilId} not found, skipping`);
      continue;
    }
    
    const pupilData = pupilDocSnap.data();

    if (data.isTerminalClass) {
      // Move to alumni (2 operations)
      const alumniRef = doc(db, 'alumni', pupilId);
      
      currentBatch.set(alumniRef, {
        ...pupilData,
        graduationSession: data.fromSession,
        graduationDate: serverTimestamp(),
        finalClass: data.fromClass.name,
        promotionDate: serverTimestamp()
      });
      operationCount++;
      totalOperations++;
      
      currentBatch.delete(pupilRef);
      operationCount++;
      totalOperations++;
      
    } else {
      // Regular promotion (1 operation)
      currentBatch.update(pupilRef, {
        'class.id': data.toClass.id,
        'class.name': data.toClass.name,
        subjects: toClassDetails?.subjects || [],
        promotionHistory: arrayUnion({
          session: data.fromSession,
          fromClass: data.fromClass.name,
          toClass: data.toClass.name,
          promoted: true,
          date: serverTimestamp()
        }),
        updatedAt: serverTimestamp()
      });
      operationCount++;
      totalOperations++;
    }
    
    // Commit if batch is full
    if (operationCount >= BATCH_SIZE) {
      await commitCurrentBatch();
    }
  }

  // Process held back pupils
  console.log(`📝 Processing ${heldBackPupils.length} held back pupils...`);
  
  for (const pupilId of heldBackPupils) {
    const pupilRef = doc(db, 'pupils', pupilId);
    const pupilDocSnap = await getDoc(pupilRef);
    
    if (!pupilDocSnap.exists()) {
      console.warn(`⚠️ Pupil ${pupilId} not found, skipping`);
      continue;
    }
    
    currentBatch.update(pupilRef, {
      promotionHistory: arrayUnion({
        session: data.fromSession,
        fromClass: data.fromClass.name,
        toClass: data.fromClass.name,
        promoted: false,
        reason: 'Held back by admin/teacher decision',
        date: serverTimestamp()
      }),
      updatedAt: serverTimestamp()
    });
    operationCount++;
    totalOperations++;
    
    if (operationCount >= BATCH_SIZE) {
      await commitCurrentBatch();
    }
  }

  // Process manual overrides
  console.log(`📝 Processing ${manualOverrides.length} manual overrides...`);
  
  for (const override of manualOverrides) {
    const pupilRef = doc(db, 'pupils', override.pupilId);
    const pupilDocSnap = await getDoc(pupilRef);
    
    if (!pupilDocSnap.exists()) {
      console.warn(`⚠️ Pupil ${override.pupilId} not found, skipping`);
      continue;
    }
    
    const pupilData = pupilDocSnap.data();

    if (override.classId === 'alumni') {
      // Move to alumni (2 operations)
      const alumniRef = doc(db, 'alumni', override.pupilId);
      
      currentBatch.set(alumniRef, {
        ...pupilData,
        graduationSession: data.fromSession,
        graduationDate: serverTimestamp(),
        finalClass: data.fromClass.name,
        manualOverride: true,
        promotionDate: serverTimestamp()
      });
      operationCount++;
      totalOperations++;
      
      currentBatch.delete(pupilRef);
      operationCount++;
      totalOperations++;
      
    } else {
      // Move to specific class
      const overrideClassDocSnap = await getDoc(doc(db, 'classes', override.classId));
      
      if (overrideClassDocSnap.exists()) {
        const overrideClassData = overrideClassDocSnap.data();
        
        currentBatch.update(pupilRef, {
          'class.id': override.classId,
          'class.name': overrideClassData.name,
          subjects: overrideClassData.subjects || [],
          promotionHistory: arrayUnion({
            session: data.fromSession,
            fromClass: data.fromClass.name,
            toClass: overrideClassData.name,
            promoted: true,
            manualOverride: true,
            date: serverTimestamp()
          }),
          updatedAt: serverTimestamp()
        });
        operationCount++;
        totalOperations++;
      }
    }
    
    if (operationCount >= BATCH_SIZE) {
      await commitCurrentBatch();
    }
  }

  // Mark promotion as completed (1 operation)
  currentBatch.update(doc(db, 'promotions', promotionId), {
    status: 'completed',
    approvedBy: auth.currentUser.uid,
    approvedAt: serverTimestamp(),
    executedAt: serverTimestamp()
  });
  operationCount++;
  totalOperations++;

  // Commit final batch
  await commitCurrentBatch();
  
  console.log(`✅ Promotion completed successfully!`);
  console.log(`   - ${promotedPupils.length} pupils promoted`);
  console.log(`   - ${heldBackPupils.length} pupils held back`);
  console.log(`   - ${manualOverrides.length} manual overrides`);
  console.log(`   - Total batches: ${batchNumber - 1}`);
  console.log(`   - Total operations: ${totalOperations}`);
}

async function rejectPromotion() {
  if (!currentPromotionId) {
    window.showToast?.('No promotion selected', 'danger');
    return;
  }

  const reason = prompt('Reason for rejection (optional):');

  try {
    await updateDoc(doc(db, 'promotions', currentPromotionId), {
      status: 'rejected',
      rejectedBy: auth.currentUser.uid,
      rejectedAt: serverTimestamp(),
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
    const docSnap = await getDoc(doc(db, 'promotions', promotionId));
    const data = docSnap.data();

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
    await updateDoc(doc(db, 'promotions', promotionId), {
      status: 'rejected',
      rejectedBy: auth.currentUser.uid,
      rejectedAt: serverTimestamp()
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
    const snapshot = await getDocs(query(collection(db, 'promotions'), where('status', '==', 'pending')));

    if (snapshot.empty) {
      window.showToast?.('No pending requests to approve', 'info');
      return;
    }

    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      await executePromotion(
        docSnap.id,
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
    const snapshot = await getDocs(query(collection(db, 'promotions'), where('status', '==', 'pending')));

    if (snapshot.empty) {
      window.showToast?.('No pending requests to reject', 'info');
      return;
    }

    const batch = writeBatch(db);

    snapshot.forEach(docSnap => {
      batch.update(doc(db, 'promotions', docSnap.id), {
        status: 'rejected',
        rejectedBy: auth.currentUser.uid,
        rejectedAt: serverTimestamp(),
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

/**
 * Load promotion period status
 */
async function loadPromotionPeriodStatus() {
  const statusEl = document.getElementById('promotion-period-status');
  const toggleBtn = document.getElementById('toggle-promotion-period-btn');
  
  if (!statusEl || !toggleBtn) return;
  
  try {
    const settingsDocSnap = await getDoc(doc(db, 'settings', 'current'));
    const isActive = settingsDocSnap.exists() && settingsDocSnap.data().promotionPeriodActive === true;
    
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

/**
 * Load result approvals section
 */
async function loadResultApprovals() {
  const tbody = document.getElementById('result-approvals-table');
  const noApprovalsMsg = document.getElementById('no-approvals-message');
  
  if (!tbody) return;
  
  tbody.innerHTML = '<tr><td colspan="8" class="table-loading">Loading approvals...</td></tr>';
  
  try {
    const submissions = await window.resultLocking.getSubmittedResults();
    
    tbody.innerHTML = '';
    
    if (submissions.length === 0) {
      if (noApprovalsMsg) noApprovalsMsg.style.display = 'block';
      return;
    }
    
    if (noApprovalsMsg) noApprovalsMsg.style.display = 'none';
    
    for (const submission of submissions) {
      const submittedDate = submission.submittedAt 
        ? submission.submittedAt.toDate().toLocaleDateString('en-GB')
        : '-';
      
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td data-label="Teacher">${submission.teacherName || 'Unknown'}</td>
        <td data-label="Class">${submission.className || '-'}</td>
        <td data-label="Subject">${submission.subject || '-'}</td>
        <td data-label="Term">${submission.term || '-'}</td>
        <td data-label="Pupils" style="text-align:center;">${submission.pupilCount || 0}</td>
        <td data-label="Submitted">${submittedDate}</td>
        <td data-label="Status">
          <span class="status-pending">Pending</span>
        </td>
        <td data-label="Actions">
          <button class="btn-small btn-success" onclick="approveResultSubmission('${submission.id}')">
            ✓ Approve
          </button>
          <button class="btn-small btn-danger" onclick="rejectResultSubmission('${submission.id}')">
            ✗ Reject
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    }
    
  } catch (error) {
    console.error('Error loading result approvals:', error);
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; color:var(--color-danger);">Error loading approvals</td></tr>';
  }
}

/* ========================================
   ADMIN: VIEW PUPIL RESULTS BY SESSION
======================================== */

let currentResultsPupilId = null;
let currentResultsSession = null;
let currentResultsData = null;

async function loadViewResultsSection() {
  console.log('📊 Loading View Results section...');
  
  try {
    // Populate session dropdown
    await populateSessionFilter();
    
    // Reset filters
    const classSelect = document.getElementById('filter-class');
    const pupilSelect = document.getElementById('filter-pupil');
    const viewBtn = document.getElementById('view-results-btn');
    const sessionSelect = document.getElementById('filter-session');
    
    if (classSelect) classSelect.disabled = true;
    if (pupilSelect) pupilSelect.disabled = true;
    if (viewBtn) viewBtn.disabled = true;
    
    // CRITICAL FIX: Attach all event listeners properly
    
    // 1. Session select listener
    if (sessionSelect) {
      const newSessionSelect = sessionSelect.cloneNode(true);
      sessionSelect.parentNode.replaceChild(newSessionSelect, sessionSelect);
      
      newSessionSelect.addEventListener('change', loadFilteredClasses);
      console.log('✓ Session select listener attached');
    }
    
    // 2. View Results button listener
    if (viewBtn) {
      const newViewBtn = viewBtn.cloneNode(true);
      viewBtn.parentNode.replaceChild(newViewBtn, viewBtn);
      
      newViewBtn.addEventListener('click', loadPupilResults);
      console.log('✓ View Results button listener attached');
    }
    
    console.log('✓ View Results section ready');
  } catch (error) {
    console.error('Error loading View Results section:', error);
    window.showToast?.('Failed to load results section', 'danger');
  }
}

async function populateSessionFilter() {
  const sessionSelect = document.getElementById('filter-session');
  if (!sessionSelect) return;
  
  try {
    // Get current session
    const settings = await window.getCurrentSettings();
    const currentSession = settings.session || 'Current Session';
    
    // Clear and rebuild
    sessionSelect.innerHTML = '<option value="">-- Select Session --</option>';
    
    // Add current session
    const currentOpt = document.createElement('option');
    currentOpt.value = 'current';
    currentOpt.textContent = `Current Session (${currentSession})`;
    sessionSelect.appendChild(currentOpt);
    
    // Get all archived sessions
    const sessionsSnap = await getDocs(query(collection(db, 'sessions'), orderBy('startYear', 'desc')));
    
    sessionsSnap.forEach(docSnap => {
      const data = docSnap.data();
      const opt = document.createElement('option');
      opt.value = data.name;
      opt.textContent = `${data.name} Session`;
      sessionSelect.appendChild(opt);
    });
    
    console.log(`✓ Session filter populated: Current + ${sessionsSnap.size} archived`);
    
  } catch (error) {
    console.error('Error populating session filter:', error);
    sessionSelect.innerHTML = '<option value="">Error loading sessions</option>';
  }
}

async function loadFilteredClasses() {
  const sessionSelect = document.getElementById('filter-session');
  let classSelect = document.getElementById('filter-class'); // Remove const
  let pupilSelect = document.getElementById('filter-pupil'); // Remove const
  
  if (!sessionSelect || !classSelect || !pupilSelect) return;
  
  const selectedSession = sessionSelect.value;
  
  // Reset dependent filters
  classSelect.innerHTML = '<option value="">-- Select Class --</option>';
  classSelect.disabled = true;
  pupilSelect.innerHTML = '<option value="">-- Select Pupil --</option>';
  pupilSelect.disabled = true;
  
  const viewBtn = document.getElementById('view-results-btn');
  if (viewBtn) viewBtn.disabled = true;
  
  if (!selectedSession) return;
  
  try {
    // Get actual session name
    let actualSession;
    if (selectedSession === 'current') {
      const settings = await window.getCurrentSettings();
      actualSession = settings.session;
    } else {
      actualSession = selectedSession;
    }
    
    currentResultsSession = actualSession;
    
    // Get all results for this session to find which classes have data
    const resultsSnap = await getDocs(query(collection(db, 'results'), where('session', '==', actualSession)));
    
    // Get all classes
    const classesSnap = await getDocs(query(collection(db, 'classes'), orderBy('name')));
    
    const classOptions = [];
    
    for (const classDoc of classesSnap.docs) {
      const className = classDoc.data().name;
      const classId = classDoc.id;
      
      // Check if this class has pupils with results in this session
      const pupilsInClassSnap = await getDocs(query(collection(db, 'pupils'), where('class.id', '==', classId), limit(1)));
      
      if (!pupilsInClassSnap.empty) {
        classOptions.push({
          id: classId,
          name: className
        });
      }
    }
    
    if (classOptions.length === 0) {
      classSelect.innerHTML = '<option value="">No classes with results in this session</option>';
      window.showToast?.('No results found for this session', 'warning', 4000);
      return;
    }
    
    // Populate class dropdown
    classOptions.forEach(cls => {
      const opt = document.createElement('option');
      opt.value = cls.id;
      opt.textContent = cls.name;
      classSelect.appendChild(opt);
    });
    
    classSelect.disabled = false;
    
    // CRITICAL FIX: Re-get the element and attach listener safely
    classSelect = document.getElementById('filter-class'); // Fresh reference
    
    if (classSelect && classSelect.parentNode) {
      // Clone to remove any existing listeners
      const newClassSelect = classSelect.cloneNode(true);
      classSelect.parentNode.replaceChild(newClassSelect, classSelect);
      
      // Attach fresh listener
      newClassSelect.addEventListener('change', loadFilteredPupils);
      
      console.log(`✓ Loaded ${classOptions.length} classes for session: ${actualSession}`);
    } else {
      console.warn('⚠️ Class select not found after population');
    }
    
  } catch (error) {
    console.error('Error loading classes:', error);
    window.showToast?.('Failed to load classes', 'danger');
  }
}

async function loadFilteredPupils() {
  let classSelect = document.getElementById('filter-class'); // Remove const
  let pupilSelect = document.getElementById('filter-pupil'); // Remove const
  
  if (!classSelect || !pupilSelect) return;
  
  const selectedClass = classSelect.value;
  
  // Reset pupil filter
  pupilSelect.innerHTML = '<option value="">-- Select Pupil --</option>';
  pupilSelect.disabled = true;
  
  const viewBtn = document.getElementById('view-results-btn');
  if (viewBtn) viewBtn.disabled = true;
  
  if (!selectedClass || !currentResultsSession) return;
  
  try {
    // Get all pupils in this class
    const pupilsSnap = await getDocs(query(collection(db, 'pupils'), where('class.id', '==', selectedClass)));
    
    if (pupilsSnap.empty) {
      pupilSelect.innerHTML = '<option value="">No pupils in this class</option>';
      window.showToast?.('No pupils found in this class', 'warning', 3000);
      return;
    }
    
    // Check which pupils have results in the selected session
    const pupilsWithResults = [];
    
    for (const pupilDoc of pupilsSnap.docs) {
      const pupilId = pupilDoc.id;
      const pupilData = pupilDoc.data();
      
      // Check if pupil has results in this session
      const resultsSnap = await getDocs(query(collection(db, 'results'), where('pupilId', '==', pupilId), where('session', '==', currentResultsSession), limit(1)));
      
      if (!resultsSnap.empty) {
        pupilsWithResults.push({
          id: pupilId,
          name: pupilData.name || 'Unknown',
          data: pupilData
        });
      }
    }
    
    if (pupilsWithResults.length === 0) {
      pupilSelect.innerHTML = '<option value="">No results found for pupils in this class</option>';
      window.showToast?.('No results found for this class in selected session', 'warning', 4000);
      return;
    }
    
    // Sort by name
    pupilsWithResults.sort((a, b) => a.name.localeCompare(b.name));
    
    // Populate pupil dropdown
    pupilsWithResults.forEach(pupil => {
      const opt = document.createElement('option');
      opt.value = pupil.id;
      opt.textContent = pupil.name;
      opt.dataset.pupilData = JSON.stringify(pupil.data);
      pupilSelect.appendChild(opt);
    });
    
    pupilSelect.disabled = false;
    
    // CRITICAL FIX: Re-get the element and attach listener safely
    pupilSelect = document.getElementById('filter-pupil'); // Fresh reference
    
    if (pupilSelect && pupilSelect.parentNode) {
      // Clone to remove any existing listeners
      const newPupilSelect = pupilSelect.cloneNode(true);
      pupilSelect.parentNode.replaceChild(newPupilSelect, pupilSelect);
      
      // Attach fresh listener
      newPupilSelect.addEventListener('change', function() {
        const viewBtn = document.getElementById('view-results-btn');
        if (viewBtn) {
          viewBtn.disabled = !this.value;
        }
      });
      
      console.log(`✓ Loaded ${pupilsWithResults.length} pupils with results`);
    } else {
      console.warn('⚠️ Pupil select not found after population');
    }
    
  } catch (error) {
    console.error('Error loading pupils:', error);
    window.showToast?.('Failed to load pupils', 'danger');
  }
}

async function loadPupilResults() {
    const pupilSelect = document.getElementById('filter-pupil');
    const container = document.getElementById('results-display-container');
    const infoCard = document.getElementById('pupil-info-card');
    
    if (!pupilSelect || !container) {
        console.error('Required elements not found');
        return;
    }
    
    const selectedPupil = pupilSelect.value;
    
    // Validate all required data before proceeding
    if (!selectedPupil) {
        infoCard.style.display = 'none';
        container.innerHTML = `
            <div style="text-align: center; padding: var(--space-2xl); color: var(--color-gray-600);">
                <div style="font-size: 3rem; margin-bottom: var(--space-md);">📊</div>
                <p>Select a pupil to view results</p>
            </div>
        `;
        return;
    }
    
    if (!currentResultsSession) {
        console.error('Session not selected');
        infoCard.style.display = 'none';
        container.innerHTML = `
            <div style="text-align: center; padding: var(--space-2xl); color: var(--color-warning);">
                <div style="font-size: 3rem; margin-bottom: var(--space-md);">⚠️</div>
                <p style="font-weight: 600;">Session not selected</p>
                <p>Please select a session from the filter above</p>
            </div>
        `;
        return;
    }
    
    currentResultsPupilId = selectedPupil;
    
    // Show loading
    container.innerHTML = `
        <div style="text-align: center; padding: var(--space-2xl);">
            <div class="spinner" style="margin: 0 auto var(--space-md);"></div>
            <p style="color: var(--color-gray-600);">Loading results for session: ${currentResultsSession}</p>
        </div>
    `;
    
    try {
        // Get pupil data
        const pupilDocSnap = await getDoc(doc(db, 'pupils', selectedPupil));
        
        if (!pupilDocSnap.exists()) {
            throw new Error('Pupil not found');
        }
        
        const pupilData = pupilDocSnap.data();
        
        // Get pupil's class name
        let className = 'Unknown';
        if (pupilData.class) {
            if (typeof pupilData.class === 'object' && pupilData.class.name) {
                className = pupilData.class.name;
            } else if (typeof pupilData.class === 'string') {
                className = pupilData.class;
            }
        }
        
        // Update info card
        document.getElementById('pupil-info-name').textContent = pupilData.name || 'Unknown';
        document.getElementById('pupil-info-class').textContent = className;
        document.getElementById('pupil-info-session').textContent = currentResultsSession;
        document.getElementById('pupil-info-gender').textContent = pupilData.gender || '-';
        infoCard.style.display = 'block';
        
        console.log('🔍 Querying results with:', {
            pupilId: selectedPupil,
            session: currentResultsSession
        });
        
        // PRIMARY QUERY: Try with composite query first
        let results = [];
        let queryMethod = 'unknown';
        
        try {
            const resultsSnap = await getDocs(query(collection(db, 'results'), where('pupilId', '==', selectedPupil), where('session', '==', currentResultsSession)));
            
            console.log(`✓ Primary query returned ${resultsSnap.size} results`);
            
            if (!resultsSnap.empty) {
                resultsSnap.forEach(docSnap => {
                    const data = docSnap.data();
                    results.push({
                        term: data.term || 'Unknown',
                        subject: data.subject || 'Unknown',
                        caScore: typeof data.caScore === 'number' ? data.caScore : 0,
                        examScore: typeof data.examScore === 'number' ? data.examScore : 0,
                        total: (data.caScore || 0) + (data.examScore || 0)
                    });
                });
                queryMethod = 'primary';
            }
        } catch (primaryError) {
            console.warn('⚠️ Primary query failed (possibly missing index):', primaryError.code);
            
            // FALLBACK METHOD: Query without session filter
            if (primaryError.code === 'failed-precondition') {
                console.log('📋 Using fallback method: querying all pupil results and filtering manually');
                
                window.showToast?.(
                    'Loading results using alternative method...',
                    'info',
                    3000
                );
            }
        }
        
        // FALLBACK QUERY: If primary failed or returned empty
        if (results.length === 0) {
            console.log('🔄 Trying fallback method: manual filtering');
            
            const allResultsSnap = await getDocs(query(collection(db, 'results'), where('pupilId', '==', selectedPupil)));
            
            console.log(`📊 Fallback query found ${allResultsSnap.size} total results for pupil`);
            
            // Filter manually by session
            allResultsSnap.forEach(docSnap => {
                const data = docSnap.data();
                if (data.session === currentResultsSession) {
                    results.push({
                        term: data.term || 'Unknown',
                        subject: data.subject || 'Unknown',
                        caScore: typeof data.caScore === 'number' ? data.caScore : 0,
                        examScore: typeof data.examScore === 'number' ? data.examScore : 0,
                        total: (data.caScore || 0) + (data.examScore || 0)
                    });
                }
            });
            
            console.log(`✓ Fallback filtered to ${results.length} results for session "${currentResultsSession}"`);
            queryMethod = 'fallback';
        }
        
        // Check if we found any results
        if (results.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: var(--space-2xl); color: var(--color-gray-600);">
                    <div style="font-size: 3rem; margin-bottom: var(--space-md);">📋</div>
                    <p style="font-size: var(--text-lg); font-weight: 600;">No results found</p>
                    <p>This pupil has no recorded results for session: <strong>${currentResultsSession}</strong></p>
                    <p style="font-size: var(--text-sm); margin-top: var(--space-md); color: var(--color-gray-500);">
                        Make sure results have been entered by the class teacher.
                    </p>
                </div>
            `;
            return;
        }
        
        // Success! Render results
        console.log(`✅ Successfully loaded ${results.length} results using ${queryMethod} method`);
        currentResultsData = results;
        renderResultsDisplay(results, container);

    } catch (error) {
        console.error('❌ Error loading pupil results:', error);
        
        // Detailed error handling
        let errorMessage = 'Error loading results';
        let errorDetails = error.message || 'Unknown error';
        let showRetry = true;
        
        if (error.code === 'permission-denied') {
            errorMessage = 'Permission denied';
            errorDetails = 'You do not have permission to view this data';
            showRetry = false;
        } else if (error.code === 'unavailable') {
            errorMessage = 'Service unavailable';
            errorDetails = 'Cannot connect to server. Check your internet connection.';
        } else if (error.code === 'failed-precondition') {
            errorMessage = 'Database Configuration Issue';
            errorDetails = 'A required database index is missing. Please contact your system administrator.';
            showRetry = false;
        }
        
        container.innerHTML = `
            <div style="text-align: center; padding: var(--space-2xl); color: var(--color-danger);">
                <div style="font-size: 3rem; margin-bottom: var(--space-md);">⚠️</div>
                <p style="font-size: var(--text-lg); font-weight: 600;">${errorMessage}</p>
                <p style="margin-bottom: var(--space-lg);">${errorDetails}</p>
                ${showRetry ? `
                    <button class="btn btn-primary" onclick="loadPupilResults()" style="margin-top: var(--space-lg);">
                        🔄 Retry
                    </button>
                ` : ''}
            </div>
        `;
        
        window.showToast?.(errorMessage, 'danger', 5000);
    }
}

function renderResultsDisplay(results, container) {
    container.innerHTML = '';
    
    // Group by term
    const terms = {};
    results.forEach(r => {
        if (!terms[r.term]) terms[r.term] = [];
        terms[r.term].push(r);
    });
    
    let overallTotal = 0;
    let overallCount = 0;
    
    ['First Term', 'Second Term', 'Third Term'].forEach(termName => {
        if (!terms[termName]) return;
        
        const termSection = document.createElement('div');
        termSection.style.marginBottom = 'var(--space-2xl)';
        
        const heading = document.createElement('h3');
        heading.textContent = termName;
        heading.style.marginBottom = 'var(--space-md)';
        heading.style.color = '#0f172a';
        heading.style.fontSize = 'var(--text-xl)';
        termSection.appendChild(heading);
        
        const table = document.createElement('table');
        table.className = 'responsive-table';
        table.innerHTML = `
            <thead>
                <tr>
                    <th>Subject</th>
                    <th style="text-align: center;">CA (40)</th>
                    <th style="text-align: center;">Exam (60)</th>
                    <th style="text-align: center;">Total (100)</th>
                    <th style="text-align: center;">Grade</th>
                    <th style="text-align: center;">Remark</th>
                </tr>
            </thead>
            <tbody></tbody>
        `;
        
        const tbody = table.querySelector('tbody');
        
        let termTotal = 0;
        let subjectCount = 0;
        
        // Sort by subject name
        terms[termName].sort((a, b) => a.subject.localeCompare(b.subject));
        
        terms[termName].forEach(result => {
            const total = result.caScore + result.examScore;
            const grade = getGrade(total);
            const remark = getRemark(total);
            const gradeClass = `grade-${grade}`;
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td data-label="Subject"><strong>${result.subject}</strong></td>
                <td data-label="CA" style="text-align: center;">${result.caScore}</td>
                <td data-label="Exam" style="text-align: center;">${result.examScore}</td>
                <td data-label="Total" style="text-align: center; font-weight: 700;">${total}</td>
                <td data-label="Grade" style="text-align: center;" class="${gradeClass}"><strong>${grade}</strong></td>
                <td data-label="Remark" style="text-align: center;">${remark}</td>
            `;
            tbody.appendChild(tr);
            
            termTotal += total;
            subjectCount++;
            overallTotal += total;
            overallCount++;
        });
        
        // Add term summary
        if (subjectCount > 0) {
            const average = (termTotal / subjectCount).toFixed(1);
            const avgGrade = getGrade(parseFloat(average));
            
            tbody.innerHTML += `
                <tr style="background: #f1f5f9; font-weight: 700;">
                    <td colspan="3"><strong>TERM TOTAL</strong></td>
                    <td colspan="3" style="text-align: center;"><strong>${termTotal} / ${subjectCount * 100}</strong></td>
                </tr>
                <tr style="background: #e0f2fe; font-weight: 700; color: #0369a1;">
                    <td colspan="3"><strong>TERM AVERAGE</strong></td>
                    <td colspan="3" style="text-align: center;"><strong>${average}% (${avgGrade})</strong></td>
                </tr>
            `;
        }
        
        termSection.appendChild(table);
        container.appendChild(termSection);
    });
    
    // Add overall session summary
    if (overallCount > 0) {
        const overallAverage = (overallTotal / overallCount).toFixed(1);
        const overallGrade = getGrade(parseFloat(overallAverage));
        
        const summaryCard = document.createElement('div');
        summaryCard.style.cssText = `
            background: linear-gradient(135deg, #00B2FF 0%, #0090CC 100%);
            color: white;
            padding: var(--space-xl);
            border-radius: var(--radius-lg);
            margin-top: var(--space-2xl);
            box-shadow: 0 4px 20px rgba(0, 178, 255, 0.3);
        `;
        
        summaryCard.innerHTML = `
            <h3 style="margin: 0 0 var(--space-lg); color: white; font-size: var(--text-xl);">
                📊 Session Summary: ${currentResultsSession}
            </h3>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: var(--space-lg);">
                <div>
                    <div style="font-size: var(--text-xs); opacity: 0.9; text-transform: uppercase; letter-spacing: 0.05em;">Total Subjects</div>
                    <div style="font-size: var(--text-3xl); font-weight: 700; margin-top: var(--space-xs);">${overallCount}</div>
                </div>
                <div>
                    <div style="font-size: var(--text-xs); opacity: 0.9; text-transform: uppercase; letter-spacing: 0.05em;">Overall Score</div>
                    <div style="font-size: var(--text-3xl); font-weight: 700; margin-top: var(--space-xs);">${overallTotal} / ${overallCount * 100}</div>
                </div>
                <div>
                    <div style="font-size: var(--text-xs); opacity: 0.9; text-transform: uppercase; letter-spacing: 0.05em;">Session Average</div>
                    <div style="font-size: var(--text-3xl); font-weight: 700; margin-top: var(--space-xs);">${overallAverage}%</div>
                </div>
                <div>
                    <div style="font-size: var(--text-xs); opacity: 0.9; text-transform: uppercase; letter-spacing: 0.05em;">Overall Grade</div>
                    <div style="font-size: var(--text-3xl); font-weight: 700; margin-top: var(--space-xs);">${overallGrade}</div>
                </div>
            </div>
        `;
        
        container.appendChild(summaryCard);
    }
    
    // Show session comparison button
    const comparisonBtn = document.createElement('button');
    comparisonBtn.className = 'btn';
    comparisonBtn.style.cssText = 'margin-top: var(--space-xl);';
    comparisonBtn.onclick = loadSessionComparison;
    comparisonBtn.innerHTML = '📈 Compare Across Sessions';
    container.appendChild(comparisonBtn);
    
    console.log(`✓ Rendered ${results.length} results successfully`);
}

function getGrade(score) {
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

function getRemark(score) {
    if (score >= 75) return 'Excellent';
    if (score >= 70) return 'Very Good';
    if (score >= 65) return 'Good';
    if (score >= 60) return 'Credit';
    if (score >= 50) return 'Credit';
    if (score >= 45) return 'Pass';
    return 'Fail';
}

function clearResultsFilter() {
  document.getElementById('filter-session').value = '';
  document.getElementById('filter-class').innerHTML = '<option value="">-- Select Class --</option>';
  document.getElementById('filter-class').disabled = true;
  document.getElementById('filter-pupil').innerHTML = '<option value="">-- Select Pupil --</option>';
  document.getElementById('filter-pupil').disabled = true;
  document.getElementById('view-results-btn').disabled = true;
  
  document.getElementById('pupil-info-card').style.display = 'none';
  document.getElementById('results-display-container').innerHTML = `
    <div style="text-align: center; padding: var(--space-2xl); color: var(--color-gray-600);">
      <div style="font-size: 3rem; margin-bottom: var(--space-md);">📊</div>
      <p style="font-size: var(--text-lg); font-weight: 600; margin-bottom: var(--space-xs);">
        Select filters to view results
      </p>
      <p style="font-size: var(--text-sm);">
        Choose session, class, and pupil from the filters above
      </p>
    </div>
  `;
  
  currentResultsPupilId = null;
  currentResultsSession = null;
  currentResultsData = null;
  
  document.getElementById('session-comparison-section').style.display = 'none';
}

async function exportPupilResults() {
  if (!currentResultsPupilId || !currentResultsSession || !currentResultsData) {
    window.showToast?.('No results to export', 'warning');
    return;
  }
  
  try {
    // Get pupil data
    const pupilDocSnap = await getDoc(doc(db, 'pupils', currentResultsPupilId));
    const pupilData = pupilDocSnap.data();
    
    // Create CSV content
    let csv = 'Session,Term,Subject,CA Score,Exam Score,Total,Grade\n';
    
    currentResultsData.forEach(result => {
      const grade = getGrade(result.total);
      csv += `${currentResultsSession},${result.term},${result.subject},${result.caScore},${result.examScore},${result.total},${grade}\n`;
    });
    
    // Download CSV
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${pupilData.name}_${currentResultsSession}_Results.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    window.showToast?.('✓ Results exported successfully', 'success');
    
  } catch (error) {
    console.error('Error exporting results:', error);
    window.showToast?.('Failed to export results', 'danger');
  }
}

// Make functions globally available
window.loadViewResultsSection = loadViewResultsSection;
window.loadFilteredClasses = loadFilteredClasses;
window.loadFilteredPupils = loadFilteredPupils;
window.loadPupilResults = loadPupilResults;
window.clearResultsFilter = clearResultsFilter;
window.exportPupilResults = exportPupilResults;

/* ========================================
   SESSION COMPARISON & PROGRESS TRACKING
======================================== */

async function loadSessionComparison() {
  if (!currentResultsPupilId) {
    window.showToast?.('No pupil selected', 'warning');
    return;
  }
  
  const section = document.getElementById('session-comparison-section');
  const content = document.getElementById('session-comparison-content');
  
  if (!section || !content) return;
  
  section.style.display = 'block';
  content.innerHTML = `
    <div style="text-align: center; padding: var(--space-2xl);">
      <div class="spinner" style="margin: 0 auto var(--space-md);"></div>
      <p style="color: var(--color-gray-600);">Loading comparison data...</p>
    </div>
  `;
  
  // Scroll to comparison section
  section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  
  try {
    // Get all results for this pupil across all sessions
    const allResultsSnap = await getDocs(query(collection(db, 'results'), where('pupilId', '==', currentResultsPupilId)));
    
    if (allResultsSnap.empty) {
      content.innerHTML = `
        <div style="text-align: center; padding: var(--space-2xl); color: var(--color-gray-600);">
          <p>No results found for comparison</p>
        </div>
      `;
      return;
    }
    
    // Group by session
    const sessionData = {};
    
    allResultsSnap.forEach(docSnap => {
      const data = docSnap.data();
      const session = data.session || 'Unknown';
      
      if (!sessionData[session]) {
        sessionData[session] = {
          results: [],
          totalScore: 0,
          subjectCount: 0
        };
      }
      
      const total = (data.caScore || 0) + (data.examScore || 0);
      sessionData[session].results.push({
        term: data.term,
        subject: data.subject,
        total: total
      });
      sessionData[session].totalScore += total;
      sessionData[session].subjectCount++;
    });
    
    // Calculate averages for each session
    const sessions = [];
    for (const [sessionName, data] of Object.entries(sessionData)) {
      const average = data.subjectCount > 0 ? (data.totalScore / data.subjectCount).toFixed(1) : 0;
      sessions.push({
        name: sessionName,
        average: parseFloat(average),
        subjectCount: data.subjectCount,
        totalScore: data.totalScore,
        grade: getGrade(parseFloat(average))
      });
    }
    
    // Sort by session year (newest first)
    sessions.sort((a, b) => {
      const yearA = parseInt(a.name.split('/')[0]) || 0;
      const yearB = parseInt(b.name.split('/')[0]) || 0;
      return yearB - yearA;
    });
    
    if (sessions.length < 2) {
      content.innerHTML = `
        <div class="alert alert-info">
          <strong>ℹ️ Comparison Not Available</strong>
          <p>This pupil only has results in one session (${sessions[0].name}). Comparison requires results from at least 2 sessions.</p>
        </div>
      `;
      return;
    }
    
    // Calculate progress
    const progressData = [];
    for (let i = 1; i < sessions.length; i++) {
      const current = sessions[i - 1];
      const previous = sessions[i];
      const change = current.average - previous.average;
      const percentChange = previous.average > 0 ? ((change / previous.average) * 100).toFixed(1) : 0;
      
      progressData.push({
        from: previous.name,
        to: current.name,
        change: change,
        percentChange: percentChange,
        improving: change > 0
      });
    }
    
    // Render comparison
    content.innerHTML = `
      <!-- Sessions Overview -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: var(--space-lg); margin-bottom: var(--space-2xl);">
        ${sessions.map((session, index) => `
          <div style="background: ${index === 0 ? 'linear-gradient(135deg, #00B2FF 0%, #0090CC 100%)' : 'white'}; 
                      color: ${index === 0 ? 'white' : 'inherit'};
                      padding: var(--space-xl); 
                      border-radius: var(--radius-lg); 
                      border: 2px solid ${index === 0 ? '#00B2FF' : '#e2e8f0'};
                      position: relative;
                      box-shadow: ${index === 0 ? '0 4px 20px rgba(0, 178, 255, 0.3)' : '0 2px 8px rgba(0,0,0,0.05)'};;">
            ${index === 0 ? '<div style="position: absolute; top: var(--space-sm); right: var(--space-sm); background: rgba(255,255,255,0.3); padding: 4px 12px; border-radius: 20px; font-size: 0.75rem[...]
            <div style="font-size: var(--text-sm); opacity: ${index === 0 ? '0.9' : '0.6'}; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: var(--space-xs);">
              Session
            </div>
            <div style="font-size: var(--text-xl); font-weight: 700; margin-bottom: var(--space-lg);">
              ${session.name}
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-md); margin-bottom: var(--space-md);">
              <div>
                <div style="font-size: var(--text-xs); opacity: ${index === 0 ? '0.9' : '0.6'}; margin-bottom: 4px;">Average</div>
                <div style="font-size: var(--text-2xl); font-weight: 700;">${session.average}%</div>
              </div>
              <div>
                <div style="font-size: var(--text-xs); opacity: ${index === 0 ? '0.9' : '0.6'}; margin-bottom: 4px;">Grade</div>
                <div style="font-size: var(--text-2xl); font-weight: 700;">${session.grade}</div>
              </div>
            </div>
            <div style="font-size: var(--text-xs); opacity: ${index === 0 ? '0.9' : '0.6'};">
              ${session.subjectCount} subjects • ${session.totalScore} total points
            </div>
          </div>
        `).join('')}
      </div>
      
      <!-- Progress Analysis -->
      <div style="background: #f8fafc; padding: var(--space-xl); border-radius: var(--radius-lg); margin-bottom: var(--space-2xl);">
        <h4 style="margin: 0 0 var(--space-lg); color: #0f172a;">📊 Progress Analysis</h4>
        ${progressData.map(progress => `
          <div style="display: flex; align-items: center; gap: var(--space-md); padding: var(--space-md); background: white; border-radius: var(--radius-md); margin-bottom: var(--space-sm); border-lef[...]
            <div style="flex: 1;">
              <div style="font-weight: 600; margin-bottom: var(--space-xs);">
                ${progress.from} → ${progress.to}
              </div>
              <div style="font-size: var(--text-sm); color: var(--color-gray-600);">
                ${progress.improving ? 'Improvement' : 'Decline'}: ${progress.change > 0 ? '+' : ''}${progress.change.toFixed(1)} points (${progress.percentChange > 0 ? '+' : ''}${progress.percentChan[...]
              </div>
            </div>
            <div style="font-size: var(--text-3xl);">
              ${progress.improving ? '📈' : '📉'}
            </div>
          </div>
        `).join('')}
      </div>
      
      <!-- Performance Trend -->
      <div style="background: white; padding: var(--space-xl); border-radius: var(--radius-lg); border: 1px solid #e2e8f0;">
        <h4 style="margin: 0 0 var(--space-lg); color: #0f172a;">📈 Performance Trend</h4>
        <div style="display: flex; align-items: flex-end; gap: var(--space-sm); height: 200px; padding: var(--space-md) 0;">
          ${sessions.slice().reverse().map((session, index) => {
            const maxAverage = Math.max(...sessions.map(s => s.average));
            const height = (session.average / maxAverage) * 100;
            const isHighest = session.average === maxAverage;
            
            return `
              <div style="flex: 1; display: flex; flex-direction: column; align-items: center; gap: var(--space-xs);">
                <div style="font-weight: 700; font-size: var(--text-lg); color: ${isHighest ? '#00B2FF' : '#0f172a'};">
                  ${session.average}%
                </div>
                <div style="width: 100%; height: ${height}%; background: ${isHighest ? 'linear-gradient(to top, #00B2FF, #0090CC)' : 'linear-gradient(to top, #cbd5e1, #94a3b8)'}; border-radius: var(--[...]
                <div style="font-size: var(--text-xs); color: var(--color-gray-600); text-align: center; margin-top: var(--space-xs);">
                  ${session.name}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
      
      <!-- Summary Insights -->
      <div style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); padding: var(--space-xl); border-radius: var(--radius-lg); margin-top: var(--space-2xl); border: 2px solid #10b981;">
        <h4 style="margin: 0 0 var(--space-md); color: #065f46;">🎯 Summary Insights</h4>
        ${generateInsights(sessions, progressData)}
      </div>
    `;
    
    console.log(`✓ Loaded comparison across ${sessions.length} sessions`);
    
  } catch (error) {
    console.error('Error loading session comparison:', error);
    content.innerHTML = `
      <div style="text-align: center; padding: var(--space-2xl); color: var(--color-danger);">
        <p style="font-weight: 600;">Error loading comparison data</p>
        <p style="font-size: var(--text-sm);">${error.message}</p>
      </div>
    `;
  }
}

function generateInsights(sessions, progressData) {
  const insights = [];
  
  // Find best and worst sessions
  const sortedByAvg = [...sessions].sort((a, b) => b.average - a.average);
  const bestSession = sortedByAvg[0];
  const worstSession = sortedByAvg[sortedByAvg.length - 1];
  
  insights.push(`<p style="margin: 0 0 var(--space-xs);"><strong>• Best Performance:</strong> ${bestSession.name} with ${bestSession.average}% average (Grade ${bestSession.grade})</p>`);
  
  if (sessions.length > 1) {
    insights.push(`<p style="margin: 0 0 var(--space-xs);"><strong>• Lowest Performance:</strong> ${worstSession.name} with ${worstSession.average}% average (Grade ${worstSession.grade})</p>`);
  }
  
  // Overall trend
  const improvements = progressData.filter(p => p.improving).length;
  const declines = progressData.filter(p => !p.improving).length;
  
  if (improvements > declines) {
    insights.push(`<p style="margin: 0 0 var(--space-xs);"><strong>• Overall Trend:</strong> Generally improving (${improvements} improvement(s), ${declines} decline(s))</p>`);
  } else if (declines > improvements) {
    insights.push(`<p style="margin: 0 0 var(--space-xs);"><strong>• Overall Trend:</strong> Needs attention (${declines} decline(s), ${improvements} improvement(s))</p>`);
  } else {
    insights.push(`<p style="margin: 0 0 var(--space-xs);"><strong>• Overall Trend:</strong> Stable performance with mixed results</p>`);
  }
  
  // Average improvement
  if (progressData.length > 0) {
    const avgChange = progressData.reduce((sum, p) => sum + p.change, 0) / progressData.length;
    const direction = avgChange > 0 ? 'improved' : 'declined';
    insights.push(`<p style="margin: 0;"><strong>• Average Change:</strong> Performance has ${direction} by ${Math.abs(avgChange).toFixed(1)} points per session</p>`);
  }
  
  return insights.join('');
}

function toggleSessionComparison() {
  const section = document.getElementById('session-comparison-section');
  if (section) {
    section.style.display = 'none';
  }
}

// Make functions globally available
window.loadSessionComparison = loadSessionComparison;
window.toggleSessionComparison = toggleSessionComparison;

// Make functions globally available
window.loadPromotionRequests = loadPromotionRequests;
window.loadPromotionPeriodStatus = loadPromotionPeriodStatus;
window.loadResultApprovals = loadResultApprovals;
window.loadViewResultsSection = loadViewResultsSection;
window.populateSessionFilter = populateSessionFilter;

console.log('✓ Missing section loaders restored');

/* ========================================
   FINANCIAL MANAGEMENT SECTION LOADERS
======================================== */

/**
 * Load Fee Management Section
 */
async function loadFeeManagementSection() {
  console.log('💰 Loading fee management section...');

  try {
    // ✅ FIXED: Directly target and force-show the nested form card
    const feeConfigFormCard = document.querySelector(
      '#fee-management .admin-card'
    );

    if (feeConfigFormCard) {
      feeConfigFormCard.style.display = 'block';
      console.log('✓ Fee configuration form card forced visible');
    } else {
      console.error('❌ Fee configuration form card not found in DOM');
    }

    // Populate class selector
    await populateFeeClassSelector();

    // Load current session/term
    const settings = await window.getCurrentSettings();

    const sessionDisplay = document.getElementById('fee-session-display');
    const termDisplay = document.getElementById('fee-term-display');

    if (sessionDisplay) sessionDisplay.textContent = settings.session;
    if (termDisplay) termDisplay.textContent = settings.term;

    // Load existing fee structures
    await loadFeeStructures();

    console.log('✓ Fee management section loaded successfully');
  } catch (error) {
    console.error('❌ Error loading fee management:', error);
    window.showToast?.('Failed to load fee management section', 'danger');
  }
}

/**
 * Populate class selector for fee configuration
 */
async function populateFeeClassSelector() {
  const select = document.getElementById('fee-config-class');
  if (!select) return;
  
  try {
    const snapshot = await getDocs(query(collection(db, 'classes'), orderBy('name')));
    
    select.innerHTML = '<option value="">-- Select Class --</option>';
    
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      const opt = document.createElement('option');
      opt.value = docSnap.id;
      opt.textContent = data.name;
      opt.dataset.className = data.name;
      select.appendChild(opt);
    });
    
  } catch (error) {
    console.error('Error populating class selector:', error);
  }
}

/**
 * Load existing fee structures
 */
async function loadFeeStructures() {
  const container = document.getElementById('fee-structures-list');
  if (!container) return;
  
  container.innerHTML = '<div style="text-align:center; padding:var(--space-lg);"><div class="spinner"></div><p>Loading fee structures...</p></div>';
  
  try {
    const settings = await window.getCurrentSettings();
    const session = settings.session;
    const term = settings.term;
    
    const snapshot = await getDocs(query(collection(db, 'fee_structures'), where('session', '==', session), where('term', '==', term)));
    
    if (snapshot.empty) {
      container.innerHTML = `
        <div style="text-align:center; padding:var(--space-2xl); color:var(--color-gray-600);">
          <p style="font-size:var(--text-lg); margin-bottom:var(--space-md);">📋 No Fee Structures Configured Yet</p>
          <p style="font-size:var(--text-sm);">Configure fees for your classes using the form above.</p>
        </div>
      `;
      return;
    }
    
    container.innerHTML = '';
    
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      
      const card = document.createElement('div');
      card.className = 'fee-structure-card';
      card.style.cssText = `
        background: white;
        border: 1px solid var(--color-gray-300);
        border-radius: var(--radius-md);
        padding: var(--space-lg);
        margin-bottom: var(--space-md);
      `;
      
      const feeItems = Object.entries(data.fees || {})
        .map(([key, value]) => `
          <div style="display:flex; justify-content:space-between; padding:var(--space-xs) 0;">
            <span style="text-transform:capitalize;">${key.replace(/_/g, ' ')}:</span>
            <strong>₦${parseFloat(value).toLocaleString()}</strong>
          </div>
        `).join('');
      
      card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:var(--space-md); padding-bottom:var(--space-md); border-bottom:1px solid var(--color-gray-200);">
          <div>
            <h3 style="margin:0; color:var(--color-primary);">${data.className}</h3>
            <p style="margin:var(--space-xs) 0 0; font-size:var(--text-sm); color:var(--color-gray-600);">
              ${data.session} • ${data.term}
            </p>
          </div>
          <button class="btn-small btn-danger" onclick="deleteFeeStructure('${docSnap.id}', '${data.className}')">
            Delete
          </button>
        </div>
        
        <div style="margin-bottom:var(--space-md);">
          ${feeItems}
        </div>
        
        <div style="padding-top:var(--space-md); border-top:2px solid var(--color-primary); display:flex; justify-content:space-between; align-items:center;">
          <strong style="font-size:var(--text-lg);">Total:</strong>
          <strong style="font-size:var(--text-xl); color:var(--color-primary);">₦${parseFloat(data.total).toLocaleString()}</strong>
        </div>
      `;
      
      container.appendChild(card);
    });
    
  } catch (error) {
    console.error('Error loading fee structures:', error);
    container.innerHTML = '<p style="text-align:center; color:var(--color-danger);">Error loading fee structures</p>';
  }
}

/**
 * Load payment recording section
 */
async function loadPaymentRecordingSection() {
  try {
    // Populate class filter
    await populatePaymentClassFilter();
    
    // Load current settings
    const settings = await window.getCurrentSettings();
    
    const sessionDisplay = document.getElementById('payment-session-display');
    const termDisplay = document.getElementById('payment-term-display');
    
    if (sessionDisplay) sessionDisplay.textContent = settings.session;
    if (termDisplay) termDisplay.textContent = settings.term;
    
  } catch (error) {
    console.error('Error loading payment section:', error);
    window.showToast?.('Failed to load payment section', 'danger');
  }
}

/**
 * Populate class filter for payment recording
 */
async function populatePaymentClassFilter() {
  const select = document.getElementById('payment-class-filter');
  if (!select) return;
  
  try {
    const snapshot = await getDocs(query(collection(db, 'classes'), orderBy('name')));
    
    select.innerHTML = '<option value="">-- Select Class --</option>';
    
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      const opt = document.createElement('option');
      opt.value = docSnap.id;
      opt.textContent = data.name;
      select.appendChild(opt);
    });
    
  } catch (error) {
    console.error('Error populating class filter:', error);
  }
}

/**
 * Load pupils for payment recording (MISSING FUNCTION)
 */
async function loadPupilsForPayment() {
  const classId = document.getElementById('payment-class-filter')?.value;
  const pupilSelect = document.getElementById('payment-pupil-select');
  
  if (!pupilSelect) return;
  
  pupilSelect.innerHTML = '<option value="">-- Select Pupil --</option>';
  
  if (!classId) {
    document.getElementById('payment-form-container').style.display = 'none';
    return;
  }
  
  try {
    const snapshot = await getDocs(query(collection(db, 'pupils'), where('class.id', '==', classId), orderBy('name')));
    
    if (snapshot.empty) {
      pupilSelect.innerHTML = '<option value="">No pupils in this class</option>';
      document.getElementById('payment-form-container').style.display = 'none';
      return;
    }
    
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      const opt = document.createElement('option');
      opt.value = docSnap.id;
      opt.textContent = data.name;
      opt.dataset.pupilName = data.name;
      opt.dataset.className = data.class?.name || 'Unknown';
      pupilSelect.appendChild(opt);
    });
    
  } catch (error) {
    console.error('Error loading pupils:', error);
    window.showToast?.('Failed to load pupils', 'danger');
  }
}

/**
 * Load pupil payment status - FIXED SESSION ENCODING
 */
async function loadPupilPaymentStatus() {
  const pupilSelect = document.getElementById('payment-pupil-select');
  const pupilId = pupilSelect?.value;
  
  if (!pupilId) {
    document.getElementById('payment-form-container').style.display = 'none';
    return;
  }
  
  const classId = document.getElementById('payment-class-filter')?.value;
  const pupilName = pupilSelect.selectedOptions[0]?.dataset.pupilName;
  const className = pupilSelect.selectedOptions[0]?.dataset.className;
  
  const formContainer = document.getElementById('payment-form-container');
  const statusContainer = document.getElementById('payment-status-display');
  
  formContainer.style.display = 'block';
  statusContainer.innerHTML = '<div style="text-align:center; padding:var(--space-md);"><div class="spinner"></div></div>';
  
  try {
    const settings = await window.getCurrentSettings();
    const session = settings.session;
    const term = settings.term;
    
    // CRITICAL FIX: Encode session for document ID lookup
    const encodedSession = session.replace(/\//g, '-');
    
    // Get fee structure (use ORIGINAL session format for query)
    const feeStructureSnap = await getDocs(query(collection(db, 'fee_structures'), where('classId', '==', classId), where('session', '==', session), where('term', '==', term), limit(1)));
    
    if (feeStructureSnap.empty) {
      statusContainer.innerHTML = `
        <div class="alert alert-warning">
          <strong>⚠️ Fee Structure Not Configured</strong>
          <p>No fee structure has been set for ${className} in ${term}. Please configure it in the Fee Management section first.</p>
        </div>
      `;
      document.getElementById('payment-input-section').style.display = 'none';
      return;
    }
    
    const feeStructure = feeStructureSnap.docs[0].data();
    
    // Get payment document (use ENCODED session in document ID)
    const paymentDocId = `${pupilId}_${encodedSession}_${term}`;
    const paymentDocSnap = await getDoc(doc(db, 'payments', paymentDocId));
    
    let amountDue = feeStructure.total || 0;
    let totalPaid = 0;
    let balance = amountDue;
    let status = 'owing';
    
    if (paymentDocSnap.exists()) {
      const paymentData = paymentDocSnap.data();
      totalPaid = paymentData.totalPaid || 0;
      balance = paymentData.balance || 0;
      status = paymentData.status || 'owing';
    }
    
    const statusBadge = 
      status === 'paid' ? '<span class="status-badge" style="background:#4CAF50;">Paid in Full</span>' :
      status === 'partial' ? '<span class="status-badge" style="background:#ff9800;">Partial Payment</span>' :
      '<span class="status-badge" style="background:#f44336;">Owing</span>';
    
    statusContainer.innerHTML = `
      <div style="background:white; border:1px solid var(--color-gray-300); border-radius:var(--radius-md); padding:var(--space-lg);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:var(--space-md);">
          <div>
            <h3 style="margin:0;">${pupilName}</h3>
            <p style="margin:var(--space-xs) 0 0; color:var(--color-gray-600);">${className} • ${session} • ${term}</p>
          </div>
          ${statusBadge}
        </div>
        
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(150px, 1fr)); gap:var(--space-md); margin-top:var(--space-lg);">
          <div style="text-align:center; padding:var(--space-md); background:var(--color-gray-50); border-radius:var(--radius-sm);">
            <div style="font-size:var(--text-xs); color:var(--color-gray-600); margin-bottom:var(--space-xs);">Amount Due</div>
            <div style="font-size:var(--text-xl); font-weight:700; color:var(--color-gray-900);">₦${amountDue.toLocaleString()}</div>
          </div>
          
          <div style="text-align:center; padding:var(--space-md); background:var(--color-success-light); border-radius:var(--radius-sm);">
            <div style="font-size:var(--text-xs); color:var(--color-success-dark); margin-bottom:var(--space-xs);">Total Paid</div>
            <div style="font-size:var(--text-xl); font-weight:700; color:var(--color-success-dark);">₦${totalPaid.toLocaleString()}</div>
          </div>
          
          <div style="text-align:center; padding:var(--space-md); background:${balance > 0 ? 'var(--color-danger-light)' : 'var(--color-success-light)'}; border-radius:var(--radius-sm);">
            <div style="font-size:var(--text-xs); color:${balance > 0 ? 'var(--color-danger-dark)' : 'var(--color-success-dark)'}; margin-bottom:var(--space-xs);">Balance</div>
            <div style="font-size:var(--text-xl); font-weight:700; color:${balance > 0 ? 'var(--color-danger-dark)' : 'var(--color-success-dark)'};">₦${balance.toLocaleString()}</div>
          </div>
        </div>
      </div>
    `;
    
    // Show payment input section
    document.getElementById('payment-input-section').style.display = 'block';
    
    // Set max amount to balance
    const amountInput = document.getElementById('payment-amount');
    if (amountInput) {
      amountInput.max = balance;
      amountInput.value = '';
    }
    
    // Load payment history (pass ORIGINAL session format)
    await loadPaymentHistory(pupilId, session, term);
    
  } catch (error) {
    console.error('Error loading payment status:', error);
    statusContainer.innerHTML = '<p style="text-align:center; color:var(--color-danger);">Error loading payment status</p>';
  }
}

/**
 * Load payment history for selected pupil - FIXED SESSION HANDLING
 */
async function loadPaymentHistory(pupilId, session, term) {
  const container = document.getElementById('payment-history-list');
  if (!container) return;
  
  container.innerHTML = '<div style="text-align:center; padding:var(--space-md);"><div class="spinner"></div></div>';
  
  try {
    // Session should already be in ORIGINAL format "2025/2026"
    // No decoding needed - just use it directly for query
    
    // Query transactions (use ORIGINAL session format)
    const transactionsSnap = await getDocs(query(collection(db, 'payment_transactions'), where('pupilId', '==', pupilId), where('session', '==', session), where('term', '==', term), orderBy('paymentDate', 'desc')));
    
    if (transactionsSnap.empty) {
      container.innerHTML = '<p style="text-align:center; color:var(--color-gray-600); padding:var(--space-lg);">No payment history yet</p>';
      return;
    }
    
    const transactions = [];
    transactionsSnap.forEach(docSnap => {
      transactions.push({ id: docSnap.id, ...docSnap.data() });
    });
    
    container.innerHTML = transactions.map(txn => {
      const date = txn.paymentDate 
        ? txn.paymentDate.toDate().toLocaleDateString('en-GB')
        : 'N/A';
      
      return `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:var(--space-md); background:white; border:1px solid var(--color-gray-300); border-radius:var(--radius-sm); [...]
          <div>
            <strong>₦${Number(txn.amountPaid).toLocaleString()}</strong>
            <div style="font-size:var(--text-sm); color:var(--color-gray-600); margin-top:var(--space-xs);">
              ${date} • ${txn.paymentMethod || 'Cash'} • Receipt #${txn.receiptNo}
            </div>
          </div>
          <button class="btn-small btn-secondary" onclick="printReceipt('${txn.receiptNo}')">
            Print Receipt
          </button>
        </div>
      `;
    }).join('');
    
  } catch (error) {
    console.error('Error loading payment history:', error);
    container.innerHTML = '<p style="text-align:center; color:var(--color-danger);">Error loading payment history</p>';
  }
}

/**
 * Load outstanding fees report
 */
async function loadOutstandingFeesReport() {
  const container = document.getElementById('outstanding-fees-table');
  if (!container) return;
  
  const tbody = container.querySelector('tbody');
  if (!tbody) return;
  
  tbody.innerHTML = '<tr><td colspan="6" class="table-loading">Loading outstanding fees...</td></tr>';
  
  try {
    const settings = await window.getCurrentSettings();
    const session = settings.session;
    const term = settings.term;
    
    // Query payments collection directly (NO finance.js dependency)
    const paymentsSnap = await getDocs(query(collection(db, 'payments'), where('session', '==', session), where('term', '==', term), where('balance', '>', 0)));
    
    if (paymentsSnap.empty) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align:center; color:var(--color-gray-600); padding:var(--space-2xl);">
            ✓ All fees collected! No outstanding payments.
          </td>
        </tr>`;
      
      const outstandingCount = document.getElementById('outstanding-count');
      if (outstandingCount) outstandingCount.textContent = '0';
      
      const outstandingTotal = document.getElementById('outstanding-total');
      if (outstandingTotal) outstandingTotal.textContent = '₦0';
      return;
    }
    
    let totalOutstanding = 0;
    const fragment = document.createDocumentFragment();
    
    paymentsSnap.forEach(docSnap => {
      const payment = docSnap.data();
      totalOutstanding += Number(payment.balance) || 0;
      
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td data-label="Pupil Name">${payment.pupilName || '-'}</td>
        <td data-label="Class">${payment.className || '-'}</td>
        <td data-label="Amount Due">₦${Number(payment.amountDue || 0).toLocaleString()}</td>
        <td data-label="Paid">₦${Number(payment.totalPaid || 0).toLocaleString()}</td>
        <td data-label="Balance" class="text-bold text-danger">
          ₦${Number(payment.balance || 0).toLocaleString()}
        </td>
        <td data-label="Status">
          <span class="status-badge" style="background:${payment.status === 'partial' ? '#ff9800' : '#f44336'};">
            ${payment.status === 'partial' ? 'Partial' : 'Owing'}
          </span>
        </td>
      `;
      fragment.appendChild(tr);
    });
    
    tbody.innerHTML = '';
    tbody.appendChild(fragment);
    
    // Update summary
    const outstandingCountEl = document.getElementById('outstanding-count');
    if (outstandingCountEl) outstandingCountEl.textContent = paymentsSnap.size;
    
    const outstandingTotalEl = document.getElementById('outstanding-total');
    if (outstandingTotalEl) outstandingTotalEl.textContent = `₦${totalOutstanding.toLocaleString()}`;
    
  } catch (error) {
    console.error('Error loading outstanding fees:', error);
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center; color:var(--color-danger);">
          Error loading outstanding fees: ${error.message}
        </td>
      </tr>`;
  }
}

/**
 * Load financial reports
 */
async function loadFinancialReports() {
  try {
    const settings = await window.getCurrentSettings();
    const session = settings.session;
    const term = settings.term;
    
    // Query payments collection directly (NO finance.js dependency)
    const paymentsSnap = await getDocs(query(collection(db, 'payments'), where('session', '==', session), where('term', '==', term)));
    
    if (paymentsSnap.empty) {
      updateFinancialDisplays(0, 0, 0, 0, 0, 0, 0, session, term);
      return;
    }
    
    // Calculate summary
    let totalExpected = 0;
    let totalCollected = 0;
    let totalOutstanding = 0;
    let paidInFull = 0;
    let partialPayments = 0;
    let noPayment = 0;
    
    paymentsSnap.forEach(docSnap => {
      const data = docSnap.data();
      totalExpected += Number(data.amountDue) || 0;
      totalCollected += Number(data.totalPaid) || 0;
      totalOutstanding += Number(data.balance) || 0;
      
      if (data.status === 'paid') {
        paidInFull++;
      } else if (data.status === 'partial') {
        partialPayments++;
      } else {
        noPayment++;
      }
    });
    
    const collectionRate = totalExpected > 0 
      ? ((totalCollected / totalExpected) * 100).toFixed(1)
      : 0;
    
    updateFinancialDisplays(
      totalExpected,
      totalCollected,
      totalOutstanding,
      collectionRate,
      paidInFull,
      partialPayments,
      noPayment,
      session,
      term
    );
    
  } catch (error) {
    console.error('Error loading financial reports:', error);
    window.showToast?.('Failed to load financial reports', 'danger');
  }
}

// Helper function
function updateFinancialDisplays(
  totalExpected,
  totalCollected,
  totalOutstanding,
  collectionRate,
  paidInFull,
  partialPayments,
  noPayment,
  session,
  term
) {
  const expectedEl = document.getElementById('report-total-expected');
  const collectedEl = document.getElementById('report-total-collected');
  const outstandingEl = document.getElementById('report-total-outstanding');
  const rateEl = document.getElementById('report-collection-rate');
  
  if (expectedEl) expectedEl.textContent = `₦${Number(totalExpected).toLocaleString()}`;
  if (collectedEl) collectedEl.textContent = `₦${Number(totalCollected).toLocaleString()}`;
  if (outstandingEl) outstandingEl.textContent = `₦${Number(totalOutstanding).toLocaleString()}`;
  if (rateEl) rateEl.textContent = `${collectionRate}%`;
  
  const paidFullEl = document.getElementById('report-paid-full');
  if (paidFullEl) paidFullEl.textContent = paidInFull;
  
  const partialEl = document.getElementById('report-partial');
  if (partialEl) partialEl.textContent = partialPayments;
  
  const owingEl = document.getElementById('report-owing');
  if (owingEl) owingEl.textContent = noPayment;
  
  const sessionEl = document.getElementById('report-session-display');
  if (sessionEl) sessionEl.textContent = session || '—';
  
  const termEl = document.getElementById('report-term-display');
  if (termEl) termEl.textContent = term || '—';
}

/**
 * Save fee structure configuration
 */
async function saveFeeStructure() {
  const classSelect = document.getElementById('fee-config-class');
  const classId = classSelect?.value;
  const className = classSelect?.selectedOptions[0]?.dataset.className;
  
  if (!classId) {
    window.showToast?.('Please select a class', 'warning');
    return;
  }
  
  // Get fee breakdown
  const tuition = parseFloat(document.getElementById('fee-tuition')?.value) || 0;
  const examFee = parseFloat(document.getElementById('fee-exam')?.value) || 0;
  const uniform = parseFloat(document.getElementById('fee-uniform')?.value) || 0;
  const books = parseFloat(document.getElementById('fee-books')?.value) || 0;
  const pta = parseFloat(document.getElementById('fee-pta')?.value) || 0;
  const other = parseFloat(document.getElementById('fee-other')?.value) || 0;
  
  const feeBreakdown = {
    tuition: tuition,
    exam_fee: examFee,
    uniform: uniform,
    books: books,
    pta: pta,
    other: other
  };
  
  // Validate at least one fee is entered
  const total = Object.values(feeBreakdown).reduce((sum, val) => sum + val, 0);
  
  if (total <= 0) {
    window.showToast?.('Please enter at least one fee amount', 'warning');
    return;
  }
  
  const saveBtn = document.getElementById('save-fee-structure-btn');
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<span class="btn-loading">Saving...</span>';
  }
  
  try {
    const settings = await window.getCurrentSettings();
    const session = settings.session;
    const term = settings.term;
    
    // Save fee structure directly to Firestore
    await addDoc(collection(db, 'fee_structures'), {
      classId,
      className,
      session,
      term,
      fees: feeBreakdown,
      total: total,
      createdAt: serverTimestamp(),
      createdBy: auth.currentUser.uid
    });
    
    window.showToast?.(
      `✓ Fee structure saved for ${className}\nTotal: ₦${total.toLocaleString()}`,
      'success',
      5000
    );
    
    // Clear form
    document.getElementById('fee-config-class').value = '';
    ['fee-tuition', 'fee-exam', 'fee-uniform', 'fee-books', 'fee-pta', 'fee-other'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    
    // Reload fee structures
    await loadFeeStructures();
    
  } catch (error) {
    console.error('Error saving fee structure:', error);
    window.showToast?.('Failed to save fee structure: ' + error.message, 'danger');
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.innerHTML = '💾 Save Fee Structure';
    }
  }
}

/**
 * Delete fee structure
 */
async function deleteFeeStructure(docId, className) {
  if (!confirm(`Delete fee structure for ${className}?\n\nThis will remove the fee configuration but will NOT delete existing payment records.`)) {
    return;
  }
  
  try {
    await deleteDoc(doc(db, 'fee_structures', docId));
    
    window.showToast?.(`✓ Fee structure for ${className} deleted`, 'success');
    
    await loadFeeStructures();
    
  } catch (error) {
    console.error('Error deleting fee structure:', error);
    window.handleError(error, 'Failed to delete fee structure');
  }
}

/**
 * Record a new payment - FIXED SESSION ENCODING
 */
async function recordPayment() {
  const pupilSelect = document.getElementById('payment-pupil-select');
  const pupilId = pupilSelect?.value;
  const pupilName = pupilSelect?.selectedOptions[0]?.dataset.pupilName;
  const className = pupilSelect?.selectedOptions[0]?.dataset.className;
  const classId = document.getElementById('payment-class-filter')?.value;

  const amountInput = document.getElementById('payment-amount');
  const amountPaid = amountInput ? parseFloat(amountInput.value) : NaN;

  const paymentMethod = document.getElementById('payment-method')?.value;
  const notes = document.getElementById('payment-notes')?.value.trim() || '';

  // Validation
  if (!pupilId || !classId) {
    window.showToast?.('Please select a pupil and class', 'warning');
    return;
  }

  if (isNaN(amountPaid) || amountPaid <= 0) {
    window.showToast?.('Please enter a valid payment amount', 'warning');
    return;
  }

  const recordBtn = document.getElementById('record-payment-btn');
  if (recordBtn) {
    recordBtn.disabled = true;
    recordBtn.innerHTML = '<span class="btn-loading">Recording payment...</span>';
  }

  try {
    const settings = await window.getCurrentSettings();
    const session = settings.session;
    const term = settings.term;
    
    // Generate receipt number
    const receiptNo = `REC-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
    
    // CRITICAL FIX: Encode session to remove "/" character for document ID
    const encodedSession = session.replace(/\//g, '-');
    
    // Get or create payment summary document (using ENCODED session in ID)
    const paymentDocId = `${pupilId}_${encodedSession}_${term}`;
    const paymentRef = doc(db, 'payments', paymentDocId);
    const paymentDocSnap = await getDoc(paymentRef);
    
    let currentPaid = 0;
    let amountDue = 0;
    
    if (paymentDocSnap.exists()) {
      const data = paymentDocSnap.data();
      currentPaid = data.totalPaid || 0;
      amountDue = data.amountDue || 0;
    } else {
      // Get fee structure to know amount due
      const feeSnap = await getDocs(query(collection(db, 'fee_structures'), where('classId', '==', classId), where('session', '==', session), where('term', '==', term), limit(1)));
      
      if (!feeSnap.empty) {
        amountDue = feeSnap.docs[0].data().total || 0;
      }
    }
    
    const newTotalPaid = currentPaid + amountPaid;
    const newBalance = Math.max(0, amountDue - newTotalPaid);
    const newStatus = newBalance === 0 ? 'paid' : (newTotalPaid > 0 ? 'partial' : 'owing');
    
    // Use batch for atomic updates
    const batch = writeBatch(db);
    
    // Update/create payment summary (store ORIGINAL session format in field)
    batch.set(paymentRef, {
      pupilId,
      pupilName,
      classId,
      className,
      session: session,  // Store ORIGINAL format "2025/2026"
      term,
      amountDue,
      totalPaid: newTotalPaid,
      balance: newBalance,
      status: newStatus,
      lastPaymentDate: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true });
    
    // CRITICAL FIX: Use receiptNo as document ID for payment_transactions (not 'transactions')
    const transactionRef = doc(db, 'payment_transactions', receiptNo);
    batch.set(transactionRef, {
      pupilId,
      pupilName,
      classId,
      className,
      session: session,  // Store ORIGINAL format "2025/2026"
      term,
      amountPaid,
      paymentMethod: paymentMethod || 'Cash',
      receiptNo,
      notes,
      paymentDate: serverTimestamp(),
      recordedBy: auth.currentUser.uid,
      recordedByEmail: auth.currentUser.email
    });
    
    await batch.commit();

    window.showToast?.(
      `✓ Payment Recorded Successfully!\n\n` +
      `Receipt #${receiptNo}\n` +
      `Amount: ₦${amountPaid.toLocaleString()}\n` +
      `New Balance: ₦${newBalance.toLocaleString()}`,
      'success',
      8000
    );

    // Clear form
    if (amountInput) amountInput.value = '';
    const notesInput = document.getElementById('payment-notes');
    if (notesInput) notesInput.value = '';

    // Refresh data
    await loadPupilPaymentStatus();

    // Ask to print receipt
    if (confirm('Payment recorded successfully!\n\nWould you like to print the receipt now?')) {
      printReceipt(receiptNo);
    }

  } catch (error) {
    console.error('Error recording payment:', error);
    window.showToast?.('Failed to record payment: ' + error.message, 'danger');
  } finally {
    if (recordBtn) {
      recordBtn.disabled = false;
      recordBtn.innerHTML = '💰 Record Payment';
    }
  }
}

// Open receipt in new window for printing
function printReceipt(receiptNo) {
    const receiptWindow = window.open(
        `receipt.html?receipt=${receiptNo}`,
        '_blank',
        'width=800,height=600'
    );

    if (!receiptWindow) {
        window.showToast?.('Please allow popups to print receipts', 'warning');
    }
}

/**
 * Export financial report to CSV
 */
async function exportFinancialReport(format) {
    if (format !== 'csv' && format !== 'pdf') {
        window.showToast?.('Invalid export format', 'warning');
        return;
    }
    
    try {
        const settings = await window.getCurrentSettings();
        const session = settings.session;
        const term = settings.term;
        
        // Get all payment data
        const paymentsSnap = await getDocs(query(collection(db, 'payments'), where('session', '==', session), where('term', '==', term)));
        
        if (paymentsSnap.empty) {
            window.showToast?.('No payment data to export', 'warning');
            return;
        }
        
        if (format === 'csv') {
            await exportFinancialCSV(paymentsSnap, session, term);
        } else if (format === 'pdf') {
            await exportFinancialPDF(paymentsSnap, session, term);
        }
        
    } catch (error) {
        console.error('Error exporting financial report:', error);
        window.handleError(error, 'Failed to export report');
    }
}

/**
 * Export to CSV format
 */
async function exportFinancialCSV(paymentsSnap, session, term) {
    const payments = [];
    
    paymentsSnap.forEach(docSnap => {
        const data = docSnap.data();
        payments.push({
            pupilName: data.pupilName || '',
            className: data.className || '',
            amountDue: data.amountDue || 0,
            totalPaid: data.totalPaid || 0,
            balance: data.balance || 0,
            status: data.status || '',
            lastPaymentDate: data.lastPaymentDate 
                ? data.lastPaymentDate.toDate().toLocaleDateString('en-GB')
                : 'N/A'
        });
    });
    
    // Create CSV content
    const headers = ['Pupil Name', 'Class', 'Amount Due', 'Total Paid', 'Balance', 'Status', 'Last Payment Date'];
    const csvRows = [headers.join(',')];
    
    payments.forEach(p => {
        const row = [
            `"${p.pupilName}"`,
            `"${p.className}"`,
            p.amountDue,
            p.totalPaid,
            p.balance,
            `"${p.status}"`,
            `"${p.lastPaymentDate}"`
        ];
        csvRows.push(row.join(','));
    });
    
    const csvContent = csvRows.join('\n');
    
    // Download CSV
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Financial_Report_${session}_${term}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    
    window.showToast?.('✓ CSV report downloaded', 'success');
}

/**
 * Export to PDF format
 */
async function exportFinancialPDF(paymentsSnap, session, term) {
    // Check if jsPDF is available
    if (typeof window.jspdf === 'undefined') {
        window.showToast?.('PDF library not loaded. Please refresh the page.', 'danger');
        return;
    }
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(18);
    doc.text('FAHMID NURSERY & PRIMARY SCHOOL', 105, 15, { align: 'center' });
    
    doc.setFontSize(14);
    doc.text('Financial Report', 105, 25, { align: 'center' });
    
    doc.setFontSize(10);
    doc.text(`Session: ${session} | Term: ${term}`, 105, 32, { align: 'center' });
    doc.text(`Generated: ${new Date().toLocaleDateString('en-GB')}`, 105, 38, { align: 'center' });
    
    // Table data
    const tableData = [];
    let totalExpected = 0;
    let totalCollected = 0;
    let totalOutstanding = 0;
    
    paymentsSnap.forEach(docSnap => {
        const data = docSnap.data();
        totalExpected += data.amountDue || 0;
        totalCollected += data.totalPaid || 0;
        totalOutstanding += data.balance || 0;
        
        tableData.push([
            data.pupilName || '',
            data.className || '',
            `₦${(data.amountDue || 0).toLocaleString()}`,
            `₦${(data.totalPaid || 0).toLocaleString()}`,
            `₦${(data.balance || 0).toLocaleString()}`,
            data.status || ''
        ]);
    });
    
    // Add table
    doc.autoTable({
        startY: 45,
        head: [['Pupil Name', 'Class', 'Amount Due', 'Paid', 'Balance', 'Status']],
        body: tableData,
        theme: 'grid',
        styles: { fontSize: 8 },
        headStyles: { fillColor: [0, 178, 255] }
    });
    
    // Summary section
    const finalY = doc.lastAutoTable.finalY + 10;
    
    doc.setFontSize(12);
    doc.text('Summary', 14, finalY);
    
    doc.setFontSize(10);
    doc.text(`Total Expected: ₦${totalExpected.toLocaleString()}`, 14, finalY + 8);
    doc.text(`Total Collected: ₦${totalCollected.toLocaleString()}`, 14, finalY + 14);
    doc.text(`Total Outstanding: ₦${totalOutstanding.toLocaleString()}`, 14, finalY + 20);
    
    const collectionRate = totalExpected > 0 ? ((totalCollected / totalExpected) * 100).toFixed(1) : 0;
    doc.text(`Collection Rate: ${collectionRate}%`, 14, finalY + 26);
    
    // Save PDF
    doc.save(`Financial_Report_${session}_${term}_${new Date().toISOString().split('T')[0]}.pdf`);
    
    window.showToast?.('✓ PDF report downloaded', 'success');
}

// Export and reporting
window.exportFinancialReport = exportFinancialReport;
window.printReceipt = printReceipt;

// Payment actions and records
window.recordPayment = recordPayment;
window.loadPaymentHistory = loadPaymentHistory;
window.loadPupilPaymentStatus = loadPupilPaymentStatus;

// Fee management
window.saveFeeStructure = saveFeeStructure;
window.deleteFeeStructure = deleteFeeStructure;

// Section and data loaders
window.loadFeeManagementSection = loadFeeManagementSection;
window.loadPaymentRecordingSection = loadPaymentRecordingSection;
window.loadPupilsForPayment = loadPupilsForPayment;
window.loadOutstandingFeesReport = loadOutstandingFeesReport;
window.loadFinancialReports = loadFinancialReports;

// Initialization logs
console.log('✓ Financial management functions loaded');
console.log('✓ Finance section loaders initialized');

// ============================================
// MAKE FUNCTIONS GLOBALLY AVAILABLE
// ============================================

window.showSection = showSection;
window.setupSidebarNavigation = setupSidebarNavigation;
window.initializeAdminPortal = initializeAdminPortal;
window.loadSectionData = loadSectionData;

console.log('✓ Admin sidebar navigation - Teacher-style logic applied');

/* ======================================== 
   CLASS HIERARCHY MODULE (ADMIN ONLY)
======================================== */

window.classHierarchy = {
  /**
   * Initialize class hierarchy from classes collection
   */
  async initializeClassHierarchy() {
    try {
      console.log('🔧 Initializing class hierarchy...');
      
      // Check if hierarchy already exists
      const hierarchyDocSnap = await getDoc(doc(db, 'settings', 'classHierarchy'));
      
      if (hierarchyDocSnap.exists() && hierarchyDocSnap.data().orderedClassIds) {
        const orderedIds = hierarchyDocSnap.data().orderedClassIds;
        console.log(`✓ Class hierarchy loaded: ${orderedIds.length} classes`);
        return {
          success: true,
          isEmpty: orderedIds.length === 0,
          message: 'Hierarchy already exists'
        };
      }
      
      // Get all classes from classes collection
      const classesSnapshot = await getDocs(query(collection(db, 'classes'), orderBy('name')));
      
      if (classesSnapshot.empty) {
        console.log('⚠️ No classes found - hierarchy empty');
        
        // Create empty hierarchy document
        await setDoc(doc(db, 'settings', 'classHierarchy'), {
          orderedClassIds: [],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        
        return {
          success: true,
          isEmpty: true,
          message: 'No classes to initialize'
        };
      }
      
      // Create ordered list (alphabetical by default)
      const orderedClassIds = [];
      classesSnapshot.forEach(docSnap => {
        orderedClassIds.push(docSnap.id);
      });
      
      // Save to database
      await setDoc(doc(db, 'settings', 'classHierarchy'), {
        orderedClassIds: orderedClassIds,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      console.log(`✓ Class hierarchy initialized with ${orderedClassIds.length} classes`);
      
      return {
        success: true,
        isEmpty: false,
        count: orderedClassIds.length,
        message: 'Hierarchy initialized successfully'
      };
      
    } catch (error) {
      console.error('❌ Error initializing class hierarchy:', error);
      return {
        success: false,
        isEmpty: true,
        error: error.message
      };
    }
  },

  /**
   * Get the next class in progression
   */
  async getNextClass(currentClassName) {
    try {
      const hierarchyDocSnap = await getDoc(doc(db, 'settings', 'classHierarchy'));
      
      if (!hierarchyDocSnap.exists() || !hierarchyDocSnap.data().orderedClassIds) {
        console.warn('Class hierarchy not initialized');
        return null;
      }
      
      const orderedClassIds = hierarchyDocSnap.data().orderedClassIds;
      
      if (orderedClassIds.length === 0) {
        console.warn('Class hierarchy is empty');
        return null;
      }
      
      // Get all classes to map IDs to names
      const classesSnapshot = await getDocs(collection(db, 'classes'));
      const classesMap = {};
      
      classesSnapshot.forEach(docSnap => {
        classesMap[docSnap.id] = docSnap.data().name;
      });
      
      // Find current class ID by name
      let currentClassId = null;
      for (const [id, name] of Object.entries(classesMap)) {
        if (name === currentClassName) {
          currentClassId = id;
          break;
        }
      }
      
      if (!currentClassId) {
        console.warn(`Class "${currentClassName}" not found in database`);
        return null;
      }
      
      // Find current position in hierarchy
      const currentIndex = orderedClassIds.indexOf(currentClassId);
      
      if (currentIndex === -1) {
        console.warn(`Class "${currentClassName}" not in hierarchy order`);
        return null;
      }
      
      // Check if this is the last class (terminal)
      if (currentIndex === orderedClassIds.length - 1) {
        console.log(`Class "${currentClassName}" is terminal class`);
        return null;
      }
      
      // Get next class name
      const nextClassId = orderedClassIds[currentIndex + 1];
      const nextClassName = classesMap[nextClassId];
      
      console.log(`Next class after "${currentClassName}": "${nextClassName}"`);
      
      return nextClassName || null;
      
    } catch (error) {
      console.error('Error getting next class:', error);
      return null;
    }
  },

  /**
   * Check if a class is the terminal (last) class
   */
  async isTerminalClass(className) {
    try {
      const hierarchyDocSnap = await getDoc(doc(db, 'settings', 'classHierarchy'));
      
      if (!hierarchyDocSnap.exists() || !hierarchyDocSnap.data().orderedClassIds) {
        console.warn('Class hierarchy not initialized');
        return false;
      }
      
      const orderedClassIds = hierarchyDocSnap.data().orderedClassIds;
      
      if (orderedClassIds.length === 0) {
        return false;
      }
      
      // Get the last class in hierarchy
      const lastClassId = orderedClassIds[orderedClassIds.length - 1];
      
      // Get class name
      const classDocSnap = await getDoc(doc(db, 'classes', lastClassId));
      
      if (!classDocSnap.exists()) {
        console.warn(`Terminal class ${lastClassId} not found`);
        return false;
      }
      
      const lastClassName = classDocSnap.data().name;
      
      const isTerminal = className === lastClassName;
      
      console.log(`Class "${className}" is terminal: ${isTerminal}`);
      
      return isTerminal;
      
    } catch (error) {
      console.error('Error checking terminal class:', error);
      return false;
    }
  },

  /**
   * Save class hierarchy order
   */
  async saveClassHierarchy(orderedClassIds) {
    try {
      if (!Array.isArray(orderedClassIds)) {
        throw new Error('orderedClassIds must be an array');
      }
      
      if (orderedClassIds.length === 0) {
        throw new Error('Cannot save empty class hierarchy');
      }
      
      // Validate all class IDs exist
      const classesSnapshot = await getDocs(collection(db, 'classes'));
      const validClassIds = new Set();
      
      classesSnapshot.forEach(docSnap => {
        validClassIds.add(docSnap.id);
      });
      
      const invalidIds = orderedClassIds.filter(id => !validClassIds.has(id));
      
      if (invalidIds.length > 0) {
        throw new Error(`Invalid class IDs: ${invalidIds.join(', ')}`);
      }
      
      // Save to database
      await setDoc(doc(db, 'settings', 'classHierarchy'), {
        orderedClassIds: orderedClassIds,
        updatedAt: serverTimestamp()
      }, { merge: true });
      
      console.log(`✓ Class hierarchy saved: ${orderedClassIds.length} classes`);
      
      return {
        success: true,
        count: orderedClassIds.length
      };
      
    } catch (error) {
      console.error('Error saving class hierarchy:', error);
      return {
        success: false,
        error: error.message
      };
    }
  },

  /**
   * Get full hierarchy as ordered list
   */
  async getHierarchy() {
    try {
      const hierarchyDocSnap = await getDoc(doc(db, 'settings', 'classHierarchy'));
      
      if (!hierarchyDocSnap.exists() || !hierarchyDocSnap.data().orderedClassIds) {
        console.warn('Class hierarchy not initialized');
        return [];
      }
      
      const orderedClassIds = hierarchyDocSnap.data().orderedClassIds;
      
      if (orderedClassIds.length === 0) {
        return [];
      }
      
      // Get all classes
      const classesSnapshot = await getDocs(collection(db, 'classes'));
      
      const classesMap = {};
      classesSnapshot.forEach(docSnap => {
        classesMap[docSnap.id] = {
          id: docSnap.id,
          name: docSnap.data().name || 'Unnamed Class'
        };
      });
      
      // Build ordered list with names
      const hierarchy = [];
      orderedClassIds.forEach(classId => {
        if (classesMap[classId]) {
          hierarchy.push(classesMap[classId]);
        }
      });
      
      console.log(`✓ Retrieved hierarchy: ${hierarchy.length} classes`);
      
      return hierarchy;
      
    } catch (error) {
      console.error('Error getting hierarchy:', error);
      return [];
    }
  }
};

console.log('✓ Class hierarchy module initialized (admin only)');

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
    const snapshot = await getDocs(query(collection(db, 'classes'), orderBy('name')));
    classSelect.innerHTML = '<option value="">-- Select Class --</option>';

    if (snapshot.empty) {
      classSelect.innerHTML = '<option value="">No classes available - Create one first</option>';
      classSelect.disabled = true;
      window.showToast?.('Please create a class first', 'warning');
      return;
    }

    classSelect.disabled = false;
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      const opt = document.createElement('option');
      opt.value = docSnap.id;
      opt.textContent = data.name || 'Unnamed Class';
      if (selectedClass && docSnap.id === selectedClass) {
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
    
    const docSnap = await getDoc(doc(db, 'classes', classId));
    
    if (!docSnap.exists()) {
      console.warn(`Class ${classId} not found`);
      return null;
    }

    const data = docSnap.data();
    let teacherName = '';
    let teacherId = data.teacherId || '';

    if (teacherId) {
      try {
        const teacherDocSnap = await getDoc(doc(db, 'teachers', teacherId));
        if (teacherDocSnap.exists()) {
          teacherName = teacherDocSnap.data().name || '';
        }
      } catch (teacherError) {
        console.error('Error fetching teacher:', teacherError);
      }
    }

    return {
      classId: docSnap.id,
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
 * FIXED PAGINATION WITH MEMORY LEAK PREVENTION
 * Replace the paginateTable function in admin.js
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
  
  // Validate page number
  if (page < 1) page = 1;
  if (page > totalPages) page = totalPages;
  
  const start = (page - 1) * itemsPerPage;
  const end = start + itemsPerPage;
  
  // CRITICAL FIX: Check if start is beyond data length
  if (start >= data.length && data.length > 0) {
    // Go back to last valid page
    console.warn(`⚠️ Page ${page} is beyond data, going to page ${totalPages}`);
    renderPage(totalPages);
    return;
  }
  
  const pageData = data.slice(start, end);
  
  // Handle empty page data
  if (pageData.length === 0) {
    tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; padding: var(--space-xl); color: var(--color-gray-600);">No data available</td></tr>';
    updatePaginationControls(1, 1); // Show page 1 of 1
    return;
  }
  
  // Render each row
  pageData.forEach(item => {
    try {
      renderRowCallback(item, tbody);
    } catch (error) {
      console.error('❌ Error rendering row:', error);
      // Don't break the entire table, just skip this row
    }
  });
  
  updatePaginationControls(page, totalPages);
}
  
  function updatePaginationControls(page, total) {
    const table = tbody.parentElement;
    if (!table) return;
    
    const container = table.parentElement;
    if (!container) return;
    
    // FIXED: Use consistent pagination container ID
    let paginationContainer = container.querySelector(`#pagination-${tbodyId}`);
    
    if (!paginationContainer) {
      paginationContainer = document.createElement('div');
      paginationContainer.className = 'pagination';
      paginationContainer.id = `pagination-${tbodyId}`;
      container.appendChild(paginationContainer);
    }
    
    // FIXED: Add keyboard navigation support
    paginationContainer.innerHTML = `
      <button 
        onclick="window.${paginationFuncName}(${page - 1})" 
        ${page === 1 ? 'disabled' : ''}
        aria-label="Previous page">
        Previous
      </button>
      <span class="page-info" role="status" aria-live="polite">
        Page ${page} of ${total || 1}
      </span>
      <button 
        onclick="window.${paginationFuncName}(${page + 1})" 
        ${page === total ? 'disabled' : ''}
        aria-label="Next page">
        Next
      </button>
    `;
  }
  
  // Create pagination function
  window[paginationFuncName] = function(newPage) {
    if (newPage < 1 || newPage > totalPages) return;
    currentPage = newPage;
    renderPage(currentPage);
  };
  
  // Initial render
  renderPage(1);
  
  console.log(`✓ Pagination initialized for ${tbodyId} (${data.length} items, ${totalPages} pages)`);
}

// Export for use
window.paginateTable = paginateTable;

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
    const snapshot = await getDocs(query(collection(db, 'sessions'), orderBy('startYear', 'desc'), limit(10)));
    
    tbody.innerHTML = '';
    
    if (snapshot.empty) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--color-gray-600);">No archived sessions yet</td></tr>';
      return;
    }
    
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      
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
    const snapshot = await getDocs(query(collection(db, 'alumni'), orderBy('graduationDate', 'desc')));
    
    tbody.innerHTML = '';
    
    if (snapshot.empty) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--color-gray-600);">No alumni yet. Pupils will appear here after graduating from terminal class.</td></tr>';
      return;
    }
    
    const alumni = [];
    snapshot.forEach(docSnap => {
      alumni.push({ id: docSnap.id, ...docSnap.data() });
    });
    
    paginateTable(alumni, 'alumni-table', 20, (alum, tbodyEl) => {
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
      tbodyEl.appendChild(tr);
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