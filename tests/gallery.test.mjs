import {test} from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import {saveGalleryItem,getGalleryItems,deleteGalleryItem} from '../src/lib/galleryStore.ts';
test('different GIFs with same memo and style survive reload and delete',async()=>{const a=await saveGalleryItem('data:image/gif;base64,R0lGODlh','', '빠른 GIF');const b=await saveGalleryItem('data:image/gif;base64,R0lGODli','', '빠른 GIF');assert.notEqual(a.id,b.id);let items=await getGalleryItems();assert.equal(items.length,2);items.forEach(i=>URL.revokeObjectURL(i.gifUrl));await deleteGalleryItem(a.id);items=await getGalleryItems();assert.equal(items.length,1);assert.equal(items[0].id,b.id);[a,b,...items].forEach(i=>URL.revokeObjectURL(i.gifUrl));});


test('same MP4 is stored once across concurrent saves while old GIF records survive',async()=>{
  const before=await getGalleryItems();const oldIds=before.map(x=>x.id);
  const url='data:video/mp4;base64,AAAAHGZ0eXBpc29tAAAAAGlzb21tcDQy';
  const [a,b]=await Promise.all([saveGalleryItem(url,'영상','실사 영상','video'),saveGalleryItem(url,'영상','실사 영상','video')]);
  assert.equal(a.id,b.id);assert.equal(a.createdAt,b.createdAt);
  let items=await getGalleryItems();assert.equal(items.filter(x=>x.id===a.id).length,1);
  for(const id of oldIds)assert.ok(items.some(x=>x.id===id));
  assert.equal((await (await fetch(items.find(x=>x.id===a.id).gifUrl)).blob()).size,a.gifBlob.size);
  await deleteGalleryItem(a.id);const after=await getGalleryItems();assert.ok(!after.some(x=>x.id===a.id));for(const id of oldIds)assert.ok(after.some(x=>x.id===id));
  [a,b,...before,...items,...after].forEach(x=>{URL.revokeObjectURL(x.gifUrl);if(x.thumbnailUrl)URL.revokeObjectURL(x.thumbnailUrl);});
});

test('legacy saved videos without a content hash are reused instead of duplicated',async()=>{
  const blob=new Blob(['legacy-mp4-content'],{type:'video/mp4'});
  const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('naezzal4zzal-gallery',2);r.onsuccess=()=>resolve(r.result);r.onerror=reject;});
  await new Promise((resolve,reject)=>{const tx=db.transaction('saved-gifs','readwrite');tx.objectStore('saved-gifs').put({id:'legacy-video',gifBlob:blob,mediaType:'video',memo:'기존 영상',styleName:'기본 5초 영상',createdAt:'2026-11-25T00:00:00Z'});tx.oncomplete=resolve;tx.onerror=reject;});db.close();
  const url=URL.createObjectURL(blob);const item=await saveGalleryItem(url,'새 메모','실사 영상','video');assert.equal(item.id,'legacy-video');assert.equal(item.memo,'기존 영상');assert.equal(item.createdAt,'2026-11-25T00:00:00Z');await deleteGalleryItem(item.id);URL.revokeObjectURL(url);URL.revokeObjectURL(item.gifUrl);
});
