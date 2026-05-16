export type SavedNaezzalItem = {
  id: string;
  gifUrl: string;
  memo: string;
  styleName: string;
  createdAt: string;
};

const DB_NAME = "naezzal4zzal-gallery";
const STORE_NAME = "saved-gifs";
const DB_VERSION = 1;

function openGalleryDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error("보관함 데이터베이스를 열 수 없습니다."));
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, {
          keyPath: "id",
        });
      }
    };
  });
}

export async function saveGalleryItem(
  gifUrl: string,
  memo: string,
  styleName: string,
): Promise<SavedNaezzalItem> {
  const db = await openGalleryDb();

  const item: SavedNaezzalItem = {
  id: crypto.randomUUID(),
  gifUrl,
  memo: memo.trim() || "오늘의 움직이는 네컷 추억",
  styleName: styleName.trim() || "기본",
  createdAt: new Date().toISOString(),
};

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);

    const request = store.add(item);

    request.onsuccess = () => {
      resolve(item);
    };

    request.onerror = () => {
      reject(new Error("보관함에 저장하지 못했습니다."));
    };
  });
}

export async function getGalleryItems(): Promise<SavedNaezzalItem[]> {
  const db = await openGalleryDb();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);

    const request = store.getAll();

    request.onsuccess = () => {
      const items = request.result as SavedNaezzalItem[];

      resolve(
        items.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        ),
      );
    };

    request.onerror = () => {
      reject(new Error("보관함을 불러오지 못했습니다."));
    };
  });
}

export async function deleteGalleryItem(id: string): Promise<void> {
  const db = await openGalleryDb();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);

    const request = store.delete(id);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(new Error("보관함 항목을 삭제하지 못했습니다."));
    };
  });
}

export async function hasSameGalleryItem(
  memo: string,
  styleName: string,
): Promise<boolean> {
  const items = await getGalleryItems();

  const normalizedMemo = memo.trim() || "오늘의 움직이는 네컷 추억";
  const normalizedStyleName = styleName.trim() || "기본";

  return items.some(
    (item) =>
      item.memo === normalizedMemo && item.styleName === normalizedStyleName,
  );
}