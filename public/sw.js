importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore-compat.js');

const firebaseConfig = {
  projectId: "gen-lang-client-0661695316",
  appId: "1:790776386778:web:84106a48971731339dc1e3",
  apiKey: "AIzaSyAmI0fqiJVYp8gUwWv4ufpTZm7REklj4-g",
  authDomain: "gen-lang-client-0661695316.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-0f18e960-7a19-48fb-85f3-dd7514dcaa34",
  storageBucket: "gen-lang-client-0661695316.firebasestorage.app",
  messagingSenderId: "790776386778"
};

// State context for the persistent Notification & Location
let lastUserCoordinates = { lat: -25.9610, lng: 32.5732 };
let cachedUserData = null;
let db = null;

// Inicializa o Firebase no Service Worker
firebase.initializeApp(firebaseConfig);
try {
  db = firebase.firestore();
} catch (e) {
  console.warn('[SW] Falha ao registar Firestore:', e);
}

try {
  const messaging = firebase.messaging();
  
  // Lida com mensagens quando a aplicação está em background ou fechada usando FCM
  messaging.onBackgroundMessage((payload) => {
    console.log('[SW FCM] Nova mensagem em background recebida:', payload);
    
    const title = payload.notification?.title || payload.data?.title || 'Anúncio Relevante!';
    const options = {
      body: payload.notification?.body || payload.data?.body || 'Recebeu um novo alerta no ComeBack.',
      icon: payload.notification?.icon || payload.data?.icon || '/favicon.ico',
      badge: '/favicon.ico',
      tag: payload.data?.tag || 'fcm-notification',
      data: {
        url: payload.data?.url || '/'
      },
      vibrate: [150, 50, 150]
    };

    self.registration.showNotification(title, options);
  });
} catch (e) {
  console.warn('[SW FCM] Falha ao registar o fcm messaging:', e);
}

// Escuta por mensagens emitidas pelo React (App.tsx)
self.addEventListener('message', event => {
  if (event.data) {
    if (event.data.type === 'UPDATE_LOCATION') {
      lastUserCoordinates = event.data.coords;
    }
    if (event.data.type === 'UPDATE_USER_DATA') {
      cachedUserData = event.data.user;
    }
    if (event.data.type === 'SHOW_PERSISTENT_SOS_NOTIFICATION') {
      showPersistentSOSNotification();
    }
  }
});

function showPersistentSOSNotification() {
  const options = {
    body: 'Alerta SOS em Standby. Ao carregar abaixo, publica-se um alarme de roubo com localização estimada para patrulhas civis.',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: 'persistent-sos-notification',
    requireInteraction: true,
    sticky: true,
    vibrate: [200, 100, 200],
    actions: [
      { action: 'quick-sos-trigger', title: '🚨 SOS IMEDIATO (Bloqueio)' }
    ],
    data: {
      url: '/'
    }
  };

  self.registration.showNotification('ComeBack SOS Activo 🚨', options);
}

const CACHE_NAME = 'comeback-cache-v3';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/index.css',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Pre-caching critical assets');
      return cache.addAll(ASSETS_TO_CACHE).catch(err => {
        console.warn('[SW] Pre-cache warning: some initial assets could not be cached', err);
      });
    })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Removing old cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') {
    return;
  }

  const requestUrl = new URL(event.request.url);
  
  // Exclude third-party dynamic APIs and analytics
  if (
    requestUrl.hostname.includes('firestore.googleapis.com') ||
    requestUrl.hostname.includes('firebase') ||
    requestUrl.pathname.includes('/api/') ||
    requestUrl.pathname.startsWith('/__/')
  ) {
    return;
  }

  // Network First, fallback to cache for HTML, Cache First for other assets
  const isHtml = event.request.headers.get('accept')?.includes('text/html') || requestUrl.pathname.endsWith('.html');

  if (isHtml) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseToCache));
          }
          return response;
        })
        .catch(() => {
          return caches.match('/').then(cachedResponse => {
            if (cachedResponse) return cachedResponse;
            return new Response('Offline - Conteúdo não disponível sem Internet.', {
              status: 503,
              statusText: 'Offline fallback failed'
            });
          });
        })
    );
  } else {
    event.respondWith(
      caches.match(event.request).then(cachedResponse => {
        if (cachedResponse) {
          // background sync for potential updates
          fetch(event.request).then(response => {
            if (response && response.status === 200) {
              caches.open(CACHE_NAME).then(cache => cache.put(event.request, response));
            }
          }).catch(() => {});
          return cachedResponse;
        }

        return fetch(event.request).then(response => {
          if (!response || response.status !== 200) {
            return response;
          }
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseToCache));
          return response;
        }).catch(() => {
          return new Response('Asset indisponível offline.', { status: 503 });
        });
      })
    );
  }
});

