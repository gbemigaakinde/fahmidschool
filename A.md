# ES Module Refactoring Guide — Fahmid Nursery & Primary School Portal

## Overview

This guide converts the existing global-script architecture to ES Modules (ESM).
Every old file that assigned to `window.*` becomes an ESM module that exports
named functions. HTML entry-point scripts become thin `<script type="module">`
tags that import only what they need.

**Total new files: 28**
No existing HTML files need structural changes beyond swapping `<script src="…">` 
to `<script type="module" src="…">`.

---

## Module Dependency Map

```
firebase-config.js          ← root, no dependencies
    └── db.js               ← wraps Firestore helpers
    └── auth.js             ← wraps Auth helpers

shared/
  errors.js                 ← error messages & handleError
  settings.js               ← getCurrentSettings, session cache
  session-encoding.js       ← encodeSession, generatePaymentDocId
  retry.js                  ← retryWithBackoff, firestoreGet/Set/etc.

finance/
  fee-calculator.js         ← calculateAdjustedFee, calculateCompleteArrears
  payment-recorder.js       ← recordPayment, generateReceiptNumber
  outstanding.js            ← calculateCurrentOutstanding
  reports.js                ← loadOutstandingFeesReport, loadFinancialReports
  pdf-report.js             ← generateComprehensiveFinancialReport

results/
  locking.js                ← resultLocking module
  approvals.js              ← approveResultSubmission, rejectResultSubmission

attendance/
  daily.js                  ← dailyAttendance module
  teacher-ui.js             ← attendance section UI for teacher portal

portals/
  admin.js                  ← admin portal entry point
  teacher.js                ← teacher portal entry point
  pupil.js                  ← pupil portal entry point
  print-results.js          ← print results page entry point

features/
  cbt-teacher.js            ← CBT test management
  cbt-engine.js             ← CBT pupil test-taking
  lesson-notes-teacher.js   ← lesson notes (teacher side)
  lesson-notes-admin.js     ← lesson notes (admin side)
  school-calendar.js        ← school calendar admin module
  class-hierarchy.js        ← class hierarchy helpers
  promotions.js             ← promotion requests (admin)
  remark-templates.js       ← remark suggestion templates
  pupils-export.js          ← Excel/PDF export for pupils data

ui/
  button-loader.js          ← global button loading states
  toast.js                  ← showToast (extracted from script.js)
  script.js                 ← public website JS (navigation, FAQ, etc.)

service-worker.js           ← unchanged (service workers cannot be ESM yet)
```

---

## File Index (28 files)

| # | New File | Replaces / Sources | Old Files Needed |
|---|----------|--------------------|-----------------|
| 1 | `firebase-config.js` | firebaseConfig object | firebase-init.js |
| 2 | `db.js` | window.db + persistence | firebase-init.js |
| 3 | `auth.js` | window.auth + session timeout + login/logout | firebase-init.js |
| 4 | `shared/errors.js` | window.ERROR_MESSAGES, window.handleError | firebase-init.js |
| 5 | `shared/settings.js` | window.getCurrentSettings, SessionCache | firebase-init.js, session-cache.js |
| 6 | `shared/session-encoding.js` | window.encodeSession, window.generatePaymentDocId | firebase-init.js |
| 7 | `shared/retry.js` | window.retryWithBackoff, window.firestoreGet/Set/Update/Delete | firebase-init.js |
| 8 | `finance/fee-calculator.js` | window.calculateAdjustedFee, window.calculateCompleteArrears, _recalculateTermBalance | admin.js, finance.js |
| 9 | `finance/payment-recorder.js` | finance.recordPayment, generateReceiptNumber | finance.js |
| 10 | `finance/outstanding.js` | window.calculateCurrentOutstanding, calculateSessionBalanceSafe | admin.js, finance.js |
| 11 | `finance/reports.js` | loadOutstandingFeesReport, loadFinancialReports, exportFinancialReport | admin.js |
| 12 | `finance/pdf-report.js` | generateComprehensiveFinancialReport | financial-report-generator.js |
| 13 | `results/locking.js` | window.resultLocking | result-locking.js |
| 14 | `results/approvals.js` | approveResultSubmission, rejectResultSubmission, toggleResultPreview | admin.js |
| 15 | `attendance/daily.js` | window.dailyAttendance | attendance-daily.js |
| 16 | `attendance/teacher-ui.js` | loadAttendanceSectionEnhanced and all attendance UI | attendance-teacher-ui.js |
| 17 | `portals/admin.js` | Full admin portal entry | admin.js |
| 18 | `portals/teacher.js` | Full teacher portal entry | teacher.js |
| 19 | `portals/pupil.js` | Full pupil portal entry | pupil.js |
| 20 | `portals/print-results.js` | Print results page | print-results.js |
| 21 | `features/cbt-teacher.js` | loadCbtSection, saveCbtTest, etc. | cbt-teacher.js |
| 22 | `features/cbt-engine.js` | CBT pupil test engine | cbt-engine.js |
| 23 | `features/lesson-notes-teacher.js` | loadLessonNotesSection, lnSaveNote, etc. | lesson-notes-teacher.js |
| 24 | `features/lesson-notes-admin.js` | loadLessonNotesAdminSection, lnAdminApproveNote, etc. | lesson-notes-admin.js |
| 25 | `features/school-calendar.js` | window.schoolCalendar API + loadSchoolCalendarSection | school-calendar-admin.js |
| 26 | `features/class-hierarchy.js` | window.classHierarchy | class-hierarchy.js, admin.js (classHierarchy object) |
| 27 | `features/remark-templates.js` | window.remarkTemplates | remark-templates.js |
| 28 | `features/pupils-export.js` | exportPupilsToExcel, exportPupilsToPDF | pupils-export.js |
| 29 | `ui/button-loader.js` | ButtonLoader, auto-intercept | button-loader.js |
| 30 | `ui/script.js` | Public website JS (navigation, FAQ, gallery, forms) | script.js |

