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
const DEFAULT_CLASS_HIERARCHY = {
  nursery: [],
  kindergarten: [],
  primary: []
};

/**
 * Get the complete class hierarchy from Firestore
 * Falls back to default if not found
 */
async function getClassHierarchy() {
  try {
    const doc = await db.collection('settings').doc('classHierarchy').get();
    
    if (doc.exists) {
      return doc.data().hierarchy || DEFAULT_CLASS_HIERARCHY;
    }
    
    return DEFAULT_CLASS_HIERARCHY;
  } catch (error) {
    console.error('Error loading class hierarchy:', error);
    return DEFAULT_CLASS_HIERARCHY;
  }
}

/**
 * Get all classes in order (nursery first, then primary)
 */
function getAllClassesInOrder(hierarchy) {
  const allClasses = [];
  
  if (hierarchy.nursery && Array.isArray(hierarchy.nursery)) {
    allClasses.push(...hierarchy.nursery);
  }
  
  if (hierarchy.primary && Array.isArray(hierarchy.primary)) {
    allClasses.push(...hierarchy.primary);
  }
  
  return allClasses;
}

/**
 * Get the next class in progression
 * @param {string} currentClassName - Current class name (e.g., "Primary 3")
 * @returns {string|null} - Next class name or null if terminal class
 */
async function getNextClass(currentClassName) {
  try {
    const hierarchy = await getClassHierarchy();
    const allClasses = getAllClassesInOrder(hierarchy);
    
    const currentIndex = allClasses.indexOf(currentClassName);
    
    if (currentIndex === -1) {
      console.warn(`Class "${currentClassName}" not found in hierarchy`);
      return null;
    }
    
    if (currentIndex === allClasses.length - 1) {
      // Terminal class (last class)
      return null;
    }
    
    return allClasses[currentIndex + 1];
  } catch (error) {
    console.error('Error getting next class:', error);
    return null;
  }
}

/**
 * Check if a class is the terminal class (Primary 6)
 * @param {string} className - Class name to check
 * @returns {boolean} - True if terminal class
 */
async function isTerminalClass(className) {
  try {
    const hierarchy = await getClassHierarchy();
    const allClasses = getAllClassesInOrder(hierarchy);
    
    return allClasses.indexOf(className) === allClasses.length - 1;
  } catch (error) {
    console.error('Error checking terminal class:', error);
    return false;
  }
}

/**
 * Get the grade level number for a class
 * @param {string} className - Class name
 * @returns {number} - Grade level (1-8, where Nursery 1 = 1, Primary 6 = 8)
 */
async function getGradeLevel(className) {
  try {
    const hierarchy = await getClassHierarchy();
    const allClasses = getAllClassesInOrder(hierarchy);
    
    const index = allClasses.indexOf(className);
    return index === -1 ? 0 : index + 1;
  } catch (error) {
    console.error('Error getting grade level:', error);
    return 0;
  }
}

/**
 * Save class hierarchy to Firestore
 * @param {object} hierarchy - Hierarchy object with nursery and primary arrays
 */
async function saveClassHierarchy(hierarchy) {
  try {
    await db.collection('settings').doc('classHierarchy').set({
      hierarchy,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    return { success: true };
  } catch (error) {
    console.error('Error saving class hierarchy:', error);
    return { success: false, error };
  }
}

/**
 * Initialize class hierarchy if it doesn't exist
 * Does NOT auto-create - admin must configure manually
 */
async function initializeClassHierarchy() {
  try {
    const doc = await db.collection('settings').doc('classHierarchy').get();
    
    if (!doc.exists) {
      console.log('⚠️ Class hierarchy not configured. Admin must set it up in School Settings.');
      // Create empty structure only
      await db.collection('settings').doc('classHierarchy').set({
        hierarchy: DEFAULT_CLASS_HIERARCHY,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }
  } catch (error) {
    console.error('Error checking class hierarchy:', error);
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
  initializeClassHierarchy,
  DEFAULT_CLASS_HIERARCHY
};

console.log('✓ Class Hierarchy module loaded');
