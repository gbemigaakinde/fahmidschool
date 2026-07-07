/**
 * FAHMID NURSERY & PRIMARY SCHOOL
 * CBT Teacher Module — Create and manage tests
 * @version 1.5.0 — Results table now sortable (latest, oldest, score, name)
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

// Store test metadata keyed by doc ID so buttons can look it up safely
const _cbtTestMap = new Map();

// Store per-result data keyed by result doc ID — pupil name plus the score
// summary fields — so the attempt-review modal can render its header
// instantly without a second round trip to Firestore.
const _cbtResultMap = new Map();

// Holds the full fetched (and pupil-name-resolved) results array for the
// test currently being viewed, plus which sort is active — so switching
// sort order is a pure client-side re-render with zero extra Firestore reads.
let _cbtResultsCache = {
    testId: null,
    results: [],   // [{ id, ...resultData, pupilName }]
    sortBy: 'latest'
};

async function loadCbtTests(container) {
    if (!window.currentUser) return;
    const listEl = document.getElementById('cbt-tests-list');
    if (!listEl) return;

    _cbtTestMap.clear();

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

        const docs = snap.docs.slice().sort((a, b) => {
            const ta = a.data().createdAt?.toMillis?.() || 0;
            const tb = b.data().createdAt?.toMillis?.() || 0;
            return tb - ta;
        });

        listEl.innerHTML = '';

        for (const doc of docs) {
            const t   = doc.data();
            const tid = doc.id;
            const now = new Date();

            // Store in map for safe retrieval on button click
            _cbtTestMap.set(tid, { ...t, id: tid });

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
                open:     { bg: '#dbeafe', color: '#1e40af' },
                draft:    { bg: '#f1f5f9', color: '#475569' },
                upcoming: { bg: '#fef3c7', color: '#92400e' },
                expired:  { bg: '#fee2e2', color: '#991b1b' }
            };
            const sc = statusColors[status] || statusColors.open;

            const publishBtnStyle = t.published
                ? 'background:#fef3c7;border:1px solid #f59e0b;color:#92400e;'
                : 'background:#dcfce7;border:1px solid #16a34a;color:#14532d;';

            const scheduleHTML = t.scheduledDate
                ? `<div class="cbt-card-date">Opens: ${t.scheduledDate.toDate().toLocaleString('en-GB', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })}</div>`
                : '';
            const expiryHTML = t.expiryDate
                ? `<div class="cbt-card-date">Closes: ${t.expiryDate.toDate().toLocaleString('en-GB', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })}</div>`
                : '';

            const card = document.createElement('div');
            card.className = 'cbt-mgr-card';

            // Title is set via textContent after creation — never via innerHTML
            // so no character in the title can ever break the HTML structure
            card.innerHTML = `
                <div class="cbt-mgr-card__top">
                    <div class="cbt-mgr-card__title-row">
                        <span class="cbt-mgr-card__title" data-title-slot></span>
                        <span class="cbt-mgr-status-pill" style="background:${sc.bg};color:${sc.color};">
                            <span class="cbt-status-dot" aria-hidden="true"></span>${statusLabel}
                        </span>
                    </div>
                    <div class="cbt-mgr-card__meta">
                        <span><span data-subject-slot></span></span>
                        <span><span data-class-slot></span></span>
                        <span>${qCount} question${qCount !== 1 ? 's' : ''}</span>
                        <span>${t.timerMinutes ? t.timerMinutes + ' min' : 'No timer'}</span>
                        <span>${attemptCount} submitted</span>
                    </div>
                    ${scheduleHTML}${expiryHTML}
                </div>
                <div class="cbt-mgr-card__actions">
                    <button class="cbt-mgr-btn cbt-mgr-btn--edit" data-tid="${tid}" data-action="edit">
                        <i data-lucide="pencil" style="width:13px;height:13px;" aria-hidden="true"></i>
                        Edit
                    </button>
                    <button class="cbt-mgr-btn cbt-mgr-btn--results" data-tid="${tid}" data-action="results">
                        <i data-lucide="bar-chart-2" style="width:13px;height:13px;" aria-hidden="true"></i>
                        Results
                    </button>
                    <button class="cbt-mgr-btn cbt-mgr-btn--publish" data-tid="${tid}" data-action="publish" style="${publishBtnStyle}">
                        <i data-lucide="${t.published ? 'eye-off' : 'send'}" style="width:13px;height:13px;" aria-hidden="true"></i>
                        ${t.published ? 'Unpublish' : 'Publish'}
                    </button>
                    <button class="cbt-mgr-btn cbt-mgr-btn--delete" data-tid="${tid}" data-action="delete">
                        <i data-lucide="trash-2" style="width:13px;height:13px;" aria-hidden="true"></i>
                        Delete
                    </button>
                </div>
            `;

            // Set text content safely — no HTML injection possible
            card.querySelector('[data-title-slot]').textContent   = t.title   || '(Untitled)';
            card.querySelector('[data-subject-slot]').textContent = t.subject || '—';
            card.querySelector('[data-class-slot]').textContent   = t.className || '—';

            // Attach events — title is read from the Map, never from the DOM
            card.querySelectorAll('[data-action]').forEach(btn => {
                btn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    const action    = this.dataset.action;
                    const id        = this.dataset.tid;
                    const testEntry = _cbtTestMap.get(id);
                    const title     = testEntry?.title || '(Untitled)';
                    const published = testEntry?.published || false;

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

// ── Autosave (localStorage) ─────────────────────────────────────────────
// Persists the in-progress Create/Edit Test form to localStorage so a
// refresh, closed tab, or crash never wipes out a teacher's typing.
const CBT_AUTOSAVE_PREFIX = 'fahmid_cbt_draft_';
let _cbtAutosaveTimer = null;

function cbtAutosaveKey() {
    const uid = window.currentUser?.uid || 'anon';
    return `${CBT_AUTOSAVE_PREFIX}${uid}_${cbtEditingTestId || 'new'}`;
}

// Reads every field currently in the form (details + all question blocks)
function cbtCollectFormState() {
    const classEl   = document.getElementById('cbt-class');
    const className = classEl?.options[classEl.selectedIndex]?.dataset.name || '';

    const questions = [];
    document.querySelectorAll('.cbt-question-builder').forEach(block => {
        const n = block.id.replace('cbt-q-', '');
        questions.push({
            existingId:    block.dataset.qid || null,
            questionText:  document.getElementById(`cbt-q${n}-text`)?.value || '',
            optionA:       document.getElementById(`cbt-q${n}-optA`)?.value || '',
            optionB:       document.getElementById(`cbt-q${n}-optB`)?.value || '',
            optionC:       document.getElementById(`cbt-q${n}-optC`)?.value || '',
            optionD:       document.getElementById(`cbt-q${n}-optD`)?.value || '',
            correctAnswer: document.querySelector(`input[name="cbt-q${n}-correct"]:checked`)?.value || ''
        });
    });

    return {
        savedAt:       Date.now(),
        title:         document.getElementById('cbt-title')?.value || '',
        subject:       document.getElementById('cbt-subject')?.value || '',
        classId:       classEl?.value || '',
        className,
        term:          document.getElementById('cbt-term')?.value || '',
        type:          document.getElementById('cbt-type')?.value || '',
        timerMinutes:  document.getElementById('cbt-timer')?.value || '',
        scheduledDate: document.getElementById('cbt-schedule')?.value || '',
        expiryDate:    document.getElementById('cbt-expiry')?.value || '',
        instructions:  document.getElementById('cbt-instructions')?.value || '',
        questions
    };
}

function cbtStateHasContent(state) {
    if (!state) return false;
    return !!(
        state.title || state.subject || state.instructions ||
        (state.questions && state.questions.some(q =>
            q.questionText || q.optionA || q.optionB || q.optionC || q.optionD))
    );
}

function cbtSaveDraftToLocalStorage() {
    try {
        // Only save while the Create/Edit form is actually on screen
        if (!document.getElementById('cbt-title')) return;

        const state = cbtCollectFormState();

        if (!cbtStateHasContent(state)) {
            localStorage.removeItem(cbtAutosaveKey());
            return;
        }

        localStorage.setItem(cbtAutosaveKey(), JSON.stringify(state));
    } catch (e) {
        console.warn('CBT autosave failed (localStorage unavailable or full):', e);
    }
}

function cbtScheduleAutosave() {
    clearTimeout(_cbtAutosaveTimer);
    _cbtAutosaveTimer = setTimeout(cbtSaveDraftToLocalStorage, 600);
}

function cbtClearAutosave() {
    try { localStorage.removeItem(cbtAutosaveKey()); } catch (e) { /* ignore */ }
    clearTimeout(_cbtAutosaveTimer);
}

