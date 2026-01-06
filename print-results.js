/**
 * FAHMID NURSERY & PRIMARY SCHOOL
 * Print Results JavaScript - Complete Report Card
 * 
 * @version 5.0.2 - FULL NIGERIAN REPORT CARD
 * @date 2026-01-06
 */

'use strict';

let currentPupilId = null;
let currentSettings = {
    term: 'First Term',
    session: '',
    resumptionDate: '-'
};

// ==============================
// INITIALIZATION
// ==============================

checkRole('pupil').then(async user => {
    await loadPupilData(user);
}).catch(() => {});

// ==============================
// LOAD PUPIL DATA
// ==============================

async function loadPupilData(user) {
    try {
        const pupilDoc = await db.collection('pupils').doc(user.uid).get();
        if (!pupilDoc.exists) {
            console.error('No pupil profile found for UID:', user.uid);
            window.showToast?.('No pupil profile found', 'danger');
            setTimeout(() => window.location.href = 'login.html', 2000);
            return;
        }

        const pupilData = pupilDoc.data();
        currentPupilId = pupilDoc.id;

        // Update bio section
        document.getElementById('student-name').textContent = pupilData.name;
        document.getElementById('student-class').textContent = pupilData.class || 'N/A';
        document.getElementById('admission-no').textContent = pupilData.admissionNo || '-';
        document.getElementById('student-gender').textContent = pupilData.gender || '-';

        // Fetch current school settings once on load
        await fetchCurrentSettings();

        // Update term selector
        const termSelect = document.getElementById('print-term');
        if (termSelect) {
            termSelect.value = currentSettings.term;
            termSelect.addEventListener('change', async (e) => {
                currentSettings.term = e.target.value;
                // Update report header and load data for selected term
                updateReportHeader();
                await loadReportData();
            });
        }

        // Initial header and data load
        updateReportHeader();
        await loadReportData();

    } catch (error) {
        console.error('Error loading pupil data:', error);
        handleError(error, 'Failed to load pupil information');
        setTimeout(() => window.location.href = 'login.html', 3000);
    }
}

// ==============================
// FETCH CURRENT SETTINGS (once)
// ==============================

async function fetchCurrentSettings() {
    try {
        const settingsDoc = await db.collection('settings').doc('current').get();
        if (settingsDoc.exists) {
            const data = settingsDoc.data();
            currentSettings.term = data.term || currentSettings.term;
            currentSettings.session = data.session || currentSettings.session;
            currentSettings.resumptionDate = data.resumptionDate || currentSettings.resumptionDate;
        }
    } catch (error) {
        console.error('Error fetching current settings:', error);
    }
}

// ==============================
// UPDATE REPORT HEADER (TERM, SESSION, RESUMPTION DATE)
// ==============================

function updateReportHeader() {
    const { term, session, resumptionDate } = currentSettings;

    const reportTitleEl = document.getElementById('report-title');
    const termEl = document.getElementById('current-term');
    const sessionEl = document.getElementById('current-session');
    const resumptionEl = document.getElementById('resumption-date');

    if (reportTitleEl) reportTitleEl.textContent = `${term} Report Card - ${session} Session`;
    if (termEl) termEl.textContent = term;
    if (sessionEl) sessionEl.textContent = session || '-';

    let displayDate = '-';
    if (resumptionDate) {
        if (resumptionDate.toDate) { // Firestore Timestamp
            displayDate = resumptionDate.toDate().toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            });
        } else {
            const dateObj = new Date(resumptionDate);
            if (!isNaN(dateObj)) {
                displayDate = dateObj.toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                });
            }
        }
    }

    if (resumptionEl) resumptionEl.textContent = displayDate;
}

// ==============================
// LOAD FULL REPORT DATA
// ==============================

async function loadReportData() {
    // Reset all traits, skills, and remarks to '-'
    resetTraitsAndSkillsAndRemarks();

    await Promise.all([
        loadAcademicResults(),
        loadAttendance(),
        loadBehavioralTraits(),
        loadPsychomotorSkills(),
        loadRemarks()
    ]);
}

// ==============================
// RESET TRAITS, SKILLS, REMARKS
// ==============================

function resetTraitsAndSkillsAndRemarks() {
    const traitIds = [
        'trait-punctuality', 'trait-neatness', 'trait-politeness', 'trait-honesty',
        'trait-obedience', 'trait-cooperation', 'trait-attentiveness', 'trait-leadership',
        'trait-selfcontrol', 'trait-creativity'
    ];
    traitIds.forEach(id => document.getElementById(id).textContent = '-');

    const skillIds = [
        'skill-handwriting', 'skill-drawing', 'skill-sports',
        'skill-craft', 'skill-verbal', 'skill-coordination'
    ];
    skillIds.forEach(id => document.getElementById(id).textContent = '-');

    document.getElementById('teacher-remark').textContent = '-';
    document.getElementById('head-remark').textContent = '-';
}

// ==============================
// ACADEMIC RESULTS
// ==============================

