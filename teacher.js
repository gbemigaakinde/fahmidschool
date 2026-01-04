/**
 * FAHMID NURSERY & PRIMARY SCHOOL
 * Teacher Portal JavaScript
 *
 * Stabilized and Refactored Version
 *
 * @version 5.2.0
 * @date 2026-01-04
 */

'use strict';

let currentUser = null;

/* =========================
   AUTH INITIALIZATION
========================= */

checkRole('teacher')
    .then(user => {
        currentUser = user;
        const info = document.getElementById('teacher-info');
        if (info) {
            info.innerHTML = `Logged in as:<br><strong>${user.email}</strong>`;
        }
        initTeacherPortal();
    })
    .catch(() => {});

document.getElementById('teacher-logout')?.addEventListener('click', e => {
    e.preventDefault();
    logout();
});

/* =========================
   SECTION NAVIGATION
========================= */

const sectionLoaders = {
    dashboard: loadTeacherDashboard,
    'my-classes': loadClassesForTeacher,
    'enter-results': () => {
        loadClassesForResults();
        loadSubjectsForResults();
    },
    attendance: loadClassesForAttendance,
    'traits-skills': loadClassesForTraits,
    remarks: loadClassesForRemarks
};

function showSection(sectionId) {
    document.querySelectorAll('.admin-card').forEach(card => {
        card.style.display = 'none';
    });

    const section = document.getElementById(sectionId);
    if (section) section.style.display = 'block';

    document.querySelectorAll('.admin-sidebar a').forEach(link => {
        link.classList.toggle(
            'active',
            link.getAttribute('onclick')?.includes(`'${sectionId}'`)
        );
    });

    if (typeof sectionLoaders[sectionId] === 'function') {
        sectionLoaders[sectionId]();
    }

    const sidebar = document.getElementById('teacher-sidebar');
    const hamburger = document.getElementById('hamburger');
    if (sidebar?.classList.contains('active')) {
        sidebar.classList.remove('active');
        hamburger?.classList.remove('active');
    }
}

/* =========================
   INITIAL BOOTSTRAP
========================= */

function initTeacherPortal() {
    showSection('dashboard');
    console.log('✓ Teacher portal ready');
}

/* =========================
   DASHBOARD
========================= */

async function loadTeacherDashboard() {
    try {
        const classCount = document.getElementById('my-class-count');
        const pupilCount = document.getElementById('my-pupil-count');
        if (!classCount || !pupilCount) return;

        classCount.textContent = '...';
        pupilCount.textContent = '...';

        const [classesSnap, pupilsSnap] = await Promise.all([
            db.collection('classes').get(),
            db.collection('pupils').get()
        ]);

        classCount.textContent = classesSnap.size;
        pupilCount.textContent = pupilsSnap.size;
    } catch (err) {
        console.error(err);
        handleError(err, 'Failed to load dashboard statistics');
    }
}

/* =========================
   MY CLASSES
========================= */

async function loadClassesForTeacher() {
    const selector = document.getElementById('class-selector');
    if (!selector) return;

    selector.innerHTML = '<option value="">-- Select a Class --</option>';

    try {
        const snap = await db.collection('classes').get();
        const classes = snap.docs
            .map(d => ({ id: d.id, name: d.data().name }))
            .sort((a, b) => a.name.localeCompare(b.name));

        classes.forEach(cls => {
            const opt = document.createElement('option');
            opt.value = `${cls.id}|${cls.name}`;
            opt.textContent = cls.name;
            selector.appendChild(opt);
        });
    } catch (err) {
        handleError(err, 'Failed to load classes');
    }
}

