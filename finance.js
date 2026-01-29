/**
 * FAHMID NURSERY & PRIMARY SCHOOL
 * Finance Management Module - OVERPAYMENT FIXED
 *
 * @version 2.0.0 - ALL CRITICAL FIXES
 * @date 2026-01-29
 */

'use strict';

const finance = {

  /**
   * Configure fee structure for a class - SESSION-BASED ONLY
   */
  async configureFeeStructure(classId, className, session, feeBreakdown) {
    try {
      // FIXED: Remove term from ID - fees are session-based
      const encodedSession = session.replace(/\//g, '-');
      const feeStructureId = `${classId}_${encodedSession}`;

      if (!feeBreakdown || typeof feeBreakdown !== 'object') {
        throw new Error('Invalid fee breakdown');
      }

      const total = Object.values(feeBreakdown).reduce((sum, amount) => {
        return sum + (parseFloat(amount) || 0);
      }, 0);

      await db.collection('fee_structures').doc(feeStructureId).set({
        classId: classId,
        className: className,
        session: session,
        // NO TERM FIELD - applies to all terms
        fees: feeBreakdown,
        total: total, // Per-term amount
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        createdBy: auth.currentUser.uid,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      return { success: true, total: total };

    } catch (error) {
      console.error('Error configuring fee structure:', error);
      throw error;
    }
  },

  /**
 * FIXED: Get fee structure (class-based, session-agnostic)
 * Replace this method in the finance object
 */
async getFeeStructure(classId) {
  try {
    // ✅ FIX: Class-based lookup only (no session)
    const feeDocId = `fee_${classId}`;
    const doc = await db.collection('fee_structures').doc(feeDocId).get();

    if (!doc.exists) {
      console.warn(`Fee structure not found for class: ${classId}`);
      return null;
    }

    return doc.data();

  } catch (error) {
    console.error('Error getting fee structure:', error);
    return null;
  }
},

  /**
 * FIXED: Record payment with validated arrears and overpayment prevention
 */
async recordPayment(pupilId, pupilName, classId, className, session, term, paymentData) {
  try {
    const amountPaid = parseFloat(paymentData.amountPaid);
    if (!amountPaid || amountPaid <= 0) {
      throw new Error('Invalid payment amount');
    }

    const encodedSession = session.replace(/\//g, '-');

    /* ---------------------------
       Get fee structure (session-based)
    ---------------------------- */
    const feeDocId = `${classId}_${encodedSession}`;
    const feeDoc = await db.collection('fee_structures').doc(feeDocId).get();

    if (!feeDoc.exists) {
      throw new Error('Fee structure not configured for this class and session');
    }

    const feeStructure = feeDoc.data();
    const amountDue = Number(feeStructure.total) || 0;

    /* ---------------------------
       Load existing payment record
    ---------------------------- */
    const paymentRecordId = `${pupilId}_${encodedSession}_${term}`;
    const existingPaymentDoc = await db.collection('payments').doc(paymentRecordId).get();

    let currentTotalPaid = 0;
    let storedArrears = 0;

    if (existingPaymentDoc.exists) {
      const existingData = existingPaymentDoc.data();
      currentTotalPaid = Number(existingData.totalPaid) || 0;
      storedArrears = Number(existingData.arrears) || 0;
    }

    /* ---------------------------
       VALIDATE arrears mathematically
       Arrears cannot exceed unpaid amount
    ---------------------------- */
    const maxPossibleArrears = Math.max(0, amountDue - currentTotalPaid);
    const arrears = Math.min(storedArrears, maxPossibleArrears);

    const totalDue = amountDue + arrears;
    const newTotalPaid = currentTotalPaid + amountPaid;

    /* ---------------------------
       Prevent overpayment
    ---------------------------- */
    if (newTotalPaid > totalDue) {
      const balance = totalDue - currentTotalPaid;
      throw new Error(
        `Payment rejected: Amount exceeds balance.\n\n` +
        `Total due: ₦${totalDue.toLocaleString()}\n` +
        `Already paid: ₦${currentTotalPaid.toLocaleString()}\n` +
        `Balance: ₦${balance.toLocaleString()}\n` +
        `Your payment: ₦${amountPaid.toLocaleString()}`
      );
    }

    /* ---------------------------
       Split payment between arrears and current term
    ---------------------------- */
    let arrearsPayment = 0;
    let currentTermPayment = 0;
    let remainingArrears = arrears;

    if (arrears > 0) {
      if (amountPaid <= arrears) {
        arrearsPayment = amountPaid;
        remainingArrears = arrears - amountPaid;
      } else {
        arrearsPayment = arrears;
        currentTermPayment = amountPaid - arrears;
        remainingArrears = 0;
      }
    } else {
      currentTermPayment = amountPaid;
    }

    const newBalance = totalDue - newTotalPaid;

    const paymentStatus =
      newBalance === 0
        ? 'paid'
        : newTotalPaid > 0
          ? 'partial'
          : remainingArrears > 0
            ? 'owing_with_arrears'
            : 'owing';

    /* ---------------------------
       Generate receipt
    ---------------------------- */
    const receiptNo = await this.generateReceiptNumber();

    /* ---------------------------
       Immutable receipt snapshot
    ---------------------------- */
    const receiptSnapshot = {
      pupilId,
      pupilName,
      classId,
      className,
      session,
      term,
      amountDue,
      arrears,
      totalDue,
      amountPaid,
      arrearsPayment,
      currentTermPayment,
      totalPaidBefore: currentTotalPaid,
      totalPaidAfter: newTotalPaid,
      balanceBefore: totalDue - currentTotalPaid,
      balanceAfter: newBalance,
      status: paymentStatus,
      paymentMethod: paymentData.paymentMethod || 'cash',
      notes: paymentData.notes || '',
      paymentDate: firebase.firestore.FieldValue.serverTimestamp(),
      receiptNo,
      recordedBy: auth.currentUser.uid
    };

    await db
      .collection('payment_transactions')
      .doc(receiptNo)
      .set(receiptSnapshot);

    /* ---------------------------
       Update mutable payment summary
    ---------------------------- */
    await db.collection('payments').doc(paymentRecordId).set({
      pupilId,
      pupilName,
      classId,
      className,
      session,
      term,
      amountDue,
      arrears: remainingArrears,
      totalDue: amountDue + remainingArrears,
      totalPaid: newTotalPaid,
      balance: newBalance,
      status: paymentStatus,
      lastPaymentDate: firebase.firestore.FieldValue.serverTimestamp(),
      lastPaymentAmount: amountPaid,
      lastReceiptNo: receiptNo,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    return {
      success: true,
      receiptNo,
      amountPaid,
      arrearsPayment,
      currentTermPayment,
      newBalance,
      totalPaid: newTotalPaid,
      status: paymentStatus
    };

  } catch (error) {
    console.error('Error recording payment:', error);
    throw error;
  }
},

  /**
   * Generate unique receipt number
   */
  generateReceiptNumber: async function() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    const counterId = `receipt_counter_${year}${month}${day}`;
    const counterRef = db.collection('counters').doc(counterId);

    let counter = 1;

    try {
      await db.runTransaction(async (transaction) => {
        const doc = await transaction.get(counterRef);

        if (doc.exists) {
          counter = (doc.data().count || 0) + 1;
          transaction.update(counterRef, {
            count: counter,
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
          });
        } else {
          transaction.set(counterRef, {
            count: 1,
            date: firebase.firestore.FieldValue.serverTimestamp()
          });
        }
      });
    } catch (error) {
      console.error('Error incrementing counter:', error);
      counter = Date.now() % 10000;
    }

    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `RCT${year}${month}${day}${String(counter).padStart(4, '0')}${random}`;
  },

  /**
   * Get receipt data (frozen snapshot)
   */
  async getReceiptData(receiptNo) {
    try {
      const doc = await db.collection('payment_transactions').doc(receiptNo).get();

      if (!doc.exists) {
        throw new Error('Receipt not found');
      }

      return doc.data();

    } catch (error) {
      console.error('Error getting receipt data:', error);
      throw error;
    }
  },

  /**
 * FIXED: Get pupil payment summary for a specific term
 * Returns accurate amounts including arrears and balances
 */
async getPupilPaymentSummary(pupilId, session, term) {
  try {
    if (!pupilId || !session || !term) {
      throw new Error('pupilId, session, and term are required');
    }

    const encodedSession = session.replace(/\//g, '-');
    const paymentRecordId = `${pupilId}_${encodedSession}_${term}`;

    const doc = await db.collection('payments').doc(paymentRecordId).get();

    if (!doc.exists) {
      return {
        pupilId: pupilId,
        session: session,
        term: term,
        amountDue: 0,
        arrears: 0,
        totalDue: 0,
        totalPaid: 0,
        balance: 0,
        status: 'no_payment'
      };
    }

    const data = doc.data();

    return {
      pupilId: data.pupilId,
      pupilName: data.pupilName,
      classId: data.classId,
      className: data.className,
      session: data.session,
      term: data.term,
      amountDue: Number(data.amountDue) || 0,
      arrears: Number(data.arrears) || 0,
      totalDue: Number(data.totalDue) || 0,
      totalPaid: Number(data.totalPaid) || 0,
      balance: Number(data.balance) || 0,
      status: data.status || 'no_payment',
      lastPaymentDate: data.lastPaymentDate || null,
      lastPaymentAmount: Number(data.lastPaymentAmount) || 0,
      lastReceiptNo: data.lastReceiptNo || null
    };

  } catch (error) {
    console.error('Error getting pupil payment summary:', error);
    return null;
  }
},

  /**
   * Get pupil payment history (all transactions)
   */
  async getPupilPaymentHistory(pupilId, session = null, term = null) {
    try {
      let query = db.collection('payment_transactions')
        .where('pupilId', '==', pupilId);
      
      if (session) {
        query = query.where('session', '==', session);
      }
      
      if (term) {
        query = query.where('term', '==', term);
      }
      
      const snapshot = await query.orderBy('paymentDate', 'desc').get();

      const transactions = [];
      snapshot.forEach(doc => {
        transactions.push({ id: doc.id, ...doc.data() });
      });

      return transactions;

    } catch (error) {
      console.error('Error getting payment history:', error);
      return [];
    }
  },

  /**
 * FIXED: Get outstanding fees report
 * Includes arrears and current term balances accurately
 */
async getOutstandingFeesReport(classId = null, session, term = null) {
  try {
    let query = db.collection('payments')
      .where('session', '==', session)
      .where('balance', '>', 0);

    if (classId) {
      query = query.where('classId', '==', classId);
    }
    
    if (term) {
      query = query.where('term', '==', term);
    }

    const snapshot = await query.get();
    const outstanding = [];

    snapshot.forEach(doc => {
      const data = doc.data();
      const amountDue = Number(data.amountDue) || 0;
      const arrears = Number(data.arrears) || 0;
      const totalDue = amountDue + arrears;
      const balance = Number(data.balance) || 0;

      if (balance > 0) {
        outstanding.push({
          pupilId: data.pupilId,
          pupilName: data.pupilName,
          classId: data.classId,
          className: data.className,
          session: data.session,
          term: data.term,
          amountDue: amountDue,
          arrears: arrears,
          totalDue: totalDue,
          totalPaid: Number(data.totalPaid) || 0,
          balance: balance,
          status: data.status
        });
      }
    });

    // Sort by balance descending (largest debt first)
    outstanding.sort((a, b) => b.balance - a.balance);

    return outstanding;

  } catch (error) {
    console.error('Error getting outstanding fees:', error);
    return [];
  }
},

  /**
 * FIXED: Get financial summary for session / optional term
 * Uses payment records as source of truth
 */
async getFinancialSummary(session, term = null) {
  try {
    let query = db.collection('payments')
      .where('session', '==', session);

    if (term) {
      query = query.where('term', '==', term);
    }

    const snapshot = await query.get();

    let totalExpected = 0;
    let totalCollected = 0;
    let totalOutstanding = 0;

    let paidInFull = 0;
    let partialPayments = 0;
    let noPayment = 0;

    snapshot.forEach(doc => {
      const data = doc.data();

      const amountDue = Number(data.amountDue) || 0;
      const arrears = Number(data.arrears) || 0;
      const totalDue = amountDue + arrears;

      const totalPaid = Number(data.totalPaid) || 0;
      const balance = Number(data.balance) || 0;

      totalExpected += totalDue;
      totalCollected += totalPaid;
      totalOutstanding += balance;

      if (balance === 0 && totalPaid > 0) {
        paidInFull++;
      } else if (totalPaid > 0 && balance > 0) {
        partialPayments++;
      } else {
        noPayment++;
      }
    });

    const collectionRate =
      totalExpected > 0
        ? parseFloat(((totalCollected / totalExpected) * 100).toFixed(1))
        : 0;

    return {
      totalExpected,
      totalCollected,
      totalOutstanding,
      collectionRate,
      paidInFull,
      partialPayments,
      noPayment,
      totalPupils: snapshot.size
    };

  } catch (error) {
    console.error('Error getting financial summary:', error);
    return null;
  }
},

  /**
   * Calculate actual fee for pupil in specific term
   */
  calculatePupilTermFee: function(pupilData, baseFee, term) {
    if (!pupilData || typeof baseFee !== 'number') {
      return baseFee || 0;
    }
    
    const isEnrolled = this.isPupilEnrolledForTerm(pupilData, term);
    
    if (!isEnrolled) {
      return 0;
    }
    
    let finalFee = baseFee;
    
    const adjustmentPercent = pupilData.feeAdjustmentPercent || 0;
    if (adjustmentPercent !== 0) {
      finalFee = finalFee * (1 + adjustmentPercent / 100);
    }
    
    const adjustmentAmount = pupilData.feeAdjustmentAmount || 0;
    if (adjustmentAmount !== 0) {
      finalFee = finalFee + adjustmentAmount;
    }
    
    return Math.max(0, finalFee);
  },

  /**
   * Check if pupil is enrolled for specific term
   */
  isPupilEnrolledForTerm: function(pupilData, term) {
    if (!pupilData) {
      return true;
    }
    
    const termOrder = {
      'First Term': 1,
      'Second Term': 2,
      'Third Term': 3
    };
    
    const currentTermNum = termOrder[term] || 1;
    
    const admissionTerm = pupilData.admissionTerm || 'First Term';
    const admissionTermNum = termOrder[admissionTerm] || 1;
    
    if (currentTermNum < admissionTermNum) {
      return false;
    }
    
    const exitTerm = pupilData.exitTerm || 'Third Term';
    const exitTermNum = termOrder[exitTerm] || 3;
    
    if (currentTermNum > exitTermNum) {
      return false;
    }
    
    return true;
  }

};

window.finance = finance;
console.log('✓ Finance module loaded (v2.0.0 - OVERPAYMENT + PERSISTENCE FIXED)');