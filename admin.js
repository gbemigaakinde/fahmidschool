/**
 * FAHMID NURSERY & PRIMARY SCHOOL
 * Admin Portal JavaScript - COMPLETE FIXED VERSION
 * 
 * @version 7.0.0 - INITIALIZATION COMPLETELY FIXED
 * @date 2026-01-12
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
   CRITICAL FIX: WAIT FOR BOTH AUTH AND DOM
===================================================== */

// Global state variables
let authUser = null;
let domReady = false;

// Only initialize when BOTH are ready
function tryInitialize() {
  if (authUser && domReady) {
    console.log('✅ Both auth and DOM ready - initializing admin portal');
    initializeAdminPortal();
  } else {
    console.log('⏳ Waiting... authUser:', !!authUser, 'domReady:', domReady);
  }
}

// Step 1: Check authentication
window.checkRole('admin')
  .then(async user => {
    console.log('✓ Admin authenticated:', user.email);
    authUser = user;
    tryInitialize();
  })
  .catch(err => {
    console.error('❌ Authentication failed:', err);
  });

// Step 2: Wait for DOM
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    console.log('✓ DOM ready via event');
    domReady = true;
    tryInitialize();
  });
} else {
  console.log('✓ DOM already ready');
  domReady = true;
  tryInitialize();
}

// Logout handler
document.addEventListener('DOMContentLoaded', () => {
  const logoutBtn = document.getElementById('admin-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      window.logout();
    });
  }
});

/* =====================================================
   MAIN INITIALIZATION FUNCTION
===================================================== */

async function initializeAdminPortal() {
  console.log('🚀 Starting admin portal initialization...');
  
  // CRITICAL: Verify DOM elements exist
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
    }, 200);
    return;
  }
  
  console.log('✓ All critical elements found');
  
  // Step 1: Setup sidebar navigation
  setupSidebarNavigation();
  
  // Step 2: Setup hamburger menu
  setupHamburgerMenu();
  
  // Step 3: Initialize class hierarchy
  try {
    await window.classHierarchy.initializeClassHierarchy();
    console.log('✓ Class hierarchy initialized');
  } catch (error) {
    console.error('⚠️ Class hierarchy init failed:', error);
  }
  
  // Step 4: Show dashboard
  showSection('dashboard');
  
  // Step 5: Setup date input max date
  const dobInput = document.getElementById('pupil-dob');
  if (dobInput) {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const maxDate = `${year}-${month}-${day}`;
    dobInput.setAttribute('max', maxDate);
  }
  
  console.log('✅ Admin portal initialized successfully');
}

/* =====================================================
   SIDEBAR NAVIGATION SETUP
===================================================== */

function setupSidebarNavigation() {
  console.log('🔧 Setting up sidebar navigation...');
  
  // Prevent double initialization
  if (window.adminSidebarInitialized) {
    console.log('⚠️ Sidebar already initialized, skipping');
    return;
  }
  
  // Verify sidebar exists
  const sidebar = document.getElementById('admin-sidebar');
  if (!sidebar) {
    console.error('❌ Sidebar element not found!');
    return;
  }
  
  // Get all navigation links
  const links = document.querySelectorAll('.sidebar-link[data-section]');
  console.log(`📋 Found ${links.length} navigation links`);
  
  if (links.length === 0) {
    console.error('❌ No navigation links found!');
    return;
  }
  
  // Setup each link
  links.forEach((link) => {
    const sectionId = link.dataset.section;
    
    if (!sectionId) {
      console.warn('⚠️ Link missing data-section:', link);
      return;
    }
    
    // Remove existing listeners by cloning
    const newLink = link.cloneNode(true);
    link.parentNode.replaceChild(newLink, link);
    
    // Add click handler
    newLink.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      
      console.log(`🖱️ Navigation clicked: ${sectionId}`);
      showSection(sectionId);
    });
  });
  
  // Setup group toggles
  const toggles = document.querySelectorAll('.sidebar-group-toggle-modern');
  console.log(`🔽 Found ${toggles.length} group toggles`);
  
  toggles.forEach((toggle) => {
    const newToggle = toggle.cloneNode(true);
    toggle.parentNode.replaceChild(newToggle, toggle);
    
    newToggle.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      
      const content = this.nextElementSibling;
      if (!content) return;
      
      const isExpanded = this.getAttribute('aria-expanded') === 'true';
      this.setAttribute('aria-expanded', !isExpanded);
      content.classList.toggle('active');
      
      const icon = this.querySelector('.toggle-icon');
      if (icon) {
        icon.style.transform = isExpanded ? 'rotate(0deg)' : 'rotate(180deg)';
      }
    });
  });
  
  window.adminSidebarInitialized = true;
  console.log('✅ Sidebar navigation initialized');
}

/* =====================================================
   HAMBURGER MENU SETUP
===================================================== */

function setupHamburgerMenu() {
  const hamburger = document.getElementById('hamburger');
  const sidebar = document.getElementById('admin-sidebar');
  
  if (!hamburger || !sidebar) {
    console.warn('Hamburger or sidebar not found');
    return;
  }
  
  // Clone to remove existing listeners
  const newHamburger = hamburger.cloneNode(true);
  hamburger.parentNode.replaceChild(newHamburger, hamburger);
  
  // Add click handler
  newHamburger.addEventListener('click', (e) => {
    e.stopPropagation();
    const isActive = sidebar.classList.toggle('active');
    newHamburger.classList.toggle('active', isActive);
    newHamburger.setAttribute('aria-expanded', isActive);
    document.body.style.overflow = isActive ? 'hidden' : '';
  });
  
  // Close on outside click
  document.addEventListener('click', (e) => {
    if (sidebar.classList.contains('active') && 
        !sidebar.contains(e.target) && 
        !newHamburger.contains(e.target)) {
      sidebar.classList.remove('active');
      newHamburger.classList.remove('active');
      newHamburger.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    }
  });
  
  console.log('✓ Hamburger menu initialized');
}

