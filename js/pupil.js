/**
 * FAHMID NURSERY & PRIMARY SCHOOL
 * Pupil Portal JavaScript
 * @version 4.4.0
 * @date 2026-01-10
 */

'use strict';

let currentPupilId = null;
let currentPupilData = null;
let currentClassInfo = null;

let pupilListener = null;
let classListener = null;

checkRole('pupil')
    .then(async user => await loadPupilProfile(user))
    .catch(() => window.location.href = 'login');

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

function getClassIdFromPupilData(classData) {
  if (!classData) return null;
  if (typeof classData === 'object' && classData.id) {
    return classData.id;
  }
  return null;
}

function getClassNameFromPupilData(classData) {
  if (!classData) return 'Unknown';
  if (typeof classData === 'object' && classData.name) {
    return classData.name;
  }
  if (typeof classData === 'string') {
    return classData;
  }
  return 'Unknown';
}

function filterSubjectsByReligion(subjects, religion) {
  if (!Array.isArray(subjects) || subjects.length === 0) return subjects || [];

  const normalizedReligion = (religion || '').trim().toLowerCase();

  const isChristianRS = (name) => {
    const n = (name || '').toLowerCase();
    return (
      n.includes('christian religious') ||
      n === 'crs' ||
      n === 'crk' ||
      n.includes('bible knowledge')
    );
  };

  const isIslamicRS = (name) => {
    const n = (name || '').toLowerCase();
    return (
      n.includes('islamic religious') ||
      n === 'irs' ||
      n === 'irk' ||
      n.includes('islamic studies')
    );
  };

  if (normalizedReligion === 'muslim' || normalizedReligion === 'islam') {
    return subjects.filter(s => !isChristianRS(s));
  }

  if (normalizedReligion === 'christian' || normalizedReligion === 'christianity') {
    return subjects.filter(s => !isIslamicRS(s));
  }

  return subjects;
}

window.filterSubjectsByReligion = filterSubjectsByReligion;

function getFirstNameOnly(fullName) {
  if (!fullName || typeof fullName !== 'string') return '-';
  return fullName.trim().split(/\s+/)[0];
}

window.getFirstNameOnly = getFirstNameOnly;

