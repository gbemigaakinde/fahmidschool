/**
 * FAHMID NURSERY & PRIMARY SCHOOL
 * Print Results JavaScript
 *
 * Purpose:
 * - Generate dynamic termly report card
 * - Pull live pupil bio, class, teacher, subjects
 * - Reflect admin changes instantly
 * - Support session parameter from pupil portal (?session=2023/2024)
 * - Sub-CA breakdown: Assignment(10) + Mid-term(20) + Project(10) = CA Total(40)
 * - Class average and position per subject
 *
 * Version: 6.7.0 - CLASSMATES-BASED AVERAGE (no classId dependency on results)
 * Date: 2026-05-09
 *
 * FIX: Class average, position and class size now work by:
 *   1. Finding classmates directly from the pupils collection using the
 *      pupil's own class.id (always reliable).
 *   2. Fetching each classmate's approved results for the same term+session.
 *   3. Computing average and rank from those scores.
 *   This approach works even when approved result documents lack a classId field.
 */
'use strict';

let currentPupilId  = null;
let pupilProfile    = null;

let currentSettings = {
    term:           'First Term',
    session:        '',
    resumptionDate: '-'
};

let isInitialized = false;

function getSessionFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const s = params.get('session');
    return (s && s !== 'current') ? s : null;
}

/* ===============================
   DUAL-ROLE AUTH & INITIALIZATION
================================ */

async function initPrintResultsWrapper() {
    firebase.auth().onAuthStateChanged(async user => {
        if (!user) {
            window.location.href = 'index.html';
            return;
        }

        try {
            const userDoc = await db.collection('users').doc(user.uid).get();
            if (!userDoc.exists) { window.location.href = 'index.html'; return; }

            const userRole = userDoc.data().role;
            if (userRole !== 'admin' && userRole !== 'pupil') {
                window.location.href = 'index.html';
                return;
            }

            const isAdmin  = userRole === 'admin';
            const urlParams = new URLSearchParams(window.location.search);

            // ── Resolve pupil identity ────────────────────────────────────────
            let resolvedPupilId = null;

            if (isAdmin) {
                const urlAdmissionNo = urlParams.get('admissionNo');
                const urlPupilId     = urlParams.get('pupilId');

                if (urlAdmissionNo) {
                    try {
                        const snap = await db.collection('pupils')
                            .where('admissionNo', '==', urlAdmissionNo)
                            .limit(1)
                            .get();
                        if (!snap.empty) resolvedPupilId = snap.docs[0].id;
                        else console.error('No pupil found with admissionNo:', urlAdmissionNo);
                    } catch (e) {
                        console.error('Error looking up pupil by admissionNo:', e);
                    }
                } else if (urlPupilId) {
                    console.warn('Legacy URL: pupilId visible in URL.');
                    resolvedPupilId = urlPupilId;
                }
            } else {
                resolvedPupilId = user.uid;
            }

            currentPupilId = resolvedPupilId;

            if (isAdmin && !currentPupilId) {
                document.body.innerHTML = `
                    <div style="display:flex;flex-direction:column;align-items:center;
                                justify-content:center;min-height:80vh;font-family:sans-serif;
                                color:#374151;text-align:center;padding:2rem;">
                      <div style="font-size:3rem;margin-bottom:1rem;">🔍</div>
                      <h2 style="margin:0 0 .5rem;">No Pupil Selected</h2>
                      <p style="color:#6b7280;margin-bottom:1.5rem;">
                        Use the <strong>View Results</strong> section in the admin portal
                        and click <em>Open Full Report / Print</em>.
                      </p>
                      <a href="admin.html"
                         style="background:#00B2FF;color:white;padding:.6rem 1.4rem;
                                border-radius:6px;text-decoration:none;font-weight:600;">
                        ← Back to Admin Portal
                      </a>
                    </div>`;
                return;
            }

            if (isAdmin) {
                const bar = document.createElement('div');
                bar.id = 'admin-view-bar';
                bar.style.cssText =
                  'position:fixed;top:0;left:0;right:0;z-index:9999;' +
                  'background:#1e40af;color:white;padding:10px 20px;' +
                  'display:flex;align-items:center;justify-content:space-between;' +
                  'font-family:sans-serif;font-size:14px;font-weight:600;' +
                  'box-shadow:0 2px 8px rgba(0,0,0,.25);';
                bar.innerHTML = `
                  <span>🔐 Admin View</span>
                  <div style="display:flex;gap:12px;align-items:center;">
                    <button onclick="window.print()"
                      style="background:rgba(255,255,255,.2);border:none;color:white;
                             padding:6px 14px;border-radius:4px;cursor:pointer;
                             font-weight:600;font-size:13px;">🖨️ Print</button>
                    <a href="admin.html"
                      style="background:rgba(255,255,255,.2);color:white;
                             padding:6px 14px;border-radius:4px;text-decoration:none;
                             font-weight:600;font-size:13px;">← Back to Admin</a>
                  </div>`;
                document.body.insertBefore(bar, document.body.firstChild);
                document.body.style.paddingTop = '48px';
                const ps = document.createElement('style');
                ps.textContent =
                  '@media print{#admin-view-bar{display:none!important}' +
                  'body{padding-top:0!important}}';
                document.head.appendChild(ps);
            }

            await fetchSchoolSettings();

            const sessionOverride = getSessionFromUrl();
            if (sessionOverride) currentSettings.session = sessionOverride;

            await fetchPupilProfile(currentPupilId);
            setupTermSelector();
            updateReportHeader();
            isInitialized = true;
            await loadReportData();

        } catch (err) {
            console.error('Print results initialization failed:', err);
            window.location.href = 'index.html';
        }
    });
}

