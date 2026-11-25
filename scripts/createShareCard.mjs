import { chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';
const asset=async(path,type)=>'data:'+type+';base64,'+(await readFile(path)).toString('base64');
const art=await asset('public/launch/login-illustration.jpg','image/jpeg');
const logo=await asset('public/launch/logo.png','image/png');
const font=await asset('public/launch/body.ttf','font/woff2');
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome'});
try {
const page=await browser.newPage({viewport:{width:1200,height:630},deviceScaleFactor:1});
await page.setContent(`<!doctype html><html lang="ko"><meta charset="utf-8"><style>
@font-face{font-family:brand;src:url(${font})}*{box-sizing:border-box}body{margin:0;width:1200px;height:630px;background:#fff3f8;color:#5e3c59;font-family:brand,sans-serif;padding:36px 54px}header{display:flex;align-items:center;justify-content:space-between}header img{width:220px}header span{font-size:22px;color:#986b8b}h1{margin:18px 0 8px;font-size:46px;letter-spacing:-2px;color:#eb3278}h2{font-size:23px;font-weight:400;margin:0 0 24px}main{display:flex;gap:22px}.card{position:relative;flex:1;background:white;border:1px solid #f1d8e4;border-radius:26px;padding:14px;box-shadow:0 8px 20px #d49ab21a}.art{height:208px;border-radius:16px;background:#fbe4eb url(${art}) 17% 7% / 310% auto no-repeat}.draw .art{background-position:87% 11%}.gif .art{transform:rotate(-2deg);border:7px solid #ffe4ef}.loop{position:absolute;right:25px;top:166px;border-radius:50%;width:54px;height:54px;background:#f5337e;color:white;text-align:center;line-height:50px;font-size:44px}.label{display:flex;align-items:center;justify-content:space-between;margin:15px 4px 4px;font-size:23px}.label span{font-size:15px;padding:5px 10px;background:#fff0f6;border-radius:20px;color:#dc3779}.draw .label{color:#7549ae}.draw .label span{background:#eee5fc;color:#7549ae}footer{display:flex;justify-content:space-between;font-size:17px;color:#986b8b;margin-top:22px}
</style><header><img src="${logo}" alt="내짤4짤"><span>사진 속 추억에 움직임을 더해요</span></header><h1>네 컷 사진을 짤과 영상으로!</h1><h2>친구와의 추억을 공유하는 새로운 방법, 내짤4짤</h2><main><div class="card gif"><div class="art"></div><div class="loop">↻</div><div class="label">움직이는 GIF<span>무료</span></div></div><div class="card"><div class="art"></div><div class="label">AI 실사 영상<span>생생하게</span></div></div><div class="card draw"><div class="art"></div><div class="label">AI 애니메이션<span>손그림으로</span></div></div></main><footer><span>사진 편집 · 제작 · 저장 · 공유</span><span>4zzal.com</span></footer></html>`);
await page.evaluate(()=>document.fonts.ready);
await page.screenshot({path:'public/share-card-v6.png'});
}finally{await browser.close();}
