/**
 * FAHMID NURSERY & PRIMARY SCHOOL
 * Finance Management Module - FIXED
 *
 * @version 1.0.2 - SYNTAX ERROR FIXED
 * @date 2026-01-28
 */

'use strict';

const finance = {

  /**
   * Configure fee structure for a class
   */
  async configureFeeStructure(classId, className, session, term, feeBreakdown) {
    try {
      const feeStructureId = `${classId}_${session}_${term}`;

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
        term: term,
        fees: feeBreakdown,
        total: total,
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
   * Get fee structure for a class
   */
  async getFeeStructure(classId, session, term) {
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
   * Record a payment transaction
   */
  async recordPayment(pupilId, pupilName, classId, className, session, term, paymentData) {
    try {
      if (!paymentData.amountPaid || parseFloat(paymentData.amountPaid) <= 0) {
        throw new Error('Invalid payment amount');
      }

      const encodedSession = session.replace(/\//g, '-');
      const feeStructure = await this.getFeeStructure(classId, session, term);

      if (!feeStructure) {
        throw new Error('Fee structure not configured for this class and term');
      }

      const amountDue = feeStructure.total;
      const amountPaid = parseFloat(paymentData.amountPaid);
      const paymentRecordId = `${pupilId}_${encodedSession}_${term}`;
      const existingPaymentDoc = await db.collection('payments').doc(paymentRecordId).get();

      let totalPaidSoFar = amountPaid;

      if (existingPaymentDoc.exists) {
        const existingData = existingPaymentDoc.data();
        totalPaidSoFar = (existingData.totalPaid || 0) + amountPaid;
      }

      const newBalance = amountDue - totalPaidSoFar;
      const paymentStatus =
        newBalance <= 0 ? 'paid' : totalPaidSoFar > 0 ? 'partial' : 'owing';

      const receiptNo = await this.generateReceiptNumber();
      const transactionId = receiptNo;

      await db.collection('payment_transactions').doc(transactionId).set({
        pupilId: pupilId,
        pupilName: pupilName,
        classId: classId,
        className: className,
        session: session,
        term: term,
        amountPaid: amountPaid,
        paymentMethod: paymentData.paymentMethod || 'cash',
        paymentDate: firebase.firestore.FieldValue.serverTimestamp(),
        receiptNo: receiptNo,
        recordedBy: auth.currentUser.uid,
        notes: paymentData.notes || ''
      });

      await db.collection('payments').doc(paymentRecordId).set({
        pupilId: pupilId,
        pupilName: pupilName,
        classId: classId,
        className: className,
        session: session,
        term: term,
        amountDue: amountDue,
        totalPaid: totalPaidSoFar,
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
        newBalance: newBalance,
        totalPaid: totalPaidSoFar,
        status: paymentStatus
      };

    } catch (error) {
      console.error('Error recording payment:', error);
      throw error;
    }
  },

  /**
   * Generate unique receipt number
   * FIXED: Proper async method syntax for object literals
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
   * Get receipt data by receipt number
   */
  async getReceiptData(receiptNo) {
    try {
      const doc = await db
        .collection('payment_transactions')
        .doc(receiptNo)
        .get();

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
   * Get pupil payment summary
   */
  async getPupilPaymentSummary(pupilId, session, term) {
    try {
      const paymentRecordId = `${pupilId}_${session}_${term}`;
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
   * Get pupil payment history
   */
  async getPupilPaymentHistory(pupilId, session, term) {
    try {
      const snapshot = await db
        .collection('payment_transactions')
        .where('pupilId', '==', pupilId)
        .where('session', '==', session)
        .where('term', '==', term)
        .orderBy('paymentDate', 'desc')
        .get();

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
      let query = db
        .collection('payments')
        .where('session', '==', session)
        .where('status', 'in', ['owing', 'partial']);

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
   * Get financial summary
   */
  async getFinancialSummary(session, term = null) {
    try {
      const feeSnap = await db
        .collection('fee_structures')
        .where('session', '==', session)
        .get();

      let totalExpected = 0;
      feeSnap.forEach(doc => {
        const data = doc.data();
        if (!term || data.term === term) {
          totalExpected += data.total || 0;
        }
      });

      let query = db
        .collection('payments')
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
        else if (data.status === 'owing') noPayment++;
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
   * Calculate actual fee for a pupil in a specific term
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
   * Check if pupil is enrolled for a specific term
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
  },

  /**
   * Get enrollment summary for a pupil
   */
  getPupilEnrollmentSummary: function(pupilData) {
    if (!pupilData) {
      return {
        admissionTerm: 'First Term',
        exitTerm: 'Third Term',
        enrolledTerms: ['First Term', 'Second Term', 'Third Term'],
        isFullSession: true
      };
    }
    
    const admissionTerm = pupilData.admissionTerm || 'First Term';
    const exitTerm = pupilData.exitTerm || 'Third Term';
    
    const termOrder = ['First Term', 'Second Term', 'Third Term'];
    const admissionIndex = termOrder.indexOf(admissionTerm);
    const exitIndex = termOrder.indexOf(exitTerm);
    
    const enrolledTerms = termOrder.slice(
      admissionIndex >= 0 ? admissionIndex : 0,
      exitIndex >= 0 ? exitIndex + 1 : 3
    );
    
    const isFullSession = admissionTerm === 'First Term' && exitTerm === 'Third Term';
    
    return {
      admissionTerm,
      exitTerm,
      enrolledTerms,
      isFullSession
    };
  },

  /**
   * Calculate total expected fees for a pupil across all enrolled terms
   */
  async calculatePupilSessionFees(pupilId, classId, session) {
    try {
      const pupilDoc = await db.collection('pupils').doc(pupilId).get();
      if (!pupilDoc.exists) {
        throw new Error('Pupil not found');
      }
      
      const pupilData = pupilDoc.data();
      
      const encodedSession = session.replace(/\//g, '-');
      const feeDocId = `${classId}_${encodedSession}`;
      const feeDoc = await db.collection('fee_structures').doc(feeDocId).get();
      
      if (!feeDoc.exists) {
        return {
          totalExpected: 0,
          termBreakdown: [],
          enrollmentSummary: this.getPupilEnrollmentSummary(pupilData)
        };
      }
      
      const feeData = feeDoc.data();
      const baseFeePerTerm = feeData.total || 0;
      
      const terms = ['First Term', 'Second Term', 'Third Term'];
      const termBreakdown = [];
      let totalExpected = 0;
      
      terms.forEach(term => {
        const termFee = this.calculatePupilTermFee(pupilData, baseFeePerTerm, term);
        
        termBreakdown.push({
          term: term,
          isEnrolled: this.isPupilEnrolledForTerm(pupilData, term),
          expectedFee: termFee
        });
        
        totalExpected += termFee;
      });
      
      return {
        totalExpected,
        termBreakdown,
        enrollmentSummary: this.getPupilEnrollmentSummary(pupilData)
      };
      
    } catch (error) {
      console.error('Error calculating pupil session fees:', error);
      throw error;
    }
  }

};

// Expose globally
window.finance = finance;
console.log('✓ Finance module loaded successfully (v1.0.2 - SYNTAX ERROR FIXED)');