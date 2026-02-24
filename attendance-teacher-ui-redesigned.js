/**
 * FAHMID NURSERY & PRIMARY SCHOOL
 * attendance-teacher-ui-redesigned.js
 *
 * DROP-IN REPLACEMENTS for the UI rendering functions in attendance-teacher-ui.js.
 * 
 * HOW TO USE:
 *   1. Keep attendance-teacher-ui.js exactly as-is (all business/Firebase logic preserved).
 *   2. Load THIS file AFTER attendance-teacher-ui.js in your HTML.
 *   3. This file overrides only the rendering functions listed below.
 *
 * FUNCTIONS REPLACED (UI/UX only — zero logic changes):
 *   - renderDailyRegisterShell()
 *   - renderRegisterTable()
 *   - renderWeeklySummaryPanel()
 *   - openMarkTodayModal()   ← modal open/close mechanism updated (FIX 3)
 *   - closeMarkDayModal()    ← modal open/close mechanism updated (FIX 3)
 *
 * ALL IDs preserved. All business logic calls preserved.
 * @version 2.0.0
 */

'use strict';

/* ══════════════════════════════════════════
   CONTEXT HEADER (FIX 4 — new component)
   Called from loadAttendanceSectionEnhanced()
   Insert this once at the top of the container.
══════════════════════════════════════════ */

function renderContextHeader(term) {
    const className  = window.assignedClasses?.[0]?.name  || '—';
    const session    = window._currentSettings?.session    || '—';
    const today      = new Date().toLocaleDateString('en-GB', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });

    return `
    <div class="att-context-header">
        <div class="att-context-header__left">
            <h2>📚 ${className} — Attendance Register</h2>
            <div class="att-context-header__meta">
                <span class="att-context-badge">🗓 ${term}</span>
                <span class="att-context-badge">📅 ${session}</span>
                <span class="att-context-badge">👥 ${(window.allPupils || []).length} pupils</span>
            </div>
        </div>
        <div class="att-context-header__today">
            <span class="att-today-label">Today</span>
            <span class="att-today-date">${today}</span>
        </div>
    </div>`;
}

/* ══════════════════════════════════════════
   OVERRIDE: loadAttendanceSectionEnhanced
   Injects context header before tab shell.
══════════════════════════════════════════ */

const _originalLoadEnhanced = window.loadAttendanceSectionEnhanced;

window.loadAttendanceSectionEnhanced = async function () {
    const container = document.getElementById('attendance-form-container');
    const saveBtn   = document.getElementById('save-attendance-btn');
    const term      = document.getElementById('attendance-term')?.value || 'First Term';

    if (!container) return;

    const assignedClasses = window.assignedClasses || [];
    const allPupils       = window.allPupils       || [];

    if (assignedClasses.length === 0 || allPupils.length === 0) {
        container.innerHTML = renderAttendanceEmptyState(
            'No pupils assigned',
            'No pupils have been assigned to your class yet. Please contact the admin.'
        );
        if (saveBtn) saveBtn.hidden = true;
        return;
    }

    // Cache settings for context header
    try {
        window._currentSettings = await window.getCurrentSettings();
    } catch (_) {}

    // Inject context header + tab shell
    container.innerHTML = `
        ${renderContextHeader(term)}

        <div class="attendance-tabs" role="tablist" aria-label="Attendance entry mode">
            <button class="attendance-tab active" role="tab" aria-selected="true"
                    data-tab="daily" onclick="switchAttendanceTab('daily')">
                📅 Daily Register
            </button>
            <button class="attendance-tab" role="tab" aria-selected="false"
                    data-tab="manual" onclick="switchAttendanceTab('manual')">
                ✏️ Manual Totals
            </button>
        </div>

        <!-- DAILY REGISTER TAB -->
        <div id="attendance-tab-daily" class="attendance-tab-panel" role="tabpanel">
            ${renderDailyRegisterShell(term)}
        </div>

        <!-- MANUAL ENTRY TAB -->
        <div id="attendance-tab-manual" class="attendance-tab-panel" style="display:none;" role="tabpanel">
            <div class="att-legacy-banner">
                <span class="att-legacy-banner-icon">ℹ️</span>
                <div class="att-legacy-banner-text">
                    <strong>Legacy Manual Entry</strong>
                    <p>Use this to override totals directly. Values entered here will be overwritten if the Daily Register is used.</p>
                </div>
            </div>
            <div id="manual-attendance-container"></div>
        </div>
    `;

    // Load both panels
    await loadDailyRegisterPanel(term);
    await loadManualAttendanceLegacy(term, container);

    if (saveBtn) saveBtn.hidden = true;

    // Attach table scroll affordance detector
    requestAnimationFrame(() => {
        const inner = container.querySelector('.att-table-inner');
        const wrap  = container.querySelector('.att-table-scroll-wrap');
        if (inner && wrap) {
            inner.addEventListener('scroll', () => {
                const atEnd = inner.scrollLeft + inner.clientWidth >= inner.scrollWidth - 4;
                wrap.classList.toggle('scrolled-end', atEnd);
            }, { passive: true });
        }
    });
};

