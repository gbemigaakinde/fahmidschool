// finance/fee-calculator.js
// Fee calculation, arrears, and enrollment utilities (ES Module)
// Uses Firebase v9+ modular SDK.

import { db } from '../db.js';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
} from 'https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js';

// ============================================
// PURE HELPERS
// ============================================

/**
 * Derive the previous session name from the current one.
 * e.g. "2025/2026" → "2024/2025"
 */
export function getPreviousSessionName(currentSession) {
  const match = currentSession.match(/(\d{4})\/(\d{4})/);
  if (!match) return null;

  const startYear = parseInt(match[1]);
  const endYear   = parseInt(match[2]);

  return `${startYear - 1}/${endYear - 1}`;
}

/**
 * Safely extract the class ID from a pupil's class field.
 * Handles both the current object format { id, name } and returns null
 * for legacy string-only records (ID cannot be recovered from the name alone).
 *
 * Exported so outstanding.js can import it without duplicating the logic.
 */
export function getClassIdSafely(pupilData) {
  if (!pupilData || !pupilData.class) return null;

  if (typeof pupilData.class === 'object' && pupilData.class.id) {
    return pupilData.class.id;
  }

  // Old format: plain string class name — ID cannot be recovered
  return null;
}

// ============================================
// ENROLLMENT CHECK (internal — not exported)
// ============================================

/**
 * Check whether a pupil was enrolled in a given session + term.
 *
 * FIX 2: Uses admissionSession + admissionTerm directly instead of
 * relying on createdAt, which can be wrong for legacy/migrated records.
 */
