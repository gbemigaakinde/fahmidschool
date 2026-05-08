/**
 * FAHMID NURSERY & PRIMARY SCHOOL
 * CBT Engine — Pupil Test-Taking Logic
 * @version 1.0.0
 */
'use strict';

// ── State ──────────────────────────────────────────────────────────────────
let testData       = null;   // the cbt_tests doc
let questions      = [];     // array of question objects
let answers        = {};     // { questionIndex: 'A'|'B'|'C'|'D' }
let flagged        = new Set();
let currentQ       = 0;
let timerInterval  = null;
let secondsLeft    = 0;
let tabSwitchCount = 0;
let testId         = null;
let currentUser    = null;
let attemptStarted = false;
let submitted      = false;

// ── Init ───────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    testId = params.get('testId');

    if (!testId) {
        showError('No test specified. Please go back to the portal.');
        return;
    }

    // Auth gate
    firebase.auth().onAuthStateChanged(async user => {
        if (!user) { window.location.href = 'login.html'; return; }

        const userDoc = await db.collection('users').doc(user.uid).get();
        if (!userDoc.exists || userDoc.data().role !== 'pupil') {
            window.location.href = 'login.html';
            return;
        }

        currentUser = user;
        await loadTestData();
    });
});

// ── Load test data ─────────────────────────────────────────────────────────
async function loadTestData() {
    try {
        const testDoc = await db.collection('cbt_tests').doc(testId).get();
        if (!testDoc.exists) { showError('Test not found.'); return; }

        testData = { id: testDoc.id, ...testDoc.data() };

        // Check if test is published
        if (!testData.published) { showError('This test is not yet available.'); return; }

        // Check if within test window (if schedule set)
        const now = new Date();
        if (testData.scheduledDate) {
            const open = testData.scheduledDate.toDate();
            if (now < open) {
                showError('This test has not started yet. Check back at: ' + open.toLocaleString('en-GB'));
                return;
            }
        }
        if (testData.expiryDate) {
            const close = testData.expiryDate.toDate();
            if (now > close) { showError('This test has expired and is no longer available.'); return; }
        }

        // Load questions
        const qSnap = await db.collection('cbt_questions')
            .where('testId', '==', testId)
            .orderBy('order', 'asc')
            .get();

        questions = qSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        if (questions.length === 0) { showError('This test has no questions yet.'); return; }

        // Check previous attempt
        const attemptSnap = await db.collection('cbt_attempts')
            .where('testId', '==', testId)
            .where('pupilId', '==', currentUser.uid)
            .where('status', '==', 'completed')
            .limit(1)
            .get();

        const alreadyDone = !attemptSnap.empty;

        // Populate start screen
        populateStartScreen(alreadyDone);

        document.getElementById('loading-screen').style.display = 'none';
        document.getElementById('start-screen').style.display = 'flex';

        lucide.createIcons();

    } catch (err) {
        console.error('Error loading test:', err);
        showError('Failed to load test. Please try again.');
    }
}

// ── Populate start screen ──────────────────────────────────────────────────
function populateStartScreen(alreadyDone) {
    document.getElementById('sc-title').textContent   = testData.title;
    document.getElementById('sc-subject').textContent = testData.subject + ' — ' + testData.type;
    document.getElementById('sc-qcount').textContent  = questions.length;
    document.getElementById('sc-time').textContent    = testData.timerMinutes ? testData.timerMinutes + ' min' : 'No limit';
    document.getElementById('sc-class').textContent   = testData.className || '—';
    document.getElementById('sc-term').textContent    = testData.term || '—';

    if (alreadyDone) {
        document.querySelector('.start-btn').disabled = true;
        document.querySelector('.start-btn').style.opacity = '0.5';
        document.querySelector('.start-btn').style.cursor = 'not-allowed';
        document.getElementById('sc-already-done').style.display = 'block';
    }
}

