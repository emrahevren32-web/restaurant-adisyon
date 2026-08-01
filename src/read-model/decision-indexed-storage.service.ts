const DB_NAME = 'restaurant_os_decision_cache'
const STORE_NAME = 'decision_records'
const DB_VERSION = 1

const memoryStore = new Map<string, unknown>()
const hydrationRequests = new Set<string>()
const registeredKeys = new Set<string>()

const isBrowser = () => (
  typeof window !== 'undefined'
  && typeof indexedDB !== 'undefined'
)

export const isDecisionStorageError = (error: unknown) => {
  const name = error instanceof DOMException ? error.name : error instanceof Error ? error.name : ''
  const message = error instanceof Error ? error.message : String(error || '')
  return /QuotaExceededError|NS_ERROR_DOM_QUOTA_REACHED|Storage|quota|setItem/i.test(`${name} ${message}`)
}

const emitStorageError = (error: unknown) => {
  if(typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('decision-storage-error', {
    detail: {
      message: error instanceof Error ? error.message : 'Karar Destek depolama hatasi.'
    }
  }))
}

const openDb = () => new Promise<IDBDatabase>((resolve, reject) => {
  if(!isBrowser()){
    reject(new Error('IndexedDB kullanilamiyor.'))
    return
  }

  const request = indexedDB.open(DB_NAME, DB_VERSION)
  request.onupgradeneeded = () => {
    const db = request.result
    if(!db.objectStoreNames.contains(STORE_NAME)){
      db.createObjectStore(STORE_NAME)
    }
  }
  request.onsuccess = () => resolve(request.result)
  request.onerror = () => reject(request.error || new Error('IndexedDB acilamadi.'))
})

const withStore = <T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>
) => openDb().then(db => new Promise<T>((resolve, reject) => {
  const transaction = db.transaction(STORE_NAME, mode)
  const store = transaction.objectStore(STORE_NAME)
  const request = action(store)
  request.onsuccess = () => resolve(request.result)
  request.onerror = () => reject(request.error || new Error('IndexedDB islemi basarisiz.'))
  transaction.oncomplete = () => db.close()
  transaction.onerror = () => {
    db.close()
    reject(transaction.error || new Error('IndexedDB transaction hatasi.'))
  }
}))

const readIndexedRecord = <T>(key: string) => (
  withStore<T | undefined>('readonly', store => store.get(key) as IDBRequest<T | undefined>)
)

const writeIndexedRecord = (key: string, value: unknown) => (
  withStore<IDBValidKey>('readwrite', store => store.put(value, key))
)

const deleteIndexedRecord = (key: string) => (
  withStore<undefined>('readwrite', store => store.delete(key) as IDBRequest<undefined>)
)

const clearIndexedRecords = () => (
  withStore<undefined>('readwrite', store => store.clear() as IDBRequest<undefined>)
)

const removeLegacyLocalStorage = (key: string) => {
  if(typeof localStorage === 'undefined') return
  try {
    localStorage.removeItem(key)
  } catch (error) {
    if(isDecisionStorageError(error)) emitStorageError(error)
  }
}

const readLegacyLocalStorage = <T>(key: string): T | null => {
  if(typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(key)
    if(raw === null) return null
    const parsed = JSON.parse(raw) as T
    removeLegacyLocalStorage(key)
    setDecisionIndexedRecord(key, parsed)
    return parsed
  } catch (error) {
    removeLegacyLocalStorage(key)
    if(isDecisionStorageError(error)) emitStorageError(error)
    return null
  }
}

const hydrateIndexedRecord = <T>(key: string) => {
  if(hydrationRequests.has(key)) return
  hydrationRequests.add(key)
  readIndexedRecord<T>(key)
    .then(value => {
      if(value !== undefined) memoryStore.set(key, value)
    })
    .catch(error => {
      if(isDecisionStorageError(error)) emitStorageError(error)
    })
    .finally(() => hydrationRequests.delete(key))
}

export const getDecisionIndexedRecord = <T>(key: string): T | null => {
  registeredKeys.add(key)
  if(memoryStore.has(key)) return memoryStore.get(key) as T

  const legacyValue = readLegacyLocalStorage<T>(key)
  if(legacyValue !== null){
    memoryStore.set(key, legacyValue)
    return legacyValue
  }

  hydrateIndexedRecord<T>(key)
  return null
}

export const setDecisionIndexedRecord = <T>(key: string, value: T) => {
  registeredKeys.add(key)
  memoryStore.set(key, value)
  removeLegacyLocalStorage(key)
  writeIndexedRecord(key, value).catch(error => {
    if(isDecisionStorageError(error)) emitStorageError(error)
  })
}

export const clearDecisionIndexedRecords = (keys?: string[]) => {
  const targetKeys = keys || Array.from(registeredKeys)
  targetKeys.forEach(key => {
    memoryStore.delete(key)
    removeLegacyLocalStorage(key)
    deleteIndexedRecord(key).catch(error => {
      if(isDecisionStorageError(error)) emitStorageError(error)
    })
  })
  if(!keys){
    clearIndexedRecords().catch(error => {
      if(isDecisionStorageError(error)) emitStorageError(error)
    })
  }
}

export const DecisionIndexedStorageService = {
  get: getDecisionIndexedRecord,
  set: setDecisionIndexedRecord,
  clear: clearDecisionIndexedRecords,
  isStorageError: isDecisionStorageError
}
