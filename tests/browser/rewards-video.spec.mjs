import {readFileSync} from "node:fs";
import {test,expect} from '@playwright/test';
async function upload(page) {
 await page.goto('/');
 await page.getByRole('button',{name:'🖼️ 불러오기'}).waitFor();
 const data=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=400;c.height=1200;const ctx=c.getContext('2d');['#e35555','#55a566','#5577dd','#e9bd49'].forEach((color,i)=>{ctx.fillStyle=color;ctx.fillRect(0,i*300,400,300)});return c.toDataURL('image/png').split(',')[1]});
 await page.locator('input[type=file]').nth(1).setInputFiles({name:'synthetic.png',mimeType:'image/png',buffer:Buffer.from(data,'base64')});
 await page.getByRole('button',{name:'사진 전송 없이 직접 맞추기'}).click();
 await page.getByRole('heading',{name:'직접 맞추기 · 임시 배치'}).waitFor();
}
async function gif(page) {
 await page.getByRole('button',{name:'움짤 만들기',exact:true}).click();
 await page.getByRole('button',{name:'헐레벌떡 GIF',exact:true}).click();
 await page.getByRole('button',{name:/기본 핑크 프레임/}).click();
 await expect(page.getByRole('button',{name:'공유하기',exact:true})).toBeEnabled({timeout:30000});
}
test('cancel does not reward; six successful shares unlock styles and frames; gallery shares use same record',async({page})=>{
 test.setTimeout(90000);page.on('dialog',d=>d.accept());
 await page.addInitScript(()=>{
  window.testShareMode='cancel';window.sharedTypes=[];
  Object.defineProperty(navigator,'canShare',{value:()=>true,configurable:true});
  Object.defineProperty(navigator,'share',{value:async data=>{if(window.testShareMode==='cancel')throw new DOMException('cancel','AbortError');window.sharedTypes.push(data.files[0].type)},configurable:true});
 });
 await upload(page);await gif(page);
 await page.getByRole('button',{name:'공유하기',exact:true}).click();
 await expect(page.getByText('공유를 취소했어요. 공유 횟수는 그대로예요.')).toBeVisible();
 expect(await page.evaluate(()=>localStorage.getItem('naezzal4zzal-share-count'))).toBeNull();
 await page.evaluate(()=>window.testShareMode='success');
 for(let i=1;i<=6;i++){await page.getByRole('button',{name:'공유하기',exact:true}).click();await expect(page.getByText(new RegExp('공유 '+i+'회 ·'))).toBeVisible();}
 await page.getByRole('button',{name:'다른 스타일로 다시 만들기'}).click();
 await expect(page.getByRole('button',{name:'흔들흔들 GIF',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'샤방샤방 GIF',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'아련아련 GIF',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'헐레벌떡 GIF',exact:true}).click();
 await expect(page.getByRole('button',{name:'봄날 프레임',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'가을 프레임',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'필름 프레임',exact:true}).click();
 await page.getByRole('button',{name:'보관함에 저장하기'}).click();
 await expect(page.getByRole('button',{name:'보관함에 저장하기'})).toBeEnabled();
 await page.reload();await page.getByRole('button',{name:'💗 내 보관함'}).click();
 await page.locator('img[alt="오늘의 움직이는 네컷 추억"]').click();
 await expect(page.getByRole('button',{name:'공유하기',exact:true})).toBeEnabled();
 await page.evaluate(()=>window.testShareMode='success');
 await page.getByRole('button',{name:'공유하기',exact:true}).click();
 await expect(page.getByText(/이 기기의 공유 기록 7회/)).toBeVisible();
 await page.getByRole('button',{name:'기기에 저장하기',exact:true}).click();
 expect(await page.evaluate(()=>localStorage.getItem('naezzal4zzal-share-count'))).toBe('7');
});
test('download fallback only rewards after explicit sent confirmation, once',async({page})=>{
 await page.addInitScript(()=>Object.defineProperty(navigator,'canShare',{value:()=>false,configurable:true}));
 await upload(page);await gif(page);
 const download=page.waitForEvent('download');
 await page.getByRole('button',{name:'공유하기',exact:true}).click();await download;
 expect(await page.evaluate(()=>localStorage.getItem('naezzal4zzal-share-count'))).toBeNull();
 await page.getByRole('button',{name:'아직 보내지 않았어요',exact:true}).click();
 expect(await page.evaluate(()=>localStorage.getItem('naezzal4zzal-share-count'))).toBeNull();
 await page.getByRole('button',{name:'공유하기',exact:true}).click();
 await page.getByRole('button',{name:'친구에게 보냈어요 · 보상 받기'}).click();
 await expect(page.getByText('공유 1회 · 흔들흔들 GIF가 열렸어요 ✨')).toBeVisible();
 expect(await page.evaluate(()=>localStorage.getItem('naezzal4zzal-share-count'))).toBe('1');
});
test('video consent, same-request retry, polling and reload recovery never auto-submit another video',async({page})=>{
 let posts=0,gets=0,requestId,received;
 await page.route('**/api/videos**',async route=>{
  const req=route.request();
  if(req.url().includes('action=config'))return route.fulfill({json:{available:true}});
  if(req.method()==='POST'){
   posts++;received=req.postDataJSON();
   if(posts===1){requestId=received.requestId;return route.fulfill({status:504,json:{error:'연결 지연'}});}
   expect(received.requestId).toBe(requestId);
   return route.fulfill({status:202,json:{token:'test-signed-token',status:'pending'}});
  }
  gets++;expect(req.headers().authorization).toBe('Bearer test-signed-token');
  return route.fulfill({json:gets===1?{status:'processing'}:{status:'failed',error:'제작 실패 시험'}});
 });
 await upload(page);await page.getByRole('button',{name:'🎬 AI 영상 만들기'}).click();
 const start=page.getByRole('button',{name:'동의하고 5초 영상 제작'});
 await expect(start).toBeDisabled();
 await page.getByLabel('사무실 테스트 코드').fill('office-test');
 await page.getByRole('checkbox').check();await expect(start).toBeEnabled();await start.click();
 await expect(page.getByText('연결 지연',{exact:true})).toBeVisible();
 await start.click();await expect(page.getByText('✨ 영상 제작 중')).toBeVisible();
 expect(received.images).toHaveLength(4);expect(received.consent).toBe(true);expect(received.variant).toBe('memory');
 await page.reload();await upload(page);await page.getByRole('button',{name:'🎬 AI 영상 만들기'}).click();
 await expect(page.getByText('제작 실패 시험',{exact:true})).toBeVisible();
 expect(posts).toBe(2);expect(gets).toBeGreaterThanOrEqual(2);
 await page.screenshot({path:'test-results/video-panel.png',fullPage:true});
});

test('completed MP4 plays, downloads, persists in gallery, and shares as a video file',async({page})=>{
 page.on('dialog',d=>d.accept());
 await page.addInitScript(()=>{
  Object.defineProperty(navigator,'canShare',{value:()=>true,configurable:true});
  Object.defineProperty(navigator,'share',{value:async data=>{window.sharedVideoType=data.files[0].type},configurable:true});
 });
 await page.goto('/');
 const bytes=readFileSync(new URL("../fixtures/share-test.mp4",import.meta.url));
 expect(bytes.length).toBeGreaterThan(0);
 await page.route('**/api/videos**',async route=>{
  const req=route.request();
  if(req.url().includes('action=config'))return route.fulfill({json:{available:true}});
  if(req.url().includes('action=file'))return route.fulfill({contentType:'video/mp4',body:Buffer.from(bytes)});
  if(req.method()==='POST')return route.fulfill({status:202,json:{token:'test-completed-token',status:'pending'}});
  return route.fulfill({json:{status:'completed',videoUrl:'https://video.example.test/result.mp4'}});
 });
 await page.route('https://video.example.test/result.mp4',route=>route.fulfill({contentType:'video/mp4',body:Buffer.from(bytes)}));
 await upload(page);await page.getByRole('button',{name:'🎬 AI 영상 만들기'}).click();
 await page.getByLabel('사무실 테스트 코드').fill('office-test');await page.getByRole('checkbox').check();
 await page.getByRole('button',{name:'동의하고 5초 영상 제작'}).click();
 const video=page.getByLabel('완성된 AI 영상');
 await expect(video).toHaveAttribute('src',/^blob:/);
 await expect.poll(()=>video.evaluate(v=>v.readyState)).toBeGreaterThanOrEqual(2);
 await expect(page.getByRole('button',{name:'기기에 저장하기',exact:true})).toBeEnabled();
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'기기에 저장하기',exact:true}).click();expect((await download).suggestedFilename()).toBe('naezzal4zzal.mp4');
 expect(await page.evaluate(()=>localStorage.getItem('naezzal4zzal-share-count'))).toBeNull();
 await page.getByRole('button',{name:'영상 보관함에 저장하기'}).click();
 await expect(page.getByRole('button',{name:'보관함 저장 완료'})).toBeDisabled();
 await page.reload();await page.getByRole('button',{name:'💗 내 보관함'}).click();
 await page.locator('video').click();
 await expect(page.getByRole('button',{name:'공유하기',exact:true})).toBeEnabled();
 await page.getByRole('button',{name:'공유하기',exact:true}).click();
 expect(await page.evaluate(()=>window.sharedVideoType)).toBe('video/mp4');
 expect(await page.evaluate(()=>localStorage.getItem('naezzal4zzal-share-count'))).toBe('1');
 await page.screenshot({path:'test-results/video-gallery.png',fullPage:true});
});

test('animal variant is optional, asks for consent again, and submits the four photos with its own choice',async({page})=>{
 let received;
 await page.route('**/api/videos**',async route=>{
  if(route.request().url().includes('action=config'))return route.fulfill({json:{available:true}});
  if(route.request().method()==='POST'){received=route.request().postDataJSON();return route.fulfill({status:202,json:{token:'animals-token',status:'pending'}});}
  return route.fulfill({json:{status:'processing',variant:'animals'}});
 });
 await upload(page);await page.getByRole('button',{name:'🎬 AI 영상 만들기'}).click();
 await expect(page.getByRole('radio',{name:'기본 · 인물 그대로'})).toBeChecked();
 await page.getByLabel('사무실 테스트 코드').fill('office-test');await page.getByRole('checkbox').check();
 await page.getByRole('radio',{name:'귀여운 동물 변신'}).check();await expect(page.getByRole('checkbox')).not.toBeChecked();
 await page.getByRole('checkbox').check();await page.getByRole('button',{name:'동의하고 5초 영상 제작'}).click();
 await expect(page.getByText('✨ 영상 제작 중')).toBeVisible();expect(received.variant).toBe('animals');expect(received.images).toHaveLength(4);
});
