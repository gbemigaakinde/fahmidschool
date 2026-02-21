/**
 * FAHMID NURSERY & PRIMARY SCHOOL
 * Lesson Notes - Teacher Module
 *
 * @version 1.0.0
 * @date 2026-02-21
 *
 * Collection: lesson_notes
 * Document ID: {classId}_{encodedSession}_{term}_week{weekNumber}
 *
 * Status workflow:
 *   draft → pending → approved
 *                  ↘ rejected → draft (editable again)
 *
 * Dependencies (all already present in teacher.html):
 *   - window.db                  (firebase-init.js)
 *   - window.getCurrentSettings  (firebase-init.js)
 *   - window.showToast           (firebase-init.js)
 *   - window.handleError         (firebase-init.js)
 *   - window.currentUser         (teacher.js — exposed at init)
 *   - window.assignedClasses     (teacher.js — exposed after load)
 *   - firebase.firestore.FieldValue (firebase compat SDK)
 */

'use strict';

/* ============================================================
   CONSTANTS
============================================================ */

const LN_TERMS        = ['First Term', 'Second Term', 'Third Term'];
const LN_MAX_WEEKS    = 13;
const LN_HISTORY_CAP  = 5; // max edit history snapshots stored per document

const LN_CONTENT_FIELDS = [
  { id: 'ln-topic',               label: 'Topic / Title',              required: true,  rows: 1,  placeholder: 'Main topic for this week' },
  { id: 'ln-subtopic',            label: 'Sub-topic',                  required: false, rows: 1,  placeholder: 'Sub-topic or unit (optional)' },
  { id: 'ln-objectives',          label: 'Learning Objectives',        required: true,  rows: 3,  placeholder: 'By the end of this week, pupils should be able to...' },
  { id: 'ln-resources',           label: 'Resources / Materials',      required: false, rows: 2,  placeholder: 'Textbooks, charts, flashcards, etc.' },
  { id: 'ln-introduction',        label: 'Introduction / Starter',     required: true,  rows: 3,  placeholder: 'How will you introduce the lesson?' },
  { id: 'ln-development',         label: 'Lesson Development',         required: true,  rows: 5,  placeholder: 'Step-by-step teaching activities...' },
  { id: 'ln-conclusion',          label: 'Conclusion / Summary',       required: true,  rows: 3,  placeholder: 'How will you close and recap the lesson?' },
  { id: 'ln-assessment',          label: 'Assessment / Evaluation',    required: false, rows: 2,  placeholder: 'Classwork, oral questions, observation...' },
  { id: 'ln-assignment',          label: 'Assignment / Homework',      required: false, rows: 2,  placeholder: 'Take-home task (if any)' },
];

/* ============================================================
   MODULE STATE
   Scoped here, not polluting teacher.js globals
============================================================ */

let _ln_currentDocId    = null; // docId of note currently open in form
let _ln_currentStatus   = null; // status of currently open note
let _ln_isSaving        = false; // click-guard for save

/* ============================================================
   ENTRY POINT — called by sectionLoaders in teacher.js
============================================================ */

async function loadLessonNotesSection() {
  const container = document.getElementById('lesson-notes-container');
  if (!container) {
    console.error('lesson-notes-container not found');
    return;
  }

  // Guard: classes must be loaded
  if (!window.assignedClasses || window.assignedClasses.length === 0) {
    container.innerHTML = `
      <div class="alert alert-warning" style="margin-top: var(--space-xl);">
        <strong>⚠️ No class assigned</strong>
        <p>You do not have a class assigned yet. Contact admin to set up your class.</p>
      </div>`;
    return;
  }

  _ln_currentDocId  = null;
  _ln_currentStatus = null;

  _lnRenderShell(container);
  await _lnLoadNotesList();
}

/* ============================================================
   SHELL LAYOUT
   Renders the two-panel structure: list on left, form on right.
   On mobile they stack vertically.
============================================================ */

function _lnRenderShell(container) {
  container.innerHTML = `
    <!-- Panel: Note List -->
    <div id="ln-list-panel">

      <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:var(--space-md); margin-bottom:var(--space-lg);">
        <h2 style="margin:0; font-size:var(--text-xl);">My Lesson Notes</h2>
        <button class="btn btn-primary" onclick="lnOpenNewForm()" id="ln-new-btn">
          + New Lesson Note
        </button>
      </div>

      <!-- Filters -->
      <div class="form-row form-row-2" style="margin-bottom:var(--space-md);">
        <div class="form-group" style="margin-bottom:0;">
          <label for="ln-filter-term" style="font-size:var(--text-sm);">Filter by Term</label>
          <select id="ln-filter-term" onchange="lnApplyFilters()">
            <option value="">All Terms</option>
            ${LN_TERMS.map(t => `<option value="${t}">${t}</option>`).join('')}
          </select>
        </div>
        <div class="form-group" style="margin-bottom:0;">
          <label for="ln-filter-status" style="font-size:var(--text-sm);">Filter by Status</label>
          <select id="ln-filter-status" onchange="lnApplyFilters()">
            <option value="">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="pending">Pending Approval</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      <!-- Note Cards -->
      <div id="ln-notes-list">
        <div style="text-align:center; padding:var(--space-2xl); color:var(--color-gray-600);">
          <div class="spinner" style="margin:0 auto var(--space-md);"></div>
          Loading your lesson notes...
        </div>
      </div>

    </div>

    <!-- Panel: Form (hidden until needed) -->
    <div id="ln-form-panel" style="display:none; margin-top:var(--space-xl);">
      <!-- form content rendered by _lnRenderForm() -->
    </div>
  `;
}

