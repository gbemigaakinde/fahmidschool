/**
 * FAHMID NURSERY & PRIMARY SCHOOL
 * Teacher Daily Attendance UI - attendance-teacher-ui.js
 *
 * Provides the digital class register UI inside teacher.js's attendance section.
 * Replaces/extends the existing loadAttendanceSection() display.
 *
 * INTEGRATION: This is loaded AFTER teacher.js. It patches into the existing
 * loadAttendanceSection() by adding a tab interface: Manual Entry | Daily Register
 *
 * @version 1.0.0
 */

'use strict';

/* ══════════════════════════════════════════
   PATCH INTO EXISTING ATTENDANCE SECTION
══════════════════════════════════════════ */

/**
 * Enhanced loadAttendanceSection — replaces the existing one.
 * Adds tabs: [Daily Register] [Manual Entry (Legacy)]
 */
async function loadAttendanceSectionEnhanced() {
    const container = document.getElementById('attendance-form-container');
    const saveBtn = document.getElementById('save-attendance-btn');
    const term = document.getElementById('attendance-term')?.value || 'First Term';

    if (!container) return;

    // Guard: need classes and pupils
    if (!window.assignedClasses || window.assignedClasses.length === 0 ||
        !window.allPupils || window.allPupils.length === 0) {
        container.innerHTML = '<p style="text-align:center;color:var(--color-gray-600);">No pupils in assigned classes</p>';
        if (saveBtn) saveBtn.hidden = true;
        return;
    }

    // Inject tab shell
    container.innerHTML = `
        <div class="attendance-tabs" style="margin-bottom: var(--space-lg);">
            <button class="attendance-tab active" data-tab="daily" onclick="switchAttendanceTab('daily')">
                📅 Daily Register
            </button>
            <button class="attendance-tab" data-tab="manual" onclick="switchAttendanceTab('manual')">
                ✏️ Manual Totals
            </button>
        </div>

        <!-- DAILY REGISTER TAB -->
        <div id="attendance-tab-daily" class="attendance-tab-panel">
            ${renderDailyRegisterShell(term)}
        </div>

        <!-- MANUAL ENTRY TAB (existing system, untouched) -->
        <div id="attendance-tab-manual" class="attendance-tab-panel" style="display:none;">
            <div class="alert-info" style="padding:var(--space-md);background:#e3f2fd;border:1px solid #90caf9;border-radius:var(--radius-md);margin-bottom:var(--space-lg);">
                <strong>ℹ️ Legacy Manual Entry</strong>
                <p style="margin:0.25rem 0 0;font-size:var(--text-sm);">
                    Use this if you need to override totals. These values will be overwritten if you use Daily Register.
                </p>
            </div>
            <div id="manual-attendance-container"></div>
        </div>
    `;

    // Load both panels
    await loadDailyRegisterPanel(term);
    await loadManualAttendanceLegacy(term, container);

    // Hide the old save button (daily register has its own)
    if (saveBtn) saveBtn.hidden = true;
}

function renderDailyRegisterShell(term) {
    const today = window.dailyAttendance.getTodayISO();
    const monday = window.dailyAttendance.getMondayOfWeek(new Date());
    const mondayISO = window.dailyAttendance.formatDateISO(monday);

    return `
        <!-- Week Navigator -->
        <div class="week-navigator" style="
            display:flex;align-items:center;gap:var(--space-md);
            padding:var(--space-md) var(--space-lg);
            background:#f0f9ff;border:1px solid #bae6fd;border-radius:var(--radius-lg);
            margin-bottom:var(--space-lg);flex-wrap:wrap;
        ">
            <button class="btn btn-secondary" onclick="navigateWeek(-1)" style="padding:0.5rem 1rem;min-width:auto;">
                ← Prev
            </button>
            <div style="flex:1;text-align:center;">
                <strong id="week-label">Loading week...</strong>
            </div>
            <button class="btn btn-secondary" onclick="navigateWeek(1)" style="padding:0.5rem 1rem;min-width:auto;">
                Next →
            </button>
            <button class="btn btn-secondary" onclick="goToCurrentWeek()" style="padding:0.5rem 1rem;min-width:auto;font-size:var(--text-sm);">
                Today
            </button>
        </div>

        <!-- Quick Mark Today Button -->
        <div style="margin-bottom:var(--space-lg);">
            <button class="btn btn-primary" onclick="openMarkTodayModal()" style="width:100%;">
                ✅ Mark Today's Attendance (${window.dailyAttendance.formatDateDisplay(today)})
            </button>
        </div>

        <!-- Register Grid Container -->
        <div id="daily-register-grid" style="overflow-x:auto;">
            <p style="text-align:center;color:var(--color-gray-500);padding:var(--space-xl);">Select a week to view register...</p>
        </div>

        <!-- Weekly Summary -->
        <div id="weekly-summary-panel" style="display:none;margin-top:var(--space-xl);"></div>

        <!-- Print Button -->
        <div style="margin-top:var(--space-lg);display:flex;gap:var(--space-md);">
            <button class="btn btn-secondary" onclick="printAttendanceRegister()" style="flex:1;">
                🖨️ Print Register
            </button>
        </div>

        <!-- Mark Day Modal -->
        <div id="mark-day-modal" style="display:none;
            position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:1000;
            align-items:center;justify-content:center;padding:var(--space-lg);">
            <div style="background:white;border-radius:var(--radius-xl);
                max-width:600px;width:100%;max-height:90vh;overflow-y:auto;padding:var(--space-xl);">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-lg);">
                    <h3 style="margin:0;" id="mark-modal-title">Mark Attendance</h3>
                    <button onclick="closeMarkDayModal()" style="background:none;border:none;font-size:1.5rem;cursor:pointer;">✕</button>
                </div>
                <div id="mark-modal-body"></div>
            </div>
        </div>
    `;
}