// ── Start Test ─────────────────────────────────────────────────────────────
async function startTest() {
    if (submitted || attemptStarted) return;
    attemptStarted = true;

    // Request fullscreen
    try {
        await document.documentElement.requestFullscreen();
    } catch(e) { /* fullscreen not required, just preferred */ }

    // Create attempt record in Firestore
    try {
        await db.collection('cbt_attempts').add({
            testId,
            pupilId: currentUser.uid,
            status: 'in_progress',
            startedAt: firebase.firestore.FieldValue.serverTimestamp(),
            tabSwitchCount: 0
        });
    } catch(err) {
        console.error('Could not create attempt record:', err);
    }

    // Show test screen
    document.getElementById('start-screen').style.display   = 'none';
    document.getElementById('test-screen').style.display    = 'block';

    // Set topbar info
    document.getElementById('ts-title').textContent = testData.title;
    document.getElementById('ts-meta').textContent  = testData.subject + ' · ' + questions.length + ' questions';

    // Render first question
    renderQuestion(0);
    buildPalette();

    // Start timer
    if (testData.timerMinutes && testData.timerMinutes > 0) {
        secondsLeft = testData.timerMinutes * 60;
        startTimer();
    } else {
        document.getElementById('cbt-timer-display').style.display = 'none';
    }

    // Anti-cheat: tab-switch detection
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('blur', onWindowBlur);

    lucide.createIcons();
}

// ── Timer ──────────────────────────────────────────────────────────────────
function startTimer() {
    updateTimerDisplay();
    timerInterval = setInterval(() => {
        secondsLeft--;
        updateTimerDisplay();
        if (secondsLeft <= 0) {
            clearInterval(timerInterval);
            autoSubmit();
        }
    }, 1000);
}

function updateTimerDisplay() {
    const mins = Math.floor(secondsLeft / 60).toString().padStart(2, '0');
    const secs = (secondsLeft % 60).toString().padStart(2, '0');
    document.getElementById('cbt-timer-text').textContent = mins + ':' + secs;

    const timerEl = document.getElementById('cbt-timer-display');
    timerEl.classList.remove('cbt-timer--warning', 'cbt-timer--danger');
    if (secondsLeft <= 60) timerEl.classList.add('cbt-timer--danger');
    else if (secondsLeft <= 5 * 60) timerEl.classList.add('cbt-timer--warning');
}

// ── Render Question ────────────────────────────────────────────────────────
function renderQuestion(index) {
    currentQ = index;
    const q  = questions[index];

    document.getElementById('q-number').textContent = 'Question ' + (index + 1) + ' of ' + questions.length;
    document.getElementById('q-text').textContent   = q.questionText;

    // Flag button
    const flagBtn = document.getElementById('flag-btn');
    if (flagged.has(index)) {
        flagBtn.classList.add('cbt-flag-btn--flagged');
        flagBtn.innerHTML = '<i data-lucide="flag" style="width:13px;height:13px;"></i> Flagged';
    } else {
        flagBtn.classList.remove('cbt-flag-btn--flagged');
        flagBtn.innerHTML = '<i data-lucide="flag" style="width:13px;height:13px;"></i> Flag for review';
    }

    // Options
    const optionsEl = document.getElementById('q-options');
    optionsEl.innerHTML = '';
    const optionLetters = ['A', 'B', 'C', 'D'];
    const optionKeys    = ['optionA', 'optionB', 'optionC', 'optionD'];

    optionKeys.forEach((key, i) => {
        if (!q[key]) return;
        const letter = optionLetters[i];
        const btn    = document.createElement('button');
        btn.className = 'cbt-option' + (answers[index] === letter ? ' cbt-option--selected' : '');
        btn.innerHTML = `
            <span class="cbt-option-letter">${letter}</span>
            <span>${q[key]}</span>
        `;
        btn.addEventListener('click', () => selectAnswer(index, letter));
        optionsEl.appendChild(btn);
    });

    // Nav buttons
    document.querySelector('.cbt-nav-btn--prev').disabled = (index === 0);

    const nextBtn = document.getElementById('next-btn');
    if (index === questions.length - 1) {
        nextBtn.innerHTML = 'Submit <i data-lucide="send" style="width:14px;height:14px;"></i>';
        nextBtn.className = 'cbt-nav-btn cbt-nav-btn--submit';
        nextBtn.onclick   = confirmSubmit;
    } else {
        nextBtn.innerHTML = 'Next <i data-lucide="arrow-right" style="width:14px;height:14px;"></i>';
        nextBtn.className = 'cbt-nav-btn cbt-nav-btn--next';
        nextBtn.onclick   = nextQuestion;
    }

    // Progress text
    const answered = Object.keys(answers).length;
    document.getElementById('q-progress').textContent = answered + ' of ' + questions.length + ' answered';

    updatePalette();
    updateProgressStats();
    lucide.createIcons();
}