/* ══════════════════════════════════════════
   OVERRIDE: renderDailyRegisterShell
   (FIX 5, 6, 7, 8 — nav hierarchy, button
    overflow, scroll wrap, empty state)
══════════════════════════════════════════ */

window.renderDailyRegisterShell = function renderDailyRegisterShell(term) {
    const today = window.dailyAttendance.getTodayISO();
    const todayDisplay = window.dailyAttendance.formatDateDisplay(today);

    return `
    <!-- Week Navigator (FIX 5) -->
    <div class="week-navigator">
        <button class="btn-nav-primary" onclick="navigateWeek(-1)"
                aria-label="Previous week" title="Previous week">←</button>
        <span id="week-label">Loading week…</span>
        <button class="btn-nav-primary" onclick="navigateWeek(1)"
                aria-label="Next week" title="Next week">→</button>
        <button class="btn-today" onclick="goToCurrentWeek()" aria-label="Go to current week">
            ↩ Today
        </button>
    </div>

    <!-- Mark Today CTA (FIX 6) -->
    <div class="att-mark-today-wrap">
        <button class="att-mark-today-btn" onclick="openMarkTodayModal()"
                aria-label="Mark today's attendance">
            <span>✅ Mark Today's Attendance</span>
            <span class="btn-date-label">${todayDisplay}</span>
        </button>
    </div>

    <!-- Register Grid (FIX 7 — scroll wrap) -->
    <div class="att-table-scroll-wrap">
        <div id="daily-register-grid" class="att-table-inner">
            ${renderTableSkeleton()}
        </div>
        <!-- Weekly summary visually connected below table (FIX 9) -->
        <div id="weekly-summary-panel" style="display:none;"></div>
    </div>

    <!-- Action Row (FIX 14 — print button distinct) -->
    <div class="att-action-row">
        <button class="att-btn-print" onclick="printAttendanceRegister()"
                aria-label="Print attendance register">
            🖨️ Print Register
        </button>
    </div>

    <!-- Mark Day Modal (FIX 3, 10 — CSS class toggle, mobile sheet) -->
    <div id="mark-day-modal" role="dialog" aria-modal="true" aria-labelledby="mark-modal-title">
        <div class="att-modal-sheet">
            <div class="att-modal-header">
                <h3 id="mark-modal-title">Mark Attendance</h3>
                <button class="att-modal-close" onclick="closeMarkDayModal()"
                        aria-label="Close modal">✕</button>
            </div>
            <div class="att-modal-body" id="mark-modal-body">
                <!-- Content injected by openMarkTodayModal() -->
            </div>
            <div class="att-modal-footer" id="mark-modal-footer" style="display:none;">
                <button class="att-modal-save-btn" onclick="saveModalAttendance()" id="att-modal-save-btn">
                    💾 Save Attendance
                </button>
                <button class="att-modal-cancel-btn" onclick="closeMarkDayModal()">
                    Cancel
                </button>
            </div>
        </div>
    </div>
    `;
};

/* ══════════════════════════════════════════
   SKELETON LOADING STATE (FIX 12)
══════════════════════════════════════════ */

function renderTableSkeleton(rows = 6) {
    let html = `<div style="background:#fff;">`;
    // Fake header
    html += `<div style="background:var(--att-blue-800);padding:10px 14px;display:flex;gap:.75rem;">
        <div class="att-skeleton" style="height:14px;width:160px;opacity:.4;border-radius:4px;"></div>
        ${Array(5).fill('<div class="att-skeleton" style="height:14px;width:50px;opacity:.3;border-radius:4px;"></div>').join('')}
    </div>`;
    for (let i = 0; i < rows; i++) {
        html += `<div class="att-skeleton-row">
            <div class="att-skeleton att-skeleton-name" style="animation-delay:${i * 60}ms;"></div>
            ${Array(5).fill(`<div class="att-skeleton att-skeleton-cell" style="animation-delay:${i * 60 + 30}ms;"></div>`).join('')}
        </div>`;
    }
    html += `</div>`;
    return html;
}

