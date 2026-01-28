/**
 * FAHMID NURSERY & PRIMARY SCHOOL
 * Pupil Portal JavaScript - FIXED SESSION SELECTOR
 * 
 * @version 4.4.0 - SESSION SELECTOR FIXED
 * @date 2026-01-10
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
        // FIXED: Detach existing listeners BEFORE creating new ones
        if (pupilListener) {
            pupilListener();
            pupilListener = null;
            console.log('✓ Detached old pupil listener');
        }
        if (classListener) {
            classListener();
            classListener = null;
            console.log('✓ Detached old class listener');
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

        const classId = getClassIdFromPupilData(data.class);
        const className = getClassNameFromPupilData(data.class);

        currentClassInfo = { 
          name: className, 
          teacher: data.assignedTeacher?.name || '-', 
          subjects: Array.isArray(data.subjects) ? data.subjects : [] 
        };

        if (classId) {
            try {
                const classDoc = await db.collection('classes').doc(classId).get();
                if (classDoc.exists) {
                    const classData = classDoc.data();
                    currentClassInfo.name = classData.name || className;
                    currentClassInfo.subjects = Array.isArray(classData.subjects) ? classData.subjects : [];
                    
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
            }
        } else {
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
                }
            }
        }

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

        await loadResults();
        await loadFeeBalance();

        let pupilUpdateTimeout = null;
        let classUpdateTimeout = null;

        pupilListener = db.collection('pupils').doc(currentPupilId)
          .onSnapshot(
            async snap => {
              if (pupilUpdateTimeout) {
                clearTimeout(pupilUpdateTimeout);
              }
              
              pupilUpdateTimeout = setTimeout(async () => {
                try {
                  if (!snap.exists) return;
                  
                  const updatedData = snap.data();
                  
                  const currentDataCopy = { ...currentPupilData };
                  const updatedDataCopy = { ...updatedData };
                  
                  delete currentDataCopy.updatedAt;
                  delete currentDataCopy.createdAt;
                  delete updatedDataCopy.updatedAt;
                  delete updatedDataCopy.createdAt;
                  
                  const hasChanges = JSON.stringify(currentDataCopy) !== JSON.stringify(updatedDataCopy);
                  
                  if (!hasChanges) {
                    console.log('No meaningful changes detected (only timestamp updated), skipping update');
                    return;
                  }
                  
                  console.log('Pupil data changed, updating...');
                  currentPupilData = updatedData;
                  
                  const updatedClassId = getClassIdFromPupilData(updatedData.class);
                  const updatedClassName = getClassNameFromPupilData(updatedData.class);
                  
                  currentClassInfo.name = updatedClassName;
                  currentClassInfo.teacher = updatedData.assignedTeacher?.name || '-';
                  currentClassInfo.subjects = Array.isArray(updatedData.subjects) ? updatedData.subjects : [];
                  
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

                  const settings = await getCurrentSettings();
                  const welcomeEl = document.getElementById('pupil-welcome');
                  const classEl = document.getElementById('student-class');
                  const sessionEl = document.getElementById('student-session');
                  
                  if (welcomeEl) welcomeEl.innerHTML = `Hello, <strong>${updatedData.name}</strong>!`;
                  if (classEl) classEl.textContent = currentClassInfo.name;
                  if (sessionEl) sessionEl.textContent = settings.session;

                  await loadResults();
                  console.log('✓ Profile updated');
                  
                } catch (error) {
                  console.error('Error in pupil listener:', error);
                } finally {
                  pupilUpdateTimeout = null;
                }
              }, 500);
            },
            error => {
              console.error('Pupil listener error:', error);
              window.showToast?.('Connection lost. Please refresh.', 'warning');
            }
          );

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
                    
                    const hasChanges = 
                      currentClassInfo.name !== classData.name ||
                      JSON.stringify(currentClassInfo.subjects) !== JSON.stringify(classData.subjects);
                    
                    if (!hasChanges) {
                      console.log('No class changes, skipping');
                      return;
                    }
                    
                    console.log('Class data changed, updating...');
                    
                    currentClassInfo.name = classData.name || currentClassInfo.name;
                    currentClassInfo.subjects = Array.isArray(classData.subjects) ? classData.subjects : [];
                    
                    if (classData.teacherName) {
                      currentClassInfo.teacher = classData.teacherName;
                    } else if (classData.teacherId) {
                      try {
                        const teacherDoc = await db.collection('teachers').doc(classData.teacherId).get();
                        currentClassInfo.teacher = teacherDoc.exists ? teacherDoc.data().name : '-';
                      } catch (err) {
                        console.error('Error fetching teacher:', err);
                      }
                    }
                    
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

                    renderSubjects(currentClassInfo.subjects, currentClassInfo.teacher);
                    console.log('✓ Class info updated');
                    
                  } catch (error) {
                    console.error('Error in class listener:', error);
                  } finally {
                    classUpdateTimeout = null;
                  }
                }, 500);
              },
              error => {
                console.error('Class listener error:', error);
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
// LOAD RESULTS WITH SESSION SUPPORT - FIXED
// ============================================

/**
 * FIXED: Load Results with Working Session Selector
 * Replace the loadResults function in pupil.js
 */

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
        
        // CRITICAL FIX: Add event listener AFTER selector is in DOM and wait for next frame
        await new Promise(resolve => requestAnimationFrame(resolve));
        
        const sessionSelect = document.getElementById('pupil-session-select');
        if (sessionSelect) {
            console.log('✓ Session selector found in DOM');
            
            // Remove any existing listeners to prevent duplicates
            const newSessionSelect = sessionSelect.cloneNode(true);
            sessionSelect.parentNode.replaceChild(newSessionSelect, sessionSelect);
            
            // Add new listener with proper logging
            newSessionSelect.addEventListener('change', async function() {
                const selectedValue = this.value;
                console.log('Session changed to:', selectedValue);
                
                // Show loading state
                container.innerHTML = `
                    <div style="text-align:center; padding:var(--space-2xl); color:var(--color-gray-600);">
                        <div class="spinner" style="margin: 0 auto var(--space-md); width: 40px; height: 40px; border: 4px solid #f3f3f3; border-top: 4px solid #00B2FF; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                        <p>Loading results for ${selectedValue === 'current' ? 'current session' : selectedValue}...</p>
                    </div>
                `;
                
                // Load results with small delay for visual feedback
                await new Promise(resolve => setTimeout(resolve, 300));
                await loadSessionResults();
            });
            
            console.log('✓ Session selector event listener attached');
        } else {
            console.error('❌ Session selector not found after populateSessionSelector()');
        }
        
        // Load results for selected session
        await loadSessionResults();

    } catch (error) {
        console.error('Error loading results:', error);
        container.innerHTML = `<p style="text-align:center;color:var(--color-danger); padding:var(--space-2xl);">
            ⚠️ Unable to load results. Try again later.
        </p>`;
    }
}

