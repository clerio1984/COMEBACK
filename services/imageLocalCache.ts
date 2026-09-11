import { Item } from '../types';
import { compressImage } from './imageUtils';

const DB_NAME = 'AcheiMzImageCache';
const DB_VERSION = 1;
const STORE_NAME = 'images';

export interface CachedImageRecord {
  url: string;
  dataUrl: string;
  size?: number;
  timestamp: number;
}

// In-memory L1 cache for instant, zero-delay synchronous lookups during the active session
const memoryCache = new Map<string, string>();

let dbPromise: Promise<IDBDatabase> | null = null;

/**
 * Opens or initializes the IndexedDB database for persistent offline images.
 */
export function openImageCacheDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      reject(new Error('IndexedDB não está disponível neste navegador.'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      dbPromise = null;
      reject(new Error('Erro ao abrir o IndexedDB para cache de imagens.'));
    };

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'url' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  });

  return dbPromise;
}

/**
 * Returns synchronously cached image from memory if available, or if it's already a Data URL.
 */
export function getMemoryCachedImage(url?: string): string | null {
  if (!url) return null;
  if (url.startsWith('data:')) return url;
  return memoryCache.get(url) || null;
}

/**
 * Retrieves a persisted image Data URL from IndexedDB.
 * Populates L1 memory cache on hit.
 */
export async function getCachedImage(url: string): Promise<string | null> {
  if (!url) return null;
  if (url.startsWith('data:')) {
    memoryCache.set(url, url);
    return url;
  }

  // 1. Check L1 Memory Cache
  if (memoryCache.has(url)) {
    return memoryCache.get(url)!;
  }

  // 2. Query IndexedDB L2 Store
  try {
    const db = await openImageCacheDB();
    return new Promise((resolve) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(url);

      request.onsuccess = () => {
        const result = request.result as CachedImageRecord | undefined;
        if (result && result.dataUrl) {
          memoryCache.set(url, result.dataUrl);
          resolve(result.dataUrl);
        } else {
          resolve(null);
        }
      };

      request.onerror = () => {
        resolve(null);
      };
    });
  } catch (err) {
    console.warn('[ImageCache] Erro ao pesquisar imagem no IndexedDB:', err);
    return null;
  }
}

/**
 * Saves an image Data URL into both memory and IndexedDB.
 */
export async function saveImageToCache(url: string, dataUrl: string): Promise<void> {
  if (!url || !dataUrl) return;

  memoryCache.set(url, dataUrl);

  try {
    const db = await openImageCacheDB();
    return new Promise((resolve) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      const record: CachedImageRecord = {
        url,
        dataUrl,
        size: dataUrl.length,
        timestamp: Date.now(),
      };

      const request = store.put(record);
      request.onsuccess = () => resolve();
      request.onerror = async () => {
        // In case of quota error, try pruning oldest images and retry once
        try {
          await pruneOldestImages(10);
          const retryTx = db.transaction([STORE_NAME], 'readwrite');
          retryTx.objectStore(STORE_NAME).put(record);
        } catch {
          // Ignore non-fatal storage limits
        }
        resolve();
      };
    });
  } catch (err) {
    console.warn('[ImageCache] Erro ao persistir imagem no IndexedDB:', err);
  }
}

/**
 * Converts a Blob to a base64 Data URL.
 */
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Falha ao converter blob para Data URL.'));
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/**
 * Fetches an external image URL and converts it to a compressed Data URL for IndexedDB persistence.
 * Tries direct CORS fetch -> Canvas drawing -> server-side proxy fallback.
 */
