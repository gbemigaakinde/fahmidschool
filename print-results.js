/**
 * FAHMID NURSERY & PRIMARY SCHOOL
 * Print Results JavaScript - FIXED
 *
 * Purpose:
 * - Generate dynamic termly report card
 * - Pull live pupil bio, class, teacher, subjects
 * - Reflect admin changes instantly
 * - Support session parameter from pupil portal (?session=2023/2024)
 *
 * Version: 6.3.0 - SESSION URL PARAMETER SUPPORT
 * Date: 2026-02-28
 */
 
'use strict';

let currentPupilId = null;
let pupilProfile = null;

let currentSettings = {
    term: 'First Term',
    session: '',
    resumptionDate: '-'
};

/* ===============================
   READ SESSION FROM URL (NEW)
================================ */

/**
 * Returns the session from the URL ?session= param, or null if absent/current.
 * e.g. print-results.html?session=2023%2F2024 → "2023/2024"
 */
function getSessionFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const s = params.get('session');
    return (s && s !== 'current') ? s : null;
}

/* ===============================
   INITIALIZATION WITH PROPER ORDER
================================ */
let isInitialized = false;

/* ===============================
   DUAL-ROLE AUTH HELPER
================================ */
async function _checkRoleForPrintResults_v2() {
  return new Promise((resolve, reject) => {
    firebase.auth().onAuthStateChanged(async user => {
      if (!user) {
        window.location.href = 'index.html';
        reject(new Error('Not logged in'));
        return;
      }
      try {
        const userDoc = await db.collection('users').doc(user.uid).get();
        if (!userDoc.exists) {
          window.location.href = 'index.html';
          reject(new Error('User profile not found'));
          return;
        }
        const role = userDoc.data().role;
        if (role === 'admin' || role === 'pupil') {
          resolve(user);
        } else {
          window.location.href = 'index.html';
          reject(new Error('Insufficient permissions'));
        }
      } catch (err) {
        reject(err);
      }
    });
  });
}
_checkRoleForPrintResults_v2()
  .then(async user => {

    // ── Determine pupilId ──────────────────────────────────────────────────
    const urlParams  = new URLSearchParams(window.location.search);
    const urlPupilId = urlParams.get('pupilId');
    const urlSession = urlParams.get('session'); // optional override

    const userDoc  = await db_pr.collection('users').doc(user.uid).get();
    const userRole = userDoc.exists ? userDoc.data().role : 'pupil';
    const isAdmin  = userRole === 'admin';

    if (isAdmin) {
      if (!urlPupilId) {
        document.body.innerHTML = `
          <div style="display:flex;flex-direction:column;align-items:center;
                      justify-content:center;min-height:80vh;font-family:sans-serif;
                      color:#374151;text-align:center;padding:2rem;">
            <div style="font-size:3rem;margin-bottom:1rem;">🔍</div>
            <h2 style="margin:0 0 .5rem;">No Pupil Selected</h2>
            <p style="color:#6b7280;margin-bottom:1.5rem;">
              Use the <strong>View Results</strong> section in the admin portal
              and click <em>Open Full Report / Print</em>.
            </p>
            <a href="admin.html"
               style="background:#00B2FF;color:white;padding:.6rem 1.4rem;
                      border-radius:6px;text-decoration:none;font-weight:600;">
              ← Back to Admin Portal
            </a>
          </div>`;
        return;
      }
      currentPupilId = urlPupilId;
    } else {
      currentPupilId = user.uid;
    }

    // ── Admin overlay bar ─────────────────────────────────────────────────
    if (isAdmin) {
      const bar = document.createElement('div');
      bar.id = 'admin-view-bar';
      bar.style.cssText =
        'position:fixed;top:0;left:0;right:0;z-index:9999;' +
        'background:#1e40af;color:white;padding:10px 20px;' +
        'display:flex;align-items:center;justify-content:space-between;' +
        'font-family:sans-serif;font-size:14px;font-weight:600;' +
        'box-shadow:0 2px 8px rgba(0,0,0,.25);';
      bar.innerHTML = `
        <span>🔐 Admin View</span>
        <div style="display:flex;gap:12px;align-items:center;">
          <button onclick="window.print()"
            style="background:rgba(255,255,255,.2);border:none;color:white;
                   padding:6px 14px;border-radius:4px;cursor:pointer;
                   font-weight:600;font-size:13px;">🖨️ Print</button>
          <a href="admin.html"
            style="background:rgba(255,255,255,.2);color:white;
                   padding:6px 14px;border-radius:4px;text-decoration:none;
                   font-weight:600;font-size:13px;">← Back to Admin</a>
        </div>`;
      document.body.insertBefore(bar, document.body.firstChild);
      document.body.style.paddingTop = '48px';
      const ps = document.createElement('style');
      ps.textContent =
        '@media print{#admin-view-bar{display:none!important}' +
        'body{padding-top:0!important}}';
      document.head.appendChild(ps);
    }

    // ── Continue with the rest of print-results.js as-is ─────────────────
    // currentPupilId is already set, so existing fetchPupilProfile and loadReportData calls work
    await fetchSchoolSettings();
    const sessionOverride = getSessionFromUrl();
    if (sessionOverride) currentSettings.session = sessionOverride;
    await fetchPupilProfile(currentPupilId);
    setupTermSelector();
    updateReportHeader();
    isInitialized = true;
    await loadReportData();

  })
  .catch(err => {
    console.error('Authentication failed:', err);
    window.location.href = 'index.html';
  });