/* ══════════════════════════════════════════
   WEEK NAVIGATION STATE
══════════════════════════════════════════ */
let currentWeekMonday = null;

async function loadDailyRegisterPanel(term) {
    currentWeekMonday = window.dailyAttendance.getMondayOfWeek(new Date());
    await renderWeekRegister(term);
}

function switchAttendanceTab(tabName) {
    document.querySelectorAll('.attendance-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.attendance-tab-panel').forEach(p => p.style.display = 'none');

    document.querySelector(`.attendance-tab[data-tab="${tabName}"]`)?.classList.add('active');
    document.getElementById(`attendance-tab-${tabName}`).style.display = 'block';
}

async function navigateWeek(direction) {
    if (!currentWeekMonday) return;
    const d = new Date(currentWeekMonday);
    d.setDate(d.getDate() + (direction * 7));
    currentWeekMonday = d;
    const term = document.getElementById('attendance-term')?.value || 'First Term';
    await renderWeekRegister(term);
}

async function goToCurrentWeek() {
    currentWeekMonday = window.dailyAttendance.getMondayOfWeek(new Date());
    const term = document.getElementById('attendance-term')?.value || 'First Term';
    await renderWeekRegister(term);
}

/* ══════════════════════════════════════════
   REGISTER GRID RENDERER
══════════════════════════════════════════ */

async function renderWeekRegister(term) {
    const grid = document.getElementById('daily-register-grid');
    const weekLabel = document.getElementById('week-label');
    if (!grid || !currentWeekMonday) return;

    const weekDates = window.dailyAttendance.getWeekDates(currentWeekMonday);
    const startDate = weekDates[0];
    const endDate = weekDates[4];

    // Update week label
    if (weekLabel) {
        const startDisplay = window.dailyAttendance.formatDateDisplay(startDate);
        const endDisplay = window.dailyAttendance.formatDateDisplay(endDate);
        weekLabel.textContent = `Week: ${startDisplay} – ${endDisplay}`;
    }

    grid.innerHTML = `<p style="text-align:center;padding:var(--space-lg);">Loading...</p>`;

    try {
        const classId = window.assignedClasses?.[0]?.id;
        if (!classId) { grid.innerHTML = '<p>No class assigned.</p>'; return; }

        const settings = await window.getCurrentSettings();
        const session = settings.session;

        const { dates, dailyRecords } = await window.dailyAttendance.fetchGrid(
            classId, term, session, startDate, endDate
        );

        const pupils = window.allPupils || [];
        const summary = window.dailyAttendance.weeklySummary(weekDates, dailyRecords, pupils);

        grid.innerHTML = renderRegisterTable(pupils, weekDates, dailyRecords, summary);
        renderWeeklySummaryPanel(summary, weekDates);

    } catch (err) {
        console.error('Error rendering week register:', err);
        grid.innerHTML = `<p style="color:var(--color-danger);text-align:center;">Error loading register: ${err.message}</p>`;
    }
}

