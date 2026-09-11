import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, initializeFirestore, updateDoc, arrayUnion, doc, setLogLevel } from 'firebase/firestore';
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import firebaseConfig from '../firebase-applet-config.json';

// Silencia avisos internos de rede e conexão offline no console
setLogLevel('error');

console.log("[Firebase Init] Config:", { ...firebaseConfig, apiKey: "REDACTED" });
const app = initializeApp(firebaseConfig);
export const db = firebaseConfig.firestoreDatabaseId
  ? initializeFirestore(app, {}, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);
console.log("[Firebase Init] Firestore instance (db):", db ? "SUCCESSFULLY CREATED" : "UNDEFINED/NULL");
export const auth = getAuth(app);

// Chave VAPID pública padrão para o FCM Web Push.
// Os utilizadores podem substituir esta chave nas configurações se necessário.
export const DEFAULT_FCM_VAPID_KEY = "BDd_DovZqWun6tZlS7Y0O6x7G_fF0x8vVnE3qU_PzPmA7vX-fU6B-t77C0xY_fS7vQvPnYy8x36M9e7MvE-ZgM";

// Retorna o objeto de mensagens se suportado no navegador atual
export const getSafeMessaging = async () => {
  if (typeof window !== 'undefined' && await isSupported()) {
    try {
      return getMessaging(app);
    } catch (e) {
      console.warn("FCM não conseguiu iniciar:", e);
      return null;
    }
  }
  return null;
};

// Converter a chave pública VAPID base64 para Uint8Array para uso nativo no Service Worker
export const urlBase64ToUint8Array = (base64String: string) => {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
};

// Pedir Permissão e Registar Token no Perfil do Utilizador
export const requestAndSaveFcmToken = async (userId: string, customVapidKey?: string): Promise<string | null> => {
  try {
    if (typeof window === 'undefined') return null;
    
    const messagingInstance = await getSafeMessaging();
    if (!messagingInstance) {
      console.warn("FCM Messaging não é suportado neste navegador.");
      return null;
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn("Permissão de notificações recusada pelo utilizador.");
      return null;
    }

    // Registar o service worker padrão para FCM se ainda não estiver ativo
    let swReg: ServiceWorkerRegistration | undefined;
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      // Encontrar sw.js ou registar um exclusivo para FCM se desejado,
      // mas o sw.js padrão agora também lida com push nativo.
      swReg = regs.find(r => r.active && r.active.scriptURL.includes('sw.js'));
    }

    const token = await getToken(messagingInstance, {
      vapidKey: customVapidKey || DEFAULT_FCM_VAPID_KEY,
      serviceWorkerRegistration: swReg
    });

    if (token) {
      console.log(`[FCM] Token de Registro obtido com sucesso:`, token);
      
      // Salva o token do dispositivo no Firestore sob o perfil do utilizador
      const userDocRef = doc(db, 'users', userId);
      
      const additionalUpdates: Record<string, any> = {
        fcmTokens: arrayUnion(token),
        lastFcmSync: new Date().toISOString()
      };

      if ('serviceWorker' in navigator) {
        try {
          const reg = swReg || await navigator.serviceWorker.ready;
          const publicVapidKey = "BJnjmch1cQH0iUX35auZ1_Dby0M_v-xos1K_dV7WMuHTDMV-iG5VsJZXjJ92mJPlC89aw5npJQCcC3H9_uVON_I";
          const convertedVapidKey = urlBase64ToUint8Array(publicVapidKey);
          
          let sub = await reg.pushManager.getSubscription();
          if (!sub) {
            sub = await reg.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: convertedVapidKey
            });
          }
          
          if (sub) {
            console.log('[Web Push Service Worker] Subscrição ativa automaticamente pelo helper:', sub);
            additionalUpdates.webPushSubscriptions = arrayUnion(sub.toJSON());
          }
        } catch (swErr: any) {
          console.warn('[Web Push SW Helper] Erro nas configurações do PushManager durante autoreg:', swErr);
        }
      }

      await updateDoc(userDocRef, additionalUpdates);
      
      return token;
    } else {
      console.warn("Nenhum Instance ID token disponível. Verifique o VAPID key.");
      return null;
    }
  } catch (error) {
    console.error("Erro ao solicitar permissão FCM ou registar Token:", error);
    return null;
  }
};

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}


interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