> Note: `service-worker.js` stays as-is. Service workers cannot use `import` statements
> in the ESM sense (they use importScripts or remain classic scripts).
> `pupils-export.js` added bringing total to 30 files.

---

## Prompts for AI-Assisted Production

Each prompt below is self-contained. Paste it into a new conversation along
with the attached old files listed. The AI does not need the full codebase —
only the files listed under "Attach these old files".

---

### FILE 1 — `firebase-config.js`

**Prompt:**
```
Convert the Firebase configuration to an ES Module.

Extract ONLY the firebaseConfig object and the Firebase initialization logic
from the attached firebase-init.js. Do NOT include any auth helpers, Firestore
helpers, or session logic — those belong in other files.

The module should:
- Export a named `firebaseConfig` constant (the config object)
- Initialize Firebase exactly once using `if (!firebase.apps.length)` guard
- Export the initialized `firebase` app instance as default
- Use `export` statements (no `window` assignments)
- Keep the file under 40 lines

File to create: firebase-config.js

Assume Firebase compat SDK is loaded via CDN script tags in HTML before this
module runs. The module can reference the global `firebase` object directly.
```

**Attach these old files:** `firebase-init.js`

---

### FILE 2 — `db.js`

**Prompt:**
```
Convert the Firestore database helpers to an ES Module.

Source: the attached firebase-init.js and the firestoreGet/Set/Update/Delete
wrapper functions.

The module should:
- Import from ./firebase-config.js (which exports the initialized firebase app)
- Export `db` as a named export (firebase.firestore() instance)
- Enable offline persistence in the module body (catch errors silently as before)
- Export the four convenience wrappers as named exports:
    firestoreGet(ref, operationName)
    firestoreSet(ref, data, options, operationName)
    firestoreUpdate(ref, data, operationName)
    firestoreDelete(ref, operationName)
- These wrappers call retryWithBackoff internally — import retryWithBackoff
  from ./shared/retry.js (it will exist; stub the import if needed)
- No `window` assignments

File to create: db.js
```

**Attach these old files:** `firebase-init.js`

---

### FILE 3 — `auth.js`

**Prompt:**
```
Convert the Firebase Auth helpers to an ES Module.

Source: the attached firebase-init.js — specifically the auth object,
session timeout logic, getUserRole, checkRole, login, and logout functions.

The module should:
- Import `firebase` from ./firebase-config.js
- Export `auth` as a named export
- Export the following as named exports:
    getUserRole(uid) → async function
    checkRole(requiredRole) → returns Promise
    login(email, password) → async function
    logout() → async function
    resetSessionTimeout() → function (internal helper, still exported for testing)
- Session timeout tracking (SESSION_TIMEOUT_MS = 8 hours) wires up inside the
  module body using auth.onAuthStateChanged — no factory function needed
- For showToast calls, import showToast from ./ui/toast.js (stub if needed)
- For handleError calls, import handleError from ./shared/errors.js (stub if needed)
- No `window` assignments

File to create: auth.js
```

**Attach these old files:** `firebase-init.js`

---

### FILE 4 — `shared/errors.js`

**Prompt:**
```
Convert the error handling utilities to an ES Module.

Source: the attached firebase-init.js — the ERROR_MESSAGES object and the
handleError function.

The module should:
- Export `ERROR_MESSAGES` as a named const
- Export `handleError(error, fallbackMessage)` as a named function
- handleError imports showToast from ../ui/toast.js (stub if needed)
- handleError handles the unauthenticated redirect as before (window.location.href)
- No `window` assignments

File to create: shared/errors.js
```

**Attach these old files:** `firebase-init.js`

---

### FILE 5 — `shared/settings.js`

**Prompt:**
```
Convert getCurrentSettings and the session cache to an ES Module.

Source: the attached files — firebase-init.js (getCurrentSettings function)
and session-cache.js (SessionCache module).

The module should:
- Import `db` from ../db.js
- Export `getCurrentSettings()` as a named async function (the full
  implementation with defaultSettings, error handling, etc.)
- Export `SessionCache` as a named object with:
    getSettings(forceRefresh)
    getAllSessions(forceRefresh)
    clearCache(type)
    getStatus()
- The exported `getCurrentSettings` should delegate to SessionCache.getSettings
  so there is one implementation (merge the two — SessionCache.getSettings IS
  getCurrentSettings, just with a cache layer)
- No `window` assignments

File to create: shared/settings.js
```

**Attach these old files:** `firebase-init.js`, `session-cache.js`

---

### FILE 6 — `shared/session-encoding.js`

