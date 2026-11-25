import {test,expect} from '@playwright/test';
async function upload(page) {
  await page.goto('/');
  await expect(page.getByRole('button',{name:'🖼️ 불러오기'})).toBeVisible();
  const data = await page.evaluate(()=>{const c=document.createElement('canvas');c.width=400;c.height=1200;const ctx=c.getContext('2d');['#e35555','#55a566','#5577dd','#e9bd49'].forEach((color,i)=>{ctx.fillStyle=color;ctx.fillRect(0,i*300,400,300);ctx.fillStyle='white';ctx.font='70px sans-serif';ctx.fillText(String(i+1),160,i*300+180);});return c.toDataURL('image/png').split(',')[1];});
  await page.locator('input[type=file]').nth(1).setInputFiles({name:'four-cuts.png',mimeType:'image/png',buffer:Buffer.from(data,'base64')});
}
test('manual editor makes a GIF, saves and reloads it',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));let requests=0;page.on('request',r=>{if(r.url().includes('/api/extract-cells'))requests++});page.on('dialog',d=>d.accept());
  await upload(page);await page.getByRole('button',{name:'사진 전송 없이 직접 맞추기'}).click();
  await expect(page.getByRole('heading',{name:'직접 맞추기 · 임시 배치'})).toBeVisible();
  await page.getByRole('button',{name:'세로 네 컷으로 다시 맞추기'}).click();
  await page.screenshot({path:'test-results/manual-editor.png',fullPage:true});
  await page.getByRole('button',{name:'움짤 만들기',exact:true}).click();
  await page.getByRole('button',{name:'헐레벌떡 GIF',exact:true}).click();
  await page.getByRole('button',{name:/기본 핑크 프레임/}).click();
  await expect(page.getByRole('button',{name:'보관함에 저장하기'})).toBeVisible({timeout:30000});
  await page.getByRole('button',{name:'보관함에 저장하기'}).click();
  await expect(page.getByRole('button',{name:'보관함에 저장하기'})).toBeEnabled();
  const frameCount = await page.evaluate(async()=>{
    const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('naezzal4zzal-gallery',2);r.onsuccess=()=>resolve(r.result);r.onerror=reject;});
    const items=await new Promise(resolve=>{const r=db.transaction('saved-gifs').objectStore('saved-gifs').getAll();r.onsuccess=()=>resolve(r.result);});db.close();
    const decoder=new ImageDecoder({data:await items[0].gifBlob.arrayBuffer(),type:'image/gif'});await decoder.tracks.ready;const count=decoder.tracks.selectedTrack.frameCount;decoder.close();return count;
  });
  expect(frameCount).toBeGreaterThan(1);
  await page.reload();await page.getByRole('button',{name:'💗 내 보관함'}).click();
  await expect(page.locator('img[alt="오늘의 움직이는 네컷 추억"]')).toHaveCount(1);
  await page.screenshot({path:'test-results/saved-gallery.png',fullPage:true});
  expect(requests).toBe(0);expect(errors).toEqual([]);
});
test('AI network failure falls back to manual editing',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/extract-cells',r=>r.abort('failed'));
  await upload(page);await page.getByRole('button',{name:'사진 전송에 동의하고 AI로 찾기'}).click();
  await expect(page.getByRole('heading',{name:'직접 맞추기 · 임시 배치'})).toBeVisible();
  await expect(page.getByRole('button',{name:'움짤 만들기',exact:true})).toBeEnabled();expect(errors).toEqual([]);
});
test('AI rectangles are used independently',async({page})=>{
  await page.route('**/api/extract-cells',r=>r.fulfill({json:{layout:'1x4',cells:[0,1,2,3].map(i=>({x:350,y:10+i*250,width:300,height:230}))}}));
  await upload(page);await page.getByRole('button',{name:'사진 전송에 동의하고 AI로 찾기'}).click();
  await expect(page.getByRole('heading',{name:'AI가 찾은 네 컷'})).toBeVisible();
  await page.getByText('사진 영역 직접 조정하기',{exact:true}).click();
  await expect(page.locator('section[aria-label="원본에서 네 컷 테두리 맞추기"] span[data-resize]')).toHaveCount(4);
});
