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
 * FIXED: Safely extract class ID with fallback for old format
 */
function getClassIdSafely(pupilData) {
  if (!pupilData || !pupilData.class) {
    console.error('❌ No class data found for pupil');
    return null;
  }
  
  // New format: {id: "xyz", name: "Primary 3"}
  if (typeof pupilData.class === 'object' && pupilData.class.id) {
    return pupilData.class.id;
  }
  
  // Old format: just "Primary 3" as string
  // We need to look it up in the classes collection
  if (typeof pupilData.class === 'string') {
    console.warn('⚠️ Old class format detected, returning null (admin should update pupil record)');
    return null;
  }
  
  return null;
}

// Make globally available
window.getClassIdSafely = getClassIdSafely;

/**
 * ✅ FIXED: Load Fee Balance with Correct Fee Structure Lookup
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
        const currentTerm = settings.term;
        const encodedSession = session.replace(/\//g, '-');

        // Get current pupil data
        const pupilDoc = await db.collection('pupils').doc(currentPupilId).get();
        if (!pupilDoc.exists) {
            throw new Error('Pupil profile not found');
        }
        
        const pupilData = pupilDoc.data();
        
        // Extract class info
        let classId = null;
        let className = 'Unknown';
        
        if (pupilData.class) {
            if (typeof pupilData.class === 'object') {
                classId = pupilData.class.id || null;
                className = pupilData.class.name || 'Unknown';
            } else if (typeof pupilData.class === 'string') {
                className = pupilData.class;
                
                // Try lookup for old format
                const classesSnap = await db.collection('classes')
                    .where('name', '==', className)
                    .limit(1)
                    .get();
                
                if (!classesSnap.empty) {
                    classId = classesSnap.docs[0].id;
                }
            }
        }
        
        // Validate classId
        if (!classId || classId === 'undefined' || classId === 'null') {
            feeSection.innerHTML = `
                <div class="section-header">
                    <div class="section-icon" style="background: linear-gradient(135deg, #f44336 0%, #d32f2f 100%);">
                        <i data-lucide="alert-triangle"></i>
                    </div>
                    <div class="section-title">
                        <h2>Fee Information Unavailable</h2>
                        <p>Class information missing or outdated</p>
                    </div>
                </div>
                <div style="background: #fef2f2; border: 2px solid #dc3545; border-radius: var(--radius-md); padding: var(--space-xl); margin-top: var(--space-lg);">
                    <h3 style="margin: 0 0 var(--space-md); color: #991b1b;">Invalid Class Data</h3>
                    <p style="margin: 0 0 var(--space-md); color: #7f1d1d;">
                        Your pupil record has outdated class information. Please contact the school office to update your record.
                    </p>
                </div>
            `;
            if (typeof lucide !== 'undefined') lucide.createIcons();
            return;
        }

        // ✅ FIX: Get fee structure (class-based, permanent) - CORRECTED ID FORMAT
        const feeDocId = `fee_${classId}`;
        const feeDoc = await db.collection('fee_structures').doc(feeDocId).get();
        
        if (!feeDoc.exists) {
            feeSection.innerHTML = `
                <div class="section-header">
                    <div class="section-icon" style="background: linear-gradient(135deg, #9e9e9e 0%, #757575 100%);">
                        <i data-lucide="info"></i>
                    </div>
                    <div class="section-title">
                        <h2>Fee Information</h2>
                        <p>No fee structure configured for ${className} yet</p>
                    </div>
                </div>
            `;
            if (typeof lucide !== 'undefined') lucide.createIcons();
            return;
        }
        
        const feeStructure = feeDoc.data();
        const baseFee = Number(feeStructure.total) || 0;

        // ✅ Apply fee adjustments (scholarships, discounts, enrollment)
        const amountDue = window.calculateAdjustedFee(pupilData, baseFee, currentTerm);
        
        // ✅ Calculate complete arrears (termly + session)
        const arrears = await window.calculateCompleteArrears(currentPupilId, session, currentTerm);

        // ✅ Get payment record (FIXED: won't fail with permission-denied)
        const paymentDocId = `${currentPupilId}_${encodedSession}_${currentTerm}`;
        let paymentDoc;
        
        try {
            paymentDoc = await db.collection('payments').doc(paymentDocId).get();
        } catch (error) {
            // ✅ FIXED: Handle permission errors gracefully
            if (error.code === 'permission-denied') {
                console.warn('Permission denied reading payment record, will auto-create');
                paymentDoc = { exists: false };
            } else {
                throw error;
            }
        }

        let totalPaid = 0;
        let balance = amountDue + arrears;
        let status = arrears > 0 ? 'owing_with_arrears' : 'owing';
        let recordExists = paymentDoc.exists;

        // ✅ Auto-create payment record if missing
        if (!recordExists && classId) {
            console.log('⚠️ Payment record missing, auto-creating...');
            
            try {
                await db.collection('payments').doc(paymentDocId).set({
                    pupilId: currentPupilId,
                    pupilName: pupilData.name || 'Unknown',
                    classId: classId,
                    className: className,
                    session: session,
                    term: currentTerm,
                    amountDue: amountDue,
                    arrears: arrears,
                    totalDue: amountDue + arrears,
                    totalPaid: 0,
                    balance: amountDue + arrears,
                    status: status,
                    lastPaymentDate: null,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    autoCreated: true
                });
                
                console.log('✅ Auto-created payment record');
                
                // Re-fetch the document
                paymentDoc = await db.collection('payments').doc(paymentDocId).get();
                recordExists = true;
            } catch (createError) {
                console.error('❌ Failed to auto-create payment record:', createError);
                // Continue with default values
            }
        }

        // Extract payment data if exists
        if (recordExists && paymentDoc.exists) {
            const data = paymentDoc.data();
            totalPaid = Number(data.totalPaid) || 0;
            balance = Number(data.balance) || 0;
            status = data.status || (arrears > 0 ? 'owing_with_arrears' : 'owing');
        }

        // Status colors
        let statusColor = '#f44336';
        let statusText = 'Outstanding Balance';
        let statusIcon = 'alert-circle';

        if (balance <= 0) {
            statusColor = '#4CAF50';
            statusText = 'Fully Paid';
            statusIcon = 'check-circle';
        } else if (totalPaid > 0) {
            statusColor = '#ff9800';
            statusText = 'Partial Payment';
            statusIcon = 'clock';
        }

        // Special case badges
        let specialCaseBadge = '';
        if (amountDue === 0 && baseFee > 0) {
            specialCaseBadge = `
                <div style="background: linear-gradient(135deg, #4CAF50 0%, #388E3C 100%); color: white; padding: var(--space-md); border-radius: var(--radius-md); margin-bottom: var(--space-lg); text-align: center;">
                    <strong>🎓 FREE EDUCATION APPLIED</strong>
                    <p style="margin: var(--space-xs) 0 0; opacity: 0.9; font-size: var(--text-sm);">
                        This pupil is enrolled under free education program
                    </p>
                </div>
            `;
        } else if (amountDue < baseFee && amountDue > 0) {
            const discount = baseFee - amountDue;
            const discountPercent = ((discount / baseFee) * 100).toFixed(0);
            specialCaseBadge = `
                <div style="background: linear-gradient(135deg, #2196F3 0%, #1976D2 100%); color: white; padding: var(--space-md); border-radius: var(--radius-md); margin-bottom: var(--space-lg); text-align: center;">
                    <strong>💎 SCHOLARSHIP/DISCOUNT APPLIED</strong>
                    <p style="margin: var(--space-xs) 0 0; opacity: 0.9; font-size: var(--text-sm);">
                        ${discountPercent}% reduction • Saving ₦${discount.toLocaleString()} per term
                    </p>
                </div>
            `;
        }

        // Arrears warning
        const arrearsHTML = arrears > 0 ? `
            <div style="background: linear-gradient(135deg, #dc3545 0%, #c82333 100%); color: white; padding: var(--space-xl); border-radius: var(--radius-lg); margin-bottom: var(--space-xl); box-shadow: 0 4px 20px rgba(220, 53, 69, 0.3);">
                <div style="display: flex; align-items: center; gap: var(--space-md); margin-bottom: var(--space-md);">
                    <i data-lucide="alert-circle" style="width: 32px; height: 32px;"></i>
                    <div>
                        <h3 style="margin: 0; color: white;">Outstanding Arrears</h3>
                        <p style="margin: var(--space-xs) 0 0; opacity: 0.9;">From Previous Term(s)</p>
                    </div>
                </div>
                <div style="font-size: var(--text-3xl); font-weight: 700; margin-bottom: var(--space-sm);">
                    ₦${arrears.toLocaleString()}
                </div>
                <p style="margin: 0; opacity: 0.9; font-size: var(--text-sm);">
                    This amount must be paid along with current term fees.
                </p>
            </div>
        ` : '';

        const totalDue = amountDue + arrears;
        const percentPaid = totalDue > 0 ? Math.round((totalPaid / totalDue) * 100) : 0;

        // Render complete fee section
        feeSection.innerHTML = `
            <div class="section-header">
                <div class="section-icon" style="background: linear-gradient(135deg, ${statusColor} 0%, ${statusColor}dd 100%);">
                    <i data-lucide="${statusIcon}"></i>
                </div>
                <div class="section-title">
                    <h2>Fee Status - ${currentTerm}</h2>
                    <p style="color: ${statusColor}; font-weight: 600;">${session} • ${statusText}</p>
                </div>
            </div>

            ${specialCaseBadge}
            ${arrearsHTML}

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: var(--space-lg); margin-bottom: var(--space-xl);">
                ${arrears > 0 ? `
                <div style="text-align: center; padding: var(--space-xl); background: #fef2f2; border: 2px solid #dc3545; border-radius: var(--radius-lg);">
                    <div style="font-size: var(--text-xs); color: #991b1b; margin-bottom: var(--space-xs); font-weight: 600;">Arrears</div>
                    <div style="font-size: var(--text-3xl); font-weight: 700; color: #dc3545;">₦${arrears.toLocaleString()}</div>
                </div>` : ''}

                <div style="text-align: center; padding: var(--space-xl); background: linear-gradient(135deg, #2196F3 0%, #1976D2 100%); color: white; border-radius: var(--radius-lg);">
                    <div style="font-size: var(--text-xs); opacity: 0.9; text-transform: uppercase; margin-bottom: var(--space-xs);">Current Term Fee</div>
                    <div style="font-size: var(--text-3xl); font-weight: 700;">₦${amountDue.toLocaleString()}</div>
                    ${amountDue !== baseFee ? `<div style="font-size: var(--text-xs); opacity: 0.8; margin-top: var(--space-xs);">Base: ₦${baseFee.toLocaleString()}</div>` : ''}
                </div>

                <div style="text-align: center; padding: var(--space-xl); background: linear-gradient(135deg, #4CAF50 0%, #388E3C 100%); color: white; border-radius: var(--radius-lg);">
                    <div style="font-size: var(--text-xs); opacity: 0.9; text-transform: uppercase; margin-bottom: var(--space-xs);">Total Paid</div>
                    <div style="font-size: var(--text-3xl); font-weight: 700;">₦${totalPaid.toLocaleString()}</div>
                    <div style="font-size: var(--text-xs); opacity: 0.8; margin-top: var(--space-xs);">
                        ${totalPaid > 0 ? percentPaid + '% collected' : 'No payments yet'}
                    </div>
                </div>

                <div style="text-align: center; padding: var(--space-xl); background: linear-gradient(135deg, ${statusColor} 0%, ${statusColor}dd 100%); color: white; border-radius: var(--radius-lg);">
                    <div style="font-size: var(--text-xs); opacity: 0.9; text-transform: uppercase; margin-bottom: var(--space-xs);">Outstanding</div>
                    <div style="font-size: var(--text-3xl); font-weight: 700;">₦${balance.toLocaleString()}</div>
                </div>
            </div>

            <div style="background: white; padding: var(--space-xl); border-radius: var(--radius-lg); border: 1px solid #e2e8f0;">
                <h3 style="margin: 0 0 var(--space-lg); display: flex; align-items: center; gap: var(--space-sm);">
                    <i data-lucide="receipt" style="width: 20px; height: 20px;"></i>
                    Payment History (All Sessions)
                </h3>
                <div id="payment-history-list" style="display: grid; gap: var(--space-md);">
                    <div style="text-align:center; padding:var(--space-lg); color:var(--color-gray-600);">
                        <div class="spinner"></div>
                        <p>Loading payment records...</p>
                    </div>
                </div>
            </div>

            <div style="margin-top: var(--space-xl); padding: var(--space-lg); background: ${balance > 0 ? '#fef2f2' : '#f0fdf4'}; border: 2px solid ${balance > 0 ? '#dc3545' : '#4CAF50'}; border-radius: var(--radius-md);">
                <h4 style="margin: 0 0 var(--space-sm); color: ${balance > 0 ? '#991b1b' : '#065f46'}; display: flex; align-items: center; gap: var(--space-sm);">
                    <i data-lucide="${balance > 0 ? 'alert-triangle' : 'check-circle'}" style="width: 18px; height: 18px;"></i>
                    ${balance > 0 ? 'Payment Required' : 'Term Fees Paid'}
                </h4>
                <p style="margin: 0; font-size: var(--text-sm); color: ${balance > 0 ? '#7f1d1d' : '#14532d'};">
                    ${balance > 0 
                        ? `Outstanding balance of ₦${balance.toLocaleString()} for ${currentTerm}. Please visit the school office.`
                        : `All fees for ${currentTerm} have been paid in full. Thank you!`}
                </p>
            </div>
        `;

        if (typeof lucide !== 'undefined') lucide.createIcons();
        await loadAllPaymentHistory(currentPupilId);

    } catch (error) {
        console.error('❌ Error loading fee balance:', error);
        feeSection.innerHTML = `
            <div style="text-align:center; padding:var(--space-2xl); color:var(--color-danger);">
                <i data-lucide="alert-triangle" style="width: 48px; height: 48px;"></i>
                <p style="font-weight: 600;">Unable to load fee information</p>
                <p style="font-size: var(--text-sm);">Error: ${error.message}</p>
                <button class="btn btn-primary" onclick="loadFeeBalance()" style="margin-top: var(--space-lg);">
                    🔄 Retry
                </button>
            </div>
        `;
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
}

window.loadFeeBalance = loadFeeBalance;

/**
 * Helper: Get previous session name
 */
