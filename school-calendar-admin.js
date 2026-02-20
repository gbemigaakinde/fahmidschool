/**
 * FAHMID NURSERY & PRIMARY SCHOOL
 * School Calendar Admin Module
 *
 * @version 1.0.0
 * @description Manages school calendar (public holidays, mid-term breaks, special breaks)
 *              so that attendance timesOpened is calculated against actual school days only.
 *
 * DESIGN PRINCIPLES:
 * - Zero modification to admin.js logic
 * - Reads/writes only the `school_calendar` Firestore collection
 * - Exposes window.schoolCalendar API for use by attendance-daily.js
 * - Integrates into admin portal via two safe additive hooks (see INTEGRATION NOTE below)
 *
 * FIRESTORE SCHEMA — school_calendar/{docId}
 * {
 *   date:        "2025-09-15"           // YYYY-MM-DD string (also the doc ID)
 *   type:        "public_holiday"       // "public_holiday" | "mid_term_break" | "special_break" | "school_day"
 *   description: "Nigerian Independence Day"
 *   session:     "2025/2026"           // set automatically from current settings
 *   term:        "First Term"          // set automatically from current settings
 *   createdAt:   Timestamp
 *   createdBy:   uid
 * }
 *
 * INTEGRATION NOTE (only two lines need adding to admin.js — see bottom of this file):
 *   1. In loadSectionData() switch statement, add:
 *        case 'school-calendar': loadSchoolCalendarSection(); break;
 *   2. No other changes needed. Navigation is handled via sidebar HTML (see admin-calendar-html-snippet below).
 */

'use strict';

console.log('📅 school-calendar-admin.js loading...');

/* ─────────────────────────────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────────────────────────────── */

const CALENDAR_COLLECTION = 'school_calendar';

const DAY_TYPES = {
  public_holiday: { label: 'Public Holiday',  icon: '🏛️', color: '#dc2626', bg: '#fef2f2' },
  mid_term_break: { label: 'Mid-Term Break',   icon: '🏖️', color: '#d97706', bg: '#fffbeb' },
  special_break:  { label: 'Special Break',    icon: '📢', color: '#7c3aed', bg: '#f5f3ff' },
  school_day:     { label: 'School Day',       icon: '🏫', color: '#16a34a', bg: '#f0fdf4' }
};

// These types are NOT counted as school days for attendance
const NON_SCHOOL_TYPES = new Set(['public_holiday', 'mid_term_break', 'special_break']);

/* ─────────────────────────────────────────────────────────────────
   PUBLIC API  (window.schoolCalendar)
   Used by attendance-daily.js to determine valid school days
───────────────────────────────────────────────────────────────── */

window.schoolCalendar = {

  /**
   * Get all non-school days for a given session + term
   * Returns a Set of "YYYY-MM-DD" strings
   */
  async getNonSchoolDays(session, term) {
    try {
      const snap = await db.collection(CALENDAR_COLLECTION)
        .where('session', '==', session)
        .where('term',    '==', term)
        .get();

      const nonSchoolDays = new Set();
      snap.forEach(doc => {
        const data = doc.data();
        if (NON_SCHOOL_TYPES.has(data.type)) {
          nonSchoolDays.add(data.date);
        }
      });

      console.log(`📅 getNonSchoolDays: ${nonSchoolDays.size} non-school days for ${session} ${term}`);
      return nonSchoolDays;

    } catch (error) {
      console.error('❌ schoolCalendar.getNonSchoolDays error:', error);
      return new Set(); // Safe fallback — empty set means all days count (existing behaviour)
    }
  },

  /**
   * Check whether a specific date string is a school day
   */
  async isSchoolDay(dateString, session, term) {
    const nonSchoolDays = await this.getNonSchoolDays(session, term);
    return !nonSchoolDays.has(dateString);
  },

  /**
   * Filter an array of date strings, returning only school days
   */
  async filterSchoolDays(dateStrings, session, term) {
    const nonSchoolDays = await this.getNonSchoolDays(session, term);
    return dateStrings.filter(d => !nonSchoolDays.has(d));
  },

  /**
   * Get calendar entries for a session+term (for display in teacher UI)
   */
  async getCalendarEntries(session, term) {
    try {
      const snap = await db.collection(CALENDAR_COLLECTION)
        .where('session', '==', session)
        .where('term',    '==', term)
        .orderBy('date', 'asc')
        .get();

      const entries = [];
      snap.forEach(doc => entries.push({ id: doc.id, ...doc.data() }));
      return entries;

    } catch (error) {
      console.error('❌ schoolCalendar.getCalendarEntries error:', error);
      return [];
    }
  }
};

