/**
 * FAHMID NURSERY & PRIMARY SCHOOL
 * Pupil Portal JavaScript - FULLY ALIGNED WITH PRINT PAGE
 * 
 * @version 4.1.0
 * @date 2026-01-06
 */

'use strict';

let currentPupilId = null;
let currentPupilData = null;
let currentClassInfo = null;

// Enforce pupil access and load profile
checkRole('pupil')
    .then(async user => await loadPupilProfile(user))
    .catch(() => window.location.href = 'login.html');

// ============================================
// PUPIL PROFILE
// ============================================
async function loadPupilProfile(user) {
    try {
        const pupilDoc = await db.collection('pupils').doc(user.uid).get();

        if (!pupilDoc.exists) {
            console.error('No pupil profile found for UID:', user.uid);
            window.showToast?.('No pupil profile found. Contact admin.', 'danger');
            setTimeout(() => window.location.href = 'login.html', 3000);
            return;
        }

        const data = pupilDoc.data();
        currentPupilId = pupilDoc.id;
        currentPupilData = data;

        // Fetch class info, teacher, subjects
        currentClassInfo = { name: data.class || 'Unknown', teacher: '-', subjects: [] };
        if (data.classId) {
            const classDoc = await db.collection('classes').doc(data.classId).get();
            if (classDoc.exists) {
                const classData = classDoc.data();
                currentClassInfo.name = classData.name;
                currentClassInfo.teacher = classData.teacherName || '-';
                currentClassInfo.subjects = classData.subjects || [];
            }
        }

        // Display pupil profile
        renderProfile({
            name: data.name || '-',
            dob: data.dob || '-',
            gender: data.gender || '-',
            contact: data.contact || '-',
            address: data.address || '-',
            email: data.email || '-',
            class: currentClassInfo.name,
            teacher: currentClassInfo.teacher,
            subjects: currentClassInfo.subjects
        });

        // Update welcome message
        const settings = await getCurrentSettings();
        document.getElementById('pupil-welcome').innerHTML = `
            Hello, <strong>${data.name}</strong>!<br>
            Class: ${currentClassInfo.name}<br>
            Session: ${settings.session}
        `;

        // Load results
        await loadResults();

        // Live update: watch pupil doc
        db.collection('pupils').doc(currentPupilId)
            .onSnapshot(async snap => {
                if (snap.exists) {
                    currentPupilData = snap.data();
                    await loadPupilProfile({ uid: currentPupilId });
                }
            });

        // Live update: watch class doc for subject changes
        if (data.classId) {
            db.collection('classes').doc(data.classId)
                .onSnapshot(snap => {
                    if (snap.exists) {
                        const classData = snap.data();
                        currentClassInfo.subjects = classData.subjects || [];
                        currentClassInfo.teacher = classData.teacherName || '-';
                        renderSubjects(currentClassInfo.subjects, currentClassInfo.teacher);
                    }
                });
        }

    } catch (error) {
        console.error('Error loading pupil profile:', error);
        handleError(error, 'Failed to load pupil profile');
    }
}

// ============================================
// PROFILE RENDER
// ============================================
function renderProfile(profile) {
    const containerId = 'profile-container';
    let container = document.getElementById(containerId);
    if (!container) {
        container = document.createElement('div');
        container.id = containerId;
        container.className = 'reveal';
        document.querySelector('.pupil-main').prepend(container);
    }

    container.innerHTML = `
        <table class="results-table">
            <tbody>
                <tr><td>Name</td><td>${profile.name}</td></tr>
                <tr><td>Date of Birth</td><td>${profile.dob}</td></tr>
                <tr><td>Gender</td><td>${profile.gender}</td></tr>
                <tr><td>Contact</td><td>${profile.contact}</td></tr>
                <tr><td>Address</td><td>${profile.address}</td></tr>
                <tr><td>Email</td><td>${profile.email}</td></tr>
                <tr><td>Class</td><td>${profile.class}</td></tr>
                <tr><td>Class Teacher</td><td>${profile.teacher}</td></tr>
            </tbody>
        </table>
    `;

    renderSubjects(profile.subjects, profile.teacher);
}