function renderRegisterTable(pupils, weekDates, dailyRecords, summary) {
    const today = window.dailyAttendance.getTodayISO();

    let html = `
    <table class="attendance-register-table" style="
        width:100%;border-collapse:collapse;font-size:0.875rem;
        border:2px solid #1565c0;
    ">
    <thead>
        <tr style="background:#1565c0;color:white;">
            <th style="padding:8px 12px;text-align:left;position:sticky;left:0;z-index:2;background:#1565c0;min-width:150px;">Pupil Name</th>
            <th style="padding:8px 6px;text-align:left;min-width:60px;position:sticky;left:150px;background:#1565c0;">Gen</th>
    `;

    weekDates.forEach(date => {
        const isToday = date === today;
        const hasRecord = !!dailyRecords[date];
        const dayDisplay = window.dailyAttendance.formatDateDisplay(date);
        const dayStyle = isToday ? 'background:#0d47a1;outline:2px solid #ffeb3b;' : 'background:#1565c0;';
        html += `<th style="padding:6px 4px;text-align:center;min-width:80px;${dayStyle}">
            ${dayDisplay}${hasRecord ? ' ✓' : ''}
            ${isToday ? '<br><small>(Today)</small>' : ''}
        </th>`;
    });

    html += `
        <th style="padding:8px 6px;text-align:center;background:#0d47a1;">Days<br>Present</th>
        <th style="padding:8px 6px;text-align:center;background:#0d47a1;">Days<br>Absent</th>
        <th style="padding:8px 6px;text-align:center;background:#0d47a1;">%</th>
        </tr>
    </thead>
    <tbody>
    `;

    pupils.forEach((pupil, idx) => {
        const rowBg = idx % 2 === 0 ? '#f8faff' : 'white';
        let weekPresent = 0, weekAbsent = 0;

        html += `<tr style="background:${rowBg};">
            <td style="padding:7px 12px;font-weight:500;border-bottom:1px solid #dbeafe;
                position:sticky;left:0;z-index:1;background:${rowBg};">${pupil.name}</td>
            <td style="padding:7px 6px;border-bottom:1px solid #dbeafe;text-align:center;
                position:sticky;left:150px;background:${rowBg};">${(pupil.gender || '-').charAt(0).toUpperCase()}</td>
        `;

        weekDates.forEach(date => {
            const record = dailyRecords[date];
            const status = record?.records?.[pupil.id];

            let cellContent = '-';
            let cellStyle = 'background:#f3f4f6;';

            if (status === 'present') {
                cellContent = '✓';
                cellStyle = 'background:#dcfce7;color:#15803d;font-weight:bold;';
                weekPresent++;
            } else if (status === 'absent') {
                cellContent = '✗';
                cellStyle = 'background:#fee2e2;color:#dc2626;font-weight:bold;';
                weekAbsent++;
            }

            // Make cell clickable if record exists
            const clickHandler = record
                ? `onclick="togglePupilStatusInDay('${pupil.id}', '${date}', '${status || 'absent'}')" style="cursor:pointer;"`
                : '';

            html += `<td ${clickHandler} style="padding:6px 4px;text-align:center;border-bottom:1px solid #dbeafe;
                border-left:1px solid #bfdbfe;${cellStyle}">${cellContent}</td>`;
        });

        const pct = (weekPresent + weekAbsent) > 0
            ? Math.round((weekPresent / (weekPresent + weekAbsent)) * 100)
            : '-';
        const pctColor = typeof pct === 'number' ? (pct >= 75 ? '#15803d' : pct >= 50 ? '#d97706' : '#dc2626') : '#9ca3af';

        html += `
            <td style="padding:7px 6px;text-align:center;border-bottom:1px solid #dbeafe;font-weight:600;">${weekPresent}</td>
            <td style="padding:7px 6px;text-align:center;border-bottom:1px solid #dbeafe;font-weight:600;">${weekAbsent}</td>
            <td style="padding:7px 6px;text-align:center;border-bottom:1px solid #dbeafe;font-weight:600;color:${pctColor};">${pct}${typeof pct === 'number' ? '%' : ''}</td>
        </tr>`;
    });

    // Totals row
    html += `<tr style="background:#dbeafe;font-weight:700;">
        <td style="padding:8px 12px;border-top:2px solid #1565c0;position:sticky;left:0;background:#dbeafe;" colspan="2">TOTALS</td>`;

    weekDates.forEach(date => {
        const record = dailyRecords[date];
        const present = record?.totalPresent ?? '-';
        const total = record?.totalPupils ?? '';
        html += `<td style="padding:6px 4px;text-align:center;border-top:2px solid #1565c0;border-left:1px solid #93c5fd;">
            ${record ? `${present}/${total}` : '-'}
        </td>`;
    });

    html += `<td colspan="3" style="padding:8px;text-align:center;border-top:2px solid #1565c0;font-size:var(--text-xs);color:#1e40af;">
        Week summary below ↓</td></tr>`;

    html += '</tbody></table>';

    return `<div style="overflow-x:auto;">${html}</div>`;
}

