export const MAX_PERSONAL_AUDIO_BYTES = 20 * 1024 * 1024
export interface PersonalAudioFile { name: string; blob: Blob }

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('Local audio storage is unavailable.')); return }
    const request = indexedDB.open('nocturne-media-v1', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('files')
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error('Close other Nocturne tabs before changing audio storage.'))
  })
}

export async function readPersonalAudio(): Promise<PersonalAudioFile | null> {
  const db = await openDatabase()
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction('files', 'readonly').objectStore('files').get('personal')
      request.onsuccess = () => resolve(request.result ?? null)
      request.onerror = () => reject(request.error)
    })
  } finally { db.close() }
}

export async function writePersonalAudio(file: PersonalAudioFile | null): Promise<void> {
  if (file && (file.blob.size === 0 || file.blob.size > MAX_PERSONAL_AUDIO_BYTES)) {
    throw new Error('Audio files must be between 1 byte and 20 MB.')
  }
  const db = await openDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction('files', 'readwrite')
      const store = transaction.objectStore('files')
      if (file) store.put(file, 'personal')
      else store.delete('personal')
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
      transaction.onabort = () => reject(transaction.error ?? new Error('Audio storage was cancelled.'))
    })
  } finally { db.close() }
}
