/**
 * FAHMID NURSERY & PRIMARY SCHOOL
 * Pupil Portal JavaScript - FIXED
 * 
 * @version 4.3.0 - CLASS HANDLING FIXED
 * @date 2026-01-06
 */

'use strict';

let currentPupilId = null;
let currentPupilData = null;
let currentClassInfo = null;

// Listener references to prevent duplicates
let pupilListener = null;
let classListener = null;

// Enforce pupil access and load profile
checkRole('pupil')
    .then(async user => await loadPupilProfile(user))
    .catch(() => window.location.href = 'login.html');

// Clean up listeners when page unloads
window.addEventListener('beforeunload', () => {
    if (pupilListener) {
        pupilListener();
        pupilListener = null;
    }
    if (classListener) {
        classListener();
        classListener = null;
    }
});

// ============================================
// HELPER: Safely extract class ID from pupil data
// ============================================
function getClassIdFromPupilData(classData) {
  if (!classData) return null;
  
  // New format: {id: "xyz", name: "Primary 3"}
  if (typeof classData === 'object' && classData.id) {
    return classData.id;
  }
  
  // Old format: just "Primary 3" as string
  // We can't get an ID from this, so return null
  return null;
}

// ============================================
// HELPER: Safely extract class name from pupil data
// ============================================
function getClassNameFromPupilData(classData) {
  if (!classData) return 'Unknown';
  
  // New format: {id: "xyz", name: "Primary 3"}
  if (typeof classData === 'object' && classData.name) {
    return classData.name;
  }
  
  // Old format: just "Primary 3" as string
  if (typeof classData === 'string') {
    return classData;
  }
  
  return 'Unknown';
}

// ============================================
// PUPIL PROFILE
// ============================================