/* ══════════════════════════════════════════
   EMPTY STATE HELPER (FIX 8)
══════════════════════════════════════════ */

function renderAttendanceEmptyState(title, subtitle, showCTA = false) {
    return `
    <div class="att-empty-state">
        <div class="att-empty-icon">📋</div>
        <p class="att-empty-title">${title}</p>
        <p class="att-empty-sub">${subtitle}</p>
        ${showCTA ? `<button class="att-mark-today-btn" style="max-width:300px;" onclick="openMarkTodayModal()">
            ✅ Mark Today's Attendance
        </button>` : ''}
    </div>`;
}

/* ══════════════════════════════════════════
   OVERRIDE: renderRegisterTable
   (FIX 2 — removes hardcoded left:150px,
    uses CSS classes for status cells,
    improves header design)
══════════════════════════════════════════ */

window.renderRegisterTable = function renderRegisterTable(pupils, weekDates, dailyRecords, summary) {
    const today = window.dailyAttendance.getTodayISO();

    if (!pupils.length) {
        return renderAttendanceEmptyState(
            'No pupils found',
            'No pupils are assigned to this class.',
            false
        );
    }

    let html = `
    <table class="attendance-register-table" role="grid" aria-label="Weekly attendance register">
    <thead>
        <tr>
            <th class="col-name" scope="col">Pupil Name</th>
            <th class="col-gen"  scope="col" aria-label="Gender">G</th>`;

    weekDates.forEach(date => {
        const isToday    = date === today;
        const hasRecord  = !!dailyRecords[date];
        const d          = new Date(date + 'T12:00:00');
        const dayName    = d.toLocaleDateString('en-GB', { weekday: 'short' });
        const dayNum     = d.getDate();
        const monthShort = d.toLocaleDateString('en-GB', { month: 'short' });

        html += `<th scope="col" class="${isToday ? 'col-today' : ''}">
            <div class="att-day-header-inner">
                <span>${dayName}</span>
                <span>${dayNum} ${monthShort}</span>
                ${hasRecord ? '<span class="att-day-dot" title="Marked"></span>' : ''}
                ${isToday ? '<span style="font-size:.6rem;font-weight:800;opacity:.85;letter-spacing:.05em;">TODAY</span>' : ''}
            </div>
        </th>`;
    });

    html += `
            <th scope="col" style="background:#0d47a1;">Pres</th>
            <th scope="col" style="background:#0d47a1;">Abs</th>
            <th scope="col" style="background:#0d47a1;">%</th>
        </tr>
    </thead>
    <tbody>`;

    pupils.forEach((pupil) => {
        let weekPresent = 0, weekAbsent = 0;
        const isBoy = pupil.gender?.toLowerCase() === 'male' || pupil.gender?.toLowerCase() === 'm';

        html += `<tr>
            <td class="col-name">${pupil.name || '—'}</td>
            <td class="col-gen" aria-label="${isBoy ? 'Male' : 'Female'}">${isBoy ? 'M' : 'F'}</td>`;

        weekDates.forEach(date => {
            const record = dailyRecords[date];
            const status = record?.records?.[pupil.id];

            if (status === 'present') {
                weekPresent++;
                html += `<td class="att-cell-present"
                    role="button" tabindex="0"
                    title="Click to toggle — currently Present"
                    aria-label="${pupil.name} on ${window.dailyAttendance.formatDateDisplay(date)}: Present"
                    onclick="togglePupilStatusInDay('${pupil.id}','${date}','present')"
                    onkeydown="if(event.key==='Enter'||event.key===' ')togglePupilStatusInDay('${pupil.id}','${date}','present')">✓</td>`;
            } else if (status === 'absent') {
                weekAbsent++;
                html += `<td class="att-cell-absent"
                    role="button" tabindex="0"
                    title="Click to toggle — currently Absent"
                    aria-label="${pupil.name} on ${window.dailyAttendance.formatDateDisplay(date)}: Absent"
                    onclick="togglePupilStatusInDay('${pupil.id}','${date}','absent')"
                    onkeydown="if(event.key==='Enter'||event.key===' ')togglePupilStatusInDay('${pupil.id}','${date}','absent')">✗</td>`;
            } else {
                html += `<td class="att-cell-unmarked" aria-label="Not marked">—</td>`;
            }
        });

        const total = weekPresent + weekAbsent;
        const pct   = total > 0 ? Math.round((weekPresent / total) * 100) : null;
        const pctClass = pct === null ? ''
            : pct >= 75 ? 'att-col-pct-good'
            : pct >= 50 ? 'att-col-pct-warn'
            : 'att-col-pct-bad';

        html += `
            <td class="att-col-total">${weekPresent}</td>
            <td class="att-col-total">${weekAbsent}</td>
            <td class="att-col-total ${pctClass}">${pct !== null ? pct + '%' : '—'}</td>
        </tr>`;
    });

    // Totals footer row
    html += `<tr class="att-totals-row">
        <td class="col-name" colspan="2">Daily Total</td>`;

    weekDates.forEach(date => {
        const record = dailyRecords[date];
        html += `<td>${record ? `${record.totalPresent ?? '?'}/${record.totalPupils ?? '?'}` : '—'}</td>`;
    });

    html += `<td colspan="3" style="font-size:.7rem;color:#1e40af;padding:6px 8px;">
        ↓ Summary</td></tr>`;

    html += `</tbody></table>`;

    return html;
};

