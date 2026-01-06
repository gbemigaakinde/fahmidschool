/**
 * FAHMID NURSERY & PRIMARY SCHOOL
 * Print Results JavaScript
 *
 * Purpose:
 * - Generate dynamic termly report card
 * - Pull live pupil bio, class, teacher, subjects
 * - Reflect admin changes instantly
 *
 * Version: 6.0.0
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
    setText('student-class', pupilProfile.class || '-');
    setText('admission-no', pupilProfile.admissionNo || '-');

    /* TEACHER */
    setText(
        'class-teacher',
        pupilProfile.assignedTeacher || '-'
    );

    /* SUBJECTS (comma-separated) */
    if (Array.isArray(pupilProfile.subjects)) {
        setText(
            'subjects-list',
            pupilProfile.subjects.join(', ')
        );
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
   ACADEMIC RESULTS
================================ */

async function loadAcademicResults() {
    const tbody = document.getElementById('academic-tbody');
    tbody.innerHTML = loadingRow();

    const snap = await db.collection('results')
        .where('pupilId', '==', currentPupilId)
        .where('term', '==', currentSettings.term)
        .get();

    tbody.innerHTML = '';

    if (snap.empty) {
        tbody.innerHTML = emptyRow('No results available');
        return;
    }

    let total = 0;

    snap.forEach(doc => {
        const r = doc.data();
        const ca = r.caScore || 0;
        const exam = r.examScore || 0;
        const score = ca + exam;

        total += score;

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
}

/* ===============================
   ATTENDANCE
================================ */

async function loadAttendance() {
    const doc = await db.collection('attendance')
        .doc(`${currentPupilId}_${currentSettings.term}`)
        .get();

    if (!doc.exists) return;

    const d = doc.data();
    setText('times-opened', d.timesOpened || '-');
    setText('times-present', d.timesPresent || '-');
    setText('times-absent', d.timesAbsent || '-');
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
    const doc = await db.collection(collection)
        .doc(`${currentPupilId}_${currentSettings.term}`)
        .get();

    if (!doc.exists) return;

    Object.entries(doc.data()).forEach(([k, v]) =>
        setText(prefix + k.toLowerCase(), v)
    );
}

/* ===============================
   REMARKS
================================ */

async function loadRemarks() {
    const doc = await db.collection('remarks')
        .doc(`${currentPupilId}_${currentSettings.term}`)
        .get();

    if (!doc.exists) return;

    setText('teacher-remark', doc.data().teacherRemark || '-');
    setText('head-remark', doc.data().headRemark || '-');
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

console.log('✓ print-results.js ready');