async function loadPupilProfile(user) {
    try {
        // Detach existing listeners first to prevent duplicates
        if (pupilListener) {
            pupilListener();
            pupilListener = null;
        }
        if (classListener) {
            classListener();
            classListener = null;
        }

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

        // FIXED: Safely extract class ID and name
        const classId = getClassIdFromPupilData(data.class);
        const className = getClassNameFromPupilData(data.class);

        // Initialize class info with defaults
        currentClassInfo = { 
          name: className, 
          teacher: data.assignedTeacher?.name || '-', 
          subjects: data.subjects || [] 
        };

        // If we have a class ID, fetch full class details
        if (classId) {
            try {
                const classDoc = await db.collection('classes').doc(classId).get();
                if (classDoc.exists) {
                    const classData = classDoc.data();
                    currentClassInfo.name = classData.name;
                    currentClassInfo.subjects = classData.subjects || [];
                    
                    // Fetch teacher name if teacherName is missing
                    if (classData.teacherName) {
                        currentClassInfo.teacher = classData.teacherName;
                    } else if (classData.teacherId) {
                        const teacherDoc = await db.collection('teachers').doc(classData.teacherId).get();
                        currentClassInfo.teacher = teacherDoc.exists ? teacherDoc.data().name : '-';
                    } else {
                        currentClassInfo.teacher = '-';
                    }
                }
            } catch (error) {
                console.error('Error fetching class details:', error);
                // Continue with defaults if class fetch fails
            }
        } else {
            // FIXED: If pupil has old-format class data (no ID), try to find class by name
            if (typeof data.class === 'string') {
                try {
                    const classesSnapshot = await db.collection('classes')
                        .where('name', '==', data.class)
                        .limit(1)
                        .get();
                    
                    if (!classesSnapshot.empty) {
                        const matchedClassDoc = classesSnapshot.docs[0];
                        const matchedClassData = matchedClassDoc.data();
                        
                        currentClassInfo.subjects = matchedClassData.subjects || [];
                        
                        // Get teacher info
                        if (matchedClassData.teacherName) {
                            currentClassInfo.teacher = matchedClassData.teacherName;
                        } else if (matchedClassData.teacherId) {
                            const teacherDoc = await db.collection('teachers').doc(matchedClassData.teacherId).get();
                            currentClassInfo.teacher = teacherDoc.exists ? teacherDoc.data().name : '-';
                        }
                        
                        console.log('Note: Pupil has old class format. Admin should edit and save to upgrade.');
                    }
                } catch (error) {
                    console.error('Error finding class by name:', error);
                    // Continue with defaults if search fails
                }
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

        // Update header information
        const settings = await getCurrentSettings();
        const welcomeEl = document.getElementById('pupil-welcome');
        const classEl = document.getElementById('student-class');
        const sessionEl = document.getElementById('student-session');
        
        if (welcomeEl) {
            welcomeEl.innerHTML = `Hello, <strong>${data.name}</strong>!`;
        }
        if (classEl) {
            classEl.textContent = currentClassInfo.name;
        }
        if (sessionEl) {
            sessionEl.textContent = settings.session;
        }

        // Load results
        await loadResults();

        // Live update: watch pupil doc (store listener reference with error handling)
        pupilListener = db.collection('pupils').doc(currentPupilId)
            .onSnapshot(
                async snap => {
                    if (snap.exists) {
                        const updatedData = snap.data();
                        currentPupilData = updatedData;
                        
                        // FIXED: Safely extract updated class info
                        const updatedClassId = getClassIdFromPupilData(updatedData.class);
                        const updatedClassName = getClassNameFromPupilData(updatedData.class);
                        
                        currentClassInfo.name = updatedClassName;
                        currentClassInfo.teacher = updatedData.assignedTeacher?.name || '-';
                        currentClassInfo.subjects = updatedData.subjects || [];
                        
                        // Update UI directly without calling loadPupilProfile again
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

                        // Update header information
                        const settings = await getCurrentSettings();
                        const welcomeEl = document.getElementById('pupil-welcome');
                        const classEl = document.getElementById('student-class');
                        const sessionEl = document.getElementById('student-session');
                        
                        if (welcomeEl) {
                            welcomeEl.innerHTML = `Hello, <strong>${updatedData.name}</strong>!`;
                        }
                        if (classEl) {
                            classEl.textContent = currentClassInfo.name;
                        }
                        if (sessionEl) {
                            sessionEl.textContent = settings.session;
                        }

                        // Reload results in case they changed
                        await loadResults();
                    }
                },
                error => {
                    console.error('Pupil listener error:', error);
                    window.showToast?.('Lost connection to server. Please refresh the page.', 'warning');
                }
            );

        // Live update: watch class doc for subject changes (only if we have a class ID)
        if (classId) {
            classListener = db.collection('classes').doc(classId)
                .onSnapshot(
                    async snap => {
                        if (snap.exists) {
                            const classData = snap.data();
                            currentClassInfo.name = classData.name;
                            currentClassInfo.subjects = classData.subjects || [];
                            
                            // Fetch teacher name if needed
                            if (classData.teacherName) {
                                currentClassInfo.teacher = classData.teacherName;
                            } else if (classData.teacherId) {
                                const teacherDoc = await db.collection('teachers').doc(classData.teacherId).get();
                                currentClassInfo.teacher = teacherDoc.exists ? teacherDoc.data().name : '-';
                            } else {
                                currentClassInfo.teacher = '-';
                            }
                            
                            // Update profile with new class info
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

                            // Update header information
                            const settings = await getCurrentSettings();
                            const welcomeEl = document.getElementById('pupil-welcome');
                            const classEl = document.getElementById('student-class');
                            const sessionEl = document.getElementById('student-session');
                            
                            if (welcomeEl) {
                                welcomeEl.innerHTML = `Hello, <strong>${currentPupilData.name}</strong>!`;
                            }
                            if (classEl) {
                                classEl.textContent = currentClassInfo.name;
                            }
                            if (sessionEl) {
                                sessionEl.textContent = settings.session;
                            }

                            renderSubjects(currentClassInfo.subjects, currentClassInfo.teacher);
                        }
                    },
                    error => {
                        console.error('Class listener error:', error);
                        window.showToast?.('Lost connection to class updates. Please refresh the page.', 'warning');
                    }
                );
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
    // Update the existing profile table fields
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
        const subjectList = profile.subjects && profile.subjects.length > 0 
            ? profile.subjects.join(', ') 
            : '-';
        subjectsDisplay.textContent = subjectList;
    }
}

// ============================================
// SUBJECTS RENDER (Kept for compatibility)
// ============================================
function renderSubjects(subjects, teacher) {
    // This function is kept for backward compatibility
    // but the subjects are now displayed in the main profile table
    const subjectsDisplay = document.getElementById('pupil-subjects-display');
    if (subjectsDisplay) {
        const subjectList = subjects && subjects.length > 0 
            ? subjects.join(', ') 
            : '-';
        subjectsDisplay.textContent = subjectList;
    }
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

console.log('✓ Pupil portal initialized (v4.3.0 - CLASS HANDLING FIXED)');