/* ===============================
   FETCH SCHOOL SETTINGS
================================ */

async function fetchSchoolSettings() {
    try {
        const doc = await db.collection('settings').doc('current').get();
        
        if (!doc.exists) {
            console.warn('Settings document not found');
            return;
        }

        const data = doc.data();
        currentSettings.term = data.term || currentSettings.term;
        currentSettings.session = data.session || '';
        currentSettings.resumptionDate = data.resumptionDate || '-';
        
        console.log('Settings loaded successfully:', currentSettings);
    } catch (error) {
        console.error('Error loading settings:', error);
        throw error;
    }
}

/* ===============================
   FETCH PUPIL PROFILE (CORE FIX)
================================ */

async function fetchPupilProfile(uid) {
    try {
        const doc = await db.collection('pupils').doc(uid).get();
        
        if (!doc.exists) {
            throw new Error('Pupil record not found');
        }

        pupilProfile = doc.data();
        currentPupilId = doc.id;

        /* ===============================
           BIO
        ================================== */
        setText('student-name', pupilProfile.name || '-');
        setText('student-gender', pupilProfile.gender || '-');
        setText('admission-no', pupilProfile.admissionNo || '-');

        /* ===============================
           HANDLE CLASS DATA (OLD & NEW)
        ================================== */
        let classId = null;
        let className = '-';

        if (pupilProfile.class) {
            if (typeof pupilProfile.class === 'object') {
                // New format
                classId = pupilProfile.class.id;
                className = pupilProfile.class.name || '-';
            } else if (typeof pupilProfile.class === 'string') {
                // Old format
                className = pupilProfile.class;

                // Try to find class by name
                const classSnap = await db.collection('classes')
                    .where('name', '==', className)
                    .limit(1)
                    .get();

                if (!classSnap.empty) {
                    const classDoc = classSnap.docs[0];
                    classId = classDoc.id;
                    className = classDoc.data().name || className;
                }
            }
        }

        setText('student-class', className);

        /* ===============================
           FETCH CLASS TEACHER AND SUBJECTS
        ================================== */
        let teacherName = '-';
        let subjectsList = '-';

        if (classId) {
            const classDoc = await db.collection('classes').doc(classId).get();
            if (classDoc.exists) {
                const classData = classDoc.data();

                // Teacher
                if (classData.teacherName) {
                    teacherName = classData.teacherName;
                } else if (classData.teacherId) {
                    const teacherDoc = await db.collection('teachers').doc(classData.teacherId).get();
                    if (teacherDoc.exists) teacherName = teacherDoc.data().name;
                }

                // Subjects
                if (Array.isArray(classData.subjects) && classData.subjects.length > 0) {
                    subjectsList = classData.subjects.join(', ');
                }
            }
        }

        setText('class-teacher', teacherName);
        setText('subjects-list', subjectsList);
        
        console.log('Pupil profile loaded successfully');
    } catch (error) {
        console.error('Error loading pupil profile:', error);
        throw error;
    }
}