initPrintResultsWrapper();

/* ===============================
   FETCH SCHOOL SETTINGS
================================ */

async function fetchSchoolSettings() {
    try {
        const doc = await db.collection('settings').doc('current').get();
        if (!doc.exists) { console.warn('Settings document not found'); return; }
        const data = doc.data();
        currentSettings.term          = data.term          || currentSettings.term;
        currentSettings.session       = data.session       || '';
        currentSettings.resumptionDate = data.resumptionDate || '-';
        console.log('Settings loaded:', currentSettings);
    } catch (error) {
        console.error('Error loading settings:', error);
        throw error;
    }
}

/* ===============================
   FETCH PUPIL PROFILE
================================ */

async function fetchPupilProfile(uid) {
    try {
        const doc = await db.collection('pupils').doc(uid).get();
        if (!doc.exists) throw new Error('Pupil record not found');

        pupilProfile    = doc.data();
        currentPupilId  = doc.id;

        setText('student-name',   pupilProfile.name   || '-');
        setText('student-gender', pupilProfile.gender || '-');
        setText('admission-no',   pupilProfile.admissionNo || '-');

        // ── Resolve classId from pupil profile ────────────────────────────
        let classId   = null;
        let className = '-';

        if (pupilProfile.class) {
            if (typeof pupilProfile.class === 'object') {
                classId   = pupilProfile.class.id   || null;
                className = pupilProfile.class.name || '-';
            } else if (typeof pupilProfile.class === 'string') {
                className = pupilProfile.class;
                // Look up the class doc to get its ID
                const classSnap = await db.collection('classes')
                    .where('name', '==', className)
                    .limit(1)
                    .get();
                if (!classSnap.empty) {
                    classId   = classSnap.docs[0].id;
                    className = classSnap.docs[0].data().name || className;
                }
            }
        }

        // Store on pupilProfile so loadAcademicResults can use it
        pupilProfile._resolvedClassId   = classId;
        pupilProfile._resolvedClassName = className;

        setText('student-class', className);

        let teacherName = '-';
        if (classId) {
            const classDoc = await db.collection('classes').doc(classId).get();
            if (classDoc.exists) {
                const cd = classDoc.data();
                if (cd.teacherName) {
                    teacherName = cd.teacherName;
                } else if (cd.teacherId) {
                    const td = await db.collection('teachers').doc(cd.teacherId).get();
                    if (td.exists) teacherName = td.data().name || '-';
                }
            }
        }

        setText('class-teacher', teacherName);
        console.log('Pupil profile loaded. classId:', classId, '| className:', className);

    } catch (error) {
        console.error('Error loading pupil profile:', error);
        throw error;
    }
}

/* ===============================
   TERM SELECTOR
================================ */

