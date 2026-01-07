/**
 * FAHMID NURSERY & PRIMARY SCHOOL
 * Pupil Portal JavaScript - FULLY FIXED
 * 
 * @version 4.3.1
 * @date 2026-01-07
 */

'use strict';

let currentPupilId = null;
let currentPupilData = null;
let currentClassInfo = null;

// Listener references
let pupilListener = null;
let classListener = null;

// Enforce pupil access and load profile
checkRole('pupil')
    .then(async user => await loadPupilProfile(user))
    .catch(() => window.location.href = 'login.html');

// Clean up listeners on page unload
window.addEventListener('beforeunload', () => {
    if (pupilListener) pupilListener();
    if (classListener) classListener();
});

// ============================================
// HELPERS: Class extraction
// ============================================
function getClassIdFromPupilData(classData) {
    if (!classData) return null;
    if (typeof classData === 'object' && classData.id) return classData.id;
    return null;
}

function getClassNameFromPupilData(classData) {
    if (!classData) return 'Unknown';
    if (typeof classData === 'object' && classData.name) return classData.name;
    if (typeof classData === 'string') return classData;
    return 'Unknown';
}

// ============================================
// LOAD PUPIL PROFILE
// ============================================
async function loadPupilProfile(user) {
    try {
        // Detach listeners
        if (pupilListener) pupilListener();
        if (classListener) classListener();

        const pupilDoc = await db.collection('pupils').doc(user.uid).get();
        if (!pupilDoc.exists) {
            console.error('No pupil profile for UID:', user.uid);
            window.showToast?.('No pupil profile found. Contact admin.', 'danger');
            setTimeout(() => window.location.href = 'login.html', 3000);
            return;
        }

        const data = pupilDoc.data();
        currentPupilId = pupilDoc.id;
        currentPupilData = data;

        // Extract class info
        const classId = getClassIdFromPupilData(data.class);
        const className = getClassNameFromPupilData(data.class);

        currentClassInfo = {
            name: className,
            teacher: data.assignedTeacher?.name || '-',
            subjects: data.subjects || []
        };

        // Fetch full class details if ID exists
        if (classId) {
            try {
                const classDoc = await db.collection('classes').doc(classId).get();
                if (classDoc.exists) {
                    const classData = classDoc.data();
                    currentClassInfo.name = classData.name || currentClassInfo.name;
                    currentClassInfo.subjects = classData.subjects || [];
                    if (classData.teacherName) {
                        currentClassInfo.teacher = classData.teacherName;
                    } else if (classData.teacherId) {
                        const teacherDoc = await db.collection('teachers').doc(classData.teacherId).get();
                        currentClassInfo.teacher = teacherDoc.exists ? teacherDoc.data().name : '-';
                    } else {
                        currentClassInfo.teacher = '-';
                    }
                }
            } catch (err) {
                console.error('Error fetching class details:', err);
            }
        } else if (typeof data.class === 'string') {
            // Old format: find class by name
            try {
                const classesSnapshot = await db.collection('classes')
                    .where('name', '==', data.class)
                    .limit(1)
                    .get();
                if (!classesSnapshot.empty) {
                    const matchedClass = classesSnapshot.docs[0].data();
                    currentClassInfo.subjects = matchedClass.subjects || [];
                    if (matchedClass.teacherName) currentClassInfo.teacher = matchedClass.teacherName;
                    else if (matchedClass.teacherId) {
                        const teacherDoc = await db.collection('teachers').doc(matchedClass.teacherId).get();
                        currentClassInfo.teacher = teacherDoc.exists ? teacherDoc.data().name : '-';
                    }
                    console.log('Note: Pupil has old class format. Admin should upgrade.');
                }
            } catch (err) {
                console.error('Error finding class by name:', err);
            }
        }

        // Display profile
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

        // Update header info
        const settings = await getCurrentSettings();
        const welcomeEl = document.getElementById('pupil-welcome');
        const classEl = document.getElementById('student-class');
        const sessionEl = document.getElementById('student-session');

        if (welcomeEl) welcomeEl.innerHTML = `Hello, <strong>${data.name}</strong>!`;
        if (classEl) classEl.textContent = currentClassInfo.name;
        if (sessionEl) sessionEl.textContent = settings.session;

        // Load results
        await loadResults();

        // ============================================
        // LIVE LISTENERS
        // ============================================

        // Pupil document
        pupilListener = db.collection('pupils').doc(currentPupilId)
            .onSnapshot(async snap => {
                if (!snap.exists) return;
                const updatedData = snap.data();
                currentPupilData = updatedData;

                const updatedClassId = getClassIdFromPupilData(updatedData.class);
                const updatedClassName = getClassNameFromPupilData(updatedData.class);

                currentClassInfo.name = updatedClassName;
                currentClassInfo.teacher = updatedData.assignedTeacher?.name || '-';
                currentClassInfo.subjects = updatedData.subjects || [];

                renderProfile({
                    name: updatedData.name || '-',
                    dob: updatedData.dob || '-',
                    gender: updatedData.gender || '-',
                    contact: updatedData.contact || '-',
                    address: updatedData.address || '-',
                    email: updatedData.email || '-',
                    class: currentClassInfo.name,
                    teacher: currentClassInfo.teacher,
                    subjects: currentClassInfo.subjects
                });

                const settings = await getCurrentSettings();
                const welcomeEl = document.getElementById('pupil-welcome');
                const classEl = document.getElementById('student-class');
                const sessionEl = document.getElementById('student-session');

                if (welcomeEl) welcomeEl.innerHTML = `Hello, <strong>${updatedData.name}</strong>!`;
                if (classEl) classEl.textContent = currentClassInfo.name;
                if (sessionEl) sessionEl.textContent = settings.session;

                await loadResults();
            }, error => {
                console.error('Pupil listener error:', error);
                window.showToast?.('Lost connection. Refresh page.', 'warning');
            });

        // Class document
        if (classId) {
            classListener = db.collection('classes').doc(classId)
                .onSnapshot(async snap => {
                    if (!snap.exists) return;
                    const classData = snap.data();
                    currentClassInfo.name = classData.name;
                    currentClassInfo.subjects = classData.subjects || [];
                    if (classData.teacherName) currentClassInfo.teacher = classData.teacherName;
                    else if (classData.teacherId) {
                        const teacherDoc = await db.collection('teachers').doc(classData.teacherId).get();
                        currentClassInfo.teacher = teacherDoc.exists ? teacherDoc.data().name : '-';
                    } else currentClassInfo.teacher = '-';

                    renderProfile({
                        name: currentPupilData.name || '-',
                        dob: currentPupilData.dob || '-',
                        gender: currentPupilData.gender || '-',
                        contact: currentPupilData.contact || '-',
                        address: currentPupilData.address || '-',
                        email: currentPupilData.email || '-',
                        class: currentClassInfo.name,
                        teacher: currentClassInfo.teacher,
                        subjects: currentClassInfo.subjects
                    });

                    renderSubjects(currentClassInfo.subjects, currentClassInfo.teacher);
                }, error => {
                    console.error('Class listener error:', error);
                    window.showToast?.('Lost connection to class updates. Refresh page.', 'warning');
                });
        }

    } catch (error) {
        console.error('Error loading pupil profile:', error);
        window.handleError?.(error, 'Failed to load pupil profile');
    }
}