**Prompt:**
```
Convert the session encoding utilities to a tiny ES Module.

Source: the attached firebase-init.js — the encodeSession, decodeSession,
generatePaymentDocId, and generateFeeStructureDocId functions.

The module should:
- Export all four as named functions
- Zero dependencies (pure string functions)
- Under 30 lines

File to create: shared/session-encoding.js
```

**Attach these old files:** `firebase-init.js`

---

### FILE 7 — `shared/retry.js`

**Prompt:**
```
Convert the retry and backoff helpers to an ES Module.

Source: the attached firebase-init.js — the retryWithBackoff function.

The module should:
- Export `retryWithBackoff(operation, maxRetries, operationName)` as a named
  async function (full implementation preserved exactly)
- For showToast, import from ../ui/toast.js (stub import if needed)
- No `window` assignments

File to create: shared/retry.js
```

**Attach these old files:** `firebase-init.js`

---

### FILE 8 — `finance/fee-calculator.js`

**Prompt:**
```
Convert the fee calculation functions to an ES Module.

Source: the attached admin.js and finance.js files.

Functions to include:
- calculateAdjustedFee(pupilData, baseFee, currentTerm) — from admin.js top
- calculateCompleteArrears(pupilId, currentSession, currentTerm) — from admin.js
- _recalculateTermBalance(pupilId, session, term) — helper, still export it
- getPreviousSessionName(currentSession) — helper
- calculateSessionBalanceSafe(pupilId, session) — helper
- wasEnrolledIn(pupilData, checkSession, checkTerm) — internal helper (do not export)

The module should:
- Import `db` from ../db.js
- Import `calculateAdjustedFee` is a dependency of calculateCompleteArrears —
  keep them in the same file
- Export: calculateAdjustedFee, calculateCompleteArrears, _recalculateTermBalance,
  getPreviousSessionName, calculateSessionBalanceSafe
- No circular dependency with finance/outstanding.js: calculateCompleteArrears
  calls calculateCurrentOutstanding. To avoid the circular dep, accept
  calculateCurrentOutstanding as a parameter to calculateCompleteArrears
  (dependency injection):
    export async function calculateCompleteArrears(pupilId, session, term, { calculateCurrentOutstanding } = {})
  When called without the injection (e.g. from tests), fall back to _recalculateTermBalance.
- Preserve all console.log debugging statements
- No `window` assignments

File to create: finance/fee-calculator.js
```

**Attach these old files:** `admin.js`, `finance.js`

---

### FILE 9 — `finance/payment-recorder.js`

**Prompt:**
```
Convert the payment recording logic to an ES Module.

Source: the attached finance.js — the recordPayment and generateReceiptNumber
methods on the `finance` object.

The module should:
- Import `db` from ../db.js
- Import `auth` from ../auth.js
- Import `calculateAdjustedFee`, `calculateCompleteArrears` from ./fee-calculator.js
- Export `recordPayment(pupilId, pupilName, classId, className, session, term, paymentData)` as a named async function
- Export `generateReceiptNumber()` as a named async function
- Preserve all validation, overpayment prevention, atomic transaction, and
  payment allocation logic exactly
- No `window` assignments

File to create: finance/payment-recorder.js
```

**Attach these old files:** `finance.js`

---

### FILE 10 — `finance/outstanding.js`

**Prompt:**
```
Convert the outstanding balance calculation to an ES Module.

Source: the attached admin.js (calculateCurrentOutstanding) and finance.js
(calculateCurrentOutstanding method on finance object — use this as the
canonical version).

The module should:
- Import `db` from ../db.js
- Import `calculateAdjustedFee`, `calculateCompleteArrears` from ./fee-calculator.js
- Export `calculateCurrentOutstanding(pupilId, session, term)` as a named
  async function (the finance.js version — it has the most fixes)
- After defining calculateCurrentOutstanding, call back into fee-calculator.js
  to resolve the dependency injection:
    import { calculateCompleteArrears as _calcArrears } from './fee-calculator.js'
    The exported calculateCurrentOutstanding passes itself as the injection:
    _calcArrears(pupilId, session, term, { calculateCurrentOutstanding })
  This breaks the circular reference cleanly.
- Preserve the overpaid/credit logic (status === 'overpaid', credit field)
- No `window` assignments

File to create: finance/outstanding.js
```

**Attach these old files:** `admin.js`, `finance.js`

---

### FILE 11 — `finance/reports.js`

**Prompt:**
```
Convert the financial reporting section loaders to an ES Module.

Source: the attached admin.js — specifically these functions:
  loadOutstandingFeesReport()
  loadFinancialReports()
  updateSummaryDisplay(count, total)
  updateFinancialDisplays(...)
  exportFinancialReport(format)
  exportFinancialCSV(session, term)
  exportFinancialPDF(session, term)

The module should:
- Import `db` from ../db.js
- Import `getCurrentSettings` from ../shared/settings.js
- Import `calculateCurrentOutstanding` from ./outstanding.js
- Import `showToast` from ../ui/toast.js
- Export all functions listed above as named exports
- Preserve alumni balance detection (FIX 5)
- Preserve the dual collection rate (FIX 6)
- No `window` assignments

File to create: finance/reports.js
```

**Attach these old files:** `admin.js`

---

### FILE 12 — `finance/pdf-report.js`

