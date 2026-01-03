/**
 * FAHMID NURSERY & PRIMARY SCHOOL
 * Pupil Portal JavaScript
 * Phases 4-7 Complete
 * 
 * Handles:
 * - Load pupil profile
 * - Display academic results
 * - Grade calculation
 * 
 * @version 2.0.0
 * @date 2026-01-03
 */

'use strict';

// ============================================
// INITIALIZATION
// ============================================

let currentPupilId = null;
let currentPupilName = '';
let currentClass = '';

// Enforce pupil access
checkRole('pupil').then(async user => {
    await loadPupilProfile(user);
}).catch(() => {
    // Error handling done in checkRole function
});

// ============================================
// PUPIL PROFILE
// ============================================

/**
 * Load pupil profile from Firestore
 * @async
 * @param {Object} user - Firebase user object
 */
async function loadPupilProfile(user) {
    try {
        // Find pupil document by matching parent email or email
        let pupilsSnap = await db.collection('pupils')
            .where('parentEmail', '==', user.email)
            .get();

        // If not found by parent email, try direct email match
        if (pupilsSnap.empty) {
            pupilsSnap = await db.collection('pupils')
                .where('email', '==', user.email)
                .get();
        }

        if (pupilsSnap.empty) {
            window.showToast?.('No pupil profile found for this account', 'danger');
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 2000);
            return;
        }

        // Get first matching pupil
        const pupilDoc = pupilsSnap.docs[0];
        const pupilData = pupilDoc.data();
        
        currentPupilId = pupilDoc.id;
        currentPupilName = pupilData.name;
        currentClass = pupilData.class || 'Unknown Class';

        // Update welcome message
        document.getElementById('pupil-welcome').innerHTML = `
            Hello, <strong>${currentPupilName}</strong>!<br>
            Class: ${currentClass}
        `;

        // Load results
        await loadResults();
    } catch (error) {
        console.error('Error loading pupil profile:', error);
        handleError(error, 'Failed to load pupil profile');
    }
}

// ============================================
// RESULTS DISPLAY
// ============================================

/**
 * Load and display pupil results
 * @async
 */
async function loadResults() {
    if (!currentPupilId) return;

    const container = document.getElementById('results-container');
    if (!container) return;

    container.innerHTML = `
        <div class="skeleton-container">
            <div class="skeleton" style="height: 40px; width: 50%; margin: var(--space-xl) auto var(--space-lg);"></div>
            <div class="skeleton" style="height: 30px; margin-bottom: var(--space-sm);"></div>
            <div class="skeleton" style="height: 30px; margin-bottom: var(--space-sm);"></div>
            <div class="skeleton" style="height: 30px; margin-bottom: var(--space-lg);"></div>
        </div>
    `;

    try {
        const resultsSnap = await db.collection('results')
            .where('pupilId', '==', currentPupilId)
            .get();

        container.innerHTML = '';

        if (resultsSnap.empty) {
            container.innerHTML = `
                <p style="text-align:center; color:var(--color-gray-600); padding: var(--space-2xl);">
                    No results have been entered yet. Check back later!
                </p>
            `;
            return;
        }

        // Group results by term
        const terms = {};
        resultsSnap.forEach(doc => {
            const result = doc.data();
            if (!terms[result.term]) {
                terms[result.term] = [];
            }
            terms[result.term].push(result);
        });

        // Sort terms (First Term, Second Term, Third Term)
        const termOrder = ['First Term', 'Second Term', 'Third Term'];
        const sortedTerms = Object.keys(terms).sort((a, b) => {
            return termOrder.indexOf(a) - termOrder.indexOf(b);
        });

        // Display results for each term
        sortedTerms.forEach(term => {
            const termSection = document.createElement('div');
            termSection.className = 'results-term-section';

            const termHeading = document.createElement('h3');
            termHeading.textContent = term;
            termSection.appendChild(termHeading);

            const table = document.createElement('table');
            table.className = 'results-table';
            table.innerHTML = `
                <thead>
                    <tr>
                        <th>Subject</th>
                        <th>Score</th>
                        <th>Grade</th>
                    </tr>
                </thead>
                <tbody></tbody>
            `;

            const tbody = table.querySelector('tbody');

            // Sort subjects alphabetically
            terms[term].sort((a, b) => a.subject.localeCompare(b.subject));

            // Calculate total and average
            let totalScore = 0;
            let subjectCount = 0;

            terms[term].forEach(result => {
                const grade = getGrade(result.score);
                const gradeClass = getGradeClass(result.score);

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><strong>${result.subject}</strong></td>
                    <td>${result.score}/100</td>
                    <td class="${gradeClass}">${grade}</td>
                `;
                tbody.appendChild(tr);

                totalScore += result.score;
                subjectCount++;
            });

            // Add average row
            if (subjectCount > 0) {
                const average = (totalScore / subjectCount).toFixed(1);
                const avgGrade = getGrade(parseFloat(average));
                const avgGradeClass = getGradeClass(parseFloat(average));

                const avgRow = document.createElement('tr');
                avgRow.style.cssText = 'border-top: 2px solid var(--color-primary); font-weight: var(--font-weight-bold); background: var(--color-gray-50);';
                avgRow.innerHTML = `
                    <td><strong>AVERAGE</strong></td>
                    <td><strong>${average}</strong></td>
                    <td class="${avgGradeClass}"><strong>${avgGrade}</strong></td>
                `;
                tbody.appendChild(avgRow);
            }

            termSection.appendChild(table);
            container.appendChild(termSection);
        });
    } catch (error) {
        console.error('Error loading results:', error);
        container.innerHTML = `
            <p style="text-align:center; color:var(--color-danger); padding: var(--space-2xl);">
                Error loading results. Please refresh the page.
            </p>
        `;
    }
}

// ============================================
// GRADE CALCULATION
// ============================================

/**
 * Calculate grade from score
 * @param {number} score - Score out of 100
 * @returns {string} Grade label
 */
function getGrade(score) {
    if (score >= 90) return 'A+ Excellent';
    if (score >= 80) return 'A Very Good';
    if (score >= 70) return 'B Good';
    if (score >= 60) return 'C Fair';
    if (score >= 50) return 'D Pass';
    return 'F Fail';
}

/**
 * Get CSS class for grade styling
 * @param {number} score - Score out of 100
 * @returns {string} CSS class name
 */
function getGradeClass(score) {
    if (score >= 80) return 'grade-excellent';
    if (score >= 70) return 'grade-good';
    if (score >= 50) return 'grade-fair';
    return 'grade-fail';
}

// ============================================
// PAGE LOAD
// ============================================

console.log('✓ Pupil portal initialized');
