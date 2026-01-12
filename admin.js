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
  
  // Hide all sections
  document.querySelectorAll('.admin-card').forEach(card => {
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
  
  const activeLink = document.querySelector(`.sidebar-link[data-section="${sectionId}"]`);
  if (activeLink) {
    activeLink.classList.add('active');
    
    // Expand parent group if nested
    const parentGroup = activeLink.closest('.sidebar-group-content-modern');
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
      const hierarchyDoc = await db.collection('settings').doc('classHierarchy').get();
      
      if (hierarchyDoc.exists && hierarchyDoc.data().orderedClassIds) {
        const orderedIds = hierarchyDoc.data().orderedClassIds;
        console.log(`✓ Class hierarchy loaded: ${orderedIds.length} classes`);
        return {
          success: true,
          isEmpty: orderedIds.length === 0,
          message: 'Hierarchy already exists'
        };
      }
      
      // Get all classes from classes collection
      const classesSnapshot = await db.collection('classes').orderBy('name').get();
      
      if (classesSnapshot.empty) {
        console.log('⚠️ No classes found - hierarchy empty');
        
        // Create empty hierarchy document
        await db.collection('settings').doc('classHierarchy').set({
          orderedClassIds: [],
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        return {
          success: true,
          isEmpty: true,
          message: 'No classes to initialize'
        };
      }
      
      // Create ordered list (alphabetical by default)
      const orderedClassIds = [];
      classesSnapshot.forEach(doc => {
        orderedClassIds.push(doc.id);
      });
      
      // Save to database
      await db.collection('settings').doc('classHierarchy').set({
        orderedClassIds: orderedClassIds,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
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
      const hierarchyDoc = await db.collection('settings').doc('classHierarchy').get();
      
      if (!hierarchyDoc.exists || !hierarchyDoc.data().orderedClassIds) {
        console.warn('Class hierarchy not initialized');
        return null;
      }
      
      const orderedClassIds = hierarchyDoc.data().orderedClassIds;
      
      if (orderedClassIds.length === 0) {
        console.warn('Class hierarchy is empty');
        return null;
      }
      
      // Get all classes to map IDs to names
      const classesSnapshot = await db.collection('classes').get();
      const classesMap = {};
      
      classesSnapshot.forEach(doc => {
        classesMap[doc.id] = doc.data().name;
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
      const hierarchyDoc = await db.collection('settings').doc('classHierarchy').get();
      
      if (!hierarchyDoc.exists || !hierarchyDoc.data().orderedClassIds) {
        console.warn('Class hierarchy not initialized');
        return false;
      }
      
      const orderedClassIds = hierarchyDoc.data().orderedClassIds;
      
      if (orderedClassIds.length === 0) {
        return false;
      }
      
      // Get the last class in hierarchy
      const lastClassId = orderedClassIds[orderedClassIds.length - 1];
      
      // Get class name
      const classDoc = await db.collection('classes').doc(lastClassId).get();
      
      if (!classDoc.exists) {
        console.warn(`Terminal class ${lastClassId} not found`);
        return false;
      }
      
      const lastClassName = classDoc.data().name;
      
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
      const classesSnapshot = await db.collection('classes').get();
      const validClassIds = new Set();
      
      classesSnapshot.forEach(doc => {
        validClassIds.add(doc.id);
      });
      
      const invalidIds = orderedClassIds.filter(id => !validClassIds.has(id));
      
      if (invalidIds.length > 0) {
        throw new Error(`Invalid class IDs: ${invalidIds.join(', ')}`);
      }
      
      // Save to database
      await db.collection('settings').doc('classHierarchy').set({
        orderedClassIds: orderedClassIds,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
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
      const hierarchyDoc = await db.collection('settings').doc('classHierarchy').get();
      
      if (!hierarchyDoc.exists || !hierarchyDoc.data().orderedClassIds) {
        console.warn('Class hierarchy not initialized');
        return [];
      }
      
      const orderedClassIds = hierarchyDoc.data().orderedClassIds;
      
      if (orderedClassIds.length === 0) {
        return [];
      }
      
      // Get all classes
      const classesSnapshot = await db.collection('classes').get();
      
      const classesMap = {};
      classesSnapshot.forEach(doc => {
        classesMap[doc.id] = {
          id: doc.id,
          name: doc.data().name || 'Unnamed Class'
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
   SIDEBAR GROUP TOGGLE
======================================== */

/**
 * FIXED: Toggle sidebar group with proper state management
 */
function toggleSidebarGroup(button) {
  if (!button) {
    console.error('toggleSidebarGroup: button is null');
    return;
  }
  
  const content = button.nextElementSibling;
  
  if (!content) {
    console.error('toggleSidebarGroup: no content element found');
    return;
  }
  
  const isCollapsed = button.classList.contains('collapsed');
  
  if (isCollapsed) {
    // Expand the group
    button.classList.remove('collapsed');
    content.classList.add('active');
    button.setAttribute('aria-expanded', 'true');
  } else {
    // Collapse the group
    button.classList.add('collapsed');
    content.classList.remove('active');
    button.setAttribute('aria-expanded', 'false');
  }
}

// Make globally available
window.toggleSidebarGroup = toggleSidebarGroup;

/* ======================================== 
   DASHBOARD STATS 
======================================== */
async function loadDashboardStats() {
  console.log('📊 Loading dashboard stats...');
  
  // Wait a bit for DOM to be ready
  await new Promise(resolve => setTimeout(resolve, 100));
  
  const teacherCount = document.getElementById('teacher-count');
  const pupilCount = document.getElementById('pupil-count');
  const classCount = document.getElementById('class-count');
  const announceCount = document.getElementById('announce-count');
  
  if (!teacherCount || !pupilCount || !classCount || !announceCount) {
    console.error('❌ Dashboard stat elements missing!');
    return;
  }
  
  // Show loading state
  teacherCount.innerHTML = '<div class="spinner" style="width:20px; height:20px;"></div>';
  pupilCount.innerHTML = '<div class="spinner" style="width:20px; height:20px;"></div>';
  classCount.innerHTML = '<div class="spinner" style="width:20px; height:20px;"></div>';
  announceCount.innerHTML = '<div class="spinner" style="width:20px; height:20px;"></div>';
  
  try {
    const teachersSnap = await db.collection('teachers').get();
    const pupilsSnap = await db.collection('pupils').get();
    const classesSnap = await db.collection('classes').get();
    const announcementsSnap = await db.collection('announcements').get();
    
    teacherCount.textContent = teachersSnap.size;
    pupilCount.textContent = pupilsSnap.size;
    classCount.textContent = classesSnap.size;
    announceCount.textContent = announcementsSnap.size;
    
    console.log('✅ Dashboard stats loaded successfully');
    
  } catch (error) {
    console.error('❌ Error loading dashboard stats:', error);
    window.showToast?.('Failed to load dashboard statistics', 'danger');
    
    teacherCount.textContent = '!';
    pupilCount.textContent = '!';
    classCount.textContent = '!';
    announceCount.textContent = '!';
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
    
    // CRITICAL FIX: Send password reset BEFORE signing out
    await secondaryAuth.sendPasswordResetEmail(email);
    await secondaryAuth.signOut();
        
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
  const admissionNo = document.getElementById('pupil-admission-no').value.trim();
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
  admissionNo,
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

/**
 * FIXED: Load Pupils with Bulk Action Support
 * Adds checkboxes and bulk operation capabilities
 */
async function loadPupils() {
  const tbody = document.getElementById('pupils-table');
  if (!tbody) return;

  // Populate class dropdown first
  await populateClassDropdown();

  tbody.innerHTML = '<tr><td colspan="7" class="table-loading">Loading pupils...</td></tr>';

  try {
    const snapshot = await db.collection('pupils').get();
    tbody.innerHTML = '';

    if (snapshot.empty) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:var(--color-gray-600);">No pupils registered yet. Add one above.</td></tr>';
      
      // Hide bulk actions if no pupils
      const bulkActionsBar = document.getElementById('bulk-actions-bar');
      if (bulkActionsBar) bulkActionsBar.style.display = 'none';
      
      return;
    }

    const pupils = [];
    snapshot.forEach(doc => {
      pupils.push({ id: doc.id, ...doc.data() });
    });

    pupils.sort((a, b) => a.name.localeCompare(b.name));

    // Show bulk actions bar
    const bulkActionsBar = document.getElementById('bulk-actions-bar');
    if (bulkActionsBar) bulkActionsBar.style.display = 'flex';

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
        <td data-label="Select" style="text-align:center;">
          <input type="checkbox" class="pupil-checkbox" data-pupil-id="${pupil.id}" onchange="updateBulkActionButtons()">
        </td>
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
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:var(--color-danger);">Error loading pupils - please refresh</td></tr>';
  }
}

async function editPupil(uid) {
  try {
    const doc = await db.collection('pupils').doc(uid).get();
    if (!doc.exists) throw new Error('Pupil not found');

    const data = doc.data();

    // Safely extract class ID
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

    // Handle old-format class data
    if (!classId && className && typeof className === 'string') {
      const classesSnapshot = await db.collection('classes')
        .where('name', '==', className)
        .get();

      if (classesSnapshot.empty) {
        window.showToast?.(
          `Warning: Class "${className}" not found in database. Please select the correct class manually.`,
          'warning',
          6000
        );
      } else if (classesSnapshot.size > 1) {
        // Multiple classes with same name found
        window.showToast?.(
          `⚠️ AMBIGUOUS CLASS DATA DETECTED!\n\n` +
          `This pupil's record shows class "${className}", but ${classesSnapshot.size} classes ` +
          `have this name in the database.\n\n` +
          `Please manually select the correct class from the dropdown and save to fix this issue.`,
          'warning',
          10000
        );

        const classSelect = document.getElementById('pupil-class');
        if (classSelect) {
          classSelect.value = ''; // force manual selection
          classSelect.style.background = '#fff3cd';
          classSelect.style.border = '2px solid #ffc107';

          classSelect.addEventListener('change', function removeHighlight() {
            this.style.background = '';
            this.style.border = '';
            this.removeEventListener('change', removeHighlight);
          });
        }
      } else {
        // Exactly one match - safe to auto-select
        const matchedClassId = classesSnapshot.docs[0].id;
        document.getElementById('pupil-class').value = matchedClassId;

        window.showToast?.(
          'Note: This pupil has old class data format. Saving will upgrade it automatically.',
          'info',
          5000
        );
      }
    } else if (!classId) {
      // classId is missing and className is invalid
      window.showToast?.(
        `Warning: Could not find class "${className}". Please select the correct class.`,
        'warning',
        6000
      );
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

/**
 * FIXED: Add Class with Duplicate Name Prevention
 * Ensures unique class names to avoid migration conflicts
 */
async function addClass() {
  const className = document.getElementById('class-name')?.value.trim();
  
  if (!className) {
    window.showToast?.('Class name is required', 'warning');
    return;
  }
  
  // CRITICAL FIX: Check for duplicate class names (case-insensitive)
  try {
    const existingSnap = await db.collection('classes')
      .where('name', '==', className)
      .get();
    
    if (!existingSnap.empty) {
      window.showToast?.(
        `Class "${className}" already exists. Please use a unique name.`,
        'warning',
        5000
      );
      return;
    }
    
    // Also check case-insensitive duplicates
    const allClassesSnap = await db.collection('classes').get();
    const duplicateFound = allClassesSnap.docs.some(doc => {
      const existingName = doc.data().name || '';
      return existingName.toLowerCase() === className.toLowerCase();
    });
    
    if (duplicateFound) {
      window.showToast?.(
        `A class with a similar name already exists (case-insensitive match). Please use a unique name.`,
        'warning',
        6000
      );
      return;
    }
    
    // Create the class
    await db.collection('classes').add({
      name: className,
      subjects: [], // Initialize empty subjects array
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      createdBy: auth.currentUser?.uid || 'unknown'
    });
    
    window.showToast?.('✓ Class created successfully', 'success');
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
    // CRITICAL FIX: Use transaction for atomic updates
    await db.runTransaction(async (transaction) => {
      const classRef = db.collection('classes').doc(currentAssignmentClassId);
      
      // Read class document
      const classDoc = await transaction.get(classRef);
      if (!classDoc.exists) {
        throw new Error('Class not found');
      }
      
      const classData = classDoc.data();
      
      // Read all pupils in this class BEFORE any updates
      const pupilsSnap = await db
        .collection('pupils')
        .where('class.id', '==', currentAssignmentClassId)
        .get();
      
      console.log(`Found ${pupilsSnap.size} pupils to update`);
      
      // Update class subjects
      transaction.update(classRef, {
        subjects: selectedSubjects,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      
      // Update all pupils' subjects atomically
      pupilsSnap.forEach(pupilDoc => {
        transaction.update(pupilDoc.ref, {
          subjects: selectedSubjects,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      });
      
      console.log('✓ Transaction prepared with all updates');
    });

    window.showToast?.(
      `✓ Subjects updated atomically for class "${currentAssignmentClassName}"`,
      'success',
      5000
    );

    closeSubjectAssignmentModal();
    loadClasses();

  } catch (error) {
    console.error('Error saving subjects:', error);
    
    if (error.message === 'Class not found') {
      window.showToast?.('Class no longer exists', 'danger');
    } else {
      window.handleError(error, 'Failed to save subjects');
    }
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
    // CRITICAL FIX: Initialize class hierarchy FIRST
    console.log('Initializing class hierarchy...');
    const hierarchyStatus = await window.classHierarchy.initializeClassHierarchy();
    
    if (hierarchyStatus && hierarchyStatus.isEmpty) {
      window.showToast?.(
        '⚠️ Class hierarchy is empty! Please configure your class names in the "Class Progression Order" section below.',
        'warning',
        8000
      );
    }
    console.log('✓ Class hierarchy ready');
    
    const settingsDoc = await db.collection('settings').doc('current').get();
    
    if (!settingsDoc.exists) {
      window.showToast?.('No settings found. Please configure school settings.', 'warning');
      return;
    }
    
    const data = settingsDoc.data();
    
    // Display current session info in status card
    if (data.currentSession && typeof data.currentSession === 'object') {
      const session = data.currentSession;
      
      const displaySessionName = document.getElementById('display-session-name');
      const displayCurrentTerm = document.getElementById('display-current-term');
      const displaySessionStart = document.getElementById('display-session-start');
      const displaySessionEnd = document.getElementById('display-session-end');
      
      if (displaySessionName) {
        displaySessionName.textContent = session.name || `${session.startYear}/${session.endYear}`;
      }
      
      if (displayCurrentTerm) {
        displayCurrentTerm.textContent = data.term || 'First Term';
      }
      
      if (session.startDate && displaySessionStart) {
        const startDate = session.startDate.toDate();
        displaySessionStart.textContent = startDate.toLocaleDateString('en-GB');
      }
      
      if (session.endDate && displaySessionEnd) {
        const endDate = session.endDate.toDate();
        displaySessionEnd.textContent = endDate.toLocaleDateString('en-GB');
      }
      
      // Check if session is ending soon
      if (session.endDate) {
        const endDate = session.endDate.toDate();
        const today = new Date();
        const daysUntilEnd = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));
        
        const statusBadge = document.getElementById('session-status-badge');
        const alertDiv = document.getElementById('session-end-alert');
        
        if (daysUntilEnd < 0 && statusBadge) {
          statusBadge.textContent = 'Ended';
          statusBadge.className = 'status-badge ended';
          if (alertDiv) alertDiv.style.display = 'block';
        } else if (daysUntilEnd <= 30 && statusBadge) {
          statusBadge.textContent = 'Ending Soon';
          statusBadge.className = 'status-badge ending-soon';
          if (alertDiv) alertDiv.style.display = 'block';
        } else if (statusBadge) {
          statusBadge.textContent = 'Active';
          statusBadge.className = 'status-badge';
          if (alertDiv) alertDiv.style.display = 'none';
        }
      }
      
      // Populate edit form
      const startYearInput = document.getElementById('session-start-year');
      const endYearInput = document.getElementById('session-end-year');
      const startDateInput = document.getElementById('session-start-date');
      const endDateInput = document.getElementById('session-end-date');
      
      if (startYearInput) startYearInput.value = session.startYear || '';
      if (endYearInput) endYearInput.value = session.endYear || '';
      
      if (session.startDate && startDateInput) {
        const startDate = session.startDate.toDate();
        startDateInput.value = startDate.toISOString().split('T')[0];
      }
      
      if (session.endDate && endDateInput) {
        const endDate = session.endDate.toDate();
        endDateInput.value = endDate.toISOString().split('T')[0];
      }
    } else if (data.session) {
      // Old format fallback
      const displaySessionName = document.getElementById('display-session-name');
      const displayCurrentTerm = document.getElementById('display-current-term');
      
      if (displaySessionName) displaySessionName.textContent = data.session;
      if (displayCurrentTerm) displayCurrentTerm.textContent = data.term || 'First Term';
    }
    
    // Current term
    const currentTermSelect = document.getElementById('current-term');
    if (currentTermSelect) {
      currentTermSelect.value = data.term || 'First Term';
    }
    
    // FIXED: Resumption date handling
    const displayNextResumption = document.getElementById('display-next-resumption');
    const resumptionDateInput = document.getElementById('resumption-date');
    
    if (data.resumptionDate) {
      try {
        const resumptionDate = data.resumptionDate.toDate();
        
        if (displayNextResumption) {
          displayNextResumption.textContent = resumptionDate.toLocaleDateString('en-GB');
        }
        
        if (resumptionDateInput) {
          resumptionDateInput.value = resumptionDate.toISOString().split('T')[0];
        }
      } catch (error) {
        console.error('Error parsing resumption date:', error);
        if (displayNextResumption) displayNextResumption.textContent = 'Not set';
        if (resumptionDateInput) resumptionDateInput.value = '';
      }
    } else {
      // No resumption date set
      if (displayNextResumption) displayNextResumption.textContent = 'Not set';
      if (resumptionDateInput) resumptionDateInput.value = '';
    }
    
    console.log('✓ Settings loaded successfully');
    
  } catch (error) {
    console.error('Error loading settings:', error);
    window.showToast?.('Failed to load settings', 'danger');
  }
}

/* ======================================== 
   START NEW ACADEMIC SESSION
======================================== */
/**
 * FIXED: Start New Session with Pre-Flight Validation
 * Checks for pending work before allowing session rollover
 */
async function confirmStartNewSession() {
  // VALIDATION STEP 1: Check for pending promotions
  const pendingPromotions = await db.collection('promotions')
    .where('status', '==', 'pending')
    .get();
  
  const pendingCount = pendingPromotions.size;
  
  // VALIDATION STEP 2: Check for pupils in terminal class
  let pupilsInTerminalClass = 0;
  
  try {
    // Get class hierarchy to find terminal class
    const hierarchy = await window.classHierarchy.getHierarchy();
    
    if (hierarchy.length > 0) {
      const terminalClassName = hierarchy[hierarchy.length - 1].name;
      
      const pupilsSnap = await db.collection('pupils')
        .where('class.name', '==', terminalClassName)
        .get();
      
      pupilsInTerminalClass = pupilsSnap.size;
    }
  } catch (error) {
    console.error('Error checking terminal class pupils:', error);
  }
  
  // VALIDATION STEP 3: Build warning message
  const issues = [];
  
  if (pendingCount > 0) {
    issues.push(`• ${pendingCount} pending promotion request(s) not yet approved`);
  }
  
  if (pupilsInTerminalClass > 0) {
    issues.push(`• ${pupilsInTerminalClass} pupil(s) still in terminal class (should be in alumni)`);
  }
  
  // VALIDATION STEP 4: Show blocking or warning dialog
  if (issues.length > 0) {
    const warningMessage = 
      '⚠️ WARNING: Issues detected before starting new session:\n\n' +
      issues.join('\n') + '\n\n' +
      'RECOMMENDATIONS:\n' +
      '1. Approve or reject all pending promotions\n' +
      '2. Move terminal class pupils to alumni\n' +
      '3. Verify all teachers have completed their work\n\n' +
      'Do you want to:\n' +
      '• Click CANCEL to fix these issues first (RECOMMENDED)\n' +
      '• Click OK to force start anyway (NOT RECOMMENDED)';
    
    const forceProceed = confirm(warningMessage);
    
    if (!forceProceed) {
      window.showToast?.('Session start cancelled. Please resolve pending issues first.', 'info', 5000);
      return;
    }
    
    // Admin chose to force - require password confirmation
    const adminConfirm = prompt(
      '⚠️ FORCE START NEW SESSION\n\n' +
      'This will archive the current session with unresolved issues.\n\n' +
      'Type "FORCE START" (without quotes) to confirm:'
    );
    
    if (adminConfirm !== 'FORCE START') {
      window.showToast?.('Session start cancelled', 'info');
      return;
    }
    
    // Log forced start with issues
    await db.collection('session_issues').add({
      sessionStartedAt: firebase.firestore.FieldValue.serverTimestamp(),
      forcedBy: auth.currentUser.uid,
      pendingPromotions: pendingCount,
      pupilsInTerminalClass: pupilsInTerminalClass,
      issues: issues,
      type: 'forced_session_start'
    });
    
  } else {
    // No issues - normal confirmation
    const confirmation = confirm(
      '⚠️ START NEW ACADEMIC SESSION?\n\n' +
      'This will:\n' +
      '• Archive the current session\n' +
      '• Create a new session (next year)\n' +
      '• Reset current term to "First Term"\n' +
      '• Open promotion period for teachers\n\n' +
      'Continue?'
    );
    
    if (!confirmation) return;
    
    // Double confirmation
    const doubleCheck = prompt(
      'Type "START NEW SESSION" (without quotes) to confirm:'
    );
    
    if (doubleCheck !== 'START NEW SESSION') {
      window.showToast?.('Action cancelled', 'info');
      return;
    }
  }
  
  // Proceed with session start
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
  const container = document.getElementById('hierarchy-container');
  
  if (!container) {
    console.error('❌ hierarchy-container element not found in DOM');
    return;
  }
  
  console.log('📋 Loading class hierarchy UI...');
  
  try {
    // FIRST: Get all classes from the "classes" collection
    const classesSnapshot = await db.collection('classes').orderBy('name').get();
    
    if (classesSnapshot.empty) {
      console.warn('⚠️ No classes found in classes collection');
      renderEmptyHierarchyUI();
      return;
    }
    
    console.log(`✓ Found ${classesSnapshot.size} classes in database`);
    
    // Get all classes as objects
    const allClasses = [];
    classesSnapshot.forEach(doc => {
      allClasses.push({
        id: doc.id,
        name: doc.data().name || 'Unnamed Class'
      });
    });
    
    // Get saved hierarchy order from settings
    const hierarchyDoc = await db.collection('settings').doc('classHierarchy').get();
    
    let orderedClasses = [];
    
    if (hierarchyDoc.exists && hierarchyDoc.data().orderedClassIds) {
      const savedOrder = hierarchyDoc.data().orderedClassIds;
      console.log(`✓ Found saved order with ${savedOrder.length} classes`);
      
      // Sort classes according to saved order
      savedOrder.forEach(classId => {
        const found = allClasses.find(c => c.id === classId);
        if (found) {
          orderedClasses.push(found);
        }
      });
      
      // Add any NEW classes that aren't in the saved order yet (append to end)
      allClasses.forEach(cls => {
        if (!savedOrder.includes(cls.id)) {
          orderedClasses.push(cls);
          console.log(`➕ Adding new class "${cls.name}" to hierarchy`);
        }
      });
    } else {
      // No saved order - use alphabetical order from classes
      console.log('ℹ️ No saved order found, using alphabetical order');
      orderedClasses = allClasses.sort((a, b) => a.name.localeCompare(b.name));
    }
    
    console.log(`✓ Rendering ${orderedClasses.length} classes in hierarchy UI`);
    renderHierarchyUI(orderedClasses);
    
  } catch (error) {
    console.error('❌ Error loading class hierarchy UI:', error);
    if (container) {
      container.innerHTML = `
        <div style="padding:var(--space-lg); text-align:center; color:var(--color-danger);">
          <p><strong>Error Loading Classes</strong></p>
          <p>${error.message}</p>
          <button class="btn btn-primary" onclick="window.refreshHierarchyUI()">
            🔄 Retry
          </button>
        </div>
      `;
    }
    window.showToast?.('Failed to load class hierarchy', 'danger');
  }
}

function renderEmptyHierarchyUI() {
  const container = document.getElementById('hierarchy-container');
  if (!container) return;
  
  console.log('📭 Rendering empty hierarchy UI');
  
  container.innerHTML = `
    <div style="text-align:center; padding:var(--space-2xl); background:var(--color-gray-100); border-radius:var(--radius-md);">
      <h3 style="color:var(--color-gray-600); margin-bottom:var(--space-md);">📚 No Classes Created Yet</h3>
      <p style="color:var(--color-gray-600); margin-bottom:var(--space-lg);">
        You need to create classes first in the <strong>"Classes"</strong> section above, then return here to arrange them in progression order.
      </p>
      <button class="btn btn-primary" onclick="window.showSection('classes')">
        ➕ Go to Classes Section
      </button>
    </div>
  `;
}

function renderHierarchyUI(orderedClasses) {
  const container = document.getElementById('hierarchy-container');
  if (!container) {
    console.error('❌ hierarchy-container element not found in DOM');
    return;
  }
  
  if (!Array.isArray(orderedClasses) || orderedClasses.length === 0) {
    console.warn('⚠️ No classes provided to renderHierarchyUI');
    renderEmptyHierarchyUI();
    return;
  }
  
  console.log(`🎨 Rendering ${orderedClasses.length} classes in UI`);
  
  container.innerHTML = `
    <div class="hierarchy-instructions">
      <p><strong>📋 Class Progression Order (${orderedClasses.length} classes found)</strong></p>
      <p>Drag classes to rearrange the order from lowest to highest level. The <strong>last class</strong> is the terminal/graduation class.</p>
      <p style="color:var(--color-gray-600); font-size:var(--text-sm); margin-top:var(--space-sm);">
        💡 <strong>Tip:</strong> To add/remove classes, go to the "Classes" section above, then click "🔄 Refresh from Classes" below.
      </p>
    </div>
    
    <div id="sortable-class-list" class="sortable-list"></div>
    
    <div style="margin-top:var(--space-lg); display:flex; gap:var(--space-md); flex-wrap:wrap;">
      <button class="btn btn-primary" onclick="window.saveHierarchyOrder()">
        💾 Save Progression Order
      </button>
      <button class="btn btn-secondary" onclick="window.refreshHierarchyUI()">
        🔄 Refresh from Classes
      </button>
    </div>
    
    <div style="margin-top:var(--space-lg); padding:var(--space-md); background:var(--color-info-light); border-radius:var(--radius-sm);">
      <p style="margin:0; color:var(--color-info-dark); font-size:var(--text-sm);">
        ℹ️ <strong>Currently showing ${orderedClasses.length} class(es)</strong> from your Classes section.
        If you added new classes, click "🔄 Refresh from Classes" to see them here.
      </p>
    </div>
  `;
  
  const listContainer = document.getElementById('sortable-class-list');
  
  if (!listContainer) {
    console.error('❌ sortable-class-list not found after innerHTML update');
    return;
  }

orderedClasses.forEach((cls, index) => {
  const itemDiv = document.createElement('div');
  itemDiv.className = 'hierarchy-item draggable';
  itemDiv.draggable = true;
  itemDiv.dataset.classId = cls.id;
  itemDiv.dataset.index = index;
  
  const isTerminal = index === orderedClasses.length - 1;
  
  itemDiv.innerHTML = `
    <span class="drag-handle">☰</span>
    <span class="hierarchy-number">${index + 1}</span>
    <span class="class-name">${cls.name}</span>
    ${isTerminal ? '<span class="terminal-badge">🎓 Terminal/Graduation Class</span>' : ''}
  `;
  
  // NO INDIVIDUAL EVENT LISTENERS - using delegation instead!
  listContainer.appendChild(itemDiv);
});

// CRITICAL FIX: Use event delegation on parent container
// Add this AFTER the forEach loop, BEFORE the console.log

// Remove old delegation if exists
if (listContainer.dataset.delegationActive === 'true') {
  console.log('⚠️ Event delegation already active, skipping');
} else {
  // Add single set of event listeners to container
  listContainer.addEventListener('dragstart', function(e) {
    if (e.target.classList.contains('hierarchy-item')) {
      handleDragStart.call(e.target, e);
    }
  });
  
  listContainer.addEventListener('dragover', function(e) {
    const item = e.target.closest('.hierarchy-item');
    if (item) {
      handleDragOver.call(item, e);
    }
  });
  
  listContainer.addEventListener('drop', function(e) {
    const item = e.target.closest('.hierarchy-item');
    if (item) {
      handleDrop.call(item, e);
    }
  });
  
  listContainer.addEventListener('dragend', function(e) {
    if (e.target.classList.contains('hierarchy-item')) {
      handleDragEnd.call(e.target, e);
    }
  });
  
  listContainer.dataset.delegationActive = 'true';
  console.log('✓ Event delegation set up for class hierarchy');
}

console.log(`✓ Successfully rendered ${orderedClasses.length} classes in hierarchy UI`);

// Drag and drop handlers - FIXED
let draggedElement = null;

function handleDragStart(e) {
  draggedElement = this;
  this.classList.add('dragging');
  this.style.opacity = '0.4';
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/html', this.innerHTML);
}

function handleDragOver(e) {
  if (e.preventDefault) {
    e.preventDefault();
  }
  e.dataTransfer.dropEffect = 'move';
  
  // Visual feedback
  const afterElement = getDragAfterElement(this.parentElement, e.clientY);
  const draggable = document.querySelector('.dragging');
  
  if (afterElement == null) {
    this.parentElement.appendChild(draggable);
  } else {
    this.parentElement.insertBefore(draggable, afterElement);
  }
  
  return false;
}

function handleDrop(e) {
  if (e.stopPropagation) {
    e.stopPropagation();
  }
  
  if (draggedElement !== this) {
    // Get all items
    const allItems = Array.from(document.querySelectorAll('.hierarchy-item'));
    const draggedIndex = allItems.indexOf(draggedElement);
    const targetIndex = allItems.indexOf(this);
    
    // Reorder in DOM
    if (draggedIndex < targetIndex) {
      this.parentNode.insertBefore(draggedElement, this.nextSibling);
    } else {
      this.parentNode.insertBefore(draggedElement, this);
    }
    
    // Update numbers and terminal badge
    updateHierarchyNumbers();
  }
  
  return false;
}

function handleDragEnd(e) {
  this.style.opacity = '1';
  this.classList.remove('dragging');
  
  document.querySelectorAll('.hierarchy-item').forEach(item => {
    item.classList.remove('over');
  });
}

function getDragAfterElement(container, y) {
  const draggableElements = [...container.querySelectorAll('.hierarchy-item:not(.dragging)')];
  
  return draggableElements.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    
    if (offset < 0 && offset > closest.offset) {
      return { offset: offset, element: child };
    } else {
      return closest;
    }
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function updateHierarchyNumbers() {
  const items = document.querySelectorAll('.hierarchy-item');
  items.forEach((item, index) => {
    const numberSpan = item.querySelector('.hierarchy-number');
    if (numberSpan) numberSpan.textContent = index + 1;
    
    // Update terminal badge
    const terminalBadge = item.querySelector('.terminal-badge');
    if (index === items.length - 1) {
      if (!terminalBadge) {
        item.insertAdjacentHTML('beforeend', '<span class="terminal-badge">🎓 Terminal/Graduation Class</span>');
      }
    } else {
      if (terminalBadge) terminalBadge.remove();
    }
  });
}

async function saveHierarchyOrder() {
  const items = document.querySelectorAll('.hierarchy-item');
  
  if (items.length === 0) {
    window.showToast?.('No classes to save', 'warning');
    return;
  }
  
  const orderedClassIds = Array.from(items).map(item => item.dataset.classId);
  
  try {
    const result = await window.classHierarchy.saveClassHierarchy(orderedClassIds);
    
    if (result.success) {
      window.showToast?.('✓ Class progression order saved successfully!', 'success');
      await loadClassHierarchyUI(); // Reload to confirm
    } else {
      window.showToast?.('Failed to save progression order', 'danger');
    }
  } catch (error) {
    console.error('Error saving hierarchy order:', error);
    window.handleError(error, 'Failed to save progression order');
  }
}

async function refreshHierarchyUI() {
  console.log('🔄 Refreshing hierarchy from classes...');
  
  const btn = event?.target;
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="btn-loading">Refreshing...</span>';
  }
  
  try {
    // Re-initialize hierarchy from classes collection
    await window.classHierarchy.initializeClassHierarchy();
    
    // Reload the UI
    await loadClassHierarchyUI();
    
    window.showToast?.('✓ Refreshed from Classes section', 'success');
  } catch (error) {
    console.error('❌ Error refreshing hierarchy:', error);
    window.showToast?.('Failed to refresh hierarchy', 'danger');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '🔄 Refresh from Classes';
    }
  }
}
// Make functions globally available
window.saveHierarchyOrder = saveHierarchyOrder;
window.refreshHierarchyUI = refreshHierarchyUI;

/* ========================================
DELETE FUNCTIONS
======================================== */

/**
 * FIXED: Delete User with Audit Trail
 * Logs all delete operations for compliance
 */
async function deleteUser(collection, uid) {
  if (!confirm('Are you sure you want to delete this user? This cannot be undone.')) {
    return;
  }

  try {
    // Get user data before deletion for audit log
    const userDoc = await db.collection(collection).doc(uid).get();
    const userData = userDoc.exists ? userDoc.data() : {};
    
    // AUDIT: Log deletion
    await db.collection('audit_log').add({
      action: 'delete_user',
      collection: collection,
      documentId: uid,
      deletedData: {
        name: userData.name || 'Unknown',
        email: userData.email || 'Unknown',
        // Store only essential data for audit
        ...Object.keys(userData).reduce((acc, key) => {
          if (!['subjects', 'promotionHistory'].includes(key)) {
            acc[key] = userData[key];
          }
          return acc;
        }, {})
      },
      performedBy: auth.currentUser.uid,
      performedByEmail: auth.currentUser.email,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      userAgent: navigator.userAgent
    });

    // Delete user
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

/**
 * FIXED: Delete Item with Audit Trail
 * Logs all delete operations for compliance
 */
async function deleteItem(collectionName, docId) {
  if (!confirm('Are you sure you want to delete this item? This action cannot be undone.')) {
    return;
  }

  try {
    // Get item data before deletion for audit log
    const itemDoc = await db.collection(collectionName).doc(docId).get();
    const itemData = itemDoc.exists ? itemDoc.data() : {};
    
    // AUDIT: Log deletion
    await db.collection('audit_log').add({
      action: 'delete_item',
      collection: collectionName,
      documentId: docId,
      deletedData: itemData,
      performedBy: auth.currentUser.uid,
      performedByEmail: auth.currentUser.email,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      userAgent: navigator.userAgent
    });

    // Delete item
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
  
  // CRITICAL FIX: Proper batch size limit
  const BATCH_SIZE = 400; // Safe limit under Firestore's 500
  let currentBatch = db.batch();
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
        currentBatch = db.batch();
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
    const toClassDoc = await db.collection('classes').doc(data.toClass.id).get();
    if (toClassDoc.exists) {
      toClassDetails = toClassDoc.data();
    }
  }

  // Process promoted pupils
  console.log(`📝 Processing ${promotedPupils.length} promoted pupils...`);
  
  for (const pupilId of promotedPupils) {
    const pupilRef = db.collection('pupils').doc(pupilId);
    const pupilDoc = await pupilRef.get();
    
    if (!pupilDoc.exists) {
      console.warn(`⚠️ Pupil ${pupilId} not found, skipping`);
      continue;
    }
    
    const pupilData = pupilDoc.data();

    if (data.isTerminalClass) {
      // Move to alumni (2 operations)
      const alumniRef = db.collection('alumni').doc(pupilId);
      
      currentBatch.set(alumniRef, {
        ...pupilData,
        graduationSession: data.fromSession,
        graduationDate: firebase.firestore.FieldValue.serverTimestamp(),
        finalClass: data.fromClass.name,
        promotionDate: firebase.firestore.FieldValue.serverTimestamp()
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
        promotionHistory: firebase.firestore.FieldValue.arrayUnion({
          session: data.fromSession,
          fromClass: data.fromClass.name,
          toClass: data.toClass.name,
          promoted: true,
          date: firebase.firestore.FieldValue.serverTimestamp()
        }),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
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
    const pupilRef = db.collection('pupils').doc(pupilId);
    const pupilDoc = await pupilRef.get();
    
    if (!pupilDoc.exists) {
      console.warn(`⚠️ Pupil ${pupilId} not found, skipping`);
      continue;
    }
    
    currentBatch.update(pupilRef, {
      promotionHistory: firebase.firestore.FieldValue.arrayUnion({
        session: data.fromSession,
        fromClass: data.fromClass.name,
        toClass: data.fromClass.name,
        promoted: false,
        reason: 'Held back by admin/teacher decision',
        date: firebase.firestore.FieldValue.serverTimestamp()
      }),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
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
    const pupilRef = db.collection('pupils').doc(override.pupilId);
    const pupilDoc = await pupilRef.get();
    
    if (!pupilDoc.exists) {
      console.warn(`⚠️ Pupil ${override.pupilId} not found, skipping`);
      continue;
    }
    
    const pupilData = pupilDoc.data();

    if (override.classId === 'alumni') {
      // Move to alumni (2 operations)
      const alumniRef = db.collection('alumni').doc(override.pupilId);
      
      currentBatch.set(alumniRef, {
        ...pupilData,
        graduationSession: data.fromSession,
        graduationDate: firebase.firestore.FieldValue.serverTimestamp(),
        finalClass: data.fromClass.name,
        manualOverride: true,
        promotionDate: firebase.firestore.FieldValue.serverTimestamp()
      });
      operationCount++;
      totalOperations++;
      
      currentBatch.delete(pupilRef);
      operationCount++;
      totalOperations++;
      
    } else {
      // Move to specific class
      const overrideClassDoc = await db.collection('classes').doc(override.classId).get();
      
      if (overrideClassDoc.exists) {
        const overrideClassData = overrideClassDoc.data();
        
        currentBatch.update(pupilRef, {
          'class.id': override.classId,
          'class.name': overrideClassData.name,
          subjects: overrideClassData.subjects || [],
          promotionHistory: firebase.firestore.FieldValue.arrayUnion({
            session: data.fromSession,
            fromClass: data.fromClass.name,
            toClass: overrideClassData.name,
            promoted: true,
            manualOverride: true,
            date: firebase.firestore.FieldValue.serverTimestamp()
          }),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
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
  currentBatch.update(promotionDoc.ref, {
    status: 'completed',
    approvedBy: auth.currentUser.uid,
    approvedAt: firebase.firestore.FieldValue.serverTimestamp(),
    executedAt: firebase.firestore.FieldValue.serverTimestamp()
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

/**
 * Approve result submission
 */
async function approveResultSubmission(submissionId) {
    if (!confirm('Approve these results and lock them?\n\nTeacher will not be able to edit unless you unlock.')) {
        return;
    }
    
    try {
        const result = await window.resultLocking.approveResults(submissionId, auth.currentUser.uid);
        
        if (result.success) {
            window.showToast?.(result.message, 'success');
            await loadResultApprovals();
        } else {
            window.showToast?.(result.message || result.error, 'danger');
        }
        
    } catch (error) {
        console.error('Error approving results:', error);
        window.handleError(error, 'Failed to approve results');
    }
}

/**
 * Reject result submission
 */
async function rejectResultSubmission(submissionId) {
    const reason = prompt('Reason for rejection (teacher will see this):');
    
    if (!reason) {
        window.showToast?.('Rejection cancelled - reason required', 'info');
        return;
    }
    
    try {
        const result = await window.resultLocking.rejectResults(submissionId, auth.currentUser.uid, reason);
        
        if (result.success) {
            window.showToast?.(result.message, 'success');
            await loadResultApprovals();
        } else {
            window.showToast?.(result.message || result.error, 'danger');
        }
        
    } catch (error) {
        console.error('Error rejecting results:', error);
        window.handleError(error, 'Failed to reject results');
    }
}

// Make functions globally available
window.loadResultApprovals = loadResultApprovals;
window.approveResultSubmission = approveResultSubmission;
window.rejectResultSubmission = rejectResultSubmission;

/**
 * FIXED: Initialize Sidebar Navigation
 * Handles all sidebar link clicks and group toggles
 */
function initializeSidebarNavigation() {
  console.log('🔗 Initializing sidebar navigation...');
  
  // ============================================
  // SECTION NAVIGATION LINKS
  // ============================================
  const sectionLinks = document.querySelectorAll('.sidebar-link[data-section]');
  
  sectionLinks.forEach(link => {
    // Remove any existing listeners by cloning
    const newLink = link.cloneNode(true);
    link.parentNode.replaceChild(newLink, link);
    
    // Add single click handler
    newLink.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      
      const sectionId = this.dataset.section;
      
      if (!sectionId) {
        console.warn('No section ID found for link:', this);
        return;
      }
      
      console.log(`📍 Navigating to section: ${sectionId}`);
      
      // Update active state
      document.querySelectorAll('.sidebar-link').forEach(l => {
        l.classList.remove('active');
      });
      this.classList.add('active');
      
      // Show the section
      if (typeof window.showSection === 'function') {
        window.showSection(sectionId);
      } else {
        console.error('showSection function not found!');
      }
    });
  });
  
  console.log(`✓ Registered ${sectionLinks.length} section navigation links`);
  
  // ============================================
  // GROUP TOGGLES
  // ============================================
  const groupToggles = document.querySelectorAll('.sidebar-group-toggle-modern');
  
  groupToggles.forEach(toggle => {
    // Remove any existing listeners by cloning
    const newToggle = toggle.cloneNode(true);
    toggle.parentNode.replaceChild(newToggle, toggle);
    
    // Add single click handler
    newToggle.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      
      const content = this.nextElementSibling;
      const isExpanded = this.getAttribute('aria-expanded') === 'true';
      
      // Toggle state
      this.setAttribute('aria-expanded', !isExpanded);
      content.classList.toggle('active');
      
      // Rotate chevron icon
      const chevron = this.querySelector('.toggle-icon');
      if (chevron) {
        chevron.style.transform = isExpanded ? 'rotate(0deg)' : 'rotate(180deg)';
      }
      
      console.log(`🔽 Toggled group: ${this.dataset.group} (expanded: ${!isExpanded})`);
    });
  });
  
  console.log(`✓ Registered ${groupToggles.length} group toggle buttons`);
  
  // ============================================
  // LOGOUT BUTTON
  // ============================================
  const logoutBtn = document.getElementById('admin-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', function(e) {
      e.preventDefault();
      console.log('🚪 Logout clicked');
      if (typeof window.logout === 'function') {
        window.logout();
      } else {
        console.error('logout function not found!');
      }
    });
    console.log('✓ Logout button registered');
  }
  
  console.log('✅ Sidebar navigation initialization complete');
}

// Make function globally available
window.initializeSidebarNavigation = initializeSidebarNavigation;

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

// Export hierarchy functions globally
window.loadClassHierarchyUI = loadClassHierarchyUI;
window.refreshHierarchyUI = refreshHierarchyUI;
window.renderEmptyHierarchyUI = renderEmptyHierarchyUI;
window.renderHierarchyUI = renderHierarchyUI;
window.showSection = showSection;

/* ========================================
   DATA MIGRATION: BACKFILL SESSION INFO
======================================== */

/**
 * FIXED: Session Data Migration with Date-Based Validation
 * Only migrates results that belong to current session based on dates
 */
async function backfillSessionData() {
  const btn = document.getElementById('backfill-btn');
  const statusDiv = document.getElementById('migration-status');
  const statusText = statusDiv?.querySelector('p');
  
  // Get current session information FIRST
  let settings;
  let currentSession;
  let sessionStartDate;
  let sessionEndDate;
  
  try {
    const settingsDoc = await db.collection('settings').doc('current').get();
    
    if (!settingsDoc.exists) {
      throw new Error('Settings not found. Please configure school settings first.');
    }
    
    settings = settingsDoc.data();
    currentSession = settings.session || 'Unknown';
    
    // CRITICAL: Get session date boundaries
    if (settings.currentSession?.startDate && settings.currentSession?.endDate) {
      sessionStartDate = settings.currentSession.startDate.toDate();
      sessionEndDate = settings.currentSession.endDate.toDate();
    } else {
      throw new Error('Session dates not configured. Please set session start and end dates in School Settings.');
    }
    
  } catch (error) {
    if (statusText) {
      statusText.innerHTML = `❌ <strong>Error:</strong> ${error.message}`;
    }
    if (statusDiv) {
      statusDiv.style.background = '#f8d7da';
      statusDiv.style.border = '1px solid #dc3545';
      statusDiv.style.display = 'block';
    }
    window.showToast?.(error.message, 'danger', 10000);
    return;
  }
  
  // ENHANCED CONFIRMATION with date information
  const confirmation = confirm(
    '⚠️ DATA MIGRATION CONFIRMATION\n\n' +
    `Current Session: ${currentSession}\n` +
    `Session Period: ${sessionStartDate.toLocaleDateString('en-GB')} to ${sessionEndDate.toLocaleDateString('en-GB')}\n\n` +
    'This migration will:\n' +
    '✓ Only assign current session to results created within session dates\n' +
    '✓ Flag results outside date range for manual review\n' +
    '✓ NOT modify existing session-labeled results\n' +
    '✓ Create a detailed migration report\n\n' +
    'Continue with migration?'
  );
  
  if (!confirmation) return;
  
  // Disable button and show status
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="btn-loading">Analyzing data...</span>';
  }
  
  if (statusDiv) {
    statusDiv.style.display = 'block';
    statusDiv.style.background = '#fff3cd';
    statusDiv.style.border = '1px solid #ffc107';
  }
  
  if (statusText) {
    statusText.innerHTML = `🔄 <strong>Analyzing results...</strong><br>Session: ${currentSession}`;
  }
  
  try {
    // Query results WITHOUT session field
    const resultsSnap = await db.collection('results')
      .where('session', '==', null)
      .get();
    
    if (resultsSnap.empty) {
      if (statusText) {
        statusText.innerHTML = '✓ <strong>No results need migration.</strong><br>All results already have session data.';
      }
      if (statusDiv) {
        statusDiv.style.background = '#d4edda';
        statusDiv.style.border = '1px solid #28a745';
      }
      
      window.showToast?.('✓ All results already have session data', 'success');
      
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '🔄 Migrate Existing Results';
      }
      
      return;
    }
    
    const totalResults = resultsSnap.size;
    
    if (statusText) {
      statusText.innerHTML = `🔄 <strong>Found ${totalResults} result(s) without session data</strong><br>Validating dates...`;
    }
    
    // CRITICAL: Categorize results by date
    const withinSession = [];
    const beforeSession = [];
    const afterSession = [];
    const noCreatedDate = [];
    
    resultsSnap.forEach(doc => {
      const data = doc.data();
      
      // Check if result has createdAt timestamp
      if (data.createdAt) {
        const resultDate = data.createdAt.toDate();
        
        if (resultDate >= sessionStartDate && resultDate <= sessionEndDate) {
          withinSession.push({ id: doc.id, data: data, date: resultDate });
        } else if (resultDate < sessionStartDate) {
          beforeSession.push({ id: doc.id, data: data, date: resultDate });
        } else {
          afterSession.push({ id: doc.id, data: data, date: resultDate });
        }
      } else {
        noCreatedDate.push({ id: doc.id, data: data });
      }
    });
    
    // Show categorization summary
    const summaryMessage = 
      `📊 <strong>Migration Analysis:</strong><br>` +
      `• ${withinSession.length} results within current session dates (will be migrated)<br>` +
      `• ${beforeSession.length} results before session start (flagged for review)<br>` +
      `• ${afterSession.length} results after session end (flagged for review)<br>` +
      `• ${noCreatedDate.length} results without creation date (flagged for review)`;
    
    if (statusText) {
      statusText.innerHTML = summaryMessage;
    }
    
    // Ask admin to proceed
    const proceedWithMigration = confirm(
      `Migration Analysis Complete:\n\n` +
      `${withinSession.length} results will be assigned to current session\n` +
      `${beforeSession.length + afterSession.length + noCreatedDate.length} results need manual review\n\n` +
      `Proceed with automatic migration?`
    );
    
    if (!proceedWithMigration) {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '🔄 Migrate Existing Results';
      }
      window.showToast?.('Migration cancelled', 'info');
      return;
    }
    
    // Process migration in batches
    const BATCH_SIZE = 450;
    let processed = 0;
    let batch = db.batch();
    let batchCount = 0;
    
    // Migrate results within session dates
    for (const result of withinSession) {
      const term = result.data.term || 'Unknown Term';
      const sessionTerm = `${currentSession}_${term}`;
      
      batch.update(db.collection('results').doc(result.id), {
        session: currentSession,
        sessionStartYear: settings.currentSession.startYear,
        sessionEndYear: settings.currentSession.endYear,
        sessionTerm: sessionTerm,
        migrated: true,
        migratedAt: firebase.firestore.FieldValue.serverTimestamp(),
        migrationMethod: 'date_validated'
      });
      
      batchCount++;
      processed++;
      
      if (batchCount >= BATCH_SIZE) {
        if (statusText) {
          statusText.innerHTML = `🔄 <strong>Migrating...</strong><br>Processed ${processed} of ${withinSession.length} results`;
        }
        
        await batch.commit();
        batch = db.batch();
        batchCount = 0;
        
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    // Commit remaining operations
    if (batchCount > 0) {
      await batch.commit();
    }
    
    // Flag problematic results for manual review
    const flaggedResults = [...beforeSession, ...afterSession, ...noCreatedDate];
    
    if (flaggedResults.length > 0) {
      const flagBatch = db.batch();
      let flagCount = 0;
      
      for (const result of flaggedResults) {
        let flagReason = '';
        
        if (beforeSession.includes(result)) {
          flagReason = `Created before current session (${result.date.toLocaleDateString('en-GB')})`;
        } else if (afterSession.includes(result)) {
          flagReason = `Created after current session (${result.date.toLocaleDateString('en-GB')})`;
        } else {
          flagReason = 'No creation date found';
        }
        
        flagBatch.update(db.collection('results').doc(result.id), {
          needsManualReview: true,
          reviewReason: flagReason,
          flaggedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        flagCount++;
        
        if (flagCount >= BATCH_SIZE) {
          await flagBatch.commit();
          flagCount = 0;
        }
      }
      
      if (flagCount > 0) {
        await flagBatch.commit();
      }
    }
    
    // Success message
    if (statusText) {
      statusText.innerHTML = 
        `✓ <strong>Migration completed successfully!</strong><br>` +
        `• ${withinSession.length} results assigned to ${currentSession}<br>` +
        `• ${flaggedResults.length} results flagged for manual review<br><br>` +
        `<em>Flagged results are marked with "needsManualReview: true"</em>`;
    }
    
    if (statusDiv) {
      statusDiv.style.background = '#d4edda';
      statusDiv.style.border = '1px solid #28a745';
    }
    
    window.showToast?.(
      `✓ Migration completed!\n${withinSession.length} migrated, ${flaggedResults.length} need review`,
      'success',
      8000
    );
    
  } catch (error) {
    console.error('❌ Migration error:', error);
    
    if (statusText) {
      statusText.innerHTML = `❌ <strong>Migration failed:</strong><br>${error.message}`;
    }
    
    if (statusDiv) {
      statusDiv.style.background = '#f8d7da';
      statusDiv.style.border = '1px solid #dc3545';
    }
    
    window.showToast?.(
      `Migration failed: ${error.message}`,
      'danger',
      10000
    );
    
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '🔄 Migrate Existing Results';
    }
  }
}

// Make function globally available
window.backfillSessionData = backfillSessionData;

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
    document.getElementById('filter-class').disabled = true;
    document.getElementById('filter-pupil').disabled = true;
    document.getElementById('view-results-btn').disabled = true;
    
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
    const sessionsSnap = await db.collection('sessions')
      .orderBy('startYear', 'desc')
      .get();
    
    sessionsSnap.forEach(doc => {
      const data = doc.data();
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
  const classSelect = document.getElementById('filter-class');
  const pupilSelect = document.getElementById('filter-pupil');
  
  if (!sessionSelect || !classSelect || !pupilSelect) return;
  
  const selectedSession = sessionSelect.value;
  
  // Reset dependent filters
  classSelect.innerHTML = '<option value="">-- Select Class --</option>';
  classSelect.disabled = true;
  pupilSelect.innerHTML = '<option value="">-- Select Pupil --</option>';
  pupilSelect.disabled = true;
  document.getElementById('view-results-btn').disabled = true;
  
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
    const resultsSnap = await db.collection('results')
      .where('session', '==', actualSession)
      .get();
    
    // Extract unique classes from results
    const classesWithResults = new Set();
    resultsSnap.forEach(doc => {
      const data = doc.data();
      if (data.pupilId) {
        classesWithResults.add(data.pupilId); // We'll use this to find classes
      }
    });
    
    // Get all classes
    const classesSnap = await db.collection('classes')
      .orderBy('name')
      .get();
    
    const classOptions = [];
    
    for (const classDoc of classesSnap.docs) {
      const className = classDoc.data().name;
      const classId = classDoc.id;
      
      // Check if this class has pupils with results in this session
      const pupilsInClassSnap = await db.collection('pupils')
        .where('class.id', '==', classId)
        .limit(1)
        .get();
      
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
    
    console.log(`✓ Loaded ${classOptions.length} classes for session: ${actualSession}`);
    
  } catch (error) {
    console.error('Error loading classes:', error);
    window.showToast?.('Failed to load classes', 'danger');
  }
}

async function loadFilteredPupils() {
  const classSelect = document.getElementById('filter-class');
  const pupilSelect = document.getElementById('filter-pupil');
  
  if (!classSelect || !pupilSelect) return;
  
  const selectedClass = classSelect.value;
  
  // Reset pupil filter
  pupilSelect.innerHTML = '<option value="">-- Select Pupil --</option>';
  pupilSelect.disabled = true;
  document.getElementById('view-results-btn').disabled = true;
  
  if (!selectedClass || !currentResultsSession) return;
  
  try {
    // Get all pupils in this class
    const pupilsSnap = await db.collection('pupils')
      .where('class.id', '==', selectedClass)
      .get();
    
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
      const resultsSnap = await db.collection('results')
        .where('pupilId', '==', pupilId)
        .where('session', '==', currentResultsSession)
        .limit(1)
        .get();
      
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
    document.getElementById('view-results-btn').disabled = false;
    
    console.log(`✓ Loaded ${pupilsWithResults.length} pupils with results`);
    
  } catch (error) {
    console.error('Error loading pupils:', error);
    window.showToast?.('Failed to load pupils', 'danger');
  }
}

/**
 * FIX #2: LOAD PUPIL RESULTS WITH BETTER ERROR HANDLING
 * Copy this ENTIRE function to replace loadPupilResults() in admin.js
 */

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
        const pupilDoc = await db.collection('pupils').doc(selectedPupil).get();
        
        if (!pupilDoc.exists) {
            throw new Error('Pupil not found');
        }
        
        const pupilData = pupilDoc.data();
        
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
            const resultsSnap = await db.collection('results')
                .where('pupilId', '==', selectedPupil)
                .where('session', '==', currentResultsSession)
                .get();
            
            console.log(`✓ Primary query returned ${resultsSnap.size} results`);
            
            if (!resultsSnap.empty) {
                resultsSnap.forEach(doc => {
                    const data = doc.data();
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
            
            const allResultsSnap = await db.collection('results')
                .where('pupilId', '==', selectedPupil)
                .get();
            
            console.log(`📊 Fallback query found ${allResultsSnap.size} total results for pupil`);
            
            // Filter manually by session
            allResultsSnap.forEach(doc => {
                const data = doc.data();
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

/**
 * Helper function to render results display
 */
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

function getRemark(score) {
    if (score >= 75) return 'Excellent';
    if (score >= 70) return 'Very Good';
    if (score >= 65) return 'Good';
    if (score >= 60) return 'Credit';
    if (score >= 50) return 'Credit';
    if (score >= 45) return 'Pass';
    return 'Fail';
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
    const pupilDoc = await db.collection('pupils').doc(currentResultsPupilId).get();
    const pupilData = pupilDoc.data();
    
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
    const allResultsSnap = await db.collection('results')
      .where('pupilId', '==', currentResultsPupilId)
      .get();
    
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
    
    allResultsSnap.forEach(doc => {
      const data = doc.data();
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
            ${index === 0 ? '<div style="position: absolute; top: var(--space-sm); right: var(--space-sm); background: rgba(255,255,255,0.3); padding: 4px 12px; border-radius: 20px; font-size: 0.75rem; font-weight: 700;">LATEST</div>' : ''}
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
          <div style="display: flex; align-items: center; gap: var(--space-md); padding: var(--space-md); background: white; border-radius: var(--radius-md); margin-bottom: var(--space-sm); border-left: 4px solid ${progress.improving ? '#10b981' : '#ef4444'};">
            <div style="flex: 1;">
              <div style="font-weight: 600; margin-bottom: var(--space-xs);">
                ${progress.from} → ${progress.to}
              </div>
              <div style="font-size: var(--text-sm); color: var(--color-gray-600);">
                ${progress.improving ? 'Improvement' : 'Decline'}: ${progress.change > 0 ? '+' : ''}${progress.change.toFixed(1)} points (${progress.percentChange > 0 ? '+' : ''}${progress.percentChange}%)
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
                <div style="width: 100%; height: ${height}%; background: ${isHighest ? 'linear-gradient(to top, #00B2FF, #0090CC)' : 'linear-gradient(to top, #cbd5e1, #94a3b8)'}; border-radius: var(--radius-sm); min-height: 20px; transition: all 0.3s ease;"></div>
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

// Make all UI functions globally available
window.showTeacherForm = showTeacherForm;
window.cancelTeacherForm = cancelTeacherForm;
window.showPupilForm = showPupilForm;
window.cancelPupilForm = cancelPupilForm;
window.editPupil = editPupil;
window.showClassForm = showClassForm;
window.addClass = addClass;
window.showSubjectForm = showSubjectForm;
window.addSubject = addSubject;
window.deleteUser = deleteUser;
window.deleteItem = deleteItem;
window.assignTeacherToClass = assignTeacherToClass;
window.unassignTeacher = unassignTeacher;
window.showAnnounceForm = showAnnounceForm;
window.addAnnouncement = addAnnouncement;
window.loadCurrentSettings = loadCurrentSettings;
window.loadAlumni = loadAlumni;
window.loadViewResultsSection = loadViewResultsSection;

/* =====================================================
   FINAL INITIALIZATION - GUARANTEED EXECUTION
===================================================== */

/**
 * CRITICAL: Final initialization check
 * This ensures everything is set up correctly
 */
function finalizeAdminPortal() {
  console.log('🚀 Finalizing admin portal initialization...');
  
  // Ensure sidebar is set up
  if (!window.adminSidebarInitialized) {
    console.warn('⚠️ Sidebar not initialized, running setup now...');
    setupSidebarNavigation();
  }
  
  // Ensure dashboard is visible
  const dashboard = document.getElementById('dashboard');
  if (dashboard && dashboard.style.display === 'none') {
    console.log('📊 Showing dashboard...');
    showSection('dashboard');
  }
  
  // Log success
  console.log('✅ Admin portal fully initialized and ready');
  console.log('═══════════════════════════════════════');
  console.log('Available sections:', 
    Array.from(document.querySelectorAll('.sidebar-link[data-section]'))
      .map(l => l.dataset.section)
      .join(', ')
  );
  console.log('═══════════════════════════════════════');
}

// Run finalization after a delay to ensure DOM is ready
setTimeout(finalizeAdminPortal, 500);

// Also run on window load as backup
window.addEventListener('load', () => {
  if (!window.adminSidebarInitialized) {
    console.warn('⚠️ Window load: Sidebar still not initialized');
    setupSidebarNavigation();
    showSection('dashboard');
  }
});

/* =====================================================
   DIAGNOSTIC & DEBUG UTILITIES
===================================================== */

/**
 * Run diagnostics on admin sidebar
 */
function runSidebarDiagnostics() {
  console.log('🔍 ADMIN SIDEBAR DIAGNOSTICS');
  console.log('═══════════════════════════════════════');
  
  const sidebar = document.getElementById('admin-sidebar');
  console.log('Sidebar element:', sidebar ? '✓ Found' : '❌ Missing');
  
  const hamburger = document.getElementById('hamburger');
  console.log('Hamburger element:', hamburger ? '✓ Found' : '❌ Missing');
  
  const links = document.querySelectorAll('.sidebar-link[data-section]');
  console.log(`Navigation links: ${links.length} found`);
  
  if (links.length > 0) {
    console.log('Link sections:');
    links.forEach((link, i) => {
      const section = link.dataset.section;
      const exists = document.getElementById(section);
      console.log(`  ${i + 1}. ${section}: ${exists ? '✓' : '❌ section missing'}`);
    });
  }
  
  const toggles = document.querySelectorAll('.sidebar-group-toggle-modern');
  console.log(`Group toggles: ${toggles.length} found`);
  
  console.log('Functions available:');
  console.log('  showSection:', typeof window.showSection);
  console.log('  setupSidebarNavigation:', typeof setupSidebarNavigation);
  
  console.log('Initialization status:');
  console.log('  adminSidebarInitialized:', window.adminSidebarInitialized || false);
  
  console.log('═══════════════════════════════════════');
}

// Make diagnostic function globally available
window.runSidebarDiagnostics = runSidebarDiagnostics;

console.log('✓ Admin portal v6.3.0 - SIDEBAR NAVIGATION COMPLETELY FIXED');
console.log('💡 Run window.runSidebarDiagnostics() in console to check sidebar status');

/* ======================================== 
   SESSION VALIDATION ON LOAD
======================================== */

window.addEventListener('load', async () => {
  try {
    const settings = await window.getCurrentSettings();
    
    // Check if session is configured
    if (!settings.session || !settings.currentSession) {
      window.showToast?.(
        '⚠️ School settings incomplete. Please configure session details in School Settings.',
        'warning',
        8000
      );
      console.warn('Session not configured properly:', settings);
    } else {
      console.log('✓ Session validated:', settings.session);
    }
  } catch (error) {
    console.error('Error validating session:', error);
  }
});

console.log('✓ Session validation loaded');

/* ========================================
   FINANCIAL MANAGEMENT SECTION
======================================== */

/**
 * Load Fee Management Section
 */
async function loadFeeManagementSection() {
  console.log('Loading fee management section...');
  
  try {
    // Populate class selector
    await populateFeeClassSelector();
    
    // Load current session/term
    const settings = await window.getCurrentSettings();
    document.getElementById('fee-session-display').textContent = settings.session;
    document.getElementById('fee-term-display').textContent = settings.term;
    
    // Load fee structures
    await loadFeeStructures();
    
  } catch (error) {
    console.error('Error loading fee management:', error);
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
    const snapshot = await db.collection('classes').orderBy('name').get();
    
    select.innerHTML = '<option value="">-- Select Class --</option>';
    
    snapshot.forEach(doc => {
      const data = doc.data();
      const opt = document.createElement('option');
      opt.value = doc.id;
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
    
    const snapshot = await db.collection('fee_structures')
      .where('session', '==', session)
      .where('term', '==', term)
      .get();
    
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
    
    snapshot.forEach(doc => {
      const data = doc.data();
      
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
          <button class="btn-small btn-danger" onclick="deleteFeeStructure('${doc.id}', '${data.className}')">
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
    
    const result = await window.finance.configureFeeStructure(
      classId,
      className,
      settings.session,
      settings.term,
      feeBreakdown
    );
    
    window.showToast?.(
      `✓ Fee structure saved for ${className}\nTotal: ₦${result.total.toLocaleString()}`,
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
    window.handleError(error, 'Failed to save fee structure');
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
    await db.collection('fee_structures').doc(docId).delete();
    
    window.showToast?.(`✓ Fee structure for ${className} deleted`, 'success');
    
    await loadFeeStructures();
    
  } catch (error) {
    console.error('Error deleting fee structure:', error);
    window.handleError(error, 'Failed to delete fee structure');
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
    document.getElementById('payment-session-display').textContent = settings.session;
    document.getElementById('payment-term-display').textContent = settings.term;
    
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
    const snapshot = await db.collection('classes').orderBy('name').get();
    
    select.innerHTML = '<option value="">-- Select Class --</option>';
    
    snapshot.forEach(doc => {
      const data = doc.data();
      const opt = document.createElement('option');
      opt.value = doc.id;
      opt.textContent = data.name;
      select.appendChild(opt);
    });
    
  } catch (error) {
    console.error('Error populating class filter:', error);
  }
}

/**
 * Load pupils for payment recording
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
    const snapshot = await db.collection('pupils')
      .where('class.id', '==', classId)
      .orderBy('name')
      .get();
    
    if (snapshot.empty) {
      pupilSelect.innerHTML = '<option value="">No pupils in this class</option>';
      document.getElementById('payment-form-container').style.display = 'none';
      return;
    }
    
    snapshot.forEach(doc => {
      const data = doc.data();
      const opt = document.createElement('option');
      opt.value = doc.id;
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
 * Load pupil payment status
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
  const className = pupilSelect.selectedOptions[0]?.dataset.className;  // ← KEEP THIS ONE
  
  const formContainer = document.getElementById('payment-form-container');
  const statusContainer = document.getElementById('payment-status-display');
  
  formContainer.style.display = 'block';
  statusContainer.innerHTML = '<div style="text-align:center; padding:var(--space-md);"><div class="spinner"></div></div>';
  
  try {
    const settings = await window.getCurrentSettings();
    const session = settings.session;
    const term = settings.term;
    
    // Get fee structure
    const feeStructure = await window.finance.getFeeStructure(classId, session, term);
    
    if (!feeStructure) {
      statusContainer.innerHTML = `
        <div class="alert alert-warning">
          <strong>⚠️ Fee Structure Not Configured</strong>
          <p>No fee structure has been set for ${className} in ${term}. Please configure it in the Fee Management section first.</p>
        </div>
      `;
      document.getElementById('payment-input-section').style.display = 'none';
      return;
    }
    
    // Get payment summary
    const paymentSummary = await window.finance.getPupilPaymentSummary(pupilId, session, term);
    
    let amountDue = feeStructure.total;
    let totalPaid = 0;
    let balance = amountDue;
    let status = 'owing';
    
    if (paymentSummary) {
      totalPaid = paymentSummary.totalPaid || 0;
      balance = paymentSummary.balance || 0;
      status = paymentSummary.status || 'owing';
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
    
    // Load payment history
    await loadPaymentHistory(pupilId, session, term);
    
  } catch (error) {
    console.error('Error loading payment status:', error);
    statusContainer.innerHTML = '<p style="text-align:center; color:var(--color-danger);">Error loading payment status</p>';
  }
}

// Record a new payment
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

        const result = await window.finance.recordPayment(
            pupilId,
            pupilName,
            classId,
            className,
            settings.session,
            settings.term,
            {
                amountPaid,
                paymentMethod,
                notes
            }
        );

        window.showToast?.(
            `✓ Payment Recorded Successfully!\n\n` +
            `Receipt #${result.receiptNo}\n` +
            `Amount: ₦${result.amountPaid.toLocaleString()}\n` +
            `New Balance: ₦${result.newBalance.toLocaleString()}`,
            'success',
            8000
        );

        // Clear form
if (amountInput) {
    amountInput.value = '';
}
const notesInput = document.getElementById('payment-notes');
if (notesInput) {
    notesInput.value = '';
}

        // Refresh data
        await loadPupilPaymentStatus();

        // Ask to print receipt
        if (confirm('Payment recorded successfully!\n\nWould you like to print the receipt now?')) {
            printReceipt(result.receiptNo);
        }

    } catch (error) {
        console.error('Error recording payment:', error);
        window.handleError?.(error, 'Failed to record payment');
    } finally {
        if (recordBtn) {
            recordBtn.disabled = false;
            recordBtn.innerHTML = '💰 Record Payment';
        }
    }
}

// Load payment history for selected pupil
async function loadPaymentHistory(pupilId, session, term) {
    const container = document.getElementById('payment-history-list');
    if (!container) return;

    container.innerHTML = '<div style="text-align:center; padding:var(--space-md);"><div class="spinner"></div></div>';

    try {
        const transactions = await window.finance.getPupilPaymentHistory(pupilId, session, term);

        if (!transactions?.length) {
            container.innerHTML = '<p style="text-align:center; color:var(--color-gray-600); padding:var(--space-lg);">No payment history yet</p>';
            return;
        }

        container.innerHTML = transactions.map(txn => {
            const date = txn.paymentDate 
                ? new Date(txn.paymentDate).toLocaleDateString('en-GB')
                : 'N/A';

            return `
                <div class="payment-item">
                    <div>
                        <strong>₦${Number(txn.amountPaid).toLocaleString()}</strong>
                        <div class="payment-meta">
                            ${date} • ${txn.paymentMethod || 'Cash'} • Receipt #${txn.receiptNo}
                        </div>
                    </div>
                    <button class="btn-small btn-secondary" 
                            onclick="printReceipt('${txn.receiptNo}')">
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

// Load list of pupils with outstanding fees
async function loadOutstandingFeesReport() {
    const container = document.getElementById('outstanding-fees-table');
    if (!container) return;

    const tbody = container.querySelector('tbody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="6" class="table-loading">Loading outstanding fees...</td></tr>';

    try {
        const settings = await window.getCurrentSettings();
        const outstanding = await window.finance.getOutstandingFeesReport(null, settings.session, settings.term);

        if (!outstanding?.length) {
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

        outstanding.forEach(payment => {
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
if (outstandingCountEl) outstandingCountEl.textContent = outstanding.length;

const outstandingTotalEl = document.getElementById('outstanding-total');
if (outstandingTotalEl) outstandingTotalEl.textContent = `₦${totalOutstanding.toLocaleString()}`;

    } catch (error) {
        console.error('Error loading outstanding fees:', error);
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align:center; color:var(--color-danger);">
                    Error loading outstanding fees
                </td>
            </tr>`;
    }
}

// Load financial summary dashboard
async function loadFinancialReports() {
    try {
        const settings = await window.getCurrentSettings();
        const summary = await window.finance.getFinancialSummary(settings.session, settings.term);

        if (!summary) {
            window.showToast?.('Failed to load financial summary', 'danger');
            return;
        }

        // ─── Fixed assignments ────────────────────────────────────────
        const expectedEl  = document.getElementById('report-total-expected');
        const collectedEl = document.getElementById('report-total-collected');
        const outstandingEl = document.getElementById('report-total-outstanding');
        const rateEl      = document.getElementById('report-collection-rate');

        if (expectedEl) {
            expectedEl.textContent = `₦${Number(summary.totalExpected || 0).toLocaleString()}`;
        }
        if (collectedEl) {
            collectedEl.textContent = `₦${Number(summary.totalCollected || 0).toLocaleString()}`;
        }
        if (outstandingEl) {
            outstandingEl.textContent = `₦${Number(summary.totalOutstanding || 0).toLocaleString()}`;
        }
        if (rateEl) {
            rateEl.textContent = `${Number(summary.collectionRate || 0)}%`;
        }

    
        // Safe assignment using explicit null check
const paidFullEl = document.getElementById('report-paid-full');
if (paidFullEl) {
    paidFullEl.textContent = summary?.paidInFull ?? 0;
}

const partialEl = document.getElementById('report-partial');
if (partialEl) {
    partialEl.textContent = summary?.partialPayments ?? 0;
}

const owingEl = document.getElementById('report-owing');
if (owingEl) {
    owingEl.textContent = summary?.noPayment ?? 0;
}
        // Session / term display
const sessionEl = document.getElementById('report-session-display');
if (sessionEl) {
    sessionEl.textContent = settings?.session || '—';
}

const termEl = document.getElementById('report-term-display');
if (termEl) {
    termEl.textContent = settings?.term || '—';
}

    } catch (error) {
        console.error('Error loading financial reports:', error);
        window.showToast?.('Failed to load financial reports', 'danger');
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
        const paymentsSnap = await db.collection('payments')
            .where('session', '==', session)
            .where('term', '==', term)
            .get();
        
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
    
    paymentsSnap.forEach(doc => {
        const data = doc.data();
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
    
    paymentsSnap.forEach(doc => {
        const data = doc.data();
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

// Make functions globally available
window.exportFinancialReport = exportFinancialReport;

// Export to global scope
window.recordPayment = recordPayment;
window.loadPaymentHistory = loadPaymentHistory;
window.printReceipt = printReceipt;
window.loadOutstandingFeesReport = loadOutstandingFeesReport;
window.loadFinancialReports = loadFinancialReports;
window.loadFeeManagementSection = loadFeeManagementSection;
window.saveFeeStructure = saveFeeStructure;
window.deleteFeeStructure = deleteFeeStructure;
window.loadPaymentRecordingSection = loadPaymentRecordingSection;
window.loadPupilsForPayment = loadPupilsForPayment;
window.loadPupilPaymentStatus = loadPupilPaymentStatus;

console.log('✓ Financial management functions loaded');

/* ========================================
   INITIALIZE LUCIDE ICONS
======================================== */

document.addEventListener('DOMContentLoaded', () => {
    // Initialize Lucide icons
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
        console.log('✓ Lucide icons initialized');
    }
});

/**
 * BULK OPERATIONS FUNCTIONS
 */

function toggleAllPupils(masterCheckbox) {
  const checkboxes = document.querySelectorAll('.pupil-checkbox');
  checkboxes.forEach(checkbox => {
    checkbox.checked = masterCheckbox.checked;
  });
  updateBulkActionButtons();
}

function updateBulkActionButtons() {
  const checkboxes = document.querySelectorAll('.pupil-checkbox:checked');
  const count = checkboxes.length;
  
  const countDisplay = document.getElementById('selected-count');
  const actionSelect = document.getElementById('bulk-action-select');
  const applyBtn = document.getElementById('apply-bulk-action-btn');
  const selectAllCheckbox = document.getElementById('select-all-pupils');
  
  if (countDisplay) {
    countDisplay.textContent = `${count} selected`;
    countDisplay.style.fontWeight = count > 0 ? '600' : 'normal';
    countDisplay.style.color = count > 0 ? 'var(--color-primary)' : 'var(--color-gray-600)';
  }
  
  if (actionSelect) actionSelect.disabled = count === 0;
  if (applyBtn) applyBtn.disabled = count === 0;
  
  // Update "Select All" checkbox state
  const allCheckboxes = document.querySelectorAll('.pupil-checkbox');
  if (selectAllCheckbox && allCheckboxes.length > 0) {
    selectAllCheckbox.checked = count === allCheckboxes.length;
    selectAllCheckbox.indeterminate = count > 0 && count < allCheckboxes.length;
  }
}

async function applyBulkAction() {
  const action = document.getElementById('bulk-action-select')?.value;
  const checkboxes = document.querySelectorAll('.pupil-checkbox:checked');
  
  if (!action || checkboxes.length === 0) {
    window.showToast?.('Please select an action and at least one pupil', 'warning');
    return;
  }
  
  const selectedPupilIds = Array.from(checkboxes).map(cb => cb.dataset.pupilId);
  
  switch(action) {
    case 'reassign-class':
      await bulkReassignClass(selectedPupilIds);
      break;
    case 'delete':
      await bulkDeletePupils(selectedPupilIds);
      break;
    default:
      window.showToast?.('Invalid action selected', 'warning');
  }
}

async function bulkReassignClass(pupilIds) {
  // Show class selection modal
  const classes = await db.collection('classes').orderBy('name').get();
  
  if (classes.empty) {
    window.showToast?.('No classes available', 'warning');
    return;
  }
  
  let classOptions = '<option value="">-- Select New Class --</option>';
  classes.forEach(doc => {
    const data = doc.data();
    classOptions += `<option value="${doc.id}">${data.name}</option>`;
  });
  
  // Create modal with unique ID
  const modalId = 'bulk-reassign-modal-' + Date.now();
  const modal = document.createElement('div');
  modal.id = modalId;
  modal.style.cssText = 'position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.5); display:flex; align-items:center; justify-content:center; z-index:10000;';
  modal.innerHTML = `
    <div style="background:white; padding:var(--space-2xl); border-radius:var(--radius-lg); max-width:500px; width:90%;">
      <h3 style="margin-top:0;">Reassign ${pupilIds.length} Pupil(s) to New Class</h3>
      <p style="color:var(--color-gray-600); margin-bottom:var(--space-lg);">
        Select the new class for the selected pupils. Their subjects and teacher will be updated automatically.
      </p>
      <select id="bulk-class-select-${modalId}" style="width:100%; padding:var(--space-sm); margin-bottom:var(--space-lg);">
        ${classOptions}
      </select>
      <div style="display:flex; gap:var(--space-md); justify-content:flex-end;">
        <button class="btn btn-secondary" data-action="cancel">Cancel</button>
        <button class="btn btn-primary" data-action="confirm">
          Reassign All
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // CRITICAL FIX: Cleanup function
  const cleanup = () => {
    modal.remove();
    document.removeEventListener('keydown', escapeHandler);
    console.log('✓ Modal cleaned up');
  };
  
  // Escape key handler
  const escapeHandler = (e) => {
    if (e.key === 'Escape') {
      cleanup();
    }
  };
  document.addEventListener('keydown', escapeHandler);
  
  // Button handlers
  modal.querySelector('[data-action="cancel"]').onclick = cleanup;
  
  modal.querySelector('[data-action="confirm"]').onclick = async function() {
    const selectId = `bulk-class-select-${modalId}`;
    const newClassId = document.getElementById(selectId)?.value;
    
    if (!newClassId) {
      window.showToast?.('Please select a class', 'warning');
      return;
    }
    
    this.disabled = true;
    this.innerHTML = '<span class="btn-loading">Reassigning...</span>';
    
    try {
      // Get new class details
      const classDoc = await db.collection('classes').doc(newClassId).get();
      if (!classDoc.exists) {
        throw new Error('Class not found');
      }
      
      const classData = classDoc.data();
      
      // Get teacher info
      let teacherId = classData.teacherId || '';
      let teacherName = classData.teacherName || '';
      
      if (teacherId && !teacherName) {
        const teacherDoc = await db.collection('teachers').doc(teacherId).get();
        if (teacherDoc.exists) {
          teacherName = teacherDoc.data().name || '';
        }
      }
      
      // Batch update pupils (with proper chunking)
      const BATCH_SIZE = 450;
      let batch = db.batch();
      let count = 0;
      
      for (const pupilId of pupilIds) {
        const pupilRef = db.collection('pupils').doc(pupilId);
        
        batch.update(pupilRef, {
          'class.id': newClassId,
          'class.name': classData.name,
          subjects: classData.subjects || [],
          'assignedTeacher.id': teacherId,
          'assignedTeacher.name': teacherName,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        count++;
        
        if (count >= BATCH_SIZE) {
          await batch.commit();
          batch = db.batch();
          count = 0;
        }
      }
      
      if (count > 0) {
        await batch.commit();
      }
      
      window.showToast?.(
        `✓ Successfully reassigned ${pupilIds.length} pupil(s) to ${classData.name}`,
        'success',
        5000
      );
      
      cleanup();
      await loadPupils();
      
    } catch (error) {
      console.error('Bulk reassign error:', error);
      window.handleError?.(error, 'Failed to reassign pupils');
      this.disabled = false;
      this.innerHTML = 'Reassign All';
    }
  };
}

async function executeBulkReassign(pupilIds, btn) {
  const newClassId = document.getElementById('bulk-class-select')?.value;
  
  if (!newClassId) {
    window.showToast?.('Please select a class', 'warning');
    return;
  }
  
  btn.disabled = true;
  btn.innerHTML = '<span class="btn-loading">Reassigning...</span>';
  
  try {
    // Get new class details
    const classDoc = await db.collection('classes').doc(newClassId).get();
    if (!classDoc.exists) {
      throw new Error('Class not found');
    }
    
    const classData = classDoc.data();
    
    // Get teacher info
    let teacherId = classData.teacherId || '';
    let teacherName = classData.teacherName || '';
    
    if (teacherId && !teacherName) {
      const teacherDoc = await db.collection('teachers').doc(teacherId).get();
      if (teacherDoc.exists) {
        teacherName = teacherDoc.data().name || '';
      }
    }
    
    // Batch update pupils
    const BATCH_SIZE = 450;
    let batch = db.batch();
    let count = 0;
    
    for (const pupilId of pupilIds) {
      const pupilRef = db.collection('pupils').doc(pupilId);
      
      batch.update(pupilRef, {
        'class.id': newClassId,
        'class.name': classData.name,
        subjects: classData.subjects || [],
        'assignedTeacher.id': teacherId,
        'assignedTeacher.name': teacherName,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      
      count++;
      
      if (count >= BATCH_SIZE) {
        await batch.commit();
        batch = db.batch();
        count = 0;
      }
    }
    
    if (count > 0) {
      await batch.commit();
    }
    
    window.showToast?.(
      `✓ Successfully reassigned ${pupilIds.length} pupil(s) to ${classData.name}`,
      'success',
      5000
    );
    
    // Close modal
    btn.closest('[style*="position"]').remove();
    
    // Reload pupils list
    await loadPupils();
    
  } catch (error) {
    console.error('Bulk reassign error:', error);
    window.handleError(error, 'Failed to reassign pupils');
  } finally {
    btn.disabled = false;
    btn.innerHTML = 'Reassign All';
  }
}

async function bulkDeletePupils(pupilIds) {
  const confirmation = confirm(
    `⚠️ DELETE ${pupilIds.length} PUPIL(S)?\n\n` +
    `This will permanently delete:\n` +
    `• ${pupilIds.length} pupil records\n` +
    `• ${pupilIds.length} user accounts\n` +
    `• All associated results, attendance, and remarks\n\n` +
    `This action CANNOT be undone!\n\n` +
    `Type "DELETE" below to confirm:`
  );
  
  if (!confirmation) return;
  
  const confirmText = prompt('Type DELETE to confirm:');
  if (confirmText !== 'DELETE') {
    window.showToast?.('Deletion cancelled', 'info');
    return;
  }
  
  try {
    // Delete in batches
    const BATCH_SIZE = 450;
    let batch = db.batch();
    let count = 0;
    
    for (const pupilId of pupilIds) {
      // Delete from pupils collection
      batch.delete(db.collection('pupils').doc(pupilId));
      
      // Delete from users collection
      batch.delete(db.collection('users').doc(pupilId));
      
      count += 2; // Two deletes per pupil
      
      if (count >= BATCH_SIZE) {
        await batch.commit();
        batch = db.batch();
        count = 0;
      }
    }
    
    if (count > 0) {
      await batch.commit();
    }
    
    window.showToast?.(
      `✓ Successfully deleted ${pupilIds.length} pupil(s)`,
      'success',
      5000
    );
    
    await loadPupils();
    await loadDashboardStats();
    
  } catch (error) {
    console.error('Bulk delete error:', error);
    window.handleError(error, 'Failed to delete pupils');
  }
}

// Make functions globally available
window.toggleAllPupils = toggleAllPupils;
window.updateBulkActionButtons = updateBulkActionButtons;
window.applyBulkAction = applyBulkAction;
window.executeBulkReassign = executeBulkReassign;

/**
 * AUDIT LOG VIEWER
 */
async function loadAuditLog() {
  const container = document.getElementById('audit-log-container');
  if (!container) return;
  
  container.innerHTML = '<div style="text-align:center; padding:var(--space-2xl);"><div class="spinner"></div><p>Loading audit log...</p></div>';
  
  try {
    const logsSnap = await db.collection('audit_log')
      .orderBy('timestamp', 'desc')
      .limit(100)
      .get();
    
    if (logsSnap.empty) {
      container.innerHTML = '<p style="text-align:center; color:var(--color-gray-600);">No audit logs yet</p>';
      return;
    }
    
    const logs = [];
    logsSnap.forEach(doc => {
      logs.push({ id: doc.id, ...doc.data() });
    });
    
    container.innerHTML = `
      <div style="margin-bottom:var(--space-lg);">
        <input type="text" id="audit-search" placeholder="Search by email, action, or collection..." 
               style="width:100%; padding:var(--space-sm);" onkeyup="filterAuditLog()">
      </div>
      <div class="table-container">
        <table class="responsive-table" id="audit-log-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Action</th>
              <th>Collection</th>
              <th>Performed By</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
      <button class="btn btn-secondary" onclick="downloadAuditLog()" style="margin-top:var(--space-lg);">
        📥 Download Full Audit Log (CSV)
      </button>
    `;
    
    paginateTable(logs, 'audit-log-table', 25, (log, tbody) => {
      const timestamp = log.timestamp ? 
        log.timestamp.toDate().toLocaleString('en-GB') : 
        'Unknown';
      
      const actionBadge = getActionBadge(log.action);
      
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td data-label="Timestamp">${timestamp}</td>
        <td data-label="Action">${actionBadge}</td>
        <td data-label="Collection">${log.collection || '-'}</td>
        <td data-label="Performed By">${log.performedByEmail || 'Unknown'}</td>
        <td data-label="Details">
          <button class="btn-small btn-secondary" onclick="viewAuditDetails('${log.id}')">
            View Details
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });
    
  } catch (error) {
    console.error('Error loading audit log:', error);
    container.innerHTML = '<p style="text-align:center; color:var(--color-danger);">Error loading audit log</p>';
  }
}

function getActionBadge(action) {
  const badges = {
    'delete_user': '<span style="background:#dc3545; color:white; padding:4px 8px; border-radius:4px; font-size:12px;">DELETE USER</span>',
    'delete_item': '<span style="background:#ff9800; color:white; padding:4px 8px; border-radius:4px; font-size:12px;">DELETE ITEM</span>',
    'create_user': '<span style="background:#28a745; color:white; padding:4px 8px; border-radius:4px; font-size:12px;">CREATE USER</span>',
    'update_settings': '<span style="background:#2196F3; color:white; padding:4px 8px; border-radius:4px; font-size:12px;">UPDATE SETTINGS</span>'
  };
  
  return badges[action] || `<span style="color:var(--color-gray-600);">${action}</span>`;
}

async function viewAuditDetails(logId) {
  try {
    const logDoc = await db.collection('audit_log').doc(logId).get();
    if (!logDoc.exists) {
      window.showToast?.('Audit log entry not found', 'danger');
      return;
    }
    
    const log = logDoc.data();
    
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.5); display:flex; align-items:center; justify-content:center; z-index:10000; overflow-y:auto; padding:var(--space-lg);';
    modal.innerHTML = `
      <div style="background:white; padding:var(--space-2xl); border-radius:var(--radius-lg); max-width:700px; width:90%; max-height:80vh; overflow-y:auto;">
        <h3 style="margin-top:0;">Audit Log Details</h3>
        
        <div style="margin-bottom:var(--space-md);">
          <strong>Action:</strong> ${log.action}
        </div>
        
        <div style="margin-bottom:var(--space-md);">
          <strong>Timestamp:</strong> ${log.timestamp ? log.timestamp.toDate().toLocaleString('en-GB') : 'Unknown'}
        </div>
        
        <div style="margin-bottom:var(--space-md);">
          <strong>Performed By:</strong> ${log.performedByEmail || 'Unknown'} (${log.performedBy || 'Unknown ID'})
        </div>
        
        <div style="margin-bottom:var(--space-md);">
          <strong>Collection:</strong> ${log.collection || 'N/A'}
        </div>
        
        <div style="margin-bottom:var(--space-md);">
          <strong>Document ID:</strong> ${log.documentId || 'N/A'}
        </div>
        
        ${log.deletedData ? `
          <div style="margin-bottom:var(--space-md);">
            <strong>Deleted Data:</strong>
            <pre style="background:#f5f5f5; padding:var(--space-md); border-radius:var(--radius-sm); overflow-x:auto; font-size:12px;">${JSON.stringify(log.deletedData, null, 2)}</pre>
          </div>
        ` : ''}
        
        <div style="margin-bottom:var(--space-md);">
          <strong>User Agent:</strong>
          <div style="font-size:12px; color:var(--color-gray-600);">${log.userAgent || 'Unknown'}</div>
        </div>
        
        <button class="btn btn-primary" onclick="this.closest('[style*=position]').remove()">Close</button>
      </div>
    `;
    
    document.body.appendChild(modal);
    
  } catch (error) {
    console.error('Error loading audit details:', error);
    window.showToast?.('Failed to load audit details', 'danger');
  }
}

async function downloadAuditLog() {
  try {
    const logsSnap = await db.collection('audit_log')
      .orderBy('timestamp', 'desc')
      .get();
    
    if (logsSnap.empty) {
      window.showToast?.('No audit logs to download', 'info');
      return;
    }
    
    // Create CSV
    let csv = 'Timestamp,Action,Collection,Document ID,Performed By,Email,User Agent\n';
    
    logsSnap.forEach(doc => {
      const log = doc.data();
      const timestamp = log.timestamp ? log.timestamp.toDate().toISOString() : '';
      
      csv += `"${timestamp}","${log.action}","${log.collection || ''}","${log.documentId || ''}","${log.performedBy || ''}","${log.performedByEmail || ''}","${(log.userAgent || '').replace(/"/g, '""')}"\n`;
    });
    
    // Download
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit_log_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    window.showToast?.('✓ Audit log downloaded', 'success');
    
  } catch (error) {
    console.error('Error downloading audit log:', error);
    window.showToast?.('Failed to download audit log', 'danger');
  }
}

function filterAuditLog() {
  const searchTerm = document.getElementById('audit-search')?.value.toLowerCase() || '';
  const rows = document.querySelectorAll('#audit-log-table tbody tr');
  
  rows.forEach(row => {
    const text = row.textContent.toLowerCase();
    row.style.display = text.includes(searchTerm) ? '' : 'none';
  });
}

// Make functions globally available
window.loadAuditLog = loadAuditLog;
window.viewAuditDetails = viewAuditDetails;
window.downloadAuditLog = downloadAuditLog;
window.filterAuditLog = filterAuditLog;

/**
 * Export all pupils data to CSV
 */
async function exportPupilsData() {
    try {
        window.showToast?.('Preparing pupils export...', 'info', 2000);

        const snap = await db.collection('pupils').get();

        if (snap.empty) {
            window.showToast?.('No pupils found to export', 'warning', 4000);
            return;
        }

        const headers = [
            'Name', 'Admission No', 'Class', 'Gender', 'Date of Birth',
            'Parent Name', 'Parent Email', 'Contact', 'Address', 'Email'
        ];

        const rows = snap.docs.map(doc => {
            const p = doc.data();
            return [
                p.name || '',
                p.admissionNo || '',
                p.class?.name || p.class || '-',
                p.gender || '',
                p.dob || '',
                p.parentName || '',
                p.parentEmail || '',
                p.contact || '',
                p.address || '',
                p.email || ''
            ];
        });

        const csv = [
            headers,
            ...rows
        ].map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
         .join('\n');

        downloadCSV(csv, `pupils_export_${new Date().toISOString().split('T')[0]}.csv`);

        window.showToast?.(`✓ Exported ${snap.size} pupil record(s)`, 'success');
    } catch (err) {
        console.error('Pupils export failed:', err);
        window.showToast?.('Export failed. Please try again.', 'danger');
    }
}

/**
 * Export results (filtered by term/session)
 */
async function exportResultsData() {
    try {
        const term = prompt('Enter term (First Term / Second Term / Third Term):')?.trim();
        if (!term) return;

        const session = prompt('Enter session (e.g. 2025/2026) or leave empty for all:')?.trim();

        window.showToast?.('Preparing results export...', 'info', 2000);

        let query = db.collection('results');
        if (term)   query = query.where('term', '==', term);
        if (session) query = query.where('session', '==', session);

        const snap = await query.get();

        if (snap.empty) {
            window.showToast?.('No results found for selected filters', 'warning');
            return;
        }

        const headers = ['Pupil ID', 'Term', 'Session', 'Subject', 'CA Score', 'Exam Score', 'Total'];

        const rows = snap.docs.map(doc => {
            const r = doc.data();
            const total = (Number(r.caScore) || 0) + (Number(r.examScore) || 0);
            return [
                r.pupilId || '',
                r.term || '',
                r.session || '',
                r.subject || '',
                r.caScore ?? 0,
                r.examScore ?? 0,
                total
            ];
        });

        const csv = [
            headers,
            ...rows
        ].map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
         .join('\n');

        const filename = `results_${term.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
        downloadCSV(csv, filename);

        window.showToast?.(`✓ Exported ${snap.size} result record(s)`, 'success');
    } catch (err) {
        console.error('Results export failed:', err);
        window.showToast?.('Export failed. Please try again.', 'danger');
    }
}

// ─── Helper ──────────────────────────────────────────────────────────────────
function downloadCSV(content, filename) {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
}

// Expose globally
window.exportPupilsData = exportPupilsData;
window.exportResultsData = exportResultsData;

console.log('✓ Data export functions loaded');
/* =====================================================
   DEBUG CONSOLE - SHOWS WHAT'S HAPPENING
===================================================== */

window.adminDebug = {
  // Check if everything is loaded
  checkStatus() {
    console.log('═══════════════════════════════════════');
    console.log('🔍 ADMIN PORTAL DEBUG STATUS');
    console.log('═══════════════════════════════════════');
    
    // Firebase
    console.log('Firebase:', typeof firebase !== 'undefined' ? '✓' : '❌');
    console.log('  db:', typeof db !== 'undefined' ? '✓' : '❌');
    console.log('  auth:', typeof auth !== 'undefined' ? '✓' : '❌');
    console.log('  currentUser:', auth?.currentUser ? `✓ ${auth.currentUser.email}` : '❌');
    
    // DOM Elements
    console.log('\nDOM Elements:');
    console.log('  sidebar:', document.getElementById('admin-sidebar') ? '✓' : '❌');
    console.log('  hamburger:', document.getElementById('hamburger') ? '✓' : '❌');
    console.log('  dashboard:', document.getElementById('dashboard') ? '✓' : '❌');
    
    // Navigation
    const links = document.querySelectorAll('.sidebar-link[data-section]');
    console.log(`  nav links: ${links.length} found`);
    
    const toggles = document.querySelectorAll('.sidebar-group-toggle-modern');
    console.log(`  group toggles: ${toggles.length} found`);
    
    // Functions
    console.log('\nFunctions:');
    console.log('  showSection:', typeof window.showSection);
    console.log('  loadDashboardStats:', typeof loadDashboardStats);
    console.log('  loadTeachers:', typeof loadTeachers);
    
    // Initialization
    console.log('\nInitialization:');
    console.log('  sidebarInitialized:', window.sidebarInitialized || false);
    
    console.log('═══════════════════════════════════════');
  },
  
  // Manually show a section
  showSection(sectionId) {
    console.log(`\n🔧 Manual section load: ${sectionId}`);
    if (typeof window.showSection === 'function') {
      window.showSection(sectionId);
    } else {
      console.error('❌ showSection function not available!');
    }
  },
  
  // Test dashboard loading
  testDashboard() {
    console.log('\n🧪 Testing dashboard load...');
    if (typeof loadDashboardStats === 'function') {
      loadDashboardStats();
    } else {
      console.error('❌ loadDashboardStats function not available!');
    }
  }
};
}
console.log('✓ Admin portal v6.3.0 loaded successfully');
console.log('All critical fixes applied • Ready for use');

/* =====================================================
   HAMBURGER DEBUG TESTER - TEMPORARY
===================================================== */

// Run this in console: testHamburger()
window.testHamburger = function() {
  console.log('🧪 HAMBURGER DIAGNOSTIC TEST');
  console.log('═══════════════════════════════════════');
  
  const hamburger = document.getElementById('hamburger');
  const sidebar = document.getElementById('admin-sidebar');
  
  console.log('Hamburger element:', hamburger);
  console.log('Hamburger HTML:', hamburger?.outerHTML?.substring(0, 100));
  console.log('Sidebar element:', sidebar);
  console.log('Sidebar classes:', sidebar?.className);
  
  if (hamburger) {
    console.log('🔍 Checking event listeners...');
    console.log('Dataset initialized:', hamburger.dataset.initialized);
    
    // Manual toggle test
    console.log('🧪 Testing manual toggle...');
    const isActive = sidebar.classList.toggle('active');
    hamburger.classList.toggle('active', isActive);
    console.log('Toggle result:', isActive ? 'OPENED' : 'CLOSED');
    
    // Toggle back
    setTimeout(() => {
      sidebar.classList.toggle('active');
      hamburger.classList.toggle('active');
      console.log('✓ Toggle test complete');
    }, 1000);
  } else {
    console.error('❌ Hamburger element not found!');
  }
  
  console.log('═══════════════════════════════════════');
};

console.log('💡 Run testHamburger() in console to diagnose');