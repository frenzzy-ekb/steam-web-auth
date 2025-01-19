const CACHE_NAME = 'steam-guard-v1';
const ASSETS = [
    '.',
    'index.html',
    'style.css',
    'app.js',
    'crypto.js',
    'icon-512.svg',
    'manifest.json'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(ASSETS))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name !== CACHE_NAME)
                    .map((name) => caches.delete(name))
            );
        })
        .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    const relativePath = url.pathname.replace(/^\/[^/]+\//, '/');

    event.respondWith(
        fetch(event.request)
            .catch(() => {
                return caches.match(event.request)
                    .then((response) => {
                        if (response) {
                            return response;
                        }
                        
                        if (event.request.mode === 'navigate') {
                            return caches.match('index.html');
                        }
                        return new Response('', {
                            status: 404,
                            statusText: 'Not Found'
                        });
                    });
            })
    );
}); 