function getPreviousSessionName(currentSession) {
    const match = currentSession.match(/(\d{4})\/(\d{4})/);
    if (!match) return null;
    
    const startYear = parseInt(match[1]);
    const endYear = parseInt(match[2]);
    
    return `${startYear - 1}/${endYear - 1}`;
}

/**
 * Helper: Calculate total balance for entire session
 */
async function calculateSessionBalance(pupilId, session) {
    try {
        const paymentsSnap = await db.collection('payments')
            .where('pupilId', '==', pupilId)
            .where('session', '==', session)
            .get();
        
        let totalBalance = 0;
        
        paymentsSnap.forEach(doc => {
            const data = doc.data();
            totalBalance += Number(data.balance) || 0;
        });
        
        return totalBalance;
        
    } catch (error) {
        console.error('Error calculating session balance:', error);
        return 0;
    }
}

// Replace the existing loadFeeBalance function with this one
window.loadFeeBalance = loadFeeBalance;

console.log('✅ Pupil fee display fixes loaded');

/**
 * ✅ FIXED: Calculate complete arrears with graceful fallback for missing records
 */
async function calculateCompleteArrears(pupilId, currentSession, currentTerm) {
    try {
        let totalArrears = 0;
        const encodedSession = currentSession.replace(/\//g, '-');
        
        // Step 1: Calculate PREVIOUS TERM balance (same session)
        const termOrder = {
            'First Term': 1,
            'Second Term': 2,
            'Third Term': 3
        };
        
        const currentTermNum = termOrder[currentTerm] || 1;
        
        // Get previous term in same session
        if (currentTermNum > 1) {
            const previousTermName = Object.keys(termOrder).find(
                key => termOrder[key] === currentTermNum - 1
            );
            
            if (previousTermName) {
                const prevTermDocId = `${pupilId}_${encodedSession}_${previousTermName}`;
                
                try {
                    const prevTermDoc = await db.collection('payments').doc(prevTermDocId).get();
                    
                    // ✅ FIX: Handle non-existent documents (no longer throws permission error)
                    if (prevTermDoc.exists) {
                        const prevTermBalance = Number(prevTermDoc.data().balance) || 0;
                        totalArrears += prevTermBalance;
                        console.log(`✓ Previous term (${previousTermName}) arrears: ₦${prevTermBalance.toLocaleString()}`);
                    } else {
                        console.log(`ℹ️ No payment record for ${previousTermName}, assuming ₦0 arrears`);
                    }
                } catch (error) {
                    console.error('Error fetching previous term balance:', error);
                    // Continue without adding arrears for this term
                }
            }
        }
        
        // Step 2: Calculate PREVIOUS SESSION balance
        const previousSession = getPreviousSessionName(currentSession);
        if (previousSession) {
            try {
                const sessionArrears = await calculateSessionBalanceSafe(pupilId, previousSession);
                totalArrears += sessionArrears;
                console.log(`✓ Previous session (${previousSession}) arrears: ₦${sessionArrears.toLocaleString()}`);
            } catch (error) {
                console.error('Error calculating previous session balance:', error);
                // Continue without adding session arrears
            }
        }
        
        console.log(`✓ Total arrears calculated: ₦${totalArrears.toLocaleString()}`);
        return totalArrears;
        
    } catch (error) {
        console.error('Error in calculateCompleteArrears:', error);
        return 0; // Safe fallback
    }
}

/**
 * ✅ NEW: Safe session balance calculation that handles missing documents
 */
async function calculateSessionBalanceSafe(pupilId, session) {
    try {
        const encodedSession = session.replace(/\//g, '-');
        let totalBalance = 0;
        
        // Try each term individually to avoid query permission errors
        const terms = ['First Term', 'Second Term', 'Third Term'];
        
        for (const term of terms) {
            const paymentDocId = `${pupilId}_${encodedSession}_${term}`;
            
            try {
                const doc = await db.collection('payments').doc(paymentDocId).get();
                
                if (doc.exists) {
                    const balance = Number(doc.data().balance) || 0;
                    totalBalance += balance;
                    
                    if (balance > 0) {
                        console.log(`  - ${term}: ₦${balance.toLocaleString()}`);
                    }
                }
            } catch (docError) {
                // Skip this term if error occurs
                console.warn(`Skipped ${term} for session ${session}:`, docError.message);
            }
        }
        
        return totalBalance;
        
    } catch (error) {
        console.error('Error in calculateSessionBalanceSafe:', error);
        return 0;
    }
}

// Make globally available
window.calculateCompleteArrears = calculateCompleteArrears;
window.calculateSessionBalanceSafe = calculateSessionBalanceSafe;

/**
 * ✅ NEW: Calculate actual fee for pupil with adjustments
 */
function calculateAdjustedFee(pupilData, baseFee, currentTerm) {
    if (!pupilData || typeof baseFee !== 'number') {
        console.warn('Invalid pupilData or baseFee');
        return baseFee || 0;
    }
    
    // Step 1: Check enrollment period (admissionTerm / exitTerm)
    const termOrder = {
        'First Term': 1,
        'Second Term': 2,
        'Third Term': 3
    };
    
    const currentTermNum = termOrder[currentTerm] || 1;
    const admissionTermNum = termOrder[pupilData.admissionTerm || 'First Term'] || 1;
    const exitTermNum = termOrder[pupilData.exitTerm || 'Third Term'] || 3;
    
    // Not yet admitted or already exited
    if (currentTermNum < admissionTermNum || currentTermNum > exitTermNum) {
        console.log(`Pupil not enrolled for ${currentTerm} (admission: ${pupilData.admissionTerm}, exit: ${pupilData.exitTerm})`);
        return 0;
    }
    
    // Step 2: Start with base fee
    let adjustedFee = baseFee;
    
    // Step 3: Apply percentage adjustment (e.g., 50% scholarship = -50%)
    const percentAdjustment = Number(pupilData.feeAdjustmentPercent) || 0;
    if (percentAdjustment !== 0) {
        adjustedFee = adjustedFee * (1 + percentAdjustment / 100);
        console.log(`Applied ${percentAdjustment}% adjustment: ₦${baseFee.toLocaleString()} → ₦${adjustedFee.toLocaleString()}`);
    }
    
    // Step 4: Apply fixed amount adjustment (e.g., ₦5000 discount = -5000)
    const amountAdjustment = Number(pupilData.feeAdjustmentAmount) || 0;
    if (amountAdjustment !== 0) {
        adjustedFee = adjustedFee + amountAdjustment;
        console.log(`Applied ₦${amountAdjustment.toLocaleString()} adjustment: final = ₦${adjustedFee.toLocaleString()}`);
    }
    
    // Step 5: Ensure non-negative
    const finalFee = Math.max(0, adjustedFee);
    
    if (finalFee === 0) {
        console.log(`✓ Free education applied for ${pupilData.name}`);
    }
    
    return finalFee;
}

// Make globally available
window.calculateAdjustedFee = calculateAdjustedFee;

async function loadAllPaymentHistory(pupilId) {
    if (!pupilId) return;
    const container = document.getElementById('payment-history-list');
    if (!container) return;

    try {
        const snapshot = await db.collection('payment_transactions')
            .where('pupilId', '==', pupilId)
            .orderBy('paymentDate', 'desc')
            .get();

        if (snapshot.empty) {
            container.innerHTML = `
                <div style="text-align:center; padding:var(--space-xl); color:var(--color-gray-600); background: #f8fafc; border-radius: var(--radius-md);">
                    <i data-lucide="inbox" style="width: 40px; height: 40px; margin: 0 auto var(--space-md); opacity: 0.5;"></i>
                    <p style="margin: 0;">No payment history yet</p>
                </div>
            `;
            if (typeof lucide !== 'undefined') lucide.createIcons();
            return;
        }

        container.innerHTML = '';
        const transactionsBySession = {};

        snapshot.forEach(doc => {
            const data = doc.data();
            const session = data.session || 'Unknown Session';
            if (!transactionsBySession[session]) transactionsBySession[session] = [];
            transactionsBySession[session].push({ id: doc.id, ...data });
        });

        Object.keys(transactionsBySession)
            .sort((a, b) => (parseInt(b.split('/')[0]) || 0) - (parseInt(a.split('/')[0]) || 0))
            .forEach(session => {
                const header = document.createElement('div');
                header.style.cssText = `
                    font-weight: 700; font-size: var(--text-lg);
                    color: #0f172a; margin-top: var(--space-lg); margin-bottom: var(--space-md);
                    padding-bottom: var(--space-sm); border-bottom: 2px solid #e2e8f0;
                `;
                header.innerHTML = `📅 ${session} (${transactionsBySession[session].length} payment${transactionsBySession[session].length > 1 ? 's' : ''})`;
                container.appendChild(header);

                transactionsBySession[session].forEach(txn => {
                    const paymentDate = txn.paymentDate ? txn.paymentDate.toDate().toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) : 'N/A';
                    const amountPaid = Number(txn.amountPaid || 0);
                    const arrearsPayment = Number(txn.arrearsPayment || 0);
                    const currentTermPayment = Number(txn.currentTermPayment || 0);
                    const paymentMethodIcon = (txn.paymentMethod || 'Cash').toLowerCase() === 'cash' ? 'banknote' : 'credit-card';

                    const itemDiv = document.createElement('div');
                    itemDiv.style.cssText = `
                        padding: var(--space-md); background: #f8fafc; border: 1px solid #e2e8f0;
                        border-radius: var(--radius-md); display: flex; justify-content: space-between; align-items: center;
                        transition: all 0.2s ease; margin-bottom: var(--space-sm);
                    `;

                    itemDiv.innerHTML = `
                        <div style="flex: 1;">
                            <div style="font-weight: 700; font-size: var(--text-lg); color: #0f172a; margin-bottom: var(--space-xs);">
                                ₦${amountPaid.toLocaleString()}
                            </div>
                            <div style="font-size: var(--text-sm); color: #64748b; display: flex; flex-direction: column; gap: var(--space-xs);">
                                <div style="display: flex; flex-wrap: wrap; gap: var(--space-md);">
                                    <span style="display: flex; align-items: center; gap: var(--space-xs);">
                                        <i data-lucide="calendar" style="width: 14px; height: 14px;"></i>
                                        ${paymentDate}
                                    </span>
                                    <span style="display: flex; align-items: center; gap: var(--space-xs);">
                                        <i data-lucide="bookmark" style="width: 14px; height: 14px;"></i>
                                        ${txn.term || 'N/A'}
                                    </span>
                                    <span style="display: flex; align-items: center; gap: var(--space-xs);">
                                        <i data-lucide="${paymentMethodIcon}" style="width: 14px; height: 14px;"></i>
                                        ${txn.paymentMethod || 'Cash'}
                                    </span>
                                    <span style="display: flex; align-items: center; gap: var(--space-xs);">
                                        <i data-lucide="hash" style="width: 14px; height: 14px;"></i>
                                        ${txn.receiptNo || 'N/A'}
                                    </span>
                                </div>
                                <div style="display: flex; flex-wrap: wrap; gap: var(--space-md); color: #0f172a; font-weight: 500;">
                                    ${arrearsPayment > 0 ? `💰 Arrears: ₦${arrearsPayment.toLocaleString()}` : ''}
                                    ${currentTermPayment > 0 ? `📌 Current Term: ₦${currentTermPayment.toLocaleString()}` : ''}
                                </div>
                            </div>
                        </div>
                        <button class="btn-small btn-secondary" onclick="viewReceipt('${txn.receiptNo}')">
                            <i data-lucide="eye" style="width: 16px; height: 16px;"></i>
                            View Receipt
                        </button>
                    `;

                    itemDiv.onmouseenter = () => {
                        itemDiv.style.background = 'white';
                        itemDiv.style.borderColor = '#cbd5e1';
                        itemDiv.style.boxShadow = '0 2px 8px rgba(0,0,0,0.05)';
                    };
                    itemDiv.onmouseleave = () => {
                        itemDiv.style.background = '#f8fafc';
                        itemDiv.style.borderColor = '#e2e8f0';
                        itemDiv.style.boxShadow = 'none';
                    };

                    container.appendChild(itemDiv);
                });
            });

        if (typeof lucide !== 'undefined') lucide.createIcons();
        console.log(`✓ Loaded ${snapshot.size} total payment records for pupil`);

    } catch (error) {
        console.error('Error loading payment history:', error);
        container.innerHTML = `
            <div style="text-align:center; padding:var(--space-lg); color:var(--color-danger); background: #fef2f2; border-radius: var(--radius-md);">
                <p style="margin: 0;">Error loading payment history</p>
            </div>
        `;
    }
}

window.loadFeeBalance = loadFeeBalance;
window.loadAllPaymentHistory = loadAllPaymentHistory;

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