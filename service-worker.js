/**
 * Service Worker — cache-first strategy dla Przygody Wariacika PWA.
 * Wersja cache: zmień CACHE_NAME aby wymusić odświeżenie zasobów.
 */
const CACHE_NAME = 'wariacik-v1.1';

const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/manifest.json',
    '/js/phaser.min.js',
    '/js/main.js',
    '/js/managers/SaveManager.js',
    '/js/managers/AudioManager.js',
    '/js/managers/InputManager.js',
    '/js/managers/EffectsManager.js',
    '/js/managers/ShopManager.js',
    '/js/entities/Player.js',
    '/js/entities/Enemy.js',
    '/js/entities/PowerUp.js',
    '/js/scenes/BootScene.js',
    '/js/scenes/PreloadScene.js',
    '/js/scenes/MenuScene.js',
    '/js/scenes/GameScene.js',
    '/js/scenes/UIScene.js',
    '/js/scenes/ShopScene.js',
    '/js/ui/OrientationOverlay.js',
    '/assets/sky.png',
    '/assets/platform.png',
    '/assets/star.png',
    '/assets/bomb.png',
    '/assets/dude.png'
];

// ─── Install — zapisz assety w cache ───
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            console.log('[SW] Cachowanie assetów...');
            return cache.addAll(ASSETS_TO_CACHE);
        }).then(() => self.skipWaiting())
    );
});

// ─── Activate — usuń stare cache ───
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME)
                    .map(key => {
                        console.log('[SW] Usuwam stary cache:', key);
                        return caches.delete(key);
                    })
            );
        }).then(() => self.clients.claim())
    );
});

// ─── Fetch — cache-first z fallbackiem na network ───
self.addEventListener('fetch', event => {
    // Tylko GET requests
    if (event.request.method !== 'GET') return;

    event.respondWith(
        caches.match(event.request).then(cached => {
            if (cached) return cached;

            return fetch(event.request).then(response => {
                // Zapisz odpowiedź do cache jeśli to statyczny asset
                if (response && response.status === 200 && response.type === 'basic') {
                    const cloned = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, cloned));
                }
                return response;
            }).catch(() => {
                // Offline fallback dla HTML
                if (event.request.destination === 'document') {
                    return caches.match('/index.html');
                }
            });
        })
    );
});

// ─── Prompt instalacji ───
self.addEventListener('message', event => {
    if (event.data === 'skipWaiting') self.skipWaiting();
});
