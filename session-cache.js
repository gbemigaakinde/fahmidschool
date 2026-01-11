/**
 * FAHMID NURSERY & PRIMARY SCHOOL
 * Session Cache Manager - Optimization Module
 * 
 * Purpose: Reduce Firestore reads by caching session data
 * 
 * @version 1.0.0
 * @date 2026-01-11
 */

'use strict';

/**
 * Session Cache Manager
 * Caches session data to reduce repeated Firestore queries
 */
window.SessionCache = (function() {
  // Private cache storage
  let cache = {
    settings: null,
    sessions: null,
    lastFetch: {
      settings: null,
      sessions: null
    }
  };
  
  const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  
  /**
   * Check if cache is still valid
   */
  function isCacheValid(type) {
    if (!cache.lastFetch[type]) return false;
    const elapsed = Date.now() - cache.lastFetch[type];
    return elapsed < CACHE_DURATION;
  }
  
  /**
   * Get current settings with caching
   */
  async function getSettings(forceRefresh = false) {
    if (!forceRefresh && isCacheValid('settings') && cache.settings) {
      console.log('✓ Using cached settings');
      return cache.settings;
    }
    
    console.log('⟳ Fetching fresh settings from Firestore');
    
    try {
      const settingsDoc = await window.db.collection('settings').doc('current').get();
      
      if (settingsDoc.exists) {
        const data = settingsDoc.data();
        
        // Extract session info properly
        let sessionName = '2025/2026';
        let sessionData = null;

        if (data.currentSession && typeof data.currentSession === 'object') {
          sessionName = data.currentSession.name || 
                       `${data.currentSession.startYear}/${data.currentSession.endYear}`;
          sessionData = data.currentSession;
        } else if (data.session) {
          sessionName = data.session;
        }

        // Build complete settings object
        cache.settings = {
          term: data.term || 'First Term',
          session: sessionName,
          currentSession: sessionData,
          resumptionDate: data.resumptionDate || null,
          promotionPeriodActive: data.promotionPeriodActive || false
        };
        
        cache.lastFetch.settings = Date.now();
        
        console.log('✓ Settings cached:', cache.settings);
        return cache.settings;
      }
      
      // Return defaults if no settings exist
      const defaults = {
        term: 'First Term',
        session: '2025/2026',
        currentSession: null,
        resumptionDate: null,
        promotionPeriodActive: false
      };
      
      cache.settings = defaults;
      cache.lastFetch.settings = Date.now();
      
      return defaults;
      
    } catch (error) {
      console.error('Error fetching settings:', error);
      
      // Return cached data if available, even if expired
      if (cache.settings) {
        console.warn('Using stale cache due to error');
        return cache.settings;
      }
      
      // Return defaults as last resort
      return {
        term: 'First Term',
        session: '2025/2026',
        currentSession: null,
        resumptionDate: null,
        promotionPeriodActive: false
      };
    }
  }
  
  /**
   * Get all sessions (current + archived) with caching
   */
  async function getAllSessions(forceRefresh = false) {
    if (!forceRefresh && isCacheValid('sessions') && cache.sessions) {
      console.log('✓ Using cached sessions');
      return cache.sessions;
    }
    
    console.log('⟳ Fetching sessions from Firestore');
    
    try {
      const settings = await getSettings();
      const currentSession = settings.session;
      
      // Get archived sessions
      const sessionsSnap = await window.db.collection('sessions')
        .orderBy('startYear', 'desc')
        .get();
      
      const sessions = [{
        value: 'current',
        label: `Current Session (${currentSession})`,
        name: currentSession,
        isCurrent: true
      }];
      
      sessionsSnap.forEach(doc => {
        const data = doc.data();
        sessions.push({
          value: data.name,
          label: `${data.name} Session`,
          name: data.name,
          isCurrent: false
        });
      });
      
      cache.sessions = sessions;
      cache.lastFetch.sessions = Date.now();
      
      console.log(`✓ Cached ${sessions.length} sessions`);
      return sessions;
      
    } catch (error) {
      console.error('Error fetching sessions:', error);
      
      // Return cached data if available
      if (cache.sessions) {
        console.warn('Using stale session cache due to error');
        return cache.sessions;
      }
      
      // Return minimal default
      const settings = await getSettings();
      return [{
        value: 'current',
        label: `Current Session (${settings.session})`,
        name: settings.session,
        isCurrent: true
      }];
    }
  }
  
  /**
   * Clear cache (useful when admin updates settings)
   */
  function clearCache(type = 'all') {
    if (type === 'all' || type === 'settings') {
      cache.settings = null;
      cache.lastFetch.settings = null;
      console.log('✓ Settings cache cleared');
    }
    
    if (type === 'all' || type === 'sessions') {
      cache.sessions = null;
      cache.lastFetch.sessions = null;
      console.log('✓ Sessions cache cleared');
    }
  }
  
  /**
   * Get cache status (for debugging)
   */
  function getStatus() {
    return {
      settings: {
        cached: !!cache.settings,
        valid: isCacheValid('settings'),
        lastFetch: cache.lastFetch.settings ? new Date(cache.lastFetch.settings) : null
      },
      sessions: {
        cached: !!cache.sessions,
        valid: isCacheValid('sessions'),
        count: cache.sessions?.length || 0,
        lastFetch: cache.lastFetch.sessions ? new Date(cache.lastFetch.sessions) : null
      }
    };
  }
  
  // Public API
  return {
    getSettings,
    getAllSessions,
    clearCache,
    getStatus
  };
})();

/**
 * Override the original getCurrentSettings to use cache
 */
window.getCurrentSettings = window.SessionCache.getSettings;

console.log('✓ Session cache manager loaded');