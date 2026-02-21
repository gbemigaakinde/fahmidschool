/**
 * FAHMID NURSERY & PRIMARY SCHOOL
 * Admin Portal — Lesson Notes Management
 *
 * @file    lesson-notes-admin.js
 * @version 1.0.0
 *
 * FEATURES:
 * - View all lesson notes (all teachers, all classes)
 * - Filter by status / term / class / teacher
 * - Approve with optional feedback
 * - Reject with mandatory reason
 * - Print any note from admin side
 * - Audit trail written to audit_log collection
 *
 * DEPENDENCIES (all already present in admin portal):
 *   window.db                  (firebase-init.js)
 *   window.getCurrentSettings  (firebase-init.js)
 *   window.showToast           (firebase-init.js)
 *   window.auth                (admin.js — firebase auth handle)
 *   firebase.firestore.FieldValue
 *
 * PATTERNS:
 *   Follows loadResultApprovals() / approveResultSubmission() structure exactly.
 *   Client-side filtering (no composite index required).
 *   Pagination via window.paginateTable().
 */

'use strict';

/* ============================================================
   SECTION LOADER — called by loadSectionData('lesson-notes')
   ============================================================ */

/**
 * Entry point. Renders filter bar + notes table.
 * Called automatically when admin navigates to the lesson-notes section.
 */
window.loadLessonNotesAdminSection = async function () {
  console.log('📋 Loading admin lesson notes section...');

  const container = document.getElementById('lesson-notes-admin-container');
  if (!container) {
    console.error('❌ lesson-notes-admin-container not found');
    return;
  }

  container.innerHTML = `
    <div style="text-align:center; padding:var(--space-2xl);">
      <div class="spinner" style="margin:0 auto var(--space-md);"></div>
      <p style="color:var(--color-gray-600);">Loading lesson notes...</p>
    </div>
  `;

  try {
    /* ── Fetch all notes in one query ── */
    const snap = await window.db.collection('lesson_notes')
      .orderBy('updatedAt', 'desc')
      .limit(200)
      .get();

    /* ── Build filter options from live data ── */
    const teachers = new Map();   // teacherId → teacherName
    const classes   = new Map();  // classId   → className
    const terms     = new Set();

    const allNotes = [];
    snap.forEach(doc => {
      const d = { id: doc.id, ...doc.data() };
      allNotes.push(d);
      if (d.teacherId && d.teacherName) teachers.set(d.teacherId, d.teacherName);
      if (d.classId   && d.className)   classes.set(d.classId,   d.className);
      if (d.term) terms.add(d.term);
    });

    /* ── Cache on window so filter callbacks can reach it ── */
    window._lnAdminAllNotes = allNotes;

    /* ── Render shell ── */
    container.innerHTML = `

      <!-- ── Filter bar ───────────────────────────────────── -->
      <div id="ln-admin-filter-bar" style="
        display:flex; flex-wrap:wrap; gap:var(--space-md);
        padding:var(--space-lg);
        background:#f8fafc;
        border:1px solid #e2e8f0;
        border-radius:var(--radius-md);
        margin-bottom:var(--space-lg);">

        <div style="flex:1; min-width:160px;">
          <label style="display:block; font-size:var(--text-sm); font-weight:600; margin-bottom:4px;">Status</label>
          <select id="ln-filter-status" onchange="lnAdminApplyFilters()"
            style="width:100%; padding:var(--space-sm); border:1px solid var(--color-gray-300); border-radius:var(--radius-sm);">
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="draft">Draft</option>
          </select>
        </div>

        <div style="flex:1; min-width:160px;">
          <label style="display:block; font-size:var(--text-sm); font-weight:600; margin-bottom:4px;">Term</label>
          <select id="ln-filter-term" onchange="lnAdminApplyFilters()"
            style="width:100%; padding:var(--space-sm); border:1px solid var(--color-gray-300); border-radius:var(--radius-sm);">
            <option value="">All Terms</option>
            ${[...terms].sort().map(t => `<option value="${t}">${t}</option>`).join('')}
          </select>
        </div>

        <div style="flex:1; min-width:160px;">
          <label style="display:block; font-size:var(--text-sm); font-weight:600; margin-bottom:4px;">Class</label>
          <select id="ln-filter-class" onchange="lnAdminApplyFilters()"
            style="width:100%; padding:var(--space-sm); border:1px solid var(--color-gray-300); border-radius:var(--radius-sm);">
            <option value="">All Classes</option>
            ${[...classes.entries()]
                .sort((a, b) => a[1].localeCompare(b[1]))
                .map(([id, name]) => `<option value="${id}">${name}</option>`)
                .join('')}
          </select>
        </div>

        <div style="flex:1; min-width:160px;">
          <label style="display:block; font-size:var(--text-sm); font-weight:600; margin-bottom:4px;">Teacher</label>
          <select id="ln-filter-teacher" onchange="lnAdminApplyFilters()"
            style="width:100%; padding:var(--space-sm); border:1px solid var(--color-gray-300); border-radius:var(--radius-sm);">
            <option value="">All Teachers</option>
            ${[...teachers.entries()]
                .sort((a, b) => a[1].localeCompare(b[1]))
                .map(([id, name]) => `<option value="${id}">${name}</option>`)
                .join('')}
          </select>
        </div>

        <div style="display:flex; align-items:flex-end;">
          <button class="btn btn-secondary" onclick="lnAdminClearFilters()"
            style="font-size:var(--text-sm); white-space:nowrap;">
            ✕ Clear Filters
          </button>
        </div>
      </div>

      <!-- ── Result count ─────────────────────────────────── -->
      <p id="ln-admin-count"
        style="font-size:var(--text-sm); color:var(--color-gray-600); margin-bottom:var(--space-md);">
        ${allNotes.length} note(s) found
      </p>

      <!-- ── Table ────────────────────────────────────────── -->
      <div class="table-container">
        <table class="responsive-table">
          <thead>
            <tr>
              <th>Teacher</th>
              <th>Class</th>
              <th>Subject</th>
              <th>Topic</th>
              <th>Term</th>
              <th style="text-align:center;">Week</th>
              <th>Status</th>
              <th>Updated</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="ln-admin-tbody"></tbody>
        </table>
      </div>
    `;

    /* ── Initial render with all notes ── */
    _lnAdminRenderTable(allNotes);

    console.log(`✓ Loaded ${allNotes.length} lesson notes`);

  } catch (error) {
    console.error('❌ Error loading lesson notes (admin):', error);
    container.innerHTML = `
      <div style="text-align:center; padding:var(--space-2xl); color:var(--color-danger);">
        <p><strong>Error loading lesson notes</strong></p>
        <p style="font-size:var(--text-sm);">${error.message}</p>
        <button class="btn btn-primary" onclick="loadLessonNotesAdminSection()"
          style="margin-top:var(--space-md);">🔄 Retry</button>
      </div>
    `;
    window.showToast?.('Failed to load lesson notes', 'danger');
  }
};

