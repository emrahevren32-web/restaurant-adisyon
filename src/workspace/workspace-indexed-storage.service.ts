const DB_NAME = 'miyop_workspace_lifecycle_cache'
const STORE_NAME = 'workspace_records'
const DB_VERSION = 1

const memoryStore = new Map<string, unknown>()
const hydrationRequests = new Set<string>()
const registeredKeys = new Set<string>()

const isBrowser = () => typeof window !== 'undefined'
const canUseIndexedDb = () => isBrowser() && typeof indexedDB !== 'undefined'

export const isWorkspaceStorageError = (error: unknown) => {
  const name = error instanceof DOMException ? error.name : error instanceof Error ? error.name : ''
  const message = error instanceof Error ? error.message : String(error || '')
  return /QuotaExceededError|NS_ERROR_DOM_QUOTA_REACHED|Storage|quota|setItem/i.test(`${name} ${message}`)
}

const emitStorageError = (error: unknown) => {
  if(!isBrowser()) return
  window.dispatchEvent(new CustomEvent('miyop-workspace-storage-error', {
    detail: {
      message: error instanceof Error ? error.message : 'Workspace depolama hatası.'
    }
  }))
}

const dispatchEvents = (events: readonly string[] = []) => {
  if(!isBrowser()) return
  events.forEach(eventName => window.dispatchEvent(new CustomEvent(eventName)))
}

const openDb = () => new Promise<IDBDatabase>((resolve, reject) => {
  if(!canUseIndexedDb()){
    reject(new Error('IndexedDB kullanılamıyor.'))
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
  request.onerror = () => reject(request.error || new Error('IndexedDB açılamadı.'))
})

const withStore = <T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>
) => openDb().then(db => new Promise<T>((resolve, reject) => {
  const transaction = db.transaction(STORE_NAME, mode)
  const store = transaction.objectStore(STORE_NAME)
  const request = action(store)
  request.onsuccess = () => resolve(request.result)
  request.onerror = () => reject(request.error || new Error('IndexedDB işlemi başarısız.'))
  transaction.oncomplete = () => db.close()
  transaction.onerror = () => {
    db.close()
    reject(transaction.error || new Error('IndexedDB transaction hatası.'))
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
  if(!isBrowser() || typeof localStorage === 'undefined') return
  try {
    localStorage.removeItem(key)
  } catch (error) {
    if(isWorkspaceStorageError(error)) emitStorageError(error)
  }
}

const readLegacyLocalStorage = <T>(key: string): T | null => {
  if(!isBrowser() || typeof localStorage === 'undefined') return null

  try {
    const raw = localStorage.getItem(key)
    if(raw === null) return null
    const parsed = JSON.parse(raw) as T
    memoryStore.set(key, parsed)
    writeIndexedRecord(key, parsed)
      .then(() => removeLegacyLocalStorage(key))
      .catch(error => {
        if(isWorkspaceStorageError(error)) emitStorageError(error)
      })
    return parsed
  } catch (error) {
    removeLegacyLocalStorage(key)
    if(isWorkspaceStorageError(error)) emitStorageError(error)
    return null
  }
}

const hydrateIndexedRecord = <T>(key: string, events: readonly string[]) => {
  if(hydrationRequests.has(key)) return
  hydrationRequests.add(key)

  readIndexedRecord<T>(key)
    .then(value => {
      if(value === undefined) return
      memoryStore.set(key, value)
      dispatchEvents(events)
    })
    .catch(error => {
      if(isWorkspaceStorageError(error)) emitStorageError(error)
    })
    .finally(() => hydrationRequests.delete(key))
}

export const getWorkspaceIndexedRecord = <T>(
  key: string,
  fallback: T,
  events: readonly string[] = []
): T => {
  registeredKeys.add(key)
  if(memoryStore.has(key)) return memoryStore.get(key) as T

  const legacyValue = readLegacyLocalStorage<T>(key)
  if(legacyValue !== null) return legacyValue

  hydrateIndexedRecord<T>(key, events)
  return fallback
}

export const setWorkspaceIndexedRecord = <T>(
  key: string,
  value: T,
  events: readonly string[] = []
) => {
  registeredKeys.add(key)
  memoryStore.set(key, value)
  removeLegacyLocalStorage(key)
  dispatchEvents(events)
  writeIndexedRecord(key, value).catch(error => {
    if(isWorkspaceStorageError(error)) emitStorageError(error)
  })
}

export const clearWorkspaceIndexedRecords = (
  keys?: string[],
  events: readonly string[] = []
) => {
  const targetKeys = keys || Array.from(registeredKeys)
  targetKeys.forEach(key => {
    memoryStore.delete(key)
    removeLegacyLocalStorage(key)
    deleteIndexedRecord(key).catch(error => {
      if(isWorkspaceStorageError(error)) emitStorageError(error)
    })
  })
  if(!keys){
    clearIndexedRecords().catch(error => {
      if(isWorkspaceStorageError(error)) emitStorageError(error)
    })
  }
  dispatchEvents(events)
}

export const WorkspaceIndexedStorageService = {
  get: getWorkspaceIndexedRecord,
  set: setWorkspaceIndexedRecord,
  clear: clearWorkspaceIndexedRecords,
  isStorageError: isWorkspaceStorageError
}