**Prompt:**
```
Convert the comprehensive financial PDF generator to an ES Module.

Source: the attached financial-report-generator.js (the entire file).

The module should:
- Import `db` from ../db.js
- Import `getCurrentSettings` from ../shared/settings.js
- Import `calculateCurrentOutstanding` from ./outstanding.js
- Import `showToast` from ../ui/toast.js
- Export `generateComprehensiveFinancialReport()` as a named async function
- Preserve gatherFinancialData, performFinancialAnalysis, generateCharts,
  createPDFReport as internal (unexported) functions
- Assumes jsPDF and Chart.js loaded via CDN script tags (references globals)
- No `window` assignments

File to create: finance/pdf-report.js
```

**Attach these old files:** `financial-report-generator.js` (document index 10)

---

### FILE 13 — `results/locking.js`

**Prompt:**
```
Convert the result locking module to an ES Module.

Source: the attached result-locking.js (the entire file — the resultLocking object).

The module should:
- Import `db` from ../db.js
- Export each method of the resultLocking object as a named export:
    isLocked(classId, term, subject, session)
    lockResults(classId, className, term, subject, session, adminUid)
    unlockResults(classId, className, term, subject, session, adminUid, reason)
    getSubmittedResults()
    submitForApproval(classId, term, subject, session, teacherUid, teacherName)
    approveResults(submissionId, adminUid)
    rejectResults(submissionId, adminUid, reason)
- Also export a default `resultLocking` object that is a namespace of the same
  functions (for backward compatibility with any code that still uses
  window.resultLocking.isLocked(...) style calls via the portal entry points)
- No `window` assignments

File to create: results/locking.js
```

**Attach these old files:** `result-locking.js`

---

### FILE 14 — `results/approvals.js`

**Prompt:**
```
Convert the result approval UI logic to an ES Module.

Source: the attached admin.js — specifically these functions:
  approveResultSubmission(submissionId)
  rejectResultSubmission(submissionId)
  approveAllPendingResults()
  _approveSubmissionSilently(submissionId, submissionDataHint)
  loadResultApprovals()
  _loadPendingResults()
  _loadApprovedResults()
  switchResultApprovalsTab(tab)
  _ensureTabBar()
  _tabBtnStyle(active)
  toggleResultPreview(submissionId, classId, term, subject, session, className)
  computePreviewStats(drafts)
  renderResultPreviewPanel(stats, meta)
  updateResultsBulkButtons()
  toggleAllResultsSelection(masterCheckbox)
  unlockApprovedResult(submissionId)

Also include the module-level state variable _resultApprovalsTab.

The module should:
- Import `db` from ../db.js
- Import `auth` from ../auth.js
- Import `showToast` from ../ui/toast.js
- Import `getGrade`, `getRemark` from ../shared/grade-utils.js (these are small
  pure functions — include them inline in this file if grade-utils.js does not
  exist, and also export them so other files can import them)
- Export all functions listed above as named exports
- No `window` assignments

File to create: results/approvals.js
```

**Attach these old files:** `admin.js`

---

### FILE 15 — `attendance/daily.js`

**Prompt:**
```
Convert the daily attendance data module to an ES Module.

Source: the attached attendance-daily.js (entire file).

The module should:
- Import `db` from ../db.js
- Import `firebase` from ../firebase-config.js (for FieldValue.serverTimestamp)
- Import `getCurrentSettings` from ../shared/settings.js
- Export every function currently on window.dailyAttendance as both:
    (a) individual named exports: markDailyAttendance, updatePupilAttendanceForDay,
        deleteDailyAttendance, recalculateCumulativeTotals, fetchAttendanceGrid,
        generateWeeklySummary, hasAttendanceForDate, getMarkedDates,
        formatDateDisplay, formatDateISO, getWeekDates, getMondayOfWeek, getTodayISO
    (b) a default export `dailyAttendance` namespace object (for portal use)
- schoolCalendar integration: import getNonSchoolDays from
  ../features/school-calendar.js (stub import if needed)
- Preserve all parameter validation and console.trace/log debugging
- No `window` assignments

File to create: attendance/daily.js
```

**Attach these old files:** `attendance-daily.js`

---

### FILE 16 — `attendance/teacher-ui.js`

**Prompt:**
```
Convert the teacher attendance UI module to an ES Module.

Source: the attached attendance-teacher-ui.js (the v3.0.0 complete replacement file).

The module should:
- Import from ../attendance/daily.js (the dailyAttendance namespace)
- Import `db` from ../db.js
- Import `getCurrentSettings` from ../shared/settings.js
- Import `showToast` from ../ui/toast.js
- The module reads window.assignedClasses, window.allPupils, window.currentUser
  — these are set by the teacher portal before calling section loaders.
  Change these to module-level variables that can be set via an exported
  init function:
    export function initAttendanceUI({ assignedClasses, allPupils, currentUser })
  The section loader (loadAttendanceSectionEnhanced) then reads from these
  module-level vars.
- Export these as named exports:
    loadAttendanceSectionEnhanced
    switchAttendanceTab
    navigateWeek
    goToCurrentWeek
    openMarkTodayModal
    closeMarkDayModal
    handleModalBackdropClick
    markAllModalPupils
    saveModalAttendance
    togglePupilStatusInDay
    printAttendanceRegister
    saveAllAttendanceManual
    initAttendanceUI
- The sectionLoaders hook (installEnhancedAttendance) is NOT needed in this
  module — the teacher portal entry point will import and register it directly
- No `window` assignments

File to create: attendance/teacher-ui.js
```