/* =====================================================
   SHOW SECTION FUNCTION
===================================================== */

function showSection(sectionId) {
  if (!sectionId) {
    console.error('showSection called with no sectionId');
    return;
  }
  
  console.log(`📄 Showing section: ${sectionId}`);
  
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
      if (toggle && toggle.classList.contains('sidebar-group-toggle-modern')) {
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
  if (sidebar && sidebar.classList.contains('active')) {
    sidebar.classList.remove('active');
    if (hamburger) {
      hamburger.classList.remove('active');
      hamburger.setAttribute('aria-expanded', 'false');
    }
    document.body.style.overflow = '';
  }
}

// Make globally available
window.showSection = showSection;

/* =====================================================
   LOAD SECTION DATA
===================================================== */

function loadSectionData(sectionId) {
  console.log(`📊 Loading data for: ${sectionId}`);
  
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

/* =====================================================
   DASHBOARD STATS
===================================================== */

async function loadDashboardStats() {
  console.log('📊 Loading dashboard stats...');
  
  // Check if elements exist
  const teacherCount = document.getElementById('teacher-count');
  const pupilCount = document.getElementById('pupil-count');
  const classCount = document.getElementById('class-count');
  const announceCount = document.getElementById('announce-count');
  
  if (!teacherCount || !pupilCount || !classCount || !announceCount) {
    console.error('❌ Dashboard stat elements missing!');
    
    setTimeout(() => {
      console.log('⏳ Retrying dashboard stats...');
      loadDashboardStats();
    }, 200);
    return;
  }
  
  // Set loading state
  [teacherCount, pupilCount, classCount, announceCount].forEach(el => {
    el.innerHTML = '<div class="spinner" style="width:20px; height:20px;"></div>';
  });
  
  try {
    const teachersSnap = await db.collection('teachers').get();
    const pupilsSnap = await db.collection('pupils').get();
    const classesSnap = await db.collection('classes').get();
    const announcementsSnap = await db.collection('announcements').get();
    
    teacherCount.textContent = teachersSnap.size;
    pupilCount.textContent = pupilsSnap.size;
    classCount.textContent = classesSnap.size;
    announceCount.textContent = announcementsSnap.size;
    
    console.log('✅ Dashboard stats loaded');
    
    await checkSessionStatus();
    
  } catch (error) {
    console.error('❌ Error loading dashboard stats:', error);
    [teacherCount, pupilCount, classCount, announceCount].forEach(el => {
      el.textContent = '!';
    });
  }
}

/* =====================================================
   PLACEHOLDER FUNCTIONS (Add your full implementations here)
===================================================== */

async function loadTeachers() {
  console.log('Loading teachers...');
  // Add your full loadTeachers implementation
}

async function loadPupils() {
  console.log('Loading pupils...');
  // Add your full loadPupils implementation
}

async function loadClasses() {
  console.log('Loading classes...');
  // Add your full loadClasses implementation
}

async function loadSubjects() {
  console.log('Loading subjects...');
  // Add your full loadSubjects implementation
}

async function loadTeacherAssignments() {
  console.log('Loading teacher assignments...');
  // Add your full implementation
}

async function loadPromotionRequests() {
  console.log('Loading promotion requests...');
  // Add your full implementation
}

async function loadResultApprovals() {
  console.log('Loading result approvals...');
  // Add your full implementation
}

async function loadAdminAnnouncements() {
  console.log('Loading announcements...');
  // Add your full implementation
}

async function loadAlumni() {
  console.log('Loading alumni...');
  // Add your full implementation
}

async function loadAuditLog() {
  console.log('Loading audit log...');
  // Add your full implementation
}

async function loadViewResultsSection() {
  console.log('Loading view results...');
  // Add your full implementation
}

async function loadCurrentSettings() {
  console.log('Loading settings...');
  // Add your full implementation
}

async function loadClassHierarchyUI() {
  console.log('Loading class hierarchy UI...');
  // Add your full implementation
}

async function loadSessionHistory() {
  console.log('Loading session history...');
  // Add your full implementation
}

async function loadFeeManagementSection() {
  console.log('Loading fee management...');
  // Add your full implementation
}

async function loadPaymentRecordingSection() {
  console.log('Loading payment recording...');
  // Add your full implementation
}

async function loadOutstandingFeesReport() {
  console.log('Loading outstanding fees...');
  // Add your full implementation
}

async function loadFinancialReports() {
  console.log('Loading financial reports...');
  // Add your full implementation
}

async function checkSessionStatus() {
  console.log('Checking session status...');
  // Add your full implementation
}

/* =====================================================
   DIAGNOSTIC UTILITY
===================================================== */

window.runDiagnostics = function() {
  console.log('🔍 ADMIN PORTAL DIAGNOSTICS');
  console.log('════════════════════════════════════');
  console.log('Auth user:', !!authUser);
  console.log('DOM ready:', domReady);
  console.log('Sidebar initialized:', !!window.adminSidebarInitialized);
  console.log('Sidebar element:', !!document.getElementById('admin-sidebar'));
  console.log('Dashboard element:', !!document.getElementById('dashboard'));
  console.log('Nav links:', document.querySelectorAll('.sidebar-link[data-section]').length);
  console.log('════════════════════════════════════');
};

console.log('✅ Admin portal v7.0.0 loaded - Run window.runDiagnostics() to check status');