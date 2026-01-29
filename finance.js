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
   * Get fee structure for a class (session-based)
   */
  async getFeeStructure(classId, session) {
    try {
      const encodedSession = session.replace(/\//g, '-');
      const feeStructureId = `${classId}_${encodedSession}`;
      const doc = await db.collection('fee_structures').doc(feeStructureId).get();

      if (!doc.exists) {
        console.warn(`Fee structure not found: ${feeStructureId}`);
        return null;
      }

      return doc.data();

    } catch (error) {
      console.error('Error getting fee structure:', error);
      return null;
    }
  },

  /**
   * FIXED: Record payment with overpayment prevention
   */
  async recordPayment(pupilId, pupilName, classId, className, session, term, paymentData) {
    try {
      if (!paymentData.amountPaid || parseFloat(paymentData.amountPaid) <= 0) {
        throw new Error('Invalid payment amount');
      }

      const encodedSession = session.replace(/\//g, '-');
      
      // Get fee structure (session-based)
      const feeDocId = `${classId}_${encodedSession}`;
      const feeDoc = await db.collection('fee_structures').doc(feeDocId).get();

      if (!feeDoc.exists) {
        throw new Error('Fee structure not configured for this class and session');
      }

      const feeStructure = feeDoc.data();
      const amountDue = feeStructure.total; // Per-term fee
      const amountPaid = parseFloat(paymentData.amountPaid);
      
      // Get existing payment record
      const paymentRecordId = `${pupilId}_${encodedSession}_${term}`;
      const existingPaymentDoc = await db.collection('payments').doc(paymentRecordId).get();

      let currentTotalPaid = 0;
      let arrears = 0;
      
      if (existingPaymentDoc.exists) {
        const existingData = existingPaymentDoc.data();
        currentTotalPaid = existingData.totalPaid || 0;
        arrears = existingData.arrears || 0;
      }
      
      // Calculate total due including arrears
      const totalDue = amountDue + arrears;
      const newTotalPaid = currentTotalPaid + amountPaid;
      
      // ✅ CRITICAL FIX: Prevent overpayment
      if (newTotalPaid > totalDue) {
        const maxAllowed = totalDue - currentTotalPaid;
        throw new Error(
          `Payment rejected: Amount exceeds balance.\n\n` +
          `Total due: ₦${totalDue.toLocaleString()}\n` +
          `Already paid: ₦${currentTotalPaid.toLocaleString()}\n` +
          `Balance: ₦${maxAllowed.toLocaleString()}\n` +
          `Your payment: ₦${amountPaid.toLocaleString()}\n\n` +
          `Maximum allowed: ₦${maxAllowed.toLocaleString()}`
        );
      }
      
      // Calculate payment split
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
      const paymentStatus = newBalance <= 0 ? 'paid' : 
                           newTotalPaid > 0 ? 'partial' : 
                           remainingArrears > 0 ? 'owing_with_arrears' : 'owing';

      const receiptNo = await this.generateReceiptNumber();
      const transactionId = receiptNo;
      
      // ✅ CRITICAL FIX: Freeze receipt snapshot (immutable)
      const receiptSnapshot = {
        pupilId: pupilId,
        pupilName: pupilName,
        classId: classId,
        className: className,
        session: session,
        term: term,
        amountDue: amountDue,
        arrears: arrears,
        totalDue: totalDue,
        amountPaid: amountPaid,
        arrearsPayment: arrearsPayment,
        currentTermPayment: currentTermPayment,
        totalPaidBefore: currentTotalPaid,
        totalPaidAfter: newTotalPaid,
        balanceBefore: totalDue - currentTotalPaid,
        balanceAfter: newBalance,
        status: paymentStatus,
        paymentMethod: paymentData.paymentMethod || 'cash',
        notes: paymentData.notes || '',
        // IMMUTABLE timestamp - never changes
        paymentDate: firebase.firestore.FieldValue.serverTimestamp(),
        receiptNo: receiptNo,
        recordedBy: auth.currentUser.uid
      };

      // Create transaction record with FROZEN snapshot
      await db.collection('payment_transactions').doc(transactionId).set(receiptSnapshot);

      // Update payment summary (mutable - updates with new payments)
      await db.collection('payments').doc(paymentRecordId).set({
        pupilId: pupilId,
        pupilName: pupilName,
        classId: classId,
        className: className,
        session: session,
        term: term,
        amountDue: amountDue,
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
        receiptNo: receiptNo,
        transactionId: transactionId,
        amountPaid: amountPaid,
        arrearsPayment: arrearsPayment,
        currentTermPayment: currentTermPayment,
        newBalance: newBalance,
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
   * Get pupil payment summary for specific term
   */
  async getPupilPaymentSummary(pupilId, session, term) {
    try {
      const encodedSession = session.replace(/\//g, '-');
      const paymentRecordId = `${pupilId}_${encodedSession}_${term}`;
      const doc = await db.collection('payments').doc(paymentRecordId).get();

      if (!doc.exists) {
        return null;
      }

      return doc.data();

    } catch (error) {
      console.error('Error getting payment summary:', error);
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
   * Get outstanding fees report
   */
  async getOutstandingFeesReport(classId = null, session, term = null) {
    try {
      let query = db.collection('payments')
        .where('session', '==', session)
        .where('status', 'in', ['owing', 'partial', 'owing_with_arrears']);

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
        if (data.balance > 0) {
          outstanding.push(data);
        }
      });

      outstanding.sort((a, b) => b.balance - a.balance);
      return outstanding;

    } catch (error) {
      console.error('Error getting outstanding fees:', error);
      return [];
    }
  },

  /**
   * Get financial summary for session/term
   */
  async getFinancialSummary(session, term = null) {
    try {
      const encodedSession = session.replace(/\//g, '-');
      
      // Get all fee structures for this session
      const feeSnap = await db.collection('fee_structures')
        .where('session', '==', session)
        .get();

      // Get all pupils to calculate expected fees
      const pupilsSnap = await db.collection('pupils').get();
      
      let totalExpected = 0;
      const feeStructureMap = {};
      
      feeSnap.forEach(doc => {
        const data = doc.data();
        feeStructureMap[data.classId] = data.total;
      });
      
      // Calculate expected based on enrolled pupils
      pupilsSnap.forEach(pupilDoc => {
        const pupilData = pupilDoc.data();
        const classId = pupilData.class?.id;
        
        if (classId && feeStructureMap[classId]) {
          totalExpected += feeStructureMap[classId];
        }
      });

      // Get payment records
      let query = db.collection('payments')
        .where('session', '==', session);

      if (term) {
        query = query.where('term', '==', term);
      }

      const snapshot = await query.get();

      let totalCollected = 0;
      let totalOutstanding = 0;
      let paidInFull = 0;
      let partialPayments = 0;
      let noPayment = 0;

      snapshot.forEach(doc => {
        const data = doc.data();
        totalCollected += data.totalPaid || 0;
        totalOutstanding += data.balance || 0;

        if (data.status === 'paid') paidInFull++;
        else if (data.status === 'partial') partialPayments++;
        else noPayment++;
      });

      const collectionRate =
        totalExpected > 0
          ? ((totalCollected / totalExpected) * 100).toFixed(1)
          : 0;

      return {
        totalExpected,
        totalCollected,
        totalOutstanding,
        collectionRate: parseFloat(collectionRate),
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