console.log('✅ window.schoolCalendar API ready');

/* ─────────────────────────────────────────────────────────────────
   SECTION LOADER  (called from admin.js loadSectionData)
───────────────────────────────────────────────────────────────── */

async function loadSchoolCalendarSection() {
  console.log('📅 Loading School Calendar section...');

  const section = document.getElementById('school-calendar');
  if (!section) {
    console.error('❌ school-calendar section element not found in HTML');
    return;
  }

  // Render the section shell on first load
  if (!section.dataset.calendarInitialized) {
    section.innerHTML = buildCalendarSectionHTML();
    section.dataset.calendarInitialized = 'true';
    _attachCalendarFormListeners();
  }

  // Always reload the table on every navigation to this section
  await _loadCalendarTable();
  await _populateCalendarSessionTerm();
}

// Expose so admin.js loadSectionData can call it
window.loadSchoolCalendarSection = loadSchoolCalendarSection;

/* ─────────────────────────────────────────────────────────────────
   SECTION HTML BUILDER
───────────────────────────────────────────────────────────────── */

function buildCalendarSectionHTML() {
  return `
    <div class="section-header" style="margin-bottom: var(--space-xl);">
      <h2 style="margin:0 0 var(--space-xs);">📅 School Calendar</h2>
      <p style="margin:0; color:var(--color-gray-600); font-size:var(--text-sm);">
        Mark public holidays, mid-term breaks, and special closures.
        These days will be excluded from attendance <em>timesOpened</em> calculations automatically.
      </p>
    </div>

    <!-- Info Banner -->
    <div style="
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-left: 4px solid #3b82f6;
      border-radius: var(--radius-md);
      padding: var(--space-md) var(--space-lg);
      margin-bottom: var(--space-xl);
      font-size: var(--text-sm);
      color: #1e40af;
    ">
      ℹ️ <strong>How this works:</strong> Any date you mark as a holiday or break will be automatically
      skipped when calculating how many times school opened for each pupil's attendance record.
      Marking a date here does <strong>not</strong> delete any attendance already recorded —
      it just tells the system that day should not count towards <em>timesOpened</em>.
    </div>

    <!-- Add Entry Card -->
    <div class="admin-card" style="margin-bottom: var(--space-xl);">
      <h3 style="margin-top:0;">➕ Add Non-School Day</h3>

      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: var(--space-md); margin-bottom: var(--space-md);">

        <div class="form-group">
          <label for="cal-date">Date <span style="color:red">*</span></label>
          <input type="date" id="cal-date" class="form-control"
                 style="width:100%; padding:var(--space-sm); border:1px solid var(--color-gray-300); border-radius:var(--radius-sm);">
        </div>

        <div class="form-group">
          <label for="cal-type">Type <span style="color:red">*</span></label>
          <select id="cal-type" class="form-control"
                  style="width:100%; padding:var(--space-sm); border:1px solid var(--color-gray-300); border-radius:var(--radius-sm);">
            <option value="">-- Select Type --</option>
            <option value="public_holiday">🏛️ Public Holiday</option>
            <option value="mid_term_break">🏖️ Mid-Term Break</option>
            <option value="special_break">📢 Special Break / Closure</option>
          </select>
        </div>

        <div class="form-group">
          <label for="cal-description">Description <span style="color:red">*</span></label>
          <input type="text" id="cal-description" class="form-control"
                 placeholder="e.g. Independence Day, Mid-term Break..."
                 style="width:100%; padding:var(--space-sm); border:1px solid var(--color-gray-300); border-radius:var(--radius-sm);">
        </div>

      </div>

      <!-- Session / Term display (auto-filled) -->
      <div style="
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: var(--radius-sm);
        padding: var(--space-sm) var(--space-md);
        margin-bottom: var(--space-md);
        font-size: var(--text-sm);
        color: #475569;
        display: flex;
        gap: var(--space-xl);
        flex-wrap: wrap;
        align-items: center;
      ">
        <span>📌 Will be saved for:</span>
        <strong id="cal-session-display">—</strong>
        &nbsp;·&nbsp;
        <strong id="cal-term-display">—</strong>
        <span style="margin-left:auto; color:#94a3b8; font-size:11px;">
          (matches current school settings)
        </span>
      </div>

      <!-- Bulk range option -->
      <div style="margin-bottom: var(--space-md);">
        <label style="
          display: flex;
          align-items: center;
          gap: var(--space-sm);
          cursor: pointer;
          font-size: var(--text-sm);
          color: #475569;
        ">
          <input type="checkbox" id="cal-use-range" onchange="window.toggleCalendarRange()">
          <span>📅 Mark a <strong>date range</strong> (e.g. whole break week)</span>
        </label>
      </div>

      <!-- Range end date (hidden by default) -->
      <div id="cal-range-group" style="display:none; margin-bottom: var(--space-md);">
        <div class="form-group">
          <label for="cal-date-end">End Date (inclusive)</label>
          <input type="date" id="cal-date-end" class="form-control"
                 style="width:220px; padding:var(--space-sm); border:1px solid var(--color-gray-300); border-radius:var(--radius-sm);">
        </div>
        <p style="font-size:11px; color:#94a3b8; margin: var(--space-xs) 0 0;">
          All dates between start and end (inclusive) will be marked with the same type and description.
        </p>
      </div>

      <button id="cal-save-btn" class="btn btn-primary" onclick="window.saveCalendarEntry()">
        💾 Save Entry
      </button>
    </div>

    <!-- Filter Bar -->
    <div style="
      display: flex;
      gap: var(--space-md);
      align-items: center;
      flex-wrap: wrap;
      margin-bottom: var(--space-lg);
    ">
      <div style="display:flex; align-items:center; gap:var(--space-sm);">
        <label for="cal-filter-type" style="font-size:var(--text-sm); color:#475569; white-space:nowrap;">Filter by type:</label>
        <select id="cal-filter-type"
                onchange="window.applyCalendarFilter()"
                style="padding:var(--space-xs) var(--space-sm); border:1px solid var(--color-gray-300); border-radius:var(--radius-sm); font-size:var(--text-sm);">
          <option value="">All types</option>
          <option value="public_holiday">🏛️ Public Holiday</option>
          <option value="mid_term_break">🏖️ Mid-Term Break</option>
          <option value="special_break">📢 Special Break</option>
        </select>
      </div>

      <button class="btn btn-secondary" style="font-size:var(--text-sm);" onclick="window.exportCalendarCSV()">
        📥 Export CSV
      </button>

      <span id="cal-entry-count" style="font-size:var(--text-sm); color:#64748b; margin-left:auto;"></span>
    </div>

    <!-- Summary badges -->
    <div id="cal-summary-badges" style="display:flex; gap:var(--space-sm); flex-wrap:wrap; margin-bottom: var(--space-lg);"></div>

    <!-- Calendar Table -->
    <div class="table-container">
      <table class="responsive-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Day</th>
            <th>Type</th>
            <th>Description</th>
            <th>Session · Term</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody id="cal-table-body">
          <tr><td colspan="6" class="table-loading">Loading calendar entries...</td></tr>
        </tbody>
      </table>
    </div>
  `;
}

