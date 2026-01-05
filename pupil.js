/**
 * FAHMID NURSERY & PRIMARY SCHOOL
 * Pupil Portal JavaScript - FULLY ALIGNED WITH PRINT PAGE
 * 
 * @version 3.2.0
 * @date 2026-01-05
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
}).catch(() => {});

// ============================================
// PUPIL PROFILE
// ============================================

async function loadPupilProfile(user) {
    try {
        const pupilDoc = await db.collection('pupils').doc(user.uid).get();

        if (!pupilDoc.exists) {
            console.error('No pupil profile found for UID:', user.uid);
            window.showToast?.('No pupil profile found for this account. Please contact admin.', 'danger');
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 3000);
            return;
        }

        const pupilData = pupilDoc.data();
        
        currentPupilId = pupilDoc.id;
        currentPupilName = pupilData.name;
        currentClass = pupilData.class || 'Unknown Class';

        console.log('✓ Pupil profile loaded:', {
            uid: currentPupilId,
            name: currentPupilName,
            class: currentClass
        });

        // Fetch current academic session from admin settings
        const settings = await getCurrentSettings();
        const currentSession = settings.session;

        // Update welcome message to include session
        document.getElementById('pupil-welcome').innerHTML = `
            Hello, <strong>${currentPupilName}</strong>!<br>
            Class: ${currentClass}<br>
            Session: ${currentSession}
        `;

        // Load results
        await loadResults();
    } catch (error) {
        console.error('Error loading pupil profile:', error);
        handleError(error, 'Failed to load pupil profile');
        
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 3000);
    }
}

// ============================================
// RESULTS DISPLAY - NOW FULLY MATCHES PRINT PAGE
// ============================================

async function loadResults() {
    if (!currentPupilId) {
        console.error('Cannot load results: currentPupilId is null');
        return;
    }

    const container = document.getElementById('results-container');
    if (!container) return;

    container.innerHTML = `
        <div class="skeleton-container">
            <div class="skeleton" style="height: 40px; width: 60%; margin: var(--space-xl) auto;"></div>
            <div class="skeleton" style="height: 30px; margin: var(--space-lg) 0 var(--space-sm);"></div>
            <div class="skeleton" style="height: 30px; margin-bottom: var(--space-sm);"></div>
            <div class="skeleton" style="height: 30px; margin-bottom: var(--space-lg);"></div>
        </div>
    `;

    try {
        // Fetch ALL results (since no pupilId field) and filter client-side by doc ID prefix
        const resultsSnap = await db.collection('results').get();

        const pupilResults = [];
        resultsSnap.forEach(doc => {
            const docId = doc.id;
            if (docId.startsWith(currentPupilId + '_')) {
                const data = doc.data();
                const parts = docId.split('_');
                if (parts.length >= 3) {
                    const term = parts[1];
                    const subject = parts.slice(2).join('_'); // Handle subjects with _
                    const caScore = data.caScore || 0;
                    const examScore = data.examScore || 0;
                    const total = caScore + examScore;

                    pupilResults.push({
                        term,
                        subject,
                        caScore,
                        examScore,
                        total
                    });
                }
            }
        });

        console.log(`Found ${pupilResults.length} result entries for this pupil`);

        container.innerHTML = '';

        if (pupilResults.length === 0) {
            container.innerHTML = `
                <p style="text-align:center; color:var(--color-gray-600); padding: var(--space-2xl); font-size: var(--text-lg);">
                    📚 No results have been entered yet.<br><br>
                    Your teachers will upload your scores soon. Check back later!
                </p>
            `;
            return;
        }

        // Group by term
        const terms = {};
        pupilResults.forEach(r => {
            if (!terms[r.term]) terms[r.term] = [];
            terms[r.term].push(r);
        });

        const termOrder = ['First Term', 'Second Term', 'Third Term'];
        const sortedTerms = Object.keys(terms).sort((a, b) => 
            termOrder.indexOf(a) - termOrder.indexOf(b)
        );

        sortedTerms.forEach(term => {
            const termSection = document.createElement('div');
            termSection.className = 'results-term-section';

            const heading = document.createElement('h3');
            heading.textContent = `${term}`;
            termSection.appendChild(heading);

            const table = document.createElement('table');
            table.className = 'results-table';
            table.innerHTML = `
                <thead>
                    <tr>
                        <th>SUBJECT</th>
                        <th>CA (40)</th>
                        <th>EXAM (60)</th>
                        <th>TOTAL (100)</th>
                        <th>GRADE</th>
                    </tr>
                </thead>
                <tbody></tbody>
            `;

            const tbody = table.querySelector('tbody');

            // Sort subjects alphabetically
            terms[term].sort((a, b) => a.subject.localeCompare(b.subject));

            let termTotal = 0;
            let subjectCount = 0;

            terms[term].forEach(r => {
                const grade = getGrade(r.total);
                const gradeClass = 'grade-' + grade;

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><strong>${r.subject}</strong></td>
                    <td style="text-align:center;">${r.caScore}</td>
                    <td style="text-align:center;">${r.examScore}</td>
                    <td style="text-align:center; font-weight:bold;">${r.total}</td>
                    <td style="text-align:center;" class="${gradeClass}">${grade}</td>
                `;
                tbody.appendChild(tr);

                termTotal += r.total;
                subjectCount++;
            });

            // Summary rows
            if (subjectCount > 0) {
                const average = (termTotal / subjectCount).toFixed(1);
                const avgGrade = getGrade(parseFloat(average));
                const avgGradeClass = 'grade-' + avgGrade;

                const totalRow = document.createElement('tr');
                totalRow.className = 'summary-row';
                totalRow.innerHTML = `
                    <td colspan="3"><strong>TOTAL SCORE</strong></td>
                    <td colspan="2"><strong>${termTotal} / ${subjectCount * 100}</strong></td>
                `;
                tbody.appendChild(totalRow);

                const avgRow = document.createElement('tr');
                avgRow.className = 'summary-row';
                avgRow.innerHTML = `
                    <td colspan="3"><strong>AVERAGE</strong></td>
                    <td colspan="2"><strong>${average}% (${avgGrade})</strong></td>
                `;
                tbody.appendChild(avgRow);
            }

            termSection.appendChild(table);
            container.appendChild(termSection);
        });

        console.log('✓ Results displayed successfully');
    } catch (error) {
        console.error('Error loading results:', error);
        container.innerHTML = `
            <p style="text-align:center; color:var(--color-danger); padding: var(--space-2xl);">
                ⚠️ Unable to load results. Please try again later.
            </p>
        `;
    }
}

// ============================================
// GRADE CALCULATION - EXACTLY MATCHES PRINT PAGE
// ============================================

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

// ============================================
// PAGE LOAD
// ============================================

console.log('✓ Pupil portal initialized (v3.2.0)');