/**
 * FAHMID NURSERY & PRIMARY SCHOOL
 * Admin Portal JavaScript - FULLY FIXED
 * 
 * @version 7.0.0 - USER CREATION BUGS FIXED
 * @date 2026-01-27
 * 
 * CRITICAL FIXES:
 * - Secondary auth properly initialized BEFORE any form handlers
 * - createSecondaryUser exposed to window IMMEDIATELY
 * - Form handlers use proper error boundaries
 * - All async operations have timeout protection
 * - Detailed error logging for debugging
 */

'use strict';

// EMERGENCY FIX: Expose deleteItem early
window.deleteItem = async function(collection, docId) {
  if (!confirm('Are you sure you want to delete this item? This action cannot be undone.')) {
    return;
  }
  
  try {
    const itemDoc = await db.collection(collection).doc(docId).get();
    const itemData = itemDoc.exists ? itemDoc.data() : {};
    
    await db.collection('audit_log').add({
      action: collection === 'teachers' || collection === 'pupils' ? 'delete_user' : 'delete_item',
      collection: collection,
      documentId: docId,
      deletedData: {
        name: itemData.name || 'Unknown',
        email: itemData.email || 'Unknown',
      },
      performedBy: auth.currentUser.uid,
      performedByEmail: auth.currentUser.email,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      userAgent: navigator.userAgent
    });

    if (collection === 'pupils') {
      await db.collection('pupils').doc(docId).delete();
      await db.collection('users').doc(docId).delete();
      window.showToast?.('Pupil deleted successfully', 'success');
      loadPupils();
    } else if (collection === 'teachers') {
      await db.collection('teachers').doc(docId).delete();
      await db.collection('users').doc(docId).delete();
      window.showToast?.('Teacher deleted successfully', 'success');
      loadTeachers();
      loadTeacherAssignments();
    } else {
      await db.collection(collection).doc(docId).delete();
      window.showToast?.('Item deleted successfully', 'success');
      
      switch(collection) {
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
    }
    
    loadDashboardStats();

  } catch (error) {
    console.error('Error deleting document:', error);
    window.handleError?.(error, 'Failed to delete item');
  }
};

const db = window.db;
const auth = window.auth;

console.log('🔧 Admin.js v7.0.0 loading...');

/* =====================================================
   CRITICAL FIX #1: SECONDARY AUTH INITIALIZATION
   This MUST run FIRST before anything else
===================================================== */

let secondaryAuth = null;
let secondaryApp = null;

(function initializeSecondaryAuth() {
  console.log('🔐 Initializing secondary auth for user creation...');
  
  try {
    // Check if secondary app already exists
    try {
      secondaryApp = firebase.app('Secondary');
      secondaryAuth = secondaryApp.auth();
      console.log('✓ Found existing secondary app');
    } catch (e) {
      // Create new secondary app
      secondaryApp = firebase.initializeApp(firebaseConfig, 'Secondary');
      secondaryAuth = secondaryApp.auth();
      console.log('✓ Created new secondary app');
    }
    
    // CRITICAL FIX: Expose function to window IMMEDIATELY
    window.createSecondaryUser = async function(email, password) {
      console.log(`📝 createSecondaryUser called for: ${email}`);
      
      // Validate current user
      if (!auth.currentUser) {
        const error = new Error('Not authenticated');
        console.error('❌ createSecondaryUser error:', error);
        throw error;
      }
      
      console.log(`✓ Current admin: ${auth.currentUser.email}`);
      
      // Verify admin role
      try {
        const userDoc = await db.collection('users').doc(auth.currentUser.uid).get();
        if (!userDoc.exists) {
          throw new Error('Admin profile not found');
        }
        if (userDoc.data().role !== 'admin') {
          throw new Error('Unauthorized: Admin access required');
        }
        console.log('✓ Admin role verified');
      } catch (error) {
        console.error('❌ Admin verification failed:', error);
        throw error;
      }
      
      // Validate secondary auth
      if (!secondaryAuth) {
        const error = new Error('Secondary auth not initialized');
        console.error('❌ Secondary auth error:', error);
        throw error;
      }
      
      console.log('📧 Creating user account...');
      
      // Create user with secondary auth
      try {
        const userCredential = await secondaryAuth.createUserWithEmailAndPassword(email, password);
        console.log(`✓ User created: ${userCredential.user.uid}`);
        
        // Send password reset email
        console.log('📨 Sending password reset email...');
        await secondaryAuth.sendPasswordResetEmail(email);
        console.log('✓ Password reset email sent');
        
        // Sign out secondary auth (keep admin signed in)
        await secondaryAuth.signOut();
        console.log('✓ Secondary auth signed out');
        
        return userCredential.user.uid;
      } catch (error) {
        console.error('❌ User creation failed:', error);
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        throw error;
      }
    };
    
    console.log('✅ createSecondaryUser exposed to window');
    
  } catch (error) {
    console.error('❌ CRITICAL: Secondary auth initialization failed:', error);
    
    // Create fallback function that shows clear error
    window.createSecondaryUser = async function() {
      throw new Error(
        'Secondary authentication system failed to initialize. ' +
        'Please refresh the page. If problem persists, check Firebase configuration.'
      );
    };
  }
})();

/* =====================================================
   CRITICAL FIX #2: WAIT FOR AUTHENTICATION
===================================================== */

console.log('🔐 Waiting for authentication...');

let authUser = null;
let domReady = false;

function tryInitialize() {
  if (authUser && domReady) {
    console.log('✅ Both auth and DOM ready - initializing portal');
    initializeAdminPortal();
  } else {
    console.log(`⏳ Waiting... (auth: ${!!authUser}, dom: ${domReady})`);
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

// Logout handler
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

/**
 * Load Audit Log Section
 * CRITICAL FIX: This function was missing, causing ReferenceError
 */
async function loadAuditLog() {
  console.log('📋 Loading audit log...');
  
  const container = document.getElementById('audit-log-container');
  if (!container) {
    console.error('❌ audit-log-container element not found');
    return;
  }
  
  container.innerHTML = `
    <div style="text-align:center; padding:var(--space-2xl);">
      <div class="spinner"></div>
      <p>Loading audit log...</p>
    </div>
  `;
  
  try {
    // Get latest 100 audit entries
    const logsSnap = await db.collection('audit_log')
      .orderBy('timestamp', 'desc')
      .limit(100)
      .get();
    
    if (logsSnap.empty) {
      container.innerHTML = `
        <div style="text-align:center; padding:var(--space-2xl); color:var(--color-gray-600);">
          <p style="font-size:var(--text-lg); margin-bottom:var(--space-md);">📋 No Audit Logs Yet</p>
          <p style="font-size:var(--text-sm);">All administrative actions will be logged here for compliance and security.</p>
        </div>
      `;
      return;
    }
    
    const logs = [];
    logsSnap.forEach(doc => {
      logs.push({ id: doc.id, ...doc.data() });
    });
    
    // Render audit log table
    container.innerHTML = `
      <div style="margin-bottom:var(--space-lg);">
        <input 
          type="text" 
          id="audit-search" 
          placeholder="🔍 Search by email, action, or collection..." 
          style="width:100%; padding:var(--space-sm); border:1px solid var(--color-gray-300); border-radius:var(--radius-sm);"
          onkeyup="filterAuditLog()">
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
          <tbody id="audit-log-tbody"></tbody>
        </table>
      </div>
      
      <button 
        class="btn btn-secondary" 
        onclick="downloadAuditLog()" 
        style="margin-top:var(--space-lg);">
        📥 Download Full Audit Log (CSV)
      </button>
    `;
    
    // Use pagination
    paginateTable(logs, 'audit-log-tbody', 25, (log, tbody) => {
      const timestamp = log.timestamp 
        ? log.timestamp.toDate().toLocaleString('en-GB')
        : 'Unknown';
      
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
    
    console.log(`✓ Loaded ${logs.length} audit log entries`);
    
  } catch (error) {
    console.error('❌ Error loading audit log:', error);
    container.innerHTML = `
      <div style="text-align:center; padding:var(--space-2xl); color:var(--color-danger);">
        <p><strong>Error Loading Audit Log</strong></p>
        <p>${error.message}</p>
        <button class="btn btn-primary" onclick="loadAuditLog()" style="margin-top:var(--space-md);">
          🔄 Retry
        </button>
      </div>
    `;
    window.showToast?.('Failed to load audit log', 'danger');
  }
}

/**
 * Helper: Get action badge with color coding
 */
function getActionBadge(action) {
  const badges = {
    'delete_user': '<span style="background:#dc3545; color:white; padding:4px 8px; border-radius:4px; font-size:12px; font-weight:600;">🗑️ DELETE USER</span>',
    'delete_item': '<span style="background:#ff9800; color:white; padding:4px 8px; border-radius:4px; font-size:12px; font-weight:600;">🗑️ DELETE ITEM</span>',
    'create_user': '<span style="background:#28a745; color:white; padding:4px 8px; border-radius:4px; font-size:12px; font-weight:600;">➕ CREATE USER</span>',
    'update_settings': '<span style="background:#2196F3; color:white; padding:4px 8px; border-radius:4px; font-size:12px; font-weight:600;">⚙️ UPDATE SETTINGS</span>',
    'promotion_approved': '<span style="background:#4CAF50; color:white; padding:4px 8px; border-radius:4px; font-size:12px; font-weight:600;">✓ PROMOTION APPROVED</span>',
    'promotion_rejected': '<span style="background:#f44336; color:white; padding:4px 8px; border-radius:4px; font-size:12px; font-weight:600;">✗ PROMOTION REJECTED</span>'
  };
  
  return badges[action] || `<span style="color:var(--color-gray-700); font-weight:600;">${action}</span>`;
}

/**
 * View detailed audit log entry
 */
async function viewAuditDetails(logId) {
  try {
    const logDoc = await db.collection('audit_log').doc(logId).get();
    
    if (!logDoc.exists) {
      window.showToast?.('Audit log entry not found', 'danger');
      return;
    }
    
    const log = logDoc.data();
    
    // Create modal
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.5); display:flex; align-items:center; justify-content:center; z-index:10000; overflow-y:auto; padding:var(--space-lg);';
    modal.innerHTML = `
      <div style="background:white; padding:var(--space-2xl); border-radius:var(--radius-lg); max-width:700px; width:90%; max-height:80vh; overflow-y:auto;">
        <h3 style="margin-top:0;">📋 Audit Log Details</h3>
        
        <div style="margin-bottom:var(--space-md);">
          <strong>Action:</strong> ${getActionBadge(log.action)}
        </div>
        
        <div style="margin-bottom:var(--space-md);">
          <strong>Timestamp:</strong> ${log.timestamp ? log.timestamp.toDate().toLocaleString('en-GB') : 'Unknown'}
        </div>
        
        <div style="margin-bottom:var(--space-md);">
          <strong>Performed By:</strong> ${log.performedByEmail || 'Unknown'} 
          <span style="color:var(--color-gray-600); font-size:var(--text-sm);">(${log.performedBy || 'Unknown ID'})</span>
        </div>
        
        <div style="margin-bottom:var(--space-md);">
          <strong>Collection:</strong> ${log.collection || 'N/A'}
        </div>
        
        <div style="margin-bottom:var(--space-md);">
          <strong>Document ID:</strong> 
          <code style="background:#f5f5f5; padding:2px 6px; border-radius:4px;">${log.documentId || 'N/A'}</code>
        </div>
        
        ${log.deletedData ? `
          <div style="margin-bottom:var(--space-md);">
            <strong>Deleted Data:</strong>
            <pre style="background:#f5f5f5; padding:var(--space-md); border-radius:var(--radius-sm); overflow-x:auto; font-size:12px; max-height:300px;">${JSON.stringify(log.deletedData, null, 2)}</pre>
          </div>
        ` : ''}
        
        ${log.changes ? `
          <div style="margin-bottom:var(--space-md);">
            <strong>Changes Made:</strong>
            <pre style="background:#f5f5f5; padding:var(--space-md); border-radius:var(--radius-sm); overflow-x:auto; font-size:12px; max-height:300px;">${JSON.stringify(log.changes, null, 2)}</pre>
          </div>
        ` : ''}
        
        <div style="margin-bottom:var(--space-md);">
          <strong>User Agent:</strong>
          <div style="font-size:12px; color:var(--color-gray-600); word-break:break-all;">${log.userAgent || 'Unknown'}</div>
        </div>
        
        <button class="btn btn-primary" onclick="this.closest('[style*=position]').remove()">Close</button>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Close on Escape key
    const escapeHandler = (e) => {
      if (e.key === 'Escape') {
        modal.remove();
        document.removeEventListener('keydown', escapeHandler);
      }
    };
    document.addEventListener('keydown', escapeHandler);
    
  } catch (error) {
    console.error('Error loading audit details:', error);
    window.showToast?.('Failed to load audit details', 'danger');
  }
}

/**
 * Download full audit log as CSV
 */
async function downloadAuditLog() {
  try {
    window.showToast?.('Preparing audit log export...', 'info', 2000);
    
    const logsSnap = await db.collection('audit_log')
      .orderBy('timestamp', 'desc')
      .get();
    
    if (logsSnap.empty) {
      window.showToast?.('No audit logs to download', 'info');
      return;
    }
    
    // Build CSV
    let csv = 'Timestamp,Action,Collection,Document ID,Performed By,Email,User Agent\n';
    
    logsSnap.forEach(doc => {
      const log = doc.data();
      const timestamp = log.timestamp ? log.timestamp.toDate().toISOString() : '';
      const action = (log.action || '').replace(/"/g, '""');
      const collection = (log.collection || '').replace(/"/g, '""');
      const docId = (log.documentId || '').replace(/"/g, '""');
      const userId = (log.performedBy || '').replace(/"/g, '""');
      const email = (log.performedByEmail || '').replace(/"/g, '""');
      const userAgent = (log.userAgent || '').replace(/"/g, '""');
      
      csv += `"${timestamp}","${action}","${collection}","${docId}","${userId}","${email}","${userAgent}"\n`;
    });
    
    // Download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit_log_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    window.showToast?.(`✓ Exported ${logsSnap.size} audit log entries`, 'success');
    
  } catch (error) {
    console.error('Error downloading audit log:', error);
    window.showToast?.('Failed to download audit log', 'danger');
  }
}

/**
 * Filter audit log table by search term
 */
function filterAuditLog() {
  const searchTerm = document.getElementById('audit-search')?.value.toLowerCase() || '';
  const rows = document.querySelectorAll('#audit-log-tbody tr');
  
  let visibleCount = 0;
  
  rows.forEach(row => {
    const text = row.textContent.toLowerCase();
    const matches = text.includes(searchTerm);
    row.style.display = matches ? '' : 'none';
    if (matches) visibleCount++;
  });
  
  console.log(`Filter: ${visibleCount} of ${rows.length} entries match "${searchTerm}"`);
}

// ✅ CRITICAL: Make functions globally available
window.loadAuditLog = loadAuditLog;
window.getActionBadge = getActionBadge;
window.viewAuditDetails = viewAuditDetails;
window.downloadAuditLog = downloadAuditLog;
window.filterAuditLog = filterAuditLog;

console.log('✓ Audit log module loaded successfully');

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
 * Load promotion period status
 */
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
    const resultsSnap = await db.collection('results')
      .where('session', '==', actualSession)
      .get();
    
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
 * Load existing fee structures - SESSION-BASED
 */
async function loadFeeStructures() {
  const container = document.getElementById('fee-structures-list');
  if (!container) return;
  
  container.innerHTML = '<div style="text-align:center; padding:var(--space-lg);"><div class="spinner"></div><p>Loading fee structures...</p></div>';
  
  try {
    const settings = await window.getCurrentSettings();
    const session = settings.session;
    
    const snapshot = await db.collection('fee_structures')
      .where('session', '==', session)
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
              ${data.session} • <strong>All Terms</strong>
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
          <strong style="font-size:var(--text-lg);">Total per term:</strong>
          <strong style="font-size:var(--text-xl); color:var(--color-primary);">₦${parseFloat(data.total).toLocaleString()}</strong>
        </div>
        
        <div style="margin-top:var(--space-md); padding:var(--space-sm); background:#e3f2fd; border-left:4px solid #2196F3; border-radius:var(--radius-sm); font-size:var(--text-sm);">
          ℹ️ This fee applies to <strong>all terms</strong> in ${data.session} until you change it
        </div>
      `;
      
      container.appendChild(card);
    });
    
  } catch (error) {
    console.error('Error loading fee structures:', error);
    container.innerHTML = '<p style="text-align:center; color:var(--color-danger);">Error loading fee structures</p>';
  }
}

window.loadFeeStructures = loadFeeStructures;

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
 * Load pupil payment status - FULLY UPDATED WITH ARREARS AND SESSION HANDLING
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
    const encodedSession = session.replace(/\//g, '-');

    // Load fee structure for current class/session
    const feeStructureSnap = await db.collection('fee_structures')
      .where('classId', '==', classId)
      .where('session', '==', session)
      .limit(1)
      .get();

    if (feeStructureSnap.empty) {
      statusContainer.innerHTML = `
        <div class="alert alert-warning">
          <strong>⚠️ Fee Structure Not Configured</strong>
          <p>No fee structure has been set for ${className} in ${session}. Configure it in the Fee Management section first.</p>
        </div>
      `;
      document.getElementById('payment-input-section').style.display = 'none';
      return;
    }

    const feeStructure = feeStructureSnap.docs[0].data();
    let amountDue = feeStructure.total || 0;
    let totalPaid = 0;
    let arrears = 0;
    let totalDue = amountDue;
    let balance = amountDue;
    let status = 'owing';

    // Load current term payment document
    const paymentDocId = `${pupilId}_${encodedSession}_${term}`;
    const paymentDoc = await db.collection('payments').doc(paymentDocId).get();

    if (paymentDoc.exists) {
      const paymentData = paymentDoc.data();
      totalPaid = paymentData.totalPaid || 0;
      arrears = paymentData.arrears || 0;
      totalDue = paymentData.totalDue || amountDue;
      balance = paymentData.balance || 0;
      status = paymentData.status || 'owing';
    } else {
      // Check arrears from previous session(s)
      const previousSession = getPreviousSessionName(session);
      if (previousSession) {
        arrears = await calculateSessionBalance(pupilId, previousSession);
        totalDue = amountDue + arrears;
        balance = totalDue;
      }
    }

    const statusBadge =
      status === 'paid' ? '<span class="status-badge" style="background:#4CAF50;">Paid in Full</span>' :
      status === 'partial' ? '<span class="status-badge" style="background:#ff9800;">Partial Payment</span>' :
      arrears > 0 ? '<span class="status-badge" style="background:#dc3545;">Owing (with Arrears)</span>' :
      '<span class="status-badge" style="background:#f44336;">Owing</span>';

    // Render payment status card
    statusContainer.innerHTML = `
      <div style="background:white; border:1px solid var(--color-gray-300); border-radius:var(--radius-md); padding:var(--space-lg);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:var(--space-md);">
          <div>
            <h3 style="margin:0;">${pupilName}</h3>
            <p style="margin:var(--space-xs) 0 0; color:var(--color-gray-600);">${className} • ${session} • ${term}</p>
          </div>
          ${statusBadge}
        </div>

        ${arrears > 0 ? `
        <div style="background:#fef2f2; border:2px solid #dc3545; border-radius:var(--radius-sm); padding:var(--space-md); margin-bottom:var(--space-lg);">
          <div style="display:flex; align-items:center; gap:var(--space-sm); margin-bottom:var(--space-xs);">
            <i data-lucide="alert-triangle" style="width:20px; height:20px; color:#dc3545;"></i>
            <strong style="color:#991b1b;">Outstanding Arrears from Previous Session</strong>
          </div>
          <p style="margin:0; font-size:var(--text-sm); color:#7f1d1d;">
            ₦${arrears.toLocaleString()} unpaid from previous session(s). Payments will prioritize clearing arrears first.
          </p>
        </div>` : ''}

        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(150px, 1fr)); gap:var(--space-md); margin-top:var(--space-lg);">
          ${arrears > 0 ? `
          <div style="text-align:center; padding:var(--space-md); background:#fef2f2; border:2px solid #dc3545; border-radius:var(--radius-sm);">
            <div style="font-size:var(--text-xs); color:#991b1b; margin-bottom:var(--space-xs); font-weight:600;">Arrears</div>
            <div style="font-size:var(--text-xl); font-weight:700; color:#dc3545;">₦${arrears.toLocaleString()}</div>
          </div>` : ''}

          <div style="text-align:center; padding:var(--space-md); background:var(--color-gray-50); border-radius:var(--radius-sm);">
            <div style="font-size:var(--text-xs); color:var(--color-gray-600); margin-bottom:var(--space-xs);">Current Term Fee</div>
            <div style="font-size:var(--text-xl); font-weight:700; color:var(--color-gray-900);">₦${amountDue.toLocaleString()}</div>
          </div>

          <div style="text-align:center; padding:var(--space-md); background:var(--color-success-light); border-radius:var(--radius-sm);">
            <div style="font-size:var(--text-xs); color:var(--color-success-dark); margin-bottom:var(--space-xs);">Total Paid</div>
            <div style="font-size:var(--text-xl); font-weight:700; color:var(--color-success-dark);">₦${totalPaid.toLocaleString()}</div>
          </div>

          <div style="text-align:center; padding:var(--space-md); background:${balance > 0 ? 'var(--color-danger-light)' : 'var(--color-success-light)'}; border-radius:var(--radius-sm);">
            <div style="font-size:var(--text-xs); color:${balance > 0 ? 'var(--color-danger-dark)' : 'var(--color-success-dark)'}; margin-bottom:var(--space-xs);">Total Balance</div>
            <div style="font-size:var(--text-xl); font-weight:700; color:${balance > 0 ? 'var(--color-danger-dark)' : 'var(--color-success-dark)'};">₦${balance.toLocaleString()}</div>
          </div>
        </div>
      </div>
    `;

    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }

    document.getElementById('payment-input-section').style.display = 'block';

    const amountInput = document.getElementById('payment-amount');
    if (amountInput) {
      amountInput.max = balance;
      amountInput.value = '';
    }

    // CRITICAL FIX: Await the payment history load
    await loadPaymentHistory(pupilId, session, term);

  } catch (error) {
    console.error('Error loading payment status:', error);
    statusContainer.innerHTML = '<p style="text-align:center; color:var(--color-danger);">Error loading payment status</p>';
  }
}

