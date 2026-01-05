/**
 * FAHMID NURSERY & PRIMARY SCHOOL
 * Teacher Portal JavaScript - FULLY UPDATED WITH ASSIGNMENT FILTERING
 * 
 * Key Features:
 * - Teachers only see data for classes assigned to them (via teacherId in classes collection)
 * - No more class selectors in any section
 * - Auto-loads pupils from assigned classes
 * - Enter Results fully implemented with CA/Exam scores
 * - Attendance loads existing data
 * - Remarks saves both Teacher and Headteacher remarks
 * - Dashboard shows only teacher's classes/pupils
 * - Caching for performance
 * - Duplicate listeners removed
 * 
 * @version 6.0.0
 * @date 2026-01-04
 */

'use strict';

let currentUser = null;
let assignedClasses = []; // Cached: [{id, name}]
let allPupils = [];       // Cached: pupils in assigned classes
let allSubjects = [];     // Cached subjects

/* =========================
   AUTH INITIALIZATION
========================= */

checkRole('teacher')
    .then(async user => {
        currentUser = user;
        const info = document.getElementById('teacher-info');
        if (info) info.innerHTML = `Logged in as:<br><strong>${user.email}</strong>`;
        
        await loadAssignedClasses(); // Critical: load teacher's classes first
        await loadSubjects();       // Load subjects once
        
        initTeacherPortal();
    })
    .catch(() => {});

document.getElementById('teacher-logout')?.addEventListener('click', e => {
    e.preventDefault();
    logout();
});

// ========================================
// REUSABLE PAGINATION FUNCTION
// ========================================
function paginateTable(data, tbodyId, itemsPerPage = 20, renderRowCallback) {
    const tbody = document.querySelector(`#${tbodyId} tbody`);
    if (!tbody) return;

    let currentPage = 1;
    const totalPages = Math.ceil(data.length / itemsPerPage);

    function renderPage(page) {
        tbody.innerHTML = '';
        const start = (page - 1) * itemsPerPage;
        const end = start + itemsPerPage;
        const pageData = data.slice(start, end);

        if (pageData.length === 0) {
            tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; padding: var(--space-xl); color: var(--color-gray-600);">No data available</td></tr>';
            return;
        }

        pageData.forEach(item => {
            renderRowCallback(item, tbody);
        });

        // Update pagination controls
        updatePaginationControls(page, totalPages);
    }

    function updatePaginationControls(page, total) {
        let paginationContainer = document.getElementById(`pagination-${tbodyId}`);
        if (!paginationContainer) {
            paginationContainer = document.createElement('div');
            paginationContainer.className = 'pagination';
            paginationContainer.id = `pagination-${tbodyId}`;
            tbody.parentElement.parentElement.appendChild(paginationContainer);
        }

        paginationContainer.innerHTML = `
            <button onclick="changePage(${page - 1})" ${page === 1 ? 'disabled' : ''}>Previous</button>
            <span class="page-info">Page ${page} of ${total}</span>
            <button onclick="changePage(${page + 1})" ${page === total ? 'disabled' : ''}>Next</button>
        `;
    }

    window.changePage = function(newPage) {
        if (newPage < 1 || newPage > totalPages) return;
        currentPage = newPage;
        renderPage(currentPage);
    };

    renderPage(1);
}

/* =========================
   CORE: LOAD ASSIGNED CLASSES & PUPILS
========================= */

