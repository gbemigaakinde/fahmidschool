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

        // FIXED: Setup real-time listeners with debouncing
        let pupilUpdateTimeout = null;
        let classUpdateTimeout = null;

        // FIXED: Pupil data listener with proper change detection
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
          
          // CRITICAL FIX: Exclude timestamp fields from comparison
          const currentDataCopy = { ...currentPupilData };
          const updatedDataCopy = { ...updatedData };
          
          // Remove timestamp fields that always change
          delete currentDataCopy.updatedAt;
          delete currentDataCopy.createdAt;
          delete updatedDataCopy.updatedAt;
          delete updatedDataCopy.createdAt;
          
          // Check if data actually changed (excluding timestamps)
          const hasChanges = JSON.stringify(currentDataCopy) !== JSON.stringify(updatedDataCopy);
          
          if (!hasChanges) {
            console.log('No meaningful changes detected (only timestamp updated), skipping update');
            return;
          }
          
          console.log('Pupil data changed, updating...');
          currentPupilData = updatedData;
          
          // Extract class info
          const updatedClassId = getClassIdFromPupilData(updatedData.class);
          const updatedClassName = getClassNameFromPupilData(updatedData.class);
          
          currentClassInfo.name = updatedClassName;
          currentClassInfo.teacher = updatedData.assignedTeacher?.name || '-';
          currentClassInfo.subjects = Array.isArray(updatedData.subjects) ? updatedData.subjects : [];
          
          // Update UI
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

          // Update header
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
      }, 500); // 500ms debounce
    },
    error => {
      console.error('Pupil listener error:', error);
      window.showToast?.('Connection lost. Please refresh.', 'warning');
    }
  );

        // Class listener with debouncing
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
                      console.log('No class changes, skipping');
                      return;
                    }
                    
                    console.log('Class data changed, updating...');
                    
                    currentClassInfo.name = classData.name || currentClassInfo.name;
                    currentClassInfo.subjects = Array.isArray(classData.subjects) ? classData.subjects : [];
                    
                    // Get teacher name
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
                    
                    // Update profile
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
                }, 500); // 500ms debounce
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
 * Load pupil fee balance
 */
async function loadFeeBalance() {
    if (!currentPupilId) return;
    
    const feeSection = document.getElementById('fee-balance-section');
    if (!feeSection) return;
    
    try {
        const settings = await window.getCurrentSettings();
        const session = settings.session;
        const term = settings.term;
        
        // Get payment summary
        const paymentRecordId = `${currentPupilId}_${session}_${term}`;
        const paymentDoc = await db.collection('payments').doc(paymentRecordId).get();
        
        if (!paymentDoc.exists) {
            // No fee structure configured for this class/term
            feeSection.style.display = 'none';
            return;
        }
        
        const paymentData = paymentDoc.data();
        
        // Display fee summary
        document.getElementById('fee-amount-due').textContent = 
            `₦${(paymentData.amountDue || 0).toLocaleString()}`;
        
        document.getElementById('fee-total-paid').textContent = 
            `₦${(paymentData.totalPaid || 0).toLocaleString()}`;
        
        const balance = paymentData.balance || 0;
        const balanceEl = document.getElementById('fee-balance');
        balanceEl.textContent = `₦${balance.toLocaleString()}`;
        
        // Color code balance
        if (balance <= 0) {
            balanceEl.parentElement.style.background = 'linear-gradient(135deg, #4CAF50 0%, #388E3C 100%)';
        } else if (balance < paymentData.amountDue) {
            balanceEl.parentElement.style.background = 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)';
        } else {
            balanceEl.parentElement.style.background = 'linear-gradient(135deg, #f44336 0%, #d32f2f 100%)';
        }
        
        // Load payment history
        await loadPaymentHistory(session, term);
        
        // Show section
        feeSection.style.display = 'block';
        
    } catch (error) {
        console.error('Error loading fee balance:', error);
        feeSection.style.display = 'none';
    }
}

/**
 * Load payment history for pupil
 */
async function loadPaymentHistory(session, term) {
    const container = document.getElementById('payment-history-list');
    if (!container || !currentPupilId) return;
    
    try {
        const transactionsSnap = await db.collection('payment_transactions')
            .where('pupilId', '==', currentPupilId)
            .where('session', '==', session)
            .where('term', '==', term)
            .orderBy('paymentDate', 'desc')
            .get();
        
        if (transactionsSnap.empty) {
            container.innerHTML = '<p style="text-align:center; color:var(--color-gray-600); padding:var(--space-lg);">No payment history yet</p>';
            return;
        }
        
        container.innerHTML = '';
        
        transactionsSnap.forEach(doc => {
            const data = doc.data();
            
            const paymentDate = data.paymentDate 
                ? data.paymentDate.toDate().toLocaleDateString('en-GB')
                : 'N/A';
            
            const itemDiv = document.createElement('div');
            itemDiv.style.cssText = `
                padding: var(--space-md);
                background: white;
                border: 1px solid var(--color-gray-300);
                border-radius: var(--radius-md);
                display: flex;
                justify-content: space-between;
                align-items: center;
            `;
            
            itemDiv.innerHTML = `
                <div>
                    <div style="font-weight: 600; margin-bottom: var(--space-xs);">₦${parseFloat(data.amountPaid).toLocaleString()}</div>
                    <div style="font-size: var(--text-sm); color: var(--color-gray-600);">
                        ${paymentDate} • ${data.paymentMethod || 'Cash'} • Receipt #${data.receiptNo}
                    </div>
                </div>
                <button class="btn-small btn-secondary" onclick="viewReceipt('${data.receiptNo}')">
                    View Receipt
                </button>
            `;
            
            container.appendChild(itemDiv);
        });
        
    } catch (error) {
        console.error('Error loading payment history:', error);
        container.innerHTML = '<p style="text-align:center; color:var(--color-danger);">Error loading payment history</p>';
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

console.log('✓ Pupil portal initialized (v4.4.0 - SESSION SELECTOR FIXED)');