// Suporte e Tratamento de Push Notifications nativos adicionais
self.addEventListener('push', event => {
  let data = { title: 'Notificação do Sistema', body: 'Nova atualização disponível no ComeBack Moçambique.' };
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: 'Notificação de Sistema', body: event.data.text() };
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/favicon.ico',
    badge: '/favicon.ico',
    tag: data.tag || 'comeback-local-push',
    data: data.data || { url: '/' },
    vibrate: [100, 50, 100],
    actions: [
      { action: 'open_url', title: 'Ver Alerta' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', event => {
  if (event.action === 'quick-sos-trigger') {
    event.notification.close();

    const id = 'sos_widget_' + Math.random().toString(36).substring(2, 11);

    const provinceCenters = [
      { name: 'Maputo Cidade', lat: -25.9610, lng: 32.5732 },
      { name: 'Maputo Província', lat: -25.8455, lng: 32.6122 },
      { name: 'Gaza', lat: -25.0519, lng: 33.6403 },
      { name: 'Inhambane', lat: -23.8650, lng: 35.3833 },
      { name: 'Sofala', lat: -19.8252, lng: 34.8389 },
      { name: 'Manica', lat: -19.1164, lng: 33.4833 },
      { name: 'Tete', lat: -16.1564, lng: 33.5867 },
      { name: 'Zambézia', lat: -17.8732, lng: 36.8872 },
      { name: 'Nampula', lat: -15.1165, lng: 39.2662 },
      { name: 'Niassa', lat: -13.3114, lng: 35.2411 },
      { name: 'Cabo Delgado', lat: -12.9723, lng: 40.5111 }
    ];

    function getDistanceInKm(lat1, lon1, lat2, lon2) {
      const R = 6371;
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    }

    let lat = lastUserCoordinates ? lastUserCoordinates.lat : -25.9692;
    let lng = lastUserCoordinates ? lastUserCoordinates.lng : 32.5732;

    let nearestProvince = 'Maputo Cidade';
    let minDistance = Infinity;
    for (const pc of provinceCenters) {
      const dist = getDistanceInKm(lat, lng, pc.lat, pc.lng);
      if (dist < minDistance) {
        minDistance = dist;
        nearestProvince = pc.name;
      }
    }

    const timeStr = new Date().toLocaleTimeString();
    const userName = cachedUserData ? (cachedUserData.name || 'Vítima Anónima') : 'Vítima Anónima';
    const userPhone = cachedUserData ? (cachedUserData.phone || '+258840000000') : '+258840000000';
    const userVerified = cachedUserData ? (!!cachedUserData.isVerified) : false;
    const userId = cachedUserData ? (cachedUserData.id || 'anonymous_sos') : 'anonymous_sos';

    const quickItem = {
      id: id,
      title: `[SOS WIDGET 🚨] Alerta de Pânico Directo`,
      description: `Alerta prioritário ativado instantaneamente a partir da barra de notificações (ecrã bloqueado) às ${timeStr}. Geoprocessamento regional via rede activa.`,
      category: 'electronics',
      status: 'STOLEN',
      location: `Pânico directo do ecrã em: ${lat.toFixed(5)}, ${lng.toFixed(5)}`,
      province: nearestProvince,
      date: new Date().toISOString().split('T')[0],
      reward: 0,
      imageUrl: `https://picsum.photos/seed/${id}/400/300`,
      imageUrls: [`https://picsum.photos/seed/${id}/400/300`],
      userId: userId,
      ownerName: userName,
      ownerPhone: userPhone,
      createdAt: new Date().toISOString(),
      latitude: lat,
      longitude: lng,
      transitLatitude: lat,
      transitLongitude: lng,
      isTrackingActive: false,
      ownerVerified: userVerified,
      isPremium: true
    };

    if (db) {
      event.waitUntil(
        db.collection('items').doc(id).set(quickItem)
          .then(() => {
            // Re-draw persistent notification
            showPersistentSOSNotification();
            return self.registration.showNotification('🚨 SOS Transmitido com Sucesso!', {
              body: `Alerta registado na província de ${nearestProvince}. Autoridades e rede local foram avisadas.`,
              icon: '/favicon.ico',
              badge: '/favicon.ico',
              vibrate: [400, 200, 400],
              requireInteraction: false
            });
          })
          .catch(err => {
            console.error('[SW] Direct Firestore set failed:', err);
            showPersistentSOSNotification();
            return self.registration.showNotification('⚠️ Erro ao Enviar Alerta SOS', {
              body: 'Assegure-se de que tem ligação à internet de dados atinge.',
              icon: '/favicon.ico',
              badge: '/favicon.ico'
            });
          })
      );
    }

    // Also tell the active clients so they display it in-app
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      for (const client of windowClients) {
        client.postMessage({
          type: 'BACKGROUND_SOS_SUBMITTED',
          item: quickItem
        });
      }
    });

    return;
  }

  event.notification.close();
  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      for (const client of windowClients) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});