/**
 * FIXED: Pupil Fee Balance with Cumulative Debt Tracking
 * Replace loadFeeBalance() in pupil.js (lines 700-900)
 * 
 * FIXES:
 * - Shows ALL outstanding balances from current session
 * - Displays term-by-term breakdown
 * - Prevents hidden debts
 */

async function loadFeeBalance() {
    if (!currentPupilId) return;
    
    const feeSection = document.getElementById('fee-balance-section');
    if (!feeSection) return;
    
    // Show loading state
    feeSection.style.display = 'block';
    feeSection.innerHTML = `
        <div style="text-align:center; padding:var(--space-2xl);">
            <div class="spinner"></div>
            <p>Loading fee information...</p>
        </div>
    `;
    
    try {
        const settings = await window.getCurrentSettings();
        const session = settings.session;
        const encodedSession = session.replace(/\//g, '-');
        
        // ✅ FIX: Get ALL payment records for current session (all terms)
        const paymentsSnap = await db.collection('payments')
            .where('pupilId', '==', currentPupilId)
            .where('session', '==', session)
            .get();  // ← REMOVED term filter
        
        if (paymentsSnap.empty) {
            // No fee structure configured
            feeSection.innerHTML = `
                <div class="section-header">
                    <div class="section-icon" style="background: linear-gradient(135deg, #9e9e9e 0%, #757575 100%);">
                        <i data-lucide="info"></i>
                    </div>
                    <div class="section-title">
                        <h2>Fee Information</h2>
                        <p>No fee structure configured for your class yet</p>
                    </div>
                </div>
                <div style="text-align:center; padding:var(--space-2xl); color:var(--color-gray-600);">
                    <p>Fee details will appear here once configured by the school administration.</p>
                </div>
            `;
            return;
        }
        
        // ✅ FIX: Calculate cumulative totals across ALL terms
        let cumulativeDue = 0;
        let cumulativePaid = 0;
        let cumulativeBalance = 0;
        const termBreakdown = [];
        
        paymentsSnap.forEach(doc => {
            const data = doc.data();
            const termDue = data.amountDue || 0;
            const termPaid = data.totalPaid || 0;
            const termBalance = data.balance || 0;
            
            cumulativeDue += termDue;
            cumulativePaid += termPaid;
            cumulativeBalance += termBalance;
            
            if (termDue > 0) {
                termBreakdown.push({
                    term: data.term,
                    due: termDue,
                    paid: termPaid,
                    balance: termBalance,
                    lastPaymentDate: data.lastPaymentDate
                });
            }
        });
        
        // Sort by term order
        const termOrder = { 'First Term': 1, 'Second Term': 2, 'Third Term': 3 };
        termBreakdown.sort((a, b) => termOrder[a.term] - termOrder[b.term]);
        
       // Determine overall status
        let statusColor = '#f44336';
        let statusText = 'Outstanding Balance';
        let statusIcon = 'alert-circle';
        
        if (cumulativeBalance <= 0) {
            statusColor = '#4CAF50';
            statusText = 'Fully Paid';
            statusIcon = 'check-circle';
        } else if (cumulativePaid > 0) {
            statusColor = '#ff9800';
            statusText = 'Partial Payment';
            statusIcon = 'clock';
        }
        
        // FIXED: Calculate arrears from payment records
        let totalArrears = 0;
        paymentsSnap.forEach(doc => {
            const data = doc.data();
            totalArrears += (data.arrears || 0);
        });
        
        const arrearsHTML = totalArrears > 0 ? `
  <div style="background: linear-gradient(135deg, #dc3545 0%, #c82333 100%); color: white; padding: var(--space-xl); border-radius: var(--radius-lg); margin-bottom: var(--space-xl); box-shadow: 0 4px 20px rgba(220, 53, 69, 0.3);">
    <div style="display: flex; align-items: center; gap: var(--space-md); margin-bottom: var(--space-md);">
      <i data-lucide="alert-circle" style="width: 32px; height: 32px;"></i>
      <div>
        <h3 style="margin: 0; color: white;">Outstanding Arrears</h3>
        <p style="margin: var(--space-xs) 0 0; opacity: 0.9;">From Previous Session(s)</p>
      </div>
    </div>
    <div style="font-size: var(--text-3xl); font-weight: 700; margin-bottom: var(--space-sm);">
      ₦${totalArrears.toLocaleString()}
    </div>
    <p style="margin: 0; opacity: 0.9; font-size: var(--text-sm);">
      This amount is being carried forward and must be paid along with current fees.
    </p>
  </div>
` : '';
        
        // Build enhanced fee section with cumulative data
        feeSection.innerHTML = `
            <div class="section-header">
                <div class="section-icon" style="background: linear-gradient(135deg, ${statusColor} 0%, ${statusColor}dd 100%);">
                    <i data-lucide="${statusIcon}"></i>
                </div>
                <div class="section-title">
                    <h2>Fee Status (${session})</h2>
                    <p style="color: ${statusColor}; font-weight: 600;">${statusText}</p>
                </div>
            </div>

            ${arrearsHTML}

            <!-- Cumulative Summary Cards -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: var(--space-lg); margin-bottom: var(--space-xl);">
                <div style="text-align: center; padding: var(--space-xl); background: linear-gradient(135deg, #2196F3 0%, #1976D2 100%); color: white; border-radius: var(--radius-lg); box-shadow: 0 4px 12px rgba(33, 150, 243, 0.3);">
                    <div style="font-size: var(--text-xs); opacity: 0.9; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: var(--space-xs);">Total Due (All Terms)</div>
                    <div style="font-size: var(--text-3xl); font-weight: 700;">₦${cumulativeDue.toLocaleString()}</div>
                    <div style="font-size: var(--text-xs); opacity: 0.8; margin-top: var(--space-xs);">${termBreakdown.length} term(s)</div>
                </div>
                
                <div style="text-align: center; padding: var(--space-xl); background: linear-gradient(135deg, #4CAF50 0%, #388E3C 100%); color: white; border-radius: var(--radius-lg); box-shadow: 0 4px 12px rgba(76, 175, 80, 0.3);">
                    <div style="font-size: var(--text-xs); opacity: 0.9; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: var(--space-xs);">Total Paid</div>
                    <div style="font-size: var(--text-3xl); font-weight: 700;">₦${cumulativePaid.toLocaleString()}</div>
                    <div style="font-size: var(--text-xs); opacity: 0.8; margin-top: var(--space-xs);">
                        ${cumulativePaid > 0 ? Math.round((cumulativePaid / cumulativeDue) * 100) + '% collected' : 'No payments yet'}
                    </div>
                </div>
                
                <div style="text-align: center; padding: var(--space-xl); background: linear-gradient(135deg, ${statusColor} 0%, ${statusColor}dd 100%); color: white; border-radius: var(--radius-lg); box-shadow: 0 4px 12px rgba(${statusColor === '#4CAF50' ? '76, 175, 80' : '244, 67, 54'}, 0.3);">
                    <div style="font-size: var(--text-xs); opacity: 0.9; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: var(--space-xs);">Outstanding</div>
                    <div style="font-size: var(--text-3xl); font-weight: 700;">₦${cumulativeBalance.toLocaleString()}</div>
                    <div style="font-size: var(--text-xs); opacity: 0.8; margin-top: var(--space-xs);">
                        ${cumulativeBalance > 0 ? 'Amount remaining' : 'All paid!'}
                    </div>
                </div>
            </div>

            <!-- ✅ NEW: Term-by-Term Breakdown -->
            ${termBreakdown.length > 1 ? `
            <div style="background: white; padding: var(--space-xl); border-radius: var(--radius-lg); border: 1px solid #e2e8f0; margin-bottom: var(--space-xl);">
                <h3 style="margin: 0 0 var(--space-lg); display: flex; align-items: center; gap: var(--space-sm);">
                    <i data-lucide="list" style="width: 20px; height: 20px;"></i>
                    Term-by-Term Breakdown
                </h3>
                <div style="display: grid; gap: var(--space-md);">
                    ${termBreakdown.map(term => {
                        const termStatus = term.balance <= 0 ? 'Paid' : term.paid > 0 ? 'Partial' : 'Unpaid';
                        const termColor = term.balance <= 0 ? '#4CAF50' : term.paid > 0 ? '#ff9800' : '#f44336';
                        
                        return `
                            <div style="padding: var(--space-md); background: #f8fafc; border-left: 4px solid ${termColor}; border-radius: var(--radius-sm);">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-xs);">
                                    <strong style="color: #0f172a;">${term.term}</strong>
                                    <span style="background: ${termColor}; color: white; padding: 2px 8px; border-radius: 4px; font-size: var(--text-xs); font-weight: 600;">
                                        ${termStatus}
                                    </span>
                                </div>
                                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-sm); font-size: var(--text-sm); color: var(--color-gray-600);">
                                    <div>Due: <strong style="color: #0f172a;">₦${term.due.toLocaleString()}</strong></div>
                                    <div>Paid: <strong style="color: #4CAF50;">₦${term.paid.toLocaleString()}</strong></div>
                                    <div>Balance: <strong style="color: ${termColor};">₦${term.balance.toLocaleString()}</strong></div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
            ` : ''}

            <!-- Payment History -->
            <div style="background: white; padding: var(--space-xl); border-radius: var(--radius-lg); border: 1px solid #e2e8f0;">
                <h3 style="margin: 0 0 var(--space-lg); display: flex; align-items: center; gap: var(--space-sm);">
                    <i data-lucide="receipt" style="width: 20px; height: 20px;"></i>
                    Payment History (All Terms)
                </h3>
                <div id="payment-history-list" style="display: grid; gap: var(--space-md);">
                    <div style="text-align:center; padding:var(--space-lg); color:var(--color-gray-600);">
                        <div class="spinner" style="margin: 0 auto var(--space-sm);"></div>
                        <p>Loading payment records...</p>
                    </div>
                </div>
            </div>

            <!-- Payment Instructions -->
            <div style="margin-top: var(--space-xl); padding: var(--space-lg); background: ${cumulativeBalance > 0 ? '#fef2f2' : '#f0fdf4'}; border: 2px solid ${cumulativeBalance > 0 ? '#dc3545' : '#4CAF50'}; border-radius: var(--radius-md);">
                <h4 style="margin: 0 0 var(--space-sm); color: ${cumulativeBalance > 0 ? '#991b1b' : '#065f46'}; display: flex; align-items: center; gap: var(--space-sm);">
                    <i data-lucide="${cumulativeBalance > 0 ? 'alert-triangle' : 'check-circle'}" style="width: 18px; height: 18px;"></i>
                    ${cumulativeBalance > 0 ? 'Payment Required' : 'All Fees Paid'}
                </h4>
                <p style="margin: 0; font-size: var(--text-sm); color: ${cumulativeBalance > 0 ? '#7f1d1d' : '#14532d'}; line-height: 1.6;">
                    ${cumulativeBalance > 0 
                        ? `You have an outstanding balance of ₦${cumulativeBalance.toLocaleString()} across ${termBreakdown.filter(t => t.balance > 0).length} term(s). Please visit the school office to make payment.`
                        : 'All fees for this session have been paid in full. Thank you!'}
                </p>
            </div>
        `;
        
        // Re-initialize Lucide icons
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
        
        // ✅ FIX: Load payment history for ALL terms (no term filter)
        await loadPaymentHistoryAllTerms(encodedSession);
        
    } catch (error) {
        console.error('Error loading fee balance:', error);
        feeSection.innerHTML = `
            <div style="text-align:center; padding:var(--space-2xl); color:var(--color-danger);">
                <i data-lucide="alert-triangle" style="width: 48px; height: 48px; margin: 0 auto var(--space-md);"></i>
                <p>Unable to load fee information. Please try again later.</p>
            </div>
        `;
    }
}

/**
 * ✅ NEW: Load payment history for all terms in session
 */
async function loadPaymentHistoryAllTerms(encodedSession) {
    const container = document.getElementById('payment-history-list');
    if (!container || !currentPupilId) return;
    
    try {
        const decodedSession = encodedSession.replace(/-/g, '/');
        
        // Query ALL transactions for this session (all terms)
        const transactionsSnap = await db.collection('payment_transactions')
            .where('pupilId', '==', currentPupilId)
            .where('session', '==', decodedSession)
            .orderBy('paymentDate', 'desc')
            .get();
        
        if (transactionsSnap.empty) {
            container.innerHTML = `
                <div style="text-align:center; padding:var(--space-xl); color:var(--color-gray-600); background: #f8fafc; border-radius: var(--radius-md);">
                    <i data-lucide="inbox" style="width: 40px; height: 40px; margin: 0 auto var(--space-md); opacity: 0.5;"></i>
                    <p style="margin: 0;">No payment history yet for this session</p>
                </div>
            `;
            
            if (typeof lucide !== 'undefined') lucide.createIcons();
            return;
        }
        
        container.innerHTML = '';
        
        transactionsSnap.forEach(doc => {
            const data = doc.data();
            const paymentDate = data.paymentDate 
                ? data.paymentDate.toDate().toLocaleDateString('en-GB', { 
                    day: '2-digit', 
                    month: 'short', 
                    year: 'numeric' 
                  })
                : 'N/A';
            
            const itemDiv = document.createElement('div');
            itemDiv.style.cssText = `
                padding: var(--space-md);
                background: #f8fafc;
                border: 1px solid #e2e8f0;
                border-radius: var(--radius-md);
                display: flex;
                justify-content: space-between;
                align-items: center;
                transition: all 0.2s ease;
            `;
            
            itemDiv.innerHTML = `
                <div style="flex: 1;">
                    <div style="font-weight: 700; font-size: var(--text-lg); color: #0f172a; margin-bottom: var(--space-xs);">
                        ₦${parseFloat(data.amountPaid).toLocaleString()}
                    </div>
                    <div style="font-size: var(--text-sm); color: #64748b; display: flex; align-items: center; gap: var(--space-md); flex-wrap: wrap;">
                        <span style="display: flex; align-items: center; gap: var(--space-xs);">
                            <i data-lucide="calendar" style="width: 14px; height: 14px;"></i>
                            ${paymentDate}
                        </span>
                        <span style="display: flex; align-items: center; gap: var(--space-xs);">
                            <i data-lucide="bookmark" style="width: 14px; height: 14px;"></i>
                            ${data.term || 'N/A'}
                        </span>
                        <span style="display: flex; align-items: center; gap: var(--space-xs);">
                            <i data-lucide="${data.paymentMethod === 'cash' ? 'banknote' : 'credit-card'}" style="width: 14px; height: 14px;"></i>
                            ${data.paymentMethod || 'Cash'}
                        </span>
                        <span style="display: flex; align-items: center; gap: var(--space-xs);">
                            <i data-lucide="hash" style="width: 14px; height: 14px;"></i>
                            ${data.receiptNo}
                        </span>
                    </div>
                </div>
                <button class="btn-small btn-secondary" onclick="viewReceipt('${data.receiptNo}')" style="white-space: nowrap;">
                    <i data-lucide="eye" style="width: 16px; height: 16px;"></i>
                    View Receipt
                </button>
            `;
            
            itemDiv.onmouseenter = () => {
                itemDiv.style.background = 'white';
                itemDiv.style.borderColor = '#cbd5e1';
                itemDiv.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.05)';
            };
            itemDiv.onmouseleave = () => {
                itemDiv.style.background = '#f8fafc';
                itemDiv.style.borderColor = '#e2e8f0';
                itemDiv.style.boxShadow = 'none';
            };
            
            container.appendChild(itemDiv);
        });
        
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
        
    } catch (error) {
        console.error('Error loading payment history:', error);
        container.innerHTML = `
            <div style="text-align:center; padding:var(--space-lg); color:var(--color-danger); background: #fef2f2; border-radius: var(--radius-md);">
                <p style="margin: 0;">Error loading payment history</p>
            </div>
        `;
    }
}

// Make functions globally available
window.loadFeeBalance = loadFeeBalance;
window.loadPaymentHistoryAllTerms = loadPaymentHistoryAllTerms;

/**
 * Load payment history with encoded session
 */
async function loadPaymentHistory(encodedSession, term) {
    const container = document.getElementById('payment-history-list');
    if (!container || !currentPupilId) return;
    
    try {
        // Query transactions directly from Firestore
        const transactionsSnap = await db.collection('payment_transactions')
            .where('pupilId', '==', currentPupilId)
            .where('session', '==', encodedSession.replace(/-/g, '/')) // Convert back to original format for query
            .where('term', '==', term)
            .orderBy('paymentDate', 'desc')
            .get();
        
        if (transactionsSnap.empty) {
            container.innerHTML = `
                <div style="text-align:center; padding:var(--space-xl); color:var(--color-gray-600); background: #f8fafc; border-radius: var(--radius-md);">
                    <i data-lucide="inbox" style="width: 40px; height: 40px; margin: 0 auto var(--space-md); opacity: 0.5;"></i>
                    <p style="margin: 0;">No payment history yet for this session</p>
                </div>
            `;
            
            // Re-init icons
            if (typeof lucide !== 'undefined') lucide.createIcons();
            return;
        }
        
        container.innerHTML = '';
        
        transactionsSnap.forEach(doc => {
            const data = doc.data();
            const paymentDate = data.paymentDate 
                ? data.paymentDate.toDate().toLocaleDateString('en-GB', { 
                    day: '2-digit', 
                    month: 'short', 
                    year: 'numeric' 
                  })
                : 'N/A';
            
            const itemDiv = document.createElement('div');
            itemDiv.style.cssText = `
                padding: var(--space-md);
                background: #f8fafc;
                border: 1px solid #e2e8f0;
                border-radius: var(--radius-md);
                display: flex;
                justify-content: space-between;
                align-items: center;
                transition: all 0.2s ease;
            `;
            
            itemDiv.innerHTML = `
                <div style="flex: 1;">
                    <div style="font-weight: 700; font-size: var(--text-lg); color: #0f172a; margin-bottom: var(--space-xs);">
                        ₦${parseFloat(data.amountPaid).toLocaleString()}
                    </div>
                    <div style="font-size: var(--text-sm); color: #64748b; display: flex; align-items: center; gap: var(--space-md); flex-wrap: wrap;">
                        <span style="display: flex; align-items: center; gap: var(--space-xs);">
                            <i data-lucide="calendar" style="width: 14px; height: 14px;"></i>
                            ${paymentDate}
                        </span>
                        <span style="display: flex; align-items: center; gap: var(--space-xs);">
                            <i data-lucide="${data.paymentMethod === 'cash' ? 'banknote' : 'credit-card'}" style="width: 14px; height: 14px;"></i>
                            ${data.paymentMethod || 'Cash'}
                        </span>
                        <span style="display: flex; align-items: center; gap: var(--space-xs);">
                            <i data-lucide="hash" style="width: 14px; height: 14px;"></i>
                            ${data.receiptNo}
                        </span>
                    </div>
                </div>
                <button class="btn-small btn-secondary" onclick="viewReceipt('${data.receiptNo}')" style="white-space: nowrap;">
                    <i data-lucide="eye" style="width: 16px; height: 16px;"></i>
                    View Receipt
                </button>
            `;
            
            // Hover effect
            itemDiv.onmouseenter = () => {
                itemDiv.style.background = 'white';
                itemDiv.style.borderColor = '#cbd5e1';
                itemDiv.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.05)';
            };
            itemDiv.onmouseleave = () => {
                itemDiv.style.background = '#f8fafc';
                itemDiv.style.borderColor = '#e2e8f0';
                itemDiv.style.boxShadow = 'none';
            };
            
            container.appendChild(itemDiv);
        });
        
        // Re-initialize Lucide icons
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
        
    } catch (error) {
        console.error('Error loading payment history:', error);
        container.innerHTML = `
            <div style="text-align:center; padding:var(--space-lg); color:var(--color-danger); background: #fef2f2; border-radius: var(--radius-md);">
                <p style="margin: 0;">Error loading payment history</p>
            </div>
        `;
    }
}

/**
 * Open receipt in new window
 */
function viewReceipt(receiptNo) {
    const receiptWindow = window.open(
        `receipt.html?receipt=${receiptNo}`,
        '_blank',
        'width=800,height=600'
    );
    
    if (!receiptWindow) {
        window.showToast?.('Please allow popups to view receipts', 'warning');
    }
}

// Make functions globally available
window.viewReceipt = viewReceipt;

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
    if (!container) return;

    const sessionSelect = document.getElementById('pupil-session-select');
    const sessionInfo = document.getElementById('session-info');
    const selectedSessionNameEl = document.getElementById('selected-session-name');

    // Show loading state
    container.innerHTML = `
        <div style="text-align:center; padding:var(--space-2xl); color:var(--color-gray-600);">
            <div class="spinner" style="margin: 0 auto var(--space-md); width: 40px; height: 40px; border: 4px solid #f3f3f3; border-top: 4px solid #00B2FF; border-radius: 50%; animation: spin 1s linear infinite;"></div>
            <p>Loading results...</p>
        </div>
    `;

    try {
        const selectedSession = sessionSelect?.value || 'current';
        let resultsSnap;
        let displaySessionName;

        // ── Determine session name & fetch results ───────────────────────────────
        if (selectedSession === 'current') {
            const settings = await window.getCurrentSettings();
            const currentSessionName = settings.session;
            displaySessionName = `Current Session (${currentSessionName})`;

            // Primary query using the real session name
            resultsSnap = await db.collection('results')
                .where('pupilId', '==', currentPupilId)
                .where('session', '==', currentSessionName)
                .get();

            // Fallback: legacy results (missing session field or matching current)
            if (resultsSnap.empty) {
                console.log('No results for current session → checking legacy data...');

                const legacySnap = await db.collection('results')
                    .where('pupilId', '==', currentPupilId)
                    .get();

                const validResults = [];
                legacySnap.forEach(doc => {
                    const data = doc.data();
                    if (!data.session || data.session === currentSessionName) {
                        validResults.push(doc);
                    }
                });

                console.log(`Found ${validResults.length} legacy/matching results`);

                if (validResults.length > 0) {
                    // Create pseudo-snapshot compatible with Firestore snapshot
                    resultsSnap = {
                        empty: false,
                        size: validResults.length,
                        forEach: callback => validResults.forEach(callback),
                        docs: validResults
                    };

                    // Add legacy data warning banner
                    const banner = document.createElement('div');
                    banner.className = 'alert alert-info';
                    banner.style.marginBottom = 'var(--space-lg)';
                    banner.innerHTML = `
                        <strong>ℹ️ Legacy Results Detected</strong>
                        <p style="margin-top:var(--space-xs); font-size:var(--text-sm);">
                            Some results lack session information (created before session tracking).
                            They are shown here because they belong to the current academic period.
                        </p>
                    `;

                    const displayContainer = document.getElementById('results-display-container');
                    if (displayContainer) {
                        displayContainer.insertBefore(banner, displayContainer.firstChild);
                    }
                }
            }
        } 
        // Historical session
        else {
            displaySessionName = `${selectedSession} Session`;

            resultsSnap = await db.collection('results')
                .where('pupilId', '==', currentPupilId)
                .where('session', '==', selectedSession)
                .get();
        }

        // ── Update UI header ─────────────────────────────────────────────────────
        if (selectedSessionNameEl) {
            selectedSessionNameEl.textContent = displaySessionName;
        }

        if (sessionInfo) {
            sessionInfo.style.display = 'block';
        }

        // ── Process results ──────────────────────────────────────────────────────
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

        // Clear loading state
        container.innerHTML = '';

        if (pupilResults.length === 0) {
            container.innerHTML = `
                <p style="text-align:center; padding:var(--space-2xl); font-size:var(--text-lg); color:var(--color-gray-600);">
                    📚 No results found for this session.<br>
                    ${selectedSession === 'current' 
                        ? 'Your teachers will upload scores soon.' 
                        : 'No historical data available.'}
                </p>`;
            return;
        }

        // ── Group by term ────────────────────────────────────────────────────────
        const terms = {};
        pupilResults.forEach(r => {
            if (!terms[r.term]) terms[r.term] = [];
            terms[r.term].push(r);
        });

        // ── Render each term ─────────────────────────────────────────────────────
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

            terms[termName]
                .sort((a, b) => a.subject.localeCompare(b.subject))
                .forEach(r => {
                    const grade = getGrade(r.total);
                    tbody.innerHTML += `
                        <tr>
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

                tbody.innerHTML += `
                    <tr class="summary-row">
                        <td colspan="3"><strong>TOTAL SCORE</strong></td>
                        <td colspan="2"><strong>${termTotal} / ${subjectCount * 100}</strong></td>
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
        container.innerHTML = `
            <p style="text-align:center; color:var(--color-danger); padding:var(--space-2xl);">
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

// Add CSS for spinner animation if not already in styles.css
const style = document.createElement('style');
style.textContent = `
@keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}
`;
document.head.appendChild(style);

/**
 * Scroll to fee balance section smoothly
 */
function scrollToFees() {
  const feeSection = document.getElementById('fee-balance-section');
  if (feeSection) {
    feeSection.style.display = 'block';
    feeSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.showToast?.('📊 Viewing fee balance', 'info', 2000);
  }
}

// Make function globally available
window.scrollToFees = scrollToFees;

console.log('✓ Pupil portal initialized (v4.4.0 - SESSION SELECTOR FIXED)');

console.log('✓ Pupil portal initialized (v4.4.0 - SESSION SELECTOR FIXED)');