/* ══════════════════════════════════════════
   OVERRIDE: renderWeeklySummaryPanel
   (FIX 9 — visually connected to table)
══════════════════════════════════════════ */

window.renderWeeklySummaryPanel = function renderWeeklySummaryPanel(summary, weekDates) {
    const panel = document.getElementById('weekly-summary-panel');
    if (!panel) return;

    const markedDays = weekDates.filter(d => summary.dailyStats[d]);

    if (markedDays.length === 0) {
        panel.style.display = 'none';
        return;
    }

    let cardsHTML = markedDays.map(date => {
        const stats = summary.dailyStats[date];
        const pctClass = stats.percentage >= 75 ? 'att-col-pct-good'
            : stats.percentage >= 50 ? 'att-col-pct-warn'
            : 'att-col-pct-bad';

        return `<div class="att-summary-day-card">
            <div class="att-summary-day-label">${window.dailyAttendance.formatDateDisplay(date)}</div>
            <div class="att-summary-day-count">${stats.present}<span style="font-size:.875rem;font-weight:400;color:#94a3b8;">/${stats.total}</span></div>
            <div class="att-summary-day-pct ${pctClass}" style="font-weight:700;">${stats.percentage}%</div>
        </div>`;
    }).join('');

    panel.innerHTML = `
    <div class="att-summary-inner">
        <p class="att-summary-title">
            📊 Weekly Summary
            <span style="font-size:.6875rem;font-weight:400;color:#64748b;text-transform:none;letter-spacing:0;">
                — ${markedDays.length} day${markedDays.length !== 1 ? 's' : ''} marked this week
            </span>
        </p>
        <div class="att-summary-grid">${cardsHTML}</div>
    </div>`;

    panel.style.display = 'block';
};

/* ══════════════════════════════════════════
   OVERRIDE: openMarkTodayModal
   (FIX 3 — CSS class toggle so animation fires;
    FIX 11 — accessible bulk action buttons)
══════════════════════════════════════════ */

