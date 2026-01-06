/**
 * FAHMID NURSERY & PRIMARY SCHOOL
 * Print Results JavaScript - Complete Report Card
 * 
 * @version 5.0.1 - FULL NIGERIAN REPORT CARD
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

        // Fetch current school settings
        await getCurrentSettings();

        // Update term selector
        const termSelect = document.getElementById('print-term');
        if (termSelect) {
            termSelect.value = currentSettings.term;
            termSelect.addEventListener('change', async (e) => {
                currentSettings.term = e.target.value;
                updateReportHeader();
                await loadReportData();
            });
        }

        // Update report header
        updateReportHeader();

        // Load all report data
        await loadReportData();

    } catch (error) {
        console.error('Error loading pupil data:', error);
        handleError(error, 'Failed to load pupil information');
        setTimeout(() => window.location.href = 'login.html', 3000);
    }
}

// ==============================
// GET CURRENT SETTINGS
// ==============================

async function getCurrentSettings() {
    try {
        const settingsDoc = await db.collection('settings').doc('current').get();
        if (settingsDoc.exists) {
            currentSettings = settingsDoc.data();
        } else {
            currentSettings = { term: 'First Term', session: '', resumptionDate: '-' };
        }
        return currentSettings;
    } catch (error) {
        console.error('Error fetching current settings:', error);
        currentSettings = { term: 'First Term', session: '', resumptionDate: '-' };
        return currentSettings;
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
    if (sessionEl) sessionEl.textContent = session;

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
    await Promise.all([
        loadAcademicResults(),
        loadAttendance(),
        loadBehavioralTraits(),
        loadPsychomotorSkills(),
        loadRemarks(),
        displayResumptionDate()
    ]);
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
            document.getElementById('trait-punctuality').textContent = data.punctuality || '-';
            document.getElementById('trait-neatness').textContent = data.neatness || '-';
            document.getElementById('trait-politeness').textContent = data.politeness || '-';
            document.getElementById('trait-honesty').textContent = data.honesty || '-';
            document.getElementById('trait-obedience').textContent = data.obedience || '-';
            document.getElementById('trait-cooperation').textContent = data.cooperation || '-';
            document.getElementById('trait-attentiveness').textContent = data.attentiveness || '-';
            document.getElementById('trait-leadership').textContent = data.leadership || '-';
            document.getElementById('trait-selfcontrol').textContent = data.selfcontrol || '-';
            document.getElementById('trait-creativity').textContent = data.creativity || '-';
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
            document.getElementById('skill-handwriting').textContent = data.handwriting || '-';
            document.getElementById('skill-drawing').textContent = data.drawing || '-';
            document.getElementById('skill-sports').textContent = data.sports || '-';
            document.getElementById('skill-craft').textContent = data.craft || '-';
            document.getElementById('skill-verbal').textContent = data.verbal || '-';
            document.getElementById('skill-coordination').textContent = data.coordination || '-';
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
// RESUMPTION DATE
// ==============================

function displayResumptionDate() {
    updateReportHeader();
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