/**
 * FAHMID NURSERY & PRIMARY SCHOOL
 * Print Results JavaScript - Complete Report Card
 * 
 * @version 4.0.0 - FULL NIGERIAN REPORT CARD
 * @date 2026-01-04
 */

'use strict';

let currentPupilId = null;
let currentTerm = 'First Term'; // Default term

checkRole('pupil').then(async user => {
    await loadPupilData(user);
}).catch(() => {});

async function loadPupilData(user) {
    try {
        const pupilDoc = await db.collection('pupils').doc(user.uid).get();

        if (!pupilDoc.exists) {
            console.error('No pupil profile found for UID:', user.uid);
            window.showToast?.('No pupil profile found', 'danger');
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 2000);
            return;
        }

        const pupilData = pupilDoc.data();
        currentPupilId = pupilDoc.id;

        console.log('✓ Pupil profile loaded:', {
            uid: currentPupilId,
            name: pupilData.name
        });

        // Update bio data
        document.getElementById('student-name').textContent = pupilData.name;
        document.getElementById('student-class').textContent = pupilData.class || 'N/A';
        document.getElementById('admission-no').textContent = pupilData.admissionNo || '-';
        document.getElementById('student-gender').textContent = pupilData.gender || '-';

        // Fetch current settings for default term and session
        const settings = await getCurrentSettings();
        currentTerm = settings.term; // Set global currentTerm
        const currentSession = settings.session;

        // Set term selector to current term
        const termSelect = document.getElementById('print-term');
        if (termSelect) {
            termSelect.value = currentTerm;
            // Reload data when term changed
            termSelect.addEventListener('change', (e) => {
                currentTerm = e.target.value;
                loadReportData();
            });
        }

        // Update report title with term and session
        document.getElementById('report-title').textContent = `${currentTerm} Report Card - ${currentSession} Session`;
        document.getElementById('current-term').textContent = currentTerm;

        // Load all report data
        await loadReportData();
    } catch (error) {
        console.error('Error loading pupil data:', error);
        handleError(error, 'Failed to load pupil information');
        
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 3000);
    }
}

async function loadReportData() {
  await Promise.all([
    loadAcademicResults(),
    loadAttendance(),
    loadBehavioralTraits(),
    loadPsychomotorSkills(),
    loadRemarks(),
    loadResumptionDate()  // NEW
  ]);
}

// ============================================
// ACADEMIC RESULTS
// ============================================

async function loadAcademicResults() {
    const tbody = document.getElementById('academic-tbody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 5mm;">Loading results...</td></tr>';

    try {
        console.log('Loading results for:', currentPupilId, currentTerm);

        const resultsSnap = await db.collection('results')
            .where('pupilId', '==', currentPupilId)
            .where('term', '==', currentTerm)
            .get();

        tbody.innerHTML = '';

        if (resultsSnap.empty) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 5mm; color: #666;">No results available for this term yet.</td></tr>';
            return;
        }

        // Collect results
        const results = [];
        resultsSnap.forEach(doc => {
            results.push(doc.data());
        });

        // Sort by subject name
        results.sort((a, b) => a.subject.localeCompare(b.subject));

        // Calculate totals
        let totalScore = 0;
        let subjectCount = 0;

        // Display each subject
        results.forEach(result => {
            // FIXED: Use correct field names from Firestore
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

        // Add summary rows
        if (subjectCount > 0) {
            const average = (totalScore / subjectCount).toFixed(1);
            const overallGrade = getGrade(parseFloat(average));

            // Total row
            const totalRow = document.createElement('tr');
            totalRow.className = 'summary-row';
            totalRow.innerHTML = `
                <td colspan="3" style="text-align: right;"><strong>TOTAL SCORE OBTAINED:</strong></td>
                <td colspan="3"><strong>${totalScore} / ${subjectCount * 100}</strong></td>
            `;
            tbody.appendChild(totalRow);

            // Average row
            const avgRow = document.createElement('tr');
            avgRow.className = 'summary-row';
            avgRow.innerHTML = `
                <td colspan="3" style="text-align: right;"><strong>AVERAGE SCORE:</strong></td>
                <td colspan="3"><strong>${average}%</strong></td>
            `;
            tbody.appendChild(avgRow);

            // Overall grade row
            const gradeRow = document.createElement('tr');
            gradeRow.className = 'summary-row';
            gradeRow.innerHTML = `
                <td colspan="3" style="text-align: right;"><strong>OVERALL GRADE:</strong></td>
                <td colspan="3" class="grade-${overallGrade.replace(/ /g, '')}"><strong>${overallGrade}</strong></td>
            `;
            tbody.appendChild(gradeRow);
        }

        console.log('✓ Academic results loaded successfully');
    } catch (error) {
        console.error('Error loading academic results:', error);
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 5mm; color: #d32f2f;">Error loading results.</td></tr>';
    }
}

// ============================================
// ATTENDANCE
// ============================================

async function loadAttendance() {
    try {
        const attendanceDoc = await db.collection('attendance')
            .doc(`${currentPupilId}_${currentTerm}`)
            .get();

        if (attendanceDoc.exists) {
            const data = attendanceDoc.data();
            document.getElementById('times-opened').textContent = data.timesOpened || '-';
            document.getElementById('times-present').textContent = data.timesPresent || '-';
            document.getElementById('times-absent').textContent = data.timesAbsent || '-';
        } else {
            // Default values if no attendance record
            document.getElementById('times-opened').textContent = '-';
            document.getElementById('times-present').textContent = '-';
            document.getElementById('times-absent').textContent = '-';
        }

        console.log('✓ Attendance loaded');
    } catch (error) {
        console.error('Error loading attendance:', error);
    }
}

// ============================================
// BEHAVIORAL TRAITS
// ============================================

async function loadBehavioralTraits() {
    try {
        const traitsDoc = await db.collection('behavioral_traits')
            .doc(`${currentPupilId}_${currentTerm}`)
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

        console.log('✓ Behavioral traits loaded');
    } catch (error) {
        console.error('Error loading behavioral traits:', error);
    }
}

// ============================================
// PSYCHOMOTOR SKILLS
// ============================================

async function loadPsychomotorSkills() {
    try {
        const skillsDoc = await db.collection('psychomotor_skills')
            .doc(`${currentPupilId}_${currentTerm}`)
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

        console.log('✓ Psychomotor skills loaded');
    } catch (error) {
        console.error('Error loading psychomotor skills:', error);
    }
}

// ============================================
// REMARKS
// ============================================

async function loadRemarks() {
  try {
    const remarksDoc = await db.collection('remarks')
      .doc(`${currentPupilId}_${currentTerm}`)
      .get();

    if (remarksDoc.exists) {
      const data = remarksDoc.data();
      document.getElementById('teacher-remark').textContent = data.teacherRemark || '-';
      document.getElementById('head-remark').textContent = data.headRemark || '-';
    }

    console.log('✓ Remarks loaded');
  } catch (error) {
    console.error('Error loading remarks:', error);
  }
}

async function loadResumptionDate() {
  try {
    const settings = await getCurrentSettings();
    document.getElementById('resumption-date').textContent = settings.resumptionDate || '-';
  } catch (error) {
    console.error('Error loading resumption date:', error);
    document.getElementById('resumption-date').textContent = '-';
  }
}

// ============================================
// GRADING FUNCTIONS
// ============================================

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