/* ===============================
   TERM SELECTOR
================================ */

/**
 * FIXED: Term Selector with Proper Default Value Handling
 * Ensures correct term is selected after cloning
 */
function setupTermSelector() {
    const select = document.getElementById('print-term');
    if (!select) {
        console.error('❌ Term selector element not found!');
        return;
    }

    console.log('✓ Setting up term selector, current term:', currentSettings.term);
    
    // CRITICAL FIX: Store the current term BEFORE any DOM manipulation
    const termToSelect = currentSettings.term;
    
    // Update display text
    setText('current-term', termToSelect);

    // Remove any existing listeners by cloning
    const newSelect = select.cloneNode(true);
    
    // CRITICAL FIX: Set default value AFTER cloning by marking option as selected
    Array.from(newSelect.options).forEach(option => {
        if (option.value === termToSelect) {
            option.selected = true;
        } else {
            option.selected = false;
        }
    });
    
    // Replace old select with new one
    select.parentNode.replaceChild(newSelect, select);

    // Add event listener to the NEW select element
    newSelect.addEventListener('change', async e => {
        currentSettings.term = e.target.value;
        console.log('Term changed to:', currentSettings.term);
        setText('current-term', currentSettings.term);
        updateReportHeader();
        await loadReportData();
    });
    
    // VERIFICATION: Log final selected value
    console.log('✓ Term selector ready, selected value:', newSelect.value);
    
    // Double-check the value is correct
    if (newSelect.value !== termToSelect) {
        console.warn('⚠️ Term selector value mismatch, forcing correct value');
        newSelect.value = termToSelect;
    }
}

/* ===============================
   UPDATE HEADER FIELDS
================================ */

function updateReportHeader() {
    setText(
        'report-title',
        `${currentSettings.term} Report Card - ${currentSettings.session} Session`
    );

    setText('current-session', currentSettings.session || '-');

    // Only show resumption date for current session
    const urlSession = getSessionFromUrl();
    if (urlSession) {
        // Historical session — no resumption date shown
        setText('resumption-date', '-');
    } else if (currentSettings.resumptionDate?.toDate) {
        setText(
            'resumption-date',
            currentSettings.resumptionDate
                .toDate()
                .toLocaleDateString('en-GB')
        );
    } else {
        setText('resumption-date', currentSettings.resumptionDate || '-');
    }
}

/* ===============================
   LOAD ALL REPORT DATA
================================ */

async function loadReportData() {
    console.log('=== Loading Report Data ===');
    console.log('Pupil ID:', currentPupilId);
    console.log('Term:', currentSettings.term);
    console.log('Session:', currentSettings.session);
    console.log('Initialized:', isInitialized);
    
    resetTraitsAndRemarks();

    try {
        await Promise.all([
            loadAcademicResults(),
            loadAttendance(),
            loadBehavioralTraits(),
            loadPsychomotorSkills(),
            loadRemarks()
        ]);
        console.log('=== Report Data Loaded Successfully ===');
    } catch (error) {
        console.error('=== Error Loading Report Data ===', error);
        window.showToast?.('Failed to load some report data', 'warning');
    }
}

/* ===============================
   ACADEMIC RESULTS (FIXED)
================================ */

/**
 * ✅ FIXED: Load Academic Results - Only Show Approved Results
 * Added status filter to prevent draft results from appearing
 */