function renderWeeklySummaryPanel(summary, weekDates) {
    const panel = document.getElementById('weekly-summary-panel');
    if (!panel) return;

    const markedDays = weekDates.filter(d => summary.dailyStats[d]);
    if (markedDays.length === 0) {
        panel.style.display = 'none';
        return;
    }

    let html = `
    <div style="padding:var(--space-lg);background:#f0f9ff;border:1px solid #bae6fd;border-radius:var(--radius-lg);">
        <h4 style="margin:0 0 var(--space-md);">📊 Weekly Summary</h4>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:var(--space-md);margin-bottom:var(--space-lg);">
    `;

    markedDays.forEach(date => {
        const stats = summary.dailyStats[date];
        html += `
        <div style="background:white;padding:var(--space-md);border-radius:var(--radius-md);border:1px solid #bae6fd;text-align:center;">
            <div style="font-size:var(--text-xs);color:#0369a1;font-weight:600;">${window.dailyAttendance.formatDateDisplay(date)}</div>
            <div style="font-size:1.25rem;font-weight:700;color:#0c4a6e;">${stats.present}/${stats.total}</div>
            <div style="font-size:var(--text-xs);color:#0369a1;">${stats.percentage}% present</div>
        </div>`;
    });

    html += `</div>`;

    // Boys/Girls breakdown (aggregate)
    let totalBoyPresent = 0, totalGirlPresent = 0;
    markedDays.forEach(date => {
        const record = summary; // we need the raw dailyRecords
    });

    html += `<p style="margin:0;font-size:var(--text-sm);color:#0369a1;">
        Days marked this week: <strong>${markedDays.length}</strong>
    </p></div>`;

    panel.innerHTML = html;
    panel.style.display = 'block';
}

/* ══════════════════════════════════════════
   MARK TODAY MODAL
══════════════════════════════════════════ */

let _modalDate = null;

async function openMarkTodayModal(dateOverride) {
    _modalDate = dateOverride || window.dailyAttendance.getTodayISO();
    const term = document.getElementById('attendance-term')?.value || 'First Term';
    const classId = window.assignedClasses?.[0]?.id;
    const pupils = window.allPupils || [];

    if (!classId) { window.showToast?.('No class assigned', 'warning'); return; }

    const modal = document.getElementById('mark-day-modal');
    const title = document.getElementById('mark-modal-title');
    const body = document.getElementById('mark-modal-body');

    if (!modal || !title || !body) return;

    title.textContent = `Mark Attendance — ${window.dailyAttendance.formatDateDisplay(_modalDate)}`;
    body.innerHTML = `<p style="text-align:center;padding:var(--space-lg);">Loading...</p>`;
    modal.style.display = 'flex';

    try {
        // Load existing record for this date (if any)
        const docId = `${classId}_${_modalDate}`;
        const snap = await db.collection('daily_attendance').doc(docId).get();
        const existingRecords = snap.exists ? snap.data().records : {};

        // Date picker for non-today marking
        let html = `
        <div style="margin-bottom:var(--space-lg);">
            <label style="font-size:var(--text-sm);font-weight:600;display:block;margin-bottom:var(--space-xs);">
                Date
            </label>
            <input type="date" id="modal-attendance-date" value="${_modalDate}"
                style="width:100%;padding:0.5rem;border:1px solid #d1d5db;border-radius:var(--radius-md);"
                onchange="_modalDate=this.value">
        </div>

        <div style="display:flex;gap:var(--space-md);margin-bottom:var(--space-lg);">
            <button class="btn btn-secondary" onclick="markAllModalPupils('present')" style="flex:1;padding:0.5rem;">
                ✓ Mark All Present
            </button>
            <button class="btn btn-secondary" onclick="markAllModalPupils('absent')" style="flex:1;padding:0.5rem;">
                ✗ Mark All Absent
            </button>
        </div>

        <div style="max-height:50vh;overflow-y:auto;">
        <table style="width:100%;border-collapse:collapse;">
        <thead><tr style="background:#f1f5f9;">
            <th style="padding:8px;text-align:left;font-size:0.8rem;">Name</th>
            <th style="padding:8px;text-align:center;font-size:0.8rem;color:#15803d;">Present</th>
            <th style="padding:8px;text-align:center;font-size:0.8rem;color:#dc2626;">Absent</th>
        </tr></thead>
        <tbody>
        `;

        pupils.forEach((pupil, idx) => {
            const status = existingRecords[pupil.id] || 'present'; // default present
            const rowBg = idx % 2 === 0 ? '#f8fafc' : 'white';
            html += `
            <tr style="background:${rowBg};">
                <td style="padding:8px;font-size:0.875rem;">${pupil.name}</td>
                <td style="padding:8px;text-align:center;">
                    <input type="radio" name="status_${pupil.id}" value="present"
                        data-pupil="${pupil.id}"
                        ${status === 'present' ? 'checked' : ''}>
                </td>
                <td style="padding:8px;text-align:center;">
                    <input type="radio" name="status_${pupil.id}" value="absent"
                        data-pupil="${pupil.id}"
                        ${status === 'absent' ? 'checked' : ''}>
                </td>
            </tr>`;
        });

        html += `</tbody></table></div>

        <div style="margin-top:var(--space-lg);display:flex;gap:var(--space-md);">
            <button class="btn" onclick="saveModalAttendance()" style="flex:2;">
                💾 Save Attendance
            </button>
            <button class="btn btn-secondary" onclick="closeMarkDayModal()" style="flex:1;">
                Cancel
            </button>
        </div>`;

        body.innerHTML = html;

    } catch (err) {
        body.innerHTML = `<p style="color:var(--color-danger);">Error: ${err.message}</p>`;
    }
}

