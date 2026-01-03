/**
 * FAHMID NURSERY & PRIMARY SCHOOL
 * Teacher Portal JavaScript
 * Phases 4-7 Complete
 * 
 * Handles:
 * - Dashboard statistics
 * - View classes and pupils
 * - Enter and save pupil results
 * 
 * @version 2.0.0
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
}).catch(() => {
    // Error handling done in checkRole function
});

// Setup logout button
document.getElementById('teacher-logout')?.addEventListener('click', (e) => {
    e.preventDefault();
    logout();
});

// ============================================
// NAVIGATION
// ============================================

/**
 * Show specific teacher section
 * @param {string} sectionId - Section ID to display
 */
function showSection(sectionId) {
    // Hide all sections
    document.querySelectorAll('.admin-card').forEach(card => {
        card.style.display = 'none';
    });
    
    // Show selected section
    const section = document.getElementById(sectionId);
    if (section) {
        section.style.display = 'block';
    }
    
    // Update active nav link
    document.querySelectorAll('.admin-sidebar a').forEach(a => {
        a.classList.remove('active');
    });
    const activeLink = document.querySelector(`.admin-sidebar a[onclick="showSection('${sectionId}')"]`);
    if (activeLink) {
        activeLink.classList.add('active');
    }
    
    // Load section-specific data
    switch(sectionId) {
        case 'dashboard':
            loadTeacherDashboard();
            break;
        case 'my-classes':
            loadClassesForTeacher();
            break;
        case 'enter-results':
            loadClassesForResults();
            break;
    }
    
    // Close mobile sidebar if open
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

/**
 * Load all teacher data on initialization
 * @async
 */
async function loadTeacherData() {
    await loadTeacherDashboard();
    await loadClassesForTeacher();
    await loadClassesForResults();
}

// ============================================
// DASHBOARD STATISTICS
// ============================================

/**
 * Load teacher dashboard statistics
 * @async
 */
async function loadTeacherDashboard() {
    try {
        const classesSnap = await db.collection('classes').get();
        document.getElementById('my-class-count').textContent = classesSnap.size;

        let totalPupils = 0;
        for (let doc of classesSnap.docs) {
            const pupilsSnap = await db.collection('pupils')
                .where('class', '==', doc.data().name)
                .get();
            totalPupils += pupilsSnap.size;
        }
        document.getElementById('my-pupil-count').textContent = totalPupils;
    } catch (error) {
        console.error('Error loading dashboard stats:', error);
        handleError(error, 'Failed to load dashboard statistics');
    }
}

// ============================================
// MY CLASSES
// ============================================

/**
 * Load classes for teacher to view
 * @async
 */
async function loadClassesForTeacher() {
    const selector = document.getElementById('class-selector');
    if (!selector) return;

    selector.innerHTML = '<option value="">-- Select a Class --</option>';

    try {
        const snapshot = await db.collection('classes').orderBy('name').get();
        
        snapshot.forEach(doc => {
            const opt = document.createElement('option');
            opt.value = doc.id;
            opt.textContent = doc.data().name;
            selector.appendChild(opt);
        });
    } catch (error) {
        console.error('Error loading classes:', error);
        handleError(error, 'Failed to load classes');
    }
}

/**
 * Load pupils in selected class
 * @async
 */
async function loadPupilsInClass() {
    const classId = document.getElementById('class-selector')?.value;
    const tbody = document.querySelector('#pupils-in-class-table tbody');
    
    if (!tbody) return;
    
    tbody.innerHTML = '';

    if (!classId) {
        tbody.innerHTML = '<tr><td colspan="2" style="text-align:center; color:var(--color-gray-600);">Select a class to view pupils</td></tr>';
        return;
    }

    tbody.innerHTML = '<tr><td colspan="2" style="text-align:center;">Loading...</td></tr>';

    try {
        const classDoc = await db.collection('classes').doc(classId).get();
        const className = classDoc.data().name;

        const pupilsSnap = await db.collection('pupils')
            .where('class', '==', className)
            .orderBy('name')
            .get();

        tbody.innerHTML = '';

        if (pupilsSnap.empty) {
            tbody.innerHTML = '<tr><td colspan="2" style="text-align:center; color:var(--color-gray-600);">No pupils in this class</td></tr>';
            return;
        }

        pupilsSnap.forEach(doc => {
            const data = doc.data();
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td data-label="Pupil Name">${data.name}</td>
                <td data-label="Parent Email">${data.parentEmail || '-'}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error('Error loading pupils:', error);
        tbody.innerHTML = '<tr><td colspan="2" style="text-align:center; color:var(--color-danger);">Error loading pupils</td></tr>';
    }
}

// ============================================
// RESULTS ENTRY
// ============================================

/**
 * Load classes for results entry
 * @async
 */
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
    } catch (error) {
        console.error('Error loading classes for results:', error);
        handleError(error, 'Failed to load classes');
    }
}

/**
 * Load class for results entry
 * Creates table with pupils and score inputs
 * @async
 */
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

    try {
        const pupilsSnap = await db.collection('pupils')
            .where('class', '==', className)
            .orderBy('name')
            .get();

        if (pupilsSnap.empty) {
            container.innerHTML = '<p style="text-align:center; color:var(--color-gray-600);">No pupils in this class</p>';
            if (saveBtn) saveBtn.style.display = 'none';
            return;
        }

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
            const pupilId = pupilDoc.id;

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
    } catch (error) {
        console.error('Error loading class for results:', error);
        container.innerHTML = '<p style="text-align:center; color:var(--color-danger);">Error loading pupils</p>';
    }
}

/**
 * Save all results to Firestore
 * @async
 */
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

    // Show loading state
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
            if (!scoreValue) return; // Skip empty inputs

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
        
        window.showToast?.(`${updatedCount} result(s) saved successfully`, 'success');
        
        // Reload the results table
        await loadClassForResults();
    } catch (error) {
        console.error('Error saving results:', error);
        handleError(error, 'Failed to save results');
    } finally {
        // Reset button state
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

// Show dashboard on load
document.addEventListener('DOMContentLoaded', () => {
    showSection('dashboard');
    console.log('✓ Teacher portal initialized');
});