**Attach these old files:** `attendance-teacher-ui.js`

---

### FILE 17 — `portals/admin.js`

**Prompt:**
```
Convert the admin portal to an ES Module entry point.

Source: the attached admin.js (the full file — this is the largest conversion).

This file is the entry point for admin.html. It:
1. Imports all dependencies from the other modules you've created
2. Contains the admin-specific UI code that doesn't belong in a shared module:
   - loadTeachers, loadPupils, loadClasses, loadSubjects
   - loadDashboardStats
   - Teacher/pupil/class form handlers (add-teacher-form, add-pupil-form)
   - Sidebar navigation (setupSidebarNavigation, showSection, loadSectionData)
   - Portal initialization (initializeAdminPortal)
   - Audit log (loadAuditLog, filterAuditLog, viewAuditDetails, downloadAuditLog)
   - Alumni management (loadAlumni, deleteAlumni)
   - Teacher assignments (loadTeacherAssignments, assignTeacherToClass, unassignTeacher)
   - Subject assignment modal (openSubjectAssignmentModal, saveClassSubjects)
   - Announcements (loadAdminAnnouncements, addAnnouncement)
   - Settings form handler (updateSessionSettings, loadCurrentSettings)
   - Class hierarchy UI (loadClassHierarchyUI, renderHierarchyUI)
   - Session management (confirmStartNewSession, startNewSession, migrateArrearsOnTermChange)
   - deleteItem, paginateTable
   - Bulk pupil operations (bulkReassignClass, bulkDeletePupils)
   - Payment section loaders (loadFeeManagementSection, loadPaymentRecordingSection,
     loadPupilPaymentStatus, loadPupilsForPayment, loadPaymentHistory, recordPayment)
   - Fee structure CRUD (saveFeeStructure, editFeeStructure, deleteFeeStructure)
   - View results section (loadViewResultsSection, loadPupilResults, etc.)
   - Session comparison (loadSessionComparison)
   - Promotion request management (loadPromotionRequests, viewPromotionDetails,
     approvePromotion, executePromotion, rejectPromotion, etc.)
   - Data migration helpers (migratePaymentRecordsToAdjustedFees, backfillSessionData)
   - createSecondaryUser (IIFE, keep this inline)

Imports needed (bring in from the modules created in earlier steps):
  import { db } from '../db.js'
  import { auth } from '../auth.js'
  import { firebase } from '../firebase-config.js'
  import { getCurrentSettings } from '../shared/settings.js'
  import { handleError, ERROR_MESSAGES } from '../shared/errors.js'
  import { calculateCurrentOutstanding } from '../finance/outstanding.js'
  import { calculateAdjustedFee, calculateCompleteArrears } from '../finance/fee-calculator.js'
  import { recordPayment as financeRecordPayment } from '../finance/payment-recorder.js'
  import { loadOutstandingFeesReport, loadFinancialReports, exportFinancialReport } from '../finance/reports.js'
  import { loadResultApprovals, approveResultSubmission, rejectResultSubmission, unlockApprovedResult, switchResultApprovalsTab, toggleResultPreview } from '../results/approvals.js'
  import { loadLessonNotesAdminSection } from '../features/lesson-notes-admin.js'
  import { loadSchoolCalendarSection } from '../features/school-calendar.js'
  import { classHierarchy } from '../features/class-hierarchy.js'
  import { generateComprehensiveFinancialReport } from '../finance/pdf-report.js'

Key structural rules:
- The file starts with `import` statements, then the IIFE for secondary auth,
  then checkRole/authUser/domReady pattern, then DOM-ready listeners
- All functions previously exported via `window.X = X` at the bottom are
  instead exported with `export function X` or `export { X }`
- The `db` and `auth` locals used throughout the file come from the imports,
  NOT re-declared as `const db = window.db`
- showToast calls: import from ../ui/toast.js
- Keep `window.adminDebug` assignment (it's a developer tool, window is fine)
- Do not import from portals/teacher.js or portals/pupil.js

File to create: portals/admin.js
```

**Attach these old files:** `admin.js`, `firebase-init.js`

---

### FILE 18 — `portals/teacher.js`

**Prompt:**
```
Convert the teacher portal to an ES Module entry point.

Source: the attached teacher.js (full file).

This file is the entry point for teacher.html.

Imports needed:
  import { db } from '../db.js'
  import { auth } from '../auth.js'
  import { firebase } from '../firebase-config.js'
  import { getCurrentSettings } from '../shared/settings.js'
  import { handleError } from '../shared/errors.js'
  import { checkRole, logout } from '../auth.js'
  import { resultLocking } from '../results/locking.js'
  import { classHierarchy } from '../features/class-hierarchy.js'
  import { loadAttendanceSectionEnhanced, initAttendanceUI } from '../attendance/teacher-ui.js'
  import { remarkTemplates } from '../features/remark-templates.js'
  import { loadLessonNotesSection } from '../features/lesson-notes-teacher.js'
  import { loadCbtSection } from '../features/cbt-teacher.js'
  import { showToast } from '../ui/toast.js'

Key structural rules:
- module-level `let currentUser`, `let assignedClasses`, `let allPupils`,
  `let allSubjects` (no window assignments for these)
- After loadAssignedClasses() completes, call:
    initAttendanceUI({ assignedClasses, allPupils, currentUser })
- sectionLoaders object: import section loaders from feature modules rather
  than defining inline where possible
- window.paginateTable = paginateTable — keep this one window assignment so
  attendance-teacher-ui.js can call it (or pass it via initAttendanceUI)
- window.currentUser = user and window.assignedClasses = assignedClasses
  keep these two window assignments for backward compatibility with
  attendance and lesson notes modules that read them
- Export: currentUser, assignedClasses, allPupils, allSubjects, showSection,
  paginateTable, loadResultsTable, saveAllResults, saveAllAttendance,
  saveBulkTraitsAndSkills, saveRemarks (named exports)

File to create: portals/teacher.js
```