function closeMarkDayModal() {
    const modal = document.getElementById('mark-day-modal');
    if (modal) modal.style.display = 'none';
}

function markAllModalPupils(status) {
    const pupils = window.allPupils || [];
    pupils.forEach(pupil => {
        const radio = document.querySelector(`input[name="status_${pupil.id}"][value="${status}"]`);
        if (radio) radio.checked = true;
    });
}

async function saveModalAttendance() {
    const term = document.getElementById('attendance-term')?.value || 'First Term';
    const dateInput = document.getElementById('modal-attendance-date');
    const date = dateInput?.value || _modalDate;

    if (!date) { window.showToast?.('No date selected', 'warning'); return; }

    const classId = window.assignedClasses?.[0]?.id;
    const pupils = window.allPupils || [];
    const teacherId = window.currentUser?.uid;

    if (!classId || !teacherId) { window.showToast?.('Missing class or user info', 'danger'); return; }

    // Collect radio values
    const records = {};
    pupils.forEach(pupil => {
        const checked = document.querySelector(`input[name="status_${pupil.id}"]:checked`);
        records[pupil.id] = checked ? checked.value : 'absent';
    });

    try {
        const settings = await window.getCurrentSettings();
        const session = settings.session;

        const saveBtn = document.querySelector('#mark-modal-body .btn');
        if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving...'; }

        await window.dailyAttendance.mark(classId, date, term, session, teacherId, records, pupils);

        window.showToast?.(`✓ Attendance saved for ${window.dailyAttendance.formatDateDisplay(date)}`, 'success');
        closeMarkDayModal();

        // Refresh the week grid
        await renderWeekRegister(term);

    } catch (err) {
        console.error('Error saving daily attendance:', err);
        window.showToast?.(`Failed to save: ${err.message}`, 'danger');
    }
}

async function togglePupilStatusInDay(pupilId, date, currentStatus) {
    const newStatus = currentStatus === 'present' ? 'absent' : 'present';
    const term = document.getElementById('attendance-term')?.value || 'First Term';
    const classId = window.assignedClasses?.[0]?.id;
    const teacherId = window.currentUser?.uid;
    const pupils = window.allPupils || [];

    if (!classId || !teacherId) return;

    try {
        const settings = await window.getCurrentSettings();
        const session = settings.session;
        const pupilName = pupils.find(p => p.id === pupilId)?.name || 'pupil';

        await window.dailyAttendance.updatePupil(classId, date, term, session, teacherId, pupilId, newStatus, pupils);
        window.showToast?.(`✓ ${pupilName} marked ${newStatus} on ${window.dailyAttendance.formatDateDisplay(date)}`, 'success', 3000);
        await renderWeekRegister(term);
    } catch (err) {
        window.showToast?.(`Error: ${err.message}`, 'danger');
    }
}

/* ══════════════════════════════════════════
   LEGACY MANUAL PANEL
══════════════════════════════════════════ */

