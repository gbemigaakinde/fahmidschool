/**
 * FAHMID NURSERY & PRIMARY SCHOOL
 * Finance Management Module - FIXED
 *
 * CRITICAL FIX: Removed syntax error at line 188
 * - Fixed async function declaration inside object literal
 * - Proper async/await syntax throughout
 *
 * @version 1.0.1 - FIXED
 * @date 2026-01-16
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
    // FIXED: Match admin.js storage format (no term in document ID)
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

      // Save transaction
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

      // Update payment summary
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
   * FIXED: Proper async function syntax
   */
  async generateReceiptNumber() {
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

    // Add random component for security
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
    
    // FIXED: Optional term filter (removed from required params)
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
   * Respects enrollment periods and fee adjustments
   * 
   * @param {Object} pupilData - Pupil document data
   * @param {number} baseFee - Fee from class structure
   * @param {string} term - Term name (First Term, Second Term, Third Term)
   * @returns {number} - Actual fee amount for this pupil in this term
   */
  calculatePupilTermFee(pupilData, baseFee, term) {
    // If pupil data is invalid, return base fee (safe fallback)
    if (!pupilData || typeof baseFee !== 'number') {
      return baseFee || 0;
    }
    
    // Check if pupil is enrolled for this term
    const isEnrolled = this.isPupilEnrolledForTerm(pupilData, term);
    
    // If not enrolled, fee is zero
    if (!isEnrolled) {
      return 0;
    }
    
    // Start with base fee from class
    let finalFee = baseFee;
    
    // Apply percentage adjustment (if exists)
    const adjustmentPercent = pupilData.feeAdjustmentPercent || 0;
    if (adjustmentPercent !== 0) {
      finalFee = finalFee * (1 + adjustmentPercent / 100);
    }
    
    // Apply fixed adjustment (if exists)
    const adjustmentAmount = pupilData.feeAdjustmentAmount || 0;
    if (adjustmentAmount !== 0) {
      finalFee = finalFee + adjustmentAmount;
    }
    
    // Fee cannot be negative
    return Math.max(0, finalFee);
  },

  /**
   * Check if pupil is enrolled for a specific term
   * 
   * @param {Object} pupilData - Pupil document data
   * @param {string} term - Term name
   * @returns {boolean} - True if enrolled
   */
  isPupilEnrolledForTerm(pupilData, term) {
    // If pupil data is invalid, assume enrolled (safe fallback)
    if (!pupilData) {
      return true;
    }
    
    // Term order for comparison
    const termOrder = {
      'First Term': 1,
      'Second Term': 2,
      'Third Term': 3
    };
    
    const currentTermNum = termOrder[term] || 1;
    
    // Check admission term (defaults to First Term)
    const admissionTerm = pupilData.admissionTerm || 'First Term';
    const admissionTermNum = termOrder[admissionTerm] || 1;
    
    // If pupil hasn't started yet, not enrolled
    if (currentTermNum < admissionTermNum) {
      return false;
    }
    
    // Check exit term (defaults to Third Term = full session)
    const exitTerm = pupilData.exitTerm || 'Third Term';
    const exitTermNum = termOrder[exitTerm] || 3;
    
    // If pupil already left, not enrolled
    if (currentTermNum > exitTermNum) {
      return false;
    }
    
    // Pupil is enrolled for this term
    return true;
  },

  /**
   * Get enrollment summary for a pupil
   * 
   * @param {Object} pupilData - Pupil document data
   * @returns {Object} - Enrollment details
   */
  getPupilEnrollmentSummary(pupilData) {
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
   * 
   * @param {string} pupilId - Pupil ID
   * @param {string} classId - Class ID
   * @param {string} session - Session name
   * @returns {Promise<Object>} - Total fees breakdown
   */
  async calculatePupilSessionFees(pupilId, classId, session) {
    try {
      // Get pupil data
      const pupilDoc = await db.collection('pupils').doc(pupilId).get();
      if (!pupilDoc.exists) {
        throw new Error('Pupil not found');
      }
      
      const pupilData = pupilDoc.data();
      
      // Get class fee structure
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
      
      // Calculate for each term
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

// ✅ Expose globally
window.finance = finance;
console.log('✓ Finance module loaded successfully (v1.0.1 - FIXED)');