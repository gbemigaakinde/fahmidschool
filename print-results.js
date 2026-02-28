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

let isInitialized = false;

function getSessionFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const s = params.get('session');
    return (s && s !== 'current') ? s : null;
}

/* ===============================
   DUAL-ROLE AUTH & INITIALIZATION
================================ */

function initPrintResultsWrapper() {
    firebase.auth().onAuthStateChanged(async user => {
        if (!user) {
            window.location.href = 'index.html';
            return;
        }

        try {
            const userDoc = await db.collection('users').doc(user.uid).get();
            if (!userDoc.exists) {
                window.location.href = 'index.html';
                return;
            }

            const userRole = userDoc.data().role;
            if (userRole !== 'admin' && userRole !== 'pupil') {
                window.location.href = 'index.html';
                return;
            }

            const isAdmin = userRole === 'admin';
            const urlParams = new URLSearchParams(window.location.search);
            const urlPupilId = urlParams.get('pupilId');
            currentPupilId = isAdmin ? urlPupilId || null : user.uid;

            if (isAdmin && !currentPupilId) {
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

            await fetchSchoolSettings();

            const sessionOverride = getSessionFromUrl();
            if (sessionOverride) currentSettings.session = sessionOverride;

            await fetchPupilProfile(currentPupilId);
            setupTermSelector();
            updateReportHeader();
            isInitialized = true;
            await loadReportData();

        } catch (err) {
            console.error('Print results initialization failed:', err);
            window.location.href = 'index.html';
        }
    });
}

// Call this wrapper once
initPrintResultsWrapper();

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

        setText('student-name', pupilProfile.name || '-');
        setText('student-gender', pupilProfile.gender || '-');
        setText('admission-no', pupilProfile.admissionNo || '-');

        let classId = null;
        let className = '-';

        if (pupilProfile.class) {
            if (typeof pupilProfile.class === 'object') {
                classId = pupilProfile.class.id;
                className = pupilProfile.class.name || '-';
            } else if (typeof pupilProfile.class === 'string') {
                className = pupilProfile.class;
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

        let teacherName = '-';
        let subjectsList = '-';

        if (classId) {
            const classDoc = await db.collection('classes').doc(classId).get();
            if (classDoc.exists) {
                const classData = classDoc.data();
                if (classData.teacherName) {
                    teacherName = classData.teacherName;
                } else if (classData.teacherId) {
                    const teacherDoc = await db.collection('teachers').doc(classData.teacherId).get();
                    if (teacherDoc.exists) teacherName = teacherDoc.data().name;
                }
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

function setupTermSelector() {
    const select = document.getElementById('print-term');
    if (!select) {
        console.error('❌ Term selector element not found!');
        return;
    }

    const termToSelect = currentSettings.term;
    setText('current-term', termToSelect);

    const newSelect = select.cloneNode(true);
    Array.from(newSelect.options).forEach(option => {
        option.selected = option.value === termToSelect;
    });
    select.parentNode.replaceChild(newSelect, select);

    newSelect.addEventListener('change', async e => {
        currentSettings.term = e.target.value;
        setText('current-term', currentSettings.term);
        updateReportHeader();
        await loadReportData();
    });

    if (newSelect.value !== termToSelect) {
        newSelect.value = termToSelect;
    }
}

/* ===============================
   UPDATE HEADER FIELDS
================================ */

function updateReportHeader() {
    setText('report-title', `${currentSettings.term} Report Card - ${currentSettings.session} Session`);
    setText('current-session', currentSettings.session || '-');

    const urlSession = getSessionFromUrl();
    if (urlSession) {
        setText('resumption-date', '-');
    } else if (currentSettings.resumptionDate?.toDate) {
        setText('resumption-date', currentSettings.resumptionDate.toDate().toLocaleDateString('en-GB'));
    } else {
        setText('resumption-date', currentSettings.resumptionDate || '-');
    }
}

/* ===============================
   LOAD ALL REPORT DATA
================================ */

async function loadReportData() {
    resetTraitsAndRemarks();

    try {
        await Promise.all([
            loadAcademicResults(),
            loadAttendance(),
            loadBehavioralTraits(),
            loadPsychomotorSkills(),
            loadRemarks()
        ]);
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
    if (!tbody) return;

    if (!isInitialized || !currentPupilId || !currentSettings.session || !currentSettings.term) {
        tbody.innerHTML = loadingRow();
        let attempts = 0;
        const maxAttempts = 100;
        while (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 100));
            if (isInitialized && currentPupilId && currentSettings.session && currentSettings.term) break;
            attempts++;
        }
        if (attempts >= maxAttempts) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">⚠️ Unable to load results. Reload page.</td></tr>`;
            return;
        }
    }

    tbody.innerHTML = loadingRow();

    try {
        const resultsSnap = await db.collection('results')
            .where('pupilId', '==', currentPupilId)
            .where('term', '==', currentSettings.term)
            .where('session', '==', currentSettings.session)
            .where('status', '==', 'approved')
            .get();
        
        let results = [];
        if (!resultsSnap.empty) {
            resultsSnap.forEach(doc => {
                const data = doc.data();
                results.push({
                    subject: data.subject || 'Unknown Subject',
                    caScore: typeof data.caScore === 'number' ? data.caScore : 0,
                    examScore: typeof data.examScore === 'number' ? data.examScore : 0
                });
            });
        } else {
            const allResultsSnap = await db.collection('results')
                .where('pupilId', '==', currentPupilId)
                .get();
            allResultsSnap.forEach(doc => {
                const data = doc.data();
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
        }

        if (results.length === 0) {
            tbody.innerHTML = emptyRow(`No approved results available for ${currentSettings.term}, ${currentSettings.session} session`);
            return;
        }

        renderResults(results, tbody);

    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">⚠️ Error loading results. Reload page.</td></tr>`;
        console.error('Error loading results:', error);
    }
}

function renderResults(results, tbody) {
    tbody.innerHTML = '';
    results.sort((a, b) => a.subject.localeCompare(b.subject));

    let totalScore = 0;
    results.forEach(r => {
        const ca = r.caScore;
        const exam = r.examScore;
        const score = ca + exam;
        totalScore += score;
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

    const subjectCount = results.length;
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

/* ===============================
   ATTENDANCE (FIXED)
================================ */

async function loadAttendance() {
    if (!currentPupilId || !currentSettings.term || !currentSettings.session) return;
    const encodedSession = currentSettings.session.replace(/\//g, '-');
    const docId = `${currentPupilId}_${encodedSession}_${currentSettings.term}`;
    const doc = await db.collection('attendance').doc(docId).get();
    const d = doc.exists ? doc.data() : {};
    setText('times-opened', typeof d.timesOpened === 'number' ? d.timesOpened : '-');
    setText('times-present', typeof d.timesPresent === 'number' ? d.timesPresent : '-');
    setText('times-absent', typeof d.timesAbsent === 'number' ? d.timesAbsent : '-');
}

/* ===============================
   TRAITS & SKILLS
================================ */

async function loadBehavioralTraits() { await loadKeyedCollection('behavioral_traits', 'trait-'); }
async function loadPsychomotorSkills() { await loadKeyedCollection('psychomotor_skills', 'skill-'); }

async function loadKeyedCollection(collection, prefix) {
    if (!currentPupilId || !currentSettings.term || !currentSettings.session) return;
    const encodedSession = currentSettings.session.replace(/\//g, '-');
    const docId = `${currentPupilId}_${encodedSession}_${currentSettings.term}`;
    const doc = await db.collection(collection).doc(docId).get();
    if (!doc.exists) return;
    const data = doc.data();
    Object.entries(data).forEach(([k, v]) => {
        if (['pupilId','term','teacherId','updatedAt','session','sessionStartYear','sessionEndYear','sessionTerm'].includes(k)) return;
        const fieldId = prefix + k.toLowerCase();
        setText(fieldId, v !== null && v !== undefined ? v : '-');
    });
}

/* ===============================
   REMARKS
================================ */

async function loadRemarks() {
    if (!currentPupilId || !currentSettings.term || !currentSettings.session) return;
    const encodedSession = currentSettings.session.replace(/\//g, '-');
    const docId = `${currentPupilId}_${encodedSession}_${currentSettings.term}`;
    const doc = await db.collection('remarks').doc(docId).get();
    const data = doc.exists ? doc.data() : {};
    setText('teacher-remark', typeof data.teacherRemark === 'string' ? data.teacherRemark : '-');
    setText('head-remark', typeof data.headRemark === 'string' ? data.headRemark : '-');
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

const style = document.createElement('style');
style.textContent = `
@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
`;
document.head.appendChild(style);

console.log('✓ print-results.js ready (v6.3.0 - SESSION URL PARAMETER SUPPORT)');