/* ============================================================
   LOAD & DISPLAY NOTE LIST
============================================================ */

let _ln_allNotes = []; // cached for client-side filtering

async function _lnLoadNotesList() {
  const listEl = document.getElementById('ln-notes-list');
  if (!listEl) return;

  listEl.innerHTML = `
    <div style="text-align:center; padding:var(--space-2xl); color:var(--color-gray-600);">
      <div class="spinner" style="margin:0 auto var(--space-md);"></div>
      Loading...
    </div>`;

  try {
    const teacherId = window.currentUser?.uid;
    if (!teacherId) throw new Error('User not authenticated');

    const snap = await window.db
      .collection('lesson_notes')
      .where('teacherId', '==', teacherId)
      .orderBy('updatedAt', 'desc')
      .get();

    _ln_allNotes = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    _lnRenderNoteCards(_ln_allNotes, listEl);

  } catch (err) {
    console.error('Error loading lesson notes:', err);
    listEl.innerHTML = `
      <div style="text-align:center; padding:var(--space-xl); color:var(--color-danger);">
        ❌ Failed to load lesson notes. Please refresh.
      </div>`;
  }
}

function _lnRenderNoteCards(notes, container) {
  if (!container) return;

  if (notes.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding:var(--space-2xl); color:var(--color-gray-600); 
                  border:2px dashed var(--color-gray-300); border-radius:var(--radius-lg);">
        <div style="font-size:2.5rem; margin-bottom:var(--space-md);">📝</div>
        <p style="margin:0; font-size:var(--text-base);">No lesson notes yet.</p>
        <p style="margin:var(--space-xs) 0 0; font-size:var(--text-sm);">Click <strong>+ New Lesson Note</strong> to create your first one.</p>
      </div>`;
    return;
  }

  const cards = notes.map(note => {
    const statusBadge = _lnStatusBadge(note.status);
    const updatedDate  = note.updatedAt
      ? note.updatedAt.toDate().toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })
      : '—';

    // Show rejection reason as a small callout if rejected
    const rejectionCallout = (note.status === 'rejected' && note.adminFeedback)
      ? `<div style="margin-top:var(--space-sm); padding:var(--space-sm) var(--space-md); 
                     background:#fef2f2; border-left:3px solid var(--color-danger); 
                     border-radius:0 var(--radius-sm) var(--radius-sm) 0;
                     font-size:var(--text-xs); color:#7f1d1d;">
           <strong>Feedback:</strong> ${_lnEscape(note.adminFeedback)}
         </div>`
      : '';

    // Actions available depend on status
    const canEdit   = note.status === 'draft' || note.status === 'rejected';
    const canSubmit = note.status === 'draft' || note.status === 'rejected';
    const canPrint  = true;

    const actionButtons = `
      <div style="display:flex; gap:var(--space-sm); flex-wrap:wrap; margin-top:var(--space-md);">
        ${canEdit   ? `<button class="btn btn-secondary btn-sm" onclick="lnOpenEditForm('${note.id}')">✏️ Edit</button>` : ''}
        ${canSubmit ? `<button class="btn btn-primary btn-sm"   onclick="lnSubmitNote('${note.id}')">📤 Submit</button>` : ''}
        ${canPrint  ? `<button class="btn btn-sm" style="background:var(--color-gray-100); color:var(--color-gray-700);" onclick="lnPrintNote('${note.id}')">🖨️ Print</button>` : ''}
      </div>`;

    return `
      <div class="ln-card" data-id="${note.id}" data-status="${note.status}" data-term="${note.term}"
           style="background:white; border:1px solid var(--color-gray-200); border-radius:var(--radius-lg);
                  padding:var(--space-lg); margin-bottom:var(--space-md);
                  box-shadow:0 1px 3px rgba(0,0,0,0.06);">

        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:var(--space-md); flex-wrap:wrap;">
          <div style="flex:1; min-width:0;">
            <div style="font-weight:700; font-size:var(--text-base); color:var(--color-gray-900); 
                        white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
              Week ${note.weekNumber} — ${_lnEscape(note.topic || 'Untitled')}
            </div>
            <div style="font-size:var(--text-sm); color:var(--color-gray-600); margin-top:4px;">
              ${_lnEscape(note.term)} &nbsp;·&nbsp; ${_lnEscape(note.session)} &nbsp;·&nbsp; ${_lnEscape(note.subject || note.className || '')}
            </div>
            <div style="font-size:var(--text-xs); color:var(--color-gray-500); margin-top:2px;">
              Last updated: ${updatedDate} &nbsp;·&nbsp; v${note.version || 1}
            </div>
          </div>
          <div style="flex-shrink:0;">
            ${statusBadge}
          </div>
        </div>

        ${rejectionCallout}
        ${actionButtons}
      </div>`;
  }).join('');

  container.innerHTML = cards;
}

/* ============================================================
   CLIENT-SIDE FILTERING (no extra Firestore reads)
============================================================ */

function lnApplyFilters() {
  const termFilter   = document.getElementById('ln-filter-term')?.value   || '';
  const statusFilter = document.getElementById('ln-filter-status')?.value || '';

  const filtered = _ln_allNotes.filter(note => {
    const termMatch   = !termFilter   || note.term   === termFilter;
    const statusMatch = !statusFilter || note.status === statusFilter;
    return termMatch && statusMatch;
  });

  const listEl = document.getElementById('ln-notes-list');
  if (listEl) _lnRenderNoteCards(filtered, listEl);
}

/* ============================================================
   FORM: NEW NOTE
============================================================ */

async function lnOpenNewForm() {
  const formPanel = document.getElementById('ln-form-panel');
  if (!formPanel) return;

  _ln_currentDocId  = null;
  _ln_currentStatus = 'draft';

  // Get default term from current settings
  let defaultTerm = 'First Term';
  try {
    const settings = await window.getCurrentSettings();
    defaultTerm = settings.term || 'First Term';
  } catch (e) { /* use fallback */ }

  _lnRenderForm(formPanel, null, defaultTerm);
  _lnScrollToForm();
}

/* ============================================================
   FORM: EDIT EXISTING NOTE
============================================================ */

async function lnOpenEditForm(docId) {
  const formPanel = document.getElementById('ln-form-panel');
  if (!formPanel) return;

  formPanel.innerHTML = `
    <div style="text-align:center; padding:var(--space-2xl); color:var(--color-gray-600);">
      <div class="spinner" style="margin:0 auto var(--space-md);"></div>
      Loading note...
    </div>`;
  formPanel.style.display = 'block';
  _lnScrollToForm();

  try {
    const doc = await window.db.collection('lesson_notes').doc(docId).get();

    if (!doc.exists) {
      window.showToast?.('Note not found. It may have been deleted.', 'danger');
      formPanel.style.display = 'none';
      return;
    }

    const data = doc.data();

    // Security: teacher can only edit their own notes in draft/rejected state
    if (data.teacherId !== window.currentUser?.uid) {
      window.showToast?.('You do not have permission to edit this note.', 'danger');
      formPanel.style.display = 'none';
      return;
    }

    if (data.status !== 'draft' && data.status !== 'rejected') {
      window.showToast?.('This note cannot be edited in its current status.', 'warning');
      formPanel.style.display = 'none';
      return;
    }

    _ln_currentDocId  = docId;
    _ln_currentStatus = data.status;

    _lnRenderForm(formPanel, data, data.term);

  } catch (err) {
    console.error('Error opening edit form:', err);
    window.showToast?.('Failed to load note for editing.', 'danger');
    formPanel.style.display = 'none';
  }
}

/**
 * Fetch subjects assigned to a class.
 * Reads the subjects array from the class document.
 */
async function _lnGetClassSubjects(classId) {
  if (!classId) return [];
  try {
    const classDoc = await db.collection('classes').doc(classId).get();
    if (!classDoc.exists) return [];
    return Array.isArray(classDoc.data().subjects) ? classDoc.data().subjects : [];
  } catch (error) {
    console.error('Error fetching class subjects:', error);
    return [];
  }
}

/* ============================================================
   FORM RENDERER
   Renders the create/edit form. `existingData` is null for new notes.
============================================================ */

async function _lnRenderForm(container, existingData, defaultTerm) {
  const isEdit    = !!existingData;
  const isNew     = !isEdit;
  const classes   = window.assignedClasses || [];

  const isDisabled = isEdit &&
    existingData?.status !== 'draft' &&
    existingData?.status !== 'rejected';

  // Build class options
  const classOptions = classes.map(c =>
    `<option value="${c.id}" data-name="${_lnEscape(c.name)}" 
      ${existingData?.classId === c.id ? 'selected' : ''}>
      ${_lnEscape(c.name)}
    </option>`
  ).join('');

  // Build week options
  const weekOptions = Array.from({ length: LN_MAX_WEEKS }, (_, i) => {
    const w = i + 1;
    return `<option value="${w}" ${existingData?.weekNumber === w ? 'selected' : ''}>Week ${w}</option>`;
  }).join('');

  // Build term options
  const termOptions = LN_TERMS.map(t =>
    `<option value="${t}" ${(existingData?.term || defaultTerm) === t ? 'selected' : ''}>${t}</option>`
  ).join('');

  // Build content field textareas
  const contentFields = LN_CONTENT_FIELDS.map(f => {
    const fieldKey = f.id.replace('ln-', '');
    const value    = existingData?.[fieldKey] || '';
    const req      = f.required ? '<span class="required">*</span>' : '';
    return `
      <div class="form-group">
        <label for="${f.id}">${f.label} ${req}</label>
        <textarea id="${f.id}" rows="${f.rows}" 
                  placeholder="${f.placeholder}"
                  style="resize:vertical;">${_lnEscape(value)}</textarea>
      </div>`;
  }).join('');

  const metaBar = isEdit ? `
    <div style="display:flex; gap:var(--space-md); align-items:center; flex-wrap:wrap;
                padding:var(--space-md) var(--space-lg); background:var(--color-gray-50);
                border-radius:var(--radius-md); margin-bottom:var(--space-xl);
                font-size:var(--text-sm); color:var(--color-gray-600);">
      <span>Document ID: <code style="font-size:0.85em;">${_ln_currentDocId}</code></span>
      <span>Version: <strong>v${existingData.version || 1}</strong></span>
      <span>Status: ${_lnStatusBadge(existingData.status)}</span>
    </div>` : '';

  const rejectionBanner = (existingData?.status === 'rejected' && existingData?.adminFeedback) ? `
    <div style="padding:var(--space-lg); background:#fef2f2; border:1px solid #fca5a5;
                border-radius:var(--radius-md); margin-bottom:var(--space-xl);">
      <strong style="color:#991b1b;">⚠️ Rejected by Admin</strong>
      <p style="margin:var(--space-sm) 0 0; color:#7f1d1d;">${_lnEscape(existingData.adminFeedback)}</p>
      <p style="margin:var(--space-sm) 0 0; font-size:var(--text-sm); color:#991b1b;">
        Please correct the note and resubmit.
      </p>
    </div>` : '';

  container.style.display = 'block';
  container.innerHTML = `
    <div style="background:white; border:1px solid var(--color-gray-200); 
                border-radius:var(--radius-lg); padding:var(--space-xl);
                box-shadow:0 2px 8px rgba(0,0,0,0.06);">

      <div style="display:flex; justify-content:space-between; align-items:center; 
                  margin-bottom:var(--space-xl); flex-wrap:wrap; gap:var(--space-md);">
        <h2 style="margin:0; font-size:var(--text-xl);">
          ${isNew ? '📝 New Lesson Note' : '✏️ Edit Lesson Note'}
        </h2>
        <button class="btn btn-secondary btn-sm" onclick="lnCloseForm()">
          ✕ Close
        </button>
      </div>

      ${metaBar}
      ${rejectionBanner}

      <div class="form-row form-row-2" style="margin-bottom:var(--space-md);">
        <div class="form-group">
          <label for="ln-class">Class <span class="required">*</span></label>
          <select id="ln-class" ${isEdit ? 'disabled' : ''}>
            <option value="">-- Select Class --</option>
            ${classOptions}
          </select>
          ${isEdit ? '<small style="color:var(--color-gray-500);">Class cannot be changed after creation</small>' : ''}
        </div>
        <div class="form-group">
          <label for="ln-subject">Subject <span class="required">*</span></label>
          <select id="ln-subject" ${isDisabled ? 'disabled' : ''}>
            <option value="">-- Select Subject --</option>
          </select>
        </div>
      </div>

      <div class="form-row form-row-2" style="margin-bottom:var(--space-xl);">
        <div class="form-group">
          <label for="ln-term">Term <span class="required">*</span></label>
          <select id="ln-term" ${isEdit ? 'disabled' : ''}>
            ${termOptions}
          </select>
          ${isEdit ? '<small style="color:var(--color-gray-500);">Term cannot be changed after creation</small>' : ''}
        </div>
        <div class="form-group">
          <label for="ln-week">Week Number <span class="required">*</span></label>
          <select id="ln-week" ${isEdit ? 'disabled' : ''}>
            <option value="">-- Select Week --</option>
            ${weekOptions}
          </select>
          ${isEdit ? '<small style="color:var(--color-gray-500);">Week cannot be changed after creation</small>' : ''}
        </div>
      </div>

      <hr style="border:none; border-top:1px solid var(--color-gray-200); margin:var(--space-xl) 0;">

      ${contentFields}

      <div style="display:flex; gap:var(--space-md); flex-wrap:wrap; margin-top:var(--space-xl); 
                  padding-top:var(--space-xl); border-top:1px solid var(--color-gray-200);">
        <button class="btn btn-primary" id="ln-save-btn" onclick="lnSaveNote()">
          💾 Save Draft
        </button>
        <button class="btn" style="background:var(--color-gray-100); color:var(--color-gray-700);" 
                onclick="lnCloseForm()">
          Cancel
        </button>
      </div>
    </div>
  `;

  const classSelect = document.getElementById('ln-class');
  const subjectSelect = document.getElementById('ln-subject');

  if (classSelect && subjectSelect) {
    const populateSubjects = async (classId, selectedSubject) => {
      const subjects = await _lnGetClassSubjects(classId);
      subjectSelect.innerHTML = '<option value="">-- Select Subject --</option>';

      subjects.forEach(name => {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        if (name === selectedSubject) opt.selected = true;
        subjectSelect.appendChild(opt);
      });

      if (subjects.length === 0) {
        subjectSelect.innerHTML = '<option value="">No subjects assigned to this class</option>';
      }
    };

    if (classSelect.value) {
      await populateSubjects(classSelect.value, existingData?.subject || '');
    }

    classSelect.addEventListener('change', function () {
      populateSubjects(this.value, '');
    });
  }
}

/* ============================================================
   CLOSE FORM
============================================================ */

function lnCloseForm() {
  const formPanel = document.getElementById('ln-form-panel');
  if (formPanel) {
    formPanel.style.display = 'none';
    formPanel.innerHTML = '';
  }
  _ln_currentDocId  = null;
  _ln_currentStatus = null;
}

/* ============================================================
   SAVE DRAFT
============================================================ */

async function lnSaveNote() {
  // Click guard
  if (_ln_isSaving) {
    console.log('Save already in progress');
    return;
  }

  // --- Collect identity fields ---
  const classSelect  = document.getElementById('ln-class');
  const classId      = classSelect?.value;
  const className    = classSelect?.options[classSelect.selectedIndex]?.dataset?.name
                       || window.assignedClasses?.find(c => c.id === classId)?.name
                       || '';
  const subject      = document.getElementById('ln-subject')?.value?.trim();
  const term         = document.getElementById('ln-term')?.value;
  const weekNumber   = parseInt(document.getElementById('ln-week')?.value) || 0;

  // --- Collect content fields ---
  const contentValues = {};
  for (const f of LN_CONTENT_FIELDS) {
    const fieldKey = f.id.replace('ln-', '');
    contentValues[fieldKey] = document.getElementById(f.id)?.value?.trim() || '';
  }

  // --- Validation ---
  const errors = [];

  // For new notes, identity fields are editable and required
  if (!_ln_currentDocId) {
    if (!classId)        errors.push('Please select a class.');
    if (!term)           errors.push('Please select a term.');
    if (!weekNumber)     errors.push('Please select a week number.');
  }

  if (!subject)          errors.push('Subject is required.');

  // Required content fields
  for (const f of LN_CONTENT_FIELDS) {
    if (f.required) {
      const fieldKey = f.id.replace('ln-', '');
      if (!contentValues[fieldKey]) errors.push(`"${f.label}" is required.`);
    }
  }

  if (errors.length > 0) {
    window.showToast?.(`Please fix the following:\n• ${errors.join('\n• ')}`, 'warning', 8000);
    return;
  }

  // --- Set loading state ---
  _ln_isSaving = true;
  const saveBtn     = document.getElementById('ln-save-btn');
  const origHTML    = saveBtn?.innerHTML;
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.innerHTML = `
      <span style="display:inline-flex; align-items:center; gap:0.5rem;">
        <span style="width:14px; height:14px; border:2px solid transparent; 
                     border-top-color:currentColor; border-radius:50%; 
                     display:inline-block; animation:spin 0.8s linear infinite;"></span>
        Saving...
      </span>`;
  }

  try {
    // --- Get session context (follows teacher.js pattern exactly) ---
    const settings         = await window.getCurrentSettings();
    const session          = settings.session || 'Unknown';
    const encodedSession   = session.replace(/\//g, '-');
    const sessionStartYear = settings.currentSession?.startYear || null;
    const sessionEndYear   = settings.currentSession?.endYear   || null;
    const sessionTerm      = `${session}_${term || document.getElementById('ln-term')?.value}`;

    // For edits, identity fields come from the existing document (fields are disabled in form)
    let finalClassId    = classId;
    let finalClassName  = className;
    let finalTerm       = term;
    let finalWeek       = weekNumber;

    if (_ln_currentDocId) {
      // Re-read from existing doc to be safe (fields were disabled)
      const existingDoc = await window.db.collection('lesson_notes').doc(_ln_currentDocId).get();
      if (existingDoc.exists) {
        const d       = existingDoc.data();
        finalClassId  = d.classId;
        finalClassName= d.className;
        finalTerm     = d.term;
        finalWeek     = d.weekNumber;
      }
    }

    // --- Build document ID ---
    // Pattern: {classId}_{encodedSession}_{term}_week{weekNumber}
    // Spaces in term are fine in Firestore doc IDs, but encode for safety
    const encodedTerm = finalTerm.replace(/ /g, '_');
    const docId       = _ln_currentDocId
      || `${finalClassId}_${encodedSession}_${encodedTerm}_week${finalWeek}`;

    // --- Build edit history snapshot ---
    const snapshot = {
      editedAt:  firebase.firestore.FieldValue.serverTimestamp(),
      editedBy:  window.currentUser.uid,
      ...contentValues,
      subject
    };

    // --- Build the full document data ---
    const now = firebase.firestore.FieldValue.serverTimestamp();

    // For a new document, set all fields
    // For an edit, merge (preserves status, submission timestamps, etc.)
    let docData;

    if (!_ln_currentDocId) {
      // New document — full creation payload
      docData = {
        // Identity
        classId:         finalClassId,
        className:       finalClassName,
        teacherId:       window.currentUser.uid,
        teacherName:     window.currentUser.displayName || window.currentUser.email || 'Unknown',

        // Time context
        session,
        encodedSession,
        term:            finalTerm,
        weekNumber:      finalWeek,
        sessionTerm,
        sessionStartYear,
        sessionEndYear,

        // Content
        subject,
        ...contentValues,

        // Workflow
        status:          'draft',
        submittedAt:     null,
        approvedAt:      null,
        rejectedAt:      null,
        adminFeedback:   '',
        reviewedBy:      '',
        reviewedByName:  '',

        // Versioning
        version:         1,
        editHistory:     [],

        // Timestamps
        createdAt:       now,
        updatedAt:       now,
        updatedBy:       window.currentUser.uid,
      };
    } else {
      // Edit — only update content + metadata, preserve identity & workflow fields
      docData = {
        subject,
        ...contentValues,
        // Reset to draft if it was rejected (teacher is correcting it)
        status:          _ln_currentStatus === 'rejected' ? 'draft' : _ln_currentStatus,
        updatedAt:       now,
        updatedBy:       window.currentUser.uid,
      };
    }

    // --- Firestore write with versioning ---
    const ref = window.db.collection('lesson_notes').doc(docId);

    if (!_ln_currentDocId) {
      // New: simple set
      await ref.set(docData);
      _ln_currentDocId  = docId;
      _ln_currentStatus = 'draft';
    } else {
      // Edit: increment version + cap editHistory array
      // We fetch current version, then do a transaction-like update
      const currentSnap = await ref.get();
      const currentData = currentSnap.data() || {};
      const newVersion  = (currentData.version || 1) + 1;

      // Build new history (cap at LN_HISTORY_CAP)
      let history = Array.isArray(currentData.editHistory) ? [...currentData.editHistory] : [];
      history.push({
        version:  currentData.version || 1,
        editedBy: window.currentUser.uid,
        topic:    currentData.topic       || '',
        subject:  currentData.subject     || '',
        development: currentData.development || ''
        // Keep snapshot lean — just enough for admin to see what changed
      });
      if (history.length > LN_HISTORY_CAP) {
        history = history.slice(history.length - LN_HISTORY_CAP);
      }

      await ref.set({
        ...docData,
        version:      newVersion,
        editHistory:  history,
      }, { merge: true });

      _ln_currentStatus = docData.status;
    }

    window.showToast?.('✓ Lesson note saved as draft.', 'success');

    // Refresh the list (background, non-blocking)
    await _lnLoadNotesList();

    // Update form meta bar to reflect new version/status
    const metaBar = document.querySelector('#ln-form-panel [style*="Document ID"]')?.closest('div');
    if (metaBar) {
      const updatedDoc = await ref.get();
      const ud = updatedDoc.data();
      metaBar.innerHTML = `
        <span>Document ID: <code style="font-size:0.85em;">${docId}</code></span>
        <span>Version: <strong>v${ud.version}</strong></span>
        <span>Status: ${_lnStatusBadge(ud.status)}</span>`;
    }

  } catch (err) {
    console.error('Error saving lesson note:', err);
    window.showToast?.(`Failed to save: ${err.message || 'Unknown error'}`, 'danger', 6000);
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.innerHTML = origHTML || '💾 Save Draft';
    }
    _ln_isSaving = false;
  }
}

/* ============================================================
   SUBMIT FOR APPROVAL
   Can be called from the note card (list view) OR in-form.
   Validates that required fields are present before submitting.
============================================================ */

async function lnSubmitNote(docId) {
  if (!docId) {
    window.showToast?.('No note selected for submission.', 'warning');
    return;
  }

  try {
    // Fetch current document
    const snap = await window.db.collection('lesson_notes').doc(docId).get();

    if (!snap.exists) {
      window.showToast?.('Note not found.', 'danger');
      return;
    }

    const data = snap.data();

    // Security checks
    if (data.teacherId !== window.currentUser?.uid) {
      window.showToast?.('Permission denied.', 'danger');
      return;
    }

    if (data.status !== 'draft' && data.status !== 'rejected') {
      window.showToast?.('This note cannot be submitted in its current status.', 'warning');
      return;
    }

    // Content validation before submission
    const missingRequired = [];
    for (const f of LN_CONTENT_FIELDS) {
      if (f.required) {
        const key = f.id.replace('ln-', '');
        if (!data[key]) missingRequired.push(f.label);
      }
    }
    if (!data.subject) missingRequired.push('Subject');

    if (missingRequired.length > 0) {
      window.showToast?.(
        `Cannot submit — the following required fields are empty:\n• ${missingRequired.join('\n• ')}\n\nPlease edit and fill them in first.`,
        'warning',
        8000
      );
      return;
    }

    // Confirm with teacher
    const weekLabel  = `Week ${data.weekNumber}`;
    const confirmed  = confirm(
      `Submit lesson note for approval?\n\n` +
      `Class:   ${data.className}\n` +
      `Subject: ${data.subject}\n` +
      `Term:    ${data.term}\n` +
      `Week:    ${weekLabel}\n\n` +
      `Once submitted, you cannot edit until admin reviews.`
    );

    if (!confirmed) return;

    // Update status to pending
    await window.db.collection('lesson_notes').doc(docId).set({
      status:      'pending',
      submittedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt:   firebase.firestore.FieldValue.serverTimestamp(),
      updatedBy:   window.currentUser.uid,
      // Clear any previous rejection data
      adminFeedback:  '',
      rejectedAt:     null,
    }, { merge: true });

    window.showToast?.('✓ Lesson note submitted for admin approval.', 'success', 5000);

    // Close form if open, refresh list
    lnCloseForm();
    await _lnLoadNotesList();

  } catch (err) {
    console.error('Error submitting lesson note:', err);
    window.showToast?.(`Failed to submit: ${err.message || 'Unknown error'}`, 'danger', 6000);
  }
}

/* ============================================================
   PRINT LESSON NOTE
   Client-side print — no server function needed.
   Opens a styled print window with the full note.
============================================================ */

async function lnPrintNote(docId) {
  if (!docId) return;

  try {
    const snap = await window.db.collection('lesson_notes').doc(docId).get();

    if (!snap.exists) {
      window.showToast?.('Note not found.', 'danger');
      return;
    }

    const d = snap.data();

    // Security: teachers can only print their own notes
    if (d.teacherId !== window.currentUser?.uid) {
      window.showToast?.('You can only print your own lesson notes.', 'danger');
      return;
    }

    const printedOn = new Date().toLocaleDateString('en-GB', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

    // Build rows for the content sections
    const sectionRows = LN_CONTENT_FIELDS.map(f => {
      const key   = f.id.replace('ln-', '');
      const value = d[key] || '—';
      return `
        <tr>
          <td class="section-label">${f.label}</td>
          <td class="section-value">${_lnEscapeHtml(value).replace(/\n/g, '<br>')}</td>
        </tr>`;
    }).join('');

    const statusLabel = {
      draft:    'Draft',
      pending:  'Pending Approval',
      approved: 'Approved',
      rejected: 'Rejected'
    }[d.status] || d.status;

    const feedbackRow = (d.status === 'rejected' && d.adminFeedback)
      ? `<tr>
           <td class="section-label" style="color:#991b1b;">Admin Feedback</td>
           <td class="section-value" style="color:#991b1b;">${_lnEscapeHtml(d.adminFeedback)}</td>
         </tr>`
      : '';

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Lesson Note — Week ${d.weekNumber}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 11pt;
      color: #1a1a1a;
      background: white;
      padding: 20mm;
    }
    .school-name {
      text-align: center;
      font-size: 16pt;
      font-weight: 700;
      color: #1a3a5c;
      margin-bottom: 4px;
    }
    .doc-title {
      text-align: center;
      font-size: 13pt;
      font-weight: 600;
      color: #2c5282;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 2px solid #2c5282;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px 16px;
      margin-bottom: 20px;
      padding: 12px 16px;
      background: #f7fafc;
      border: 1px solid #e2e8f0;
      border-radius: 4px;
    }
    .meta-item { font-size: 10pt; }
    .meta-label { font-weight: 700; color: #4a5568; }
    .status-badge {
      display: inline-block;
      padding: 2px 10px;
      border-radius: 12px;
      font-size: 9pt;
      font-weight: 700;
      background: ${d.status === 'approved' ? '#d1fae5' : d.status === 'pending' ? '#dbeafe' : d.status === 'rejected' ? '#fee2e2' : '#f3f4f6'};
      color: ${d.status === 'approved' ? '#065f46' : d.status === 'pending' ? '#1e40af' : d.status === 'rejected' ? '#991b1b' : '#374151'};
    }
    table.content-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }
    .section-label {
      width: 28%;
      padding: 8px 12px;
      font-weight: 700;
      font-size: 10pt;
      vertical-align: top;
      background: #edf2f7;
      border: 1px solid #cbd5e0;
      color: #2d3748;
    }
    .section-value {
      padding: 8px 12px;
      font-size: 10.5pt;
      vertical-align: top;
      border: 1px solid #cbd5e0;
      line-height: 1.6;
    }
    .footer {
      margin-top: 24px;
      padding-top: 12px;
      border-top: 1px solid #e2e8f0;
      font-size: 9pt;
      color: #718096;
      display: flex;
      justify-content: space-between;
    }
    @media print {
      body { padding: 15mm; }
      @page { margin: 0; }
    }
  </style>
</head>
<body>
  <div class="school-name">Fahmid Nursery &amp; Primary School</div>
  <div class="doc-title">Weekly Lesson Note</div>

  <div class="meta-grid">
    <div class="meta-item"><span class="meta-label">Teacher:</span> ${_lnEscapeHtml(d.teacherName || '')}</div>
    <div class="meta-item"><span class="meta-label">Class:</span> ${_lnEscapeHtml(d.className || '')}</div>
    <div class="meta-item"><span class="meta-label">Subject:</span> ${_lnEscapeHtml(d.subject || '')}</div>
    <div class="meta-item"><span class="meta-label">Week:</span> Week ${d.weekNumber}</div>
    <div class="meta-item"><span class="meta-label">Term:</span> ${_lnEscapeHtml(d.term || '')}</div>
    <div class="meta-item"><span class="meta-label">Session:</span> ${_lnEscapeHtml(d.session || '')}</div>
    <div class="meta-item"><span class="meta-label">Version:</span> v${d.version || 1}</div>
    <div class="meta-item"><span class="meta-label">Status:</span> <span class="status-badge">${statusLabel}</span></div>
  </div>

  <table class="content-table">
    ${sectionRows}
    ${feedbackRow}
  </table>

  <div class="footer">
    <span>Printed: ${printedOn}</span>
    <span>Fahmid Nursery &amp; Primary School — Teacher Portal</span>
  </div>
</body>
</html>`;

    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) {
      window.showToast?.('Popup blocked. Please allow popups and try again.', 'warning', 5000);
      return;
    }

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();

    // Small delay so styles render before print dialog opens
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);

  } catch (err) {
    console.error('Error printing lesson note:', err);
    window.showToast?.('Failed to load note for printing.', 'danger');
  }
}

