/**
 * FAHMID NURSERY & PRIMARY SCHOOL
 * Service Worker - Offline Support
 * 
 * Purpose: Enable offline functionality and improve performance
 * 
 * @version 1.0.0
 * @date 2026-01-11
 */

'use strict';

const CACHE_NAME = 'fahmid-school-v1.0.0';
const OFFLINE_PAGE = '/offline.html';

// Assets to cache immediately on install
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/login.html',
  '/styles.css',
  '/script.js',
  '/firebase-init.js',
  '/IMG_4628.jpeg', // School logo
  OFFLINE_PAGE
];

// Assets to cache on first use
const RUNTIME_CACHE = [
  '/portal.html',
  '/admin.html',
  '/teacher.html',
  '/pupil.html',
  '/print-results.html',
  '/admin.js',
  '/teacher.js',
  '/pupil.js',
  '/print-results.js',
  '/class-hierarchy.js',
  '/pupils-export.js'
];

/**
 * Install Event - Cache critical assets
 */
self.addEventListener('install', event => {
  console.log('[Service Worker] Installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Precaching critical assets');
        return cache.addAll(PRECACHE_ASSETS);
      })
      .then(() => self.skipWaiting())
      .catch(error => {
        console.error('[Service Worker] Precaching failed:', error);
      })
  );
});

/**
 * Activate Event - Clean up old caches
 */
self.addEventListener('activate', event => {
  console.log('[Service Worker] Activating...');
  
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== CACHE_NAME) {
              console.log('[Service Worker] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

/**
 * Fetch Event - Network-first with cache fallback
 */
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') return;
  
  // Skip Firebase and external requests
  if (
    url.origin.includes('firebasestorage.googleapis.com') ||
    url.origin.includes('firebaseapp.com') ||
    url.origin.includes('googleapis.com') ||
    url.origin.includes('gstatic.com') ||
    url.origin.includes('cdnjs.cloudflare.com')
  ) {
    return;
  }
  
  // Network-first strategy for HTML pages
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Clone and cache successful responses
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Fallback to cache
          return caches.match(request)
            .then(cachedResponse => {
              if (cachedResponse) {
                return cachedResponse;
              }
              // Show offline page as last resort
              return caches.match(OFFLINE_PAGE);
            });
        })
    );
    return;
  }
  
  // Cache-first strategy for static assets (CSS, JS, images)
  if (
    request.url.endsWith('.css') ||
    request.url.endsWith('.js') ||
    request.url.endsWith('.jpeg') ||
    request.url.endsWith('.jpg') ||
    request.url.endsWith('.svg')
  ) {
    event.respondWith(
      caches.match(request)
        .then(cachedResponse => {
          if (cachedResponse) {
            // Return cached version and update in background
            fetch(request).then(response => {
              if (response.ok) {
                caches.open(CACHE_NAME).then(cache => {
                  cache.put(request, response);
                });
              }
            }).catch(() => {});
            
            return cachedResponse;
          }
          
          // Not in cache, fetch from network
          return fetch(request).then(response => {
            if (response.ok) {
              const responseClone = response.clone();
              caches.open(CACHE_NAME).then(cache => {
                cache.put(request, responseClone);
              });
            }
            return response;
          });
        })
    );
    return;
  }
  
  // Network-only for everything else (API calls, etc.)
});

/**
 * Background Sync - Queue failed requests
 */
self.addEventListener('sync', event => {
  console.log('[Service Worker] Background sync:', event.tag);
  
  if (event.tag === 'sync-data') {
    event.waitUntil(
      // Implement your sync logic here
      syncPendingData()
    );
  }
});

async function syncPendingData() {
  // This would sync any pending data when connection is restored
  console.log('[Service Worker] Syncing pending data...');
  // Implementation depends on your specific needs
}

/**
 * Push Notifications (future feature)
 */
self.addEventListener('push', event => {
  console.log('[Service Worker] Push received');
  
  const options = {
    body: event.data ? event.data.text() : 'New notification',
    icon: '/IMG_4628.jpeg',
    badge: '/IMG_4628.jpeg',
    vibrate: [200, 100, 200]
  };
  
  event.waitUntil(
    self.registration.showNotification('Fahmid School', options)
  );
});

console.log('[Service Worker] Loaded');