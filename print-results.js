/**
 * FAHMID NURSERY & PRIMARY SCHOOL
 * Print Results JavaScript - FIXED
 * 
 * @version 3.0.0 - COMPREHENSIVE FIX
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
}).catch(() => {});

// ============================================
// PUPIL DATA LOADING
// ============================================

async function loadPupilData(user) {
    try {
        const pupilDoc = await db.collection('pupils').doc(user.uid).get();

        if (!pupilDoc.exists) {
            console.error('No pupil profile found for UID:', user.uid);
            window.showToast?.('No pupil profile found', 'danger');
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 2000);
            return;
        }

        const pupilData = pupilDoc.data();
        currentPupilId = pupilDoc.id;

        console.log('✓ Print: Pupil profile loaded:', {
            uid: currentPupilId,
            name: pupilData.name
        });

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
        
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 3000);
    }
}

// ============================================
// RESULTS DISPLAY
// ============================================

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
        console.log('Print: Querying results for pupilId:', currentPupilId);

        const resultsSnap = await db.collection('results')
            .where('pupilId', '==', currentPupilId)
            .get();

        console.log('Print: Results found:', resultsSnap.size);

        container.innerHTML = '';

        if (resultsSnap.empty) {
            container.innerHTML = `
                <p style="text-align:center; color:var(--color-gray-600); padding: var(--space-xl);">
                    📚 No results available yet. Results will appear here once your teachers enter them.
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
            termHeading.textContent = `📖 ${term}`;
            container.appendChild(termHeading);

            const table = document.createElement('table');
            table.className = 'results-table';
            table.innerHTML = `
                <thead>
                    <tr>
                        <th style="width: 40%;">Subject</th>
                        <th style="width: 30%; text-align: center;">Score</th>
                        <th style="width: 30%; text-align: center;">Grade</th>
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
                const gradeClass = getGradeClass(result.score);
                
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><strong>${result.subject}</strong></td>
                    <td style="text-align: center; font-weight: var(--font-weight-bold);">${result.score}/100</td>
                    <td style="text-align: center;" class="${gradeClass}">${grade}</td>
                `;
                tbody.appendChild(tr);

                totalScore += result.score;
                subjectCount++;
            });

            // Add summary rows
            if (subjectCount > 0) {
                const average = (totalScore / subjectCount).toFixed(1);
                const avgGrade = getGrade(parseFloat(average));
                const avgGradeClass = getGradeClass(parseFloat(average));

                // Total row
                const totalRow = document.createElement('tr');
                totalRow.className = 'summary-row';
                totalRow.innerHTML = `
                    <td><strong>📊 TOTAL</strong></td>
                    <td style="text-align: center;"><strong>${totalScore}/${subjectCount * 100}</strong></td>
                    <td style="text-align: center;">-</td>
                `;
                tbody.appendChild(totalRow);

                // Average row
                const avgRow = document.createElement('tr');
                avgRow.className = 'summary-row';
                avgRow.style.background = 'var(--color-primary-dark)';
                avgRow.style.color = 'var(--color-white)';
                avgRow.innerHTML = `
                    <td style="color: var(--color-white);"><strong>🎯 AVERAGE</strong></td>
                    <td style="text-align: center; color: var(--color-white);"><strong>${average}%</strong></td>
                    <td style="text-align: center; color: var(--color-white);"><strong>${avgGrade}</strong></td>
                `;
                tbody.appendChild(avgRow);
            }

            container.appendChild(table);
        });

        console.log('✓ Print results loaded successfully');
    } catch (error) {
        console.error('Error loading print results:', error);
        container.innerHTML = `
            <p style="text-align:center; color:var(--color-danger); padding: var(--space-xl);">
                ⚠️ Error loading results. Please try again or contact support.
            </p>
        `;
    }
}

// ============================================
// GRADE CALCULATION
// ============================================

function getGrade(score) {
    if (score >= 90) return 'A+ Excellent';
    if (score >= 80) return 'A Very Good';
    if (score >= 70) return 'B Good';
    if (score >= 60) return 'C Fair';
    if (score >= 50) return 'D Pass';
    return 'F Fail';
}

function getGradeClass(score) {
    if (score >= 80) return 'grade-excellent';
    if (score >= 70) return 'grade-good';
    if (score >= 50) return 'grade-fair';
    return 'grade-fail';
}

// ============================================
// PAGE LOAD
// ============================================

console.log('✓ Print results page initialized');