async function loadAcademicResults() {
    const tbody = document.getElementById('academic-tbody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 5mm;">Loading results...</td></tr>';

    try {
        const resultsSnap = await db.collection('results')
            .where('pupilId', '==', currentPupilId)
            .where('term', '==', currentSettings.term)
            .get();

        tbody.innerHTML = '';

        if (resultsSnap.empty) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 5mm; color: #666;">No results available for this term yet.</td></tr>';
            return;
        }

        const results = [];
        resultsSnap.forEach(doc => results.push(doc.data()));
        results.sort((a, b) => a.subject.localeCompare(b.subject));

        let totalScore = 0;
        let subjectCount = 0;

        results.forEach(result => {
            const ca = result.caScore || 0;
            const exam = result.examScore || 0;
            const total = ca + exam;
            const grade = getGrade(total);
            const remark = getSubjectRemark(total);

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${result.subject}</td>
                <td>${ca}</td>
                <td>${exam}</td>
                <td><strong>${total}</strong></td>
                <td class="grade-${grade.replace(/ /g, '')}">${grade}</td>
                <td style="font-size: 8pt;">${remark}</td>
            `;
            tbody.appendChild(tr);

            totalScore += total;
            subjectCount++;
        });

        if (subjectCount > 0) {
            const average = (totalScore / subjectCount).toFixed(1);
            const overallGrade = getGrade(parseFloat(average));

            const totalRow = document.createElement('tr');
            totalRow.className = 'summary-row';
            totalRow.innerHTML = `
                <td colspan="3" style="text-align: right;"><strong>TOTAL SCORE OBTAINED:</strong></td>
                <td colspan="3"><strong>${totalScore} / ${subjectCount * 100}</strong></td>
            `;
            tbody.appendChild(totalRow);

            const avgRow = document.createElement('tr');
            avgRow.className = 'summary-row';
            avgRow.innerHTML = `
                <td colspan="3" style="text-align: right;"><strong>AVERAGE SCORE:</strong></td>
                <td colspan="3"><strong>${average}%</strong></td>
            `;
            tbody.appendChild(avgRow);

            const gradeRow = document.createElement('tr');
            gradeRow.className = 'summary-row';
            gradeRow.innerHTML = `
                <td colspan="3" style="text-align: right;"><strong>OVERALL GRADE:</strong></td>
                <td colspan="3" class="grade-${overallGrade.replace(/ /g, '')}"><strong>${overallGrade}</strong></td>
            `;
            tbody.appendChild(gradeRow);
        }

    } catch (error) {
        console.error('Error loading academic results:', error);
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 5mm; color: #d32f2f;">Error loading results.</td></tr>';
    }
}

// ==============================
// ATTENDANCE
// ==============================

async function loadAttendance() {
    try {
        const attendanceDoc = await db.collection('attendance')
            .doc(`${currentPupilId}_${currentSettings.term}`)
            .get();

        const data = attendanceDoc.exists ? attendanceDoc.data() : {};
        document.getElementById('times-opened').textContent = data.timesOpened || '-';
        document.getElementById('times-present').textContent = data.timesPresent || '-';
        document.getElementById('times-absent').textContent = data.timesAbsent || '-';

    } catch (error) {
        console.error('Error loading attendance:', error);
    }
}

// ==============================
// BEHAVIORAL TRAITS
// ==============================

async function loadBehavioralTraits() {
    try {
        const traitsDoc = await db.collection('behavioral_traits')
            .doc(`${currentPupilId}_${currentSettings.term}`)
            .get();

        if (traitsDoc.exists) {
            const data = traitsDoc.data();
            for (const key in data) {
                const el = document.getElementById(`trait-${key.toLowerCase()}`);
                if (el) el.textContent = data[key];
            }
        }

    } catch (error) {
        console.error('Error loading behavioral traits:', error);
    }
}

// ==============================
// PSYCHOMOTOR SKILLS
// ==============================

async function loadPsychomotorSkills() {
    try {
        const skillsDoc = await db.collection('psychomotor_skills')
            .doc(`${currentPupilId}_${currentSettings.term}`)
            .get();

        if (skillsDoc.exists) {
            const data = skillsDoc.data();
            for (const key in data) {
                const el = document.getElementById(`skill-${key.toLowerCase()}`);
                if (el) el.textContent = data[key];
            }
        }

    } catch (error) {
        console.error('Error loading psychomotor skills:', error);
    }
}

// ==============================
// REMARKS
// ==============================

async function loadRemarks() {
    try {
        const remarksDoc = await db.collection('remarks')
            .doc(`${currentPupilId}_${currentSettings.term}`)
            .get();

        if (remarksDoc.exists) {
            const data = remarksDoc.data();
            document.getElementById('teacher-remark').textContent = data.teacherRemark || '-';
            document.getElementById('head-remark').textContent = data.headRemark || '-';
        }

    } catch (error) {
        console.error('Error loading remarks:', error);
    }
}

// ==============================
// GRADING FUNCTIONS
// ==============================

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

function getSubjectRemark(score) {
    if (score >= 75) return 'Excellent';
    if (score >= 70) return 'Very Good';
    if (score >= 65) return 'Good';
    if (score >= 60) return 'Credit';
    if (score >= 50) return 'Credit';
    if (score >= 45) return 'Pass';
    if (score >= 40) return 'Pass';
    return 'Fail';
}

console.log('✓ Print results page initialized');