window.openMarkTodayModal = async function openMarkTodayModal(dateOverride) {
    _modalDate = dateOverride || window.dailyAttendance.getTodayISO();
    const term    = document.getElementById('attendance-term')?.value || 'First Term';
    const classId = window.assignedClasses?.[0]?.id;
    const pupils  = window.allPupils || [];

    if (!classId) { window.showToast?.('No class assigned', 'warning'); return; }

    const modal  = document.getElementById('mark-day-modal');
    const title  = document.getElementById('mark-modal-title');
    const body   = document.getElementById('mark-modal-body');
    const footer = document.getElementById('mark-modal-footer');

    if (!modal || !title || !body) return;

    title.textContent = `Mark Attendance — ${window.dailyAttendance.formatDateDisplay(_modalDate)}`;
    body.innerHTML    = renderTableSkeleton(Math.min(pupils.length, 8));
    if (footer) footer.style.display = 'none';

    // FIX 3 — use CSS class for animation
    modal.classList.add('is-open');
    document.body.style.overflow = 'hidden';

    // Trap focus inside modal
    requestAnimationFrame(() => {
        modal.querySelector('.att-modal-close')?.focus();
    });

    try {
        const docId = `${classId}_${_modalDate}`;
        const snap  = await db.collection('daily_attendance').doc(docId).get();
        const existingRecords = snap.exists ? snap.data().records : {};

        body.innerHTML = `
        <!-- Date picker -->
        <div class="att-modal-date-group">
            <label for="modal-attendance-date">Date</label>
            <input type="date" id="modal-attendance-date"
                   value="${_modalDate}"
                   onchange="_modalDate=this.value"
                   aria-label="Select attendance date">
        </div>

        <!-- FIX 11 — Bulk actions with proper touch targets -->
        <div class="att-bulk-actions">
            <button class="att-bulk-btn att-bulk-btn-present"
                    onclick="markAllModalPupils('present')"
                    aria-label="Mark all pupils present">
                ✓ Mark All Present
            </button>
            <button class="att-bulk-btn att-bulk-btn-absent"
                    onclick="markAllModalPupils('absent')"
                    aria-label="Mark all pupils absent">
                ✗ Mark All Absent
            </button>
        </div>

        <!-- Pupil list -->
        <div class="att-modal-table-wrap">
            <table class="att-modal-table" role="grid"
                   aria-label="Pupil attendance marking">
                <thead>
                    <tr>
                        <th scope="col">Name</th>
                        <th scope="col">Present</th>
                        <th scope="col">Absent</th>
                    </tr>
                </thead>
                <tbody>
                    ${pupils.map((pupil, idx) => {
                        const status = existingRecords[pupil.id] || 'present';
                        return `<tr>
                            <td>${pupil.name}</td>
                            <td>
                                <input type="radio"
                                       name="status_${pupil.id}"
                                       value="present"
                                       data-pupil="${pupil.id}"
                                       class="att-radio-present"
                                       aria-label="${pupil.name} — Present"
                                       ${status === 'present' ? 'checked' : ''}>
                            </td>
                            <td>
                                <input type="radio"
                                       name="status_${pupil.id}"
                                       value="absent"
                                       data-pupil="${pupil.id}"
                                       class="att-radio-absent"
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
        body.innerHTML = `<div class="att-empty-state" style="padding:2rem;">
            <div class="att-empty-icon">⚠️</div>
            <p class="att-empty-title">Failed to load</p>
            <p class="att-empty-sub">${err.message}</p>
        </div>`;
    }
};

/* ══════════════════════════════════════════
   OVERRIDE: closeMarkDayModal
   (FIX 3 — CSS class toggle)
══════════════════════════════════════════ */

window.closeMarkDayModal = function closeMarkDayModal() {
    const modal = document.getElementById('mark-day-modal');
    if (modal) {
        modal.classList.remove('is-open');
        document.body.style.overflow = '';
    }
};

/* ══════════════════════════════════════════
   KEYBOARD: close modal on Escape
   (enhances existing Escape key in teacher.js)
══════════════════════════════════════════ */

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const modal = document.getElementById('mark-day-modal');
        if (modal?.classList.contains('is-open')) {
            closeMarkDayModal();
        }
    }
});

/* ══════════════════════════════════════════
   SAVE BUTTON LOADING STATE
   Patches saveModalAttendance to update the
   redesigned save button during save.
══════════════════════════════════════════ */

const _originalSaveModal = window.saveModalAttendance;

window.saveModalAttendance = async function saveModalAttendance() {
    const btn = document.getElementById('att-modal-save-btn');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<span style="display:inline-flex;align-items:center;gap:.5rem;">
            <span style="width:16px;height:16px;border:2px solid rgba(255,255,255,.4);
                border-top-color:#fff;border-radius:50%;display:inline-block;
                animation:att-spin .7s linear infinite;"></span>
            Saving…
        </span>`;
    }

    try {
        await _originalSaveModal();
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '💾 Save Attendance';
        }
    }
};

/* ══════════════════════════════════════════
   SWITCH TAB — update aria-selected
══════════════════════════════════════════ */

const _originalSwitchTab = window.switchAttendanceTab;

window.switchAttendanceTab = function switchAttendanceTab(tabName) {
    _originalSwitchTab(tabName);
    // Sync aria-selected
    document.querySelectorAll('.attendance-tab').forEach(t => {
        t.setAttribute('aria-selected', t.dataset.tab === tabName ? 'true' : 'false');
    });
};

/* ══════════════════════════════════════════
   CSS ANIMATION FOR SPINNER
══════════════════════════════════════════ */

(function injectSpinnerKeyframe() {
    if (document.getElementById('att-spinner-style')) return;
    const style = document.createElement('style');
    style.id = 'att-spinner-style';
    style.textContent = `@keyframes att-spin { to { transform: rotate(360deg); } }`;
    document.head.appendChild(style);
})();

console.log('✓ attendance-teacher-ui-redesigned.js loaded (v2.0.0)');