// Delegated listeners on the container catch typing/selecting in every
// question block, including ones added later — no need to re-bind per field.
function cbtAttachAutosaveListeners() {
    const container = document.getElementById('cbt-section-content');
    if (!container) return;
    // addEventListener silently ignores duplicate (same fn ref) registrations,
    // so calling this again on re-render is safe and won't double-fire.
    container.addEventListener('input', cbtScheduleAutosave);
    container.addEventListener('change', cbtScheduleAutosave);
}

// Small reusable confirm dialog (same visual language as the delete dialog)
function cbtShowConfirmDialog({ icon = 'help-circle', title, message, confirmLabel = 'Yes', cancelLabel = 'Cancel', confirmColor = '#1a56db' }) {
    return new Promise(resolve => {
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed; inset: 0; z-index: 99999;
            background: rgba(15,23,42,0.7);
            display: flex; align-items: center; justify-content: center;
            padding: 20px; backdrop-filter: blur(3px);
        `;

        const box = document.createElement('div');
        box.style.cssText = `
            background: #ffffff; border-radius: 18px;
            padding: 32px 28px; max-width: 420px; width: 100%;
            box-shadow: 0 20px 60px rgba(0,0,0,0.25);
            text-align: center; font-family: 'DM Sans', sans-serif;
        `;

        box.innerHTML = `
            <div style="width:56px;height:56px;border-radius:50%;background:#eff6ff;color:${confirmColor};
                        display:flex;align-items:center;justify-content:center;margin:0 auto 14px;">
                <i data-lucide="${icon}" style="width:26px;height:26px;"></i>
            </div>
            <h3 style="font-family:'Plus Jakarta Sans',sans-serif; font-size:1.1rem; font-weight:800;
                       color:#0f172a; margin:0 0 8px;">${escHtml(title)}</h3>
            <p style="font-size:13.5px; color:#64748b; margin:0 0 24px; line-height:1.5;">
                ${escHtml(message)}
            </p>
            <div style="display:flex; gap:10px; justify-content:center;">
                <button id="cbt-confirm-cancel" style="
                    flex:1; max-width:170px; padding:11px;
                    border-radius:9999px; border:1.5px solid #e2e8f0;
                    background:#ffffff; color:#475569;
                    font-size:14px; font-weight:600; cursor:pointer;">
                    ${escHtml(cancelLabel)}
                </button>
                <button id="cbt-confirm-ok" style="
                    flex:1; max-width:170px; padding:11px;
                    border-radius:9999px; border:none;
                    background:${confirmColor}; color:#ffffff;
                    font-size:14px; font-weight:700; cursor:pointer;">
                    ${escHtml(confirmLabel)}
                </button>
            </div>
        `;

        overlay.appendChild(box);
        document.body.appendChild(overlay);
        if (typeof lucide !== 'undefined') lucide.createIcons();

        function cleanup(result) {
            document.body.removeChild(overlay);
            resolve(result);
        }

        document.getElementById('cbt-confirm-cancel').addEventListener('click', () => cleanup(false));
        document.getElementById('cbt-confirm-ok').addEventListener('click', () => cleanup(true));
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) cleanup(false);
        });
    });
}

// Checks localStorage for a leftover draft for this exact test (or "new"),
// and if found, asks the teacher whether to restore it. Returns the
// (possibly replaced) { existingData, existingQs } to render the form with.
async function cbtCheckForAutosave(existingData, existingQs) {
    let saved = null;
    try {
        const raw = localStorage.getItem(cbtAutosaveKey());
        if (raw) saved = JSON.parse(raw);
    } catch (e) {
        saved = null;
    }

    if (!saved || !cbtStateHasContent(saved)) {
        cbtClearAutosave();
        return { existingData, existingQs };
    }

    const savedTime = saved.savedAt
        ? new Date(saved.savedAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
        : 'earlier';

    const wantsRestore = await cbtShowConfirmDialog({
        icon: 'history',
        title: 'Restore Unsaved Test?',
        message: `We found changes from ${savedTime} that were never saved (probably from a refresh or closed tab). Would you like to restore them and continue where you left off?`,
        confirmLabel: 'Restore',
        cancelLabel: 'Discard',
        confirmColor: '#1a56db'
    });

    if (!wantsRestore) {
        cbtClearAutosave();
        return { existingData, existingQs };
    }

    const restoredData = {
        title:         saved.title || '',
        subject:       saved.subject || '',
        classId:       saved.classId || '',
        className:     saved.className || '',
        term:          saved.term || '',
        type:          saved.type || 'Test',
        timerMinutes:  saved.timerMinutes ? parseInt(saved.timerMinutes) : 0,
        instructions:  saved.instructions || '',
        scheduledDate: saved.scheduledDate || '',
        expiryDate:    saved.expiryDate || ''
    };

    const restoredQs = (saved.questions || []).map(q => ({
        id:            q.existingId || '',
        questionText:  q.questionText || '',
        optionA:       q.optionA || '',
        optionB:       q.optionB || '',
        optionC:       q.optionC || '',
        optionD:       q.optionD || '',
        correctAnswer: q.correctAnswer || ''
    }));

    window.showToast?.('Restored your unsaved changes.', 'success', 4000);

    return { existingData: restoredData, existingQs: restoredQs };
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
        if (testDoc.exists) {
            const raw = testDoc.data();
            // Normalise Firestore Timestamps to plain datetime-local strings
            // up front so the rest of this function only ever deals with
            // strings — the same shape a restored localStorage draft has.
            existingData = {
                ...raw,
                scheduledDate: raw.scheduledDate ? toDatetimeLocalString(raw.scheduledDate.toDate()) : '',
                expiryDate:    raw.expiryDate    ? toDatetimeLocalString(raw.expiryDate.toDate())    : ''
            };
        }

        const qSnap = await db.collection('cbt_questions')
            .where('testId', '==', testId)
            .orderBy('order', 'asc')
            .get();
        existingQs = qSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    }

    // Check for an unsaved draft left over from a previous session and
    // offer to restore it (this may replace existingData/existingQs).
    const restored = await cbtCheckForAutosave(existingData, existingQs);
    existingData = restored.existingData;
    existingQs   = restored.existingQs;

    const classes  = window.assignedClasses || [];
    const settings = await window.getCurrentSettings();

    const scheduleValue = existingData?.scheduledDate || '';
    const expiryValue   = existingData?.expiryDate || '';

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
                    <input type="datetime-local" id="cbt-schedule" value="${scheduleValue}">
                </div>
                <div class="form-group">
                    <label for="cbt-expiry">Expiry Date &amp; Time (optional)</label>
                    <input type="datetime-local" id="cbt-expiry" value="${expiryValue}">
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

    // Pre-load existing questions (from Firestore or a restored draft)
    if (existingQs.length > 0) {
        existingQs.forEach(q => addCbtQuestion(q));
    }

    // Start watching the form for changes so we can autosave to localStorage
    cbtAttachAutosaveListeners();
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

    // Relabel every question block ("Question 1", "Question 2"...) based on
    // its actual position on screen. The internal id `n` above is just an
    // ever-increasing unique key for element IDs/radio groups — it is NOT
    // the same thing as the number the teacher sees.
    cbtRenumberQuestions();

    // A question was added — persist immediately (typing inside it will
    // continue to autosave via the delegated input/change listeners).
    cbtScheduleAutosave();
}

// ── Remove question ────────────────────────────────────────────────────────
function removeCbtQuestion(n) {
    const el = document.getElementById(`cbt-q-${n}`);
    if (el) el.remove();

    const container = document.getElementById('cbt-questions-container');
    const noMsg     = document.getElementById('cbt-no-q-msg');
    if (container && !container.children.length && noMsg) noMsg.style.display = 'block';

    // Close the gap left behind: renumber the remaining questions so they
    // always read 1, 2, 3… with no skipped numbers, regardless of which
    // question was deleted or how many were added/removed before it.
    cbtRenumberQuestions();

    // Removing a question doesn't fire an input/change event on the
    // container, so persist the new state explicitly.
    cbtScheduleAutosave();
}

// Recalculates the visible "Question N" label for every question block
// based on its current position in the DOM. Internal element IDs (used for
// input/radio uniqueness) are left untouched — only the label text changes.
function cbtRenumberQuestions() {
    document.querySelectorAll('#cbt-questions-container .cbt-question-builder').forEach((block, idx) => {
        const label = block.querySelector('.cbt-question-builder__num');
        if (label) label.textContent = `Question ${idx + 1}`;
    });
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

        // Test successfully saved — the autosaved draft is no longer needed
        cbtClearAutosave();

        window.showToast?.(`Test ${publish ? 'published' : 'saved as draft'} successfully.`, 'success', 5000);
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
    // Build a custom confirmation overlay — never rely on browser confirm()
    // which is blocked silently in many mobile and cross-origin contexts
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed; inset: 0; z-index: 99999;
        background: rgba(15,23,42,0.7);
        display: flex; align-items: center; justify-content: center;
        padding: 20px; backdrop-filter: blur(3px);
    `;

    const box = document.createElement('div');
    box.style.cssText = `
        background: #ffffff; border-radius: 18px;
        padding: 32px 28px; max-width: 400px; width: 100%;
        box-shadow: 0 20px 60px rgba(0,0,0,0.25);
        text-align: center; font-family: 'DM Sans', sans-serif;
    `;

    box.innerHTML = `
        <div style="width:56px;height:56px;border-radius:50%;background:#fef2f2;color:#dc2626;
                    display:flex;align-items:center;justify-content:center;margin:0 auto 14px;">
            <i data-lucide="trash-2" style="width:26px;height:26px;"></i>
        </div>
        <h3 style="font-family:'Plus Jakarta Sans',sans-serif; font-size:1.1rem; font-weight:800;
                   color:#0f172a; margin:0 0 8px;">Delete Test?</h3>
        <p style="font-size:13.5px; color:#64748b; margin:0 0 6px; line-height:1.5;">
            You are about to permanently delete:
        </p>
        <p style="font-size:14px; font-weight:700; color:#0f172a; margin:0 0 16px;
                  background:#f1f5f9; border-radius:8px; padding:10px 14px;">
            ${escHtml(title)}
        </p>
        <p style="font-size:12.5px; color:#dc2626; margin:0 0 24px; line-height:1.5;">
            This will delete all questions, all pupil scores, and all submission records.
            This <strong>cannot be undone</strong>.
        </p>
        <div style="display:flex; gap:10px; justify-content:center;">
            <button id="cbt-del-cancel" style="
                flex:1; max-width:150px; padding:11px;
                border-radius:9999px; border:1.5px solid #e2e8f0;
                background:#ffffff; color:#475569;
                font-size:14px; font-weight:600; cursor:pointer;">
                Cancel
            </button>
            <button id="cbt-del-confirm" style="
                flex:1; max-width:150px; padding:11px;
                border-radius:9999px; border:none;
                background:#dc2626; color:#ffffff;
                font-size:14px; font-weight:700; cursor:pointer;">
                Yes, Delete
            </button>
        </div>
    `;

    overlay.appendChild(box);
    document.body.appendChild(overlay);
    if (typeof lucide !== 'undefined') lucide.createIcons();

    // Return a promise that resolves when the user makes a choice
    const confirmed = await new Promise(resolve => {
        document.getElementById('cbt-del-cancel').addEventListener('click', () => {
            document.body.removeChild(overlay);
            resolve(false);
        });
        document.getElementById('cbt-del-confirm').addEventListener('click', () => {
            document.body.removeChild(overlay);
            resolve(true);
        });
        // Also close on backdrop click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                document.body.removeChild(overlay);
                resolve(false);
            }
        });
    });

    if (!confirmed) return;

    // Show deleting state
    window.showToast?.('Deleting test…', 'info', 3000);

    try {
        const batch = db.batch();

        const qSnap = await db.collection('cbt_questions').where('testId', '==', testId).get();
        qSnap.forEach(d => batch.delete(d.ref));

        const aSnap = await db.collection('cbt_attempts').where('testId', '==', testId).get();
        aSnap.forEach(d => batch.delete(d.ref));

        const rSnap = await db.collection('cbt_results').where('testId', '==', testId).get();
        rSnap.forEach(d => batch.delete(d.ref));

        const revSnap = await db.collection('cbt_reviews').where('testId', '==', testId).get();
        revSnap.forEach(d => batch.delete(d.ref));

        const pSnap = await db.collection('cbt_proctoring').where('testId', '==', testId).get();
        pSnap.forEach(d => batch.delete(d.ref));

        batch.delete(db.collection('cbt_tests').doc(testId));

        await batch.commit();

        // Remove from local map
        _cbtTestMap.delete(testId);

        window.showToast?.('Test deleted successfully.', 'success', 4000);
        await loadCbtSection();

    } catch (err) {
        console.error('Delete failed:', err);
        window.showToast?.('Delete failed: ' + (err.message || 'Unknown error'), 'danger', 6000);
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
                <p style="font-size:12px;color:#64748b;margin:0;">All submissions for this test. Click a pupil's score to review their full attempt.</p>
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

        // Resolve pupil names once, up front, and cache the full results
        // array (in the order Firestore gave us — latest first). All
        // subsequent sort changes are pure client-side re-renders of this
        // cached array, so switching sort order costs zero Firestore reads.
        const results = resultsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        for (const r of results) {
            let pupilName = r.pupilId;
            try {
                const pDoc = await db.collection('pupils').doc(r.pupilId).get();
                if (pDoc.exists) pupilName = pDoc.data().name;
            } catch(e) {}
            r.pupilName = pupilName;
            _cbtResultMap.set(r.id, r);
        }

        _cbtResultsCache = { testId, results, sortBy: 'latest' };

        renderCbtResultsTable(content);

    } catch (err) {
        console.error('Error loading results:', err);
        document.getElementById('cbt-results-content').innerHTML = '<p style="color:red;padding:20px;">Error loading results.</p>';
    }
}