export async function fetchAndCacheImage(url: string): Promise<string | null> {
  if (!url) return null;

  // Already a base64 data URL: save and return directly
  if (url.startsWith('data:')) {
    await saveImageToCache(url, url);
    return url;
  }

  // Already cached in IndexedDB: return cached copy
  const existing = await getCachedImage(url);
  if (existing) return existing;

  // If offline, cannot fetch from network
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return null;
  }

  let finalDataUrl: string | null = null;

  // Method 1: Direct CORS fetch
  try {
    const response = await fetch(url, { mode: 'cors' });
    if (response.ok) {
      const blob = await response.blob();
      const rawDataUrl = await blobToDataUrl(blob);
      // Compress if it's an image to save IndexedDB space
      try {
        finalDataUrl = await compressImage(rawDataUrl, 800, 800, 0.8);
      } catch {
        finalDataUrl = rawDataUrl;
      }
    }
  } catch {
    // Direct fetch failed (likely CORS or cross-origin restrictions), proceed to Method 2
  }

  // Method 2: HTML Image + Canvas
  if (!finalDataUrl) {
    try {
      finalDataUrl = await new Promise<string | null>((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            const maxWidth = 800;
            const maxHeight = 800;
            let width = img.width;
            let height = img.height;

            if (width > height && width > maxWidth) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            } else if (height > maxHeight) {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.8));
          } catch {
            resolve(null);
          }
        };
        img.onerror = () => resolve(null);
        img.src = url;
      });
    } catch {
      // Proceed to proxy fallback
    }
  }

  // Method 3: Server-side proxy fallback (when online)
  if (!finalDataUrl) {
    try {
      const proxyRes = await fetch(`/api/proxy-image?url=${encodeURIComponent(url)}`);
      if (proxyRes.ok) {
        const json = await proxyRes.json();
        if (json.dataUrl) {
          try {
            finalDataUrl = await compressImage(json.dataUrl, 800, 800, 0.8);
          } catch {
            finalDataUrl = json.dataUrl;
          }
        }
      }
    } catch {
      // Proxy unavailable
    }
  }

  if (finalDataUrl) {
    await saveImageToCache(url, finalDataUrl);
    return finalDataUrl;
  }

  return null;
}

/**
 * Preloads and persists images for all items in the background.
 * Uses controlled concurrency to protect network and main-thread responsiveness.
 */
export async function preloadAndCacheItemImages(items: Item[]): Promise<void> {
  if (!items || items.length === 0) return;

  // Extract and deduplicate all image URLs from items
  const urlSet = new Set<string>();
  for (const item of items) {
    if (item.imageUrl && typeof item.imageUrl === 'string') {
      urlSet.add(item.imageUrl);
    }
    if (item.imageUrls && Array.isArray(item.imageUrls)) {
      for (const u of item.imageUrls) {
        if (u && typeof u === 'string') {
          urlSet.add(u);
        }
      }
    }
  }

  const urls = Array.from(urlSet);
  if (urls.length === 0) return;

  // Concurrency queue (limit to 3 concurrent downloads)
  const CONCURRENCY = 3;
  let index = 0;

  async function worker() {
    while (index < urls.length) {
      const currentUrl = urls[index++];
      if (!currentUrl) continue;

      // If already in memory or indexedDB, skip
      if (memoryCache.has(currentUrl)) continue;

      try {
        const cached = await getCachedImage(currentUrl);
        if (!cached && (typeof navigator === 'undefined' || navigator.onLine)) {
          await fetchAndCacheImage(currentUrl);
        }
      } catch (err) {
        console.warn(`[ImageCache] Falha ao precarregar imagem: ${currentUrl.slice(0, 40)}...`, err);
      }
    }
  }

  const workers = Array.from({ length: Math.min(CONCURRENCY, urls.length) }, () => worker());
  await Promise.all(workers);
}

/**
 * Cleans up the oldest cached images from IndexedDB if storage limit is approached.
 */
async function pruneOldestImages(count = 20): Promise<void> {
  try {
    const db = await openImageCacheDB();
    return new Promise((resolve) => {
      const tx = db.transaction([STORE_NAME], 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const index = store.index('timestamp');
      const request = index.openCursor();
      let deleted = 0;

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result as IDBCursorWithValue | null;
        if (cursor && deleted < count) {
          cursor.delete();
          deleted++;
          cursor.continue();
        } else {
          resolve();
        }
      };

      request.onerror = () => resolve();
    });
  } catch {
    // Ignore cleanup errors
  }
}

/**
 * Returns statistics about the IndexedDB image cache.
 */
export async function getImageCacheStats(): Promise<{ count: number; estimatedSizeKb: number }> {
  try {
    const db = await openImageCacheDB();
    return new Promise((resolve) => {
      const tx = db.transaction([STORE_NAME], 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const countReq = store.count();

      countReq.onsuccess = () => {
        const count = countReq.result;
        resolve({ count, estimatedSizeKb: count * 45 }); // approximate ~45KB per compressed image
      };

      countReq.onerror = () => {
        resolve({ count: 0, estimatedSizeKb: 0 });
      };
    });
  } catch {
    return { count: 0, estimatedSizeKb: 0 };
  }
}

/**
 * Completely purges all cached images from IndexedDB.
 */
export async function clearImageCache(): Promise<void> {
  memoryCache.clear();
  try {
    const db = await openImageCacheDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_NAME], 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(new Error('Erro ao limpar cache de imagens.'));
    });
  } catch (err) {
    console.error('Erro ao limpar cache de imagens:', err);
  }
}
