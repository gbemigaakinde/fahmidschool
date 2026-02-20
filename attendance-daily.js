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

    const docId = `${classId}_${date}`;

    // Compute summary stats
    let totalPresent = 0, totalAbsent = 0;
    let boyPresent = 0, girlPresent = 0;
    let boyAbsent = 0, girlAbsent = 0;

    const pupilMap = {};
    pupils.forEach(p => { pupilMap[p.id] = p; });

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
        records,            // { pupilId: 'present'|'absent' }
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

    await db.collection('daily_attendance').doc(docId).set(docData, { merge: false });

    // After saving daily record, recalculate cumulative totals for all pupils
    await recalculateCumulativeTotals(classId, term, session, teacherId, pupils);

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
 * This is the SINGLE SOURCE OF TRUTH calculation.
 *
 * SAFETY: Never produces negative numbers.
 */
async function recalculateCumulativeTotals(classId, term, session, teacherId, pupils) {
    console.log(`Recalculating cumulative attendance: class=${classId}, term=${term}`);

    // Fetch all daily records for this class + term + session
    const snap = await db.collection('daily_attendance')
        .where('classId', '==', classId)
        .where('term', '==', term)
        .where('session', '==', session)
        .get();

    // Count per pupil
    const pupilCounts = {};
    pupils.forEach(p => {
        pupilCounts[p.id] = { timesPresent: 0, timesAbsent: 0 };
    });

    let totalDays = 0;   // unique school days = number of daily_attendance docs

    snap.forEach(doc => {
        const data = doc.data();
        totalDays++;

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

    // Batch write to existing attendance collection
    const settings = await window.getCurrentSettings?.() || { session };
    const sessionStartYear = settings.currentSession?.startYear;
    const sessionEndYear = settings.currentSession?.endYear;
    const sessionTerm = `${session}_${term}`;

    // Write in batches of 500 (Firestore limit)
    const batchSize = 400;
    const pupilEntries = Object.entries(pupilCounts);

    for (let i = 0; i < pupilEntries.length; i += batchSize) {
        const batch = db.batch();
        const chunk = pupilEntries.slice(i, i + batchSize);

        chunk.forEach(([pupilId, counts]) => {
            const docId = `${pupilId}_${term}`;
            const ref = db.collection('attendance').doc(docId);

            // Clamp to zero to prevent negative numbers
            const timesPresent = Math.max(0, counts.timesPresent);
            const timesAbsent = Math.max(0, counts.timesAbsent);
            const timesOpened = totalDays;

            batch.set(ref, {
                pupilId,
                term,
                teacherId,
                session,
                sessionStartYear: sessionStartYear || null,
                sessionEndYear: sessionEndYear || null,
                sessionTerm,
                timesOpened,
                timesPresent,
                timesAbsent,
                // Flag so system knows these are derived values
                derivedFromDailyRecords: true,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });  // merge:true preserves any extra fields
        });

        await batch.commit();
    }

    console.log(`✓ Recalculated cumulative for ${pupilEntries.length} pupils. Days: ${totalDays}`);
    return { totalDays, pupilCounts };
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