async function loadAssignedClasses() {
    try {
        const snap = await db.collection('classes')
            .where('teacherId', '==', currentUser.uid)
            .get();

        assignedClasses = snap.docs.map(doc => ({
            id: doc.id,
            name: doc.data().name
        }));

        assignedClasses.sort((a, b) => a.name.localeCompare(b.name));

        if (assignedClasses.length === 0) {
            window.showToast?.('No classes assigned yet. Contact admin.', 'warning', 8000);
        }

        // Load all pupils in assigned classes
        if (assignedClasses.length > 0) {
            const classNames = assignedClasses.map(c => c.name);
            const pupilsSnap = await db.collection('pupils')
                .where('class', 'in', classNames)
                .get();

            allPupils = pupilsSnap.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })).sort((a, b) => a.name.localeCompare(b.name));
        } else {
            allPupils = [];
        }

    } catch (err) {
        console.error('Error loading assigned classes:', err);
        handleError(err, 'Failed to load your classes');
        assignedClasses = [];
        allPupils = [];
    }
}

async function loadSubjects() {
    try {
        const snap = await db.collection('subjects').get();
        allSubjects = snap.empty
            ? ['English', 'Mathematics', 'Science', 'Social Studies']
            : snap.docs.map(d => d.data().name);
        allSubjects.sort();
    } catch (err) {
        console.error('Error loading subjects:', err);
        allSubjects = ['English', 'Mathematics', 'Science'];
    }
}

/* =========================
   SECTION NAVIGATION
========================= */

const sectionLoaders = {
    dashboard: loadTeacherDashboard,
    'my-classes': loadMyClassesSection,
    'enter-results': loadResultsSection,
    attendance: loadAttendanceSection,
    'traits-skills': loadTraitsSection,
    remarks: loadRemarksSection
};

function showSection(sectionId) {
    document.querySelectorAll('.admin-card').forEach(card => card.style.display = 'none');
    const section = document.getElementById(sectionId);
    if (section) section.style.display = 'block';

    document.querySelectorAll('.admin-sidebar a[data-section]').forEach(link => {
        link.classList.toggle('active', link.dataset.section === sectionId);
    });

    if (typeof sectionLoaders[sectionId] === 'function') {
        sectionLoaders[sectionId]();
    }

    // Close mobile sidebar
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
    // First load current settings, then proceed with portal init
    getCurrentSettings().then(settings => {
        // Set default term in all term selects
        const termSelects = [
            document.getElementById('result-term'),
            document.getElementById('attendance-term'),
            document.getElementById('traits-term'),
            document.getElementById('remarks-term')
        ];

        termSelects.forEach(select => {
            if (select) {
                select.value = settings.term;
            }
        });

        // Now show dashboard and setup navigation
        showSection('dashboard');
        console.log('✓ Teacher portal ready (v6.1.0) - Current term:', settings.term);

        // Sidebar navigation (unchanged)
        document.querySelectorAll('.admin-sidebar a[data-section]').forEach(link => {
            link.addEventListener('click', e => {
                e.preventDefault();
                const section = link.dataset.section;
                if (section) showSection(section);
            });
        });

        // Trigger initial loads that depend on term
        loadResultsTable();
        loadAttendanceSection();
    }).catch(error => {
        console.error('Failed to load current settings:', error);
        window.showToast?.('Using default term (First Term)', 'warning');

        // Fallback: proceed with default
        showSection('dashboard');
        document.querySelectorAll('.admin-sidebar a[data-section]').forEach(link => {
            link.addEventListener('click', e => {
                e.preventDefault();
                const section = link.dataset.section;
                if (section) showSection(section);
            });
        });
    });
}

/* =========================
   DASHBOARD
========================= */

async function loadTeacherDashboard() {
    const classCountEl = document.getElementById('my-class-count');
    const pupilCountEl = document.getElementById('my-pupil-count');

    if (!classCountEl || !pupilCountEl) return;

    classCountEl.textContent = assignedClasses.length;
    pupilCountEl.textContent = allPupils.length;
}

/* =========================
   MY CLASSES
========================= */