/* ─────────────────────────────────────────────────────────────────
   FORM LISTENERS
───────────────────────────────────────────────────────────────── */

function _attachCalendarFormListeners() {
  // Date input → auto-check if it falls on weekend and warn
  const dateInput = document.getElementById('cal-date');
  if (dateInput) {
    dateInput.addEventListener('change', function () {
      _checkWeekendWarning(this.value, 'cal-date-warning');
    });
  }
}

function _checkWeekendWarning(dateStr, warningId) {
  if (!dateStr) return;
  const d = new Date(dateStr + 'T00:00:00');
  const existing = document.getElementById(warningId);
  if (existing) existing.remove();

  if (d.getDay() === 0 || d.getDay() === 6) {
    const input = document.getElementById('cal-date');
    if (!input) return;
    const warn = document.createElement('p');
    warn.id = warningId;
    warn.style.cssText = 'font-size:11px; color:#d97706; margin:4px 0 0;';
    warn.textContent = '⚠️ This is a Saturday/Sunday. School is already closed on weekends.';
    input.insertAdjacentElement('afterend', warn);
  }
}

/* ─────────────────────────────────────────────────────────────────
   POPULATE SESSION/TERM FROM SETTINGS
───────────────────────────────────────────────────────────────── */

async function _populateCalendarSessionTerm() {
  try {
    const settings = await window.getCurrentSettings();
    const sessionEl = document.getElementById('cal-session-display');
    const termEl    = document.getElementById('cal-term-display');
    if (sessionEl) sessionEl.textContent = settings.session || '—';
    if (termEl)    termEl.textContent    = settings.term    || '—';
  } catch (error) {
    console.error('❌ Could not load session/term for calendar:', error);
  }
}

