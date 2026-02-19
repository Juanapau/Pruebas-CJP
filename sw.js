// Service Worker para Sistema PNSA
// Versión del caché - incrementar cuando actualices archivos
const CACHE_VERSION = 'pnsa-v1.0.0';
const CACHE_NAME = `${CACHE_VERSION}-static`;
const DATA_CACHE_NAME = `${CACHE_VERSION}-data`;

// Archivos estáticos para cachear
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/script.js',
  '/manifest.json'
];

// URLs de datos que se cachean dinámicamente
const DATA_URLS = [
  'https://script.google.com/macros/s/'
];

// Instalación del Service Worker
self.addEventListener('install', event => {
  console.log('🔧 Service Worker: Instalando...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('📦 Service Worker: Cacheando archivos estáticos');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('✅ Service Worker: Instalado correctamente');
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('❌ Error al instalar Service Worker:', error);
      })
  );
});

// Activación del Service Worker
self.addEventListener('activate', event => {
  console.log('🚀 Service Worker: Activando...');
  
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        // Eliminar cachés antiguos
        return Promise.all(
          cacheNames
            .filter(cacheName => cacheName.startsWith('pnsa-') && cacheName !== CACHE_NAME && cacheName !== DATA_CACHE_NAME)
            .map(cacheName => {
              console.log('🗑️ Eliminando caché antiguo:', cacheName);
              return caches.delete(cacheName);
            })
        );
      })
      .then(() => {
        console.log('✅ Service Worker: Activado');
        return self.clients.claim();
      })
  );
});

// Interceptar peticiones (Estrategia: Network First, Cache Fallback)
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Ignorar peticiones que no sean GET
  if (request.method !== 'GET') {
    // Para POST, PUT, DELETE - intentar online, guardar en cola si falla
    event.respondWith(
      fetch(request)
        .catch(error => {
          console.log('⚠️ Petición falló, guardando en cola offline:', request.url);
          // Guardar en IndexedDB para sincronizar después
          return saveToOfflineQueue(request.clone());
        })
    );
    return;
  }
  
  // Estrategia para archivos estáticos (Cache First)
  if (STATIC_ASSETS.some(asset => request.url.includes(asset))) {
    event.respondWith(
      caches.match(request)
        .then(cachedResponse => {
          if (cachedResponse) {
            return cachedResponse;
          }
          return fetch(request)
            .then(response => {
              if (response && response.status === 200) {
                const responseToCache = response.clone();
                caches.open(CACHE_NAME)
                  .then(cache => cache.put(request, responseToCache));
              }
              return response;
            });
        })
    );
    return;
  }
  
  // Estrategia para datos de Google Sheets (Network First, Cache Fallback)
  if (url.hostname.includes('script.google.com')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Si la respuesta es exitosa, cachear
          if (response && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(DATA_CACHE_NAME)
              .then(cache => cache.put(request, responseToCache));
          }
          return response;
        })
        .catch(error => {
          console.log('📡 Sin conexión, usando caché para:', request.url);
          // Si falla, usar caché
          return caches.match(request)
            .then(cachedResponse => {
              if (cachedResponse) {
                return cachedResponse;
              }
              // Si no hay caché, devolver respuesta offline
              return new Response(
                JSON.stringify({
                  success: false,
                  offline: true,
                  message: 'Sin conexión. Los datos se sincronizarán cuando haya internet.'
                }),
                {
                  headers: { 'Content-Type': 'application/json' }
                }
              );
            });
        })
    );
    return;
  }
  
  // Para todo lo demás, intentar red primero
  event.respondWith(
    fetch(request)
      .catch(() => caches.match(request))
  );
});

// Guardar peticiones fallidas en IndexedDB
async function saveToOfflineQueue(request) {
  try {
    const db = await openOfflineDB();
    const requestData = {
      url: request.url,
      method: request.method,
      headers: [...request.headers.entries()],
      body: await request.text(),
      timestamp: Date.now()
    };
    
    const tx = db.transaction('offlineQueue', 'readwrite');
    await tx.objectStore('offlineQueue').add(requestData);
    
    console.log('💾 Petición guardada en cola offline');
    
    return new Response(
      JSON.stringify({
        success: true,
        offline: true,
        queued: true,
        message: 'Guardado localmente. Se sincronizará cuando haya conexión.'
      }),
      {
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('❌ Error al guardar en cola offline:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// Abrir base de datos IndexedDB
function openOfflineDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('PNSA_Offline', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = event => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('offlineQueue')) {
        db.createObjectStore('offlineQueue', { keyPath: 'id', autoIncrement: true });
      }
    };
  });
}

// Sincronización en segundo plano
self.addEventListener('sync', event => {
  if (event.tag === 'sync-offline-data') {
    console.log('🔄 Iniciando sincronización en segundo plano...');
    event.waitUntil(syncOfflineData());
  }
});

// Sincronizar datos offline
async function syncOfflineData() {
  try {
    const db = await openOfflineDB();
    const tx = db.transaction('offlineQueue', 'readonly');
    const store = tx.objectStore('offlineQueue');
    const allRequests = await store.getAll();
    
    if (allRequests.length === 0) {
      console.log('✅ No hay datos pendientes de sincronizar');
      return;
    }
    
    console.log(`🔄 Sincronizando ${allRequests.length} peticiones pendientes...`);
    
    for (const requestData of allRequests) {
      try {
        const response = await fetch(requestData.url, {
          method: requestData.method,
          headers: new Headers(requestData.headers),
          body: requestData.body
        });
        
        if (response.ok) {
          // Eliminar de la cola si fue exitoso
          const deleteTx = db.transaction('offlineQueue', 'readwrite');
          await deleteTx.objectStore('offlineQueue').delete(requestData.id);
          console.log('✅ Petición sincronizada:', requestData.url);
        }
      } catch (error) {
        console.error('❌ Error al sincronizar petición:', error);
      }
    }
    
    console.log('✅ Sincronización completada');
    
    // Notificar al cliente
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'SYNC_COMPLETE',
        count: allRequests.length
      });
    });
    
  } catch (error) {
    console.error('❌ Error en sincronización:', error);
  }
}

// Escuchar mensajes del cliente
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'SYNC_NOW') {
    syncOfflineData();
  }
});

console.log('🚀 Service Worker cargado');
