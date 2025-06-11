/**
 * @file Service Worker for Rock Living Water PWA
 * @description Handles caching, offline support, and form syncing
 */

const CACHE_NAME = 'rock-living-water-v5'; // Incremented version
const API_CACHE_NAME = 'rock-api-cache-v2';
const FONT_CACHE_NAME = 'rock-fonts-v2';

// Align with index.js endpoints
const OFFLINE_METRICS_URLS = [
  '/api/generateReports',
  '/api/getSalesRecords',
  '/api/getCustomers',
  '/api/getVendors',
  '/api/getExpensesRecords'
];

const urlsToCache = [
  '/',
  '/index.html',
  '/styles/main.css',
  '/scripts/app.js',
  '/scripts/localforage.min.js',
  '/scripts/moment.min.js',
  '/scripts/chart.min.js',
  '/scripts/bootstrap.bundle.min.js',
  '/images/logo.png',
  '/manifest.json'
];

const fontFilesToCache = [
  '/fonts/OpenSans-Regular.woff2',
  '/fonts/OpenSans-Medium.woff2'
];

// IndexedDBHelper implementation (unchanged from previous)
const IndexedDBHelper = {
  DB_NAME: 'RockLivingWaterDB',
  DB_VERSION: 1,
  STORE_NAME: 'formQueue',

  openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          db.createObjectStore(this.STORE_NAME, { keyPath: 'id', autoIncrement: true });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error(`Failed to open database: ${request.error}`));
    });
  },

  async addToQueue(formData) {
    try {
      const db = await this.openDB();
      const transaction = db.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);

      const submission = {
        url: formData.url,
        method: formData.method || 'POST',
        headers: formData.headers || { 'Content-Type': 'application/json' },
        body: formData.body || {},
        formId: formData.formId,
        timestamp: formData.timestamp || new Date().toISOString(),
        attempts: formData.attempts || 0,
        csrfToken: formData.csrfToken || ''
      };

      const request = store.add(submission);

      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          console.log(`[IndexedDBHelper] Queued form ${formData.formId}`);
          resolve();
        };
        request.onerror = () => reject(new Error(`Failed to queue form: ${request.error}`));
      });
    } catch (err) {
      console.error('[IndexedDBHelper] Error in addToQueue:', err);
      throw err;
    }
  },

  async getQueue() {
    try {
      const db = await this.openDB();
      const transaction = db.transaction([this.STORE_NAME], 'readonly');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.getAll();

      return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(new Error(`Failed to get queue: ${request.error}`));
      });
    } catch (err) {
      console.error('[IndexedDBHelper] Error in getQueue:', err);
      throw err;
    }
  },

  async removeFromQueue(submissions) {
    try {
      if (!submissions.length) return;

      const db = await this.openDB();
      const transaction = db.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);

      const promises = submissions.map(submission => {
        return new Promise((resolve, reject) => {
          const request = store.delete(submission.id);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(new Error(`Failed to delete submission ${submission.id}: ${request.error}`));
        });
      });

      await Promise.all(promises);
      console.log(`[IndexedDBHelper] Removed ${submissions.length} submissions`);
    } catch (err) {
      console.error('[IndexedDBHelper] Error in removeFromQueue:', err);
      throw err;
    }
  },

  async updateQueue(submissions) {
    try {
      if (!submissions.length) return;

      const db = await this.openDB();
      const transaction = db.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);

      const promises = submissions.map(submission => {
        return new Promise((resolve, reject) => {
          const request = store.put(submission);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(new Error(`Failed to update submission ${submission.id}: ${request.error}`));
        });
      });

      await Promise.all(promises);
      console.log(`[IndexedDBHelper] Updated ${submissions.length} submissions`);
    } catch (err) {
      console.error('[IndexedDBHelper] Error in updateQueue:', err);
      throw err;
    }
  }
};

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .catch(err => console.error('Failed to cache static assets:', err))
      .then(() => caches.open(FONT_CACHE_NAME))
      .then(fontCache => fontCache.addAll(fontFilesToCache))
      .catch(err => console.error('Failed to cache fonts:', err))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME && cache !== API_CACHE_NAME && cache !== FONT_CACHE_NAME) {
            return caches.delete(cache).catch(err => console.error('Failed to delete cache:', err));
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const requestUrl = event.request.url;

  // API requests (adjust for Google Apps Script endpoint)
  if (requestUrl.includes('/api/') || requestUrl.includes('script.google.com')) {
    if (OFFLINE_METRICS_URLS.some(url => requestUrl.includes(url))) {
      event.respondWith(
        fetch(event.request)
          .then(response => {
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const responseClone = response.clone();
            caches.open(API_CACHE_NAME)
              .then(cache => cache.put(event.request, responseClone));
            return response;
          })
          .catch(() => {
            return caches.match(event.request)
              .then(response => response || new Response(
                JSON.stringify({ success: false, message: 'No cached data available offline' }),
                { status: 503, headers: { 'Content-Type': 'application/json' } }
              ));
          })
      );
    } else {
      event.respondWith(
        fetch(event.request).catch(() => {
          return new Response(
            JSON.stringify({ success: false, message: 'Offline, please try again later' }),
            { status: 503, headers: { 'Content-Type': 'application/json' } }
          );
        })
      );
    }
  } else {
    event.respondWith(
      caches.match(event.request)
        .then(response => response || fetch(event.request).catch(() => {
          return new Response('Resource unavailable offline', { status: 503 });
        }))
    );
  }
});

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-form-submissions') {
    event.waitUntil(syncForms());
  }
});

self.addEventListener('message', (event) => {
  if (event.data.type === 'queue-form') {
    event.waitUntil(
      IndexedDBHelper.addToQueue({
        ...event.data.formData,
        csrfToken: event.data.formData.csrfToken || ''
      })
        .then(() => {
          event.ports[0].postMessage({ success: true });
        })
        .catch(err => {
          console.error('Failed to queue form:', err);
          event.ports[0].postMessage({ success: false, error: err.message });
        })
    );
  }
});

async function syncForms() {
  const queue = await IndexedDBHelper.getQueue();
  if (!queue.length) return;

  const successfulSubmissions = [];
  const failedSubmissions = [];

  for (const formData of queue) {
    if (formData.attempts >= 3) {
      failedSubmissions.push(formData);
      continue;
    }
    try {
      const response = await fetch(formData.url, {
        method: formData.method,
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': formData.csrfToken || '',
          ...formData.headers
        },
        body: JSON.stringify(formData.body)
      });

      if (response.ok) {
        successfulSubmissions.push(formData);
      } else {
        formData.attempts = (formData.attempts || 0) + 1;
        failedSubmissions.push(formData);
      }
    } catch (err) {
      console.error('Failed to sync form:', err);
      formData.attempts = (formData.attempts || 0) + 1;
      failedSubmissions.push(formData);
    }
  }

  await IndexedDBHelper.removeFromQueue(successfulSubmissions);
  await IndexedDBHelper.updateQueue(failedSubmissions);

  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({
      type: 'forms-synced',
      count: successfulSubmissions.length,
      failed: failedSubmissions.length
    });
  });
}