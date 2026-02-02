/**
 * FAHMID NURSERY & PRIMARY SCHOOL
 * Finance Management Module - COMPLETE REWRITE
 *
 * @version 4.0.0 - FULLY CONSISTENT WITH ADMIN/PUPIL LOGIC
 * @date 2026-02-02
 * 
 * DESIGN PRINCIPLES:
 * ✅ Single source of truth for all financial calculations
 * ✅ NO stale data - always recalculates from base fee + adjustments
 * ✅ Consistent arrears logic (First Term: full session, Later Terms: previous term only)
 * ✅ Atomic payment recording with Firestore transactions
 * ✅ All functions used by admin.js and pupil.js
 */

'use strict';

const finance = {

  /**
   * ═══════════════════════════════════════════════════════════
   * CORE CALCULATION: Current Outstanding Balance
   * ═══════════════════════════════════════════════════════════
   * This is the SINGLE SOURCE OF TRUTH for all balance queries.
   * Admin reports, pupil portal, and payment recording ALL use this.
   */
  async calculateCurrentOutstanding(pupilId, session, term) {
    try {
      console.log(`\n📊 [FINANCE] Calculating outstanding for Pupil ${pupilId}`);
      console.log(`   Session: ${session}, Term: ${term}`);
      
      // Step 1: Get pupil data
      const pupilDoc = await db.collection('pupils').doc(pupilId).get();
      if (!pupilDoc.exists) {
        throw new Error('Pupil not found');
      }
      const pupilData = pupilDoc.data();
      console.log(`   ✓ Pupil: ${pupilData.name}`);
      
      // Step 2: Extract class ID safely
      const classId = this.getClassIdSafely(pupilData);
      if (!classId) {
        console.warn(`   ⚠️ No valid classId for pupil ${pupilId}`);
        return {
          pupilId,
          pupilName: pupilData.name,
          session,
          term,
          amountDue: 0,
          arrears: 0,
          totalDue: 0,
          totalPaid: 0,
          balance: 0,
          reason: 'Invalid class data - contact admin'
        };
      }
      console.log(`   ✓ Class ID: ${classId}`);
      
      // Step 3: Get base fee (class-based, permanent)
      const feeDocId = `fee_${classId}`;
      const feeDoc = await db.collection('fee_structures').doc(feeDocId).get();
      
      if (!feeDoc.exists) {
        console.warn(`   ⚠️ No fee structure for class ${classId}`);
        return {
          pupilId,
          pupilName: pupilData.name,
          classId,
          className: pupilData.class?.name || 'Unknown',
          session,
          term,
          amountDue: 0,
          arrears: 0,
          totalDue: 0,
          totalPaid: 0,
          balance: 0,
          reason: 'No fee structure configured for this class'
        };
      }
      
      const baseFee = Number(feeDoc.data().total) || 0;
      console.log(`   ✓ Base fee: ₦${baseFee.toLocaleString()}`);
      
      // Step 4: Calculate ADJUSTED fee (enrollment period + discounts/scholarships)
      const amountDue = this.calculateAdjustedFee(pupilData, baseFee, term);
      
      if (amountDue !== baseFee) {
        console.log(`   ✓ Adjusted fee: ₦${amountDue.toLocaleString()} (was ₦${baseFee.toLocaleString()})`);
      }
      
      // Step 5: Calculate COMPLETE arrears (no double-counting)
      const arrears = await this.calculateCompleteArrears(pupilId, session, term);
      console.log(`   ✓ Arrears: ₦${arrears.toLocaleString()}`);
      
      // Step 6: Get total paid for this term
      const encodedSession = session.replace(/\//g, '-');
      const paymentDocId = `${pupilId}_${encodedSession}_${term}`;
      
      let totalPaid = 0;
      try {
        const paymentDoc = await db.collection('payments').doc(paymentDocId).get();
        if (paymentDoc.exists) {
          totalPaid = Number(paymentDoc.data().totalPaid) || 0;
        }
      } catch (error) {
        console.warn('   ⚠️ Could not read payment doc:', error.message);
      }
      console.log(`   ✓ Total paid: ₦${totalPaid.toLocaleString()}`);
      
      // Step 7: Calculate outstanding
      const totalDue = amountDue + arrears;
      const balance = Math.max(0, totalDue - totalPaid); // Never negative
      
      console.log(`   ═══════════════════════════════════════`);
      console.log(`   Total Due: ₦${totalDue.toLocaleString()}`);
      console.log(`   Balance: ₦${balance.toLocaleString()}`);
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
        status: balance <= 0 ? 'paid' : totalPaid > 0 ? 'partial' : arrears > 0 ? 'owing_with_arrears' : 'owing'
      };
      
    } catch (error) {
      console.error('❌ [FINANCE] Error calculating outstanding:', error);
      throw error;
    }
  },

  /**
   * ═══════════════════════════════════════════════════════════
   * HELPER: Safely Extract Class ID
   * ═══════════════════════════════════════════════════════════
   */
  getClassIdSafely(pupilData) {
    if (!pupilData || !pupilData.class) {
      return null;
    }
    
    // New format: {id: "xyz", name: "Primary 3"}
    if (typeof pupilData.class === 'object' && pupilData.class.id) {
      return pupilData.class.id;
    }
    
    // Old format: just "Primary 3" as string - cannot extract ID
    return null;
  },

  /**
   * ═══════════════════════════════════════════════════════════
   * CORE CALCULATION: Adjusted Fee with Enrollment Period
   * ═══════════════════════════════════════════════════════════
   */
  calculateAdjustedFee(pupilData, baseFee, currentTerm) {
    if (!pupilData || typeof baseFee !== 'number') {
      console.warn('[FINANCE] Invalid input to calculateAdjustedFee');
      return baseFee || 0;
    }
    
    // Step 1: Check enrollment period (admissionTerm / exitTerm)
    const termOrder = {
      'First Term': 1,
      'Second Term': 2,
      'Third Term': 3
    };
    
    const currentTermNum = termOrder[currentTerm] || 1;
    const admissionTermNum = termOrder[pupilData.admissionTerm || 'First Term'] || 1;
    const exitTermNum = termOrder[pupilData.exitTerm || 'Third Term'] || 3;
    
    // Not yet admitted or already exited
    if (currentTermNum < admissionTermNum || currentTermNum > exitTermNum) {
      console.log(`   [FINANCE] Pupil not enrolled for ${currentTerm} (admission: ${pupilData.admissionTerm}, exit: ${pupilData.exitTerm})`);
      return 0;
    }
    
    // Step 2: Start with base fee
    let adjustedFee = baseFee;
    
    // Step 3: Apply percentage adjustment (e.g., 50% scholarship = -50%)
    const percentAdjustment = Number(pupilData.feeAdjustmentPercent) || 0;
    if (percentAdjustment !== 0) {
      adjustedFee = adjustedFee * (1 + percentAdjustment / 100);
      console.log(`   [FINANCE] Applied ${percentAdjustment}% adjustment: ₦${baseFee.toLocaleString()} → ₦${adjustedFee.toLocaleString()}`);
    }
    
    // Step 4: Apply fixed amount adjustment (e.g., ₦5000 discount = -5000)
    const amountAdjustment = Number(pupilData.feeAdjustmentAmount) || 0;
    if (amountAdjustment !== 0) {
      adjustedFee = adjustedFee + amountAdjustment;
      console.log(`   [FINANCE] Applied ₦${amountAdjustment.toLocaleString()} adjustment → ₦${adjustedFee.toLocaleString()}`);
    }
    
    // Step 5: Ensure non-negative
    const finalFee = Math.max(0, adjustedFee);
    
    if (finalFee === 0 && baseFee > 0) {
      console.log(`   [FINANCE] ✓ Free education applied for ${pupilData.name}`);
    }
    
    return finalFee;
  },

  /**
   * ═══════════════════════════════════════════════════════════
   * CORE CALCULATION: Complete Arrears (No Double-Counting)
   * ═══════════════════════════════════════════════════════════
   * LOGIC:
   * - First Term of session: Add ENTIRE previous session balance
   * - Second/Third Term: Add ONLY previous term balance (already cascaded)
   */
  async calculateCompleteArrears(pupilId, currentSession, currentTerm) {
    try {
      let totalArrears = 0;
      const encodedSession = currentSession.replace(/\//g, '-');
      
      const termOrder = {
        'First Term': 1,
        'Second Term': 2,
        'Third Term': 3
      };
      
      const currentTermNum = termOrder[currentTerm] || 1;
      
      console.log(`   [FINANCE] Calculating arrears for ${currentTerm} in ${currentSession}...`);
      
      if (currentTermNum === 1) {
        // ─── FIRST TERM: Add entire previous SESSION ───
        const previousSession = this.getPreviousSessionName(currentSession);
        
        if (previousSession) {
          console.log(`     Checking previous session: ${previousSession}`);
          
          try {
            const sessionArrears = await this.calculateSessionBalanceSafe(pupilId, previousSession);
            totalArrears = sessionArrears;
            
            if (sessionArrears > 0) {
              console.log(`     ✓ Previous session arrears: ₦${sessionArrears.toLocaleString()}`);
            } else {
              console.log(`     ✓ No arrears from previous session`);
            }
          } catch (error) {
            console.error(`     ⚠️ Error fetching previous session balance:`, error);
          }
        } else {
          console.log(`     ℹ️ No previous session (this is the first session ever)`);
        }
        
      } else {
        // ─── SECOND/THIRD TERM: Add ONLY previous TERM balance ───
        const previousTermName = Object.keys(termOrder).find(
          key => termOrder[key] === currentTermNum - 1
        );
        
        if (previousTermName) {
          console.log(`     Checking previous term: ${previousTermName}`);
          
          const prevTermDocId = `${pupilId}_${encodedSession}_${previousTermName}`;
          
          try {
            const prevTermDoc = await db.collection('payments').doc(prevTermDocId).get();
            
            if (prevTermDoc.exists) {
              const prevTermBalance = Number(prevTermDoc.data().balance) || 0;
              totalArrears = prevTermBalance;
              
              if (prevTermBalance > 0) {
                console.log(`     ✓ Previous term balance: ₦${prevTermBalance.toLocaleString()}`);
              } else {
                console.log(`     ✓ Previous term fully paid`);
              }
            } else {
              console.log(`     ℹ️ No payment record for ${previousTermName} (assuming ₦0)`);
            }
          } catch (error) {
            console.error(`     ⚠️ Error fetching previous term balance:`, error);
          }
        }
      }
      
      console.log(`   [FINANCE] Total arrears: ₦${totalArrears.toLocaleString()}`);
      return totalArrears;
      
    } catch (error) {
      console.error('❌ [FINANCE] Error in calculateCompleteArrears:', error);
      return 0; // Safe fallback
    }
  },

  /**
   * ═══════════════════════════════════════════════════════════
   * HELPER: Calculate Session Balance (Third Term Only)
   * ═══════════════════════════════════════════════════════════
   */
  async calculateSessionBalanceSafe(pupilId, session) {
    try {
      const encodedSession = session.replace(/\//g, '-');
      
      // Only get Third Term balance (already contains First + Second Term arrears)
      const thirdTermDocId = `${pupilId}_${encodedSession}_Third Term`;
      
      console.log(`     Checking session balance for ${session}...`);
      
      try {
        const thirdTermDoc = await db.collection('payments').doc(thirdTermDocId).get();
        
        if (thirdTermDoc.exists) {
          const balance = Number(thirdTermDoc.data().balance) || 0;
          
          if (balance > 0) {
            console.log(`     ✓ Third Term balance: ₦${balance.toLocaleString()}`);
          } else {
            console.log(`     ✓ Session fully paid`);
          }
          
          return balance;
        } else {
          console.log(`     ℹ️ No Third Term payment record for ${session}`);
          return 0;
        }
      } catch (error) {
        console.warn(`     ⚠️ Could not fetch Third Term for ${session}:`, error.message);
        return 0;
      }
      
    } catch (error) {
      console.error('❌ [FINANCE] Error in calculateSessionBalanceSafe:', error);
      return 0;
    }
  },

  /**
   * ═══════════════════════════════════════════════════════════
   * HELPER: Get Previous Session Name
   * ═══════════════════════════════════════════════════════════
   */
  getPreviousSessionName(currentSession) {
    const match = currentSession.match(/(\d{4})\/(\d{4})/);
    if (!match) return null;
    
    const startYear = parseInt(match[1]);
    const endYear = parseInt(match[2]);
    
    return `${startYear - 1}/${endYear - 1}`;
  },

  /*
 * ═══════════════════════════════════════════════════════════
 * PAYMENT RECORDING: Atomic Transaction
 * ═══════════════════════════════════════════════════════════
 */
async recordPayment(pupilId, pupilName, classId, className, session, term, paymentData) {
  try {
    const amountPaid = parseFloat(paymentData.amountPaid);
    if (!amountPaid || amountPaid <= 0) {
      throw new Error('Invalid payment amount');
    }

    const encodedSession = session.replace(/\//g, '-');

    // ─── Get pupil data for fee adjustments ───
    const pupilDoc = await db.collection('pupils').doc(pupilId).get();
    if (!pupilDoc.exists) {
      throw new Error('Pupil profile not found');
    }
    
    const pupilData = pupilDoc.data();

    // ─── Get base fee ───
    const feeDocId = `fee_${classId}`;
    const feeDoc = await db.collection('fee_structures').doc(feeDocId).get();

    if (!feeDoc.exists) {
      throw new Error(`Fee structure not configured for class: ${className}`);
    }

    const baseFee = Number(feeDoc.data().total) || 0;

    // ─── Calculate ADJUSTED fee ───
    const amountDue = this.calculateAdjustedFee(pupilData, baseFee, term);
    
    console.log('💰 [FINANCE] Payment Recording:');
    console.log(`   Base fee: ₦${baseFee.toLocaleString()}`);
    console.log(`   Adjusted fee: ₦${amountDue.toLocaleString()}`);
    console.log(`   Payment: ₦${amountPaid.toLocaleString()}`);

    // ─── Get current payment state ───
    const paymentRecordId = `${pupilId}_${encodedSession}_${term}`;
    const existingPaymentDoc = await db.collection('payments').doc(paymentRecordId).get();

    let currentTotalPaid = 0;
    let storedArrears = 0;

    if (existingPaymentDoc.exists) {
      const existingData = existingPaymentDoc.data();
      currentTotalPaid = Number(existingData.totalPaid) || 0;
      storedArrears = Number(existingData.arrears) || 0;
    } else {
      // No payment record exists - calculate arrears fresh
      storedArrears = await this.calculateCompleteArrears(pupilId, session, term);
    }

    const arrears = Math.max(0, storedArrears);
    const totalDue = amountDue + arrears;
    const newTotalPaid = currentTotalPaid + amountPaid;

    // ─── Prevent overpayment ───
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

    // ─── Split payment between arrears and current term ───
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

    // ✅ CRITICAL FIX: Calculate balances BEFORE and AFTER
    const balanceBefore = totalDue - currentTotalPaid;
    const balanceAfter = totalDue - newTotalPaid;

    const paymentStatus =
      balanceAfter === 0 ? 'paid' :
      newTotalPaid > 0 ? 'partial' :
      remainingArrears > 0 ? 'owing_with_arrears' : 'owing';

    console.log(`   Balance before: ₦${balanceBefore.toLocaleString()}`);
    console.log(`   Balance after: ₦${balanceAfter.toLocaleString()}`);

    // ─── Generate receipt number ───
    const receiptNo = await this.generateReceiptNumber();

    // ─── ATOMIC WRITE using Firestore transaction ───
    const paymentRef = db.collection('payments').doc(paymentRecordId);
    const transactionRef = db.collection('payment_transactions').doc(receiptNo);

    await db.runTransaction(async (transaction) => {
      // ✅ Write frozen transaction snapshot with CORRECT balance fields
      transaction.set(transactionRef, {
        pupilId,
        pupilName,
        classId,
        className,
        session,
        term,
        baseFee,
        adjustedFee: amountDue,
        feeAdjustment: baseFee - amountDue,
        amountDue,
        arrears,
        totalDue,
        amountPaid,
        arrearsPayment,
        currentTermPayment,
        totalPaidBefore: currentTotalPaid,
        totalPaidAfter: newTotalPaid,
        balanceBefore: balanceBefore,        // ✅ Balance before this payment
        balanceAfter: balanceAfter,          // ✅ Balance after this payment
        status: paymentStatus,
        paymentMethod: paymentData.paymentMethod || 'Cash',
        notes: paymentData.notes || '',
        paymentDate: firebase.firestore.FieldValue.serverTimestamp(),
        receiptNo,
        recordedBy: auth.currentUser.uid,
        recordedByEmail: auth.currentUser.email
      });

      // Update running payment summary
      transaction.set(paymentRef, {
        pupilId,
        pupilName,
        classId,
        className,
        session,
        term,
        baseFee,
        adjustedFee: amountDue,
        amountDue,
        arrears: remainingArrears,
        totalDue: amountDue + remainingArrears,
        totalPaid: newTotalPaid,
        balance: balanceAfter,              // ✅ Use calculated balanceAfter
        status: paymentStatus,
        lastPaymentDate: firebase.firestore.FieldValue.serverTimestamp(),
        lastPaymentAmount: amountPaid,
        lastReceiptNo: receiptNo,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    });

    console.log(`✅ [FINANCE] Payment recorded: Receipt ${receiptNo}`);
    console.log(`   Balance after payment: ₦${balanceAfter.toLocaleString()}`);

    return {
      success: true,
      receiptNo,
      amountPaid,
      arrearsPayment,
      currentTermPayment,
      newBalance: balanceAfter,             // ✅ Return correct balance
      totalPaid: newTotalPaid,
      status: paymentStatus,
      baseFee,
      adjustedFee: amountDue
    };

  } catch (error) {
    console.error('❌ [FINANCE] Error recording payment:', error);
    throw error;
  }
},

  /**
   * ═══════════════════════════════════════════════════════════
   * HELPER: Generate Unique Receipt Number
   * ═══════════════════════════════════════════════════════════
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
      console.error('[FINANCE] Error incrementing counter:', error);
      counter = Date.now() % 10000;
    }

    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `RCT${year}${month}${day}${String(counter).padStart(4, '0')}${random}`;
  },

  /**
   * ═══════════════════════════════════════════════════════════
   * QUERY: Get Receipt Data (Frozen Snapshot)
   * ═══════════════════════════════════════════════════════════
   */
  async getReceiptData(receiptNo) {
    try {
      const doc = await db.collection('payment_transactions').doc(receiptNo).get();

      if (!doc.exists) {
        throw new Error('Receipt not found');
      }

      return doc.data();

    } catch (error) {
      console.error('[FINANCE] Error getting receipt data:', error);
      throw error;
    }
  },

  /**
   * ═══════════════════════════════════════════════════════════
   * QUERY: Get Pupil Payment Summary (RECALCULATED)
   * ═══════════════════════════════════════════════════════════
   * CRITICAL: This now RECALCULATES instead of reading stale data
   */
  async getPupilPaymentSummary(pupilId, session, term) {
    try {
      if (!pupilId || !session || !term) {
        throw new Error('pupilId, session, and term are required');
      }

      // ✅ FIXED: Use canonical calculation instead of reading stored values
      const result = await this.calculateCurrentOutstanding(pupilId, session, term);
      
      // Handle errors from calculation
      if (result.reason) {
        return {
          pupilId,
          session,
          term,
          amountDue: 0,
          arrears: 0,
          totalDue: 0,
          totalPaid: 0,
          balance: 0,
          status: 'no_payment',
          reason: result.reason
        };
      }

      return {
        pupilId: result.pupilId,
        pupilName: result.pupilName,
        classId: result.classId,
        className: result.className,
        session: result.session,
        term: result.term,
        baseFee: result.baseFee,
        adjustedFee: result.amountDue,
        amountDue: result.amountDue,
        arrears: result.arrears,
        totalDue: result.totalDue,
        totalPaid: result.totalPaid,
        balance: result.balance,
        status: result.status,
        lastPaymentDate: null, // Not tracked in canonical calculation
        lastPaymentAmount: 0,
        lastReceiptNo: null
      };

    } catch (error) {
      console.error('[FINANCE] Error getting pupil payment summary:', error);
      return null;
    }
  },

  /**
   * ═══════════════════════════════════════════════════════════
   * QUERY: Get Payment History (All Transactions)
   * ═══════════════════════════════════════════════════════════
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
      console.error('[FINANCE] Error getting payment history:', error);
      return [];
    }
  },

  /**
   * ═══════════════════════════════════════════════════════════
   * REPORT: Outstanding Fees (RECALCULATED)
   * ═══════════════════════════════════════════════════════════
   */
  async getOutstandingFeesReport(classId = null, session, term = null) {
    try {
      // Get all pupils (filter by class if specified)
      let pupilQuery = db.collection('pupils');
      if (classId) {
        pupilQuery = pupilQuery.where('class.id', '==', classId);
      }
      
      const pupilsSnap = await pupilQuery.get();
      const outstanding = [];

      for (const pupilDoc of pupilsSnap.docs) {
        const pupilId = pupilDoc.id;
        const pupilData = pupilDoc.data();
        
        // Use canonical calculation for each pupil
        const result = await this.calculateCurrentOutstanding(pupilId, session, term || 'First Term');
        
        // Skip if no fee configured or no balance
        if (result.reason || result.balance <= 0) {
          continue;
        }

        outstanding.push({
          pupilId: result.pupilId,
          pupilName: result.pupilName,
          classId: result.classId,
          className: result.className,
          session: result.session,
          term: result.term,
          baseFee: result.baseFee,
          adjustedFee: result.amountDue,
          amountDue: result.amountDue,
          arrears: result.arrears,
          totalDue: result.totalDue,
          totalPaid: result.totalPaid,
          balance: result.balance,
          status: result.status
        });
      }

      // Sort by balance (highest first)
      outstanding.sort((a, b) => b.balance - a.balance);

      return outstanding;

    } catch (error) {
      console.error('[FINANCE] Error getting outstanding fees:', error);
      return [];
    }
  },

  /**
   * ═══════════════════════════════════════════════════════════
   * REPORT: Financial Summary (RECALCULATED)
   * ═══════════════════════════════════════════════════════════
   */
  async getFinancialSummary(session, term = null) {
    try {
      // Get all pupils
      const pupilsSnap = await db.collection('pupils').get();

      let totalExpected = 0;
      let totalCollected = 0;
      let totalOutstanding = 0;
      let paidInFull = 0;
      let partialPayments = 0;
      let noPayment = 0;

      for (const pupilDoc of pupilsSnap.docs) {
        const pupilId = pupilDoc.id;
        
        // Use canonical calculation
        const result = await this.calculateCurrentOutstanding(pupilId, session, term || 'First Term');
        
        // Skip if no fee configured
        if (result.reason) {
          continue;
        }

        totalExpected += result.totalDue;
        totalCollected += result.totalPaid;
        totalOutstanding += result.balance;

        if (result.balance === 0 && result.totalPaid > 0) {
          paidInFull++;
        } else if (result.totalPaid > 0 && result.balance > 0) {
          partialPayments++;
        } else {
          noPayment++;
        }
      }

      const collectionRate = totalExpected > 0
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
        totalPupils: pupilsSnap.size
      };

    } catch (error) {
      console.error('[FINANCE] Error getting financial summary:', error);
      return null;
    }
  }

};

// Expose to window for global access
window.finance = finance;

// Also expose individual functions for backward compatibility
window.calculateCurrentOutstanding = finance.calculateCurrentOutstanding.bind(finance);
window.calculateAdjustedFee = finance.calculateAdjustedFee.bind(finance);
window.calculateCompleteArrears = finance.calculateCompleteArrears.bind(finance);
window.calculateSessionBalanceSafe = finance.calculateSessionBalanceSafe.bind(finance);
window.getClassIdSafely = finance.getClassIdSafely.bind(finance);
window.getPreviousSessionName = finance.getPreviousSessionName.bind(finance);

console.log('✅ Finance module v4.0.0 loaded - FULLY CONSISTENT WITH ADMIN/PUPIL LOGIC');