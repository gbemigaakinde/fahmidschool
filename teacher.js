/**
 * FAHMID NURSERY & PRIMARY SCHOOL
 * Teacher Portal JavaScript
 *
 * Fully Stabilized Version
 *
 * @version 5.3.0
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
        if (info) info.innerHTML = `Logged in as:<br><strong>${user.email}</strong>`;
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
    'my-classes': () => {
        loadClassesForTeacher();
    },
    'enter-results': () => {
        populateClassSelector('result-class');
        loadSubjectsForResults();
    },
    attendance: () => {
        populateClassSelector('attendance-class');
    },
    'traits-skills': () => {
        populateClassSelector('traits-class');
    },
    remarks: () => {
        populateClassSelector('remarks-class');
    }
};

function showSection(sectionId) {
    document.querySelectorAll('.admin-card').forEach(card => card.style.display = 'none');
    const section = document.getElementById(sectionId);
    if (section) section.style.display = 'block';

    document.querySelectorAll('.admin-sidebar a[data-section]').forEach(link => {
        link.classList.toggle('active', link.dataset.section === sectionId);
    });

    if (typeof sectionLoaders[sectionId] === 'function') sectionLoaders[sectionId]();

    const sidebar = document.getElementById('teacher-sidebar');
    const hamburger = document.getElementById('hamburger');
    if (sidebar?.classList.contains('active')) {
        sidebar.classList.remove('active');
        hamburger?.classList.remove('active');
        hamburger?.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
    }
}

/* =========================
   INITIAL BOOTSTRAP
========================= */

function initTeacherPortal() {
    showSection('dashboard');
    console.log('✓ Teacher portal ready');

    // Sidebar link click listener
    document.querySelectorAll('.admin-sidebar a[data-section]').forEach(link => {
        link.addEventListener('click', e => {
            e.preventDefault();
            const section = link.dataset.section;
            if (section) showSection(section);
        });
    });
}

/* =========================
   DASHBOARD
========================= */

async function loadTeacherDashboard() {
    try {
        const classCount = document.getElementById('my-class-count');
        const pupilCount = document.getElementById('my-pupil-count');
        if (!classCount || !pupilCount) return;

        const [classesSnap, pupilsSnap] = await Promise.all([
            db.collection('classes').get(),
            db.collection('pupils').get()
        ]);

        classCount.textContent = classesSnap.size;
        pupilCount.textContent = pupilsSnap.size;
    } catch (err) {
        handleError(err, 'Failed to load dashboard statistics');
    }
}

/* =========================
   HELPER: POPULATE CLASS SELECTORS
========================= */

async function populateClassSelector(id) {
    const selector = document.getElementById(id);
    if (!selector) return;
    selector.innerHTML = '<option value="">-- Select Class --</option>';

    try {
        const snap = await db.collection('classes').get();
        snap.docs
            .map(d => ({ id: d.id, name: d.data().name }))
            .sort((a, b) => a.name.localeCompare(b.name))
            .forEach(cls => {
                const opt = document.createElement('option');
                opt.value = `${cls.id}|${cls.name}`;
                opt.textContent = cls.name;
                selector.appendChild(opt);
            });
    } catch (err) {
        handleError(err, 'Failed to load classes');
    }
}

/* =========================
   MY CLASSES
========================= */

async function loadClassesForTeacher() {
    const selector = document.getElementById('class-selector');
    if (!selector) return;

    await populateClassSelector('class-selector');

    selector.addEventListener('change', loadPupilsInClass);
}

