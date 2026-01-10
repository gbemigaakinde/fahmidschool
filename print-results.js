/**
 * FAHMID NURSERY & PRIMARY SCHOOL
 * Print Results JavaScript
 *
 * Purpose:
 * - Generate dynamic termly report card
 * - Pull live pupil bio, class, teacher, subjects
 * - Reflect admin changes instantly
 *
 * Version: 6.1.0
 * Date: 2026-01-06
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
   INITIALIZATION WITH PROPER ORDER
================================ */
// Add loading state flag
let isInitialized = false;

checkRole('pupil')
    .then(async user => {
        try {
            // STEP 1: Load settings FIRST
            console.log('Step 1: Loading settings...');
            await fetchSchoolSettings();
            
            // STEP 2: Load pupil profile SECOND
            console.log('Step 2: Loading pupil profile...');
            await fetchPupilProfile(user.uid);
            
            // STEP 3: Setup UI THIRD
            console.log('Step 3: Setting up UI...');
            setupTermSelector();
            updateReportHeader();
            
            // STEP 4: Load report data LAST
            console.log('Step 4: Loading report data...');
            await loadReportData();
            
            isInitialized = true;
            console.log('✓ Report card initialized successfully');
            
        } catch (error) {
            console.error('Initialization failed:', error);
            window.showToast?.('Failed to load report card. Please refresh.', 'danger');
        }
    })
    .catch(() => window.location.href = 'login.html');
    
/* ===============================
   MAIN INITIALIZER
================================ */

async function initReport(user) {
    try {
        console.log('=== Initializing Report (Fixed) ===');
        
        // STEP 1: Load school settings FIRST (needed by everything)
        console.log('Step 1: Loading school settings...');
        await fetchSchoolSettings();
        console.log('✓ Settings loaded:', currentSettings);
        
        // STEP 2: Load pupil profile SECOND (needs settings to be ready)
        console.log('Step 2: Loading pupil profile...');
        await fetchPupilProfile(user.uid);
        console.log('✓ Profile loaded for:', pupilProfile?.name);
        
        // STEP 3: Setup UI components (now safe with loaded data)
        console.log('Step 3: Setting up UI...');
        setupTermSelector();
        updateReportHeader();
        console.log('✓ UI ready');
        
        // STEP 4: Load report data LAST (needs profile and settings)
        console.log('Step 4: Loading report data...');
        await loadReportData();
        console.log('✓ Report data loaded');
        
        console.log('=== Report Initialization Complete ===');
    } catch (error) {
        console.error('=== Report Initialization Failed ===', error);
        window.showToast?.('Unable to load report card. Please refresh the page.', 'danger');
    }
}

/* ===============================
   FETCH SCHOOL SETTINGS
================================ */

async function fetchSchoolSettings() {
    const doc = await db.collection('settings').doc('current').get();
    if (!doc.exists) return;

    const data = doc.data();
    currentSettings.term = data.term || currentSettings.term;
    currentSettings.session = data.session || '';
    currentSettings.resumptionDate = data.resumptionDate || '-';
}

/* ===============================
   FETCH PUPIL PROFILE (CORE FIX)
================================ */

async function fetchPupilProfile(uid) {
    const doc = await db.collection('pupils').doc(uid).get();
    if (!doc.exists) throw new Error('Pupil record not found');

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
}

/* ===============================
   TERM SELECTOR
================================ */

