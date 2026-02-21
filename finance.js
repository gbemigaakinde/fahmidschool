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

  const termOrder = {
    'First Term': 1,
    'Second Term': 2,
    'Third Term': 3
  };

  const currentTermNum = termOrder[currentTerm] || 1;
  const admissionTermNum = termOrder[pupilData.admissionTerm || 'First Term'] || 1;
  const exitTermNum = termOrder[pupilData.exitTerm || 'Third Term'] || 3;

  if (currentTermNum < admissionTermNum || currentTermNum > exitTermNum) {
    console.log(`   [FINANCE] Pupil not enrolled for ${currentTerm} (admission: ${pupilData.admissionTerm}, exit: ${pupilData.exitTerm})`);
    return 0;
  }

  // ✅ Round base fee on entry — guards against legacy unrounded values in Firestore
  let adjustedFee = Math.round(Number(baseFee) || 0);

  const percentAdjustment = Number(pupilData.feeAdjustmentPercent) || 0;
  if (percentAdjustment !== 0) {
    // ✅ Round after percentage — prevents float drift (e.g. 50000 * 1.15 = 57499.9999...)
    adjustedFee = Math.round(adjustedFee * (1 + percentAdjustment / 100));
    console.log(`   [FINANCE] Applied ${percentAdjustment}% adjustment: ₦${baseFee.toLocaleString()} → ₦${adjustedFee.toLocaleString()}`);
  }

  const amountAdjustment = Number(pupilData.feeAdjustmentAmount) || 0;
  if (amountAdjustment !== 0) {
    // ✅ Round after fixed adjustment
    adjustedFee = Math.round(adjustedFee + amountAdjustment);
    console.log(`   [FINANCE] Applied ₦${amountAdjustment.toLocaleString()} adjustment → ₦${adjustedFee.toLocaleString()}`);
  }

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
              // ─── NO PAYMENT DOC: Recalculate what that term cost ───
              // Pupil existed but never had a payment recorded (e.g. joined mid-year,
              // or payment doc was never created). We cannot assume ₦0 — that would
              // silently erase a full term's debt. Recalculate from fee structure.
              console.log(`     ℹ️ No payment record for ${previousTermName} — recalculating from fee structure`);
              
              try {
                const pupilDoc = await db.collection('pupils').doc(pupilId).get();
                
                if (pupilDoc.exists) {
                  const pupilData = pupilDoc.data();
                  const classId = this.getClassIdSafely(pupilData);
                  
                  if (classId) {
                    const feeDoc = await db.collection('fee_structures').doc(`fee_${classId}`).get();
                    
                    if (feeDoc.exists) {
                      const baseFee = Math.round(Number(feeDoc.data().total) || 0);
                      const termFee = this.calculateAdjustedFee(pupilData, baseFee, previousTermName);
                      totalArrears = termFee;
                      console.log(`     ✓ Recalculated ${previousTermName} fee as arrears: ₦${termFee.toLocaleString()}`);
                    } else {
                      console.warn(`     ⚠️ No fee structure found — treating previous term as ₦0`);
                    }
                  } else {
                    console.warn(`     ⚠️ No valid classId for pupil — treating previous term as ₦0`);
                  }
                }
              } catch (fallbackError) {
                console.error(`     ⚠️ Fallback recalculation failed:`, fallbackError);
              }
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

    console.log(`     Checking session balance for ${session}...`);

    // BUG 7 FIX: Check terms in reverse order — Third, then Second, then First.
    // A pupil's session-end balance lives in whichever term was their last.
    // Pupils with exitTerm = 'Second Term' have no Third Term document.
    // The first document found is returned — do not sum them (that would double-count).

    const termsToCheck = ['Third Term', 'Second Term', 'First Term'];

    for (const termName of termsToCheck) {
      const docId = `${pupilId}_${encodedSession}_${termName}`;

      try {
        const termDoc = await db.collection('payments').doc(docId).get();

        if (termDoc.exists) {
          const balance = Number(termDoc.data().balance) || 0;

          if (balance > 0) {
            console.log(`     ✓ Found balance in ${termName}: ₦${balance.toLocaleString()}`);
          } else {
            console.log(`     ✓ ${termName} document found — session fully paid`);
          }

          // Return the balance from the most recent term that has a document.
          // Do not continue checking earlier terms — they are already included
          // in the cascade balance of this term.
          return balance;
        } else {
          console.log(`     ℹ️ No ${termName} document for ${session} — checking earlier term`);
        }

      } catch (error) {
        console.warn(`     ⚠️ Could not fetch ${termName} for ${session}:`, error.message);
        // Continue to next term
      }
    }

    // No payment documents found for this session at all
    console.log(`     ℹ️ No payment records found for ${session} — assuming ₦0`);
    return 0;

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

