import fs from 'node:fs';
import { chromium } from '@playwright/test';
const browser = await chromium.launch({channel:'chrome'});
try {
 const page = await browser.newPage();
 const source = fs.readFileSync('public/favicon-512.png').toString('base64');
 const icon = await page.evaluate(async source=>{
  const image=new Image();image.src='data:image/png;base64,'+source;await image.decode();
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=1024;
  const context=canvas.getContext('2d');context.fillStyle='#ffffff';context.fillRect(0,0,1024,1024);context.drawImage(image,0,0,1024,1024);
  return canvas.toDataURL('image/png').split(',')[1];
 },source);
 fs.writeFileSync('ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png',Buffer.from(icon,'base64'));
} finally { await browser.close(); }