async function loadPupilsInClass() {
    const selection = document.getElementById('class-selector')?.value;
    const tbody = document.querySelector('#pupils-in-class-table tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!selection) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">Select a class</td></tr>';
        return;
    }

    const [, className] = selection.split('|');

    try {
        const snap = await db.collection('pupils').where('class', '==', className).get();
        if (snap.empty) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">No pupils found</td></tr>';
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

/* =========================
   ATTENDANCE
========================= */

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

    const [, className] = selected.split('|');
    const term = document.getElementById('attendance-term')?.value || 'Term1';

    try {
        const pupilsSnap = await db.collection('pupils').where('class', '==', className).get();
        if (pupilsSnap.empty) {
            container.innerHTML = '<p style="text-align:center; color:var(--color-gray-600);">No pupils in this class</p>';
            if (saveBtn) saveBtn.style.display = 'none';
            return;
        }

        const pupils = pupilsSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.name.localeCompare(b.name));
        let html = '<table class="responsive-table"><thead><tr><th>Pupil Name</th><th>Times Opened</th><th>Times Present</th><th>Times Absent</th></tr></thead><tbody>';

        pupils.forEach(p => {
            html += `<tr>
                <td>${p.name}</td>
                <td><input type="number" min="0" data-pupil="${p.id}" data-field="timesOpened" value="" placeholder="0" style="width:80px;"></td>
                <td><input type="number" min="0" data-pupil="${p.id}" data-field="timesPresent" value="" placeholder="0" style="width:80px;"></td>
                <td><input type="number" min="0" data-pupil="${p.id}" data-field="timesAbsent" value="" placeholder="0" style="width:80px;"></td>
            </tr>`;
        });

        html += '</tbody></table>';
        container.innerHTML = html;
        if (saveBtn) saveBtn.style.display = 'block';
    } catch (err) {
        handleError(err, 'Failed to load attendance form');
        container.innerHTML = '<p style="text-align:center; color:var(--color-danger);">Error loading form</p>';
    }
}