async function loadManualAttendanceLegacy(term, outerContainer) {
    const container = document.getElementById('manual-attendance-container');
    if (!container) return;

    const pupils = window.allPupils || [];
    if (pupils.length === 0) {
        container.innerHTML = '<p>No pupils.</p>';
        return;
    }

    try {
        const attendanceMap = {};
        for (const pupil of pupils) {
            const docId = `${pupil.id}_${term}`;
            const doc = await db.collection('attendance').doc(docId).get();
            if (doc.exists) attendanceMap[pupil.id] = doc.data();
        }

        container.innerHTML = `
        <div class="table-container">
            <table class="responsive-table" id="manual-attendance-table">
                <thead>
                    <tr>
                        <th>Pupil Name</th>
                        <th>Times School Opened</th>
                        <th>Times Present</th>
                        <th>Times Absent</th>
                    </tr>
                </thead>
                <tbody></tbody>
            </table>
        </div>
        <button class="btn" onclick="saveAllAttendanceManual('${term}')" style="width:100%;margin-top:var(--space-lg);">
            💾 Save Manual Totals
        </button>`;

        // Use the existing paginateTable if available
        if (typeof window.paginateTable === 'function') {
            window.paginateTable(pupils, 'manual-attendance-table', 25, (pupil, tbody) => {
                const existing = attendanceMap[pupil.id] || {};
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td data-label="Pupil Name">${pupil.name}</td>
                    <td data-label="Times School Opened">
                        <input type="number" min="0" value="${existing.timesOpened || ''}"
                            data-pupil="${pupil.id}" data-field="timesOpened"
                            style="width:100%;max-width:100px;" placeholder="0">
                    </td>
                    <td data-label="Times Present">
                        <input type="number" min="0" value="${existing.timesPresent || ''}"
                            data-pupil="${pupil.id}" data-field="timesPresent"
                            style="width:100%;max-width:100px;" placeholder="0">
                    </td>
                    <td data-label="Times Absent">
                        <input type="number" min="0" value="${existing.timesAbsent || ''}"
                            data-pupil="${pupil.id}" data-field="timesAbsent"
                            style="width:100%;max-width:100px;" placeholder="0">
                    </td>`;
                tbody.appendChild(tr);
            });
        }

    } catch (err) {
        container.innerHTML = `<p style="color:var(--color-danger);">Error: ${err.message}</p>`;
    }
}

// Wrap the existing saveAllAttendance to work with the manual panel
async function saveAllAttendanceManual(term) {
    // Call the original save function — it queries #attendance-form-container inputs
    // We route it to the manual container inputs
    const inputs = document.querySelectorAll('#manual-attendance-container input[type="number"]');
    if (!inputs.length || !term) {
        window.showToast?.('No data to save', 'warning');
        return;
    }

    // Reuse validation + save logic from existing saveAllAttendance
    // (identical logic, just sourced from different container)
    await window._saveAttendanceFromInputs(inputs, term);
}

/* ══════════════════════════════════════════
   PRINT REGISTER
══════════════════════════════════════════ */

async function printAttendanceRegister() {
    const term = document.getElementById('attendance-term')?.value || 'First Term';
    const classId = window.assignedClasses?.[0]?.id;
    const className = window.assignedClasses?.[0]?.name || 'Unknown Class';
    const pupils = window.allPupils || [];

    if (!classId) { window.showToast?.('No class assigned', 'warning'); return; }

    window.showToast?.('Preparing print register...', 'info', 3000);

    try {
        const settings = await window.getCurrentSettings();
        const session = settings.session;

        // Fetch ALL daily records for this term
        const snap = await db.collection('daily_attendance')
            .where('classId', '==', classId)
            .where('term', '==', term)
            .where('session', '==', session)
            .orderBy('date', 'asc')
            .get();

        const dailyRecords = {};
        snap.forEach(doc => {
            dailyRecords[doc.data().date] = doc.data();
        });

        const allDates = Object.keys(dailyRecords).sort();
        const printHTML = generatePrintRegisterHTML(className, term, session, pupils, allDates, dailyRecords);

        const printWindow = window.open('', '_blank', 'width=1200,height=800');
        if (!printWindow) {
            window.showToast?.('Popup blocked. Please allow popups and try again.', 'warning');
            return;
        }
        printWindow.document.write(printHTML);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => printWindow.print(), 800);

    } catch (err) {
        console.error('Print error:', err);
        window.showToast?.(`Print failed: ${err.message}`, 'danger');
    }
}

function generatePrintRegisterHTML(className, term, session, pupils, allDates, dailyRecords) {
    const today = new Date().toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' });

    // Group dates by week
    const weeks = [];
    let currentWeek = [];
    allDates.forEach((date, i) => {
        currentWeek.push(date);
        if (currentWeek.length === 5 || i === allDates.length - 1) {
            weeks.push([...currentWeek]);
            currentWeek = [];
        }
    });

    // Build attendance rows
    const pupilRows = pupils.map(pupil => {
        let totalPresent = 0, totalAbsent = 0;
        const cells = allDates.map(date => {
            const status = dailyRecords[date]?.records?.[pupil.id];
            if (status === 'present') { totalPresent++; return { status: 'P', cls: 'p-cell' }; }
            if (status === 'absent') { totalAbsent++; return { status: 'A', cls: 'a-cell' }; }
            return { status: '', cls: '' };
        });
        const pct = (totalPresent + totalAbsent) > 0
            ? Math.round((totalPresent / (totalPresent + totalAbsent)) * 100) + '%'
            : '-';
        return { pupil, cells, totalPresent, totalAbsent, pct };
    });

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Attendance Register — ${className} — ${term} ${session}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 9pt; color: #000; background: white; }

  @page {
    size: A3 landscape;
    margin: 10mm 8mm;
  }

  .page-header {
    text-align: center;
    border: 2px solid #1565c0;
    padding: 8px;
    margin-bottom: 8px;
    background: #e3f2fd;
  }

  .page-header h1 { font-size: 14pt; color: #1565c0; }
  .page-header h2 { font-size: 11pt; }
  .page-header p { font-size: 9pt; margin-top: 4px; }

  .info-row {
    display: flex;
    justify-content: space-between;
    margin-bottom: 6px;
    font-size: 9pt;
    border-bottom: 1px solid #1565c0;
    padding-bottom: 4px;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 8pt;
  }

  th, td {
    border: 1px solid #1565c0;
    padding: 3px 4px;
    text-align: center;
    white-space: nowrap;
  }

  th { background: #1565c0; color: white; font-weight: 600; }

  .name-col { text-align: left !important; min-width: 120px; max-width: 150px; }
  .gen-col { width: 24px; }
  .date-col { width: 30px; font-size: 7pt; }
  .total-col { font-weight: 700; background: #e3f2fd; }

  .p-cell { background: #dcfce7; color: #15803d; font-weight: 700; }
  .a-cell { background: #fee2e2; color: #dc2626; font-weight: 700; }

  tr:nth-child(even) td:not(.p-cell):not(.a-cell) { background: #f8faff; }

  .totals-row td { background: #dbeafe !important; font-weight: 700; }

  .week-header th { background: #0d47a1; font-size: 7pt; }

  .summary-section {
    margin-top: 12px;
    border: 1px solid #1565c0;
    padding: 8px;
  }

  .summary-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 6px;
    margin-top: 8px;
  }

  .summary-day {
    border: 1px solid #90caf9;
    padding: 4px;
    text-align: center;
    background: #f0f9ff;
    font-size: 8pt;
  }

  .signatures {
    margin-top: 20px;
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 20px;
  }

  .sig-box {
    border-top: 1px solid #000;
    padding-top: 4px;
    font-size: 8pt;
    text-align: center;
    margin-top: 20px;
  }

  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>

<div class="page-header">
    <h1>FAHMID NURSERY &amp; PRIMARY SCHOOL</h1>
    <h2>CLASS ATTENDANCE REGISTER</h2>
    <p>Class: <strong>${className}</strong> &nbsp;|&nbsp;
       Term: <strong>${term}</strong> &nbsp;|&nbsp;
       Session: <strong>${session}</strong> &nbsp;|&nbsp;
       Printed: ${today}</p>
</div>

<div class="info-row">
    <span>Total Pupils: <strong>${pupils.length}</strong></span>
    <span>Total Days Marked: <strong>${allDates.length}</strong></span>
    <span>Boys: <strong>${pupils.filter(p => p.gender?.toLowerCase() === 'male' || p.gender?.toLowerCase() === 'm').length}</strong></span>
    <span>Girls: <strong>${pupils.filter(p => p.gender?.toLowerCase() !== 'male' && p.gender?.toLowerCase() !== 'm').length}</strong></span>
</div>

<table>
    <thead>
        <tr>
            <th class="name-col">Pupil Name</th>
            <th class="gen-col">G</th>
            ${allDates.map(date => {
                const d = new Date(date + 'T12:00:00');
                const dayName = d.toLocaleDateString('en-GB', { weekday: 'narrow' });
                const dayNum = d.getDate();
                const mon = d.toLocaleDateString('en-GB', { month: 'short' });
                return `<th class="date-col">${dayName}<br>${dayNum}<br>${mon}</th>`;
            }).join('')}
            <th class="total-col">Pres</th>
            <th class="total-col">Abs</th>
            <th class="total-col">%</th>
        </tr>
    </thead>
    <tbody>
    ${pupilRows.map((row, idx) => {
        const isBoy = row.pupil.gender?.toLowerCase() === 'male' || row.pupil.gender?.toLowerCase() === 'm';
        return `<tr>
            <td class="name-col">${row.pupil.name}</td>
            <td class="gen-col">${isBoy ? 'M' : 'F'}</td>
            ${row.cells.map(cell => `<td class="${cell.cls}">${cell.status}</td>`).join('')}
            <td class="total-col">${row.totalPresent}</td>
            <td class="total-col">${row.totalAbsent}</td>
            <td class="total-col">${row.pct}</td>
        </tr>`;
    }).join('')}
    <tr class="totals-row">
        <td class="name-col" colspan="2"><strong>DAILY TOTAL PRESENT</strong></td>
        ${allDates.map(date => {
            const rec = dailyRecords[date];
            return `<td>${rec?.totalPresent ?? '-'}</td>`;
        }).join('')}
        <td></td><td></td><td></td>
    </tr>
    <tr class="totals-row">
        <td class="name-col" colspan="2"><strong>DAILY TOTAL ABSENT</strong></td>
        ${allDates.map(date => {
            const rec = dailyRecords[date];
            return `<td>${rec?.totalAbsent ?? '-'}</td>`;
        }).join('')}
        <td></td><td></td><td></td>
    </tr>
    <tr class="totals-row">
        <td class="name-col" colspan="2"><strong>% ATTENDANCE</strong></td>
        ${allDates.map(date => {
            const rec = dailyRecords[date];
            if (!rec) return `<td>-</td>`;
            const pct = rec.totalPupils > 0
                ? Math.round((rec.totalPresent / rec.totalPupils) * 100)
                : '-';
            return `<td>${pct}${typeof pct === 'number' ? '%' : ''}</td>`;
        }).join('')}
        <td></td><td></td><td></td>
    </tr>
    </tbody>
</table>

<!-- Weekly Summary -->
<div class="summary-section">
    <strong>WEEKLY ATTENDANCE SUMMARY</strong>
    <table style="margin-top:6px;font-size:8pt;" cellspacing="0">
        <thead>
            <tr>
                <th>Week</th>
                <th>Days</th>
                <th>Boys Present</th>
                <th>Girls Present</th>
                <th>Total Present</th>
                <th>Total Absent</th>
                <th>Avg % Present</th>
            </tr>
        </thead>
        <tbody>
        ${weeks.map((weekDates, wi) => {
            let boyPresent = 0, girlPresent = 0, totalAbsent = 0;
            weekDates.forEach(date => {
                const rec = dailyRecords[date];
                if (rec) {
                    boyPresent += rec.boyPresent || 0;
                    girlPresent += rec.girlPresent || 0;
                    totalAbsent += rec.totalAbsent || 0;
                }
            });
            const totalPresent = boyPresent + girlPresent;
            const totalPossible = (boyPresent + girlPresent + totalAbsent);
            const pct = totalPossible > 0 ? Math.round((totalPresent / totalPossible) * 100) + '%' : '-';
            const startD = new Date(weekDates[0] + 'T12:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
            return `<tr>
                <td>Wk ${wi + 1} (${startD})</td>
                <td>${weekDates.length}</td>
                <td>${boyPresent}</td>
                <td>${girlPresent}</td>
                <td>${totalPresent}</td>
                <td>${totalAbsent}</td>
                <td>${pct}</td>
            </tr>`;
        }).join('')}
        </tbody>
    </table>
</div>

<!-- Signature Lines -->
<div class="signatures">
    <div class="sig-box">
        _____________________________<br>
        Class Teacher's Signature &amp; Date
    </div>
    <div class="sig-box">
        _____________________________<br>
        Head Teacher's Signature &amp; Date
    </div>
    <div class="sig-box">
        _____________________________<br>
        School Stamp
    </div>
</div>

<p style="margin-top:8px;font-size:7pt;text-align:center;color:#666;">
    Key: P = Present &nbsp;|&nbsp; A = Absent &nbsp;|&nbsp; - = Not marked<br>
    This register is a legal school document. Handle with care.
</p>

</body>
</html>`;
}

/* ══════════════════════════════════════════
   INSTALL ENHANCED SECTION
══════════════════════════════════════════ */

// Make all functions globally available
window.loadAttendanceSectionEnhanced = loadAttendanceSectionEnhanced;
window.switchAttendanceTab = switchAttendanceTab;
window.navigateWeek = navigateWeek;
window.goToCurrentWeek = goToCurrentWeek;
window.openMarkTodayModal = openMarkTodayModal;
window.closeMarkDayModal = closeMarkDayModal;
window.markAllModalPupils = markAllModalPupils;
window.saveModalAttendance = saveModalAttendance;
window.togglePupilStatusInDay = togglePupilStatusInDay;
window.printAttendanceRegister = printAttendanceRegister;
window.saveAllAttendanceManual = saveAllAttendanceManual;

// FIXED: Retry loop — keeps trying until teacher.js finishes its async init
// and sectionLoaders is available on window
function installEnhancedAttendance() {
    if (window.sectionLoaders) {
        window.sectionLoaders['attendance'] = loadAttendanceSectionEnhanced;
        console.log('✓ Enhanced attendance UI installed into sectionLoaders');
    } else {
        console.log('⏳ Waiting for sectionLoaders...');
        setTimeout(installEnhancedAttendance, 100);
    }
}

installEnhancedAttendance();

console.log('✓ attendance-teacher-ui.js loaded (v1.0.0)');