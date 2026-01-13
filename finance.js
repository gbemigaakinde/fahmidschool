/**
 * FAHMID NURSERY & PRIMARY SCHOOL
 * Finance Management Module
 * 
 * Handles:
 * - Fee structure configuration per class
 * - Payment recording with receipt generation
 * - Outstanding fees tracking
 * - Financial reports
 * 
 * @version 1.0.0
 * @date 2026-01-11
 */

'use strict';

const finance = {
  
  /**
   * Configure fee structure for a specific class and term
   */
  async configureFeeStructure(classId, className, session, term, feeBreakdown) {
    try {
      const feeStructureId = `${classId}_${session}_${term}`;
      
      // Validate fee breakdown
      if (!feeBreakdown || typeof feeBreakdown !== 'object') {
        throw new Error('Invalid fee breakdown');
      }
      
      // Calculate total
      const total = Object.values(feeBreakdown).reduce((sum, amount) => {
        return sum + (parseFloat(amount) || 0);
      }, 0);
      
      // Save to Firestore
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
      
      console.log(`✓ Fee structure configured for ${className} - ${term}`);
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
      const feeStructureId = `${classId}_${session}_${term}`;
      const doc = await db.collection('fee_structures').doc(feeStructureId).get();
      
      if (!doc.exists) {
        return null;
      }
      
      return doc.data();
      
    } catch (error) {
      console.error('Error getting fee structure:', error);
      return null;
    }
  },
  
  /**
   * Record payment and generate receipt
   */
  async recordPayment(pupilId, pupilName, classId, className, session, term, paymentData) {
  try {
    // Validate payment data
    if (!paymentData.amountPaid || parseFloat(paymentData.amountPaid) <= 0) {
      throw new Error('Invalid payment amount');
    }
    
    // FIXED: Encode session for document IDs
    const encodedSession = session.replace(/\//g, '-');
    
    // Get fee structure (using original session format for query)
    const feeStructure = await this.getFeeStructure(classId, session, term);
    
    if (!feeStructure) {
      throw new Error('Fee structure not configured for this class and term');
    }
    
    const amountDue = feeStructure.total;
    const amountPaid = parseFloat(paymentData.amountPaid);
    
    // FIXED: Use encoded session for document ID
    const paymentRecordId = `${pupilId}_${encodedSession}_${term}`;
    const existingPaymentDoc = await db.collection('payments').doc(paymentRecordId).get();
      
      let totalPaidSoFar = amountPaid;
      let previousBalance = amountDue;
      
      if (existingPaymentDoc.exists) {
        const existingData = existingPaymentDoc.data();
        totalPaidSoFar = (existingData.totalPaid || 0) + amountPaid;
        previousBalance = existingData.balance || amountDue;
      }
      
      const newBalance = amountDue - totalPaidSoFar;
      const paymentStatus = newBalance <= 0 ? 'paid' : (totalPaidSoFar > 0 ? 'partial' : 'owing');
      
      // Generate receipt number
      const receiptNo = await this.generateReceiptNumber();
      
      // Create payment transaction record
      const transactionId = db.collection('payment_transactions').doc().id;
      
      await db.collection('payment_transactions').doc(transactionId).add({
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
      
      // Update or create payment summary record
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
      
      console.log(`✓ Payment recorded: Receipt #${receiptNo}`);
      
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
 */
async generateReceiptNumber() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    // Get counter for today
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
        console.error('Error generating receipt number:', error);
        // Fallback to timestamp-based receipt number
        counter = Date.now() % 10000;
    }
    
    return `RCT${year}${month}${day}${String(counter).padStart(4, '0')}`;
}
  
  /**
   * Get receipt data for printing
   */
  async getReceiptData(receiptNo) {
    try {
      const snapshot = await db.collection('payment_transactions')
        .where('receiptNo', '==', receiptNo)
        .limit(1)
        .get();
      
      if (snapshot.empty) {
        throw new Error('Receipt not found');
      }
      
      return snapshot.docs[0].data();
      
    } catch (error) {
      console.error('Error getting receipt data:', error);
      throw error;
    }
  },
  
  /**
   * Get payment summary for a pupil
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
   * Get all payment transactions for a pupil
   */
  async getPupilPaymentHistory(pupilId, session, term) {
    try {
      const snapshot = await db.collection('payment_transactions')
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
  async getOutstandingFeesReport(classId = null, session, term) {
    try {
      let query = db.collection('payments')
        .where('session', '==', session)
        .where('term', '==', term)
        .where('status', 'in', ['owing', 'partial']);
      
      if (classId) {
        query = query.where('classId', '==', classId);
      }
      
      const snapshot = await query.get();
      
      const outstanding = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.balance > 0) {
          outstanding.push(data);
        }
      });
      
      // Sort by balance (highest first)
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
  async getFinancialSummary(session, term) {
    try {
      const snapshot = await db.collection('payments')
        .where('session', '==', session)
        .where('term', '==', term)
        .get();
      
      let totalExpected = 0;
      let totalCollected = 0;
      let totalOutstanding = 0;
      let paidInFull = 0;
      let partialPayments = 0;
      let noPayment = 0;
      
      snapshot.forEach(doc => {
        const data = doc.data();
        totalExpected += data.amountDue || 0;
        totalCollected += data.totalPaid || 0;
        totalOutstanding += data.balance || 0;
        
        if (data.status === 'paid') paidInFull++;
        else if (data.status === 'partial') partialPayments++;
        else if (data.status === 'owing') noPayment++;
      });
      
      const collectionRate = totalExpected > 0 
        ? ((totalCollected / totalExpected) * 100).toFixed(1)
        : 0;
      
      return {
        totalExpected: totalExpected,
        totalCollected: totalCollected,
        totalOutstanding: totalOutstanding,
        collectionRate: parseFloat(collectionRate),
        paidInFull: paidInFull,
        partialPayments: partialPayments,
        noPayment: noPayment,
        totalPupils: snapshot.size
      };
      
    } catch (error) {
      console.error('Error getting financial summary:', error);
      return null;
    }
  }
  
};

// Export to window for global access
window.finance = finance;

console.log('✓ Finance module loaded successfully');