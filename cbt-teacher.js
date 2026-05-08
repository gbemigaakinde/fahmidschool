/**
 * FAHMID NURSERY & PRIMARY SCHOOL
 * CBT Teacher Module — Create and manage tests
 * @version 1.0.0
 *
 * HOW TO USE:
 * Place this file alongside teacher.js.
 * Add <script src="cbt-teacher.js"></script> in teacher.html AFTER teacher.js.
 * The module auto-attaches to window so teacher.js can call it.
 */
'use strict';

// ── Module state ──────────────────────────────────────────────────────────
let cbtQuestionCount  = 0;
let cbtEditingTestId  = null;
let cbtCurrentSection = 'list'; // 'list' | 'create' | 'manage'

// ── Entry point — called by teacher section loader ─────────────────────────
async function loadCbtSection() {
    const container = document.getElementById('cbt-section-content');
    if (!container) return;

    renderCbtListView(container);
    await loadCbtTests(container);
}

// ── Render the list view shell ─────────────────────────────────────────────
function renderCbtListView(container) {
    container.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:12px;">
            <div>
                <h3 style="font-family:'Plus Jakarta Sans',sans-serif;font-size:1.1rem;font-weight:800;color:#0f172a;margin:0 0 2px;">My Tests &amp; Exams</h3>
                <p style="font-size:13px;color:#64748b;margin:0;">Create and manage online objective tests for your class.</p>
            </div>
            <button class="btn tp-btn-primary" onclick="showCbtCreateForm()">
                <i data-lucide="plus" style="width:16px;height:16px;"></i>
                Create New Test
            </button>
        </div>
        <div id="cbt-tests-list">
            <div style="text-align:center;padding:32px;color:#94a3b8;">
                <div class="spinner" style="margin:0 auto 12px;"></div>
                <p>Loading tests…</p>
            </div>
        </div>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ── Load tests from Firestore ──────────────────────────────────────────────
async function loadCbtTests(container) {
    if (!window.currentUser) return;
    const listEl = document.getElementById('cbt-tests-list');
    if (!listEl) return;

    try {
        const snap = await db.collection('cbt_tests')
            .where('teacherId', '==', window.currentUser.uid)
            .get();

        if (snap.empty) {
            listEl.innerHTML = `
                <div class="cbt-empty">
                    <i data-lucide="clipboard-list"></i>
                    <div class="cbt-empty-title">No tests yet</div>
                    <div class="cbt-empty-desc">Click "Create New Test" to set your first online test.</div>
                </div>`;
            if (typeof lucide !== 'undefined') lucide.createIcons();
            return;
        }

        // Sort client-side: newest first
        const docs = snap.docs.slice().sort((a, b) => {
            const ta = a.data().createdAt?.toMillis?.() || 0;
            const tb = b.data().createdAt?.toMillis?.() || 0;
            return tb - ta;
        });

        listEl.innerHTML = '';

        for (const doc of docs) {
            const t   = doc.data();
            const now = new Date();
            const tid = doc.id;

            let status = 'open';
            let statusLabel = 'Open';
            if (!t.published) { status = 'draft'; statusLabel = 'Draft'; }
            else if (t.expiryDate && t.expiryDate.toDate() < now) { status = 'expired'; statusLabel = 'Expired'; }
            else if (t.scheduledDate && t.scheduledDate.toDate() > now) { status = 'upcoming'; statusLabel = 'Scheduled'; }

            const qSnap = await db.collection('cbt_questions').where('testId', '==', tid).get();
            const qCount = qSnap.size;

            const aSnap = await db.collection('cbt_attempts')
                .where('testId', '==', tid)
                .where('status', '==', 'completed')
                .get();
            const attemptCount = aSnap.size;

            const statusColors = {
                open:     { bg: '#dbeafe', color: '#1e40af', dot: '●' },
                draft:    { bg: '#f1f5f9', color: '#475569', dot: '○' },
                upcoming: { bg: '#fef3c7', color: '#92400e', dot: '⏳' },
                expired:  { bg: '#fee2e2', color: '#991b1b', dot: '✕' }
            };
            const sc = statusColors[status] || statusColors.open;

            const publishBtnStyle = t.published
                ? 'background:#fef3c7;border:1px solid #f59e0b;color:#92400e;'
                : 'background:#dcfce7;border:1px solid #16a34a;color:#14532d;';
            const publishBtnText = t.published ? 'Unpublish' : 'Publish';

            const scheduleHTML = t.scheduledDate
                ? `<div class="cbt-card-date"> Opens: ${t.scheduledDate.toDate().toLocaleString('en-GB', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })}</div>`
                : '';
            const expiryHTML = t.expiryDate
                ? `<div class="cbt-card-date"> Closes: ${t.expiryDate.toDate().toLocaleString('en-GB', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })}</div>`
                : '';

            const card = document.createElement('div');
            card.className = 'cbt-mgr-card';
            card.innerHTML = `
                <div class="cbt-mgr-card__top">
                    <div class="cbt-mgr-card__title-row">
                        <span class="cbt-mgr-card__title">${escHtml(t.title)}</span>
                        <span class="cbt-mgr-status-pill" style="background:${sc.bg};color:${sc.color};">
                            ${sc.dot} ${statusLabel}
                        </span>
                    </div>
                    <div class="cbt-mgr-card__meta">
                        <span> ${escHtml(t.subject || '—')}</span>
                        <span> ${escHtml(t.className || '—')}</span>
                        <span> ${qCount} question${qCount !== 1 ? 's' : ''}</span>
                        <span> ${t.timerMinutes ? t.timerMinutes + ' min' : 'No timer'}</span>
                        <span> ${attemptCount} submitted</span>
                    </div>
                    ${scheduleHTML}${expiryHTML}
                </div>
                <div class="cbt-mgr-card__actions">
                    <button class="cbt-mgr-btn cbt-mgr-btn--edit" data-action="edit" data-id="${tid}">
                        Edit
                    </button>
                    <button class="cbt-mgr-btn cbt-mgr-btn--results" data-action="results" data-id="${tid}" data-title="${escHtml(t.title)}">
                        Results
                    </button>
                    <button class="cbt-mgr-btn cbt-mgr-btn--publish" data-action="publish" data-id="${tid}" data-published="${t.published}" style="${publishBtnStyle}">
                        ${t.published ? 'Unpublish' : 'Publish'}
                    </button>
                    <button class="cbt-mgr-btn cbt-mgr-btn--delete" data-action="delete" data-id="${tid}" data-title="${escHtml(t.title)}">
                        Delete
                    </button>
                </div>
            `;

            // Attach ALL button events here on the element directly — no inline onclick
            card.querySelectorAll('[data-action]').forEach(btn => {
                btn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    const action    = this.dataset.action;
                    const id        = this.dataset.id;
                    const title     = this.dataset.title || '';
                    const published = this.dataset.published === 'true';

                    if (action === 'edit')    editCbtTest(id);
                    if (action === 'results') viewCbtResults(id, title);
                    if (action === 'publish') togglePublish(id, published);
                    if (action === 'delete')  deleteCbtTest(id, title);
                });
            });

            listEl.appendChild(card);
        }

        if (typeof lucide !== 'undefined') lucide.createIcons();

    } catch (err) {
        console.error('Error loading CBT tests:', err);
        if (listEl) listEl.innerHTML = '<p style="color:red;padding:20px;">Error loading tests. Please refresh.</p>';
    }
}

