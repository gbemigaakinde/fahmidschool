import { db }   from '../db.js';
import { auth } from '../auth.js';
import { calculateAdjustedFee, calculateCompleteArrears } from './fee-calculator.js';

import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js';

export async function recordPayment(
  pupilId,
  pupilName,
  classId,
  className,
  session,
  term,
  paymentData
) {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('No authenticated user — cannot record payment');
  }

  const amountPaid = Math.round(parseFloat(paymentData.amountPaid));
  if (!amountPaid || amountPaid <= 0) {
    throw new Error('Invalid payment amount');
  }

  const encodedSession = session.replace(/\//g, '-');

  const pupilSnap = await getDoc(doc(db, 'pupils', pupilId));
  if (!pupilSnap.exists()) {
    throw new Error('Pupil profile not found');
  }
  const pupilData = pupilSnap.data();

  const feeSnap = await getDoc(doc(db, 'fee_structures', `fee_${classId}`));
  if (!feeSnap.exists()) {
    throw new Error(`Fee structure not configured for class: ${className}`);
  }
  const baseFee = Math.round(Number(feeSnap.data().total) || 0);

  const amountDue = calculateAdjustedFee(pupilData, baseFee, term);

  const arrears = await calculateCompleteArrears(pupilId, session, term);

  const paymentRecordId = `${pupilId}_${encodedSession}_${term}`;
  const paymentRef      = doc(db, 'payments', paymentRecordId);

  let currentTotalPaid = 0;
  const existingSnap   = await getDoc(paymentRef);

  if (existingSnap.exists()) {
    currentTotalPaid = Number(existingSnap.data().totalPaid) || 0;

    const storedArrears = Number(existingSnap.data().arrears) || 0;
    if (storedArrears !== arrears) {
      console.warn(
        `[payment-recorder] Arrears mismatch — stored: ₦${storedArrears.toLocaleString()}, ` +
        `recalculated: ₦${arrears.toLocaleString()}. Using recalculated value.`
      );
    }
  }

  const totalDue         = amountDue + arrears;
  const remainingBalance = totalDue - currentTotalPaid;
  const newTotalPaid     = currentTotalPaid + amountPaid;
  const newBalance       = totalDue - newTotalPaid;

  const ROUNDING_TOLERANCE = 1;

  if (newTotalPaid > totalDue + ROUNDING_TOLERANCE) {
    const overpayment = newTotalPaid - totalDue;
    throw new Error(
      `⚠️ PAYMENT REJECTED: Overpayment Detected\n\n` +
      `FINANCIAL SUMMARY:\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `Current Term Fee: ₦${amountDue.toLocaleString()}\n` +
      `Outstanding Arrears: ₦${arrears.toLocaleString()}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `TOTAL DUE: ₦${totalDue.toLocaleString()}\n` +
      `Already Paid: ₦${currentTotalPaid.toLocaleString()}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `REMAINING BALANCE: ₦${remainingBalance.toLocaleString()}\n\n` +
      `YOUR PAYMENT: ₦${amountPaid.toLocaleString()}\n\n` +
      `❌ This payment would overpay by ₦${overpayment.toLocaleString()}\n\n` +
      `Maximum you can pay: ₦${remainingBalance.toLocaleString()}`
    );
  }

  let arrearsPayment     = 0;
  let currentTermPayment = 0;

  if (arrears > 0) {
    if (amountPaid <= arrears) {
      arrearsPayment     = amountPaid;
      currentTermPayment = 0;
    } else {
      arrearsPayment     = arrears;
      currentTermPayment = amountPaid - arrears;
    }
  } else {
    currentTermPayment = amountPaid;
  }

  const balanceBefore = Math.max(0, remainingBalance);
  const balanceAfter  = Math.max(0, newBalance);

  const paymentStatus =
    balanceAfter === 0 ? 'paid'               :
    newTotalPaid  > 0  ? 'partial'            :
    arrears       > 0  ? 'owing_with_arrears' : 'owing';

  const receiptNo      = await generateReceiptNumber();
  const transactionRef = doc(db, 'payment_transactions', receiptNo);

  const transactionData = {
    pupilId,
    pupilName,
    classId,
    className,
    session,
    term,
    baseFee,
    adjustedFee:        amountDue,
    feeAdjustment:      baseFee - amountDue,
    amountDue,
    arrears,
    totalDue,
    amountPaid,
    arrearsPayment,
    currentTermPayment,
    totalPaidBefore:    currentTotalPaid,
    totalPaidAfter:     newTotalPaid,
    balanceBefore,
    balanceAfter,
    status:             paymentStatus,
    paymentMethod:      paymentData.paymentMethod || 'Cash',
    notes:              paymentData.notes         || '',
    paymentDate:        serverTimestamp(),
    receiptNo,
    recordedBy:         currentUser.uid,
    recordedByEmail:    currentUser.email,
  };

  await runTransaction(db, async (tx) => {
    tx.set(transactionRef, transactionData);

    tx.set(
      paymentRef,
      {
        pupilId,
        pupilName,
        classId,
        className,
        session,
        term,
        baseFee,
        adjustedFee:       amountDue,
        amountDue,
        arrears,
        totalDue,
        totalPaid:         newTotalPaid,
        balance:           balanceAfter,
        status:            paymentStatus,
        lastPaymentDate:   serverTimestamp(),
        lastPaymentAmount: amountPaid,
        lastReceiptNo:     receiptNo,
        updatedAt:         serverTimestamp(),
      },
      { merge: true }
    );
  });

  return {
    success:           true,
    receiptNo,
    amountPaid,
    arrearsPayment,
    currentTermPayment,
    newBalance:        balanceAfter,
    totalPaid:         newTotalPaid,
    status:            paymentStatus,
    baseFee,
    adjustedFee:       amountDue,
  };
}

export async function generateReceiptNumber() {
  const date  = new Date();
  const year  = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day   = String(date.getDate()).padStart(2, '0');

  const counterRef = doc(db, 'counters', `receipt_counter_${year}${month}${day}`);

  let counter = 1;

  try {
    await runTransaction(db, async (tx) => {
      const counterSnap = await tx.get(counterRef);

      if (counterSnap.exists()) {
        counter = (counterSnap.data().count || 0) + 1;
        tx.update(counterRef, {
          count:       counter,
          lastUpdated: serverTimestamp(),
        });
      } else {
        tx.set(counterRef, {
          count: 1,
          date:  serverTimestamp(),
        });
      }
    });
  } catch (error) {
    console.error('[payment-recorder] Counter increment failed:', error);
    counter = Date.now() % 10000;
  }

  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `RCT${year}${month}${day}${String(counter).padStart(4, '0')}${random}`;
}
