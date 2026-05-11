import { db } from '../db.js';
import {
  calculateAdjustedFee,
  calculateCompleteArrears as _calcArrears,
  getClassIdSafely,
} from './fee-calculator.js';

import { doc, getDoc } from 'firebase/firestore';

export async function calculateCurrentOutstanding(pupilId, session, term) {
  try {
    console.log(`\n📊 [FINANCE] Calculating outstanding for Pupil ${pupilId}`);
    console.log(`   Session: ${session}, Term: ${term}`);

    const pupilSnap = await getDoc(doc(db, 'pupils', pupilId));
    if (!pupilSnap.exists()) {
      throw new Error('Pupil not found');
    }
    const pupilData = pupilSnap.data();
    console.log(`   ✓ Pupil: ${pupilData.name}`);

    if (pupilData.status === 'alumni' || pupilData.isActive === false) {
      return {
        amountDue: 0, arrears: 0, totalDue: 0, totalPaid: 0,
        balance: 0,  credit: 0,
        reason: 'Alumni — not an active pupil',
      };
    }

    const classId = getClassIdSafely(pupilData);
    if (!classId) {
      console.warn(`   ⚠️ No valid classId for pupil ${pupilId}`);
      return {
        pupilId,
        pupilName: pupilData.name,
        session,
        term,
        amountDue: 0, arrears: 0, totalDue: 0, totalPaid: 0,
        balance: 0,  credit: 0,
        reason: 'Invalid class data - contact admin',
      };
    }
    console.log(`   ✓ Class ID: ${classId}`);

    const feeSnap = await getDoc(doc(db, 'fee_structures', `fee_${classId}`));
    if (!feeSnap.exists()) {
      console.warn(`   ⚠️ No fee structure for class ${classId}`);
      return {
        pupilId,
        pupilName: pupilData.name,
        classId,
        className: pupilData.class?.name || 'Unknown',
        session,
        term,
        amountDue: 0, arrears: 0, totalDue: 0, totalPaid: 0,
        balance: 0,  credit: 0,
        reason: 'No fee structure configured for this class',
      };
    }

    const baseFee = Math.round(Number(feeSnap.data().total) || 0);
    console.log(`   ✓ Base fee: ₦${baseFee.toLocaleString()}`);

    const amountDue = calculateAdjustedFee(pupilData, baseFee, term);

    if (amountDue === 0 && baseFee > 0) {
      return {
        pupilId,
        pupilName: pupilData.name,
        classId,
        className: pupilData.class?.name || 'Unknown',
        session,
        term,
        amountDue: 0, arrears: 0, totalDue: 0, totalPaid: 0,
        balance: 0,  credit: 0,
        reason: 'Not enrolled for this term',
      };
    }

    if (amountDue !== baseFee) {
      console.log(
        `   ✓ Adjusted fee: ₦${amountDue.toLocaleString()} (was ₦${baseFee.toLocaleString()})`
      );
    }

    // Pass ourselves as the injection so fee-calculator.js can call back
    // without a circular ES Module import.
    const arrears = await _calcArrears(pupilId, session, term, {
      calculateCurrentOutstanding,
    });
    console.log(`   ✓ Arrears: ₦${arrears.toLocaleString()}`);

    const encodedSession = session.replace(/\//g, '-');
    const paymentDocId   = `${pupilId}_${encodedSession}_${term}`;

    let totalPaid = 0;
    try {
      const paymentSnap = await getDoc(doc(db, 'payments', paymentDocId));
      if (paymentSnap.exists()) {
        totalPaid = Math.round(
          Math.max(0, Number(paymentSnap.data().totalPaid) || 0)
        );
      }
    } catch (err) {
      console.warn('   ⚠️ Could not read payment doc:', err.message);
    }
    console.log(`   ✓ Total paid: ₦${totalPaid.toLocaleString()}`);

    const totalDue   = amountDue + arrears;
    const rawBalance = totalDue - totalPaid;
    const balance    = Math.max(0, rawBalance);
    const credit     = rawBalance < 0 ? Math.abs(rawBalance) : 0;

    let status;
    if (rawBalance < 0) {
      status = 'overpaid';
    } else if (balance === 0) {
      status = totalPaid > 0 ? 'paid' : 'owing';
    } else if (totalPaid > 0) {
      status = 'partial';
    } else if (arrears > 0) {
      status = 'owing_with_arrears';
    } else {
      status = 'owing';
    }

    console.log(`   ═══════════════════════════════════════`);
    console.log(`   Total Due:  ₦${totalDue.toLocaleString()}`);
    console.log(`   Balance:    ₦${balance.toLocaleString()}`);
    if (credit > 0) {
      console.log(`   Credit:     ₦${credit.toLocaleString()} (overpaid)`);
    }
    console.log(`   Status:     ${status}`);
    console.log(`   ═══════════════════════════════════════\n`);

    return {
      pupilId,
      pupilName: pupilData.name,
      classId,
      className: pupilData.class?.name || 'Unknown',
      session,
      term,
      baseFee,
      amountDue,
      arrears,
      totalDue,
      totalPaid,
      balance,
      credit,
      status,
    };

  } catch (error) {
    console.error('❌ [FINANCE] Error calculating outstanding:', error);
    throw error;
  }
}
