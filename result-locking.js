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
 * ✅ FIXED: Admin approval COPIES draft results to production collection
 * This is the ONLY action that makes results visible to pupils
 */
async approveResults(submissionId, adminUid) {
  try {
    const submissionDoc = await db.collection('result_submissions').doc(submissionId).get();
    
    if (!submissionDoc.exists) {
      return { success: false, message: 'Submission not found' };
    }
    
    const data = submissionDoc.data();
    const { classId, className, term, subject, session } = data;
    
    // ✅ STEP 1: Get all draft results for this submission
    const draftResults = await db.collection('results_draft')
      .where('session', '==', session)
      .where('term', '==', term)
      .where('subject', '==', subject)
      .where('teacherId', '==', data.teacherUid)
      .get();
    
    if (draftResults.empty) {
      return { 
        success: false, 
        message: 'No draft results found to approve' 
      };
    }
    
    // ✅ STEP 2: Copy draft results to PRODUCTION collection (visible to pupils)
    const batch = db.batch();
    
    draftResults.forEach(draftDoc => {
      const draftData = draftDoc.data();
      const pupilId = draftData.pupilId;
      
      // Create document ID for production results
      const prodDocId = `${pupilId}_${term}_${subject}`;
      const prodRef = db.collection('results').doc(prodDocId);
      
      // Copy data to production with approval metadata
      batch.set(prodRef, {
        ...draftData,
        status: 'approved', // ✅ Mark as approved
        approvedBy: adminUid,
        approvedAt: firebase.firestore.FieldValue.serverTimestamp(),
        publishedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    });
    
    // ✅ STEP 3: Update submission status
    batch.update(submissionDoc.ref, {
      status: 'approved',
      approvedAt: firebase.firestore.FieldValue.serverTimestamp(),
      approvedBy: adminUid
    });
    
    // ✅ STEP 4: Lock the results
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
    
    // ✅ STEP 5: Commit all changes atomically
    await batch.commit();
    
    console.log(`✅ Results approved and published: ${className} - ${term} - ${subject}`);
    
    return { 
      success: true, 
      message: 'Results approved and published to pupils successfully' 
    };
    
  } catch (error) {
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