async function loadPupilsInClass() {
    const selection = document.getElementById('class-selector')?.value;
    const tbody = document.querySelector('#pupils-in-class-table tbody');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (!selection) {
        tbody.innerHTML =
            '<tr><td colspan="3" style="text-align:center;">Select a class</td></tr>';
        return;
    }

    const [, className] = selection.split('|');

    try {
        const snap = await db.collection('pupils')
            .where('class', '==', className)
            .get();

        if (snap.empty) {
            tbody.innerHTML =
                '<tr><td colspan="3" style="text-align:center;">No pupils found</td></tr>';
            return;
        }

        snap.docs
            .map(d => d.data())
            .sort((a, b) => a.name.localeCompare(b.name))
            .forEach(pupil => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${pupil.name}</td>
                    <td>${pupil.gender || '-'}</td>
                    <td>${pupil.admissionNo || '-'}</td>
                `;
                tbody.appendChild(tr);
            });
    } catch (err) {
        handleError(err, 'Failed to load pupils');
    }
}

/* =========================
   RESULTS ENTRY
========================= */

async function loadClassesForResults() {
    populateClassSelector('result-class');
}

async function loadSubjectsForResults() {
    const selector = document.getElementById('result-subject');
    if (!selector) return;

    selector.innerHTML = '<option value="">-- Select Subject --</option>';

    try {
        const snap = await db.collection('subjects').get();
        const subjects = snap.empty
            ? ['English', 'Mathematics', 'Science', 'Social Studies']
            : snap.docs.map(d => d.data().name);

        subjects.sort().forEach(name => {
            const opt = document.createElement('option');
            opt.value = name;
            opt.textContent = name;
            selector.appendChild(opt);
        });
    } catch {
        ['English', 'Mathematics', 'Science'].forEach(name => {
            const opt = document.createElement('option');
            opt.value = name;
            opt.textContent = name;
            selector.appendChild(opt);
        });
    }
}

function populateClassSelector(id) {
    const selector = document.getElementById(id);
    if (!selector) return;

    selector.innerHTML = '<option value="">-- Select Class --</option>';

    db.collection('classes').get().then(snap => {
        snap.docs
            .map(d => ({ id: d.id, name: d.data().name }))
            .sort((a, b) => a.name.localeCompare(b.name))
            .forEach(cls => {
                const opt = document.createElement('option');
                opt.value = `${cls.id}|${cls.name}`;
                opt.textContent = cls.name;
                selector.appendChild(opt);
            });
    });
}

// ============================================
// ATTENDANCE - FIXED
// ============================================

async function loadClassesForAttendance() {
    const selector = document.getElementById('attendance-class');
    if (!selector) return;

    selector.innerHTML = '<option value="">-- Select Class --</option>';

    try {
        const snapshot = await db.collection('classes').get();
        
        const classes = [];
        snapshot.forEach(doc => {
            classes.push({ id: doc.id, name: doc.data().name });
        });
        
        classes.sort((a, b) => a.name.localeCompare(b.name));
        
        classes.forEach(classItem => {
            const opt = document.createElement('option');
            opt.value = `${classItem.id}|${classItem.name}`;
            opt.textContent = classItem.name;
            selector.appendChild(opt);
        });
    } catch (error) {
        console.error('Error loading classes for attendance:', error);
        handleError(error, 'Failed to load classes');
    }
}

async function loadAttendanceForm() {
    const selected = document.getElementById('attendance-class')?.value;
    const container = document.getElementById('attendance-form-container');
    const saveBtn = document.getElementById('save-attendance-btn');

    if (!container) return;

    if (!selected) {
        container.innerHTML = '';
        if (saveBtn) saveBtn.style.display = 'none';
        return;
    }

    const term = document.getElementById('attendance-term')?.value;

    if (!term) {
        container.innerHTML = '<p style="text-align:center; color:var(--color-gray-600);">Please select term</p>';
        if (saveBtn) saveBtn.style.display = 'none';
        return;
    }

    container.innerHTML = '<div class="skeleton-container"><div class="skeleton" style="height: 40px;"></div></div>';

    const [classId, className] = selected.split('|');

    try {
        const pupilsSnap = await db.collection('pupils')
            .where('class', '==', className)
            .get();

        if (pupilsSnap.empty) {
            container.innerHTML = '<p style="text-align:center; color:var(--color-gray-600);">No pupils in this class</p>';
            if (saveBtn) saveBtn.style.display = 'none';
            return;
        }

        // Get ALL attendance records for this term ONCE
        const pupilIds = [];
        pupilsSnap.forEach(doc => pupilIds.push(doc.id));

        // Firestore limitation: 'in' queries limited to 10 items
        // So we batch if needed
        const attendanceMap = {};
        
        if (pupilIds.length <= 10) {
            const attendanceSnap = await db.collection('attendance')
                .where(firebase.firestore.FieldPath.documentId(), 'in', 
                    pupilIds.map(id => `${id}_${term}`))
                .get();
            
            attendanceSnap.forEach(doc => {
                const data = doc.data();
                attendanceMap[data.pupilId] = data;
            });
        } else {
            // For >10 pupils, use Promise.all
            const chunks = [];
            for (let i = 0; i < pupilIds.length; i += 10) {
                chunks.push(pupilIds.slice(i, i + 10));
            }
            
            const results = await Promise.all(
                chunks.map(chunk => 
                    db.collection('attendance')
                        .where(firebase.firestore.FieldPath.documentId(), 'in', 
                            chunk.map(id => `${id}_${term}`))
                        .get()
                )
            );
            
            results.forEach(snap => {
                snap.forEach(doc => {
                    const data = doc.data();
                    attendanceMap[data.pupilId] = data;
                });
            });
        }

        const pupils = [];
        pupilsSnap.forEach(pupilDoc => {
            pupils.push({ id: pupilDoc.id, data: pupilDoc.data() });
        });
        
        pupils.sort((a, b) => a.data.name.localeCompare(b.data.name));

        let tableHTML = `
            <table class="responsive-table">
                <thead>
                    <tr>
                        <th>Pupil Name</th>
                        <th>Times Opened</th>
                        <th>Times Present</th>
                        <th>Times Absent</th>
                    </tr>
                </thead>
                <tbody>
        `;

        pupils.forEach(pupilItem => {
            const pupil = pupilItem.data;
            const pupilId = pupilItem.id;

            // Lookup from map (instant)
            const attendance = attendanceMap[pupilId] || {};
            const timesOpened = attendance.timesOpened || '';
            const timesPresent = attendance.timesPresent || '';
            const timesAbsent = attendance.timesAbsent || '';

            tableHTML += `
                <tr>
                    <td data-label="Pupil Name"><strong>${pupil.name}</strong></td>
                    <td data-label="Times Opened">
                        <input 
                            type="number" 
                            min="0" 
                            data-pupil="${pupilId}" 
                            data-field="timesOpened"
                            value="${timesOpened}"
                            placeholder="0"
                            style="width: 80px;"
                        >
                    </td>
                    <td data-label="Times Present">
                        <input 
                            type="number" 
                            min="0" 
                            data-pupil="${pupilId}" 
                            data-field="timesPresent"
                            value="${timesPresent}"
                            placeholder="0"
                            style="width: 80px;"
                        >
                    </td>
                    <td data-label="Times Absent">
                        <input 
                            type="number" 
                            min="0" 
                            data-pupil="${pupilId}" 
                            data-field="timesAbsent"
                            value="${timesAbsent}"
                            placeholder="0"
                            style="width: 80px;"
                        >
                    </td>
                </tr>
            `;
        });

        tableHTML += `</tbody></table>`;
        container.innerHTML = tableHTML;
        
        if (saveBtn) saveBtn.style.display = 'block';
        
        console.log('✓ Attendance form loaded successfully');
    } catch (error) {
        console.error('Error loading attendance form:', error);
        container.innerHTML = '<p style="text-align:center; color:var(--color-danger);">Error loading form</p>';
        handleError(error, 'Failed to load attendance form');
    }
}

async function saveAllAttendance() {
    const inputs = document.querySelectorAll('#attendance-form-container input[type="number"]');
    const term = document.getElementById('attendance-term')?.value;

    if (!inputs.length || !term) {
        window.showToast?.('Please select class and term', 'warning');
        return;
    }

    const batch = db.batch();
    let updatedCount = 0;

    try {
        const pupilData = {};

        inputs.forEach(input => {
            const pupilId = input.dataset.pupil;
            const field = input.dataset.field;
            const value = parseInt(input.value) || 0;

            if (!pupilData[pupilId]) {
                pupilData[pupilId] = {};
            }

            pupilData[pupilId][field] = value;
        });

        for (const [pupilId, data] of Object.entries(pupilData)) {
            const attendanceRef = db.collection('attendance').doc(`${pupilId}_${term}`);

            batch.set(attendanceRef, {
                pupilId,
                term,
                ...data,
                teacherId: currentUser?.uid || 'unknown',
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });

            updatedCount++;
        }

        await batch.commit();
        
        window.showToast?.(`✓ Attendance saved for ${updatedCount} pupil(s)`, 'success');
        
        console.log('✓ Attendance saved successfully');
    } catch (error) {
        console.error('Error saving attendance:', error);
        handleError(error, 'Failed to save attendance. Check Firestore rules.');
    }
}

// ============================================
// TRAITS & SKILLS - FIXED
// ============================================

async function loadClassesForTraits() {
    const selector = document.getElementById('traits-class');
    if (!selector) return;
    
    selector.innerHTML = '<option value="">-- Select Class --</option>';
    
    try {
        const snapshot = await db.collection('classes').get();
        
        const classes = [];
        snapshot.forEach(doc => {  // ← Fixed: removed extra space
            classes.push({ id: doc.id, name: doc.data().name });
        });
        
        classes.sort((a, b) => a.name.localeCompare(b.name));
        
        classes.forEach(classItem => {
            const opt = document.createElement('option');
            opt.value = `${classItem.id}|${classItem.name}`;
            opt.textContent = classItem.name;
            selector.appendChild(opt);
        });
    } catch (error) {
        console.error('Error loading classes for traits:', error);
        handleError(error, 'Failed to load classes');
    }
}

async function loadTraitsForm() {
    const selected = document.getElementById('traits-class')?.value;
    const pupilSelector = document.getElementById('traits-pupil');
    const container = document.getElementById('traits-form-container');

    if (!pupilSelector) return;

    pupilSelector.innerHTML = '<option value="">-- Select Pupil --</option>';

    if (!selected) {
        if (container) container.style.display = 'none';
        return;
    }

    const [classId, className] = selected.split('|');

    try {
        const pupilsSnap = await db.collection('pupils')
            .where('class', '==', className)
            .get();

        const pupils = [];
        pupilsSnap.forEach(doc => {
            pupils.push({ id: doc.id, data: doc.data() });
        });
        
        pupils.sort((a, b) => a.data.name.localeCompare(b.data.name));

        pupils.forEach(pupil => {
            const opt = document.createElement('option');
            opt.value = pupil.id;
            opt.textContent = pupil.data.name;
            pupilSelector.appendChild(opt);
        });
        
        console.log('✓ Traits form pupils loaded');
    } catch (error) {
        console.error('Error loading pupils for traits:', error);
        handleError(error, 'Failed to load pupils');
    }
}

async function loadTraitsData() {
    const pupilId = document.getElementById('traits-pupil')?.value;
    const term = document.getElementById('traits-term')?.value;
    const container = document.getElementById('traits-form-container');

    if (!container) return;

    if (!pupilId || !term) {
        container.style.display = 'none';
        return;
    }

    container.style.display = 'block';

    try {
        // Load behavioral traits
        try {
            const traitsDoc = await db.collection('behavioral_traits')
                .doc(`${pupilId}_${term}`)
                .get();

            if (traitsDoc.exists) {
                const data = traitsDoc.data();
                document.getElementById('trait-punctuality').value = data.punctuality || '';
                document.getElementById('trait-neatness').value = data.neatness || '';
                document.getElementById('trait-politeness').value = data.politeness || '';
                document.getElementById('trait-honesty').value = data.honesty || '';
                document.getElementById('trait-obedience').value = data.obedience || '';
                document.getElementById('trait-cooperation').value = data.cooperation || '';
                document.getElementById('trait-attentiveness').value = data.attentiveness || '';
                document.getElementById('trait-leadership').value = data.leadership || '';
                document.getElementById('trait-selfcontrol').value = data.selfcontrol || '';
                document.getElementById('trait-creativity').value = data.creativity || '';
            } else {
                // Reset form
                ['punctuality', 'neatness', 'politeness', 'honesty', 'obedience', 'cooperation', 
                 'attentiveness', 'leadership', 'selfcontrol', 'creativity'].forEach(trait => {
                    document.getElementById(`trait-${trait}`).value = '';
                });
            }
        } catch (error) {
            console.warn('Error loading behavioral traits:', error);
            // Reset form on error
            ['punctuality', 'neatness', 'politeness', 'honesty', 'obedience', 'cooperation', 
             'attentiveness', 'leadership', 'selfcontrol', 'creativity'].forEach(trait => {
                document.getElementById(`trait-${trait}`).value = '';
            });
        }

        // Load psychomotor skills
        try {
            const skillsDoc = await db.collection('psychomotor_skills')
                .doc(`${pupilId}_${term}`)
                .get();

            if (skillsDoc.exists) {
                const data = skillsDoc.data();
                document.getElementById('skill-handwriting').value = data.handwriting || '';
                document.getElementById('skill-drawing').value = data.drawing || '';
                document.getElementById('skill-sports').value = data.sports || '';
                document.getElementById('skill-craft').value = data.craft || '';
                document.getElementById('skill-verbal').value = data.verbal || '';
                document.getElementById('skill-coordination').value = data.coordination || '';
            } else {
                // Reset form
                ['handwriting', 'drawing', 'sports', 'craft', 'verbal', 'coordination'].forEach(skill => {
                    document.getElementById(`skill-${skill}`).value = '';
                });
            }
        } catch (error) {
            console.warn('Error loading psychomotor skills:', error);
            // Reset form on error
            ['handwriting', 'drawing', 'sports', 'craft', 'verbal', 'coordination'].forEach(skill => {
                document.getElementById(`skill-${skill}`).value = '';
            });
        }
        
        console.log('✓ Traits data loaded successfully');
    } catch (error) {
        console.error('Error loading traits data:', error);
        handleError(error, 'Failed to load traits data');
    }
}

async function saveTraitsAndSkills() {
    const pupilId = document.getElementById('traits-pupil')?.value;
    const term = document.getElementById('traits-term')?.value;

    if (!pupilId || !term) {
        window.showToast?.('Please select class, term, and pupil', 'warning');
        return;
    }

    try {
        // Save behavioral traits
        const traitsData = {
            pupilId,
            term,
            punctuality: document.getElementById('trait-punctuality').value,
            neatness: document.getElementById('trait-neatness').value,
            politeness: document.getElementById('trait-politeness').value,
            honesty: document.getElementById('trait-honesty').value,
            obedience: document.getElementById('trait-obedience').value,
            cooperation: document.getElementById('trait-cooperation').value,
            attentiveness: document.getElementById('trait-attentiveness').value,
            leadership: document.getElementById('trait-leadership').value,
            selfcontrol: document.getElementById('trait-selfcontrol').value,
            creativity: document.getElementById('trait-creativity').value,
            teacherId: currentUser?.uid || 'unknown',
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        await db.collection('behavioral_traits').doc(`${pupilId}_${term}`).set(traitsData, { merge: true });

        // Save psychomotor skills
        const skillsData = {
            pupilId,
            term,
            handwriting: document.getElementById('skill-handwriting').value,
            drawing: document.getElementById('skill-drawing').value,
            sports: document.getElementById('skill-sports').value,
            craft: document.getElementById('skill-craft').value,
            verbal: document.getElementById('skill-verbal').value,
            coordination: document.getElementById('skill-coordination').value,
            teacherId: currentUser?.uid || 'unknown',
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        await db.collection('psychomotor_skills').doc(`${pupilId}_${term}`).set(skillsData, { merge: true });

        window.showToast?.('✓ Traits and skills saved successfully', 'success');
        
        console.log('✓ Traits and skills saved');
    } catch (error) {
        console.error('Error saving traits and skills:', error);
        handleError(error, 'Failed to save traits and skills. Check Firestore rules.');
    }
}

// ============================================
// REMARKS - FIXED
// ============================================

async function loadClassesForRemarks() {
    const selector = document.getElementById('remarks-class');
    if (!selector) return;

    selector.innerHTML = '<option value="">-- Select Class --</option>';

    try {
        const snapshot = await db.collection('classes').get();
        
        const classes = [];
        snapshot.forEach(doc => {
            classes.push({ id: doc.id, name: doc.data().name });
        });
        
        classes.sort((a, b) => a.name.localeCompare(b.name));
        
        classes.forEach(classItem => {
            const opt = document.createElement('option');
            opt.value = `${classItem.id}|${classItem.name}`;
            opt.textContent = classItem.name;
            selector.appendChild(opt);
        });
    } catch (error) {
        console.error('Error loading classes for remarks:', error);
        handleError(error, 'Failed to load classes');
    }
}

async function loadRemarksForm() {
    const selected = document.getElementById('remarks-class')?.value;
    const pupilSelector = document.getElementById('remarks-pupil');
    const container = document.getElementById('remarks-form-container');

    if (!pupilSelector) return;

    pupilSelector.innerHTML = '<option value="">-- Select Pupil --</option>';

    if (!selected) {
        if (container) container.style.display = 'none';
        return;
    }

    const [classId, className] = selected.split('|');

    try {
        const pupilsSnap = await db.collection('pupils')
            .where('class', '==', className)
            .get();

        const pupils = [];
        pupilsSnap.forEach(doc => {
            pupils.push({ id: doc.id, data: doc.data() });
        });
        
        pupils.sort((a, b) => a.data.name.localeCompare(b.data.name));

        pupils.forEach(pupil => {
            const opt = document.createElement('option');
            opt.value = pupil.id;
            opt.textContent = pupil.data.name;
            pupilSelector.appendChild(opt);
        });
        
        console.log('✓ Remarks form pupils loaded');
    } catch (error) {
        console.error('Error loading pupils for remarks:', error);
        handleError(error, 'Failed to load pupils');
    }
}

async function loadRemarksData() {
    const pupilId = document.getElementById('remarks-pupil')?.value;
    const term = document.getElementById('remarks-term')?.value;
    const container = document.getElementById('remarks-form-container');

    if (!container) return;

    if (!pupilId || !term) {
        container.style.display = 'none';
        return;
    }

    container.style.display = 'block';

    try {
        const remarksDoc = await db.collection('remarks')
            .doc(`${pupilId}_${term}`)
            .get();

        if (remarksDoc.exists) {
            const data = remarksDoc.data();
            document.getElementById('teacher-remark').value = data.teacherRemark || '';
        } else {
            document.getElementById('teacher-remark').value = '';
        }
        
        console.log('✓ Remarks data loaded successfully');
    } catch (error) {
        console.error('Error loading remarks data:', error);
        document.getElementById('teacher-remark').value = '';
        handleError(error, 'Failed to load remarks data');
    }
}

async function saveRemarks() {
    const pupilId = document.getElementById('remarks-pupil')?.value;
    const term = document.getElementById('remarks-term')?.value;
    const teacherRemark = document.getElementById('teacher-remark')?.value.trim();

    if (!pupilId || !term) {
        window.showToast?.('Please select class, term, and pupil', 'warning');
        return;
    }

    if (!teacherRemark) {
        window.showToast?.('Please enter a remark', 'warning');
        return;
    }

    try {
        await db.collection('remarks').doc(`${pupilId}_${term}`).set({
            pupilId,
            term,
            teacherRemark,
            teacherId: currentUser?.uid || 'unknown',
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        window.showToast?.('✓ Remark saved successfully', 'success');
        
        console.log('✓ Remark saved successfully');
    } catch (error) {
        console.error('Error saving remarks:', error);
        handleError(error, 'Failed to save remark. Check Firestore rules.');
    }
}

// ============================================
// PAGE LOAD
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('✓ Teacher JS loaded');
});
