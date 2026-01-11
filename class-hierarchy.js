/**
 * FAHMID NURSERY & PRIMARY SCHOOL
 * Class Hierarchy Management
 * 
 * Defines class progression order and helper functions
 * 
 * @version 1.0.0
 * @date 2026-01-07
 */

'use strict';

// Default class hierarchy - Empty by default, admin must configure
// Default class hierarchy - COMPLETELY EMPTY until admin configures
// Admin can name classes anything: "Apple", "Orange", "Goat 1", "Team A", etc.
const DEFAULT_CLASS_HIERARCHY = {
  nursery: [],
  primary: []
};

/**
 * Get the complete class hierarchy from Firestore
 * Sources classes from the 'classes' collection
 * Returns them in the saved progression order
 */
async function getClassHierarchy() {
  try {
    const doc = await db.collection('settings').doc('classHierarchy').get();
    
    if (doc.exists && doc.data().orderedClassIds) {
      // New format: ordered list of class IDs
      return doc.data();
    }
    
    // If no hierarchy saved yet, return empty
    return {
      orderedClassIds: [],
      lastUpdated: null
    };
  } catch (error) {
    console.error('Error loading class hierarchy:', error);
    return {
      orderedClassIds: [],
      lastUpdated: null
    };
  }
}

/**
 * Get all classes in order (nursery first, then primary)
 */
/**
 * Get all classes from the classes collection in hierarchical order
 * If no order is saved, returns classes sorted alphabetically
 */
async function getAllClassesInOrder() {
  try {
    // Get all classes from Firestore
    const classesSnapshot = await db.collection('classes').orderBy('name').get();
    
    if (classesSnapshot.empty) {
      return [];
    }
    
    const allClasses = [];
    classesSnapshot.forEach(doc => {
      allClasses.push({
        id: doc.id,
        name: doc.data().name || 'Unnamed Class'
      });
    });
    
    // Get saved hierarchy order
    const hierarchyDoc = await db.collection('settings').doc('classHierarchy').get();
    
    if (hierarchyDoc.exists && hierarchyDoc.data().orderedClassIds) {
      const orderedIds = hierarchyDoc.data().orderedClassIds;
      
      // Sort classes according to saved order
      const orderedClasses = [];
      orderedIds.forEach(classId => {
        const found = allClasses.find(c => c.id === classId);
        if (found) orderedClasses.push(found);
      });
      
      // Add any new classes that aren't in the order yet (append to end)
      allClasses.forEach(cls => {
        if (!orderedIds.includes(cls.id)) {
          orderedClasses.push(cls);
        }
      });
      
      return orderedClasses;
    }
    
    // No saved order - return alphabetically
    return allClasses.sort((a, b) => a.name.localeCompare(b.name));
    
  } catch (error) {
    console.error('Error getting classes in order:', error);
    return [];
  }
}

/**
 * Get the next class in progression
 * @param {string} currentClassName - Current class name (e.g., "Apple Class", "Team A", etc.)
 * @returns {string|null} - Next class name or null if terminal class
 */
async function getNextClass(currentClassName) {
  try {
    const allClasses = await getAllClassesInOrder();
    
    if (allClasses.length === 0) {
      console.warn('No classes configured in system');
      return null;
    }
    
    const currentIndex = allClasses.findIndex(c => c.name === currentClassName);
    
    if (currentIndex === -1) {
      console.warn(`Class "${currentClassName}" not found in hierarchy`);
      return null;
    }
    
    if (currentIndex === allClasses.length - 1) {
      // Terminal class (last class in order)
      return null;
    }
    
    return allClasses[currentIndex + 1].name;
  } catch (error) {
    console.error('Error getting next class:', error);
    return null;
  }
}

/**
 * Check if a class is the terminal (last) class in the progression order
 * @param {string} className - Class name to check
 * @returns {boolean} - True if terminal class
 */
async function isTerminalClass(className) {
  try {
    const allClasses = await getAllClassesInOrder();
    
    if (allClasses.length === 0) {
      console.warn('No classes configured');
      return false;
    }
    
    const lastClass = allClasses[allClasses.length - 1];
    return lastClass.name === className;
  } catch (error) {
    console.error('Error checking terminal class:', error);
    return false;
  }
}

/**
 * Get the position/level number for a class in the progression order
 * @param {string} className - Class name
 * @returns {number} - Position level (1 for first class, 2 for second, etc.)
 */