// ── Show Create/Edit Form ──────────────────────────────────────────────────
async function showCbtCreateForm(testId = null) {
    cbtEditingTestId = testId;
    cbtQuestionCount  = 0;

    const container = document.getElementById('cbt-section-content');
    if (!container) return;

    let existingData  = null;
    let existingQs    = [];

    if (testId) {
        const testDoc = await db.collection('cbt_tests').doc(testId).get();
        if (testDoc.exists) existingData = testDoc.data();

        const qSnap = await db.collection('cbt_questions')
            .where('testId', '==', testId)
            .orderBy('order', 'asc')
            .get();
        existingQs = qSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    }

    const classes  = window.assignedClasses || [];
    const settings = await window.getCurrentSettings();

    container.innerHTML = `
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px;">
            <button onclick="loadCbtSection()" class="btn-small btn-secondary">
                <i data-lucide="arrow-left" style="width:13px;height:13px;"></i> Back
            </button>
            <h3 style="font-family:'Plus Jakarta Sans',sans-serif;font-size:1.1rem;font-weight:800;color:#0f172a;margin:0;">
                ${testId ? 'Edit Test' : 'Create New Test'}
            </h3>
        </div>

        <!-- Test Settings -->
        <div class="form-section" style="margin-bottom:20px;">
            <h3 style="margin-top:0;">Test Details</h3>
            <div class="form-row form-row-2">
                <div class="form-group">
                    <label for="cbt-title">Test / Exam Title <span class="required">*</span></label>
                    <input type="text" id="cbt-title" placeholder="e.g. First Term Mathematics Test" value="${escHtml(existingData?.title || '')}">
                </div>
                <div class="form-group">
                    <label for="cbt-subject">Subject <span class="required">*</span></label>
                    <input type="text" id="cbt-subject" placeholder="e.g. Mathematics" value="${escHtml(existingData?.subject || '')}">
                </div>
            </div>
            <div class="form-row form-row-3">
                <div class="form-group">
                    <label for="cbt-type">Type</label>
                    <select id="cbt-type">
                        <option value="Test" ${existingData?.type === 'Test' ? 'selected' : ''}>Test</option>
                        <option value="Exam" ${existingData?.type === 'Exam' ? 'selected' : ''}>Exam</option>
                        <option value="Quiz" ${existingData?.type === 'Quiz' ? 'selected' : ''}>Quiz</option>
                        <option value="Practice" ${existingData?.type === 'Practice' ? 'selected' : ''}>Practice</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="cbt-class">Class <span class="required">*</span></label>
                    <select id="cbt-class">
                        <option value="">— Select Class —</option>
                        ${classes.map(c => `<option value="${c.id}" data-name="${escHtml(c.name)}" ${existingData?.classId === c.id ? 'selected' : ''}>${escHtml(c.name)}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label for="cbt-term">Term</label>
                    <select id="cbt-term">
                        <option value="First Term" ${(existingData?.term || settings.term) === 'First Term' ? 'selected' : ''}>First Term</option>
                        <option value="Second Term" ${(existingData?.term || settings.term) === 'Second Term' ? 'selected' : ''}>Second Term</option>
                        <option value="Third Term" ${(existingData?.term || settings.term) === 'Third Term' ? 'selected' : ''}>Third Term</option>
                    </select>
                </div>
            </div>
            <div class="form-row form-row-3">
                <div class="form-group">
                    <label for="cbt-timer">Timer (minutes, 0 = no limit)</label>
                    <input type="number" id="cbt-timer" min="0" max="300" value="${existingData?.timerMinutes || 0}" placeholder="e.g. 30">
                </div>
                <div class="form-group">
                    <label for="cbt-schedule">Scheduled Open Date &amp; Time (optional)</label>
                    <input type="datetime-local" id="cbt-schedule" value="${existingData?.scheduledDate ? toDatetimeLocalString(existingData.scheduledDate.toDate()) : ''}">
                </div>
                <div class="form-group">
                    <label for="cbt-expiry">Expiry Date &amp; Time (optional)</label>
                    <input type="datetime-local" id="cbt-expiry" value="${existingData?.expiryDate ? toDatetimeLocalString(existingData.expiryDate.toDate()) : ''}">
                </div>
            </div>
            <div class="form-group">
                <label for="cbt-instructions">Additional Instructions (optional)</label>
                <textarea id="cbt-instructions" rows="2" placeholder="Any extra instructions pupils should see before starting…">${escHtml(existingData?.instructions || '')}</textarea>
            </div>
        </div>

        <!-- Question Builder -->
        <div class="form-section">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
                <h3 style="margin:0;">Questions</h3>
                <button class="btn tp-btn-primary" onclick="addCbtQuestion()" style="padding:8px 18px;font-size:13px;">
                    <i data-lucide="plus" style="width:14px;height:14px;"></i>
                    Add Question
                </button>
            </div>
            <div id="cbt-questions-container"></div>
            <p id="cbt-no-q-msg" style="text-align:center;color:#94a3b8;padding:20px;font-size:13px;">No questions yet. Click "Add Question" to start.</p>
        </div>

        <!-- Save Actions -->
        <div style="display:flex;gap:12px;margin-top:20px;flex-wrap:wrap;">
            <button class="btn btn-success" onclick="saveCbtTest(false)">
                <i data-lucide="save" style="width:15px;height:15px;"></i>
                Save as Draft
            </button>
            <button class="btn tp-btn-primary" onclick="saveCbtTest(true)">
                <i data-lucide="send" style="width:15px;height:15px;"></i>
                Save &amp; Publish
            </button>
            <button onclick="loadCbtSection()" class="btn btn-secondary" style="color:#475569;">
                Cancel
            </button>
        </div>
    `;

    if (typeof lucide !== 'undefined') lucide.createIcons();

    // Pre-load existing questions
    if (existingQs.length > 0) {
        existingQs.forEach(q => addCbtQuestion(q));
    }
}

// ── Add question block ─────────────────────────────────────────────────────
function addCbtQuestion(existing = null) {
    const container = document.getElementById('cbt-questions-container');
    const noMsg     = document.getElementById('cbt-no-q-msg');
    if (!container) return;

    if (noMsg) noMsg.style.display = 'none';

    cbtQuestionCount++;
    const n = cbtQuestionCount;

    const div = document.createElement('div');
    div.className   = 'cbt-question-builder';
    div.id          = `cbt-q-${n}`;
    div.dataset.qid = existing?.id || '';

    const opts = ['A','B','C','D'];
    let optionsHTML = '';
    opts.forEach(letter => {
        const key = 'option' + letter;
        const val = existing ? (existing[key] || '') : '';
        const isCorrect = existing?.correctAnswer === letter;
        optionsHTML += `
            <div class="cbt-option-input-row">
                <span class="cbt-option-letter-badge">${letter}</span>
                <input type="text" placeholder="Option ${letter}" value="${escHtml(val)}"
                       id="cbt-q${n}-opt${letter}" style="flex:1;">
                <input type="radio" name="cbt-q${n}-correct" value="${letter}"
                       id="cbt-q${n}-correct${letter}" class="cbt-correct-radio"
                       ${isCorrect ? 'checked' : ''}>
                <label for="cbt-q${n}-correct${letter}" class="cbt-correct-label">Correct</label>
            </div>`;
    });

    div.innerHTML = `
        <button class="cbt-remove-q-btn" onclick="removeCbtQuestion(${n})" title="Remove question">
            <i data-lucide="x" style="width:14px;height:14px;"></i>
        </button>
        <div class="cbt-question-builder__num">Question ${n}</div>
        <div class="form-group" style="margin-bottom:12px;">
            <label for="cbt-q${n}-text" style="font-size:12px;font-weight:600;color:#374151;margin-bottom:4px;">Question Text <span class="required">*</span></label>
            <textarea id="cbt-q${n}-text" rows="2" style="resize:vertical;" placeholder="Type the question here…">${escHtml(existing?.questionText || '')}</textarea>
        </div>
        <div style="margin-bottom:6px;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.07em;">
            Options &nbsp;·&nbsp; <span style="color:#16a34a;">Select the correct answer</span>
        </div>
        ${optionsHTML}
    `;

    container.appendChild(div);
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ── Remove question ────────────────────────────────────────────────────────
function removeCbtQuestion(n) {
    const el = document.getElementById(`cbt-q-${n}`);
    if (el) el.remove();

    const container = document.getElementById('cbt-questions-container');
    const noMsg     = document.getElementById('cbt-no-q-msg');
    if (container && !container.children.length && noMsg) noMsg.style.display = 'block';
}

// ── Save Test ──────────────────────────────────────────────────────────────
async function saveCbtTest(publish = false) {
    // Validate
    const title    = document.getElementById('cbt-title')?.value.trim();
    const subject  = document.getElementById('cbt-subject')?.value.trim();
    const classEl  = document.getElementById('cbt-class');
    const classId  = classEl?.value;
    const className = classEl?.options[classEl.selectedIndex]?.dataset.name || '';
    const term     = document.getElementById('cbt-term')?.value;
    const type     = document.getElementById('cbt-type')?.value;
    const timer    = parseInt(document.getElementById('cbt-timer')?.value) || 0;
    const schedule = document.getElementById('cbt-schedule')?.value;
    const expiry   = document.getElementById('cbt-expiry')?.value;
    const instructions = document.getElementById('cbt-instructions')?.value.trim();

    if (!title)   { window.showToast?.('Please enter a test title.', 'warning'); return; }
    if (!subject) { window.showToast?.('Please enter the subject.', 'warning'); return; }
    if (!classId) { window.showToast?.('Please select a class.', 'warning'); return; }

    // Collect questions
    const questionBlocks = document.querySelectorAll('.cbt-question-builder');
    if (questionBlocks.length === 0) {
        window.showToast?.('Please add at least one question.', 'warning'); return;
    }

    const questions = [];
    let hasError = false;

    questionBlocks.forEach((block, idx) => {
        const n           = block.id.replace('cbt-q-', '');
        const questionText = document.getElementById(`cbt-q${n}-text`)?.value.trim();
        const optA        = document.getElementById(`cbt-q${n}-optA`)?.value.trim();
        const optB        = document.getElementById(`cbt-q${n}-optB`)?.value.trim();
        const optC        = document.getElementById(`cbt-q${n}-optC`)?.value.trim();
        const optD        = document.getElementById(`cbt-q${n}-optD`)?.value.trim();
        const correctRadio = document.querySelector(`input[name="cbt-q${n}-correct"]:checked`);

        if (!questionText) { window.showToast?.(`Question ${idx+1}: Please enter the question text.`, 'warning'); hasError = true; return; }
        if (!optA || !optB) { window.showToast?.(`Question ${idx+1}: Options A and B are required.`, 'warning'); hasError = true; return; }
        if (!correctRadio)   { window.showToast?.(`Question ${idx+1}: Please select the correct answer.`, 'warning'); hasError = true; return; }

        questions.push({
            questionText,
            optionA: optA,
            optionB: optB,
            optionC: optC || null,
            optionD: optD || null,
            correctAnswer: correctRadio.value,
            order: idx,
            existingId: block.dataset.qid || null
        });
    });

    if (hasError) return;

    const settings = await window.getCurrentSettings();

    // Build test data object
    const testDocData = {
        title,
        subject,
        classId,
        className,
        term,
        type,
        timerMinutes: timer,
        instructions,
        published:   publish,
        teacherId:   window.currentUser.uid,
        session:     settings.session,
        updatedAt:   firebase.firestore.FieldValue.serverTimestamp()
    };

    if (schedule) testDocData.scheduledDate = new Date(schedule);
    if (expiry)   testDocData.expiryDate    = new Date(expiry);

    try {
        window.showToast?.('Saving test…', 'info', 3000);

        let testDocId = cbtEditingTestId;

        if (testDocId) {
            // Update existing test
            await db.collection('cbt_tests').doc(testDocId).update(testDocData);
        } else {
            // Create new test
            testDocData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            const ref = await db.collection('cbt_tests').add(testDocData);
            testDocId = ref.id;
        }

        // Upsert questions (delete removed, add/update kept)
        const existingQSnap = await db.collection('cbt_questions')
            .where('testId', '==', testDocId)
            .get();
        const existingQIds = existingQSnap.docs.map(d => d.id);
        const keptIds       = questions.map(q => q.existingId).filter(Boolean);
        const toDelete      = existingQIds.filter(id => !keptIds.includes(id));

        const batch = db.batch();

        // Delete removed questions
        toDelete.forEach(id => {
            batch.delete(db.collection('cbt_questions').doc(id));
        });

        // Add/update questions
        questions.forEach(q => {
            const ref = q.existingId
                ? db.collection('cbt_questions').doc(q.existingId)
                : db.collection('cbt_questions').doc();

            batch.set(ref, {
                testId: testDocId,
                questionText:   q.questionText,
                optionA:        q.optionA,
                optionB:        q.optionB,
                optionC:        q.optionC,
                optionD:        q.optionD,
                correctAnswer:  q.correctAnswer,
                order:          q.order
            }, { merge: true });
        });

        await batch.commit();

        window.showToast?.(`✓ Test ${publish ? 'published' : 'saved as draft'} successfully!`, 'success', 5000);
        await loadCbtSection();

    } catch (err) {
        console.error('Error saving test:', err);
        window.showToast?.('Failed to save test: ' + err.message, 'danger', 8000);
    }
}

// ── Toggle publish ─────────────────────────────────────────────────────────
async function togglePublish(testId, currentlyPublished) {
    try {
        await db.collection('cbt_tests').doc(testId).update({
            published: !currentlyPublished,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        window.showToast?.(`Test ${!currentlyPublished ? 'published' : 'unpublished'}.`, 'success');
        await loadCbtSection();
    } catch(err) {
        window.showToast?.('Failed to update: ' + err.message, 'danger');
    }
}

// ── Delete test ────────────────────────────────────────────────────────────
async function deleteCbtTest(testId, title) {
    if (!confirm(`Delete "${title}"?\n\nThis will permanently delete the test, all questions, and all student results. This cannot be undone.`)) return;

    try {
        const batch = db.batch();

        // Delete questions
        const qSnap = await db.collection('cbt_questions').where('testId','==',testId).get();
        qSnap.forEach(d => batch.delete(d.ref));

        // Delete attempts
        const aSnap = await db.collection('cbt_attempts').where('testId','==',testId).get();
        aSnap.forEach(d => batch.delete(d.ref));

        // Delete results
        const rSnap = await db.collection('cbt_results').where('testId','==',testId).get();
        rSnap.forEach(d => batch.delete(d.ref));

        // Delete reviews
        const revSnap = await db.collection('cbt_reviews').where('testId','==',testId).get();
        revSnap.forEach(d => batch.delete(d.ref));

        // Delete test doc itself
        batch.delete(db.collection('cbt_tests').doc(testId));

        await batch.commit();
        window.showToast?.('Test deleted.', 'success');
        await loadCbtSection();
    } catch(err) {
        window.showToast?.('Delete failed: ' + err.message, 'danger');
    }
}

// ── Edit test ──────────────────────────────────────────────────────────────
async function editCbtTest(testId) {
    await showCbtCreateForm(testId);
}

// ── View Results for a test ────────────────────────────────────────────────
async function viewCbtResults(testId, testTitle) {
    const container = document.getElementById('cbt-section-content');
    if (!container) return;

    container.innerHTML = `
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px;">
            <button onclick="loadCbtSection()" class="btn-small btn-secondary">
                <i data-lucide="arrow-left" style="width:13px;height:13px;"></i> Back
            </button>
            <div>
                <h3 style="font-family:'Plus Jakarta Sans',sans-serif;font-size:1.1rem;font-weight:800;color:#0f172a;margin:0 0 2px;">${escHtml(testTitle)} — Results</h3>
                <p style="font-size:12px;color:#64748b;margin:0;">All submissions for this test</p>
            </div>
        </div>
        <div id="cbt-results-content">
            <div style="text-align:center;padding:32px;color:#94a3b8;">
                <div class="spinner" style="margin:0 auto 12px;"></div>
                <p>Loading results…</p>
            </div>
        </div>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons();

    try {
        const resultsSnap = await db.collection('cbt_results')
            .where('testId', '==', testId)
            .orderBy('submittedAt', 'desc')
            .get();

        const content = document.getElementById('cbt-results-content');

        if (resultsSnap.empty) {
            content.innerHTML = `
                <div class="cbt-empty">
                    <i data-lucide="inbox"></i>
                    <div class="cbt-empty-title">No submissions yet</div>
                    <div class="cbt-empty-desc">No pupils have submitted this test yet.</div>
                </div>`;
            if (typeof lucide !== 'undefined') lucide.createIcons();
            return;
        }

        // Summary stats
        const results = resultsSnap.docs.map(d => d.data());
        const avgPct  = Math.round(results.reduce((sum, r) => sum + r.percentage, 0) / results.length);
        const highest = Math.max(...results.map(r => r.percentage));
        const lowest  = Math.min(...results.map(r => r.percentage));

        let tableRows = '';
        for (const r of results) {
            // Get pupil name
            let pupilName = r.pupilId;
            try {
                const pDoc = await db.collection('pupils').doc(r.pupilId).get();
                if (pDoc.exists) pupilName = pDoc.data().name;
            } catch(e) {}

            const submittedDate = r.submittedAt?.toDate().toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) || '—';
            tableRows += `
                <tr>
                    <td data-label="Pupil">${escHtml(pupilName)}</td>
                    <td data-label="Score" style="text-align:center;font-weight:700;">${r.score}/${r.total}</td>
                    <td data-label="Percentage" style="text-align:center;font-weight:700;color:${r.percentage >= 50 ? '#16a34a' : '#dc2626'};">${r.percentage}%</td>
                    <td data-label="Grade" style="text-align:center;" class="grade-${r.grade}">${r.grade}</td>
                    <td data-label="Tab Switches" style="text-align:center;color:${(r.tabSwitches || 0) > 3 ? '#dc2626' : '#64748b'};">${r.tabSwitches || 0}</td>
                    <td data-label="Submitted">${submittedDate}</td>
                </tr>`;
        }

        content.innerHTML = `
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:20px;">
                <div class="stat-card"><h3>Submissions</h3><div class="stat-number">${results.length}</div></div>
                <div class="stat-card stat-card-primary"><h3>Average</h3><div class="stat-number" style="color:#1a56db!important;-webkit-text-fill-color:#1a56db!important;">${avgPct}%</div></div>
                <div class="stat-card stat-card-primary"><h3>Highest</h3><div class="stat-number" style="color:#16a34a!important;-webkit-text-fill-color:#16a34a!important;">${highest}%</div></div>
                <div class="stat-card stat-card-orange"><h3>Lowest</h3><div class="stat-number">${lowest}%</div></div>
            </div>
            <div class="table-container">
                <table class="responsive-table">
                    <thead>
                        <tr>
                            <th>Pupil</th>
                            <th style="text-align:center;">Score</th>
                            <th style="text-align:center;">Percentage</th>
                            <th style="text-align:center;">Grade</th>
                            <th style="text-align:center;">Tab Switches</th>
                            <th>Submitted</th>
                        </tr>
                    </thead>
                    <tbody>${tableRows}</tbody>
                </table>
            </div>
        `;

    } catch (err) {
        console.error('Error loading results:', err);
        document.getElementById('cbt-results-content').innerHTML = '<p style="color:red;padding:20px;">Error loading results.</p>';
    }
}

// ── Utility ────────────────────────────────────────────────────────────────
function escHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g,'&amp;')
        .replace(/</g,'&lt;')
        .replace(/>/g,'&gt;')
        .replace(/"/g,'&quot;');
}

function toDatetimeLocalString(date) {
    const pad = n => String(n).padStart(2,'0');
    return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// ── Expose ─────────────────────────────────────────────────────────────────
window.loadCbtSection      = loadCbtSection;
window.showCbtCreateForm   = showCbtCreateForm;
window.addCbtQuestion      = addCbtQuestion;
window.removeCbtQuestion   = removeCbtQuestion;
window.saveCbtTest         = saveCbtTest;
window.editCbtTest         = editCbtTest;
window.deleteCbtTest       = deleteCbtTest;
window.togglePublish       = togglePublish;
window.viewCbtResults      = viewCbtResults;

console.log('✓ CBT Teacher module v1.0.0 loaded');