// ============================================
// PROFILE RENDER
// ============================================
function renderProfile(profile) {
    const nameDisplay = document.getElementById('pupil-name-display');
    const dobDisplay = document.getElementById('pupil-dob-display');
    const genderDisplay = document.getElementById('pupil-gender-display');
    const contactDisplay = document.getElementById('pupil-contact-display');
    const addressDisplay = document.getElementById('pupil-address-display');
    const classDisplay = document.getElementById('pupil-class-display');
    const teacherDisplay = document.getElementById('pupil-teacher-display');
    const subjectsDisplay = document.getElementById('pupil-subjects-display');

    if (nameDisplay) nameDisplay.textContent = profile.name;
    if (dobDisplay) dobDisplay.textContent = profile.dob;
    if (genderDisplay) genderDisplay.textContent = profile.gender;
    if (contactDisplay) contactDisplay.textContent = profile.contact;
    if (addressDisplay) addressDisplay.textContent = profile.address;
    if (classDisplay) classDisplay.textContent = profile.class;
    if (teacherDisplay) teacherDisplay.textContent = profile.teacher;

    if (subjectsDisplay) {
        subjectsDisplay.textContent = profile.subjects && profile.subjects.length ? profile.subjects.join(', ') : '-';
    }
}

function renderSubjects(subjects, teacher) {
    const subjectsDisplay = document.getElementById('pupil-subjects-display');
    if (subjectsDisplay) subjectsDisplay.textContent = subjects && subjects.length ? subjects.join(', ') : '-';
}

// ============================================
// RESULTS DISPLAY
// ============================================
async function loadResults() {
    if (!currentPupilId) return;
    const container = document.getElementById('results-container');
    if (!container) return;

    container.innerHTML = `<div class="skeleton-container">
        <div class="skeleton" style="height:40px;width:60%;margin:var(--space-xl) auto;"></div>
        <div class="skeleton" style="height:30px;margin:var(--space-lg) 0 var(--space-sm;"></div>
        <div class="skeleton" style="height:30px;margin-bottom:var(--space-sm);"></div>
    </div>`;

    try {
        const resultsSnap = await db.collection('results').get();
        const pupilResults = [];

        resultsSnap.forEach(doc => {
            const docId = doc.id;
            const data = doc.data();
            if (!data) return;

            if (docId.startsWith(currentPupilId + '_')) {
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

        ['First Term','Second Term','Third Term'].forEach(termName => {
            if (!terms[termName]) return;

            const termSection = document.createElement('div');
            termSection.className = 'results-term-section';
            const heading = document.createElement('h3');
            heading.textContent = termName;
            termSection.appendChild(heading);

            const table = document.createElement('table');
            table.className = 'results-table';
            table.innerHTML = `<thead>
                <tr><th>SUBJECT</th><th>CA (40)</th><th>EXAM (60)</th><th>TOTAL (100)</th><th>GRADE</th></tr>
            </thead><tbody></tbody>`;
            const tbody = table.querySelector('tbody');

            let termTotal = 0;
            let subjectCount = 0;

            terms[termName].sort((a,b)=>a.subject.localeCompare(b.subject)).forEach(r=>{
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

            if (subjectCount>0){
                const average = (termTotal/subjectCount).toFixed(1);
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
function getGrade(score){
    if (score>=75) return 'A1';
    if (score>=70) return 'B2';
    if (score>=65) return 'B3';
    if (score>=60) return 'C4';
    if (score>=55) return 'C5';
    if (score>=50) return 'C6';
    if (score>=45) return 'D7';
    if (score>=40) return 'D8';
    return 'F9';
}

console.log('✓ Pupil portal initialized (v4.3.1)');