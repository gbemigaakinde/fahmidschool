# ES Module Refactoring Guide — Fahmid Nursery & Primary School Portal
## Version 2.0 — Complete & Accurate (Based on Full Code Analysis)

---

## What Changed From the Old Guide

After reading every line of every file, the old guide had these gaps:
- `admin.js` alone has **~10,000 lines** split across ~80 distinct feature areas — the old guide treated it as one file
- Several shared utility modules were missing entirely (`grade-utils.js`, `utils.js`)
- The `finance.js` object and `admin.js` finance functions overlapped without a clear split plan
- Migration helpers (`migrateArrearsOnTermChange`, `ensureAllPupilsHavePaymentRecords`, etc.) had no home
- The admin portal needed **sub-modules** by feature area, not one monolithic entry point
- `ui/toast.js` was mentioned but never given a prompt
- `results/approvals.js` covered only part of the result workflow; the full unlock/preview logic was missing
- `features/promotions.js` existed in admin.js but had no dedicated module prompt
- The `session-cache.js` and `pupil-ui-patch.js` inline blocks needed explicit treatment

---

## Final Module Tree (50 files)

```
firebase-config.js
db.js
auth.js

shared/
  errors.js
  settings.js
  session-encoding.js
  retry.js
  grade-utils.js
  utils.js

finance/
  fee-calculator.js
  outstanding.js
  payment-recorder.js
  reports.js
  migration.js
  pdf-report.js

results/
  locking.js
  approvals.js

attendance/
  daily.js
  teacher-ui.js

admin/
  index.js              ← entry point for admin.html (imports + wires everything)
  auth-setup.js         ← secondary auth IIFE + createSecondaryUser
  sidebar.js            ← setupSidebarNavigation, showSection, loadSectionData
  dashboard.js          ← loadDashboardStats
  teachers.js           ← loadTeachers, editTeacher, showTeacherForm, exportTeachersPDF
  pupils.js             ← loadPupils, editPupil, showPupilForm, bulk ops
  classes.js            ← loadClasses, addClass, subjects, teacher assignment
  announcements.js      ← loadAdminAnnouncements, addAnnouncement
  alumni.js             ← loadAlumni, deleteAlumni, filterAlumni
  audit-log.js          ← loadAuditLog, filterAuditLog, viewAuditDetails, downloadAuditLog
  settings-section.js   ← loadCurrentSettings, updateSessionSettings, loadSessionHistory
  hierarchy-ui.js       ← loadClassHierarchyUI, renderHierarchyUI, drag-drop
  promotions.js         ← full promotion request management
  view-results.js       ← loadViewResultsSection, loadPupilResults, session comparison
  fee-management.js     ← fee structure CRUD, loadFeeManagementSection
  payment-management.js ← loadPaymentRecordingSection, loadPupilPaymentStatus, recordPayment
  data-export.js        ← exportTeachersPDF (admin), exportPupilResults (admin)
  delete-item.js        ← deleteItem with payment protection
  pagination.js         ← paginateTable

portals/
  admin.js              ← thin entry point (imports admin/* + features/*)
  teacher.js
  pupil.js
  print-results.js

features/
  cbt-teacher.js
  cbt-engine.js
  lesson-notes-teacher.js
  lesson-notes-admin.js
  school-calendar.js
  class-hierarchy.js
  remark-templates.js
  pupils-export.js

ui/
  toast.js
  button-loader.js
  script.js
```

---

## Complete File Index (50 files)