async function loadPupilProfile(user) {
    if (window.isLoadingProfile) {
        return;
    }

    window.isLoadingProfile = true;

    try {
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
            window.showToast?.('No pupil profile found. Contact admin.', 'danger');
            setTimeout(() => window.location.href = 'login', 3000);
            window.isLoadingProfile = false;
            return;
        }

        const data = pupilDoc.data();
        currentPupilId = pupilDoc.id;
        currentPupilData = data;

        const isAlumni = data.status === 'alumni' || data.isActive === false;

        if (isAlumni) {
            renderProfile({
                name: data.name || '-',
                dob: data.dob || '-',
                admissionNo: data.admissionNo || '-',
                gender: data.gender || '-',
                contact: data.contact || '-',
                address: data.address || '-',
                email: data.email || '-',
                class: data.finalClass || 'Graduated',
                teacher: '-',
                subjects: [],
                isAlumni: true,
                graduationSession: data.graduationSession || '-'
            });

            const welcomeEl = document.getElementById('pupil-welcome');
            const classEl = document.getElementById('student-class');
            const sessionEl = document.getElementById('student-session');

            if (welcomeEl) {
                welcomeEl.innerHTML = `Hello, <strong>${getFirstNameOnly(data.name)}</strong>!`;
            }
            if (classEl) {
                classEl.innerHTML = '<span style="background: linear-gradient(135deg, #4CAF50 0%, #388E3C 100%); color: white; padding: 4px 12px; border-radius: 20px; font-weight: 600;">🎓 Alumni (Graduated!)</span>';
            }
            if (sessionEl) {
                sessionEl.textContent = data.graduationSession || 'Graduated';
            }

            await loadResults();
            await loadFeeBalance();

            window.isLoadingProfile = false;
            return;
        }
        const classId = getClassIdFromPupilData(data.class);
        const className = getClassNameFromPupilData(data.class);

        currentClassInfo = {
          name: className,
          teacher: data.assignedTeacher?.name || '-',
          subjects: window.filterSubjectsByReligion(
            Array.isArray(data.subjects) ? data.subjects : [],
            data.religion
          )
        };

        if (classId) {
            try {
                const classDoc = await db.collection('classes').doc(classId).get();
                if (classDoc.exists) {
                    const classData = classDoc.data();
                    currentClassInfo.name = classData.name || className;
                    currentClassInfo.subjects = window.filterSubjectsByReligion(
                        Array.isArray(classData.subjects) ? classData.subjects : [],
                        data.religion
                    );

                    if (classData.teacherName) {
                        currentClassInfo.teacher = classData.teacherName;
                    } else if (classData.teacherId) {
                        try {
                            const teacherDoc = await db.collection('teachers').doc(classData.teacherId).get();
                            currentClassInfo.teacher = teacherDoc.exists ? teacherDoc.data().name : '-';
                        } catch (teacherError) {
                            currentClassInfo.teacher = '-';
                        }
                    } else {
                        currentClassInfo.teacher = '-';
                    }
                }
            } catch (error) {
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

                        currentClassInfo.subjects = window.filterSubjectsByReligion(
                            Array.isArray(matchedClassData.subjects) ? matchedClassData.subjects : [],
                            data.religion
                        );

                        if (matchedClassData.teacherName) {
                            currentClassInfo.teacher = matchedClassData.teacherName;
                        } else if (matchedClassData.teacherId) {
                            try {
                                const teacherDoc = await db.collection('teachers').doc(matchedClassData.teacherId).get();
                                currentClassInfo.teacher = teacherDoc.exists ? teacherDoc.data().name : '-';
                            } catch (teacherError) {
                                currentClassInfo.teacher = '-';
                            }
                        }
                    }
                } catch (error) {
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
            welcomeEl.innerHTML = `Hello, <strong>${getFirstNameOnly(data.name)}</strong>!`;
        }
        if (classEl) {
            classEl.textContent = currentClassInfo.name;
        }
        if (sessionEl) {
            sessionEl.textContent = settings.session;
        }

        await loadResults();
        await loadFeeBalance();

        if (typeof window.loadAnnouncementsForUser === 'function' && currentPupilId) {
          const annClassId = getClassIdFromPupilData(data.class);
          window.loadAnnouncementsForUser(
            'pupil',
            currentPupilId,
            annClassId,
            'announcements-banner-container'
          );
        }

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
                    return;
                  }

                  currentPupilData = updatedData;

                  const updatedClassId = getClassIdFromPupilData(updatedData.class);
                  const updatedClassName = getClassNameFromPupilData(updatedData.class);

                  currentClassInfo.name = updatedClassName;
                  currentClassInfo.teacher = updatedData.assignedTeacher?.name || '-';
                  currentClassInfo.subjects = window.filterSubjectsByReligion(
                    Array.isArray(updatedData.subjects) ? updatedData.subjects : [],
                    updatedData.religion
                  );

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

                  if (welcomeEl) welcomeEl.innerHTML = `Hello, <strong>${getFirstNameOnly(updatedData.name)}</strong>!`;
                  if (classEl) classEl.textContent = currentClassInfo.name;
                  if (sessionEl) sessionEl.textContent = settings.session;

                  await loadResults();

                } catch (error) {
                } finally {
                  pupilUpdateTimeout = null;
                }
              }, 500);
            },
            error => {
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

                    const filteredIncoming = window.filterSubjectsByReligion(
                      Array.isArray(classData.subjects) ? classData.subjects : [],
                      currentPupilData?.religion
                    );

                    const hasChanges =
                      currentClassInfo.name !== classData.name ||
                      JSON.stringify(currentClassInfo.subjects) !== JSON.stringify(filteredIncoming);

                    if (!hasChanges) {
                      return;
                    }

                    currentClassInfo.name = classData.name || currentClassInfo.name;
                    currentClassInfo.subjects = filteredIncoming;

                    if (classData.teacherName) {
                      currentClassInfo.teacher = classData.teacherName;
                    } else if (classData.teacherId) {
                      try {
                        const teacherDoc = await db.collection('teachers').doc(classData.teacherId).get();
                        currentClassInfo.teacher = teacherDoc.exists ? teacherDoc.data().name : '-';
                      } catch (err) {
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

                  } catch (error) {
                  } finally {
                    classUpdateTimeout = null;
                  }
                }, 500);
              },
              error => {
              }
            );
        }

    } catch (error) {
        window.handleError?.(error, 'Failed to load pupil profile');
    } finally {
        window.isLoadingProfile = false;
    }
}

