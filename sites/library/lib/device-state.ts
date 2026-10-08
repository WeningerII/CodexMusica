const database = "codex-musica-library-v1";
async function open() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open(database, 1);
    r.onupgradeneeded = () => r.result.createObjectStore("state");
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
export async function readDevice<T>(key: string, fallback: T): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const r = db.transaction("state").objectStore("state").get(key);
      r.onsuccess = () => resolve(r.result === undefined ? fallback : r.result);
      r.onerror = () => reject(r.error);
    });
  } finally {
    db.close();
  }
}
export async function writeDevice(key: string, value: unknown) {
  const db = await open();
  try {
    await new Promise<void>((resolve, reject) => {
      const t = db.transaction("state", "readwrite");
      t.objectStore("state").put(value, key);
      t.oncomplete = () => resolve();
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    });
  } finally {
    db.close();
  }
}