// ── Answer Selection ───────────────────────────────────────────────────────
function selectAnswer(qIndex, letter) {
    answers[qIndex] = letter;
    renderQuestion(qIndex);
}

// ── Flag Toggle ────────────────────────────────────────────────────────────
function toggleFlag() {
    if (flagged.has(currentQ)) flagged.delete(currentQ);
    else flagged.add(currentQ);
    renderQuestion(currentQ);
}

// ── Navigation ─────────────────────────────────────────────────────────────
function nextQuestion() {
    if (currentQ < questions.length - 1) renderQuestion(currentQ + 1);
}

function prevQuestion() {
    if (currentQ > 0) renderQuestion(currentQ - 1);
}

// ── Palette ────────────────────────────────────────────────────────────────
function buildPalette() {
    const grid = document.getElementById('palette-grid');
    grid.innerHTML = '';
    questions.forEach((_, i) => {
        const btn = document.createElement('button');
        btn.className    = 'cbt-palette-btn';
        btn.textContent  = i + 1;
        btn.setAttribute('aria-label', 'Go to question ' + (i + 1));
        btn.addEventListener('click', () => renderQuestion(i));
        grid.appendChild(btn);
    });
    updatePalette();
}

function updatePalette() {
    const btns = document.querySelectorAll('.cbt-palette-btn');
    btns.forEach((btn, i) => {
        btn.classList.remove('cbt-palette-btn--answered', 'cbt-palette-btn--flagged', 'cbt-palette-btn--current');
        if (i === currentQ)         btn.classList.add('cbt-palette-btn--current');
        else if (flagged.has(i))    btn.classList.add('cbt-palette-btn--flagged');
        else if (answers[i])        btn.classList.add('cbt-palette-btn--answered');
    });
}

function updateProgressStats() {
    const total    = questions.length;
    const answered = Object.keys(answers).length;
    const fl       = flagged.size;
    const unanswered = total - answered;
    document.getElementById('progress-stats').innerHTML = `
        <span style="color:#1a56db;font-weight:700;">${answered}</span> answered<br>
        <span style="color:#f59e0b;font-weight:700;">${fl}</span> flagged<br>
        <span style="color:#94a3b8;font-weight:700;">${unanswered}</span> not answered
    `;
}

// ── Anti-cheat ─────────────────────────────────────────────────────────────
function onVisibilityChange() {
    if (document.hidden && !submitted) recordTabSwitch('tab_hidden');
}
function onWindowBlur() {
    if (!submitted) recordTabSwitch('window_blur');
}

async function recordTabSwitch(type) {
    tabSwitchCount++;
    const banner  = document.getElementById('tab-warn-banner');
    const warnTxt = document.getElementById('tab-warn-text');
    banner.style.display = 'flex';
    warnTxt.textContent  = '⚠ Warning: You left this page (' + tabSwitchCount + ' time' + (tabSwitchCount > 1 ? 's' : '') + '). This is recorded.';

    // Log to Firestore
    try {
        await db.collection('cbt_proctoring').add({
            testId,
            pupilId:   currentUser.uid,
            eventType: type,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            switchCount: tabSwitchCount
        });
    } catch(e) { /* non-critical */ }

    lucide.createIcons();
}

// ── Confirm and Submit ─────────────────────────────────────────────────────
function confirmSubmit() {
    const unanswered = questions.length - Object.keys(answers).length;
    let desc = 'Are you sure you want to submit your answers?';
    if (unanswered > 0) {
        desc = `You have ${unanswered} unanswered question${unanswered > 1 ? 's' : ''}. Are you sure you want to submit?`;
    }
    document.getElementById('confirm-desc').textContent = desc;
    document.getElementById('confirm-overlay').style.display = 'flex';
}