**Attach these old files:** `teacher.js`, `attendance-teacher-ui.js`

---

### FILE 19 — `portals/pupil.js`

**Prompt:**
```
Convert the pupil portal to an ES Module entry point.

Source: the attached pupil.js (full file).

This file is the entry point for pupil.html.

Imports needed:
  import { db } from '../db.js'
  import { auth } from '../auth.js'
  import { getCurrentSettings } from '../shared/settings.js'
  import { checkRole, logout } from '../auth.js'
  import { calculateCurrentOutstanding } from '../finance/outstanding.js'
  import { calculateCompleteArrears } from '../finance/fee-calculator.js'
  import { showToast, showLoading } from '../ui/toast.js'
  import { handleError } from '../shared/errors.js'

Key structural rules:
- module-level `let currentPupilId`, `let currentPupilData`,
  `let currentClassInfo` (no window assignments)
- The pupil-ui-patch.js MutationObserver code is merged directly into this
  module (at the end, in a DOMContentLoaded or load event) since it patches
  the DOM after pupil profile loads
- Export: loadFeeBalance, loadAllPaymentHistory, viewReceipt, loadSessionResults,
  scrollToFees (so pupil.html onclick attributes can call them)
- getGrade, getRemark inline (or import from shared/grade-utils.js if it exists)

File to create: portals/pupil.js
```

**Attach these old files:** `pupil.js`, `pupil-ui-patch.js` (the short IIFE at the bottom of the provided code)

---

### FILE 20 — `portals/print-results.js`

**Prompt:**
```
Convert the print results page to an ES Module entry point.

Source: the attached print-results.js (full file).

This file is the entry point for print-results.html.

Imports needed:
  import { db } from '../db.js'
  import { auth } from '../auth.js' (for firebase.auth().onAuthStateChanged)
  import { firebase } from '../firebase-config.js'

Key structural rules:
- module-level `let currentPupilId`, `let pupilProfile`, `let currentSettings`,
  `let isInitialized`
- The `initPrintResultsWrapper()` call at bottom becomes a top-level await
  or wraps in a DOMContentLoaded event
- All functions remain module-internal (not exported) except those called from
  HTML onchange attributes:
    export { loadReportData } (for the term selector onchange)
- getGrade, getRemark, abbreviateSubject, classNameToSlug inline

File to create: portals/print-results.js
```

**Attach these old files:** `print-results.js`

---

### FILE 21 — `features/cbt-teacher.js`

**Prompt:**
```
Convert the CBT teacher module to an ES Module.

Source: the attached cbt-teacher.js (full file).

The module should:
- Import `db` from ../db.js
- Import `firebase` from ../firebase-config.js
- Import `getCurrentSettings` from ../shared/settings.js
- Import `showToast` from ../ui/toast.js
- Export these as named exports:
    loadCbtSection
    showCbtCreateForm
    addCbtQuestion
    removeCbtQuestion
    saveCbtTest
    editCbtTest
    deleteCbtTest
    togglePublish
    viewCbtResults
- Internal: _cbtTestMap, cbtQuestionCount, cbtEditingTestId (module-level vars)
- escHtml and toDatetimeLocalString remain internal (unexported)
- window.assignedClasses is referenced — change to an imported let variable
  that is set by calling an exported init function:
    export function initCbt({ assignedClasses, currentUser })
- No `window` assignments except for exported functions that are called from
  HTML onclick attributes (add explicit export statements instead)

File to create: features/cbt-teacher.js
```

**Attach these old files:** `cbt-teacher.js`

---

### FILE 22 — `features/cbt-engine.js`

**Prompt:**
```
Convert the CBT pupil engine to an ES Module.

Source: the attached cbt-engine.js (full file).

This file runs on the CBT test-taking page (cbt-test.html).

The module should:
- Import `db` from ../db.js
- Import `firebase` from ../firebase-config.js (for auth and FieldValue)
- Keep module-level state variables (testData, questions, answers, etc.)
- Export these as named exports (called from HTML onclick attributes):
    startTest, nextQuestion, prevQuestion, toggleFlag,
    confirmSubmit, submitTest, showReview
- DOMContentLoaded initialization logic stays in module body (top-level await
  or the existing event listener)
- getGradeFromPct and showError remain internal
- No `window` assignments

File to create: features/cbt-engine.js
```

**Attach these old files:** `cbt-engine.js`

---

### FILE 23 — `features/lesson-notes-teacher.js`

