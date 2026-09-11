import { Item } from '../types';
import { preloadAndCacheItemImages } from './imageLocalCache';

export * from './imageLocalCache';

const DB_NAME = 'AcheiMzLocalCache';
const DB_VERSION = 2;
const STORE_NAME = 'items';
const PROXIMITY_STORE_NAME = 'proximity_last_state';

export function openCacheDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error('Erro ao abrir o IndexedDB para cache.'));
    };

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(PROXIMITY_STORE_NAME)) {
        db.createObjectStore(PROXIMITY_STORE_NAME);
      }
    };
  });
}

/**
 * Salva a lista de itens no cache local (IndexedDB)
 * Limpa o cache antigo e grava os novos itens para manter o cache atualizado.
 * Filtra e remove itens com status 'REUNITED' com mais de 3 dias do cache para economizar armazenamento.
 */
export async function saveItemsToCache(items: Item[]): Promise<void> {
  try {
    const db = await openCacheDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      // Limpa os itens antigos para garantir que o cache reflete os mais recentes
      const clearRequest = store.clear();

      clearRequest.onsuccess = () => {
        const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
        const now = Date.now();

        // Filtra itens 'REUNITED' mais antigos do que 3 dias antes de salvar
        const validItems = items.filter((item) => {
          if (item.status === 'REUNITED') {
            const reunitedDateStr = item.reunitedAt || item.createdAt || item.date;
            if (reunitedDateStr) {
              const reunitedTime = new Date(reunitedDateStr).getTime();
              if (!isNaN(reunitedTime)) {
                return (now - reunitedTime) <= THREE_DAYS_MS;
              }
            }
            return false; // Se não tem data legível do reencontro, assume expirado de imediato
          }
          return true;
        });

        if (validItems.length === 0) {
          resolve();
          return;
        }

        let completed = 0;
        let hasError = false;

        validItems.forEach((item) => {
          const addRequest = store.put(item);
          addRequest.onsuccess = () => {
            completed++;
            if (completed === validItems.length && !hasError) {
              // Persiste as imagens dos itens em segundo plano no IndexedDB para navegação 100% offline
              preloadAndCacheItemImages(validItems).catch((err) => {
                console.warn('[ImageCache] Falha no precarregamento de imagens em segundo plano:', err);
              });
              resolve();
            }
          };
          addRequest.onerror = () => {
            if (!hasError) {
              hasError = true;
              reject(new Error('Erro ao salvar item no cache local.'));
            }
          };
        });
      };

      clearRequest.onerror = () => {
        reject(new Error('Erro ao limpar o cache local anterior.'));
      };
    });
  } catch (error) {
    console.error('Falha no salvamento do cache local:', error);
  }
}

/**
 * Remove fisicamente os itens informados do cache local no DB.
 */
async function cleanupExpiredItemsFromStore(itemIds: string[]): Promise<void> {
  try {
    const db = await openCacheDB();
    return new Promise((resolve) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      let completed = 0;
      
      itemIds.forEach(id => {
        const req = store.delete(id);
        req.onsuccess = () => {
          completed++;
          if (completed === itemIds.length) {
            resolve();
          }
        };
        req.onerror = () => {
          completed++;
          if (completed === itemIds.length) {
            resolve();
          }
        };
      });
    });
  } catch (error) {
    console.error('Falha ao expirar itens antigos do armazenamento local:', error);
  }
}

/**
 * Recupera os itens armazenados em cache anteriormente.
 * Purga de forma assíncrona quaisquer itens 'REUNITED' expirados que ainda existam localmente.
 */
export async function getCachedItems(): Promise<Item[]> {
  try {
    const db = await openCacheDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const items = request.result as Item[];
        const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
        const now = Date.now();
        const validItems: Item[] = [];
        const expiredItemIds: string[] = [];

        items.forEach((item) => {
          if (item.status === 'REUNITED') {
            const reunitedDateStr = item.reunitedAt || item.createdAt || item.date;
            if (reunitedDateStr) {
              const reunitedTime = new Date(reunitedDateStr).getTime();
              if (!isNaN(reunitedTime)) {
                if (now - reunitedTime > THREE_DAYS_MS) {
                  expiredItemIds.push(item.id);
                } else {
                  validItems.push(item);
                }
              } else {
                expiredItemIds.push(item.id);
              }
            } else {
              expiredItemIds.push(item.id);
            }
          } else {
            validItems.push(item);
          }
        });

        // Limpa itens expirados em segundo plano para libertar armazenamento IndexedDB imediatamente
        if (expiredItemIds.length > 0) {
          cleanupExpiredItemsFromStore(expiredItemIds).catch(err => {
            console.error('Erro na purga de itens expirados do cache:', err);
          });
        }

        // Ordena os itens do cache por data de criação decrescente
        validItems.sort((a, b) => {
          const timeA = new Date(a.createdAt || 0).getTime();
          const timeB = new Date(b.createdAt || 0).getTime();
          return timeB - timeA;
        });
        resolve(validItems);
      };

      request.onerror = () => {
        reject(new Error('Erro ao ler dados do cache local.'));
      };
    });
  } catch (error) {
    console.error('Falha ao recuperar cache local:', error);
    return [];
  }
}

/**
 * Salva o estado ativo do alerta de proximidade no IndexedDB para consulta offline.
 */
export async function saveActiveProximityState(
  state: { item: Item; distance: number; transportMode: 'walking' | 'cycling' | 'driving' | 'chapa' | 'bus' | 'mototaxi' | 'fastwalking' } | null
): Promise<void> {
  try {
    const db = await openCacheDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([PROXIMITY_STORE_NAME], 'readwrite');
      const store = transaction.objectStore(PROXIMITY_STORE_NAME);

      let request;
      if (state === null) {
        request = store.delete('active_route');
      } else {
        request = store.put(state, 'active_route');
      }

      request.onsuccess = () => {
        resolve();
      };
      request.onerror = () => {
        reject(new Error('Erro ao salvar estado de proximidade no IndexedDB.'));
      };
    });
  } catch (error) {
    console.error('Falha ao salvar estado de proximidade local:', error);
  }
}

/**
 * Recupera o último estado ativo de proximidade salvo.
 */
export async function getActiveProximityState(): Promise<{ item: Item; distance: number; transportMode: 'walking' | 'cycling' | 'driving' | 'chapa' | 'bus' | 'mototaxi' | 'fastwalking' } | null> {
  try {
    const db = await openCacheDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([PROXIMITY_STORE_NAME], 'readonly');
      const store = transaction.objectStore(PROXIMITY_STORE_NAME);
      const request = store.get('active_route');

      request.onsuccess = () => {
        resolve(request.result || null);
      };
      request.onerror = () => {
        reject(new Error('Erro ao obter estado de proximidade do IndexedDB.'));
      };
    });
  } catch (error) {
    console.error('Falha ao recuperar estado de proximidade local:', error);
    return null;
  }
}
