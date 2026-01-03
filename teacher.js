/**
 * FAHMID NURSERY & PRIMARY SCHOOL
 * Teacher Portal JavaScript - ORDERBY FIX
 * 
 * @version 3.1.0 - REMOVED ORDERBY DEPENDENCY
 * @date 2026-01-03
 */

'use strict';

// ============================================
// INITIALIZATION
// ============================================

let currentUser = null;

// Enforce teacher access
checkRole('teacher').then(user => {
    currentUser = user;
    document.getElementById('teacher-info').innerHTML = `
        Logged in as:<br>
        <strong>${user.email}</strong>
    `;
    loadTeacherData();
}).catch(() => {});

// Setup logout button
document.getElementById('teacher-logout')?.addEventListener('click', (e) => {
    e.preventDefault();
    logout();
});

// ============================================
// NAVIGATION
// ============================================

function showSection(sectionId) {
    document.querySelectorAll('.admin-card').forEach(card => {
        card.style.display = 'none';
    });
    
    const section = document.getElementById(sectionId);
    if (section) {
        section.style.display = 'block';
    }
    
    document.querySelectorAll('.admin-sidebar a').forEach(a => {
        a.classList.remove('active');
    });
    const activeLink = document.querySelector(`.admin-sidebar a[onclick="showSection('${sectionId}')"]`);
    if (activeLink) {
        activeLink.classList.add('active');
    }
    
    switch(sectionId) {
        case 'dashboard':
            loadTeacherDashboard();
            break;
        case 'my-classes':
            loadClassesForTeacher();
            break;
        case 'enter-results':
            loadClassesForResults();
            loadSubjectsForResults();
            break;
    }
    
    const sidebar = document.getElementById('teacher-sidebar');
    const hamburger = document.getElementById('hamburger');
    if (sidebar && sidebar.classList.contains('active')) {
        sidebar.classList.remove('active');
        if (hamburger) {
            hamburger.classList.remove('active');
        }
    }
}

// ============================================
// TEACHER DATA LOADING
// ============================================

async function loadTeacherData() {
    await loadTeacherDashboard();
    await loadClassesForTeacher();
    await loadClassesForResults();
    await loadSubjectsForResults();
}

// ============================================
// DASHBOARD STATISTICS - FIXED
// ============================================

async function loadTeacherDashboard() {
    try {
        // Get classes count
        const classesSnap = await db.collection('classes').get();
        const classCount = classesSnap.size;
        document.getElementById('my-class-count').textContent = classCount;

        // Get total pupils count across all classes
        const pupilsSnap = await db.collection('pupils').get();
        document.getElementById('my-pupil-count').textContent = pupilsSnap.size;

        console.log('✓ Dashboard stats loaded:', {
            classes: classCount,
            pupils: pupilsSnap.size
        });
    } catch (error) {
        console.error('Error loading dashboard stats:', error);
        document.getElementById('my-class-count').textContent = '0';
        document.getElementById('my-pupil-count').textContent = '0';
        handleError(error, 'Failed to load dashboard statistics');
    }
}

// ============================================
// MY CLASSES - FIXED
// ============================================

async function loadClassesForTeacher() {
    const selector = document.getElementById('class-selector');
    if (!selector) return;

    selector.innerHTML = '<option value="">-- Select a Class --</option>';

    try {
        // Removed .orderBy() - sort in JavaScript instead
        const snapshot = await db.collection('classes').get();
        
        // Sort classes by name in JavaScript
        const classes = [];
        snapshot.forEach(doc => {
            classes.push({
                id: doc.id,
                name: doc.data().name
            });
        });
        
        classes.sort((a, b) => a.name.localeCompare(b.name));
        
        classes.forEach(classItem => {
            const opt = document.createElement('option');
            opt.value = `${classItem.id}|${classItem.name}`;
            opt.textContent = classItem.name;
            selector.appendChild(opt);
        });

        console.log('✓ Loaded', classes.length, 'classes');
    } catch (error) {
        console.error('Error loading classes:', error);
        handleError(error, 'Failed to load classes');
    }
}

