// Service Worker para lidar com Notificações FCM em Background
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

const firebaseConfig = {
  projectId: "gen-lang-client-0661695316",
  appId: "1:790776386778:web:84106a48971731339dc1e3",
  apiKey: "AIzaSyAmI0fqiJVYp8gUwWv4ufpTZm7REklj4-g",
  authDomain: "gen-lang-client-0661695316.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-0f18e960-7a19-48fb-85f3-dd7514dcaa34",
  storageBucket: "gen-lang-client-0661695316.firebasestorage.app",
  messagingSenderId: "790776386778"
};

// Inicializa o Firebase no Service Worker
firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

// Lida com mensagens quando a aplicação está em background ou fechada
messaging.onBackgroundMessage((payload) => {
  console.log('[SW FCM] Nova mensagem em background recebida:', payload);
  
  const title = payload.notification?.title || payload.data?.title || 'FCM ComeBack!';
  const options = {
    body: payload.notification?.body || payload.data?.body || 'Recebeu um novo alerta em Moçambique.',
    icon: payload.notification?.icon || '/favicon.ico' || 'https://images.unsplash.com/photo-1557200134-90327ee9fafa?w=100', // ícone padrão
    badge: '/favicon.ico',
    tag: payload.data?.tag || 'fcm-notification',
    data: {
      url: payload.data?.url || '/'
    },
    vibrate: [150, 50, 150],
    actions: [
      { action: 'open_url', title: 'Abrir App' }
    ]
  };

  self.registration.showNotification(title, options);
});

// Responde ao clique na notificação nativa abrindo a app no link relevante
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Se houver uma janela já aberta, foca nela
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      // Se não houver, abre uma nova janela
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});
