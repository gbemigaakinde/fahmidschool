// shared/settings.js
// Current settings fetcher and session cache manager (ES Module)

import { db } from '../db.js';

// ============================================
// DEFAULTS
// ============================================

const DEFAULT_SETTINGS = {
  term: 'First Term',
  session: '2025/2026',
  currentSession: {
    name: '2025/2026',
    startYear: 2025,
    endYear: 2026,
    startDate: null,
    endDate: null
  },
  resumptionDate: null,
  promotionPeriodActive: false
};

// ============================================
// CACHE STATE
// ============================================

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

let cache = {
  settings: null,
  sessions: null,
  lastFetch: {
    settings: null,
    sessions: null
  }
};

function isCacheValid(type) {
  if (!cache.lastFetch[type]) return false;
  return (Date.now() - cache.lastFetch[type]) < CACHE_DURATION;
}

// ============================================
// CORE SETTINGS FETCHER (with cache layer)
// ============================================

/**
 * Fetch current school settings from Firestore, with a 5-minute in-memory
 * cache to reduce reads. Pass forceRefresh = true to bypass the cache.
 *
 * This is the single implementation shared by getCurrentSettings() and
 * SessionCache.getSettings() — both are the same function.
 *
 * @param {boolean} [forceRefresh=false]
 * @returns {Promise<object>} Resolved settings object
 */
async function fetchSettings(forceRefresh = false) {
  if (!forceRefresh && isCacheValid('settings') && cache.settings) {
    console.log('✓ Using cached settings');
    return cache.settings;
  }

  console.log('⟳ Fetching fresh settings from Firestore');

  try {
    const settingsDoc = await db.collection('settings').doc('current').get();

    if (!settingsDoc.exists) {
      console.warn('⚠️ Settings document not found, using defaults');
      cache.settings = DEFAULT_SETTINGS;
      cache.lastFetch.settings = Date.now();
      return DEFAULT_SETTINGS;
    }

    const data = settingsDoc.data();

    // Extract session information safely
    let sessionName = DEFAULT_SETTINGS.session;
    let sessionData = DEFAULT_SETTINGS.currentSession;

    if (data.currentSession && typeof data.currentSession === 'object') {
      sessionName = data.currentSession.name ||
                    `${data.currentSession.startYear}/${data.currentSession.endYear}` ||
                    DEFAULT_SETTINGS.session;
      sessionData = {
        name: sessionName,
        startYear: data.currentSession.startYear || DEFAULT_SETTINGS.currentSession.startYear,
        endYear:   data.currentSession.endYear   || DEFAULT_SETTINGS.currentSession.endYear,
        startDate: data.currentSession.startDate || null,
        endDate:   data.currentSession.endDate   || null
      };
    } else if (data.session) {
      sessionName = data.session;
      const yearMatch = data.session.match(/(\d{4})\/(\d{4})/);
      if (yearMatch) {
        sessionData = {
          name:      data.session,
          startYear: parseInt(yearMatch[1]),
          endYear:   parseInt(yearMatch[2]),
          startDate: null,
          endDate:   null
        };
      }
    }

    const settings = {
      term:                 data.term || DEFAULT_SETTINGS.term,
      session:              sessionName,
      currentSession:       sessionData,
      resumptionDate:       data.resumptionDate || null,
      promotionPeriodActive: Boolean(data.promotionPeriodActive)
    };

    cache.settings = settings;
    cache.lastFetch.settings = Date.now();

    console.log('✓ Settings cached:', settings);
    return settings;

  } catch (error) {
    console.error('❌ Error getting settings:', error);

    // Return stale cache if available, otherwise fall back to defaults
    if (cache.settings) {
      console.warn('Using stale settings cache due to error');
      return cache.settings;
    }

    return DEFAULT_SETTINGS;
  }
}

// ============================================
// SESSION LIST FETCHER (with cache layer)
// ============================================

async function fetchAllSessions(forceRefresh = false) {
  if (!forceRefresh && isCacheValid('sessions') && cache.sessions) {
    console.log('✓ Using cached sessions');
    return cache.sessions;
  }

  console.log('⟳ Fetching sessions from Firestore');

  try {
    const settings = await fetchSettings();
    const currentSession = settings.session;

    const sessionsSnap = await db.collection('sessions')
      .orderBy('startYear', 'desc')
      .get();

    const sessions = [{
      value:     'current',
      label:     `Current Session (${currentSession})`,
      name:      currentSession,
      isCurrent: true
    }];

    sessionsSnap.forEach(doc => {
      const data = doc.data();
      sessions.push({
        value:     data.name,
        label:     `${data.name} Session`,
        name:      data.name,
        isCurrent: false
      });
    });

    cache.sessions = sessions;
    cache.lastFetch.sessions = Date.now();

    console.log(`✓ Cached ${sessions.length} sessions`);
    return sessions;

  } catch (error) {
    console.error('Error fetching sessions:', error);

    if (cache.sessions) {
      console.warn('Using stale session cache due to error');
      return cache.sessions;
    }

    // Minimal fallback — re-use already-cached/default settings
    const settings = await fetchSettings();
    return [{
      value:     'current',
      label:     `Current Session (${settings.session})`,
      name:      settings.session,
      isCurrent: true
    }];
  }
}

// ============================================
// PUBLIC EXPORTS
// ============================================

/**
 * SessionCache — public API for settings and session list, both cached.
 */
export const SessionCache = {
  /**
   * Get current school settings (cached).
   * @param {boolean} [forceRefresh=false]
   */
  getSettings: fetchSettings,

  /**
   * Get current + archived sessions list (cached).
   * @param {boolean} [forceRefresh=false]
   */
  getAllSessions: fetchAllSessions,

  /**
   * Invalidate cache entries.
   * @param {'all'|'settings'|'sessions'} [type='all']
   */
  clearCache(type = 'all') {
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
  },

  /**
   * Return cache status (useful for debugging).
   */
  getStatus() {
    return {
      settings: {
        cached:    !!cache.settings,
        valid:     isCacheValid('settings'),
        lastFetch: cache.lastFetch.settings ? new Date(cache.lastFetch.settings) : null
      },
      sessions: {
        cached:    !!cache.sessions,
        valid:     isCacheValid('sessions'),
        count:     cache.sessions?.length || 0,
        lastFetch: cache.lastFetch.sessions ? new Date(cache.lastFetch.sessions) : null
      }
    };
  }
};

/**
 * getCurrentSettings — convenience export that delegates to the cache layer.
 * Identical to SessionCache.getSettings(); exported separately so callers
 * that don't need the full cache API can import just this.
 */
export const getCurrentSettings = fetchSettings;
