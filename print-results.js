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

    /* BIO */
    setText('student-name', pupilProfile.name || '-');
    setText('student-gender', pupilProfile.gender || '-');
    setText('student-class', pupilProfile.class?.name || '-');
    setText('admission-no', pupilProfile.admissionNo || '-');

    /* FETCH CLASS TEACHER IF NEEDED */
    if (pupilProfile.class?.id) {
        const classDoc = await db.collection('classes').doc(pupilProfile.class.id).get();
        if (classDoc.exists) {
            const classData = classDoc.data();
            
            // Get teacher name
            let teacherName = '-';
            if (classData.teacherName) {
                teacherName = classData.teacherName;
            } else if (classData.teacherId) {
                const teacherDoc = await db.collection('teachers').doc(classData.teacherId).get();
                teacherName = teacherDoc.exists ? teacherDoc.data().name : '-';
            }
            
            setText('class-teacher', teacherName);
            
            // Get subjects
            if (Array.isArray(classData.subjects) && classData.subjects.length > 0) {
                setText('subjects-list', classData.subjects.join(', '));
            } else {
                setText('subjects-list', '-');
            }
        }
    }
}

/* ===============================
   TERM SELECTOR
================================ */

function setupTermSelector() {
    const select = document.getElementById('print-term');
    if (!select) return;

    select.value = currentSettings.term;
    setText('current-term', currentSettings.term);

    select.addEventListener('change', async e => {
        currentSettings.term = e.target.value;
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
    resetTraitsAndRemarks();

    await Promise.all([
        loadAcademicResults(),
        loadAttendance(),
        loadBehavioralTraits(),
        loadPsychomotorSkills(),
        loadRemarks()
    ]);
}

/* ===============================
   ACADEMIC RESULTS (FIXED)
================================ */

async function loadAcademicResults() {
    const tbody = document.getElementById('academic-tbody');
    tbody.innerHTML = loadingRow();

    try {
        // Get ALL results documents
        const snap = await db.collection('results').get();
        
        // Filter results by pupilId and term from document ID
        const results = [];
        snap.forEach(doc => {
            const docId = doc.id;
            // Format: pupilId_term_subject
            if (docId.startsWith(currentPupilId + '_')) {
                const parts = docId.split('_');
                if (parts.length >= 3) {
                    const term = parts[1];
                    const subject = parts.slice(2).join('_');
                    
                    if (term === currentSettings.term) {
                        const data = doc.data();
                        results.push({
                            subject: subject,
                            caScore: data.caScore || 0,
                            examScore: data.examScore || 0
                        });
                    }
                }
            }
        });

        tbody.innerHTML = '';

        if (results.length === 0) {
            tbody.innerHTML = emptyRow('No results available for this term');
            return;
        }

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
        tbody.innerHTML = emptyRow('Error loading results');
    }
}

/* ===============================
   ATTENDANCE (FIXED)
================================ */

async function loadAttendance() {
    try {
        const docId = `${currentPupilId}_${currentSettings.term}`;
        const doc = await db.collection('attendance').doc(docId).get();

        if (!doc.exists) {
            console.log('No attendance data for:', docId);
            return;
        }

        const d = doc.data();
        setText('times-opened', d.timesOpened || '-');
        setText('times-present', d.timesPresent || '-');
        setText('times-absent', d.timesAbsent || '-');
    } catch (error) {
        console.error('Error loading attendance:', error);
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