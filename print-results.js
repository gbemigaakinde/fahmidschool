/**
 * FAHMID NURSERY & PRIMARY SCHOOL
 * Print Results JavaScript
 * Phases 4-7 Complete
 * 
 * Handles:
 * - Load pupil information
 * - Display print-formatted results
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

// Enforce pupil access and load data
checkRole('pupil').then(async user => {
    await loadPupilData(user);
}).catch(() => {
    // Error handling done in checkRole function
});

// ============================================
// PUPIL DATA LOADING
// ============================================

/**
 * Load pupil data and results
 * @async
 * @param {Object} user - Firebase user object
 */
async function loadPupilData(user) {
    try {
        // Find pupil document
        let pupilsSnap = await db.collection('pupils')
            .where('parentEmail', '==', user.email)
            .get();

        if (pupilsSnap.empty) {
            pupilsSnap = await db.collection('pupils')
                .where('email', '==', user.email)
                .get();
        }

        if (pupilsSnap.empty) {
            window.showToast?.('No pupil profile found', 'danger');
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 2000);
            return;
        }

        const pupilDoc = pupilsSnap.docs[0];
        const pupilData = pupilDoc.data();
        currentPupilId = pupilDoc.id;

        // Update pupil info
        document.getElementById('print-name').textContent = pupilData.name;
        document.getElementById('print-class').textContent = pupilData.class || 'N/A';
        
        // Set current date
        const today = new Date();
        document.getElementById('print-date').textContent = today.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        // Load and display results
        await loadPrintResults();
    } catch (error) {
        console.error('Error loading pupil data:', error);
        handleError(error, 'Failed to load pupil information');
    }
}

// ============================================
// RESULTS DISPLAY
// ============================================

/**
 * Load and display results in print format
 * @async
 */
async function loadPrintResults() {
    const container = document.getElementById('print-results-container');
    if (!container) return;

    container.innerHTML = `
        <div class="skeleton-container">
            <div class="skeleton" style="height: 40px; margin-bottom: var(--space-lg);"></div>
            <div class="skeleton" style="height: 30px; margin-bottom: var(--space-sm);"></div>
            <div class="skeleton" style="height: 30px; margin-bottom: var(--space-sm);"></div>
        </div>
    `;

    try {
        const resultsSnap = await db.collection('results')
            .where('pupilId', '==', currentPupilId)
            .get();

        container.innerHTML = '';

        if (resultsSnap.empty) {
            container.innerHTML = `
                <p style="text-align:center; color:var(--color-gray-600); padding: var(--space-xl);">
                    No results available yet.
                </p>
            `;
            return;
        }

        // Group by term
        const terms = {};
        resultsSnap.forEach(doc => {
            const result = doc.data();
            if (!terms[result.term]) {
                terms[result.term] = [];
            }
            terms[result.term].push(result);
        });

        // Sort terms
        const termOrder = ['First Term', 'Second Term', 'Third Term'];
        const sortedTerms = Object.keys(terms).sort((a, b) => {
            return termOrder.indexOf(a) - termOrder.indexOf(b);
        });

        // Display each term
        sortedTerms.forEach(term => {
            const termHeading = document.createElement('h2');
            termHeading.className = 'term-heading';
            termHeading.textContent = term;
            container.appendChild(termHeading);

            const table = document.createElement('table');
            table.className = 'results-table';
            table.innerHTML = `
                <thead>
                    <tr>
                        <th style="width: 40%;">Subject</th>
                        <th style="width: 30%;">Score</th>
                        <th style="width: 30%;">Grade</th>
                    </tr>
                </thead>
                <tbody></tbody>
            `;

            const tbody = table.querySelector('tbody');

            // Sort subjects
            terms[term].sort((a, b) => a.subject.localeCompare(b.subject));

            // Calculate statistics
            let totalScore = 0;
            let subjectCount = 0;

            // Add subject rows
            terms[term].forEach(result => {
                const grade = getGrade(result.score);
                
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><strong>${result.subject}</strong></td>
                    <td style="text-align: center;">${result.score}/100</td>
                    <td style="text-align: center;">${grade}</td>
                `;
                tbody.appendChild(tr);

                totalScore += result.score;
                subjectCount++;
            });

            // Add summary rows
            if (subjectCount > 0) {
                const average = (totalScore / subjectCount).toFixed(1);
                const avgGrade = getGrade(parseFloat(average));

                // Total row
                const totalRow = document.createElement('tr');
                totalRow.style.cssText = 'border-top: 2px solid var(--color-gray-700); font-weight: var(--font-weight-bold);';
                totalRow.innerHTML = `
                    <td><strong>TOTAL</strong></td>
                    <td style="text-align: center;"><strong>${totalScore}/${subjectCount * 100}</strong></td>
                    <td style="text-align: center;">-</td>
                `;
                tbody.appendChild(totalRow);

                // Average row
                const avgRow = document.createElement('tr');
                avgRow.style.cssText = 'font-weight: var(--font-weight-bold); background: var(--color-gray-100);';
                avgRow.innerHTML = `
                    <td><strong>AVERAGE</strong></td>
                    <td style="text-align: center;"><strong>${average}%</strong></td>
                    <td style="text-align: center;"><strong>${avgGrade}</strong></td>
                `;
                tbody.appendChild(avgRow);
            }

            container.appendChild(table);
        });
    } catch (error) {
        console.error('Error loading print results:', error);
        container.innerHTML = `
            <p style="text-align:center; color:var(--color-danger); padding: var(--space-xl);">
                Error loading results. Please try again.
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
    if (score >= 90) return 'A+';
    if (score >= 80) return 'A';
    if (score >= 70) return 'B';
    if (score >= 60) return 'C';
    if (score >= 50) return 'D';
    return 'F';
}

// ============================================
// PRINT FUNCTIONALITY
// ============================================

/**
 * Check if page is ready to print
 * Auto-print after results are loaded (optional)
 */
window.addEventListener('load', () => {
    // Optional: Auto-print after a delay
    // Uncomment the following lines to enable auto-print
    /*
    setTimeout(() => {
        if (currentPupilId && !document.getElementById('print-results-container').querySelector('.skeleton')) {
            window.print();
        }
    }, 2000);
    */
});

// ============================================
// PAGE LOAD
// ============================================

console.log('✓ Print results page initialized');