function renderProfile(profile) {
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

    if (profile.isAlumni) {
        if (classDisplay) {
            classDisplay.innerHTML = `
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span>${profile.class}</span>
                    <span style="background: #4CAF50; color: white; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600;">GRADUATED</span>
                </div>
            `;
        }

        if (teacherDisplay) {
            teacherDisplay.textContent = '-';
            teacherDisplay.style.color = '#94a3b8';
        }

        if (subjectsDisplay) {
            subjectsDisplay.textContent = '-';
            subjectsDisplay.style.color = '#94a3b8';
        }
    } else {
        if (classDisplay) classDisplay.textContent = profile.class;
        if (teacherDisplay) {
            teacherDisplay.textContent = profile.teacher;
            teacherDisplay.style.color = '';
        }
        if (subjectsDisplay) {
            const subjectList = profile.subjects && profile.subjects.length > 0
                ? profile.subjects.join(', ')
                : '-';
            subjectsDisplay.textContent = subjectList;
            subjectsDisplay.style.color = '';
        }
    }
}

function renderSubjects(subjects, teacher) {
    const subjectsDisplay = document.getElementById('pupil-subjects-display');
    if (subjectsDisplay) {
        const subjectList = subjects && subjects.length > 0
            ? subjects.join(', ')
            : '-';
        subjectsDisplay.textContent = subjectList;
    }
}

async function loadResults() {
    if (!currentPupilId) return;

    const container = document.getElementById('results-container');
    if (!container) return;

    container.innerHTML = `
        <div class="skeleton-container">
            <div class="skeleton" style="height:40px;width:60%;margin:var(--space-xl) auto;"></div>
            <div class="skeleton" style="height:30px;margin:var(--space-lg) 0 var(--space-sm);"></div>
            <div class="skeleton" style="height:30px;margin-bottom:var(--space-sm);"></div>
        </div>
    `;

    try {
        await populateSessionSelector();

        await new Promise(resolve => requestAnimationFrame(resolve));

        const sessionSelect = document.getElementById('pupil-session-select');
        if (sessionSelect) {
            const newSessionSelect = sessionSelect.cloneNode(true);
            sessionSelect.parentNode.replaceChild(newSessionSelect, sessionSelect);

            newSessionSelect.addEventListener('change', async function() {
                const selectedValue = this.value;

                container.innerHTML = `
                    <div style="text-align:center; padding:var(--space-2xl); color:var(--color-gray-600);">
                        <div class="spinner" style="margin: 0 auto var(--space-md); width: 40px; height: 40px; border: 4px solid #f3f3f3; border-top: 4px solid #00B2FF; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                        <p>Loading results for ${selectedValue === 'current' ? 'current session' : selectedValue}...</p>
                    </div>
                `;

                await new Promise(resolve => setTimeout(resolve, 300));
                await loadSessionResults();
            });
        }

        await loadSessionResults();

    } catch (error) {
        container.innerHTML = `<p style="text-align:center;color:var(--color-danger); padding:var(--space-2xl);">
            ⚠️ Unable to load results. Try again later.
        </p>`;
    }
}

function getClassIdSafely(pupilData) {
  if (!pupilData || !pupilData.class) {
    return null;
  }

  if (typeof pupilData.class === 'object' && pupilData.class.id) {
    return pupilData.class.id;
  }

  if (typeof pupilData.class === 'string') {
    return null;
  }

  return null;
}

window.getClassIdSafely = getClassIdSafely;