/**
 * ═══════════════════════════════════════════════════════════
 * COMPLETE FIX: Payment Recording with Proper Overpayment Prevention
 * ═══════════════════════════════════════════════════════════
 * 
 * FIXES:
 * 1. Always recalculates totalDue from scratch (no stale data)
 * 2. Better error messages showing exactly what's wrong
 * 3. Validates against ACTUAL remaining balance, not stored values
 * 4. Handles adjusted fees correctly
 * 5. Prevents tiny rounding errors from blocking valid payments
 */

/**
 * Replace the ENTIRE recordPayment function in finance.js (lines ~300-480)
 */
async recordPayment(pupilId, pupilName, classId, className, session, term, paymentData) {
  try {
    console.log('💰 [FINANCE] Starting payment recording...');
    console.log('   Input data:', { pupilId, pupilName, classId, className, session, term });
    
    // ✅ FIX 2: Round after parsing to prevent float accumulation over many payments
    const amountPaid = Math.round(parseFloat(paymentData.amountPaid));
    if (!amountPaid || amountPaid <= 0) {
      throw new Error('Invalid payment amount');
    }
    console.log(`   Amount to pay: ₦${amountPaid.toLocaleString()}`);

    const encodedSession = session.replace(/\//g, '-');

    // ═══════════════════════════════════════════════════════════
    // STEP 1: Get FRESH pupil data for fee calculations
    // ═══════════════════════════════════════════════════════════
    console.log('   Fetching pupil data...');
    const pupilDoc = await db.collection('pupils').doc(pupilId).get();
    if (!pupilDoc.exists) {
      throw new Error('Pupil profile not found');
    }
    const pupilData = pupilDoc.data();
    console.log('   ✓ Pupil data loaded');

    // ═══════════════════════════════════════════════════════════
    // STEP 2: Get FRESH base fee from fee structure
    // ═══════════════════════════════════════════════════════════
    console.log(`   Fetching fee structure for class ${classId}...`);
    const feeDocId = `fee_${classId}`;
    const feeDoc = await db.collection('fee_structures').doc(feeDocId).get();

    if (!feeDoc.exists) {
      throw new Error(`Fee structure not configured for class: ${className}`);
    }

    const baseFee = Math.round(Number(feeDoc.data().total) || 0);
    console.log(`   ✓ Base fee: ₦${baseFee.toLocaleString()}`);

    // ═══════════════════════════════════════════════════════════
    // STEP 3: Calculate FRESH adjusted fee
    // ═══════════════════════════════════════════════════════════
    const amountDue = this.calculateAdjustedFee(pupilData, baseFee, term);
    console.log(`   ✓ Adjusted fee: ₦${amountDue.toLocaleString()}`);
    
    if (amountDue !== baseFee) {
      console.log(`   📊 Fee adjustment applied: ₦${baseFee.toLocaleString()} → ₦${amountDue.toLocaleString()}`);
    }

    // ═══════════════════════════════════════════════════════════
    // STEP 4: RECALCULATE arrears from scratch
    // ═══════════════════════════════════════════════════════════
    console.log('   Recalculating arrears from scratch...');
    const arrears = await this.calculateCompleteArrears(pupilId, session, term);
    console.log(`   ✓ Fresh arrears calculation: ₦${arrears.toLocaleString()}`);

    // ═══════════════════════════════════════════════════════════
    // STEP 5: Get CURRENT total paid from payment record
    // ═══════════════════════════════════════════════════════════
    const paymentRecordId = `${pupilId}_${encodedSession}_${term}`;
    console.log(`   Checking payment record: ${paymentRecordId}`);
    
    let currentTotalPaid = 0;
    
    const existingPaymentDoc = await db.collection('payments').doc(paymentRecordId).get();
    
    if (existingPaymentDoc.exists) {
      const existingData = existingPaymentDoc.data();
      currentTotalPaid = Number(existingData.totalPaid) || 0;
      
      console.log(`   ✓ Found existing payment record`);
      console.log(`     - Already paid: ₦${currentTotalPaid.toLocaleString()}`);
      
      const storedArrears = Number(existingData.arrears) || 0;
      if (storedArrears !== arrears) {
        console.warn(`   ⚠️ ARREARS MISMATCH DETECTED!`);
        console.warn(`     - Stored in record: ₦${storedArrears.toLocaleString()}`);
        console.warn(`     - Fresh calculation: ₦${arrears.toLocaleString()}`);
        console.warn(`     - Using FRESH calculation (more accurate)`);
      }
    } else {
      console.log(`   ℹ️ No existing payment record (first payment)`);
    }

    // ═══════════════════════════════════════════════════════════
    // STEP 6: Calculate ACTUAL financial position
    // ═══════════════════════════════════════════════════════════
    const totalDue = amountDue + arrears;
    const remainingBalance = totalDue - currentTotalPaid;
    const newTotalPaid = currentTotalPaid + amountPaid;
    const newBalance = totalDue - newTotalPaid;

    console.log('   ═══════════════════════════════════════');
    console.log('   📊 FINANCIAL BREAKDOWN:');
    console.log(`   Current Term Fee: ₦${amountDue.toLocaleString()}`);
    console.log(`   Arrears: ₦${arrears.toLocaleString()}`);
    console.log(`   ─────────────────────────────────────`);
    console.log(`   TOTAL DUE: ₦${totalDue.toLocaleString()}`);
    console.log(`   Already Paid: ₦${currentTotalPaid.toLocaleString()}`);
    console.log(`   ─────────────────────────────────────`);
    console.log(`   REMAINING BALANCE: ₦${remainingBalance.toLocaleString()}`);
    console.log(`   New Payment: ₦${amountPaid.toLocaleString()}`);
    console.log(`   ─────────────────────────────────────`);
    console.log(`   Balance After Payment: ₦${newBalance.toLocaleString()}`);
    console.log('   ═══════════════════════════════════════');

    // ═══════════════════════════════════════════════════════════
    // STEP 7: OVERPAYMENT VALIDATION
    // ═══════════════════════════════════════════════════════════
    const ROUNDING_TOLERANCE = 1;
    
    if (newTotalPaid > (totalDue + ROUNDING_TOLERANCE)) {
      const overpayment = newTotalPaid - totalDue;
      
      console.error('   ❌ OVERPAYMENT DETECTED');
      console.error(`     - Overpayment amount: ₦${overpayment.toLocaleString()}`);
      
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
    
    console.log('   ✅ Overpayment check PASSED');

    // ═══════════════════════════════════════════════════════════
    // STEP 8: Split payment between arrears and current term
    // ═══════════════════════════════════════════════════════════
    let arrearsPayment = 0;
    let currentTermPayment = 0;
    let remainingArrears = arrears;

    if (arrears > 0) {
      if (amountPaid <= arrears) {
        arrearsPayment = amountPaid;
        currentTermPayment = 0;
        remainingArrears = arrears - amountPaid;
      } else {
        arrearsPayment = arrears;
        currentTermPayment = amountPaid - arrears;
        remainingArrears = 0;
      }
      
      console.log(`   💰 Payment allocation:`);
      console.log(`     - To arrears: ₦${arrearsPayment.toLocaleString()}`);
      console.log(`     - To current term: ₦${currentTermPayment.toLocaleString()}`);
      console.log(`     - Remaining arrears: ₦${remainingArrears.toLocaleString()}`);
    } else {
      currentTermPayment = amountPaid;
      console.log(`   💰 Full payment to current term: ₦${currentTermPayment.toLocaleString()}`);
    }

    // ═══════════════════════════════════════════════════════════
    // STEP 9: Calculate balances BEFORE and AFTER
    // ═══════════════════════════════════════════════════════════
    const balanceBefore = Math.max(0, remainingBalance);
    const balanceAfter = Math.max(0, newBalance);

    console.log(`   📊 Balance transition:`);
    console.log(`     - Before: ₦${balanceBefore.toLocaleString()}`);
    console.log(`     - After: ₦${balanceAfter.toLocaleString()}`);

    // ═══════════════════════════════════════════════════════════
    // STEP 10: Determine payment status
    // ═══════════════════════════════════════════════════════════
    const paymentStatus =
      balanceAfter === 0 ? 'paid' :
      newTotalPaid > 0 ? 'partial' :
      arrears > 0 ? 'owing_with_arrears' : 'owing';

    console.log(`   📌 Payment status: ${paymentStatus}`);

    // ═══════════════════════════════════════════════════════════
    // STEP 11: Generate receipt number
    // ═══════════════════════════════════════════════════════════
    const receiptNo = await this.generateReceiptNumber();
    console.log(`   ✓ Generated receipt: ${receiptNo}`);

    // ═══════════════════════════════════════════════════════════
    // STEP 12: ATOMIC WRITE using Firestore transaction
    // ═══════════════════════════════════════════════════════════
    console.log('   📝 Writing to Firestore...');
    
    const paymentRef = db.collection('payments').doc(paymentRecordId);
    const transactionRef = db.collection('payment_transactions').doc(receiptNo);

    const transactionData = {
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
      balanceBefore: balanceBefore,
      balanceAfter: balanceAfter,
      status: paymentStatus,
      paymentMethod: paymentData.paymentMethod || 'Cash',
      notes: paymentData.notes || '',
      paymentDate: firebase.firestore.FieldValue.serverTimestamp(),
      receiptNo,
      recordedBy: auth.currentUser.uid,
      recordedByEmail: auth.currentUser.email
    };

    console.log('   📋 Transaction data prepared');

    await db.runTransaction(async (transaction) => {
      transaction.set(transactionRef, transactionData);

      // ✅ FIX 1: Store ORIGINAL arrears and ORIGINAL totalDue — never mutate them.
      // balance = totalDue - totalPaid reflects true outstanding.
      // Downstream terms read this balance as their arrears source — it must be accurate.
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
        arrears: arrears,        // ✅ Original arrears — never reduced
        totalDue: totalDue,      // ✅ amountDue + original arrears — never reduced
        totalPaid: newTotalPaid,
        balance: balanceAfter,
        status: paymentStatus,
        lastPaymentDate: firebase.firestore.FieldValue.serverTimestamp(),
        lastPaymentAmount: amountPaid,
        lastReceiptNo: receiptNo,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    });

    console.log('   ✅ Firestore transaction completed successfully');
    console.log(`   🎫 Receipt: ${receiptNo}`);
    console.log(`   💳 Balance after payment: ₦${balanceAfter.toLocaleString()}`);

    return {
      success: true,
      receiptNo,
      amountPaid,
      arrearsPayment,
      currentTermPayment,
      newBalance: balanceAfter,
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