async function saveAllAttendance() {
    const inputs = document.querySelectorAll('#attendance-form-container input[type="number"]');
    const term = document.getElementById('attendance-term')?.value;
    if (!inputs.length || !term) return window.showToast?.('Please select class and term', 'warning');

    const batch = db.batch();
    try {
        const pupilData = {};
        inputs.forEach(input => {
            const pupilId = input.dataset.pupil;
            const field = input.dataset.field;
            const value = parseInt(input.value) || 0;
            if (!pupilData[pupilId]) pupilData[pupilId] = {};
            pupilData[pupilId][field] = value;
        });

        for (const [pupilId, data] of Object.entries(pupilData)) {
            const ref = db.collection('attendance').doc(`${pupilId}_${term}`);
            batch.set(ref, { pupilId, term, teacherId: currentUser?.uid || 'unknown', ...data, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
        }

        await batch.commit();
        window.showToast?.('✓ Attendance saved successfully', 'success');
    } catch (err) {
        handleError(err, 'Failed to save attendance');
    }
}

/* =========================
   TRAITS & SKILLS
========================= */

async function loadTraitsForm() {
    const selected = document.getElementById('traits-class')?.value;
    const pupilSelector = document.getElementById('traits-pupil');
    if (!pupilSelector) return;
    pupilSelector.innerHTML = '<option value="">-- Select Pupil --</option>';
    if (!selected) return showTraitSection(false);

    const [, className] = selected.split('|');

    try {
        const snap = await db.collection('pupils').where('class', '==', className).get();
        snap.docs.sort((a, b) => a.data().name.localeCompare(b.data().name)).forEach(doc => {
            const opt = document.createElement('option');
            opt.value = doc.id;
            opt.textContent = doc.data().name;
            pupilSelector.appendChild(opt);
        });
        showTraitSection(true);
    } catch (err) {
        handleError(err, 'Failed to load pupils for traits');
    }
}

async function loadTraitsData() {
    const pupilId = document.getElementById('traits-pupil')?.value;
    const term = document.getElementById('traits-term')?.value;
    if (!pupilId || !term) return showTraitSection(false);

    const traitFields = ['punctuality','neatness','politeness','honesty','obedience','cooperation','attentiveness','leadership','selfcontrol','creativity'];
    const skillFields = ['handwriting','drawing','sports','craft','verbal','coordination'];

    try {
        const traitsDoc = await db.collection('behavioral_traits').doc(`${pupilId}_${term}`).get();
        traitFields.forEach(f => document.getElementById(`trait-${f}`).value = traitsDoc.exists ? traitsDoc.data()[f] || '' : '');

        const skillsDoc = await db.collection('psychomotor_skills').doc(`${pupilId}_${term}`).get();
        skillFields.forEach(f => document.getElementById(`skill-${f}`).value = skillsDoc.exists ? skillsDoc.data()[f] || '' : '');
    } catch (err) {
        handleError(err, 'Failed to load traits and skills');
    }
}

async function saveTraitsAndSkills() {
    const pupilId = document.getElementById('traits-pupil')?.value;
    const term = document.getElementById('traits-term')?.value;
    if (!pupilId || !term) return window.showToast?.('Select pupil and term', 'warning');

    const traitsData = {
        pupilId, term, teacherId: currentUser?.uid || 'unknown',
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
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    const skillsData = {
        pupilId, term, teacherId: currentUser?.uid || 'unknown',
        handwriting: document.getElementById('skill-handwriting').value,
        drawing: document.getElementById('skill-drawing').value,
        sports: document.getElementById('skill-sports').value,
        craft: document.getElementById('skill-craft').value,
        verbal: document.getElementById('skill-verbal').value,
        coordination: document.getElementById('skill-coordination').value,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
        await db.collection('behavioral_traits').doc(`${pupilId}_${term}`).set(traitsData, { merge: true });
        await db.collection('psychomotor_skills').doc(`${pupilId}_${term}`).set(skillsData, { merge: true });
        window.showToast?.('✓ Traits and skills saved', 'success');
    } catch (err) {
        handleError(err, 'Failed to save traits and skills');
    }
}

function showTraitSection(show = true) {
    const container = document.getElementById('traits-form-container');
    if (!container) return;
    container.classList.toggle('is-hidden', !show);
}

/* =========================
   REMARKS
========================= */

async function loadRemarksForm() {
    const selected = document.getElementById('remarks-class')?.value;
    const pupilSelector = document.getElementById('remarks-pupil');
    if (!pupilSelector) return;

    pupilSelector.innerHTML = '<option value="">-- Select Pupil --</option>';
    if (!selected) return;

    const [, className] = selected.split('|');

    try {
        const snap = await db.collection('pupils').where('class', '==', className).get();
        snap.docs.sort((a, b) => a.data().name.localeCompare(b.data().name)).forEach(doc => {
            const opt = document.createElement('option');
            opt.value = doc.id;
            opt.textContent = doc.data().name;
            pupilSelector.appendChild(opt);
        });
    } catch (err) {
        handleError(err, 'Failed to load pupils for remarks');
    }
}

async function loadRemarksData() {
    const pupilId = document.getElementById('remarks-pupil')?.value;
    const term = document.getElementById('remarks-term')?.value;
    const container = document.getElementById('remarks-form-container');
    if (!container || !pupilId || !term) return container.style.display = 'none';

    try {
        const doc = await db.collection('remarks').doc(`${pupilId}_${term}`).get();
        document.getElementById('teacher-remark').value = doc.exists ? doc.data().teacherRemark || '' : '';
        container.style.display = 'block';
    } catch (err) {
        handleError(err, 'Failed to load remarks');
    }
}

async function saveRemarks() {
    const pupilId = document.getElementById('remarks-pupil')?.value;
    const term = document.getElementById('remarks-term')?.value;
    const remark = document.getElementById('teacher-remark')?.value.trim();
    if (!pupilId || !term) return window.showToast?.('Select pupil and term', 'warning');
    if (!remark) return window.showToast?.('Enter a remark', 'warning');

    try {
        await db.collection('remarks').doc(`${pupilId}_${term}`).set({
            pupilId, term, teacherRemark: remark,
            teacherId: currentUser?.uid || 'unknown',
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        window.showToast?.('✓ Remark saved', 'success');
    } catch (err) {
        handleError(err, 'Failed to save remark');
    }
}

/* =========================
   PAGE LOAD
========================= */

document.addEventListener('DOMContentLoaded', () => {
    console.log('✓ Teacher JS loaded');
});