function wasEnrolledIn(pupilData, checkSession, checkTerm) {
  const termOrder = {
    'First Term':  1,
    'Second Term': 2,
    'Third Term':  3,
  };

  const admissionSession = pupilData.admissionSession || null;
  const admissionTerm    = pupilData.admissionTerm    || 'First Term';
  const exitTerm         = pupilData.exitTerm         || 'Third Term';

  // Pupil left before this term
  if ((termOrder[checkTerm] || 1) > (termOrder[exitTerm] || 3)) return false;

  if (!admissionSession) {
    // Legacy data: no session recorded. Use admissionTerm as a within-session
    // guard. Cannot compare sessions, so trust termOrder only.
    return (termOrder[checkTerm] || 1) >= (termOrder[admissionTerm] || 1);
  }

  const sessionStartYear = (s) => {
    const m = (s || '').match(/(\d{4})\//);
    return m ? parseInt(m[1]) : 0;
  };

  const admissionYear = sessionStartYear(admissionSession);
  const checkYear     = sessionStartYear(checkSession);

  if (checkYear < admissionYear) return false;
  if (checkYear > admissionYear) return true;

  // Same session — compare terms
  if ((termOrder[admissionTerm] || 1) > (termOrder[checkTerm] || 1)) return false;

  return true;
}

// ============================================
// ADJUSTED FEE
// ============================================

/**
 * Calculate the fee actually owed by a specific pupil for a specific term,
 * applying their individual adjustments on top of the class base fee.
 *
 * FIXED: Both adjustments apply to baseFee independently, then combine.
 * Previously: percent was applied first, then amount was applied to the
 * already-discounted result — causing unintended compounding.
 */
export function calculateAdjustedFee(pupilData, baseFee, currentTerm) {
  if (!pupilData || typeof baseFee !== 'number') {
    console.warn('[fee-calculator] Invalid pupilData or baseFee passed to calculateAdjustedFee');
    return baseFee || 0;
  }

  const termOrder = {
    'First Term':  1,
    'Second Term': 2,
    'Third Term':  3,
  };

  const currentTermNum   = termOrder[currentTerm] || 1;
  const admissionTermNum = termOrder[pupilData.admissionTerm || 'First Term'] || 1;
  const exitTermNum      = termOrder[pupilData.exitTerm      || 'Third Term'] || 3;

  if (currentTermNum < admissionTermNum || currentTermNum > exitTermNum) {
    console.log(`[fee-calculator] Pupil ${pupilData.name} not enrolled for ${currentTerm}`);
    return 0;
  }

  // Round base fee on entry — guards against unrounded legacy values in Firestore
  const base = Math.round(Number(baseFee) || 0);

  const percentAdjustment = Number(pupilData.feeAdjustmentPercent) || 0;
  const amountAdjustment  = Number(pupilData.feeAdjustmentAmount)  || 0;

  const percentDiscount = Math.round(base * (percentAdjustment / 100));
  const adjustedFee     = Math.round(base + percentDiscount + amountAdjustment);

  if (percentAdjustment !== 0) {
    console.log(
      `[fee-calculator] Applied ${percentAdjustment}% adjustment: ` +
      `₦${base.toLocaleString()} → discount ₦${percentDiscount.toLocaleString()}`
    );
  }
  if (amountAdjustment !== 0) {
    console.log(`[fee-calculator] Applied ₦${amountAdjustment.toLocaleString()} fixed adjustment`);
  }

  const finalFee = Math.max(0, adjustedFee);
  console.log(`[fee-calculator] Final adjusted fee: ₦${finalFee.toLocaleString()}`);
  return finalFee;
}

// ============================================
// SINGLE-TERM BALANCE RECALCULATION
// ============================================

/**
 * Recalculate a single term's outstanding balance from the fee structure and
 * payment transactions, rather than relying on the stored balance field.
 *
 * FIXES APPLIED:
 * - Uses historical classId from payment_transactions (prevents promotion from
 *   retroactively altering prior-term fee calculations).
 * - Uses historical baseFee from payment_transactions when available (prevents
 *   fee structure changes from retroactively altering balances).
 * - Falls back to current pupil class + live fee only when no history exists.
 *
 * NOTE: This function calculates ONE term's own balance only — no arrears cascade.
 * It is the last-resort fallback. The preferred recalculation path goes through
 * calculateCurrentOutstanding (injected into calculateCompleteArrears) so that
 * the full arrears chain is preserved.
 */
export async function _recalculateTermBalance(pupilId, session, term) {
  try {
    console.log(`[fee-calculator] _recalculateTermBalance: ${term} ${session} for ${pupilId}`);

    const pupilDoc = await getDoc(doc(db, 'pupils', pupilId));
    if (!pupilDoc.exists()) {
      console.warn(`[fee-calculator] Pupil ${pupilId} not found`);
      return 0;
    }

    const pupilData = pupilDoc.data();

    if (pupilData.status === 'alumni' || pupilData.isActive === false) {
      return 0;
    }

    // ── HISTORICAL RESOLUTION: class and fee at time of term ─────────────────
    let resolvedClassId = null;
    let resolvedBaseFee = null;

    try {
      const txSnap = await getDocs(
        query(
          collection(db, 'payment_transactions'),
          where('pupilId', '==', pupilId),
          where('session', '==', session),
          where('term',    '==', term),
          orderBy('paymentDate', 'asc'),
          limit(1)
        )
      );

      if (!txSnap.empty) {
        const firstTx = txSnap.docs[0].data();
        if (firstTx.classId) {
          resolvedClassId = firstTx.classId;
          console.log(`[fee-calculator] Using historical classId: ${resolvedClassId}`);
        }
        if (typeof firstTx.baseFee === 'number' && firstTx.baseFee > 0) {
          resolvedBaseFee = firstTx.baseFee;
          console.log(`[fee-calculator] Using historical baseFee: ₦${resolvedBaseFee.toLocaleString()}`);
        }
      }
    } catch (txError) {
      console.warn(
        '[fee-calculator] Could not read payment_transactions for historical snapshot:',
        txError.message
      );
    }

    // ── FALLBACK: current pupil class ─────────────────────────────────────────
    if (!resolvedClassId) {
      resolvedClassId = getClassIdSafely(pupilData);
      if (!resolvedClassId) {
        console.warn('[fee-calculator] No classId available (historical or current)');
        return 0;
      }
      console.log(`[fee-calculator] No historical class — using current class: ${resolvedClassId}`);
    }

    // ── FEE RESOLUTION ────────────────────────────────────────────────────────
    if (resolvedBaseFee === null) {
      const feeDoc = await getDoc(doc(db, 'fee_structures', `fee_${resolvedClassId}`));
      if (!feeDoc.exists()) {
        console.warn('[fee-calculator] No fee structure for resolved class');
        return 0;
      }
      resolvedBaseFee = Math.round(Number(feeDoc.data().total) || 0);
      console.log(
        `[fee-calculator] No historical fee — using current fee structure: ₦${resolvedBaseFee.toLocaleString()}`
      );
    }

    const amountDue = calculateAdjustedFee(pupilData, resolvedBaseFee, term);

    const encodedSession = session.replace(/\//g, '-');
    const paymentDocId   = `${pupilId}_${encodedSession}_${term}`;
    let totalPaid = 0;

    try {
      const paymentDoc = await getDoc(doc(db, 'payments', paymentDocId));
      if (paymentDoc.exists()) {
        totalPaid = Math.max(0, Math.round(Number(paymentDoc.data().totalPaid) || 0));
      }
    } catch (e) {
      // No payment doc — totalPaid stays 0
    }

    const balance = Math.max(0, amountDue - totalPaid);
    console.log(
      `[fee-calculator] Recalculated ${term} ${session} for ${pupilData.name}: ` +
      `due=₦${amountDue.toLocaleString()}, paid=₦${totalPaid.toLocaleString()}, ` +
      `balance=₦${balance.toLocaleString()}`
    );

    return balance;

  } catch (error) {
    console.error('[fee-calculator] _recalculateTermBalance error:', error);
    return 0;
  }
}

// ============================================
// SESSION BALANCE (proxy via Third Term)
// ============================================

/**
 * Return the pupil's outstanding balance for an entire session by reading
 * the Third Term payment doc (which already cascades Second and First Term
 * arrears). Falls back to calculateCurrentOutstanding (injected) when the
 * doc is missing or corrupt, so prior arrears are included in the figure.
 *
 * FIX 4: Corrupt-balance and missing-doc paths now use the injected
 * getOutstanding helper, not _recalculateTermBalance. This preserves the
 * full arrears cascade for pupils in those edge cases.
 *
 * @param {string}   pupilId
 * @param {string}   session
 * @param {Function} [getOutstanding]  Injected resolver; falls back to _recalculateTermBalance.
 * @returns {Promise<number>}
 */
export async function calculateSessionBalanceSafe(
  pupilId,
  session,
  getOutstanding = async (pid, sess, t) => ({ balance: await _recalculateTermBalance(pid, sess, t) })
) {
  try {
    const encodedSession = session.replace(/\//g, '-');
    console.log(`[fee-calculator] Checking session balance for ${session}...`);

    const termsToCheck = ['Third Term', 'Second Term', 'First Term'];

    for (const termName of termsToCheck) {
      const docId = `${pupilId}_${encodedSession}_${termName}`;

      try {
        const termDoc = await getDoc(doc(db, 'payments', docId));

        if (termDoc.exists()) {
          const rawBalance = termDoc.data().balance;
          const balance    = Number(rawBalance);

          if (rawBalance === undefined || rawBalance === null || isNaN(balance)) {
            // FIX 4: Use injected getOutstanding so prior arrears are included.
            console.warn(
              `[fee-calculator] Invalid balance field in ${termName} doc — recalculating via getOutstanding`
            );
            try {
              const result      = await getOutstanding(pupilId, session, termName);
              const recalculated = result.balance || 0;
              console.log(
                `[fee-calculator] Recalculated ${termName} balance: ₦${recalculated.toLocaleString()}`
              );
              return recalculated;
            } catch (e) {
              console.error(
                `[fee-calculator] getOutstanding fallback failed for ${termName}:`, e.message
              );
              // Last resort
              return await _recalculateTermBalance(pupilId, session, termName);
            }
          }

          if (balance > 0) {
            console.log(`[fee-calculator] Found balance in ${termName}: ₦${balance.toLocaleString()}`);
          } else {
            console.log(`[fee-calculator] ${termName} document found — session fully paid`);
          }

          return Math.max(0, Math.round(balance));

        } else {
          console.log(
            `[fee-calculator] No ${termName} document for ${session} — checking earlier term`
          );
        }

      } catch (error) {
        console.warn(
          `[fee-calculator] Could not fetch ${termName} for ${session}:`, error.message
        );
      }
    }

    // No payment docs found — check admissionSession to see if pupil was enrolled
    console.log(`[fee-calculator] No payment records for ${session} — checking enrolment`);

    try {
      const pupilDoc = await getDoc(doc(db, 'pupils', pupilId));
      if (pupilDoc.exists()) {
        const pupilData        = pupilDoc.data();
        const admissionSession = pupilData.admissionSession || null;

        if (admissionSession) {
          const sessionStartYear = (s) => {
            const m = (s || '').match(/(\d{4})\//);
            return m ? parseInt(m[1]) : 0;
          };
          if (sessionStartYear(session) < sessionStartYear(admissionSession)) {
            console.log(
              `[fee-calculator] Pupil admitted in ${admissionSession} — not enrolled in ${session}. No arrears.`
            );
            return 0;
          }
        } else {
          console.log(
            `[fee-calculator] No admissionSession on record — assuming enrolled in ${session}`
          );
        }
      }
    } catch (enrollmentCheckError) {
      console.warn('[fee-calculator] Could not check enrolment:', enrollmentCheckError.message);
    }

    // Pupil was (or may have been) enrolled — fall back via getOutstanding so
    // the Third Term proxy figure includes any cascaded arrears.
    console.log(
      `[fee-calculator] Recalculating Third Term of ${session} as session balance proxy`
    );
    try {
      const result   = await getOutstanding(pupilId, session, 'Third Term');
      const fallback = result.balance || 0;
      console.log(`[fee-calculator] Fallback recalculated: ₦${fallback.toLocaleString()}`);
      return fallback;
    } catch (fallbackError) {
      console.error('[fee-calculator] Final fallback failed:', fallbackError.message);
    }

    return 0;

  } catch (error) {
    console.error('[fee-calculator] calculateSessionBalanceSafe error:', error);
    return 0;
  }
}

// ============================================
// COMPLETE ARREARS
// ============================================

/**
 * Calculate the total arrears a pupil carries into the given term.
 *
 * LOGIC:
 * - First Term of session  → carry ENTIRE previous session balance
 * - Second / Third Term    → carry ONLY previous term balance (already cascaded)
 *
 * To avoid a circular dependency with finance/outstanding.js, this function
 * accepts calculateCurrentOutstanding via dependency injection.
 * When omitted (e.g. in tests), it falls back to _recalculateTermBalance.
 *
 * FIX 4: All corrupt-balance and missing-doc paths use getOutstanding (the
 * injected calculateCurrentOutstanding), not _recalculateTermBalance, so the
 * full arrears cascade is preserved for every fallback branch.
 *
 * @param {string} pupilId
 * @param {string} currentSession
 * @param {string} currentTerm
 * @param {{ calculateCurrentOutstanding?: Function }} [deps]
 * @returns {Promise<number>}
 */
export async function calculateCompleteArrears(
  pupilId,
  currentSession,
  currentTerm,
  { calculateCurrentOutstanding } = {}
) {
  try {
    let totalArrears = 0;
    const encodedSession = currentSession.replace(/\//g, '-');

    const termOrder = {
      'First Term':  1,
      'Second Term': 2,
      'Third Term':  3,
    };

    const currentTermNum = termOrder[currentTerm] || 1;

    console.log(
      `[fee-calculator] calculateCompleteArrears: pupil=${pupilId} ` +
      `term=${currentTerm} session=${currentSession}`
    );

    // ── Cache pupil data ────────────────────────────────────────────────────
    let pupilDataCache = null;
    const getPupilData = async () => {
      if (pupilDataCache) return pupilDataCache;
      const docSnap = await getDoc(doc(db, 'pupils', pupilId));
      pupilDataCache = docSnap.exists() ? docSnap.data() : null;
      return pupilDataCache;
    };

    // ── FIX 4: Use injected calculateCurrentOutstanding for all fallback paths.
    // Falls back to _recalculateTermBalance only as a last resort (no injection).
    const getOutstanding = async (pid, sess, term) => {
      if (typeof calculateCurrentOutstanding === 'function') {
        return calculateCurrentOutstanding(pid, sess, term);
      }
      const balance = await _recalculateTermBalance(pid, sess, term);
      return { balance };
    };

    if (currentTermNum === 1) {
      // ── FIRST TERM: carry entire previous session balance ─────────────────
      const previousSession = getPreviousSessionName(currentSession);

      if (previousSession) {
        console.log(`[fee-calculator] Checking previous session: ${previousSession}`);

        const pupilData = await getPupilData();
        if (pupilData) {
          const enrolled = wasEnrolledIn(pupilData, previousSession, 'Third Term');
          if (!enrolled) {
            console.log(
              `[fee-calculator] Pupil was not enrolled in ${previousSession}. No arrears to carry forward.`
            );
            return 0;
          }
        }

        try {
          // Pass getOutstanding into calculateSessionBalanceSafe so its own
          // corrupt-balance fallbacks also use the full cascade.
          const sessionArrears = await calculateSessionBalanceSafe(
            pupilId,
            previousSession,
            getOutstanding
          );
          totalArrears = sessionArrears;

          if (sessionArrears > 0) {
            console.log(
              `[fee-calculator] Previous session arrears: ₦${sessionArrears.toLocaleString()}`
            );
          } else {
            console.log(`[fee-calculator] No arrears from previous session`);
          }
        } catch (error) {
          console.error(
            `[fee-calculator] Error fetching previous session balance:`, error.message
          );
          totalArrears = 0;
        }

      } else {
        console.log(`[fee-calculator] No previous session (first session on record)`);
      }

    } else {
      // ── SECOND / THIRD TERM: carry only previous term balance ─────────────
      const previousTermName = Object.keys(termOrder).find(
        key => termOrder[key] === currentTermNum - 1
      );

      if (previousTermName) {
        const pupilData = await getPupilData();
        if (pupilData) {
          const enrolled = wasEnrolledIn(pupilData, currentSession, previousTermName);
          if (!enrolled) {
            console.log(
              `[fee-calculator] Pupil was not enrolled in ${previousTermName} of ${currentSession}. No arrears.`
            );
            return 0;
          }
        }

        const prevTermDocId = `${pupilId}_${encodedSession}_${previousTermName}`;
        console.log(
          `[fee-calculator] Checking previous term: ${previousTermName} (doc: ${prevTermDocId})`
        );

        try {
          const prevTermDoc = await getDoc(doc(db, 'payments', prevTermDocId));

          if (prevTermDoc.exists()) {
            const rawBalance = prevTermDoc.data().balance;
            const parsed     = Number(rawBalance);

            if (rawBalance === undefined || rawBalance === null || isNaN(parsed)) {
              // FIX 4: Use getOutstanding so prior-term arrears are included.
              console.warn(
                `[fee-calculator] Invalid balance in ${previousTermName} doc. ` +
                `Recalculating via getOutstanding...`
              );
              try {
                const result = await getOutstanding(pupilId, currentSession, previousTermName);
                totalArrears = result.balance || 0;
              } catch (e) {
                console.error('[fee-calculator] getOutstanding fallback failed:', e.message);
                totalArrears = 0;
              }

            } else {
              totalArrears = Math.max(0, Math.round(parsed));
              if (totalArrears > 0) {
                console.log(
                  `[fee-calculator] ${previousTermName} outstanding: ₦${totalArrears.toLocaleString()}`
                );
              } else {
                console.log(`[fee-calculator] ${previousTermName} fully paid`);
              }
            }

          } else {
            // No payment doc — pupil was enrolled but has no record.
            // FIX 4: Use getOutstanding so multi-term debt chains cascade correctly.
            console.warn(
              `[fee-calculator] No payment record for ${previousTermName} in ${currentSession}. ` +
              `Calculating full outstanding balance...`
            );
            try {
              const result = await getOutstanding(pupilId, currentSession, previousTermName);
              totalArrears = result.balance || 0;
            } catch (e) {
              console.error('[fee-calculator] getOutstanding fallback failed:', e.message);
              // Last resort
              try {
                totalArrears = await _recalculateTermBalance(
                  pupilId, currentSession, previousTermName
                );
              } catch (e2) {
                totalArrears = 0;
              }
            }

            if (totalArrears > 0) {
              console.log(
                `[fee-calculator] Calculated ${previousTermName} balance: ₦${totalArrears.toLocaleString()}`
              );
            } else {
              console.log(
                `[fee-calculator] ${previousTermName}: no fee configured or not enrolled`
              );
            }
          }

        } catch (readError) {
          console.error(
            `[fee-calculator] Failed to read ${previousTermName}:`, readError.message
          );
          totalArrears = 0;
        }
      }
    }

    console.log(`[fee-calculator] Total arrears resolved: ₦${totalArrears.toLocaleString()}`);
    return totalArrears;

  } catch (error) {
    console.error('[fee-calculator] calculateCompleteArrears error:', error);
    return 0;
  }
}