function autoSubmit() {
    window.showToast?.('Time is up! Submitting automatically.', 'warning', 4000);
    submitTest();
}

// ── Submit Test ────────────────────────────────────────────────────────────
async function submitTest() {
    if (submitted) return;
    submitted = true;

    document.getElementById('confirm-overlay').style.display = 'none';
    clearInterval(timerInterval);
    document.removeEventListener('visibilitychange', onVisibilityChange);
    window.removeEventListener('blur', onWindowBlur);

    // Exit fullscreen
    try { document.exitFullscreen(); } catch(e) {}

    // Calculate score
    let correct = 0;
    const reviewData = [];

    questions.forEach((q, i) => {
        const pupilAnswer   = answers[i] || null;
        const correctAnswer = q.correctAnswer;
        const isCorrect     = pupilAnswer === correctAnswer;
        if (isCorrect) correct++;
        reviewData.push({
            questionText:  q.questionText,
            optionA: q.optionA, optionB: q.optionB,
            optionC: q.optionC, optionD: q.optionD,
            correctAnswer,
            pupilAnswer,
            isCorrect
        });
    });

    const total     = questions.length;
    const wrong     = Object.keys(answers).filter(i => answers[i] !== questions[i].correctAnswer).length;
    const skipped   = total - Object.keys(answers).length;
    const pct       = Math.round((correct / total) * 100);
    const grade     = getGradeFromPct(pct);
    const timeTaken = testData.timerMinutes
        ? (testData.timerMinutes * 60) - secondsLeft
        : null;

    // Save to Firestore
    try {
        const batch = db.batch();

        // Main result
        const resultRef = db.collection('cbt_results').doc();
        batch.set(resultRef, {
            testId,
            testTitle:   testData.title,
            subject:     testData.subject,
            term:        testData.term,
            session:     testData.session,
            className:   testData.className,
            pupilId:     currentUser.uid,
            score:       correct,
            total,
            percentage:  pct,
            grade,
            timeTakenSec: timeTaken,
            tabSwitches: tabSwitchCount,
            submittedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Per-question review doc
        const reviewRef = db.collection('cbt_reviews').doc();
        batch.set(reviewRef, {
            testId,
            resultId: resultRef.id,
            pupilId:  currentUser.uid,
            answers:  reviewData,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Update attempt status
        const attemptSnap = await db.collection('cbt_attempts')
            .where('testId', '==', testId)
            .where('pupilId', '==', currentUser.uid)
            .where('status', '==', 'in_progress')
            .limit(1)
            .get();

        if (!attemptSnap.empty) {
            batch.update(attemptSnap.docs[0].ref, {
                status: 'completed',
                score:  correct,
                total,
                percentage: pct,
                completedAt: firebase.firestore.FieldValue.serverTimestamp(),
                tabSwitchCount
            });
        }

        await batch.commit();
        showResultScreen({ correct, wrong, skipped, total, pct, grade, reviewData });

    } catch (err) {
        console.error('Error saving result:', err);
        // Still show result to pupil even if save failed
        showResultScreen({ correct, wrong, skipped, total, pct, grade, reviewData });
        window.showToast?.('Your score was calculated but could not be saved. Please contact your teacher.', 'warning', 8000);
    }
}

// ── Result Screen ──────────────────────────────────────────────────────────
function showResultScreen({ correct, wrong, skipped, total, pct, grade, reviewData }) {
    document.getElementById('test-screen').style.display   = 'none';
    document.getElementById('result-screen').style.display = 'block';

    document.getElementById('score-pct').textContent   = pct + '%';
    document.getElementById('result-title').textContent = pct >= 50 ? '🎉 Well done!' : 'Test Complete';
    document.getElementById('result-subtitle').textContent = `You scored ${correct} out of ${total} (${grade})`;
    document.getElementById('r-correct').textContent  = correct;
    document.getElementById('r-wrong').textContent    = wrong;
    document.getElementById('r-skipped').textContent  = skipped;

    const ring = document.getElementById('score-ring');
    ring.classList.remove('cbt-score-ring--pass', 'cbt-score-ring--fail');
    ring.classList.add(pct >= 50 ? 'cbt-score-ring--pass' : 'cbt-score-ring--fail');

    // Store review data for showReview()
    window._cbtReviewData = reviewData;

    lucide.createIcons();
    window.scrollTo(0, 0);
}

// ── Review ─────────────────────────────────────────────────────────────────
function showReview() {
    const container = document.getElementById('review-container');
    const list      = document.getElementById('review-list');
    const data      = window._cbtReviewData || [];

    list.innerHTML = '';
    const letters = ['A','B','C','D'];
    const keys    = ['optionA','optionB','optionC','optionD'];

    data.forEach((item, i) => {
        const div = document.createElement('div');
        div.className = 'review-item';

        let optionsHTML = '';
        keys.forEach((key, ki) => {
            if (!item[key]) return;
            const letter = letters[ki];
            const isPupil   = item.pupilAnswer === letter;
            const isCorrect = item.correctAnswer === letter;
            let cls = '';
            if (isCorrect)                        cls = 'cbt-option--correct';
            else if (isPupil && !isCorrect)       cls = 'cbt-option--incorrect';
            optionsHTML += `
                <div class="cbt-option ${cls}" style="cursor:default;pointer-events:none;margin-bottom:8px;">
                    <span class="cbt-option-letter">${letter}</span>
                    <span>${item[key]}</span>
                    ${isCorrect ? '<span style="margin-left:auto;font-size:11px;font-weight:700;color:#16a34a;">✓ Correct</span>' : ''}
                    ${isPupil && !isCorrect ? '<span style="margin-left:auto;font-size:11px;font-weight:700;color:#dc2626;">✗ Your answer</span>' : ''}
                </div>`;
        });

        div.innerHTML = `
            <div class="review-item__q-num">Question ${i + 1}
                <span style="margin-left:8px;font-size:11px;padding:2px 8px;border-radius:9999px;font-weight:700;
                    background:${item.isCorrect ? '#dcfce7' : '#fee2e2'};
                    color:${item.isCorrect ? '#14532d' : '#7f1d1d'}">
                    ${item.isCorrect ? '✓ Correct' : item.pupilAnswer ? '✗ Incorrect' : '— Skipped'}
                </span>
            </div>
            <div class="review-item__q">${item.questionText}</div>
            <div class="cbt-options">${optionsHTML}</div>
        `;
        list.appendChild(div);
    });

    container.style.display = 'block';
    container.scrollIntoView({ behavior: 'smooth' });
}

// ── Helpers ────────────────────────────────────────────────────────────────
function getGradeFromPct(pct) {
    if (pct >= 75) return 'A1';
    if (pct >= 70) return 'B2';
    if (pct >= 65) return 'B3';
    if (pct >= 60) return 'C4';
    if (pct >= 55) return 'C5';
    if (pct >= 50) return 'C6';
    if (pct >= 45) return 'D7';
    if (pct >= 40) return 'D8';
    return 'F9';
}

function showError(msg) {
    document.getElementById('loading-screen').style.display = 'none';
    document.body.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;padding:20px;">
            <div style="background:#ffffff;border-radius:20px;padding:40px;max-width:460px;text-align:center;box-shadow:0 8px 40px rgba(0,0,0,0.1);">
                <div style="font-size:48px;margin-bottom:16px;">⚠️</div>
                <h2 style="font-family:'Plus Jakarta Sans',sans-serif;font-size:1.3rem;font-weight:800;color:#0f172a;margin-bottom:10px;">Cannot Load Test</h2>
                <p style="font-size:14px;color:#64748b;margin-bottom:24px;">${msg}</p>
                <a href="pupil.html" style="display:inline-block;padding:12px 28px;background:#1a56db;color:white;border-radius:9999px;font-weight:700;text-decoration:none;font-size:14px;">Back to Portal</a>
            </div>
        </div>
    `;
}

// Expose functions used by HTML onclick attributes
window.startTest      = startTest;
window.nextQuestion   = nextQuestion;
window.prevQuestion   = prevQuestion;
window.toggleFlag     = toggleFlag;
window.confirmSubmit  = confirmSubmit;
window.submitTest     = submitTest;
window.showReview     = showReview;

console.log('✓ CBT engine v1.0.0 loaded');