// ============================================
// SUBJECTS RENDER
// ============================================
function renderSubjects(subjects, teacher) {
    const containerId = 'subjects-container';
    let container = document.getElementById(containerId);
    if (!container) {
        container = document.createElement('div');
        container.id = containerId;
        container.className = 'reveal';
        const profileContainer = document.getElementById('profile-container');
        profileContainer.insertAdjacentElement('afterend', container);
    }

    const subjectList = subjects.length ? subjects.map(s => `<li>${s}</li>`).join('') : '<li>-</li>';

    container.innerHTML = `
        <h3>Subjects & Teacher</h3>
        <p><strong>Class Teacher:</strong> ${teacher}</p>
        <ul>${subjectList}</ul>
    `;
}

// ============================================
// RESULTS DISPLAY
// ============================================
async function loadResults() {
    if (!currentPupilId) return;

    const container = document.getElementById('results-container');
    if (!container) return;

    container.innerHTML = `
        <div class="skeleton-container">
            <div class="skeleton" style="height:40px;width:60%;margin:var(--space-xl) auto;"></div>
            <div class="skeleton" style="height:30px;margin:var(--space-lg) 0 var(--space-sm;"></div>
            <div class="skeleton" style="height:30px;margin-bottom:var(--space-sm);"></div>
        </div>
    `;

    try {
        const resultsSnap = await db.collection('results').get();
        const pupilResults = [];

        resultsSnap.forEach(doc => {
            const docId = doc.id;
            if (docId.startsWith(currentPupilId + '_')) {
                const data = doc.data();
                const parts = docId.split('_');
                if (parts.length >= 3) {
                    const term = parts[1];
                    const subject = parts.slice(2).join('_');
                    pupilResults.push({
                        term,
                        subject,
                        caScore: data.caScore || 0,
                        examScore: data.examScore || 0,
                        total: (data.caScore || 0) + (data.examScore || 0)
                    });
                }
            }
        });

        container.innerHTML = '';

        if (!pupilResults.length) {
            container.innerHTML = `<p style="text-align:center; padding:var(--space-2xl); font-size:var(--text-lg); color:var(--color-gray-600);">
                📚 No results have been entered yet.<br>Your teachers will upload scores soon.
            </p>`;
            return;
        }

        const terms = {};
        pupilResults.forEach(r => { if (!terms[r.term]) terms[r.term] = []; terms[r.term].push(r); });

        ['First Term', 'Second Term', 'Third Term'].forEach(termName => {
            if (!terms[termName]) return;

            const termSection = document.createElement('div');
            termSection.className = 'results-term-section';
            const heading = document.createElement('h3');
            heading.textContent = termName;
            termSection.appendChild(heading);

            const table = document.createElement('table');
            table.className = 'results-table';
            table.innerHTML = `
                <thead>
                    <tr>
                        <th>SUBJECT</th><th>CA (40)</th><th>EXAM (60)</th><th>TOTAL (100)</th><th>GRADE</th>
                    </tr>
                </thead>
                <tbody></tbody>
            `;
            const tbody = table.querySelector('tbody');

            let termTotal = 0;
            let subjectCount = 0;

            terms[termName].sort((a, b) => a.subject.localeCompare(b.subject))
                .forEach(r => {
                    const grade = getGrade(r.total);
                    tbody.innerHTML += `<tr>
                        <td><strong>${r.subject}</strong></td>
                        <td style="text-align:center;">${r.caScore}</td>
                        <td style="text-align:center;">${r.examScore}</td>
                        <td style="text-align:center;font-weight:bold;">${r.total}</td>
                        <td style="text-align:center;" class="grade-${grade}">${grade}</td>
                    </tr>`;
                    termTotal += r.total;
                    subjectCount++;
                });

            if (subjectCount > 0) {
                const average = (termTotal / subjectCount).toFixed(1);
                const avgGrade = getGrade(parseFloat(average));

                tbody.innerHTML += `<tr class="summary-row">
                    <td colspan="3"><strong>TOTAL SCORE</strong></td>
                    <td colspan="2"><strong>${termTotal} / ${subjectCount*100}</strong></td>
                </tr>
                <tr class="summary-row">
                    <td colspan="3"><strong>AVERAGE</strong></td>
                    <td colspan="2"><strong>${average}% (${avgGrade})</strong></td>
                </tr>`;
            }

            termSection.appendChild(table);
            container.appendChild(termSection);
        });

    } catch (error) {
        console.error('Error loading results:', error);
        container.innerHTML = `<p style="text-align:center;color:var(--color-danger); padding:var(--space-2xl);">
            ⚠️ Unable to load results. Try again later.
        </p>`;
    }
}

// ============================================
// GRADE CALCULATION
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

console.log('✓ Pupil portal initialized (v4.1.0)');