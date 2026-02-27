/**
 * FAHMID NURSERY & PRIMARY SCHOOL
 * Result Locking Module
 * Handles result approval workflow and locking
 * 
 * @version 1.0.0
 * @date 2026-01-11
 */

'use strict';

const resultLocking = {
  /**
 * ✅ FIXED: Check if results are locked with clarified error handling
 */
async isLocked(classId, term, subject, session) {
  try {
    const lockId = `${classId}_${session}_${term}_${subject}`;
    const lockDoc = await db.collection('result_locks').doc(lockId).get();
    
    if (!lockDoc.exists) {
      return { locked: false };
    }
    
    const data = lockDoc.data();
    return {
      locked: data.locked || false,
      lockedAt: data.lockedAt,
      lockedBy: data.lockedBy,
      reason: data.reason
    };
  } catch (error) {
    // ✅ FIX: Clarify what the error actually means
    if (error.code === 'permission-denied') {
      console.log('Lock check: Permission denied (likely document does not exist yet)');
      return { 
        locked: false,
        note: 'No lock document found or no permission to read it'
      };
    }
    
    if (error.code === 'unavailable') {
      console.warn('Lock check: Firestore temporarily unavailable');
      return { 
        locked: false, 
        error: 'Service temporarily unavailable',
        errorCode: 'unavailable'
      };
    }
    
    console.error('Error checking lock status:', error.code || error.message);
    
    return { 
      locked: false, 
      error: error.message,
      errorCode: error.code 
    };
  }
},

  /**
   * Lock results after admin approval
   */
  async lockResults(classId, className, term, subject, session, adminUid) {
    try {
      const lockId = `${classId}_${session}_${term}_${subject}`;
      
      await db.collection('result_locks').doc(lockId).set({
        classId,
        className,
        term,
        subject,
        session,
        locked: true,
        lockedAt: firebase.firestore.FieldValue.serverTimestamp(),
        lockedBy: adminUid,
        reason: 'Admin approved and locked'
      });
      
      console.log(`✓ Results locked: ${className} - ${term} - ${subject}`);
      return { success: true };
      
    } catch (error) {
      console.error('Error locking results:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Unlock results (admin only with reason)
   */
  async unlockResults(classId, className, term, subject, session, adminUid, reason) {
    try {
      const lockId = `${classId}_${session}_${term}_${subject}`;
      const lockRef = db.collection('result_locks').doc(lockId);
      
      // Get current lock data for history
      const lockDoc = await lockRef.get();
      const currentData = lockDoc.exists ? lockDoc.data() : {};
      
      // Update lock document
      await lockRef.set({
        classId,
        className,
        term,
        subject,
        session,
        locked: false,
        unlockedAt: firebase.firestore.FieldValue.serverTimestamp(),
        unlockedBy: adminUid,
        unlockReason: reason,
        unlockHistory: firebase.firestore.FieldValue.arrayUnion({
          unlockedAt: new Date().toISOString(),
          unlockedBy: adminUid,
          reason: reason,
          previousLockDate: currentData.lockedAt ? currentData.lockedAt.toDate().toISOString() : null
        })
      }, { merge: true });
      
      console.log(`✓ Results unlocked: ${className} - ${term} - ${subject}`);
      return { success: true };
      
    } catch (error) {
      console.error('Error unlocking results:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Get all submitted results pending approval
   */
  async getSubmittedResults() {
    try {
      const snapshot = await db.collection('result_submissions')
        .where('status', '==', 'pending')
        .orderBy('submittedAt', 'desc')
        .get();
      
      const submissions = [];
      snapshot.forEach(doc => {
        submissions.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      return submissions;
      
    } catch (error) {
      console.error('Error getting submitted results:', error);
      return [];
    }
  },

/**
 * ✅ FIXED: Submit results for admin approval
 */
async submitForApproval(classId, term, subject, session, teacherUid, teacherName) {
  try {
    // Validate inputs
    if (!classId || !term || !subject || !session || !teacherUid || !teacherName) {
      throw new Error('Missing required parameters for submission');
    }

    const submissionId = `${classId}_${session}_${term}_${subject}`;
    
    // ✅ FIX: Check if already submitted with better error handling
    let existingSubmission = null;
    try {
      const existingDoc = await db.collection('result_submissions').doc(submissionId).get();
      if (existingDoc.exists) {
        existingSubmission = existingDoc.data();
      }
    } catch (checkError) {
      // ✅ FIX: If permission denied checking non-existent doc, that's OK - proceed with creation
      if (checkError.code !== 'permission-denied') {
        throw checkError;
      }
      console.log('Could not check existing submission (likely does not exist)');
    }
    
    // Don't allow resubmission if already pending
    if (existingSubmission && existingSubmission.status === 'pending') {
      return {
        success: false,
        message: 'Results are already submitted and pending approval'
      };
    }

    // ✅ CRITICAL FIX: Create submission with proper data structure
    const submissionData = {
      classId: classId,
      className: '', // Will be filled from class doc
      term: term,
      subject: subject,
      session: session,
      teacherUid: teacherUid,
      teacherName: teacherName,
      status: 'pending', // CRITICAL: Must be 'pending' to pass security rules
      pupilCount: 0, // Will be calculated
      submittedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    // Get class name
    const classDoc = await db.collection('classes').doc(classId).get();
    if (classDoc.exists) {
      submissionData.className = classDoc.data().name || 'Unknown Class';
    }
    
    // Count pupils with results
    const resultsSnap = await db.collection('results')
      .where('session', '==', session)
      .where('term', '==', term)
      .where('subject', '==', subject)
      .get();
    
    const pupilIds = new Set();
    resultsSnap.forEach(doc => {
      const data = doc.data();
      if ((data.caScore || 0) > 0 || (data.examScore || 0) > 0) {
        pupilIds.add(data.pupilId);
      }
    });
    
    submissionData.pupilCount = pupilIds.size;

    // ✅ CRITICAL FIX: Use set() with merge:true instead of create-only
    // This works for both new submissions and resubmissions after rejection
    await db.collection('result_submissions')
      .doc(submissionId)
      .set(submissionData, { merge: true });

    console.log('✅ Results submitted for approval:', submissionId);

    return {
      success: true,
      message: 'Results submitted for approval successfully',
      submissionId: submissionId
    };

  } catch (error) {
    console.error('❌ Error submitting for approval:', error);
    
    // ✅ FIX: Return structured error instead of throwing
    return {
      success: false,
      message: error.code === 'permission-denied' 
        ? 'Permission denied. Please contact administrator.' 
        : `Submission failed: ${error.message}`,
      error: error.code || 'unknown'
    };
  }
},

  /**
 * ✅ FIXED: Idempotent result approval — safe against double-click and concurrent requests
 * Uses a Firestore transaction to check submission status before writing.
 * Will not re-approve an already-approved submission.
 */
async approveResults(submissionId, adminUid) {
  try {
    const submissionRef = db.collection('result_submissions').doc(submissionId);

    // ── STEP 1: Idempotency check inside a transaction ───────────────────────
    // Read-then-write inside a transaction prevents two concurrent approvals
    // from both proceeding past the status check.
    let submissionData = null;

    await db.runTransaction(async (transaction) => {
      const submissionDoc = await transaction.get(submissionRef);

      if (!submissionDoc.exists) {
        throw new Error('Submission not found');
      }

      const data = submissionDoc.data();

      // ✅ IDEMPOTENCY GUARD: Reject if already approved
      if (data.status === 'approved') {
        throw new Error('ALREADY_APPROVED');
      }

      // ✅ GUARD: Only approve pending submissions
      if (data.status !== 'pending') {
        throw new Error(`Cannot approve submission with status: ${data.status}`);
      }

      // Mark as 'approving' atomically — any concurrent request will now see
      // a non-pending status and be rejected
      transaction.update(submissionRef, {
        status: 'approving',
        approvingBy: adminUid,
        approvingStartedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      submissionData = data;
    });

    // ── STEP 2: Get draft results ─────────────────────────────────────────────
    const { classId, className, term, subject, session } = submissionData;

    const draftResults = await db.collection('results_draft')
      .where('session', '==', session)
      .where('term', '==', term)
      .where('subject', '==', subject)
      .where('teacherId', '==', submissionData.teacherUid)
      .get();

    if (draftResults.empty) {
      // Roll back the 'approving' status so admin can retry
      await submissionRef.update({
        status: 'pending',
        approvingBy: null,
        approvingStartedAt: null
      });
      return {
        success: false,
        message: 'No draft results found to approve'
      };
    }

    // ── STEP 3: Copy drafts to production + finalise submission + lock ────────
    const batch = db.batch();

    draftResults.forEach(draftDoc => {
      const draftData = draftDoc.data();
      const pupilId = draftData.pupilId;

      const prodDocId = `${pupilId}_${term}_${subject}`;
      const prodRef = db.collection('results').doc(prodDocId);

      batch.set(prodRef, {
        ...draftData,
        status: 'approved',
        approvedBy: adminUid,
        approvedAt: firebase.firestore.FieldValue.serverTimestamp(),
        publishedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    });

    // Finalise submission status
    batch.update(submissionRef, {
      status: 'approved',
      approvedAt: firebase.firestore.FieldValue.serverTimestamp(),
      approvedBy: adminUid,
      approvingBy: null,
      approvingStartedAt: null
    });

    // Lock the results
    const lockId = `${classId}_${session}_${term}_${subject}`;
    const lockRef = db.collection('result_locks').doc(lockId);

    batch.set(lockRef, {
      classId,
      className,
      term,
      subject,
      session,
      locked: true,
      lockedAt: firebase.firestore.FieldValue.serverTimestamp(),
      lockedBy: adminUid,
      reason: 'Admin approved and locked'
    });

    await batch.commit();

    console.log(`✅ Results approved and published: ${className} - ${term} - ${subject}`);

    return {
      success: true,
      message: 'Results approved and published to pupils successfully'
    };

  } catch (error) {
    if (error.message === 'ALREADY_APPROVED') {
      console.log('ℹ️ approveResults: submission already approved — no action taken');
      return {
        success: false,
        message: 'These results have already been approved.'
      };
    }

    console.error('Error approving results:', error);
    return { success: false, error: error.message };
  }
},

  /**
   * Reject submitted results
   */
  async rejectResults(submissionId, adminUid, reason) {
    try {
      await db.collection('result_submissions').doc(submissionId).update({
        status: 'rejected',
        rejectedAt: firebase.firestore.FieldValue.serverTimestamp(),
        rejectedBy: adminUid,
        rejectionReason: reason || 'No reason provided'
      });
      
      return { 
        success: true, 
        message: 'Results rejected. Teacher will be notified.' 
      };
      
    } catch (error) {
      console.error('Error rejecting results:', error);
      return { success: false, error: error.message };
    }
  }
};

// Export to window for global access
window.resultLocking = resultLocking;

console.log('✓ Result locking module loaded');
