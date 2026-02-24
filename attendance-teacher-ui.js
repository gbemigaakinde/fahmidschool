/**
 * FAHMID NURSERY & PRIMARY SCHOOL
 * Teacher Attendance UI — attendance-teacher-ui.js
 *
 * COMPLETE REPLACEMENT — v3.0.0
 *
 * This single file replaces BOTH:
 *   - attendance-teacher-ui.js (v1.0.0)
 *   - attendance-teacher-ui-redesigned.js (v2.0.0)
 *
 * All business logic from v1.0.0 is preserved verbatim.
 * All UI improvements from v2.0.0 are integrated correctly.
 * All cross-file patching conflicts are eliminated.
 *
 * @version 3.0.0
 * @requires teacher.js       (window.assignedClasses, window.allPupils,
 *                              window.currentUser, window.paginateTable,
 *                              window._saveAttendanceFromInputs)
 * @requires attendance-daily.js (window.dailyAttendance)
 * @requires firebase-init.js    (db)
 */

'use strict';

/* ══════════════════════════════════════════════════════════════
   § 1  WEEK NAVIGATION STATE
══════════════════════════════════════════════════════════════ */

let currentWeekMonday = null;
let _modalDate        = null;   // shared across open/save/close

/* ══════════════════════════════════════════════════════════════
   § 2  SECTION ENTRY POINT
   Replaces teacher.js sectionLoaders['attendance']
══════════════════════════════════════════════════════════════ */

async function loadAttendanceSectionEnhanced() {
    const container = document.getElementById('attendance-form-container');
    const saveBtn   = document.getElementById('save-attendance-btn');
    const term      = document.getElementById('attendance-term')?.value || 'First Term';

    if (!container) return;

    const assignedClasses = window.assignedClasses || [];
    const allPupils       = window.allPupils       || [];

    if (assignedClasses.length === 0 || allPupils.length === 0) {
        container.innerHTML = renderEmptyState(
            'No pupils assigned',
            'No pupils have been assigned to your class yet. Contact the admin.'
        );
        if (saveBtn) saveBtn.hidden = true;
        return;
    }

    // Cache settings once for context header
    try {
        window._attCurrentSettings = await window.getCurrentSettings();
    } catch (_) {}

    const contextHeaderHTML = buildContextHeader(term, allPupils, assignedClasses);

    // Modal is injected into document.body — NOT inside container.
    // Reason: position:fixed breaks whenever any ancestor has transform,
    // will-change, filter, or perspective applied (common in admin layouts).
    // Moving the modal to <body> guarantees it overlays the full viewport.
    _ensureModalInBody();

    container.innerHTML = `
        ${contextHeaderHTML}

        <!-- TABS -->
        <div class="att-tabs" role="tablist" aria-label="Attendance entry mode">
            <button class="att-tab att-tab--active" role="tab" aria-selected="true"
                    data-tab="daily" onclick="switchAttendanceTab('daily')">
                📅 Daily Register
            </button>
            <button class="att-tab" role="tab" aria-selected="false"
                    data-tab="manual" onclick="switchAttendanceTab('manual')">
                ✏️ Manual Totals
            </button>
        </div>

        <!-- DAILY REGISTER PANEL -->
        <div id="att-panel-daily" class="att-panel" role="tabpanel">
            ${buildDailyRegisterShell(term)}
        </div>

        <!-- MANUAL ENTRY PANEL -->
        <div id="att-panel-manual" class="att-panel" style="display:none;" role="tabpanel">
            <div class="att-legacy-banner">
                <span class="att-legacy-icon">ℹ️</span>
                <div>
                    <strong>Legacy Manual Entry</strong>
                    <p>Override cumulative totals directly. Values here are overwritten when the Daily Register is used.</p>
                </div>
            </div>
            <div id="manual-attendance-container"></div>
        </div>
    `;

    // Load both panels
    await loadDailyRegisterPanel(term);
    await loadManualAttendanceLegacy(term);

    if (saveBtn) saveBtn.hidden = true;

    // Scroll affordance: detect when table is scrolled to end
    const scrollEl = document.getElementById('daily-register-grid');
    if (scrollEl) {
        const wrap = scrollEl.closest('.att-register-scroll');
        if (wrap) {
            scrollEl.addEventListener('scroll', () => {
                const atEnd = scrollEl.scrollLeft + scrollEl.clientWidth >= scrollEl.scrollWidth - 4;
                wrap.classList.toggle('att-register-scroll--end', atEnd);
            }, { passive: true });
        }
    }
}

/**
 * Creates the modal once on <body> and reuses it on subsequent visits.
 * Idempotent — safe to call every time the attendance section loads.
 */
