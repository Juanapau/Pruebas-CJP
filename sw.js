// ==========================================
// SERVICE WORKER - SCJP v2.0
// Sistema de Calificaciones JP — Politécnico NSA
// ==========================================

const CACHE_NAME = 'scjp-v2.0';
const CACHE_STATIC = 'scjp-static-v2.0';
const CACHE_DYNAMIC = 'scjp-dynamic-v2.0';

// Recursos estáticos que se cachean al instalar el SW
const STATIC_ASSETS = [
    './index.html',
    './app.html',
    './script.js',
    './styles.css',
    './manifest.json',
    './icon-72x72.png',
    './icon-96x96.png',
    './icon-128x128.png',
    './icon-144x144.png',
    './icon-152x152.png',
    './icon-180x180.png',
    './icon-192x192.png',
    './icon-32x32.png',
    './icon-16x16.png',
    'https://fonts.googleapis.com/css2?family=Sora:wght@300;400;600;700&family=Space+Mono:wght@400;700&family=Bebas+Neue&display=swap'
];

// ── Instalación: cachear recursos estáticos ────────────────────────────────
self.addEventListener('install', event => {
    console.log('[SW] Instalando Service Worker SCJP v2.0...');
    event.waitUntil(
        caches.open(CACHE_STATIC)
            .then(cache => {
                console.log('[SW] Cacheando recursos estáticos...');
                // Cachear uno por uno para que un fallo no detenga todo
                return Promise.allSettled(
                    STATIC_ASSETS.map(url =>
                        cache.add(url).catch(err =>
                            console.warn(`[SW] No se pudo cachear: ${url}`, err)
                        )
                    )
                );
            })
            .then(() => {
                console.log('[SW] Instalación completa.');
                return self.skipWaiting(); // Activar inmediatamente sin esperar
            })
    );
});

// ── Activación: limpiar cachés antiguas ────────────────────────────────────
self.addEventListener('activate', event => {
    console.log('[SW] Activando Service Worker SCJP v2.0...');
    event.waitUntil(
        caches.keys()
            .then(keys => {
                return Promise.all(
                    keys
                        .filter(key => key !== CACHE_STATIC && key !== CACHE_DYNAMIC)
                        .map(key => {
                            console.log(`[SW] Eliminando caché antigua: ${key}`);
                            return caches.delete(key);
                        })
                );
            })
            .then(() => {
                console.log('[SW] Activación completa — controlando todos los clientes.');
                return self.clients.claim(); // Tomar control de páginas abiertas
            })
    );
});

// ── Fetch: estrategia por tipo de recurso ─────────────────────────────────
self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);

    // No interceptar peticiones a Google Apps Script (siempre necesitan red)
    if (url.hostname.includes('script.google.com') ||
        url.hostname.includes('googleapis.com') && url.pathname.includes('/macros/')) {
        // Estrategia: Network Only con cola offline para POST
        if (request.method === 'POST') {
            event.respondWith(
                fetch(request.clone()).catch(() => {
                    // Guardar en cola offline si falla
                    return guardarEnColaOffline(request.clone()).then(() => {
                        return new Response(
                            JSON.stringify({ success: false, offline: true, error: 'Sin conexión. Datos guardados localmente.' }),
                            { headers: { 'Content-Type': 'application/json' } }
                        );
                    });
                })
            );
        }
        return; // GET a Google Script: dejar pasar sin interceptar
    }

    // No interceptar peticiones a fuentes externas (Google Fonts, etc.) en modo offline
    if (url.hostname !== self.location.hostname && !url.hostname.includes('fonts.googleapis')) {
        return;
    }

    // Estrategia Cache First para recursos estáticos (JS, CSS, imágenes, HTML)
    if (request.method === 'GET') {
        event.respondWith(
            caches.match(request)
                .then(cachedResponse => {
                    if (cachedResponse) {
                        // Retornar desde caché y actualizar en segundo plano
                        const fetchPromise = fetch(request)
                            .then(networkResponse => {
                                if (networkResponse && networkResponse.status === 200) {
                                    const responseClone = networkResponse.clone();
                                    caches.open(CACHE_STATIC).then(cache => {
                                        cache.put(request, responseClone);
                                    });
                                }
                                return networkResponse;
                            })
                            .catch(() => null);

                        return cachedResponse; // Retornar caché inmediatamente
                    }

                    // No está en caché → intentar red y cachear
                    return fetch(request)
                        .then(networkResponse => {
                            if (!networkResponse || networkResponse.status !== 200 || networkResponse.type === 'opaque') {
                                return networkResponse;
                            }
                            const responseClone = networkResponse.clone();
                            caches.open(CACHE_DYNAMIC).then(cache => {
                                cache.put(request, responseClone);
                            });
                            return networkResponse;
                        })
                        .catch(() => {
                            // Sin red y sin caché: devolver página offline si es navegación HTML
                            if (request.destination === 'document') {
                                return caches.match('./index.html');
                            }
                            return new Response('Sin conexión', { status: 503 });
                        });
                })
        );
    }
});

// ── Cola offline para peticiones POST fallidas ─────────────────────────────
const OFFLINE_QUEUE_KEY = 'scjp_offline_queue';

async function guardarEnColaOffline(request) {
    try {
        const body = await request.text();
        const item = {
            url: request.url,
            method: request.method,
            body: body,
            timestamp: Date.now()
        };

        // Guardar en IndexedDB a través de mensaje al cliente
        const clients = await self.clients.matchAll();
        clients.forEach(client => {
            client.postMessage({
                type: 'QUEUE_OFFLINE_REQUEST',
                data: item
            });
        });

        console.log('[SW] Petición guardada en cola offline:', item.url);
    } catch (error) {
        console.error('[SW] Error al guardar en cola offline:', error);
    }
}

// ── Sincronización en segundo plano (Background Sync) ─────────────────────
self.addEventListener('sync', event => {
    if (event.tag === 'sync-offline-data') {
        console.log('[SW] Sincronizando datos offline...');
        event.waitUntil(sincronizarDatosOffline());
    }
});

async function sincronizarDatosOffline() {
    // Notificar a los clientes para que procesen la cola
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
        client.postMessage({ type: 'SYNC_NOW' });
    });
}

// ── Mensajes desde la página principal ────────────────────────────────────
self.addEventListener('message', event => {
    if (!event.data) return;

    switch (event.data.type) {
        case 'SYNC_NOW':
            // La página pide sincronizar manualmente
            sincronizarDatosOffline();
            break;

        case 'SKIP_WAITING':
            // Forzar activación de nueva versión
            self.skipWaiting();
            break;

        case 'SYNC_COMPLETE':
            // Notificar a todos los clientes que la sincronización terminó
            self.clients.matchAll().then(clients => {
                clients.forEach(client => {
                    client.postMessage({
                        type: 'SYNC_COMPLETE',
                        count: event.data.count || 0
                    });
                });
            });
            break;

        default:
            console.log('[SW] Mensaje no reconocido:', event.data.type);
    }
});

console.log('[SW] Service Worker SCJP v2.0 cargado correctamente.');
