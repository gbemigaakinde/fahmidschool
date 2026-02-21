/**
 * FAHMID NURSERY & PRIMARY SCHOOL
 * Daily Attendance Module - attendance-daily.js
 *
 * PURPOSE:
 * - Adds digital daily attendance marking ON TOP of existing system
 * - Existing attendance/{pupilId}_{term} documents are PRESERVED
 * - Daily records stored in daily_attendance/{classId}_{date}
 * - Cumulative totals auto-updated in existing attendance collection
 *
 * @version 1.0.0
 * @requires firebase-init.js (db, auth)
 */

'use strict';

/* ══════════════════════════════════════════
   DAILY ATTENDANCE DATA LAYER
══════════════════════════════════════════ */

/**
 * Mark daily attendance for an entire class.
 * GUARANTEES: no duplicate entry per class per day.
 *
 * @param {string} classId
 * @param {string} date - YYYY-MM-DD
 * @param {string} term
 * @param {string} session
 * @param {string} teacherId
 * @param {Object} records - { pupilId: 'present'|'absent', ... }
 * @param {Array}  pupils  - full pupil objects [{ id, name, gender }]
 */
async function markDailyAttendance(classId, date, term, session, teacherId, records, pupils) {
    if (!classId || !date || !term || !session || !teacherId) {
        throw new Error('markDailyAttendance: missing required parameters');
    }

    if (!records || typeof records !== 'object' || Object.keys(records).length === 0) {
        throw new Error('markDailyAttendance: records object is empty or invalid');
    }

    const docId = `${classId}_${date}`;

    let totalPresent = 0, totalAbsent = 0;
    let boyPresent = 0, girlPresent = 0;
    let boyAbsent = 0, girlAbsent = 0;

    const pupilMap = {};
    (pupils || []).forEach(p => { if (p && p.id) pupilMap[p.id] = p; });

    Object.entries(records).forEach(([pupilId, status]) => {
        const pupil = pupilMap[pupilId];
        const isBoy = pupil?.gender?.toLowerCase() === 'male' || pupil?.gender?.toLowerCase() === 'm';

        if (status === 'present') {
            totalPresent++;
            if (isBoy) boyPresent++; else girlPresent++;
        } else {
            totalAbsent++;
            if (isBoy) boyAbsent++; else girlAbsent++;
        }
    });

    const docData = {
        classId,
        date,
        term,
        session,
        teacherId,
        records,
        totalPresent,
        totalAbsent,
        totalPupils: Object.keys(records).length,
        boyPresent,
        girlPresent,
        boyAbsent,
        girlAbsent,
        markedAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
        await db.collection('daily_attendance').doc(docId).set(docData, { merge: false });
    } catch (writeErr) {
        console.error('markDailyAttendance: failed to write daily record:', writeErr);
        throw new Error(`Failed to save daily attendance: ${writeErr.message}`);
    }

    // Recalculate cumulative totals — failure here is surfaced to caller
    try {
        await recalculateCumulativeTotals(classId, term, session, teacherId, pupils);
    } catch (calcErr) {
        console.error('markDailyAttendance: daily record saved but cumulative recalculation failed:', calcErr);
        // Re-throw so the UI can inform the teacher
        throw new Error(`Attendance marked for today but summary totals failed to update: ${calcErr.message}`);
    }

    console.log(`✓ Daily attendance marked: ${docId} (${totalPresent} present, ${totalAbsent} absent)`);
}

/**
 * Update a single pupil's status for a specific day.
 * Triggers full recalculation to keep cumulative totals consistent.
 */