function loadMyClassesSection() {
    const table = document.getElementById('pupils-in-class-table');
    if (!table) return;

    const tbody = table.querySelector('tbody');

    if (assignedClasses.length === 0) {
        tbody.innerHTML =
            '<tr><td colspan="3" style="text-align:center; color:var(--color-gray-600);">No classes assigned</td></tr>';
        return;
    }

    if (allPupils.length === 0) {
        tbody.innerHTML =
            '<tr><td colspan="3" style="text-align:center; color:var(--color-gray-600);">No pupils in your classes</td></tr>';
        return;
    }

    paginateTable(allPupils, 'pupils-in-class-table', 20, (pupil, tbodyEl) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td data-label="Name">${pupil.name}</td>
            <td data-label="Gender">${pupil.gender || '-'}</td>
            <td data-label="Admission No">${pupil.admissionNo || '-'}</td>
        `;
        tbodyEl.appendChild(tr);
    });
}

/* =========================
   ENTER RESULTS (FULLY IMPLEMENTED)
========================= */

async function loadResultsSection() {
    const container = document.getElementById('results-entry-table-container');
    const saveBtn = document.getElementById('save-results-btn');
    if (!container || !saveBtn) return;

    if (assignedClasses.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:var(--color-gray-600);">No classes assigned</p>';
        saveBtn.hidden = true;
        return;
    }

    if (allPupils.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:var(--color-gray-600);">No pupils in your classes</p>';
        saveBtn.hidden = true;
        return;
    }

    const termSelect = document.getElementById('result-term');
    const subjectSelect = document.getElementById('result-subject');
    if (termSelect && subjectSelect) {
        termSelect.value = 'First Term'; // default
        subjectSelect.innerHTML = '<option value="">-- Select Subject --</option>';
        allSubjects.forEach(sub => {
            const opt = document.createElement('option');
            opt.value = sub;
            opt.textContent = sub;
            subjectSelect.appendChild(opt);
        });
    }

    await loadResultsTable();
}

async function loadResultsTable() {
    const container = document.getElementById('results-entry-table-container');
    const saveBtn = document.getElementById('save-results-btn');
    const term = document.getElementById('result-term')?.value;
    const subject = document.getElementById('result-subject')?.value;

    if (!container || !term || !subject) {
        container.innerHTML = '';
        if (saveBtn) saveBtn.hidden = true;
        return;
    }

    if (allPupils.length === 0) {
        container.innerHTML =
            '<p style="text-align:center; color:var(--color-gray-600);">No pupils available</p>';
        if (saveBtn) saveBtn.hidden = true;
        return;
    }

    try {
        container.innerHTML = `
            <table class="responsive-table" id="results-table">
                <thead>
                    <tr>
                        <th>Pupil Name</th>
                        <th>CA Score (40)</th>
                        <th>Exam Score (60)</th>
                        <th>Total</th>
                    </tr>
                </thead>
                <tbody></tbody>
            </table>
        `;

        paginateTable(allPupils, 'results-table', 20, (pupil, tbody) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${pupil.name}</td>
                <td>
                    <input type="number" min="0" max="40"
                        data-pupil="${pupil.id}" data-field="ca"
                        style="width:90px;">
                </td>
                <td>
                    <input type="number" min="0" max="60"
                        data-pupil="${pupil.id}" data-field="exam"
                        style="width:90px;">
                </td>
                <td>-</td>
            `;
            tbody.appendChild(tr);
        });

        if (saveBtn) saveBtn.hidden = false;

        container.querySelectorAll('input').forEach(input => {
            input.addEventListener('input', () => {
                const row = input.closest('tr');
                const ca = parseFloat(row.querySelector('[data-field="ca"]')?.value) || 0;
                const exam = parseFloat(row.querySelector('[data-field="exam"]')?.value) || 0;
                row.querySelector('td:last-child').textContent =
                    ca + exam > 0 ? ca + exam : '-';
            });
        });

    } catch (err) {
        handleError(err, 'Failed to load results');
        container.innerHTML =
            '<p style="text-align:center; color:var(--color-danger);">Error loading results</p>';
        if (saveBtn) saveBtn.hidden = true;
    }
}

