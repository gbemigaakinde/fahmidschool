/**
 * FAHMID NURSERY & PRIMARY SCHOOL
 * Remark Templates Module
 * Provides pre-written remarks based on performance
 *
 * @version 5.0.0
 * @date 2026-05-17
 */

'use strict';

const remarkTemplates = {

  /**
   * Fetch pupil's first name and gender pronouns from Firestore.
   * Returns { firstName, pronoun, possessive }
   * e.g. { firstName: 'Amina', pronoun: 'She', possessive: 'Her' }
   */
  async getPupilTokens(pupilId) {
    try {
      const doc = await db.collection('pupils').doc(pupilId).get();
      if (!doc.exists) return { firstName: '', pronoun: 'They', possessive: 'Their' };

      const data      = doc.data();
      const fullName  = (data.name || '').trim();
      const firstName = fullName.split(' ')[0] || '';
      const gender    = (data.gender || '').toLowerCase();

      let pronoun    = 'They';
      let possessive = 'Their';

      if (gender === 'male' || gender === 'boy' || gender === 'm') {
        pronoun    = 'He';
        possessive = 'His';
      } else if (gender === 'female' || gender === 'girl' || gender === 'f') {
        pronoun    = 'She';
        possessive = 'Her';
      }

      return { firstName, pronoun, possessive };

    } catch (error) {
      console.error('Error fetching pupil tokens:', error);
      return { firstName: '', pronoun: 'They', possessive: 'Their' };
    }
  },

  /**
   * Replace {name}, {pronoun}, {possessive} in a template string.
   */
  inject(template, tokens) {
    return template
      .replace(/\{name\}/g,       tokens.firstName  || 'This pupil')
      .replace(/\{pronoun\}/g,    tokens.pronoun    || 'They')
      .replace(/\{possessive\}/g, tokens.possessive || 'Their');
  },

  /**
   * Teacher remark templates.
   *
   * Mixing rules applied:
   * - Some start with {name}
   * - Some start with {pronoun} directly (no name)
   * - Some start with a neutral phrase (no name, no pronoun)
   *
   * {name}       → pupil's first name
   * {pronoun}    → He / She / They
   * {possessive} → His / Her / Their
   */
  templates: {
    excellent: [
      "{name} has shown an excellent performance this term. {pronoun} should keep it up!",
      "{pronoun} has excelled across all subjects this term. {possessive} dedication is truly commendable.",
      "An outstanding performance this term. {name} has demonstrated great ability and commitment.",
      "{name} has produced exceptional results. {pronoun} is clearly putting in excellent effort.",
      "Excellent work this term. {possessive} results reflect hard work and a strong attitude to learning.",
      "{pronoun} has performed brilliantly and should be very proud of {possessive} achievement this term.",
      "A remarkable performance all round. {name} should continue to aim high next term."
    ],

    veryGood: [
      "{name} has shown very good academic progress this term. {pronoun} should keep working hard.",
      "{pronoun} has achieved commendable results this term. {possessive} effort is noted and appreciated.",
      "A very good performance this term. With continued effort, {name} can reach even greater heights.",
      "{name} has shown great improvement this term and should maintain this positive momentum.",
      "Very good results achieved this term. {pronoun} is encouraged to keep striving for more.",
      "{possessive} commitment to learning has been strong this term. Well done!",
      "{pronoun} has performed very well and is encouraged to push for excellence next term."
    ],

    good: [
      "{name} has shown a good performance this term but can achieve even more with greater effort.",
      "{pronoun} has made good academic progress this term. More focus will improve outcomes further.",
      "A satisfactory performance overall. {name} is encouraged to keep pushing {possessive} limits.",
      "{pronoun} has done well this term and should continue working towards {possessive} full potential.",
      "Good effort shown this term. With more consistency, better results will surely follow.",
      "{name} has performed reasonably well. {pronoun} is encouraged to aim higher next term.",
      "A decent showing this term. Greater dedication in all subjects will lead to much better results."
    ],

    average: [
      "{name} has shown a fair performance this term. More effort is needed to improve.",
      "{pronoun} has achieved average results and must work harder and more consistently next term.",
      "There is clear room for improvement in several subjects. {name} is capable of doing better.",
      "{pronoun} needs to be more focused and disciplined in {possessive} studies going forward.",
      "A fair effort this term, but greater dedication and consistency are expected next term.",
      "{name} can do better with sustained hard work. {pronoun} is encouraged to seek help where needed.",
      "Average performance this term. {possessive} full potential has not yet been reached."
    ],

    poor: [
      "{name} has shown a poor performance this term. Immediate and serious improvement is required.",
      "{pronoun} has achieved weak results this term and must commit to working much harder next term.",
      "An unsatisfactory performance overall. {name} must be more serious about {possessive} studies.",
      "{pronoun} has not met academic expectations this term. Greater effort and focus are urgently needed.",
      "These results are a cause for concern. {possessive} commitment to studies must improve significantly.",
      "{name} is advised to seek help from teachers and to dedicate more time to studying.",
      "A disappointing performance this term. {pronoun} must make a strong commitment to improve next term."
    ]
  },

  /**
   * Head teacher remark templates.
   *
   * Same mixing rules — more formal and authoritative in tone.
   */
  headTemplates: {
    excellent: [
      "{name} has delivered a truly outstanding performance this term. We are very proud of {possessive} achievement.",
      "{pronoun} has excelled academically and shown exceptional dedication. A credit to this school.",
      "An exceptional performance this term. {name} has set a high standard that we encourage {pronoun} to maintain.",
      "{pronoun} has produced brilliant results and we commend {possessive} hard work and commitment to excellence.",
      "Outstanding academic achievement this term. {name} should be very proud of what {pronoun} has accomplished.",
      "We are proud of the excellent results recorded this term. {pronoun} should keep up this great work."
    ],

    veryGood: [
      "{name} has delivered a very good performance this term. We encourage {pronoun} to keep pushing for excellence.",
      "{pronoun} has shown strong commitment to learning this term and the results clearly reflect that.",
      "A very good performance overall. {name} has made us proud and we encourage continued hard work.",
      "{pronoun} has put in a solid effort this term. With sustained commitment, even greater results await.",
      "Very good results this term. {name} should be proud and continue striving for the very best.",
      "We are pleased with {possessive} progress this term and encourage {pronoun} to aim even higher next term."
    ],

    good: [
      "{name} has shown a good performance this term. We encourage {pronoun} to put in greater effort to excel.",
      "{pronoun} has achieved satisfactory results. We urge more focus and dedication next term.",
      "A fair performance this term. {name} has potential for much better results with greater effort.",
      "Good effort shown this term. We encourage {pronoun} to seek help wherever it is needed.",
      "{pronoun} has done reasonably well. We expect to see greater improvement in the coming term.",
      "{name} has achieved a satisfactory result. We urge {pronoun} to give {possessive} very best next term."
    ],

    average: [
      "{name} has shown an average performance this term. We strongly encourage greater effort next term.",
      "{pronoun} is capable of much better than these results suggest. More dedication is urgently needed.",
      "A fair result, but there is clear room for improvement. {name} must commit more fully to {possessive} studies.",
      "We encourage {pronoun} to seek extra help and study harder for better results next term.",
      "{possessive} full potential has not been reached this term. We know {pronoun} can do better.",
      "{name}'s performance is below our expectations. We urge both parents and pupil to work together for improvement."
    ],

    poor: [
      "{name} has produced a performance that is below expectation. We urge immediate improvement and parental support.",
      "{pronoun} has shown a disappointing result this term. Urgent action is required from both pupil and parents.",
      "We are concerned about the results recorded this term. {name} must take {possessive} studies far more seriously.",
      "An unsatisfactory performance overall. We call for a meeting with parents to discuss a clear way forward.",
      "{pronoun} must commit more fully to {possessive} academic work. This level of performance cannot continue.",
      "{name} must work very hard next term without fail. We urge full commitment and strong parental support."
    ]
  },

  /**
   * Get the performance category based on average score
   */
  getCategoryFromScore(averageScore) {
    if (averageScore >= 75) return 'excellent';
    if (averageScore >= 65) return 'veryGood';
    if (averageScore >= 50) return 'good';
    if (averageScore >= 40) return 'average';
    return 'poor';
  },

  /**
   * Calculate pupil's average for the current term and session
   */
  async calculatePupilAverage(pupilId, term) {
    try {
      const settings = await window.getCurrentSettings();
      const session   = settings.session;

      const resultsSnap = await db.collection('results')
        .where('pupilId',  '==', pupilId)
        .where('term',     '==', term)
        .where('session',  '==', session)
        .get();

      if (resultsSnap.empty) return { average: 0, subjectCount: 0 };

      let totalScore   = 0;
      let subjectCount = 0;

      resultsSnap.forEach(doc => {
        const data = doc.data();
        const ca   = parseFloat(data.caScore)   || 0;
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
   * Get teacher remark suggestions for a specific pupil
   */
  async getRemarkSuggestions(pupilId, term) {
    try {
      const [{ average, subjectCount }, tokens] = await Promise.all([
        this.calculatePupilAverage(pupilId, term),
        this.getPupilTokens(pupilId)
      ]);

      if (subjectCount === 0) {
        return {
          success:   false,
          message:   'No approved results found for this pupil in the selected term.',
          templates: []
        };
      }

      const category  = this.getCategoryFromScore(average);
      const templates = (this.templates[category] || []).map(t => this.inject(t, tokens));

      return { success: true, average: average.toFixed(1), category, templates };

    } catch (error) {
      console.error('Error getting suggestions:', error);
      return { success: false, message: 'Failed to load suggestions.', templates: [] };
    }
  },

  /**
   * Get head teacher remark suggestions for a specific pupil.
   * Also returns the best auto-selected template (first in the category).
   */
  async getHeadRemarkSuggestions(pupilId, term) {
    try {
      const [{ average, subjectCount }, tokens] = await Promise.all([
        this.calculatePupilAverage(pupilId, term),
        this.getPupilTokens(pupilId)
      ]);

      if (subjectCount === 0) {
        return {
          success:      false,
          message:      'No approved results found for this pupil in the selected term.',
          templates:    [],
          autoSelected: null
        };
      }

      const category  = this.getCategoryFromScore(average);
      const templates = (this.headTemplates[category] || []).map(t => this.inject(t, tokens));

      return {
        success:      true,
        average:      average.toFixed(1),
        category,
        templates,
        autoSelected: templates.length > 0 ? templates[0] : null
      };

    } catch (error) {
      console.error('Error getting head remark suggestions:', error);
      return {
        success:      false,
        message:      'Failed to load suggestions.',
        templates:    [],
        autoSelected: null
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
        isActive:  true
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

window.remarkTemplates = remarkTemplates;

console.log('✓ Remark templates module v5.0.0 loaded');