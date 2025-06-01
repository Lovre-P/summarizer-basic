/**
 * Service Worker for Content Summarizer PWA
 * Handles caching, offline functionality, and background sync
 */

const CACHE_NAME = 'content-summarizer-v1';
const STATIC_CACHE_NAME = 'content-summarizer-static-v1';
const DYNAMIC_CACHE_NAME = 'content-summarizer-dynamic-v1';

// Files to cache for offline functionality
const STATIC_FILES = [
    '/',
    '/index.html',
    '/manifest.json',
    '/styles.css',
    '/js/app.js',
    '/js/storage.js',
    '/js/gemini.js',
    '/js/content-processor.js',
    '/js/tts-manager.js',
    '/js/ui-manager.js',
    '/icons/icon-192.png',
    '/icons/icon-512.png'
];

// URLs that should always be fetched from network
const NETWORK_FIRST_URLS = [
    'https://generativelanguage.googleapis.com/',
    'https://api.allorigins.win/',
    'https://www.youtube.com/oembed'
];

// Install event - cache static files
self.addEventListener('install', (event) => {
    console.log('Service Worker: Installing...');
    
    event.waitUntil(
        caches.open(STATIC_CACHE_NAME)
            .then((cache) => {
                console.log('Service Worker: Caching static files');
                return cache.addAll(STATIC_FILES);
            })
            .then(() => {
                console.log('Service Worker: Static files cached');
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('Service Worker: Error caching static files', error);
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('Service Worker: Activating...');
    
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== STATIC_CACHE_NAME && 
                            cacheName !== DYNAMIC_CACHE_NAME &&
                            cacheName.startsWith('content-summarizer-')) {
                            console.log('Service Worker: Deleting old cache', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                console.log('Service Worker: Activated');
                return self.clients.claim();
            })
    );
});

// Fetch event - handle requests with caching strategy
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);
    
    // Handle different types of requests
    if (request.method === 'GET') {
        if (isStaticFile(request.url)) {
            // Static files: Cache first, then network
            event.respondWith(cacheFirst(request));
        } else if (isNetworkFirstUrl(request.url)) {
            // API calls: Network first, then cache
            event.respondWith(networkFirst(request));
        } else if (isNavigationRequest(request)) {
            // Navigation: Network first, fallback to cached index.html
            event.respondWith(navigationHandler(request));
        } else {
            // Other requests: Network first with cache fallback
            event.respondWith(networkFirst(request));
        }
    }
});

// Handle share target
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    
    if (url.pathname === '/shared-content' && event.request.method === 'GET') {
        event.respondWith(handleSharedContent(event.request));
    }
});

// Cache first strategy - for static files
async function cacheFirst(request) {
    try {
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            const cache = await caches.open(STATIC_CACHE_NAME);
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    } catch (error) {
        console.error('Cache first strategy failed:', error);
        return new Response('Offline', { status: 503 });
    }
}

// Network first strategy - for API calls and dynamic content
async function networkFirst(request) {
    try {
        const networkResponse = await fetch(request);
        
        if (networkResponse.ok && request.method === 'GET') {
            const cache = await caches.open(DYNAMIC_CACHE_NAME);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        console.log('Network failed, trying cache:', request.url);
        
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        
        // Return offline page for navigation requests
        if (isNavigationRequest(request)) {
            const offlineResponse = await caches.match('/index.html');
            return offlineResponse || new Response('Offline', { 
                status: 503,
                headers: { 'Content-Type': 'text/html' }
            });
        }
        
        return new Response('Offline', { status: 503 });
    }
}

// Navigation handler - for page requests
async function navigationHandler(request) {
    try {
        const networkResponse = await fetch(request);
        return networkResponse;
    } catch (error) {
        console.log('Navigation failed, serving cached index.html');
        const cachedResponse = await caches.match('/index.html');
        return cachedResponse || new Response('Offline', { 
            status: 503,
            headers: { 'Content-Type': 'text/html' }
        });
    }
}

// Handle shared content from other apps
async function handleSharedContent(request) {
    const url = new URL(request.url);
    const sharedUrl = url.searchParams.get('url');
    const sharedText = url.searchParams.get('text');
    const sharedTitle = url.searchParams.get('title');
    
    // Redirect to main app with shared content parameters
    const redirectUrl = new URL('/', self.location.origin);
    
    if (sharedUrl) {
        redirectUrl.searchParams.set('url', sharedUrl);
    } else if (sharedText) {
        redirectUrl.searchParams.set('text', sharedText);
    }
    
    if (sharedTitle) {
        redirectUrl.searchParams.set('title', sharedTitle);
    }
    
    return Response.redirect(redirectUrl.href, 302);
}

// Utility functions
function isStaticFile(url) {
    return STATIC_FILES.some(file => url.endsWith(file)) ||
           url.includes('/icons/') ||
           url.endsWith('.css') ||
           url.endsWith('.js') ||
           url.endsWith('.png') ||
           url.endsWith('.jpg') ||
           url.endsWith('.svg');
}

function isNetworkFirstUrl(url) {
    return NETWORK_FIRST_URLS.some(pattern => url.includes(pattern));
}

function isNavigationRequest(request) {
    return request.mode === 'navigate' ||
           (request.method === 'GET' && 
            request.headers.get('accept') && 
            request.headers.get('accept').includes('text/html'));
}

// Background sync for offline actions
self.addEventListener('sync', (event) => {
    console.log('Service Worker: Background sync triggered', event.tag);
    
    if (event.tag === 'background-summarize') {
        event.waitUntil(handleBackgroundSummarize());
    }
});

async function handleBackgroundSummarize() {
    try {
        // Get pending summarization requests from IndexedDB
        const db = await openDB();
        const transaction = db.transaction(['pending_requests'], 'readonly');
        const store = transaction.objectStore('pending_requests');
        const requests = await getAll(store);
        
        for (const request of requests) {
            try {
                // Process the request
                await processPendingRequest(request);
                
                // Remove from pending requests
                const deleteTransaction = db.transaction(['pending_requests'], 'readwrite');
                const deleteStore = deleteTransaction.objectStore('pending_requests');
                await deleteStore.delete(request.id);
                
            } catch (error) {
                console.error('Failed to process pending request:', error);
            }
        }
    } catch (error) {
        console.error('Background sync failed:', error);
    }
}

async function processPendingRequest(request) {
    // This would process the summarization request when back online
    // Implementation would depend on the specific request structure
    console.log('Processing pending request:', request);
}

// IndexedDB helpers
function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('SummarizerDB', 1);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function getAll(store) {
    return new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// Handle push notifications (for future enhancement)
self.addEventListener('push', (event) => {
    console.log('Service Worker: Push notification received');
    
    const options = {
        body: 'Your content summary is ready!',
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        tag: 'content-summarizer',
        requireInteraction: false,
        actions: [
            {
                action: 'view',
                title: 'View Summary'
            },
            {
                action: 'dismiss',
                title: 'Dismiss'
            }
        ]
    };
    
    event.waitUntil(
        self.registration.showNotification('Content Summarizer', options)
    );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
    console.log('Service Worker: Notification clicked', event.action);
    
    event.notification.close();
    
    if (event.action === 'view') {
        event.waitUntil(
            clients.openWindow('/')
        );
    }
});

// Handle messages from main app
self.addEventListener('message', (event) => {
    console.log('Service Worker: Message received', event.data);
    
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

console.log('Service Worker: Loaded');
