/**
 * FAHMID NURSERY & PRIMARY SCHOOL
 * Teacher Portal JavaScript - COMPLETE FIX
 * 
 * @version 2.2.0 - ALL ISSUES FIXED
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

// Setup logout
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
            loadSubjects(); // Load subjects dropdown
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
    await loadSubjects();
}

// ============================================
// DASHBOARD STATISTICS - FIXED
// ============================================

async function loadTeacherDashboard() {
    try {
        const classesSnap = await db.collection('classes').get();
        const classCount = classesSnap.size;
        
        document.getElementById('my-class-count').textContent = classCount;

        let totalPupils = 0;
        for (let doc of classesSnap.docs) {
            const className = doc.data().name;
            const pupilsSnap = await db.collection('pupils')
                .where('class', '==', className)
                .get();
            totalPupils += pupilsSnap.size;
        }
        
        document.getElementById('my-pupil-count').textContent = totalPupils;
        
        console.log('✓ Teacher dashboard loaded:', { classes: classCount, pupils: totalPupils });
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
        const snapshot = await db.collection('classes').orderBy('name').get();
        
        if (snapshot.empty) {
            console.log('No classes found');
            return;
        }
        
        snapshot.forEach(doc => {
            const opt = document.createElement('option');
            opt.value = `${doc.id}|${doc.data().name}`;
            opt.textContent = doc.data().name;
            selector.appendChild(opt);
        });
        
        console.log('✓ Classes loaded for teacher:', snapshot.size);
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

    tbody.innerHTML = '<tr><td colspan="2" style="text-align:center;">Loading pupils...</td></tr>';

    try {
        const [classId, className] = selected.split('|');
        
        console.log('Loading pupils for class:', className);

        const pupilsSnap = await db.collection('pupils')
            .where('class', '==', className)
            .get();

        tbody.innerHTML = '';

        if (pupilsSnap.empty) {
            tbody.innerHTML = '<tr><td colspan="2" style="text-align:center; color:var(--color-gray-600);">No pupils assigned to this class yet</td></tr>';
            console.log('No pupils found for class:', className);
            return;
        }

        console.log('✓ Found pupils:', pupilsSnap.size);

        pupilsSnap.forEach(doc => {
            const data = doc.data();
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td data-label="Pupil Name"><strong>${data.name}</strong></td>
                <td data-label="Parent Email">${data.parentEmail || '-'}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error('Error loading pupils:', error);
        tbody.innerHTML = '<tr><td colspan="2" style="text-align:center; color:var(--color-danger);">Error loading pupils. Please try again.</td></tr>';
        handleError(error, 'Failed to load pupils');
    }
}

// ============================================
// SUBJECTS MANAGEMENT - NEW
// ============================================

async function loadSubjects() {
    const selector = document.getElementById('result-subject');
    if (!selector) return;

    try {
        // Try to load subjects from Firestore
        const subjectsDoc = await db.collection('settings').doc('subjects').get();
        
        selector.innerHTML = '';
        
        if (subjectsDoc.exists && subjectsDoc.data().list) {
            const subjects = subjectsDoc.data().list;
            subjects.forEach(subject => {
                const opt = document.createElement('option');
                opt.value = subject;
                opt.textContent = subject;
                selector.appendChild(opt);
            });
            console.log('✓ Subjects loaded from Firestore:', subjects.length);
        } else {
            // Default subjects if none exist
            const defaultSubjects = [
                'English',
                'Mathematics',
                'Science',
                'Social Studies',
                'Arts',
                'Physical Education'
            ];
            
            defaultSubjects.forEach(subject => {
                const opt = document.createElement('option');
                opt.value = subject;
                opt.textContent = subject;
                selector.appendChild(opt);
            });
            
            console.log('✓ Using default subjects');
        }
    } catch (error) {
        console.error('Error loading subjects:', error);
        // Fallback to default
        const fallback = ['English', 'Mathematics', 'Science', 'Social Studies'];
        fallback.forEach(subject => {
            const opt = document.createElement('option');
            opt.value = subject;
            opt.textContent = subject;
            selector.appendChild(opt);
        });
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
        const snapshot = await db.collection('classes').orderBy('name').get();
        
        snapshot.forEach(doc => {
            const opt = document.createElement('option');
            opt.value = `${doc.id}|${doc.data().name}`;
            opt.textContent = doc.data().name;
            selector.appendChild(opt);
        });
        
        console.log('✓ Classes loaded for results entry');
    } catch (error) {
        console.error('Error loading classes for results:', error);
        handleError(error, 'Failed to load classes');
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

    container.innerHTML = '<div class="skeleton-container"><div class="skeleton" style="height: 40px;"></div></div>';

    const [classId, className] = selected.split('|');
    const term = document.getElementById('result-term')?.value || 'First Term';
    const subject = document.getElementById('result-subject')?.value;

    if (!subject) {
        container.innerHTML = '<p style="text-align:center; color:var(--color-gray-600);">Please select a subject</p>';
        if (saveBtn) saveBtn.style.display = 'none';
        return;
    }

    try {
        console.log('Loading class for results:', { classId, className, term, subject });

        const pupilsSnap = await db.collection('pupils')
            .where('class', '==', className)
            .get();

        if (pupilsSnap.empty) {
            container.innerHTML = '<p style="text-align:center; color:var(--color-gray-600);">No pupils assigned to this class yet</p>';
            if (saveBtn) saveBtn.style.display = 'none';
            return;
        }

        console.log('✓ Found pupils for results:', pupilsSnap.size);

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

        for (let pupilDoc of pupilsSnap.docs) {
            const pupil = pupilDoc.data();
            const pupilId = pupilDoc.id; // This is the UID

            // Check existing result
            const resultDocId = `${pupilId}_${classId}_${term}_${subject}`;
            
            let currentScore = '';
            try {
                const resultDoc = await db.collection('results').doc(resultDocId).get();
                if (resultDoc.exists) {
                    currentScore = resultDoc.data().score;
                }
            } catch (err) {
                console.log('No existing result for:', pupil.name);
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
                            data-pupil-name="${pupil.name}"
                            data-class="${classId}" 
                            value="${currentScore}"
                            placeholder="0-100"
                            style="width: 100px;"
                        >
                    </td>
                    <td data-label="Current Score">${currentScore ? `<strong>${currentScore}</strong>` : '-'}</td>
                </tr>
            `;
        }

        tableHTML += `</tbody></table>`;
        container.innerHTML = tableHTML;
        
        if (saveBtn) saveBtn.style.display = 'block';
    } catch (error) {
        console.error('Error loading class for results:', error);
        container.innerHTML = '<p style="text-align:center; color:var(--color-danger);">Error loading pupils. Please try again.</p>';
        handleError(error, 'Failed to load pupils for results');
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

    // Show loading
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.classList.add('loading');
        saveBtn.querySelector('.btn-text').style.display = 'none';
        saveBtn.querySelector('.btn-loading').style.display = 'inline';
    }

    const batch = db.batch();
    let updatedCount = 0;
    const errors = [];

    try {
        inputs.forEach(input => {
            const scoreValue = input.value.trim();
            if (!scoreValue) return; // Skip empty

            const score = parseInt(scoreValue);
            if (isNaN(score) || score < 0 || score > 100) {
                errors.push(`Invalid score for ${input.dataset.pupilName}: ${scoreValue}`);
                return;
            }

            const pupilId = input.dataset.pupil;
            const resultDocId = `${pupilId}_${classId}_${term}_${subject}`;
            const resultRef = db.collection('results').doc(resultDocId);

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

        if (errors.length > 0) {
            window.showToast?.(errors[0], 'warning');
            return;
        }

        if (updatedCount === 0) {
            window.showToast?.('No scores to save. Please enter at least one score.', 'warning');
            return;
        }

        await batch.commit();
        
        window.showToast?.(`✓ ${updatedCount} result(s) saved successfully!`, 'success');
        
        // Reload
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