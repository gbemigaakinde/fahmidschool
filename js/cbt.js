/**
 * FAHMID NURSERY & PRIMARY SCHOOL
 * CBT Engine — Pupil Test-Taking Logic
 * @version 1.4.0 
 */

'use strict';

let testData          = null;   
let questions         = [];    
let answers           = {};   
let flagged           = new Set();
let currentQ          = 0;
let timerInterval     = null;
let secondsLeft       = 0;
let tabSwitchCount    = 0;
let testId            = null;
let currentUser       = null;
let attemptStarted    = false;
let submitted         = false;
let currentAttemptRef = null;
let progressSaveTimer = null;

document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    testId = params.get('testId');

    if (!testId) {
        showError('No test specified. Please go back to the portal.');
        return;
    }

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

function seededRandomGenerator(seedStr) {
    let h = 1779033703 ^ seedStr.length;
    for (let i = 0; i < seedStr.length; i++) {
        h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353);
        h = (h << 13) | (h >>> 19);
    }
    return function() {
        h = Math.imul(h ^ (h >>> 16), 2246822507);
        h = Math.imul(h ^ (h >>> 13), 3266489909);
        h ^= h >>> 16;
        return (h >>> 0) / 4294967296;
    };
}

function seededShuffle(array, seedStr) {
    const rand = seededRandomGenerator(seedStr);
    const arr  = array.slice();
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

// Shuffles questions but keeps every passage group together and in its written order.
// Groups and stand-alone questions are shuffled as units. With no passages this gives the
// exact same order as a plain seeded shuffle, so attempts in progress keep their order.
function groupedSeededShuffle(list, seedStr) {
    const units = [];
    const byId  = {};
    list.forEach(q => {
        const id = q && q.passageId;
        if (!id) { units.push([q]); return; }
        if (!byId[id]) { byId[id] = []; units.push(byId[id]); }
        byId[id].push(q);
    });
    return seededShuffle(units, seedStr).reduce((a, u) => a.concat(u), []);
}

function shuffleQuestionOptions(q, seedStr) {
    if (q.type === 'theory') return q;
    const letters = ['A', 'B', 'C', 'D'];
    const keys    = ['optionA', 'optionB', 'optionC', 'optionD'];

    const pairs = keys
        .map((key, i) => ({ letter: letters[i], text: q[key] }))
        .filter(p => p.text !== null && p.text !== undefined && p.text !== '');

    const shuffledPairs = seededShuffle(pairs, seedStr);

    const newQ = { ...q };
    letters.forEach((letter, i) => {
        newQ['option' + letter] = shuffledPairs[i] ? shuffledPairs[i].text : null;
    });

    const originalCorrectPair = pairs.find(p => p.letter === q.correctAnswer);
    if (originalCorrectPair) {
        const newIndex = shuffledPairs.findIndex(p => p.text === originalCorrectPair.text);
        if (newIndex !== -1) newQ.correctAnswer = letters[newIndex];
    }

    return newQ;
}

function hasAnswer(i) {
    const v = answers[i];
    if (v === undefined || v === null) return false;
    if (typeof v === 'object') return Object.keys(v).length > 0;
    return String(v).trim() !== '';
}
function answeredCount() {
    let n = 0;
    for (let i = 0; i < questions.length; i++) if (hasAnswer(i)) n++;
    return n;
}

async function loadTestData() {
    try {
        const testDoc = await db.collection('cbt_tests').doc(testId).get();
        if (!testDoc.exists) { showError('Test not found.'); return; }

        testData = { id: testDoc.id, ...testDoc.data() };

        if (!testData.published) { showError('This test is not yet available.'); return; }

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

        const qSnap = await db.collection('cbt_questions')
            .where('testId', '==', testId)
            .orderBy('order', 'asc')
            .get();

        questions = qSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        if (questions.length === 0) { showError('This test has no questions yet.'); return; }

        questions = groupedSeededShuffle(questions, currentUser.uid + '_' + testId + '_qorder');

        questions = questions.map(q =>
            shuffleQuestionOptions(q, currentUser.uid + '_' + testId + '_' + q.id)
        );

        const completedSnap = await db.collection('cbt_attempts')
            .where('testId', '==', testId)
            .where('pupilId', '==', currentUser.uid)
            .where('status', '==', 'completed')
            .limit(1)
            .get();

        if (!completedSnap.empty) {
            populateStartScreen(true);
            document.getElementById('loading-screen').style.display = 'none';
            document.getElementById('start-screen').style.display = 'flex';
            lucide.createIcons();
            return;
        }

        const inProgressSnap = await db.collection('cbt_attempts')
            .where('testId', '==', testId)
            .where('pupilId', '==', currentUser.uid)
            .where('status', '==', 'in_progress')
            .limit(1)
            .get();

        if (!inProgressSnap.empty) {
            const attemptDoc = inProgressSnap.docs[0];
            await resumeTest(attemptDoc.id, attemptDoc.data());
            return;
        }

        populateStartScreen(false);
        document.getElementById('loading-screen').style.display = 'none';
        document.getElementById('start-screen').style.display = 'flex';
        lucide.createIcons();

    } catch (err) {
        showError('Failed to load test. Please try again.');
    }
}

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

async function startTest() {
    if (submitted || attemptStarted) return;
    attemptStarted = true;

    // Show a loading state on the button while we set up fullscreen + save the attempt
    const startBtn = document.querySelector('.start-btn');
    if (startBtn) {
        startBtn.disabled = true;
        startBtn.style.opacity = '0.6';
        startBtn.style.cursor = 'not-allowed';
        startBtn.textContent = 'Starting test…';
    }

    try {
        await document.documentElement.requestFullscreen();
    } catch(e) {}

    try {
        const ref = await db.collection('cbt_attempts').add({
            testId,
            pupilId: currentUser.uid,
            status: 'in_progress',
            startedAt: firebase.firestore.FieldValue.serverTimestamp(),
            tabSwitchCount: 0,
            answers: {},
            flaggedIndexes: [],
            currentQ: 0
        });
        currentAttemptRef = ref;
    } catch(err) {}

    document.getElementById('start-screen').style.display   = 'none';
    document.getElementById('test-screen').style.display    = 'block';

    document.getElementById('ts-title').textContent = testData.title;
    document.getElementById('ts-meta').textContent  = testData.subject + ' · ' + questions.length + ' questions';

    renderQuestion(0);
    buildPalette();

    if (testData.timerMinutes && testData.timerMinutes > 0) {
        secondsLeft = testData.timerMinutes * 60;
        startTimer();
    } else {
        document.getElementById('cbt-timer-display').style.display = 'none';
    }

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('blur', onWindowBlur);

    document.addEventListener('keydown', onNavDrawerKeydown);

    lucide.createIcons();
}

async function resumeTest(attemptId, attemptData) {
    attemptStarted = true;
    currentAttemptRef = db.collection('cbt_attempts').doc(attemptId);

    answers        = attemptData.answers || {};
    flagged        = new Set((attemptData.flaggedIndexes || []).map(Number));
    tabSwitchCount = attemptData.tabSwitchCount || 0;
    const savedQ   = typeof attemptData.currentQ === 'number' ? attemptData.currentQ : 0;
    currentQ       = Math.min(Math.max(savedQ, 0), questions.length - 1);

    document.getElementById('loading-screen').style.display = 'none';

    let expiredWhileAway = false;
    if (testData.timerMinutes && testData.timerMinutes > 0) {
        const startedAt = attemptData.startedAt?.toDate ? attemptData.startedAt.toDate() : new Date();
        const elapsedSeconds = Math.floor((Date.now() - startedAt.getTime()) / 1000);
        secondsLeft = (testData.timerMinutes * 60) - elapsedSeconds;
        if (secondsLeft <= 0) {
            secondsLeft = 0;
            expiredWhileAway = true;
        }
    }

    if (expiredWhileAway) {
        window.showToast?.('Time ran out while you were away. Submitting your answers.', 'warning', 5000);
        await submitTest();
        return;
    }

    try { await document.documentElement.requestFullscreen(); } catch(e) {}

    document.getElementById('test-screen').style.display = 'block';
    document.getElementById('ts-title').textContent = testData.title;
    document.getElementById('ts-meta').textContent  = testData.subject + ' · ' + questions.length + ' questions';

    renderQuestion(currentQ);
    buildPalette();

    if (testData.timerMinutes && testData.timerMinutes > 0) {
        startTimer();
    } else {
        document.getElementById('cbt-timer-display').style.display = 'none';
    }

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('blur', onWindowBlur);
    document.addEventListener('keydown', onNavDrawerKeydown);

    window.showToast?.('Welcome back. Your progress has been restored.', 'info', 4000);

    lucide.createIcons();
}

function scheduleProgressSave() {
    clearTimeout(progressSaveTimer);
    progressSaveTimer = setTimeout(saveProgressNow, 800);
}

async function saveProgressNow() {
    if (!currentAttemptRef || submitted) return;
    try {
        await currentAttemptRef.update({
            answers,
            flaggedIndexes: Array.from(flagged),
            currentQ,
            tabSwitchCount,
            lastSavedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (e) {}
}

function toggleNavDrawer(forceState) {
    const sidebar  = document.getElementById('cbt-sidebar');
    const backdrop = document.getElementById('nav-backdrop');
    if (!sidebar || !backdrop) return;

    const shouldOpen = typeof forceState === 'boolean'
        ? forceState
        : !sidebar.classList.contains('active');

    sidebar.classList.toggle('active', shouldOpen);
    backdrop.classList.toggle('active', shouldOpen);
    document.body.style.overflow = shouldOpen ? 'hidden' : '';
}

function closeNavDrawer() {
    toggleNavDrawer(false);
}

function onNavDrawerKeydown(e) {
    if (e.key === 'Escape') closeNavDrawer();
}

window.toggleNavDrawer = toggleNavDrawer;

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

function renderQuestion(index) {
    currentQ = index;
    const q  = questions[index];

    const isTheory = q.type === 'theory';
    document.getElementById('q-number').textContent = 'Question ' + (index + 1) + ' of ' + questions.length +
        (isTheory ? ' · ' + (q.marks || 1) + (Number(q.marks || 1) === 1 ? ' mark' : ' marks') : '');
    document.getElementById('q-text').textContent   = q.questionText;
    renderPassageFor(q, index);

    const flagBtn = document.getElementById('flag-btn');
    if (flagged.has(index)) {
        flagBtn.classList.add('cbt-flag-btn--flagged');
        flagBtn.innerHTML = '<i data-lucide="flag" style="width:13px;height:13px;"></i> Flagged';
    } else {
        flagBtn.classList.remove('cbt-flag-btn--flagged');
        flagBtn.innerHTML = '<i data-lucide="flag" style="width:13px;height:13px;"></i> Flag for review';
    }

    const optionsEl = document.getElementById('q-options');
    optionsEl.innerHTML = '';
    optionsEl.style.display = isTheory ? 'none' : '';
    renderTheoryFor(q, index);
    const optionLetters = ['A', 'B', 'C', 'D'];
    const optionKeys    = ['optionA', 'optionB', 'optionC', 'optionD'];

    optionKeys.forEach((key, i) => {
        if (isTheory || !q[key]) return;
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

    refreshProgress();
    lucide.createIcons();

    scheduleProgressSave();
}

function refreshProgress() {
    document.getElementById('q-progress').textContent = answeredCount() + ' of ' + questions.length + ' answered';
    updatePalette();
    updateProgressStats();
    updateNavToggleCount();
    updateProgressBar();
}

// ── Passages (several question types share one passage) ─────────────────────
const PASSAGE_META = {
    text:     { label: 'Reading passage', icon: 'book-open' },
    cloze:    { label: 'Cloze passage',   icon: 'type' },
    poem:     { label: 'Poem',            icon: 'feather' },
    dialogue: { label: 'Dialogue',        icon: 'messages-square' },
    table:    { label: 'Data table',      icon: 'table' },
    image:    { label: 'Picture',         icon: 'image' }
};

function cbtEsc(str) {
    return String(str == null ? '' : str)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function getPassage(id) {
    return (testData && Array.isArray(testData.passages) ? testData.passages : []).find(p => p.id === id) || null;
}

function passageBodyHtml(p) {
    const text = p.text || '';
    if (p.type === 'table') {
        const rows = text.split('\n').map(r => r.trim()).filter(Boolean).map(r => r.split('|').map(c => c.trim()));
        if (rows.length) {
            const head = rows[0].map(c => '<th>' + cbtEsc(c) + '</th>').join('');
            const body = rows.slice(1).map(r => '<tr>' + r.map(c => '<td>' + cbtEsc(c) + '</td>').join('') + '</tr>').join('');
            return '<div class="cbt-passage__tablewrap"><table class="cbt-passage__table"><thead><tr>' + head + '</tr></thead><tbody>' + body + '</tbody></table></div>';
        }
    }
    if (p.type === 'image') {
        const url = /^https?:\/\//i.test(p.imageUrl || '') ? p.imageUrl : '';
        return (url ? '<img class="cbt-passage__img" src="' + cbtEsc(url) + '" alt="' + cbtEsc(p.title || 'Passage picture') + '">' : '') +
               (text ? '<div class="cbt-passage__text">' + cbtEsc(text) + '</div>' : '');
    }
    if (p.type === 'dialogue') {
        return '<div class="cbt-passage__text cbt-passage__text--dialogue">' + text.split('\n').filter(l => l.trim()).map(line => {
            const m = line.match(/^([^:]{1,30}):\s*(.*)$/);
            return m ? '<p><strong>' + cbtEsc(m[1]) + ':</strong> ' + cbtEsc(m[2]) + '</p>' : '<p>' + cbtEsc(line) + '</p>';
        }).join('') + '</div>';
    }
    return '<div class="cbt-passage__text cbt-passage__text--' + cbtEsc(p.type || 'text') + '">' + cbtEsc(text) + '</div>';
}

function syncPassageMore(body) {
    const wrap = body.parentNode;
    const more = body.scrollHeight - body.clientHeight - body.scrollTop > 12;
    wrap.classList.toggle('has-more', more);
}

function renderPassageFor(q, index) {
    let host = document.getElementById('q-passage');
    if (!host) {
        host = document.createElement('div');
        host.id = 'q-passage';
        const qt = document.getElementById('q-text');
        qt.parentNode.insertBefore(host, qt);
    }
    const p = q.passageId ? getPassage(q.passageId) : null;
    if (!p) { host.innerHTML = ''; host.dataset.pid = ''; return; }

    let pos = 0, tot = 0;
    questions.forEach((x, i) => { if (x.passageId === q.passageId) { tot++; if (i <= index) pos++; } });

    if (host.dataset.pid === p.id) {
        // Same passage as the previous question: keep it (and the reader's scroll position) as is.
        const c = host.querySelector('.cbt-passage__count');
        if (c) { c.textContent = 'Q ' + pos + ' of ' + tot; c.style.display = tot > 1 ? '' : 'none'; }
        return;
    }
    host.dataset.pid = p.id;
    const meta = PASSAGE_META[p.type] || PASSAGE_META.text;
    host.innerHTML =
        '<section class="cbt-passage">' +
          '<div class="cbt-passage__head">' +
            '<span class="cbt-passage__icon"><i data-lucide="' + meta.icon + '" style="width:14px;height:14px;"></i></span>' +
            '<span class="cbt-passage__title">' + cbtEsc(p.title || meta.label) + '</span>' +
            '<span class="cbt-passage__count" style="' + (tot > 1 ? '' : 'display:none;') + '">Q ' + pos + ' of ' + tot + '</span>' +
          '</div>' +
          '<div class="cbt-passage__wrap">' +
            '<div class="cbt-passage__body" tabindex="0">' + passageBodyHtml(p) + '</div>' +
            '<div class="cbt-passage__more" aria-hidden="true"><span>Scroll to read more</span></div>' +
          '</div>' +
        '</section>';
    const body = host.querySelector('.cbt-passage__body');
    body.addEventListener('scroll', () => syncPassageMore(body), { passive: true });
    requestAnimationFrame(() => syncPassageMore(body));
    setTimeout(() => syncPassageMore(body), 300);
}

// ── Theory questions ────────────────────────────────────────────────────────
function normAns(s) {
    return String(s == null ? '' : s).toLowerCase()
        .replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"')
        .replace(/\s+/g, ' ').trim().replace(/[.,;:!?]+$/, '').trim();
}
function matchesAccepted(value, accepted) {
    const v = normAns(value);
    if (!v) return false;
    return (accepted || []).some(a => normAns(a) === v);
}

function renderTheoryFor(q, index) {
    let host = document.getElementById('q-theory');
    if (!host) {
        host = document.createElement('div');
        host.id = 'q-theory';
        const opts = document.getElementById('q-options');
        opts.parentNode.insertBefore(host, opts.nextSibling);
        host.addEventListener('input', onTheoryInput);
        host.addEventListener('click', onTheoryClick);
    }
    if (q.type !== 'theory') { host.innerHTML = ''; return; }

    const a = answers[index];
    let html = '';

    if (q.theoryType === 'short') {
        html = '<input type="text" class="cbt-theory-input" data-sub="" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Type your answer here" value="' + cbtEsc(typeof a === 'string' ? a : '') + '">';
    } else if (q.theoryType === 'essay') {
        const val = typeof a === 'string' ? a : '';
        html = '<textarea class="cbt-theory-input cbt-theory-input--essay" data-sub="" rows="9" placeholder="Write your answer here…">' + cbtEsc(val) + '</textarea>' +
               '<div class="cbt-theory-wc" id="q-wordcount">' + countWords(val) + ' words</div>';
    } else if (q.theoryType === 'gap') {
        const vals = (a && typeof a === 'object') ? a : {};
        const answersList = q.gapAnswers || [];
        const parts = String(q.gapTemplate || '').split(/\{\{(\d+)\}\}/);
        let body = '';
        parts.forEach((seg, i) => {
            if (i % 2 === 0) { body += cbtEsc(seg); return; }
            const gi = Number(seg);
            const longest = Math.max(4, ...((answersList[gi] && answersList[gi].answers) || ['abcd']).map(x => String(x).length));
            body += '<input type="text" class="cbt-gap-input" data-sub="' + gi + '" aria-label="Gap ' + (gi + 1) + '" autocomplete="off" autocapitalize="off" spellcheck="false" ' +
                    'style="width:' + Math.min(Math.max(longest + 3, 7), 28) + 'ch;" placeholder="(' + (gi + 1) + ')" value="' + cbtEsc(vals[gi] || '') + '">';
        });
        const bank = String(q.wordBank || '').split(',').map(x => x.trim()).filter(Boolean);
        html = (bank.length ? '<div class="cbt-wordbank"><span class="cbt-wordbank__label">Word bank</span>' +
                    bank.map(w => '<button type="button" class="cbt-wordbank__chip" data-word="' + cbtEsc(w) + '">' + cbtEsc(w) + '</button>').join('') + '</div>' : '') +
               '<div class="cbt-gap-text">' + body + '</div>';
    } else if (q.theoryType === 'parts') {
        const vals = (a && typeof a === 'object') ? a : {};
        html = (q.parts || []).map((pt, i) =>
            '<div class="cbt-part">' +
              '<div class="cbt-part__head"><span class="cbt-part__label">(' + String.fromCharCode(97 + i) + ')</span>' +
              '<span class="cbt-part__prompt">' + cbtEsc(pt.prompt) + '</span>' +
              '<span class="cbt-part__marks">' + (pt.marks || 1) + (Number(pt.marks || 1) === 1 ? ' mark' : ' marks') + '</span></div>' +
              '<textarea class="cbt-theory-input" data-sub="' + i + '" rows="3" placeholder="Your answer to part (' + String.fromCharCode(97 + i) + ')">' + cbtEsc(vals[i] || '') + '</textarea>' +
            '</div>').join('');
    }
    host.innerHTML = '<div class="cbt-theory cbt-theory--' + cbtEsc(q.theoryType || 'short') + '">' + html + '</div>';
}

function countWords(t) { const m = String(t || '').trim().match(/\S+/g); return m ? m.length : 0; }

function setTheoryAnswer(index, sub, value) {
    if (sub === '' || sub === null) {
        if (String(value).trim() === '') delete answers[index]; else answers[index] = value;
    } else {
        const o = (answers[index] && typeof answers[index] === 'object') ? answers[index] : {};
        if (String(value).trim() === '') delete o[sub]; else o[sub] = value;
        if (Object.keys(o).length) answers[index] = o; else delete answers[index];
    }
    refreshProgress();
    scheduleProgressSave();
}

function onTheoryInput(e) {
    const el = e.target;
    if (!el.matches || !el.matches('[data-sub]')) return;
    setTheoryAnswer(currentQ, el.getAttribute('data-sub'), el.value);
    const wc = document.getElementById('q-wordcount');
    if (wc && el.classList.contains('cbt-theory-input--essay')) wc.textContent = countWords(el.value) + ' words';
}

let _lastGapInput = null;
document.addEventListener('focusin', e => {
    if (e.target && e.target.classList && e.target.classList.contains('cbt-gap-input')) _lastGapInput = e.target;
});

function onTheoryClick(e) {
    const chip = e.target.closest && e.target.closest('.cbt-wordbank__chip');
    if (!chip) return;
    const host = document.getElementById('q-theory');
    const inputs = Array.from(host.querySelectorAll('.cbt-gap-input'));
    let target = (_lastGapInput && host.contains(_lastGapInput) && !_lastGapInput.value) ? _lastGapInput : inputs.find(i => !i.value);
    if (!target) target = _lastGapInput && host.contains(_lastGapInput) ? _lastGapInput : inputs[0];
    if (!target) return;
    target.value = chip.getAttribute('data-word');
    setTheoryAnswer(currentQ, target.getAttribute('data-sub'), target.value);
    const next = inputs.find(i => !i.value);
    (next || target).focus();
}

// Marks one question. Auto-markable parts are marked here; the rest wait for the teacher.
function gradeTheory(q, a) {
    const items = [];
    const marks = Number(q.marks) || 1;
    if (q.theoryType === 'short') {
        const accepted = (q.acceptedAnswers || []).filter(x => String(x).trim());
        const ans = typeof a === 'string' ? a : '';
        const auto = accepted.length > 0;
        items.push({ label: '', answer: ans, accepted, max: marks, auto, pending: !auto,
                     earned: auto && matchesAccepted(ans, accepted) ? marks : 0 });
    } else if (q.theoryType === 'essay') {
        items.push({ label: '', answer: typeof a === 'string' ? a : '', accepted: [], max: marks, auto: false, pending: true, earned: 0 });
    } else if (q.theoryType === 'gap') {
        const per = Number(q.gapMarks) || 1;
        (q.gapAnswers || []).forEach((g, i) => {
            const ans = a && typeof a === 'object' ? (a[i] || '') : '';
            const accepted = (g && g.answers) || [];
            items.push({ label: 'Gap ' + (i + 1), answer: ans, accepted, max: per, auto: true, pending: false,
                         earned: matchesAccepted(ans, accepted) ? per : 0 });
        });
    } else if (q.theoryType === 'parts') {
        (q.parts || []).forEach((pt, i) => {
            const ans = a && typeof a === 'object' ? (a[i] || '') : '';
            const accepted = (pt.accepted || []).filter(x => String(x).trim());
            const pm = Number(pt.marks) || 1;
            const auto = accepted.length > 0;
            items.push({ label: '(' + String.fromCharCode(97 + i) + ') ' + (pt.prompt || ''), answer: ans, accepted, max: pm, auto, pending: !auto,
                         earned: auto && matchesAccepted(ans, accepted) ? pm : 0 });
        });
    }
    const max = items.reduce((t, it) => t + it.max, 0);
    const earned = items.reduce((t, it) => t + (it.pending ? 0 : it.earned), 0);
    const pending = items.some(it => it.pending);
    return { items, max, earned, pending };
}

function selectAnswer(qIndex, letter) {
    answers[qIndex] = letter;
    renderQuestion(qIndex);
}

function toggleFlag() {
    if (flagged.has(currentQ)) flagged.delete(currentQ);
    else flagged.add(currentQ);
    renderQuestion(currentQ);
}

function nextQuestion() {
    if (currentQ < questions.length - 1) renderQuestion(currentQ + 1);
}

function prevQuestion() {
    if (currentQ > 0) renderQuestion(currentQ - 1);
}

function buildPalette() {
    const grid = document.getElementById('palette-grid');
    grid.innerHTML = '';
    questions.forEach((_, i) => {
        const btn = document.createElement('button');
        btn.className    = 'cbt-palette-btn';
        btn.textContent  = i + 1;
        btn.setAttribute('aria-label', 'Go to question ' + (i + 1));
        btn.addEventListener('click', () => {
            renderQuestion(i);
            closeNavDrawer();
        });
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
        else if (hasAnswer(i))      btn.classList.add('cbt-palette-btn--answered');
    });
}

function updateProgressStats() {
    const total    = questions.length;
    const answered = answeredCount();
    const fl       = flagged.size;
    const unanswered = total - answered;
    document.getElementById('progress-stats').innerHTML = `
        <span style="color:#1a56db;font-weight:700;">${answered}</span> answered<br>
        <span style="color:#f59e0b;font-weight:700;">${fl}</span> flagged<br>
        <span style="color:#94a3b8;font-weight:700;">${unanswered}</span> not answered
    `;
}

function updateNavToggleCount() {
    const el = document.getElementById('nav-toggle-count');
    if (!el) return;
    el.textContent = answeredCount() + '/' + questions.length;
}

function updateProgressBar() {
    const fill = document.getElementById('progress-bar-fill');
    if (!fill || !questions.length) return;
    const pct = Math.round((answeredCount() / questions.length) * 100);
    fill.style.width = pct + '%';
}

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
    warnTxt.textContent  = 'You left this page (' + tabSwitchCount + ' time' + (tabSwitchCount > 1 ? 's' : '') + '). This has been recorded.';

    try {
        await db.collection('cbt_proctoring').add({
            testId,
            pupilId:   currentUser.uid,
            eventType: type,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            switchCount: tabSwitchCount
        });
    } catch(e) {}

    scheduleProgressSave();

    lucide.createIcons();
}

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

function showSubmittingOverlay() {
    if (document.getElementById('cbt-submitting-overlay')) return;
    const overlay = document.createElement('div');
    overlay.id = 'cbt-submitting-overlay';
    overlay.className = 'cbt-submitting-overlay';
    overlay.innerHTML = `
        <div class="cbt-submitting-card">
            <div class="cbt-submitting-text">Submitting your answers…</div>
        </div>
    `;
    document.body.appendChild(overlay);
}

function hideSubmittingOverlay() {
    const overlay = document.getElementById('cbt-submitting-overlay');
    if (overlay) overlay.remove();
}

async function submitTest() {
    if (submitted) return;
    submitted = true;

    clearTimeout(progressSaveTimer);
    document.getElementById('confirm-overlay').style.display = 'none';
    clearInterval(timerInterval);
    document.removeEventListener('visibilitychange', onVisibilityChange);
    window.removeEventListener('blur', onWindowBlur);
    document.removeEventListener('keydown', onNavDrawerKeydown);
    closeNavDrawer();

    try { document.exitFullscreen(); } catch(e) {}

    showSubmittingOverlay();

    let correct = 0;      // questions fully correct
    let wrong   = 0;
    let skipped = 0;
    let earnedMarks = 0;
    let totalMarks  = 0;
    let pendingMarks = 0;
    const reviewData = [];

    questions.forEach((q, i) => {
        const answered = hasAnswer(i);
        if (!answered) skipped++;

        if (q.type === 'theory') {
            const g = gradeTheory(q, answers[i]);
            totalMarks  += g.max;
            earnedMarks += g.earned;
            g.items.forEach(it => { if (it.pending) pendingMarks += it.max; });
            const full = !g.pending && g.earned === g.max;
            if (full) correct++; else if (answered && !g.pending) wrong++;
            reviewData.push({
                type: 'theory',
                theoryType: q.theoryType || 'short',
                questionText: q.questionText,
                passageId: q.passageId || null,
                marks: g.max,
                earned: g.earned,
                pending: g.pending,
                items: g.items,
                modelAnswer: q.modelAnswer || null,
                gapTemplate: q.theoryType === 'gap' ? (q.gapTemplate || null) : null,
                isCorrect: g.pending ? null : full,
                pupilAnswer: answered ? 'answered' : null,
                flagged: flagged.has(i)
            });
            return;
        }

        const pupilAnswer   = answers[i] || null;
        const correctAnswer = q.correctAnswer;
        const isCorrect     = pupilAnswer === correctAnswer;
        totalMarks += 1;
        if (isCorrect) { correct++; earnedMarks += 1; }
        else if (pupilAnswer) wrong++;
        reviewData.push({
            type: 'mcq',
            marks: 1,
            earned: isCorrect ? 1 : 0,
            passageId: q.passageId || null,
            questionText:  q.questionText,
            optionA: q.optionA ?? null, optionB: q.optionB ?? null,
            optionC: q.optionC ?? null, optionD: q.optionD ?? null,
            correctAnswer: correctAnswer ?? null,
            pupilAnswer,
            isCorrect,
            flagged: flagged.has(i)
        });
    });

    const total     = totalMarks;
    const pendingReview = pendingMarks > 0;
    const pct       = total ? Math.round((earnedMarks / total) * 100) : 0;
    const grade     = getGradeFromPct(pct);
    const timeTaken = testData.timerMinutes
        ? (testData.timerMinutes * 60) - secondsLeft
        : null;

    try {
        const batch = db.batch();

        const resultRef = db.collection('cbt_results').doc();
        batch.set(resultRef, {
            testId,
            testTitle:   testData.title,
            subject:     testData.subject,
            term:        testData.term,
            session:     testData.session,
            className:   testData.className,
            pupilId:     currentUser.uid,
            score:       earnedMarks,
            total,
            percentage:  pct,
            grade,
            pendingReview,
            pendingMarks,
            hasTheory:   questions.some(q => q.type === 'theory'),
            timeTakenSec: timeTaken,
            tabSwitches: tabSwitchCount,
            flaggedCount: flagged.size,
            submittedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        const reviewRef = db.collection('cbt_reviews').doc();
        batch.set(reviewRef, {
            testId,
            resultId: resultRef.id,
            pupilId:  currentUser.uid,
            answers:  reviewData,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        let attemptRefToUpdate = currentAttemptRef;
        if (!attemptRefToUpdate) {
            const attemptSnap = await db.collection('cbt_attempts')
                .where('testId', '==', testId)
                .where('pupilId', '==', currentUser.uid)
                .where('status', '==', 'in_progress')
                .limit(1)
                .get();
            if (!attemptSnap.empty) attemptRefToUpdate = attemptSnap.docs[0].ref;
        }

        if (attemptRefToUpdate) {
            batch.update(attemptRefToUpdate, {
                status: 'completed',
                score:  earnedMarks,
                total,
                percentage: pct,
                completedAt: firebase.firestore.FieldValue.serverTimestamp(),
                tabSwitchCount
            });
        }

        await batch.commit();
        hideSubmittingOverlay();
        showResultScreen({ correct, wrong, skipped, total, pct, grade, reviewData, earnedMarks, pendingMarks });

    } catch (err) {
        hideSubmittingOverlay();
        showResultScreen({ correct, wrong, skipped, total, pct, grade, reviewData, earnedMarks, pendingMarks });
        window.showToast?.('Your score was calculated but could not be saved. Please contact your teacher.', 'warning', 8000);
    }
}

function showResultScreen({ correct, wrong, skipped, total, pct, grade, reviewData, earnedMarks, pendingMarks }) {
    document.getElementById('test-screen').style.display   = 'none';
    document.getElementById('result-screen').style.display = 'block';

    document.getElementById('score-pct').textContent   = pct + '%';

    const titleEl = document.getElementById('result-title');
    if (pendingMarks > 0) {
        titleEl.innerHTML = '<i data-lucide="clock" style="width:20px;height:20px;vertical-align:-4px;margin-right:6px;color:#d97706;"></i>Test Submitted';
    } else if (pct >= 50) {
        titleEl.innerHTML = '<i data-lucide="check-circle" style="width:20px;height:20px;vertical-align:-4px;margin-right:6px;color:#16a34a;"></i>Well done';
    } else {
        titleEl.textContent = 'Test Complete';
    }

    document.getElementById('result-subtitle').textContent = pendingMarks > 0
        ? `You have ${earnedMarks} out of ${total} marks so far. ${pendingMarks} mark${pendingMarks === 1 ? '' : 's'} of written answers will be marked by your teacher, so your final score may go up.`
        : `You scored ${earnedMarks} out of ${total} (${grade})`;
    document.getElementById('r-correct').textContent  = correct;
    document.getElementById('r-wrong').textContent    = wrong;
    document.getElementById('r-skipped').textContent  = skipped;

    const ring = document.getElementById('score-ring');
    ring.classList.remove('cbt-score-ring--pass', 'cbt-score-ring--fail');
    ring.classList.add(pendingMarks > 0 ? 'cbt-score-ring--pass' : (pct >= 50 ? 'cbt-score-ring--pass' : 'cbt-score-ring--fail'));

    window._cbtReviewData = reviewData;

    lucide.createIcons();
    window.scrollTo(0, 0);
}

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

        if (item.type === 'theory') {
            const pTitle = item.passageId && getPassage(item.passageId) ? (getPassage(item.passageId).title || PASSAGE_META[getPassage(item.passageId).type]?.label || 'Passage') : '';
            const badge = item.pending
                ? '<span class="cbt-rv-badge cbt-rv-badge--pending">Awaiting marking</span>'
                : '<span class="cbt-rv-badge ' + (item.earned === item.marks ? 'cbt-rv-badge--ok' : item.earned > 0 ? 'cbt-rv-badge--part' : 'cbt-rv-badge--bad') + '">' + item.earned + '/' + item.marks + ' marks</span>';
            const itemsHtml = (item.items || []).map(it =>
                '<div class="cbt-rv-item">' +
                  (it.label ? '<div class="cbt-rv-item__label">' + cbtEsc(it.label) + '</div>' : '') +
                  '<div class="cbt-rv-item__ans">' + (it.answer ? cbtEsc(it.answer) : '<em>No answer</em>') + '</div>' +
                  (it.auto && it.earned < it.max && (it.accepted || []).length ? '<div class="cbt-rv-item__acc">Correct answer: ' + cbtEsc(it.accepted[0]) + '</div>' : '') +
                  (it.pending ? '<div class="cbt-rv-item__acc">Waiting for your teacher</div>' : '<div class="cbt-rv-item__acc">' + it.earned + '/' + it.max + '</div>') +
                '</div>').join('');
            div.innerHTML =
                '<div class="review-item__q-num">Question ' + (i + 1) + ' ' + badge +
                (item.flagged ? '<span style="margin-left:6px;font-size:11px;padding:2px 8px;border-radius:9999px;font-weight:700;background:#fef3c7;color:#92400e;">Flagged</span>' : '') + '</div>' +
                (pTitle ? '<div class="cbt-rv-passage">Passage: ' + cbtEsc(pTitle) + '</div>' : '') +
                '<div class="review-item__q">' + cbtEsc(item.questionText) + '</div>' + itemsHtml +
                (item.modelAnswer ? '<div class="cbt-rv-model"><strong>Marking guide:</strong> ' + cbtEsc(item.modelAnswer) + '</div>' : '');
            list.appendChild(div);
            return;
        }

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
                    ${isCorrect ? '<span style="margin-left:auto;font-size:11px;font-weight:700;color:#16a34a;">Correct</span>' : ''}
                    ${isPupil && !isCorrect ? '<span style="margin-left:auto;font-size:11px;font-weight:700;color:#dc2626;">Your answer</span>' : ''}
                </div>`;
        });

        div.innerHTML = `
            <div class="review-item__q-num">Question ${i + 1}
                <span style="margin-left:8px;font-size:11px;padding:2px 8px;border-radius:9999px;font-weight:700;
                    background:${item.isCorrect ? '#dcfce7' : '#fee2e2'};
                    color:${item.isCorrect ? '#14532d' : '#7f1d1d'}">
                    ${item.isCorrect ? 'Correct' : item.pupilAnswer ? 'Incorrect' : 'Skipped'}
                </span>
                ${item.flagged ? '<span style="margin-left:6px;font-size:11px;padding:2px 8px;border-radius:9999px;font-weight:700;background:#fef3c7;color:#92400e;">Flagged</span>' : ''}
            </div>
            <div class="review-item__q">${item.questionText}</div>
            <div class="cbt-options">${optionsHTML}</div>
        `;
        list.appendChild(div);
    });

    container.style.display = 'block';
    container.scrollIntoView({ behavior: 'smooth' });
}

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
                <div style="width:56px;height:56px;border-radius:50%;background:#fef2f2;color:#dc2626;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;">
                    <i data-lucide="alert-triangle" style="width:26px;height:26px;"></i>
                </div>
                <h2 style="font-family:'Plus Jakarta Sans',sans-serif;font-size:1.3rem;font-weight:800;color:#0f172a;margin-bottom:10px;">Cannot Load Test</h2>
                <p style="font-size:14px;color:#64748b;margin-bottom:24px;">${msg}</p>
                <a href="pupil.html" style="display:inline-block;padding:12px 28px;background:#1a56db;color:white;border-radius:9999px;font-weight:700;text-decoration:none;font-size:14px;">Back to Portal</a>
            </div>
        </div>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

window.startTest      = startTest;
window.nextQuestion   = nextQuestion;
window.prevQuestion   = prevQuestion;
window.toggleFlag     = toggleFlag;
window.confirmSubmit  = confirmSubmit;
window.submitTest     = submitTest;
window.showReview     = showReview;
