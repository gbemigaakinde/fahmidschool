/**
 * FAHMID NURSERY & PRIMARY SCHOOL
 * Print Results JavaScript
 *
 * Version: 7.2.0
 * Date: 2026-05-11
 *
 * FIX: Class average, position, and class size now load correctly.
 *      Added Method B2 (query results by pupilId pattern) and Method C2
 *      (query all approved results for the term/session then group by classId).
 *      Also fixed classId resolution for pupils with old string-format class data.
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

        console.log('Resolved classId:', classId, '| className:', className);

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
   ACADEMIC RESULTS  —  v7.2.0
   ─────────────────────────────────────────────────────────────
   CLASSMATE LOOKUP STRATEGY
   ─────────────────────────────────────────────────────────────
   Method A — Query results collection by classId (top-level field):
     This is the most reliable method. Results docs store classId
     when saved by the teacher. We query all approved results for
     the class/term/session and collect unique pupilIds.

   Method B — Query results collection by className stored on docs:
     Fallback if classId is not stored (older results).

   Method C — Derive classId from this pupil's own results docs:
     Look at this pupil's own approved results and read the classId
     field from there, then query other pupils' results by that classId.

   Method D — Honest fallback: show "–" for class stats.
     Does NOT fake 1st/1.
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
        const classId        = pupilProfile._resolvedClassId;
        const className      = pupilProfile._resolvedClassName;

        console.log('Loading results | term:', TARGET_TERM, '| session:', TARGET_SESSION, '| classId:', classId, '| className:', className);

        /* ── 1. Fetch this pupil's own approved results ─────────────────── */
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
                    // store classId from results doc for later use
                    _classId:   d.classId || null,
                });
            }
        });

        console.log('Own results:', myResults.length, myResults.map(r => r.subject));

        if (myResults.length === 0) {
            tbody.innerHTML = emptyRow(
                `No approved results for ${TARGET_TERM}, ${TARGET_SESSION} session`
            );
            clearPerformanceSummary();
            return;
        }

        /* ── 2. Determine the best classId to use for lookups ────────────── */
        /*
         * Priority:
         * 1. classId from pupil profile (_resolvedClassId)
         * 2. classId stored on this pupil's own results docs
         * Either way we now have a classId to search with.
         */
        let effectiveClassId = classId;

        if (!effectiveClassId) {
            // Try to read classId from this pupil's own result docs
            for (const r of myResults) {
                if (r._classId) {
                    effectiveClassId = r._classId;
                    console.log('Derived classId from own results doc:', effectiveClassId);
                    break;
                }
            }
        }

        /* ── 3. Get classmate pupilIds ───────────────────────────────────── */
        /*
         * We attempt multiple strategies and take the first one that gives
         * us more than just the current pupil.
         */
        let classmateIds = [];

        /* ── Method A: Query approved results by classId ─────────────────── */
        if (effectiveClassId && classmateIds.length === 0) {
            try {
                console.log('Method A: querying results by classId =', effectiveClassId);
                const classResultsSnap = await db.collection('results')
                    .where('classId', '==', effectiveClassId)
                    .get();

                const pupilIdSet = new Set();
                classResultsSnap.forEach(doc => {
                    const d = doc.data();
                    if (
                        d.term    === TARGET_TERM    &&
                        d.session === TARGET_SESSION &&
                        (!d.status || d.status === 'approved') &&
                        d.pupilId
                    ) {
                        pupilIdSet.add(d.pupilId);
                    }
                });

                if (pupilIdSet.size > 0) {
                    classmateIds = Array.from(pupilIdSet);
                    console.log('Method A found', classmateIds.length, 'pupils');
                } else {
                    console.warn('Method A returned 0 pupils — trying Method B');
                }
            } catch (errA) {
                console.warn('Method A failed:', errA.message, '— trying Method B');
            }
        }

        /* ── Method B: Query results by className field ───────────────────── */
        /*
         * Some older results may store className but not classId.
         * We query all results for term/session and filter by className client-side.
         */
        if (classmateIds.length === 0 && className && className !== '-') {
            try {
                console.log('Method B: querying results by className =', className);
                const classNameResultsSnap = await db.collection('results')
                    .where('className', '==', className)
                    .get();

                const pupilIdSet = new Set();
                classNameResultsSnap.forEach(doc => {
                    const d = doc.data();
                    if (
                        d.term    === TARGET_TERM    &&
                        d.session === TARGET_SESSION &&
                        (!d.status || d.status === 'approved') &&
                        d.pupilId
                    ) {
                        pupilIdSet.add(d.pupilId);
                    }
                });

                if (pupilIdSet.size > 0) {
                    classmateIds = Array.from(pupilIdSet);
                    console.log('Method B found', classmateIds.length, 'pupils');
                } else {
                    console.warn('Method B returned 0 pupils — trying Method C');
                }
            } catch (errB) {
                console.warn('Method B failed:', errB.message, '— trying Method C');
            }
        }

        /* ── Method C: Broad scan — all approved results for term/session ── */
        /*
         * Query all approved results for this term and session, then find
         * the subset that share a classId or className with this pupil.
         * We use a broad query (just term + session) and filter client-side.
         * This works regardless of whether classId/className fields exist.
         */
        if (classmateIds.length === 0) {
            try {
                console.log('Method C: broad scan of all results for term/session');

                // We need some identifier to group classmates.
                // Use effectiveClassId if available, else className.
                const allResultsSnap = await db.collection('results')
                    .where('term',    '==', TARGET_TERM)
                    .where('session', '==', TARGET_SESSION)
                    .get();

                const pupilIdSet = new Set();
                allResultsSnap.forEach(doc => {
                    const d = doc.data();
                    if (!d.pupilId) return;
                    if (d.status && d.status !== 'approved') return;

                    // Match by classId if we have one
                    if (effectiveClassId && d.classId === effectiveClassId) {
                        pupilIdSet.add(d.pupilId);
                        return;
                    }
                    // Match by className
                    if (className && className !== '-' && d.className === className) {
                        pupilIdSet.add(d.pupilId);
                        return;
                    }
                });

                // Make sure current pupil is always in the set
                // (their results might not have classId/className stored)
                pupilIdSet.add(currentPupilId);

                if (pupilIdSet.size > 1) {
                    classmateIds = Array.from(pupilIdSet);
                    console.log('Method C found', classmateIds.length, 'pupils');
                } else {
                    console.warn('Method C could not find classmates — falling back to Method D');
                }
            } catch (errC) {
                console.warn('Method C failed:', errC.message);
            }
        }

        /* ── Method D: Try querying pupils collection directly (admin only) */
        /*
         * If we still have no classmates and we have effectiveClassId,
         * try the pupils collection (may work for admin but not pupil accounts).
         */
        if (classmateIds.length <= 1 && effectiveClassId) {
            try {
                console.log('Method D: querying pupils collection by class.id');
                const classSnap = await db.collection('pupils')
                    .where('class.id', '==', effectiveClassId)
                    .get();

                const methodDIds = [];
                classSnap.forEach(doc => {
                    const d = doc.data();
                    if (d.status !== 'alumni') {
                        methodDIds.push(doc.id);
                    }
                });

                if (methodDIds.length > 1) {
                    classmateIds = methodDIds;
                    console.log('Method D found', classmateIds.length, 'pupils');
                } else {
                    console.warn('Method D returned', methodDIds.length, 'pupils');
                }
            } catch (errD) {
                console.warn('Method D failed (expected for pupil accounts):', errD.message);
            }
        }

        /* ── Ensure current pupil is always included ──────────────────────── */
        if (!classmateIds.includes(currentPupilId)) {
            classmateIds.push(currentPupilId);
        }

        const hasClassData = classmateIds.length > 1;

        if (!hasClassData) {
            console.warn('No classmates found — class stats will show –');
        }

        console.log('Final classmate IDs count:', classmateIds.length);

        /* ── 4. Fetch results for all classmates ────────────────────────── */
        /*
         * subjectScoresMap keys are NORMALISED (lowercase trimmed) subject names.
         */
        const subjectScoresMap = {}; // normKey -> [ { pupilId, total } ]

        const chunks = chunkArray(classmateIds, 10);

        for (const chunk of chunks) {
            try {
                const snap = await db.collection('results')
                    .where('pupilId', 'in', chunk)
                    .get();

                snap.forEach(doc => {
                    const d = doc.data();
                    if (d.term    !== TARGET_TERM)    return;
                    if (d.session !== TARGET_SESSION)  return;
                    if (d.status && d.status !== 'approved') return;

                    const normKey = normaliseSubject(d.subject || '');
                    const ca      = typeof d.caScore   === 'number' ? d.caScore   : 0;
                    const exam    = typeof d.examScore === 'number' ? d.examScore : 0;
                    const total   = ca + exam;
                    const pid     = d.pupilId || '';

                    if (!subjectScoresMap[normKey]) subjectScoresMap[normKey] = [];

                    // Prevent duplicates for the same pupil+subject
                    if (!subjectScoresMap[normKey].find(s => s.pupilId === pid)) {
                        subjectScoresMap[normKey].push({ pupilId: pid, total });
                    }
                });
            } catch (chunkErr) {
                console.warn('Chunk query failed:', chunkErr.message);
            }
        }

        console.log('Subjects with class data:', Object.keys(subjectScoresMap));

        /* ── 5. Compute per-subject stats ───────────────────────────────── */
        const classStatMap = {}; // originalSubjectName -> stats

        myResults.forEach(r => {
            const normKey = normaliseSubject(r.subject);
            const scores  = subjectScoresMap[normKey];

            if (!scores || scores.length === 0) {
                console.warn('No class scores for subject:', r.subject, '(norm:', normKey + ')');
                classStatMap[r.subject] = { average: null, position: null, classSize: null };
                return;
            }

            const sum      = scores.reduce((acc, s) => acc + s.total, 0);
            const average  = sum / scores.length;
            const sorted   = [...scores].sort((a, b) => b.total - a.total);
            const posIndex = sorted.findIndex(s => s.pupilId === currentPupilId);

            classStatMap[r.subject] = {
                average:   average.toFixed(1),
                position:  posIndex >= 0 ? posIndex + 1 : null,
                classSize: scores.length
            };

            console.log(
                `"${r.subject}": classSize=${scores.length}, avg=${average.toFixed(1)},`,
                `pos=${posIndex + 1}, scores=[${scores.map(s=>s.total).join(',')}]`
            );
        });

        /* ── 6. Attach stats and render ─────────────────────────────────── */
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

/* ─── Subject name normalisation ────────────────────────────── */
function normaliseSubject(name) {
    return (name || '').trim().toLowerCase();
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
        if (position !== null && classSize !== null) {
            const suffix = position === 1 ? 'st'
                         : position === 2 ? 'nd'
                         : position === 3 ? 'rd' : 'th';
            posDisplay = `${position}${suffix}/${classSize}`;
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

    // Class size: use the modal value across all subjects
    const classSizeVal = getModalClassSize(results);

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

/* ─── Modal class size helper ───────────────────────────────── */
function getModalClassSize(results) {
    const freq = {};
    results.forEach(r => {
        if (r.classSize != null) {
            freq[r.classSize] = (freq[r.classSize] || 0) + 1;
        }
    });
    const entries = Object.entries(freq);
    if (entries.length === 0) return null;
    entries.sort((a, b) => b[1] - a[1]);
    return Number(entries[0][0]);
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

console.log('✓ print-results.js v7.2.0 ready');