/* ─────────────────────────────────────────────────────────────────
   TOGGLE DATE RANGE
───────────────────────────────────────────────────────────────── */

window.toggleCalendarRange = function () {
  const checkbox  = document.getElementById('cal-use-range');
  const rangeGroup = document.getElementById('cal-range-group');
  if (!rangeGroup) return;
  rangeGroup.style.display = checkbox?.checked ? 'block' : 'none';
};

/* ─────────────────────────────────────────────────────────────────
   SAVE ENTRY (single date or range)
───────────────────────────────────────────────────────────────── */

window.saveCalendarEntry = async function () {
  const dateStart   = document.getElementById('cal-date')?.value;
  const type        = document.getElementById('cal-type')?.value;
  const description = document.getElementById('cal-description')?.value.trim();
  const useRange    = document.getElementById('cal-use-range')?.checked;
  const dateEnd     = useRange ? document.getElementById('cal-date-end')?.value : null;

  // Validation
  if (!dateStart) {
    window.showToast?.('Please select a date', 'warning');
    return;
  }
  if (!type) {
    window.showToast?.('Please select a type', 'warning');
    return;
  }
  if (!description) {
    window.showToast?.('Please enter a description', 'warning');
    return;
  }
  if (useRange && !dateEnd) {
    window.showToast?.('Please select an end date for the range', 'warning');
    return;
  }
  if (useRange && dateEnd < dateStart) {
    window.showToast?.('End date must be on or after start date', 'warning');
    return;
  }

  const btn = document.getElementById('cal-save-btn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Saving...'; }

  try {
    const settings = await window.getCurrentSettings();
    const session  = settings.session;
    const term     = settings.term;

    if (!session || !term) {
      throw new Error('School session/term not configured. Please check School Settings.');
    }

    // Build list of dates to save
    const datesToSave = useRange
      ? _expandDateRange(dateStart, dateEnd)
      : [dateStart];

    // Filter out weekends (optional warn but don't block)
    const batch = db.batch();
    let savedCount = 0;
    let skippedCount = 0;

    for (const dateStr of datesToSave) {
      const docId = dateStr; // Use date string as doc ID — guarantees uniqueness per date
      const docRef = db.collection(CALENDAR_COLLECTION).doc(docId);

      // Check if already exists
      const existing = await docRef.get();
      if (existing.exists) {
        console.log(`⏭️ ${dateStr} already has an entry, skipping`);
        skippedCount++;
        continue;
      }

      batch.set(docRef, {
        date:        dateStr,
        type:        type,
        description: description,
        session:     session,
        term:        term,
        createdAt:   firebase.firestore.FieldValue.serverTimestamp(),
        createdBy:   auth.currentUser.uid
      });

      savedCount++;
    }

    if (savedCount > 0) {
      await batch.commit();
    }

    const total = datesToSave.length;
    let msg = '';
    if (savedCount > 0 && skippedCount === 0) {
      msg = savedCount === 1
        ? `✅ ${dateStart} saved as ${DAY_TYPES[type].label}`
        : `✅ ${savedCount} dates saved as ${DAY_TYPES[type].label}`;
    } else if (savedCount > 0 && skippedCount > 0) {
      msg = `✅ ${savedCount} saved, ${skippedCount} already existed (skipped)`;
    } else {
      msg = `ℹ️ All ${total} date(s) already have entries — nothing changed.`;
    }

    window.showToast?.(msg, savedCount > 0 ? 'success' : 'info', 6000);

    // Reset form
    document.getElementById('cal-date').value        = '';
    document.getElementById('cal-type').value        = '';
    document.getElementById('cal-description').value = '';
    if (document.getElementById('cal-use-range')) {
      document.getElementById('cal-use-range').checked = false;
      document.getElementById('cal-range-group').style.display = 'none';
    }
    if (document.getElementById('cal-date-end')) {
      document.getElementById('cal-date-end').value = '';
    }

    // Reload table
    await _loadCalendarTable();

  } catch (error) {
    console.error('❌ saveCalendarEntry error:', error);
    window.showToast?.(`Failed to save: ${error.message}`, 'danger', 8000);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '💾 Save Entry'; }
  }
};