**Prompt:**
```
Convert the teacher lesson notes module to an ES Module.

Source: the attached lesson-notes-teacher.js (v1.0.1, full file).

The module should:
- Import `db` from ../db.js
- Import `firebase` from ../firebase-config.js
- Import `getCurrentSettings` from ../shared/settings.js
- Import `showToast`, `handleError` from appropriate modules
- Accept assignedClasses and currentUser via an exported init function:
    export function initLessonNotes({ assignedClasses, currentUser })
- Export these as named exports (called from HTML onclick or sectionLoaders):
    loadLessonNotesSection
    lnOpenNewForm
    lnOpenEditForm
    lnCloseForm
    lnSaveNote
    lnSubmitNote
    lnPrintNote
    lnApplyFilters
    initLessonNotes
- Module-level state: _ln_currentDocId, _ln_currentStatus, _ln_isSaving,
  _ln_allNotes, _assignedClasses, _currentUser
- LN_TERMS, LN_MAX_WEEKS, LN_HISTORY_CAP, LN_CONTENT_FIELDS remain internal consts
- No `window` assignments

File to create: features/lesson-notes-teacher.js
```

**Attach these old files:** `lesson-notes-teacher.js`

---

### FILE 24 — `features/lesson-notes-admin.js`

**Prompt:**
```
Convert the admin lesson notes module to an ES Module.

Source: the attached lesson-notes-admin.js (full file).

The module should:
- Import `db` from ../db.js
- Import `auth` from ../auth.js
- Import `firebase` from ../firebase-config.js
- Import `showToast` from ../ui/toast.js
- Export these as named exports:
    loadLessonNotesAdminSection
    lnAdminApplyFilters
    lnAdminClearFilters
    lnAdminViewNote
    lnAdminApproveNote
    lnAdminRejectNote
    lnAdminPrintNote
- Module-level state: _allCalendarEntries (rename to _lnAdminAllNotes),
  window.paginateTable reference — change to imported paginateTable parameter
  or passed via init:
    export function initLessonNotesAdmin({ paginateTable })
- _lnWriteAudit and _lnAdminUpdateCache remain internal
- No `window` assignments

File to create: features/lesson-notes-admin.js
```

**Attach these old files:** `lesson-notes-admin.js`

---

### FILE 25 — `features/school-calendar.js`

**Prompt:**
```
Convert the school calendar module to an ES Module.

Source: the attached school-calendar-admin.js (full file).

The module should:
- Import `db` from ../db.js
- Import `auth` from ../auth.js
- Import `firebase` from ../firebase-config.js
- Import `getCurrentSettings` from ../shared/settings.js
- Import `showToast` from ../ui/toast.js
- Export the public API (previously window.schoolCalendar) as named exports:
    getNonSchoolDays(session, term)
    isSchoolDay(dateString, session, term)
    filterSchoolDays(dateStrings, session, term)
    getCalendarEntries(session, term)
- Export the admin section functions:
    loadSchoolCalendarSection()
    saveCalendarEntry()
    deleteCalendarEntry(docId, dateStr)
    applyCalendarFilter()
    exportCalendarCSV()
    toggleCalendarRange()
- Also export a default `schoolCalendar` namespace object containing the four
  public API functions (for use by attendance/daily.js)
- Module-level state: _allCalendarEntries, CALENDAR_COLLECTION, DAY_TYPES,
  NON_SCHOOL_TYPES
- No `window` assignments

File to create: features/school-calendar.js
```

**Attach these old files:** `school-calendar-admin.js`

---

### FILE 26 — `features/class-hierarchy.js`

**Prompt:**
```
Convert the class hierarchy modules to a single ES Module.

Source: BOTH attached files — class-hierarchy.js (the standalone module) and
the window.classHierarchy object defined inside admin.js.

Reconcile these two implementations:
- class-hierarchy.js has: getClassHierarchy, getAllClassesInOrder, getNextClass,
  isTerminalClass, getGradeLevel, saveClassHierarchy, initializeClassHierarchy
- admin.js's window.classHierarchy has: initializeClassHierarchy, getNextClass,
  isTerminalClass, saveClassHierarchy, getHierarchy

The admin.js versions are more battle-hardened (transaction-safe init, better
error handling). Use admin.js versions as the canonical implementation for
initializeClassHierarchy and saveClassHierarchy. Use class-hierarchy.js for
getAllClassesInOrder (it reads from classes collection, admin.js version differs).
For getNextClass and isTerminalClass, the admin.js versions are better.

The module should:
- Import `db` from ../db.js
- Import `auth` from ../auth.js (admin.js version of initializeClassHierarchy uses it)
- Export as named exports:
    initializeClassHierarchy
    saveClassHierarchy(orderedClassIds)
    getAllClassesInOrder()
    getNextClass(currentClassName)
    isTerminalClass(className)
    getGradeLevel(className)
    getHierarchy()
- Also export a default `classHierarchy` namespace object with all the above
- No `window` assignments

File to create: features/class-hierarchy.js
```

**Attach these old files:** `class-hierarchy.js`, `admin.js` (for the classHierarchy object section)

---

### FILE 27 — `features/remark-templates.js`