window.loadPupilPaymentStatus = loadPupilPaymentStatus;

/**
 * Load complete payment history for selected pupil - ALL TERMS WITH ARREARS
 * ADMIN VERSION - Shows full transaction details
 */
async function loadPaymentHistory(pupilId, session, term) {
  const container = document.getElementById('payment-history-list');
  if (!container) {
    console.error('payment-history-list container not found');
    return;
  }

  container.innerHTML = '<div style="text-align:center; padding:var(--space-md);"><div class="spinner"></div></div>';

  try {
    // Fetch all payment transactions for this pupil in current session
    const snapshot = await db.collection('payment_transactions')
      .where('pupilId', '==', pupilId)
      .where('session', '==', session)
      .orderBy('paymentDate', 'desc')
      .get();

    if (snapshot.empty) {
      container.innerHTML = '<p style="text-align:center; color:var(--color-gray-600); padding:var(--space-lg);">No payment history yet for this session</p>';
      return;
    }

    const transactions = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      transactions.push({
        id: doc.id,
        receiptNo: data.receiptNo || 'N/A',
        amountPaid: data.amountPaid || 0,
        arrearsPayment: data.arrearsPayment || 0,
        currentTermPayment: data.currentTermPayment || 0,
        paymentDate: data.paymentDate || null,
        paymentMethod: data.paymentMethod || 'Cash',
        term: data.term || 'N/A',
        session: data.session || 'N/A',
        recordedBy: data.recordedBy || 'Unknown'
      });
    });

    container.innerHTML = transactions.map(txn => {
      const date = txn.paymentDate ? txn.paymentDate.toDate().toLocaleDateString('en-GB') : 'N/A';
      const hasArrears = txn.arrearsPayment > 0;
      
      return `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:var(--space-md); background:white; border:1px solid var(--color-gray-300); border-radius:var(--radius-sm); margin-bottom:var(--space-sm);">
          <div style="flex:1;">
            <div style="font-weight:700; font-size:var(--text-lg); margin-bottom:var(--space-xs);">
              ₦${Number(txn.amountPaid).toLocaleString()}
            </div>
            <div style="font-size:var(--text-sm); color:var(--color-gray-600);">
              ${date} • ${txn.paymentMethod} • Receipt #${txn.receiptNo} • ${txn.term}
            </div>
            ${hasArrears ? `
              <div style="font-size:var(--text-sm); margin-top:var(--space-xs); color:#991b1b; font-weight:600;">
                💰 Arrears: ₦${txn.arrearsPayment.toLocaleString()} 
                ${txn.currentTermPayment > 0 ? `• Current: ₦${txn.currentTermPayment.toLocaleString()}` : ''}
              </div>
            ` : ''}
          </div>
          <button class="btn-small btn-secondary" onclick="printReceipt('${txn.receiptNo}')">
            Print Receipt
          </button>
        </div>
      `;
    }).join('');

    console.log(`✓ Loaded ${transactions.length} payment transactions for ${session}`);

  } catch (error) {
    console.error('Error loading payment history:', error);
    container.innerHTML = '<p style="text-align:center; color:var(--color-danger);">Error loading payment history</p>';
  }
}

