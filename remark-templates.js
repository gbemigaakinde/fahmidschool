/**
 * FAHMID NURSERY & PRIMARY SCHOOL
 * Remark Templates Module
 * Provides pre-written remarks based on performance
 * 
 * @version 1.0.0
 * @date 2026-01-11
 */

'use strict';

const remarkTemplates = {
  /**
   * Template database - organized by performance level
   */
  templates: {
    excellent: [
      "Excellent performance! Keep up the outstanding work.",
      "Exceptional academic achievement. Well done!",
      "Outstanding performance across all subjects. Continue to excel.",
      "Remarkable progress shown this term. Keep it up!",
      "Excellent work ethic and academic performance.",
      "Top-notch performance. You're doing brilliantly!",
      "Superb academic results. Keep aiming high!",
      "Outstanding effort and excellent results achieved."
    ],
    
    veryGood: [
      "Very good academic progress shown this term.",
      "Commendable performance. Keep working hard!",
      "Very good results. Continue this excellent effort.",
      "Great improvement noticed. Well done!",
      "Very good work ethic and strong performance.",
      "Impressive results. Keep up the good work!",
      "Very good progress. Continue striving for excellence."
    ],
    
    good: [
      "Good performance overall. Keep pushing yourself.",
      "Good academic progress. You can do even better!",
      "Satisfactory results. More effort needed in some subjects.",
      "Good work shown. Continue to improve.",
      "Good performance. With more focus, you can excel.",
      "Decent results. Keep working to reach your potential.",
      "Good effort shown. Aim higher next term."
    ],
    
    average: [
      "Fair performance. More effort required to improve.",
      "Average results. You need to work harder next term.",
      "Room for improvement in several subjects.",
      "Satisfactory but more dedication is needed.",
      "Average performance. Put in more effort to excel.",
      "You can do better with consistent hard work.",
      "Fair effort shown. Focus more on your studies."
    ],
    
    poor: [
      "Poor performance. Immediate improvement required.",
      "Weak results. You must work much harder next term.",
      "Unsatisfactory performance. Serious effort needed.",
      "Poor academic showing. Commitment to studies is essential.",
      "Results are below expectation. Extra effort urgently needed.",
      "Disappointing performance. You must improve significantly.",
      "Poor results. Meet with teachers to discuss improvement plan."
    ]
  },

  /**
   * Get appropriate template based on average score
   */
  async getTemplateForGrade(averageScore) {
    let category = 'average';
    
    if (averageScore >= 75) {
      category = 'excellent';
    } else if (averageScore >= 65) {
      category = 'veryGood';
    } else if (averageScore >= 50) {
      category = 'good';
    } else if (averageScore >= 40) {
      category = 'average';
    } else {
      category = 'poor';
    }
    
    return {
      category,
      templates: this.templates[category] || []
    };
  },

  /**
   * Calculate pupil's average for current term
   */
  async calculatePupilAverage(pupilId, term) {
    try {
      const settings = await window.getCurrentSettings();
      const session = settings.session;
      
      const resultsSnap = await db.collection('results')
        .where('pupilId', '==', pupilId)
        .where('term', '==', term)
        .where('session', '==', session)
        .get();
      
      if (resultsSnap.empty) {
        return { average: 0, subjectCount: 0 };
      }
      
      let totalScore = 0;
      let subjectCount = 0;
      
      resultsSnap.forEach(doc => {
        const data = doc.data();
        const ca = parseFloat(data.caScore) || 0;
        const exam = parseFloat(data.examScore) || 0;
        totalScore += (ca + exam);
        subjectCount++;
      });
      
      const average = subjectCount > 0 ? totalScore / subjectCount : 0;
      
      return { average, subjectCount };
      
    } catch (error) {
      console.error('Error calculating average:', error);
      return { average: 0, subjectCount: 0 };
    }
  },

  /**
   * Get remark suggestions for a specific pupil
   */
  async getRemarkSuggestions(pupilId, term) {
    try {
      const { average, subjectCount } = await this.calculatePupilAverage(pupilId, term);
      
      if (subjectCount === 0) {
        return {
          success: false,
          message: 'No results found for this pupil in selected term',
          templates: []
        };
      }
      
      const { category, templates } = await this.getTemplateForGrade(average);
      
      return {
        success: true,
        average: average.toFixed(1),
        category,
        templates
      };
      
    } catch (error) {
      console.error('Error getting suggestions:', error);
      return {
        success: false,
        message: 'Failed to load suggestions',
        templates: []
      };
    }
  },

  /**
   * Save custom template (admin only)
   */
  async saveCustomTemplate(template, category) {
    try {
      if (!['excellent', 'veryGood', 'good', 'average', 'poor'].includes(category)) {
        return { success: false, message: 'Invalid category' };
      }
      
      await db.collection('custom_remark_templates').add({
        template,
        category,
        createdBy: auth.currentUser.uid,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        isActive: true
      });
      
      return { success: true, message: 'Custom template saved' };
      
    } catch (error) {
      console.error('Error saving template:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Load custom templates and merge with defaults
   */
  async loadAllTemplates() {
    try {
      const customSnap = await db.collection('custom_remark_templates')
        .where('isActive', '==', true)
        .get();
      
      const allTemplates = { ...this.templates };
      
      customSnap.forEach(doc => {
        const data = doc.data();
        if (allTemplates[data.category]) {
          allTemplates[data.category].push(data.template);
        }
      });
      
      return allTemplates;
      
    } catch (error) {
      console.error('Error loading templates:', error);
      return this.templates;
    }
  }
};

// Export to window for global access
window.remarkTemplates = remarkTemplates;

console.log('✓ Remark templates module loaded');
