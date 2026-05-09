/**
 * FAHMID NURSERY & PRIMARY SCHOOL
 * Print Results JavaScript
 *
 * Version: 6.9.0
 * Date: 2026-05-09
 *
 * CLASS AVERAGE / POSITION / CLASS SIZE STRATEGY:
 *   - We already know the pupil's classId from their profile.
 *   - We fetch ALL pupils (no filter) and pick those whose class.id matches
 *     in JavaScript. This avoids any Firestore nested-field index requirement.
 *   - We then fetch results for each classmate by pupilId (single-field query).
 *   - Everything is filtered client-side — zero composite indexes needed.
 */
'use strict';

let currentPupilId = null;
let pupilProfile   = null;

let currentSettings = {
    term:           'First Term',
    session:        '',
    resumptionDate: '-'
};

let isInitialized = false;

/* ─── URL helper ─────────────────────────────────────────────── */
function getSessionFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const s = params.get('session');
    return (s && s !== 'current') ? s : null;
}

/* ═══════════════════════════════════════════════════════════════
   AUTH & INITIALIZATION
═══════════════════════════════════════════════════════════════ */
async function initPrintResultsWrapper() {
    firebase.auth().onAuthStateChanged(async user => {
        if (!user) { window.location.href = 'index.html'; return; }

        try {
            const userDoc = await db.collection('users').doc(user.uid).get();
            if (!userDoc.exists) { window.location.href = 'index.html'; return; }

            const userRole = userDoc.data().role;
            if (userRole !== 'admin' && userRole !== 'pupil') {
                window.location.href = 'index.html';
                return;
            }

            const isAdmin   = userRole === 'admin';
            const urlParams = new URLSearchParams(window.location.search);
            let   resolvedPupilId = null;

            if (isAdmin) {
                const urlAdmissionNo = urlParams.get('admissionNo');
                const urlPupilId     = urlParams.get('pupilId');

                if (urlAdmissionNo) {
                    try {
                        const snap = await db.collection('pupils')
                            .where('admissionNo', '==', urlAdmissionNo)
                            .limit(1).get();
                        if (!snap.empty) resolvedPupilId = snap.docs[0].id;
                        else console.error('No pupil found with admissionNo:', urlAdmissionNo);
                    } catch (e) {
                        console.error('Error looking up pupil by admissionNo:', e);
                    }
                } else if (urlPupilId) {
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

            /* Admin toolbar */
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
                ps.textContent = '@media print{#admin-view-bar{display:none!important}body{padding-top:0!important}}';
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

/* ═══════════════════════════════════════════════════════════════
   SCHOOL SETTINGS
═══════════════════════════════════════════════════════════════ */
async function fetchSchoolSettings() {
    try {
        const doc = await db.collection('settings').doc('current').get();
        if (!doc.exists) { console.warn('Settings document not found'); return; }
        const data = doc.data();
        currentSettings.term           = data.term           || currentSettings.term;
        currentSettings.session        = data.session        || '';
        currentSettings.resumptionDate = data.resumptionDate || '-';
        console.log('Settings loaded:', currentSettings);
    } catch (error) {
        console.error('Error loading settings:', error);
        throw error;
    }
}

/* ═══════════════════════════════════════════════════════════════
   PUPIL PROFILE
═══════════════════════════════════════════════════════════════ */
async function fetchPupilProfile(uid) {
    try {
        const doc = await db.collection('pupils').doc(uid).get();
        if (!doc.exists) throw new Error('Pupil record not found');

        pupilProfile   = doc.data();
        currentPupilId = doc.id;

        setText('student-name',   pupilProfile.name        || '-');
        setText('student-gender', pupilProfile.gender      || '-');
        setText('admission-no',   pupilProfile.admissionNo || '-');

        /* Resolve classId */
        let classId   = null;
        let className = '-';

        if (pupilProfile.class) {
            if (typeof pupilProfile.class === 'object') {
                classId   = pupilProfile.class.id   || null;
                className = pupilProfile.class.name || '-';
            } else if (typeof pupilProfile.class === 'string') {
                className = pupilProfile.class;
                try {
                    const classSnap = await db.collection('classes')
                        .where('name', '==', className).limit(1).get();
                    if (!classSnap.empty) {
                        classId   = classSnap.docs[0].id;
                        className = classSnap.docs[0].data().name || className;
                    }
                } catch (e) {
                    console.warn('Could not look up classId by name:', e.message);
                }
            }
        }

        pupilProfile._resolvedClassId   = classId;
        pupilProfile._resolvedClassName = className;

        setText('student-class', className);

        /* Teacher name */
        let teacherName = '-';
        if (classId) {
            try {
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
            } catch (e) {
                console.warn('Could not fetch teacher info:', e.message);
            }
        }

        setText('class-teacher', teacherName);
        console.log('Pupil profile loaded. classId:', classId, '| className:', className);

    } catch (error) {
        console.error('Error loading pupil profile:', error);
        throw error;
    }
}

/* ═══════════════════════════════════════════════════════════════
   TERM SELECTOR
═══════════════════════════════════════════════════════════════ */
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

/* ═══════════════════════════════════════════════════════════════
   REPORT HEADER
═══════════════════════════════════════════════════════════════ */
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

/* ═══════════════════════════════════════════════════════════════
   LOAD ALL REPORT DATA
═══════════════════════════════════════════════════════════════ */
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
    }
}

/* ═══════════════════════════════════════════════════════════════
   ACADEMIC RESULTS  —  v6.9.0
   ─────────────────────────────────────────────────────────────
   HOW CLASS STATS ARE COMPUTED
   ─────────────────────────────────────────────────────────────
   1. Fetch THIS pupil's approved results (single-field query,
      filter term/session/status client-side).
   2. Fetch ALL pupils from the database (get() with no filter).
      Loop through in JavaScript and keep only those whose
      class.id matches this pupil's classId.
      → Avoids any Firestore nested-field index requirement.
   3. For each classmate, fetch results by pupilId in batches
      of 10 (single-field "in" query — always works without indexes).
      Filter term/session/status client-side.
   4. Build per-subject scores map, compute average & rank.
   5. Attach stats to each result row before rendering.
═══════════════════════════════════════════════════════════════ */
async function loadAcademicResults() {
    const tbody = document.getElementById('academic-tbody');
    if (!tbody) return;

    /* Wait for init */
    if (!isInitialized || !currentPupilId || !currentSettings.session || !currentSettings.term) {
        tbody.innerHTML = loadingRow();
        let tries = 0;
        while (tries < 100) {
            await sleep(100);
            if (isInitialized && currentPupilId && currentSettings.session && currentSettings.term) break;
            tries++;
        }
        if (tries >= 100) {
            tbody.innerHTML = errorRow('Unable to load results. Reload page.');
            clearPerformanceSummary();
            return;
        }
    }

    tbody.innerHTML = loadingRow();
    clearPerformanceSummary();

    try {
        const TARGET_TERM    = currentSettings.term;
        const TARGET_SESSION = currentSettings.session;

        /* ── 1. Fetch this pupil's own results ─────────────────────────── */
        const mySnap = await db.collection('results')
            .where('pupilId', '==', currentPupilId)
            .get();

        let myResults = [];
        mySnap.forEach(doc => {
            const d = doc.data();
            if (
                d.term    === TARGET_TERM    &&
                d.session === TARGET_SESSION &&
                (!d.status || d.status === 'approved')
            ) {
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

        console.log(`Own results found: ${myResults.length}`);

        if (myResults.length === 0) {
            tbody.innerHTML = emptyRow(
                `No approved results for ${TARGET_TERM}, ${TARGET_SESSION} session`
            );
            clearPerformanceSummary();
            return;
        }

        /* ── 2. Find classmates ─────────────────────────────────────────── */
        /*
         * We fetch ALL pupils and filter in JavaScript.
         * This is the only guaranteed-to-work approach when Firestore
         * composite or nested-field indexes are not set up.
         *
         * We look for pupils where class.id === this pupil's classId.
         * We also handle the edge case where class is stored as a plain string.
         */
        const classId = pupilProfile._resolvedClassId;
        let classmateIds = [];

        if (classId) {
            try {
                const allPupilsSnap = await db.collection('pupils').get();

                allPupilsSnap.forEach(doc => {
                    const d = doc.data();

                    /* Skip alumni */
                    if (d.status === 'alumni') return;

                    /* Match class.id */
                    let pupilClassId = null;
                    if (d.class && typeof d.class === 'object' && d.class.id) {
                        pupilClassId = d.class.id;
                    }

                    if (pupilClassId === classId) {
                        classmateIds.push(doc.id);
                    }
                });

                /* Always include the current pupil */
                if (!classmateIds.includes(currentPupilId)) {
                    classmateIds.push(currentPupilId);
                }

                console.log(`Classmates found (JS filter): ${classmateIds.length} in classId "${classId}"`);
            } catch (e) {
                console.warn('Could not fetch all pupils for class stats:', e.message);
                classmateIds = [currentPupilId];
            }
        } else {
            console.warn('No classId — skipping class stats');
            classmateIds = [currentPupilId];
        }

        /* ── 3. Fetch results for all classmates ────────────────────────── */
        /*
         * Firestore "in" queries accept max 10 values per call.
         * We chunk classmateIds into groups of 10 and merge.
         * Each query uses only ONE field (pupilId) — no index needed.
         * We filter term / session / approved status client-side.
         */
        const subjectScoresMap = {}; // { subject: [ { pupilId, total } ] }

        const chunks = chunkArray(classmateIds, 10);

        for (const chunk of chunks) {
            try {
                const snap = await db.collection('results')
                    .where('pupilId', 'in', chunk)
                    .get();

                snap.forEach(doc => {
                    const d = doc.data();

                    /* Client-side filter */
                    if (d.term    !== TARGET_TERM)    return;
                    if (d.session !== TARGET_SESSION)  return;
                    if (d.status && d.status !== 'approved') return;

                    const subj  = d.subject  || 'Unknown';
                    const ca    = typeof d.caScore   === 'number' ? d.caScore   : 0;
                    const exam  = typeof d.examScore === 'number' ? d.examScore : 0;
                    const total = ca + exam;
                    const pid   = d.pupilId  || '';

                    if (!subjectScoresMap[subj]) subjectScoresMap[subj] = [];

                    /* Prevent duplicates for the same pupil+subject */
                    if (!subjectScoresMap[subj].find(s => s.pupilId === pid)) {
                        subjectScoresMap[subj].push({ pupilId: pid, total });
                    }
                });
            } catch (chunkErr) {
                console.warn('Chunk query failed:', chunkErr.message);
            }
        }

        console.log('Subjects with class data:', Object.keys(subjectScoresMap));

        /* ── 4. Compute per-subject average, position, class size ───────── */
        const classStatMap = {};

        Object.entries(subjectScoresMap).forEach(([subj, scores]) => {
            if (!scores.length) return;

            const sum      = scores.reduce((acc, s) => acc + s.total, 0);
            const average  = sum / scores.length;
            const sorted   = [...scores].sort((a, b) => b.total - a.total);
            const posIndex = sorted.findIndex(s => s.pupilId === currentPupilId);

            classStatMap[subj] = {
                average:   average.toFixed(1),
                position:  posIndex >= 0 ? posIndex + 1 : null,
                classSize: scores.length
            };
        });

        console.log('Class stats computed:', classStatMap);

        /* ── 5. Attach stats to rows and render ─────────────────────────── */
        myResults = myResults.map(r => ({
            ...r,
            classAverage: classStatMap[r.subject]?.average   ?? null,
            position:     classStatMap[r.subject]?.position  ?? null,
            classSize:    classStatMap[r.subject]?.classSize ?? null,
        }));

        renderResults(myResults, tbody);

    } catch (err) {
        console.error('loadAcademicResults error:', err);
        tbody.innerHTML = errorRow('Error loading results. Reload page.');
        clearPerformanceSummary();
    }
}

/* ═══════════════════════════════════════════════════════════════
   RENDER TABLE ROWS
═══════════════════════════════════════════════════════════════ */
function renderResults(results, tbody) {
    tbody.innerHTML = '';
    results.sort((a, b) => a.subject.localeCompare(b.subject));

    let totalScore = 0;

    results.forEach(r => {
        const ca    = r.caScore;
        const exam  = r.examScore;
        const score = ca + exam;
        totalScore += score;

        const assignment = r.assignment !== null && r.assignment !== undefined ? r.assignment : null;
        const midterm    = r.midterm    !== null && r.midterm    !== undefined ? r.midterm    : null;
        const project    = r.project    !== null && r.project    !== undefined ? r.project    : null;

        const classAvg  = r.classAverage !== null && r.classAverage !== undefined
            ? Number(r.classAverage).toFixed(1) : null;
        const position  = r.position  !== null && r.position  !== undefined ? r.position  : null;
        const classSize = r.classSize !== null && r.classSize !== undefined ? r.classSize : null;

        let posDisplay = '–';
        if (position !== null) {
            const suffix = position === 1 ? 'st'
                         : position === 2 ? 'nd'
                         : position === 3 ? 'rd' : 'th';
            posDisplay = classSize ? `${position}${suffix}/${classSize}` : `${position}${suffix}`;
        }

        tbody.insertAdjacentHTML('beforeend', `
            <tr>
                <td>${r.subject}</td>
                <td style="text-align:center;">${assignment !== null ? assignment : '–'}</td>
                <td style="text-align:center;">${midterm    !== null ? midterm    : '–'}</td>
                <td style="text-align:center;">${project    !== null ? project    : '–'}</td>
                <td class="col-total" style="text-align:center;color:var(--blue-mid);">${ca}</td>
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
    const classSizeVal = results.find(r => r.classSize != null)?.classSize ?? null;

    setText('perf-total',      `${totalScore} / ${subjectCount * 100}`);
    setText('perf-subjects',   String(subjectCount));
    setText('perf-avg',        `${average}%`);
    setText('perf-class-size', classSizeVal !== null ? String(classSizeVal) : '–');

    const gradeEl = document.getElementById('perf-grade');
    if (gradeEl) {
        gradeEl.textContent = avgGrade;
        gradeEl.className   = `perf-row__val grade-${avgGrade}`;
        gradeEl.id          = 'perf-grade';
    }
}

/* ═══════════════════════════════════════════════════════════════
   ATTENDANCE
═══════════════════════════════════════════════════════════════ */
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

/* ═══════════════════════════════════════════════════════════════
   TRAITS & SKILLS
═══════════════════════════════════════════════════════════════ */
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
        const skip = new Set(['pupilId','term','teacherId','updatedAt','session',
                              'sessionStartYear','sessionEndYear','sessionTerm']);
        Object.entries(data).forEach(([k, v]) => {
            if (skip.has(k)) return;
            setText(prefix + k.toLowerCase(), v !== null && v !== undefined ? v : '-');
        });
    } catch (e) {
        console.error(`Error loading ${collection}:`, e);
    }
}

/* ═══════════════════════════════════════════════════════════════
   REMARKS
═══════════════════════════════════════════════════════════════ */
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

/* ═══════════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════════ */
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

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function chunkArray(arr, size) {
    const chunks = [];
    for (let i = 0; i < arr.length; i += size) {
        chunks.push(arr.slice(i, i + size));
    }
    return chunks;
}

function loadingRow() {
    return `<tr><td colspan="11" style="text-align:center;padding:12px;color:var(--ink-3);">
        <div style="width:24px;height:24px;margin:0 auto 6px;border:3px solid #f3f3f3;
             border-top:3px solid var(--blue-deep);border-radius:50%;
             animation:spin 1s linear infinite;"></div>
        Loading results…
    </td></tr>`;
}

function emptyRow(text) {
    return `<tr><td colspan="11" style="text-align:center;padding:12px;color:var(--ink-3);">${text}</td></tr>`;
}

function errorRow(text) {
    return `<tr><td colspan="11" style="text-align:center;padding:12px;color:#dc2626;">⚠️ ${text}</td></tr>`;
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

/* Spin keyframes */
const _spinStyle = document.createElement('style');
_spinStyle.textContent = '@keyframes spin{0%{transform:rotate(0)}100%{transform:rotate(360deg)}}';
document.head.appendChild(_spinStyle);

console.log('✓ print-results.js v6.9.0 ready');
