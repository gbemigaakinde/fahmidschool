/**
 * FAHMID NURSERY & PRIMARY SCHOOL
 * CBT Teacher Module — Create and manage tests
 * @version 1.6.0 — Attempt review now includes the tab-switch proctoring timeline
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
        questions.push(cbtReadQuestionBlock(block));
    });
    const passages = cbtReadPassages();

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
        passages,
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

    restoredData.passages = saved.passages || [];
    const restoredQs = (saved.questions || []).map(q => Object.assign({}, q, {
        id:            q.existingId || '',
        qType:         q.qType || 'mcq'
    }));

    window.showToast?.('Restored your unsaved changes.', 'success', 4000);

    return { existingData: restoredData, existingQs: restoredQs };
}

// Fills the Subject dropdown with the subjects that actually belong to the
// selected class — the same source of truth the religion filter reads from,
// so a saved test's subject can never drift into an unrecognised variant
// like "C.R.S" or "Christian R.S" again.
function populateCbtSubjectsForClass(classId, preselectSubject = '') {
    const subjectSelect = document.getElementById('cbt-subject');
    if (!subjectSelect) return;

    if (!classId) {
        subjectSelect.innerHTML = '<option value="">-- Select Class First --</option>';
        return;
    }

    const classes = window.assignedClasses || [];
    const cls = classes.find(c => c.id === classId);
    const subjects = (cls && Array.isArray(cls.subjects)) ? cls.subjects.slice() : [];

    // If editing an existing test whose saved subject isn't in the class's
    // current subject list (e.g. it was free-typed before this dropdown
    // existed, or the class's subjects changed since), keep it as a
    // selectable option so editing the test never silently discards it.
    if (preselectSubject && !subjects.some(s => s.toLowerCase() === preselectSubject.toLowerCase())) {
        subjects.push(preselectSubject);
    }

    if (subjects.length === 0) {
        subjectSelect.innerHTML = '<option value="">-- No subjects set for this class --</option>';
        return;
    }

    subjectSelect.innerHTML = '<option value="">-- Select Subject --</option>' +
        subjects
            .map(s => `<option value="${escHtml(s)}" ${s === preselectSubject ? 'selected' : ''}>${escHtml(s)}</option>`)
            .join('');
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
                    <label for="cbt-class">Class <span class="required">*</span></label>
                    <select id="cbt-class">
                        <option value="">— Select Class —</option>
                        ${classes.map(c => `<option value="${c.id}" data-name="${escHtml(c.name)}" ${existingData?.classId === c.id ? 'selected' : ''}>${escHtml(c.name)}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label for="cbt-subject">Subject <span class="required">*</span></label>
                    <select id="cbt-subject">
                        <option value="">-- Select Class First --</option>
                    </select>
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

        <!-- Passages / reading materials -->
        <div class="form-section">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;gap:10px;flex-wrap:wrap;">
                <h3 style="margin:0;">Passages &amp; Materials <span style="font-size:12px;font-weight:600;color:#94a3b8;">(optional)</span></h3>
                <button type="button" class="btn btn-secondary" onclick="addCbtPassage()" style="padding:8px 16px;font-size:13px;color:#475569;">
                    <i data-lucide="book-open" style="width:14px;height:14px;"></i>
                    Add Passage
                </button>
            </div>
            <p style="font-size:12.5px;color:#64748b;margin:0 0 12px;">Add a passage, poem, dialogue, data table or picture once, then attach it to as many questions as you like. Pupils see it above each attached question, and those questions always stay together.</p>
            <div id="cbt-passages-container"></div>
        </div>

        <!-- Question Builder -->
        <div class="form-section">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
                <h3 style="margin:0;">Questions</h3>
                <button class="btn tp-btn-primary" onclick="addCbtQuestion()" style="padding:8px 18px;font-size:13px;" id="cbt-add-q-btn">
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

    // ── Subject dropdown: populate from the selected class's own subject
    // list, and keep it in sync whenever the teacher changes the class.
    // This guarantees the saved subject string always exactly matches what
    // the religion filter expects — no more free-typed variants like
    // "C.R.S" slipping through and breaking the Muslim/Christian filter.
    const cbtClassSelectEl = document.getElementById('cbt-class');
    populateCbtSubjectsForClass(cbtClassSelectEl?.value || '', existingData?.subject || '');

    cbtClassSelectEl?.addEventListener('change', function () {
        populateCbtSubjectsForClass(this.value, '');
    });

    // Pre-load passages, then questions (from Firestore or a restored draft)
    cbtPassageCounter = 0;
    (existingData?.passages || []).forEach(pp => addCbtPassage(pp));

    if (existingQs.length > 0) {
        existingQs.forEach(q => addCbtQuestion(q));
    }

    // Start watching the form for changes so we can autosave to localStorage
    cbtAttachAutosaveListeners();
}

// ── Add question block ─────────────────────────────────────────────────────
// ── Passages & theory question builder ─────────────────────────────────────
let cbtPassageCounter = 0;

const CBT_PASSAGE_TYPES = [
    ['text',     'Reading passage (comprehension)'],
    ['cloze',    'Cloze passage (numbered blanks)'],
    ['poem',     'Poem'],
    ['dialogue', 'Dialogue / play script'],
    ['table',    'Data table'],
    ['image',    'Picture or diagram (image link)']
];

const CBT_QUESTION_TYPES = [
    ['mcq',   'Multiple choice'],
    ['short', 'Short answer (type a word or phrase)'],
    ['essay', 'Essay / long answer'],
    ['gap',   'Fill in the gap'],
    ['parts', 'Multi-part question (a, b, c)']
];

const CBT_PASSAGE_HINTS = {
    text:     'Paste the passage. Line breaks are kept.',
    cloze:    'Write the passage and number the blanks, for example: The boy (1) ____ to school every day. Then attach it to the questions for blanks 1, 2, 3.',
    poem:     'Type the poem, one line per row.',
    dialogue: 'One line per speaker, like  Ada: Good morning!  Speaker names are shown in bold.',
    table:    'One row per line, columns separated by | . The first line is the header. Example:  Item | Price | Qty',
    image:    'Paste a link to the picture (starts with https://). You can add a caption or note below it.'
};

function cbtOptsHtml(list, val) {
    return list.map(([v, l]) => `<option value="${v}" ${v === val ? 'selected' : ''}>${escHtml(l)}</option>`).join('');
}

function addCbtPassage(existing = null) {
    const container = document.getElementById('cbt-passages-container');
    if (!container) return;
    let id = existing?.id;
    if (!id) { cbtPassageCounter++; id = 'p' + cbtPassageCounter; }
    else { const num = parseInt(String(id).replace(/\D/g, ''), 10); if (num > cbtPassageCounter) cbtPassageCounter = num; }
    const type = existing?.type || 'text';

    const div = document.createElement('div');
    div.className = 'cbt-passage-builder';
    div.dataset.pid = id;
    div.innerHTML = `
        <button type="button" class="cbt-remove-q-btn" title="Remove passage" onclick="removeCbtPassage('${id}')">
            <i data-lucide="x" style="width:14px;height:14px;"></i>
        </button>
        <div class="cbt-question-builder__num cbt-p-num">Passage</div>
        <div class="cbt-builder-row">
            <div class="form-group" style="margin:0;">
                <label style="font-size:12px;font-weight:600;color:#374151;margin-bottom:4px;">Type</label>
                <select class="cbt-p-type" onchange="cbtPassageTypeChanged(this)">${cbtOptsHtml(CBT_PASSAGE_TYPES, type)}</select>
            </div>
            <div class="form-group" style="margin:0;">
                <label style="font-size:12px;font-weight:600;color:#374151;margin-bottom:4px;">Title</label>
                <input type="text" class="cbt-p-title" placeholder="e.g. Read the passage and answer questions 1 to 5" value="${escHtml(existing?.title || '')}">
            </div>
        </div>
        <div class="form-group cbt-p-imgrow" style="margin:10px 0 0;${type === 'image' ? '' : 'display:none;'}">
            <label style="font-size:12px;font-weight:600;color:#374151;margin-bottom:4px;">Picture link</label>
            <input type="url" class="cbt-p-img" placeholder="https://…" value="${escHtml(existing?.imageUrl || '')}">
        </div>
        <div class="form-group" style="margin:10px 0 0;">
            <label style="font-size:12px;font-weight:600;color:#374151;margin-bottom:4px;"><span class="cbt-p-textlabel">${type === 'image' ? 'Caption or note (optional)' : 'Text'}</span></label>
            <textarea class="cbt-p-text" rows="6" style="resize:vertical;" placeholder="">${escHtml(existing?.text || '')}</textarea>
            <div class="cbt-p-hint">${escHtml(CBT_PASSAGE_HINTS[type])}</div>
        </div>`;
    container.appendChild(div);
    if (typeof lucide !== 'undefined') lucide.createIcons();
    cbtRefreshPassageSelects();
    if (existing === null) cbtScheduleAutosave();
}

function cbtPassageTypeChanged(sel) {
    const block = sel.closest('.cbt-passage-builder');
    const type = sel.value;
    block.querySelector('.cbt-p-imgrow').style.display = type === 'image' ? '' : 'none';
    block.querySelector('.cbt-p-textlabel').textContent = type === 'image' ? 'Caption or note (optional)' : 'Text';
    block.querySelector('.cbt-p-hint').textContent = CBT_PASSAGE_HINTS[type] || '';
    cbtRefreshPassageSelects();
}

function removeCbtPassage(id) {
    const el = document.querySelector(`.cbt-passage-builder[data-pid="${id}"]`);
    if (!el) return;
    const used = Array.from(document.querySelectorAll('.cbt-q-passage')).filter(sel => sel.value === id).length;
    if (used && !confirm(`This passage is attached to ${used} question(s). They will be detached (nothing else is deleted). Remove it?`)) return;
    el.remove();
    cbtRefreshPassageSelects();
    cbtScheduleAutosave();
}

function cbtReadPassages() {
    return Array.from(document.querySelectorAll('.cbt-passage-builder')).map(b => ({
        id:       b.dataset.pid,
        type:     b.querySelector('.cbt-p-type')?.value || 'text',
        title:    b.querySelector('.cbt-p-title')?.value.trim() || '',
        text:     b.querySelector('.cbt-p-text')?.value || '',
        imageUrl: b.querySelector('.cbt-p-img')?.value.trim() || ''
    }));
}

// Keeps every question's "Attach passage" dropdown in step with the passages above.
function cbtRefreshPassageSelects() {
    const passages = cbtReadPassages();
    document.querySelectorAll('#cbt-passages-container .cbt-passage-builder').forEach((b, i) => {
        const lbl = b.querySelector('.cbt-p-num');
        if (lbl) lbl.textContent = `Passage ${i + 1}`;
    });
    document.querySelectorAll('.cbt-q-passage').forEach(sel => {
        const keep = sel.value || sel.dataset.want || '';
        sel.innerHTML = '<option value="">No passage</option>' + passages.map((p, i) => {
            const typeLabel = (CBT_PASSAGE_TYPES.find(t => t[0] === p.type) || [,''])[1].split(' (')[0];
            const label = `Passage ${i + 1}: ${p.title || typeLabel}`;
            return `<option value="${escHtml(p.id)}">${escHtml(label.length > 70 ? label.slice(0, 67) + '…' : label)}</option>`;
        }).join('');
        sel.value = passages.some(p => p.id === keep) ? keep : '';
        sel.dataset.want = '';
    });
}

// Gap helpers: the teacher writes [[answer]] or [[answer|other accepted answer]].
function cbtParseGapSource(src) {
    const answers = [];
    const template = String(src || '').replace(/\[\[([^\]]*?)\]\]/g, (m, inner) => {
        const list = inner.split('|').map(x => x.trim()).filter(Boolean);
        answers.push({ answers: list });
        return `{{${answers.length - 1}}}`;
    });
    return { template, answers };
}
function cbtGapSourceFromDoc(template, gapAnswers) {
    return String(template || '').replace(/\{\{(\d+)\}\}/g, (m, i) => `[[${((gapAnswers || [])[Number(i)]?.answers || []).join('|')}]]`);
}

// Converts a Firestore question document into the flat model the form uses.
function cbtDocToModel(d) {
    if (!d) return { qType: 'mcq' };
    if (d.qType) return d;
    const type = d.type === 'theory' ? (d.theoryType || 'short') : 'mcq';
    return {
        id: d.id || '',
        qType: type,
        questionText: d.questionText || '',
        passageId: d.passageId || '',
        marks: d.marks || 1,
        optionA: d.optionA || '', optionB: d.optionB || '', optionC: d.optionC || '', optionD: d.optionD || '',
        correctAnswer: d.correctAnswer || '',
        acceptedText: (d.acceptedAnswers || []).join('\n'),
        guide: d.modelAnswer || '',
        gapSource: cbtGapSourceFromDoc(d.gapTemplate, d.gapAnswers),
        gapMarks: d.gapMarks || 1,
        wordBank: d.wordBank || '',
        parts: (d.parts || []).map(pt => ({ prompt: pt.prompt || '', marks: pt.marks || 1, accepted: (pt.accepted || []).join(', ') }))
    };
}

function addCbtQuestion(existing = null) {
    const container = document.getElementById('cbt-questions-container');
    const noMsg     = document.getElementById('cbt-no-q-msg');
    if (!container) return;

    if (noMsg) noMsg.style.display = 'none';

    cbtQuestionCount++;
    const n = cbtQuestionCount;
    const m = cbtDocToModel(existing);
    const qType = m.qType || 'mcq';

    const div = document.createElement('div');
    div.className   = 'cbt-question-builder';
    div.id          = `cbt-q-${n}`;
    div.dataset.qid = m.id || existing?.id || '';

    const opts = ['A','B','C','D'];
    let optionsHTML = '';
    opts.forEach(letter => {
        const val = m['option' + letter] || '';
        const isCorrect = m.correctAnswer === letter;
        optionsHTML += `
            <div class="cbt-option-input-row">
                <span class="cbt-option-letter-badge">${letter}</span>
                <input type="text" placeholder="Option ${letter}" value="${escHtml(val)}"
                       id="cbt-q${n}-opt${letter}" style="flex:1;min-width:0;">
                <input type="radio" name="cbt-q${n}-correct" value="${letter}"
                       id="cbt-q${n}-correct${letter}" class="cbt-correct-radio"
                       ${isCorrect ? 'checked' : ''}>
                <label for="cbt-q${n}-correct${letter}" class="cbt-correct-label">Correct</label>
            </div>`;
    });

    const labelStyle = 'font-size:12px;font-weight:600;color:#374151;margin-bottom:4px;';
    div.innerHTML = `
        <button type="button" class="cbt-remove-q-btn" onclick="removeCbtQuestion(${n})" title="Remove question">
            <i data-lucide="x" style="width:14px;height:14px;"></i>
        </button>
        <div class="cbt-question-builder__num">Question ${n}</div>

        <div class="cbt-builder-row">
            <div class="form-group" style="margin:0;">
                <label for="cbt-q${n}-type" style="${labelStyle}">Question type</label>
                <select id="cbt-q${n}-type" onchange="cbtSwitchQType(${n})">${cbtOptsHtml(CBT_QUESTION_TYPES, qType)}</select>
            </div>
            <div class="form-group" style="margin:0;">
                <label for="cbt-q${n}-passage" style="${labelStyle}">Attach passage</label>
                <select id="cbt-q${n}-passage" class="cbt-q-passage" data-want="${escHtml(m.passageId || '')}"><option value="">No passage</option></select>
            </div>
        </div>

        <div class="form-group" style="margin:12px 0;">
            <label for="cbt-q${n}-text" style="${labelStyle}"><span id="cbt-q${n}-textlabel">Question Text</span> <span class="required">*</span></label>
            <textarea id="cbt-q${n}-text" rows="2" style="resize:vertical;" placeholder="Type the question here…">${escHtml(m.questionText || '')}</textarea>
        </div>

        <div class="cbt-qpanel" data-for="mcq">
            <div style="margin-bottom:6px;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.07em;">
                Options &nbsp;·&nbsp; <span style="color:#16a34a;">Select the correct answer</span>
            </div>
            ${optionsHTML}
        </div>

        <div class="cbt-qpanel" data-for="short">
            <label for="cbt-q${n}-accepted" style="${labelStyle}">Accepted answers (optional, one per line)</label>
            <textarea id="cbt-q${n}-accepted" rows="2" style="resize:vertical;" placeholder="Leave empty to mark by hand. Add answers to mark automatically (spelling must match, capital letters ignored).">${escHtml(m.acceptedText || '')}</textarea>
        </div>

        <div class="cbt-qpanel" data-for="essay">
            <label for="cbt-q${n}-guide" style="${labelStyle}">Marking guide / model answer (optional)</label>
            <textarea id="cbt-q${n}-guide" rows="3" style="resize:vertical;" placeholder="Shown to you when marking, and to the pupil after they submit.">${escHtml(m.guide || '')}</textarea>
        </div>

        <div class="cbt-qpanel" data-for="gap">
            <label for="cbt-q${n}-gap" style="${labelStyle}">Sentence with gaps</label>
            <textarea id="cbt-q${n}-gap" rows="3" style="resize:vertical;" oninput="cbtUpdateGapCount(${n})" placeholder="The [[cat]] sat on the [[mat|rug]]. (put each correct answer in [[double brackets]]; separate other accepted answers with | )">${escHtml(m.gapSource || '')}</textarea>
            <div class="cbt-p-hint" id="cbt-q${n}-gapcount"></div>
            <label for="cbt-q${n}-bank" style="${labelStyle};margin-top:10px;display:block;">Word bank (optional, separate words with commas)</label>
            <input type="text" id="cbt-q${n}-bank" placeholder="cat, mat, dog, rug" value="${escHtml(m.wordBank || '')}">
        </div>

        <div class="cbt-qpanel" data-for="parts">
            <div style="${labelStyle}">Parts</div>
            <div id="cbt-q${n}-parts"></div>
            <button type="button" class="btn btn-secondary" onclick="cbtAddPart(${n})" style="padding:6px 14px;font-size:12.5px;color:#475569;margin-top:6px;">
                <i data-lucide="plus" style="width:13px;height:13px;"></i> Add part
            </button>
        </div>

        <div class="cbt-marks-row" id="cbt-q${n}-marksrow">
            <label for="cbt-q${n}-marks" id="cbt-q${n}-markslabel" style="${labelStyle};margin:0;">Marks</label>
            <input type="number" id="cbt-q${n}-marks" min="1" max="100" step="1" value="${Number(m.marks) || 1}">
        </div>
    `;

    container.appendChild(div);

    // Gap marks live in the same input slot as marks (marks per gap)
    const marksInput = div.querySelector(`#cbt-q${n}-marks`);
    if (qType === 'gap') marksInput.value = Number(m.gapMarks) || 1;

    (m.parts && m.parts.length ? m.parts : (qType === 'parts' ? [{}, {}] : [])).forEach(pt => cbtAddPart(n, pt, true));

    cbtRefreshPassageSelects();
    cbtSwitchQType(n, true);
    cbtUpdateGapCount(n);
    if (typeof lucide !== 'undefined') lucide.createIcons();

    cbtRenumberQuestions();
    cbtScheduleAutosave();
}

function cbtSwitchQType(n, silent) {
    const block = document.getElementById(`cbt-q-${n}`);
    if (!block) return;
    const type = document.getElementById(`cbt-q${n}-type`).value;
    block.querySelectorAll('.cbt-qpanel').forEach(p => { p.style.display = p.dataset.for === type ? '' : 'none'; });
    const marksRow = document.getElementById(`cbt-q${n}-marksrow`);
    marksRow.style.display = (type === 'mcq' || type === 'parts') ? 'none' : '';
    document.getElementById(`cbt-q${n}-markslabel`).textContent = type === 'gap' ? 'Marks per gap' : 'Marks';
    const tl = document.getElementById(`cbt-q${n}-textlabel`);
    tl.textContent = type === 'gap' ? 'Instruction (for example: Fill in the gaps)' : type === 'parts' ? 'Question stem' : 'Question Text';
    if (type === 'parts' && !block.querySelector('.cbt-part-row')) { cbtAddPart(n, {}, true); cbtAddPart(n, {}, true); }
    if (!silent) cbtScheduleAutosave();
}

function cbtUpdateGapCount(n) {
    const el = document.getElementById(`cbt-q${n}-gapcount`);
    const src = document.getElementById(`cbt-q${n}-gap`)?.value || '';
    if (!el) return;
    const count = cbtParseGapSource(src).answers.length;
    el.textContent = count ? `${count} gap${count === 1 ? '' : 's'} found. Pupils will see an empty box for each one.` : 'No gaps yet. Wrap each correct answer in [[double brackets]].';
}

function cbtAddPart(n, pt = {}, silent) {
    const host = document.getElementById(`cbt-q${n}-parts`);
    if (!host) return;
    const row = document.createElement('div');
    row.className = 'cbt-part-row';
    row.innerHTML = `
        <span class="cbt-part-letter"></span>
        <div class="cbt-part-fields">
            <input type="text" class="cbt-part-prompt" placeholder="Part question" value="${escHtml(pt.prompt || '')}">
            <div class="cbt-part-sub">
                <input type="number" class="cbt-part-marks" min="1" max="100" value="${Number(pt.marks) || 1}" title="Marks" aria-label="Marks">
                <input type="text" class="cbt-part-acc" placeholder="Accepted answers, comma separated (optional)" value="${escHtml(pt.accepted || '')}">
            </div>
        </div>
        <button type="button" class="cbt-part-del" title="Remove part" onclick="this.closest('.cbt-part-row').remove();cbtRelabelParts(${n});cbtScheduleAutosave();">&times;</button>`;
    host.appendChild(row);
    cbtRelabelParts(n);
    if (!silent) cbtScheduleAutosave();
}
function cbtRelabelParts(n) {
    document.querySelectorAll(`#cbt-q${n}-parts .cbt-part-row`).forEach((r, i) => {
        r.querySelector('.cbt-part-letter').textContent = `(${String.fromCharCode(97 + i)})`;
    });
}

// Reads one question block into the flat model (used for autosave AND for saving).
function cbtReadQuestionBlock(block) {
    const n = block.id.replace('cbt-q-', '');
    const g = id => document.getElementById(`cbt-q${n}-${id}`);
    const qType = g('type')?.value || 'mcq';
    return {
        existingId:    block.dataset.qid || null,
        qType,
        questionText:  g('text')?.value || '',
        passageId:     g('passage')?.value || '',
        optionA:       g('optA')?.value || '',
        optionB:       g('optB')?.value || '',
        optionC:       g('optC')?.value || '',
        optionD:       g('optD')?.value || '',
        correctAnswer: document.querySelector(`input[name="cbt-q${n}-correct"]:checked`)?.value || '',
        acceptedText:  g('accepted')?.value || '',
        guide:         g('guide')?.value || '',
        gapSource:     g('gap')?.value || '',
        wordBank:      g('bank')?.value || '',
        marks:         parseInt(g('marks')?.value, 10) || 1,
        gapMarks:      qType === 'gap' ? (parseInt(g('marks')?.value, 10) || 1) : 1,
        parts:         Array.from(block.querySelectorAll('.cbt-part-row')).map(r => ({
            prompt:   r.querySelector('.cbt-part-prompt')?.value || '',
            marks:    parseInt(r.querySelector('.cbt-part-marks')?.value, 10) || 1,
            accepted: r.querySelector('.cbt-part-acc')?.value || ''
        }))
    };
}

function cbtValidateQuestion(m) {
    const text = (m.questionText || '').trim();
    if (!text) return 'Please enter the question text.';
    if (m.qType === 'mcq') {
        if (!m.optionA.trim() || !m.optionB.trim()) return 'Options A and B are required.';
        if (!m.correctAnswer) return 'Please select the correct answer.';
        if (!m['option' + m.correctAnswer].trim()) return 'The option marked correct is empty.';
    }
    if (m.qType === 'gap') {
        if (!cbtParseGapSource(m.gapSource).answers.length) return 'Add at least one gap by wrapping the answer in [[double brackets]].';
        if (cbtParseGapSource(m.gapSource).answers.some(a => !a.answers.length)) return 'One of the gaps has no answer inside its [[ ]].';
    }
    if (m.qType === 'parts') {
        const filled = (m.parts || []).filter(p => p.prompt.trim());
        if (!filled.length) return 'Add at least one part with a question.';
    }
    return null;
}

// Flat model -> the Firestore question document (every field always present).
function cbtModelToDoc(m, order, passageIds) {
    const isMcq = m.qType === 'mcq';
    const doc = {
        existingId: m.existingId || null,
        questionText: (m.questionText || '').trim(),
        type: isMcq ? 'mcq' : 'theory',
        theoryType: isMcq ? null : m.qType,
        passageId: m.passageId && passageIds.has(m.passageId) ? m.passageId : null,
        order,
        optionA: isMcq ? (m.optionA.trim() || null) : null,
        optionB: isMcq ? (m.optionB.trim() || null) : null,
        optionC: isMcq ? (m.optionC.trim() || null) : null,
        optionD: isMcq ? (m.optionD.trim() || null) : null,
        correctAnswer: isMcq ? (m.correctAnswer || null) : null,
        marks: 1,
        acceptedAnswers: null,
        modelAnswer: null,
        gapTemplate: null,
        gapAnswers: null,
        gapMarks: null,
        wordBank: null,
        parts: null
    };
    if (m.qType === 'short') {
        doc.marks = Math.max(1, m.marks || 1);
        doc.acceptedAnswers = (m.acceptedText || '').split('\n').map(x => x.trim()).filter(Boolean);
    } else if (m.qType === 'essay') {
        doc.marks = Math.max(1, m.marks || 1);
        doc.modelAnswer = (m.guide || '').trim() || null;
    } else if (m.qType === 'gap') {
        const parsed = cbtParseGapSource(m.gapSource);
        doc.gapTemplate = parsed.template;
        doc.gapAnswers  = parsed.answers;
        doc.gapMarks    = Math.max(1, m.gapMarks || 1);
        doc.marks       = parsed.answers.length * doc.gapMarks;
        doc.wordBank    = (m.wordBank || '').trim() || null;
    } else if (m.qType === 'parts') {
        doc.parts = (m.parts || []).filter(p => p.prompt.trim()).map(p => ({
            prompt: p.prompt.trim(),
            marks: Math.max(1, p.marks || 1),
            accepted: (p.accepted || '').split(',').map(x => x.trim()).filter(Boolean)
        }));
        doc.marks = doc.parts.reduce((t, p) => t + p.marks, 0) || 1;
    }
    return doc;
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
    // Validate — these basic details are always required, draft or not
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

    // Only require at least one question when actually PUBLISHING.
    // A draft can be saved with zero questions — that's the point of a draft.
    if (publish && questionBlocks.length === 0) {
        window.showToast?.('Please add at least one question before publishing.', 'warning'); return;
    }

    const passages = cbtReadPassages();
    if (publish) {
        for (let i = 0; i < passages.length; i++) {
            const pp = passages[i];
            if (!pp.text.trim() && !(pp.type === 'image' && pp.imageUrl)) {
                window.showToast?.(`Passage ${i + 1} is empty. Add its text (or picture link) or remove it.`, 'warning'); return;
            }
            if (pp.type === 'image' && pp.imageUrl && !/^https?:\/\//i.test(pp.imageUrl)) {
                window.showToast?.(`Passage ${i + 1}: the picture link must start with http:// or https://`, 'warning'); return;
            }
        }
    }
    const passageIds = new Set(passages.map(x => x.id));

    const questions = [];
    let hasError = false;

    questionBlocks.forEach((block, idx) => {
        if (hasError) return;
        const m = cbtReadQuestionBlock(block);
        const err = publish ? cbtValidateQuestion(m) : null;
        if (err) { window.showToast?.(`Question ${idx + 1}: ${err}`, 'warning'); hasError = true; return; }
        questions.push(cbtModelToDoc(m, idx, passageIds));
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
        passages,
        totalMarks:  questions.reduce((t, q) => t + (Number(q.marks) || 1), 0),
        hasTheory:   questions.some(q => q.type === 'theory'),
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

            const { existingId, ...fields } = q;
            batch.set(ref, Object.assign({ testId: testDocId }, fields), { merge: true });
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
                    ${r.pendingReview ? '<div style="font-size:10.5px;font-weight:700;color:#b45309;background:#fef3c7;border-radius:9999px;padding:2px 8px;margin-top:4px;display:inline-block;">Awaiting marking</div>' : ''}
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

// ── Proctoring timeline ──────────────────────────────────────────────────
// Fetches every cbt_proctoring event for this specific pupil + test. Query
// uses two equality filters only (no orderBy) so no composite Firestore
// index is required — the small result set is sorted client-side instead.
async function cbtFetchProctoringEvents(testId, pupilId) {
    try {
        const snap = await db.collection('cbt_proctoring')
            .where('testId', '==', testId)
            .where('pupilId', '==', pupilId)
            .get();

        const events = snap.docs.map(d => d.data());
        events.sort((a, b) => (a.timestamp?.toMillis?.() || 0) - (b.timestamp?.toMillis?.() || 0));
        return events;
    } catch (err) {
        console.error('Error loading proctoring events:', err);
        return [];
    }
}

// Builds the HTML for the proctoring timeline block. Returns an empty-state
// message if there were no incidents — that's the common case and should
// read as reassuring, not like something failed to load.
function cbtRenderProctoringTimeline(events) {
    if (!events || events.length === 0) {
        return `
            <div style="display:flex;align-items:center;gap:8px;padding:12px 14px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;margin-bottom:18px;">
                <i data-lucide="shield-check" style="width:16px;height:16px;color:#16a34a;flex-shrink:0;"></i>
                <span style="font-size:12.5px;color:#14532d;font-weight:600;">No tab-switch or focus-loss events were recorded during this attempt.</span>
            </div>
        `;
    }

    const eventLabels = {
        tab_hidden:   { label: 'Switched away from the test tab', icon: 'eye-off' },
        window_blur:  { label: 'Left the browser window',         icon: 'external-link' }
    };

    const rows = events.map((ev, idx) => {
        const meta = eventLabels[ev.eventType] || { label: ev.eventType || 'Unknown event', icon: 'alert-triangle' };
        const time = ev.timestamp?.toDate
            ? ev.timestamp.toDate().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
            : '—';
        return `
            <div style="display:flex;align-items:center;gap:10px;padding:8px 0;${idx < events.length - 1 ? 'border-bottom:1px dashed #fde68a;' : ''}">
                <span style="width:26px;height:26px;min-width:26px;border-radius:50%;background:#fef3c7;color:#92400e;display:flex;align-items:center;justify-content:center;">
                    <i data-lucide="${meta.icon}" style="width:13px;height:13px;"></i>
                </span>
                <span style="font-size:12.5px;color:#78350f;font-weight:600;flex:1;">${escHtml(meta.label)}</span>
                <span style="font-size:11.5px;color:#92400e;font-weight:700;font-family:monospace;">${time}</span>
                <span style="font-size:10.5px;color:#a16207;">#${ev.switchCount || (idx + 1)}</span>
            </div>`;
    }).join('');

    return `
        <details style="margin-bottom:18px;background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:14px 16px;" open>
            <summary style="cursor:pointer;font-size:12.5px;font-weight:700;color:#92400e;display:flex;align-items:center;gap:6px;list-style:none;">
                <i data-lucide="shield-alert" style="width:14px;height:14px;"></i>
                Proctoring Timeline &nbsp;·&nbsp; ${events.length} event${events.length !== 1 ? 's' : ''}
            </summary>
            <div style="margin-top:10px;">${rows}</div>
        </details>
    `;
}

// ── View a pupil's full attempt ──────────────────────────────────────────
// Opens a modal showing every question from that submission — the pupil's
// answer vs. the correct one, in the order they appeared on the pupil's
// screen — plus a summary header (score, time taken, tab switches) and,
// now, the full chronological proctoring timeline (every tab-switch /
// focus-loss event, not just the running count). Any question the pupil
// flagged is marked and, if scrollToFlagged is true (i.e. opened via the
// Flagged badge rather than the score), the view jumps straight to it.
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
        <div id="cbt-proctoring-timeline">
            <div style="text-align:center;padding:10px;color:#94a3b8;font-size:12px;">Loading proctoring log…</div>
        </div>
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

    const timelineEl = document.getElementById('cbt-proctoring-timeline');
    const bodyEl     = document.getElementById('cbt-attempt-body');

    // Fetch the proctoring timeline and the question-by-question review in
    // parallel — they're independent queries against different collections.
    const [proctoringEvents] = await Promise.all([
        resultMeta ? cbtFetchProctoringEvents(resultMeta.testId, resultMeta.pupilId) : Promise.resolve([]),
        (async () => {
            try {
                const reviewSnap = await db.collection('cbt_reviews')
                    .where('resultId', '==', resultId)
                    .limit(1)
                    .get();

                if (reviewSnap.empty) {
                    bodyEl.innerHTML = `<p style="text-align:center;color:#94a3b8;padding:20px;">No review data found for this submission.</p>`;
                    return;
                }

                const reviewDoc  = reviewSnap.docs[0];
                const reviewData = reviewDoc.data().answers || [];
                const letters = ['A','B','C','D'];
                const keys    = ['optionA','optionB','optionC','optionD'];
                const hasTheory = reviewData.some(it => it.type === 'theory');

                bodyEl.innerHTML = reviewData.map((item, i) => {
                    const isFlagged = !!item.flagged;
                    const wrapStart = `
                        <div class="${isFlagged ? 'cbt-attempt-flagged' : ''}"
                             style="border:1px solid ${isFlagged ? '#fde68a' : '#e2e8f0'};background:${isFlagged ? '#fffbeb' : '#ffffff'};border-radius:12px;padding:16px;margin-bottom:14px;">`;
                    const flagBadge = isFlagged ? '<span style="font-size:10.5px;font-weight:700;padding:2px 9px;border-radius:9999px;background:#fef3c7;color:#92400e;"><i data-lucide="flag" style="width:10px;height:10px;vertical-align:-1px;"></i> Flagged</span>' : '';

                    if (item.type === 'theory') {
                        const itemsHtml = (item.items || []).map((it, ii) => `
                            <div style="border:1.5px solid #e2e8f0;border-radius:10px;padding:10px 12px;margin-bottom:8px;background:#f8fafc;">
                                ${it.label ? `<div style="font-size:12px;font-weight:700;color:#475569;margin-bottom:4px;">${escHtml(it.label)}</div>` : ''}
                                <div style="font-size:13.5px;color:#0f172a;white-space:pre-wrap;word-break:break-word;">${it.answer ? escHtml(it.answer) : '<em style="color:#94a3b8;">No answer</em>'}</div>
                                ${(it.accepted || []).length ? `<div style="font-size:11.5px;color:#16a34a;margin-top:4px;">Accepted: ${escHtml(it.accepted.join(' / '))}</div>` : ''}
                                <div style="display:flex;align-items:center;gap:8px;margin-top:8px;flex-wrap:wrap;">
                                    <label style="font-size:12px;font-weight:700;color:#475569;">Marks</label>
                                    <input type="number" class="cbt-mark-input" data-qi="${i}" data-ii="${ii}" min="0" max="${it.max}" step="0.5"
                                           value="${it.pending ? '' : it.earned}" placeholder="–"
                                           style="width:70px;padding:6px 8px;border:1.5px solid ${it.pending ? '#f59e0b' : '#cbd5e1'};border-radius:8px;font-size:13px;">
                                    <span style="font-size:12px;color:#64748b;">out of ${it.max}</span>
                                    <span style="font-size:10.5px;font-weight:700;padding:2px 8px;border-radius:9999px;${it.pending ? 'background:#fef3c7;color:#92400e;' : it.auto ? 'background:#dbeafe;color:#1e40af;' : 'background:#dcfce7;color:#14532d;'}">${it.pending ? 'Needs marking' : it.auto ? 'Auto-marked' : 'Marked'}</span>
                                </div>
                            </div>`).join('');
                        return `${wrapStart}
                            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px;">
                                <span style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;">Question ${i + 1}</span>
                                <span style="font-size:10.5px;font-weight:700;padding:2px 9px;border-radius:9999px;background:#ede9fe;color:#5b21b6;">Written · ${item.marks} mark${item.marks === 1 ? '' : 's'}</span>
                                ${flagBadge}
                            </div>
                            <div style="font-size:14px;font-weight:600;color:#0f172a;margin-bottom:10px;line-height:1.5;">${escHtml(item.questionText)}</div>
                            ${item.gapTemplate ? `<div style="font-size:12.5px;color:#475569;margin-bottom:10px;">${escHtml(String(item.gapTemplate).replace(/\{\{(\d+)\}\}/g, (m, g) => '(' + (Number(g) + 1) + ') ____'))}</div>` : ''}
                            ${itemsHtml}
                            ${item.modelAnswer ? `<div style="font-size:12.5px;color:#0f766e;background:#f0fdfa;border-radius:8px;padding:8px 10px;margin-top:4px;"><strong>Marking guide:</strong> ${escHtml(item.modelAnswer)}</div>` : ''}
                        </div>`;
                    }

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

                    return `${wrapStart}
                            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px;">
                                <span style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;">Question ${i + 1}</span>
                                <span style="font-size:10.5px;font-weight:700;padding:2px 9px;border-radius:9999px;background:${statusColor}1a;color:${statusColor};">${statusLabel}</span>
                                ${flagBadge}
                            </div>
                            <div style="font-size:14px;font-weight:600;color:#0f172a;margin-bottom:12px;line-height:1.5;">${escHtml(item.questionText)}</div>
                            ${optionsHTML}
                        </div>`;
                }).join('');

                if (hasTheory) {
                    const bar = document.createElement('div');
                    bar.style.cssText = 'position:sticky;bottom:-28px;background:#fff;padding:12px 0 4px;border-top:1px solid #e2e8f0;display:flex;gap:10px;align-items:center;flex-wrap:wrap;';
                    bar.innerHTML = `<button type="button" id="cbt-save-marks" class="btn tp-btn-primary" style="padding:9px 18px;font-size:13px;">Save marks</button>
                                     <span style="font-size:12px;color:#64748b;">Leave a box empty to keep that answer waiting. Auto-marked boxes can be overridden.</span>`;
                    bodyEl.appendChild(bar);
                    bar.querySelector('#cbt-save-marks').addEventListener('click', () => cbtSaveTheoryMarks(reviewDoc, resultId, resultMeta, bodyEl, close));
                }
            } catch (err) {
                console.error('Error loading pupil attempt:', err);
                bodyEl.innerHTML = `<p style="text-align:center;color:#dc2626;padding:20px;">Failed to load this attempt.</p>`;
            }
        })()
    ]);

    timelineEl.innerHTML = cbtRenderProctoringTimeline(proctoringEvents);

    if (typeof lucide !== 'undefined') lucide.createIcons();

    if (scrollToFlagged) {
        const firstFlagged = bodyEl.querySelector('.cbt-attempt-flagged');
        if (firstFlagged) firstFlagged.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

// ── Theory marking ─────────────────────────────────────────────────────────
function cbtGradeFromPct(pct) {
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

async function cbtSaveTheoryMarks(reviewDoc, resultId, resultMeta, bodyEl, closeFn) {
    const btn = bodyEl.querySelector('#cbt-save-marks');
    const answers = JSON.parse(JSON.stringify(reviewDoc.data().answers || []));
    let invalid = false;

    bodyEl.querySelectorAll('.cbt-mark-input').forEach(inp => {
        const it  = answers[Number(inp.dataset.qi)]?.items?.[Number(inp.dataset.ii)];
        const raw = inp.value.trim();
        if (!it || raw === '') return;
        const v = Number(raw);
        if (!isFinite(v) || v < 0 || v > it.max) { invalid = true; inp.style.borderColor = '#dc2626'; return; }
        it.earned  = v;
        it.pending = false;
    });
    if (invalid) { window.showToast?.('Some marks are outside the allowed range.', 'warning'); return; }

    let score = 0, total = 0, pendingMarks = 0;
    answers.forEach(q => {
        if (q.type === 'theory') {
            const items = q.items || [];
            q.earned  = items.reduce((t, it) => t + (it.pending ? 0 : it.earned), 0);
            q.pending = items.some(it => it.pending);
            q.isCorrect = q.pending ? null : q.earned === q.marks;
            score += q.earned;
            total += q.marks;
            items.forEach(it => { if (it.pending) pendingMarks += it.max; });
        } else {
            total += q.marks ?? 1;
            score += q.earned ?? (q.isCorrect ? 1 : 0);
        }
    });
    const pct = total ? Math.round((score / total) * 100) : 0;
    const grade = cbtGradeFromPct(pct);

    if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
    try {
        await reviewDoc.ref.update({ answers });
        await db.collection('cbt_results').doc(resultId).update({
            score, total, percentage: pct, grade,
            pendingReview: pendingMarks > 0,
            pendingMarks,
            markedBy: window.currentUser.uid,
            markedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        try {
            const at = await db.collection('cbt_attempts')
                .where('testId', '==', resultMeta.testId)
                .where('pupilId', '==', resultMeta.pupilId)
                .where('status', '==', 'completed').limit(1).get();
            if (!at.empty) await at.docs[0].ref.update({ score, total, percentage: pct });
        } catch (e) { console.warn('Attempt mirror not updated:', e); }

        window.showToast?.(pendingMarks > 0 ? 'Marks saved. Some answers are still waiting.' : 'Marks saved. Result is final.', 'success', 5000);
        closeFn();
        await viewCbtResults(resultMeta.testId, resultMeta.testTitle);
    } catch (err) {
        console.error('Error saving marks:', err);
        window.showToast?.('Failed to save marks: ' + err.message, 'danger', 8000);
        if (btn) { btn.disabled = false; btn.textContent = 'Save marks'; }
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

console.log('✓ CBT Teacher module v1.6.0 loaded (proctoring timeline added to attempt review)');