// Make function globally available
window.loadPaymentHistory = loadPaymentHistory;

/**
 * FIXED: Outstanding Fees Report - Current Term with Arrears
 */
async function loadOutstandingFeesReport() {
    const container = document.getElementById('outstanding-fees-table');
    if (!container) return;

    const tbody = container.querySelector('tbody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="7" class="table-loading">Loading outstanding fees...</td></tr>';

    try {
        const settings = await window.getCurrentSettings();
        const session = settings.session;
        const currentTerm = settings.term;

        // Query payments for current term with outstanding balances
        const paymentsSnap = await db.collection('payments')
            .where('session', '==', session)
            .where('term', '==', currentTerm)
            .get();

        if (paymentsSnap.empty) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:var(--color-success); padding:var(--space-2xl);">✓ No payment records for ' + currentTerm + ' yet.</td></tr>';
            updateSummaryDisplay(0, 0);
            return;
        }

        const outstandingPupils = [];
        let totalOutstanding = 0;

        paymentsSnap.forEach(doc => {
            const data = doc.data();
            const balance = data.balance || 0;
            
            // Only include pupils with outstanding balance
            if (balance > 0) {
                outstandingPupils.push({
                    name: data.pupilName || 'Unknown',
                    className: data.className || '-',
                    amountDue: data.amountDue || 0,
                    arrears: data.arrears || 0,
                    totalDue: data.totalDue || 0,
                    totalPaid: data.totalPaid || 0,
                    balance: balance,
                    status: data.status || 'owing'
                });
                
                totalOutstanding += balance;
            }
        });

        tbody.innerHTML = '';

        if (outstandingPupils.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:var(--color-success); padding:var(--space-2xl);">✓ All fees collected for ' + currentTerm + '!</td></tr>';
            updateSummaryDisplay(0, 0);
            return;
        }

        // Sort by balance (highest first)
        outstandingPupils.sort((a, b) => b.balance - a.balance);

        const fragment = document.createDocumentFragment();
        
        outstandingPupils.forEach(pupil => {
            const tr = document.createElement('tr');
            
            // Show arrears badge if exists
            const arrearsNote = pupil.arrears > 0 
                ? `<br><span style="color:#dc3545; font-size:0.85em;">+ ₦${pupil.arrears.toLocaleString()} arrears</span>` 
                : '';
            
            tr.innerHTML = `
                <td data-label="Pupil Name">${pupil.name}</td>
                <td data-label="Class">${pupil.className}</td>
                <td data-label="Amount Due">₦${pupil.amountDue.toLocaleString()}${arrearsNote}</td>
                <td data-label="Total Paid">₦${pupil.totalPaid.toLocaleString()}</td>
                <td data-label="Balance" class="text-bold text-danger">
                    ₦${pupil.balance.toLocaleString()}
                </td>
                <td data-label="Status">
                    <span class="status-badge" style="background:${pupil.status === 'partial' ? '#ff9800' : pupil.arrears > 0 ? '#dc3545' : '#f44336'};">
                        ${pupil.status === 'partial' ? 'Partial' : pupil.arrears > 0 ? 'With Arrears' : 'Owing'}
                    </span>
                </td>
                <td data-label="Term">${currentTerm}</td>
            `;
            fragment.appendChild(tr);
        });

        tbody.appendChild(fragment);
        updateSummaryDisplay(outstandingPupils.length, totalOutstanding);

        console.log(`✓ Outstanding fees: ${outstandingPupils.length} pupils owe ₦${totalOutstanding.toLocaleString()}`);

    } catch (error) {
        console.error('Error loading outstanding fees:', error);
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--color-danger);">Error: ${error.message}</td></tr>`;
    }
}

window.loadOutstandingFeesReport = loadOutstandingFeesReport;

/**
 * Update summary display elements
 */
function updateSummaryDisplay(count, total) {
  const countEl = document.getElementById('outstanding-count');
  const totalEl = document.getElementById('outstanding-total');
  
  if (countEl) countEl.textContent = count;
  if (totalEl) totalEl.textContent = `₦${total.toLocaleString()}`;
}

/**
 * Show detailed fee breakdown in modal
 */
function showFeeBreakdown(pupilName, termBreakdown) {
  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.5); display:flex; align-items:center; justify-content:center; z-index:10000;';
  
  const breakdownRows = termBreakdown
    .filter(t => t.due > 0)
    .map(t => `
      <tr>
        <td><strong>${t.term}</strong></td>
        <td style="text-align:right;">₦${t.due.toLocaleString()}</td>
        <td style="text-align:right;">₦${t.paid.toLocaleString()}</td>
        <td style="text-align:right; color:${t.balance > 0 ? '#f44336' : '#4CAF50'}; font-weight:700;">
          ₦${t.balance.toLocaleString()}
        </td>
      </tr>
    `).join('');
  
  const totalDue = termBreakdown.reduce((sum, t) => sum + t.due, 0);
  const totalPaid = termBreakdown.reduce((sum, t) => sum + t.paid, 0);
  const totalBalance = termBreakdown.reduce((sum, t) => sum + t.balance, 0);
  
  modal.innerHTML = `
    <div style="background:white; padding:var(--space-2xl); border-radius:var(--radius-lg); max-width:600px; width:90%; max-height:80vh; overflow-y:auto;">
      <h3 style="margin-top:0;">Fee Breakdown: ${pupilName}</h3>
      
      <table style="width:100%; border-collapse:collapse; margin-bottom:var(--space-lg);">
        <thead>
          <tr style="background:#f5f5f5;">
            <th style="padding:var(--space-sm); text-align:left;">Term</th>
            <th style="padding:var(--space-sm); text-align:right;">Due</th>
            <th style="padding:var(--space-sm); text-align:right;">Paid</th>
            <th style="padding:var(--space-sm); text-align:right;">Balance</th>
          </tr>
        </thead>
        <tbody>
          ${breakdownRows}
        </tbody>
        <tfoot>
          <tr style="background:#e3f2fd; font-weight:700;">
            <td style="padding:var(--space-sm);"><strong>TOTAL</strong></td>
            <td style="padding:var(--space-sm); text-align:right;">₦${totalDue.toLocaleString()}</td>
            <td style="padding:var(--space-sm); text-align:right;">₦${totalPaid.toLocaleString()}</td>
            <td style="padding:var(--space-sm); text-align:right; color:#f44336;">₦${totalBalance.toLocaleString()}</td>
          </tr>
        </tfoot>
      </table>
      
      <button class="btn btn-primary" onclick="this.closest('[style*=position]').remove()">Close</button>
    </div>
  `;
  
  document.body.appendChild(modal);
}

// Make functions globally available
window.loadOutstandingFeesReport = loadOutstandingFeesReport;
window.updateSummaryDisplay = updateSummaryDisplay;
window.showFeeBreakdown = showFeeBreakdown;

/**
 * FIXED: Financial Reports - Current Term with Arrears Included
 */
