import fs from 'node:fs';
import { chromium } from '@playwright/test';
const input = process.argv[2];
if (!input || !fs.existsSync(input)) throw new Error('A local photo path is required');
const browser = await chromium.launch({channel:'chrome'});
try {
 const page = await browser.newPage({viewport:{width:390,height:844}});
 let captured;
 await page.route('**/api/extract-cells', async route=>{captured=route.request().postData(); await route.fulfill({json:{layout:'unknown',cells:[]}});});
 await page.goto('http://127.0.0.1:5173/');
 await page.getByRole('button',{name:'🖼️ 불러오기'}).waitFor();
 await page.locator('input[type=file]').nth(1).setInputFiles(input);
 await page.getByRole('button',{name:'사진 전송에 동의하고 AI로 찾기'}).click();
 await page.getByRole('heading',{name:'직접 맞추기 · 임시 배치'}).waitFor();
 if (!captured) throw new Error('No analysis request captured');
 fs.mkdirSync('artifacts/real-photo',{recursive:true});
 fs.writeFileSync('artifacts/real-photo/request.json',captured);
 const source = await page.locator('img[alt="인화지 원본과 선택한 네 컷 영역"]').getAttribute('src');
 fs.writeFileSync('artifacts/real-photo/source.jpg',Buffer.from(source.split(',')[1],'base64'));
 const image=JSON.parse(captured).image;
 fs.writeFileSync('artifacts/real-photo/input.jpg',Buffer.from(image.split(',')[1],'base64'));
 console.log(JSON.stringify({prepared:true,requestBytes:Buffer.byteLength(captured)}));
} finally { await browser.close(); }