function setupTermSelector() {
    const select = document.getElementById('print-term');
    if (!select) {
        console.error('❌ Term selector element not found!');
        return;
    }

    console.log('✓ Setting up term selector, current term:', currentSettings.term);
    select.value = currentSettings.term;
    setText('current-term', currentSettings.term);

    select.addEventListener('change', async e => {
        currentSettings.term = e.target.value;
        console.log('Term changed to:', currentSettings.term);
        setText('current-term', currentSettings.term);
        updateReportHeader();
        await loadReportData();
    });
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

    if (currentSettings.resumptionDate?.toDate) {
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

async function loadAcademicResults() {
  const tbody = document.getElementById('academic-tbody');
  
  if (!tbody) {
    console.error('Academic tbody element not found');
    return;
  }
  
  if (!currentPupilId) {
    tbody.innerHTML = emptyRow('Unable to load: Pupil not identified');
    return;
  }
  
  if (!currentSettings || !currentSettings.term) {
    tbody.innerHTML = emptyRow('Unable to load: Term not configured');
    return;
  }
  
  // Check if initialized
  if (!isInitialized) {
    tbody.innerHTML = emptyRow('Loading report card...');
    return;
  }
  
  tbody.innerHTML = loadingRow();

  try {
    // CRITICAL FIX: Validate all required data
    if (!currentPupilId) {
      console.error('No pupil ID available');
      tbody.innerHTML = emptyRow('Unable to load results: Pupil not identified');
      return;
    }
    
    if (!currentSettings || !currentSettings.term) {
      console.error('No term data available');
      tbody.innerHTML = emptyRow('Unable to load results: Term not identified');
      return;
    }
    
    // Check permissions first with a simple test query
    try {
      await db.collection('results').limit(1).get();
    } catch (permissionError) {
      console.error('Permission denied for results collection:', permissionError);
      tbody.innerHTML = emptyRow('Permission denied. Contact administrator.');
      window.showToast?.('You do not have permission to view results', 'danger');
      return;
    }
    
    // Get all results documents
    const allResultsSnap = await db.collection('results').get();
    
    if (allResultsSnap.empty) {
      tbody.innerHTML = emptyRow('No results in system yet. Teacher must enter scores.');
      return;
    }
    
    const results = [];
    const currentPupilUid = currentPupilId;
    const currentTermValue = currentSettings.term;
    
    // Check every document
    allResultsSnap.forEach(doc => {
      const docId = doc.id;
      const data = doc.data();
      
      if (!data) {
        console.warn(`Document ${docId} has no data`);
        return;
      }
      
      let matchFound = false;
      let subject = '';
      
      // METHOD 1: Document ID format (pupilId_term_subject)
      if (typeof docId === 'string' && docId.includes('_')) {
        const parts = docId.split('_');
        if (parts.length >= 3) {
          const idPupilId = parts[0];
          const idTerm = parts[1];
          const idSubject = parts.slice(2).join('_');
          
          if (idPupilId === currentPupilUid && idTerm === currentTermValue) {
            matchFound = true;
            subject = idSubject;
          }
        }
      }
      
      // METHOD 2: Field-based format (backup)
      if (!matchFound && data.pupilId && data.term && data.subject) {
        if (data.pupilId === currentPupilUid && data.term === currentTermValue) {
          matchFound = true;
          subject = data.subject;
        }
      }
      
      // If match found, add to results
      if (matchFound && subject) {
        const existingIndex = results.findIndex(r => r.subject === subject);
        if (existingIndex === -1) {
          results.push({
            subject: subject,
            caScore: typeof data.caScore === 'number' ? data.caScore : 0,
            examScore: typeof data.examScore === 'number' ? data.examScore : 0
          });
        }
      }
    });

    tbody.innerHTML = '';

    if (results.length === 0) {
      tbody.innerHTML = emptyRow(`No results for ${currentTermValue}`);
      return;
    }

    // Sort alphabetically
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

  } catch (error) {
    console.error('Error loading results:', error);
    
    let errorMessage = 'Error loading results';
    
    if (error.code === 'permission-denied') {
      errorMessage = 'Permission denied. Contact administrator.';
      window.showToast?.('You do not have permission to view results', 'danger');
    } else if (error.code === 'unavailable') {
      errorMessage = 'Service unavailable. Check your internet connection.';
      window.showToast?.('Cannot connect to server. Please check your internet.', 'warning');
    } else if (error.code === 'not-found') {
      errorMessage = 'Results data not found.';
    } else {
      errorMessage = `Error: ${error.message || 'Unknown error'}`;
    }
    
    tbody.innerHTML = emptyRow(errorMessage);
  }
}

/* ===============================
   ATTENDANCE (FIXED)
================================ */

async function loadAttendance() {
  try {
    // FIXED: Check if required data exists
    if (!currentPupilId) {
      console.warn('No pupil ID for attendance');
      setText('times-opened', '-');
      setText('times-present', '-');
      setText('times-absent', '-');
      return;
    }
    
    if (!currentSettings || !currentSettings.term) {
      console.warn('No term data for attendance');
      setText('times-opened', '-');
      setText('times-present', '-');
      setText('times-absent', '-');
      return;
    }
    
    const docId = `${currentPupilId}_${currentSettings.term}`;
    console.log('Loading attendance for:', docId);
    
    // FIXED: Check permissions first
    try {
      await db.collection('attendance').limit(1).get();
    } catch (permissionError) {
      console.error('Permission denied for attendance:', permissionError);
      setText('times-opened', 'N/A');
      setText('times-present', 'N/A');
      setText('times-absent', 'N/A');
      return;
    }
    
    const doc = await db.collection('attendance').doc(docId).get();

    if (!doc.exists) {
      console.log('No attendance data found for:', docId);
      setText('times-opened', '-');
      setText('times-present', '-');
      setText('times-absent', '-');
      return;
    }

    const d = doc.data();
    
    // FIXED: Validate data
    if (!d) {
      console.warn('Attendance document exists but has no data');
      setText('times-opened', '-');
      setText('times-present', '-');
      setText('times-absent', '-');
      return;
    }
    
    console.log('Attendance data:', d);
    
    // FIXED: Type checking for attendance values
    setText('times-opened', typeof d.timesOpened === 'number' ? d.timesOpened : '-');
    setText('times-present', typeof d.timesPresent === 'number' ? d.timesPresent : '-');
    setText('times-absent', typeof d.timesAbsent === 'number' ? d.timesAbsent : '-');
    
  } catch (error) {
    console.error('Error loading attendance:', error);
    
    // FIXED: Handle specific errors
    if (error.code === 'permission-denied') {
      setText('times-opened', 'N/A');
      setText('times-present', 'N/A');
      setText('times-absent', 'N/A');
      window.showToast?.('Cannot access attendance data', 'warning');
    } else {
      setText('times-opened', '-');
      setText('times-present', '-');
      setText('times-absent', '-');
    }
  }
}

/* ===============================
   TRAITS & SKILLS
================================ */

async function loadBehavioralTraits() {
    await loadKeyedCollection(
        'behavioral_traits',
        'trait-'
    );
}

async function loadPsychomotorSkills() {
    await loadKeyedCollection(
        'psychomotor_skills',
        'skill-'
    );
}

async function loadKeyedCollection(collection, prefix) {
  try {
    // FIXED: Validate inputs
    if (!collection || !prefix) {
      console.error('loadKeyedCollection called with invalid parameters');
      return;
    }
    
    if (!currentPupilId || !currentSettings || !currentSettings.term) {
      console.warn(`Cannot load ${collection}: Missing pupil or term data`);
      return;
    }
    
    const docId = `${currentPupilId}_${currentSettings.term}`;
    
    // FIXED: Check permissions first
    try {
      await db.collection(collection).limit(1).get();
    } catch (permissionError) {
      console.error(`Permission denied for ${collection}:`, permissionError);
      return;
    }
    
    const doc = await db.collection(collection).doc(docId).get();

    if (!doc.exists) {
      console.log(`No ${collection} data for:`, docId);
      return;
    }
    
    const data = doc.data();
    
    // FIXED: Validate data exists
    if (!data) {
      console.warn(`${collection} document exists but has no data`);
      return;
    }

    Object.entries(data).forEach(([k, v]) => {
      // Skip metadata fields
      if (k === 'pupilId' || k === 'term' || k === 'teacherId' || k === 'updatedAt') return;
      
      // FIXED: Type check value before setting
      const fieldId = prefix + k.toLowerCase();
      const element = document.getElementById(fieldId);
      
      if (element) {
        setText(fieldId, v !== null && v !== undefined ? v : '-');
      }
    });
    
  } catch (error) {
    console.error(`Error loading ${collection}:`, error);
    
    // FIXED: Handle specific errors
    if (error.code === 'permission-denied') {
      window.showToast?.(`Cannot access ${collection} data`, 'warning');
    }
    // Fail silently for other errors - fields will remain as '-'
  }
}

/* ===============================
   REMARKS
================================ */

async function loadRemarks() {
  try {
    // FIXED: Validate required data
    if (!currentPupilId || !currentSettings || !currentSettings.term) {
      console.warn('Cannot load remarks: Missing pupil or term data');
      setText('teacher-remark', '-');
      setText('head-remark', '-');
      return;
    }
    
    const docId = `${currentPupilId}_${currentSettings.term}`;
    
    // FIXED: Check permissions first
    try {
      await db.collection('remarks').limit(1).get();
    } catch (permissionError) {
      console.error('Permission denied for remarks:', permissionError);
      setText('teacher-remark', 'N/A');
      setText('head-remark', 'N/A');
      return;
    }
    
    const doc = await db.collection('remarks').doc(docId).get();

    if (!doc.exists) {
      console.log('No remarks data for:', docId);
      setText('teacher-remark', '-');
      setText('head-remark', '-');
      return;
    }

    const data = doc.data();
    
    // FIXED: Validate data exists
    if (!data) {
      console.warn('Remarks document exists but has no data');
      setText('teacher-remark', '-');
      setText('head-remark', '-');
      return;
    }
    
    // FIXED: Type check values
    setText('teacher-remark', typeof data.teacherRemark === 'string' ? data.teacherRemark : '-');
    setText('head-remark', typeof data.headRemark === 'string' ? data.headRemark : '-');
    
  } catch (error) {
    console.error('Error loading remarks:', error);
    
    // FIXED: Handle specific errors
    if (error.code === 'permission-denied') {
      setText('teacher-remark', 'N/A');
      setText('head-remark', 'N/A');
      window.showToast?.('Cannot access remarks data', 'warning');
    } else {
      setText('teacher-remark', '-');
      setText('head-remark', '-');
    }
  }
}

/* ===============================
   HELPERS
================================ */

function resetTraitsAndRemarks() {
    document
        .querySelectorAll('.trait-value')
        .forEach(el => el.textContent = '-');

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
    return `<tr><td colspan="6" style="text-align:center">Loading…</td></tr>`;
}

function emptyRow(text) {
    return `<tr><td colspan="6" style="text-align:center">${text}</td></tr>`;
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

console.log('✓ print-results.js ready (v6.1.0)');