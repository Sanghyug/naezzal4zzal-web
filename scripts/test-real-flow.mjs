import fs from 'node:fs';import {chromium} from '@playwright/test';
const browser=await chromium.launch({channel:'chrome'});try{
 const page=await browser.newPage({viewport:{width:390,height:844}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 let result;
 page.on('response',async response=>{if(response.url().endsWith('/api/extract-cells')){result=await response.json();fs.writeFileSync('artifacts/real-photo/response.json',JSON.stringify(result,null,2));}});
 await page.goto('http://127.0.0.1:5173/');
 await page.getByRole('button',{name:'🖼️ 불러오기'}).waitFor();
 await page.locator('input[type=file]').nth(1).setInputFiles(process.argv[2]);
 await page.getByRole('button',{name:'사진 전송에 동의하고 AI로 찾기'}).click();
 await page.getByRole('heading',{name:'AI가 찾은 네 컷'}).waitFor({timeout:60000});
 await page.screenshot({path:'artifacts/real-photo/actual-editor.png',fullPage:true});
 const boxes=await page.locator('span[data-resize]').evaluateAll(spans=>spans.map(span=>{const style=span.parentElement.style;return {left:style.left,top:style.top,width:style.width,height:style.height}}));
 fs.writeFileSync('artifacts/real-photo/displayed-boxes.json',JSON.stringify(boxes,null,2));
 await page.getByRole('button',{name:'움짤 만들기',exact:true}).click();
 await page.getByRole('button',{name:'헐레벌떡 GIF',exact:true}).click();
 await page.getByRole('button',{name:/기본 핑크 프레임/}).click();
 const image=page.locator('img[src^="data:image/gif"]');await image.waitFor({timeout:40000});
 const url=await image.getAttribute('src');fs.writeFileSync('artifacts/real-photo/result.gif',Buffer.from(url.split(',')[1],'base64'));
 const count=await page.evaluate(async url=>{const buffer=await(await fetch(url)).arrayBuffer();const decoder=new ImageDecoder({data:buffer,type:'image/gif'});await decoder.tracks.ready;const count=decoder.tracks.selectedTrack.frameCount;decoder.close();return count;},url);
 fs.writeFileSync('artifacts/real-photo/verification.json',JSON.stringify({model:result?.model,rawCells:result?.cells?.length,gifFrameCount:count,pageErrors:errors},null,2));
 console.log(JSON.stringify({model:result?.model,rawCells:result?.cells?.length,gifFrameCount:count,pageErrors:errors}));
}finally{await browser.close();}