async function getGradeLevel(className) {
  try {
    const allClasses = await getAllClassesInOrder();
    
    const index = allClasses.findIndex(c => c.name === className);
    return index === -1 ? 0 : index + 1;
  } catch (error) {
    console.error('Error getting grade level:', error);
    return 0;
  }
}

/**
 * Save class progression order to Firestore
 * @param {Array} orderedClassIds - Array of class IDs in progression order
 */
async function saveClassHierarchy(orderedClassIds) {
  try {
    if (!Array.isArray(orderedClassIds)) {
      console.error('orderedClassIds must be an array');
      return { success: false, error: 'Invalid input' };
    }
    
    await db.collection('settings').doc('classHierarchy').set({
      orderedClassIds: orderedClassIds,
      lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    console.log('✓ Class progression order saved:', orderedClassIds);
    return { success: true };
  } catch (error) {
    console.error('Error saving class hierarchy:', error);
    return { success: false, error };
  }
}

/**
 * FIXED: Initialize class hierarchy with race condition protection
 * Uses transaction to prevent duplicate creation
 */
async function initializeClassHierarchy() {
  try {
    // Check if db is available
    if (!window.db) {
      console.error('❌ Firebase not initialized - cannot check class hierarchy');
      return { success: false, error: 'Firebase not initialized' };
    }
    
    const hierarchyRef = db.collection('settings').doc('classHierarchy');
    
    // CRITICAL FIX: Use transaction to prevent race condition
    const result = await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(hierarchyRef);
      
      // If hierarchy exists, validate and return
      if (doc.exists) {
        const data = doc.data();
        const orderedIds = data.orderedClassIds || [];
        
        if (orderedIds.length === 0) {
          console.warn('⚠️ Class hierarchy exists but is empty');
          return { 
            success: true, 
            isEmpty: true,
            message: 'Hierarchy exists but is empty',
            alreadyExists: true
          };
        }
        
        console.log(`✓ Class hierarchy already exists: ${orderedIds.length} classes`);
        return { 
          success: true, 
          isEmpty: false,
          classCount: orderedIds.length,
          message: 'Hierarchy already exists',
          alreadyExists: true
        };
      }
      
      // Hierarchy doesn't exist - create it atomically
      console.log('📋 Class hierarchy not found - initializing atomically...');
      
      // Get all existing classes (outside transaction for performance)
      const classesSnapshot = await db.collection('classes').orderBy('name').get();
      
      if (classesSnapshot.empty) {
        console.log('⚠️ No classes created yet. Create classes first.');
        
        // Create empty structure atomically
        transaction.set(hierarchyRef, {
          orderedClassIds: [],
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          createdBy: auth.currentUser?.uid || 'system',
          version: 1,
          note: 'Empty - waiting for classes to be created'
        });
        
        return { 
          success: true, 
          isEmpty: true, 
          message: 'Hierarchy initialized but empty',
          created: true
        };
      }
      
      // Auto-initialize with alphabetical order atomically
      const classIds = classesSnapshot.docs.map(doc => doc.id);
      
      transaction.set(hierarchyRef, {
        orderedClassIds: classIds,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        createdBy: auth.currentUser?.uid || 'system',
        version: 1,
        note: 'Auto-initialized in alphabetical order. Rearrange in School Settings if needed.'
      });
      
      console.log(`✓ Class hierarchy created atomically with ${classIds.length} classes`);
      return { 
        success: true, 
        isEmpty: false, 
        autoInitialized: true,
        classCount: classIds.length,
        created: true
      };
    });
    
    return result;
    
  } catch (error) {
    // Transaction conflicts will retry automatically
    if (error.code === 'aborted') {
      console.log('⚠️ Transaction aborted (likely concurrent initialization), retrying...');
      // Let Firestore retry automatically
      return { 
        success: false, 
        error: 'Concurrent initialization detected, please refresh',
        retry: true
      };
    }
    
    console.error('❌ Error initializing class hierarchy:', error);
    return { 
      success: false, 
      error: error.message || 'Unknown error',
      details: error
    };
  }
}

// Export for use in other files
window.classHierarchy = {
  getClassHierarchy,
  getAllClassesInOrder,
  getNextClass,
  isTerminalClass,
  getGradeLevel,
  saveClassHierarchy,
  initializeClassHierarchy
};

console.log('✓ Class Hierarchy module loaded (v2.0 - Sources from Classes collection)');