**Prompt:**
```
Convert the remark templates module to an ES Module.

Source: the attached remark-templates.js (full file).

The module should:
- Import `db` from ../db.js
- Import `getCurrentSettings` from ../shared/settings.js
- Import `auth` from ../auth.js
- Export as named exports:
    getRemarkSuggestions(pupilId, term)
    getTemplateForGrade(averageScore)
    calculatePupilAverage(pupilId, term)
    saveCustomTemplate(template, category)
    loadAllTemplates()
    TEMPLATES (the templates object, renamed from the internal `templates` property)
- Also export a default `remarkTemplates` namespace object for backward compat
- No `window` assignments

File to create: features/remark-templates.js
```

**Attach these old files:** `remark-templates.js`

---

### FILE 28 — `features/pupils-export.js`

**Prompt:**
```
Convert the pupils data export module to an ES Module.

Source: the attached pupils-export.js (full file).

The module should:
- Import `db` from ../db.js
- Import `showToast`, `handleError` from appropriate modules
- Export as named exports:
    exportPupilsToExcel()
    exportPupilsToPDF()
- Assumes XLSX (SheetJS) and jsPDF loaded via CDN script tags (global references)
- No `window` assignments

File to create: features/pupils-export.js
```

**Attach these old files:** `pupils-export.js`

---

### FILE 29 — `ui/button-loader.js`

**Prompt:**
```
Convert the global button loader to an ES Module.

Source: the attached button-loader.js (full file).

The module should:
- Zero Firebase dependencies
- Export as named exports:
    ButtonLoader  (the public API object with .start(), .wrap(), .register())
    init()        (the bootstrap function — also called automatically on import)
- ACTION_REGISTRY exported as a named const so portals can add to it:
    export const ACTION_REGISTRY = { ... }
- The auto-intercept (document.body.addEventListener) fires when the module
  is imported (in the init() call at the bottom)
- No `window` assignments except window.ButtonLoader — keep that one
  assignment since it's a developer utility

File to create: ui/button-loader.js
```

**Attach these old files:** `button-loader.js`

---

### FILE 30 — `ui/script.js`

**Prompt:**
```
Convert the public website JavaScript to an ES Module.

Source: the attached script.js (the v3.1 full replacement for the public site).

The module should:
- Zero Firebase dependencies
- Export as named exports:
    showToast(message, type, duration)  ← THIS is the canonical showToast
    showLoading(elementId, message)
    hideLoading(elementId)
    retryOperation(operation, maxRetries)  ← simple retry, no backoff
- All initialization functions (initNavigation, initScrollReveal, initCountUp,
  initTestimonialMarquee, initFAQ, initGalleryLightbox, initContactForm,
  initAdmissionsForm, initSmoothScroll) remain internal (not exported)
- The DOMContentLoaded block at the bottom runs all inits automatically on import
- window.showToast = showToast  — keep this one window assignment so inline
  HTML onclick handlers can still call window.showToast
- window.FahmidUtils = { debounce, throttle, announceToScreenReader }  — keep
- No other `window` assignments

File to create: ui/script.js

Note: This module is the source of showToast used by all other modules via
  import { showToast } from '../ui/toast.js'
The toast.js file should be a one-line re-export:
  export { showToast, showLoading, hideLoading } from './script.js'
This way ui/script.js is the true source and toast.js is just an alias.
```

**Attach these old files:** `script.js`

---

## HTML Script Tag Changes

After all modules are created, update each HTML file's `<script>` tags as follows.

Replace all `<script src="…">` for application JS with:

```html
<!-- Firebase SDK (stays as classic scripts — CDN compat SDK) -->
<script src="https://www.gstatic.com/firebasejs/9.x.x/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.x.x/firebase-auth-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.x.x/firebase-firestore-compat.js"></script>

<!-- Your ES modules -->
<script type="module" src="portals/admin.js"></script>
```

Each portal file imports everything it needs transitively — you do not need
to list all 30 modules in the HTML.

The public website HTML uses:
```html
<script type="module" src="ui/script.js"></script>
```

---

## Key Migration Rules (apply to every file)

1. **No `window.X = X`** except: `window.showToast`, `window.ButtonLoader`,
   `window.FahmidUtils`, `window.adminDebug`, `window.currentUser`,
   `window.assignedClasses` (teacher portal only — for legacy attendance UI).

2. **Circular dependencies** between fee-calculator.js and outstanding.js are
   broken via dependency injection (see FILE 8 and FILE 10 notes).

3. **`const db = window.db`** and **`const auth = window.auth`** patterns in
   admin.js/teacher.js are replaced by `import { db } from '../db.js'` etc.

4. **`firebase.firestore.FieldValue.serverTimestamp()`** — import `firebase`
   from firebase-config.js and use it directly.

5. **`firebaseConfig`** variable referenced in secondary auth IIFE in admin.js
   — import it from firebase-config.js.

6. **HTML onclick attributes** — functions called from onclick="" must still
   be reachable at call time. The cleanest ESM approach: the portal entry point
   imports them and re-assigns to window where needed, OR the HTML is refactored
   to use addEventListener. For this project, re-assigning to window in the
   portal entry point is acceptable and lower risk.

7. **`'use strict'`** — remove from all files (ESM is always strict).

8. **Service worker** — keep service-worker.js as a classic script. It uses
   `self` and cannot be a true ESM (though Chrome supports `type: module` in
   SW, it complicates things and the existing SW logic is fine as-is).