async function loadPupilsInClass() {
    const selected = document.getElementById('class-selector')?.value;
    const tbody = document.querySelector('#pupils-in-class-table tbody');
    
    if (!tbody) return;
    
    tbody.innerHTML = '';

    if (!selected) {
        tbody.innerHTML = '<tr><td colspan="2" style="text-align:center; color:var(--color-gray-600);">Select a class to view pupils</td></tr>';
        return;
    }

    tbody.innerHTML = '<tr><td colspan="2" style="text-align:center;">Loading...</td></tr>';

    try {
        const [classId, className] = selected.split('|');

        console.log('Loading pupils for class:', className);

        // Removed .orderBy() - sort in JavaScript instead
        const pupilsSnap = await db.collection('pupils')
            .where('class', '==', className)
            .get();

        tbody.innerHTML = '';

        if (pupilsSnap.empty) {
            tbody.innerHTML = '<tr><td colspan="2" style="text-align:center; color:var(--color-gray-600);">No pupils in this class yet</td></tr>';
            return;
        }

        // Sort pupils by name in JavaScript
        const pupils = [];
        pupilsSnap.forEach(doc => {
            pupils.push(doc.data());
        });
        
        pupils.sort((a, b) => a.name.localeCompare(b.name));

        pupils.forEach(data => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td data-label="Pupil Name">${data.name}</td>
                <td data-label="Parent Email">${data.parentEmail || '-'}</td>
            `;
            tbody.appendChild(tr);
        });

        console.log('✓ Loaded', pupils.length, 'pupils');
    } catch (error) {
        console.error('Error loading pupils:', error);
        tbody.innerHTML = '<tr><td colspan="2" style="text-align:center; color:var(--color-danger);">Error loading pupils. Please try again.</td></tr>';
        handleError(error, 'Failed to load pupils');
    }
}

// ============================================
// RESULTS ENTRY - FIXED
// ============================================

async function loadClassesForResults() {
    const selector = document.getElementById('result-class');
    if (!selector) return;

    selector.innerHTML = '<option value="">-- Select Class --</option>';

    try {
        // Removed .orderBy() - sort in JavaScript instead
        const snapshot = await db.collection('classes').get();
        
        // Sort classes by name in JavaScript
        const classes = [];
        snapshot.forEach(doc => {
            classes.push({
                id: doc.id,
                name: doc.data().name
            });
        });
        
        classes.sort((a, b) => a.name.localeCompare(b.name));
        
        classes.forEach(classItem => {
            const opt = document.createElement('option');
            opt.value = `${classItem.id}|${classItem.name}`;
            opt.textContent = classItem.name;
            selector.appendChild(opt);
        });

        console.log('✓ Loaded classes for results');
    } catch (error) {
        console.error('Error loading classes for results:', error);
        handleError(error, 'Failed to load classes');
    }
}

async function loadSubjectsForResults() {
    const selector = document.getElementById('result-subject');
    if (!selector) return;

    const currentValue = selector.value;
    
    selector.innerHTML = '<option value="">-- Select Subject --</option>';

    try {
        // Removed .orderBy() - sort in JavaScript instead
        const snapshot = await db.collection('subjects').get();
        
        if (snapshot.empty) {
            // Fallback to default subjects
            const defaultSubjects = ['English', 'Mathematics', 'Science', 'Social Studies', 'Arts', 'Physical Education'];
            defaultSubjects.forEach(subject => {
                const opt = document.createElement('option');
                opt.value = subject;
                opt.textContent = subject;
                selector.appendChild(opt);
            });
            console.log('✓ Using default subjects');
        } else {
            // Sort subjects by name in JavaScript
            const subjects = [];
            snapshot.forEach(doc => {
                subjects.push(doc.data().name);
            });
            
            subjects.sort((a, b) => a.localeCompare(b));
            
            subjects.forEach(subjectName => {
                const opt = document.createElement('option');
                opt.value = subjectName;
                opt.textContent = subjectName;
                selector.appendChild(opt);
            });
            
            console.log('✓ Loaded', subjects.length, 'subjects');
        }

        if (currentValue) {
            selector.value = currentValue;
        }
    } catch (error) {
        console.error('Error loading subjects:', error);
        // Fallback to default subjects on error
        const defaultSubjects = ['English', 'Mathematics', 'Science', 'Social Studies', 'Arts', 'Physical Education'];
        defaultSubjects.forEach(subject => {
            const opt = document.createElement('option');
            opt.value = subject;
            opt.textContent = subject;
            selector.appendChild(opt);
        });
    }
}

async function loadClassForResults() {
    const selected = document.getElementById('result-class')?.value;
    const container = document.getElementById('results-entry-table-container');
    const saveBtn = document.getElementById('save-results-btn');

    if (!container) return;

    if (!selected) {
        container.innerHTML = '';
        if (saveBtn) saveBtn.style.display = 'none';
        return;
    }

    const term = document.getElementById('result-term')?.value;
    const subject = document.getElementById('result-subject')?.value;

    if (!term || !subject) {
        container.innerHTML = '<p style="text-align:center; color:var(--color-gray-600);">Please select term and subject</p>';
        if (saveBtn) saveBtn.style.display = 'none';
        return;
    }

    container.innerHTML = '<div class="skeleton-container"><div class="skeleton" style="height: 40px;"></div></div>';

    const [classId, className] = selected.split('|');

    try {
        console.log('Loading class for results:', { classId, className, term, subject });

        // Removed .orderBy() - sort in JavaScript instead
        const pupilsSnap = await db.collection('pupils')
            .where('class', '==', className)
            .get();

        if (pupilsSnap.empty) {
            container.innerHTML = '<p style="text-align:center; color:var(--color-gray-600);">No pupils in this class yet</p>';
            if (saveBtn) saveBtn.style.display = 'none';
            return;
        }

        console.log('✓ Found', pupilsSnap.size, 'pupils');

        // Sort pupils by name in JavaScript
        const pupils = [];
        pupilsSnap.forEach(pupilDoc => {
            pupils.push({
                id: pupilDoc.id,
                data: pupilDoc.data()
            });
        });
        
        pupils.sort((a, b) => a.data.name.localeCompare(b.data.name));

        let tableHTML = `
            <table class="responsive-table">
                <thead>
                    <tr>
                        <th>Pupil Name</th>
                        <th>Score (0-100)</th>
                        <th>Current Score</th>
                    </tr>
                </thead>
                <tbody>
        `;

        for (let pupilItem of pupils) {
            const pupil = pupilItem.data;
            const pupilId = pupilItem.id;

            // Check existing result
            const existingSnap = await db.collection('results')
                .where('pupilId', '==', pupilId)
                .where('classId', '==', classId)
                .where('term', '==', term)
                .where('subject', '==', subject)
                .limit(1).get();

            let currentScore = '';
            if (!existingSnap.empty) {
                currentScore = existingSnap.docs[0].data().score;
            }

            tableHTML += `
                <tr>
                    <td data-label="Pupil Name"><strong>${pupil.name}</strong></td>
                    <td data-label="Score">
                        <input 
                            type="number" 
                            min="0" 
                            max="100" 
                            data-pupil="${pupilId}" 
                            data-class="${classId}" 
                            value="${currentScore}"
                            placeholder="Enter score"
                            style="width: 100px;"
                        >
                    </td>
                    <td data-label="Current Score">${currentScore || '-'}</td>
                </tr>
            `;
        }

        tableHTML += `</tbody></table>`;
        container.innerHTML = tableHTML;
        
        if (saveBtn) saveBtn.style.display = 'block';
        
        console.log('✓ Results table loaded');
    } catch (error) {
        console.error('Error loading class for results:', error);
        container.innerHTML = '<p style="text-align:center; color:var(--color-danger);">Error loading pupils. Please try again.</p>';
        handleError(error, 'Failed to load pupils for results entry');
    }
}

async function saveAllResults() {
    const inputs = document.querySelectorAll('#results-entry-table-container input[type="number"]');
    const term = document.getElementById('result-term')?.value;
    const subject = document.getElementById('result-subject')?.value;
    const classId = document.getElementById('result-class')?.value.split('|')[0];
    const saveBtn = document.getElementById('save-results-btn');

    if (!inputs.length || !term || !subject || !classId) {
        window.showToast?.('Please select class, term, and subject', 'warning');
        return;
    }

    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.classList.add('loading');
        saveBtn.querySelector('.btn-text').style.display = 'none';
        saveBtn.querySelector('.btn-loading').style.display = 'inline';
    }

    const batch = db.batch();
    let updatedCount = 0;

    try {
        inputs.forEach(input => {
            const scoreValue = input.value.trim();
            if (!scoreValue) return;

            const score = parseInt(scoreValue);
            if (isNaN(score) || score < 0 || score > 100) {
                throw new Error(`Invalid score: ${scoreValue}. Must be between 0 and 100.`);
            }

            const pupilId = input.dataset.pupil;
            const resultRef = db.collection('results').doc(`${pupilId}_${classId}_${term}_${subject}`);

            batch.set(resultRef, {
                pupilId,
                classId,
                term,
                subject,
                score,
                teacherId: currentUser?.uid || 'unknown',
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });

            updatedCount++;
        });

        if (updatedCount === 0) {
            window.showToast?.('No scores to save. Please enter at least one score.', 'warning');
            return;
        }

        await batch.commit();
        
        window.showToast?.(`✓ ${updatedCount} result(s) saved successfully`, 'success');
        
        await loadClassForResults();
    } catch (error) {
        console.error('Error saving results:', error);
        handleError(error, 'Failed to save results');
    } finally {
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.classList.remove('loading');
            saveBtn.querySelector('.btn-text').style.display = 'inline';
            saveBtn.querySelector('.btn-loading').style.display = 'none';
        }
    }
}

// ============================================
// PAGE LOAD
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    showSection('dashboard');
    console.log('✓ Teacher portal initialized');
});