async function loadAcademicResults() {
    const tbody = document.getElementById('academic-tbody');
    
    if (!tbody) {
        console.error('Academic tbody element not found');
        return;
    }
    
    // CRITICAL FIX: Wait for initialization with TIMEOUT
    if (!isInitialized || !currentPupilId || !currentSettings.session || !currentSettings.term) {
        console.log('Waiting for complete initialization...', {
            isInitialized,
            hasPupilId: !!currentPupilId,
            hasSession: !!currentSettings.session,
            hasTerm: !!currentSettings.term
        });
        
        tbody.innerHTML = loadingRow();
        
        // TIMEOUT PROTECTION: Maximum 10 seconds (100 attempts × 100ms)
        let attempts = 0;
        const maxAttempts = 100;
        let timedOut = false;
        
        while (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Check if ALL required data is now available
            if (isInitialized && currentPupilId && currentSettings.session && currentSettings.term) {
                console.log('✓ All data ready after', attempts * 100, 'ms');
                break;
            }
            
            attempts++;
        }
        
        // Check if we timed out
        if (attempts >= maxAttempts) {
            timedOut = true;
            console.error('❌ Initialization timeout after 10 seconds');
        }
        
        // Final validation after waiting
        if (timedOut || !isInitialized || !currentPupilId || !currentSettings.session || !currentSettings.term) {
            const missingData = [];
            if (!isInitialized) missingData.push('initialization incomplete');
            if (!currentPupilId) missingData.push('pupil ID missing');
            if (!currentSettings.session) missingData.push('session missing');
            if (!currentSettings.term) missingData.push('term missing');
            
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align:center; padding:var(--space-2xl);">
                        <div style="color:var(--color-danger); margin-bottom:var(--space-md);">
                            <strong>⚠️ Unable to load results</strong>
                        </div>
                        <p style="color:var(--color-gray-600); margin-bottom:var(--space-lg);">
                            ${timedOut ? 'Loading timed out after 10 seconds.' : 'Required data not available.'}<br>
                            Missing: ${missingData.join(', ')}
                        </p>
                        <button class="btn btn-primary" onclick="location.reload()" style="margin-top:var(--space-md);">
                            🔄 Reload Page
                        </button>
                        <p style="font-size:var(--text-sm); color:var(--color-gray-500); margin-top:var(--space-md);">
                            If this persists, check your internet connection or contact support.
                        </p>
                    </td>
                </tr>
            `;
            return;
        }
    }
    
    console.log('Loading academic results for:', {
        pupilId: currentPupilId,
        term: currentSettings.term,
        session: currentSettings.session
    });
    
    tbody.innerHTML = loadingRow();

    try {
        // ✅ CRITICAL FIX: Query by pupilId, term, session, AND status
        const resultsSnap = await db.collection('results')
            .where('pupilId', '==', currentPupilId)
            .where('term', '==', currentSettings.term)
            .where('session', '==', currentSettings.session)
            .where('status', '==', 'approved')
            .get();
        
        console.log(`Query returned ${resultsSnap.size} approved results`);
        
        if (resultsSnap.empty) {
            console.log('No approved results found with query. Trying alternative method...');
            
            // ✅ FALLBACK: Try loading all results for this pupil and filter by status
            const allResultsSnap = await db.collection('results')
                .where('pupilId', '==', currentPupilId)
                .get();
            
            const results = [];
            
            allResultsSnap.forEach(doc => {
                const data = doc.data();
                
                // ✅ CRITICAL FIX: Check status is approved OR legacy (missing status field)
                const isApproved = !data.status || data.status === 'approved';
                const matchesTerm = data.term === currentSettings.term;
                const matchesSession = data.session === currentSettings.session;
                
                if (isApproved && matchesTerm && matchesSession) {
                    results.push({
                        subject: data.subject || 'Unknown Subject',
                        caScore: typeof data.caScore === 'number' ? data.caScore : 0,
                        examScore: typeof data.examScore === 'number' ? data.examScore : 0
                    });
                }
            });
            
            console.log(`Fallback method found ${results.length} approved results`);
            
            if (results.length === 0) {
                tbody.innerHTML = emptyRow(
                    `No approved results available for ${currentSettings.term}, ${currentSettings.session} session`
                );
                return;
            }
            
            renderResults(results, tbody);
        } else {
            const results = [];
            
            resultsSnap.forEach(doc => {
                const data = doc.data();
                results.push({
                    subject: data.subject || 'Unknown Subject',
                    caScore: typeof data.caScore === 'number' ? data.caScore : 0,
                    examScore: typeof data.examScore === 'number' ? data.examScore : 0
                });
            });
            
            renderResults(results, tbody);
        }

    } catch (error) {
        console.error('Error loading results:', error);
        
        let errorMessage = 'Error loading results';
        let canRetry = true;
        
        if (error.code === 'permission-denied') {
            errorMessage = 'Permission denied. Contact administrator.';
            canRetry = false;
            window.showToast?.('You do not have permission to view results', 'danger');
        } else if (error.code === 'unavailable') {
            errorMessage = 'Service unavailable. Check your internet connection.';
            window.showToast?.('Cannot connect to server. Please check your internet.', 'warning');
        } else if (error.code === 'not-found') {
            errorMessage = 'Results data not found.';
            canRetry = false;
        } else {
            errorMessage = `Error: ${error.message || 'Unknown error'}`;
        }
        
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align:center; padding:var(--space-2xl);">
                    <div style="color:var(--color-danger); margin-bottom:var(--space-md);">
                        <strong>⚠️ ${errorMessage}</strong>
                    </div>
                    ${canRetry ? `
                        <button class="btn btn-primary" onclick="loadAcademicResults()" style="margin-top:var(--space-md);">
                            🔄 Retry
                        </button>
                    ` : `
                        <button class="btn btn-primary" onclick="location.reload()" style="margin-top:var(--space-md);">
                            🔄 Reload Page
                        </button>
                    `}
                </td>
            </tr>
        `;
    }
}

function renderResults(results, tbody) {
    tbody.innerHTML = '';
    
    if (results.length === 0) {
        tbody.innerHTML = emptyRow('No results available');
        return;
    }
    
    // Sort alphabetically by subject
    results.sort((a, b) => a.subject.localeCompare(b.subject));

    let totalScore = 0;
    let subjectCount = 0;

    // Display each result
    results.forEach(r => {
        const ca = r.caScore;
        const exam = r.examScore;
        const score = ca + exam;

        totalScore += score;
        subjectCount++;

        tbody.insertAdjacentHTML('beforeend', `
            <tr>
                <td>${r.subject}</td>
                <td>${ca}</td>
                <td>${exam}</td>
                <td><strong>${score}</strong></td>
                <td class="grade-${getGrade(score)}">${getGrade(score)}</td>
                <td>${getRemark(score)}</td>
            </tr>
        `);
    });

    // Add summary
    if (subjectCount > 0) {
        const average = (totalScore / subjectCount).toFixed(1);
        const avgGrade = getGrade(parseFloat(average));

        tbody.insertAdjacentHTML('beforeend', `
            <tr class="summary-row">
                <td colspan="3"><strong>TOTAL SCORE</strong></td>
                <td colspan="3"><strong>${totalScore} / ${subjectCount * 100}</strong></td>
            </tr>
            <tr class="summary-row">
                <td colspan="3"><strong>AVERAGE</strong></td>
                <td colspan="3"><strong>${average}% (${avgGrade})</strong></td>
            </tr>
        `);
    }
    
    console.log(`✓ Rendered ${results.length} results successfully`);
}

/* ===============================
   ATTENDANCE (FIXED)
================================ */

async function loadAttendance() {
    try {
        if (!currentPupilId || !currentSettings.term || !currentSettings.session) {
            console.warn('Missing data for attendance');
            setText('times-opened', '-');
            setText('times-present', '-');
            setText('times-absent', '-');
            return;
        }

        // FIX: Document ID now includes encoded session to match teacher.js write format
        const encodedSession = currentSettings.session.replace(/\//g, '-');
        const docId = `${currentPupilId}_${encodedSession}_${currentSettings.term}`;
        console.log('Loading attendance for:', docId);

        const doc = await db.collection('attendance').doc(docId).get();

        if (!doc.exists) {
            console.log('No attendance data found for:', docId);
            setText('times-opened', '-');
            setText('times-present', '-');
            setText('times-absent', '-');
            return;
        }

        const d = doc.data();

        if (!d) {
            console.warn('Attendance document exists but has no data');
            setText('times-opened', '-');
            setText('times-present', '-');
            setText('times-absent', '-');
            return;
        }

        console.log('Attendance data:', d);

        setText('times-opened', typeof d.timesOpened === 'number' ? d.timesOpened : '-');
        setText('times-present', typeof d.timesPresent === 'number' ? d.timesPresent : '-');
        setText('times-absent', typeof d.timesAbsent === 'number' ? d.timesAbsent : '-');

    } catch (error) {
        console.error('Error loading attendance:', error);
        setText('times-opened', '-');
        setText('times-present', '-');
        setText('times-absent', '-');
    }
}

/* ===============================
   TRAITS & SKILLS
================================ */

async function loadBehavioralTraits() {
    await loadKeyedCollection('behavioral_traits', 'trait-');
}

async function loadPsychomotorSkills() {
    await loadKeyedCollection('psychomotor_skills', 'skill-');
}

async function loadKeyedCollection(collection, prefix) {
    try {
        if (!collection || !prefix) {
            console.error('loadKeyedCollection called with invalid parameters');
            return;
        }

        if (!currentPupilId || !currentSettings.term || !currentSettings.session) {
            console.warn(`Cannot load ${collection}: Missing pupil, term, or session data`);
            return;
        }

        // FIX: Document ID now includes encoded session to match teacher.js write format
        const encodedSession = currentSettings.session.replace(/\//g, '-');
        const docId = `${currentPupilId}_${encodedSession}_${currentSettings.term}`;

        const doc = await db.collection(collection).doc(docId).get();

        if (!doc.exists) {
            console.log(`No ${collection} data for:`, docId);
            return;
        }

        const data = doc.data();

        if (!data) {
            console.warn(`${collection} document exists but has no data`);
            return;
        }

        Object.entries(data).forEach(([k, v]) => {
            // Skip metadata fields
            if (k === 'pupilId' || k === 'term' || k === 'teacherId' ||
                k === 'updatedAt' || k === 'session' || k === 'sessionStartYear' ||
                k === 'sessionEndYear' || k === 'sessionTerm') return;

            const fieldId = prefix + k.toLowerCase();
            const element = document.getElementById(fieldId);

            if (element) {
                setText(fieldId, v !== null && v !== undefined ? v : '-');
            }
        });

    } catch (error) {
        console.error(`Error loading ${collection}:`, error);
    }
}

/* ===============================
   REMARKS
================================ */

async function loadRemarks() {
    try {
        if (!currentPupilId || !currentSettings.term || !currentSettings.session) {
            console.warn('Cannot load remarks: Missing pupil, term, or session data');
            setText('teacher-remark', '-');
            setText('head-remark', '-');
            return;
        }

        // FIX: Document ID now includes encoded session to match teacher.js write format
        const encodedSession = currentSettings.session.replace(/\//g, '-');
        const docId = `${currentPupilId}_${encodedSession}_${currentSettings.term}`;

        const doc = await db.collection('remarks').doc(docId).get();

        if (!doc.exists) {
            console.log('No remarks data for:', docId);
            setText('teacher-remark', '-');
            setText('head-remark', '-');
            return;
        }

        const data = doc.data();

        if (!data) {
            console.warn('Remarks document exists but has no data');
            setText('teacher-remark', '-');
            setText('head-remark', '-');
            return;
        }

        setText('teacher-remark', typeof data.teacherRemark === 'string' ? data.teacherRemark : '-');
        setText('head-remark', typeof data.headRemark === 'string' ? data.headRemark : '-');

    } catch (error) {
        console.error('Error loading remarks:', error);
        setText('teacher-remark', '-');
        setText('head-remark', '-');
    }
}

/* ===============================
   HELPERS
================================ */

function resetTraitsAndRemarks() {
    document.querySelectorAll('.trait-value').forEach(el => el.textContent = '-');

    setText('teacher-remark', '-');
    setText('head-remark', '-');
    setText('times-opened', '-');
    setText('times-present', '-');
    setText('times-absent', '-');
}

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

function loadingRow() {
    return `<tr><td colspan="6" style="text-align:center; padding: var(--space-lg); color: var(--color-gray-600);">
        <div class="spinner" style="width: 30px; height: 30px; margin: 0 auto var(--space-sm); border: 3px solid #f3f3f3; border-top: 3px solid #00B2FF; border-radius: 50%; animation: spin 1s linear infinite;"></div>
        Loading results...
    </td></tr>`;
}

function emptyRow(text) {
    return `<tr><td colspan="6" style="text-align:center; padding: var(--space-lg); color: var(--color-gray-600);">${text}</td></tr>`;
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

// Add spinner animation CSS
const style = document.createElement('style');
style.textContent = `
@keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}
`;
document.head.appendChild(style);

console.log('✓ print-results.js ready (v6.3.0 - SESSION URL PARAMETER SUPPORT)');