function setupTermSelector() {
    const select = document.getElementById('print-term');
    if (!select) { console.error('Term selector not found'); return; }

    const termToSelect = currentSettings.term;
    setText('current-term', termToSelect);

    const newSelect = select.cloneNode(true);
    Array.from(newSelect.options).forEach(o => { o.selected = o.value === termToSelect; });
    select.parentNode.replaceChild(newSelect, select);

    newSelect.addEventListener('change', async e => {
        currentSettings.term = e.target.value;
        setText('current-term', currentSettings.term);
        updateReportHeader();
        await loadReportData();
    });

    if (newSelect.value !== termToSelect) newSelect.value = termToSelect;
}

/* ===============================
   UPDATE HEADER FIELDS
================================ */

function updateReportHeader() {
    const term    = currentSettings.term    || '';
    const session = currentSettings.session || '';

    setText('report-title',      `${term} Report Card${session ? ' — ' + session + ' Academic Session' : ''}`);
    setText('current-term',      term    || '-');
    setText('current-session',   session || '-');
    setText('header-term-badge', term    || 'Termly Report');
    setText('header-session',    session ? `Session: ${session}` : 'Session –');

    const urlSession = getSessionFromUrl();
    if (urlSession) {
        setText('resumption-date', '-');
    } else if (currentSettings.resumptionDate?.toDate) {
        setText('resumption-date',
            currentSettings.resumptionDate.toDate().toLocaleDateString('en-GB'));
    } else {
        setText('resumption-date', currentSettings.resumptionDate || '-');
    }
}

/* ===============================
   LOAD ALL REPORT DATA
================================ */

async function loadReportData() {
    resetTraitsAndRemarks();
    try {
        await Promise.all([
            loadAcademicResults(),
            loadAttendance(),
            loadBehavioralTraits(),
            loadPsychomotorSkills(),
            loadRemarks()
        ]);
    } catch (error) {
        console.error('Error loading report data:', error);
        window.showToast?.('Failed to load some report data', 'warning');
    }
}

/* ===============================
   ACADEMIC RESULTS — v6.7.0
================================ */

