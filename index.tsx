
import React from 'react';
import ReactDOM from 'react-dom/client';
import { db } from './services/firebase';
import App from './App';
import { doc, getDocFromServer } from 'firebase/firestore';

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
testConnection();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Limpar cache e desregistar o Service Worker para evitar conflito de versões e cache obsoleto do React (causando Erro de Hook inválido)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    for (const registration of registrations) {
      registration.unregister();
      console.log('[Service Worker] Desregistado para evitar cache obsoleto');
    }
  });
}
if ('caches' in window) {
  caches.keys().then(names => {
    for (const name of names) {
      caches.delete(name);
      console.log('[Cache] Cache limpo:', name);
    }
  });
}

