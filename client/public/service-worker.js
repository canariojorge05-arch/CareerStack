// Enhanced Service Worker with advanced caching strategies and offline support
const CACHE_VERSION = 'v2.2.0';
const STATIC_CACHE = `static-cache-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `dynamic-cache-${CACHE_VERSION}`;
const API_CACHE = `api-cache-${CACHE_VERSION}`;
const DOCX_CACHE = `docx-cache-${CACHE_VERSION}`;
const FONT_CACHE = `font-cache-${CACHE_VERSION}`;

// Cache strategies
const CACHE_STRATEGIES = {
  NETWORK_FIRST: 'network-first',
  CACHE_FIRST: 'cache-first',
  STALE_WHILE_REVALIDATE: 'stale-while-revalidate',
  NETWORK_ONLY: 'network-only',
  CACHE_ONLY: 'cache-only'
};

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/offline.html'
];

// Route configurations
const ROUTE_CONFIG = {
  // Critical API routes - cache with stale-while-revalidate
  '/api/user/profile': { strategy: CACHE_STRATEGIES.STALE_WHILE_REVALIDATE, ttl: 300000 }, // 5 mins
  '/api/resumes': { strategy: CACHE_STRATEGIES.STALE_WHILE_REVALIDATE, ttl: 60000 }, // 1 min
  '/api/templates': { strategy: CACHE_STRATEGIES.CACHE_FIRST, ttl: 3600000 }, // 1 hour
  
  // DOCX processing - cache first due to expensive operations
  '/api/process-docx': { strategy: CACHE_STRATEGIES.CACHE_FIRST, ttl: 86400000 }, // 24 hours
  
  // Static assets - cache first
  '/assets/': { strategy: CACHE_STRATEGIES.CACHE_FIRST, ttl: 2592000000 }, // 30 days
  '/fonts/': { strategy: CACHE_STRATEGIES.CACHE_FIRST, ttl: 2592000000 }, // 30 days
};

const OFFLINE_FALLBACK = '/offline.html';
const MAX_CACHE_ENTRIES = 100;

// Enhanced install event with comprehensive caching
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker');
  
  event.waitUntil(
    Promise.all([
      // Cache static assets
      caches.open(STATIC_CACHE).then((cache) => {
        return cache.addAll(STATIC_ASSETS).catch(error => {
          console.error('[SW] Failed to cache static assets:', error);
        });
      }),
      
      // Pre-cache critical resources
      self.skipWaiting()
    ])
  );
});

// Enhanced activate event with intelligent cache cleanup
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker');
  
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => {
              return !cacheName.includes(CACHE_VERSION);
            })
            .map((cacheName) => {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            })
        );
      }),
      
      // Take control of all clients
      self.clients.claim()
    ])
  );
});

// Advanced fetch handler with multiple caching strategies
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  
  // Skip cross-origin requests
  if (url.origin !== self.location.origin) {
    return;
  }
  
  // Always avoid caching full page navigations to prevent stale auth state issues
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(error => {
        console.warn('[SW] Navigation fetch failed:', error.message);
        // Return a basic response for failed navigation requests
        return new Response('Navigation failed', { 
          status: 503, 
          statusText: 'Service Unavailable' 
        });
      })
    );
    return;
  }
  
  // Skip non-GET requests for caching
  if (request.method !== 'GET') {
    return;
  }
  
  event.respondWith(handleRequest(request));
});

// Request handling with strategy-based caching
async function handleRequest(request) {
  const url = new URL(request.url);
  const pathname = url.pathname;
  
  // Determine caching strategy
  const strategy = getStrategy(pathname);
  
  try {
    switch (strategy.name) {
      case CACHE_STRATEGIES.NETWORK_FIRST:
        return await networkFirst(request, strategy);
      case CACHE_STRATEGIES.CACHE_FIRST:
        return await cacheFirst(request, strategy);
      case CACHE_STRATEGIES.STALE_WHILE_REVALIDATE:
        return await staleWhileRevalidate(request, strategy);
      case CACHE_STRATEGIES.NETWORK_ONLY:
        // Include credentials for API requests
        if (request.url.includes('/api/')) {
          return await fetch(new Request(request, { credentials: 'include' }));
        }
        return await fetch(request);
      case CACHE_STRATEGIES.CACHE_ONLY:
        return await caches.match(request) || new Response('Not found', { status: 404 });
      default:
        return await networkFirst(request, strategy);
    }
  } catch (error) {
    console.error('[SW] Request handling error:', error);
    return getOfflineFallback(request);
  }
}

// Strategy selection based on request path
function getStrategy(pathname) {
  // Check exact matches first
  for (const [route, config] of Object.entries(ROUTE_CONFIG)) {
    if (pathname.startsWith(route)) {
      return { name: config.strategy, ttl: config.ttl };
    }
  }
  
  // Default strategies
  // IMPORTANT: Do NOT cache API calls. Use network-only to avoid stale auth and noisy errors.
  if (pathname.startsWith('/api/')) {
    return { name: CACHE_STRATEGIES.NETWORK_ONLY, ttl: 0 };
  }
  
  if (pathname.startsWith('/assets/') || pathname.match(/\.(css|js|woff2?|ttf|eot)$/)) {
    return { name: CACHE_STRATEGIES.CACHE_FIRST, ttl: 2592000000 }; // 30 days
  }
  
  return { name: CACHE_STRATEGIES.NETWORK_FIRST, ttl: 300000 }; // 5 minutes
}

// Network-first strategy
async function networkFirst(request, strategy) {
  try {
    // Include credentials for API requests to maintain session
    const requestOptions = {
      credentials: 'include'
    };
    
    // Create new request with credentials if it's an API request
    let fetchRequest = request;
    if (request.url.includes('/api/')) {
      fetchRequest = new Request(request, requestOptions);
    }
    
    const response = await fetch(fetchRequest);
    if (response.ok) {
      await cacheResponse(request, response.clone(), strategy);
      return response;
    }
    // Return the non-ok response instead of treating it as offline
    return response;
  } catch (error) {
    console.log('[SW] Network failed, trying cache:', error && error.message ? error.message : String(error));
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    // If truly offline (network error), fall back accordingly
    throw error;
  }
}

// Cache-first strategy
async function cacheFirst(request, strategy) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse && !isExpired(cachedResponse, strategy.ttl)) {
    return cachedResponse;
  }
  
  try {
    // Include credentials for API requests
    let fetchRequest = request;
    if (request.url.includes('/api/')) {
      fetchRequest = new Request(request, { credentials: 'include' });
    }
    
    const response = await fetch(fetchRequest);
    if (response.ok) {
      await cacheResponse(request, response.clone(), strategy);
    }
    return response;
  } catch (error) {
    if (cachedResponse) {
      return cachedResponse;
    }
    throw error;
  }
}
// Stale-while-revalidate strategy
async function staleWhileRevalidate(request, strategy) {
  const cachedResponse = await caches.match(request);
  
  // Include credentials for API requests
  let fetchRequest = request;
  if (request.url.includes('/api/')) {
    fetchRequest = new Request(request, { credentials: 'include' });
  }
  
  // Always try to revalidate in the background
  const fetchPromise = fetch(fetchRequest).then(async (response) => {
    if (response.ok) {
      await cacheResponse(request, response.clone(), strategy);
    }
    return response;
  }).catch(error => {
    console.log('[SW] Background revalidation failed:', error.message);
  });
  
  // Return cached version immediately if available
  if (cachedResponse) {
    return cachedResponse;
  }
  
  // If no cache, wait for network
  return await fetchPromise;
}

// Cache response with metadata
async function cacheResponse(request, response, strategy) {
  const cacheName = getCacheName(request);
  const cache = await caches.open(cacheName);
  
  // Add timestamp to response headers for TTL checking
  const responseWithTimestamp = new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: {
      ...response.headers,
      'sw-cached-at': Date.now().toString()
    }
  });
  
  await cache.put(request, responseWithTimestamp);
  
  // Clean up old entries
  await cleanupCache(cacheName);
}

// Get appropriate cache name
function getCacheName(request) {
  const url = new URL(request.url);
  
  if (url.pathname.startsWith('/api/')) {
    if (url.pathname.includes('docx')) {
      return DOCX_CACHE;
    }
    return API_CACHE;
  }
  
  if (url.pathname.match(/\.(woff2?|ttf|eot)$/)) {
    return FONT_CACHE;
  }
  
  if (STATIC_ASSETS.some(asset => url.pathname === asset)) {
    return STATIC_CACHE;
  }
  
  return DYNAMIC_CACHE;
}

// Check if cached response is expired
function isExpired(response, ttl) {
  const cachedAt = response.headers.get('sw-cached-at');
  if (!cachedAt) return false;
  
  const age = Date.now() - parseInt(cachedAt);
  return age > ttl;
}

// Cleanup old cache entries
async function cleanupCache(cacheName) {
  const cache = await caches.open(cacheName);
  const requests = await cache.keys();
  
  if (requests.length > MAX_CACHE_ENTRIES) {
    // Remove oldest entries
    const entriesToDelete = requests.slice(0, requests.length - MAX_CACHE_ENTRIES);
    await Promise.all(
      entriesToDelete.map(request => cache.delete(request))
    );
  }
}

// Offline fallback
async function getOfflineFallback(request) {
  const url = new URL(request.url);
  
  // Try to serve cached version first
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  
  // API requests - return offline message
  if (url.pathname.startsWith('/api/')) {
    return new Response(
      JSON.stringify({
        error: 'offline',
        message: 'You are currently offline. Please check your connection and try again.'
      }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
  
  // Page requests - serve offline fallback
  const offlinePage = await caches.match(OFFLINE_FALLBACK);
  return offlinePage || new Response('Offline', { status: 503 });
}

// Background sync for failed requests
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync());
  }
});

async function doBackgroundSync() {
  console.log('[SW] Performing background sync');
  // Handle failed requests that were queued while offline
  // This would integrate with your app's offline queue
}

// Push notifications
self.addEventListener('push', (event) => {
  if (!event.data) return;
  
  const data = event.data.json();
  const options = {
    body: data.body,
    icon: data.icon || '/favicon.ico',
    badge: '/favicon.ico',
    actions: data.actions,
    data: data.data
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification click handling
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  if (event.action === 'open') {
    event.waitUntil(
      clients.openWindow(event.notification.data.url || '/')
    );
  }
});