/* ─────────────────────────────────────────────────────────────────
   EXPAND DATE RANGE to array of YYYY-MM-DD strings
───────────────────────────────────────────────────────────────── */

function _expandDateRange(startStr, endStr) {
  const dates  = [];
  const cursor = new Date(startStr + 'T00:00:00');
  const end    = new Date(endStr   + 'T00:00:00');

  while (cursor <= end) {
    dates.push(cursor.toISOString().split('T')[0]);
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

/* ─────────────────────────────────────────────────────────────────
   LOAD CALENDAR TABLE
───────────────────────────────────────────────────────────────── */

let _allCalendarEntries = []; // module-level cache for filter

async function _loadCalendarTable() {
  const tbody = document.getElementById('cal-table-body');
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="6" class="table-loading">Loading...</td></tr>';

  try {
    // Load current session/term to filter by default
    const settings = await window.getCurrentSettings();
    const session  = settings.session;
    const term     = settings.term;

    // Query by session + term (already have index for this via school_calendar)
    const snap = await db.collection(CALENDAR_COLLECTION)
      .where('session', '==', session)
      .where('term',    '==', term)
      .orderBy('date', 'asc')
      .get();

    _allCalendarEntries = [];
    snap.forEach(doc => _allCalendarEntries.push({ id: doc.id, ...doc.data() }));

    _renderCalendarTable(_allCalendarEntries);

  } catch (error) {
    console.error('❌ _loadCalendarTable error:', error);

    // If index missing, fall back to full collection scan
    if (error.code === 'failed-precondition') {
      console.warn('⚠️ Composite index missing — falling back to full scan');
      await _loadCalendarTableFallback();
    } else {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--color-danger);">
        Error loading calendar: ${error.message}
        <br><button class="btn btn-secondary" style="margin-top:8px;" onclick="window.loadSchoolCalendarSection()">🔄 Retry</button>
      </td></tr>`;
    }
  }
}

async function _loadCalendarTableFallback() {
  const tbody = document.getElementById('cal-table-body');
  try {
    const settings = await window.getCurrentSettings();
    const snap = await db.collection(CALENDAR_COLLECTION)
      .orderBy('date', 'asc')
      .get();

    _allCalendarEntries = [];
    snap.forEach(doc => {
      const data = doc.data();
      // Filter client-side for current session+term
      if (data.session === settings.session && data.term === settings.term) {
        _allCalendarEntries.push({ id: doc.id, ...data });
      }
    });

    _renderCalendarTable(_allCalendarEntries);

  } catch (error) {
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--color-danger);">
        Failed to load calendar entries. ${error.message}
      </td></tr>`;
    }
  }
}

/* ─────────────────────────────────────────────────────────────────
   RENDER TABLE
───────────────────────────────────────────────────────────────── */

function _renderCalendarTable(entries) {
  const tbody = document.getElementById('cal-table-body');
  if (!tbody) return;

  tbody.innerHTML = '';

  // Update count
  const countEl = document.getElementById('cal-entry-count');
  if (countEl) {
    countEl.textContent = entries.length === 0
      ? 'No entries for this term'
      : `${entries.length} entr${entries.length === 1 ? 'y' : 'ies'}`;
  }

  // Update summary badges
  _renderSummaryBadges(entries);

  if (entries.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center; padding: var(--space-2xl); color:var(--color-gray-600);">
          <div style="font-size:2rem; margin-bottom:var(--space-md);">📅</div>
          <p style="font-size:var(--text-lg); font-weight:600; margin-bottom:var(--space-sm);">
            No non-school days marked yet
          </p>
          <p style="font-size:var(--text-sm);">
            Add public holidays and breaks above. Once added, they will be excluded from
            attendance <em>timesOpened</em> automatically.
          </p>
        </td>
      </tr>
    `;
    return;
  }

  const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  entries.forEach(entry => {
    const typeInfo = DAY_TYPES[entry.type] || { label: entry.type, icon: '📅', color: '#64748b', bg: '#f1f5f9' };
    const dateObj  = new Date(entry.date + 'T00:00:00');
    const dayName  = DAYS_OF_WEEK[dateObj.getDay()];
    const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td data-label="Date" style="font-weight:600; font-family:monospace;">
        ${_formatDateDisplay(entry.date)}
      </td>
      <td data-label="Day" style="color:${isWeekend ? '#94a3b8' : '#0f172a'};">
        ${dayName}${isWeekend ? ' <span style="font-size:11px; color:#94a3b8;">(wknd)</span>' : ''}
      </td>
      <td data-label="Type">
        <span style="
          display: inline-flex;
          align-items: center;
          gap: 4px;
          background: ${typeInfo.bg};
          color: ${typeInfo.color};
          padding: 3px 10px;
          border-radius: 999px;
          font-size: var(--text-sm);
          font-weight: 600;
          white-space: nowrap;
        ">
          ${typeInfo.icon} ${typeInfo.label}
        </span>
      </td>
      <td data-label="Description">${_escapeHTML(entry.description || '—')}</td>
      <td data-label="Session · Term" style="font-size:var(--text-sm); color:#64748b;">
        ${entry.session || '—'} · ${entry.term || '—'}
      </td>
      <td data-label="Actions">
        <button class="btn-small btn-danger"
                onclick="window.deleteCalendarEntry('${entry.id}', '${_escapeHTML(entry.date)}')">
          🗑️ Remove
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

/* ─────────────────────────────────────────────────────────────────
   SUMMARY BADGES
───────────────────────────────────────────────────────────────── */

function _renderSummaryBadges(entries) {
  const container = document.getElementById('cal-summary-badges');
  if (!container) return;

  container.innerHTML = '';

  if (entries.length === 0) return;

  // Count by type
  const typeCounts = {};
  entries.forEach(e => {
    typeCounts[e.type] = (typeCounts[e.type] || 0) + 1;
  });

  // Total non-school days
  const badge = (label, count, color, bg, icon) => `
    <span style="
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: ${bg};
      color: ${color};
      border: 1px solid ${color}30;
      padding: 4px 14px;
      border-radius: 999px;
      font-size: var(--text-sm);
      font-weight: 600;
    ">
      ${icon} ${count} ${label}
    </span>
  `;

  Object.entries(typeCounts).forEach(([type, count]) => {
    const info = DAY_TYPES[type];
    if (info) {
      container.innerHTML += badge(
        count === 1 ? info.label : info.label + 's',
        count,
        info.color,
        info.bg,
        info.icon
      );
    }
  });

  // Grand total
  container.innerHTML += badge(
    'total non-school day' + (entries.length === 1 ? '' : 's'),
    entries.length,
    '#0369a1',
    '#eff6ff',
    '📅'
  );
}

/* ─────────────────────────────────────────────────────────────────
   FILTER
───────────────────────────────────────────────────────────────── */

window.applyCalendarFilter = function () {
  const filterType = document.getElementById('cal-filter-type')?.value;
  const filtered = filterType
    ? _allCalendarEntries.filter(e => e.type === filterType)
    : _allCalendarEntries;
  _renderCalendarTable(filtered);
};

/* ─────────────────────────────────────────────────────────────────
   DELETE ENTRY
───────────────────────────────────────────────────────────────── */

window.deleteCalendarEntry = async function (docId, dateStr) {
  if (!confirm(
    `Remove ${dateStr} from calendar?\n\n` +
    `This will make it count as a school day again in attendance calculations.\n\n` +
    `Continue?`
  )) return;

  try {
    await db.collection(CALENDAR_COLLECTION).doc(docId).delete();
    window.showToast?.(`✅ ${dateStr} removed from calendar`, 'success');
    await _loadCalendarTable();
  } catch (error) {
    console.error('❌ deleteCalendarEntry error:', error);
    window.showToast?.(`Failed to remove: ${error.message}`, 'danger');
  }
};

/* ─────────────────────────────────────────────────────────────────
   EXPORT CSV
───────────────────────────────────────────────────────────────── */

window.exportCalendarCSV = async function () {
  if (_allCalendarEntries.length === 0) {
    window.showToast?.('No entries to export', 'info');
    return;
  }

  const headers = ['Date', 'Day', 'Type', 'Description', 'Session', 'Term'];
  const DAYS    = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

  const rows = _allCalendarEntries.map(e => {
    const d = new Date(e.date + 'T00:00:00');
    return [
      e.date,
      DAYS[d.getDay()],
      DAY_TYPES[e.type]?.label || e.type,
      e.description || '',
      e.session || '',
      e.term    || ''
    ];
  });

  const csv = [headers, ...rows]
    .map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href     = url;
  link.download = `school_calendar_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  window.showToast?.(`✅ Exported ${_allCalendarEntries.length} entries`, 'success');
};

/* ─────────────────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────────────────────── */

function _formatDateDisplay(dateStr) {
  try {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch (_) {
    return dateStr;
  }
}

function _escapeHTML(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

console.log('✅ school-calendar-admin.js loaded');
console.log('   → window.schoolCalendar API: getNonSchoolDays, isSchoolDay, filterSchoolDays, getCalendarEntries');
console.log('   → Admin section: loadSchoolCalendarSection()');

/*
 ═══════════════════════════════════════════════════════════════════
   INTEGRATION INSTRUCTIONS FOR admin.js
   (TWO ADDITIVE CHANGES ONLY — nothing existing is modified)
 ═══════════════════════════════════════════════════════════════════

 1. In loadSectionData() switch statement, add ONE new case:

    case 'school-calendar':
      loadSchoolCalendarSection();
      break;

    Location: inside the switch(sectionId) block, after 'financial-reports' case.

 2. In admin.html sidebar, add a navigation link wherever appropriate:

    <a href="#" class="sidebar-link" data-section="school-calendar">
      📅 School Calendar
    </a>

    And in main content area, add the section container:

    <div id="school-calendar" class="admin-card" style="display:none;"></div>

 3. Load this file in admin.html AFTER admin.js:

    <script src="school-calendar-admin.js"></script>

 That's it. No other changes to admin.js.
 ═══════════════════════════════════════════════════════════════════
*/