async function loadFeeBalance() {
    if (!currentPupilId) return;

    const feeSection = document.getElementById('fee-balance-section');
    if (!feeSection) return;

    feeSection.style.display = 'block';
    feeSection.innerHTML = `
        <div style="text-align:center; padding:var(--space-2xl);">
            <div class="spinner"></div>
            <p>Loading fee information...</p>
        </div>
    `;

    try {
        const pupilDoc = await db.collection('pupils').doc(currentPupilId).get();
        if (!pupilDoc.exists) {
            throw new Error('Pupil profile not found');
        }

        const pupilData = pupilDoc.data();
        const isAlumni = pupilData.status === 'alumni' || pupilData.isActive === false;

        if (isAlumni) {
            feeSection.innerHTML = `
                <div class="section-header">
                    <div class="section-icon" style="background: linear-gradient(135deg, #4CAF50 0%, #388E3C 100%);">
                        <i data-lucide="graduation-cap"></i>
                    </div>
                    <div class="section-title">
                        <h2>Payment Records</h2>
                        <p style="color: #4CAF50; font-weight: 600;">Alumni • Graduated</p>
                    </div>
                </div>

                <div style="background: linear-gradient(135deg, #4CAF50 0%, #388E3C 100%); color: white; padding: var(--space-xl); border-radius: var(--radius-lg); margin-bottom: var(--space-xl);">
                    <div style="display: flex; align-items: center; gap: var(--space-md); margin-bottom: var(--space-md);">
                        <i data-lucide="graduation-cap" style="width: 32px; height: 32px;"></i>
                        <div>
                            <h3 style="margin: 0; color: white;">Alumni Status</h3>
                            <p style="margin: var(--space-xs) 0 0; opacity: 0.9;">Graduated from ${pupilData.finalClass || 'School'}</p>
                        </div>
                    </div>
                    <p style="margin: 0; opacity: 0.9; font-size: var(--text-sm);">
                        You have successfully graduated. Below is your complete payment history for reference.
                    </p>
                </div>

                <div style="background: white; padding: var(--space-xl); border-radius: var(--radius-lg); border: 1px solid #e2e8f0;">
                    <h3 style="margin: 0 0 var(--space-lg); display: flex; align-items: center; gap: var(--space-sm);">
                        <i data-lucide="receipt" style="width: 20px; height: 20px;"></i>
                        Complete Payment History
                    </h3>
                    <div id="payment-history-list" style="display: grid; gap: var(--space-md);">
                        <div style="text-align:center; padding:var(--space-lg); color:var(--color-gray-600);">
                            <div class="spinner"></div>
                            <p>Loading payment records...</p>
                        </div>
                    </div>
                </div>

                <div style="margin-top: var(--space-xl); padding: var(--space-lg); background: #f0fdf4; border: 2px solid #4CAF50; border-radius: var(--radius-md);">
                    <h4 style="margin: 0 0 var(--space-sm); color: #065f46; display: flex; align-items: center; gap: var(--space-sm);">
                        <i data-lucide="info" style="width: 18px; height: 18px;"></i>
                        Need Documents?
                    </h4>
                    <p style="margin: 0; font-size: var(--text-sm); color: #14532d;">
                        For transcript requests or payment verification, please contact the school office.
                    </p>
                </div>
            `;

            if (typeof lucide !== 'undefined') lucide.createIcons();
            await loadAllPaymentHistory(currentPupilId);
            return;
        }

        const settings = await window.getCurrentSettings();
        const session = settings.session;
        const currentTerm = settings.term;

        let classId = null;
        let className = 'Unknown';

        if (pupilData.class) {
            if (typeof pupilData.class === 'object') {
                classId = pupilData.class.id || null;
                className = pupilData.class.name || 'Unknown';
            } else if (typeof pupilData.class === 'string') {
                className = pupilData.class;

                const classesSnap = await db.collection('classes')
                    .where('name', '==', className)
                    .limit(1)
                    .get();

                if (!classesSnap.empty) {
                    classId = classesSnap.docs[0].id;
                }
            }
        }

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

        const result = await window.calculateCurrentOutstanding(
            currentPupilId,
            session,
            currentTerm
        );

        if (result.reason) {
            feeSection.innerHTML = `
                <div class="section-header">
                    <div class="section-icon" style="background: linear-gradient(135deg, #9e9e9e 0%, #757575 100%);">
                        <i data-lucide="info"></i>
                    </div>
                    <div class="section-title">
                        <h2>Fee Information</h2>
                        <p>${result.reason}</p>
                    </div>
                </div>
            `;
            if (typeof lucide !== 'undefined') lucide.createIcons();
            return;
        }

        const baseFee = result.baseFee;
        const amountDue = result.amountDue;
        const arrears = result.arrears;
        const totalPaid = result.totalPaid;
        const balance = result.balance;
        const status = result.status;

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

        const arrearsCleared = balance <= amountDue;
        const arrearsHTML = (arrears > 0 && !arrearsCleared) ? `
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
                        ${totalPaid > 0 ? percentPaid + '% paid' : 'No payments yet'}
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

        const sortedSessions = Object.keys(transactionsBySession).sort((a, b) => {
            return (parseInt(b.split('/')[0]) || 0) - (parseInt(a.split('/')[0]) || 0);
        });

        function buildTransactionCard(txn) {
            const paymentDate = txn.paymentDate
                ? txn.paymentDate.toDate().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                : 'N/A';
            const amountPaid = Number(txn.amountPaid || 0);
            const paymentMethodIcon = (txn.paymentMethod || 'Cash').toLowerCase() === 'cash' ? 'banknote' : 'credit-card';
            const balanceAfter = typeof txn.balanceAfter === 'number' ? txn.balanceAfter : null;

            const itemDiv = document.createElement('div');
            itemDiv.style.cssText = `
    padding: var(--space-md); background: #f8fafc; border: 1px solid #e2e8f0;
    border-radius: var(--radius-md); display: flex; justify-content: space-between;
    align-items: flex-start; transition: all 0.2s ease; margin-bottom: var(--space-sm);
    position: relative; width: 100%; min-width: 0; box-sizing: border-box;
    flex-wrap: wrap; gap: 8px;
`;

            itemDiv.innerHTML = `
                <div style="flex: 1; min-width: 0; overflow-wrap: break-word; word-break: break-word;">
                    <div class="payment-amount" style="font-size: 1rem; font-weight: 700; color: #0f172a; margin-bottom: var(--space-xs);">
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
                        ${balanceAfter !== null ? `
                        <div style="
                            display: inline-flex; align-items: center; gap: 3px; margin-top: 4px;
                            padding: 2px 6px; border-radius: 16px; font-size: 11px; font-weight: 600;
                            line-height: 1.4; white-space: nowrap; width: fit-content; flex-wrap: nowrap;
                            background-color: ${balanceAfter <= 0 ? 'rgba(22,163,74,0.08)' : 'rgba(180,83,9,0.08)'};
                            color: ${balanceAfter <= 0 ? '#15803d' : '#a16207'};
                            border: 1px solid ${balanceAfter <= 0 ? 'rgba(22,163,74,0.25)' : 'rgba(180,83,9,0.25)'};
                         ">
                            <i data-lucide="${balanceAfter <= 0 ? 'check-circle' : 'alert-circle'}" style="width: 12px; height: 12px;"></i>
                            Balance after payment: ₦${Math.max(0, balanceAfter).toLocaleString()}
                            ${balanceAfter <= 0 ? ' · Fully paid' : ''}
                        </div>` : ''}
                    </div>
                </div>
                <button class="btn-small btn-secondary" onclick="viewReceipt('${txn.receiptNo}')" style="flex-shrink: 0; align-self: flex-start; margin-top: 4px;">
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

            return itemDiv;
        }

        sortedSessions.forEach((session, sessionIndex) => {
            const txns = transactionsBySession[session];
            const isMostRecent = sessionIndex === 0;
            const hiddenCount = txns.length - 1;

            const header = document.createElement('div');
            header.style.cssText = `
                font-weight: 700; font-size: var(--text-lg);
                color: #0f172a; margin-top: var(--space-lg); margin-bottom: var(--space-md);
                padding-bottom: var(--space-sm); border-bottom: 2px solid #e2e8f0;
                display: flex; align-items: center; justify-content: space-between;
            `;
            header.innerHTML = `
                <span>📅 ${session} (${txns.length} payment${txns.length > 1 ? 's' : ''})</span>
            `;
            container.appendChild(header);

            container.appendChild(buildTransactionCard(txns[0]));

            if (hiddenCount > 0) {
                const collapseId = `history-collapse-${sessionIndex}`;

                const olderWrapper = document.createElement('div');
                olderWrapper.id = collapseId;
                olderWrapper.style.cssText = `
                     display: none;
                     flex-direction: column;
                     margin-top: 0;
                     width: 100%;
                     min-width: 0;
                     box-sizing: border-box;
                     overflow: hidden;
                 `;

                txns.slice(1).forEach(txn => {
                    olderWrapper.appendChild(buildTransactionCard(txn));
                });

                container.appendChild(olderWrapper);

                const toggleBtn = document.createElement('button');
                toggleBtn.style.cssText = `
                    display: flex; align-items: center; justify-content: center; gap: 6px;
                    width: 100%; padding: 8px 14px; margin-bottom: var(--space-sm);
                    background: #f1f5f9; border: 1px dashed #cbd5e1; border-radius: var(--radius-md);
                    font-size: 12.5px; font-weight: 600; color: #475569;
                    cursor: pointer; transition: all 0.2s ease;
                `;
                toggleBtn.innerHTML = `
                    <i data-lucide="chevron-down" style="width:14px;height:14px; transition: transform 0.25s ease;"></i>
                    Show ${hiddenCount} older payment${hiddenCount > 1 ? 's' : ''} in this session
                `;

                let expanded = false;
                toggleBtn.addEventListener('click', () => {
                    expanded = !expanded;
                    olderWrapper.style.display = expanded ? 'flex' : 'none';
                     olderWrapper.style.flexDirection = 'column';
                     olderWrapper.style.width = '100%';
                     olderWrapper.style.minWidth = '0';
                     olderWrapper.style.boxSizing = 'border-box';
                      olderWrapper.style.overflow = 'hidden';

                    const icon = toggleBtn.querySelector('i[data-lucide]');
                    if (expanded) {
                        toggleBtn.innerHTML = `
                            <i data-lucide="chevron-up" style="width:14px;height:14px;"></i>
                            Hide older payments
                        `;
                        toggleBtn.style.background = '#e0e7ff';
                        toggleBtn.style.borderColor = '#a5b4fc';
                        toggleBtn.style.color = '#3730a3';
                    } else {
                        toggleBtn.innerHTML = `
                            <i data-lucide="chevron-down" style="width:14px;height:14px;"></i>
                            Show ${hiddenCount} older payment${hiddenCount > 1 ? 's' : ''} in this session
                        `;
                        toggleBtn.style.background = '#f1f5f9';
                        toggleBtn.style.borderColor = '#cbd5e1';
                        toggleBtn.style.color = '#475569';
                    }
                    if (typeof lucide !== 'undefined') lucide.createIcons();
                });

                container.appendChild(toggleBtn);
            }
        });

        if (typeof lucide !== 'undefined') lucide.createIcons();

    } catch (error) {
        container.innerHTML = `
            <div style="text-align:center; padding:var(--space-lg); color:var(--color-danger); background: #fef2f2; border-radius: var(--radius-md);">
                <p style="margin: 0;">Error loading payment history</p>
            </div>
        `;
    }
}

