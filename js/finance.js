/**
 * FAHMID NURSERY & PRIMARY SCHOOL
 * Finance Management Module
 * @version 4.0.0
 * @date 2026-02-02
 */

'use strict';

const finance = {

  async calculateCurrentOutstanding(pupilId, session, term) {
    try {
      const pupilDoc = await db.collection('pupils').doc(pupilId).get();
      if (!pupilDoc.exists) {
        throw new Error('Pupil not found');
      }
      const pupilData = pupilDoc.data();

      if (pupilData.status === 'alumni' || pupilData.isActive === false) {
        return {
          amountDue: 0, arrears: 0, totalDue: 0, totalPaid: 0,
          balance: 0, credit: 0,
          reason: 'Alumni — not an active pupil'
        };
      }

      const classId = this.getClassIdSafely(pupilData);
      if (!classId) {
        return {
          pupilId,
          pupilName: pupilData.name,
          session,
          term,
          amountDue: 0, arrears: 0, totalDue: 0, totalPaid: 0,
          balance: 0, credit: 0,
          reason: 'Invalid class data - contact admin'
        };
      }

      const feeDocId = `fee_${classId}`;
      const feeDoc   = await db.collection('fee_structures').doc(feeDocId).get();

      if (!feeDoc.exists) {
        return {
          pupilId,
          pupilName: pupilData.name,
          classId,
          className: pupilData.class?.name || 'Unknown',
          session,
          term,
          amountDue: 0, arrears: 0, totalDue: 0, totalPaid: 0,
          balance: 0, credit: 0,
          reason: 'No fee structure configured for this class'
        };
      }

      const baseFee = Math.round(Number(feeDoc.data().total) || 0);

      const amountDue = this.calculateAdjustedFee(pupilData, baseFee, term);

      if (amountDue === 0 && baseFee > 0) {
        return {
          pupilId,
          pupilName: pupilData.name,
          classId,
          className: pupilData.class?.name || 'Unknown',
          session,
          term,
          amountDue: 0, arrears: 0, totalDue: 0, totalPaid: 0,
          balance: 0, credit: 0,
          reason: 'Not enrolled for this term'
        };
      }

      const arrears = await this.calculateCompleteArrears(pupilId, session, term);

      const encodedSession = session.replace(/\//g, '-');
      const paymentDocId   = `${pupilId}_${encodedSession}_${term}`;

      let totalPaid = 0;
      try {
        const paymentDoc = await db.collection('payments').doc(paymentDocId).get();
        if (paymentDoc.exists) {
          totalPaid = Math.round(Math.max(0, Number(paymentDoc.data().totalPaid) || 0));
        }
      } catch (error) {
        // no payment doc yet
      }

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

      return {
        pupilId,
        pupilName:  pupilData.name,
        classId,
        className:  pupilData.class?.name || 'Unknown',
        session,
        term,
        baseFee,
        amountDue,
        arrears,
        totalDue,
        totalPaid,
        balance,
        credit,
        status
      };

    } catch (error) {
      throw error;
    }
  },

  getClassIdSafely(pupilData) {
    if (!pupilData || !pupilData.class) {
      return null;
    }

    if (typeof pupilData.class === 'object' && pupilData.class.id) {
      return pupilData.class.id;
    }

    return null;
  },

  calculateAdjustedFee(pupilData, baseFee, currentTerm) {
    if (!pupilData || typeof baseFee !== 'number') {
      return baseFee || 0;
    }

    const termOrder = {
      'First Term':  1,
      'Second Term': 2,
      'Third Term':  3
    };

    const currentTermNum   = termOrder[currentTerm] || 1;
    const admissionTermNum = termOrder[pupilData.admissionTerm || 'First Term'] || 1;
    const exitTermNum      = termOrder[pupilData.exitTerm      || 'Third Term'] || 3;

    if (currentTermNum < admissionTermNum || currentTermNum > exitTermNum) {
      return 0;
    }

    const base = Math.round(Number(baseFee) || 0);

    const percentAdjustment = Number(pupilData.feeAdjustmentPercent) || 0;
    const amountAdjustment  = Number(pupilData.feeAdjustmentAmount)  || 0;

    const percentDiscount = Math.round(base * (percentAdjustment / 100));
    const adjustedFee     = Math.round(base + percentDiscount + amountAdjustment);

    const finalFee = Math.max(0, adjustedFee);

    return finalFee;
  },

  async calculateCompleteArrears(pupilId, currentSession, currentTerm) {
    try {
      let totalArrears = 0;
      const encodedSession = currentSession.replace(/\//g, '-');

      const termOrder = {
        'First Term':  1,
        'Second Term': 2,
        'Third Term':  3
      };

      const currentTermNum = termOrder[currentTerm] || 1;

      const wasEnrolledIn = async (pupilData, checkSession, checkTerm) => {
        const admissionSession = pupilData.admissionSession || null;
        const admissionTerm    = pupilData.admissionTerm    || 'First Term';
        const exitTerm         = pupilData.exitTerm         || 'Third Term';

        if ((termOrder[checkTerm] || 1) > (termOrder[exitTerm] || 3)) return false;

        if (!admissionSession) {
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

        if ((termOrder[admissionTerm] || 1) > (termOrder[checkTerm] || 1)) return false;

        return true;
      };

      let pupilDataCache = null;
      const getPupilData = async () => {
        if (pupilDataCache) return pupilDataCache;
        const doc = await db.collection('pupils').doc(pupilId).get();
        pupilDataCache = doc.exists ? doc.data() : null;
        return pupilDataCache;
      };

      if (currentTermNum === 1) {
        const previousSession = this.getPreviousSessionName(currentSession);

        if (previousSession) {
          const pupilData = await getPupilData();
          if (pupilData) {
            const enrolled = await wasEnrolledIn(pupilData, previousSession, 'Third Term');
            if (!enrolled) {
              return 0;
            }
          }

          try {
            const sessionArrears = await this.calculateSessionBalanceSafe(pupilId, previousSession);
            totalArrears = sessionArrears;
          } catch (error) {
            totalArrears = 0;
          }
        }

      } else {
        const previousTermName = Object.keys(termOrder).find(
          key => termOrder[key] === currentTermNum - 1
        );

        if (previousTermName) {
          const pupilData = await getPupilData();
          if (pupilData) {
            const enrolled = await wasEnrolledIn(pupilData, currentSession, previousTermName);
            if (!enrolled) {
              return 0;
            }
          }

          const prevTermDocId = `${pupilId}_${encodedSession}_${previousTermName}`;

          try {
            const prevTermDoc = await db.collection('payments').doc(prevTermDocId).get();

            if (prevTermDoc.exists) {
              const rawBalance = prevTermDoc.data().balance;
              const parsed     = Number(rawBalance);

              if (rawBalance === undefined || rawBalance === null || isNaN(parsed)) {
                try {
                  const outstanding = await this.calculateCurrentOutstanding(
                    pupilId, currentSession, previousTermName
                  );
                  totalArrears = outstanding.balance || 0;
                } catch (e) {
                  totalArrears = 0;
                }
              } else {
                totalArrears = Math.max(0, Math.round(parsed));
              }

            } else {
              try {
                const outstanding = await this.calculateCurrentOutstanding(
                  pupilId, currentSession, previousTermName
                );
                totalArrears = outstanding.balance || 0;
              } catch (e) {
                try {
                  totalArrears = await this._recalculateTermBalance(
                    pupilId, currentSession, previousTermName
                  );
                } catch (e2) {
                  totalArrears = 0;
                }
              }
            }

          } catch (readError) {
            totalArrears = 0;
          }
        }
      }

      return totalArrears;

    } catch (error) {
      return 0;
    }
  },

  async calculateSessionBalanceSafe(pupilId, session) {
    try {
      const encodedSession = session.replace(/\//g, '-');

      const termsToCheck = ['Third Term', 'Second Term', 'First Term'];

      for (const termName of termsToCheck) {
        const docId = `${pupilId}_${encodedSession}_${termName}`;

        try {
          const termDoc = await db.collection('payments').doc(docId).get();

          if (termDoc.exists) {
            const rawBalance = termDoc.data().balance;
            const balance    = Number(rawBalance);

            if (rawBalance === undefined || rawBalance === null || isNaN(balance)) {
              try {
                const outstanding = await this.calculateCurrentOutstanding(
                  pupilId, session, termName
                );
                const recalculated = outstanding.balance || 0;
                return recalculated;
              } catch (e) {
                return 0;
              }
            }

            return Math.max(0, Math.round(balance));
          }

        } catch (error) {
          // could not fetch this term doc — move to earlier term
        }
      }

      try {
        const pupilDoc = await db.collection('pupils').doc(pupilId).get();
        if (pupilDoc.exists) {
          const pupilData        = pupilDoc.data();
          const admissionSession = pupilData.admissionSession || null;

          if (admissionSession) {
            const sessionStartYear = (s) => {
              const m = (s || '').match(/(\d{4})\//);
              return m ? parseInt(m[1]) : 0;
            };

            const admissionYear = sessionStartYear(admissionSession);
            const checkYear     = sessionStartYear(session);

            if (checkYear < admissionYear) {
              return 0;
            }
          }
        }
      } catch (enrollmentCheckError) {
        // could not verify enrolment — fall through to recalculation
      }

      try {
        const fallback = await this._recalculateTermBalance(pupilId, session, 'Third Term');
        return fallback;
      } catch (fallbackError) {
        // final fallback failed
      }

      return 0;

    } catch (error) {
      return 0;
    }
  },

  async _recalculateTermBalance(pupilId, session, term) {
    try {
      const pupilDoc = await db.collection('pupils').doc(pupilId).get();
      if (!pupilDoc.exists) return 0;

      const pupilData = pupilDoc.data();

      let resolvedClassId = null;
      let resolvedBaseFee = null;

      try {
        const txSnap = await db.collection('payment_transactions')
          .where('pupilId', '==', pupilId)
          .where('session', '==', session)
          .where('term', '==', term)
          .orderBy('paymentDate', 'asc')
          .limit(1)
          .get();

        if (!txSnap.empty) {
          const firstTx = txSnap.docs[0].data();

          if (firstTx.classId) {
            resolvedClassId = firstTx.classId;
          }

          if (typeof firstTx.baseFee === 'number' && firstTx.baseFee > 0) {
            resolvedBaseFee = firstTx.baseFee;
          }
        }
      } catch (txError) {
        // no historical transaction snapshot available
      }

      if (!resolvedClassId) {
        resolvedClassId = this.getClassIdSafely(pupilData);
        if (!resolvedClassId) {
          return 0;
        }
      }

      if (resolvedBaseFee === null) {
        const feeDoc = await db.collection('fee_structures').doc(`fee_${resolvedClassId}`).get();
        if (!feeDoc.exists) {
          return 0;
        }
        resolvedBaseFee = Math.round(Number(feeDoc.data().total) || 0);
      }

      const amountDue = this.calculateAdjustedFee(pupilData, resolvedBaseFee, term);

      const encodedSession = session.replace(/\//g, '-');
      const paymentDocId = `${pupilId}_${encodedSession}_${term}`;
      let totalPaid = 0;

      try {
        const paymentDoc = await db.collection('payments').doc(paymentDocId).get();
        if (paymentDoc.exists) {
          totalPaid = Number(paymentDoc.data().totalPaid) || 0;
        }
      } catch (e) {
        // no payment doc — totalPaid stays 0
      }

      const balance = Math.max(0, amountDue - totalPaid);
      return balance;

    } catch (error) {
      return 0;
    }
  },

  getPreviousSessionName(currentSession) {
    const match = currentSession.match(/(\d{4})\/(\d{4})/);
    if (!match) return null;

    const startYear = parseInt(match[1]);
    const endYear = parseInt(match[2]);

    return `${startYear - 1}/${endYear - 1}`;
  },

  async recordPayment(pupilId, pupilName, classId, className, session, term, paymentData) {
    try {
      const amountPaid = Math.round(parseFloat(paymentData.amountPaid));
      if (!amountPaid || amountPaid <= 0) {
        throw new Error('Invalid payment amount');
      }

      const encodedSession = session.replace(/\//g, '-');

      const pupilDoc = await db.collection('pupils').doc(pupilId).get();
      if (!pupilDoc.exists) {
        throw new Error('Pupil profile not found');
      }
      const pupilData = pupilDoc.data();

      const feeDocId = `fee_${classId}`;
      const feeDoc = await db.collection('fee_structures').doc(feeDocId).get();

      if (!feeDoc.exists) {
        throw new Error(`Fee structure not configured for class: ${className}`);
      }

      const baseFee = Math.round(Number(feeDoc.data().total) || 0);

      const amountDue = this.calculateAdjustedFee(pupilData, baseFee, term);

      const arrears = await this.calculateCompleteArrears(pupilId, session, term);

      const paymentRecordId = `${pupilId}_${encodedSession}_${term}`;

      let currentTotalPaid = 0;

      const existingPaymentDoc = await db.collection('payments').doc(paymentRecordId).get();

      if (existingPaymentDoc.exists) {
        const existingData = existingPaymentDoc.data();
        currentTotalPaid = Number(existingData.totalPaid) || 0;
      }

      const totalDue = amountDue + arrears;
      const remainingBalance = totalDue - currentTotalPaid;
      const newTotalPaid = currentTotalPaid + amountPaid;
      const newBalance = totalDue - newTotalPaid;

      const ROUNDING_TOLERANCE = 1;

      if (newTotalPaid > (totalDue + ROUNDING_TOLERANCE)) {
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
      } else {
        currentTermPayment = amountPaid;
      }

      const balanceBefore = Math.max(0, remainingBalance);
      const balanceAfter = Math.max(0, newBalance);

      const paymentStatus =
        balanceAfter === 0 ? 'paid' :
        newTotalPaid > 0 ? 'partial' :
        arrears > 0 ? 'owing_with_arrears' : 'owing';

      const receiptNo = await this.generateReceiptNumber();

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

      await db.runTransaction(async (transaction) => {
        transaction.set(transactionRef, transactionData);

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
          arrears: arrears,
          totalDue: totalDue,
          totalPaid: newTotalPaid,
          balance: balanceAfter,
          status: paymentStatus,
          lastPaymentDate: firebase.firestore.FieldValue.serverTimestamp(),
          lastPaymentAmount: amountPaid,
          lastReceiptNo: receiptNo,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      });

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
      throw error;
    }
  },

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
      counter = Date.now() % 10000;
    }

    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `RCT${year}${month}${day}${String(counter).padStart(4, '0')}${random}`;
  },

  async getReceiptData(receiptNo) {
    try {
      const doc = await db.collection('payment_transactions').doc(receiptNo).get();

      if (!doc.exists) {
        throw new Error('Receipt not found');
      }

      return doc.data();

    } catch (error) {
      throw error;
    }
  },

  async getPupilPaymentSummary(pupilId, session, term) {
    try {
      if (!pupilId || !session || !term) {
        throw new Error('pupilId, session, and term are required');
      }

      const result = await this.calculateCurrentOutstanding(pupilId, session, term);

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
        lastPaymentDate: null,
        lastPaymentAmount: 0,
        lastReceiptNo: null
      };

    } catch (error) {
      return null;
    }
  },

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
      return [];
    }
  },

  async getOutstandingFeesReport(classId = null, session, term = null) {
    try {
      let pupilQuery = db.collection('pupils');
      if (classId) {
        pupilQuery = pupilQuery.where('class.id', '==', classId);
      }

      const pupilsSnap = await pupilQuery.get();
      const outstanding = [];

      for (const pupilDoc of pupilsSnap.docs) {
        const pupilId = pupilDoc.id;
        const pupilData = pupilDoc.data();

        const result = await this.calculateCurrentOutstanding(pupilId, session, term || 'First Term');

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

      outstanding.sort((a, b) => b.balance - a.balance);

      return outstanding;

    } catch (error) {
      return [];
    }
  },

  async getFinancialSummary(session, term = null) {
    try {
      const pupilsSnap = await db.collection('pupils').get();

      let totalExpected = 0;
      let totalCollected = 0;
      let totalOutstanding = 0;
      let paidInFull = 0;
      let partialPayments = 0;
      let noPayment = 0;

      for (const pupilDoc of pupilsSnap.docs) {
        const pupilId = pupilDoc.id;

        const result = await this.calculateCurrentOutstanding(pupilId, session, term || 'First Term');

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
      return null;
    }
  }

};

window.finance = finance;
window.calculateCurrentOutstanding = finance.calculateCurrentOutstanding.bind(finance);
window.calculateAdjustedFee = finance.calculateAdjustedFee.bind(finance);
window.calculateCompleteArrears = finance.calculateCompleteArrears.bind(finance);
window.calculateSessionBalanceSafe = finance.calculateSessionBalanceSafe.bind(finance);
window._recalculateTermBalance = finance._recalculateTermBalance.bind(finance);
window.getClassIdSafely = finance.getClassIdSafely.bind(finance);
window.getPreviousSessionName = finance.getPreviousSessionName.bind(finance);