/* ============================================================
   FILTER HELPERS
   ============================================================ */

window.lnAdminApplyFilters = function () {
  const status  = document.getElementById('ln-filter-status')?.value  || '';
  const term    = document.getElementById('ln-filter-term')?.value    || '';
  const classId = document.getElementById('ln-filter-class')?.value   || '';
  const teacher = document.getElementById('ln-filter-teacher')?.value || '';

  const all = window._lnAdminAllNotes || [];

  const filtered = all.filter(note => {
    if (status  && note.status    !== status)  return false;
    if (term    && note.term      !== term)    return false;
    if (classId && note.classId   !== classId) return false;
    if (teacher && note.teacherId !== teacher) return false;
    return true;
  });

  _lnAdminRenderTable(filtered);

  const countEl = document.getElementById('ln-admin-count');
  if (countEl) {
    const total = all.length;
    countEl.textContent = filtered.length === total
      ? `${total} note(s) found`
      : `Showing ${filtered.length} of ${total} note(s)`;
  }
};

window.lnAdminClearFilters = function () {
  ['ln-filter-status', 'ln-filter-term', 'ln-filter-class', 'ln-filter-teacher']
    .forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
  window.lnAdminApplyFilters();
};

/* ============================================================
   TABLE RENDERER
   ============================================================ */