async function loadAcademicResults() {
    const tbody = document.getElementById('academic-tbody');
    if (!tbody) return;

    // Wait for initialization if needed
    if (!isInitialized || !currentPupilId || !currentSettings.session || !currentSettings.term) {
        tbody.innerHTML = loadingRow();
        let attempts = 0;
        while (attempts < 100) {
            await new Promise(resolve => setTimeout(resolve, 100));
            if (isInitialized && currentPupilId && currentSettings.session && currentSettings.term) break;
            attempts++;
        }
        if (attempts >= 100) {
            tbody.innerHTML = `<tr><td colspan="11" style="text-align:center;">⚠️ Unable to load results. Reload page.</td></tr>`;
            clearPerformanceSummary();
            return;
        }
    }

    tbody.innerHTML = loadingRow();
    clearPerformanceSummary();

    try {
        // ── Step 1: Fetch THIS pupil's approved results ───────────────────────
        // Query by pupilId only (single-field index, always available).
        // Filter term, session, and status client-side to avoid composite indexes.
        const allMyResultsSnap = await db.collection('results')
            .where('pupilId', '==', currentPupilId)
            .get();

        let myResults = [];
        allMyResultsSnap.forEach(doc => {
            const d = doc.data();
            const matchesTerm    = d.term    === currentSettings.term;
            const matchesSession = d.session === currentSettings.session;
            const isApproved     = !d.status || d.status === 'approved';
            if (matchesTerm && matchesSession && isApproved) {
                myResults.push({
                    subject:    d.subject    || 'Unknown Subject',
                    assignment: typeof d.assignment === 'number' ? d.assignment : null,
                    midterm:    typeof d.midterm    === 'number' ? d.midterm    : null,
                    project:    typeof d.project    === 'number' ? d.project    : null,
                    caScore:    typeof d.caScore    === 'number' ? d.caScore    : 0,
                    examScore:  typeof d.examScore  === 'number' ? d.examScore  : 0,
                });
            }
        });

        console.log(`This pupil has ${myResults.length} approved results for ${currentSettings.term} / ${currentSettings.session}`);

        if (myResults.length === 0) {
            tbody.innerHTML = emptyRow(
                `No approved results available for ${currentSettings.term}, ${currentSettings.session} session`
            );
            clearPerformanceSummary();
            return;
        }

        // ── Step 2: Get classmates from the pupils collection ─────────────────
        //
        // KEY FIX: We find classmates by querying the pupils collection for
        // class.id === this pupil's classId.  This works 100% of the time
        // because the pupil profile always has current class info, and it
        // does NOT depend on whether result documents have a classId field.
        //
        const classId = pupilProfile._resolvedClassId;
        let classmateIds = []; // includes this pupil

        if (classId) {
            try {
                const classmatesSnap = await db.collection('pupils')
                    .where('class.id', '==', classId)
                    .get();

                classmatesSnap.forEach(doc => {
                    // Exclude alumni — they are no longer in the active class
                    if (doc.data().status !== 'alumni') {
                        classmateIds.push(doc.id);
                    }
                });

                console.log(`Found ${classmateIds.length} classmates in class "${pupilProfile._resolvedClassName}" (classId: ${classId})`);
            } catch (e) {
                console.warn('Could not fetch classmates:', e.message);
            }
        } else {
            console.warn('No classId available — class average and position will not be shown');
        }

        // ── Step 3: Build subject → scores map from classmates' results ───────
        //
        // For each classmate (including this pupil), fetch their approved results
        // for the same term+session.  Because we query by pupilId (one field),
        // no composite index is needed.
        //
        // We batch classmates in groups of 10 using Firestore's "in" operator
        // so we minimise the number of round trips.
        //
        // subjectScoresMap: { subjectName: [ { pupilId, total }, ... ] }
        //
        const subjectScoresMap = {};

        if (classmateIds.length > 0) {
            // Chunk into groups of 10 (Firestore "in" limit)
            const chunks = [];
            for (let i = 0; i < classmateIds.length; i += 10) {
                chunks.push(classmateIds.slice(i, i + 10));
            }

            for (const chunk of chunks) {
                const chunkSnap = await db.collection('results')
                    .where('pupilId', 'in', chunk)
                    .get();

                chunkSnap.forEach(doc => {
                    const d = doc.data();
                    const matchesTerm    = d.term    === currentSettings.term;
                    const matchesSession = d.session === currentSettings.session;
                    const isApproved     = !d.status || d.status === 'approved';

                    if (!matchesTerm || !matchesSession || !isApproved) return;

                    const subj  = d.subject || 'Unknown';
                    const ca    = typeof d.caScore   === 'number' ? d.caScore   : 0;
                    const exam  = typeof d.examScore === 'number' ? d.examScore : 0;
                    const total = ca + exam;

                    if (!subjectScoresMap[subj]) subjectScoresMap[subj] = [];
                    subjectScoresMap[subj].push({ pupilId: d.pupilId, total });
                });
            }

            console.log('Subjects with class data:', Object.keys(subjectScoresMap));
        }

        // ── Step 4: Compute average and position per subject ──────────────────
        const classAverageMap = {};

        Object.entries(subjectScoresMap).forEach(([subj, scores]) => {
            const sum    = scores.reduce((acc, s) => acc + s.total, 0);
            const avg    = scores.length > 0 ? sum / scores.length : 0;
            const sorted = [...scores].sort((a, b) => b.total - a.total);
            const posIdx = sorted.findIndex(s => s.pupilId === currentPupilId);

            classAverageMap[subj] = {
                average:   avg.toFixed(1),
                position:  posIdx >= 0 ? posIdx + 1 : null,
                classSize: scores.length
            };

            if (posIdx < 0) {
                console.warn(`Pupil not ranked for subject "${subj}" — their result may be missing from the class set`);
            }
        });

        // ── Step 5: Attach stats to each result row ───────────────────────────
        myResults = myResults.map(r => ({
            ...r,
            classAverage: classAverageMap[r.subject]?.average  ?? null,
            position:     classAverageMap[r.subject]?.position ?? null,
            classSize:    classAverageMap[r.subject]?.classSize ?? null,
        }));

        // Debug: log the first result to verify stats are attached
        if (myResults.length > 0) {
            console.log('Sample result:', myResults[0]);
        }

        renderResults(myResults, tbody);

    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="11" style="text-align:center;">⚠️ Error loading results. Reload page.</td></tr>`;
        clearPerformanceSummary();
        console.error('Error in loadAcademicResults:', error);
    }
}

/* ===============================
   RENDER RESULTS TABLE ROWS
================================ */

function renderResults(results, tbody) {
    tbody.innerHTML = '';
    results.sort((a, b) => a.subject.localeCompare(b.subject));

    let totalScore = 0;

    results.forEach(r => {
        const ca    = r.caScore;
        const exam  = r.examScore;
        const score = ca + exam;
        totalScore += score;

        // Sub-CA: show '–' for legacy results that lack breakdown
        const assignment = (r.assignment !== null && r.assignment !== undefined) ? r.assignment : null;
        const midterm    = (r.midterm    !== null && r.midterm    !== undefined) ? r.midterm    : null;
        const project    = (r.project    !== null && r.project    !== undefined) ? r.project    : null;

        // Class stats
        const classAvg  = (r.classAverage !== null && r.classAverage !== undefined)
            ? Number(r.classAverage).toFixed(1) : null;
        const position  = (r.position  !== null && r.position  !== undefined) ? r.position  : null;
        const classSize = (r.classSize !== null && r.classSize !== undefined) ? r.classSize : null;

        // Format position as e.g. "3rd/25"
        let posDisplay = '–';
        if (position !== null) {
            const suffix = position === 1 ? 'st' : position === 2 ? 'nd' : position === 3 ? 'rd' : 'th';
            posDisplay = classSize ? `${position}${suffix}/${classSize}` : `${position}${suffix}`;
        }

        tbody.insertAdjacentHTML('beforeend', `
            <tr>
                <td>${r.subject}</td>
                <td style="text-align:center;">${assignment !== null ? assignment : '–'}</td>
                <td style="text-align:center;">${midterm    !== null ? midterm    : '–'}</td>
                <td style="text-align:center;">${project    !== null ? project    : '–'}</td>
                <td class="col-total" style="text-align:center; color:var(--blue-mid);">${ca}</td>
                <td style="text-align:center;">${exam}</td>
                <td class="col-total" style="text-align:center;">${score}</td>
                <td style="text-align:center;">${classAvg  !== null ? classAvg  : '–'}</td>
                <td style="text-align:center;">${posDisplay}</td>
                <td class="grade-${getGrade(score)}" style="text-align:center;">${getGrade(score)}</td>
                <td style="text-align:center;">${getRemark(score)}</td>
            </tr>
        `);
    });

    const subjectCount = results.length;
    const average      = subjectCount > 0 ? (totalScore / subjectCount).toFixed(1) : '0.0';
    const avgGrade     = getGrade(parseFloat(average));

    // Class size — take from first result that has it (all should be same)
    const classSizeVal = results.find(r => r.classSize)?.classSize || null;

    setText('perf-total',      `${totalScore} / ${subjectCount * 100}`);
    setText('perf-subjects',   String(subjectCount));
    setText('perf-avg',        `${average}%`);
    setText('perf-class-size', classSizeVal ? String(classSizeVal) : '–');

    const gradeEl = document.getElementById('perf-grade');
    if (gradeEl) {
        gradeEl.textContent = avgGrade;
        gradeEl.className   = `perf-row__val grade-${avgGrade}`;
        gradeEl.id          = 'perf-grade';
    }
}

/* ===============================
   ATTENDANCE
================================ */

async function loadAttendance() {
    if (!currentPupilId || !currentSettings.term || !currentSettings.session) return;
    const encodedSession = currentSettings.session.replace(/\//g, '-');
    const docId = `${currentPupilId}_${encodedSession}_${currentSettings.term}`;
    try {
        const doc = await db.collection('attendance').doc(docId).get();
        const d   = doc.exists ? doc.data() : {};
        setText('times-opened',  typeof d.timesOpened  === 'number' ? d.timesOpened  : '-');
        setText('times-present', typeof d.timesPresent === 'number' ? d.timesPresent : '-');
        setText('times-absent',  typeof d.timesAbsent  === 'number' ? d.timesAbsent  : '-');
    } catch (e) {
        console.error('Error loading attendance:', e);
    }
}

/* ===============================
   TRAITS & SKILLS
================================ */

async function loadBehavioralTraits()  { await loadKeyedCollection('behavioral_traits',  'trait-'); }
async function loadPsychomotorSkills() { await loadKeyedCollection('psychomotor_skills', 'skill-'); }

async function loadKeyedCollection(collection, prefix) {
    if (!currentPupilId || !currentSettings.term || !currentSettings.session) return;
    const encodedSession = currentSettings.session.replace(/\//g, '-');
    const docId = `${currentPupilId}_${encodedSession}_${currentSettings.term}`;
    try {
        const doc = await db.collection(collection).doc(docId).get();
        if (!doc.exists) return;
        const data = doc.data();
        const skip = ['pupilId','term','teacherId','updatedAt','session',
                      'sessionStartYear','sessionEndYear','sessionTerm'];
        Object.entries(data).forEach(([k, v]) => {
            if (skip.includes(k)) return;
            setText(prefix + k.toLowerCase(), v !== null && v !== undefined ? v : '-');
        });
    } catch (e) {
        console.error(`Error loading ${collection}:`, e);
    }
}

/* ===============================
   REMARKS
================================ */

async function loadRemarks() {
    if (!currentPupilId || !currentSettings.term || !currentSettings.session) return;
    const encodedSession = currentSettings.session.replace(/\//g, '-');
    const docId = `${currentPupilId}_${encodedSession}_${currentSettings.term}`;
    try {
        const doc  = await db.collection('remarks').doc(docId).get();
        const data = doc.exists ? doc.data() : {};
        setText('teacher-remark', typeof data.teacherRemark === 'string' ? data.teacherRemark : '-');
        setText('head-remark',    typeof data.headRemark    === 'string' ? data.headRemark    : '-');
    } catch (e) {
        console.error('Error loading remarks:', e);
    }
}

/* ===============================
   HELPERS
================================ */

function clearPerformanceSummary() {
    setText('perf-total',      '–');
    setText('perf-subjects',   '–');
    setText('perf-avg',        '–');
    setText('perf-class-size', '–');
    const gradeEl = document.getElementById('perf-grade');
    if (gradeEl) {
        gradeEl.textContent = '–';
        gradeEl.className   = 'perf-row__val';
        gradeEl.id          = 'perf-grade';
    }
}

function resetTraitsAndRemarks() {
    document.querySelectorAll('.trait-value').forEach(el => el.textContent = '-');
    setText('teacher-remark', '-');
    setText('head-remark',    '-');
    setText('times-opened',   '-');
    setText('times-present',  '-');
    setText('times-absent',   '-');
    clearPerformanceSummary();
}

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

function loadingRow() {
    return `<tr><td colspan="11" style="text-align:center; padding:12px; color:var(--ink-3);">
        <div style="width:24px;height:24px;margin:0 auto 6px;border:3px solid #f3f3f3;
             border-top:3px solid var(--blue-deep);border-radius:50%;
             animation:spin 1s linear infinite;"></div>
        Loading results…
    </td></tr>`;
}

function emptyRow(text) {
    return `<tr><td colspan="11" style="text-align:center; padding:12px; color:var(--ink-3);">${text}</td></tr>`;
}

function getGrade(score) {
    if (score >= 75) return 'A1';
    if (score >= 70) return 'B2';
    if (score >= 65) return 'B3';
    if (score >= 60) return 'C4';
    if (score >= 55) return 'C5';
    if (score >= 50) return 'C6';
    if (score >= 45) return 'D7';
    if (score >= 40) return 'D8';
    return 'F9';
}

function getRemark(score) {
    if (score >= 75) return 'Excellent';
    if (score >= 70) return 'Very Good';
    if (score >= 65) return 'Good';
    if (score >= 60) return 'Credit';
    if (score >= 50) return 'Credit';
    if (score >= 45) return 'Pass';
    if (score >= 40) return 'Pass';
    return 'Fail';
}

// Spin animation
const _spinStyle = document.createElement('style');
_spinStyle.textContent = '@keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}';
document.head.appendChild(_spinStyle);

console.log('✓ print-results.js ready (v6.7.0 - CLASSMATES-BASED AVERAGE)');