// Sorts _cbtResultsCache.results according to the given key. Returns a NEW
// array — the cache's original (Firestore) order is left untouched so
// switching back to "Latest first" never needs a re-fetch.
function cbtSortResults(results, sortBy) {
    const arr = results.slice();
    switch (sortBy) {
        case 'oldest':
            return arr.sort((a, b) => (a.submittedAt?.toMillis?.() || 0) - (b.submittedAt?.toMillis?.() || 0));
        case 'score-high':
            return arr.sort((a, b) => b.percentage - a.percentage);
        case 'score-low':
            return arr.sort((a, b) => a.percentage - b.percentage);
        case 'name':
            return arr.sort((a, b) => (a.pupilName || '').localeCompare(b.pupilName || ''));
        case 'latest':
        default:
            return arr.sort((a, b) => (b.submittedAt?.toMillis?.() || 0) - (a.submittedAt?.toMillis?.() || 0));
    }
}

// Renders (or re-renders) the stat cards + sort control + table body from
// _cbtResultsCache. Called on first load and every time the sort dropdown
// changes — never touches Firestore.
function renderCbtResultsTable(content) {
    const { results, sortBy } = _cbtResultsCache;

    const avgPct  = Math.round(results.reduce((sum, r) => sum + r.percentage, 0) / results.length);
    const highest = Math.max(...results.map(r => r.percentage));
    const lowest  = Math.min(...results.map(r => r.percentage));
    const flaggedSubmissions = results.filter(r => (r.flaggedCount || 0) > 0).length;

    const sortOptions = [
        { value: 'latest',     label: 'Latest first' },
        { value: 'oldest',     label: 'Oldest first' },
        { value: 'score-high', label: 'Highest score' },
        { value: 'score-low',  label: 'Lowest score' },
        { value: 'name',       label: 'Pupil name (A–Z)' }
    ];

    const sortedResults = cbtSortResults(results, sortBy);

    let tableRows = '';
    for (const r of sortedResults) {
        const submittedDate = r.submittedAt?.toDate().toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) || '—';
        const flaggedCount  = r.flaggedCount || 0;
        const flaggedCell   = flaggedCount > 0
            ? `<button class="cbt-mgr-btn" data-action="view-flags" data-result-id="${r.id}"
                   style="padding:4px 10px;font-size:11.5px;background:#fef3c7;border-color:#f59e0b;color:#92400e;">
                   <i data-lucide="flag" style="width:12px;height:12px;" aria-hidden="true"></i> ${flaggedCount}
               </button>`
            : `<span style="color:#94a3b8;">0</span>`;

        tableRows += `
            <tr>
                <td data-label="Pupil">${escHtml(r.pupilName)}</td>
                <td data-label="Score" style="text-align:center;">
                    <button class="cbt-score-link" data-action="view-attempt" data-result-id="${r.id}"
                        style="background:none;border:none;padding:0;cursor:pointer;font-weight:700;
                               font-size:13.5px;color:#1a56db;text-decoration:underline;text-underline-offset:2px;">
                        ${r.score}/${r.total}
                    </button>
                </td>
                <td data-label="Percentage" style="text-align:center;font-weight:700;color:${r.percentage >= 50 ? '#16a34a' : '#dc2626'};">${r.percentage}%</td>
                <td data-label="Grade" style="text-align:center;" class="grade-${r.grade}">${r.grade}</td>
                <td data-label="Flagged" style="text-align:center;">${flaggedCell}</td>
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
            <div class="stat-card" style="border-left:3px solid #f59e0b;"><h3>Flagged</h3><div class="stat-number" style="color:#f59e0b!important;-webkit-text-fill-color:#f59e0b!important;">${flaggedSubmissions}</div></div>
        </div>
        <div style="display:flex;align-items:center;justify-content:flex-end;gap:8px;margin-bottom:12px;flex-wrap:wrap;">
            <label for="cbt-results-sort" style="font-size:12.5px;font-weight:600;color:#64748b;">Sort by:</label>
            <select id="cbt-results-sort" style="
                padding:6px 12px;border-radius:8px;border:1.5px solid #e2e8f0;
                background:#ffffff;color:#0f172a;font-size:13px;font-weight:600;cursor:pointer;">
                ${sortOptions.map(o => `<option value="${o.value}" ${o.value === sortBy ? 'selected' : ''}>${o.label}</option>`).join('')}
            </select>
        </div>
        <div class="table-container">
            <table class="responsive-table">
                <thead>
                    <tr>
                        <th>Pupil</th>
                        <th style="text-align:center;">Score</th>
                        <th style="text-align:center;">Percentage</th>
                        <th style="text-align:center;">Grade</th>
                        <th style="text-align:center;">Flagged</th>
                        <th style="text-align:center;">Tab Switches</th>
                        <th>Submitted</th>
                    </tr>
                </thead>
                <tbody>${tableRows}</tbody>
            </table>
        </div>
    `;

    // Wire up sort dropdown — just re-renders from the cache, no re-fetch
    const sortSelect = document.getElementById('cbt-results-sort');
    if (sortSelect) {
        sortSelect.addEventListener('change', function() {
            _cbtResultsCache.sortBy = this.value;
            renderCbtResultsTable(content);
        });
    }

    // Wire up the "View Attempt" (score) and "View Flags" buttons
    content.querySelectorAll('[data-action="view-attempt"]').forEach(btn => {
        btn.addEventListener('click', () => viewPupilAttempt(btn.dataset.resultId, false));
    });
    content.querySelectorAll('[data-action="view-flags"]').forEach(btn => {
        btn.addEventListener('click', () => viewPupilAttempt(btn.dataset.resultId, true));
    });

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ── View a pupil's full attempt ──────────────────────────────────────────
// Opens a modal showing every question from that submission — the pupil's
// answer vs. the correct one, in the order they appeared on the pupil's
// screen — plus a summary header (score, time taken, tab switches). Any
// question the pupil flagged is marked and, if scrollToFlagged is true
// (i.e. opened via the Flagged badge rather than the score), the view
// jumps straight to the first one.
async function viewPupilAttempt(resultId, scrollToFlagged) {
    const resultMeta = _cbtResultMap.get(resultId);
    const pupilName  = resultMeta?.pupilName || 'Pupil';

    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed; inset: 0; z-index: 99999;
        background: rgba(15,23,42,0.7);
        display: flex; align-items: center; justify-content: center;
        padding: 20px; backdrop-filter: blur(3px);
    `;

    const box = document.createElement('div');
    box.style.cssText = `
        background: #ffffff; border-radius: 18px;
        padding: 28px; max-width: 700px; width: 100%;
        max-height: 86vh; overflow-y: auto;
        box-shadow: 0 20px 60px rgba(0,0,0,0.25);
        font-family: 'DM Sans', sans-serif;
    `;

    // ── Header: pupil name + summary stats (already have this data in
    //    _cbtResultMap — no Firestore round trip needed for it) ──────────
    let headerStatsHTML = '';
    if (resultMeta) {
        const mins = resultMeta.timeTakenSec != null ? Math.floor(resultMeta.timeTakenSec / 60) : null;
        const secs = resultMeta.timeTakenSec != null ? resultMeta.timeTakenSec % 60 : null;
        const timeStr = resultMeta.timeTakenSec != null
            ? `${mins}m ${secs}s`
            : 'No timer';
        const submittedStr = resultMeta.submittedAt?.toDate
            ? resultMeta.submittedAt.toDate().toLocaleString('en-GB', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })
            : '—';

        headerStatsHTML = `
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(100px,1fr));gap:10px;margin-bottom:18px;">
                <div style="background:#f8fafc;border-radius:10px;padding:10px 12px;text-align:center;">
                    <div style="font-size:10.5px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;">Score</div>
                    <div style="font-size:15px;font-weight:800;color:#0f172a;">${resultMeta.score}/${resultMeta.total}</div>
                </div>
                <div style="background:#f8fafc;border-radius:10px;padding:10px 12px;text-align:center;">
                    <div style="font-size:10.5px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;">Percentage</div>
                    <div style="font-size:15px;font-weight:800;color:${resultMeta.percentage >= 50 ? '#16a34a' : '#dc2626'};">${resultMeta.percentage}%</div>
                </div>
                <div style="background:#f8fafc;border-radius:10px;padding:10px 12px;text-align:center;">
                    <div style="font-size:10.5px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;">Grade</div>
                    <div style="font-size:15px;font-weight:800;color:#0f172a;">${resultMeta.grade}</div>
                </div>
                <div style="background:#f8fafc;border-radius:10px;padding:10px 12px;text-align:center;">
                    <div style="font-size:10.5px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;">Time Taken</div>
                    <div style="font-size:13px;font-weight:700;color:#0f172a;">${timeStr}</div>
                </div>
                <div style="background:#f8fafc;border-radius:10px;padding:10px 12px;text-align:center;">
                    <div style="font-size:10.5px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;">Tab Switches</div>
                    <div style="font-size:13px;font-weight:700;color:${(resultMeta.tabSwitches || 0) > 3 ? '#dc2626' : '#0f172a'};">${resultMeta.tabSwitches || 0}</div>
                </div>
            </div>
            <div style="font-size:11.5px;color:#94a3b8;margin-bottom:18px;">Submitted ${submittedStr}</div>
        `;
    }

    box.innerHTML = `
        <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:6px;gap:12px;">
            <div style="min-width:0;">
                <h3 style="font-family:'Plus Jakarta Sans',sans-serif;font-size:1.1rem;font-weight:800;color:#0f172a;margin:0 0 2px;">
                    <i data-lucide="file-text" style="width:16px;height:16px;vertical-align:-3px;color:#1a56db;"></i>
                    Full Attempt Review
                </h3>
                <p style="font-size:12.5px;color:#64748b;margin:0;">${escHtml(pupilName)}</p>
            </div>
            <button id="cbt-attempt-close" style="
                width:30px;height:30px;border-radius:50%;border:none;
                background:#eef2f7;color:#475569;display:flex;align-items:center;
                justify-content:center;cursor:pointer;flex-shrink:0;">
                <i data-lucide="x" style="width:15px;height:15px;"></i>
            </button>
        </div>
        ${headerStatsHTML}
        <div id="cbt-attempt-body">
            <div style="text-align:center;padding:24px;color:#94a3b8;">
                <div class="spinner" style="margin:0 auto 10px;"></div>
                <p style="font-size:13px;">Loading attempt…</p>
            </div>
        </div>
    `;

    overlay.appendChild(box);
    document.body.appendChild(overlay);
    if (typeof lucide !== 'undefined') lucide.createIcons();

    function close() { document.body.removeChild(overlay); }
    document.getElementById('cbt-attempt-close').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

    const bodyEl = document.getElementById('cbt-attempt-body');

    try {
        const reviewSnap = await db.collection('cbt_reviews')
            .where('resultId', '==', resultId)
            .limit(1)
            .get();

        if (reviewSnap.empty) {
            bodyEl.innerHTML = `<p style="text-align:center;color:#94a3b8;padding:20px;">No review data found for this submission.</p>`;
            return;
        }

        const reviewData = reviewSnap.docs[0].data().answers || [];
        const letters = ['A','B','C','D'];
        const keys    = ['optionA','optionB','optionC','optionD'];

        bodyEl.innerHTML = reviewData.map((item, i) => {
            let optionsHTML = '';
            keys.forEach((key, ki) => {
                if (!item[key]) return;
                const letter     = letters[ki];
                const isPupil    = item.pupilAnswer === letter;
                const isCorrect  = item.correctAnswer === letter;
                let extraStyle = '';
                if (isCorrect)                    extraStyle = 'border-color:#16a34a;background:#f0fdf4;color:#14532d;';
                else if (isPupil && !isCorrect)   extraStyle = 'border-color:#dc2626;background:#fef2f2;color:#7f1d1d;';
                optionsHTML += `
                    <div style="display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:9px;border:1.5px solid #e2e8f0;margin-bottom:6px;font-size:13px;${extraStyle}">
                        <span style="width:22px;height:22px;min-width:22px;border-radius:50%;background:#f1f5f9;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;">${letter}</span>
                        <span>${escHtml(item[key])}</span>
                        ${isCorrect ? '<span style="margin-left:auto;font-size:10.5px;font-weight:700;color:#16a34a;">Correct</span>' : ''}
                        ${isPupil && !isCorrect ? '<span style="margin-left:auto;font-size:10.5px;font-weight:700;color:#dc2626;">Pupil&rsquo;s answer</span>' : ''}
                    </div>`;
            });

            const statusLabel = item.isCorrect ? 'Correct' : item.pupilAnswer ? 'Incorrect' : 'Skipped';
            const statusColor = item.isCorrect ? '#16a34a' : item.pupilAnswer ? '#dc2626' : '#94a3b8';
            const isFlagged   = !!item.flagged;

            return `
                <div class="${isFlagged ? 'cbt-attempt-flagged' : ''}"
                     style="border:1px solid ${isFlagged ? '#fde68a' : '#e2e8f0'};background:${isFlagged ? '#fffbeb' : '#ffffff'};border-radius:12px;padding:16px;margin-bottom:14px;">
                    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px;">
                        <span style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;">Question ${i + 1}</span>
                        <span style="font-size:10.5px;font-weight:700;padding:2px 9px;border-radius:9999px;background:${statusColor}1a;color:${statusColor};">${statusLabel}</span>
                        ${isFlagged ? '<span style="font-size:10.5px;font-weight:700;padding:2px 9px;border-radius:9999px;background:#fef3c7;color:#92400e;"><i data-lucide="flag" style="width:10px;height:10px;vertical-align:-1px;"></i> Flagged</span>' : ''}
                    </div>
                    <div style="font-size:14px;font-weight:600;color:#0f172a;margin-bottom:12px;line-height:1.5;">${escHtml(item.questionText)}</div>
                    ${optionsHTML}
                </div>`;
        }).join('');

        if (typeof lucide !== 'undefined') lucide.createIcons();

        if (scrollToFlagged) {
            const firstFlagged = bodyEl.querySelector('.cbt-attempt-flagged');
            if (firstFlagged) firstFlagged.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

    } catch (err) {
        console.error('Error loading pupil attempt:', err);
        bodyEl.innerHTML = `<p style="text-align:center;color:#dc2626;padding:20px;">Failed to load this attempt.</p>`;
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
window.viewPupilAttempt    = viewPupilAttempt;

console.log('✓ CBT Teacher module v1.5.0 loaded (sortable results table)');