async function updatePupilAttendanceForDay(classId, date, term, session, teacherId, pupilId, newStatus, pupils) {
    const docId = `${classId}_${date}`;
    const docRef = db.collection('daily_attendance').doc(docId);
    const snap = await docRef.get();

    if (!snap.exists) {
        throw new Error(`No attendance record found for ${docId}`);
    }

    const existing = snap.data();
    const updatedRecords = { ...existing.records, [pupilId]: newStatus };

    // Recompute stats
    const pupilMap = {};
    pupils.forEach(p => { pupilMap[p.id] = p; });

    let totalPresent = 0, totalAbsent = 0;
    let boyPresent = 0, girlPresent = 0;
    let boyAbsent = 0, girlAbsent = 0;

    Object.entries(updatedRecords).forEach(([pid, status]) => {
        const pupil = pupilMap[pid];
        const isBoy = pupil?.gender?.toLowerCase() === 'male' || pupil?.gender?.toLowerCase() === 'm';
        if (status === 'present') {
            totalPresent++;
            if (isBoy) boyPresent++; else girlPresent++;
        } else {
            totalAbsent++;
            if (isBoy) boyAbsent++; else girlAbsent++;
        }
    });

    await docRef.update({
        records: updatedRecords,
        totalPresent,
        totalAbsent,
        boyPresent,
        girlPresent,
        boyAbsent,
        girlAbsent,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    // Recalculate cumulative
    await recalculateCumulativeTotals(classId, term, session, teacherId, pupils);
    console.log(`✓ Updated ${pupilId} to '${newStatus}' on ${date}`);
}

/**
 * Delete a day's attendance record and recalculate cumulative.
 */
async function deleteDailyAttendance(classId, date, term, session, teacherId, pupils) {
    const docId = `${classId}_${date}`;
    await db.collection('daily_attendance').doc(docId).delete();
    await recalculateCumulativeTotals(classId, term, session, teacherId, pupils);
    console.log(`✓ Deleted daily attendance for ${docId}`);
}

/**
 * CORE: Recalculate cumulative attendance from ALL daily records.
 * Updates the existing attendance/{pupilId}_{term} documents.
 *
 * timesOpened is derived from the school_calendar collection:
 *   = number of days that have a daily_attendance record
 *     AND are NOT marked as public_holiday / mid_term_break / special_break
 *
 * SAFETY: Never produces negative numbers. Falls back to raw day count
 *         if school_calendar is unavailable (preserves existing behaviour).
 *
 * @version 1.1.0 — calendar-aware timesOpened
 */
async function recalculateCumulativeTotals(classId, term, session, teacherId, pupils) {
    console.log(`Recalculating cumulative attendance: class=${classId}, term=${term}, session=${session}`);

    if (!classId || !term || !session) {
        console.error('recalculateCumulativeTotals: missing required parameters', { classId, term, session });
        throw new Error('recalculateCumulativeTotals: missing classId, term, or session');
    }

    if (!Array.isArray(pupils) || pupils.length === 0) {
        console.warn('recalculateCumulativeTotals: empty pupils array, skipping write');
        return { totalDays: 0, pupilCounts: {} };
    }

    // ── 1. Fetch all daily records for this class + term + session ───────────
    let snap;
    try {
        snap = await db.collection('daily_attendance')
            .where('classId', '==', classId)
            .where('term', '==', term)
            .where('session', '==', session)
            .get();
    } catch (queryErr) {
        console.error('recalculateCumulativeTotals: Firestore query failed:', queryErr);
        throw new Error(`Failed to fetch daily attendance records: ${queryErr.message}`);
    }

    // ── 2. Get non-school days from admin calendar ───────────────────────────
    let nonSchoolDays = new Set();
    try {
        if (window.schoolCalendar?.getNonSchoolDays) {
            nonSchoolDays = await window.schoolCalendar.getNonSchoolDays(session, term);
            console.log(`📅 Calendar: ${nonSchoolDays.size} non-school day(s) excluded for ${session} ${term}`);
        }
    } catch (calErr) {
        console.warn('⚠️ Could not load school calendar — falling back to raw day count:', calErr);
    }

    // ── 3. Count per pupil, excluding non-school days ────────────────────────
    const pupilCounts = {};
    pupils.forEach(p => {
        if (p && p.id) {
            pupilCounts[p.id] = { timesPresent: 0, timesAbsent: 0 };
        }
    });

    let totalSchoolDays = 0;

    snap.forEach(doc => {
        const data = doc.data();
        const date = data.date;

        if (!date) {
            console.warn('Daily attendance doc missing date field:', doc.id);
            return;
        }

        if (nonSchoolDays.has(date)) {
            console.log(`📅 Skipping non-school day in attendance calc: ${date}`);
            return;
        }

        totalSchoolDays++;

        if (data.records && typeof data.records === 'object') {
            Object.entries(data.records).forEach(([pupilId, status]) => {
                if (!pupilCounts[pupilId]) {
                    pupilCounts[pupilId] = { timesPresent: 0, timesAbsent: 0 };
                }
                if (status === 'present') {
                    pupilCounts[pupilId].timesPresent++;
                } else {
                    pupilCounts[pupilId].timesAbsent++;
                }
            });
        }
    });

    // ── 4. Batch-write cumulative totals to attendance collection ────────────
    let settings = { session };
    let sessionStartYear = null;
    let sessionEndYear = null;

    try {
        const loadedSettings = await window.getCurrentSettings?.();
        if (loadedSettings) {
            sessionStartYear = loadedSettings.currentSession?.startYear || null;
            sessionEndYear   = loadedSettings.currentSession?.endYear   || null;
        }
    } catch (settingsErr) {
        console.warn('recalculateCumulativeTotals: could not load settings, using defaults:', settingsErr);
    }

    const sessionTerm  = `${session}_${term}`;
    const batchSize    = 400;
    const pupilEntries = Object.entries(pupilCounts);

    for (let i = 0; i < pupilEntries.length; i += batchSize) {
        const batch = db.batch();
        const chunk = pupilEntries.slice(i, i + batchSize);

        chunk.forEach(([pupilId, counts]) => {
            const docId = `${pupilId}_${term}`;
            const ref   = db.collection('attendance').doc(docId);

            const timesPresent = Math.max(0, counts.timesPresent);
            const timesAbsent  = Math.max(0, counts.timesAbsent);
            const timesOpened  = totalSchoolDays;

            batch.set(ref, {
                pupilId,
                term,
                teacherId,
                session,
                sessionStartYear,
                sessionEndYear,
                sessionTerm,
                timesOpened,
                timesPresent,
                timesAbsent,
                derivedFromDailyRecords: true,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        });

        try {
            await batch.commit();
        } catch (batchErr) {
            console.error(`recalculateCumulativeTotals: batch commit failed (chunk ${i}):`, batchErr);
            throw new Error(`Failed to write cumulative attendance: ${batchErr.message}`);
        }
    }

    console.log(`✓ Recalculated cumulative for ${pupilEntries.length} pupils. School days: ${totalSchoolDays} (${snap.size - totalSchoolDays} non-school day(s) excluded)`);
    return { totalDays: totalSchoolDays, pupilCounts };
}

/**
 * Fetch attendance grid for a date range.
 * Returns: { dates: ['2026-01-05', ...], dailyRecords: { date: {...data} }, pupils: [...] }
 */
async function fetchAttendanceGrid(classId, term, session, startDate, endDate) {
    const snap = await db.collection('daily_attendance')
        .where('classId', '==', classId)
        .where('term', '==', term)
        .where('session', '==', session)
        .where('date', '>=', startDate)
        .where('date', '<=', endDate)
        .orderBy('date', 'asc')
        .get();

    const dailyRecords = {};
    snap.forEach(doc => {
        dailyRecords[doc.data().date] = doc.data();
    });

    const dates = Object.keys(dailyRecords).sort();
    return { dates, dailyRecords };
}

/**
 * Generate weekly summary statistics from daily records.
 */
function generateWeeklySummary(weekDates, dailyRecords, pupils) {
    const summary = {
        weekDates,
        totalDaysMarked: 0,
        dailyStats: {},
        pupilWeeklyStats: {}
    };

    const pupilMap = {};
    pupils.forEach(p => { pupilMap[p.id] = p; });

    weekDates.forEach(date => {
        const record = dailyRecords[date];
        if (!record) return;

        summary.totalDaysMarked++;
        summary.dailyStats[date] = {
            present: record.totalPresent || 0,
            absent: record.totalAbsent || 0,
            total: record.totalPupils || 0,
            percentage: record.totalPupils > 0
                ? Math.round((record.totalPresent / record.totalPupils) * 100)
                : 0
        };
    });

    pupils.forEach(pupil => {
        let present = 0, absent = 0;
        weekDates.forEach(date => {
            const record = dailyRecords[date];
            if (!record?.records) return;
            const status = record.records[pupil.id];
            if (status === 'present') present++;
            else if (status === 'absent') absent++;
        });
        summary.pupilWeeklyStats[pupil.id] = {
            name: pupil.name,
            present,
            absent,
            percentage: (present + absent) > 0
                ? Math.round((present / (present + absent)) * 100)
                : 0
        };
    });

    return summary;
}

/**
 * Check if a date already has attendance marked.
 */
async function hasAttendanceForDate(classId, date) {
    const docId = `${classId}_${date}`;
    const snap = await db.collection('daily_attendance').doc(docId).get();
    return snap.exists;
}

/**
 * Get all dates with attendance marked for a class + term.
 */
async function getMarkedDates(classId, term, session) {
    const snap = await db.collection('daily_attendance')
        .where('classId', '==', classId)
        .where('term', '==', term)
        .where('session', '==', session)
        .orderBy('date', 'asc')
        .get();

    return snap.docs.map(doc => doc.data().date);
}

/* ══════════════════════════════════════════
   DATE UTILITIES
══════════════════════════════════════════ */

function formatDateDisplay(dateStr) {
    // YYYY-MM-DD → "Mon 05 Jan"
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' });
}

function formatDateISO(date) {
    // Date object → YYYY-MM-DD
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function getWeekDates(startOfWeek) {
    // Returns Mon-Fri array from a Monday Date object
    const dates = [];
    for (let i = 0; i < 5; i++) {
        const d = new Date(startOfWeek);
        d.setDate(d.getDate() + i);
        dates.push(formatDateISO(d));
    }
    return dates;
}

function getMondayOfWeek(date) {
    const d = new Date(date);
    const day = d.getDay(); // 0=Sun, 1=Mon...
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    return d;
}

function getTodayISO() {
    return formatDateISO(new Date());
}

/* ══════════════════════════════════════════
   EXPORTS
══════════════════════════════════════════ */
window.dailyAttendance = {
    mark: markDailyAttendance,
    updatePupil: updatePupilAttendanceForDay,
    delete: deleteDailyAttendance,
    recalculate: recalculateCumulativeTotals,
    fetchGrid: fetchAttendanceGrid,
    weeklySummary: generateWeeklySummary,
    hasMarked: hasAttendanceForDate,
    getMarkedDates,
    // Utilities
    formatDateDisplay,
    formatDateISO,
    getWeekDates,
    getMondayOfWeek,
    getTodayISO
};

console.log('✓ Daily attendance module loaded (v1.0.0)');