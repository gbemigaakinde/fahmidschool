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
   INITIALIZATION
================================ */

checkRole('pupil')
    .then(user => initReport(user))
    .catch(() => window.location.href = 'login.html');

/* ===============================
   MAIN INITIALIZER
================================ */

async function initReport(user) {
    try {
        await fetchSchoolSettings();
        await fetchPupilProfile(user.uid);
        setupTermSelector();
        updateReportHeader();
        await loadReportData();
    } catch (error) {
        console.error(error);
        window.showToast?.('Unable to load report card', 'danger');
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
    tbody.innerHTML = loadingRow();

    try {
        console.log('Loading results for:', currentPupilId, currentSettings.term);
        
        // METHOD 1: Try document ID format (pupilId_term_subject)
        const allResultsDocs = await db.collection('results').get();
        const results = [];
        
        allResultsDocs.forEach(doc => {
            const docId = doc.id;
            const data = doc.data();
            
            // Check if document ID starts with current pupil ID
            if (docId.startsWith(currentPupilId + '_')) {
                const parts = docId.split('_');
                
                if (parts.length >= 3) {
                    const docPupilId = parts[0];
                    const docTerm = parts[1];
                    const docSubject = parts.slice(2).join('_');
                    
                    // Match current term
                    if (docTerm === currentSettings.term) {
                        results.push({
                            subject: docSubject,
                            caScore: data.caScore || 0,
                            examScore: data.examScore || 0
                        });
                        console.log('Found result (ID format):', docSubject, data);
                    }
                }
            }
            
            // METHOD 2: Also check field-based format (backup)
            if (data.pupilId === currentPupilId && data.term === currentSettings.term) {
                // Only add if not already added from ID format
                const alreadyExists = results.some(r => r.subject === data.subject);
                if (!alreadyExists && data.subject) {
                    results.push({
                        subject: data.subject,
                        caScore: data.caScore || 0,
                        examScore: data.examScore || 0
                    });
                    console.log('Found result (field format):', data.subject, data);
                }
            }
        });

        tbody.innerHTML = '';

        if (results.length === 0) {
            console.log('No results found for pupil:', currentPupilId, 'term:', currentSettings.term);
            tbody.innerHTML = emptyRow('No results available for this term');
            return;
        }

        console.log('Total results found:', results.length);

        // Sort results alphabetically by subject
        results.sort((a, b) => a.subject.localeCompare(b.subject));

        let totalScore = 0;
        let subjectCount = 0;

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

        // Add summary rows
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
        console.error('Error loading academic results:', error);
        tbody.innerHTML = emptyRow('Error loading results - ' + error.message);
    }
}

/* ===============================
   ATTENDANCE (FIXED)
================================ */

async function loadAttendance() {
    try {
        const docId = `${currentPupilId}_${currentSettings.term}`;
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
        console.log('Attendance data:', d);
        
        setText('times-opened', d.timesOpened !== undefined ? d.timesOpened : '-');
        setText('times-present', d.timesPresent !== undefined ? d.timesPresent : '-');
        setText('times-absent', d.timesAbsent !== undefined ? d.timesAbsent : '-');
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
        const docId = `${currentPupilId}_${currentSettings.term}`;
        const doc = await db.collection(collection).doc(docId).get();

        if (!doc.exists) {
            console.log(`No ${collection} data for:`, docId);
            return;
        }

        Object.entries(doc.data()).forEach(([k, v]) => {
            // Skip metadata fields
            if (k === 'pupilId' || k === 'term') return;
            
            setText(prefix + k.toLowerCase(), v);
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
        const docId = `${currentPupilId}_${currentSettings.term}`;
        const doc = await db.collection('remarks').doc(docId).get();

        if (!doc.exists) {
            console.log('No remarks data for:', docId);
            return;
        }

        const data = doc.data();
        setText('teacher-remark', data.teacherRemark || '-');
        setText('head-remark', data.headRemark || '-');
    } catch (error) {
        console.error('Error loading remarks:', error);
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