window.loadFeeBalance = loadFeeBalance;
window.loadAllPaymentHistory = loadAllPaymentHistory;

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

window.viewReceipt = viewReceipt;

async function populateSessionSelector() {
    const selector = document.getElementById('pupil-session-select');
    if (!selector) {
        return;
    }

    try {
        const pupilDoc = await db.collection('pupils').doc(currentPupilId).get();
        const isAlumni = pupilDoc.exists &&
            (pupilDoc.data().status === 'alumni' || pupilDoc.data().isActive === false);

        const settings = await window.getCurrentSettings();
        const currentSession = settings.session || 'Current Session';

        selector.innerHTML = '';

        if (!isAlumni) {
            const currentOpt = document.createElement('option');
            currentOpt.value = 'current';
            currentOpt.textContent = `Current Session (${currentSession})`;
            selector.appendChild(currentOpt);
        }

        const resultsSnap = await db.collection('results')
            .where('pupilId', '==', currentPupilId)
            .get();

        const sessions = new Set();
        let approvedCount = 0;

        resultsSnap.forEach(doc => {
            const data = doc.data();

            if (data.session && data.status === 'approved') {
                if (isAlumni || data.session !== currentSession) {
                    sessions.add(data.session);
                    approvedCount++;
                }
            }
        });

        const sortedSessions = Array.from(sessions).sort((a, b) => {
            const yearA = parseInt(a.split('/')[0]) || 0;
            const yearB = parseInt(b.split('/')[0]) || 0;
            return yearB - yearA;
        });

        sortedSessions.forEach(session => {
            const opt = document.createElement('option');
            opt.value = session;
            opt.textContent = `${session} Session`;
            selector.appendChild(opt);
        });

        if (sortedSessions.length === 0 && isAlumni) {
            selector.innerHTML = '<option value="">No results available</option>';
        }

    } catch (error) {
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

        if (selectedSession === 'current') {
            const settings = await window.getCurrentSettings();
            const currentSessionName = settings.session;
            displaySessionName = `Current Session (${currentSessionName})`;

            try {
                resultsSnap = await db.collection('results')
                    .where('pupilId', '==', currentPupilId)
                    .where('session', '==', currentSessionName)
                    .where('status', '==', 'approved')
                    .get();

            } catch (error) {
                const allResultsSnap = await db.collection('results')
                    .where('pupilId', '==', currentPupilId)
                    .where('session', '==', currentSessionName)
                    .get();

                const approvedDocs = [];
                allResultsSnap.forEach(doc => {
                    const data = doc.data();
                    if (data.status === 'approved') {
                        approvedDocs.push(doc);
                    }
                });

                resultsSnap = {
                    empty: approvedDocs.length === 0,
                    size: approvedDocs.length,
                    forEach: callback => approvedDocs.forEach(callback),
                    docs: approvedDocs
                };
            }
        }
        else {
            displaySessionName = `${selectedSession} Session`;

            try {
                resultsSnap = await db.collection('results')
                    .where('pupilId', '==', currentPupilId)
                    .where('session', '==', selectedSession)
                    .where('status', '==', 'approved')
                    .get();

            } catch (error) {
                const allResultsSnap = await db.collection('results')
                    .where('pupilId', '==', currentPupilId)
                    .where('session', '==', selectedSession)
                    .get();

                const approvedDocs = [];
                allResultsSnap.forEach(doc => {
                    if (doc.data().status === 'approved') {
                        approvedDocs.push(doc);
                    }
                });

                resultsSnap = {
                    empty: approvedDocs.length === 0,
                    size: approvedDocs.length,
                    forEach: callback => approvedDocs.forEach(callback),
                    docs: approvedDocs
                };
            }
        }

        if (selectedSessionNameEl) {
            selectedSessionNameEl.textContent = displaySessionName;
        }

        if (sessionInfo) {
            sessionInfo.style.display = 'block';
        }

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

        container.innerHTML = '';

        if (pupilResults.length === 0) {
            container.innerHTML = `
                <div style="text-align:center; padding:40px 24px;">
                    <i data-lucide="inbox" style="width:36px;height:36px;margin:0 auto 12px;opacity:0.35;display:block;color:#64748b;"></i>
                    <p style="margin:0 0 4px; font-size:14px; font-weight:600; color:#475569;">
                        No approved results found for this session
                    </p>
                    <p style="margin:0; font-size:12.5px; color:#94a3b8;">
                        ${selectedSession === 'current'
                            ? 'Your teachers will upload and admin will approve scores soon.'
                            : 'No approved results available for this historical session.'}
                    </p>
                </div>`;
            if (typeof lucide !== 'undefined') lucide.createIcons();
            return;
        }

        const terms = {};
        pupilResults.forEach(r => {
            if (!terms[r.term]) terms[r.term] = [];
            terms[r.term].push(r);
        });

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
const caption = document.createElement('caption');
caption.className = 'visually-hidden';
caption.textContent = `${termName} results`;
table.appendChild(caption);
table.innerHTML += `
    <thead>
        <tr>
            <th scope="col">SUBJECT</th>
            <th scope="col">CA (40)</th>
            <th scope="col">EXAM (60)</th>
            <th scope="col">TOTAL (100)</th>
            <th scope="col">GRADE</th>
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

    } catch (error) {
        container.innerHTML = `
            <p style="text-align:center; color:var(--color-danger); padding:var(--space-2xl);">
                ⚠️ Unable to load results. Please try again.
            </p>`;
    }
}

window.loadSessionResults = loadSessionResults;

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

const style = document.createElement('style');
style.textContent = `
@keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}
`;
document.head.appendChild(style);

function scrollToFees() {
  const feeSection = document.getElementById('fee-balance-section');
  if (feeSection) {
    feeSection.style.display = 'block';
    feeSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.showToast?.('📊 Viewing fee balance', 'info', 2000);
  }
}

window.scrollToFees = scrollToFees;