/* ============================================================
   HELPERS
============================================================ */

/** Status badge HTML — mirrors the style pattern in teacher.js */
function _lnStatusBadge(status) {
  const config = {
    draft:    { bg: '#f3f4f6', color: '#374151', label: 'Draft'            },
    pending:  { bg: '#dbeafe', color: '#1e40af', label: 'Pending Approval' },
    approved: { bg: '#d1fae5', color: '#065f46', label: 'Approved'         },
    rejected: { bg: '#fee2e2', color: '#991b1b', label: 'Rejected'         },
  };
  const c = config[status] || config.draft;
  return `<span style="display:inline-block; padding:3px 10px; border-radius:12px; 
                       font-size:var(--text-xs); font-weight:700;
                       background:${c.bg}; color:${c.color};">${c.label}</span>`;
}

/** Escape for insertion into HTML attributes & text nodes */
function _lnEscape(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Escape for the print window HTML */
function _lnEscapeHtml(str) {
  return _lnEscape(str);
}

/** Smooth scroll to form panel */
function _lnScrollToForm() {
  setTimeout(() => {
    const el = document.getElementById('ln-form-panel');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 100);
}

/* ============================================================
   GLOBAL EXPORTS
   All functions called from HTML onclick="" must be on window.
============================================================ */

window.loadLessonNotesSection = loadLessonNotesSection;
window.lnOpenNewForm          = lnOpenNewForm;
window.lnOpenEditForm         = lnOpenEditForm;
window.lnCloseForm            = lnCloseForm;
window.lnSaveNote             = lnSaveNote;
window.lnSubmitNote           = lnSubmitNote;
window.lnPrintNote            = lnPrintNote;
window.lnApplyFilters         = lnApplyFilters;

console.log('✓ lesson-notes-teacher.js v1.0.0 loaded');