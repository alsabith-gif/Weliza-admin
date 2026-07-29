/**
 * Weliza Web App - Database Module (IndexedDB with LocalStorage Fallback)
 * Stored locally in the user's browser.
 * Falls back to LocalStorage automatically if IndexedDB is blocked (e.g., Firefox file:// or private windows).
 */

const DB_NAME = 'WelizaDB';
const DB_VERSION = 2;

let useFallback = false;

// In-memory backup in case even localStorage is blocked (rare private mode edge cases)
const memoryDB = {
  clients: [],
  invoices: [],
  purchases: [],
  itemPresets: []
};

/**
 * Initializes the IndexedDB database.
 */
function initDB() {
  return new Promise((resolve, reject) => {
    // If we've already detected we need a fallback, reject immediately to use it
    if (useFallback) {
      reject(new Error("Using LocalStorage fallback"));
      return;
    }

    if (!window.indexedDB) {
      reject(new Error("IndexedDB not supported"));
      return;
    }

    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = (event) => {
        reject(event.target.error);
      };

      request.onsuccess = (event) => {
        resolve(event.target.result);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        if (!db.objectStoreNames.contains('clients')) {
          const clientStore = db.createObjectStore('clients', { keyPath: 'id', autoIncrement: true });
          clientStore.createIndex('name', 'name', { unique: false });
        }

        if (!db.objectStoreNames.contains('invoices')) {
          const invoiceStore = db.createObjectStore('invoices', { keyPath: 'id', autoIncrement: true });
          invoiceStore.createIndex('invoiceNumber', 'invoiceNumber', { unique: true });
          invoiceStore.createIndex('date', 'date', { unique: false });
        }

        if (!db.objectStoreNames.contains('purchases')) {
          db.createObjectStore('purchases', { keyPath: 'id', autoIncrement: true });
        }

        if (!db.objectStoreNames.contains('itemPresets')) {
          const presetStore = db.createObjectStore('itemPresets', { keyPath: 'id', autoIncrement: true });
          presetStore.createIndex('name', 'name', { unique: false });
        }
      };
    } catch (e) {
      reject(e);
    }
  });
}

// --- LOCAL STORAGE FALLBACK UTILITIES ---
function getFallbackStore(storeName) {
  try {
    const data = localStorage.getItem('weliza_db_' + storeName);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return memoryDB[storeName] || [];
  }
}

function saveFallbackStore(storeName, data) {
  try {
    localStorage.setItem('weliza_db_' + storeName, JSON.stringify(data));
  } catch (e) {
    memoryDB[storeName] = data;
  }
}

// --- PUBLIC DATABASE FUNCTIONS ---

async function dbGetAll(storeName) {
  if (useFallback) {
    return getFallbackStore(storeName);
  }
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn("IndexedDB blocked or failed. Switching to LocalStorage fallback.", err);
    useFallback = true;
    return getFallbackStore(storeName);
  }
}

async function dbAdd(storeName, data) {
  if (useFallback) {
    const list = getFallbackStore(storeName);
    const newId = list.length > 0 ? Math.max(...list.map(item => item.id || 0)) + 1 : 1;
    data.id = newId;
    list.push(data);
    saveFallbackStore(storeName, list);
    return newId;
  }
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.add(data);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    useFallback = true;
    return dbAdd(storeName, data);
  }
}

async function dbUpdate(storeName, data) {
  if (useFallback) {
    const list = getFallbackStore(storeName);
    const idx = list.findIndex(item => item.id === data.id);
    if (idx !== -1) {
      list[idx] = data;
      saveFallbackStore(storeName, list);
    }
    return data.id;
  }
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(data);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    useFallback = true;
    return dbUpdate(storeName, data);
  }
}

async function dbRemove(storeName, id) {
  if (useFallback) {
    let list = getFallbackStore(storeName);
    list = list.filter(item => item.id !== id);
    saveFallbackStore(storeName, list);
    return;
  }
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    useFallback = true;
    return dbRemove(storeName, id);
  }
}

async function dbGetById(storeName, id) {
  if (useFallback) {
    const list = getFallbackStore(storeName);
    return list.find(item => item.id === id);
  }
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    useFallback = true;
    return dbGetById(storeName, id);
  }
}

// Export to Global Scope
window.WelizaDB = {
  initDB,
  getAll: dbGetAll,
  add: dbAdd,
  update: dbUpdate,
  remove: dbRemove,
  getById: dbGetById
};