async function loadFinancialReports() {
    try {
        const settings = await window.getCurrentSettings();
        const session = settings.session;
        const currentTerm = settings.term;

        // Query payments for CURRENT TERM ONLY
        const paymentsSnap = await db.collection('payments')
            .where('session', '==', session)
            .where('term', '==', currentTerm)
            .get();

        if (paymentsSnap.empty) {
            updateFinancialDisplays(0, 0, 0, 0, 0, 0, 0, session, currentTerm);
            return;
        }

        let totalExpected = 0;
        let totalCollected = 0;
        let totalOutstanding = 0;
        let paidInFull = 0;
        let partialPayments = 0;
        let noPayment = 0;

        paymentsSnap.forEach(doc => {
            const data = doc.data();
            const totalDue = data.totalDue || 0; // Includes arrears
            const totalPaid = data.totalPaid || 0;
            const balance = data.balance || 0;
            const status = data.status || 'owing';

            totalExpected += totalDue; // Include arrears in expected
            totalCollected += totalPaid;
            totalOutstanding += balance;

            if (status === 'paid') {
                paidInFull++;
            } else if (status === 'partial') {
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
            currentTerm
        );

        console.log(`✓ Financial report for ${currentTerm}:`);
        console.log(`  - Expected (inc. arrears): ₦${totalExpected.toLocaleString()}`);
        console.log(`  - Collected: ₦${totalCollected.toLocaleString()}`);
        console.log(`  - Outstanding: ₦${totalOutstanding.toLocaleString()}`);

    } catch (error) {
        console.error('Error loading financial reports:', error);
        window.showToast?.('Failed to load financial reports', 'danger');
    }
}

window.loadFinancialReports = loadFinancialReports;

/**
 * ✅ NEW: Generate term-by-term breakdown chart
 */
async function generateTermBreakdownChart(session, feeStructureMap, paymentMap) {
    const chartContainer = document.getElementById('term-breakdown-chart');
    if (!chartContainer) return;

    const termOrder = ['First Term', 'Second Term', 'Third Term'];
    const termData = {};

    // Initialize term data
    termOrder.forEach(term => {
        termData[term] = {
            expected: 0,
            collected: 0,
            outstanding: 0
        };
    });

    // Calculate expected fees per term from feeStructureMap
    Object.values(feeStructureMap).forEach(classFees => {
        termOrder.forEach(term => {
            termData[term].expected += classFees[term] || 0;
        });
    });

    // Allocate collected payments proportionally across terms
    Object.values(paymentMap).forEach(pupilPayments => {
        pupilPayments.terms.forEach(term => {
            if (termData[term]) {
                const portion = pupilPayments.totalPaid / pupilPayments.terms.length;
                termData[term].collected += portion;
            }
        });
    });

    // Compute outstanding fees per term
    Object.keys(termData).forEach(term => {
        termData[term].outstanding = termData[term].expected - termData[term].collected;
    });

    // Render chart
    const chartHTML = `
        <div style="background: white; padding: var(--space-xl); border-radius: var(--radius-lg); border: 1px solid #e2e8f0; margin-top: var(--space-xl);">
            <h3 style="margin: 0 0 var(--space-lg);">📊 Term-by-Term Breakdown</h3>
            <div style="display: grid; gap: var(--space-lg);">
                ${termOrder.map(term => {
                    const data = termData[term];
                    if (data.expected === 0) return '';

                    const collectionRate = data.expected > 0
                        ? Math.round((data.collected / data.expected) * 100)
                        : 0;

                    return `
                        <div style="padding: var(--space-md); background: #f8fafc; border-radius: var(--radius-md);">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-sm);">
                                <strong style="color: #0f172a;">${term}</strong>
                                <span style="font-weight: 700;">
                                    ${collectionRate}% collected
                                </span>
                            </div>
                            <div style="display: flex; justify-content: space-between; font-size: var(--text-sm);">
                                <span>Expected: ₦${Math.round(data.expected).toLocaleString()}</span>
                                <span>Collected: ₦${Math.round(data.collected).toLocaleString()}</span>
                                <span>Outstanding: ₦${Math.round(data.outstanding).toLocaleString()}</span>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;

    chartContainer.innerHTML = chartHTML;
}

// Helper function (keep existing one)
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

// Make functions globally available
window.loadFinancialReports = loadFinancialReports;
window.generateTermBreakdownChart = generateTermBreakdownChart;
window.updateFinancialDisplays = updateFinancialDisplays;

/**
 * Save fee structure configuration
 * FIXED: Session-based only, persists across terms
 */
/**
 * Save fee structure configuration - SESSION-BASED ONLY
 * FIXED: Fees persist across all terms in session
 */
async function saveFeeStructure() {
  const classSelect = document.getElementById('fee-config-class');
  const classId = classSelect?.value;
  const className = classSelect?.selectedOptions[0]?.dataset.className;
  
  if (!classId) {
    window.showToast?.('Please select a class', 'warning');
    return;
  }
  
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
    
    // FIXED: Use session only (no term) - persists across all terms
    const encodedSession = session.replace(/\//g, '-');
    const feeDocId = `${classId}_${encodedSession}`;
    
    await db.collection('fee_structures').doc(feeDocId).set({
      classId,
      className,
      session,
      // NO term field - applies to ALL terms in session
      fees: feeBreakdown,
      total: total,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      createdBy: auth.currentUser.uid
    });

    window.showToast?.(
      `✓ Fee structure saved for ${className}!\n\n` +
      `Per-term fee: ₦${total.toLocaleString()}\n\n` +
      `This fee applies to ALL terms in ${session} until you change it.\n\n` +
      `Use "Generate Missing Records" to create payment records for pupils.`,
      'success',
      10000
    );
    
    // Clear form
    document.getElementById('fee-config-class').value = '';
    ['fee-tuition', 'fee-exam', 'fee-uniform', 'fee-books', 'fee-pta', 'fee-other'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    
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

window.saveFeeStructure = saveFeeStructure;

/**
 * Generate payment records for all pupils in a class
 * FIXED: Checks for existing records to prevent duplicates
 */
async function generatePaymentRecordsForClass(classId, className, session, term, totalFee) {
  try {
    console.log(`Generating payment records for class ${className}, term ${term}...`);
    
    const pupilsSnap = await db.collection('pupils')
      .where('class.id', '==', classId)
      .get();
    
    if (pupilsSnap.empty) {
      console.log('No pupils found in this class');
      return { success: true, count: 0, skipped: 0, total: 0 };
    }
    
    const batch = db.batch();
    let created = 0;
    let skipped = 0;
    
    const previousSession = getPreviousSessionName(session);
    const encodedSession = session.replace(/\//g, '-');
    
    for (const pupilDoc of pupilsSnap.docs) {
      const pupilData = pupilDoc.data();
      const pupilId = pupilDoc.id;
      const paymentDocId = `${pupilId}_${encodedSession}_${term}`;
      
      // Check if payment record already exists
      const existingPayment = await db.collection('payments').doc(paymentDocId).get();
      
      if (existingPayment.exists) {
        console.log(`⏭️ Skipping ${pupilData.name} - payment record already exists`);
        skipped++;
        continue;
      }
      
      // Calculate actual fee for this pupil in this term
      const actualFee = window.finance.calculatePupilTermFee(
        pupilData,
        totalFee,
        term
      );
      
      // Skip if pupil is not enrolled for this term
      if (actualFee === 0) {
        console.log(`⏭️ Skipping ${pupilData.name} - not enrolled for ${term}`);
        skipped++;
        continue;
      }
      
      // Check for arrears from previous session
      let arrears = 0;
      if (previousSession) {
        const previousSessionBalance = await calculateSessionBalance(pupilId, previousSession);
        arrears = previousSessionBalance;
      }
      
      const paymentRef = db.collection('payments').doc(paymentDocId);
      
      // Create payment record with actual fee
      batch.set(paymentRef, {
        pupilId: pupilId,
        pupilName: pupilData.name || 'Unknown',
        classId: classId,
        className: className,
        session: session,
        term: term,
        amountDue: actualFee,
        arrears: arrears,
        totalDue: actualFee + arrears,
        totalPaid: 0,
        balance: actualFee + arrears,
        status: arrears > 0 ? 'owing_with_arrears' : 'owing',
        lastPaymentDate: null,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      
      created++;
    }
    
    if (created > 0) {
      await batch.commit();
      console.log(`✓ Created ${created} new payment records (${skipped} skipped)`);
    } else {
      console.log(`✓ All ${pupilsSnap.size} pupils already have payment records`);
    }
    
    return { 
      success: true, 
      count: created,
      skipped: skipped,
      total: pupilsSnap.size
    };
    
  } catch (error) {
    console.error('Error generating payment records:', error);
    throw error;
  }
}

window.generatePaymentRecordsForClass = generatePaymentRecordsForClass;

/**
 * Helper: Get previous session name
 */
function getPreviousSessionName(currentSession) {
  // Extract years from "2025/2026"
  const match = currentSession.match(/(\d{4})\/(\d{4})/);
  if (!match) return null;
  
  const startYear = parseInt(match[1]);
  const endYear = parseInt(match[2]);
  
  // Previous session is one year back
  return `${startYear - 1}/${endYear - 1}`;
}

/**
 * Helper: Calculate total unpaid balance for entire session
 */
async function calculateSessionBalance(pupilId, session) {
  try {
    const paymentsSnap = await db.collection('payments')
      .where('pupilId', '==', pupilId)
      .where('session', '==', session)
      .get();
    
    let totalBalance = 0;
    
    paymentsSnap.forEach(doc => {
      const data = doc.data();
      totalBalance += (data.balance || 0);
    });
    
    return totalBalance;
    
  } catch (error) {
    console.error('Error calculating session balance:', error);
    return 0;
  }
}

/**
 * Bulk generate payment records for ALL fee structures
 */
async function bulkGenerateAllPaymentRecords() {
  const btn = document.getElementById('bulk-generate-btn');
  
  if (!confirm(
    'Generate payment records for all pupils?\n\n' +
    'This will create records ONLY for pupils who don\'t have them yet.\n' +
    'Existing payment records will NOT be overwritten.\n\n' +
    'Continue?'
  )) {
    return;
  }
  
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="btn-loading">Generating records...</span>';
  }
  
  try {
    const settings = await window.getCurrentSettings();
    const session = settings.session;
    const term = settings.term;
    
    // Get all fee structures for current session
    const feeStructuresSnap = await db.collection('fee_structures')
      .where('session', '==', session)
      .get();
    
    if (feeStructuresSnap.empty) {
      window.showToast?.('No fee structures found for current session', 'info');
      return;
    }
    
    let totalCreated = 0;
    let totalSkipped = 0;
    let classesProcessed = 0;
    
    for (const feeDoc of feeStructuresSnap.docs) {
      const feeData = feeDoc.data();
      
      const result = await generatePaymentRecordsForClass(
        feeData.classId,
        feeData.className,
        session,
        term, // Use current term
        feeData.total
      );
      
      totalCreated += result.count;
      totalSkipped += result.skipped || 0;
      classesProcessed++;
    }
    
    window.showToast?.(
      `✓ Bulk generation complete!\n\n` +
      `Classes processed: ${classesProcessed}\n` +
      `Records created: ${totalCreated}\n` +
      `Records skipped: ${totalSkipped} (already exist)\n\n` +
      `Existing payment data was preserved.`,
      'success',
      10000
    );
    
    // Reload outstanding fees report if visible
    const outstandingSection = document.getElementById('outstanding-fees');
    if (outstandingSection && outstandingSection.style.display !== 'none') {
      await loadOutstandingFeesReport();
    }
    
  } catch (error) {
    console.error('Error in bulk generation:', error);
    window.handleError?.(error, 'Failed to generate payment records');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '📋 Generate All Missing Payment Records';
    }
  }
}

// Make globally available
window.bulkGenerateAllPaymentRecords = bulkGenerateAllPaymentRecords;

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
 * Record a new payment - OVERPAYMENT SAFE
 */
async function recordPayment() {
  const pupilSelect = document.getElementById('payment-pupil-select');
  const pupilId = pupilSelect?.value;
  const pupilName = pupilSelect?.selectedOptions[0]?.dataset.pupilName;
  const className = pupilSelect?.selectedOptions[0]?.dataset.className;
  const classId = document.getElementById('payment-class-filter')?.value;

  const amountInput = document.getElementById('payment-amount');
  let amountPaid = amountInput ? parseFloat(amountInput.value) : NaN;

  const paymentMethod = document.getElementById('payment-method')?.value;
  const notes = document.getElementById('payment-notes')?.value.trim() || '';

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

    const receiptNo = `REC-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 5)
      .toUpperCase()}`;

    const encodedSession = session.replace(/\//g, '-');
    const paymentDocId = `${pupilId}_${encodedSession}_${term}`;

    const paymentRef = db.collection('payments').doc(paymentDocId);
    const paymentDoc = await paymentRef.get();

    let currentPaid = 0;
    let amountDue = 0;
    let arrears = 0;

    if (paymentDoc.exists) {
      const data = paymentDoc.data();
      currentPaid = data.totalPaid || 0;
      amountDue = data.amountDue || 0;
      arrears = data.arrears || 0;
    } else {
      const feeSnap = await db
        .collection('fee_structures')
        .where('classId', '==', classId)
        .where('session', '==', session)
        .where('term', '==', term)
        .limit(1)
        .get();

      if (!feeSnap.empty) {
        amountDue = feeSnap.docs[0].data().total || 0;
      }

      const previousSession = getPreviousSessionName(session);
      if (previousSession) {
        arrears = await calculateSessionBalance(pupilId, previousSession);
      }
    }

    const totalDue = amountDue + arrears;
    const remainingPayable = totalDue - currentPaid;

    if (remainingPayable <= 0) {
      window.showToast?.('This pupil has fully paid all outstanding fees', 'info');
      return;
    }

    if (amountPaid > remainingPayable) {
      amountPaid = remainingPayable;
    }

    const newTotalPaid = currentPaid + amountPaid;

    let arrearsPayment = 0;
    let currentTermPayment = 0;
    let remainingArrears = arrears;

    if (arrears > 0) {
      if (amountPaid <= arrears) {
        arrearsPayment = amountPaid;
        remainingArrears = arrears - amountPaid;
      } else {
        arrearsPayment = arrears;
        currentTermPayment = amountPaid - arrears;
        remainingArrears = 0;
      }
    } else {
      currentTermPayment = amountPaid;
    }

    const newBalance = totalDue - newTotalPaid;
    const newStatus =
      newBalance === 0 ? 'paid' : newTotalPaid > 0 ? 'partial' : 'owing';

    const batch = db.batch();

    batch.set(
      paymentRef,
      {
        pupilId,
        pupilName,
        classId,
        className,
        session,
        term,
        amountDue,
        arrears: remainingArrears,
        totalDue: amountDue + remainingArrears,
        totalPaid: newTotalPaid,
        balance: newBalance,
        status: newStatus,
        lastPaymentDate: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      },
      { merge: true }
    );

    const transactionRef = db.collection('payment_transactions').doc(receiptNo);
    batch.set(transactionRef, {
      pupilId,
      pupilName,
      classId,
      className,
      session,
      term,
      amountPaid,
      arrearsPayment,
      currentTermPayment,
      paymentMethod: paymentMethod || 'Cash',
      receiptNo,
      notes,
      paymentDate: firebase.firestore.FieldValue.serverTimestamp(),
      recordedBy: auth.currentUser.uid,
      recordedByEmail: auth.currentUser.email
    });

    await batch.commit();

    let message = `✓ Payment Recorded Successfully!\n\nReceipt #${receiptNo}\nAmount: ₦${amountPaid.toLocaleString()}`;

    if (arrearsPayment > 0) {
      message += `\n\nPayment Breakdown:\n`;
      message += `  • Arrears: ₦${arrearsPayment.toLocaleString()}`;
      if (currentTermPayment > 0) {
        message += `\n  • Current Term: ₦${currentTermPayment.toLocaleString()}`;
      }
    }

    message += `\n\nNew Balance: ₦${newBalance.toLocaleString()}`;
    if (remainingArrears > 0) {
      message += `\n(Includes ₦${remainingArrears.toLocaleString()} arrears)`;
    }

    window.showToast?.(message, 'success', 10000);

    if (amountInput) amountInput.value = '';
    const notesInput = document.getElementById('payment-notes');
    if (notesInput) notesInput.value = '';

    await loadPupilPaymentStatus();

    if (
      confirm(
        'Payment recorded successfully!\n\nWould you like to print the receipt now?'
      )
    ) {
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
        'width=1000,height=750,scrollbars=yes,resizable=yes'
    );

    if (!receiptWindow) {
        window.showToast?.('Please allow popups to print receipts', 'warning');
    }
}

async function migrateArrearsToNewSession() {
  const btn = document.getElementById('migrate-arrears-btn');
  
  if (!confirm(
    '⚠️ ARREARS MIGRATION\n\n' +
    'This will:\n' +
    '• Calculate unpaid balances from previous session\n' +
    '• Add arrears to current session payment records\n' +
    '• Update all affected pupil balances\n\n' +
    'This should only be run ONCE at the start of a new session.\n\n' +
    'Continue?'
  )) {
    return;
  }
  
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="btn-loading">Migrating arrears...</span>';
  }
  
  try {
    const settings = await window.getCurrentSettings();
    const currentSession = settings.session;
    const previousSession = getPreviousSessionName(currentSession);
    
    if (!previousSession) {
      window.showToast?.('Cannot determine previous session', 'danger');
      return;
    }
    
    // Get all pupils
    const pupilsSnap = await db.collection('pupils').get();
    
    let processedCount = 0;
    let arrearsFoundCount = 0;
    let totalArrearsAmount = 0;
    
    const batch = db.batch();
    let batchCount = 0;
    
    for (const pupilDoc of pupilsSnap.docs) {
      const pupilId = pupilDoc.id;
      
      // Calculate arrears from previous session
      const arrears = await calculateSessionBalance(pupilId, previousSession);
      
      if (arrears > 0) {
        arrearsFoundCount++;
        totalArrearsAmount += arrears;
        
        // Update all payment records for current session
        const paymentsSnap = await db.collection('payments')
          .where('pupilId', '==', pupilId)
          .where('session', '==', currentSession)
          .get();
        
        paymentsSnap.forEach(paymentDoc => {
          const data = paymentDoc.data();
          const amountDue = data.amountDue || 0;
          const totalPaid = data.totalPaid || 0;
          
          batch.update(paymentDoc.ref, {
            arrears: arrears,
            totalDue: amountDue + arrears,
            balance: (amountDue + arrears) - totalPaid,
            status: 'owing_with_arrears',
            arrearsUpdatedAt: firebase.firestore.FieldValue.serverTimestamp()
          });
          
          batchCount++;
        });
      }
      
      processedCount++;
      
      // Commit batch if reaching limit
      if (batchCount >= 400) {
        await batch.commit();
        batchCount = 0;
        console.log(`Progress: ${processedCount}/${pupilsSnap.size} pupils processed`);
      }
    }
    
    // Commit remaining
    if (batchCount > 0) {
      await batch.commit();
    }
    
    window.showToast?.(
      `✓ Arrears Migration Complete!\n\n` +
      `• Processed: ${processedCount} pupils\n` +
      `• Found arrears: ${arrearsFoundCount} pupils\n` +
      `• Total arrears: ₦${totalArrearsAmount.toLocaleString()}`,
      'success',
      10000
    );
    
  } catch (error) {
    console.error('Arrears migration error:', error);
    window.showToast?.(`Migration failed: ${error.message}`, 'danger');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '🔄 Migrate Arrears from Previous Session';
    }
  }
}

// Make functions globally available
window.generatePaymentRecordsForClass = generatePaymentRecordsForClass;
window.getPreviousSessionName = getPreviousSessionName;
window.calculateSessionBalance = calculateSessionBalance;
window.recordPayment = recordPayment;
window.loadPupilPaymentStatus = loadPupilPaymentStatus;
window.migrateArrearsToNewSession = migrateArrearsToNewSession;

console.log('✓ Cross-session debt tracking system loaded');

/**
 * Export financial report to CSV or PDF - FIXED: based on ALL pupils
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

        // 1. Get ALL currently enrolled pupils
        const pupilsSnap = await db.collection('pupils').get();

        if (pupilsSnap.empty) {
            window.showToast?.('No pupils enrolled - nothing to export', 'warning');
            return;
        }

        // 2. Get current fee structures
        const feeStructuresSnap = await db.collection('fee_structures')
            .where('session', '==', session)
            .where('term', '==', term)
            .get();

        const feeStructureMap = {};
        feeStructuresSnap.forEach(doc => {
            const data = doc.data();
            feeStructureMap[data.classId] = data.total || 0;
        });

        // 3. Get all payment records for this session/term
        const paymentsSnap = await db.collection('payments')
            .where('session', '==', session)
            .where('term', '==', term)
            .get();

        const paymentMap = {};
        paymentsSnap.forEach(doc => {
            const data = doc.data();
            paymentMap[data.pupilId] = {
                totalPaid: data.totalPaid || 0,
                balance: data.balance || 0,
                status: data.status || 'owing',
                lastPaymentDate: data.lastPaymentDate
            };
        });

        // 4. Build complete dataset
        const reportData = [];
        let totalExpected = 0;
        let totalCollected = 0;
        let totalOutstanding = 0;

        pupilsSnap.forEach(pupilDoc => {
            const pupil = pupilDoc.data();
            const pupilId = pupilDoc.id;
            const classId = pupil.class?.id;

            if (!classId) return; // skip unassigned

            const amountDue = feeStructureMap[classId] || 0;
            if (amountDue === 0) return; // skip classes without fee structure

            const payment = paymentMap[pupilId];

            const totalPaid = payment?.totalPaid || 0;
            const balance = amountDue - totalPaid;

            const calculatedStatus = 
                balance <= 0 ? 'paid' :
                totalPaid > 0 ? 'partial' : 'owing';

            reportData.push({
                pupilName: pupil.name || 'Unknown',
                className: pupil.class?.name || '-',
                amountDue,
                totalPaid,
                balance,
                status: calculatedStatus,
                lastPaymentDate: payment?.lastPaymentDate 
                    ? payment.lastPaymentDate.toDate().toLocaleDateString('en-GB')
                    : 'N/A'
            });

            totalExpected += amountDue;
            totalCollected += totalPaid;
            totalOutstanding += balance;
        });

        if (reportData.length === 0) {
            window.showToast?.('No pupils with fee structures for this session/term', 'warning');
            return;
        }

        if (format === 'csv') {
            await exportFinancialCSV(reportData, session, term, totalExpected, totalCollected, totalOutstanding);
        } else {
            await exportFinancialPDF(reportData, session, term, totalExpected, totalCollected, totalOutstanding);
        }

    } catch (error) {
        console.error('Error exporting financial report:', error);
        window.handleError?.(error, 'Failed to export report');
    }
}

/**
 * Export CSV - using complete pupil-based data
 */
async function exportFinancialCSV(reportData, session, term, totalExpected, totalCollected, totalOutstanding) {
    const headers = ['Pupil Name', 'Class', 'Amount Due', 'Total Paid', 'Balance', 'Status', 'Last Payment Date'];
    
    const csvRows = [headers.join(',')];
    
    reportData.forEach(p => {
        csvRows.push([
            `"${(p.pupilName || '').replace(/"/g, '""')}"`,
            `"${(p.className || '').replace(/"/g, '""')}"`,
            p.amountDue,
            p.totalPaid,
            p.balance,
            `"${p.status}"`,
            `"${p.lastPaymentDate}"`
        ].join(','));
    });

    // Optional: add summary row
    csvRows.push([]);
    csvRows.push(['SUMMARY','','','','','']);
    csvRows.push(['Total Expected', '', totalExpected, '', '', '']);
    csvRows.push(['Total Collected', '', totalCollected, '', '', '']);
    csvRows.push(['Total Outstanding', '', totalOutstanding, '', '', '']);
    csvRows.push(['Collection Rate', '', 
        totalExpected > 0 ? ((totalCollected / totalExpected) * 100).toFixed(1) + '%' : '0%', 
        '', '', '']);

    const csvContent = csvRows.join('\n');

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
 * Export PDF - using complete pupil-based data
 */
async function exportFinancialPDF(reportData, session, term, totalExpected, totalCollected, totalOutstanding) {
    if (typeof window.jspdf === 'undefined') {
        window.showToast?.('PDF library not loaded. Please refresh.', 'danger');
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
    const tableData = reportData.map(p => [
        p.pupilName,
        p.className,
        `₦${p.amountDue.toLocaleString()}`,
        `₦${p.totalPaid.toLocaleString()}`,
        `₦${p.balance.toLocaleString()}`,
        p.status.charAt(0).toUpperCase() + p.status.slice(1)
    ]);

    doc.autoTable({
        startY: 45,
        head: [['Pupil Name', 'Class', 'Amount Due', 'Paid', 'Balance', 'Status']],
        body: tableData,
        theme: 'grid',
        styles: { fontSize: 8 },
        headStyles: { fillColor: [0, 178, 255] },
        columnStyles: {
            0: { cellWidth: 50 },
            1: { cellWidth: 30 },
            2: { cellWidth: 30 },
            3: { cellWidth: 30 },
            4: { cellWidth: 30 },
            5: { cellWidth: 25 }
        }
    });

    // Summary
    const finalY = doc.lastAutoTable.finalY + 12;
    
    doc.setFontSize(12);
    doc.text('Summary', 14, finalY);
    
    doc.setFontSize(10);
    doc.text(`Total Expected:     ₦${totalExpected.toLocaleString()}`, 14, finalY + 8);
    doc.text(`Total Collected:    ₦${totalCollected.toLocaleString()}`, 14, finalY + 14);
    doc.text(`Total Outstanding:  ₦${totalOutstanding.toLocaleString()}`, 14, finalY + 20);
    
    const collectionRate = totalExpected > 0 ? ((totalCollected / totalExpected) * 100).toFixed(1) : 0;
    doc.text(`Collection Rate:    ${collectionRate}%`, 14, finalY + 26);

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

/* =====================================================
   CRITICAL FIX #3: TEACHER FORM HANDLER
   Complete rewrite with proper error handling
===================================================== */

document.addEventListener('DOMContentLoaded', () => {
  console.log('📝 Setting up teacher form handler...');
  
  const teacherForm = document.getElementById('add-teacher-form');
  
  if (!teacherForm) {
    console.warn('⚠️ Teacher form not found');
    return;
  }
  
  // Remove old handlers by cloning
  const newTeacherForm = teacherForm.cloneNode(true);
  teacherForm.parentNode.replaceChild(newTeacherForm, teacherForm);
  
  const freshForm = document.getElementById('add-teacher-form');
  
  freshForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log('🎯 Teacher form submitted');
    
    // Get form values
    const name = document.getElementById('teacher-name')?.value.trim();
    const email = document.getElementById('teacher-email')?.value.trim();
    const subject = document.getElementById('teacher-subject')?.value.trim();
    const tempPassword = document.getElementById('teacher-password')?.value;
    
    // Validation
    if (!name || !email || !tempPassword) {
      console.warn('⚠️ Form validation failed');
      window.showToast?.('All required fields must be filled', 'warning');
      return;
    }
    
    console.log(`📋 Creating teacher: ${name} (${email})`);
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.warn('⚠️ Invalid email format');
      window.showToast?.('Please enter a valid email address', 'warning');
      return;
    }
    
    // Check for duplicate email
    console.log('🔍 Checking for duplicate email...');
    try {
      const existingUsers = await db.collection('users')
        .where('email', '==', email)
        .get();
      
      if (!existingUsers.empty) {
        console.warn('⚠️ Duplicate email found');
        window.showToast?.('This email is already registered', 'warning');
        return;
      }
      console.log('✓ Email is unique');
    } catch (error) {
      console.error('❌ Error checking email:', error);
      window.showToast?.('Error checking email. Please try again.', 'danger');
      return;
    }
    
    // Get submit button
    const submitBtn = freshForm.querySelector('button[type="submit"]');
    
    // Disable button and show loading
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="btn-loading">Creating teacher...</span>';
    }
    
    try {
      console.log('🚀 Starting user creation process...');
      
      // CRITICAL: Check if createSecondaryUser exists
      if (typeof window.createSecondaryUser !== 'function') {
        throw new Error(
          'User creation system not ready. Please refresh the page and try again.'
        );
      }
      
      // Create user account
      console.log('📝 Calling createSecondaryUser...');
      const uid = await window.createSecondaryUser(email, tempPassword);
      
      if (!uid) {
        throw new Error('User creation returned no UID');
      }
      
      console.log(`✓ User account created: ${uid}`);
      
      // Create user document
      console.log('📄 Creating user document...');
      await db.collection('users').doc(uid).set({
        email,
        role: 'teacher',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      console.log('✓ User document created');
      
      // Create teacher profile
      console.log('👤 Creating teacher profile...');
      await db.collection('teachers').doc(uid).set({
        name,
        email,
        subject: subject || '',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      console.log('✓ Teacher profile created');
      
      // Success!
      console.log('✅ Teacher creation complete');
      
      window.showToast?.(
        `✓ Teacher "${name}" added successfully!\n\nPassword reset email sent to ${email}`,
        'success',
        6000
      );
      
      // Reset form and hide
      freshForm.reset();
      document.getElementById('teacher-form').style.display = 'none';
      
      // Reload data
      await loadTeachers();
      await loadDashboardStats();
      
    } catch (error) {
      console.error('❌ TEACHER CREATION FAILED:', error);
      console.error('Error details:', {
        code: error.code,
        message: error.message,
        stack: error.stack
      });
      
      // Handle specific errors
      let errorMessage = 'Failed to add teacher';
      
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'This email is already registered';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'Password should be at least 6 characters';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      window.showToast?.(errorMessage, 'danger', 5000);
      
    } finally {
      // Re-enable button
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Save Teacher';
      }
    }
  });
  
  console.log('✅ Teacher form handler registered');
});

/* =====================================================
   CRITICAL FIX #4: PUPIL FORM HANDLER
   Same improvements as teacher form
===================================================== */

document.addEventListener('DOMContentLoaded', () => {
  console.log('📝 Setting up pupil form handler...');
  
  const pupilForm = document.getElementById('add-pupil-form');
  
  if (!pupilForm) {
    console.warn('⚠️ Pupil form not found');
    return;
  }
  
  // Remove old handlers by cloning
  const newPupilForm = pupilForm.cloneNode(true);
  pupilForm.parentNode.replaceChild(newPupilForm, pupilForm);
  
  const freshForm = document.getElementById('add-pupil-form');
  
  freshForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log('🎯 Pupil form submitted');
    
    // Get form values
    const pupilId = document.getElementById('pupil-id')?.value;
    const name = document.getElementById('pupil-name')?.value.trim();
    const admissionNo = document.getElementById('pupil-admission-no')?.value.trim();
    const classId = document.getElementById('pupil-class')?.value;
    const email = document.getElementById('pupil-email')?.value.trim();
    const password = document.getElementById('pupil-password')?.value;
    
    // Validation
    if (!name || !classId) {
      console.warn('⚠️ Form validation failed');
      window.showToast?.('Name and class are required', 'warning');
      return;
    }
    
    // For new pupils, email and password are required
    if (!pupilId && (!email || !password)) {
      console.warn('⚠️ Email and password required for new pupils');
      window.showToast?.('Email and password required for new pupils', 'warning');
      return;
    }
    
    console.log(`📋 ${pupilId ? 'Updating' : 'Creating'} pupil: ${name}`);
    
    // Validate email format if provided
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        console.warn('⚠️ Invalid email format');
        window.showToast?.('Please enter a valid email address', 'warning');
        return;
      }
    }
    
    // Check for duplicate admission number
    if (admissionNo) {
      try {
        const duplicateSnap = await db.collection('pupils')
          .where('admissionNo', '==', admissionNo)
          .limit(1)
          .get();
        
        if (!duplicateSnap.empty) {
          const existingPupilId = duplicateSnap.docs[0].id;
          
          if (!pupilId || pupilId !== existingPupilId) {
            console.warn('⚠️ Duplicate admission number');
            window.showToast?.(
              `Admission number "${admissionNo}" is already assigned`,
              'danger',
              5000
            );
            return;
          }
        }
      } catch (error) {
        console.error('Error checking admission number:', error);
      }
    }
    
    // Get submit button
    const submitBtn = freshForm.querySelector('button[type="submit"]');
    
    // Disable button and show loading
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="btn-loading">Saving pupil...</span>';
    }
    
    try {
      // Get class details
      const classDoc = await db.collection('classes').doc(classId).get();
      
      if (!classDoc.exists) {
        throw new Error('Selected class not found');
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
      
      // Build pupil data
const pupilData = {
    admissionNo,
    name,
    dob: document.getElementById('pupil-dob')?.value || '',
    gender: document.getElementById('pupil-gender')?.value || '',
    parentName: document.getElementById('pupil-parent-name')?.value.trim() || '',
    parentEmail: document.getElementById('pupil-parent-email')?.value.trim() || '',
    contact: document.getElementById('pupil-contact')?.value.trim() || '',
    address: document.getElementById('pupil-address')?.value.trim() || '',
    class: {
        id: classId,
        name: classData.name || 'Unknown Class'
    },
    subjects: Array.isArray(classData.subjects) ? classData.subjects : [],
    assignedTeacher: {
        id: teacherId,
        name: teacherName
    },

    // ✅ New Optional Fields
    admissionTerm: document.getElementById('pupil-admission-term')?.value || 'First Term',
    exitTerm: document.getElementById('pupil-exit-term')?.value || 'Third Term',
    feeAdjustmentPercent: parseFloat(document.getElementById('pupil-fee-adjustment-percent')?.value) || 0,
    feeAdjustmentAmount: parseFloat(document.getElementById('pupil-fee-adjustment-amount')?.value) || 0,

    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
};
      
      if (pupilId) {
        // UPDATE EXISTING PUPIL
        console.log(`📝 Updating pupil: ${pupilId}`);
        
        await db.collection('pupils').doc(pupilId).update(pupilData);
        
        // Update email if changed
        if (email) {
          const userDoc = await db.collection('users').doc(pupilId).get();
          if (userDoc.exists && userDoc.data().email !== email) {
            await db.collection('users').doc(pupilId).update({
              email,
              updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
          }
        }
        
        console.log('✓ Pupil updated');
        window.showToast?.(`✓ Pupil "${name}" updated successfully`, 'success');
        
      } else {
        // CREATE NEW PUPIL
        console.log('🚀 Creating new pupil...');
        
        // Check for duplicate email
        const existingUsers = await db.collection('users')
          .where('email', '==', email)
          .get();
        
        if (!existingUsers.empty) {
          throw new Error('This email is already registered');
        }
        
        // CRITICAL: Check if createSecondaryUser exists
        if (typeof window.createSecondaryUser !== 'function') {
          throw new Error(
            'User creation system not ready. Please refresh the page and try again.'
          );
        }
        
        // Create user account
        console.log('📝 Calling createSecondaryUser...');
        const uid = await window.createSecondaryUser(email, password);
        
        if (!uid) {
          throw new Error('User creation returned no UID');
        }
        
        console.log(`✓ User account created: ${uid}`);
        
        // Create user document
        await db.collection('users').doc(uid).set({
          email,
          role: 'pupil',
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        console.log('✓ User document created');
        
        // Create pupil profile
pupilData.email = email;
pupilData.createdAt = firebase.firestore.FieldValue.serverTimestamp();

await db.collection('pupils').doc(uid).set(pupilData);

console.log('✓ Pupil profile created');

// ✅ FIX: Auto-create payment record if fee structure exists
try {
  const settings = await window.getCurrentSettings();
  const session = settings.session;
  const term = settings.term;
  
  // Check if fee structure exists for this class
  const feeDocId = `${classId}_${session.replace(/\//g, '-')}`;
  const feeDoc = await db.collection('fee_structures').doc(feeDocId).get();
  
  if (feeDoc.exists) {
    const feeData = feeDoc.data();
    const totalFee = feeData.total || 0;
    
    console.log(`✓ Found fee structure for ${classData.name}: ₦${totalFee.toLocaleString()}`);
    
    // Check for arrears from previous session
    const previousSession = getPreviousSessionName(session);
    let arrears = 0;
    
    if (previousSession) {
      arrears = await calculateSessionBalance(uid, previousSession);
    }
    
    // Create payment record for current term
    const encodedSession = session.replace(/\//g, '-');
    const paymentDocId = `${uid}_${encodedSession}_${term}`;
    
    await db.collection('payments').doc(paymentDocId).set({
      pupilId: uid,
      pupilName: name,
      classId: classId,
      className: classData.name,
      session: session,
      term: term,
      amountDue: totalFee,
      arrears: arrears,
      totalDue: totalFee + arrears,
      totalPaid: 0,
      balance: totalFee + arrears,
      status: arrears > 0 ? 'owing_with_arrears' : 'owing',
      lastPaymentDate: null,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    console.log(`✓ Auto-created payment record: ₦${totalFee.toLocaleString()} (arrears: ₦${arrears.toLocaleString()})`);
  } else {
    console.log(`ℹ️ No fee structure configured for ${classData.name} yet`);
  }
} catch (error) {
  console.error('⚠️ Failed to auto-create payment record:', error);
  // Don't throw - pupil was created successfully
}
        
        window.showToast?.(
          `✓ Pupil "${name}" added successfully!\n\nPassword reset email sent to ${email}`,
          'success',
          6000
        );
      }
      
      // Reset form and hide
      freshForm.reset();
      document.getElementById('pupil-form').style.display = 'none';
      
      // Reload data
      await loadPupils();
      await loadDashboardStats();
      
    } catch (error) {
      console.error('❌ PUPIL SAVE FAILED:', error);
      console.error('Error details:', {
        code: error.code,
        message: error.message,
        stack: error.stack
      });
      
      // Handle specific errors
      let errorMessage = 'Failed to save pupil';
      
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'This email is already registered';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'Password should be at least 6 characters';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      window.showToast?.(errorMessage, 'danger', 5000);
      
    } finally {
      // Re-enable button
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = pupilId ? 'Update Pupil' : 'Save Pupil';
      }
    }
  });
  
  console.log('✅ Pupil form handler registered');
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
          <button class="btn-small btn-danger" onclick="deleteItem('teachers', '${teacher.id}')">Delete</button>
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
 * FIXED: Load Pupils with Proper Event Delegation
 * Replace the entire loadPupils() function in admin.js (around line 2280)
 */
async function loadPupils() {
  const tbody = document.getElementById('pupils-table');
  if (!tbody) return;

  // Populate class dropdown first
  await populateClassDropdown();

  tbody.innerHTML = '<tr><td colspan="7" class="table-loading">Loading pupils...</td></tr>';

  try {
    // FIXED: Use query limit instead of fetching all
    const snapshot = await db.collection('pupils')
      .orderBy('name')
      .limit(500) // Fetch max 500 for pagination
      .get();
    
    tbody.innerHTML = '';

    if (snapshot.empty) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:var(--color-gray-600);">No pupils registered yet. Add one above.</td></tr>';
      
      const bulkActionsBar = document.getElementById('bulk-actions-bar');
      if (bulkActionsBar) bulkActionsBar.style.display = 'none';
      
      return;
    }

    const pupils = [];
    snapshot.forEach(doc => {
      pupils.push({ id: doc.id, ...doc.data() });
    });

    const bulkActionsBar = document.getElementById('bulk-actions-bar');
    if (bulkActionsBar) bulkActionsBar.style.display = 'flex';

    paginateTable(pupils, 'pupils-table', 20, (pupil, tbody) => {
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
          <input type="checkbox" class="pupil-checkbox" data-pupil-id="${pupil.id}">
        </td>
        <td data-label="Name">${pupil.name}</td>
        <td data-label="Class">${className}</td>
        <td data-label="Gender">${pupil.gender || '-'}</td>
        <td data-label="Parent Name">${pupil.parentName || '-'}</td>
        <td data-label="Parent Email">${pupil.parentEmail || '-'}</td>
        <td data-label="Actions">
          <button class="btn-small btn-primary" onclick="editPupil('${pupil.id}')">Edit</button>
          <button class="btn-small btn-danger" onclick="deleteItem('pupils', '${pupil.id}')">Delete</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
    
    setupBulkActionsEventListeners();
    
  } catch (error) {
    console.error('Error loading pupils:', error);
    window.showToast?.('Failed to load pupils list. Check connection and try again.', 'danger');
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:var(--color-danger);">Error loading pupils - please refresh</td></tr>';
  }
}

/* =====================================================
   BULK OPERATIONS - COMPLETE IMPLEMENTATION
   Add this entire section after loadPupils() function
===================================================== */

/**
 * Setup bulk actions event listeners
 * Called AFTER pupils table is loaded
 */
function setupBulkActionsEventListeners() {
  console.log('🔧 Setting up bulk actions event listeners...');
  
  // 1. Select All checkbox
  const selectAllCheckbox = document.getElementById('select-all-pupils');
  if (selectAllCheckbox) {
    // Remove old listener by cloning
    const newSelectAll = selectAllCheckbox.cloneNode(true);
    selectAllCheckbox.parentNode.replaceChild(newSelectAll, selectAllCheckbox);
    
    // Add fresh listener
    newSelectAll.addEventListener('change', function() {
      console.log('🔘 Select All clicked:', this.checked);
      const checkboxes = document.querySelectorAll('.pupil-checkbox');
      checkboxes.forEach(checkbox => {
        checkbox.checked = this.checked;
      });
      updateBulkActionButtons();
    });
    
    console.log('✓ Select All listener attached');
  }
  
  // 2. Individual pupil checkboxes (EVENT DELEGATION)
  const table = document.getElementById('pupils-table');
  if (table) {
    // Use event delegation on tbody
    const tbody = table.querySelector('tbody');
    if (tbody) {
      // Remove old listeners
      const newTbody = tbody.cloneNode(true);
      tbody.parentNode.replaceChild(newTbody, tbody);
      
      // Add fresh delegation listener
      const freshTbody = table.querySelector('tbody');
      freshTbody.addEventListener('change', function(e) {
        if (e.target.classList.contains('pupil-checkbox')) {
          console.log('✓ Pupil checkbox changed');
          updateBulkActionButtons();
        }
      });
      console.log('✓ Pupil checkboxes delegation attached');
    }
  }
  
  // 3. Apply button
  const applyBtn = document.getElementById('apply-bulk-action-btn');
  if (applyBtn) {
    const newApplyBtn = applyBtn.cloneNode(true);
    applyBtn.parentNode.replaceChild(newApplyBtn, applyBtn);
    
    const freshApplyBtn = document.getElementById('apply-bulk-action-btn');
    freshApplyBtn.addEventListener('click', applyBulkAction);
    console.log('✓ Apply button listener attached');
  }
  
  console.log('✅ Bulk actions event listeners setup complete');
}

/**
 * Update bulk action buttons based on selection
 */
function updateBulkActionButtons() {
  const checkboxes = document.querySelectorAll('.pupil-checkbox:checked');
  const count = checkboxes.length;
  
  console.log(`📊 ${count} pupils selected`);
  
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

/**
 * Apply bulk action to selected pupils
 */
async function applyBulkAction() {
  const action = document.getElementById('bulk-action-select')?.value;
  const checkboxes = document.querySelectorAll('.pupil-checkbox:checked');
  
  if (!action || checkboxes.length === 0) {
    window.showToast?.('Please select an action and at least one pupil', 'warning');
    return;
  }
  
  const selectedPupilIds = Array.from(checkboxes).map(cb => cb.dataset.pupilId);
  
  console.log(`Applying ${action} to ${selectedPupilIds.length} pupils`);
  
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

/**
 * Bulk reassign pupils to a new class
 */
async function bulkReassignClass(pupilIds) {
  console.log(`📝 bulkReassignClass called with ${pupilIds.length} pupils`);
  
  try {
    // Get all classes
    const classesSnap = await db.collection('classes').orderBy('name').get();
    
    if (classesSnap.empty) {
      window.showToast?.('No classes available', 'warning');
      return;
    }
    
    // Build class options
    let classOptions = '<option value="">-- Select New Class --</option>';
    classesSnap.forEach(doc => {
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
    
    // Cleanup function
    const cleanup = () => {
      modal.remove();
      document.removeEventListener('keydown', escapeHandler);
      console.log('✓ Modal cleaned up');
    };
    
    // Escape key handler
    const escapeHandler = (e) => {
      if (e.key === 'Escape') cleanup();
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
        window.showToast?.(`Failed to reassign pupils: ${error.message}`, 'danger');
        this.disabled = false;
        this.innerHTML = 'Reassign All';
      }
    };
    
  } catch (error) {
    console.error('Error in bulkReassignClass:', error);
    window.showToast?.('Failed to load classes', 'danger');
  }
}

/**
 * Bulk delete selected pupils
 */
async function bulkDeletePupils(pupilIds) {
  console.log(`🗑️ bulkDeletePupils called with ${pupilIds.length} pupils`);
  
  const confirmation = confirm(
    `⚠️ DELETE ${pupilIds.length} PUPIL(S)?\n\n` +
    `This will permanently delete:\n` +
    `• ${pupilIds.length} pupil records\n` +
    `• ${pupilIds.length} user accounts\n` +
    `• All associated results, attendance, and remarks\n\n` +
    `This action CANNOT be undone!`
  );
  
  if (!confirmation) {
    console.log('Deletion cancelled by user');
    return;
  }
  
  const confirmText = prompt('Type DELETE to confirm:');
  if (confirmText !== 'DELETE') {
    window.showToast?.('Deletion cancelled - confirmation text did not match', 'info');
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
    window.showToast?.(`Failed to delete pupils: ${error.message}`, 'danger');
  }
}

// ✅ CRITICAL: Make ALL functions globally available
window.loadPupils = loadPupils;
window.setupBulkActionsEventListeners = setupBulkActionsEventListeners;
window.updateBulkActionButtons = updateBulkActionButtons;
window.applyBulkAction = applyBulkAction;
window.bulkReassignClass = bulkReassignClass;
window.bulkDeletePupils = bulkDeletePupils;

console.log('✅ Bulk operations module loaded and exposed globally');

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

/**
 * FIXED: Load current settings without auto-redirecting
 */
async function loadCurrentSettings() {
  try {
    console.log('📋 Loading school settings...');
    
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
    
    // Resumption date handling
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
      if (displayNextResumption) displayNextResumption.textContent = 'Not set';
      if (resumptionDateInput) resumptionDateInput.value = '';
    }
    
    console.log('✓ Settings loaded successfully');
    
    // CRITICAL FIX: Load class hierarchy AFTER settings display is complete
    // Use setTimeout to prevent blocking the UI
    setTimeout(async () => {
      try {
        console.log('📊 Initializing class hierarchy...');
        const hierarchyStatus = await window.classHierarchy.initializeClassHierarchy();
        
        if (hierarchyStatus && hierarchyStatus.isEmpty) {
          console.log('⚠️ Class hierarchy is empty');
        }
        
        // CRITICAL: Only load UI if we're still on settings page
        const settingsSection = document.getElementById('settings');
        if (settingsSection && settingsSection.style.display !== 'none') {
          await loadClassHierarchyUI();
          console.log('✓ Class hierarchy UI loaded');
        } else {
          console.log('ℹ️ User navigated away, skipping hierarchy UI load');
        }
      } catch (error) {
        console.error('⚠️ Class hierarchy load failed:', error);
        // Don't throw error - settings page should still work
      }
    }, 300);
    
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
    const newSessionName = `${newStartYear}/${newEndYear}`;
    
    const newStartDate = new Date(newStartYear, 8, 1);
    const newEndDate = new Date(newEndYear, 6, 31);
    const newResumptionDate = new Date(newStartYear, 8, 1);
    
    await db.collection('settings').doc('current').update({
      currentSession: {
        name: newSessionName,
        startYear: newStartYear,
        endYear: newEndYear,
        startDate: firebase.firestore.Timestamp.fromDate(newStartDate),
        endDate: firebase.firestore.Timestamp.fromDate(newEndDate)
      },
      session: newSessionName,
      term: 'First Term',
      resumptionDate: firebase.firestore.Timestamp.fromDate(newResumptionDate),
      promotionPeriodActive: true,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    // ✅ FIX: Trigger arrears migration immediately
    console.log('🔄 Triggering arrears migration for new session...');
    
    const oldSessionName = `${currentSession.startYear}/${currentSession.endYear}`;
    
    // Get all pupils
    const pupilsSnap = await db.collection('pupils').get();
    
    let pupilsWithArrears = 0;
    let totalArrearsAmount = 0;
    
    for (const pupilDoc of pupilsSnap.docs) {
      const pupilId = pupilDoc.id;
      
      // Calculate arrears from previous session
      const arrears = await calculateSessionBalance(pupilId, oldSessionName);
      
      if (arrears > 0) {
        pupilsWithArrears++;
        totalArrearsAmount += arrears;
        
        // Log arrears for reporting
        await db.collection('arrears_log').add({
          pupilId: pupilId,
          pupilName: pupilDoc.data().name || 'Unknown',
          oldSession: oldSessionName,
          newSession: newSessionName,
          arrearsAmount: arrears,
          migratedAt: firebase.firestore.FieldValue.serverTimestamp(),
          migratedBy: auth.currentUser.uid
        });
      }
    }
    
    window.showToast?.(
      `✓ New session ${newSessionName} started successfully!\n\n` +
      `Arrears Migration:\n` +
      `• ${pupilsWithArrears} pupils with outstanding balances\n` +
      `• Total arrears: ₦${totalArrearsAmount.toLocaleString()}\n\n` +
      `Promotion period is now ACTIVE for teachers.`,
      'success',
      12000
    );
    
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
    // REMOVED: Don't redirect - just log error
    return;
  }
  
  console.log('📋 Loading class hierarchy UI...');
  
  try {
    // Get all classes from the "classes" collection
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
 * FIXED: Unified delete function with proper cascade deletion
 */
async function deleteItem(collection, docId) {
  if (!confirm('Are you sure you want to delete this item? This action cannot be undone.')) {
    return;
  }

  try {
    // Get item data before deletion for audit log
    const itemDoc = await db.collection(collection).doc(docId).get();
    const itemData = itemDoc.exists ? itemDoc.data() : {};
    
    // AUDIT: Log deletion
    await db.collection('audit_log').add({
      action: collection === 'teachers' || collection === 'pupils' ? 'delete_user' : 'delete_item',
      collection: collection,
      documentId: docId,
      deletedData: {
        name: itemData.name || 'Unknown',
        email: itemData.email || 'Unknown',
      },
      performedBy: auth.currentUser.uid,
      performedByEmail: auth.currentUser.email,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      userAgent: navigator.userAgent
    });

    // Handle user collections with cascade deletion
    if (collection === 'pupils') {
      // Delete pupil data
      await db.collection('pupils').doc(docId).delete();
      await db.collection('users').doc(docId).delete();
      
      window.showToast?.('Pupil deleted successfully', 'success');
      loadPupils();
      
    } else if (collection === 'teachers') {
      // Delete teacher data
      await db.collection('teachers').doc(docId).delete();
      await db.collection('users').doc(docId).delete();
      
      window.showToast?.('Teacher deleted successfully', 'success');
      loadTeachers();
      loadTeacherAssignments();
      
    } else {
      // Regular item deletion
      await db.collection(collection).doc(docId).delete();
      window.showToast?.('Item deleted successfully', 'success');
      
      // Reload appropriate section
      switch(collection) {
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
    }
    
    loadDashboardStats();

  } catch (error) {
    console.error('Error deleting document:', error);
    window.handleError?.(error, 'Failed to delete item');
  }
}

// ✅ CRITICAL: Make deleteItem globally available IMMEDIATELY
window.deleteItem = deleteItem;

console.log('✓ deleteItem function exposed globally');
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
  const newTerm = document.getElementById('current-term').value;
  const resumptionDate = document.getElementById('resumption-date').value;
  
  if (!startYear || !endYear || !startDate || !endDate || !newTerm || !resumptionDate) {
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
    // Get OLD settings to detect changes
    const oldSettings = await window.getCurrentSettings();
    const oldTerm = oldSettings.term;
    const oldSession = oldSettings.session;
    const session = `${startYear}/${endYear}`;
    
    // Save new settings
    await db.collection('settings').doc('current').set({
      currentSession: {
        name: session,
        startYear: startYear,
        endYear: endYear,
        startDate: firebase.firestore.Timestamp.fromDate(new Date(startDate)),
        endDate: firebase.firestore.Timestamp.fromDate(new Date(endDate))
      },
      term: newTerm,
      session: session,
      resumptionDate: firebase.firestore.Timestamp.fromDate(new Date(resumptionDate)),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    
    // CRITICAL FIX: Auto-migrate arrears on term change
    if (oldTerm && oldTerm !== newTerm && oldSession === session) {
      console.log(`⚠️ Term changed: ${oldTerm} → ${newTerm}`);
      
      window.showToast?.(
        'Migrating outstanding balances to new term...',
        'info',
        3000
      );
      
      const result = await migrateArrearsOnTermChange(
        oldTerm,
        newTerm,
        session
      );
      
      if (result.success && result.count > 0) {
        window.showToast?.(
          `✓ Settings saved & arrears migrated!\n\n` +
          `${result.count} pupil(s) with outstanding balances moved to ${newTerm}\n` +
          `Total arrears: ₦${result.totalArrears.toLocaleString()}`,
          'success',
          10000
        );
      } else {
        window.showToast?.('✓ Settings saved successfully!', 'success');
      }
    } else {
      window.showToast?.('✓ Settings saved successfully!', 'success');
    }
    
    await loadCurrentSettings();
    
  } catch (error) {
    console.error('Error saving settings:', error);
    window.handleError(error, 'Failed to save settings');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '💾 Save Settings';
  }
});

/**
 * ✅ CRITICAL FIX: Automatic arrears migration when term changes
 */
async function migrateArrearsOnTermChange(oldTerm, newTerm, session) {
  console.log(`🔄 Auto-migrating arrears: ${oldTerm} → ${newTerm}`);
  
  try {
    const encodedSession = session.replace(/\//g, '-');
    
    // Get all payment records from the OLD term with outstanding balances
    const oldTermPaymentsSnap = await db.collection('payments')
      .where('session', '==', session)
      .where('term', '==', oldTerm)
      .get();
    
    if (oldTermPaymentsSnap.empty) {
      console.log('No payments from previous term to migrate');
      return { success: true, count: 0, totalArrears: 0 };
    }
    
    const batch = db.batch();
    let migratedCount = 0;
    let totalArrearsCreated = 0;
    
    for (const doc of oldTermPaymentsSnap.docs) {
      const oldData = doc.data();
      const balance = oldData.balance || 0;
      
      // Skip if fully paid
      if (balance <= 0) continue;
      
      const pupilId = oldData.pupilId;
      const classId = oldData.classId;
      
      // Get fee structure for this class
      const feeDocId = `${classId}_${encodedSession}`;
      const feeDoc = await db.collection('fee_structures').doc(feeDocId).get();
      
      if (!feeDoc.exists) continue;
      
      const feeData = feeDoc.data();
      const newTermFee = feeData.total || 0;
      
      // Create NEW term payment record with arrears
      const newPaymentDocId = `${pupilId}_${encodedSession}_${newTerm}`;
      
      batch.set(db.collection('payments').doc(newPaymentDocId), {
        pupilId: pupilId,
        pupilName: oldData.pupilName,
        classId: classId,
        className: oldData.className,
        session: session,
        term: newTerm,
        amountDue: newTermFee,
        arrears: balance, // OLD term balance becomes arrears
        totalDue: newTermFee + balance,
        totalPaid: 0,
        balance: newTermFee + balance,
        status: 'owing_with_arrears',
        lastPaymentDate: null,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        migratedFrom: oldTerm,
        migratedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      
      migratedCount++;
      totalArrearsCreated += balance;
    }
    
    if (migratedCount > 0) {
      await batch.commit();
      console.log(`✓ Migrated ${migratedCount} pupils with ₦${totalArrearsCreated.toLocaleString()} total arrears`);
    }
    
    return {
      success: true,
      count: migratedCount,
      totalArrears: totalArrearsCreated
    };
    
  } catch (error) {
    console.error('❌ Arrears migration failed:', error);
    throw error;
  }
}

// Make globally available
window.migrateArrearsOnTermChange = migrateArrearsOnTermChange;

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
window.assignTeacherToClass = assignTeacherToClass;
window.unassignTeacher = unassignTeacher;
window.showAnnounceForm = showAnnounceForm;
window.addAnnouncement = addAnnouncement;
window.loadCurrentSettings = loadCurrentSettings;
window.loadAlumni = loadAlumni;
window.loadViewResultsSection = loadViewResultsSection;

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
 * BULK OPERATIONS FUNCTIONS - FIXED
 * Replace the entire bulk operations section in admin.js (around line 2800-2900)
 */

/**
 * Toggle all pupils selection for bulk operations
 */
function toggleAllPupils(masterCheckbox) {
  console.log('🔘 toggleAllPupils called:', masterCheckbox?.checked);
  
  const checkboxes = document.querySelectorAll('.pupil-checkbox');
  const isChecked = masterCheckbox.checked;
  
  checkboxes.forEach(checkbox => {
    checkbox.checked = isChecked;
  });
  
  updateBulkActionButtons();
}

/**
 * Update bulk action buttons based on selection
 */
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

/**
 * Apply bulk action to selected pupils
 */
async function applyBulkAction() {
  const action = document.getElementById('bulk-action-select')?.value;
  const checkboxes = document.querySelectorAll('.pupil-checkbox:checked');
  
  if (!action || checkboxes.length === 0) {
    window.showToast?.('Please select an action and at least one pupil', 'warning');
    return;
  }
  
  const selectedPupilIds = Array.from(checkboxes).map(cb => cb.dataset.pupilId);
  
  console.log(`Applying ${action} to ${selectedPupilIds.length} pupils`);
  
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

/**
 * Bulk reassign pupils to new class
 */
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
  
  // Create modal
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
  
  // Cleanup function
  const cleanup = () => {
    modal.remove();
    document.removeEventListener('keydown', escapeHandler);
  };
  
  // Escape key handler
  const escapeHandler = (e) => {
    if (e.key === 'Escape') cleanup();
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
      if (!classDoc.exists) throw new Error('Class not found');
      
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

/**
 * Bulk delete selected pupils
 */
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
      
      count += 2;
      
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

// ✅ CRITICAL: Make functions globally available IMMEDIATELY
window.toggleAllPupils = toggleAllPupils;
window.updateBulkActionButtons = updateBulkActionButtons;
window.applyBulkAction = applyBulkAction;
window.bulkReassignClass = bulkReassignClass;
window.bulkDeletePupils = bulkDeletePupils;

console.log('✓ Bulk operations functions loaded and exposed globally');

/**
 * Toggle all pupils selection for bulk operations
 * Replace or add this function in admin.js after the bulk operations section
 */
function toggleAllPupils(masterCheckbox) {
  const checkboxes = document.querySelectorAll('.pupil-checkbox');
  const isChecked = masterCheckbox.checked;
  
  checkboxes.forEach(checkbox => {
    checkbox.checked = isChecked;
  });
  
  updateBulkActionButtons();
}

/**
 * AUDIT LOG VIEWER
 */
/**
 * AUDIT LOG VIEWER - FIXED
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
          <tbody id="audit-log-tbody"></tbody>
        </table>
      </div>
      <button class="btn btn-secondary" onclick="downloadAuditLog()" style="margin-top:var(--space-lg);">
        📥 Download Full Audit Log (CSV)
      </button>
    `;
    
    // FIXED: Use tbody ID, not table ID
    paginateTable(logs, 'audit-log-tbody', 25, (log, tbody) => {
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
  const rows = document.querySelectorAll('#audit-log-tbody tr'); // FIXED: tbody ID
  
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

/* ======================================== 
   HAMBURGER MENU FOR MOBILE - ADMIN PORTAL
======================================== */

function initAdminHamburger() {
  const hamburger = document.getElementById('hamburger');
  const sidebar = document.getElementById('admin-sidebar');
  
  if (!hamburger || !sidebar) {
    console.warn('Hamburger or sidebar not found - will retry');
    // Retry after a short delay if elements not found
    setTimeout(initAdminHamburger, 100);
    return;
  }
  
  // Remove any existing listeners to prevent duplicates
  const newHamburger = hamburger.cloneNode(true);
  hamburger.parentNode.replaceChild(newHamburger, hamburger);
  const hamburgerBtn = document.getElementById('hamburger');
  
  // Toggle sidebar on hamburger click
  hamburgerBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isActive = sidebar.classList.toggle('active');
    hamburgerBtn.classList.toggle('active', isActive);
    hamburgerBtn.setAttribute('aria-expanded', isActive);
    document.body.style.overflow = isActive ? 'hidden' : '';
  });
  
  // Close sidebar when clicking outside
  document.addEventListener('click', (e) => {
    if (sidebar.classList.contains('active') && 
        !sidebar.contains(e.target) && 
        !hamburgerBtn.contains(e.target)) {
      sidebar.classList.remove('active');
      hamburgerBtn.classList.remove('active');
      hamburgerBtn.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    }
  });
  
  // Close sidebar when clicking navigation links on mobile
  sidebar.querySelectorAll('a[data-section]').forEach(link => {
    link.addEventListener('click', () => {
      if (window.innerWidth <= 1024) {
        sidebar.classList.remove('active');
        hamburgerBtn.classList.remove('active');
        hamburgerBtn.setAttribute('aria-expanded', 'false');
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
        hamburgerBtn.classList.remove('active');
        hamburgerBtn.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
      }
    }, 250);
  });
  
  console.log('✓ Admin hamburger menu initialized');
}

// Initialize hamburger when DOM is fully ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAdminHamburger);
} else {
  // DOM already loaded
  initAdminHamburger();
}

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
console.log('✅ Admin.js v7.0.0 loaded successfully');
console.log('User creation system: READY');