function _lnAdminRenderTable(notes) {
  const tbody = document.getElementById('ln-admin-tbody');
  if (!tbody) return;

  tbody.innerHTML = '';

  if (notes.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9"
          style="text-align:center; padding:var(--space-2xl); color:var(--color-gray-600);">
          No lesson notes match the current filters.
        </td>
      </tr>
    `;
    return;
  }

  /* Use the global paginator from admin.js */
  if (typeof window.paginateTable === 'function') {
    window.paginateTable(notes, 'ln-admin-tbody', 20, (note, tbodyEl) => {
      tbodyEl.appendChild(_lnAdminBuildRow(note));
    });
  } else {
    /* Fallback: render up to 50 without pagination */
    notes.slice(0, 50).forEach(note => {
      tbody.appendChild(_lnAdminBuildRow(note));
    });
  }
}

function _lnAdminBuildRow(note) {
  const statusBadge = _lnStatusBadge(note.status);
  const updatedAt   = note.updatedAt
    ? note.updatedAt.toDate().toLocaleDateString('en-GB')
    : '-';

  const isPending = note.status === 'pending';

  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td data-label="Teacher">${_esc(note.teacherName  || 'Unknown')}</td>
    <td data-label="Class">${_esc(note.className    || '-')}</td>
    <td data-label="Subject">${_esc(note.subject      || '-')}</td>
    <td data-label="Topic">${_esc(note.topic        || '-')}</td>
    <td data-label="Term">${_esc(note.term         || '-')}</td>
    <td data-label="Week" style="text-align:center;">${note.weekNumber || '-'}</td>
    <td data-label="Status">${statusBadge}</td>
    <td data-label="Updated">${updatedAt}</td>
    <td data-label="Actions">
      <button class="btn-small btn-secondary"
        onclick="lnAdminViewNote('${note.id}')">
        🔍 View
      </button>
      <button class="btn-small btn-secondary"
        onclick="lnAdminPrintNote('${note.id}')">
        🖨️ Print
      </button>
      ${isPending ? `
        <button class="btn-small btn-success"
          onclick="lnAdminApproveNote('${note.id}')">
          ✓ Approve
        </button>
        <button class="btn-small btn-danger"
          onclick="lnAdminRejectNote('${note.id}')">
          ✗ Reject
        </button>
      ` : ''}
    </td>
  `;
  return tr;
}

/* ============================================================
   STATUS BADGE
   ============================================================ */

function _lnStatusBadge(status) {
  const map = {
    draft:    { bg: '#94a3b8', label: 'Draft' },
    pending:  { bg: '#f59e0b', label: 'Pending' },
    approved: { bg: '#10b981', label: 'Approved' },
    rejected: { bg: '#ef4444', label: 'Rejected' },
  };
  const cfg = map[status] || { bg: '#64748b', label: status || 'Unknown' };
  return `<span style="
    background:${cfg.bg};
    color:white;
    padding:3px 10px;
    border-radius:20px;
    font-size:12px;
    font-weight:600;
    white-space:nowrap;
  ">${cfg.label}</span>`;
}

/* ============================================================
   VIEW NOTE MODAL
   ============================================================ */

window.lnAdminViewNote = async function (docId) {
  try {
    const doc = await window.db.collection('lesson_notes').doc(docId).get();
    if (!doc.exists) { window.showToast?.('Note not found', 'danger'); return; }

    const d = doc.data();

    const fields = [
      ['Subject',               d.subject],
      ['Topic',                 d.topic],
      ['Sub-topic',             d.subtopic],
      ['Learning Objectives',   d.learningObjectives],
      ['Resources',             d.resources],
      ['Introduction',          d.introduction],
      ['Development',           d.development],
      ['Conclusion',            d.conclusion],
      ['Assessment',            d.assessment],
      ['Assignment',            d.assignment],
    ];

    const fieldRows = fields
      .filter(([, val]) => val && val.trim())
      .map(([label, val]) => `
        <tr>
          <td style="
            width:170px; padding:8px 12px;
            background:#f8fafc; font-weight:600;
            vertical-align:top; border:1px solid #e2e8f0;
            white-space:nowrap;">
            ${label}
          </td>
          <td style="padding:8px 12px; border:1px solid #e2e8f0; white-space:pre-wrap;">
            ${_esc(val)}
          </td>
        </tr>
      `).join('');

    const rejectionBanner = d.status === 'rejected' && d.adminFeedback ? `
      <div style="
        background:#fef2f2; border-left:4px solid #ef4444;
        padding:var(--space-md); border-radius:var(--radius-sm);
        margin-bottom:var(--space-lg);">
        <strong style="color:#991b1b;">Rejection Reason:</strong>
        <p style="margin:4px 0 0; color:#7f1d1d;">${_esc(d.adminFeedback)}</p>
      </div>
    ` : '';

    const modal = document.createElement('div');
    modal.style.cssText = `
      position:fixed; top:0; left:0; right:0; bottom:0;
      background:rgba(0,0,0,0.55);
      display:flex; align-items:center; justify-content:center;
      z-index:10000; padding:var(--space-lg);
      overflow-y:auto;
    `;

    modal.innerHTML = `
      <div style="
        background:white; border-radius:var(--radius-lg);
        max-width:780px; width:100%; max-height:85vh;
        overflow-y:auto; padding:var(--space-2xl);">

        <div style="
          display:flex; justify-content:space-between;
          align-items:flex-start; margin-bottom:var(--space-lg);">
          <div>
            <h3 style="margin:0 0 4px;">📄 Lesson Note</h3>
            <p style="margin:0; font-size:var(--text-sm); color:var(--color-gray-600);">
              ${_esc(d.teacherName || 'Unknown')} &nbsp;·&nbsp;
              ${_esc(d.className  || '-')} &nbsp;·&nbsp;
              ${_esc(d.term       || '-')} Week ${d.weekNumber || '-'} &nbsp;·&nbsp;
              ${_esc(d.session    || '-')}
            </p>
          </div>
          ${_lnStatusBadge(d.status)}
        </div>

        ${rejectionBanner}

        <table style="width:100%; border-collapse:collapse; margin-bottom:var(--space-xl);">
          ${fieldRows || '<tr><td colspan="2" style="padding:8px; color:#94a3b8;">No content recorded.</td></tr>'}
        </table>

        <div style="
          font-size:var(--text-sm); color:var(--color-gray-600);
          margin-bottom:var(--space-xl);">
          Version ${d.version || 1} &nbsp;·&nbsp;
          Last updated: ${d.updatedAt ? d.updatedAt.toDate().toLocaleString('en-GB') : '-'}
        </div>

        <div style="display:flex; gap:var(--space-md); flex-wrap:wrap;">
          <button class="btn btn-secondary"
            onclick="lnAdminPrintNote('${docId}')">🖨️ Print</button>
          ${d.status === 'pending' ? `
            <button class="btn btn-success"
              onclick="lnAdminApproveNote('${docId}'); this.closest('[style*=position]').remove()">
              ✓ Approve
            </button>
            <button class="btn btn-danger"
              onclick="lnAdminRejectNote('${docId}'); this.closest('[style*=position]').remove()">
              ✗ Reject
            </button>
          ` : ''}
          <button class="btn btn-secondary"
            onclick="this.closest('[style*=position]').remove()">
            Close
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    /* Close on Escape */
    const esc = e => {
      if (e.key === 'Escape') { modal.remove(); document.removeEventListener('keydown', esc); }
    };
    document.addEventListener('keydown', esc);

  } catch (error) {
    console.error('❌ lnAdminViewNote error:', error);
    window.showToast?.('Failed to load note details', 'danger');
  }
};

/* ============================================================
   APPROVE
   ============================================================ */

window.lnAdminApproveNote = async function (docId) {
  const optionalFeedback = prompt(
    'Optional message to teacher (leave blank to approve silently):'
  );

  /* Cancelled prompt returns null — treat as user backing out if null */
  if (optionalFeedback === null) return;

  try {
    const ref = window.db.collection('lesson_notes').doc(docId);
    const snap = await ref.get();
    if (!snap.exists) { window.showToast?.('Note not found', 'danger'); return; }
    if (snap.data().status !== 'pending') {
      window.showToast?.('Note is no longer pending', 'warning');
      return;
    }

    await ref.update({
      status:          'approved',
      approvedAt:      firebase.firestore.FieldValue.serverTimestamp(),
      approvedBy:      window.auth.currentUser.uid,
      reviewedBy:      window.auth.currentUser.uid,
      reviewedByName:  window.auth.currentUser.email,
      adminFeedback:   optionalFeedback.trim() || null,
      updatedAt:       firebase.firestore.FieldValue.serverTimestamp(),
    });

    /* Audit trail */
    await _lnWriteAudit('approve_lesson_note', docId, snap.data());

    window.showToast?.('✓ Lesson note approved', 'success');

    /* Update cache + re-render */
    _lnAdminUpdateCache(docId, { status: 'approved' });
    window.lnAdminApplyFilters();

  } catch (error) {
    console.error('❌ lnAdminApproveNote error:', error);
    window.showToast?.(`Failed to approve note: ${error.message}`, 'danger');
  }
};

/* ============================================================
   REJECT
   ============================================================ */

window.lnAdminRejectNote = async function (docId) {
  const reason = prompt('Reason for rejection (required — teacher will see this):');

  if (!reason || !reason.trim()) {
    window.showToast?.('Rejection cancelled — a reason is required', 'info');
    return;
  }

  try {
    const ref  = window.db.collection('lesson_notes').doc(docId);
    const snap = await ref.get();
    if (!snap.exists) { window.showToast?.('Note not found', 'danger'); return; }
    if (snap.data().status !== 'pending') {
      window.showToast?.('Note is no longer pending', 'warning');
      return;
    }

    await ref.update({
      status:          'rejected',
      rejectedAt:      firebase.firestore.FieldValue.serverTimestamp(),
      rejectedBy:      window.auth.currentUser.uid,
      reviewedBy:      window.auth.currentUser.uid,
      reviewedByName:  window.auth.currentUser.email,
      adminFeedback:   reason.trim(),
      updatedAt:       firebase.firestore.FieldValue.serverTimestamp(),
    });

    /* Audit trail */
    await _lnWriteAudit('reject_lesson_note', docId, snap.data());

    window.showToast?.('✓ Lesson note rejected. Teacher can now edit and resubmit.', 'success', 6000);

    /* Update cache + re-render */
    _lnAdminUpdateCache(docId, { status: 'rejected', adminFeedback: reason.trim() });
    window.lnAdminApplyFilters();

  } catch (error) {
    console.error('❌ lnAdminRejectNote error:', error);
    window.showToast?.(`Failed to reject note: ${error.message}`, 'danger');
  }
};

/* ============================================================
   PRINT
   ============================================================ */

window.lnAdminPrintNote = async function (docId) {
  try {
    const doc = await window.db.collection('lesson_notes').doc(docId).get();
    if (!doc.exists) { window.showToast?.('Note not found', 'danger'); return; }

    const d = doc.data();

    const fields = [
      ['Subject',             d.subject],
      ['Topic',               d.topic],
      ['Sub-topic',           d.subtopic],
      ['Learning Objectives', d.learningObjectives],
      ['Resources',           d.resources],
      ['Introduction',        d.introduction],
      ['Development',         d.development],
      ['Conclusion',          d.conclusion],
      ['Assessment',          d.assessment],
      ['Assignment',          d.assignment],
    ];

    const fieldRows = fields
      .filter(([, v]) => v && v.trim())
      .map(([label, val]) => `
        <tr>
          <td class="label">${label}</td>
          <td class="value">${_esc(val).replace(/\n/g, '<br>')}</td>
        </tr>
      `).join('');

    const statusLabel = (d.status || 'unknown').toUpperCase();

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Lesson Note — ${_esc(d.teacherName || '')} — Week ${d.weekNumber}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 11pt; color: #111; padding: 20mm 18mm; }

    .school-header { text-align: center; border-bottom: 2px solid #003366; padding-bottom: 10px; margin-bottom: 18px; }
    .school-header h1 { font-size: 15pt; font-weight: bold; color: #003366; letter-spacing: 0.5px; }
    .school-header h2 { font-size: 12pt; font-weight: normal; color: #444; margin-top: 4px; }

    .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 20px; margin-bottom: 18px; font-size: 10pt; }
    .meta-grid .meta-item { display: flex; gap: 6px; }
    .meta-item .meta-key { font-weight: bold; min-width: 80px; color: #333; }

    .status-badge {
      display: inline-block;
      padding: 2px 10px;
      border-radius: 20px;
      font-size: 9pt;
      font-weight: bold;
      color: white;
      background: ${d.status === 'approved' ? '#10b981' : d.status === 'rejected' ? '#ef4444' : d.status === 'pending' ? '#f59e0b' : '#94a3b8'};
    }

    table.content-table { width: 100%; border-collapse: collapse; margin-top: 6px; }
    table.content-table td { border: 1px solid #ccc; padding: 7px 10px; vertical-align: top; }
    td.label { width: 160px; font-weight: bold; background: #f1f5f9; white-space: nowrap; }
    td.value { white-space: pre-wrap; line-height: 1.5; }

    .rejection-box { background: #fef2f2; border-left: 4px solid #ef4444; padding: 8px 12px; margin-bottom: 14px; font-size: 10pt; }
    .rejection-box strong { color: #991b1b; }

    .print-footer { margin-top: 24px; padding-top: 8px; border-top: 1px solid #ccc; font-size: 9pt; color: #666; display: flex; justify-content: space-between; }

    @media print {
      body { padding: 10mm; }
      button { display: none; }
    }
  </style>
</head>
<body>

  <div class="school-header">
    <h1>Fahmid Nursery &amp; Primary School</h1>
    <h2>Weekly Lesson Note</h2>
  </div>

  <div class="meta-grid">
    <div class="meta-item"><span class="meta-key">Teacher:</span><span>${_esc(d.teacherName || '-')}</span></div>
    <div class="meta-item"><span class="meta-key">Class:</span><span>${_esc(d.className || '-')}</span></div>
    <div class="meta-item"><span class="meta-key">Term:</span><span>${_esc(d.term || '-')}</span></div>
    <div class="meta-item"><span class="meta-key">Session:</span><span>${_esc(d.session || '-')}</span></div>
    <div class="meta-item"><span class="meta-key">Week:</span><span>${d.weekNumber || '-'}</span></div>
    <div class="meta-item"><span class="meta-key">Version:</span><span>${d.version || 1}</span></div>
    <div class="meta-item"><span class="meta-key">Status:</span><span class="status-badge">${statusLabel}</span></div>
  </div>

  ${d.status === 'rejected' && d.adminFeedback ? `
    <div class="rejection-box">
      <strong>Rejection Reason:</strong> ${_esc(d.adminFeedback)}
    </div>
  ` : ''}

  <table class="content-table">
    ${fieldRows}
  </table>

  <div class="print-footer">
    <span>Printed: ${new Date().toLocaleString('en-GB')}</span>
    <span>Fahmid Nursery &amp; Primary School</span>
  </div>

</body>
</html>`;

    const win = window.open('', '_blank', 'width=900,height=720,scrollbars=yes');
    if (!win) { window.showToast?.('Please allow popups to print notes', 'warning'); return; }

    win.document.write(html);
    win.document.close();

    setTimeout(() => {
      try { win.focus(); win.print(); }
      catch (e) { console.warn('Auto-print skipped:', e); }
    }, 500);

  } catch (error) {
    console.error('❌ lnAdminPrintNote error:', error);
    window.showToast?.('Failed to load note for printing', 'danger');
  }
};

/* ============================================================
   PRIVATE HELPERS
   ============================================================ */

/** Update the in-memory cache after an approve/reject */
function _lnAdminUpdateCache(docId, patch) {
  if (!window._lnAdminAllNotes) return;
  const idx = window._lnAdminAllNotes.findIndex(n => n.id === docId);
  if (idx !== -1) {
    window._lnAdminAllNotes[idx] = { ...window._lnAdminAllNotes[idx], ...patch };
  }
}

/** Write an entry to admin audit_log (mirrors deleteItem pattern) */
async function _lnWriteAudit(action, docId, noteData) {
  try {
    await window.db.collection('audit_log').add({
      action,
      collection: 'lesson_notes',
      documentId:        docId,
      performedBy:       window.auth.currentUser.uid,
      performedByEmail:  window.auth.currentUser.email,
      timestamp:         firebase.firestore.FieldValue.serverTimestamp(),
      userAgent:         navigator.userAgent,
      changes: {
        teacherName: noteData.teacherName || 'Unknown',
        className:   noteData.className   || 'Unknown',
        subject:     noteData.subject     || '-',
        term:        noteData.term        || '-',
        weekNumber:  noteData.weekNumber  || '-',
        session:     noteData.session     || '-',
      }
    });
  } catch (e) {
    /* Audit failure must never block the main action */
    console.warn('⚠️ Audit log write failed:', e.message);
  }
}

/** Safe HTML escaping */
function _esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

console.log('✅ lesson-notes-admin.js loaded');