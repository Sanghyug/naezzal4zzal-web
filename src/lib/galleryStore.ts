export type SavedNaezzalItem = {
  id: string;
  gifUrl: string; // 화면 표시용 object URL
  gifBlob?: Blob; // 실제 저장되는 GIF 파일
  memo: string;
  styleName: string;
  createdAt: string;
};

type StoredNaezzalItem = {
  id: string;
  gifBlob: Blob;
  memo: string;
  styleName: string;
  createdAt: string;
};

const DB_NAME = "naezzal4zzal-gallery";
const STORE_NAME = "saved-gifs";
const DB_VERSION = 2;

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

async function gifUrlToBlob(gifUrl: string): Promise<Blob> {
  const response = await fetch(gifUrl);
  const blob = await response.blob();

  if (!blob || blob.size === 0) {
    throw new Error("GIF 파일을 읽을 수 없습니다.");
  }

  return blob;
}

export async function saveGalleryItem(
  gifUrl: string,
  memo: string,
  styleName: string,
): Promise<SavedNaezzalItem> {
  const db = await openGalleryDb();
  const gifBlob = await gifUrlToBlob(gifUrl);

  const storedItem: StoredNaezzalItem = {
    id: crypto.randomUUID(),
    gifBlob,
    memo: memo.trim() || "오늘의 움직이는 네컷 추억",
    styleName: styleName.trim() || "기본",
    createdAt: new Date().toISOString(),
  };

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);

    const request = store.add(storedItem);

    request.onsuccess = () => {
      resolve({
        ...storedItem,
        gifUrl: URL.createObjectURL(gifBlob),
      });
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

    request.onsuccess = async () => {
      try {
        const rawItems = request.result as Array<
          StoredNaezzalItem & { gifUrl?: string }
        >;

        const items: SavedNaezzalItem[] = await Promise.all(
          rawItems.map(async (item) => {
            let gifBlob = item.gifBlob;

            // 예전 버전에서 gifUrl만 저장된 항목이 있을 경우를 위한 임시 호환 처리
            if (!gifBlob && item.gifUrl) {
              gifBlob = await gifUrlToBlob(item.gifUrl);
            }

            return {
              id: item.id,
              gifBlob,
              gifUrl: URL.createObjectURL(gifBlob),
              memo: item.memo,
              styleName: item.styleName,
              createdAt: item.createdAt,
            };
          }),
        );

        resolve(
          items.sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          ),
        );
      } catch (error) {
        console.error(error);
        reject(new Error("보관함을 불러오지 못했습니다."));
      }
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
