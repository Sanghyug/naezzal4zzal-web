import {test} from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import {saveGalleryItem,getGalleryItems,deleteGalleryItem} from '../src/lib/galleryStore.ts';
test('different GIFs with same memo and style survive reload and delete',async()=>{const a=await saveGalleryItem('data:image/gif;base64,R0lGODlh','', '빠른 GIF');const b=await saveGalleryItem('data:image/gif;base64,R0lGODli','', '빠른 GIF');assert.notEqual(a.id,b.id);let items=await getGalleryItems();assert.equal(items.length,2);items.forEach(i=>URL.revokeObjectURL(i.gifUrl));await deleteGalleryItem(a.id);items=await getGalleryItems();assert.equal(items.length,1);assert.equal(items[0].id,b.id);[a,b,...items].forEach(i=>URL.revokeObjectURL(i.gifUrl));});