| # | File | Primary Source | Key Exports |
|---|------|---------------|-------------|
| 1 | `firebase-config.js` | firebase-init.js | `firebaseConfig`, default `firebase` |
| 2 | `db.js` | firebase-init.js | `db`, `firestoreGet/Set/Update/Delete` |
| 3 | `auth.js` | firebase-init.js | `auth`, `checkRole`, `login`, `logout`, `getUserRole` |
| 4 | `shared/errors.js` | firebase-init.js | `ERROR_MESSAGES`, `handleError` |
| 5 | `shared/settings.js` | firebase-init.js + session-cache.js | `getCurrentSettings`, `SessionCache` |
| 6 | `shared/session-encoding.js` | firebase-init.js | `encodeSession`, `decodeSession`, `generatePaymentDocId`, `generateFeeStructureDocId` |
| 7 | `shared/retry.js` | firebase-init.js | `retryWithBackoff` |
| 8 | `shared/grade-utils.js` | admin.js + teacher.js + pupil.js | `getGrade`, `getRemark`, `getGradeFromScore` |
| 9 | `shared/utils.js` | script.js + admin.js | `debounce`, `throttle`, `sleep`, `announceToScreenReader` |
| 10 | `finance/fee-calculator.js` | admin.js + finance.js | `calculateAdjustedFee`, `calculateCompleteArrears`, `getPreviousSessionName` |
| 11 | `finance/outstanding.js` | admin.js + finance.js | `calculateCurrentOutstanding` |
| 12 | `finance/payment-recorder.js` | finance.js | `recordPayment`, `generateReceiptNumber` |
| 13 | `finance/reports.js` | admin.js | `loadOutstandingFeesReport`, `loadFinancialReports`, `updateFinancialDisplays`, `updateSummaryDisplay` |
| 14 | `finance/migration.js` | admin.js | `migrateArrearsOnTermChange`, `migrateArrearsToNewSession`, `ensureAllPupilsHavePaymentRecords`, `generatePaymentRecordsForClass`, `migratePaymentRecordsToAdjustedFees`, `backfillSessionData` |
| 15 | `finance/pdf-report.js` | financial-report-generator.js | `generateComprehensiveFinancialReport` |
| 16 | `results/locking.js` | result-locking.js | `isLocked`, `lockResults`, `unlockResults`, `submitForApproval`, `approveResults`, `rejectResults`, default `resultLocking` |
| 17 | `results/approvals.js` | admin.js | `loadResultApprovals`, `approveResultSubmission`, `rejectResultSubmission`, `unlockApprovedResult`, `switchResultApprovalsTab`, `toggleResultPreview`, `computePreviewStats`, `approveAllPendingResults`, `toggleAllResultsSelection`, `updateResultsBulkButtons` |
| 18 | `attendance/daily.js` | attendance-daily.js | `markDailyAttendance`, `recalculateCumulativeTotals`, `fetchAttendanceGrid`, date utils, default `dailyAttendance` |
| 19 | `attendance/teacher-ui.js` | attendance-teacher-ui.js | `loadAttendanceSectionEnhanced`, `initAttendanceUI`, `saveModalAttendance`, `togglePupilStatusInDay`, `printAttendanceRegister` |
| 20 | `admin/auth-setup.js` | admin.js (IIFE section) | `createSecondaryUser`, `initSecondaryAuth` |
| 21 | `admin/sidebar.js` | admin.js | `setupSidebarNavigation`, `showSection`, `loadSectionData` |
| 22 | `admin/dashboard.js` | admin.js | `loadDashboardStats` |
| 23 | `admin/teachers.js` | admin.js | `loadTeachers`, `editTeacher`, `showTeacherForm`, `cancelTeacherForm`, `filterTeachers`, `renderTeachersTable`, `toggleDirectPublish` |
| 24 | `admin/pupils.js` | admin.js | `loadPupils`, `editPupil`, `showPupilForm`, `cancelPupilForm`, `filterPupils`, `renderPupilsTable`, `setupBulkActionsEventListeners`, `updateBulkActionButtons`, `applyBulkAction`, `bulkReassignClass`, `bulkDeletePupils`, `populateClassDropdown` |
| 25 | `admin/classes.js` | admin.js | `loadClasses`, `addClass`, `showClassForm`, `loadSubjects`, `addSubject`, `showSubjectForm`, `openSubjectAssignmentModal`, `closeSubjectAssignmentModal`, `saveClassSubjects`, `loadTeacherAssignments`, `assignTeacherToClass`, `unassignTeacher` |
| 26 | `admin/announcements.js` | admin.js | `loadAdminAnnouncements`, `addAnnouncement`, `showAnnounceForm` |
| 27 | `admin/alumni.js` | admin.js | `loadAlumni`, `deleteAlumni`, `filterAlumni`, `renderAlumniTable` |
| 28 | `admin/audit-log.js` | admin.js | `loadAuditLog`, `filterAuditLog`, `renderAuditLogTable`, `viewAuditDetails`, `downloadAuditLog`, `getActionBadge` |
| 29 | `admin/settings-section.js` | admin.js | `loadCurrentSettings`, `updateSessionSettings`, `loadSessionHistory`, `confirmStartNewSession`, `startNewSession` |
| 30 | `admin/hierarchy-ui.js` | admin.js | `loadClassHierarchyUI`, `renderHierarchyUI`, `renderEmptyHierarchyUI`, `saveHierarchyOrder`, `refreshHierarchyUI` |
| 31 | `admin/promotions.js` | admin.js | `loadPromotionRequests`, `loadPromotionPeriodStatus`, `togglePromotionPeriod`, `viewPromotionDetails`, `closePromotionDetailsModal`, `approvePromotion`, `executePromotion`, `rejectPromotion`, `quickApprovePromotion`, `quickRejectPromotion`, `approveAllPendingPromotions`, `rejectAllPendingPromotions`, `addManualOverride`, `removeManualOverride`, `renderManualOverrides` |
| 32 | `admin/view-results.js` | admin.js | `loadViewResultsSection`, `loadPupilResults`, `loadFilteredClasses`, `loadFilteredPupils`, `populateSessionFilter`, `renderResultsDisplay`, `loadSessionComparison`, `toggleSessionComparison`, `clearResultsFilter`, `exportPupilResults` |
| 33 | `admin/fee-management.js` | admin.js | `loadFeeManagementSection`, `loadFeeStructures`, `saveFeeStructure`, `editFeeStructure`, `deleteFeeStructure`, `fixDuplicateFees`, `populateFeeClassSelector` |
| 34 | `admin/payment-management.js` | admin.js | `loadPaymentRecordingSection`, `loadPupilsForPayment`, `loadPupilPaymentStatus`, `loadPaymentHistory`, `recordPayment`, `printReceipt`, `populatePaymentClassFilter` |
| 35 | `admin/data-export.js` | admin.js | `exportPupilResults` (admin side), `exportPupilsData`, `exportResultsData`, `downloadCSV` |
| 36 | `admin/delete-item.js` | admin.js | `deleteItem` |
| 37 | `admin/pagination.js` | admin.js | `paginateTable` |
| 38 | `admin/index.js` | admin.js (wiring only) | (imports + re-exports all admin/* modules, wires DOMContentLoaded) |
| 39 | `portals/admin.js` | admin.js (thin shell) | (imports admin/index.js + all features, exposes window globals) |
| 40 | `portals/teacher.js` | teacher.js | (full teacher portal entry) |
| 41 | `portals/pupil.js` | pupil.js + pupil-ui-patch.js | (full pupil portal entry) |
| 42 | `portals/print-results.js` | print-results.js | (print results page) |
| 43 | `features/cbt-teacher.js` | cbt-teacher.js | `loadCbtSection`, `saveCbtTest`, `deleteCbtTest`, etc. |
| 44 | `features/cbt-engine.js` | cbt-engine.js | `startTest`, `submitTest`, `showReview`, etc. |
| 45 | `features/lesson-notes-teacher.js` | lesson-notes-teacher.js | `loadLessonNotesSection`, `lnSaveNote`, `lnSubmitNote`, etc. |
| 46 | `features/lesson-notes-admin.js` | lesson-notes-admin.js | `loadLessonNotesAdminSection`, `lnAdminApproveNote`, etc. |
| 47 | `features/school-calendar.js` | school-calendar-admin.js | `getNonSchoolDays`, `loadSchoolCalendarSection`, default `schoolCalendar` |
| 48 | `features/class-hierarchy.js` | class-hierarchy.js + admin.js | `initializeClassHierarchy`, `getNextClass`, `isTerminalClass`, default `classHierarchy` |
| 49 | `features/remark-templates.js` | remark-templates.js | `getRemarkSuggestions`, default `remarkTemplates` |
| 50 | `features/pupils-export.js` | pupils-export.js | `exportPupilsToExcel`, `exportPupilsToPDF` |
| 51 | `ui/toast.js` | script.js (re-export) | `showToast`, `showLoading`, `hideLoading` |
| 52 | `ui/button-loader.js` | button-loader.js | `ButtonLoader`, `ACTION_REGISTRY`, `init` |
| 53 | `ui/script.js` | script.js | `showToast`, public website UI |

> Total: **53 files**. The split of admin.js into sub-modules (`admin/*`) is the most important architectural decision — it makes each AI prompt tractable and keeps each file under ~400 lines.

---

## Dependency Injection Pattern (Circular Dep Fix)

`finance/fee-calculator.js` → calls `calculateCurrentOutstanding` (in `finance/outstanding.js`)
`finance/outstanding.js` → calls `calculateCompleteArrears` (in `finance/fee-calculator.js`)

**Solution:** Both files accept the cross-dependency as a parameter with a fallback:

```js
// In fee-calculator.js:
export async function calculateCompleteArrears(
  pupilId, session, term,
  { calculateCurrentOutstanding } = {}
) {
  // When calling calculateCurrentOutstanding is needed:
  if (typeof calculateCurrentOutstanding === 'function') {
    const result = await calculateCurrentOutstanding(pupilId, session, term);
    return result.balance || 0;
  }
  // Fallback when injection not provided:
  return await _recalculateTermBalance(pupilId, session, term);
}

// In outstanding.js — import fee-calculator and pass itself:
import { calculateCompleteArrears as _calcArrears } from './fee-calculator.js';
import { calculateCurrentOutstanding as _self } from './outstanding.js'; // NOT needed
// Instead: pass self inline when calling _calcArrears:
const arrears = await _calcArrears(pupilId, session, term, {
  calculateCurrentOutstanding  // reference to the locally-defined function
});
```

This completely avoids the circular import while preserving all logic.

---

## Key Migration Rules (Apply to Every File)

1. **Remove `'use strict'`** — ESM is always strict mode.
2. **`const db = window.db`** → `import { db } from '../db.js'`
3. **`const auth = window.auth`** → `import { auth } from '../auth.js'`
4. **`firebase.firestore.FieldValue.serverTimestamp()`** → use `firebase` imported from `../firebase-config.js` (the compat SDK global is still available, but explicit import is cleaner)
5. **`window.X = X`** at the bottom of old files → use `export function X` or `export { X }` instead. Keep **only these window assignments**:
   - `window.showToast` (needed by legacy inline onclick on public pages)
   - `window.ButtonLoader` (developer tool)
   - `window.FahmidUtils` (developer tool)
   - `window.adminDebug` (developer tool)
   - `window.currentUser` and `window.assignedClasses` (teacher portal: needed by attendance-teacher-ui.js)
6. **HTML `onclick="fnName()"`** — the portal entry point (`portals/admin.js`, etc.) imports all needed functions and explicitly re-assigns them to `window` so inline handlers keep working. This is the pragmatic choice for an existing codebase. Add a comment: `// For HTML onclick= compatibility`.
7. **`getAllTeachers`** — defined in `firebase-init.js`, move to `auth.js` or a new `shared/teachers-api.js`.
8. **`getGrade` / `getRemark`** — defined independently in `admin.js`, `teacher.js`, `pupil.js`, and `print-results.js` with identical logic. Consolidate in `shared/grade-utils.js` and import everywhere.
9. **`paginateTable`** — defined separately in `admin.js` and `teacher.js` with slightly different signatures (`admin.js` uses `tbodyId` as a plain ID string targeting `<tbody>` directly; `teacher.js` targets `#id tbody`). Reconcile in `admin/pagination.js`: accept both forms.
10. **`sleep(ms)`** — defined in `print-results.js`. Move to `shared/utils.js`.
11. **CDN globals** (jsPDF, XLSX, Chart.js, lucide) — these load via `<script>` tags before the module. Reference them as globals inside the module. Do NOT try to import them.
12. **Firebase compat SDK** — stays as CDN classic `<script>` tags. The `firebase` global is available to all ESM files in the same page.

---

## Prompts for AI-Assisted Production

Each prompt is self-contained. Paste into a fresh conversation with only the listed old files attached.

---

### FILE 1 — `firebase-config.js`

```
Convert the Firebase configuration to an ES Module.
Extract ONLY the firebaseConfig object and the one-time initialization guard
from firebase-init.js. Do not include auth, Firestore, session, or any helper
logic — those belong in other files.

The module should:
- Export a named const `firebaseConfig` (the config object)
- Call firebase.initializeApp(firebaseConfig) with the if (!firebase.apps.length) guard
- Export `firebase` as a named export (the global compat SDK object, typed as the
  already-initialized app reference)
- Under 30 lines total
- No window assignments

Assume the Firebase compat SDK (firebase-app-compat, firebase-auth-compat,
firebase-firestore-compat) is loaded via CDN <script> tags before this module.
The global `firebase` object is therefore available.

File to create: firebase-config.js
```
**Attach:** `firebase-init.js`

---

### FILE 2 — `db.js`

```
Convert Firestore helpers to an ES Module.

The module should:
- Import { firebase } from './firebase-config.js'
- Export `db` as the firestore instance: export const db = firebase.firestore()
- Enable offline persistence in the module body, silently catching errors
  (failed-precondition = multiple tabs, unimplemented = browser doesn't support)
- Export four convenience wrappers as named async functions:
    firestoreGet(ref, operationName = 'Fetch document')
    firestoreSet(ref, data, options = null, operationName = 'Save document')
    firestoreUpdate(ref, data, operationName = 'Update document')
    firestoreDelete(ref, operationName = 'Delete document')
  Each wrapper calls retryWithBackoff from ./shared/retry.js — stub that import
  with: import { retryWithBackoff } from './shared/retry.js'
- No window assignments

File to create: db.js
```
**Attach:** `firebase-init.js`

---

### FILE 3 — `auth.js`

```
Convert Firebase Auth helpers to an ES Module.

The module should:
- Import { firebase } from './firebase-config.js'
- Import { handleError } from './shared/errors.js'
- Import { showToast } from './ui/toast.js'
- Export `auth` as: export const auth = firebase.auth()
- Export these named functions (full implementations from firebase-init.js):
    getUserRole(uid)                     → async, reads users/{uid}.data.role
    checkRole(requiredRole)              → returns Promise<{uid, email, role}>
    login(email, password)               → async
    logout()                             → async
    getAllTeachers()                      → async (currently in firebase-init.js)
    resetSessionTimeout()                → internal helper, export for testing
- Session timeout tracking (SESSION_TIMEOUT_MS = 8 * 60 * 60 * 1000) wires up
  inside the module body via auth.onAuthStateChanged — no factory needed
- Activity event listeners (mousedown, keydown, etc.) attached in module body
- No window assignments

File to create: auth.js
```
**Attach:** `firebase-init.js`

---

### FILE 4 — `shared/errors.js`

```
Convert error handling utilities to an ES Module.

The module should:
- Import { showToast } from '../ui/toast.js'
- Export ERROR_MESSAGES as a named const (the full object from firebase-init.js)
- Export handleError(error, fallbackMessage) as a named async-capable function
  (it calls showToast and may redirect to login.html for unauthenticated errors)
- No window assignments

File to create: shared/errors.js
```
**Attach:** `firebase-init.js`

---

### FILE 5 — `shared/settings.js`

```
Convert getCurrentSettings and the session cache to an ES Module.

The module should:
- Import { db } from '../db.js'
- Merge the SessionCache from session-cache.js with the getCurrentSettings from
  firebase-init.js. The canonical implementation is:
    - SessionCache.getSettings() IS getCurrentSettings with a 5-minute cache layer
    - The cache stores the full settings object (term, session, currentSession,
      resumptionDate, promotionPeriodActive)
    - Cache is invalidated after 5 minutes (CACHE_DURATION = 5 * 60 * 1000)
- Export getCurrentSettings as a named async function that delegates to
  SessionCache.getSettings() — this is the function all other modules import
- Export SessionCache as a named object:
    { getSettings, getAllSessions, clearCache, getStatus }
- getAllSessions fetches from the `sessions` collection and prepends the current
  session as the first option (value: 'current')
- Default settings object if none configured:
    { term: 'First Term', session: '2025/2026',
      currentSession: { name, startYear: 2025, endYear: 2026, startDate: null, endDate: null },
      resumptionDate: null, promotionPeriodActive: false }
- No window assignments

File to create: shared/settings.js
```
**Attach:** `firebase-init.js`, `session-cache.js`

---

### FILE 6 — `shared/session-encoding.js`

```
Convert session encoding utilities to a tiny ES Module.

Source: firebase-init.js — the four functions at the bottom.

Export as named functions (zero dependencies, pure strings):
  encodeSession(session)            → replaces '/' with '-'
  decodeSession(encodedSession)     → replaces '-' with '/'
  generatePaymentDocId(pupilId, session, term)
  generateFeeStructureDocId(classId, session, term)

Under 25 lines. No window assignments.

File to create: shared/session-encoding.js
```
**Attach:** `firebase-init.js`

---

### FILE 7 — `shared/retry.js`

```
Convert the retry/backoff helper to an ES Module.

Source: firebase-init.js — the retryWithBackoff function.

The module should:
- Import { showToast } from '../ui/toast.js'
- Export retryWithBackoff(operation, maxRetries = 3, operationName = 'Operation')
  as a named async function — full implementation preserved:
    - Detects retryable errors (unavailable, deadline-exceeded, cancelled, network/timeout)
    - Exponential backoff: 1s → 2s → 4s → 8s (capped at 8s)
    - Shows toast on retry attempts and on final failure
- No window assignments

File to create: shared/retry.js
```
**Attach:** `firebase-init.js`

---

### FILE 8 — `shared/grade-utils.js`

```
Create a new shared utility module for grade calculations.

This module consolidates identical grade/remark functions defined separately
in admin.js, teacher.js, pupil.js, and print-results.js.

The module should export:

  getGrade(score)       → returns string: 'A1'|'B2'|'B3'|'C4'|'C5'|'C6'|'D7'|'D8'|'F9'
  getRemark(score)      → returns string: 'Excellent'|'Very Good'|'Good'|'Credit'|'Pass'|'Fail'
  getGradeFromScore(score)  → identical to getGrade (alias used in teacher.js for promotions)

Grade scale (from all four source files — they are identical):
  >= 75 → A1 / Excellent
  >= 70 → B2 / Very Good
  >= 65 → B3 / Good
  >= 60 → C4 / Credit
  >= 55 → C5 / Credit
  >= 50 → C6 / Credit
  >= 45 → D7 / Pass
  >= 40 → D8 / Pass
   < 40 → F9 / Fail

Zero dependencies. Under 40 lines. No window assignments.

File to create: shared/grade-utils.js
```
**Attach:** `admin.js` (grep for getGrade), `teacher.js`, `pupil.js`, `print-results.js`

---

### FILE 9 — `shared/utils.js`

```
Create a shared utility module for general-purpose helpers.

Collect these functions from their various sources:

From script.js:
  debounce(fn, delay)                      → returns debounced function
  throttle(fn, limit)                      → returns throttled function
  announceToScreenReader(message, priority) → creates ARIA live region

From print-results.js:
  sleep(ms)                                → returns Promise that resolves after ms

All are pure functions with zero dependencies. Under 50 lines.

Export all four as named functions. No window assignments
(window.FahmidUtils is assigned in ui/script.js, not here).

File to create: shared/utils.js
```
**Attach:** `script.js`, `print-results.js`

---

### FILE 10 — `finance/fee-calculator.js`

```
Convert fee calculation functions to an ES Module.

Source functions: admin.js (the top-level window-assigned versions — these are
the canonical fixed versions; they shadow the finance.js object methods which
have the same logic).

The module should:
- Import { db } from '../db.js'
- Export these named functions:

  calculateAdjustedFee(pupilData, baseFee, currentTerm)
    → Applies feeAdjustmentPercent and feeAdjustmentAmount to baseFee
    → Checks admissionTerm / exitTerm enrollment period
    → Returns Math.max(0, adjustedFee)
    → All amounts rounded to whole naira (Math.round)

  calculateCompleteArrears(pupilId, currentSession, currentTerm, { calculateCurrentOutstanding } = {})
    → DEPENDENCY INJECTION: accepts calculateCurrentOutstanding as an optional
      injection to break the circular dependency with finance/outstanding.js
    → First Term: reads previous session Third Term balance
    → Second/Third Term: reads previous term payment doc balance
    → When a payment doc is missing, falls back to the injected
      calculateCurrentOutstanding if available, else _recalculateTermBalance
    → Uses wasEnrolledIn() (internal helper — do not export) to check admissionSession

  _recalculateTermBalance(pupilId, session, term)
    → Resolves historical classId from payment_transactions first, then falls
      back to current pupilData.class.id
    → Resolves historical baseFee from payment_transactions first, then falls
      back to current fee_structures doc
    → Returns Math.max(0, amountDue - totalPaid) for just that one term
    → Export this (admin.js and finance.js both expose it on window)

  getPreviousSessionName(currentSession)
    → Pure string: "2025/2026" → "2024/2025"
    → Export this

  calculateSessionBalanceSafe(pupilId, session)
    → Tries Third Term → Second Term → First Term payment docs in order
    → Falls back to _recalculateTermBalance for Third Term if no docs found
    → Export this

Preserve ALL console.log debugging statements exactly.
Preserve the wasEnrolledIn() logic that checks admissionSession vs checkSession
by start year comparison.

No window assignments.

File to create: finance/fee-calculator.js
```
**Attach:** `admin.js`, `finance.js`

---

### FILE 11 — `finance/outstanding.js`

```
Convert calculateCurrentOutstanding to an ES Module.

Use the finance.js version as canonical (it has the most complete fixes
including credit/overpaid status).

The module should:
- Import { db } from '../db.js'
- Import { calculateAdjustedFee, calculateCompleteArrears, getPreviousSessionName }
    from './fee-calculator.js'
- Define calculateCurrentOutstanding(pupilId, session, term) as an async function
- CIRCULAR DEP FIX: after defining calculateCurrentOutstanding, when calling
  calculateCompleteArrears pass it as the injection:
    const arrears = await calculateCompleteArrears(pupilId, session, term, {
      calculateCurrentOutstanding
    });
- Logic to preserve:
    - Alumni / inactive → return reason: 'Alumni — not an active pupil'
    - No class → return reason: 'No class assigned'
    - No fee structure → return reason: 'No fee structure configured for this class'
    - amountDue === 0 && baseFee > 0 → return reason: 'Not enrolled for this term'
    - rawBalance < 0 → status: 'overpaid', credit: Math.abs(rawBalance)
    - Returns full object: { pupilId, pupilName, classId, className, session, term,
        baseFee, amountDue, arrears, totalDue, totalPaid, balance, credit, status }
- Export calculateCurrentOutstanding as named export
- No window assignments

File to create: finance/outstanding.js
```
**Attach:** `admin.js`, `finance.js`

---

### FILE 12 — `finance/payment-recorder.js`

```
Convert payment recording logic to an ES Module.

Source: finance.js — the recordPayment and generateReceiptNumber methods.

The module should:
- Import { db } from '../db.js'
- Import { auth } from '../auth.js'
- Import { calculateAdjustedFee, calculateCompleteArrears } from './fee-calculator.js'
- Import { calculateCurrentOutstanding } from './outstanding.js'
- Export recordPayment(pupilId, pupilName, classId, className, session, term, paymentData)
  as a named async function — preserve ALL of:
    - Round amountPaid with Math.round after parseFloat (FIX 2 from finance.js)
    - Fresh fee recalculation (do NOT read stored amountDue from payment doc)
    - Fresh arrears recalculation (do NOT read stored arrears from payment doc)
    - Overpayment prevention with ROUNDING_TOLERANCE = 1
    - Detailed error message showing full financial breakdown on overpayment
    - Payment allocation: arrears first, then current term
    - Atomic Firestore transaction writing both payment doc and transaction doc
    - Original arrears and totalDue stored in payment doc (never reduced) — FIX 1
    - balanceBefore and balanceAfter stored in transaction doc
- Export generateReceiptNumber() as a named async function
  (uses a counters/{date} document with transaction for increment)
- No window assignments

File to create: finance/payment-recorder.js
```
**Attach:** `finance.js`

---

### FILE 13 — `finance/reports.js`

```
Convert financial reporting section loaders to an ES Module.

Source: admin.js — the following functions:
  loadOutstandingFeesReport()
  loadFinancialReports()
  updateSummaryDisplay(count, total)
  updateFinancialDisplays(totalExpected, totalCollected, totalOutstanding,
    collectionRate, paidInFull, partialPayments, noPayment, session, term)
  exportFinancialReport(format)
  exportFinancialCSV(session, term)
  exportFinancialPDF(session, term)

The module should:
- Import { db } from '../db.js'
- Import { getCurrentSettings } from '../shared/settings.js'
- Import { calculateCurrentOutstanding } from './outstanding.js'
- Import { showToast } from '../ui/toast.js'
- Export all seven functions listed above as named exports
- Preserve these specific fixes from admin.js:
    FIX 5: Alumni with outstanding balances shown in separate table section
    FIX 6: Two separate collection rates (current-term rate and overall rate);
            looks for element 'report-current-term-collection-rate' in DOM
    Credit/overpaid pupils logged in console only (not shown in report table)
- The CSV and PDF exports use calculateCurrentOutstanding per pupil (not stored values)
- PDF export assumes jsPDF loaded via CDN (window.jspdf global)
- No window assignments

File to create: finance/reports.js
```
**Attach:** `admin.js`

---

### FILE 14 — `finance/migration.js`

```
Convert financial migration helpers to an ES Module.

Source: admin.js — the following functions:
  migrateArrearsOnTermChange(oldTerm, newTerm, session)
  migrateArrearsToNewSession()              ← the button handler (calls migrateArrearsToNewSession internally)
  ensureAllPupilsHavePaymentRecords()
  generatePaymentRecordsForClass(classId, className, session, term, totalFee)
  migratePaymentRecordsToAdjustedFees()
  backfillSessionData()
  calculateSessionBalance(pupilId, session)  ← private helper that delegates to calculateSessionBalanceSafe

The module should:
- Import { db } from '../db.js'
- Import { auth } from '../auth.js'
- Import { firebase } from '../firebase-config.js'
- Import { getCurrentSettings } from '../shared/settings.js'
- Import { calculateAdjustedFee, calculateCompleteArrears,
    calculateSessionBalanceSafe, getPreviousSessionName } from './fee-calculator.js'
- Import { calculateCurrentOutstanding } from './outstanding.js'
- Import { showToast } from '../ui/toast.js'
- Export all six public functions as named exports
- Preserve all batch commit logic with BATCH_SIZE = 400 and batch renewal
  (admin.js had a bug where batch was declared with const — the fixed version
  uses let so it can be renewed; preserve the let version)
- migrateArrearsOnTermChange: two-phase migration —
    Phase 1: ensure previous term docs exist with valid balance fields
    Phase 2: create new term payment docs using calculateCompleteArrears
- ensureAllPupilsHavePaymentRecords: uses two sequential Firestore transactions
  (FIX 7 from admin.js) to prevent concurrent duplicate creation
- No window assignments

File to create: finance/migration.js
```
**Attach:** `admin.js`

---

### FILE 15 — `finance/pdf-report.js`

```
Convert the comprehensive financial PDF generator to an ES Module.

Source: financial-report-generator.js (entire file).

The module should:
- Import { db } from '../db.js'
- Import { getCurrentSettings } from '../shared/settings.js'
- Import { calculateCurrentOutstanding } from './outstanding.js'
- Import { showToast } from '../ui/toast.js'
- Export generateComprehensiveFinancialReport() as the only named export
- Keep gatherFinancialData, performFinancialAnalysis, generateCharts,
  createPDFReport as internal unexported functions
- Chart generation: CRITICAL FIX — the canvas must be appended to document.body
  (position fixed off-screen) before creating Chart instances, then removed
  after all charts are captured as data URLs. The original file has this fix
  already — preserve it exactly.
- Assumes jsPDF and Chart.js loaded via CDN (window.jspdf and window.Chart globals)
- No window assignments

File to create: finance/pdf-report.js
```
**Attach:** `financial-report-generator.js`

---

### FILE 16 — `results/locking.js`

```
Convert the result locking module to an ES Module.

Source: result-locking.js (entire file).

The module should:
- Import { db } from '../db.js'
- Import { firebase } from '../firebase-config.js'
- Export each method as a named export:
    isLocked(classId, term, subject, session)
    lockResults(classId, className, term, subject, session, adminUid)
    unlockResults(classId, className, term, subject, session, adminUid, reason)
    getSubmittedResults()
    submitForApproval(classId, term, subject, session, teacherUid, teacherName)
    approveResults(submissionId, adminUid)
    rejectResults(submissionId, adminUid, reason)
- Also export a default `resultLocking` namespace object containing the same functions
  (for import { resultLocking } from '../results/locking.js' usage in portals)
- Preserve the IDEMPOTENCY GUARD in approveResults (Firestore transaction that
  atomically sets status to 'approving' before proceeding)
- isLocked: on permission-denied, return { locked: false, note: '...' }
  (do NOT throw — the teacher portal treats permission-denied as "no lock exists")
- No window assignments

File to create: results/locking.js
```
**Attach:** `result-locking.js`

---

### FILE 17 — `results/approvals.js`

```
Convert the admin result approvals UI to an ES Module.

Source: admin.js — these functions and state:
  State: let _resultApprovalsTab = 'pending'
  loadResultApprovals()
  _loadPendingResults()
  _loadApprovedResults()
  _ensureTabBar()
  _tabBtnStyle(active)
  switchResultApprovalsTab(tab)
  approveResultSubmission(submissionId)
  rejectResultSubmission(submissionId)
  unlockApprovedResult(submissionId)
  approveAllPendingResults()
  _approveSubmissionSilently(submissionId, submissionDataHint)
  toggleAllResultsSelection(masterCheckbox)
  updateResultsBulkButtons()
  toggleResultPreview(submissionId, classId, term, subject, session, className)
  computePreviewStats(drafts)
  renderResultPreviewPanel(stats, meta)

The module should:
- Import { db } from '../db.js'
- Import { auth } from '../auth.js'
- Import { firebase } from '../firebase-config.js'
- Import { showToast } from '../ui/toast.js'
- Import { getGrade, getRemark } from '../shared/grade-utils.js'
- Export all functions listed above as named exports
- Preserve the IDEMPOTENCY GUARD in approveResultSubmission:
    Firestore transaction atomically sets status to 'approving'; rollback to
    'pending' in the finally block on any error
- unlockApprovedResult: revert results collection docs to status:'draft',
  revert submission to status:'rejected', write audit_log entry
- computePreviewStats and renderResultPreviewPanel: the full chart/stat
  panel HTML builder — preserve exactly including grade color coding,
  sparkline bars, pass/fail bar, recommendation banner
- No window assignments

File to create: results/approvals.js
```
**Attach:** `admin.js`

---

### FILE 18 — `attendance/daily.js`

```
Convert the daily attendance data module to an ES Module.

Source: attendance-daily.js (entire file).

The module should:
- Import { db } from '../db.js'
- Import { firebase } from '../firebase-config.js'
- Import { getCurrentSettings } from '../shared/settings.js'
- Import { schoolCalendar } from '../features/school-calendar.js' (stub if needed)
- Export these as named exports:
    markDailyAttendance(classId, date, term, session, teacherId, records, pupils)
    updatePupilAttendanceForDay(classId, date, term, session, teacherId, pupilId, newStatus, pupils)
    deleteDailyAttendance(classId, date, term, session, teacherId, pupils)
    recalculateCumulativeTotals(classId, term, session, teacherId, pupils)
    fetchAttendanceGrid(classId, term, session, startDate, endDate)
    generateWeeklySummary(weekDates, dailyRecords, pupils)
    hasAttendanceForDate(classId, date)
    getMarkedDates(classId, term, session)
    formatDateDisplay(dateStr)
    formatDateISO(date)
    getWeekDates(startOfWeek)
    getMondayOfWeek(date)
    getTodayISO()
- Also export a default `dailyAttendance` namespace object with all the same functions
- recalculateCumulativeTotals CRITICAL FIXES to preserve:
    - Document ID format: `${pupilId}_${encodedSession}_${term}` (NOT just pupilId_term)
    - encodedSession = session.replace(/\//g, '-')
    - Calls schoolCalendar.getNonSchoolDays() to exclude holidays from timesOpened
    - Falls back gracefully if schoolCalendar is unavailable
    - Writes session, sessionTerm, sessionStartYear, sessionEndYear to each attendance doc
    - Never produces negative timesOpened/timesPresent/timesAbsent (Math.max(0, ...))
- No window assignments

File to create: attendance/daily.js
```
**Attach:** `attendance-daily.js`

---

### FILE 19 — `attendance/teacher-ui.js`

```
Convert the teacher attendance UI to an ES Module.

Source: attendance-teacher-ui.js v3.0.0 (the complete replacement file).

The module should:
- Import { dailyAttendance } from './daily.js'
- Import { db } from '../db.js'
- Import { firebase } from '../firebase-config.js'
- Import { getCurrentSettings } from '../shared/settings.js'
- Import { showToast } from '../ui/toast.js'
- Module-level state for injected dependencies:
    let _assignedClasses = []
    let _allPupils = []
    let _currentUser = null
    let currentWeekMonday = null
    let _modalDate = null
- Export an init function to set these:
    export function initAttendanceUI({ assignedClasses, allPupils, currentUser })
- Export these named functions:
    loadAttendanceSectionEnhanced()
    switchAttendanceTab(tabName)
    navigateWeek(direction)
    goToCurrentWeek()
    openMarkTodayModal(dateOverride)
    closeMarkDayModal()
    handleModalBackdropClick(e)
    markAllModalPupils(status)
    saveModalAttendance()
    togglePupilStatusInDay(pupilId, date, currentStatus)
    saveAllAttendanceManual(term)
    printAttendanceRegister()
    initAttendanceUI
- CRITICAL FIXES from v3.0.0 to preserve:
    FIX-B: Modal uses CSS class .is-open (not inline display) — animation works correctly
    FIX-C: #daily-register-grid IS the scrollable element (not a wrapper)
    FIX-D: #weekly-summary-panel is OUTSIDE the scroll container (sibling, not child)
    FIX-E: saveModalAttendance is a single function with built-in loading state
    FIX-F: Sticky left column width is a fixed px value matching col-name width
    Modal: _ensureModalInBody() appends to document.body (not to the container)
      to avoid z-index/transform stacking context bugs in admin layouts
- The sectionLoader registration (installEnhancedAttendance) is NOT done here;
  the teacher portal entry point handles it
- References to window.paginateTable change to: import { paginateTable } from
  '../admin/pagination.js' for admin use, or accept it as an init param for
  teacher use. Since this UI is teacher-only, accept via initAttendanceUI:
    export function initAttendanceUI({ assignedClasses, allPupils, currentUser, paginateTable })
  Store paginateTable in a module-level variable _paginateTable.
- No window assignments

File to create: attendance/teacher-ui.js
```
**Attach:** `attendance-teacher-ui.js`

---

### FILE 20 — `admin/auth-setup.js`

```
Extract the secondary auth setup from admin.js into its own ES Module.

Source: admin.js — the IIFE at the top that creates the secondary Firebase app
and exposes window.createSecondaryUser.

The module should:
- Import { firebase } from '../firebase-config.js'
- Import { firebaseConfig } from '../firebase-config.js'
- Import { db } from '../db.js'
- Import { auth } from '../auth.js'
- Module-level variables: let secondaryAuth = null; let secondaryApp = null;
- Export initSecondaryAuth() as a named function that:
    - Tries to get existing 'Secondary' app or creates it
    - Sets secondaryAuth and secondaryApp
    - Returns true on success
- Export createSecondaryUser(email, password) as a named async function that:
    - Validates current admin user exists and has role 'admin'
    - Clears any stale secondary session before proceeding
    - Creates user via secondaryAuth.createUserWithEmailAndPassword
    - Sends password reset email (non-fatal if it fails)
    - Always signs out secondaryAuth afterward
    - Returns the new UID
    - On failure: always signs out secondary auth, then rethrows
- Call initSecondaryAuth() in the module body immediately (IIFE equivalent):
    initSecondaryAuth().catch(err => {
      console.error('Secondary auth init failed:', err);
    });
- No window assignments

File to create: admin/auth-setup.js
```
**Attach:** `admin.js`

---

### FILE 21 — `admin/sidebar.js`

```
Extract sidebar navigation from admin.js into an ES Module.

Source: admin.js — these functions and state:
  State: let adminDataLoaded, let isLoadingAdminData
  setupSidebarNavigation()
  showSection(sectionId)
  loadSectionData(sectionId)
  initializeAdminPortal()

The module should:
- Import { showToast } from '../ui/toast.js'
- Export these module-level state variables (mutable, so use getter functions):
    export let adminDataLoaded = false
    export let isLoadingAdminData = false
- Export these named functions:
    setupSidebarNavigation()
    showSection(sectionId)
    loadSectionData(sectionId)
    initializeAdminPortal()

IMPORTANT — loadSectionData switch cases:
The switch statement calls section loader functions from many other admin/*
modules. These will be imported at the top of this file as needed. Do NOT
inline the function implementations here — import them.

For example (stub imports in this file):
    import { loadDashboardStats } from './dashboard.js'
    import { loadTeachers } from './teachers.js'
    import { loadPupils } from './pupils.js'
    import { loadClasses } from './classes.js'
    ... etc.

The switch statement then just calls: case 'dashboard': loadDashboardStats(); break;

setupSidebarNavigation CRITICAL FIXES:
  - Guard: window.adminSidebarInitialized — use module-level boolean instead
  - Clones hamburger element to remove stale listeners
  - Stores outside-click, escape, and resize handlers in module-level vars
    so they are never double-attached
  - Group toggles (.sidebar-group-toggle-modern) use aria-expanded

showSection CRITICAL FIX:
  - Only hides 'main > .content-wrapper > .admin-card' elements (NOT nested ones)
  - Expands parent sidebar group if active link is in a collapsed group

No window assignments (window.showSection is assigned in portals/admin.js).

File to create: admin/sidebar.js
```
**Attach:** `admin.js`

---

### FILE 22 — `admin/dashboard.js`

```
Extract the dashboard stats loader from admin.js.

Source: admin.js — loadDashboardStats() function.

The module should:
- Import { db } from '../db.js'
- Import { showToast } from '../ui/toast.js'
- Export loadDashboardStats() as a named async function

Logic to preserve:
- Waits 100ms for DOM readiness (setTimeout Promise)
- Requires: teacher-count, pupil-count, class-count, announce-count elements
- Counts pupils from the 'pupils' collection, client-side filters out alumni
  (data.status !== 'alumni') — does NOT use a Firestore query filter
- Shows spinner in each stat element while loading
- On error: sets each element to '!'

No window assignments.

File to create: admin/dashboard.js
```
**Attach:** `admin.js`

---

### FILE 23 — `admin/teachers.js`

```
Extract teacher management from admin.js into an ES Module.

Source: admin.js — these functions:
  showTeacherForm()
  cancelTeacherForm()
  loadTeachers()
  renderTeachersTable(teachersData)
  filterTeachers()
  editTeacher(uid)
  toggleDirectPublish(teacherId, currentlyPublished)
  exportTeachersPDF()
  + the DOMContentLoaded handler for 'add-teacher-form' submit

Module-level state:
  let allTeachersData = []

The module should:
- Import { db } from '../db.js'
- Import { auth } from '../auth.js'
- Import { firebase } from '../firebase-config.js'
- Import { showToast } from '../ui/toast.js'
- Import { handleError } from '../shared/errors.js'
- Import { createSecondaryUser } from './auth-setup.js'
- Import { paginateTable } from './pagination.js'
- Import { loadDashboardStats } from './dashboard.js'
- Export all functions listed above as named exports

Teacher form submit handler (add-teacher-form DOMContentLoaded):
  Move this into an exported function setupTeacherFormHandler() that is called
  from admin/index.js in a DOMContentLoaded listener.
  The handler should:
    - Validate required fields (name, gender, dateJoined, email)
    - For new teachers: call createSecondaryUser(email, tempPassword)
    - Create users/{uid} doc with role: 'teacher'
    - Create teachers/{uid} doc with all fields
    - For updates: just update the teachers doc and optionally the users email
    - Reset form and close on success
    - Re-enable submit button in finally block

exportTeachersPDF: assumes jsPDF loaded via CDN (window.jspdf global).

No window assignments.

File to create: admin/teachers.js
```
**Attach:** `admin.js`

---

### FILE 24 — `admin/pupils.js`

```
Extract pupil management from admin.js into an ES Module.

Source: admin.js — these functions:
  showPupilForm()
  cancelPupilForm()
  loadPupils()
  renderPupilsTable(pupilsData)
  filterPupils()
  editPupil(uid)
  populateClassDropdown(selectedClass)
  getClassDetails(classId)
  getClassIdFromPupilData(classData)
  setupBulkActionsEventListeners()
  updateBulkActionButtons()
  applyBulkAction()
  bulkReassignClass(pupilIds)
  bulkDeletePupils(pupilIds)
  toggleAllPupils(masterCheckbox)
  + the DOMContentLoaded handler for 'add-pupil-form' submit

Module-level state:
  let allPupilsData = []

The module should:
- Import { db } from '../db.js'
- Import { auth } from '../auth.js'
- Import { firebase } from '../firebase-config.js'
- Import { getCurrentSettings } from '../shared/settings.js'
- Import { showToast } from '../ui/toast.js'
- Import { handleError } from '../shared/errors.js'
- Import { createSecondaryUser } from './auth-setup.js'
- Import { paginateTable } from './pagination.js'
- Import { loadDashboardStats } from './dashboard.js'
- Import { calculateAdjustedFee, calculateCompleteArrears,
    getPreviousSessionName } from '../finance/fee-calculator.js'
- Export all functions listed above as named exports

Pupil form submit (add-pupil-form DOMContentLoaded):
  Move into exported setupPupilFormHandler() called from admin/index.js.
  Critical logic:
    - Check for duplicate admissionNo before creating
    - Call createSecondaryUser(email, password) for new pupils
    - Auto-create payment record using fee_{classId} fee structure
    - Apply calculateAdjustedFee for per-pupil fee adjustments
    - Apply calculateCompleteArrears for arrears on new pupil
    - All in a try/catch — payment record failure should NOT fail pupil creation

bulkDeletePupils: deletes payments, payment_transactions, results,
  results_draft per pupil, not just pupils and users docs.
  Uses per-pupil isolation (each pupil in its own try/catch).

No window assignments.

File to create: admin/pupils.js
```
**Attach:** `admin.js`

---

### FILE 25 — `admin/classes.js`

```
Extract class and subject management from admin.js into an ES Module.

Source: admin.js — these functions:
  showClassForm()
  addClass()
  loadClasses()
  showSubjectForm()
  addSubject()
  loadSubjects()
  openSubjectAssignmentModal(classId, className)
  closeSubjectAssignmentModal()
  saveClassSubjects()
  loadTeacherAssignments()
  assignTeacherToClass()
  unassignTeacher(classId)

Module-level state:
  let currentAssignmentClassId = null
  let currentAssignmentClassName = null

The module should:
- Import { db } from '../db.js'
- Import { auth } from '../auth.js'
- Import { firebase } from '../firebase-config.js'
- Import { showToast } from '../ui/toast.js'
- Import { handleError } from '../shared/errors.js'
- Import { paginateTable } from './pagination.js'
- Import { loadDashboardStats } from './dashboard.js'
- Import { getAllTeachers } from '../auth.js'
- Export all functions as named exports

addClass: CRITICAL — checks for exact and case-insensitive duplicate names
  before creating. Checks both db.where('name','==',className) and a client-side
  toLowerCase() comparison against all classes.

saveClassSubjects: uses db.runTransaction to atomically update both the class
  doc and all pupils in that class. Preserves this exact atomic pattern.

loadClasses: counts pupils per class client-side (excludes alumni by checking
  data.status !== 'alumni').

No window assignments.

File to create: admin/classes.js
```
**Attach:** `admin.js`

---

### FILE 26 — `admin/announcements.js`

```
Extract announcements management from admin.js.

Source: admin.js — these functions:
  showAnnounceForm()
  addAnnouncement()
  loadAdminAnnouncements()

The module should:
- Import { db } from '../db.js'
- Import { firebase } from '../firebase-config.js'
- Import { showToast } from '../ui/toast.js'
- Import { handleError } from '../shared/errors.js'
- Import { loadDashboardStats } from './dashboard.js'
- Export all three functions as named exports
- No window assignments

File to create: admin/announcements.js
```
**Attach:** `admin.js`

---

### FILE 27 — `admin/alumni.js`

```
Extract alumni management from admin.js.

Source: admin.js — these functions:
  loadAlumni()
  renderAlumniTable(alumniData)
  filterAlumni()
  deleteAlumni(alumniId)

Module-level state:
  let allAlumniData = []

The module should:
- Import { db } from '../db.js'
- Import { auth } from '../auth.js'
- Import { firebase } from '../firebase-config.js'
- Import { showToast } from '../ui/toast.js'
- Import { handleError } from '../shared/errors.js'
- Import { paginateTable } from './pagination.js'
- Export all functions as named exports

loadAlumni: queries pupils collection (orderBy name), filters client-side
  for status === 'alumni'. Does NOT use a Firestore query filter on status
  (avoids composite index requirement).

deleteAlumni (renamed to "restore from alumni"):
  CRITICAL — this does NOT delete the pupil. It sets status back to 'active',
  sets class.name to 'UNASSIGNED — Please reassign', sets requiresClassAssignment: true,
  and tries to delete the alumni/{alumniId} index doc (non-fatal if missing).
  Show a warning toast that admin must assign a class.

No window assignments.

File to create: admin/alumni.js
```
**Attach:** `admin.js`

---

### FILE 28 — `admin/audit-log.js`

```
Extract audit log management from admin.js.

Source: admin.js — these functions:
  loadAuditLog()
  renderAuditLogTable(logsData)
  filterAuditLog()
  viewAuditDetails(logId)
  downloadAuditLog()
  getActionBadge(action)

Module-level state:
  let allAuditLogsData = []

The module should:
- Import { db } from '../db.js'
- Import { showToast } from '../ui/toast.js'
- Import { paginateTable } from './pagination.js'
- Export: loadAuditLog, renderAuditLogTable, filterAuditLog,
    viewAuditDetails, downloadAuditLog, getActionBadge as named exports
- No window assignments

getActionBadge: returns color-coded badge HTML for each action type
  (delete_user, create_user, update_settings, promotion_approved, etc.)

viewAuditDetails: creates a modal overlay dynamically, shows all fields
  including deletedData and changes as formatted JSON.

downloadAuditLog: queries ALL audit_log entries (no limit), builds CSV,
  triggers browser download.

File to create: admin/audit-log.js
```
**Attach:** `admin.js`

---

### FILE 29 — `admin/settings-section.js`

```
Extract the settings section from admin.js.

Source: admin.js — these functions:
  loadCurrentSettings()
  updateSessionSettings()
  loadSessionHistory()
  confirmStartNewSession()
  startNewSession()

The module should:
- Import { db } from '../db.js'
- Import { auth } from '../auth.js'
- Import { firebase } from '../firebase-config.js'
- Import { getCurrentSettings, SessionCache } from '../shared/settings.js'
- Import { showToast } from '../ui/toast.js'
- Import { handleError } from '../shared/errors.js'
- Import { loadClassHierarchyUI } from './hierarchy-ui.js'
- Import { migrateArrearsOnTermChange } from '../finance/migration.js'
- Export all five functions as named exports
- Also export setupSettingsFormHandler() — the DOMContentLoaded wiring for the
  settings form and the save-settings-btn

startNewSession: CRITICAL — the new-session migration block that runs after
  settings are saved. This:
    Phase 1: Ensures old session Third Term docs exist for all pupils
    Phase 2: Creates new session First Term payment docs with cascaded arrears
  Preserve the full logic including batch renewal at 400 operations.

loadCurrentSettings: loads settings into the display AND edit form, then after
  a 300ms setTimeout calls window.classHierarchy.initializeClassHierarchy()
  and loadClassHierarchyUI() — only if the settings section is still visible.

No window assignments.

File to create: admin/settings-section.js
```
**Attach:** `admin.js`

---

### FILE 30 — `admin/hierarchy-ui.js`

```
Extract the class hierarchy UI from admin.js.

Source: admin.js — these functions and their nested inner functions:
  loadClassHierarchyUI()
  renderEmptyHierarchyUI()
  renderHierarchyUI(orderedClasses)    ← contains nested drag/drop handlers
  saveHierarchyOrder()                 ← defined inside renderHierarchyUI
  refreshHierarchyUI()                 ← defined inside renderHierarchyUI
  updateHierarchyNumbers()             ← nested inside renderHierarchyUI
  currentHierarchy (module-level var)

The module should:
- Import { db } from '../db.js'
- Import { classHierarchy } from '../features/class-hierarchy.js'
- Import { showToast } from '../ui/toast.js'
- Import { handleError } from '../shared/errors.js'
- Export: loadClassHierarchyUI, renderEmptyHierarchyUI, renderHierarchyUI,
    saveHierarchyOrder, refreshHierarchyUI as named exports

IMPORTANT: saveHierarchyOrder and refreshHierarchyUI are defined as inner
functions inside renderHierarchyUI in the original code. Move them to
module level (they can read module-level state). Their window.saveHierarchyOrder
and window.refreshHierarchyUI assignments become the module exports.

Drag-and-drop: uses standard HTML5 dragstart/dragover/drop/dragend events.
Event delegation pattern: attach to the list container, not individual items.
The event.delegationActive dataset guard (dataset.delegationActive = 'true')
prevents double-attaching.

No window assignments.

File to create: admin/hierarchy-ui.js
```
**Attach:** `admin.js`

---

### FILE 31 — `admin/promotions.js`

```
Extract the full promotion request management from admin.js.

Source: admin.js — these functions and state:
  State: let currentPromotionId, let currentPromotionData, let manualOverrides
  loadPromotionRequests()
  loadPromotionPeriodStatus()
  togglePromotionPeriod()
  viewPromotionDetails(promotionId)
  closePromotionDetailsModal()
  populateOverrideDropdowns()
  handlePromotionOverride()
  addManualOverride()
  removeManualOverride(index)
  renderManualOverrides()
  approvePromotion()
  executePromotion(promotionId, promotedPupils, heldBackPupils, manualOverrides)
  rejectPromotion()
  quickApprovePromotion(promotionId)
  quickRejectPromotion(promotionId)
  approveAllPendingPromotions()
  rejectAllPendingPromotions()

The module should:
- Import { db } from '../db.js'
- Import { auth } from '../auth.js'
- Import { firebase } from '../firebase-config.js'
- Import { showToast } from '../ui/toast.js'
- Import { handleError } from '../shared/errors.js'
- Export all functions as named exports

executePromotion CRITICAL FIXES:
  - BATCH_SIZE = 400 (safe under Firestore's 500 limit)
  - Uses let batch (not const) and renews after 400 ops
  - Includes commitCurrentBatch() helper function
  - Defensive assertion: check for overlap between finalPromotedPupils and
    finalHeldBackPupils (same pupil in both lists = throw Error)
  - Alumni pupils: set status:'alumni', isActive:false, class.id:null,
    create alumni/{pupilId} doc, update pupils/{pupilId}
  - Promoted pupils: update class.id/name, subjects, add promotionHistory entry
  - Held back: add promotionHistory entry only (no class change)

approvePromotion CRITICAL:
  - Reads checkboxes from DOM to determine final promote/hold lists
  - Uses a single Map to prevent any pupil appearing in both lists
  - Defensive overlap check before calling executePromotion

No window assignments.

File to create: admin/promotions.js
```
**Attach:** `admin.js`

---

### FILE 32 — `admin/view-results.js`

```
Extract the view results section from admin.js.

Source: admin.js — these functions and state:
  State: let currentResultsPupilId, let currentResultsSession, let currentResultsData
  loadViewResultsSection()
  populateSessionFilter()
  loadFilteredClasses()
  loadFilteredPupils()
  loadPupilResults()
  renderResultsDisplay(results, container)
  loadSessionComparison()
  generateInsights(sessions, progressData)
  toggleSessionComparison()
  clearResultsFilter()
  exportPupilResults()

The module should:
- Import { db } from '../db.js'
- Import { getCurrentSettings } from '../shared/settings.js'
- Import { showToast } from '../ui/toast.js'
- Import { getGrade, getRemark } from '../shared/grade-utils.js'
- Export all functions as named exports

loadViewResultsSection: attaches event listeners by CLONING the select and
  button elements (to remove stale listeners before re-attaching). Preserve this.

loadFilteredClasses: checks for alumni pupils who have results via a sampling
  approach (checks one result doc to see if its pupilId has status:'alumni').
  Also adds a '__alumni__' virtual class option if any alumni have results.

loadPupilResults: uses a fallback query chain:
  1. Try composite query (pupilId + session + status:'approved')
  2. If failed-precondition (missing index), fall back to pupilId-only query,
     filter session client-side
  Renders results grouped by term (First, Second, Third), with a session
  summary card at the bottom.
  Print button uses admissionNo in URL (resolves to it from pupil doc),
  falls back to pupilId if no admissionNo.

loadSessionComparison: queries ALL results for the pupil across ALL sessions,
  groups by session, calculates averages, renders progress cards and bar chart.

No window assignments.

File to create: admin/view-results.js
```
**Attach:** `admin.js`

---

### FILE 33 — `admin/fee-management.js`

```
Extract fee structure management from admin.js.

Source: admin.js — these functions:
  loadFeeManagementSection()
  populateFeeClassSelector()
  loadFeeStructures()
  saveFeeStructure()
  editFeeStructure(feeDocId)
  deleteFeeStructure(docId, className)
  fixDuplicateFees(classId)

The module should:
- Import { db } from '../db.js'
- Import { auth } from '../auth.js'
- Import { firebase } from '../firebase-config.js'
- Import { getCurrentSettings } from '../shared/settings.js'
- Import { showToast } from '../ui/toast.js'
- Import { handleError } from '../shared/errors.js'
- Export all functions as named exports

Fee structure document ID format: fee_{classId} (permanent, not session-based).

saveFeeStructure CRITICAL:
  - ALL fee components rounded with Math.round() on input (prevents float accumulation)
  - Total = sum of already-rounded integers (always a whole number)
  - Archives old fee structure to fee_structure_history before updating
  - Confirms with admin if a fee structure already exists for that class

deleteFeeStructure CRITICAL:
  - Checks BOTH payments AND payment_transactions for financial history
  - If either has records for that classId, blocks deletion with error message
  - Archives to fee_structure_history before deleting
  - Uses atomic batch: one batch for both archive write and delete

loadFeeStructures:
  - Queries ALL fee_structures (no session filter)
  - Groups by classId using a Map to detect duplicates
  - Shows duplicate warning banner with "Fix Duplicates" button if > 1 per class
  - Shows "permanent" badge (not session-specific)

No window assignments.

File to create: admin/fee-management.js
```
**Attach:** `admin.js`

---

### FILE 34 — `admin/payment-management.js`

```
Extract payment recording from admin.js.

Source: admin.js — these functions:
  loadPaymentRecordingSection()
  populatePaymentClassFilter()
  loadPupilsForPayment()
  loadPupilPaymentStatus()
  loadPaymentHistory(pupilId, session, term)
  recordPayment()
  printReceipt(receiptNo)

The module should:
- Import { db } from '../db.js'
- Import { auth } from '../auth.js'
- Import { firebase } from '../firebase-config.js'
- Import { getCurrentSettings } from '../shared/settings.js'
- Import { calculateAdjustedFee, calculateCompleteArrears } from '../finance/fee-calculator.js'
- Import { recordPayment as financeRecordPayment } from '../finance/payment-recorder.js'
- Import { showToast } from '../ui/toast.js'
- Import { handleError } from '../shared/errors.js'
- Export all functions as named exports

loadPupilPaymentStatus CRITICAL:
  - Auto-creates payment record using db.runTransaction (FIX: prevents race condition
    if two sessions create the doc simultaneously — the transaction checks existence
    inside the transaction boundary)
  - Arrears warning HTML only shows if arrears are not yet cleared
    (arrearsCleared = totalPaid >= arrears)
  - Passes finance.recordPayment as the payment executor (window.finance.recordPayment
    in the original — import financeRecordPayment instead)

recordPayment (the admin UI handler — wraps financeRecordPayment):
  - Validates pupilId, classId, amount > 0, amount <= 10,000,000
  - Gets session/term from getCurrentSettings
  - Calls financeRecordPayment(pupilId, pupilName, classId, className, session, term, {...})
  - On success: shows receipt print confirm dialog

loadPaymentHistory:
  - Queries payment_transactions by pupilId + session
  - Ordered by paymentDate desc
  - Shows balanceAfter field if present

No window assignments.

File to create: admin/payment-management.js
```
**Attach:** `admin.js`, `finance.js`

---

### FILE 35 — `admin/data-export.js`

```
Extract data export helpers from admin.js.

Source: admin.js — these functions:
  exportPupilsData()          ← pupils to CSV
  exportResultsData()         ← results to CSV with term/session prompt
  downloadCSV(content, filename)

Note: exportPupilResults() for the view-results section is in admin/view-results.js.
The exportTeachersPDF() is in admin/teachers.js.
This file handles the generic data export panel exports.

The module should:
- Import { db } from '../db.js'
- Import { showToast } from '../ui/toast.js'
- Export: exportPupilsData, exportResultsData, downloadCSV as named exports
- No window assignments

File to create: admin/data-export.js
```
**Attach:** `admin.js`

---

### FILE 36 — `admin/delete-item.js`

```
Extract the deleteItem function from admin.js.

Source: admin.js — the window.deleteItem function.

The module should:
- Import { db } from '../db.js'
- Import { auth } from '../auth.js'
- Import { firebase } from '../firebase-config.js'
- Import { showToast } from '../ui/toast.js'
- Import { handleError } from '../shared/errors.js'
- Export deleteItem(collection, docId) as a named async function

CRITICAL — blocked collections (never delete):
  'payments', 'payment_transactions', 'fee_structures', 'arrears_log'
  If collection is in this list, show toast and return immediately.

After deletion:
  - Writes to audit_log
  - For 'pupils': also deletes users/{docId}
  - For 'teachers': also deletes users/{docId}, calls loadTeachers() + loadTeacherAssignments()
  - For other collections: calls the appropriate section reload function

To avoid circular imports, accept reload callbacks as optional parameters or
import from the relevant admin/* modules directly.

No window assignments.

File to create: admin/delete-item.js
```
**Attach:** `admin.js`

---

### FILE 37 — `admin/pagination.js`

```
Extract paginateTable from admin.js into a shared module.

Source: admin.js — the paginateTable function.

RECONCILIATION: admin.js and teacher.js each define their own paginateTable.
  - admin.js: tbodyId is a bare ID; function finds `document.getElementById(tbodyId)` 
    which must be a <tbody> element directly
  - teacher.js: tbodyId is the TABLE's id; function finds `#${tbodyId} tbody`

Create a single function that handles both cases:

  export function paginateTable(data, tableOrTbodyId, itemsPerPage = 20, renderRowCallback)

  Logic:
    1. Try document.getElementById(tableOrTbodyId) — check tagName
    2. If tagName === 'TBODY': use it directly (admin.js style)
    3. If tagName === 'TABLE': find its tbody child (teacher.js style)
    4. If neither found: console.error and return

Preserve all other logic from admin.js version:
  - CRITICAL FIX: Clean up old pagination function (delete window[paginationFuncName])
  - renderPage handles empty pages gracefully
  - updatePaginationControls hides controls when total <= 1
  - aria-live="polite" on page-info span
  - window[paginationFuncName] still assigned (onclick handlers need it)

Export paginateTable as a named export.
Note: window[paginationFuncName] = ... is kept inside this function because
it is per-table and per-invocation, not a module-level assignment.

File to create: admin/pagination.js
```
**Attach:** `admin.js`, `teacher.js`

---

### FILE 38 — `admin/index.js`

```
Create the admin module orchestrator.

This file wires together all admin/* sub-modules. It is NOT the HTML entry point
(portals/admin.js is). This file:
1. Imports everything from admin/* modules
2. Sets up DOMContentLoaded form handlers
3. Sets up the authentication/initialization flow
4. Re-exports everything that portals/admin.js needs to expose to window

The module should:
- Import { checkRole, auth, logout } from '../auth.js'
- Import { createSecondaryUser, initSecondaryAuth } from './auth-setup.js'
- Import { setupSidebarNavigation, showSection, loadSectionData,
    initializeAdminPortal, adminDataLoaded, isLoadingAdminData } from './sidebar.js'
- Import { loadDashboardStats } from './dashboard.js'
- Import ALL functions from ./teachers.js, ./pupils.js, ./classes.js,
    ./announcements.js, ./alumni.js, ./audit-log.js, ./settings-section.js,
    ./hierarchy-ui.js, ./promotions.js, ./view-results.js,
    ./fee-management.js, ./payment-management.js, ./data-export.js,
    ./delete-item.js, ./pagination.js
- Import from finance/*, results/*, features/* as needed

Module body:
  1. Set up checkRole('admin') promise chain — same pattern as original admin.js:
       let authUser = null; let domReady = false;
       function tryInitialize() { if (authUser && domReady) initializeAdminPortal(); }
       window.checkRole('admin').then(user => { authUser = user; tryInitialize(); })
       if (document.readyState === 'loading') { DOMContentLoaded → domReady=true; tryInitialize() }
       else { domReady = true; tryInitialize() }
  2. DOMContentLoaded: admin-logout click handler
  3. DOMContentLoaded: settings-form submit handler (updateSessionSettings)
  4. DOMContentLoaded: add-teacher-form submit (setupTeacherFormHandler from teachers.js)
  5. DOMContentLoaded: add-pupil-form submit (setupPupilFormHandler from pupils.js)
  6. DOMContentLoaded: save-settings-btn click (updateSessionSettings)

Re-export everything needed by portals/admin.js using named re-exports:
  export { loadTeachers, editTeacher, ... } from './teachers.js'
  export { loadPupils, editPupil, ... } from './pupils.js'
  ... etc.

No window assignments (those happen in portals/admin.js).

File to create: admin/index.js
```
**Attach:** `admin.js`

---

### FILE 39 — `portals/admin.js`

```
Create the thin entry point for admin.html.

This file does two things only:
1. Imports everything from admin/index.js (which chains to all sub-modules)
2. Assigns to window.* for HTML onclick= compatibility

The module should:
- import * as AdminModule from '../admin/index.js'
- After importing, assign to window for all functions used in HTML onclick attrs:

// For HTML onclick= compatibility:
window.showSection = AdminModule.showSection;
window.deleteItem = AdminModule.deleteItem;
window.paginateTable = AdminModule.paginateTable;
window.loadTeachers = AdminModule.loadTeachers;
window.editTeacher = AdminModule.editTeacher;
window.showTeacherForm = AdminModule.showTeacherForm;
window.cancelTeacherForm = AdminModule.cancelTeacherForm;
window.filterTeachers = AdminModule.filterTeachers;
window.toggleDirectPublish = AdminModule.toggleDirectPublish;
window.exportTeachersPDF = AdminModule.exportTeachersPDF;
window.loadPupils = AdminModule.loadPupils;
window.editPupil = AdminModule.editPupil;
window.showPupilForm = AdminModule.showPupilForm;
window.cancelPupilForm = AdminModule.cancelPupilForm;
window.filterPupils = AdminModule.filterPupils;
window.toggleAllPupils = AdminModule.toggleAllPupils;
window.updateBulkActionButtons = AdminModule.updateBulkActionButtons;
window.applyBulkAction = AdminModule.applyBulkAction;
window.loadClasses = AdminModule.loadClasses;
window.addClass = AdminModule.addClass;
window.showClassForm = AdminModule.showClassForm;
window.loadSubjects = AdminModule.loadSubjects;
window.addSubject = AdminModule.addSubject;
window.showSubjectForm = AdminModule.showSubjectForm;
window.openSubjectAssignmentModal = AdminModule.openSubjectAssignmentModal;
window.closeSubjectAssignmentModal = AdminModule.closeSubjectAssignmentModal;
window.saveClassSubjects = AdminModule.saveClassSubjects;
window.assignTeacherToClass = AdminModule.assignTeacherToClass;
window.unassignTeacher = AdminModule.unassignTeacher;
window.showAnnounceForm = AdminModule.showAnnounceForm;
window.addAnnouncement = AdminModule.addAnnouncement;
window.loadAlumni = AdminModule.loadAlumni;
window.filterAlumni = AdminModule.filterAlumni;
window.deleteAlumni = AdminModule.deleteAlumni;
window.loadAuditLog = AdminModule.loadAuditLog;
window.filterAuditLog = AdminModule.filterAuditLog;
window.viewAuditDetails = AdminModule.viewAuditDetails;
window.downloadAuditLog = AdminModule.downloadAuditLog;
window.loadCurrentSettings = AdminModule.loadCurrentSettings;
window.confirmStartNewSession = AdminModule.confirmStartNewSession;
window.saveHierarchyOrder = AdminModule.saveHierarchyOrder;
window.refreshHierarchyUI = AdminModule.refreshHierarchyUI;
window.togglePromotionPeriod = AdminModule.togglePromotionPeriod;
window.viewPromotionDetails = AdminModule.viewPromotionDetails;
window.closePromotionDetailsModal = AdminModule.closePromotionDetailsModal;
window.handlePromotionOverride = AdminModule.handlePromotionOverride;
window.addManualOverride = AdminModule.addManualOverride;
window.removeManualOverride = AdminModule.removeManualOverride;
window.approvePromotion = AdminModule.approvePromotion;
window.rejectPromotion = AdminModule.rejectPromotion;
window.quickApprovePromotion = AdminModule.quickApprovePromotion;
window.quickRejectPromotion = AdminModule.quickRejectPromotion;
window.approveAllPendingPromotions = AdminModule.approveAllPendingPromotions;
window.rejectAllPendingPromotions = AdminModule.rejectAllPendingPromotions;
window.loadResultApprovals = AdminModule.loadResultApprovals;
window.approveResultSubmission = AdminModule.approveResultSubmission;
window.rejectResultSubmission = AdminModule.rejectResultSubmission;
window.unlockApprovedResult = AdminModule.unlockApprovedResult;
window.switchResultApprovalsTab = AdminModule.switchResultApprovalsTab;
window.toggleResultPreview = AdminModule.toggleResultPreview;
window.approveAllPendingResults = AdminModule.approveAllPendingResults;
window.toggleAllResultsSelection = AdminModule.toggleAllResultsSelection;
window.updateResultsBulkButtons = AdminModule.updateResultsBulkButtons;
window.loadViewResultsSection = AdminModule.loadViewResultsSection;
window.loadPupilResults = AdminModule.loadPupilResults;
window.loadFilteredClasses = AdminModule.loadFilteredClasses;
window.loadFilteredPupils = AdminModule.loadFilteredPupils;
window.clearResultsFilter = AdminModule.clearResultsFilter;
window.exportPupilResults = AdminModule.exportPupilResults;
window.loadSessionComparison = AdminModule.loadSessionComparison;
window.toggleSessionComparison = AdminModule.toggleSessionComparison;
window.loadFeeManagementSection = AdminModule.loadFeeManagementSection;
window.loadFeeStructures = AdminModule.loadFeeStructures;
window.saveFeeStructure = AdminModule.saveFeeStructure;
window.editFeeStructure = AdminModule.editFeeStructure;
window.deleteFeeStructure = AdminModule.deleteFeeStructure;
window.fixDuplicateFees = AdminModule.fixDuplicateFees;
window.loadPaymentRecordingSection = AdminModule.loadPaymentRecordingSection;
window.loadPupilsForPayment = AdminModule.loadPupilsForPayment;
window.loadPupilPaymentStatus = AdminModule.loadPupilPaymentStatus;
window.loadPaymentHistory = AdminModule.loadPaymentHistory;
window.recordPayment = AdminModule.recordPayment;
window.printReceipt = AdminModule.printReceipt;
window.loadOutstandingFeesReport = AdminModule.loadOutstandingFeesReport;
window.loadFinancialReports = AdminModule.loadFinancialReports;
window.exportFinancialReport = AdminModule.exportFinancialReport;
window.ensureAllPupilsHavePaymentRecords = AdminModule.ensureAllPupilsHavePaymentRecords;
window.migrateArrearsToNewSession = AdminModule.migrateArrearsToNewSession;
window.migratePaymentRecordsToAdjustedFees = AdminModule.migratePaymentRecordsToAdjustedFees;
window.backfillSessionData = AdminModule.backfillSessionData;
window.exportPupilsData = AdminModule.exportPupilsData;
window.exportResultsData = AdminModule.exportResultsData;
window.generateComprehensiveFinancialReport = AdminModule.generateComprehensiveFinancialReport;
window.loadSchoolCalendarSection = AdminModule.loadSchoolCalendarSection;
window.saveCalendarEntry = AdminModule.saveCalendarEntry;
window.deleteCalendarEntry = AdminModule.deleteCalendarEntry;
window.applyCalendarFilter = AdminModule.applyCalendarFilter;
window.exportCalendarCSV = AdminModule.exportCalendarCSV;
window.toggleCalendarRange = AdminModule.toggleCalendarRange;
window.loadLessonNotesAdminSection = AdminModule.loadLessonNotesAdminSection;
window.lnAdminApplyFilters = AdminModule.lnAdminApplyFilters;
window.lnAdminClearFilters = AdminModule.lnAdminClearFilters;
window.lnAdminViewNote = AdminModule.lnAdminViewNote;
window.lnAdminApproveNote = AdminModule.lnAdminApproveNote;
window.lnAdminRejectNote = AdminModule.lnAdminRejectNote;
window.lnAdminPrintNote = AdminModule.lnAdminPrintNote;
// Developer tools:
window.adminDebug = { ... }  // keep inline as before

File to create: portals/admin.js
```
**Attach:** `admin.js`

---

### FILE 40 — `portals/teacher.js`

```
Convert the teacher portal to an ES Module entry point.

Source: teacher.js (the version at the end of the provided code — the full
v8.1.0 with all race condition fixes).

The module should:
- Import { db } from '../db.js'
- Import { auth, checkRole, logout, getAllTeachers } from '../auth.js'
- Import { firebase } from '../firebase-config.js'
- Import { getCurrentSettings } from '../shared/settings.js'
- Import { handleError } from '../shared/errors.js'
- Import { showToast } from '../ui/toast.js'
- Import { resultLocking } from '../results/locking.js'
- Import { classHierarchy } from '../features/class-hierarchy.js'
- Import { loadAttendanceSectionEnhanced, initAttendanceUI } from '../attendance/teacher-ui.js'
- Import { remarkTemplates } from '../features/remark-templates.js'
- Import { loadLessonNotesSection } from '../features/lesson-notes-teacher.js'
- Import { loadCbtSection, initCbt } from '../features/cbt-teacher.js'
- Import { getGrade, getRemark, getGradeFromScore } from '../shared/grade-utils.js'
- Import { paginateTable } from '../admin/pagination.js'

Module-level variables (keep these — some are referenced by other scripts):
  export let currentUser = null
  export let assignedClasses = []
  export let allPupils = []
  export let allSubjects = []
  let dataLoaded = false
  let isLoadingData = false

After loadAssignedClasses() succeeds, call:
  initAttendanceUI({ assignedClasses, allPupils, currentUser, paginateTable })
  initCbt({ assignedClasses, currentUser })
  initLessonNotes({ assignedClasses, currentUser })  ← from lesson-notes-teacher.js

sectionLoaders object: reference imported functions:
  'attendance': loadAttendanceSectionEnhanced
  'lesson-notes': loadLessonNotesSection
  'cbt': loadCbtSection
  ... all others defined inline as before

Keep these window assignments for backward compatibility with
attendance-teacher-ui.js and other modules that read them:
  window.currentUser = user        (after auth)
  window.assignedClasses = ...     (after load)
  window.allPupils = ...           (after load)
  window.allSubjects = ...         (after load)
  window.paginateTable = paginateTable

For HTML onclick= compatibility, at the end of the file:
  window.showSection = showSection
  window.submitResultsForApproval = submitResultsForApproval
  window.checkResultLockStatus = checkResultLockStatus
  window.loadResultsTable = loadResultsTable
  window.saveAllResults = saveAllResults
  window.saveAllAttendance = saveAllAttendance
  window.saveBulkTraitsAndSkills = saveBulkTraitsAndSkills
  window.saveRemarks = saveRemarks
  window.loadRemarksData = loadRemarksData
  window.loadBulkTraitsTable = loadBulkTraitsTable
  window.selectAllForPromotion = selectAllForPromotion
  window.deselectAllForPromotion = deselectAllForPromotion
  window.toggleAllPupilsPromotion = toggleAllPupilsPromotion
  window.submitPromotionRequest = submitPromotionRequest
  window.useRemarkTemplate = useRemarkTemplate
  window.refreshRemarkSuggestions = refreshRemarkSuggestions

All other logic preserved exactly from teacher.js v8.1.0.

File to create: portals/teacher.js
```
**Attach:** `teacher.js`

---

### FILE 41 — `portals/pupil.js`

```
Convert the pupil portal to an ES Module entry point.

Source: pupil.js (the full v4.4.0 with session selector fix) + pupil-ui-patch.js
(the small IIFE at the bottom of the provided code).

The module should:
- Import { db } from '../db.js'
- Import { auth, checkRole, logout } from '../auth.js'
- Import { firebase } from '../firebase-config.js'
- Import { getCurrentSettings } from '../shared/settings.js'
- Import { calculateCurrentOutstanding } from '../finance/outstanding.js'
- Import { showToast } from '../ui/toast.js'
- Import { handleError } from '../shared/errors.js'
- Import { getGrade } from '../shared/grade-utils.js'

Module-level variables:
  let currentPupilId = null
  let currentPupilData = null
  let currentClassInfo = null
  let pupilListener = null
  let classListener = null

MERGE pupil-ui-patch.js logic:
  The three MutationObservers from pupil-ui-patch.js are set up in a window 'load'
  listener at the end of this module:
  1. Observer on #pupil-name-display → updates #pupil-welcome hero greeting
  2. Observer on #results-container → replaces plain <p> empty state with
     richer pp-empty component HTML
  3. Observer on #pp-fees (attribute changes) → re-runs lucide.createIcons()
     when display changes from 'none' to 'block'

For HTML onclick= compatibility:
  window.loadFeeBalance = loadFeeBalance
  window.viewReceipt = viewReceipt
  window.loadSessionResults = loadSessionResults
  window.scrollToFees = scrollToFees
  window.loadAllPaymentHistory = loadAllPaymentHistory

All logic from pupil.js v4.4.0 preserved exactly, including:
  - Alumni detection and special alumni profile rendering
  - Session selector population (only shows sessions with approved results)
  - Results loading with fallback query chain
  - Payment history grouped by session with collapsible older entries
  - Fee balance using calculateCurrentOutstanding (canonical)
  - Real-time Firestore listeners with debounce (500ms) and change detection

File to create: portals/pupil.js
```
**Attach:** `pupil.js`, (the pupil-ui-patch.js IIFE block)

---

### FILE 42 — `portals/print-results.js`

```
Convert the print results page to an ES Module entry point.

Source: print-results.js (v8.2.0).

The module should:
- Import { db } from '../db.js'
- Import { firebase } from '../firebase-config.js'
- Import { getGrade, getRemark } from '../shared/grade-utils.js'
- Import { sleep } from '../shared/utils.js'

Module-level variables:
  let currentPupilId = null
  let pupilProfile = null
  let currentSettings = { term: 'First Term', session: '', resumptionDate: '-' }
  let isInitialized = false

initPrintResultsWrapper() call becomes module body:
  firebase.auth().onAuthStateChanged(async user => { ... })
  Run at module load time (not in DOMContentLoaded — the old code ran immediately).

Key functions remain module-internal (not exported):
  fetchSchoolSettings, fetchPupilProfile, setupTermSelector, updateReportHeader,
  loadReportData, loadAcademicResults, loadAttendance, loadBehavioralTraits,
  loadPsychomotorSkills, loadRemarks, clearPerformanceSummary, resetTraitsAndRemarks,
  renderResults, formatResumptionDate, abbreviateSubject, classNameToSlug,
  setText, normaliseSubject, getModalClassSize, loadingRow, emptyRow, errorRow,
  loadSignatureImage, loadSignatures, clearSignatures, getSessionFromUrl

Export only:
  export { loadReportData }  ← for the term selector onchange="loadReportData()"

For HTML onchange= compatibility:
  window.loadReportData = loadReportData

Preserve ALL fixes from v8.2.0:
  - Admin bar injection (checks user role, injects blue bar if admin)
  - admissionNo URL parameter resolution (queries pupils by admissionNo)
  - Fallback composite query → simple query + client-side session filter for results
  - Class stats: derives effectiveClassId from own results if pupilProfile._resolvedClassId
    is null (handles alumni whose class.id was set to null after graduation)
  - setupTermSelector: for historical sessions, determines which term to default
    to by querying which terms have approved results for that session
  - Signature images: loaded via Image() probe (fails silently if missing)

File to create: portals/print-results.js
```
**Attach:** `print-results.js`

---

### FILE 43 — `features/cbt-teacher.js`

```
Convert the CBT teacher module to an ES Module.

Source: cbt-teacher.js (entire file).

The module should:
- Import { db } from '../db.js'
- Import { firebase } from '../firebase-config.js'
- Import { getCurrentSettings } from '../shared/settings.js'
- Import { showToast } from '../ui/toast.js'

Module-level state:
  let _assignedClasses = []
  let _currentUser = null
  let cbtQuestionCount = 0
  let cbtEditingTestId = null
  const _cbtTestMap = new Map()

Export an init function:
  export function initCbt({ assignedClasses, currentUser })

Export named functions:
  loadCbtSection, showCbtCreateForm, addCbtQuestion, removeCbtQuestion,
  saveCbtTest, editCbtTest, deleteCbtTest, togglePublish, viewCbtResults, initCbt

SECURITY FIX — preserve the safe card rendering approach from the original:
  Card titles, subjects, and class names are set via .textContent (not innerHTML)
  to prevent XSS. Only button data-tid attributes and safe string formatting
  use innerHTML.

deleteCbtTest: uses a custom overlay dialog (not browser confirm) — preserve
  the overlay approach with Promise-based user confirmation.

escHtml and toDatetimeLocalString remain internal (unexported).

For HTML onclick= compatibility in portals/teacher.js:
  window.loadCbtSection = loadCbtSection
  window.showCbtCreateForm = showCbtCreateForm
  window.addCbtQuestion = addCbtQuestion
  window.removeCbtQuestion = removeCbtQuestion
  window.saveCbtTest = saveCbtTest
  ... etc.
(These assignments happen in portals/teacher.js, not here.)

No window assignments.

File to create: features/cbt-teacher.js
```
**Attach:** `cbt-teacher.js`

---

### FILE 44 — `features/cbt-engine.js`

```
Convert the CBT pupil engine to an ES Module.

Source: cbt-engine.js (entire file).

This file runs on a standalone cbt-test.html page.

The module should:
- Import { db } from '../db.js'
- Import { firebase } from '../firebase-config.js'

Module-level state:
  let testData, questions, answers, flagged, currentQ, timerInterval,
  secondsLeft, tabSwitchCount, testId, currentUser, attemptStarted, submitted

DOMContentLoaded initialization: keep as module-body event listener.

Export for HTML onclick= attributes:
  export { startTest, nextQuestion, prevQuestion, toggleFlag,
           confirmSubmit, submitTest, showReview }

getGradeFromPct and showError remain internal.

For HTML onclick= compatibility, portals must assign to window — but since
cbt-test.html is a standalone page that loads only this module, add window
assignments AT THE BOTTOM of this file (exception to the rule, since there
is no portal entry point for the CBT test page):
  window.startTest = startTest
  window.nextQuestion = nextQuestion
  window.prevQuestion = prevQuestion
  window.toggleFlag = toggleFlag
  window.confirmSubmit = confirmSubmit
  window.submitTest = submitTest
  window.showReview = showReview

File to create: features/cbt-engine.js
```
**Attach:** `cbt-engine.js`

---

### FILE 45 — `features/lesson-notes-teacher.js`

```
Convert the teacher lesson notes module to an ES Module.

Source: lesson-notes-teacher.js (v1.0.1, entire file).

The module should:
- Import { db } from '../db.js'
- Import { firebase } from '../firebase-config.js'
- Import { getCurrentSettings } from '../shared/settings.js'
- Import { showToast, handleError } from '../ui/toast.js' and '../shared/errors.js'

Module-level state:
  let _assignedClasses = []
  let _currentUser = null
  let _ln_currentDocId = null
  let _ln_currentStatus = null
  let _ln_isSaving = false
  let _ln_allNotes = []

Export init function:
  export function initLessonNotes({ assignedClasses, currentUser })

Export named functions:
  loadLessonNotesSection, lnOpenNewForm, lnOpenEditForm, lnCloseForm,
  lnSaveNote, lnSubmitNote, lnPrintNote, lnApplyFilters, initLessonNotes

_lnGetClassSubjects: uses _assignedClasses cache first, falls back to
  Firestore classes/{classId} — preserve this exactly.

_lnRenderForm: async because it calls _lnGetClassSubjects and populates
  the subject dropdown. The classSelect 'change' event re-populates subjects.

lnSaveNote click guard (isSaving): uses module-level _ln_isSaving.

Version incrementing: reads current doc version, increments by 1,
  caps editHistory at LN_HISTORY_CAP = 5 snapshots.

No window assignments (portals/teacher.js handles those).

File to create: features/lesson-notes-teacher.js
```
**Attach:** `lesson-notes-teacher.js`

---

### FILE 46 — `features/lesson-notes-admin.js`

```
Convert the admin lesson notes module to an ES Module.

Source: lesson-notes-admin.js (entire file).

The module should:
- Import { db } from '../db.js'
- Import { auth } from '../auth.js'
- Import { firebase } from '../firebase-config.js'
- Import { showToast } from '../ui/toast.js'
- Accept paginateTable via an init function:
    export function initLessonNotesAdmin({ paginateTable })
  Store in module-level _paginateTable variable.

Export named functions:
  loadLessonNotesAdminSection, lnAdminApplyFilters, lnAdminClearFilters,
  lnAdminViewNote, lnAdminApproveNote, lnAdminRejectNote, lnAdminPrintNote,
  initLessonNotesAdmin

Module-level state:
  let _lnAdminAllNotes = []
  let _paginateTable = null

_lnWriteAudit and _lnAdminUpdateCache remain internal.

No window assignments.

File to create: features/lesson-notes-admin.js
```
**Attach:** `lesson-notes-admin.js`

---

### FILE 47 — `features/school-calendar.js`

```
Convert the school calendar module to an ES Module.

Source: school-calendar-admin.js (entire file).

The module should:
- Import { db } from '../db.js'
- Import { auth } from '../auth.js'
- Import { firebase } from '../firebase-config.js'
- Import { getCurrentSettings } from '../shared/settings.js'
- Import { showToast } from '../ui/toast.js'

Export the public API as named exports (used by attendance/daily.js):
  getNonSchoolDays(session, term)      → returns Set<string>
  isSchoolDay(dateString, session, term)
  filterSchoolDays(dateStrings, session, term)
  getCalendarEntries(session, term)

Export the admin section functions as named exports:
  loadSchoolCalendarSection()
  saveCalendarEntry()
  deleteCalendarEntry(docId, dateStr)
  applyCalendarFilter()
  exportCalendarCSV()
  toggleCalendarRange()

Export a default `schoolCalendar` namespace object:
  export default { getNonSchoolDays, isSchoolDay, filterSchoolDays, getCalendarEntries }
Also export as named: export { schoolCalendar as default, ... }

Module-level state:
  let _allCalendarEntries = []
  const CALENDAR_COLLECTION = 'school_calendar'
  const DAY_TYPES = { ... }
  const NON_SCHOOL_TYPES = new Set([...])

No window assignments (portals/admin.js handles those).

File to create: features/school-calendar.js
```
**Attach:** `school-calendar-admin.js`

---

### FILE 48 — `features/class-hierarchy.js`

```
Convert the class hierarchy to a reconciled ES Module.

Sources: class-hierarchy.js AND the window.classHierarchy object in admin.js.

RECONCILIATION — use admin.js versions for these (they are more robust):
  initializeClassHierarchy()   ← admin.js has transaction-safe init
  saveClassHierarchy(ids)      ← admin.js validates all classIds exist
  getHierarchy()               ← admin.js version (returns [{id, name}] array)
  getNextClass(name)           ← admin.js version (looks up classId → index → next)
  isTerminalClass(name)        ← admin.js version

Use class-hierarchy.js version for:
  getAllClassesInOrder()        ← reads from classes collection in hierarchy order

The module should:
- Import { db } from '../db.js'
- Import { auth } from '../auth.js' (for initializeClassHierarchy which uses auth.currentUser)
- Import { firebase } from '../firebase-config.js'
- Export all six functions as named exports
- Export a default `classHierarchy` namespace object with all six functions

initializeClassHierarchy: uses db.runTransaction to prevent race conditions
  (two admin sessions both seeing "no hierarchy exists" and both creating one).
  If transaction aborts (error.code === 'aborted'), return { success: false, retry: true }.

getGradeLevel(className): pure lookup — finds index in allClassesInOrder.
  Export this (it's in class-hierarchy.js but missing from admin.js).

No window assignments.

File to create: features/class-hierarchy.js
```
**Attach:** `class-hierarchy.js`, `admin.js`

---

### FILE 49 — `features/remark-templates.js`

```
Convert the remark templates module to an ES Module.

Source: remark-templates.js (entire file).

The module should:
- Import { db } from '../db.js'
- Import { auth } from '../auth.js'
- Import { getCurrentSettings } from '../shared/settings.js'
- Export named functions:
    getRemarkSuggestions(pupilId, term)
    getTemplateForGrade(averageScore)
    calculatePupilAverage(pupilId, term)
    saveCustomTemplate(template, category)
    loadAllTemplates()
- Export the templates object as a named const: export const REMARK_TEMPLATES = { ... }
- Export a default `remarkTemplates` namespace object containing all functions plus
  the templates as a `templates` property

getRemarkSuggestions: calls calculatePupilAverage which queries results collection
  filtered by pupilId + term + session (session from getCurrentSettings).

No window assignments.

File to create: features/remark-templates.js
```
**Attach:** `remark-templates.js`

---

### FILE 50 — `features/pupils-export.js`

```
Convert the pupils export module to an ES Module.

Source: pupils-export.js (entire file).

The module should:
- Import { db } from '../db.js'
- Import { showToast } from '../ui/toast.js'
- Import { handleError } from '../shared/errors.js'
- Export:
    exportPupilsToExcel()
    exportPupilsToPDF()
- Assumes XLSX (window.XLSX) and jsPDF (window.jspdf) loaded via CDN

No window assignments.

File to create: features/pupils-export.js
```
**Attach:** `pupils-export.js`

---

### FILE 51 — `ui/toast.js`

```
Create a thin re-export module for toast notifications.

This is a one-file alias so all other modules can import from a consistent
short path (../ui/toast.js) regardless of where they live in the tree.

Content:
  export { showToast, showLoading, hideLoading, retryOperation }
    from './script.js'

That's the entire file. Under 5 lines.

Note: showToast is defined in ui/script.js (the public website JS) and also
handles the case where document.body is not yet ready (queues via
DOMContentLoaded). That implementation is the canonical one — all other modules
import it from here.

File to create: ui/toast.js
```
**Attach:** `script.js`

---

### FILE 52 — `ui/button-loader.js`

```
Convert the global button loader to an ES Module.

Source: button-loader.js (entire file).

The module should:
- Zero Firebase dependencies
- Export:
    export const ACTION_REGISTRY = { ... }  ← the full registry from the source
    export function init()
    export const ButtonLoader = { start, wrap, register }
- The auto-intercept wires up when the module loads (init() called in module body)
- MutationObserver starts in module body
- window.ButtonLoader = ButtonLoader  ← keep this one assignment (developer tool)
- No other window assignments

ACTION_REGISTRY: export as a mutable const so portals can add entries:
  import { ACTION_REGISTRY } from '../ui/button-loader.js'
  ACTION_REGISTRY['myNewAction'] = 'myWindowFnName'

File to create: ui/button-loader.js
```
**Attach:** `button-loader.js`

---

### FILE 53 — `ui/script.js`

```
Convert the public website JavaScript to an ES Module.

Source: script.js (v3.1, the full replacement).

The module should:
- Zero Firebase dependencies
- Export these as named exports:
    showToast(message, type = 'info', duration = 3000)
    showLoading(elementId, message)
    hideLoading(elementId)
    retryOperation(operation, maxRetries = 3)
- All init functions remain internal:
    initNavigation, initScrollReveal, initTypingHeadline, initCountUp,
    initTestimonialMarquee, initFAQ, initGalleryLightbox, initContactForm,
    initAdmissionsForm, initSmoothScroll, setCopyrightYear, initKeyboardNavigation
- The DOMContentLoaded block at the bottom runs all inits automatically on import
- Module-level state: the CSS spin style is injected once in module body
- Keep these window assignments (needed by legacy inline HTML handlers):
    window.showToast = showToast
    window.showLoading = showLoading
    window.hideLoading = hideLoading
    window.FahmidUtils = { debounce, throttle, announceToScreenReader }
- Import { debounce, throttle, sleep, announceToScreenReader } from '../shared/utils.js'
  (move them out of this file to shared/utils.js, import back here for window.FahmidUtils)
- Online/offline event listeners wired in module body
- Global error handlers (window.addEventListener('error') etc.) wired in module body

File to create: ui/script.js
```
**Attach:** `script.js`

---

## HTML Script Tag Changes

After all modules are created, update each HTML file's `<script>` tags.

**For admin.html:**
```html
<!-- Firebase compat SDK (must stay as classic scripts) -->
<script src="https://www.gstatic.com/firebasejs/9.x.x/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.x.x/firebase-auth-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.x.x/firebase-firestore-compat.js"></script>

<!-- jsPDF, SheetJS, lucide, Chart.js CDN scripts (stay as classic) -->

<!-- Your app — single entry point -->
<script type="module" src="portals/admin.js"></script>
```

**For teacher.html:**
```html
<!-- Firebase CDN scripts as above -->
<script type="module" src="portals/teacher.js"></script>
```

**For pupil.html:**
```html
<!-- Firebase CDN scripts as above -->
<script type="module" src="portals/pupil.js"></script>
```

**For print-results.html:**
```html
<!-- Firebase CDN scripts as above -->
<script type="module" src="portals/print-results.js"></script>
```

**For cbt-test.html (standalone CBT test page):**
```html
<!-- Firebase CDN scripts as above -->
<script type="module" src="features/cbt-engine.js"></script>
```

**For public pages (index.html, about.html, etc.):**
```html
<!-- No Firebase needed -->
<script type="module" src="ui/script.js"></script>
```

---

## Firestore Security Rules — No Changes Needed

The Firestore rules operate on the server side and are independent of ESM vs
classic scripts. The existing `firestore.rules` file requires no modifications.

---

## Common Pitfalls to Avoid

| Pitfall | Fix |
|---------|-----|
| `firebase.firestore.FieldValue` not found | Import `firebase` from `firebase-config.js`; use `firebase.firestore.FieldValue.serverTimestamp()` |
| Circular import error at runtime | Verify fee-calculator.js and outstanding.js use the dependency injection pattern |
| `window.X is not a function` onclick error | Check portals/admin.js assigns that function to window |
| paginateTable breaks for teacher tables | Use the reconciled `admin/pagination.js` version that handles both <tbody> direct and table#id styles |
| Auth not ready when module body runs | The checkRole pattern is already async — module body sets up the listener, doesn't call it synchronously |
| Double-init of sidebar (flash of unstyled content) | admin/sidebar.js uses module-level `let _sidebarInitialized = false` (not `window.adminSidebarInitialized`) |
| Attendance UI modal not showing | Verify _ensureModalInBody() appends to `document.body`, not the container div |
| lucide icons not rendering in dynamic content | Call `lucide.createIcons()` after injecting any HTML that contains `data-lucide` attributes |
| Service worker registration fails | Keep service-worker.js as a classic script; do not convert to ESM |