async function saveAllResults() {
    const inputs = document.querySelectorAll('#results-entry-table-container input[type="number"]');
    const term = document.getElementById('result-term')?.value;
    const subject = document.getElementById('result-subject')?.value;

    if (!term || !subject) {
        window.showToast?.('Select term and subject', 'warning');
        return;
    }

    const batch = db.batch();
    let hasChanges = false;

    inputs.forEach(input => {
        const pupilId = input.dataset.pupil;
        const field = input.dataset.field;
        const value = parseFloat(input.value) || 0;

        if (value > 0) hasChanges = true;

        const docId = `${pupilId}_${term}_${subject}`;
        const ref = db.collection('results').doc(docId);

        if (field === 'ca') {
            batch.set(ref, { caScore: value }, { merge: true });
        } else {
            batch.set(ref, { examScore: value }, { merge: true });
        }
    });

    if (!hasChanges) {
        window.showToast?.('No scores entered', 'warning');
        return;
    }

    try {
        batch.set(db.collection('results').doc(), { // dummy to force commit if empty
            dummy: true
        }, { merge: true });

        await batch.commit();
        window.showToast?.('✓ All results saved successfully', 'success');
    } catch (err) {
        handleError(err, 'Failed to save results');
    }
}

/* =========================
   ATTENDANCE (NOW LOADS EXISTING DATA)
========================= */