function _ensureModalInBody() {
    // Already exists — nothing to do
    if (document.getElementById('mark-day-modal')) return;

    const modal = document.createElement('div');
    modal.id              = 'mark-day-modal';
    modal.role            = 'dialog';
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'mark-modal-title');
    modal.onclick         = handleModalBackdropClick;

    modal.innerHTML = `
        <div class="att-modal-sheet" role="document">
            <div class="att-modal-header">
                <h3 id="mark-modal-title">Mark Attendance</h3>
                <button class="att-modal-close" onclick="closeMarkDayModal()"
                        aria-label="Close modal">✕</button>
            </div>
            <div class="att-modal-body" id="mark-modal-body"></div>
            <div class="att-modal-footer" id="mark-modal-footer" style="display:none;">
                <button class="att-modal-save-btn" id="att-modal-save-btn"
                        onclick="saveModalAttendance()">
                    💾 Save Attendance
                </button>
                <button class="att-modal-cancel-btn" onclick="closeMarkDayModal()">
                    Cancel
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
}

/* ══════════════════════════════════════════════════════════════
   § 3  CONTEXT HEADER
══════════════════════════════════════════════════════════════ */

function buildContextHeader(term, allPupils, assignedClasses) {
    const className = assignedClasses[0]?.name || '—';
    const session   = window._attCurrentSettings?.session || '—';
    const today     = new Date().toLocaleDateString('en-GB', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });

    return `
    <div class="att-context-header">
        <div class="att-context-header__left">
            <h2 class="att-context-header__title">📚 ${className}</h2>
            <div class="att-context-header__badges">
                <span class="att-badge">🗓 ${term}</span>
                <span class="att-badge">📅 ${session}</span>
                <span class="att-badge">👥 ${allPupils.length} pupils</span>
            </div>
        </div>
        <div class="att-context-header__right">
            <span class="att-today-label">Today</span>
            <span class="att-today-date">${today}</span>
        </div>
    </div>`;
}

/* ══════════════════════════════════════════════════════════════
   § 4  DAILY REGISTER SHELL
   FIX-A: plain function, not window override — no race condition.
   FIX-B: modal has no inline display style.
   FIX-C: #daily-register-grid IS the scrollable element.
   FIX-D: #weekly-summary-panel is a sibling of the grid, outside
          the scroll container so it can expand naturally.
══════════════════════════════════════════════════════════════ */

function buildDailyRegisterShell(term) {
    const today        = window.dailyAttendance.getTodayISO();
    const todayDisplay = window.dailyAttendance.formatDateDisplay(today);

    return `
    <!-- Week Navigator -->
    <div class="att-week-nav">
        <button class="att-btn-nav" onclick="navigateWeek(-1)"
                aria-label="Previous week" title="Previous week">←</button>
        <span id="week-label" class="att-week-label">Loading…</span>
        <button class="att-btn-nav" onclick="navigateWeek(1)"
                aria-label="Next week" title="Next week">→</button>
        <button class="att-btn-today" onclick="goToCurrentWeek()">↩ Today</button>
    </div>

    <!-- Mark Today CTA -->
    <div class="att-cta-wrap">
        <button class="att-cta-btn" onclick="openMarkTodayModal()"
                aria-label="Mark today's attendance">
            <span>✅ Mark Today's Attendance</span>
            <span class="att-cta-date">${todayDisplay}</span>
        </button>
    </div>

    <!-- Register scroll container (FIX-C: grid IS the scroll el) -->
    <div class="att-register-scroll">
        <div id="daily-register-grid" style="overflow-x:auto;-webkit-overflow-scrolling:touch;">
            ${buildTableSkeleton(6)}
        </div>
    </div>

    <!-- Weekly summary (FIX-D: outside scroll container) -->
    <div id="weekly-summary-panel" style="display:none;"></div>

    <!-- Action row -->
    <div class="att-action-row">
        <button class="att-btn-print" onclick="printAttendanceRegister()">
            🖨️ Print Register
        </button>
    </div>`;
}

/* ══════════════════════════════════════════════════════════════
   § 5  SKELETON LOADER
══════════════════════════════════════════════════════════════ */

function buildTableSkeleton(rows = 6) {
    const cells = Array(5).fill('<div class="att-skel att-skel--cell"></div>').join('');
    let html = `<div class="att-skel-header"></div>`;
    for (let i = 0; i < rows; i++) {
        html += `<div class="att-skel-row" style="animation-delay:${i * 60}ms;">
            <div class="att-skel att-skel--name"></div>
            ${cells}
        </div>`;
    }
    return html;
}

/* ══════════════════════════════════════════════════════════════
   § 6  EMPTY STATE
══════════════════════════════════════════════════════════════ */

function renderEmptyState(title, subtitle) {
    return `
    <div class="att-empty">
        <div class="att-empty__icon">📋</div>
        <p class="att-empty__title">${title}</p>
        <p class="att-empty__sub">${subtitle}</p>
    </div>`;
}

/* ══════════════════════════════════════════════════════════════
   § 7  TAB SWITCHER
══════════════════════════════════════════════════════════════ */

function switchAttendanceTab(tabName) {
    document.querySelectorAll('.att-tab').forEach(t => {
        const isActive = t.dataset.tab === tabName;
        t.classList.toggle('att-tab--active', isActive);
        t.setAttribute('aria-selected', String(isActive));
    });
    ['daily', 'manual'].forEach(name => {
        const panel = document.getElementById(`att-panel-${name}`);
        if (panel) panel.style.display = name === tabName ? 'block' : 'none';
    });
}

/* ══════════════════════════════════════════════════════════════
   § 8  WEEK NAVIGATION
══════════════════════════════════════════════════════════════ */

async function loadDailyRegisterPanel(term) {
    currentWeekMonday = window.dailyAttendance.getMondayOfWeek(new Date());
    await renderWeekRegister(term);
}

async function navigateWeek(direction) {
    if (!currentWeekMonday) return;
    const d = new Date(currentWeekMonday);
    d.setDate(d.getDate() + direction * 7);
    currentWeekMonday = d;
    const term = document.getElementById('attendance-term')?.value || 'First Term';
    await renderWeekRegister(term);
}

async function goToCurrentWeek() {
    currentWeekMonday = window.dailyAttendance.getMondayOfWeek(new Date());
    const term = document.getElementById('attendance-term')?.value || 'First Term';
    await renderWeekRegister(term);
}

/* ══════════════════════════════════════════════════════════════
   § 9  REGISTER GRID RENDERER
══════════════════════════════════════════════════════════════ */

async function renderWeekRegister(term) {
    const grid      = document.getElementById('daily-register-grid');
    const weekLabel = document.getElementById('week-label');
    if (!grid || !currentWeekMonday) return;

    const weekDates = window.dailyAttendance.getWeekDates(currentWeekMonday);
    const startDate = weekDates[0];
    const endDate   = weekDates[4];

    if (weekLabel) {
        const s = window.dailyAttendance.formatDateDisplay(startDate);
        const e = window.dailyAttendance.formatDateDisplay(endDate);
        weekLabel.textContent = `${s} – ${e}`;
    }

    grid.innerHTML = buildTableSkeleton(Math.min((window.allPupils || []).length, 8));

    try {
        const classId = window.assignedClasses?.[0]?.id;
        if (!classId) { grid.innerHTML = renderEmptyState('No class assigned', 'Contact admin.'); return; }

        const settings = await window.getCurrentSettings();
        const session  = settings.session;
        const pupils   = window.allPupils || [];

        const { dailyRecords } = await window.dailyAttendance.fetchGrid(
            classId, term, session, startDate, endDate
        );

        const summary = window.dailyAttendance.weeklySummary(weekDates, dailyRecords, pupils);

        grid.innerHTML = buildRegisterTable(pupils, weekDates, dailyRecords);
        buildWeeklySummaryPanel(summary, weekDates);

    } catch (err) {
        console.error('renderWeekRegister error:', err);
        grid.innerHTML = `<div class="att-empty">
            <div class="att-empty__icon">⚠️</div>
            <p class="att-empty__title">Error loading register</p>
            <p class="att-empty__sub">${err.message}</p>
        </div>`;
    }
}

/* ══════════════════════════════════════════════════════════════
   § 10  REGISTER TABLE HTML
   FIX-F: col-gen sticky left is a fixed value matching col-name width.
══════════════════════════════════════════════════════════════ */

function buildRegisterTable(pupils, weekDates, dailyRecords) {
    const today = window.dailyAttendance.getTodayISO();

    if (!pupils.length) {
        return renderEmptyState('No pupils found', 'No pupils are assigned to this class.');
    }

    // ── HEADER ──────────────────────────────────────────────────────────────
    let headerCells = weekDates.map(date => {
        const isToday   = date === today;
        const hasRecord = !!dailyRecords[date];
        const d         = new Date(date + 'T12:00:00');
        const dayName   = d.toLocaleDateString('en-GB', { weekday: 'short' });
        const dayNum    = d.getDate();
        const mon       = d.toLocaleDateString('en-GB', { month: 'short' });
        return `<th class="att-th-day${isToday ? ' att-th-day--today' : ''}">
            <div class="att-day-inner">
                <span>${dayName}</span>
                <span class="att-day-num">${dayNum} ${mon}</span>
                ${hasRecord ? '<span class="att-day-dot" title="Marked"></span>' : ''}
                ${isToday ? '<span class="att-today-chip">TODAY</span>' : ''}
            </div>
        </th>`;
    }).join('');

    // ── ROWS ─────────────────────────────────────────────────────────────────
    let bodyRows = pupils.map((pupil, idx) => {
        let weekPresent = 0, weekAbsent = 0;
        const isBoy = pupil.gender?.toLowerCase() === 'male' || pupil.gender?.toLowerCase() === 'm';

        const statusCells = weekDates.map(date => {
            const record = dailyRecords[date];
            const status = record?.records?.[pupil.id];
            if (status === 'present') {
                weekPresent++;
                return `<td class="att-cell att-cell--present"
                    role="button" tabindex="0"
                    title="Present — click to toggle"
                    aria-label="${pupil.name}, ${window.dailyAttendance.formatDateDisplay(date)}: Present"
                    onclick="togglePupilStatusInDay('${pupil.id}','${date}','present')"
                    onkeydown="if(event.key==='Enter'||event.key===' ')togglePupilStatusInDay('${pupil.id}','${date}','present')">✓</td>`;
            } else if (status === 'absent') {
                weekAbsent++;
                return `<td class="att-cell att-cell--absent"
                    role="button" tabindex="0"
                    title="Absent — click to toggle"
                    aria-label="${pupil.name}, ${window.dailyAttendance.formatDateDisplay(date)}: Absent"
                    onclick="togglePupilStatusInDay('${pupil.id}','${date}','absent')"
                    onkeydown="if(event.key==='Enter'||event.key===' ')togglePupilStatusInDay('${pupil.id}','${date}','absent')">✗</td>`;
            } else {
                return `<td class="att-cell att-cell--unmarked" aria-label="Not marked">—</td>`;
            }
        }).join('');

        const total    = weekPresent + weekAbsent;
        const pct      = total > 0 ? Math.round((weekPresent / total) * 100) : null;
        const pctClass = pct === null ? '' : pct >= 75 ? 'att-pct--good' : pct >= 50 ? 'att-pct--warn' : 'att-pct--bad';

        return `<tr class="att-row${idx % 2 === 0 ? '' : ' att-row--alt'}">
            <td class="att-td-name">${pupil.name || '—'}</td>
            <td class="att-td-gen">${isBoy ? 'M' : 'F'}</td>
            ${statusCells}
            <td class="att-td-total">${weekPresent}</td>
            <td class="att-td-total">${weekAbsent}</td>
            <td class="att-td-total ${pctClass}">${pct !== null ? pct + '%' : '—'}</td>
        </tr>`;
    }).join('');

    // ── TOTALS FOOTER ────────────────────────────────────────────────────────
    const totalCells = weekDates.map(date => {
        const rec = dailyRecords[date];
        return `<td class="att-td-footer">${rec ? `${rec.totalPresent ?? '?'}/${rec.totalPupils ?? '?'}` : '—'}</td>`;
    }).join('');

    return `
    <table class="att-register-table" role="grid" aria-label="Weekly attendance register">
        <thead>
            <tr>
                <th class="att-th-name">Pupil Name</th>
                <th class="att-th-gen">G</th>
                ${headerCells}
                <th class="att-th-stat">Pres</th>
                <th class="att-th-stat">Abs</th>
                <th class="att-th-stat">%</th>
            </tr>
        </thead>
        <tbody>
            ${bodyRows}
            <tr class="att-row-totals">
                <td class="att-td-name att-td-totals-label" colspan="2">Daily Total</td>
                ${totalCells}
                <td colspan="3" class="att-td-footer" style="font-size:.7rem;color:#1e40af;">↓ Summary</td>
            </tr>
        </tbody>
    </table>`;
}

/* ══════════════════════════════════════════════════════════════
   § 11  WEEKLY SUMMARY PANEL
   FIX-D: targets #weekly-summary-panel which is a sibling of the
          scroll container — always findable.
══════════════════════════════════════════════════════════════ */

function buildWeeklySummaryPanel(summary, weekDates) {
    const panel = document.getElementById('weekly-summary-panel');
    if (!panel) return;

    const markedDays = weekDates.filter(d => summary.dailyStats[d]);
    if (markedDays.length === 0) { panel.style.display = 'none'; return; }

    const cards = markedDays.map(date => {
        const s       = summary.dailyStats[date];
        const pctCls  = s.percentage >= 75 ? 'att-pct--good' : s.percentage >= 50 ? 'att-pct--warn' : 'att-pct--bad';
        return `<div class="att-summary-card">
            <div class="att-summary-card__day">${window.dailyAttendance.formatDateDisplay(date)}</div>
            <div class="att-summary-card__count">${s.present}<span class="att-summary-card__of">/${s.total}</span></div>
            <div class="att-summary-card__pct ${pctCls}">${s.percentage}%</div>
        </div>`;
    }).join('');

    panel.innerHTML = `
    <div class="att-summary-inner">
        <p class="att-summary-title">
            📊 Weekly Summary
            <span class="att-summary-days-note">— ${markedDays.length} day${markedDays.length !== 1 ? 's' : ''} marked</span>
        </p>
        <div class="att-summary-grid">${cards}</div>
    </div>`;

    panel.style.display = 'block';
}

/* ══════════════════════════════════════════════════════════════
   § 12  MARK TODAY MODAL
   FIX-B: uses CSS class .is-open — no inline display toggling.
   FIX-E: save loading state is built in here, not via patch.
══════════════════════════════════════════════════════════════ */

async function openMarkTodayModal(dateOverride) {
    _modalDate     = dateOverride || window.dailyAttendance.getTodayISO();
    const term     = document.getElementById('attendance-term')?.value || 'First Term';
    const classId  = window.assignedClasses?.[0]?.id;
    const pupils   = window.allPupils || [];

    if (!classId) { window.showToast?.('No class assigned', 'warning'); return; }

    const modal  = document.getElementById('mark-day-modal');
    const title  = document.getElementById('mark-modal-title');
    const body   = document.getElementById('mark-modal-body');
    const footer = document.getElementById('mark-modal-footer');

    if (!modal || !title || !body) return;

    title.textContent = `Mark Attendance — ${window.dailyAttendance.formatDateDisplay(_modalDate)}`;
    body.innerHTML    = buildTableSkeleton(Math.min(pupils.length, 8));
    if (footer) footer.style.display = 'none';

    // FIX-B: CSS class toggle — animation fires correctly
    modal.classList.add('is-open');
    document.body.style.overflow = 'hidden';

    requestAnimationFrame(() => modal.querySelector('.att-modal-close')?.focus());

    try {
        const docId = `${classId}_${_modalDate}`;
        const snap  = await db.collection('daily_attendance').doc(docId).get();
        const existingRecords = snap.exists ? snap.data().records : {};

        body.innerHTML = `
        <div class="att-modal-date-group">
            <label for="modal-attendance-date">Date</label>
            <input type="date" id="modal-attendance-date"
                   value="${_modalDate}"
                   onchange="_modalDate=this.value"
                   aria-label="Select attendance date">
        </div>

        <div class="att-bulk-actions">
            <button class="att-bulk-btn att-bulk-btn--present"
                    onclick="markAllModalPupils('present')">✓ All Present</button>
            <button class="att-bulk-btn att-bulk-btn--absent"
                    onclick="markAllModalPupils('absent')">✗ All Absent</button>
        </div>

        <div class="att-modal-table-wrap">
            <table class="att-modal-table" role="grid">
                <thead>
                    <tr>
                        <th>Name</th>
                        <th style="color:#15803d;">✓ Present</th>
                        <th style="color:#dc2626;">✗ Absent</th>
                    </tr>
                </thead>
                <tbody>
                    ${pupils.map((pupil, idx) => {
                        const status = existingRecords[pupil.id] || 'present';
                        return `<tr class="${idx % 2 === 0 ? '' : 'att-modal-row--alt'}">
                            <td>${pupil.name}</td>
                            <td style="text-align:center;">
                                <input type="radio" name="status_${pupil.id}" value="present"
                                       data-pupil="${pupil.id}"
                                       class="att-radio att-radio--present"
                                       aria-label="${pupil.name} — Present"
                                       ${status === 'present' ? 'checked' : ''}>
                            </td>
                            <td style="text-align:center;">
                                <input type="radio" name="status_${pupil.id}" value="absent"
                                       data-pupil="${pupil.id}"
                                       class="att-radio att-radio--absent"
                                       aria-label="${pupil.name} — Absent"
                                       ${status === 'absent' ? 'checked' : ''}>
                            </td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>
        </div>`;

        if (footer) footer.style.display = 'flex';

    } catch (err) {
        body.innerHTML = renderEmptyState('Failed to load', err.message);
    }
}

function closeMarkDayModal() {
    const modal = document.getElementById('mark-day-modal');
    if (modal) {
        modal.classList.remove('is-open');
        document.body.style.overflow = '';
    }
}

// Close on backdrop click (not on sheet click)
function handleModalBackdropClick(e) {
    if (e.target.id === 'mark-day-modal') closeMarkDayModal();
}

function markAllModalPupils(status) {
    (window.allPupils || []).forEach(pupil => {
        const radio = document.querySelector(`input[name="status_${pupil.id}"][value="${status}"]`);
        if (radio) radio.checked = true;
    });
}

/* ══════════════════════════════════════════════════════════════
   § 13  SAVE MODAL ATTENDANCE
   FIX-E: single function, no patch chain, loading state built in.
══════════════════════════════════════════════════════════════ */

async function saveModalAttendance() {
    const term      = document.getElementById('attendance-term')?.value || 'First Term';
    const dateInput = document.getElementById('modal-attendance-date');
    const date      = dateInput?.value || _modalDate;
    const classId   = window.assignedClasses?.[0]?.id;
    const pupils    = window.allPupils || [];
    const teacherId = window.currentUser?.uid;
    const saveBtn   = document.getElementById('att-modal-save-btn');
    const footer    = document.getElementById('mark-modal-footer');

    if (!date)      { window.showToast?.('No date selected', 'warning'); return; }
    if (!classId)   { window.showToast?.('No class assigned', 'danger'); return; }
    if (!teacherId) { window.showToast?.('Not authenticated', 'danger'); return; }

    // Loading state
    if (saveBtn) {
        saveBtn.disabled    = true;
        saveBtn.innerHTML   = `<span class="att-spinner"></span> Saving…`;
    }

    // Collect radio values
    const records = {};
    pupils.forEach(pupil => {
        const checked = document.querySelector(`input[name="status_${pupil.id}"]:checked`);
        records[pupil.id] = checked ? checked.value : 'absent';
    });

    try {
        const settings = await window.getCurrentSettings();
        const session  = settings.session;

        await window.dailyAttendance.mark(classId, date, term, session, teacherId, records, pupils);

        window.showToast?.(
            `✓ Attendance saved for ${window.dailyAttendance.formatDateDisplay(date)}`,
            'success'
        );
        closeMarkDayModal();
        await renderWeekRegister(term);

    } catch (err) {
        console.error('saveModalAttendance error:', err);
        window.showToast?.(`Failed to save: ${err.message}`, 'danger');
        if (saveBtn) {
            saveBtn.disabled  = false;
            saveBtn.innerHTML = '💾 Save Attendance';
        }
    }
}

/* ══════════════════════════════════════════════════════════════
   § 14  QUICK TOGGLE (click a cell to flip present/absent)
══════════════════════════════════════════════════════════════ */

async function togglePupilStatusInDay(pupilId, date, currentStatus) {
    const newStatus = currentStatus === 'present' ? 'absent' : 'present';
    const term      = document.getElementById('attendance-term')?.value || 'First Term';
    const classId   = window.assignedClasses?.[0]?.id;
    const teacherId = window.currentUser?.uid;
    const pupils    = window.allPupils || [];

    if (!classId || !teacherId) return;

    try {
        const settings   = await window.getCurrentSettings();
        const session    = settings.session;
        const pupilName  = pupils.find(p => p.id === pupilId)?.name || 'pupil';

        await window.dailyAttendance.updatePupil(
            classId, date, term, session, teacherId, pupilId, newStatus, pupils
        );
        window.showToast?.(
            `✓ ${pupilName} marked ${newStatus} on ${window.dailyAttendance.formatDateDisplay(date)}`,
            'success', 3000
        );
        await renderWeekRegister(term);

    } catch (err) {
        window.showToast?.(`Error: ${err.message}`, 'danger');
    }
}

/* ══════════════════════════════════════════════════════════════
   § 15  LEGACY MANUAL PANEL
══════════════════════════════════════════════════════════════ */

async function loadManualAttendanceLegacy(term) {
    const container = document.getElementById('manual-attendance-container');
    if (!container) return;

    const pupils = window.allPupils || [];
    if (pupils.length === 0) { container.innerHTML = renderEmptyState('No pupils', ''); return; }

    try {
        const settings       = await window.getCurrentSettings();
        const encodedSession = settings.session.replace(/\//g, '-');

        const attendanceMap = {};
        for (const pupil of pupils) {
            const docId = `${pupil.id}_${encodedSession}_${term}`;
            const doc   = await db.collection('attendance').doc(docId).get();
            if (doc.exists) attendanceMap[pupil.id] = doc.data();
        }

        container.innerHTML = `
        <div class="table-container">
            <table class="responsive-table" id="manual-attendance-table">
                <thead>
                    <tr>
                        <th>Pupil Name</th>
                        <th>Times Opened</th>
                        <th>Times Present</th>
                        <th>Times Absent</th>
                    </tr>
                </thead>
                <tbody></tbody>
            </table>
        </div>
        <button class="btn btn-primary"
                onclick="saveAllAttendanceManual('${term}')"
                style="width:100%;margin-top:1rem;">
            💾 Save Manual Totals
        </button>`;

        if (typeof window.paginateTable === 'function') {
            window.paginateTable(pupils, 'manual-attendance-table', 25, (pupil, tbody) => {
                const ex = attendanceMap[pupil.id] || {};
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td data-label="Pupil Name">${pupil.name}</td>
                    <td data-label="Times Opened">
                        <input type="number" min="0" value="${ex.timesOpened || ''}"
                            data-pupil="${pupil.id}" data-field="timesOpened"
                            style="width:100%;max-width:100px;" placeholder="0">
                    </td>
                    <td data-label="Times Present">
                        <input type="number" min="0" value="${ex.timesPresent || ''}"
                            data-pupil="${pupil.id}" data-field="timesPresent"
                            style="width:100%;max-width:100px;" placeholder="0">
                    </td>
                    <td data-label="Times Absent">
                        <input type="number" min="0" value="${ex.timesAbsent || ''}"
                            data-pupil="${pupil.id}" data-field="timesAbsent"
                            style="width:100%;max-width:100px;" placeholder="0">
                    </td>`;
                tbody.appendChild(tr);
            });
        }

    } catch (err) {
        container.innerHTML = renderEmptyState('Error loading data', err.message);
    }
}

async function saveAllAttendanceManual(term) {
    const inputs = document.querySelectorAll('#manual-attendance-container input[type="number"]');
    if (!inputs.length || !term) {
        window.showToast?.('No data to save', 'warning');
        return;
    }
    await window._saveAttendanceFromInputs(inputs, term);
}

/* ══════════════════════════════════════════════════════════════
   § 16  KEYBOARD: ESC closes modal
══════════════════════════════════════════════════════════════ */

document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
        const modal = document.getElementById('mark-day-modal');
        if (modal?.classList.contains('is-open')) closeMarkDayModal();
    }
});

/* ══════════════════════════════════════════════════════════════
   § 17  PRINT REGISTER
══════════════════════════════════════════════════════════════ */

async function printAttendanceRegister() {
    const term      = document.getElementById('attendance-term')?.value || 'First Term';
    const classId   = window.assignedClasses?.[0]?.id;
    const className = window.assignedClasses?.[0]?.name || 'Unknown Class';
    const pupils    = window.allPupils || [];

    if (!classId) { window.showToast?.('No class assigned', 'warning'); return; }

    window.showToast?.('Preparing print register…', 'info', 3000);

    try {
        const settings = await window.getCurrentSettings();
        const session  = settings.session;

        const snap = await db.collection('daily_attendance')
            .where('classId', '==', classId)
            .where('term', '==', term)
            .where('session', '==', session)
            .orderBy('date', 'asc')
            .get();

        const dailyRecords = {};
        snap.forEach(doc => { dailyRecords[doc.data().date] = doc.data(); });

        const allDates   = Object.keys(dailyRecords).sort();
        const printHTML  = buildPrintHTML(className, term, session, pupils, allDates, dailyRecords);
        const printWin   = window.open('', '_blank', 'width=1200,height=800');

        if (!printWin) {
            window.showToast?.('Popup blocked — please allow popups.', 'warning');
            return;
        }
        printWin.document.write(printHTML);
        printWin.document.close();
        printWin.focus();
        setTimeout(() => printWin.print(), 800);

    } catch (err) {
        console.error('Print error:', err);
        window.showToast?.(`Print failed: ${err.message}`, 'danger');
    }
}

function buildPrintHTML(className, term, session, pupils, allDates, dailyRecords) {
    const today = new Date().toLocaleDateString('en-GB', {
        year: 'numeric', month: 'long', day: 'numeric'
    });

    // Bucket dates into weeks of 5
    const weeks = [];
    let wk = [];
    allDates.forEach((date, i) => {
        wk.push(date);
        if (wk.length === 5 || i === allDates.length - 1) { weeks.push([...wk]); wk = []; }
    });

    const pupilRows = pupils.map(pupil => {
        let totalPresent = 0, totalAbsent = 0;
        const cells = allDates.map(date => {
            const status = dailyRecords[date]?.records?.[pupil.id];
            if (status === 'present') { totalPresent++; return { s: 'P', cls: 'p-cell' }; }
            if (status === 'absent')  { totalAbsent++;  return { s: 'A', cls: 'a-cell' }; }
            return { s: '', cls: '' };
        });
        const pct = (totalPresent + totalAbsent) > 0
            ? Math.round((totalPresent / (totalPresent + totalAbsent)) * 100) + '%'
            : '—';
        return { pupil, cells, totalPresent, totalAbsent, pct };
    });

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Attendance Register — ${className} — ${term} ${session}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:Arial,sans-serif;font-size:9pt;color:#000;background:#fff}
  @page{size:A3 landscape;margin:10mm 8mm}
  .hdr{text-align:center;border:2px solid #1565c0;padding:8px;margin-bottom:8px;background:#e3f2fd}
  .hdr h1{font-size:14pt;color:#1565c0}.hdr h2{font-size:11pt}.hdr p{font-size:9pt;margin-top:4px}
  .info{display:flex;justify-content:space-between;margin-bottom:6px;font-size:9pt;
        border-bottom:1px solid #1565c0;padding-bottom:4px}
  table{width:100%;border-collapse:collapse;font-size:8pt}
  th,td{border:1px solid #1565c0;padding:3px 4px;text-align:center;white-space:nowrap}
  th{background:#1565c0;color:#fff;font-weight:600}
  .n{text-align:left!important;min-width:120px;max-width:150px}
  .g{width:24px}.dc{width:30px;font-size:7pt}
  .tc{font-weight:700;background:#e3f2fd}
  .p-cell{background:#dcfce7;color:#15803d;font-weight:700}
  .a-cell{background:#fee2e2;color:#dc2626;font-weight:700}
  tr:nth-child(even) td:not(.p-cell):not(.a-cell){background:#f8faff}
  .tr td{background:#dbeafe!important;font-weight:700}
  .wk-sum{margin-top:12px;border:1px solid #1565c0;padding:8px}
  .sigs{margin-top:20px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:20px}
  .sig{border-top:1px solid #000;padding-top:4px;font-size:8pt;text-align:center;margin-top:20px}
  @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style>
</head>
<body>
<div class="hdr">
  <h1>FAHMID NURSERY &amp; PRIMARY SCHOOL</h1>
  <h2>CLASS ATTENDANCE REGISTER</h2>
  <p>Class: <strong>${className}</strong> &nbsp;|&nbsp; Term: <strong>${term}</strong>
     &nbsp;|&nbsp; Session: <strong>${session}</strong> &nbsp;|&nbsp; Printed: ${today}</p>
</div>
<div class="info">
  <span>Total Pupils: <strong>${pupils.length}</strong></span>
  <span>Days Marked: <strong>${allDates.length}</strong></span>
  <span>Boys: <strong>${pupils.filter(p => p.gender?.toLowerCase() === 'male' || p.gender?.toLowerCase() === 'm').length}</strong></span>
  <span>Girls: <strong>${pupils.filter(p => p.gender?.toLowerCase() !== 'male' && p.gender?.toLowerCase() !== 'm').length}</strong></span>
</div>
<table>
  <thead><tr>
    <th class="n">Pupil Name</th><th class="g">G</th>
    ${allDates.map(date => {
        const d = new Date(date + 'T12:00:00');
        return `<th class="dc">${d.toLocaleDateString('en-GB',{weekday:'narrow'})}<br>${d.getDate()}<br>${d.toLocaleDateString('en-GB',{month:'short'})}</th>`;
    }).join('')}
    <th class="tc">Pres</th><th class="tc">Abs</th><th class="tc">%</th>
  </tr></thead>
  <tbody>
  ${pupilRows.map(row => {
      const isBoy = row.pupil.gender?.toLowerCase() === 'male' || row.pupil.gender?.toLowerCase() === 'm';
      return `<tr>
        <td class="n">${row.pupil.name}</td>
        <td class="g">${isBoy ? 'M' : 'F'}</td>
        ${row.cells.map(c => `<td class="${c.cls}">${c.s}</td>`).join('')}
        <td class="tc">${row.totalPresent}</td>
        <td class="tc">${row.totalAbsent}</td>
        <td class="tc">${row.pct}</td>
      </tr>`;
  }).join('')}
  <tr class="tr">
    <td class="n" colspan="2"><strong>DAILY TOTAL PRESENT</strong></td>
    ${allDates.map(d => `<td>${dailyRecords[d]?.totalPresent ?? '—'}</td>`).join('')}
    <td></td><td></td><td></td>
  </tr>
  <tr class="tr">
    <td class="n" colspan="2"><strong>DAILY TOTAL ABSENT</strong></td>
    ${allDates.map(d => `<td>${dailyRecords[d]?.totalAbsent ?? '—'}</td>`).join('')}
    <td></td><td></td><td></td>
  </tr>
  <tr class="tr">
    <td class="n" colspan="2"><strong>% ATTENDANCE</strong></td>
    ${allDates.map(d => {
        const rec = dailyRecords[d];
        if (!rec) return `<td>—</td>`;
        const pct = rec.totalPupils > 0 ? Math.round((rec.totalPresent / rec.totalPupils) * 100) : '—';
        return `<td>${pct}${typeof pct === 'number' ? '%' : ''}</td>`;
    }).join('')}
    <td></td><td></td><td></td>
  </tr>
  </tbody>
</table>

<div class="wk-sum">
  <strong>WEEKLY ATTENDANCE SUMMARY</strong>
  <table style="margin-top:6px;font-size:8pt;" cellspacing="0">
    <thead><tr>
      <th>Week</th><th>Days</th><th>Boys Present</th>
      <th>Girls Present</th><th>Total Present</th><th>Total Absent</th><th>Avg %</th>
    </tr></thead>
    <tbody>
    ${weeks.map((wkDates, wi) => {
        let boyPres=0,girlPres=0,totAbs=0;
        wkDates.forEach(d => {
            const r = dailyRecords[d];
            if (r) { boyPres += r.boyPresent||0; girlPres += r.girlPresent||0; totAbs += r.totalAbsent||0; }
        });
        const totPres = boyPres + girlPres;
        const poss    = totPres + totAbs;
        const pct     = poss > 0 ? Math.round((totPres/poss)*100)+'%' : '—';
        const startD  = new Date(wkDates[0]+'T12:00:00').toLocaleDateString('en-GB',{day:'2-digit',month:'short'});
        return `<tr>
          <td>Wk ${wi+1} (${startD})</td>
          <td>${wkDates.length}</td>
          <td>${boyPres}</td><td>${girlPres}</td>
          <td>${totPres}</td><td>${totAbs}</td><td>${pct}</td>
        </tr>`;
    }).join('')}
    </tbody>
  </table>
</div>

<div class="sigs">
  <div class="sig">_____________________________<br>Class Teacher's Signature &amp; Date</div>
  <div class="sig">_____________________________<br>Head Teacher's Signature &amp; Date</div>
  <div class="sig">_____________________________<br>School Stamp</div>
</div>
<p style="margin-top:8px;font-size:7pt;text-align:center;color:#666;">
  Key: P = Present &nbsp;|&nbsp; A = Absent &nbsp;|&nbsp; — = Not marked<br>
  This register is a legal school document. Handle with care.
</p>
</body></html>`;
}

/* ══════════════════════════════════════════════════════════════
   § 18  GLOBAL EXPORTS
══════════════════════════════════════════════════════════════ */

window.loadAttendanceSectionEnhanced = loadAttendanceSectionEnhanced;
window.switchAttendanceTab           = switchAttendanceTab;
window.navigateWeek                  = navigateWeek;
window.goToCurrentWeek               = goToCurrentWeek;
window.openMarkTodayModal            = openMarkTodayModal;
window.closeMarkDayModal             = closeMarkDayModal;
window.handleModalBackdropClick      = handleModalBackdropClick;
window.markAllModalPupils            = markAllModalPupils;
window.saveModalAttendance           = saveModalAttendance;
window.togglePupilStatusInDay        = togglePupilStatusInDay;
window.printAttendanceRegister       = printAttendanceRegister;
window.saveAllAttendanceManual       = saveAllAttendanceManual;

/* ══════════════════════════════════════════════════════════════
   § 19  INSTALL INTO sectionLoaders (retry until teacher.js ready)
══════════════════════════════════════════════════════════════ */

function installEnhancedAttendance() {
    if (window.sectionLoaders) {
        window.sectionLoaders['attendance'] = loadAttendanceSectionEnhanced;
        console.log('✓ Enhanced attendance UI installed into sectionLoaders');
    } else {
        setTimeout(installEnhancedAttendance, 100);
    }
}

installEnhancedAttendance();

console.log('✓ attendance-teacher-ui.js v3.0.0 loaded — all conflicts resolved');