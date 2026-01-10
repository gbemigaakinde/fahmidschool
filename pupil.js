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
    // FIXED: Add loading flag to prevent re-entry
    if (window.isLoadingProfile) {
        console.log('Profile already loading, skipping...');
        return;
    }
    
    window.isLoadingProfile = true;
    
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
            window.isLoadingProfile = false;
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
          subjects: Array.isArray(data.subjects) ? data.subjects : [] 
        };

        // If we have a class ID, fetch full class details
        if (classId) {
            try {
                const classDoc = await db.collection('classes').doc(classId).get();
                if (classDoc.exists) {
                    const classData = classDoc.data();
                    currentClassInfo.name = classData.name || className;
                    currentClassInfo.subjects = Array.isArray(classData.subjects) ? classData.subjects : [];
                    
                    // Fetch teacher name if teacherName is missing
                    if (classData.teacherName) {
                        currentClassInfo.teacher = classData.teacherName;
                    } else if (classData.teacherId) {
                        try {
                            const teacherDoc = await db.collection('teachers').doc(classData.teacherId).get();
                            currentClassInfo.teacher = teacherDoc.exists ? teacherDoc.data().name : '-';
                        } catch (teacherError) {
                            console.error('Error fetching teacher:', teacherError);
                            currentClassInfo.teacher = '-';
                        }
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
                        
                        currentClassInfo.subjects = Array.isArray(matchedClassData.subjects) ? matchedClassData.subjects : [];
                        
                        // Get teacher info
                        if (matchedClassData.teacherName) {
                            currentClassInfo.teacher = matchedClassData.teacherName;
                        } else if (matchedClassData.teacherId) {
                            try {
                                const teacherDoc = await db.collection('teachers').doc(matchedClassData.teacherId).get();
                                currentClassInfo.teacher = teacherDoc.exists ? teacherDoc.data().name : '-';
                            } catch (teacherError) {
                                console.error('Error fetching teacher:', teacherError);
                                currentClassInfo.teacher = '-';
                            }
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
    admissionNo: data.admissionNo || '-',
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

    /**
 * FIXED PUPIL PROFILE LISTENER
 * Replace the listener setup in loadPupilProfile() function
 */

// CRITICAL FIX: Set up listeners with proper debouncing
let pupilUpdateTimeout = null;

pupilListener = db.collection('pupils').doc(currentPupilId)
  .onSnapshot(
    async snap => {
      // CRITICAL: Prevent recursive updates with debouncing
      if (pupilUpdateTimeout) {
        clearTimeout(pupilUpdateTimeout);
      }
      
      pupilUpdateTimeout = setTimeout(async () => {
        try {
          if (!snap.exists) return;
          
          const updatedData = snap.data();
          
          // Check if data actually changed
          const hasChanges = JSON.stringify(currentPupilData) !== JSON.stringify(updatedData);
          
          if (!hasChanges) {
            console.log('No changes detected, skipping update');
            return;
          }
          
          console.log('Pupil data changed, updating UI...');
          
          currentPupilData = updatedData;
          
          // Extract class info safely
          const updatedClassId = getClassIdFromPupilData(updatedData.class);
          const updatedClassName = getClassNameFromPupilData(updatedData.class);
          
          currentClassInfo.name = updatedClassName;
          currentClassInfo.teacher = updatedData.assignedTeacher?.name || '-';
          currentClassInfo.subjects = Array.isArray(updatedData.subjects) ? updatedData.subjects : [];
          
          // Update UI directly without calling loadPupilProfile
          renderProfile({
            name: updatedData.name || '-',
            dob: updatedData.dob || '-',
            admissionNo: updatedData.admissionNo || '-',
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
          
          console.log('✓ Profile updated from listener');
          
        } catch (error) {
          console.error('Error in pupil listener:', error);
        } finally {
          pupilUpdateTimeout = null;
        }
      }, 500); // 500ms debounce
    },
    error => {
      console.error('Pupil listener error:', error);
      window.showToast?.('Lost connection to server. Please refresh the page.', 'warning');
    }
  );

// FIXED: Class listener with debouncing
let classUpdateTimeout = null;

if (classId) {
  classListener = db.collection('classes').doc(classId)
    .onSnapshot(
      async snap => {
        if (classUpdateTimeout) {
          clearTimeout(classUpdateTimeout);
        }
        
        classUpdateTimeout = setTimeout(async () => {
          try {
            if (!snap.exists) return;
            
            const classData = snap.data();
            
            // Check if data actually changed
            const hasChanges = 
              currentClassInfo.name !== classData.name ||
              JSON.stringify(currentClassInfo.subjects) !== JSON.stringify(classData.subjects);
            
            if (!hasChanges) {
              console.log('No class changes detected, skipping update');
              return;
            }
            
            console.log('Class data changed, updating UI...');
            
            currentClassInfo.name = classData.name || currentClassInfo.name;
            currentClassInfo.subjects = Array.isArray(classData.subjects) ? classData.subjects : [];
            
            // Fetch teacher name if needed
            if (classData.teacherName) {
              currentClassInfo.teacher = classData.teacherName;
            } else if (classData.teacherId) {
              try {
                const teacherDoc = await db.collection('teachers').doc(classData.teacherId).get();
                currentClassInfo.teacher = teacherDoc.exists ? teacherDoc.data().name : '-';
              } catch (teacherError) {
                console.error('Error fetching teacher:', teacherError);
              }
            } else {
              currentClassInfo.teacher = '-';
            }
            
            // Update profile with new class info
            renderProfile({
              name: currentPupilData.name || '-',
              dob: currentPupilData.dob || '-',
              admissionNo: currentPupilData.admissionNo || '-',
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
            
          } catch (error) {
            console.error('Error in class listener:', error);
          } finally {
            classUpdateTimeout = null;
          }
        }, 500); // 500ms debounce
      },
      error => {
        console.error('Class listener error:', error);
        window.showToast?.('Lost connection to class updates. Please refresh the page.', 'warning');
      }
    );
}

// FIXED: Class listener with debouncing
let classUpdateTimeout = null;

if (classId) {
  classListener = db.collection('classes').doc(classId)
    .onSnapshot(
      async snap => {
        // CRITICAL: Prevent recursive updates with debouncing
        if (classUpdateTimeout) {
          clearTimeout(classUpdateTimeout);
        }
        
        classUpdateTimeout = setTimeout(async () => {
          try {
            if (!snap.exists) return;
            
            const classData = snap.data();
            
            // Check if data actually changed
            const hasChanges = 
              currentClassInfo.name !== classData.name ||
              JSON.stringify(currentClassInfo.subjects) !== JSON.stringify(classData.subjects);
            
            if (!hasChanges) {
              console.log('No class changes detected, skipping update');
              return;
            }
            
            console.log('Class data changed, updating UI...');
            
            currentClassInfo.name = classData.name || currentClassInfo.name;
            currentClassInfo.subjects = Array.isArray(classData.subjects) ? classData.subjects : [];
            
            // Fetch teacher name if needed
            if (classData.teacherName) {
              currentClassInfo.teacher = classData.teacherName;
            } else if (classData.teacherId) {
              try {
                const teacherDoc = await db.collection('teachers').doc(classData.teacherId).get();
                currentClassInfo.teacher = teacherDoc.exists ? teacherDoc.data().name : '-';
              } catch (teacherError) {
                console.error('Error fetching teacher:', teacherError);
              }
            } else {
              currentClassInfo.teacher = '-';
            }
            
            // Update profile with new class info
            renderProfile({
    name: currentPupilData.name || '-',
    dob: currentPupilData.dob || '-',
    admissionNo: currentPupilData.admissionNo || '-',
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
            
          } catch (error) {
            console.error('Error in class listener:', error);
          } finally {
            classUpdateTimeout = null;
          }
        }, 500); // 500ms debounce
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
    } finally {
        window.isLoadingProfile = false;
    }
}

// ============================================
// PROFILE RENDER
// ============================================
function renderProfile(profile) {
    // Update the existing profile table fields
    const nameDisplay = document.getElementById('pupil-name-display');
    const dobDisplay = document.getElementById('pupil-dob-display');
    const admissionDisplay = document.getElementById('pupil-admission-display');
    const genderDisplay = document.getElementById('pupil-gender-display');
    const contactDisplay = document.getElementById('pupil-contact-display');
    const addressDisplay = document.getElementById('pupil-address-display');
    const classDisplay = document.getElementById('pupil-class-display');
    const teacherDisplay = document.getElementById('pupil-teacher-display');
    const subjectsDisplay = document.getElementById('pupil-subjects-display');

    if (nameDisplay) nameDisplay.textContent = profile.name;
    if (dobDisplay) dobDisplay.textContent = profile.dob;
    if (admissionDisplay) admissionDisplay.textContent = profile.admissionNo || '-';
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
// LOAD RESULTS WITH SESSION SUPPORT
// ============================================

async function loadResults() {
    if (!currentPupilId) return;

    const container = document.getElementById('results-container');
    if (!container) return;

    // Show loading skeleton
    container.innerHTML = `
        <div class="skeleton-container">
            <div class="skeleton" style="height:40px;width:60%;margin:var(--space-xl) auto;"></div>
            <div class="skeleton" style="height:30px;margin:var(--space-lg) 0 var(--space-sm);"></div>
            <div class="skeleton" style="height:30px;margin-bottom:var(--space-sm);"></div>
        </div>
    `;

    try {
        // Populate session selector first
        await populateSessionSelector();
        
        // Get selected session (defaults to current)
        const sessionSelect = document.getElementById('pupil-session-select');
        const selectedSession = sessionSelect?.value || 'current';
        
        // Load results for selected session
        await loadSessionResults();

    } catch (error) {
        console.error('Error loading results:', error);
        container.innerHTML = `<p style="text-align:center;color:var(--color-danger); padding:var(--space-2xl);">
            ⚠️ Unable to load results. Try again later.
        </p>`;
    }
}

async function populateSessionSelector() {
    const selector = document.getElementById('pupil-session-select');
    if (!selector) {
        console.warn('Session selector not found');
        return;
    }
    
    try {
        // Get current session settings
        const settings = await window.getCurrentSettings();
        const currentSession = settings.session || 'Current Session';
        
        // Clear and rebuild selector
        selector.innerHTML = '';
        
        // Add current session option (always first)
        const currentOpt = document.createElement('option');
        currentOpt.value = 'current';
        currentOpt.textContent = `Current Session (${currentSession})`;
        selector.appendChild(currentOpt);
        
        // Query all results for this pupil to find unique sessions
        const resultsSnap = await db.collection('results')
            .where('pupilId', '==', currentPupilId)
            .get();
        
        // Extract unique sessions
        const sessions = new Set();
        resultsSnap.forEach(doc => {
            const data = doc.data();
            if (data.session && data.session !== currentSession) {
                sessions.add(data.session);
            }
        });
        
        // Add historical sessions (sorted newest to oldest)
        const sortedSessions = Array.from(sessions).sort((a, b) => {
            // Extract years from session format "2023/2024"
            const yearA = parseInt(a.split('/')[0]);
            const yearB = parseInt(b.split('/')[0]);
            return yearB - yearA; // Descending order
        });
        
        sortedSessions.forEach(session => {
            const opt = document.createElement('option');
            opt.value = session;
            opt.textContent = `${session} Session`;
            selector.appendChild(opt);
        });
        
        console.log(`✓ Session selector populated: 1 current + ${sortedSessions.length} historical`);
        
    } catch (error) {
        console.error('Error populating session selector:', error);
        selector.innerHTML = '<option value="current">Current Session (Error loading)</option>';
    }
}

async function loadSessionResults() {
    if (!currentPupilId) return;
    
    const container = document.getElementById('results-container');
    const sessionSelect = document.getElementById('pupil-session-select');
    const sessionInfo = document.getElementById('session-info');
    const selectedSessionName = document.getElementById('selected-session-name');
    
    if (!container) return;
    
    // Show loading
    container.innerHTML = `
        <div style="text-align:center; padding:var(--space-2xl); color:var(--color-gray-600);">
            <div class="spinner" style="margin: 0 auto var(--space-md);"></div>
            <p>Loading results...</p>
        </div>
    `;
    
    try {
        const selectedSession = sessionSelect?.value || 'current';
        
        // Build query based on selection
        let resultsSnap;
        
        if (selectedSession === 'current') {
            // Load current session results
            const settings = await window.getCurrentSettings();
            const currentSessionName = settings.session;
            
            resultsSnap = await db.collection('results')
                .where('pupilId', '==', currentPupilId)
                .where('session', '==', currentSessionName)
                .get();
            
            // Update info display
            if (selectedSessionName) {
                selectedSessionName.textContent = `Current Session (${currentSessionName})`;
            }
            
        } else {
            // Load historical session results
            resultsSnap = await db.collection('results')
                .where('pupilId', '==', currentPupilId)
                .where('session', '==', selectedSession)
                .get();
            
            // Update info display
            if (selectedSessionName) {
                selectedSessionName.textContent = `${selectedSession} Session`;
            }
        }
        
        // Show session info
        if (sessionInfo) {
            sessionInfo.style.display = 'block';
        }
        
        // Process and display results
        const pupilResults = [];
        
        resultsSnap.forEach(doc => {
            const data = doc.data();
            pupilResults.push({
                term: data.term || 'Unknown Term',
                subject: data.subject || 'Unknown Subject',
                caScore: data.caScore || 0,
                examScore: data.examScore || 0,
                total: (data.caScore || 0) + (data.examScore || 0)
            });
        });
        
        // Clear container
        container.innerHTML = '';
        
        if (pupilResults.length === 0) {
            container.innerHTML = `<p style="text-align:center; padding:var(--space-2xl); font-size:var(--text-lg); color:var(--color-gray-600);">
                📚 No results found for this session.<br>
                ${selectedSession === 'current' ? 'Your teachers will upload scores soon.' : 'No historical data available.'}
            </p>`;
            return;
        }
        
        // Group results by term
        const terms = {};
        pupilResults.forEach(r => { 
            if (!terms[r.term]) terms[r.term] = []; 
            terms[r.term].push(r); 
        });
        
        // Display results for each term
        ['First Term', 'Second Term', 'Third Term'].forEach(termName => {
            if (!terms[termName]) return;

            const termSection = document.createElement('div');
            termSection.className = 'results-term-section';
            termSection.style.marginBottom = 'var(--space-2xl)';
            
            const heading = document.createElement('h3');
            heading.textContent = termName;
            heading.style.marginBottom = 'var(--space-md)';
            heading.style.color = '#0f172a';
            termSection.appendChild(heading);

            const table = document.createElement('table');
            table.className = 'results-table';
            table.innerHTML = `
                <thead>
                    <tr>
                        <th>SUBJECT</th>
                        <th>CA (40)</th>
                        <th>EXAM (60)</th>
                        <th>TOTAL (100)</th>
                        <th>GRADE</th>
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
        
        console.log(`✓ Loaded ${pupilResults.length} results for session: ${selectedSession}`);

    } catch (error) {
        console.error('Error loading session results:', error);
        container.innerHTML = `<p style="text-align:center;color:var(--color-danger); padding:var(--space-2xl);">
            ⚠️ Unable to load results. Please try again.
        </p>`;
    }
}

// Make function globally available
window.loadSessionResults = loadSessionResults;

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