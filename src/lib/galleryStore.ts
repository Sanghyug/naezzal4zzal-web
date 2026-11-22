export type SavedNaezzalItem = { id: string; gifUrl: string; gifBlob?: Blob; memo: string; styleName: string; createdAt: string };
type StoredItem = Omit<SavedNaezzalItem, "gifUrl"> & { gifBlob: Blob; gifUrl?: string };
const DB_NAME = "naezzal4zzal-gallery", STORE_NAME = "saved-gifs";
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 2);
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME, { keyPath: "id" }); };
    request.onerror = () => reject(new Error("보관함을 열지 못했어요."));
    request.onblocked = () => reject(new Error("다른 창의 앱을 닫고 다시 시도해주세요."));
    request.onsuccess = () => { request.result.onversionchange = () => request.result.close(); resolve(request.result); };
  });
}
export async function saveGalleryItem(gifUrl: string, memo: string, styleName: string): Promise<SavedNaezzalItem> {
  const response = await fetch(gifUrl);
  if (!response.ok) throw new Error("움짤 파일을 읽지 못했어요.");
  const gifBlob = await response.blob();
  if (!gifBlob.size) throw new Error("빈 움짤은 저장할 수 없어요.");
  const item: StoredItem = { id: crypto.randomUUID(), gifBlob, memo: memo.trim() || "오늘의 움직이는 네컷 추억", styleName: styleName.trim() || "기본", createdAt: new Date().toISOString() };
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.oncomplete = () => resolve();
      tx.onabort = tx.onerror = () => reject(new Error("저장 공간이 부족하거나 보관함에 저장할 수 없어요."));
      tx.objectStore(STORE_NAME).add(item);
    });
    return { ...item, gifUrl: URL.createObjectURL(gifBlob) };
  } finally { db.close(); }
}
export async function getGalleryItems(): Promise<SavedNaezzalItem[]> {
  const db = await openDb();
  let raw: StoredItem[];
  try {
    raw = await new Promise<StoredItem[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const request = tx.objectStore(STORE_NAME).getAll();
      tx.oncomplete = () => resolve(request.result);
      tx.onabort = tx.onerror = () => reject(new Error("보관함을 읽지 못했어요."));
    });
  } finally { db.close(); }
  const items: SavedNaezzalItem[] = [];
  for (const item of raw) {
    try {
      const blob = item.gifBlob || (item.gifUrl ? await (await fetch(item.gifUrl)).blob() : null);
      if (!blob?.size) continue;
      items.push({ ...item, gifBlob: blob, gifUrl: URL.createObjectURL(blob) });
    } catch { /* A broken legacy entry must not hide the rest of the gallery. */ }
  }
  return items.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
export async function deleteGalleryItem(id: string): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.oncomplete = () => resolve();
      tx.onabort = tx.onerror = () => reject(new Error("삭제하지 못했어요."));
      tx.objectStore(STORE_NAME).delete(id);
    });
  } finally { db.close(); }
}