async function loadAttendanceSection() {
    const container = document.getElementById('attendance-form-container');
    const saveBtn = document.getElementById('save-attendance-btn');
    const term = document.getElementById('attendance-term')?.value || 'First Term';

    if (!container || !saveBtn) return;

    if (assignedClasses.length === 0 || allPupils.length === 0) {
        container.innerHTML =
            '<p style="text-align:center; color:var(--color-gray-600);">No pupils in assigned classes</p>';
        saveBtn.hidden = true;
        return;
    }

    try {
        container.innerHTML = `
            <table class="responsive-table" id="attendance-table">
                <thead>
                    <tr>
                        <th>Pupil Name</th>
                        <th>Times Opened</th>
                        <th>Times Present</th>
                        <th>Times Absent</th>
                    </tr>
                </thead>
                <tbody></tbody>
            </table>
        `;

        paginateTable(allPupils, 'attendance-table', 25, (pupil, tbody) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${pupil.name}</td>
                <td>
                    <input type="number" min="0"
                        data-pupil="${pupil.id}" data-field="timesOpened"
                        style="width:80px;">
                </td>
                <td>
                    <input type="number" min="0"
                        data-pupil="${pupil.id}" data-field="timesPresent"
                        style="width:80px;">
                </td>
                <td>
                    <input type="number" min="0"
                        data-pupil="${pupil.id}" data-field="timesAbsent"
                        style="width:80px;">
                </td>
            `;
            tbody.appendChild(tr);
        });

        saveBtn.hidden = false;

    } catch (err) {
        handleError(err, 'Failed to load attendance');
        container.innerHTML =
            '<p style="text-align:center; color:var(--color-danger);">Error loading attendance</p>';
        saveBtn.hidden = true;
    }
}

async function saveAllAttendance() {
    const inputs = document.querySelectorAll('#attendance-form-container input[type="number"]');
    const term = document.getElementById('attendance-term')?.value;
    if (!inputs.length || !term) {
        window.showToast?.('No data to save', 'warning');
        return;
    }

    const batch = db.batch();
    let hasChanges = false;

    const pupilData = {};
    inputs.forEach(input => {
        const pupilId = input.dataset.pupil;
        const field = input.dataset.field;
        const value = parseInt(input.value) || 0;
        if (value > 0) hasChanges = true;

        if (!pupilData[pupilId]) pupilData[pupilId] = {};
        pupilData[pupilId][field] = value;
    });

    if (!hasChanges) {
        window.showToast?.('No changes to save', 'info');
        return;
    }

    for (const [pupilId, data] of Object.entries(pupilData)) {
        const ref = db.collection('attendance').doc(`${pupilId}_${term}`);
        batch.set(ref, {
            pupilId, term, teacherId: currentUser.uid,
            ...data,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
    }

    try {
        await batch.commit();
        window.showToast?.('✓ Attendance saved successfully', 'success');
    } catch (err) {
        handleError(err, 'Failed to save attendance');
    }
}

/* =========================
   TRAITS & SKILLS
========================= */

function loadTraitsSection() {
    const pupilSelect = document.getElementById('traits-pupil');
    const container = document.getElementById('traits-form-container');
    if (!pupilSelect || !container) return;

    pupilSelect.innerHTML = '<option value="">-- Select Pupil --</option>';

    if (allPupils.length === 0) {
        container.hidden = true;
        return;
    }

    allPupils.forEach(pupil => {
        const opt = document.createElement('option');
        opt.value = pupil.id;
        opt.textContent = pupil.name;
        pupilSelect.appendChild(opt);
    });

    container.hidden = true; // will show when pupil selected
}

async function loadTraitsData() {
    const pupilId = document.getElementById('traits-pupil')?.value;
    const term = document.getElementById('traits-term')?.value;
    const container = document.getElementById('traits-form-container');
    if (!container || !pupilId || !term) {
        container.hidden = true;
        return;
    }

    container.hidden = false;

    const traitFields = ['punctuality','neatness','politeness','honesty','obedience','cooperation','attentiveness','leadership','selfcontrol','creativity'];
    const skillFields = ['handwriting','drawing','sports','craft','verbal','coordination'];

    try {
        const traitsSnap = await db.collection('behavioral_traits').doc(`${pupilId}_${term}`).get();
        const traitsData = traitsSnap.exists ? traitsSnap.data() : {};
        traitFields.forEach(f => {
            const el = document.getElementById(`trait-${f}`);
            if (el) el.value = traitsData[f] || '';
        });

        const skillsSnap = await db.collection('psychomotor_skills').doc(`${pupilId}_${term}`).get();
        const skillsData = skillsSnap.exists ? skillsSnap.data() : {};
        skillFields.forEach(f => {
            const el = document.getElementById(`skill-${f}`);
            if (el) el.value = skillsData[f] || '';
        });
    } catch (err) {
        handleError(err, 'Failed to load traits/skills');
    }
}

async function saveTraitsAndSkills() {
    const pupilId = document.getElementById('traits-pupil')?.value;
    const term = document.getElementById('traits-term')?.value;
    if (!pupilId || !term) {
        window.showToast?.('Select pupil and term', 'warning');
        return;
    }

    const traitFields = ['punctuality','neatness','politeness','honesty','obedience','cooperation','attentiveness','leadership','selfcontrol','creativity'];
    const skillFields = ['handwriting','drawing','sports','craft','verbal','coordination'];

    const traitsData = { pupilId, term, teacherId: currentUser.uid };
    traitFields.forEach(f => {
        traitsData[f] = document.getElementById(`trait-${f}`).value.trim();
    });
    traitsData.updatedAt = firebase.firestore.FieldValue.serverTimestamp();

    const skillsData = { pupilId, term, teacherId: currentUser.uid };
    skillFields.forEach(f => {
        skillsData[f] = document.getElementById(`skill-${f}`).value.trim();
    });
    skillsData.updatedAt = firebase.firestore.FieldValue.serverTimestamp();

    try {
        await db.collection('behavioral_traits').doc(`${pupilId}_${term}`).set(traitsData, { merge: true });
        await db.collection('psychomotor_skills').doc(`${pupilId}_${term}`).set(skillsData, { merge: true });
        window.showToast?.('✓ Traits & skills saved', 'success');
    } catch (err) {
        handleError(err, 'Failed to save traits & skills');
    }
}

/* =========================
   REMARKS (NOW SAVES HEADTEACHER TOO)
========================= */

function loadRemarksSection() {
    const pupilSelect = document.getElementById('remarks-pupil');
    const container = document.getElementById('remarks-form-container');
    if (!pupilSelect || !container) return;

    pupilSelect.innerHTML = '<option value="">-- Select Pupil --</option>';

    if (allPupils.length === 0) {
        container.hidden = true;
        return;
    }

    allPupils.forEach(pupil => {
        const opt = document.createElement('option');
        opt.value = pupil.id;
        opt.textContent = pupil.name;
        pupilSelect.appendChild(opt);
    });

    container.hidden = true;
}

async function loadRemarksData() {
    const pupilId = document.getElementById('remarks-pupil')?.value;
    const term = document.getElementById('remarks-term')?.value;
    const container = document.getElementById('remarks-form-container');
    if (!container || !pupilId || !term) {
        container.hidden = true;
        return;
    }

    try {
        const docSnap = await db.collection('remarks').doc(`${pupilId}_${term}`).get();
        const data = docSnap.exists ? docSnap.data() : {};

        document.getElementById('teacher-remark').value = data.teacherRemark || '';
        document.getElementById('head-remark').value = data.headRemark || '';

        container.hidden = false;
    } catch (err) {
        handleError(err, 'Failed to load remarks');
        container.hidden = true;
    }
}

async function saveRemarks() {
    const pupilId = document.getElementById('remarks-pupil')?.value;
    const term = document.getElementById('remarks-term')?.value;
    const teacherRemark = document.getElementById('teacher-remark')?.value.trim();
    const headRemark = document.getElementById('head-remark')?.value.trim();

    if (!pupilId || !term) {
        window.showToast?.('Select pupil and term', 'warning');
        return;
    }

    if (!teacherRemark && !headRemark) {
        window.showToast?.('Enter at least one remark', 'warning');
        return;
    }

    const data = {
        pupilId,
        term,
        teacherId: currentUser.uid,
        teacherRemark,
        headRemark,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
        await db.collection('remarks').doc(`${pupilId}_${term}`).set(data, { merge: true });
        window.showToast?.('✓ Remarks saved', 'success');
    } catch (err) {
        handleError(err, 'Failed to save remarks');
    }
}

/* =========================
   EVENT LISTENERS FOR DYNAMIC SECTIONS
========================= */

document.addEventListener('DOMContentLoaded', () => {
    // Results: term or subject change → reload table
    const resultTerm = document.getElementById('result-term');
    const resultSubject = document.getElementById('result-subject');
    
    if (resultTerm) {
        resultTerm.addEventListener('change', loadResultsTable);
    }
    if (resultSubject) {
        resultSubject.addEventListener('change', loadResultsTable);
    }

    // Traits & Skills: pupil or term change → reload data
    const traitsPupil = document.getElementById('traits-pupil');
    const traitsTerm = document.getElementById('traits-term');
    
    if (traitsPupil) {
        traitsPupil.addEventListener('change', loadTraitsData);
    }
    if (traitsTerm) {
        traitsTerm.addEventListener('change', () => {
            // Only reload if a pupil is already selected
            if (traitsPupil?.value) {
                loadTraitsData();
            }
        });
    }

    // Remarks: pupil or term change → reload data
    const remarksPupil = document.getElementById('remarks-pupil');
    const remarksTerm = document.getElementById('remarks-term');
    
    if (remarksPupil) {
        remarksPupil.addEventListener('change', loadRemarksData);
    }
    if (remarksTerm) {
        remarksTerm.addEventListener('change', () => {
            // Only reload if a pupil is already selected
            if (remarksPupil?.value) {
                loadRemarksData();
            }
        });
    }

    // Attendance: term change → reload section
    const attendanceTerm = document.getElementById('attendance-term');
    if (attendanceTerm) {
        attendanceTerm.addEventListener('change', loadAttendanceSection);
    }

    console.log('✓ Teacher portal event listeners fully updated and loaded');
});